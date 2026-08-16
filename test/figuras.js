/**
 * N FIGURAS POR NOMBRE, con el caso de Miguel dentro.
 *
 * LO QUE VE HOY, con sus palabras: «se ve morir a uno y se le sigue pegando al
 * cadáver». Había UNA figura por nombre, así que la primera muerte la apagaba y
 * el segundo bicho igual seguía pegando desde un dibujo gris. Medido sobre el
 * histórico: pasa en 394 peleas de 1.474 —una de cada cuatro— y son 2.306
 * figuras que faltan por dibujar.
 *
 * EL CASO QUE ESTRENA ESTA BATERÍA es suyo y real: 5 de agosto, 00:56:15, The
 * Ruins of Old Guk, «a shin ghoul knight» ×4 en 88 segundos. Hoy es una figura
 * que se apaga en la primera muerte y a la que se le sigue pegando durante las
 * otras tres.
 */
import { muertesPorNombre, sueloDeNombre, suelosDe } from '../src/suelo.js';
import { Parser } from '../src/parser.js';
import { guion } from '../src/guion.js';
import { segundosDePelea } from '../src/reloj.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── El caso real ──────────────────────────────────────────────────────────
console.log('\nlos cuatro «a shin ghoul knight» del 5 de agosto');
{
  const kills = ['a shin ghoul knight', 'a shin ghoul knight',
    'a shin ghoul knight', 'a shin ghoul knight'];
  const m = muertesPorNombre(kills);
  ok(m.get('a shin ghoul knight') === 4, 'se cuentan las cuatro muertes', String(m.get('a shin ghoul knight')));

  // Sin actividad después de la cuarta: cuatro bichos, cuatro figuras.
  const sinDespues = suelosDe(kills, () => false);
  ok(sinDespues.get('a shin ghoul knight') === 4,
    'cuatro figuras, no una', String(sinDespues.get('a shin ghoul knight')));

  // Con líneas suyas después de la última muerte, el suelo sube: había un
  // quinto. Es el razonamiento de Miguel — un muerto no pega.
  const conDespues = suelosDe(kills, () => true);
  ok(conDespues.get('a shin ghoul knight') === 5,
    'y cinco si el nombre sigue dando señales después de la última',
    String(conDespues.get('a shin ghoul knight')));
}

// ── La regla que faltaba ──────────────────────────────────────────────────
console.log('\nuna figura no se apaga mientras haya líneas suyas después');
{
  // El caso mínimo: una muerte y actividad posterior. Con una sola figura, esa
  // actividad sale de un cadáver. Con dos, sale del que sigue vivo.
  ok(sueloDeNombre(1, true) === 2, 'una muerte y líneas después: eran dos');
  ok(sueloDeNombre(1, false) === 1, 'una muerte y silencio: era uno');
  ok(sueloDeNombre(0, false) === 1, 'sin muertes, el que está delante');
  ok(sueloDeNombre(3, true) === 4, 'tres muertes y líneas después: cuatro');
}

// ── La mayúscula, que ya nos costó 25 abatidos ────────────────────────────
console.log('\ny se cuenta igual con la mayúscula de abrir frase');
{
  // EQ escribe «A shin ghoul knight has been slain» al abrir frase y
  // «a shin ghoul knight» a mitad. Si el recuento no las junta, un nombre sale
  // con menos muertes de las que tuvo — que es exactamente lo que le pasó al
  // bestiario con `orc legionnaire`. Ver la deuda en `src/store.js`.
  const m = muertesPorNombre(['Orc legionnaire', 'orc legionnaire', 'Orc legionnaire']);
  ok(m.size === 1, 'las dos formas son el mismo nombre', `${m.size} entradas`);
  ok(m.get('orc legionnaire') === 3, 'y suman tres muertes', String(m.get('orc legionnaire')));
}

// ── El recuento es UNO, compartido con el título ──────────────────────────
console.log('\nel título y las figuras cuentan con la misma función');
{
  // No se comprueba que los dos números coincidan —eso lo garantiza compartir
  // el módulo— sino que el módulo existe y lo usan los dos. Si alguien vuelve
  // a contar a mano en `engine.js`, esto no lo caza; lo caza la revisión. Lo
  // que sí se fija aquí es la FORMA del rótulo, que es lo que se lee.
  const m = muertesPorNombre(['a gorgon', 'a gorgon', 'a spectre']);
  const rotulo = [...m].map(([n, x]) => (x > 1 ? `${n} ×${x}` : n)).join(', ');
  ok(rotulo === 'a gorgon ×2, a spectre', 'el rótulo dice «×2» donde hay dos', rotulo);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Y AHORA EL PREDICADO DE VERDAD, QUE ES LO QUE ESTA BATERÍA NO PROBABA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Todo lo de arriba le pasa a `suelosDe` un predicado CONSTANTE: `() => true`,
 * `() => false`. Con eso, ni la ESCALA de sus argumentos ni la definición de
 * «actividad» se ejercitan nunca — se sustituye justo la pieza que puede estar
 * rota, y la prueba pasa igual con el código bueno y con el malo.
 *
 * Es la familia de la prueba que no podía fallar. Y la cazó una medición sobre
 * el registro, no esta batería.
 *
 * Lo de aquí abajo ejerce el predicado con sus dos argumentos reales, y las tres
 * comprobaciones VAN DRILADAS EN ROJO contra el código anterior:
 *
 *   1. la escala   -> `suelosDe` lanza si le llegan epoch disfrazados de segundos
 *   2. las caídas  -> `guion` restaba `inicio` dos veces y todas salían en 0
 *   3. el sujeto   -> valía con que a uno lo NOMBRARAN, y a un cadáver lo nombran
 */

// ── 1. La escala: un epoch disfrazado de segundo de pelea ────────────────
console.log('\nun instante fuera de escala PARA, no se aplana');
{
  // 1.785.835.073 es una hora epoch. Como «segundo de pelea» sería una pelea de
  // once mil días. Antes esto no lanzaba: comparaba y devolvía `false` para
  // siempre, en silencio.
  let lanzo = false;
  try {
    suelosDe(['a gorgon'], () => true, new Map([['a gorgon', [1785835073]]]));
  } catch (e) { lanzo = e instanceof RangeError; }
  ok(lanzo, 'un epoch donde se esperan segundos de pelea lanza RangeError');

  // Y lo normal sigue pasando.
  let bien = true;
  try { suelosDe(['a gorgon'], () => true, new Map([['a gorgon', [47]]])); }
  catch { bien = false; }
  ok(bien, 'y 47 segundos de pelea no molestan a nadie');
}

/**
 * ── 1 bis. LA MISMA INVARIANTE, EN LOS TRECE SITIOS DE `encounter.js` ────
 *
 * `Math.max(0, Math.round(t - this.start))` es la expresión que apagó a todas
 * las figuras en el segundo cero. En `encounter.js` es correcta —los dos lados
 * son epoch— y por eso es exactamente donde hay que poner la guarda: el día que
 * alguien pase un `t` ya relativo no habrá error, habrá un cero.
 *
 * DRILADO: quitando el `throw` de `segundosDePelea`, las dos primeras se ponen
 * verdes con un cero y la prueba deja de decir nada.
 */
console.log('\nun instante en otra escala PARA, y un negativo pequeño se pinza');
{
  const AHORA = 1786358914;
  let lanzo = false;
  try { segundosDePelea(107, AHORA, 'prueba'); } catch (e) { lanzo = e instanceof RangeError; }
  ok(lanzo, 'un instante RELATIVO donde se espera epoch lanza RangeError');

  lanzo = false;
  try { segundosDePelea(AHORA + 47, 0, 'prueba'); } catch (e) { lanzo = e instanceof RangeError; }
  ok(lanzo, 'y un inicio en cero contra un epoch, también');

  // Lo que la pinza SÍ tiene que seguir haciendo: un tramo que empieza dos
  // segundos antes de la pelea es un caso del mundo, no un imposible.
  ok(segundosDePelea(AHORA - 2, AHORA, 'prueba') === 0, 'un negativo pequeño se pinza a 0');
  ok(segundosDePelea(AHORA + 47, AHORA, 'prueba') === 47, 'y lo normal pasa tal cual');
}

// ── 2. El predicado recibe SEGUNDOS DE PELEA, y se comprueba mirándolos ──
console.log('\nel predicado recibe la última muerte en segundos de pelea');
{
  const vistos = [];
  const suelos = suelosDe(
    ['a gorgon', 'a gorgon', 'a spectre'],
    (nombre, ultimaMuerteSeg) => { vistos.push([nombre, ultimaMuerteSeg]); return ultimaMuerteSeg === 30; },
    new Map([['a gorgon', [12, 30]], ['a spectre', [45]]]),
  );
  const gorgon = vistos.find(([n]) => n === 'a gorgon');
  ok(gorgon?.[1] === 30, 'le llega la ÚLTIMA de sus muertes, no la primera', String(gorgon?.[1]));
  ok(vistos.find(([n]) => n === 'a spectre')?.[1] === 45, 'y la suya a cada nombre');
  ok(suelos.get('a gorgon') === 3, 'dos muertes y actividad después: tres', String(suelos.get('a gorgon')));
  ok(suelos.get('a spectre') === 1, 'y el que no la tiene se queda en uno', String(suelos.get('a spectre')));
}

/**
 * ── 3. El caso real, entero, por el guion ────────────────────────────────
 *
 * Una pelea de 60 s con dos «a gorgon»: la primera cae en el segundo 20 y la
 * segunda sigue pegando hasta el 40. La escena tiene que decir DOS figuras y
 * UNA caída EN EL SEGUNDO 20.
 *
 * DRILADO: con el `- inicio` de más, `caidas` salía `[0]`; con la regla laxa,
 * el cuarto caso de abajo también daba dos figuras y no debe.
 */
console.log('\nla pelea entera: dos gorgonas, una cae en el segundo 20');
const INICIO = Math.round(new Date(2026, 7, 5, 12, 0, 0).getTime() / 1000);
const L = (s, texto) => ({ t: INICIO + s, texto });
const PELEA = (killTimes, kills) => ({
  start: INICIO, duration: 60, kills, killTimes,
  rows: [{ name: 'Campeon', side: 'ally', damage: 500 }, { name: 'a gorgon', side: 'enemy', damage: 100 }],
});
{
  const g = guion(
    PELEA([{ name: 'a gorgon', t: 20 }], ['a gorgon']),
    [
      L(5, 'Campeon slashes a gorgon for 40 points of damage.'),
      L(20, 'A gorgon has been slain by Campeon!'),
      // La segunda sigue pegando: esto es actividad SUYA, es sujeto.
      L(40, 'A gorgon hits Campeon for 12 points of damage.'),
    ],
    Parser, 'Campeon');
  const gorgon = g.actores.find((a) => a.nombre === 'a gorgon');
  ok(gorgon?.figuras === 2, 'dos figuras: una cayó y otra seguía pegando', String(gorgon?.figuras));
  ok(gorgon?.suelo?.porActividad === true, 'y consta que la segunda se apoya en actividad');
  ok(JSON.stringify(gorgon?.caidas) === '[20]',
    'la caída va en el segundo 20, NO en el 0', JSON.stringify(gorgon?.caidas));
}

// ── 4. Que a un cadáver lo nombren no es actividad suya ──────────────────
console.log('\nque a un cadáver lo NOMBREN no lo resucita');
{
  const g = guion(
    PELEA([{ name: 'a gorgon', t: 20 }], ['a gorgon']),
    [
      L(5, 'Campeon slashes a gorgon for 40 points of damage.'),
      L(20, 'A gorgon has been slain by Campeon!'),
      // Combate contra el cadáver: la gorgona es OBJETO, no sujeto.
      L(30, 'Campeon slashes a gorgon for 11 points of damage.'),
      L(35, 'Campeon tries to bash a gorgon, but misses!'),
      L(38, 'a gorgon has taken 5 damage from your Envenomed Breath.'),
    ],
    Parser, 'Campeon');
  const gorgon = g.actores.find((a) => a.nombre === 'a gorgon');
  ok(gorgon?.figuras === 1, 'sigue siendo UNA figura: nada de eso lo hizo ella', String(gorgon?.figuras));
  ok(gorgon?.suelo?.porActividad === false, 'y no se apoya en ninguna actividad');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
