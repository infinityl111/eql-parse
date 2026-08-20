/** Contenido REAL para los prototipos: una pelea densa y los cronos de Campeón. */
import fs from 'node:fs';
import { FightStore } from 'file:///D:/EQL%20SPAIN/src/store.js';

const D = 'C:/Users/ferna/AppData/Roaming/eql-parse';
const s = new FightStore(D); s.load();
const cfg = JSON.parse(fs.readFileSync(`${D}/config.json`, 'utf8'));

// La pelea más poblada del histórico: la que hace falta para ver la densidad.
/**
 * LA PELEA SE ELIGE PARA QUE EJERCITE LO QUE HAY QUE ENSEÑAR, no por ser la más
 * grande. La más poblada del histórico —23 filas en Clan Crushbone— no tenía ni
 * incertidumbre ni tipos de daño, así que con ella el prototipo no podía enseñar
 * ni «lo que esta pelea no sabe» ni la barra segmentada. Enseñar una maqueta de
 * una función usando una pelea que no la tiene es inventarse el caso.
 */
const puntua = (g) => {
  const inc = (g.unattributed > 0 ? 1 : 0) + (g.charm?.soltado?.daño > 0 ? 1 : 0)
    + ((g.loot ?? []).filter((l) => l.amb).length > 0 ? 1 : 0);
  const tipos = (g.rows ?? []).filter((x) => (x.types ?? []).length > 1).length;
  return inc * 1000 + tipos * 10 + (g.rows ?? []).length;
};
let densa = null, mejorP = -1;
for (const sm of s.index) {
  const g = s.get(sm.uid); if (!g) continue;
  const p = puntua(g);
  if (p > mejorP) { mejorP = p; densa = sm; }
}
const f = s.get(densa.uid);

const out = {
  generado: new Date().toISOString().slice(0, 16),
  origen: `${D}/fights.ndjson`,
  pelea: {
    label: f.label, zone: f.zone, duration: f.duration, at: densa.at,
    total: f.total, enemyTotal: f.enemyTotal, healing: f.healing,
    kills: f.kills, losses: f.losses,
    filas: (f.rows ?? []).map((r) => ({
      n: r.name, lado: r.side, dano: r.damage, dps: Math.round(r.dps),
      recibido: r.taken, curado: r.healingDone, muertes: r.deaths,
      precision: r.accuracy != null ? Math.round(r.accuracy * 100) : null,
      criticos: r.crits, max: r.max,
      hab: (r.abilities ?? []).slice(0, 4).map((a) => [a.name, a.sum]),
      // Por TIPO de daño: es lo que segmenta la barra.
      tipos: (r.types ?? []).map(([n, v]) => [n, typeof v === 'number' ? v : (v?.sum ?? 0)]),
    })).sort((a, b) => b.dano - a.dano),
    botin: (f.loot ?? []).slice(0, 12),
    // «Lo que esta pelea no sabe», con los mismos campos que lee la aplicación.
    noSabe: {
      unattributed: f.unattributed ?? 0,
      soltado: f.charm?.soltado ?? null,
      botinAmbiguo: (f.loot ?? []).filter((l) => l.amb).length,
      sinMandoSec: f.sinMandoSec ?? 0,
      resistidos: f.resistsSuffered ?? 0,
    },
  },
  cronos: cfg.cronos ?? [],
  cuantas: { peleas: s.index.length, zonas: new Set(s.index.map((x) => x.zoneBase)).size },
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('pelea:', f.label, '·', f.zone, '·', (f.rows ?? []).length, 'filas ·', f.duration, 's');
console.log('enemigos:', (f.rows ?? []).filter((r) => r.side === 'enemy').length,
  '· aliados:', (f.rows ?? []).filter((r) => r.side !== 'enemy').length);
console.log('cronos:', out.cronos.length, '· peleas en el almacén:', out.cuantas.peleas);
