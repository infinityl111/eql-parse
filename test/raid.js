/**
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO, NO UN OBSERVABLE.
 *
 * Lo que la mayoría de las pruebas fijan es un observable: una línea del
 * registro entra y sale un número. Si el número cambia, algo se rompió, y la
 * prueba protege. Ésta no: fija QUÉ DECIDIMOS QUE SIGNIFICA lo que se observa.
 *
 * Una prueba así NO PROTEGE, DEFIENDE LA CREENCIA. Sólo suena cuando alguien
 * corrige la interpretación —que es cuando NO tiene que sonar— y se queda
 * callada mientras la creencia siga siendo la misma aunque sea falsa. El
 * 19/08/2026 tres sitios afirmaban que el dígito de «The Ruins of Old Guk 2»
 * era parte del nombre: los tres estaban en verde, y sonaron al arreglarlo.
 *
 * Al ponerse roja, LÉELA ANTES DE TOCARLA. Puede que lo que haya cambiado sea
 * la creencia, y entonces lo que hay que actualizar es la prueba.
 *
 * Se marca al escribir la prueba, no en un barrido: si el barrido cuesta más
 * que el fallo que evita, no es una regla.
 */
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
import { clasificaJefe, jefesDe, controlWiki, CANARIOS } from '../src/raid.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/**
 * Una respuesta de la wiki lleva SIEMPRE título: es lo que prueba que resolvió
 * a una página de verdad. Sin él no es una respuesta, es un fallo de búsqueda,
 * y desde el 19/08/2026 `clasificaJefe` lo trata como silencio. La fixture lo
 * refleja para que el test mida la regla y no la ausencia de un campo.
 */
const wikiDice = (m) => new Map(Object.entries(m)
  .map(([k, v]) => [k, { found: true, raid: v, title: k }]));

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
  /**
   * ESTA ASERCIÓN DECÍA LO CONTRARIO, Y FIJABA UNA CREENCIA NUESTRA.
   *
   * Ponía: «no tener página ES una respuesta: no es jefe, y consta que lo dice
   * la wiki». No lo es. `title: null` significa que la wiki no tiene página CON
   * ESE NOMBRE, que es distinto de que el enemigo no sea un jefe: la página de
   * `Innoruuk, the Prince of Hate` se llama «Innoruuk», y por esa lectura se
   * cayó del censo con 43.265 de vida. Auditadas las 19 respuestas guardadas,
   * tres eran fallos de búsqueda leídos como negativas.
   *
   * La aserción no protegía nada: defendía la creencia, y sólo sonó cuando se
   * arregló. Ahora fija lo contrario, que es lo medible.
   */
  const sinPagina = new Map([['a decrepit warder', { found: true, raid: false, named: false, title: null }]]);
  const r = clasificaJefe('a decrepit warder', { wiki: sinPagina, vida: 20596 });
  ok(r.src === 'deducido',
    'no tener página NO es una respuesta: es silencio, y el silencio se deduce', r.src);
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

/**
 * ── UNA CONSULTA QUE FALLA NO PUEDE PRODUCIR UNA RESPUESTA NEGATIVA ────────
 *
 * ESTA TANDA FIJA SIGNIFICADO, no un observable: dice qué CUENTA como que la
 * wiki haya contestado. Si mañana cambiamos de idea sobre eso, esta tanda se
 * pondrá roja y hay que releerla, no arreglarla a ciegas.
 *
 * El fallo: el caché guardaba `found: true` con `title: null` para cualquier
 * error de la API, y `clasificaJefe` lo leía como un «no es jefe» rotundo.
 * Auditadas las 19 respuestas guardadas el 19/08/2026, TRES eran así o peores
 * —Innoruuk con 43.265 de vida, `a fire giant warrior`, y Cazic-Thule
 * resolviendo al artículo de lore—. Innoruuk se cayó del censo por eso.
 *
 * Son TRES ESTADOS: sí, no, y no lo sé. El tercero no se degrada nunca al
 * segundo.
 */
console.log('\nun título vacío no es una respuesta: se deduce');
{
  const conTitulo = new Map([['X', { found: true, raid: false, title: 'X' }]]);
  const sinTitulo = new Map([['X', { found: true, raid: false, title: null }]]);
  const noHallado = new Map([['X', { found: false }]]);

  ok(clasificaJefe('X', { wiki: conTitulo, vida: 99999 }).src === 'wiki',
    'con página de verdad, manda la wiki');
  ok(clasificaJefe('X', { wiki: conTitulo, vida: 99999 }).raid === false,
    'y su «no» se respeta aunque la vida diga otra cosa');

  const roto = clasificaJefe('X', { wiki: sinTitulo, vida: 99999 });
  ok(roto.src === 'deducido', 'con title:null NO manda la wiki: se deduce', roto.src);
  ok(roto.raid === true, 'y la deducción contesta que sí, que es lo que la vida dice');

  ok(clasificaJefe('X', { wiki: noHallado, vida: 99999 }).src === 'deducido',
    'y sin found tampoco manda');

  /**
   * EL CONTROL POSITIVO DE LA TANDA: sin esto, todo lo de arriba pasa con un
   * `clasificaJefe` que ignorase la wiki SIEMPRE. Hay que exigir que cuando la
   * respuesta es buena, la wiki SÍ mande y SÍ pueda decir que sí.
   */
  const bueno = new Map([['X', { found: true, raid: true, title: 'X' }]]);
  const r = clasificaJefe('X', { wiki: bueno, vida: 0 });
  ok(r.src === 'wiki' && r.raid === true,
    'CONTROL: con respuesta buena la wiki manda Y puede decir que SÍ, con vida 0');
}

console.log('\nel control positivo de la fuente: antes de creerse un «no»');
{
  const canta = new Map(CANARIOS.map((n) => [n, { found: true, raid: true, title: n }]));
  const muda = new Map(CANARIOS.map((n) => [n, { found: true, raid: false, title: n }]));
  const vacia = new Map();
  const rota = new Map(CANARIOS.map((n) => [n, { found: true, raid: false, title: null }]));

  ok(CANARIOS.length >= 1, 'hay al menos un canario declarado', CANARIOS.join(', '));
  ok(controlWiki(canta).ok === true, 'si los canarios salen en Raid_Encounters, la fuente vale');
  ok(controlWiki(muda).ok === false,
    'si NO salen, la fuente no distingue y sus negativas son ruido', controlWiki(muda).motivo);
  ok(controlWiki(vacia).ok === false, 'sin respuestas todavía, no se puede dar por buena');
  ok(controlWiki(rota).ok === false, 'y un canario con title:null tampoco cuenta como contestado');
  ok(controlWiki(null).ok === false, 'ni sin mapa');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
