/** Contenido REAL para los prototipos: una pelea densa y los cronos de Campeón. */
import fs from 'node:fs';
import { FightStore } from 'file:///D:/EQL%20SPAIN/src/store.js';

const D = 'C:/Users/ferna/AppData/Roaming/eql-parse';
const s = new FightStore(D); s.load();
const cfg = JSON.parse(fs.readFileSync(`${D}/config.json`, 'utf8'));

// La pelea más poblada del histórico: la que hace falta para ver la densidad.
const tam = (x) => (Array.isArray(x.foes) ? x.foes.length : 0) + (Array.isArray(x.allies) ? x.allies.length : 0);
const densa = [...s.index].sort((a, b) => tam(b) - tam(a))[0];
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
      hab: (r.byAbility ?? []).slice(0, 4).map(([n, v]) => [n, v]),
    })).sort((a, b) => b.dano - a.dano),
    botin: (f.loot ?? []).slice(0, 12),
  },
  cronos: cfg.cronos ?? [],
  cuantas: { peleas: s.index.length, zonas: new Set(s.index.map((x) => x.zoneBase)).size },
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('pelea:', f.label, '·', f.zone, '·', (f.rows ?? []).length, 'filas ·', f.duration, 's');
console.log('enemigos:', (f.rows ?? []).filter((r) => r.side === 'enemy').length,
  '· aliados:', (f.rows ?? []).filter((r) => r.side !== 'enemy').length);
console.log('cronos:', out.cronos.length, '· peleas en el almacén:', out.cuantas.peleas);
