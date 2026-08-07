/**
 * El botín: que se case la línea Y que se cuente la cantidad.
 *
 * Los dos fallos que hay aquí dentro salieron de medir un log real de 278.299
 * líneas, no de imaginarlos. De sus 681 líneas de botín se perdían 98 —el 14%—
 * por dos motivos distintos:
 *
 *   83  la cantidad. «You looted 2 Phosphorous Powder from …» no llevaba
 *       artículo y la regla exigía uno, así que la línea entera se descartaba.
 *   15  «and stored it in your currency», un final que no existía como regla.
 *       Son los Motes, que van al monedero: 9 de ellos `Mote of Major
 *       Potential`, ninguno visible en la sección de Botín.
 *
 * Y el segundo, el que de verdad justifica este fichero: casar la línea sin
 * leer la cantidad es PEOR que no casarla. Una línea que no casa se ve en el
 * contador de no reconocidas; un «2 Bone Chips» contado como uno no lo ve
 * nadie nunca. Por eso se comprueba que la cantidad llega hasta las tres
 * cuentas —el resumen del tramo, la ficha del enemigo y la enciclopedia—, que
 * son tres caminos distintos hasta el mismo número y tienen que coincidir.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Parser } from '../src/parser.js';
import { aggregate } from '../src/aggregate.js';
import { FoeLedger } from '../src/foes.js';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const linea = (cuerpo) => `[Tue Aug 04 12:50:13 2026] ${cuerpo}`;
const parse = (cuerpo) => new Parser({ self: 'Campeon' }).parse(linea(cuerpo));

// ── 1. Las cinco formas de línea, con su cantidad ──────────────────────────
//
// Las cinco están copiadas del log, no inventadas. Las tres últimas son las que
// no casaban. Ojo a la de la moneda: es la única que NO termina en punto.
console.log('\nformas de línea de botín');
{
  const casos = [
    ['--You have looted a Mote of Lesser Potential from a fetid fiend\'s corpse.--',
      { item: 'Mote of Lesser Potential', from: 'a fetid fiend', qty: 1 }],
    ['--You have looted 2 Bone Chips from a greater ice bones\'s corpse.--',
      { item: 'Bone Chips', from: 'a greater ice bones', qty: 2 }],
    ['You looted an Undead Froglok Tongue from a wan ghoul knight\'s corpse and sold it for 5 silver and 8 copper.',
      { item: 'Undead Froglok Tongue', from: 'a wan ghoul knight', qty: 1 }],
    ['You looted 2 Phosphorous Powder from a zol ghoul knight\'s corpse and sold it for 2 platinum, 5 gold, 7 silver and 2 copper.',
      { item: 'Phosphorous Powder', from: 'a zol ghoul knight', qty: 2 }],
    ['You looted a Mote of Major Potential from a scareling\'s corpse and stored it in your currency',
      { item: 'Mote of Major Potential', from: 'a scareling', qty: 1 }],
  ];
  for (const [cuerpo, esperado] of casos) {
    const ev = parse(cuerpo);
    const bien = ev?.kind === 'loot' && ev.item === esperado.item
      && ev.from === esperado.from && ev.qty === esperado.qty;
    ok(bien, cuerpo.slice(0, 62), bien ? `qty ${ev.qty}` : `salió ${JSON.stringify({ kind: ev?.kind, item: ev?.item, from: ev?.from, qty: ev?.qty })}`);
  }
}

// ── 2. El Mote que se perdía, tal cual estaba en el log ────────────────────
//
// Nueve `Mote of Major Potential` recogidos y cero en la sección de Botín. Es
// el caso que destapó todo, así que se queda escrito con su nombre.
console.log('\nel Mote of Major Potential');
{
  const ev = parse('You looted a Mote of Major Potential from Lord Nagafen\'s corpse and stored it in your currency');
  ok(ev?.kind === 'loot', 'la línea del monedero se reconoce como botín', ev?.kind);
  ok(ev?.stored === true, 'queda marcada como guardada en el monedero', ev?.stored);
  ok(ev?.item === 'Mote of Major Potential', 'el objeto sale entero', ev?.item);
}

// ── 3. Un final desconocido NO debe colarse como botín ─────────────────────
//
// La regla del monedero acepta punto final opcional; conviene que eso no la
// vuelva glotona con una cola que no conocemos.
console.log('\nlo que no es botín no se cuela');
{
  ok(parse('You are too far away to loot that corpse.')?.kind !== 'loot', '«too far away» no es botín');
  ok(parse('You received 5 platinum from that item.')?.kind !== 'loot', '«from that item» es moneda, no botín');
  ok(parse('Notarino tells the guild, \'Mote of Potential\'')?.kind === 'chat', 'nombrarlo en el chat no es recogerlo');
}

// ── 4. La cantidad llega igual por los tres caminos ────────────────────────
//
// Tres recorridos distintos sobre las mismas dos peleas. Si alguno cuenta
// recogidas en vez de unidades, la ficha del enemigo y la sección de Botín
// dirían cosas distintas del mismo objeto.
console.log('\nla cantidad llega a las tres cuentas');
{
  const pelea = (id, loot) => ({
    id, duration: 40, total: 5000, zone: 'Lower Guk', zoneBase: 'Lower Guk',
    diff: 2, diffTag: 'Adaptive', level: 50, raidDps: 125, enemyDps: 75,
    enemyTotal: 3000, healing: 0, kills: ['a zol ghoul knight'], losses: [],
    hpSamples: { 'a zol ghoul knight': [5000] }, loot, spellVsFoe: [],
    rows: [
      { name: 'Campeon', side: 'ally', damage: 5000, taken: 3000, healingDone: 0,
        hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: 900, activeSec: 40, types: [], abilities: [],
        targets: [{ name: 'a zol ghoul knight', sum: 5000 }], takenBySource: [] },
      { name: 'a zol ghoul knight', side: 'enemy', damage: 3000, taken: 5000,
        healingDone: 0, hits: 20, meleeHits: 20, misses: 0, crits: 0, flurries: 0,
        ripostes: 0, deaths: 0, max: 400, activeSec: 40, types: [], abilities: [],
        targets: [], takenBySource: [] },
    ],
  });
  // 2 + 2 unidades de Phosphorous Powder en dos peleas, y 1 Bone Chip suelto.
  const peleas = [
    pelea(1, [{ item: 'Phosphorous Powder', qty: 2, from: 'a zol ghoul knight' },
      { item: 'Bone Chips', qty: 1, from: 'a zol ghoul knight' }]),
    pelea(2, [{ item: 'Phosphorous Powder', qty: 2, from: 'a zol ghoul knight' }]),
  ];

  const a = aggregate(peleas, 'Campeon');
  const pp = a.loot.find((l) => l.item === 'Phosphorous Powder');
  ok(pp?.n === 4, 'resumen del tramo: 2 + 2 son 4 unidades', pp?.n);

  const led = new FoeLedger();
  for (const f of peleas) led.fold(f);
  const ficha = led.get('a zol ghoul knight');
  const fp = ficha.lootList.find((l) => l.item === 'Phosphorous Powder');
  ok(fp?.n === 4, 'ficha del enemigo: las mismas 4 unidades', fp?.n);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-loot-'));
  const store = new FightStore(dir);
  store.load();
  // El segundo argumento es la marca de tiempo, y tiene que ser distinta en
  // cada una: el almacén deduplica por «misma hora, mismo total, misma
  // duración», así que dos peleas gemelas a la misma hora son una sola.
  peleas.forEach((f, i) => store.append(f, 1_700_000_000_000 + i * 60_000));
  const enc = new Encyclopedia(store);
  enc.load();
  const ep = enc.lootList().find((l) => l.item === 'Phosphorous Powder');
  ok(ep?.n === 4, 'enciclopedia: las mismas 4 unidades', ep?.n);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 5. Lo guardado sin cantidad sigue valiendo uno ─────────────────────────
//
// El almacén de antes de este arreglo no trae `qty`. Vale uno, que es lo que se
// supo de esas peleas: inventarle otra cosa sería peor. Reconstruir las corrige.
console.log('\nlo guardado antes, sin cantidad');
{
  const vieja = {
    id: 9, duration: 10, total: 100, zone: 'Lower Guk', diff: null, level: 50,
    raidDps: 10, enemyDps: 0, enemyTotal: 0, healing: 0, kills: ['a froglok'],
    losses: [], hpSamples: {}, spellVsFoe: [],
    loot: [{ item: 'Bone Chips', from: 'a froglok' }],   // sin qty, como antes
    rows: [{ name: 'Campeon', side: 'ally', damage: 100, taken: 0, healingDone: 0,
      hits: 1, meleeHits: 1, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
      max: 100, activeSec: 10, types: [], abilities: [],
      targets: [{ name: 'a froglok', sum: 100 }], takenBySource: [] },
    { name: 'a froglok', side: 'enemy', damage: 0, taken: 100, healingDone: 0,
      hits: 0, meleeHits: 0, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
      max: 0, activeSec: 10, types: [], abilities: [], targets: [], takenBySource: [] }],
  };
  const a = aggregate([vieja], 'Campeon');
  ok(a.loot.find((l) => l.item === 'Bone Chips')?.n === 1,
    'una entrada sin `qty` cuenta uno, no cero ni NaN');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
