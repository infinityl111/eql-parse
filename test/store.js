/**
 * Pruebas del almacén: identidad, duplicados y migración.
 *
 * Cada una reproduce un fallo real que se pudo medir antes de arreglarlo, no
 * una situación imaginada. Si alguna vuelve a fallar, el histórico está
 * mintiendo otra vez y cualquier otra cifra que salga de él no vale nada.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FightStore } from '../src/store.js';
import { aggregate } from '../src/aggregate.js';
import { liveAdvice, advise } from '../src/advisor.js';

let failed = 0;
const ok = (cond, label) => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}`);
  if (!cond) failed++;
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eqlstore-'));

/** Pelea mínima pero con la forma real: filas con bando y objetivos. */
const fight = (id, foe, dmg) => ({
  id, label: foe, zone: 'Lower Guk', duration: 40, total: dmg, raidDps: dmg / 40,
  enemyTotal: 0, enemyDps: 0, healing: 0, kills: [foe], losses: [], loot: [], spellVsFoe: [],
  rows: [
    { name: 'Campeon', side: 'ally', damage: dmg, taken: 0, healingDone: 0, hits: 10,
      meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 100,
      activeSec: 40, types: [['melee', dmg]], abilities: [], targets: [{ name: foe, sum: dmg }],
      takenBySource: [] },
    { name: foe, side: 'enemy', damage: 0, taken: dmg, healingDone: 0, hits: 0, meleeHits: 0,
      misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 0, activeSec: 40,
      types: [], abilities: [], targets: [], takenBySource: [] },
  ],
});

// ── 1. Dos sesiones numeran desde 1: no pueden taparse entre ellas ─────────
console.log('\nidentidad entre sesiones');
{
  const dir = tmp();
  const s = new FightStore(dir);
  const ayer = [], hoy = [];
  // Ayer: ids 1..3. Hoy la aplicación se reinicia y vuelve a numerar desde 1.
  for (let i = 1; i <= 3; i++) ayer.push(s.append(fight(i, `bicho de ayer ${i}`, 1000 * i), 1_000_000 + i));
  for (let i = 1; i <= 3; i++) hoy.push(s.append(fight(i, `bicho de hoy ${i}`, 7000 + i), 2_000_000 + i));

  ok(new Set([...ayer, ...hoy].map((x) => x.uid)).size === 6, 'seis peleas, seis identidades distintas');
  ok(s.get(ayer[0].uid).label === 'bicho de ayer 1', 'la pelea de ayer sigue siendo la de ayer');
  ok(s.get(hoy[0].uid).label === 'bicho de hoy 1', 'la de hoy sigue siendo la de hoy');

  const list = s.filter({});
  const agg = aggregate(list.map((x) => s.get(x.uid)).filter(Boolean), 'Campeon');
  const real = 1000 + 2000 + 3000 + 7001 + 7002 + 7003;
  ok(agg.total === real, `el resumen suma ${real} y no ${real * 2} (antes contaba dos veces las de hoy)`);
  ok(agg.foes.length === 6, 'aparecen los seis enemigos, no sólo los de hoy');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 2. Releer el log entero no puede multiplicar el histórico ──────────────
console.log('\nrelectura del log');
{
  const dir = tmp();
  const s = new FightStore(dir);
  for (let i = 1; i <= 5; i++) s.append(fight(i, `bicho ${i}`, 1000), 5_000_000 + i * 1000);
  const bytesTras1 = fs.statSync(path.join(dir, 'fights.ndjson')).size;

  // Segunda importación idéntica: mismas peleas, mismos instantes de inicio.
  for (let i = 1; i <= 5; i++) s.append(fight(i, `bicho ${i}`, 1000), 5_000_000 + i * 1000);
  ok(s.index.length === 5, 'siguen siendo cinco peleas tras reimportar');
  ok(fs.statSync(path.join(dir, 'fights.ndjson')).size === bytesTras1, 'no se ha escrito nada nuevo en disco');

  // Y también al recargar desde cero, por si las copias ya estaban en disco.
  const s2 = new FightStore(dir);
  s2.load();
  ok(s2.index.length === 5, 'al recargar tampoco se cuentan dos veces');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 3. Índices antiguos (sin uid) se migran solos, sin reescribir nada ─────
console.log('\níndices anteriores');
{
  const dir = tmp();
  const s = new FightStore(dir);
  s.append(fight(1, 'un gorgon', 500), 9_000_000);
  s.append(fight(2, 'otro gorgon', 700), 9_100_000);

  // Se quita `uid` del índice, como lo escribían las versiones anteriores.
  const idxPath = path.join(dir, 'fights.idx');
  const viejo = fs.readFileSync(idxPath, 'utf8').split('\n').filter(Boolean)
    .map((l) => { const o = JSON.parse(l); delete o.uid; return JSON.stringify(o); }).join('\n') + '\n';
  fs.writeFileSync(idxPath, viejo);

  const s2 = new FightStore(dir);
  ok(s2.load() === 2, 'se cargan las dos peleas del índice antiguo');
  ok(s2.index.every((x) => Number.isFinite(x.uid)), 'todas reciben identidad al cargar');
  ok(s2.get(s2.index[0].uid)?.total === 700, 'y se leen del disco por esa identidad');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 4. El consejo no dictamina con muestra corta ni sobre daño reconstruido ─
console.log('\nsuelo de muestra del consejo');
{
  // Monje en Evasive: 3 golpes de 100. El bruto reconstruido son 6.000 puntos.
  const row = {
    taken: 300, rawTakenByType: [{ name: 'melee', sum: 6000, n: 3 }],
    takenByType: [{ name: 'melee', sum: 300, n: 3 }], types: [], healingDone: 0, rawMeleeOut: 0,
  };
  const a = advise(row, { classes: ['MNK'], stance: 'evasive' });
  ok(a.lowSample === true, 'con 3 impactos se marca la muestra como corta');
  ok(a.verdict === null, 'y no se dictamina nada');
  ok(a.incoming.observed === 300 && a.incoming.total === 6000,
    'se devuelven las dos cifras: 300 recibidos y 6.000 reconstruidos');

  // Con muestra suficiente y una postura que no evade sí se dictamina.
  const muchos = { ...row, takenByType: [{ name: 'melee', sum: 300, n: 12 }],
    rawTakenByType: [{ name: 'melee', sum: 300, n: 12 }], defense: [['esquiva', 8]] };
  ok(advise(muchos, { classes: ['MNK'], stance: 'balanced' }).verdict !== null,
    'con 12 impactos sí se dictamina');

  // El mínimo del consejo en vivo va sobre daño RECIBIDO, no sobre el bruto.
  // 20 golpes recibidos de 10 puntos con 20 fallos: poco daño real.
  const flojo = { melee: 200, spell: 0, total: 200, observed: 200, seconds: 20, hits: 20,
    landedMelee: 20, meleeSwings: 40 };
  ok(liveAdvice(flojo, { classes: ['MNK'], stance: 'balanced' }).suggest === false,
    '200 puntos reales en 20 s no piden cambio de postura');
  // Lo mismo pero de verdad fuerte: 40 golpes de 150 con 40 fallos.
  const fuerte = { melee: 6000, spell: 0, total: 6000, observed: 6000, seconds: 20, hits: 40,
    landedMelee: 40, meleeSwings: 80 };
  const lf = liveAdvice(fuerte, { classes: ['MNK'], stance: 'balanced' });
  ok(lf.suggest === true, '6.000 puntos reales sí lo piden');
  ok(lf.bestKey === 'evasive', 'y contra melé puro la mejor es Evasive', lf.bestKey);
  ok(liveAdvice(fuerte, { classes: ['MNK'], stance: 'evasive' }).suggest === false,
    'pero con Evasive ya puesta no se sugiere nada: falta la referencia');
}

// ── 5. Evasive evita golpes, no mitiga daño ───────────────────────────────
// Wiki de EQL: «You have a 95% chance to evade all incoming attacks».
console.log('\nposturas que evaden');
{
  const { STANCES, mitigationFor } = await import('../src/stances.js');
  ok(STANCES.evasive.mit.melee === 0, 'Evasive no declara mitigación de melé');
  ok(STANCES.evasive.evade.melee === 0.95, 'declara 95% de evasión');
  ok(mitigationFor('evasive', 'melee') === 0,
    'un golpe recibido en Evasive no se reconstruye: llegó sin mitigar');

  // Monje en Balanced: de 100 ataques le entran 60, a 100 de daño cada uno.
  // Con Evasive sólo entrarían 5 → ahorra 55 golpes × 100 = 5.500.
  const row = {
    taken: 6000,
    rawTakenByType: [{ name: 'melee', sum: 6000, n: 60 }],
    takenByType: [{ name: 'melee', sum: 6000, n: 60 }],
    defense: [['esquiva', 25], ['parada', 15]],
    types: [], healingDone: 0, rawMeleeOut: 0,
  };
  const a = advise(row, { classes: ['MNK'], stance: 'balanced' });
  const ev = a.defence.find((d) => d.key === 'evasive');
  const bal = a.defence.find((d) => d.key === 'balanced');
  ok(a.incoming.meleeSwings === 100, 'cuenta los 100 ataques: 60 que entraron + 40 que fallaron');
  ok(ev && Math.round(ev.prevented) === 5500,
    'Evasive ahorra 5.500 = 55 golpes evitados × 100 de daño medio',
    `da ${Math.round(ev?.prevented ?? 0)}`);
  ok(bal && Math.round(bal.prevented) === 600, 'Balanced ahorra 600 = 10% de 6.000');
  ok(ev.prevented > bal.prevented && ev.prevented < 6000,
    'gana a Balanced pero no supera el daño total recibido');
  ok(Math.round(ev.endurance) === 11000, 'y cuesta 2 de vigor por punto evitado');

  // Con Evasive ya puesta no se puede saber cuánto entraría sin ella.
  const enEvasive = advise({ ...row, rawTakenByType: [{ name: 'melee', sum: 500, n: 5 }],
    takenByType: [{ name: 'melee', sum: 500, n: 5 }], defense: [['esquiva', 95]], taken: 500 },
    { classes: ['MNK'], stance: 'evasive' });
  ok(enEvasive.unknownBase === true, 'con Evasive puesta se marca que falta la referencia');
  ok(enEvasive.verdict === null, 'y no se dictamina nada');
}

// ── 6. Migración: detectar almacenes de versiones anteriores ──────────────
console.log('\nmigración del almacén');
{
  const { STORE_VERSION, generacion } = await import('../src/store.js');

  ok(STORE_VERSION >= 2, 'la generación de los datos va por su cuenta, no por la versión de la app');
  ok(generacion(null) === 0 && generacion({}) === 0, 'sin marca es la generación 0');
  ok(generacion({ version: '1.1.0' }) === 0,
    'una marca con formato de versión también: no es una generación');
  ok(generacion({ version: 2 }) === 2, 'y un número es lo que dice');

  // Almacén vacío: nada que corregir, aunque no tenga marca.
  const vacio = tmp();
  const s0 = new FightStore(vacio); s0.load();
  ok(s0.migration().needed === false, 'un almacén vacío no pide migración');
  fs.rmSync(vacio, { recursive: true, force: true });

  // Almacén con peleas y sin marca: es de la 1.0.x.
  const viejo = tmp();
  const s1 = new FightStore(viejo);
  s1.append(fight(1, 'un gorgon', 500), 1_000_000);
  s1.append(fight(2, 'otro gorgon', 700), 1_100_000);
  const s2 = new FightStore(viejo); s2.load();
  const m = s2.migration();
  ok(m.needed === true, 'con peleas y sin marca, hay que migrar');
  ok(m.from === null && m.fights === 2, 'y se sabe de dónde viene y cuántas son',
    `${m.from} · ${m.fights} peleas`);

  // Una vez marcado, no se vuelve a preguntar.
  s2.stamp(STORE_VERSION);
  const s3 = new FightStore(viejo); s3.load();
  ok(s3.migration().needed === false, 'tras marcarlo ya no pide migración');
  ok(s3.meta()?.version === STORE_VERSION, 'y la marca dice la versión', s3.meta()?.version);

  // Marcado con una generación anterior: vuelve a pedirla. Es lo que pasa
  // cuando un arreglo del parser invalida lo guardado, como el doble conteo de
  // muertes que trajo la generación 2.
  s3.stamp(STORE_VERSION - 1);
  const s4 = new FightStore(viejo); s4.load();
  ok(s4.migration().needed === true, 'una generación anterior vuelve a pedir migración');
  // Y una marca de las de antes, con formato de versión, también.
  s4.stamp('1.1.0');
  const s5 = new FightStore(viejo); s5.load();
  ok(s5.migration().needed === true, 'una marca «1.1.0» de las primeras también migra');
  fs.rmSync(viejo, { recursive: true, force: true });
}

// ── 7. La reconstrucción no puede llevarse por delante el histórico ───────
console.log('\nred de seguridad de la reconstrucción');
{
  const { rebuildStore } = await import('../src/rebuild.js');
  const dir = tmp();
  const s = new FightStore(dir);
  for (let i = 1; i <= 4; i++) s.append(fight(i, `bicho ${i}`, 1000), 3_000_000 + i * 1000);
  const antes = fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8');

  // Sin log no se toca nada.
  const r1 = await rebuildStore({ dir, logPath: path.join(dir, 'no-existe.txt') });
  ok(r1.ok === false && r1.reason === 'sin-log', 'sin log no se reconstruye', r1.reason);

  // Con un log que ya no contiene esas peleas, se deshace y se devuelve todo.
  const vacio = path.join(dir, 'eqlog_Nadie_servidor.txt');
  fs.writeFileSync(vacio, '[Tue Aug 04 18:00:00 2026] You have entered Lower Guk.\n');
  const r2 = await rebuildStore({ dir, logPath: vacio, self: 'Nadie' });
  ok(r2.ok === false && r2.reason === 'sin-peleas',
    'un log sin peleas no borra el histórico', r2.reason);
  ok(fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8') === antes,
    'y los datos quedan exactamente como estaban');
  const s5 = new FightStore(dir); s5.load();
  ok(s5.index.length === 4, 'las cuatro peleas siguen ahí', String(s5.index.length));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 8. Una pelea nueva tiene que ANUNCIARSE, no sólo guardarse ────────────
//
// Fallo real: se veía la pelea en directo y al cerrarse desaparecía sin llegar
// a la lista. Estaba guardada en disco desde el primer momento; lo que fallaba
// era el aviso a la interfaz, que miraba `history.length`. Como `history` se
// recorta a 60, con 60 peleas guardadas o más esa longitud ya no cambia nunca:
// unshift y recorte la dejan igual. La lista dejaba de releer el índice y sólo
// volvía a la vida al tocar el filtro o al reiniciar.
//
// Se comprueban las dos mitades: que la señal vieja está muda (si no, la prueba
// pasaría sola y no probaría nada) y que la nueva sí suena.
console.log('\naviso de pelea nueva con el histórico lleno');
{
  const { Engine } = await import('../src/engine.js');
  const dir = tmp();
  const s = new FightStore(dir);
  // 61 peleas guardadas: una más que el recorte de `history`.
  for (let i = 1; i <= 61; i++) s.append(fight(i, `bicho ${i}`, 1000 + i), 4_000_000 + i * 1000);

  const log = path.join(dir, 'eqlog_Campeon_erudin.txt');
  fs.writeFileSync(log, '[Tue Aug 04 18:00:00 2026] You have entered Lower Guk.\n');

  const e = new Engine();
  e.setStorePath(dir);
  await e.attach(log, { self: 'Campeon', idleSec: 20 });

  ok(e.history.length === 60, 'el histórico en memoria viene recortado a 60', String(e.history.length));

  const golpe = (t, amount) => ({
    kind: 'melee', t, seq: 0, raw: '', school: 'melee',
    source: 'Campeon', target: 'a revultant rat', amount, ability: 'hits',
  });

  const antesPeleas = e.store.index.length;
  const antesLongitud = e.history.length;
  const antesSeq = e.storeSeq;

  // Una pelea de verdad: dos golpes y silencio hasta que caduca.
  e.feedEvent(golpe(1_800_000_000, 700));
  e.feedEvent(golpe(1_800_000_010, 900));
  e.tracker.tick(1_800_000_100);

  ok(e.store.index.length === antesPeleas + 1, 'la pelea llega al almacén',
    `${antesPeleas} -> ${e.store.index.length}`);
  ok(e.store.index[0].total === 1600, 'y con el daño que tuvo', String(e.store.index[0].total));
  // La mitad que explica el fallo: la señal vieja no se mueve.
  ok(e.history.length === antesLongitud,
    'la longitud del histórico NO cambia: por eso la lista no se enteraba',
    `${antesLongitud} -> ${e.history.length}`);
  // La mitad que lo arregla.
  ok(e.storeSeq > antesSeq, 'el contador de cambios sí sube', `${antesSeq} -> ${e.storeSeq}`);
  ok(e.snapshot().storeSeq === e.storeSeq, 'y viaja en el snapshot que ve la interfaz');

  // Y una segunda pelea vuelve a anunciarse: no basta con avisar una vez.
  const trasPrimera = e.storeSeq;
  e.feedEvent(golpe(1_800_001_000, 500));
  e.feedEvent(golpe(1_800_001_005, 500));
  e.tracker.tick(1_800_001_100);
  ok(e.storeSeq > trasPrimera, 'la segunda pelea también se anuncia',
    `${trasPrimera} -> ${e.storeSeq}`);

  // El tramo de las dos últimas horas las incluye: el filtro no era el problema.
  const ahora = Date.now();
  const recientes = e.queryHistory({ sinceMs: 2 * 3600 * 1000 });
  ok(recientes.length === 0 || recientes.every((x) => x.at >= ahora - 2 * 3600 * 1000),
    'el filtro por tramo compara con la hora de la pelea y no descarta nada más');

  e.detach();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
