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
 */
export class FightStore {
  constructor(dir) {
    this.dir = dir;
    this.dataPath = path.join(dir, 'fights.ndjson');
    this.idxPath = path.join(dir, 'fights.idx');
    this.index = [];        // resúmenes, del más reciente al más antiguo
    this.cache = new Map(); // id -> pelea completa, para no releer el disco
    this.offsets = new Map();
  }

  /** Resumen: lo justo para la lista y los filtros. */
  static summary(f, at, off, len) {
    return {
      id: f.id, at, off, len,
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
    this.offsets.clear();
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const s = JSON.parse(line);
          this.index.push(s);
          this.offsets.set(s.id, s);
        } catch { /* línea a medias por un cierre brusco: se ignora */ }
      }
    } catch { /* aún no hay nada guardado */ }
    this.index.sort((a, b) => b.at - a.at);
    return this.index.length;
  }

  /** Añade una pelea. Devuelve su resumen. */
  append(fight, at = Date.now()) {
    if (!fight) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const body = JSON.stringify(fight) + '\n';
      let off = 0;
      try { off = fs.statSync(this.dataPath).size; } catch { off = 0; }
      fs.appendFileSync(this.dataPath, body);
      const s = FightStore.summary(fight, at, off, Buffer.byteLength(body));
      fs.appendFileSync(this.idxPath, JSON.stringify(s) + '\n');
      this.index.unshift(s);
      this.offsets.set(s.id, s);
      this.cache.set(s.id, fight);
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
      return s;
    } catch { return null; }
  }

  /** Pelea completa. Se lee del disco por su posición, sin cargar el resto. */
  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const s = this.offsets.get(id);
    if (!s) return null;
    try {
      const fd = fs.openSync(this.dataPath, 'r');
      const buf = Buffer.allocUnsafe(s.len);
      fs.readSync(fd, buf, 0, s.len, s.off);
      fs.closeSync(fd);
      const f = JSON.parse(buf.toString('utf8'));
      this.cache.set(id, f);
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
    return { fights: this.index.length, bytes, oldest: this.index.at(-1)?.at ?? null };
  }
}


export { RANGES };
