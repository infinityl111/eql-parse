import { RANGES } from './ranges.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Almacén de peleas.
 *
 * Dos ficheros, y la razón importa:
 *
 *   fights.ndjson   una pelea completa por línea, sólo se AÑADE al final.
 *                   Nada se recorta ni se borra: el histórico queda íntegro.
 *   fights.idx      un resumen por línea, con el byte donde empieza la pelea
 *                   completa. Es lo único que se carga en memoria al arrancar.
 *
 * Un único JSON con todo dentro obligaría a releerlo y reescribirlo entero en
 * cada pelea. Con mil peleas eso son decenas de megas moviéndose sin parar.
 * Añadir al final cuesta lo mismo con una pelea que con diez mil, y el índice
 * de mil peleas ocupa unos 200 KB.
 *
 * IDENTIDAD DE UNA PELEA
 *
 * `id` NO identifica nada fuera de la sesión que la generó: el contador vive en
 * el EncounterTracker y vuelve a 1 en cada arranque, así que la pelea 1 de hoy
 * y la 1 de ayer comparten número. Cuando el mapa de búsqueda se indexaba por
 * `id`, la de hoy tapaba a la de ayer: pinchar una pelea vieja abría otra, y el
 * resumen del tramo leía la misma pelea varias veces y se dejaba fuera las
 * antiguas.
 *
 * La identidad es `uid` = el byte donde empieza el registro. Es único por
 * construcción (el fichero sólo crece), ya estaba guardado en cada línea del
 * índice como `off`, y por eso los índices antiguos se migran solos sin
 * reescribir nada.
 *
 * DUPLICADOS
 *
 * Releer el log entero vuelve a generar las mismas peleas. Como `at` es la hora
 * de la PELEA y no la de importarla, la terna (at, total, duración) es estable
 * entre relecturas y sirve de identidad lógica: `append` la usa para no guardar
 * dos veces lo mismo, y `load` descarta las copias que ya hubiera en disco.
 */

/** Identidad lógica de una pelea: estable aunque se reimporte el log. */
const logicalKey = (s) => `${s.at}:${s.total ?? 0}:${s.duration ?? 0}`;

/**
 * Generación de los datos guardados. NO es la versión de la aplicación.
 *
 * Son dos preguntas distintas y conviene no mezclarlas: «qué versión es esto»
 * la contesta package.json, y «lo que hay en disco describe lo que pasó» la
 * contesta este número. Un arreglo de interfaz sube la primera y no debería
 * obligar a nadie a releer su log; un arreglo del parser sube ésta aunque la
 * versión no cambie.
 *
 * Se sube cuando lo guardado por la generación anterior es incorrecto y no se
 * puede arreglar leyéndolo mejor:
 *
 *   1  (implícita)  todo lo anterior a que esta marca existiera. Muertes sin
 *                   contar, peleas duplicadas, identidades que se tapaban,
 *                   vida estimada multiplicada, Evasive mal calculada.
 *   2               `You have been knocked unconscious!` se contaba como una
 *                   muerte además de la línea de muerte real que siempre la
 *                   sigue: cada muerte tuya valía por dos.
 *   3               Los avisos de subárea («has entrado en un sitio donde no
 *                   funciona la levitación») se guardaban como zona y
 *                   machacaban la real, y con ella la dificultad de la
 *                   instancia. El 23% de las peleas de un log real tenía la
 *                   zona destruida. Además la dificultad pasa a ser un campo
 *                   propio, que es lo que permite separar el expediente.
 *   4               Botín perdido y botín mal contado. De las 681 líneas de
 *                   botín de un log real se descartaban 98 —el 14%—: 83 porque
 *                   traían cantidad en vez de artículo («2 Phosphorous
 *                   Powder») y 15 porque acababan en «and stored it in your
 *                   currency», un final que no existía como regla; entre estas
 *                   últimas, los 9 `Mote of Major Potential` recogidos, de los
 *                   que no aparecía ninguno. Y la cantidad no se guardaba: lo
 *                   recogido se contaba por veces y no por unidades, así que
 *                   «2 Bone Chips» valía uno. Releyendo el log salen 764
 *                   unidades donde antes se veían 583.
 *   5               El botin recogido de un cadaver que remato entero un
 *                   companero no tenia pelea a la que colgarse y se perdia. Se
 *                   guarda aparte, en `loot.ndjson`, porque recoger un objeto
 *                   es un suceso TUYO y no de un combate: la prueba de que
 *                   estabas alli es que lo cogiste. Eran 5 objetos en un
 *                   registro real.
 */
export const STORE_VERSION = 5;
const META = 'store.json';

/** Generación de un almacén ya marcado. Lo que no sea un número es anterior. */
export function generacion(meta) {
  const v = Number(meta?.version);
  return Number.isFinite(v) ? v : 0;
}

export class FightStore {
  constructor(dir, self = null) {
    this.dir = dir;
    /** Tu nombre. Hace falta para anotar tu daño en cada resumen. */
    this.self = self;
    this.dataPath = path.join(dir, 'fights.ndjson');
    this.idxPath = path.join(dir, 'fights.idx');
    // Botín recogido sin ninguna pelea a la que colgarlo. Fichero propio y no
    // un campo de las peleas, porque no pertenece a ninguna: recoger algo es un
    // suceso tuyo y existe aunque no hubiera combate. Ver `orphanLoot`.
    this.lootPath = path.join(dir, 'loot.ndjson');
    this.orphanLoot = [];
    this.lootSeen = new Set();
    this.index = [];        // resúmenes, del más reciente al más antiguo
    this.cache = new Map(); // uid -> pelea completa, para no releer el disco
    this.byUid = new Map();
    this.seen = new Map();  // identidad lógica -> resumen, para no duplicar
    this.dropped = 0;       // duplicados descartados al cargar
  }

  /** Con qué versión se escribió lo que hay guardado. */
  meta() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, META), 'utf8')); }
    catch { return null; }
  }

  stamp(version = STORE_VERSION) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, META),
        JSON.stringify({ version, at: Date.now() }, null, 2));
      return true;
    } catch { return false; }
  }

  /**
   * ¿Hay que releer el log?
   *
   * Sólo si ya hay peleas guardadas: un almacén vacío no tiene nada que
   * corregir, se marca y en paz. Sin marca y con peleas dentro significa que lo
   * escribió una versión anterior a que la marca existiera, o sea la 1.0.x.
   */
  migration() {
    const m = this.meta();
    const fights = this.index.length;
    const from = m?.version ?? null;
    if (!fights) return { needed: false, from, fights, current: STORE_VERSION };
    return {
      needed: generacion(m) < STORE_VERSION,
      from, fights, current: STORE_VERSION,
    };
  }

  /**
   * Resumen: lo justo para la lista y los filtros.
   *
   * @param {string|null} self  tu nombre, para anotar tu daño en la pelea. Si no
   *   se sabe, el campo NO se escribe: un cero afirmaría que no pegaste nada.
   */
  static summary(f, at, off, len, self = null) {
    const mio = self ? (f.rows ?? []).find((r) => r.name === self) : null;
    return {
      // `uid` identifica; `id` sólo se conserva para mostrarlo y exportarlo.
      uid: off, id: f.id, at, off, len,
      label: f.label, zone: f.zone,
      // La dificultad va también en el índice: el filtro y el expediente la
      // necesitan sin abrir cada pelea del disco.
      zoneBase: f.zoneBase ?? null, diff: f.diff ?? null, diffTag: f.diffTag ?? null,
      // El nivel también: emparejar las mejores marcas sin él no significa nada.
      level: f.level ?? null,
      duration: f.duration, total: f.total, raidDps: f.raidDps,
      enemyTotal: f.enemyTotal, enemyDps: f.enemyDps,
      healing: f.healing, kills: f.kills, losses: f.losses,
      // Nombres de los enemigos, para poder filtrar sin abrir la pelea.
      foes: (f.rows ?? []).filter((r) => r.side === 'enemy').map((r) => r.name),
      // Y los de tu bando, por lo mismo: es lo que permite filtrar por
      // compañero sin abrir 160 registros del disco en cada tecleo.
      allies: (f.rows ?? []).filter((r) => r.side !== 'enemy').map((r) => r.name),
      // Los nombres del botín van en el índice: así el aviso al pasar el ratón
      // por una pelea no obliga a leerla entera del disco.
      loot: (f.loot ?? []).map((l) => l.item),
      // TU daño en esa pelea. `raidDps` es el del grupo entero, y con él no se
      // puede hablar de tu progresión: sube porque entró un compañero que pega
      // más. Va aquí y no se deduce al consultar porque si no habría que abrir
      // dos mil registros del disco para dibujar una lista.
      ...(mio ? { mine: mio.damage ?? 0 } : {}),
    };
  }

  load() {
    this.index = [];
    this.byUid.clear();
    this.seen.clear();
    this.dropped = 0;
    this.#loadLoot();
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const s = JSON.parse(line);
          // Índices escritos antes de que `uid` existiera: el byte de inicio ya
          // estaba ahí, así que la migración no toca ningún fichero.
          if (s.uid === undefined) s.uid = s.off;
          const k = logicalKey(s);
          // La misma pelea guardada dos veces por una relectura del log. Se
          // queda la primera copia; el .ndjson no se toca.
          if (this.seen.has(k)) { this.dropped++; continue; }
          this.seen.set(k, s);
          this.index.push(s);
          this.byUid.set(s.uid, s);
        } catch { /* línea a medias por un cierre brusco: se ignora */ }
      }
    } catch { /* aún no hay nada guardado */ }
    this.index.sort((a, b) => b.at - a.at);
    // Con lo que se sepa ahora. Si aún no se sabe quién eres, `mine` se
    // rellenará cuando el motor lo sepa y vuelva a llamar.
    this.lastBackfill = this.backfill(this.self);
    return this.index.length;
  }

  /**
   * Rellena los campos del resumen que un índice viejo no traía.
   *
   * El índice es dato DERIVADO —el .ndjson es la fuente y no se toca nunca—,
   * así que esto no es una migración de datos: es recalcular un resumen. Por
   * eso no hace falta releer el log. Medido sobre un almacén real de 160 peleas
   * y 2,5 MB: 34 ms, y el índice pasa de 76 a 81 KB.
   *
   * Se escribe en un fichero aparte y se renombra encima. Si el proceso muere a
   * medias, el índice de antes sigue entero: lo peor que pasa es que se vuelva
   * a intentar en el siguiente arranque.
   *
   * @param {string|null} self  hace falta para `mine`, que es TU daño. Sin él
   *   ese campo no se rellena: se reintentará cuando se sepa quién eres.
   * @returns {number} cuántos resúmenes se han completado
   */
  backfill(self = null) {
    const faltan = this.index.filter((s) => s.allies === undefined
      || (self && s.mine === undefined));
    if (!faltan.length) return 0;
    let fd = null;
    try { fd = fs.openSync(this.dataPath, 'r'); } catch { return 0; }
    let hechos = 0;
    for (const s of faltan) {
      try {
        const buf = Buffer.allocUnsafe(s.len);
        fs.readSync(fd, buf, 0, s.len, s.off);
        const f = JSON.parse(buf.toString('utf8'));
        if (s.allies === undefined) {
          s.allies = (f.rows ?? []).filter((r) => r.side !== 'enemy').map((r) => r.name);
        }
        if (self && s.mine === undefined) {
          const mio = (f.rows ?? []).find((r) => r.name === self);
          // Si no sales en la pelea, tu daño en ella es cero de verdad: estuvo
          // guardada porque pasó algo, no porque tú estuvieras.
          if (mio) s.mine = mio.damage ?? 0;
          else s.mine = 0;
        }
        hechos++;
      } catch {
        // Registro ilegible: se deja sin rellenar en vez de poner una lista
        // vacía o un cero, que afirmarían que no había nadie o que no pegaste.
        // El filtro por compañero descarta lo que no consta, que es lo honesto.
      }
    }
    fs.closeSync(fd);
    try {
      const tmp = `${this.idxPath}.tmp`;
      // El índice se guarda del más reciente al más antiguo en memoria, pero en
      // disco va en orden de escritura: se reescribe por `off`, que es el orden
      // real del fichero de datos.
      const lineas = [...this.index].sort((a, b) => a.off - b.off)
        .map((s) => JSON.stringify(s)).join('\n');
      fs.writeFileSync(tmp, `${lineas}\n`);
      fs.renameSync(tmp, this.idxPath);
    } catch { /* sin permisos: se reintenta en el próximo arranque */ }
    return hechos;
  }

  /**
   * Añade una pelea. Devuelve su resumen.
   *
   * Si esa pelea ya está guardada devuelve la que había sin escribir nada: así
   * releer el log entero es idempotente y deja de multiplicar el histórico.
   */
  /**
   * Botín recogido sin ninguna pelea a la que colgarlo.
   *
   * Fichero aparte y no un campo dentro de una pelea, porque no pertenece a
   * ninguna: el cadáver lo remató entero un compañero y ese combate nunca fue
   * tuyo. Lo que sí es tuyo es haberlo recogido, y eso pasó.
   *
   * Se deduplica por (hora, objeto, de quién) para que releer el registro no lo
   * cuente dos veces, igual que las peleas se deduplican por su identidad
   * lógica. Sin esto, cada reconstrucción sumaría otra copia de cada objeto.
   */
  appendLoot(e) {
    if (!e?.item) return null;
    const clave = `${Math.round(e.t ?? 0)}:${e.item}:${e.from ?? ''}`;
    if (this.lootSeen.has(clave)) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const fila = { ...e, k: clave };
      fs.appendFileSync(this.lootPath, `${JSON.stringify(fila)}\n`);
      this.lootSeen.add(clave);
      this.orphanLoot.push(fila);
      return fila;
    } catch { return null; }
  }

  #loadLoot() {
    this.orphanLoot = [];
    this.lootSeen = new Set();
    try {
      for (const line of fs.readFileSync(this.lootPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.item || this.lootSeen.has(e.k)) continue;
          this.lootSeen.add(e.k);
          this.orphanLoot.push(e);
        } catch { /* línea rota: se salta, como en el índice */ }
      }
    } catch { /* sin fichero: no hay botín huérfano y no es un problema */ }
  }

  append(fight, at = Date.now()) {
    if (!fight) return null;
    const dup = this.seen.get(logicalKey({ at, total: fight.total, duration: fight.duration }));
    if (dup) return dup;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const body = JSON.stringify(fight) + '\n';
      let off = 0;
      try { off = fs.statSync(this.dataPath).size; } catch { off = 0; }
      fs.appendFileSync(this.dataPath, body);
      const s = FightStore.summary(fight, at, off, Buffer.byteLength(body), this.self);
      fs.appendFileSync(this.idxPath, JSON.stringify(s) + '\n');
      this.index.unshift(s);
      this.byUid.set(s.uid, s);
      this.seen.set(logicalKey(s), s);
      this.cache.set(s.uid, fight);
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
      return s;
    } catch { return null; }
  }

  /** Pelea completa. Se lee del disco por su posición, sin cargar el resto. */
  get(uid) {
    if (this.cache.has(uid)) return this.cache.get(uid);
    const s = this.byUid.get(uid);
    if (!s) return null;
    try {
      const fd = fs.openSync(this.dataPath, 'r');
      const buf = Buffer.allocUnsafe(s.len);
      fs.readSync(fd, buf, 0, s.len, s.off);
      fs.closeSync(fd);
      const f = JSON.parse(buf.toString('utf8'));
      this.cache.set(uid, f);
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
      return f;
    } catch { return null; }
  }

  /**
   * Filtra el índice.
   * @param {object} q  { sinceMs, foe, zone, mates, limit }
   */
  filter(q = {}) {
    // Una selección a mano manda sobre todo lo demás. Si has pinchado seis
    // peleas concretas, el tramo y el enemigo ya no pintan nada: dijiste
    // exactamente cuáles, y filtrarlas otra vez sólo podría quitarte alguna de
    // las que elegiste.
    if (q.uids?.length) {
      const pedidas = new Set(q.uids);
      return this.index.filter((s) => pedidas.has(s.uid));
    }
    const cut = q.sinceMs ? Date.now() - q.sinceMs : null;
    const foe = q.foe ? String(q.foe).toLowerCase() : null;
    const zone = q.zone ? String(q.zone).toLowerCase() : null;
    const mates = (q.mates ?? []).filter(Boolean);
    let out = this.index;
    if (cut !== null) out = out.filter((s) => s.at >= cut);

    // Los tres exactos son para la enciclopedia, y son otra pregunta que los de
    // arriba. `foe` busca lo que escribes y por eso hace «contiene»: tecleas
    // «naga» y salen los Nagafen. La enciclopedia no busca, señala una ficha
    // concreta, y con «contiene» «a fear guardian» arrastraría a cualquier otro
    // guardián. Lo mismo con la zona: «Plane of Fear» contiene a las cinco
    // dificultades a la vez, que es justo lo que hay que separar.
    if (q.foeExact) out = out.filter((s) => (s.foes ?? []).includes(q.foeExact));
    if (q.zoneBase) {
      out = out.filter((s) => (s.zoneBase ?? null) === q.zoneBase);
    }
    // `diff: null` es una dificultad —«sin marca», el mundo abierto— y no «no
    // filtres». Se distingue por que la clave venga o no, no por su valor.
    if (Object.hasOwn(q, 'diff') && q.diff !== undefined) {
      out = out.filter((s) => (s.diff ?? null) === q.diff);
    }
    if (mates.length) {
      // TODOS los marcados, no cualquiera de ellos. Comparar lo que ha hecho
      // cada uno sólo significa algo si en todas las peleas estaba la misma
      // gente: con «alguno», tu porcentaje sale de un conjunto donde a veces
      // faltaba uno, y entonces no compara nada.
      //
      // «Estuvieron todos» no es «sólo ellos»: una pelea donde además ayudó un
      // cuarto cuenta, y debe contar — estuvisteis.
      out = out.filter((s) => Array.isArray(s.allies)
        && mates.every((m) => s.allies.includes(m)));
    }
    if (foe) {
      out = out.filter((s) => (s.label ?? '').toLowerCase().includes(foe)
        || (s.foes ?? []).some((n) => n.toLowerCase().includes(foe)));
    }
    if (zone) out = out.filter((s) => (s.zone ?? '').toLowerCase().includes(zone));
    return q.limit ? out.slice(0, q.limit) : out;
  }

  /** Enemigos vistos, por frecuencia: alimenta el desplegable del filtro. */
  foeList(sinceMs = null) {
    const cut = sinceMs ? Date.now() - sinceMs : null;
    const count = new Map();
    for (const s of this.index) {
      if (cut !== null && s.at < cut) continue;
      for (const n of s.foes ?? []) count.set(n, (count.get(n) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([name, n]) => ({ name, n }));
  }

  stats() {
    let bytes = 0;
    try { bytes = fs.statSync(this.dataPath).size; } catch { /* aún vacío */ }
    return {
      fights: this.index.length, bytes, oldest: this.index.at(-1)?.at ?? null,
      // Copias descartadas al cargar: el pie de la lista puede decirlo en vez de
      // que el resumen sume menos peleas de las que anuncia sin explicar por qué.
      dropped: this.dropped,
    };
  }

  /**
   * Revisión completa del almacén: lee todos los registros de verdad.
   *
   * Cuesta un segundo con miles de peleas, así que no se hace al arrancar. Es lo
   * que usa `npm run store:check` para responder a «¿está sano el histórico?»
   * con números y no con fe.
   */
  audit() {
    const out = { lines: 0, corruptIdx: 0, fights: this.index.length, duplicates: this.dropped,
      unreadable: 0, idCollisions: 0, uidCollisions: 0, bytes: 0 };
    try { out.bytes = fs.statSync(this.dataPath).size; } catch { /* vacío */ }
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        out.lines++;
        try { JSON.parse(line); } catch { out.corruptIdx++; }
      }
    } catch { /* aún no hay nada */ }

    const ids = new Map(); const uids = new Set();
    let fd = null;
    try { fd = fs.openSync(this.dataPath, 'r'); } catch { /* aún no hay nada */ }
    for (const s of this.index) {
      ids.set(s.id, (ids.get(s.id) ?? 0) + 1);
      if (uids.has(s.uid)) out.uidCollisions++;
      uids.add(s.uid);
      if (fd === null) { out.unreadable++; continue; }
      try {
        const buf = Buffer.allocUnsafe(s.len);
        fs.readSync(fd, buf, 0, s.len, s.off);
        JSON.parse(buf.toString('utf8'));
      } catch { out.unreadable++; }
    }
    if (fd !== null) fs.closeSync(fd);
    out.idCollisions = [...ids.values()].filter((n) => n > 1).length;
    return out;
  }
}


export { RANGES };
