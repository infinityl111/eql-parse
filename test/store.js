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
  const { FORMATO_VERSION, RECONSTRUIR_DESDE, generacion } = await import('../src/store.js');

  ok(FORMATO_VERSION >= 2, 'la generación de los datos va por su cuenta, no por la versión de la app');
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
  s2.stamp(FORMATO_VERSION);
  const s3 = new FightStore(viejo); s3.load();
  ok(s3.migration().needed === false, 'tras marcarlo ya no pide migración');
  ok(s3.meta()?.version === FORMATO_VERSION, 'y la marca dice la versión', s3.meta()?.version);

  // MARCADO POR DEBAJO DE `RECONSTRUIR_DESDE`: vuelve a pedirla. Es lo que pasa
  // cuando un arreglo del parser invalida lo guardado y no hay forma de
  // corregirlo leyéndolo mejor, como el doble conteo de muertes de la
  // generación 2.
  //
  // ANTES ESTA PRUEBA USABA `FORMATO_VERSION - 1`, y era correcta mientras los
  // dos conceptos fueron el mismo número. Desde la 1.11.0 no lo son: el formato
  // puede subir sin que haya que reconstruir nada, que es justo lo que hace esa
  // versión. Esta prueba falló al separarlos, y falló bien.
  s3.stamp(RECONSTRUIR_DESDE - 1);
  const s4 = new FightStore(viejo); s4.load();
  ok(s4.migration().needed === true, 'por debajo del umbral de reconstruir, se pide');

  // Y la otra mitad de la distinción: sellado en el umbral pero por debajo del
  // formato de hoy, NO se pide reconstruir aunque lo guardado sea de antes.
  s4.stamp(RECONSTRUIR_DESDE);
  const s4b = new FightStore(viejo); s4b.load();
  ok(s4b.migration().needed === false,
    'sellado en el umbral, un formato nuevo NO obliga a reconstruir');
  ok(generacion(s4b.meta()) < FORMATO_VERSION,
    'aunque el formato haya subido por encima', `${generacion(s4b.meta())} < ${FORMATO_VERSION}`);
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

// ── 9. La pila de combates del overlay ────────────────────────────────────
//
// El overlay pasa a ir combate a combate: cada pelea cerrada es una entrada.
// Lo que se comprueba aquí es el contrato del motor con él, que es lo único
// que se puede medir sin una pantalla delante:
//   - una pelea cerrada entra en la pila, recortada y con identidad propia,
//   - la relectura del histórico NO la ensucia con peleas de hace horas,
//   - el reset la vacía junto al acumulado de la sesión.
console.log('\npila de combates del overlay');
{
  const { Engine, overlayFight, fightKey } = await import('../src/engine.js');
  const dir = tmp();
  const log = path.join(dir, 'eqlog_Campeon_erudin.txt');
  fs.writeFileSync(log, '[Tue Aug 04 18:00:00 2026] You have entered Lower Guk.\n');

  const e = new Engine();
  e.setStorePath(dir);
  await e.attach(log, { self: 'Campeon', idleSec: 20 });

  const golpe = (t, target, amount) => ({
    kind: 'melee', t, seq: 0, raw: '', school: 'melee',
    source: 'Campeon', target, amount, ability: 'hits',
  });

  ok(e.closedFights.length === 0, 'la pila arranca vacía');

  e.feedEvent(golpe(1_800_000_000, 'a spectre', 1200));
  e.feedEvent(golpe(1_800_000_020, 'a spectre', 800));
  e.tracker.tick(1_800_000_100);

  ok(e.closedFights.length === 1, 'la pelea cerrada entra en la pila');
  const b = e.closedFights[0];
  ok(b.total === 2000 && b.label === 'a spectre', 'con su daño y su nombre',
    `${b.label} · ${b.total}`);
  ok(b.rows.some((r) => r.name === 'Campeon' && r.side === 'ally')
    && b.rows.some((r) => r.name === 'a spectre' && r.side === 'enemy'),
    'y los dos bandos separados');
  // Recortada: sin series, sin casts, sin hechizos por enemigo. Es lo que
  // permite mandarla por su canal sin cargarse el ritmo del overlay.
  ok(b.series === undefined && b.casts === undefined && b.spellVsFoe === undefined,
    'va recortada: nada de lo que el overlay no pinta');
  ok(b.rows.every((r) => (r.abilities ?? []).length <= 6),
    'y como mucho las seis habilidades que enseña el desglose');

  // La identidad no puede ser el `id` a secas: al reconectar el log vuelve a
  // empezar por 1 y un bloque nuevo taparía a uno que ya está en la pila.
  ok(fightKey({ id: 1, start: 100 }) !== fightKey({ id: 1, start: 200 }),
    'dos peleas con el mismo id pero distinto inicio son distintas');
  ok(overlayFight(null) === null, 'sin pelea no hay bloque');

  // Segunda pelea: entra por delante.
  e.feedEvent(golpe(1_800_001_000, 'a revultant rat', 500));
  e.feedEvent(golpe(1_800_001_010, 'a revultant rat', 500));
  e.tracker.tick(1_800_001_100);
  ok(e.closedFights.length === 2 && e.closedFights[0].label === 'a revultant rat',
    'la más reciente va arriba', e.closedFights[0].label);
  ok(e.closedFights[0].key !== e.closedFights[1].key, 'y cada bloque tiene su identidad');

  // Al releer el histórico no se apila nada: son peleas de hace horas y
  // aparecerían en el overlay como si acabaran de terminar.
  e.backfilling = true;
  e.feedEvent(golpe(1_800_002_000, 'an ire ghast', 900));
  e.feedEvent(golpe(1_800_002_010, 'an ire ghast', 900));
  e.tracker.tick(1_800_002_100);
  e.backfilling = false;
  ok(e.closedFights.length === 2, 'la relectura del histórico no ensucia la pila',
    String(e.closedFights.length));
  ok(e.store.index.length === 3, 'pero sí se guarda, que es otra cosa',
    String(e.store.index.length));

  // Borrón y cuenta nueva: las dos mitades a la vez.
  e.killAgg.set('Campeon', { damage: 1000, seconds: 10, kills: 1 });
  e.resetSession();
  ok(e.closedFights.length === 0, 'el reset vacía la pila de combates');
  ok(e.killAgg.size === 0, 'y el acumulado de la sesión con ella');
  ok(e.store.index.length === 3, 'sin tocar el histórico guardado',
    String(e.store.index.length));

  e.detach();
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 10. Compañeros de grupo declarados ───────────────────────────────────
//
// El registro de EQL no dice quién va en tu grupo: se buscó y no hay ninguna
// señal —ni invitaciones, ni entradas, ni salidas—, así que un jugador que pega
// a tus enemigos no se distingue de uno que pasaba por allí. Declararlo es la
// única vía, y de ahí salen dos cosas: deja de contarse como «sin identificar»
// y se puede filtrar el histórico por con quién jugaste.
console.log('\nfiltro por compañero de grupo');
{
  const dir = tmp();
  const s = new FightStore(dir);
  /** Pelea con los aliados que se le digan. */
  const conAliados = (id, foe, dmg, aliados) => ({
    ...fight(id, foe, dmg),
    rows: [
      ...fight(id, foe, dmg).rows,
      ...aliados.map((n) => ({ name: n, side: 'ally', damage: 100, taken: 0, healingDone: 0,
        hits: 5, meleeHits: 5, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
        max: 30, activeSec: 40, types: [['melee', 100]], abilities: [], targets: [], takenBySource: [] })),
    ],
  });
  s.append(conAliados(1, 'bicho solo', 900, []), 8_000_000);
  s.append(conAliados(2, 'bicho con uno', 900, ['Notarino']), 8_001_000);
  s.append(conAliados(3, 'bicho con los dos', 900, ['Notarino', 'Kalforgelp']), 8_002_000);
  s.append(conAliados(4, 'bicho con el otro', 900, ['Kalforgelp']), 8_003_000);

  ok(s.filter({}).length === 4, 'cuatro peleas guardadas');
  ok(s.index[0].allies.includes('Campeon'), 'el índice guarda quién estuvo de tu lado',
    s.index[0].allies.join(', '));

  const uno = s.filter({ mates: ['Notarino'] });
  ok(uno.length === 2, 'con uno marcado: las peleas donde estuvo', `${uno.length}`);

  // La decisión que importa: varios marcados es «estuvieron TODOS», no
  // «alguno». Con «alguno» saldrían tres y el reparto por persona se calcularía
  // sobre peleas a las que faltaba uno, que es justo lo que no se puede
  // comparar.
  const dos = s.filter({ mates: ['Notarino', 'Kalforgelp'] });
  ok(dos.length === 1, 'con dos marcados: sólo donde estuvieron los dos', `${dos.length}`);
  ok(dos[0].label === 'bicho con los dos', 'y es la que toca', dos[0].label);

  ok(s.filter({ mates: ['Nadie'] }).length === 0, 'alguien que no estuvo no devuelve nada');
  ok(s.filter({ mates: [] }).length === 4, 'sin nadie marcado no se filtra nada');
  // Se compone con los filtros que ya había.
  ok(s.filter({ mates: ['Notarino'], foe: 'con los dos' }).length === 1,
    'y se combina con el filtro por enemigo');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 11. Índices anteriores a que existiera `allies` se rellenan solos ─────
//
// El índice es dato DERIVADO: el .ndjson es la fuente y no se toca. Por eso
// esto no pide releer el log ni avisar a nadie. Medido sobre un almacén real de
// 160 peleas y 2,5 MB: 34 ms.
console.log('\nrelleno del índice sin reconstruir');
{
  const dir = tmp();
  const s = new FightStore(dir);
  const conAliado = (id, foe) => {
    const f = fight(id, foe, 900);
    f.rows.push({ name: 'Notarino', side: 'ally', damage: 100, taken: 0, healingDone: 0,
      hits: 5, meleeHits: 5, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
      max: 30, activeSec: 40, types: [], abilities: [], targets: [], takenBySource: [] });
    return f;
  };
  s.append(conAliado(1, 'un gorgon'), 7_000_000);
  s.append(conAliado(2, 'otro gorgon'), 7_001_000);

  // Se quita `allies` del índice, como lo escribían las versiones anteriores.
  const idxPath = path.join(dir, 'fights.idx');
  const datosAntes = fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8');
  fs.writeFileSync(idxPath, fs.readFileSync(idxPath, 'utf8').split('\n').filter(Boolean)
    .map((l) => { const o = JSON.parse(l); delete o.allies; return JSON.stringify(o); }).join('\n') + '\n');
  ok(!JSON.parse(fs.readFileSync(idxPath, 'utf8').split('\n')[0]).allies,
    'el índice de partida no tiene `allies`');

  const s2 = new FightStore(dir);
  ok(s2.load() === 2, 'se cargan las dos peleas');
  ok(s2.index.every((x) => Array.isArray(x.allies)), 'y todas reciben `allies` al cargar');
  ok(s2.filter({ mates: ['Notarino'] }).length === 2,
    'así que se puede filtrar por compañero sin reconstruir nada');
  ok(fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8') === datosAntes,
    'el fichero de datos no se ha tocado: sólo se ha recalculado el resumen');

  // Y queda escrito, para no repetirlo en cada arranque.
  const s3 = new FightStore(dir); s3.load();
  ok(s3.index.every((x) => Array.isArray(x.allies)), 'el índice reescrito ya lo trae');
  ok(s3.get(s3.index[0].uid)?.label === 'otro gorgon',
    'y los registros se siguen leyendo por su posición', s3.get(s3.index[0].uid)?.label);

  // Un registro ilegible no puede inventarse una lista vacía: eso afirmaría que
  // no había nadie. Se queda sin `allies` y el filtro lo descarta.
  const s4 = new FightStore(dir);
  s4.load();
  s4.index[0].allies = undefined;
  ok(s4.filter({ mates: ['Notarino'] }).length === 1,
    'una pelea de la que no se sabe quién estuvo no cuela en el filtro');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 11b. La dificultad que faltaba se rehace al leer ──────────────────────
//
// Hasta ahora, una zona sin modo ni etiqueta —«The Plane of Sky»— se guardaba
// con `diff: null`, «no consta». Es que vale 0: en EQL el silencio sobre la
// dificultad ES la dificultad base, y el registro lo enseña sin ambigüedad —una
// instancia recién creada por ti no trae ninguna línea con dificultad—. Con la
// regla vieja se quedaban sin asignar 84 de 410 peleas guardadas, el 20,5%, y
// 70 eran esa misma zona.
//
// Se cura al LEER, como el `uid` que faltaba en los índices antiguos: la
// dificultad sale entera del nombre de zona, y el nombre de zona sí se guardó.
// Ningún fichero se toca y una reconstrucción escribiría exactamente lo mismo.
console.log('\nla dificultad que faltaba, sin reconstruir');
{
  const dir = tmp();
  const s = new FightStore(dir);
  const enZona = (id, zona) => ({ ...fight(id, 'un gorgon', 900), zone: zona });
  s.append(enZona(1, 'The Plane of Sky'), 8_000_000);
  s.append(enZona(2, "Nagafen's Lair - Solo 3 (Fused)"), 8_001_000);

  // Se pone el índice como lo escribían las versiones anteriores.
  const idxPath = path.join(dir, 'fights.idx');
  const datosAntes = fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8');
  fs.writeFileSync(idxPath, fs.readFileSync(idxPath, 'utf8').split('\n').filter(Boolean)
    .map((l) => {
      const o = JSON.parse(l);
      if (o.zone === 'The Plane of Sky') o.diff = null;
      return JSON.stringify(o);
    }).join('\n') + '\n');

  const s2 = new FightStore(dir);
  s2.load();
  const sky = s2.index.find((x) => x.zone === 'The Plane of Sky');
  ok(sky.diff === 0, 'la pelea guardada sin dificultad pasa a ser D0', String(sky.diff));
  ok(s2.filter({ diff: 0 }).some((x) => x.zone === 'The Plane of Sky'),
    'y el filtro por D0 ya la encuentra');
  ok(s2.get(sky.uid)?.diff === 0, 'la pelea entera también, que es de donde lee el expediente');

  // Lo que YA tenía dificultad no se toca: puede venir de una etiqueta.
  const naga = s2.index.find((x) => x.zone?.startsWith("Nagafen's"));
  ok(naga.diff === 3, 'una dificultad que ya constaba se respeta', String(naga.diff));
  ok(fs.readFileSync(path.join(dir, 'fights.ndjson'), 'utf8') === datosAntes,
    'y el fichero de datos sigue intacto');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 12. Selección a mano de un grupo de peleas ───────────────────────────
//
// Los filtros describen un criterio; esto describe una lista. Sirve para lo
// que ningún criterio acierta: «estas seis de aquí», la sesión que acabas de
// jugar y que no cae en un tramo redondo ni comparte enemigo.
console.log('\nselección a mano de peleas');
{
  const dir = tmp();
  const s = new FightStore(dir);
  const uids = [];
  for (let i = 1; i <= 6; i++) uids.push(s.append(fight(i, `bicho ${i}`, 100 * i), 6_000_000 + i * 1000).uid);

  const tres = s.filter({ uids: [uids[0], uids[2], uids[4]] });
  ok(tres.length === 3, 'devuelve exactamente las pedidas', `${tres.length}`);
  ok(tres.map((x) => x.label).sort().join(',') === 'bicho 1,bicho 3,bicho 5',
    'y son las que se pidieron', tres.map((x) => x.label).join(','));

  // Lo que decide el diseño: una selección a mano MANDA sobre los criterios.
  // Si no, elegir seis peleas y tener el tramo en «última hora» te quitaría
  // las que están fuera, y tú ya habías dicho cuáles querías.
  const conFiltros = s.filter({
    uids: [uids[0], uids[1]], sinceMs: 1, foe: 'no existe', mates: ['Nadie'],
  });
  ok(conFiltros.length === 2,
    'el tramo, el enemigo y los compañeros no le quitan nada', `${conFiltros.length}`);

  // Y sin selección, los criterios siguen mandando como siempre.
  ok(s.filter({ uids: [] }).length === 6, 'sin selección no cambia nada');
  ok(s.filter({ foe: 'bicho 4' }).length === 1, 'y el filtro por enemigo sigue vivo');
  // Un uid que ya no existe no inventa una pelea.
  ok(s.filter({ uids: [uids[0], 999999] }).length === 1,
    'un identificador que no está se ignora, no falla');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 13. La mascota de otro jugador, asignada a mano ──────────────────────
//
// En EQL la mascota cambia de nombre en cada invocación y el nombre sale de una
// lista cerrada, así que la de otro jugador aparece como un desconocido más.
// Decir de quién es la saca de «sin identificar», y plegarla dentro de su dueño
// es lo único que permite comparar personas: medido en un almacén real, una
// mascota sin asignar se llevaba el 20% del daño de un tramo, y ese 20% era de
// alguien.
console.log('\nmascota ajena asignada a su dueño');
{
  const { ownerPets, mergeOwnerPets } = await import('../src/aggregate.js');
  const fila = (name, damage, extra = {}) => ({
    name, side: 'ally', damage, taken: 0, healingDone: 0, hits: 10, meleeHits: 10,
    misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 100, activeSec: 40,
    share: damage / 1000, types: [['melee', damage]],
    abilities: [{ name: 'golpe', type: 'melee', sum: damage, n: 10, max: 100 }],
    targets: [{ name: 'a gorgon', sum: damage }], ...extra,
  });
  const filas = [fila('Campeon', 500), fila('Notarino', 300), fila('Gobobn', 200),
    { ...fila('a gorgon', 0), side: 'enemy' }];
  filas[2].unidentified = true;

  // Asignar: rótulo y salida de «sin identificar». Ni una cifra se mueve.
  const conDueño = ownerPets(filas, { Gobobn: 'Notarino' });
  const g = conDueño.find((r) => r.name === 'Gobobn');
  ok(g.petOf === 'Notarino', 'la mascota queda a nombre de su dueño', g.petOf);
  ok(g.unidentified === false, 'y deja de estar sin identificar');
  ok(g.damage === 200 && conDueño.find((r) => r.name === 'Notarino').damage === 300,
    'asignarla no mueve ninguna cifra');

  // Plegar: ahora sí se suma, y donde toca.
  const plegado = mergeOwnerPets(conDueño);
  ok(!plegado.some((r) => r.name === 'Gobobn'), 'plegada, su fila desaparece');
  const n = plegado.find((r) => r.name === 'Notarino');
  ok(n.damage === 500, 'y su daño entra en el de su dueño', String(n.damage));
  ok(n.mergedPets === 1 && n.mergedPetsFrom[0] === 'Gobobn',
    'diciendo cuántas y cuáles, para que no parezca todo suyo');
  ok(Math.abs(n.share - 0.5) < 1e-9, 'el reparto también se suma', String(n.share));
  ok(n.hits === 20, 'y los golpes', String(n.hits));

  // LA MASCOTA ES UNA LÍNEA DENTRO DE SU DUEÑO, no un puñado de habilidades
  // sueltas. Antes sus «golpe» se sumaban a los del dueño y quedaban entre los
  // suyos sin nada que dijera de quién eran: el total salía bien y «cuánto puso
  // la mascota» dejaba de poderse contestar. Es el fallo del tanqueo otra vez.
  const suGolpe = n.abilities.find((a) => a.name === 'golpe');
  const suPet = n.abilities.find((a) => a.pet);
  ok(suGolpe.n === 10, 'lo del dueño sigue siendo lo del dueño', String(suGolpe.n));
  ok(!!suPet && suPet.name === 'Gobobn', 'y la mascota entra con su nombre', suPet?.name);
  ok(suPet.sum === 200 && suPet.n === 10,
    'con lo que puso ella, que es lo que había que poder contestar',
    `${suPet?.sum}/${suPet?.n}`);
  ok(n.abilities.reduce((a, x) => a + x.sum, 0) === n.damage,
    'y las dos líneas suman exactamente el total del dueño');
  ok(suPet.p50 === undefined,
    'la línea de la mascota no finge tener forma del golpe: es una suma, no un ataque');
  ok(plegado.find((r) => r.name === 'Campeon').damage === 500, 'a nadie más le toca nada');
  ok(plegado.find((r) => r.name === 'a gorgon'), 'y el enemigo sigue donde estaba');

  // Un dueño que no está en la pelea no puede recibir nada: sería inventar una
  // fila. La mascota se queda suelta con su rótulo.
  const sinDueño = mergeOwnerPets(ownerPets(filas, { Gobobn: 'Kalforgelp' }));
  ok(sinDueño.some((r) => r.name === 'Gobobn'),
    'si el dueño no está en la pelea, la mascota se queda como está');
  ok(sinDueño.length === filas.length, 'y no aparece ninguna fila nueva');

  // Sin asignaciones no se toca nada, ni se copian las filas.
  ok(ownerPets(filas, {}) === filas, 'sin asignaciones se devuelven las mismas filas');
  ok(mergeOwnerPets(filas) === filas, 'y sin dueños tampoco hay nada que plegar');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
