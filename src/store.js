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
 * Versión del formato del almacén.
 *
 * Subir esto declara que lo guardado por versiones anteriores no describe lo
 * que pasó y hay que releer el log. No es un número de formato de fichero: los
 * ficheros de la 1.0.x se leen perfectamente, lo que pasa es que su CONTENIDO
 * era incorrecto —muertes que no se contaron, peleas duplicadas, mitigación de
 * Evasive mal aplicada—, y eso no se arregla leyendo mejor.
 */
export const STORE_VERSION = '1.1.0';
const META = 'store.json';

/** Compara 1.2.10 con 1.3.0 sin traerse una librería para tres números. */
export function olderThan(a, b) {
  const pa = String(a ?? '0').replace(/^v/, '').split('.').map(Number);
  const pb = String(b ?? '0').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

export class FightStore {
  constructor(dir) {
    this.dir = dir;
    this.dataPath = path.join(dir, 'fights.ndjson');
    this.idxPath = path.join(dir, 'fights.idx');
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
      needed: from === null || olderThan(from, STORE_VERSION),
      from, fights, current: STORE_VERSION,
    };
  }

  /** Resumen: lo justo para la lista y los filtros. */
  static summary(f, at, off, len) {
    return {
      // `uid` identifica; `id` sólo se conserva para mostrarlo y exportarlo.
      uid: off, id: f.id, at, off, len,
      label: f.label, zone: f.zone,
      duration: f.duration, total: f.total, raidDps: f.raidDps,
      enemyTotal: f.enemyTotal, enemyDps: f.enemyDps,
      healing: f.healing, kills: f.kills, losses: f.losses,
      // Nombres de los enemigos, para poder filtrar sin abrir la pelea.
      foes: (f.rows ?? []).filter((r) => r.side === 'enemy').map((r) => r.name),
      // Los nombres del botín van en el índice: así el aviso al pasar el ratón
      // por una pelea no obliga a leerla entera del disco.
      loot: (f.loot ?? []).map((l) => l.item),
    };
  }

  load() {
    this.index = [];
    this.byUid.clear();
    this.seen.clear();
    this.dropped = 0;
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
    return this.index.length;
  }

  /**
   * Añade una pelea. Devuelve su resumen.
   *
   * Si esa pelea ya está guardada devuelve la que había sin escribir nada: así
   * releer el log entero es idempotente y deja de multiplicar el histórico.
   */
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
      const s = FightStore.summary(fight, at, off, Buffer.byteLength(body));
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
   * @param {object} q  { sinceMs, foe, zone, limit }
   */
  filter(q = {}) {
    const cut = q.sinceMs ? Date.now() - q.sinceMs : null;
    const foe = q.foe ? String(q.foe).toLowerCase() : null;
    const zone = q.zone ? String(q.zone).toLowerCase() : null;
    let out = this.index;
    if (cut !== null) out = out.filter((s) => s.at >= cut);
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
