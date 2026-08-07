/**
 * Las cinco columnas, y el cajón que no es una de ellas.
 *
 * Todo lo que hay aquí sale de medir un log real de 278.299 líneas, no de
 * suponerlo.
 *
 * EL FALLO DE FONDO. Había un `nivel = (d) => d ?? 0` escrito en cinco sitios
 * que convertía «no consta» en la dificultad 0. La consecuencia era que la
 * columna D0 de la rejilla contenía East Freeport: una columna rotulada como
 * una dificultad medida que en realidad contenía la ausencia de medida. Un dato
 * ausente con aspecto de dato medido es peor que no tener la columna.
 *
 * Y LO QUE PERMITIÓ ARREGLARLO. «Nagafen's Lair - Group.» —modo declarado, sin
 * número ni etiqueta— es la dificultad base, D0. No es una deducción por el
 * formato: mismo enemigo, misma zona y mismo modo, la vida de esas instancias
 * está un peldaño ENTERO por debajo de D1 (mediana 0,873 sobre once enemigos,
 * nueve de ellos entre 0,86 y 0,88), y ese peldaño mide lo mismo que el de D1 a
 * D2 (0,853) y el de D2 a D3 (0,884). No cae en medio: es el escalón de abajo.
 *
 * Los tres cajones son tres cosas distintas y se comprueban por separado:
 *   D0          instancia con dificultad base. Medida.
 *   sin marca   mundo abierto: la zona no declara dificultad porque no la hay.
 *   sin zona    peleas anteriores a la primera línea de zona: no se sabe dónde.
 */
import { parseZone, diffKey, labelDiff, SIN_MARCA, SIN_ZONA, DIFFS } from '../src/zones.js';
import { FoeLedger } from '../src/foes.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── 1. parseZone distingue D0 de «no consta» ───────────────────────────────
console.log('\nD0 no es lo mismo que «no consta»');
{
  const casos = [
    ["Nagafen's Lair - Group", 0, 'Group', "instancia base: D0"],
    ['The Permafrost Caverns - Group', 0, 'Group', 'otra base'],
    ["Nagafen's Lair - Group 1 (Awakened)", 1, 'Group', 'con número'],
    ['The Plane of Fear - Solo 4 (Refined)', 4, 'Solo', 'la más alta'],
    ['The Plane of Fear 4 (Refined)', 4, null, 'etiqueta sin modo: la etiqueta manda'],
    ['The Plane of Sky', null, null, 'mundo abierto: NO consta'],
    ['East Freeport', null, null, 'una ciudad tampoco es D0'],
  ];
  for (const [zona, diff, modo, nota] of casos) {
    const r = parseZone(zona);
    ok(r.diff === diff && r.mode === modo, `${zona} → ${diff === null ? 'no consta' : 'D' + diff} · ${nota}`,
      `salió diff=${r.diff} modo=${r.mode}`);
  }
  // «The Ruins of Old Guk 2» es parte del NOMBRE de la zona, no una dificultad.
  ok(parseZone('The Ruins of Old Guk 2 (Adaptive)').base === 'The Ruins of Old Guk 2',
    'el número del nombre de la zona se queda en el nombre');
}

// ── 2. Las claves de cajón: null NUNCA es cero ─────────────────────────────
console.log('\nlas claves de cajón');
{
  ok(diffKey(0) === 'D0', 'la dificultad 0 tiene su clave');
  ok(diffKey(null) === SIN_MARCA, '«no consta» tiene la suya, distinta');
  ok(diffKey(0) !== diffKey(null), 'y NO son la misma — este es el fallo de fondo');
  ok(labelDiff(0, null) === 'D0', 'D0 se rotula como D0');
  ok(labelDiff(null, null) === null, '«no consta» no se rotula como una dificultad');
  ok(DIFFS.length === 5 && DIFFS[0] === 0, 'las columnas son cinco, de la 0 a la 4');
}

// ── 3. La ficha se parte en los tres cajones ───────────────────────────────
const pelea = ({ zone, vida, loot = [], resist = null, mataTe = false, id = 1 }) => ({
  id, duration: 40, total: vida, zone, level: 50,
  kills: ['Dread'], losses: mataTe ? ['Campeon'] : [],
  lossesBy: mataTe ? [{ victim: 'Campeon', killer: 'Dread' }] : [],
  hpSamples: { Dread: [vida] },
  loot: loot.map((item) => ({ item, qty: 1, from: 'Dread' })),
  spellVsFoe: resist ? [{ spell: 'Shock of Swords', foe: 'Dread', ...resist, inv: null }] : [],
  rows: [
    { name: 'Campeon', side: 'ally', damage: vida, taken: 300, healingDone: 0,
      hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
      deaths: 0, max: 900, activeSec: 40, types: [], abilities: [],
      targets: [{ name: 'Dread', sum: vida }], takenBySource: [] },
    { name: 'Dread', side: 'enemy', damage: 300, taken: vida, healingDone: 0,
      hits: 20, meleeHits: 20, misses: 0, crits: 0, flurries: 0, ripostes: 0,
      deaths: 0, max: 120, activeSec: 40, types: [], abilities: [],
      targets: [{ name: 'Campeon', sum: 300 }], takenBySource: [] },
  ],
});

console.log('\ntres cajones, tres cosas distintas');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group", vida: 1000, loot: ['Throwing Boulder'] }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300, loot: ['Throwing Boulder +2'] }));
  led.fold(pelea({ id: 3, zone: 'East Freeport', vida: 800, loot: ['Rusty Dagger'] }));
  led.fold(pelea({ id: 4, zone: null, vida: 700 }));

  const f = led.get('Dread');
  const por = new Map(f.dificultades.map((d) => [d.key, d]));
  ok(por.has('D0'), 'la instancia base cae en D0');
  ok(por.has('D2'), 'la numerada cae en D2');
  ok(por.has(SIN_MARCA), 'el mundo abierto cae en «no consta»');
  ok(por.has(SIN_ZONA), 'la pelea sin zona cae en su propio cajón');
  ok(por.get('D0') !== por.get(SIN_MARCA), 'D0 y «no consta» no son la misma celda');
  ok(por.get(SIN_MARCA).diff === null && por.get(SIN_ZONA).diff === null,
    'los dos cajones de ausencia tienen diff null…');
  ok(por.get(SIN_MARCA).key !== por.get(SIN_ZONA).key,
    '…y aun así se distinguen, porque la clave no es el número');
  ok(por.get('D0').hp.avg === 1000 && por.get('D2').hp.avg === 1300,
    'cada celda tiene su vida, sin promediar', `${por.get('D0').hp.avg} / ${por.get('D2').hp.avg}`);
}

// ── 4. Botín por dificultad ────────────────────────────────────────────────
//
// Medido: `a fire giant warrior` suelta «Throwing Boulder» y «+1» en D0, y
// «Throwing Boulder +2» en D2. Son tablas distintas y sumadas describen una que
// no existe.
console.log('\nel botín no se mezcla entre dificultades');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group", vida: 1000, loot: ['Throwing Boulder'] }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300, loot: ['Throwing Boulder +2'] }));
  const f = led.get('Dread');
  const d0 = f.dificultades.find((d) => d.diff === 0);
  const d2 = f.dificultades.find((d) => d.diff === 2);
  ok(d0.lootList.length === 1 && d0.lootList[0].item === 'Throwing Boulder',
    'D0 sólo enseña lo suyo', d0.lootList.map((l) => l.item).join());
  ok(d2.lootList.length === 1 && d2.lootList[0].item === 'Throwing Boulder +2',
    'D2 sólo enseña lo suyo', d2.lootList.map((l) => l.item).join());
  ok(f.lootList.length === 2, 'y la ficha común sigue teniendo los dos', f.lootList.length);
}

// ── 5. Resistencias por dificultad, con su tamaño de muestra ───────────────
console.log('\nresistencias partidas, y el «n» siempre visible');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group", vida: 1000, resist: { landed: 9, resisted: 1 } }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300, resist: { landed: 1, resisted: 3 } }));
  const f = led.get('Dread');
  const d0 = f.dificultades.find((d) => d.diff === 0).spells[0];
  const d2 = f.dificultades.find((d) => d.diff === 2).spells[0];
  ok(d0.landed === 9 && d0.resisted === 1, 'D0 tiene sus intentos', `${d0.landed}/${d0.n}`);
  ok(d2.landed === 1 && d2.resisted === 3, 'D2 los suyos', `${d2.landed}/${d2.n}`);
  ok(d0.n === 10 && d2.n === 4, 'cada celda lleva su tamaño de muestra', `${d0.n} y ${d2.n}`);
  ok(f.spells[0].n === 14, 'la ficha común sigue teniendo la muestra entera', f.spells[0].n);
}

// ── 6. Las veces que te mató, que era un campo muerto ──────────────────────
//
// `deaths` se declaraba, se guardaba y se restauraba, y no lo incrementaba
// nadie. Sale de quién REMATÓ y no de a quién apuntaba el enemigo: en una pelea
// con tres, apuntarte no es haberte matado, y el log dice cuál fue.
console.log('\nlas veces que te mató');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group", vida: 1000, mataTe: true }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300 }));
  const f = led.get('Dread');
  ok(f.deaths === 1, 'la ficha común lo cuenta', f.deaths);
  ok(f.dificultades.find((d) => d.diff === 0).deaths === 1, 'y la celda de D0 también');
  ok(f.dificultades.find((d) => d.diff === 2).deaths === 0, 'la de D2 no, porque ahí no te mató');

  // Y no se le apunta la muerte a quien sólo te apuntaba.
  const otra = pelea({ id: 3, zone: "Nagafen's Lair - Group", vida: 500, mataTe: true });
  otra.lossesBy = [{ victim: 'Campeon', killer: 'Otro Bicho' }];
  const led2 = new FoeLedger();
  led2.fold(otra);
  ok(led2.get('Dread').deaths === 0, 'si te remató otro, a éste no se le apunta');
}

// ── 7. El modo va como dato de la celda, nunca como eje ────────────────────
//
// Medido: el 54% de las peleas de un log real no declara el modo, así que
// partir por él dejaría a la mayoría en un tercer cajón de «no consta» — la
// etiqueta que precisamente se acaba de quitar. Y el efecto medido en enemigos
// normales es +6,5%, menos de medio escalón de dificultad. Se guarda para que
// la pregunta se pueda contestar sola cuando haya muestra.
console.log('\nel modo se guarda, pero no parte la rejilla');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300 }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Solo 2 (Adaptive)", vida: 1200 }));
  const f = led.get('Dread');
  const d2 = f.dificultades.filter((d) => d.diff === 2);
  ok(d2.length === 1, 'Solo y Group comparten celda: D2 es D2', d2.length);
  const modos = Object.fromEntries(d2[0].modes.map((m) => [m.mode, m.n]));
  ok(modos.Group === 1 && modos.Solo === 1, 'pero el modo consta en la celda', JSON.stringify(modos));
}

// ── 8. Ida y vuelta a disco, con todo lo nuevo dentro ──────────────────────
//
// Es la invariante de siempre: guardar y volver tiene que dar un contador que
// pliega igual. Los campos nuevos son justo donde se rompe en silencio.
console.log('\nida y vuelta a disco');
{
  const led = new FoeLedger();
  led.fold(pelea({ id: 1, zone: "Nagafen's Lair - Group", vida: 1000, loot: ['Throwing Boulder'],
    resist: { landed: 9, resisted: 1 }, mataTe: true }));
  led.fold(pelea({ id: 2, zone: "Nagafen's Lair - Group 2 (Adaptive)", vida: 1300, loot: ['Throwing Boulder +2'] }));
  led.fold(pelea({ id: 3, zone: null, vida: 700 }));
  const vuelta = FoeLedger.fromJSON(JSON.parse(JSON.stringify(led.toJSON())));
  ok(JSON.stringify(led.list()) === JSON.stringify(vuelta.list()),
    'la ficha sobrevive entera al disco');
  const d0 = vuelta.get('Dread').dificultades.find((d) => d.diff === 0);
  ok(d0.lootList.length === 1, 'el botín por dificultad vuelve');
  ok(d0.spells.length === 1 && d0.spells[0].n === 10, 'las resistencias por dificultad también');
  ok(d0.deaths === 1, 'y las muertes que te causó');
  ok(vuelta.get('Dread').dificultades.some((d) => d.key === SIN_ZONA), 'y el cajón de «sin zona»');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
