import { FoeLedger } from '../src/foes.js';
import { aggregate } from '../src/aggregate.js';

/**
 * El contador de expedientes, y la propiedad que justifica que exista.
 *
 * El resumen del tramo suma las peleas de golpe y de la más nueva a la más
 * vieja, que es como las devuelve el índice. La enciclopedia las plegará de una
 * en una y de la más vieja a la más nueva, según van terminando. Si las dos
 * cosas no dan exactamente la misma ficha, una de las dos miente y no hay forma
 * de saber cuál: por eso el contador es uno solo y por eso se comprueba aquí
 * que el orden no cambia el resultado.
 */

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/** Una pelea contra un enemigo, con todo lo que alimenta su ficha. */
function pelea({ diff, tag, zone, vida, maxHit, cayo = true, hab = [], loot = [], hechizos = [] }) {
  return {
    duration: 40, total: vida, zone, diff, diffTag: tag, level: 50,
    kills: cayo ? ['Dread'] : [], losses: [],
    hpSamples: cayo ? { Dread: [vida] } : {},
    loot: loot.map((item) => ({ item, from: 'Dread' })),
    spellVsFoe: hechizos,
    rows: [
      { name: 'Campeon', side: 'ally', damage: vida, taken: 3000, healingDone: 0,
        hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: 900, activeSec: 40, types: [], abilities: [],
        targets: [{ name: 'Dread', sum: vida }], takenBySource: [{ name: 'Dread', sum: 3000 }] },
      { name: 'Dread', side: 'enemy', damage: 3000, taken: vida, healingDone: 0,
        hits: 20, meleeHits: 20, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: maxHit, activeSec: 40, types: [],
        abilities: hab, targets: [{ name: 'Campeon', sum: 3000 }], takenBySource: [] },
    ],
  };
}

const golpe = (name, type, sum) => ({ name, type, sum, n: 1, max: sum });

const PELEAS = [
  pelea({ diff: 4, tag: 'Refined', zone: 'Plane of Fear - Group 4 (Refined)', vida: 412900, maxHit: 18402,
    hab: [golpe('hits', 'melee', 2000), golpe('Ice Comet', 'cold', 900)],
    loot: ['Cloak of Flames'],
    hechizos: [{ spell: 'Shock of Swords', foe: 'Dread', landed: 3, resisted: 5, inv: 'Wolf' }] }),
  pelea({ diff: 4, tag: 'Refined', zone: 'Plane of Fear - Group 4 (Refined)', vida: 408100, maxHit: 17100,
    hab: [golpe('hits', 'melee', 2400)],
    hechizos: [{ spell: 'Shock of Swords', foe: 'Dread', landed: 6, resisted: 10, inv: null }] }),
  pelea({ diff: 3, tag: 'Fused', zone: 'Plane of Fear - Group 3 (Fused)', vida: 251000, maxHit: 9400,
    hab: [golpe('hits', 'melee', 1200), golpe('Ice Comet', 'magic', 400)],
    loot: ['Cloak of Flames', 'Shiny Brass Idol'] }),
  // Una que no cayó: cuenta como encuentro y no deja muestra de vida.
  pelea({ diff: 3, tag: null, zone: 'Plane of Fear - Group 3 (Fused)', vida: 90000, maxHit: 9100,
    cayo: false, hab: [golpe('Ice Comet', 'magic', 700)] }),
];

/** Lo comparable de una ficha: si dos caminos difieren, difieren aquí. */
const huella = (e) => JSON.stringify({
  fights: e.fights, kills: e.kills, damageTo: e.damageTo, taken: e.taken,
  maxHit: e.maxHit, seconds: e.seconds, hp: e.hp,
  zones: [...e.zones].sort(), levels: e.levels,
  abilities: e.abilities, lootList: e.lootList, spells: e.spells,
  dificultades: e.dificultades.map((d) => ({ ...d, zones: [...d.zones].sort() })),
});

console.log('\nel contador da lo mismo por los dos caminos');
{
  const enLote = new FoeLedger();
  for (const f of PELEAS) enLote.fold(f);

  const alReves = new FoeLedger();
  for (const f of [...PELEAS].reverse()) alReves.fold(f);

  ok(huella(enLote.get('Dread')) === huella(alReves.get('Dread')),
    'plegarlas al derecho o al revés da la misma ficha');

  // Y el resumen del tramo, que es el otro consumidor, tiene que coincidir con
  // el contador llamado a mano: si alguien vuelve a copiar el cálculo dentro de
  // `aggregate`, esta comprobación se cae.
  const delResumen = aggregate(PELEAS, 'Campeon').foes.find((x) => x.name === 'Dread');
  ok(huella(delResumen) === huella(enLote.get('Dread')),
    'y el resumen del tramo no tiene una cuenta propia');
}

console.log('\nlo que la ficha afirma, y lo que no');
{
  const l = new FoeLedger();
  for (const f of PELEAS) l.fold(f);
  const e = l.get('Dread');

  ok(e.fights === 4, 'cuatro encuentros', e.fights);
  ok(e.kills === 3, 'tres caídas: la cuarta se escapó', e.kills);
  ok(e.hp.n === 3, 'tres muestras de vida, una por caída', e.hp.n);

  const d4 = e.dificultades.find((d) => d.diff === 4);
  const d3 = e.dificultades.find((d) => d.diff === 3);
  ok(d4.hp.avg === 410500 && d3.hp.avg === 251000,
    'cada dificultad con su vida, sin promediar', `${d4.hp.avg} y ${d3.hp.avg}`);
  ok(d4.hp.n === 2 && d3.hp.n === 1, 'y con cuántas muertes lo sostienen');
  ok(d3.fights === 2 && d3.kills === 1,
    'el encuentro en el que no cayó cuenta como encuentro y no como caída');
  ok(d3.tag === 'Fused',
    'la etiqueta la pone la pelea que la trae, no la primera que llegue', d3.tag);

  // El tipo de daño de Ice Comet viene como «cold» en D4 (900) y «magic» en D3
  // (400 + 700 = 1.100): gana el que más ha pegado, no el que llegó antes.
  const comet = e.abilities.find((a) => a.name === 'Ice Comet');
  ok(comet.type === 'magic', 'el tipo de daño lo decide el reparto, no el orden', comet.type);
  ok(comet.sum === 2000, 'y la suma es la de todas las peleas', comet.sum);

  const enD4 = d4.abilities.find((a) => a.name === 'Ice Comet');
  ok(enD4.inFights === 1 && d4.fights === 2,
    'se dice en cuántos de cuántos encuentros salió, no que la tenga', `${enD4.inFights}/${d4.fights}`);
  ok(!d3.abilities.some((a) => a.name === 'hits' && a.inFights === 2),
    'lo que sólo pasó en un encuentro no se atribuye a los dos');

  ok(d4.zones.join() === 'Plane of Fear' && d3.zones.join() === 'Plane of Fear',
    'la zona se guarda sin modo ni dificultad, que es como se consulta', d4.zones.join());

  const shock = e.spells.find((s) => s.spell === 'Shock of Swords');
  ok(shock.landed === 9 && shock.resisted === 15,
    'las resistencias se suman en crudo, sin partir por dificultad', `${shock.landed}/${shock.landed + shock.resisted}`);

  ok(e.lootList[0].item === 'Cloak of Flames' && e.lootList[0].n === 2,
    'el botín cuenta cuántas veces ha caído de él', JSON.stringify(e.lootList[0]));
}

console.log('\nsin peleas no se inventa nada');
{
  const l = new FoeLedger();
  ok(l.get('Dread') === null, 'un enemigo que no te has cruzado no tiene ficha');
  l.fold({ rows: [] });
  l.fold(null);
  ok(l.list().length === 0, 'y plegar peleas vacías no crea ninguna');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
