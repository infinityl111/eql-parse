import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { LogTailer } from './tailer.js';
import { Parser } from './parser.js';
import { EncounterTracker, DAMAGE_KINDS } from './encounter.js';
import { TriggerEngine } from './triggers.js';
import { advise, liveAdvice } from './advisor.js';
import { Narrator } from './narrator.js';
import { setLang } from './i18n.js';
import { FightStore } from './store.js';
import { aggregate, mergePets, ensureSides } from './aggregate.js';
import { inferClasses, availableFor, normStance, normInvocation, STANCES, INVOCATIONS } from './stances.js';
import { parseZone } from './zones.js';
import { catalog } from './catalog.js';
import { proofOf } from './classes.js';
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
    this.knownPets = new Set();  // todas las vistas alguna vez, entre sesiones
    this.petsSaved = 0;
    this.notMine = new Set();    // aliados que ya dijiste que no son tuyos
    this.storePath = null;      // fichero de peleas guardadas
    this.store = null;
    this.history = [];          // peleas cerradas, la más reciente primero
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
    this.seq = 0;
    this.error = null;

    this.parser = new Parser({ self: this.self });
    this.narrator.setSelf(this.self);
    this.narrator.setPets([]);
    this.tracker = new EncounterTracker({
      self: this.self,
      idleSec: opts.idleSec ?? 20,
      closeOnDeath: opts.closeOnDeath ?? false,
    });
    this.tracker.on('close', (enc) => {
      const f = this.#enc(enc);
      this.narrator.fightEnd(f);
      for (const n of this.parser?.pets.keys() ?? []) this.knownPets.add(n);
      if (f && (f.total > 0 || f.enemyTotal > 0)) {
        // La hora de la PELEA, no la de importarla: si no, al reconstruir el
        // almacén releyendo el log, todo queda fechado en el mismo instante y
        // los filtros por tramo dejan de significar nada.
        const at = Math.round((f.start ?? Date.now() / 1000) * 1000);
        const sum = this.store?.append(f, at) ?? f;
        this.history.unshift(sum);
        if (this.history.length > 60) this.history.length = 60;
        this.saveStore();
      }
      this.petPrompt(f);
      this.emit('encounter');
    });
    this.tracker.on('open', () => { this.foes.clear(); this.narrator.fightStart(); });
    // Acumulador de sesión: mismos eventos, pero no se cierra nunca. Es lo que
    // ve el overlay, que sólo se pone a cero cuando tú lo pides.
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });

    // Se recupera lo guardado de ESTE log y se reanuda por donde iba, así que
    // sólo se relee lo que se escribió mientras la aplicación estaba cerrada.
    this.history = this.store ? this.store.filter({ limit: 60 }) : [];
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
      if (ev.kind === 'pet_claim' || ev.kind === 'pet_leader' || ev.kind === 'pet_order') {
        this.narrator.setPets([...this.parser.pets.keys()]);
        if (this.tracker) this.tracker.petNames = new Set(this.parser.pets.keys());
      }
      if (ev.kind === 'stance' && ev.stance) this.seenStances.add(ev.stance);
      if (ev.kind === 'invocation' && ev.invocation) this.seenInvocations.add(ev.invocation);
      this.#cooldown(ev);
      // El /who de tu propio personaje es la única fuente que no admite dudas.
      if (ev.kind === 'who' && ev.who) this.whoSeen.add(ev.who);
      if (ev.kind === 'who' && ev.who === (this.self ?? 'You') && ev.classes?.length) {
        const changed = this.whoClasses && this.whoClasses.join() !== ev.classes.join();
        this.whoClasses = ev.classes;
        this.whoAt = ev.t;
        this.level = ev.level;
        // Un /who nuevo es la verdad: se descarta lo anterior y lo observado.
        if (changed || this.classes?.length) {
          this.classes = null;
          this.seenStances.clear();
          this.seenInvocations.clear();
        }
        this.classConflict = null;
        this.#markLevel(ev.level, ev.classes);
      }
      // La subida de nivel es una afirmación absoluta y gratis, y en EQL el
      // nivel baja al cambiar una clase por otra más baja: es la otra mitad de
      // la línea de tiempo, junto al /who.
      if (ev.kind === 'levelup' && ev.level) this.#markLevel(ev.level, null);
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
      // ev.raw es la línea sin la marca de tiempo, la reconozca el parser o no.
      if (!this.backfilling) this.triggers.match(ev.raw, ev.t);
    });
    this.tailer.on('waiting', () => { this.status = 'missing'; });
    this.tailer.on('flush', () => { this.status = 'monitoring'; });
    this.tailer.on('error', (e) => { this.status = 'error'; this.error = e.message; });

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
  }

  describe() {
    return {
      path: this.path, self: this.self, server: this.server,
      status: this.status, error: this.error,
      zone: this.parser?.zone ?? null,
      stance: this.parser?.stance ?? null,
      invocation: this.parser?.invocation ?? null,
    };
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
   */
  classProof(ev) {
    const clase = proofOf(ev.ability);
    if (!clase) return;
    this.lastProof.set(clase, ev.t);
    const trio = this.whoClasses;
    if (!trio?.length || trio.includes(clase)) return;

    const sale = trio.filter((c) => c !== clase)
      .sort((a, b) => (this.lastProof.get(a) ?? -1) - (this.lastProof.get(b) ?? -1))[0];
    if (!sale) return;

    const nuevo = trio.map((c) => (c === sale ? clase : c));
    this.#markLevel(null, nuevo, 'inferido');
    this.level = null;
    for (const tr of [this.tracker, this.session]) if (tr) tr.level = null;

    // El aviso: sólo aquí tiene sentido pedir el comando, porque es el
    // instante exacto en que la aplicación sabe que su información está vieja.
    // Una vez por contradicción, no por hechizo: si juegas toda la tarde con
    // druida, con decirlo una vez basta hasta que escribas /who o cambies otra
    // vez. Y en pantalla, no por voz: escribirlo treinta segundos después no
    // cuesta nada, y la voz está reservada a lo que cambia lo que haces ya.
    const clave = `${clase}|${nuevo.join('/')}`;
    if (this.promptedClass === clave) return;
    this.promptedClass = clave;
    this.classPrompt = { spell: ev.ability, clase, trio: nuevo, sale, at: Date.now() };
    if (!this.backfilling) {
      this.emit('alert', {
        id: 'class-contradiction', name: 'clases',
        speak: null,                            // en pantalla, no hablado
        text: t('cls.contradiction', { spell: ev.ability, cls: t(`cl.${clase}`) }),
        sound: null, color: '#6FC7D8', holdMs: 12000, at: Date.now(),
      });
    }
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

  #b(list) { return list.map(([k, v]) => ({ name: k, sum: v.sum, n: v.n, max: v.max, min: v.min === Infinity ? 0 : v.min, crits: v.crits, school: v.school, type: v.type })); }

  #row(r) {
    return {
      name: r.name,
      damage: r.damage, dps: r.dps, dpsOwn: r.dpsOwn, dpsActive: r.dpsActive, share: r.share,
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
      takenByType: this.#b(r.takenByType),
      rawTakenByType: this.#b(r.rawTakenByType), rawMeleeOut: r.rawMeleeOut,
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
   */
  #sides(rows, me, petSet) {
    const foes = new Set();
    const ours = new Set([me, ...petSet]);
    for (const r of rows) {
      const hitsUs = (r.byTarget ?? []).some(([n]) => ours.has(n));
      if (hitsUs && !ours.has(r.name)) foes.add(r.name);
    }
    for (const r of rows) {
      if (!ours.has(r.name)) continue;
      for (const [n] of r.byTarget ?? []) if (!ours.has(n)) foes.add(n);
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
        if (foes.has(r.name) || ours.has(r.name)) continue;
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
    const petSet = new Set([...this.knownPets, ...(this.parser?.pets.keys() ?? [])]);
    const foeSet = this.#sides(t.rows, me, petSet);
    const allyRows = t.rows.filter((r) => !foeSet.has(r.name));
    const foeRows = t.rows.filter((r) => foeSet.has(r.name));
    const allyTotal = allyRows.reduce((a, r) => a + r.damage, 0);
    const foeTotal = foeRows.reduce((a, r) => a + r.damage, 0);
    // La zona se descompone al guardar y no al leer: la dificultad cambia de
    // verdad lo que es un enemigo, así que tiene que ser un campo de la pelea y
    // no un trozo de texto dentro del nombre.
    const z = parseZone(enc.zone);
    return {
      id: enc.id,
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
      spellVsFoe: [...(enc.spellVsFoe ?? new Map()).values()],
      // Abatido = uno del bando enemigo. Antes bastaba con «no eres tú ni tu
      // mascota», y en cuanto empezaron a contarse las muertes de los
      // compañeros de grupo, la caída de un aliado se apuntaba como una presa.
      kills: enc.kills.filter((k) => foeSet.has(k.victim)).map((k) => k.victim),
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
      series: [...(enc.series ?? new Map()).values()].sort((a, b) => a.s - b.s),
      stanceSpans: (enc.stanceSpans ?? []).map((x, i, arr) => ({
        ...x, to: i === arr.length - 1 ? Math.max(x.to, enc.end - enc.start) : x.to,
      })),
      label: (() => {
        // Nombre de la pelea: el enemigo abatido, nunca los tuyos.
        const foesDown = enc.kills.filter((k) => foeSet.has(k.victim));
        if (foesDown.length) {
          const c = {};
          for (const k of foesDown) c[k.victim] = (c[k.victim] ?? 0) + 1;
          return Object.entries(c).map(([n, x]) => (x > 1 ? `${n} ×${x}` : n)).join(', ');
        }
        const foes = [...enc.targetTotals].filter(([n]) => n !== (this.self ?? 'You'));
        foes.sort((a, b) => b[1] - a[1]);
        return foes.length ? foes[0][0] : null;
      })(),

      resistsSuffered: enc.resistsSuffered,
      casts: (enc.casts ?? []).slice(0, 300),
      resistsCaused: enc.resistsCaused,
      interrupts: enc.interrupts,
      closed: enc.closed,
      start: enc.start,
      rows: t.rows.map((r) => {
        const enemy = foeSet.has(r.name);
        const base = enemy ? foeTotal : allyTotal;
        // La marca va en la fila y no en una lista aparte: las mascotas cambian
        // de nombre en cada invocación y el histórico no sabría reconocerlas.
        // «Sin identificar»: pegó a tus enemigos, pero no consta que sea tuyo.
        // Ni tú, ni mascota confirmada, ni nadie de quien haya un /who. El log
        // de EQL no dice quién va en tu grupo —comprobado: ni invitaciones, ni
        // entradas, ni salidas—, así que esto no se puede resolver solo y lo
        // honesto es enseñarlo aparte en vez de sumarlo a tu bando.
        const desconocido = !enemy && r.name !== me && !petSet.has(r.name)
          && !this.parser?.otherPets.has(r.name) && !this.whoSeen.has(r.name);
        return {
          ...this.#row(r), side: enemy ? 'enemy' : 'ally',
          unidentified: desconocido,
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

  /** De dónde salen las clases, para que la interfaz lo diga sin engañar. */
  get classSource() {
    if (this.whoClasses?.length) return 'who';
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
      stance: this.parser?.stance,
      invocation: this.parser?.invocation,
      resistsSuffered: enc.resistsSuffered,
      casts: enc.casts.slice(0, 300),
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
    let melee = 0, spell = 0, observed = 0, hits = 0, landedMelee = 0, missedMelee = 0;
    for (const r of win) {
      if (r.miss) { missedMelee++; continue; }
      hits++;
      if (r.school === 'melee') { melee += r.raw; landedMelee++; } else spell += r.raw;
      observed += r.amt ?? r.raw;
    }
    if (!hits) return null;
    const total = melee + spell;
    const l = liveAdvice(
      { melee, spell, total, observed, seconds: this.windowSec, hits,
        landedMelee, meleeSwings: landedMelee + missedMelee },
      { classes: this.activeClasses, stance: this.parser?.stance });
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
    return aggregate(
      q.mergePets ? full.map((f) => ({ ...f, rows: mergePets(f.rows, q.petLabel, known, this.self, q.notPets ?? []) })) : full,
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
      fights: full.length,
    };
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

  /**
   * Al caer un enemigo, quién le hizo cuánto.
   *
   * Se calcula sobre ESE objetivo, no sobre la pelea: en una pelea con varios
   * bichos el reparto general no dice nada de quién mató a cuál. El dps va
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

  /** Pone a cero el acumulado del overlay sin tocar el histórico de peleas. */
  resetSession() {
    this.lastKill = null;
    this.suggestKey = null;
    this.suggestSince = null;
    this.killAgg.clear();
    this.recentHits.length = 0;
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });
    if (this.tracker) this.session.zone = this.tracker.zone;
    return true;
  }
  setLang(code) { setLang(code); }

  /** «Ese no es mío»: deja de preguntarlo. */
  dismissPet(name) { this.notMine.add(name); this.parser?.petMaybe.delete(name); return true; }

  markPet(name) { this.parser?.markPet(name); this.narrator.setPets([...(this.parser?.pets.keys() ?? [])]); }
  unmarkPet(name) { this.parser?.unmarkPet(name); this.narrator.setPets([...(this.parser?.pets.keys() ?? [])]); }

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
