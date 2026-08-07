/**
 * Quién es un jefe, y de dónde se sabe.
 *
 * El reparto acordado, y el orden es lo que se comprueba aquí: la wiki declara,
 * la heurística deduce y tú corriges. Lo tuyo manda sobre las dos; la wiki
 * manda sobre lo deducido; y mientras la wiki no ha contestado, lo que hay es
 * una suposición y va rotulada como tal.
 *
 * POR QUÉ NO SE USA «Named_Mobs»
 *
 * Era la categoría que sonaba bien y no sirve. Medido sobre los 119 enemigos de
 * un registro real, 96 la llevan —el 81%—, entre ellos `a desert tarantula` con
 * 175 de vida y `a vampire bat` con 1.723. En esa wiki significa «tiene
 * página». La que discrimina es «Raid_Encounters»: 14 enemigos, vida mediana
 * 32.005 frente a 7.769 de los demás.
 *
 * LOS DOS CASOS QUE FALLABAN
 *
 * Eran la señal de que la heurística sola no bastaba, y son la prueba de que la
 * wiki la arregla:
 *
 *   a spite golem       artículo y 49.452 de vida. La heurística dice que no es
 *                       jefe por el artículo. La wiki tampoco lo marca raid, así
 *                       que aquí las dos coinciden — y la que manda es la wiki.
 *   the Spiroc Lord     artículo y 32.212. La heurística lo descarta por el
 *                       artículo y la wiki SÍ lo marca raid. Éste es el que
 *                       demuestra que hacía falta.
 */
import { clasificaJefe, jefesDe } from '../src/raid.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const wikiDice = (m) => new Map(Object.entries(m).map(([k, v]) => [k, { found: true, raid: v }]));

// ── 1. El orden de las tres fuentes ────────────────────────────────────────
console.log('\nel orden: tú, luego la wiki, luego la deducción');
{
  const wiki = wikiDice({ 'Lord Nagafen': true, 'a spite golem': false });
  const manual = new Map([['a spite golem', true], ['Lord Nagafen', false]]);

  ok(clasificaJefe('Lord Nagafen', { wiki, vida: 86695 }).src === 'wiki',
    'con respuesta de la wiki, la fuente es la wiki');
  ok(clasificaJefe('Lord Nagafen', { wiki, manual, vida: 86695 }).raid === false,
    'y si tú dices que no, gana lo tuyo aunque la wiki diga que sí');
  ok(clasificaJefe('Lord Nagafen', { wiki, manual, vida: 86695 }).src === 'manual',
    'y se dice que la fuente eres tú');
  ok(clasificaJefe('a spite golem', { wiki, manual, vida: 49452 }).raid === true,
    'al revés igual: tú lo marcas y la wiki decía que no');
  ok(clasificaJefe('Zzz', { vida: 100 }).src === 'deducido',
    'sin wiki ni marca tuya, la fuente es la deducción');
}

// ── 2. Los dos casos conocidos, con la wiki delante ────────────────────────
console.log('\nlos casos que fallaban');
{
  // Lo que responde la wiki de verdad, comprobado contra su API.
  const wiki = wikiDice({
    'Lord Nagafen': true, 'Lady Vox': true, 'Master Yael': true,
    'the Spiroc Lord': true, 'Eye of Veeshan': true,
    'a spite golem': false, 'Amygdalan warrior': false, 'a boogeyman': false,
    'a scareling': false, 'King Tranix': false,
  });

  // `the Spiroc Lord` es el caso que justifica la wiki: la heurística lo
  // descarta por el artículo y es un jefe de raid.
  ok(clasificaJefe('the Spiroc Lord', { vida: 32212 }).raid === false,
    'sin wiki, «the Spiroc Lord» se escapa por el artículo');
  ok(clasificaJefe('the Spiroc Lord', { wiki, vida: 32212 }).raid === true,
    'CON wiki, sale jefe — es lo que la deducción no puede hacer');

  // `a spite golem`: 49.452 de vida y aun así no es raid. Sin la wiki nadie lo
  // sabría; la vida sugiere que sí y la vida se equivoca.
  ok(clasificaJefe('a spite golem', { wiki, vida: 49452 }).raid === false,
    '«a spite golem» tiene 49.452 de vida y NO es raid: lo dice la wiki');

  // `Amygdalan warrior`: la deducción lo marcaba y llegué a decir que era un
  // falso positivo. Era yo el equivocado — pero raid tampoco es.
  ok(clasificaJefe('Amygdalan warrior', { vida: 10309 }).raid === false,
    '«Amygdalan warrior» no llega al umbral de vida, así que ni deducido');
  ok(clasificaJefe('Amygdalan warrior', { wiki, vida: 10309 }).raid === false,
    'y la wiki confirma que no es raid');

  ok(clasificaJefe('a boogeyman', { wiki, vida: 8412 }).raid === false, '«a boogeyman» tampoco');
  ok(clasificaJefe('a scareling', { wiki, vida: 12177 }).raid === false, '«a scareling» tampoco');
}

// ── 3. Mientras la wiki no contesta ────────────────────────────────────────
//
// Sin red, o la primera vez, hay que decir algo. Se deduce y se rotula.
console.log('\nsin respuesta de la wiki se deduce, y se dice');
{
  ok(clasificaJefe('Lord Nagafen', { vida: 86695 }).raid === true,
    'sin artículo y con mucha vida, se supone jefe');
  ok(clasificaJefe('Lord Nagafen', { vida: 86695 }).src === 'deducido',
    'pero la fuente es la deducción, no la wiki');
  ok(clasificaJefe('a fire giant warrior', { vida: 11497 }).raid === false,
    'con artículo, no');
  // Una wiki que ha contestado «no tiene página» ES una respuesta.
  const sinPagina = new Map([['a decrepit warder', { found: true, raid: false, named: false, title: null }]]);
  const r = clasificaJefe('a decrepit warder', { wiki: sinPagina, vida: 20596 });
  ok(r.raid === false && r.src === 'wiki',
    'no tener página es una respuesta: no es jefe, y consta que lo dice la wiki');
}

// ── 4. Una mascota nunca ────────────────────────────────────────────────────
console.log('\nlas mascotas quedan fuera');
{
  const wiki = wikiDice({ 'Lord Nagafen pet': true });
  ok(clasificaJefe('Lord Nagafen pet', { wiki, vida: 99999 }).raid === false,
    'ni con la wiki diciendo que sí');
}

// ── 5. El conjunto que usa el texto del chat ───────────────────────────────
console.log('\nel conjunto para la línea del chat');
{
  const rows = [
    { name: 'Lord Nagafen', side: 'enemy', taken: 86695 },
    { name: 'a fire giant warrior', side: 'enemy', taken: 11497 },
    { name: 'the Spiroc Lord', side: 'enemy', taken: 32212 },
    { name: 'Campeon', side: 'ally', damage: 500 },
  ];
  const wiki = wikiDice({ 'Lord Nagafen': true, 'the Spiroc Lord': true, 'a fire giant warrior': false });
  const jefes = jefesDe(rows, { wiki });
  ok(jefes.size === 2, 'salen los dos jefes', [...jefes].join(', '));
  ok(jefes.has('the Spiroc Lord'), 'incluido el que la deducción se dejaba');
  ok(!jefes.has('Campeon'), 'y nadie de tu bando');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
