import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { LogTailer } from './tailer.js';
import { Parser } from './parser.js';
import { EncounterTracker, DAMAGE_KINDS, forma } from './encounter.js';
import { Casteos } from './casteos.js';
import { TriggerEngine } from './triggers.js';
// El recuento de muertes por nombre, compartido con las figuras del reproductor.
import { muertesPorNombre } from './suelo.js';
import { advise, liveAdvice } from './advisor.js';
import { Narrator } from './narrator.js';
import { setLang } from './i18n.js';
import { FightStore, MODELO_MEDICION } from './store.js';
import { Encyclopedia } from './encyclopedia.js';
import { aggregate, mergePets, mergeOwnerPets, ownerPets, ensureSides } from './aggregate.js';
import { inferClasses, availableFor, normStance, normInvocation, STANCES, INVOCATIONS,
  SIN_MITIGACION } from './stances.js';
import { parseZone } from './zones.js';
import { catalog, spellDetail, spellbook } from './catalog.js';
import { proofOf } from './classes.js';
import { normalizeTrios } from './trios.js';
import { t } from './i18n.js';
import { baseSpell } from './spells.js';

/**
 * Dónde buscar el log.
 *
 * La ruta cambia por completo entre instalaciones, así que se recorren todas
 * las unidades con una lista de subrutas probables. No se escanea el disco
 * entero: sería lento y molesto. Si aun así no aparece, está el botón de
 * buscar el fichero a mano.
 */
const SUBPATHS = [
  'EVERQUEST LEGENDS\\Logs',
  'EverQuest Legends\\Logs',
  'Games\\EverQuest Legends\\Logs',
  'Program Files\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'Program Files (x86)\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'SteamLibrary\\steamapps\\common\\EverQuest Legends\\Logs',
  'Steam\\steamapps\\common\\EverQuest Legends\\Logs',
];

function drives() {
  if (process.platform !== 'win32') return ['/'];
  const out = [];
  for (let i = 67; i <= 90; i++) {           // C: hasta Z:
    const d = `${String.fromCharCode(i)}:\\`;
    try { fs.accessSync(d); out.push(d); } catch { /* unidad ausente */ }
  }
  return out;
}

/** Carpetas candidatas: subrutas conocidas más lo que haya en la raíz. */
function candidateDirs() {
  const dirs = [];
  for (const d of drives()) {
    for (const sub of SUBPATHS) dirs.push(path.join(d, sub));
    // Un vistazo a la raíz por si la carpeta se llama de otra forma.
    try {
      for (const name of fs.readdirSync(d)) {
        if (/everquest.*legend/i.test(name)) dirs.push(path.join(d, name, 'Logs'));
      }
    } catch { /* sin permisos de lectura en la raíz */ }
  }
  return dirs;
}

/** Busca el eqlog_*.txt modificado más recientemente. */
export function findLog(extraDirs = []) {
  const found = [];
  const seen = new Set();
  for (const dir of [...extraDirs, ...candidateDirs()]) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!/^eqlog_.+\.txt$/i.test(f)) continue;
        const full = path.join(dir, f);
        found.push({ path: full, mtime: fs.statSync(full).mtimeMs });
      }
    } catch { /* carpeta inexistente, siguiente */ }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found;
}

/** eqlog_Campeon_erudin.txt -> { character: 'Campeon', server: 'erudin' } */
export function parseLogName(p) {
  const m = /^eqlog_([^_]+)_(.+)\.txt$/i.exec(path.basename(p));
  return m ? { character: m[1], server: m[2] } : { character: null, server: null };
}

/** Cuántas peleas cerradas conserva el overlay. Las de abajo se caen. */
const OVERLAY_FIGHTS = 10;

/**
 * Identidad de una pelea DENTRO de la sesión, para el overlay.
 *
 * No vale el `id` a secas: al reconectar el log vuelve a empezar por 1 y un
 * bloque nuevo se confundiría con uno que ya está en la pila. Con el instante
 * de inicio delante no se repite.
 */
export const fightKey = (f) => (f ? `${f.id}@${Math.round(f.start ?? 0)}` : null);

/**
 * Lo que el overlay necesita de una pelea cerrada, y ni un campo más.
 *
 * Una pelea completa ocupa entre 10 y 30 KB —lo que ocupa en el almacén—, y al
 * overlay le llega un envío cada medio segundo. Mandar las diez últimas en cada
 * envío serían cientos de kilobytes por segundo para unas cifras que sólo
 * cambian cuando termina un combate. Se recorta una vez, al cerrar, y se manda
 * una sola vez por su propio canal.
 *
 * Las filas conservan los NOMBRES de los campos que trae la pelea viva, para
 * que el overlay pinte las dos con el mismo código: lo único que las distingue
 * es de dónde vienen.
 */
export function overlayFight(f) {
  if (!f) return null;
  return {
    key: fightKey(f), label: f.label, duration: f.duration, at: Date.now(),
    total: f.total, enemyTotal: f.enemyTotal, dead: f.dead ?? {},
    rows: (f.rows ?? []).map((r) => ({
      name: r.name, side: r.side, charmed: r.charmed === true,
      damage: r.damage, dps: r.dps, share: r.share,
      types: r.types, petOf: r.petOf ?? null, max: r.max, crits: r.crits,
      meleeHits: r.meleeHits, misses: r.misses, accuracy: r.accuracy,
      taken: r.taken, healingDone: r.healingDone,
      // Seis: es lo que enseña el desglose al desplegar una fila, ni una más.
      abilities: (r.abilities ?? []).slice(0, 6),
    })),
  };
}

export class Engine extends EventEmitter {
  constructor() {
    super();
    this.tailer = null;
    this.parser = null;
    this.tracker = null;
    this.seq = 0;
    this.path = null;
    this.self = null;
    this.server = null;
    this.status = 'idle';   // idle | reading | monitoring | missing | error
    this.error = null;
    this.classes = null;        // manual; si no, se deduce del log
    // Cuánto tarda cada hechizo, medido mientras se lee. Vive en memoria y no
    // en el almacén: sale de emparejar dos líneas, y las líneas ya están.
    this.casteos = new Casteos();
    this.seenStances = new Set();
    this.seenInvocations = new Set();
    this.whoClasses = null;
    this.whoAt = 0;
    this.level = null;
    this.classConflict = null;
    this.backfilling = false;
    this.lastKill = null;
    // DPS con sentido: por enemigo abatido, desde el primer golpe hasta que cae.
    this.killAgg = new Map();   // nombre -> {damage, seconds, kills}
    this.recentHits = [];       // {t, name, amount} de los últimos 20 s
    // Cooldowns medidos y usos, acumulados al leer. El aviso de reutilización
    // es una línea suelta que no pertenece a ninguna pelea, así que si no se
    // anota al pasar se pierde.
    this.cooldowns = new Map();
    // Última vez que cada clase se demostró con un hechizo exclusivo suyo.
    this.lastProof = new Map();
    this.classPrompt = null;      // contradicción pendiente de que escribas /who
    this.promptedClass = null;    // para no repetir el aviso por cada hechizo
    this.classSourceAt = null;    // de dónde salió el trío: /who, inferido o manual
    this.petPrompted = new Set();  // nombres por los que ya se ha pedido el comando
    this.whoSeen = new Set();      // jugadores de los que hay un /who: no son desconocidos
    this.trios = [];              // tabla declarada a mano; manda sobre todo
    this.trioIdx = 0;
    this.trioActive = null;
    this.knownPets = new Set();  // todas las vistas alguna vez, entre sesiones
    this.petsSaved = 0;
    this.notMine = new Set();    // aliados que ya dijiste que no son tuyos
    // Compañeros de grupo: declarados por ti o detectados por el canal.
    //
    // Aquí ponía que el log no da ninguna señal de grupo —«ni invitaciones, ni
    // entradas, ni salidas: se buscó y no hay nada»— y era FALSO. Quien habla
    // por el canal de grupo está en tu grupo, y esas líneas ya se analizaban
    // para leerlas en voz alta. El comentario, escrito cuando se buscaron
    // mensajes de sistema y no se encontraron, impidió durante meses ver que la
    // señal estaba en el chat.
    //
    // Lo que sigue siendo cierto es lo otro: un jugador que pega a tus enemigos
    // y no habla no se distingue de uno que pasaba por allí, así que para ése
    // la única vía sigue siendo declararlo.
    //
    // De dónde salió cada uno se guarda y se enseña, como con las clases: no es
    // lo mismo lo que has dicho tú que lo que se ha deducido.
    //
    // ESTO NO ENTRA EN #mine(). Ahí sólo van tú y tus mascotas, porque #mine()
    // decide si una pelea SE ABRE, y tu mascota pegando eres tú pegando
    // mientras que tu compañero pegando no lo es. Metiéndolos ahí, una pelea
    // suya al otro lado de la sala se guardaría como tuya — el mismo fallo que
    // dieron los nombres de mascota reciclados, pero declarado y permanente.
    // Un compañero declarado dice QUIÉN ES, no que su pelea sea tuya.
    this.companions = new Set();
    /** Quién ha hablado por el canal de grupo en esta sesión. */
    this.groupSeen = new Set();
    this.storePath = null;      // fichero de peleas guardadas
    this.store = null;
    this.history = [];          // peleas cerradas, la más reciente primero
    // Contador de cambios del histórico: sube cada vez que una pelea llega al
    // almacén o que se cambia de almacén. Es la señal que usa la lista para
    // saber que tiene que releer el índice.
    //
    // Antes esa señal era `history.length`, y `history` está recortada a 60. Con
    // 60 peleas guardadas o más la longitud ya no volvía a cambiar nunca —
    // unshift y recorte la dejan igual—, así que la lista dejaba de refrescarse
    // y las peleas nuevas no aparecían hasta tocar el filtro o reiniciar. Se
    // veían en directo y desaparecían al cerrarse. Estaban guardadas: no se
    // enseñaban.
    this.storeSeq = 0;
    // Las últimas peleas cerradas, recortadas para el overlay. Van por su
    // propio canal y no en el snapshot: ver overlayFight().
    this.closedFights = [];
    this.saveTimer = null;
    this.foes = new Set();
    this.recent = [];           // daño recibido reciente, para el consejo en vivo
    this.windowSec = 20;
    // Los disparadores viven fuera del ciclo de attach: sobreviven
    // a un cambio de log y siguen activos aunque no haya combate.
    this.triggers = new TriggerEngine();
    this.triggers.on('alert', (a) => this.emit('alert', a));
    // El narrador vive fuera del attach, como los disparadores.
    this.narrator = new Narrator();
    this.narrator.on('say', (a) => this.emit('alert', a));
  }

  attach(logPath, opts = {}) {
    this.detach();
    const { character, server } = parseLogName(logPath);
    this.path = logPath;
    this.self = opts.self || character;
    this.server = server;
    // Quién eres se sabe aquí y no al abrir el almacén, y hay un campo del
    // resumen —tu daño en cada pelea— que sin eso no se puede rellenar. Se
    // recalcula leyendo el histórico que ya está guardado; el log no se toca.
    if (this.store) {
      this.store.self = this.self;
      this.storeBackfill = this.store.backfill(this.self);
    }
    this.seq = 0;
    this.error = null;
    // La tabla manual se reproduce desde el principio: al releer el log los
    // tramos tienen que aplicarse en su momento, no todos de golpe al final.
    this.trioIdx = 0;
    this.trioActive = null;

    // El contador de los disparadores viaja con el registro del que sale: hay un
    // botón de cambiar de log y una etiqueta que dijera «visto 33 veces» sobre
    // el registro de otro personaje sería identidad colgada de algo que se
    // cambia debajo. Ver `registro()` en `src/triggers.js`.
    this.triggers.registro(logPath);
    this.parser = new Parser({ self: this.self });
    this.narrator.setSelf(this.self);
    this.narrator.setPets([]);
    // Lo que declaraste tuyo se le devuelve al analizador recién creado. El
    // analizador se rehace en cada enganche, así que sin esto una mascota
    // marcada a mano se perdía en cuanto se reiniciaba o se cambiaba de log.
    for (const n of opts.myPets ?? []) this.parser.markPet(n);
    for (const n of opts.notPets ?? []) this.parser.unmarkPet(n);
    // Y los compañeros, por lo mismo: el rastreador es nuevo en cada enganche.
    if (opts.companions?.length) {
      this.companions = new Set(opts.companions);
      this.store?.setCompanions(this.companions);
    }
    this.tracker = new EncounterTracker({
      self: this.self,
      idleSec: opts.idleSec ?? 20,
      closeOnDeath: opts.closeOnDeath ?? false,
      // La forma buena del nombre sale del parser, que la aprende leyendo.
      formaDe: (n) => this.parser?.formaAtestiguada(n) ?? null,
    });
    this.tracker.setCompanions(this.companions);
    this.tracker.on('close', (enc) => {
      const f = this.#enc(enc);
      let cerrada = null;              // la versión recortada, para el overlay
      this.narrator.fightEnd(f);
      for (const n of this.parser?.pets.keys() ?? []) this.knownPets.add(n);
      if (f && (f.total > 0 || f.enemyTotal > 0)) {
        // La hora de la PELEA, no la de importarla: si no, al reconstruir el
        // almacén releyendo el log, todo queda fechado en el mismo instante y
        // los filtros por tramo dejan de significar nada.
        const at = Math.round((f.start ?? Date.now() / 1000) * 1000);
        const sum = this.store?.append(f, at) ?? f;
        // La enciclopedia se aprende aquí, con la pelea en la mano, y no cuando
        // alguien la abre. Se le pasa el resumen porque `uid` es lo que impide
        // contar dos veces la misma pelea al releer el log.
        this.enc?.fold(f, sum);
        this.history.unshift(sum);
        if (this.history.length > 60) this.history.length = 60;
        this.storeSeq++;
        this.saveStore();
        // El overlay apila las peleas cerradas: la misma condición que para
        // guardarla, así lo que se ve arriba es lo que hay en la lista.
        //
        // Durante la relectura del histórico no se apila nada: son peleas de
        // hace horas y aparecerían como si acabaran de terminar.
        if (!this.backfilling) {
          cerrada = overlayFight(f);
          this.closedFights.unshift(cerrada);
          if (this.closedFights.length > OVERLAY_FIGHTS) this.closedFights.length = OVERLAY_FIGHTS;
        }
      } else if (f) {
        // Una pelea sin daño no se guarda, y está bien: no describe nada. Pero
        // el botín que se recogiera dentro sí existe, y se iba con ella.
        //
        // Un caso medido, un `Rusty Long Sword` de un esqueleto: algo abrió la
        // pelea, nadie llegó a pegar, y el objeto desapareció sin salir en
        // ningún contador. Va al mismo sitio que el botín sin pelea, que es lo
        // que es — la pelea a la que se colgó no llegó a existir.
        for (const l of f.loot ?? []) {
          if (!l?.item) continue;
          this.store?.appendLoot({
            ...l, via: 'suelto', porQue: 'pelea-sin-dano', de: null,
            t: (f.start ?? 0) + (l.t ?? 0),
            at: Math.round(((f.start ?? Date.now() / 1000) + (l.t ?? 0)) * 1000),
            zone: f.zone ?? null, zoneBase: f.zoneBase ?? null,
            diff: f.diff ?? null, diffTag: f.diffTag ?? null,
          });
          this.storeSeq++;
        }
        // Y la moneda de esa pelea que no llegó a existir, por lo mismo: es
        // dinero que tienes. Sin esto volvería a pasar lo del `Rusty Long
        // Sword`, sólo que en platino y sin nadie mirando.
        for (const c of f.coins ?? []) {
          this.store?.appendCoin({
            cp: c.cp ?? 0, raw: c.raw ?? null, de: null,
            t: (f.start ?? 0) + (c.t ?? 0), zone: f.zone ?? null,
          });
          this.storeSeq++;
        }
      }
      this.petPrompt(f);
      this.emit('encounter', cerrada);
    });
    this.tracker.on('open', () => { this.foes.clear(); this.narrator.fightStart(); });
    // Botín sin pelea: va derecho al almacén, por su cuenta.
    //
    // No se cuelga de la pelea anterior ni de la siguiente: el último cierre
    // podía ser ocho minutos antes y en otra zona, así que atribuírselo sería
    // inventar. Y no se descarta, que es lo que pasaba: son objetos que tienes.
    this.tracker.on('orphanLoot', (e) => {
      if (this.backfilling) { /* precargado: igual entra, es un hecho del registro */ }
      const z = e.zone ? parseZone(e.zone) : null;
      this.store?.appendLoot({
        ...e, de: null, at: Math.round((e.t ?? Date.now() / 1000) * 1000),
        zoneBase: z?.base ?? null, diff: z?.diff ?? null, diffTag: z?.tag ?? null,
      });
      this.storeSeq++;
    });
    /**
     * BOTÍN TARDÍO: el cadáver murió en una pelea que ya está cerrada.
     *
     * Va al MISMO fichero que el suelto y con la misma forma, más un campo `de`
     * con la hora de su pelea. Dos ficheros para dos clases de lo mismo sólo
     * darían dos sitios donde buscar el mismo objeto.
     *
     * Y NO se mete dentro de la pelea guardada, aunque ahora se sepa cuál es:
     * `fights.ndjson` sólo crece por el final y `uid` ES el byte de inicio, así
     * que reescribir una línea correría todas las siguientes y dejaría el índice
     * —y el `lastUid` de la enciclopedia— apuntando a sitios equivocados. Es la
     * misma regla que ya siguen `tramos.ndjson` y `dudas.ndjson`: lo que llega
     * después de guardar una pelea vive al lado, indexado por su hora.
     */
    this.tracker.on('lateLoot', (e) => {
      const z = e.zone ? parseZone(e.zone) : null;
      this.store?.appendLoot({
        ...e, at: Math.round((e.t ?? Date.now() / 1000) * 1000),
        zoneBase: z?.base ?? null, diff: z?.diff ?? null, diffTag: z?.tag ?? null,
      });
      this.storeSeq++;
    });
    // Moneda recogida sin ninguna pelea abierta. No se le puede buscar cadáver
    // —la línea no lo nombra— así que aquí no hay nada que deducir: se guarda
    // como lo que es, dinero tuyo sin pelea, y la ficha no lo cuenta en ninguna.
    this.tracker.on('orphanCoin', (e) => {
      this.store?.appendCoin({ ...e, de: null });
      this.storeSeq++;
    });
    // Acumulador de sesión: mismos eventos, pero no se cierra nunca. Es la
    // referencia de cómo llevas la sesión, y sólo se pone a cero cuando tú lo
    // pides. La pila de combates del overlay arranca vacía con cada log: las
    // peleas del anterior no son de esta sesión.
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });
    this.closedFights = [];

    // Se recupera lo guardado de ESTE log y se reanuda por donde iba, así que
    // sólo se relee lo que se escribió mientras la aplicación estaba cerrada.
    this.history = this.store ? this.store.filter({ limit: 60 }) : [];
    this.storeSeq++;
    let resume = opts.fromStart ? null : this.#resumeOffset(logPath);

    // Primera vez con este log: sin nada guardado y sin punto de reanudación,
    // se lee entero aunque no lo pidas. Depender de una casilla para algo que
    // sólo tiene una respuesta razonable es pedirle al usuario que adivine.
    // Basta con que el almacén esté vacío: si quedó un punto de reanudación
    // de una sesión anterior pero no hay peleas guardadas, seguir desde ahí
    // dejaría el histórico vacío para siempre.
    const firstTime = !opts.fromStart && (this.store?.index.length ?? 0) === 0;
    if (firstTime) { opts = { ...opts, fromStart: true }; resume = null; }
    this.autoFullRead = firstTime;

    this.tailer = new LogTailer(logPath, { pollMs: 100, fromStart: !!opts.fromStart, startOffset: resume });
    this.tailer.on('line', (l) => {
      const ev = this.parser.parse(l, this.seq++);
      if (!ev) return;
      this.feedEvent(ev);
    });
    this.tailer.on('waiting', () => { this.status = 'missing'; });
    this.tailer.on('flush', () => { this.status = 'monitoring'; });
    this.tailer.on('error', (e) => { this.status = 'error'; this.error = e.message; });
    /**
     * EL REGISTRO SE HA REINICIADO — y esto lo escucha alguien, que es la mitad
     * que faltaba.
     *
     * `LogTailer` emitía `rotate` desde el primer día y NO lo escuchaba nadie:
     * se podía comprobar buscándolo en `src/`, `ui/` y `electron/` y salía una
     * sola línea, la que lo emite. Salida muerta, que es una de las familias
     * que este proyecto lleva contadas — y la peor versión de ella, porque el
     * aviso existía y daba la sensación de que el caso estaba atendido.
     *
     * Lo que se hace con él es lo único honesto: DECIRLO. Una relectura entera
     * tarda unos segundos —25,5 s medidos sobre 74,6 MB— y sin este aviso la
     * aplicación se queda pensando sin explicar por qué. No se toca ningún
     * contador: quien evita duplicar es la identidad lógica del almacén, no
     * este manejador.
     */
    this.tailer.on('rotate', () => {
      this.rotations = (this.rotations ?? 0) + 1;
      this.rotatedAt = Date.now();
      this.status = 'reading';
    });

    this.status = opts.fromStart ? 'reading' : 'monitoring';
    this.backfilling = true;
    this.narrator.setMuted(true);
    // El precargado va ANTES de arrancar el lector: si no, las primeras líneas
    // nuevas crean peleas antes de que sepamos la zona, la postura o la mascota.
    return Promise.resolve(opts.fromStart ? 0 : this.#primeFromTail(logPath))
      .then(() => this.tailer.start())
      .then(() => {
        // start() no resuelve hasta que ha leído todo lo pendiente, así que
        // aquí el histórico ya está procesado y lo que llegue es de ahora.
        this.backfilling = false;
        this.narrator.setMuted(false);
        this.status = 'monitoring';
        return this.describe();
      });
  }

  /**
   * Al conectar, leer los últimos KB del fichero para recuperar el contexto:
   * tu /who, la zona, la postura activa y las mascotas.
   *
   * No se alimenta al agregador ni al narrador: sólo se actualiza el estado
   * del parser. Si se metiera en el agregador aparecerían peleas viejas como
   * si acabaran de pasar, y el narrador leería en voz alta chat de hace media
   * hora.
   */
  async #primeFromTail(logPath, bytes = 512 * 1024) {
    const before = { parsed: this.parser.parsed, unknown: this.parser.unrecognized };
    try {
      const st = await fsp.stat(logPath);
      const from = Math.max(0, st.size - bytes);
      const fh = await fsp.open(logPath, 'r');
      const buf = Buffer.allocUnsafe(st.size - from);
      await fh.read(buf, 0, buf.length, from);
      await fh.close();
      const lines = buf.toString('latin1').split(/\r?\n/);
      if (from > 0) lines.shift();          // la primera vendrá cortada
      let n = 0;
      for (const line of lines) {
        if (!line) continue;
        const ev = this.parser.parse(line, 0);
        if (!ev) continue;
        n++;
        if (ev.kind === 'who' && ev.who === (this.self ?? 'You') && ev.classes?.length) {
          this.whoClasses = ev.classes;
          this.whoAt = ev.t;
          this.level = ev.level;
        }
        if (ev.kind === 'stance' && ev.stance) this.seenStances.add(ev.stance);
        if (ev.kind === 'invocation' && ev.invocation) this.seenInvocations.add(ev.invocation);
      }
      // El precargado no debe contar como lectura en vivo, pero tampoco puede
      // borrar lo que ya se hubiera leído del fichero al reanudar.
      this.parser.parsed = before.parsed;
      this.parser.unrecognized = before.unknown;
      this.narrator.setPets([...this.parser.pets.keys()]);
      // El agregador tiene su propia zona y no se entera del precargado: sin
      // esto, las peleas de la sesión nacen sin zona hasta el siguiente cambio.
      // Lo que no aparezca en la ventana releída se recupera de lo guardado.
      const saved = this.#resumeInfo(logPath);
      if (!this.parser.zone && saved?.zone) this.parser.zone = saved.zone;
      if (!this.parser.stance && saved?.stance) this.parser.stance = saved.stance;
      if (!this.parser.invocation && saved?.invocation) this.parser.invocation = saved.invocation;

      if (this.parser.zone) {
        if (this.tracker) this.tracker.zone = this.parser.zone;
        if (this.session) this.session.zone = this.parser.zone;
      }
      return n;
    } catch { return 0; }
  }

  detach() {
    this.narrator?.setMuted(false);
    this.tailer?.stop();
    this.tailer = null;
    this.status = 'idle';
    // Lo aprendido y aún no escrito. El temporizador de guardado no llega si se
    // cierra la aplicación justo después de una pelea, y esa pelea se volvería
    // a plegar al arrancar — que es correcto, pero cuesta una lectura de disco
    // por nada.
    this.enc?.flush();
  }

  describe() {
    return {
      path: this.path, self: this.self, server: this.server,
      status: this.status, error: this.error,
      // Veces que el registro se ha reiniciado bajo nosotros en esta sesión, y
      // cuándo fue la última. Va aquí para que el aviso de `rotate` tenga a
      // dónde llegar: sin esto el manejador sería otra salida muerta con un
      // paso más.
      rotations: this.rotations ?? 0,
      rotatedAt: this.rotatedAt ?? null,
      zone: this.parser?.zone ?? null,
      stance: this.parser?.stance ?? null,
      invocation: this.parser?.invocation ?? null,
    };
  }

  /**
   * Un evento ya interpretado, con todo lo que hay que hacer con él.
   *
   * Vive fuera del bucle del lector para que se pueda alimentar a mano: es
   * la única forma de probar la línea de tiempo del nivel y del trío sin
   * un fichero de log de verdad detrás.
   */
  feedEvent(ev) {
    if (!ev) return;
    if (ev.kind === 'pet_claim' || ev.kind === 'pet_leader' || ev.kind === 'pet_order') {
      this.narrator.setPets([...this.parser.pets.keys()]);
      if (this.tracker) this.tracker.petNames = new Set(this.parser.pets.keys());
    }
    if (ev.kind === 'stance' && ev.stance) this.seenStances.add(ev.stance);
    if (ev.kind === 'invocation' && ev.invocation) this.seenInvocations.add(ev.invocation);
    this.#cooldown(ev);
    // Lo que declaraste a mano va por delante de todo lo demás.
    this.#applyTrios(ev.t);
    // El /who de tu propio personaje es la única fuente que no admite dudas.
    if (ev.kind === 'who' && ev.who) this.whoSeen.add(ev.who);
    // ── Compañeros de grupo, detectados por el canal ────────────────────
    //
    // Quien habla por el canal de grupo ESTÁ en tu grupo. Es la señal que se
    // dio por inexistente durante meses —el comentario decía «se buscó y no hay
    // nada»— y estaba en el chat, que ya se analizaba para leerlo en voz alta.
    //
    // Medido sobre un registro real: los emisores del canal `group` son
    // exactamente los dos compañeros que el usuario había declarado a mano, sin
    // un solo falso positivo. El canal de gremio NO vale y no se usa: un
    // compañero de gremio no está en tu grupo.
    //
    // Se propone, no se impone: quien lo recibe decide, y quitarlo se recuerda.
    if (ev.kind === 'chat' && ev.channel === 'group' && ev.from
        && ev.from !== (this.self ?? 'You') && !this.groupSeen.has(ev.from)) {
      this.groupSeen.add(ev.from);
      this.emit('groupmate', ev.from);
    }
    if (ev.kind === 'who' && ev.who === (this.self ?? 'You') && ev.classes?.length) {
      const man = this.trioActive;
      const changed = this.whoClasses && this.whoClasses.join() !== ev.classes.join();
      // Un /who nuevo es la verdad: se descarta lo anterior y lo observado.
      if (changed || this.classes?.length) {
        this.classes = null;
        this.seenStances.clear();
        this.seenInvocations.clear();
      }
      this.classConflict = null;
      this.whoAt = ev.t;
      // Un renglón de la tabla dice «desde las 12:31, esto», y eso vale hacia
      // adelante hasta que algo lo desmienta. Un /who POSTERIOR que dice otro
      // trío es exactamente eso: no contradice lo que declaraste del pasado,
      // termina el tramo. Una declaración abierta hacia el futuro no puede
      // ganarle a una medida tomada después.
      //
      // Antes ganaba la tabla y el /who se tiraba entero, clases y nivel. Medido
      // en el log real: la tabla decía SHD/DRU/MAG nivel 50 y el /who de las
      // 23:51:47 decía SHD/SHM/MAG nivel 27. Las peleas siguientes se guardaban
      // a nivel 50 — y el nivel es justo lo que separa las marcas, así que se
      // comparaban peleas de 27 contra récords de 50.
      //
      // Esto NO es lo mismo que la inferencia por hechizos, que sigue sin tocar
      // un tramo declarado: allí hay que adivinar cuál de las tres sale, y aquí
      // el juego te da el trío entero y el nivel. No hay nada que suponer.
      const desmiente = man && ev.classes.join() !== man.classes.join();
      if (!man || desmiente) {
        this.whoClasses = ev.classes;
        this.level = ev.level;
        this.#markLevel(ev.level, ev.classes);
        // El tramo declarado queda superado desde aquí. Los renglones
        // posteriores de la tabla siguen aplicándose cuando les toque:
        // `#applyTrios` los pone en vigor por su hora, no por esta marca.
        if (desmiente) {
          this.trioActive = null;
          this.#staleTable(man, ev);
        }
      } else if (man.level == null && ev.level) {
        this.level = ev.level;
        this.#markLevel(ev.level, null);
      }
    }
    // La subida de nivel es una afirmación absoluta y gratis, y en EQL el
    // nivel baja al cambiar una clase por otra más baja: es la otra mitad de
    // la línea de tiempo, junto al /who.
    if (ev.kind === 'levelup' && ev.level) this.#markLevel(ev.level, null);
    // Un punto de habilidad, con su hora. No pertenece a ninguna pelea —cae
    // entre unas y otras— así que va a su propio sitio, como el botín huérfano.
    // Que un hechizo esté en tu libro no se deduce de haberlo lanzado: se dice
    // en tres líneas distintas y las tres cuentan. Sin esto, «Mis hechizos»
    // sólo conoce lo que has usado y no puede enseñarte lo que tienes parado.
    // Y haberlo lanzado también se anota aquí, no sólo dentro de la pelea.
    //
    // `casts` vive en cada pelea guardada, así que un hechizo lanzado fuera de
    // combate —un buff antes de entrar, una cura de camino— o en una pelea que
    // no llegó a guardarse no contaba como usado. Medido: 40 hechizos sin usar
    // leyendo el registro entero contra 59 leyendo sólo las peleas. Diecinueve
    // que la aplicación habría señalado como «lo tienes parado» cuando sí lo
    // usas, que es peor que no decir nada.
    if (ev.kind === 'cast' && ev.ability && ev.source === (this.self ?? 'You')) {
      this.store?.appendSpell({ name: ev.ability, via: 'lanzado', t: ev.t, at: Math.round(ev.t * 1000) });
    }
    if (['scribe', 'memorize', 'spell_buy'].includes(ev.kind) && ev.ability) {
      const via = ev.kind === 'spell_buy' ? 'comprado'
        : (ev.kind === 'scribe' ? 'escrito' : 'memorizado');
      this.store?.appendSpell({ name: ev.ability, via, t: ev.t, at: Math.round(ev.t * 1000) });
    }
    if (ev.kind === 'aa') {
      this.store?.appendAA({ t: ev.t, at: Math.round(ev.t * 1000), balance: ev.balance ?? null });
    }
    if (ev.kind === 'cast' && ev.source === (this.self ?? 'You') && ev.ability) this.classProof(ev);
    if (ev.kind === 'stance' && ev.stance) this.#checkConflict('stance', ev.stance);
    if (ev.kind === 'invocation' && ev.invocation) this.#checkConflict('invocation', ev.invocation);
    // Golpes recientes de todo el mundo, para el DPS de los últimos segundos.
    if (ev.amount > 0 && ev.source && !this.backfilling) {
      this.recentHits.push({ t: ev.t, name: ev.source, amount: ev.amount });
      const cut = ev.t - 20;
      while (this.recentHits.length && this.recentHits[0].t < cut) this.recentHits.shift();
    }

    // Ventana móvil: sólo DAÑO que te entra, en bruto.
    //
    // La comprobación del tipo es imprescindible: las curaciones también
    // traen cantidad y te tienen a ti como objetivo. Sin ella, cada Drain
    // Spirit que te cura se contaba como daño mágico recibido, y el consejo
    // te pedía Mage Hunter justo cuando más daño mágico estabas haciendo tú.
    if (ev.amount > 0 && DAMAGE_KINDS.has(ev.kind) && ev.target === (this.self ?? 'You')) {
      // Se guardan las dos cifras: `raw` es la reconstrucción sin postura, que
      // es con lo que se comparan las posturas entre sí, y `amt` el daño que
      // de verdad recibiste, que es con lo que se decide si vale la pena
      // molestarte. Con Evasive las dos se separan por un factor de veinte.
      this.recent.push({ t: ev.t, school: ev.school, raw: ev.rawAmount ?? ev.amount, amt: ev.amount });
      const cut = ev.t - this.windowSec;
      while (this.recent.length && this.recent[0].t < cut) this.recent.shift();
    }
    // Los golpes que te FALLAN también entran en la ventana. Una postura que
    // evade no reduce daño: quita golpes, así que se puntúa contando ataques,
    // y sin los fallos no se sabe cuántos ataques hubo.
    if (ev.kind === 'miss' && ev.target === (this.self ?? 'You')) {
      this.recent.push({ t: ev.t, school: 'melee', raw: 0, amt: 0, miss: true });
      const cut = ev.t - this.windowSec;
      while (this.recent.length && this.recent[0].t < cut) this.recent.shift();
    }
    this.casteos.feed(ev);
    this.tracker.feed(ev);
    this.session?.feed(ev);
    if (ev.kind === 'death' && ev.victim && !this.backfilling) this.#makeKillCard(ev);
    // Durante la lectura del histórico no se habla ni se disparan avisos: son
    // sucesos de hace horas. La guarda anterior miraba el estado, que pasaba
    // a "monitorizando" en el primer volcado, a mitad de la lectura.
    this.narrator.feed(ev);
    if (ev.amount && ev.source && ev.source !== (this.self ?? 'You') && ev.target === (this.self ?? 'You')) {
      this.narrator.add(ev.source);
    }
    // Enemigo = a quien pegas tú o tu mascota. Es el filtro que evita
    // que los hechizos de tus compañeros de grupo se anuncien.
    if (ev.amount && ev.target && (ev.source === (this.self ?? 'You') || this.parser.pets.has(ev.source))) {
      this.foes.add(ev.target);
      this.narrator.setFoes([...this.foes]);
    }
    /**
     * ev.raw es la línea sin la marca de tiempo, la reconozca el parser o no.
     *
     * DURANTE LA RELECTURA SE CUENTA Y SE CALLA. Antes se saltaba entera, y era
     * medio correcto: si el motor hablara mientras relee el registro, al abrir
     * la aplicación llegarían cientos de miles de avisos de peleas de hace días.
     * Pero saltarla del todo dejaba el contador de cada disparador a cero, y con
     * él la única cifra que separa una alarma viva de una muerta.
     *
     * Lo que cuesta, medido con los cinco disparadores encendidos del registro
     * de referencia: 0,6 s sobre 880.021 líneas. Dentro de una relectura de 31
     * segundos, el 2 %. Y a cambio la etiqueta puede decir «visto 33 veces en tu
     * registro» en vez de «aún no ha casado en esta sesión», que era honesto y
     * vacío: contesta la pregunta de si el patrón caza algo, que es justo la que
     * se hace quien mira una plantilla de fábrica.
     */
    this.triggers.match(ev.raw, ev.t, { mudo: this.backfilling });
  }

  /**
   * Pone en vigor los renglones de la tabla manual que ya tocan.
   *
   * Se llama en cada evento con la hora del evento, así que al releer el log
   * los tramos se aplican en su momento y no todos de golpe al final.
   */
  #applyTrios(tSec) {
    if (!this.trios?.length) return;
    const ms = tSec * 1000;
    let cambio = false;
    while (this.trioIdx < this.trios.length) {
      const r = this.trios[this.trioIdx];
      if (r.at != null && r.at > ms) break;
      this.trioIdx++;
      this.trioActive = r;
      cambio = true;
    }
    if (!cambio) return;
    const r = this.trioActive;
    // Cambiar de trío BORRA el nivel heredado: en EQL el nivel efectivo es el
    // de tu clase más baja, así que meter una clase nueva puede hundirlo. Si
    // el renglón no declara nivel, se queda sin nivel hasta el primer hito de
    // dentro del tramo, en vez de arrastrar una mentira del tramo anterior.
    this.level = r.level ?? null;
    this.whoClasses = r.classes.slice();
    this.classSourceAt = 'manual';
    this.classPrompt = null;
    this.promptedClass = null;
    this.classConflict = null;
    this.classes = null;
    this.seenStances.clear();
    this.seenInvocations.clear();
    for (const tr of [this.tracker, this.session]) {
      if (!tr) continue;
      tr.level = this.level;
      tr.classes = r.classes.slice();
    }
  }

  /** La tabla que declaras a mano. Manda sobre el /who y sobre la inferencia. */
  setTrios(lista) {
    this.trios = normalizeTrios(lista);
    this.trioIdx = 0;
    this.trioActive = null;
    return this.trios;
  }

  /**
   * Un hito de la línea de tiempo del nivel.
   *
   * Dos fuentes: el /who, que trae nivel y clases, y la subida de nivel, que
   * trae sólo el nivel. Cada pelea se queda con lo que hubiera cuando se abrió;
   * las anteriores al primer hito se quedan sin nivel, y eso se dice.
   */
  #markLevel(level, classes, fuente = '/who') {
    if (level) this.level = level;
    if (classes?.length) {
      this.whoClasses = classes;
      this.classSourceAt = fuente;
      // Un /who resuelve la contradicción: vuelve a haber información fresca.
      if (fuente === '/who') { this.classPrompt = null; this.promptedClass = null; }
    }
    for (const tr of [this.tracker, this.session]) {
      if (!tr) continue;
      if (level) tr.level = level;
      if (classes?.length) tr.classes = classes;
    }

    // Y LA PELEA QUE ESTÁ ABIERTA AHORA MISMO, que se quedaba fuera.
    //
    // El encuentro copia trío y nivel al nacer, así que lo que empezó antes del
    // /who se guardaba con lo de antes. Medido: una pelea en The Ruins of Old
    // Guk 2 guardada con SHD/DRU/MAG y nivel 50, y el /who veintitrés segundos
    // después decía [29 SHD/SHM/MAG]. Es la misma pelea, en la misma zona.
    //
    // Entre una medida tomada DENTRO de la pelea y otra de hace tres horas en
    // otra zona, vale la de dentro. Es el mismo criterio que ya aplica
    // `classProof` cuando un hechizo exclusivo delata un cambio de trío.
    //
    // Sólo la abierta: las cerradas ya están guardadas y se arreglan releyendo.
    for (const tr of [this.tracker, this.session]) {
      const enc = tr?.current;
      if (!enc || enc.closed) continue;
      if (level) enc.level = level;
      if (classes?.length) enc.classes = classes.slice();
    }
  }

  /**
   * Un hechizo exclusivo de una clase demuestra que esa clase está en el trío
   * AHORA. Si no consta, el trío ha cambiado y lo que sabíamos ya no vale.
   *
   * Esto es lo único continuo que hay: en EQL se cambia de trío y el log no lo
   * dice en ninguna parte. Medido en un log real, entre un cambio y el /who que
   * lo confirmó pasaron dos horas y cuarto, y 32 peleas quedaron guardadas con
   * el trío y el nivel equivocados. Con esta señal se arreglan solas.
   *
   * Cuál salió del trío no se sabe con certeza: se toma la que lleva más tiempo
   * sin dar señales, que es la única candidata razonable, y se marca el origen
   * como inferido para que la interfaz no lo presente como un hecho.
   *
   * Y el NIVEL deja de ser fiable: lo marca la clase más baja del trío, así que
   * cambiar una clase lo cambia. Se pone a desconocido hasta que un /who o una
   * subida lo digan. No se hereda.
   *
   * SÓLO PRUEBA LO EXCLUSIVO. Un hechizo que tengan dos clases no demuestra
   * cuál de las dos llevas, y `proofOf` devuelve null: Regeneration la tienen
   * druida y chamán, así que lanzarla no dice nada y aquí no pasa nada. Eso no
   * es un fallo del aviso — es la diferencia entre medir y suponer.
   */
  classProof(ev) {
    const clase = proofOf(ev.ability);
    if (!clase) return;
    this.lastProof.set(clase, ev.t);
    const trio = this.whoClasses;
    if (!trio?.length || trio.includes(clase)) return;

    // Cuál de las tres salió NO se sabe. Se ordenan por cuánto llevan sin dar
    // señales, que es lo único que hay, pero eso es un orden de sospecha y no
    // una respuesta: una clase puede llevar media hora sin aparecer sólo porque
    // lanzas pocos hechizos suyos.
    const orden = trio.filter((c) => c !== clase)
      .sort((a, b) => (this.lastProof.get(a) ?? -1) - (this.lastProof.get(b) ?? -1));
    const sale = orden[0];
    if (!sale) return;

    const nuevo = trio.map((c) => (c === sale ? clase : c));

    // Reasignar el trío y avisar de la contradicción son dos cosas distintas, y
    // estaban soldadas: dentro de un tramo declarado a mano se salía antes de
    // llegar al aviso, así que con la tabla puesta la contradicción NO PODÍA
    // saltar nunca. Justo al revés de lo que hace falta — que lo declarado deje
    // de corresponderse con la realidad es el caso en que más falta hace saberlo,
    // porque nada más lo va a corregir.
    //
    //   Reasignar  — sólo si el trío venía del /who o de la inferencia. Lo que
    //                declaraste a mano no se toca: tú estabas allí.
    //   Avisar     — siempre. Cambia el texto, no el hecho.
    const declarado = this.trioActive ? trio.slice() : null;
    if (!declarado) {
      this.#markLevel(null, nuevo, 'inferido');
      // Y el NIVEL deja de ser fiable: lo marca la clase más baja del trío.
      this.level = null;
      for (const tr of [this.tracker, this.session]) if (tr) tr.level = null;
    }

    // Una vez por contradicción, no por hechizo: si juegas toda la tarde con
    // druida, con decirlo una vez basta hasta que escribas /who o cambies otra
    // vez. Y en pantalla, no por voz: escribirlo treinta segundos después no
    // cuesta nada, y la voz está reservada a lo que cambia lo que haces ya.
    const clave = `${clase}|${nuevo.join('/')}|${declarado ? 'declarado' : 'deducido'}`;
    if (this.promptedClass === clave) return;
    this.promptedClass = clave;
    this.classPrompt = {
      fuente: 'hechizo',
      spell: ev.ability, clase, trio: nuevo, sale, at: Date.now(),
      // El trío que declaraste, si lo que se contradice es tu tabla. `null`
      // significa que el trío venía del log y ya se ha corregido solo.
      declarado,
      // CUÁNDO empezar el tramo nuevo si aceptas la corrección. Es la hora del
      // hechizo que lo demuestra: el último instante en que se puede afirmar
      // que ya habías cambiado. Medido, no supuesto.
      atLog: Math.round(ev.t * 1000),
      // Y el otro extremo de la ventana: la última vez que se demostró que la
      // clase que sale seguía puesta. El cambio ocurrió entre las dos, y no se
      // puede afinar más sin inventarlo.
      desde: this.lastProof.has(sale) ? Math.round(this.lastProof.get(sale) * 1000) : null,
      // Las tres salidas posibles, con lo que se sabe de cada una, ordenadas por
      // sospecha. Si hay que ESCRIBIR en tu tabla —la fuente de arriba— no vale
      // colar una suposición por un botón: lo medido es que {clase} está dentro,
      // y cuál sale lo dices tú. Sin tabla no hace falta: allí el trío deducido
      // se marca como deducido y la interfaz ya no lo presenta como un hecho.
      candidatos: declarado ? orden.map((c) => ({
        clase: c,
        visto: this.lastProof.has(c) ? Math.round(this.lastProof.get(c) * 1000) : null,
        trio: trio.map((x) => (x === c ? clase : x)),
      })) : null,
    };
    if (!this.backfilling) {
      this.emit('alert', {
        id: 'class-contradiction', name: 'clases',
        speak: null,                            // en pantalla, no hablado
        text: declarado
          ? t('cls.contradictionTable', {
            spell: ev.ability, cls: t(`cl.${clase}`),
            trio: declarado.map((c) => t(`cl.${c}`)).join('/'),
          })
          : t('cls.contradiction', { spell: ev.ability, cls: t(`cl.${clase}`) }),
        sound: null, color: '#6FC7D8', holdMs: 12000, at: Date.now(),
      });
    }
  }

  /**
   * Tu tabla dice una cosa y tu /who, posterior, dice otra.
   *
   * El /who ya se ha tomado arriba. Esto sólo te lo cuenta y te deja el renglón
   * preparado, y hace falta: si la tabla se queda como está, la próxima vez que
   * se relea el log volverá a pisar al /who y las peleas se guardarán otra vez
   * con el trío y el nivel viejos. Lo que arregla el histórico no es este aviso,
   * es que el renglón acabe escrito.
   */
  #staleTable(man, ev) {
    const clave = `who|${man.classes.join('/')}|${ev.classes.join('/')}|${Math.round(ev.t)}`;
    if (this.promptedClass === clave) return;
    this.promptedClass = clave;
    this.classPrompt = {
      fuente: 'who',
      spell: null, clase: null, sale: null, candidatos: null,
      // Aquí no hay nada que adivinar: el juego da el trío entero y el nivel.
      trio: ev.classes.slice(),
      nivel: ev.level ?? null,
      declarado: man.classes.slice(),
      declaradoNivel: man.level ?? null,
      atLog: Math.round(ev.t * 1000),
      desde: man.at ?? null,
      at: Date.now(),
    };
    if (this.backfilling) return;
    this.emit('alert', {
      id: 'class-contradiction', name: 'clases',
      speak: null,                            // en pantalla, no hablado
      text: t('cls.whoBeatsTable', {
        trio: man.classes.map((c) => t(`cl.${c}`)).join('/'),
        who: ev.classes.map((c) => t(`cl.${c}`)).join('/'),
      }),
      sound: null, color: '#6FC7D8', holdMs: 12000, at: Date.now(),
    });
  }

  /**
   * Cooldowns y usos, anotados al vuelo.
   *
   * El aviso da el tiempo que FALTA, no el cooldown entero, así que el máximo
   * observado es una cota inferior. Y el aviso nombra la habilidad sin rango
   * («Harm Touch») mientras que el daño la nombra con él («Harm Touch X»): sin
   * quitar el numeral, los usos no se cruzan con el cooldown y el
   * aprovechamiento sale a cero.
   */
  #cooldown(ev) {
    if (ev.kind === 'ability_cd' && ev.ability) {
      const base = baseSpell(ev.ability);
      const t = String(ev.left ?? '');
      const h = /(\d+)\s*hour/.exec(t), m = /(\d+)\s*minute/.exec(t), s = /(\d+)\s*second/.exec(t);
      const secs = (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
      const e = this.cooldowns.get(base) ?? { name: base, seconds: 0, attempts: 0, uses: 0 };
      e.attempts++;
      if (secs > e.seconds) e.seconds = secs;
      this.cooldowns.set(base, e);
    } else if ((ev.kind === 'cast' || ev.kind === 'spell' || ev.kind === 'dot')
        && ev.ability && ev.source === (this.self ?? 'You')) {
      const base = baseSpell(ev.ability);
      const e = this.cooldowns.get(base) ?? { name: base, seconds: 0, attempts: 0, uses: 0 };
      e.uses++;
      this.cooldowns.set(base, e);
    } else return;
    for (const e of this.cooldowns.values()) {
      e.source = e.attempts >= 3 ? 'medido' : e.attempts ? 'una sola muestra' : null;
      // Sin rastro de uso no hay aprovechamiento que calcular, y eso NO es un
      // cero: Companion's Fury avisa 283 veces de que no está lista y no deja
      // ni una línea al usarse. Decir «no se puede saber» es la respuesta.
      e.countable = e.uses > 0;
    }
  }

  /** Cierra peleas por inactividad y avanza los temporizadores. */
  tick() {
    this.tracker?.tick(Date.now() / 1000);
    return this.triggers.tick();
  }

  /**
   * De los contadores a lo que se guarda.
   *
   * `forma` sólo la traen las habilidades —es la única lista que la cuenta— y
   * sale ya resuelta en tres cifras: el recuento entero se queda en memoria.
   * Ver `forma()` en `src/encounter.js` para el porqué.
   *
   * EL MÍNIMO YA NO VIAJA. Era la cifra más frágil de la tabla: una muestra de
   * n=1 puesta al lado de sumas de cientos, y se leía como si valiera lo mismo.
   * Lo que ocupa su sitio es el p10, que contesta la misma pregunta sin que un
   * golpe raro se la lleve por delante.
   */
  #b(list) {
    return list.map(([k, v]) => {
      const f = forma(v);
      return {
        name: k, sum: v.sum, n: v.n, max: v.max, crits: v.crits, school: v.school, type: v.type,
        ...(f ? { p10: f.p10, p50: f.p50, p90: f.p90, ...(f.bimodal ? { bimodal: true } : {}) } : {}),
      };
    });
  }

  #row(r) {
    return {
      name: r.name,
      // Sin esto la marca muere aquí: cada capa de estas escoge campos a mano,
      // y lo que no se nombra no viaja.
      charmed: r.charmed === true,
      damage: r.damage, dps: r.dps, dpsOwn: r.dpsOwn, dpsActive: r.dpsActive, share: r.share,
      // Un número por fila, no una serie por jugador: ver `mejorRafaga`.
      rafaga10: r.rafaga10 ?? 0,
      // Tu cadencia de ataque y el parón que NO explica tu arma. Sin nombrarlos
      // aquí no llegan al análisis: cada capa escoge campos a mano.
      cadencia: r.cadencia ?? null,
      swingSec: r.swingSec ?? 0,
      huecoReal: r.huecoReal ?? null,
      // Segundos en los que esta fila no manejaba su personaje. Sólo la tuya
      // los tiene: el registro no dice nada del mando de los demás.
      sinMandoSec: r.sinMandoSec ?? 0,
      hits: r.hits, meleeHits: r.meleeHits, misses: r.misses,
      crits: r.crits, critDamage: r.critDamage, critRate: r.critRate,
      flurries: r.flurries, ripostes: r.ripostes, healPotential: r.healPotential,
      max: r.max, min: r.min, accuracy: r.accuracy, avoidance: r.avoidance,
      taken: r.taken, swingsAgainst: r.swingsAgainst, deaths: r.deaths,
      healingDone: r.healingDone, healingTaken: r.healingTaken,
      activeSec: r.activeSec, hitSec: r.hitSec, ownSec: r.ownSec,
      types: r.byType.map(([k, v]) => [k, v.sum]),
      abilities: this.#b(r.byAbility),
      targets: this.#b(r.byTarget),
      schools: this.#b(r.bySchool),
      stances: this.#b(r.byStance),
      invocations: this.#b(r.byInvocation),
      missReasons: r.missReasons.map(([k, v]) => [k, v.n]),
      defense: r.defense.map(([k, v]) => [k, v.n]),
      // La runa se come el golpe entero: es daño que NO llegó, y por eso
      // viaja aparte de  —lo que sí llegó— y de la curación, que
      // repara lo que llegó. Con su cuenta de runas al lado, que son pocas.
      absorbed: r.absorbed ?? 0, absorbHits: r.absorbHits ?? 0,
      takenByType: this.#b(r.takenByType),
      rawTakenByType: this.#b(r.rawTakenByType), rawMeleeOut: r.rawMeleeOut,
      // El daño recibido partido por la postura de cada golpe. Ya viene con
      // forma de lista de objetos desde el encuentro, así que no pasa por `#b`.
      // Sin esta línea el campo se construía, se guardaba en la fila del
      // encuentro y se caía aquí: el consejo seguía colapsando la pelea a una
      // sola postura sin que nada avisara.
      takenByStance: r.takenByStance ?? [],
      takenBySource: this.#b(r.takenBySource),
      healBySpell: this.#b(r.healBySpell),
      healByTarget: this.#b(r.healByTarget),
    };
  }

  /**
   * Quién es enemigo y quién de los tuyos.
   *
   * Enemigo = te ha pegado a ti o a tu mascota, o tú o tu mascota le habéis
   * pegado. Sin esta separación el "dps del grupo" sumaba los dos bandos y los
   * porcentajes repartían entre atacantes y atacados a la vez.
   *
   * CON UNA EXCEPCIÓN, Y ES LA REGLA QUE MANDA: UN COMPAÑERO DECLARADO NUNCA
   * ACABA EN EL BANDO ENEMIGO. La regla de arriba decide por un golpe, y un
   * golpe es un dato inestable: en el Plano del Miedo encantan, y con la regla a
   * secas bastaba UNO para que alguien de tu grupo fuera enemigo el resto de la
   * pelea, con todo su daño detrás. Declararlo tuyo es una identidad que has
   * afirmado tú; lo que un golpe suyo puede hacer es apartarse y contarse aparte
   * —ver `entreTuyos` en `src/encounter.js`—, no cambiarle el bando.
   *
   * La guarda va también aquí, y no sólo en el encuentro que ya no le pasa esos
   * golpes a `byTarget`: esto es la regla, aquello es su consecuencia, y las
   * peleas que llegan por otros caminos tienen que obedecer la misma.
   */
  #sides(rows, me, petSet, mates = new Set()) {
    const foes = new Set();
    const ours = new Set([me, ...petSet]);
    const declarado = (n) => ours.has(n) || mates.has(n);
    for (const r of rows) {
      const hitsUs = (r.byTarget ?? []).some(([n]) => ours.has(n));
      if (hitsUs && !declarado(r.name)) foes.add(r.name);
    }
    for (const r of rows) {
      if (!ours.has(r.name)) continue;
      for (const [n] of r.byTarget ?? []) if (!declarado(n)) foes.add(n);
    }

    // Quien CURA a un enemigo es enemigo.
    //
    // La regla de arriba clasifica por daño, y un sanador enemigo que nunca te
    // toca y al que nunca tocas se cae por el hueco y aterriza en aliados por
    // defecto. Pasó de verdad: «a ghoul savant» curó 104 a un wan ghoul knight
    // y salía en «Los tuyos», igual que «a zol ghoul knight pet» curando a los
    // suyos. Y no valía la regla de «cero daño = fuera», porque curar es hacer
    // algo: los habría borrado en vez de reclasificarlos.
    //
    // Se repite hasta que no cambie nada, por si un sanador cura a otro.
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      let nuevos = 0;
      for (const r of rows) {
        if (foes.has(r.name) || declarado(r.name)) continue;
        if ((r.healByTarget ?? []).some(([n]) => foes.has(n))) { foes.add(r.name); nuevos++; }
      }
      if (!nuevos) break;
    }
    return foes;
  }

  #enc(enc) {
    if (!enc) return null;
    const t = enc.totals();
    const me = this.self ?? 'You';
    // Las mascotas de ESTA sesión, si se sabe cuál es la tuya ahora mismo.
    //
    // `knownPets` acumula entre sesiones para que el histórico de ayer reconozca
    // a las de ayer, y para eso está bien. Pero aplicada a la pelea de ahora
    // convierte en tuya a la mascota de otro que reutilice un nombre viejo: los
    // nombres salen de una lista cerrada y se reciclan. Sólo se usa como
    // respaldo cuando no consta ninguna de esta sesión —justo después de
    // reabrir la aplicación con la mascota ya invocada—, que es el único caso
    // en que aporta algo que no sepamos ya.
    const deAhora = new Set(this.parser?.pets.keys() ?? []);
    const petSet = deAhora.size ? deAhora : new Set(this.knownPets);
    const foeSet = this.#sides(t.rows, me, petSet, this.companions);
    // El bando se decide por NOMBRE, y un encantado comparte nombre con el
    // salvaje del mismo tipo: sin esta excepción los dos caían en enemigos y
    // el que peleaba para ti aparecía en el bando contrario.
    const esEnemigo = (r) => !r.charmed && foeSet.has(r.name);
    const allyRows = t.rows.filter((r) => !esEnemigo(r));
    const foeRows = t.rows.filter(esEnemigo);
    const allyTotal = allyRows.reduce((a, r) => a + r.damage, 0);
    const foeTotal = foeRows.reduce((a, r) => a + r.damage, 0);
    // La zona se descompone al guardar y no al leer: la dificultad cambia de
    // verdad lo que es un enemigo, así que tiene que ser un campo de la pelea y
    // no un trozo de texto dentro del nombre.
    const z = parseZone(enc.zone);
    /**
     * EL ÚLTIMO LANZAMIENTO ENEMIGO ANTES DE ESTE SEGUNDO. Por episodio, y sea
     * el que sea.
     *
     * QUÉ ESTABA MAL Y ESTO ARREGLA. La primera versión ponía al lado de estos
     * tramos un agregado —«el jefe cantó un encanto 8 veces en esta pelea»— y
     * eso es escoger el candidato bonito. La vecindad se lee antes que el
     * descargo: una canción de encanto pegada a un tramo «sin control» se lee
     * como «te encantaron» por mucho que debajo ponga que no se sabe.
     *
     * Y CONTRADECÍA LA PROPIA MEDICIÓN. De los 31 tramos sin control del
     * registro de referencia, el lanzamiento inmediatamente anterior fue:
     *
     *   15  Dragon Fear (a dracoliche)          18 de miedo
     *    2  Fear (Terror)                       ────────────
     *    1  Panic (a turmoil toad)              10 de encanto
     *   10  Solon's Bewitching Bravura           3 de otra cosa
     *    1  Root · 1 Paralyzing Earth · 1 Greater Healing
     *
     * O sea que el encanto era el segundo, y aun así era el que se enseñaba
     * porque es el que explica la historia bonita. Ahora se enseña el de cada
     * episodio, con su distancia, y en el episodio donde lo último fue una
     * curación del enemigo se enseña esa curación — que es exactamente lo que
     * impide leer causa donde sólo hay vecindad.
     *
     * LA VENTANA SALE DE LA MEDIDA Y NO HACE FALTA AFINARLA, porque los datos no
     * tienen término medio: en los 31 tramos el hueco es de 0 a 3 s (mediana 0),
     * y en los 13 tramos de fuego amigo, o hay uno a 8 s o menos, o no hay
     * ninguno en toda la pelea. Se toma el doble del peor caso observado —la
     * misma regla que `CHARM_MAX_SEC` y `MARGEN_TICK`— y sobra sitio.
     *
     * `dt` viaja siempre, como el hueco del botín: enseñar la distancia es lo
     * que permite no pedir que se confíe en la regla.
     */
    const VECINO_MAX = 16;
    const previoDe = (seg) => {
      let mejor = null;
      for (const c of enc.casts ?? []) {
        if (!c.ability || !foeSet.has(c.source)) continue;
        if (c.t > seg || seg - c.t > VECINO_MAX) continue;
        if (!mejor || c.t >= mejor.t) mejor = c;
      }
      return mejor ? { ability: mejor.ability, source: mejor.source, dt: seg - mejor.t } : null;
    };
    return {
      id: enc.id,
      /**
       * Con qué reglas están calculadas estas cifras. Va en la pelea y no en el
       * almacén: en cuanto una parte del histórico se corrige y otra no, una
       * marca global deja de describir lo que hay dentro. Ver `MODELO_MEDICION`.
       *
       * GUARDA DORMIDA, y así la cazó `test/muertos.js`. Su único lector es
       * `repararModelo` en `store.js`, que decide con él si una pelea vieja hay
       * que subirla al leerla; ninguna pantalla lo enseña.
       *
       * CUÁNDO DESPIERTA, que es lo que hace que no sea salida muerta: cuando
       * exista una pelea guardada por debajo de `MODELO_MEDICION`. Hoy no puede
       * haberla —la 1.13.0 fuerza la reconstrucción y todo el histórico nace al
       * día— pero la habrá la próxima vez que el modelo suba SIN reconstruir,
       * que es justo lo que pasó en la 1.11.0 y para lo que se inventó este
       * campo. El día que eso ocurra, `repararModelo` lo lee y decide con él.
       *
       * Si algún día se decide que además hay que ENSEÑARLO, el sitio es la
       * ficha de la pelea, al lado de las cifras que ese modelo calculó.
       */
      modelo: MODELO_MEDICION,
      // La misma identidad que llevan las cerradas: es lo que permite al
      // overlay saber que el bloque de arriba y el que acaba de llegar por el
      // otro canal son la misma pelea, y no pintarla dos veces.
      key: fightKey({ id: enc.id, start: enc.start }),
      zone: enc.zone,
      zoneBase: z.base, zoneMode: z.mode, diff: z.diff, diffTag: z.tag,
      // Nivel y clases de ESTA pelea. `null` significa que no se sabe, y se
      // enseña como tal: no se hereda del hito siguiente ni del actual.
      level: enc.level ?? null,
      classesAt: enc.classes ?? null,
      duration: t.duration,
      healing: t.healing,
      // Matar a un enemigo y perder a un tuyo son cosas distintas: si se
      // mezclan, una pelea donde caíste dos veces se titula "Campeon ×2".
      dead: Object.fromEntries(enc.deadAt ?? new Map()),
      // Una muestra de vida por muerte, medida al caer cada uno.
      hpSamples: Object.fromEntries(enc.hpSamples ?? new Map()),
      // Daño real que no se puede adjudicar a nadie. Fuera de los totales.
      unattributed: enc.unattributed ?? 0,
      loot: (enc.loot ?? []).slice(0, 200),
      // La moneda de esta pelea, con su instante. Va aparte del botín y no
      // fundida en un total porque la ficha la enseña en su sitio de la línea
      // de tiempo, igual que los objetos — y porque un total sin instantes no
      // se puede colocar después si alguien lo necesita.
      coins: (enc.coins ?? []).slice(0, 200),
      spellVsFoe: [...(enc.spellVsFoe ?? new Map()).values()],
      // Abatido = uno del bando enemigo. Antes bastaba con «no eres tú ni tu
      // mascota», y en cuanto empezaron a contarse las muertes de los
      // compañeros de grupo, la caída de un aliado se apuntaba como una presa.
      kills: enc.kills.filter((k) => foeSet.has(k.victim)).map((k) => k.victim),
      // CUÁNDO cayó cada uno, que es otra pregunta que `kills` no contesta.
      //
      // El instante ya se medía —el encuentro guarda {t, victim, killer}— y se
      // tiraba aquí mismo, en el `.map` de arriba. Cuesta 910 marcas en todo
      // un histórico, unos 9 KB, y es lo que hace falta para poder cortar una
      // tanda al MIRARLA en vez de decidirlo al guardar: si tres bichos caen
      // seguidos sin pausa, hoy son una pelea y no hay forma de separarlos
      // después.
      //
      // `kills` se queda como está —una lista de nombres— porque media
      // aplicación la compara como cadenas y porque responde a otra cosa: QUÉ
      // cayó, no cuándo. Son dos preguntas, no dos nombres para una.
      killTimes: enc.kills.filter((k) => foeSet.has(k.victim))
        .map((k) => ({ name: k.victim, t: Math.round(k.t - enc.start) })),
      // Los totales del grupo son sólo de los tuyos; el enemigo va aparte.
      total: allyTotal,
      raidDps: allyTotal / t.duration,
      enemyTotal: foeTotal,
      enemyDps: foeTotal / t.duration,
      // Baja = de los vuestros: tú, tus mascotas o cualquier aliado que estaba
      // en la pelea. Lo que no se puede clasificar no se cuenta como ninguna
      // de las dos cosas antes que contarlo mal.
      losses: enc.kills.filter((k) => k.victim === me || petSet.has(k.victim)
        || (!foeSet.has(k.victim) && t.rows.some((r) => r.name === k.victim))).map((k) => k.victim),
      // Y QUIÉN os mató, que es dato del log —«You have been slain by X!»— y se
      // estaba tirando al quedarse sólo con el nombre de la víctima. Sin esto,
      // «cuántas veces te mató este enemigo» habría que deducirlo de a quién
      // apuntaba, que no es lo mismo: en una pelea con tres enemigos, apuntarte
      // no es haberte rematado. Va en una lista aparte para no cambiarle la
      // forma a `losses`, que ya la lee media aplicación.
      lossesBy: enc.kills.filter((k) => k.victim === me || petSet.has(k.victim)
        || (!foeSet.has(k.victim) && t.rows.some((r) => r.name === k.victim)))
        .map((k) => ({ victim: k.victim, killer: k.killer ?? null })),
      series: [...(enc.series ?? new Map()).values()].sort((a, b) => a.s - b.s),
      stanceSpans: (enc.stanceSpans ?? []).map((x, i, arr) => ({
        ...x, to: i === arr.length - 1 ? Math.max(x.to, enc.end - enc.start) : x.to,
      })),
      // Lo que no se pudo atribuir del encanto, para poder rotularlo. Nulo
      // cuando no hubo ninguno, que es casi siempre.
      charm: t.charm ?? null,
      // Dos de los tuyos pegándose entre ellos: quién, cuánto y cuántos
      // segundos. Está fuera de `total` y fuera de `enemyTotal` a propósito —no
      // es producción y no es daño enemigo— así que si no viaja en su propio
      // campo, no queda constancia de que ocurrió. Nulo casi siempre.
      //
      // Cada tramo lleva pegado el último lanzamiento enemigo que hubo antes de
      // que empezara — el suyo, no el más llamativo de la pelea. Ver `previoDe`.
      entreTuyos: t.entreTuyos
        ? { ...t.entreTuyos, quien: t.entreTuyos.quien.map((q) => ({ ...q, previo: previoDe(q.desde) })) }
        : null,
      // Los segundos en que tu personaje no era tuyo, con sus dos extremos
      // escritos en el registro. Nulo cuando no perdiste el mando.
      sinControl: t.sinControl
        ? t.sinControl.map((x) => ({ ...x, previo: previoDe(x.desde) }))
        : null,
      /**
       * SEGUNDOS QUE NO CUENTAN CONTRA TI, Y LA DURACIÓN QUE QUEDA.
       *
       * Con miedo no puedes actuar y con encanto no decides. Los dos son
       * involuntarios, así que ese tiempo no puede entrar en ningún denominador
       * de actividad: veinte segundos encantado hunden tu dps por un rato en el
       * que no manejabas nada, y encima la duración no la eliges tú.
       *
       * `duration` SE QUEDA COMO ESTÁ y esto viaja al lado, que es deliberado:
       * `duration` es de la primera a la última línea de la pelea, que es la
       * convención de siempre, y cambiarla en silencio haría que tus cifras
       * dejaran de compararse con ninguna otra.
       * Lo que se hace es dar la otra al lado y usarla donde se te juzga — ver
       * `huecoReal` y el hallazgo de tiempo muerto en `analysis.js`.
       */
      sinMandoSec: t.sinMandoSec ?? 0,
      duracionMando: Math.max(1, t.duration - (t.sinMandoSec ?? 0)),
      label: (() => {
        // Nombre de la pelea: el enemigo abatido, nunca los tuyos.
        const foesDown = enc.kills.filter((k) => foeSet.has(k.victim));
        if (foesDown.length) {
          // El recuento sale de `src/suelo.js`, que es el mismo que usan las
          // figuras del reproductor. Aquí se contaba a mano con un objeto, y
          // dos recuentos del mismo hecho en dos ficheros es la forma que ya
          // nos costó 25 abatidos: la mayúscula inicial casaba en un sitio y en
          // el otro no. Ver la nota de ese módulo.
          return [...muertesPorNombre(foesDown)]
            .map(([n, x]) => (x > 1 ? `${n} ×${x}` : n)).join(', ');
        }
        const foes = [...enc.targetTotals].filter(([n]) => n !== (this.self ?? 'You'));
        foes.sort((a, b) => b[1] - a[1]);
        if (foes.length) return foes[0][0];
        // Y si no llegaste a pegar a nadie, el que te pegó a ti.
        //
        // Sin esto se quedaban sin nombre y la lista las enseñaba como
        // «escaramuza»: ocho en un almacén real, y ninguna era una escaramuza.
        // Una donde un gigante de fuego y King Tranix te meten 4.310 puntos sin
        // que devuelvas uno es una muerte o una huida, y es justo la que
        // quieres poder encontrar. `foeRows` ya viene ordenada por daño.
        return foeRows.find((r) => r.damage > 0)?.name ?? null;
      })(),

      resistsSuffered: enc.resistsSuffered,
      // El tope sube de 300 a 1200 porque ahora se guardan TODOS los
      // lanzamientos, no sólo las utilidades: el máximo medido en una pelea
      // real es 349 y con 300 se habría recortado sin decirlo. Y si algún día
      // se recorta, se anota — un recorte callado se lee como que no hubo más.
      casts: (enc.casts ?? []).slice(0, 1200),
      fades: (enc.fades ?? []).slice(0, 400),
      castsCut: Math.max(0, (enc.casts ?? []).length - 1200),
      resistsCaused: enc.resistsCaused,
      // De quién y de qué. `resistsCaused` a secas es un número que no se puede
      // usar para nada; esto va a la ficha del enemigo, que es donde una
      // proporción dice algo. Es el sitio al que se muda `resist_by_you` al
      // salir de la pista del reproductor.
      resistsByFoe: [...(enc.resistedByYou ?? new Map()).values()],
      interrupts: enc.interrupts,
      closed: enc.closed,
      start: enc.start,
      rows: t.rows.map((r) => {
        const enemy = !r.charmed && foeSet.has(r.name);
        const base = enemy ? foeTotal : allyTotal;
        // La marca va en la fila y no en una lista aparte: las mascotas cambian
        // de nombre en cada invocación y el histórico no sabría reconocerlas.
        // «Sin identificar»: pegó a tus enemigos, pero no consta que sea tuyo.
        // Ni tú, ni mascota confirmada, ni nadie de quien haya un /who. El log
        // de EQL no dice quién va en tu grupo —comprobado: ni invitaciones, ni
        // entradas, ni salidas—, así que esto no se puede resolver solo y lo
        // honesto es enseñarlo aparte en vez de sumarlo a tu bando.
        // Un compañero declarado deja de ser un desconocido: eso es justo lo
        // que significa declararlo. No cambia de bando —ya estaba en el tuyo,
        // como todo el que no es enemigo— ni mueve ninguna cifra: `total` y
        // `raidDps` se calculan por `side` y nunca miran esta marca.
        const desconocido = !enemy && r.name !== me && !petSet.has(r.name)
          && !this.companions.has(r.name)
          && !this.parser?.otherPets.has(r.name) && !this.whoSeen.has(r.name);
        return {
          ...this.#row(r), side: enemy ? 'enemy' : 'ally',
          unidentified: desconocido,
          /**
           * ── EL NOMBRE QUE SE ENSEÑA, ¿ESTÁ MEDIDO O DEDUCIDO? ───────────
           *
           * EQ capitaliza al abrir frase, así que la forma que ves al principio
           * de una línea NO dice nada: «A gorgon» y «a gorgon» se escriben
           * igual ahí. Lo único que atestigua la forma buena es haberlo visto
           * A MITAD DE FRASE, y de 440 nombres del histórico hay **25** que el
           * registro no escribe nunca fuera del principio: `Guard Philbin`,
           * `Sergeant Slate`, `Sarawyn Amorfin`…
           *
           * De ésos, la forma que enseñamos es una apuesta razonable —bajar el
           * artículo si lo hay, respetar lo demás— y hasta hoy se presentaba
           * exactamente igual que las 410 que sí están atestiguadas. **Deducido
           * presentado como medido**, que es la regla de esta casa al revés.
           *
           * Con esta marca, la interfaz puede decirlo donde enseña procedencia.
           * No cambia ninguna cifra: cambia lo que se afirma sobre una.
           */
          nombreDeducido: !this.parser?.formaAtestiguada(r.name),
          pet: !enemy && r.name !== me && petSet.has(r.name),
          // Mascota de otro jugador: se nombra con su dueño y nunca se funde
          // con las tuyas ni se pregunta por ella.
          petOf: !enemy ? (this.parser?.otherPets.get(r.name) ?? null) : null,
          share: base ? r.damage / base : 0,
        };
      }),
    };
  }

  /**
   * ¿Has usado algo que tu combinación no tiene? Entonces cambiaste de clase.
   * Es la única señal que no depende de que nadie escriba ningún comando.
   */
  #checkConflict(kind, name) {
    const cs = this.activeClasses;
    if (!cs.length) return;
    const key = kind === 'stance' ? normStance(name) : normInvocation(name);
    const table = kind === 'stance' ? STANCES : INVOCATIONS;
    const def = table[key];
    if (!def) return;                                  // no lo conocemos, no opinamos
    if (def.classes.some((c) => cs.includes(c))) return;
    this.classConflict = { reason: kind, name: def.label ?? name, classes: cs };
  }

  /** Clases: las que hayas fijado, o las deducidas de las posturas vistas. */
  get activeClasses() {
    // El /who es lo que dice el juego ahora mismo: manda sobre lo que fijaste
    // a mano hace horas, porque en EQL las clases se pueden cambiar.
    if (this.whoClasses?.length) return this.whoClasses;
    if (this.classes?.length) return this.classes;
    return inferClasses([...this.seenStances], [...this.seenInvocations]).classes;
  }

  /**
   * De dónde salen las clases, para que la interfaz lo diga sin engañar.
   *
   * `whoClasses` ya no viene sólo de un /who: también lo escriben la tabla
   * declarada a mano y la inferencia por hechizos exclusivos. Devolver 'who'
   * en los tres casos hacía que la etiqueta dijera «leídas de tu /who» sobre
   * un trío deducido, que es justo la distinción que este programa existe
   * para no perder.
   */
  get classSource() {
    if (this.whoClasses?.length) {
      if (this.classSourceAt === 'manual') return 'tabla';
      if (this.classSourceAt === 'inferido') return 'hechizos';
      return 'who';
    }
    if (this.classes?.length) return 'manual';
    const r = inferClasses([...this.seenStances], [...this.seenInvocations]);
    return r.classes.length ? (r.confident ? 'deducidas' : 'parciales') : 'desconocidas';
  }

  setClasses(list) {
    this.classes = (list ?? []).filter(Boolean);
    // Fijarlas a mano zanja el aviso y descarta el /who anterior.
    this.whoClasses = null;
    this.classConflict = null;
    this.seenStances.clear();
    this.seenInvocations.clear();
  }

  #advice(enc) {
    // El histórico son resúmenes sin filas: sólo se aconseja sobre una pelea
    // completa. Sin esta guarda el snapshot entero fallaba al no haber combate.
    if (!enc?.rows) return null;
    const me = this.self ?? 'You';
    const row = enc.rows.find((r) => r.name === me);
    if (!row) return null;
    return advise(row, {
      classes: this.activeClasses,
      // Lo que se te ha VISTO asumir. Va aparte de las clases porque no es lo
      // mismo: las clases se deducen, esto está escrito en el registro.
      seenStances: [...this.seenStances],
      seenInvocations: [...this.seenInvocations],
      stance: this.parser?.stance,
      invocation: this.parser?.invocation,
      resistsSuffered: enc.resistsSuffered,
      casts: enc.casts.slice(0, 1200),
      fades: (enc.fades ?? []).slice(0, 400),
      castsCut: Math.max(0, enc.casts.length - 1200),
      resistsCaused: enc.resistsCaused,
      interrupts: enc.interrupts,
    });
  }

  /** Consejo en vivo sobre los últimos segundos, no sobre la pelea entera. */
  #live() {
    // Fuera de combate no se aconseja: el reparto de un par de ticks sueltos
    // mientras te buffean no dice nada de la siguiente pelea.
    if (!this.tracker?.current) { this.suggestSince = null; return null; }
    const now = this.tracker.current.end;
    const cut = now - this.windowSec;
    const win = this.recent.filter((r) => r.t >= cut);
    if (!win.length) return null;
    let melee = 0, spell = 0, unmitigable = 0, observed = 0, hits = 0, landedMelee = 0, missedMelee = 0;
    for (const r of win) {
      if (r.miss) { missedMelee++; continue; }
      hits++;
      // El mismo reparto en tres cubos que en la pelea cerrada, y por lo mismo:
      // el daño periódico y el escudo no los para ninguna postura, así que no
      // pueden contar como evitables al sugerir un cambio en mitad del combate.
      if (r.school === 'melee') { melee += r.raw; landedMelee++; }
      else if (SIN_MITIGACION.has(r.school)) unmitigable += r.raw;
      else spell += r.raw;
      observed += r.amt ?? r.raw;
    }
    if (!hits) return null;
    const total = melee + spell + unmitigable;
    const l = liveAdvice(
      { melee, spell, unmitigable, total, observed, seconds: this.windowSec, hits,
        landedMelee, meleeSwings: landedMelee + missedMelee },
      { classes: this.activeClasses, stance: this.parser?.stance,
        seenStances: [...this.seenStances] });
    if (!l) return null;

    // Estabilidad: la misma recomendación debe mantenerse unos segundos antes
    // de decirla. Si no, en peleas mixtas cambiaría de opinión constantemente.
    if (!l.suggest) { this.suggestSince = null; return l; }
    if (this.suggestKey !== l.bestKey) { this.suggestKey = l.bestKey; this.suggestSince = now; }
    if (now - this.suggestSince < 5) l.suggest = false;
    return l;
  }

  setNarrate(cfg) { this.narrator.setConfig(cfg); }

  /** Dónde se guardan las peleas. Lo fija el proceso principal. */
  setStorePath(dir) {
    this.store = new FightStore(dir);
    // El almacén es nuevo y la lista de compañeros no: sin esto, cambiar de
    // carpeta de datos dejaba de marcar las peleas afectadas hasta que volvieras
    // a tocar la lista. Es la misma cura que la del rastreador en `attach`.
    this.store.setCompanions(this.companions);
    // Las mascotas cambian de nombre en cada invocación y el parser sólo
    // recuerda las de esta sesión. Sin una lista acumulada, el histórico de
    // ayer no puede reconocer a las de ayer.
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, 'pets.json'), 'utf8'));
      for (const n of raw.pets ?? []) this.knownPets.add(n);
      this.petsSaved = this.knownPets.size;
    } catch { /* aún no hay lista */ }
    const n = this.store.load();
    this.history = this.store.filter({ limit: 60 });
    // La enciclopedia va detrás del almacén y nunca antes: necesita el índice
    // cargado para saber qué le falta y para detectar que se reconstruyó.
    this.enc = new Encyclopedia(this.store);
    this.encLoad = this.enc.load();
    this.storeSeq++;
    return n;
  }

  /** Guarda el punto de lectura para reanudar en la próxima sesión. */
  saveStore(now = false) {
    if (!this.store || !this.path) return;
    try {
      const all = new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? [])]);
      this.knownPets = all;
      // Se compara con lo guardado, no con el conjunto en memoria: éste ya se
      // ha ido actualizando al cerrar cada pelea.
      if (all.size && all.size !== this.petsSaved) {
        fs.writeFileSync(path.join(this.store.dir, 'pets.json'), JSON.stringify({ pets: [...all] }));
        this.petsSaved = all.size;
      }
    } catch { /* sin permisos */ }
    try {
      fs.mkdirSync(this.store.dir, { recursive: true });
      fs.writeFileSync(path.join(this.store.dir, 'resume.json'), JSON.stringify({
        [this.path]: {
          offset: this.tailer?.offset ?? null, self: this.self, at: Date.now(),
          // La zona también: si llevas horas en la misma, su línea de entrada
          // queda fuera de los 512 KB que se releen y se perdería al reabrir.
          zone: this.parser?.zone ?? null,
          stance: this.parser?.stance ?? null,
          invocation: this.parser?.invocation ?? null,
        },
      }));
    } catch { /* disco lleno o permisos */ }
  }

  #resumeInfo(logPath) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.store.dir, 'resume.json'), 'utf8'))[logPath] ?? null;
    } catch { return null; }
  }

  #resumeOffset(logPath) { return this.#resumeInfo(logPath)?.offset ?? null; }

  /** Peleas del índice según tramo y enemigo. */
  queryHistory(q = {}) {
    if (!this.store) return [];
    return this.store.filter(q);
  }
  /** @param {number} uid  byte de inicio del registro, no el `id` de la pelea. */
  getFight(uid) { return this.store?.get(uid) ?? null; }

  /** Todas las peleas del tramo sumadas en un solo desglose. */
  aggregate(q = {}) {
    if (!this.store) return null;
    const list = this.store.filter({ ...q, limit: q.limit ?? 300 });
    const pets = [...new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? []), ...(q.myPets ?? [])])];
    // Por `uid` y no por `id`: el `id` se repite entre sesiones, así que leer
    // por él devolvía varias veces la misma pelea reciente y ninguna antigua.
    const full = list.map((sm) => {
      const f = this.store.get(sm.uid);
      // Las peleas guardadas antes de que existiera el bando se recalculan.
      return f ? ensureSides({ ...f, at: sm.at }, this.self, pets) : null;
    }).filter(Boolean);
    // Se pasan las mascotas conocidas ahora mismo: rescata las peleas guardadas
    // antes de que la marca existiera.
    const known = [...new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? []), ...(q.myPets ?? [])])];
    // Quién es la mascota de quién se aplica AHORA, no como quedó guardado: lo
    // declaras a mitad de sesión y las peleas de hace media hora se rotulan
    // bien sin reconstruir nada.
    const dueños = Object.fromEntries(this.parser?.otherPets ?? []);
    const conDueño = full.map((f) => ({ ...f, rows: ownerPets(f.rows, dueños) }));
    return aggregate(
      q.mergePets
        ? conDueño.map((f) => ({ ...f,
          rows: mergeOwnerPets(mergePets(f.rows, q.petLabel, known, this.self, q.notPets ?? [])) }))
        : conDueño,
      this.self);
  }
  /**
   * Catálogo de tus hechizos desde el histórico, con los cooldowns medidos.
   *
   * Los cooldowns se acumulan en vivo según pasan los avisos: el histórico
   * guarda peleas, no líneas sueltas, así que la única forma de tenerlos es ir
   * anotándolos al leer.
   */
  spellCatalog(q = {}) {
    if (!this.store) return { spells: [], cooldowns: [] };
    const list = this.store.filter({ ...q, limit: q.limit ?? 300 });
    const full = list.map((sm) => {
      const f = this.store.get(sm.uid);
      return f ? { ...f, uid: sm.uid, at: sm.at } : null;
    }).filter(Boolean);
    return {
      spells: catalog(full, this.self, this.cooldowns),
      cooldowns: [...this.cooldowns.values()].sort((a, b) => b.attempts - a.attempts),
      marks: this.#marks(full),
      book: spellbook(this.store, full, this.self),
      fights: full.length,
    };
  }

  /**
   * La ficha de un hechizo. Se pide al abrirlo, no con la lista.
   *
   * Son 205 puntos de uno solo: mandarlos con el catálogo entero serían
   * veinticuatro series por el puente cada vez que se pinta una tabla.
   */
  spellDetail(nombre, q = {}) {
    if (!this.store || !nombre) return null;
    const list = this.store.filter({ ...q, limit: q.limit ?? 2000 });
    const full = list.map((sm) => {
      const f = this.store.get(sm.uid);
      return f ? { ...f, uid: sm.uid, at: sm.at } : null;
    }).filter(Boolean);
    return spellDetail(full, this.self, nombre, this.cooldowns);
  }

  /**
   * Tus mejores marcas, agrupadas por nivel.
   *
   * Sin agrupar no dicen nada: medido en un log real, la mediana de dps cae de
   * 127 a 44 al bajar de nivel 50 a 25. Compararte hoy contra el récord de
   * cuando ibas a 50 sólo informa de que ya no vas a 50.
   *
   * Las peleas sin nivel conocido van en su propio grupo y se dice que lo es.
   */
  #marks(fights) {
    const me = this.self ?? 'You';
    const grupos = new Map();
    for (const f of fights) {
      if ((f.duration ?? 0) < 30) continue;
      const row = (f.rows ?? []).find((r) => r.name === me);
      if (!row || !(row.damage > 0)) continue;
      const k = f.level ?? 'sin nivel';
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push({
        dps: row.dps, damage: row.damage, duration: f.duration,
        label: f.label, zone: f.zone, diff: f.diff ?? null, diffTag: f.diffTag ?? null,
        at: f.at ?? null, uid: f.uid ?? null,
      });
    }
    return [...grupos].map(([level, list]) => {
      list.sort((a, b) => b.dps - a.dps);
      const med = list[Math.floor(list.length / 2)]?.dps ?? 0;
      return {
        level: level === 'sin nivel' ? null : level,
        fights: list.length, best: list[0]?.dps ?? 0, median: med,
        top: list.slice(0, 5),
      };
    }).sort((a, b) => (b.level ?? -1) - (a.level ?? -1));
  }

  foeList(sinceMs) { return this.store?.foeList(sinceMs) ?? []; }
  storeStats() { return this.store?.stats() ?? null; }

  // ── Enciclopedia ───────────────────────────────────────────────────────
  // Todo esto se contesta desde la ficha, que ya está en memoria. Lo único que
  // toca el disco es la lista de combates contra un enemigo, y sólo el índice.
  encZones() { return this.enc?.zones() ?? []; }
  encZoneFoes(base, diff) { return this.enc?.zoneFoes(base, diff ?? null) ?? []; }
  encFoe(name) { return this.enc?.foe(name) ?? null; }
  encFoeAt(name, diff) { return this.enc?.foeAt(name, diff ?? null) ?? null; }
  encFoes() { return this.enc?.foes() ?? []; }
  encLoot() { return this.enc?.lootList() ?? []; }
  /**
   * LA ÚLTIMA MUERTE DE CADA NOMBRE, para el temporizador de reaparición.
   *
   * Se busca por el ÍNDICE, que ya trae los nombres matados en cada pelea, y
   * sólo se abre del disco LA PELEA QUE LA CONTIENE, para sacarle el
   * desplazamiento exacto de `killTimes`. Con el índice a secas la marca sería
   * la del principio de la pelea, y en una pelea larga eso son minutos de
   * error justo en la cifra que el crono descuenta.
   *
   * Devuelve segundos epoch, o null si ese nombre no ha muerto nunca. NULL NO
   * ES CERO: «no ha muerto nunca» y «murió en el instante cero» no pueden
   * verse igual, y quien lo pinta se apoya en esa distinción.
   *
   * ── LAS UNIDADES VAN EN EL NOMBRE DE LA VARIABLE ──────────────────────
   *
   * `sm.at` va en MILISEGUNDOS y `killTimes.t` en SEGUNDOS. Escribiendo esto se
   * sumaron sin convertir y salieron fechas del AÑO 58600. La aritmética no
   * falló: `a + b` es correcto para cualquier par de números. Falló el NOMBRE,
   * que no decía en qué unidad estaba cada uno, así que la operación parecía
   * bien escrita mirándola.
   *
   * Por eso aquí toda variable de tiempo lleva la unidad pegada —`atMs`,
   * `tSeg`, `muerteSeg`— y no hay ni una que se llame sólo `t` o `at`. Un
   * error de unidad no lo caza ninguna prueba de tipos ni ninguna revisión
   * rápida: lo caza el nombre, o no lo caza nadie.
   */
  ultimaMuerte(nombres = []) {
    const pide = new Set(nombres.filter(Boolean));
    const out = {};
    for (const n of pide) out[n] = null;
    if (!pide.size || !this.store) return out;

    // Del más reciente al más viejo: en cuanto un nombre aparece, ya es el suyo.
    const idx = [...(this.store.index ?? [])].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    const faltan = new Set(pide);
    for (const sm of idx) {
      if (!faltan.size) break;
      const aqui = (sm.kills ?? []).filter((k) => faltan.has(k));
      if (!aqui.length) continue;
      const inicioMs = sm.at ?? 0;                  // el índice guarda MILISEGUNDOS
      const duracionSeg = sm.duration ?? 0;         // y la duración, SEGUNDOS
      let f = null;
      try { f = this.store.get(sm.uid); } catch { f = null; }
      for (const n of aqui) {
        // `killTimes` da el SEGUNDO dentro de la pelea. Si falta —peleas
        // guardadas por versiones que no lo escribían— se cae al final de la
        // pelea, que es la cota más cercana que hay, y no al principio.
        const tsSeg = (f?.killTimes ?? []).filter((k) => k.name === n).map((k) => k.t);
        const dentroSeg = tsSeg.length ? Math.max(...tsSeg) : duracionSeg;
        out[n] = Math.round(inicioMs / 1000) + dentroSeg;
        faltan.delete(n);
      }
    }
    return out;
  }

  encDeaths() { return this.enc?.deaths(this.self) ?? null; }
  encProgress() { return this.enc?.progress() ?? null; }
  encCounts() { return this.enc?.counts() ?? null; }
  encStatus() {
    return {
      ...(this.enc?.audit() ?? {}),
      load: this.encLoad ?? null,
      // Resúmenes del índice completados al arrancar. Se dice en el pie por lo
      // mismo que la ficha: si algo tarda un momento la primera vez, mejor que
      // se sepa por qué.
      backfilled: this.storeBackfill ?? 0,
    };
  }
  encRebuild() { return this.enc?.rebuild() ?? { ok: false }; }

  /** Los combates contra un enemigo, opcionalmente los de una zona y dificultad. */
  encFights(q = {}) {
    if (!this.store) return [];
    const f = { foeExact: q.name, zoneBase: q.base, limit: q.limit ?? 200 };
    // Sólo se pasa si de verdad se pide: `null` es «sin marca» y no «da igual».
    if (Object.hasOwn(q, 'diff')) f.diff = q.diff;
    return this.store.filter(f);
  }

  /**
   * Al caer un enemigo, quién le hizo cuánto.
   *
   * Se calcula sobre ESE objetivo, no sobre la pelea: en una pelea con varios
   * enemigos el reparto general no dice nada de quién mató a cuál. El dps va
   * sobre el tiempo que ese enemigo estuvo recibiendo golpes.
   */
  #makeKillCard(ev) {
    const enc = this.tracker?.current;
    if (!enc) return;
    const me = this.self ?? 'You';
    const pets = new Set(this.parser?.pets.keys() ?? []);
    if (ev.victim === me || pets.has(ev.victim)) return;      // los tuyos no
    // Ni los compañeros de grupo: la tarjeta es el reparto de un enemigo que
    // cae, no el de cualquiera que muera cerca.
    if (this.foes.size && !this.foes.has(ev.victim)) return;

    const first = enc.targetFirst.get(ev.victim) ?? enc.start;
    const secs = Math.max(1, Math.round(ev.t - first) + 1);
    const rows = [];
    for (const c of enc.combatants.values()) {
      const b = c.byTarget.get(ev.victim);
      if (!b || b.sum <= 0 || c.name === ev.victim) continue;
      rows.push({ name: c.name, damage: b.sum, dps: b.sum / secs, hits: b.n });
    }
    if (!rows.length) return;
    const total = rows.reduce((a, r) => a + r.damage, 0);
    rows.sort((a, b) => b.damage - a.damage);
    for (const r of rows) r.share = total ? r.damage / total : 0;
    // Cada muerte aporta una ventana medida: daño y segundos reales de pelea
    // contra ESE enemigo. La media de la sesión es la suma de las ventanas,
    // no el promedio de los promedios, que pesaría igual una pelea de 3
    // segundos que una de tres minutos.
    for (const r of rows) {
      const a = this.killAgg.get(r.name) ?? { damage: 0, seconds: 0, kills: 0 };
      a.damage += r.damage;
      a.seconds += secs;
      a.kills += 1;
      this.killAgg.set(r.name, a);
    }
    this.lastKill = { victim: ev.victim, seconds: secs, total, rows, at: Date.now() };
  }

  /**
   * DPS por combatiente, en tres lecturas distintas y ninguna intercambiable:
   *   kill  media de las ventanas de cada enemigo abatido
   *   w10   últimos 10 segundos
   *   w20   últimos 20 segundos
   */
  #sessionDps() {
    const now = this.tracker?.current?.end ?? (Date.now() / 1000);
    const out = {};
    for (const [name, a] of this.killAgg) {
      out[name] = { kill: a.seconds ? a.damage / a.seconds : null, kills: a.kills, w10: 0, w20: 0 };
    }
    for (const h of this.recentHits) {
      const age = now - h.t;
      if (age > 20) continue;
      if (!out[h.name]) out[h.name] = { kill: null, kills: 0, w10: 0, w20: 0 };
      out[h.name].w20 += h.amount / 20;
      if (age <= 10) out[h.name].w10 += h.amount / 10;
    }
    return out;
  }

  /**
   * Borrón y cuenta nueva en el overlay, sin tocar el histórico de peleas.
   *
   * Vacía las dos cosas a la vez —la pila de combates y el acumulado de la
   * sesión— porque son la misma pregunta: «empiezo a contar de nuevo». Vaciar
   * una y dejar la otra daría una pantalla donde la tira de sesión habla de
   * peleas que ya no se ven.
   */
  resetSession() {
    this.lastKill = null;
    this.suggestKey = null;
    this.suggestSince = null;
    this.killAgg.clear();
    this.recentHits.length = 0;
    this.closedFights = [];
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });
    if (this.tracker) this.session.zone = this.tracker.zone;
    return true;
  }
  setLang(code) { setLang(code); }

  /** «Ese no es mío»: deja de preguntarlo. */
  dismissPet(name) { this.notMine.add(name); this.parser?.petMaybe.delete(name); return true; }

  /**
   * «Esa mascota es de aquél», dicho a mano.
   *
   * Va al mismo sitio que lo que saca el `/pet who leader` de otro jugador, y
   * por la misma razón: dura la sesión. Los nombres de mascota salen de una
   * lista cerrada y se reciclan entre jugadores, así que la frase sólo es
   * cierta mientras esa mascota esté invocada. Guardarla para siempre sería
   * repetir el fallo que metía la pelea de otro en tu histórico.
   */
  assignPetOwner(pet, owner) {
    if (!pet || !this.parser) return {};
    if (owner) {
      this.parser.otherPets.set(pet, owner);
      // Deja de ser candidata a mascota tuya: ya sabemos de quién es.
      this.parser.petMaybe.delete(pet);
      this.parser.pets.delete(pet);
    } else this.parser.otherPets.delete(pet);
    return Object.fromEntries(this.parser.otherPets);
  }

  /** Los compañeros que has declarado. Los fija el proceso principal. */
  setCompanions(list) {
    this.companions = new Set((list ?? []).filter(Boolean));
    // Y al rastreador, que los necesita para saber si abrir una pelea en la que
    // no llegaste a pegar. Sin esta línea la lista existía sólo para pintar.
    this.tracker?.setCompanions(this.companions);
    // Y al almacén, que con ella puede marcar al leer las peleas viejas donde
    // uno de ellos quedó en el bando enemigo. Ver `dudaCompa` en `store.js`.
    this.store?.setCompanions(this.companions);
    return [...this.companions];
  }

  markPet(name) { this.parser?.markPet(name); this.#refrescarMascotas(); }
  unmarkPet(name) { this.parser?.unmarkPet(name); this.#refrescarMascotas(); }

  /**
   * Lo que declaraste tuyo, aplicado al arrancar.
   *
   * Sin esto, marcar una mascota duraba lo que durase la sesión: se guardaba en
   * la configuración y nadie se la volvía a dar al analizador, así que tras
   * reiniciar el filtro de relevancia no la conocía. Una decisión que hay que
   * repetir cada vez no es una decisión, es una molestia.
   */
  setMyPets(list = [], notList = []) {
    for (const n of list) this.parser?.markPet(n);
    for (const n of notList) this.parser?.unmarkPet(n);
    this.#refrescarMascotas();
    return [...(this.parser?.pets.keys() ?? [])];
  }

  /** Quien lee mascotas las lee de un solo sitio, y se avisa a la vez. */
  #refrescarMascotas() {
    const vivas = [...(this.parser?.pets.keys() ?? [])];
    this.narrator.setPets(vivas);
    if (this.tracker) this.tracker.petNames = new Set(vivas);
    return vivas;
  }

  /**
   * Aliados sin identificar: pegan a lo mismo que tú pero no se sabe qué son.
   * En EQL la mascota cambia de nombre en cada invocación, así que no vale
   * memorizarlos: hay que pedirle al usuario un /pet who leader.
   */
  /**
   * Pedir /pet who leader, y sólo cuando de verdad hace falta.
   *
   * En EQL la mascota cambia de nombre en CADA invocación y el log no lo dice.
   * Medido en un log real de 27 horas: 18 mascotas distintas en combate y sólo
   * 4 `/pet who leader`. Las otras 14 nunca se confirmaron.
   *
   * El disparador NO es la muerte: sólo 2 de esas 18 apariciones vinieron
   * después de que muriera una conocida. El que cubre los casos es «aparece un
   * aliado sin identificar pegando a tus enemigos», que es justo cuando la
   * aplicación no sabe qué está viendo.
   *
   * Una vez por nombre y por sesión: si la mascota muere tres veces en una
   * pelea no se dice tres veces, y si la apagas no se dice ninguna.
   */
  petPrompt(enc) {
    if (this.backfilling) return;
    if (this.narrator.config?.combat?.petprompt === false) return;
    const h = this.#petHint(enc);
    const nuevo = (h?.candidates ?? []).find((n) => !this.petPrompted.has(n));
    if (!nuevo) return;
    this.petPrompted.add(nuevo);
    this.emit('alert', {
      id: 'pet-unknown', name: 'mascota',
      speak: null,                            // en pantalla, no hablado
      text: t('pet.prompt', { who: nuevo }),
      sound: null, color: '#6FC7D8', holdMs: 12000, at: Date.now(),
    });
  }

  #petHint(enc) {
    if (!enc?.rows) return null;
    const me = this.self ?? 'You';
    const known = new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? [])]);
    const mine = enc.rows.find((r) => r.name === me);
    if (!mine) return null;
    const myFoes = new Set(mine.targets.map((t) => t.name));
    // Alguien que pega a TUS enemigos, no eres tú, no es enemigo, no es una
    // mascota confirmada y no lo has descartado ya. En grupo puede ser la
    // mascota de otro: por eso hay que preguntarlo en vez de suponerlo.
    const candidates = enc.rows
      .filter((r) => r.name !== me && !known.has(r.name) && !this.notMine.has(r.name)
        // Un compañero declarado no es una mascota sin identificar: preguntar
        // por él sería preguntar algo que ya has contestado.
        && !this.companions.has(r.name)
        && !this.parser?.otherPets.has(r.name) && r.damage > 0)
      .filter((r) => r.targets.some((t) => myFoes.has(t.name)))
      .filter((r) => !myFoes.has(r.name))
      .map((r) => r.name);
    if (!candidates.length) return null;
    return {
      candidates,
      // Las que dijeron "Master" en voz alta son las más probables.
      likely: candidates.filter((n) => this.parser?.petMaybe.has(n)),
      currentPet: this.parser?.currentPet ?? null,
    };
  }

  snapshot() {
    const current = this.#enc(this.tracker?.current);
    return {
      ...this.describe(),
      classes: this.activeClasses,
      classSource: this.classSource,
      autoFullRead: !!this.autoFullRead,
      classConflict: this.classConflict,
      level: this.level,
      parsed: this.parser?.parsed ?? 0,
      unknown: this.parser?.unrecognized ?? 0,
      pets: this.parser ? [...this.parser.pets.keys()] : [],
      allPets: [...new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? [])])],
      petOwners: Object.fromEntries(this.parser?.otherPets ?? []),
      timers: this.triggers.snapshot(),
      current,
      history: this.history,
      // Lo que mira la lista para saber si tiene que releer el índice. No es un
      // número de peleas: es un contador de cambios, y por eso sirve aunque
      // `history` esté recortada y su longitud no se mueva.
      storeSeq: this.storeSeq,
      session: this.#enc(this.session?.current),
      lastKill: this.lastKill ?? null,
      sessionDps: this.#sessionDps(),
      advice: this.#advice(current ?? this.history[0]),
      petHint: this.#petHint(current ?? this.history[0]),
      classPrompt: this.classPrompt,
      classSourceAt: this.classSourceAt,
      currentPet: this.parser?.currentPet ?? null,
      live: (() => { const l = this.#live(); this.narrator.stance(l); return l; })(),
    };
  }
}
