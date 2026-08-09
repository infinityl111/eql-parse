/**
 * CONTRA QUÉ SE COMPARA EL VEREDICTO DEL CONSEJO.
 *
 * EL FALLO QUE ESTO IMPIDE, y es de medición, no de presentación. La tabla de
 * posturas siempre estuvo bien: «cuánto habría evitado Defensive» se aplica al
 * daño entero porque la hipótesis es haberla llevado toda la pelea. Lo que
 * estaba mal era el OTRO lado de la resta. Para saber cuánto evitaste de verdad
 * se cogía UNA postura —la que más tiempo aguantó— y se le acreditaba el daño
 * entero de la pelea, incluidos todos los tramos en los que llevabas otra.
 *
 * En una pelea donde bailas bien, eso invierte el consejo. Si pasas la fase de
 * melé en Defensive y la mágica en Mage Hunter, evitaste la mitad de todo; pero
 * colapsando la pelea a Defensive salen 7.000 de 20.000, y entonces el consejo
 * te recomienda Channeler «para evitar 1.000 más» cuando en realidad Channeler
 * habría evitado 2.000 MENOS que lo que hiciste.
 *
 * La comprobación que manda es la de abajo: MISMOS TOTALES, un tramo o dos, y
 * el veredicto tiene que cambiar. Si vuelve a colapsarse, los dos casos dan lo
 * mismo y esto falla.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { advise } from '../src/advisor.js';
import { STANCES } from '../src/stances.js';
import { t } from '../src/i18n.js';
import { FightStore, MODELO_MEDICION } from '../src/store.js';

let failed = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra !== undefined ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eqltramos-'));

const CTX = { classes: ['SHD'], stance: 'defensive',
  seenStances: ['defensive', 'mage hunter', 'channeler'] };

/**
 * La misma pelea con los mismos totales, contada de dos maneras.
 *
 * 10.000 de melé y 10.000 de mágico recibidos, 40 impactos. Lo único que cambia
 * es si el daño viene partido por la postura de cada golpe o en un solo cubo.
 */
const pelea = (tramos) => ({
  name: 'Campeon', damage: 40000, taken: 20000, healingDone: 0,
  types: [['melee', 40000]], defense: [], rawMeleeOut: 40000,
  takenByType: [{ name: 'melee', sum: 10000, n: 20 }, { name: 'magic', sum: 10000, n: 20 }],
  rawTakenByType: [{ name: 'melee', sum: 10000, n: 20 }, { name: 'magic', sum: 10000, n: 20 }],
  takenByStance: tramos,
});

// Bailando: el melé en Defensive (mitiga 0,50 de melé) y lo mágico en Mage
// Hunter (mitiga 0,50 de mágico). Evitas la mitad de todo: 10.000.
const BAILANDO = [
  { stance: 'defensive', melee: 10000, spell: 0, unmit: 0, n: 20, landed: 20, avoided: 0 },
  { stance: 'mage hunter', melee: 0, spell: 10000, unmit: 0, n: 20, landed: 0, avoided: 0 },
];
// Quieto en Defensive todo el rato: 10.000×0,50 + 10.000×0,20 = 7.000.
const QUIETO = [
  { stance: 'defensive', melee: 10000, spell: 10000, unmit: 0, n: 40, landed: 20, avoided: 0 },
];

console.log('\nmismos totales, un tramo o dos');
{
  const dos = advise(pelea(BAILANDO), CTX);
  const uno = advise(pelea(QUIETO), CTX);
  ok(dos && uno, 'las dos versiones producen consejo');

  // Los totales son idénticos: es la misma pelea.
  ok(dos.incoming.total === uno.incoming.total && dos.incoming.total === 20000,
    'el daño recibido es el mismo en las dos', dos.incoming.total);
  // Y por tanto la tabla de candidatas también, que es lo que no debía cambiar.
  ok(JSON.stringify(dos.defence.map((d) => Math.round(d.prevented)))
     === JSON.stringify(uno.defence.map((d) => Math.round(d.prevented))),
  'la tabla de posturas candidatas es idéntica en las dos');

  // Lo que evitaste de verdad NO es lo mismo, y ahí está todo.
  ok(Math.round(dos.prevenidoReal) === 10000,
    'bailando evitaste 10.000', Math.round(dos.prevenidoReal));
  ok(Math.round(uno.prevenidoReal) === 7000,
    'quieto en Defensive habrías evitado 7.000', Math.round(uno.prevenidoReal));

  // La mejor postura FIJA es Channeler, con 8.000. Bailando la superas.
  const mejor = dos.defence[0];
  ok(mejor.key === 'channeler' && Math.round(mejor.prevented) === 8000,
    'la mejor postura fija es Channeler con 8.000', `${mejor.key} ${Math.round(mejor.prevented)}`);

  // ── LA COMPROBACIÓN QUE MANDA ──────────────────────────────────────────
  ok(dos.gain < 0, 'bailando, sostener la mejor postura fija habría evitado MENOS',
    Math.round(dos.gain));
  ok(uno.gain > 0, 'quieto, sostener Channeler sí habría evitado más',
    Math.round(uno.gain));
  ok(dos.gain !== uno.gain,
    'y por tanto el veredicto de las dos NO puede ser el mismo',
    `${Math.round(dos.gain)} vs ${Math.round(uno.gain)}`);

  ok(dos.bailaste === true && uno.bailaste === false,
    'se sabe cuál tuvo más de una postura');
  ok(dos.verdict === t('adv.dancedFine', { used: 'Defensive · Mage Hunter', stance: 'Channeler' }),
    'y el veredicto dice que el baile salió bien, no que cambies', dos.verdict);
  ok(uno.verdict === t('adv.wouldGain', { stance: 'Channeler', n: 1000, current: 'Defensive' }),
    'mientras que quieto sí se recomienda cambiar', uno.verdict);
}

// ── El baile MALO también se detecta ────────────────────────────────────
//
// Bailar no es bueno por bailar: si eliges mal en cada tramo, la mejor postura
// fija te gana y hay que decirlo.
console.log('\nun baile que salió mal');
{
  const alReves = [
    { stance: 'mage hunter', melee: 10000, spell: 0, unmit: 0, n: 20, landed: 20, avoided: 0 },
    { stance: 'defensive', melee: 0, spell: 10000, unmit: 0, n: 20, landed: 0, avoided: 0 },
  ];
  const a = advise(pelea(alReves), CTX);
  ok(Math.round(a.prevenidoReal) === 4000,
    'eligiendo al revés evitas 4.000', Math.round(a.prevenidoReal));
  ok(a.gain > 0 && Math.round(a.gain) === 4000,
    'Channeler habría evitado 4.000 más que ese baile', Math.round(a.gain));
  ok(a.verdict === t('adv.dancedWorse',
    { stance: 'Channeler', n: 4000, used: 'Mage Hunter · Defensive' }),
  'y se dice contra el baile, no contra una postura sola', a.verdict);
}

// ── Peleas viejas: se comparan contra una sola, y se dice ──────────────
console.log('\nuna pelea guardada antes de que esto se midiera');
{
  const vieja = pelea(undefined);
  delete vieja.takenByStance;
  const a = advise(vieja, CTX);
  ok(a.segmentado === false, 'se marca que NO está segmentada', a.segmentado);
  ok(a.conTramos === false, 'y no hay tramos que usar', a.conTramos);
  ok(a.prevenidoReal === null, 'y no se inventa un reparto que no se midió');
  ok(a.bailaste === false, 'ni se afirma que bailaras');
  // Sigue dando consejo, comparando contra la postura única, que es lo único
  // que se puede hacer con lo que hay guardado.
  ok(a.verdict !== null && a.gain !== null, 'pero sigue dictaminando con lo que hay');
}

// ── «Sin postura» NO es «pelea vieja» ──────────────────────────────────
//
// Los dos casos dan una lista de tramos vacía, y confundirlos le echa encima a
// una pelea medida el cartel de «guardada antes de que esto se midiera».
console.log('\nuna pelea medida en la que no consta ninguna postura');
{
  const a = advise(pelea([]), CTX);
  ok(a.segmentado === true, 'SÍ está medida por postura', a.segmentado);
  ok(a.conTramos === false, 'aunque no haya ningún tramo que usar', a.conTramos);
  ok(a.prevenidoReal === null, 'y no se le acredita nada evitado');
}

// ── El fichero lateral: reparto y motivo, los dos viajan ───────────────
console.log('\nel reparto de las peleas viejas, y el motivo de las que no lo tienen');
{
  const s = new FightStore(tmp(), 'Campeon');
  const base = (id) => ({
    id, label: 'a gorgon', zone: 'Lower Guk', duration: 40, total: 5000,
    raidDps: 125, enemyTotal: 0, enemyDps: 0, healing: 0, kills: [], losses: [],
    loot: [], spellVsFoe: [], start: 1000,
    rows: [{ name: 'Campeon', side: 'ally', damage: 5000, taken: 600,
      takenByType: [{ name: 'melee', sum: 600, n: 12 }],
      rawTakenByType: [{ name: 'melee', sum: 1200, n: 12 }] }],
  });
  const conReparto = s.append(base(1), 111000);
  const conMotivo = s.append(base(2), 222000);

  s.appendTramos({ at: 111000, self: 'Campeon', modelo: MODELO_MEDICION,
    takenByStance: BAILANDO });
  s.appendTramos({ at: 222000, self: 'Campeon', modelo: 2, motivo: 'frontera-idle-20s' });

  s.cache.clear();
  const a = s.get(conReparto.uid), b = s.get(conMotivo.uid);

  ok(a.rows[0].takenByStance?.length === 2, 'el reparto llega a la fila propia',
    a.rows[0].takenByStance?.length);
  ok(a.modelo === MODELO_MEDICION, 'y la pelea sube al modelo nuevo', a.modelo);
  ok(a.motivo === undefined, 'sin motivo, porque no hizo falta');

  ok(!b.rows[0].takenByStance, 'la exceptuada NO recibe reparto');
  ok(b.modelo === 2, 'se queda en el modelo viejo', b.modelo);
  ok(b.motivo === 'frontera-idle-20s',
    'Y EL MOTIVO VIAJA CON ELLA, que es lo que la distingue de un fallo', b.motivo);

  // Anotar dos veces la misma pelea no la duplica: gana la última.
  s.appendTramos({ at: 222000, self: 'Campeon', modelo: MODELO_MEDICION,
    takenByStance: QUIETO });
  s.cache.clear();
  const c = s.get(conMotivo.uid);
  ok(c.rows[0].takenByStance?.length === 1 && c.modelo === MODELO_MEDICION,
    'volver a pasar la migración corrige en vez de duplicar');
}

// ── Ningún fichero del almacén se queda fuera de la reconstrucción ────
//
// EL FALLO QUE ESTO IMPIDE ES EL DE AÑADIR UN FICHERO Y OLVIDARSE. `tramos.ndjson`
// se creó sin meterlo en la lista de `rebuild.js`, y entonces sobrevivía a la
// reconstrucción estampando lo suyo sobre peleas que ya no eran las mismas: la
// de las 11:43 se reconstruye entera y correcta, y le caía encima el motivo de
// la versión partida. Comprobado sobre el almacén real antes de arreglarlo.
//
// Se comprueba por ENUMERACIÓN y no a mano: cualquier fichero que el almacén
// aprenda a escribir mañana tiene que aparecer en una de las dos listas, y
// elegir cuál es una decisión que hay que tomar a conciencia.
console.log('\nningún fichero del almacén se queda fuera de la reconstrucción');
{
  const s = new FightStore(tmp(), 'Campeon');
  const ficheros = Object.keys(s)
    .filter((k) => k.endsWith('Path'))
    .map((k) => path.basename(s[k]));

  /**
   * Los que a propósito NO se apartan, con el motivo. Sobrevivir es su trabajo.
   *   store.json  la marca de generación. La reconstrucción la reescribe al
   *               terminar, así que apartarla sólo perdería el rastro si falla.
   */
  const SOBREVIVEN = new Set(['store.json']);

  const fuente = fs.readFileSync(new URL('../src/rebuild.js', import.meta.url), 'utf8');
  const lista = fuente.match(/const FICHEROS = \[([\s\S]*?)\]/)?.[1] ?? '';
  const enLista = new Set([...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]));

  ok(ficheros.length >= 6, 'el almacén escribe varios ficheros', ficheros.join(' '));
  const huerfanos = ficheros.filter((f) => !enLista.has(f) && !SOBREVIVEN.has(f));
  ok(huerfanos.length === 0,
    'todos están o en FICHEROS o en la lista de los que sobreviven a propósito',
    huerfanos.length ? `fuera de las dos: ${huerfanos.join(', ')}` : '');
  ok(enLista.has('tramos.ndjson'),
    'y en concreto el reparto por postura se aparta al reconstruir');
}

// ── Que las cifras de la tabla siguen siendo las de la tabla ──────────
console.log('\nlas mitigaciones que sostienen todo esto');
{
  ok(STANCES.defensive.mit.melee === 0.50 && STANCES.defensive.mit.spell === 0.20,
    'Defensive 0,50 melé / 0,20 mágico');
  ok(STANCES['mage hunter'].mit.melee === 0.20 && STANCES['mage hunter'].mit.spell === 0.50,
    'Mage Hunter 0,20 melé / 0,50 mágico');
  ok(STANCES.channeler.mit.melee === 0.40 && STANCES.channeler.mit.spell === 0.40,
    'Channeler 0,40 / 0,40');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
