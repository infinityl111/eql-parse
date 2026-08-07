/**
 * Las dos clases que se pisaban siguen separadas.
 *
 * EL FALLO. `.serie` significaba dos cosas en el mismo fichero de estilos: el
 * bloque de un tramo en la ficha de un hechizo —título más barras— y la
 * minigráfica SVG de la página de progresión. Trescientas líneas por debajo
 * de la primera, la segunda declaraba `height: 34px` fijo. Misma
 * especificidad y va después, así que ganaba: los seis tramos de la ficha
 * quedaban clavados a 34 píxeles de alto, uno encima de otro, y las barras
 * desbordaban por fuera. El cálculo estaba perfecto —2.151 usos, seis
 * dificultades con sus medias distintas—; lo roto era el nombre de la clase.
 *
 * POR QUÉ AQUÍ NO HAY UNA COMPROBACIÓN GENERAL, que es lo que se intentó
 * primero y no salió. La idea era señalar cualquier clase declarada en dos
 * reglas donde alguna fijase geometría. Probada en los dos sentidos:
 *
 *   - Exigiendo que las dos reglas se peleen por la MISMA propiedad, el fallo
 *     original pasa limpio. Las dos `.serie` no disputaban ninguna: una ponía
 *     `margin-top` y la otra `height`.
 *
 *   - Sin exigirlo, saltan siete casos de este fichero y ninguno es un fallo.
 *     El más claro es `.cat-head, .cat-row { display: grid; … }` seguido de
 *     `.cat-head { border-bottom; … }`: una base compartida y su refinamiento,
 *     que es CSS normal y bien escrito.
 *
 * Y las dos formas son IDÉNTICAS mirando sólo el texto: una regla con
 * geometría y otra sin ella, con el mismo nombre. Lo que las separa es si las
 * dos reglas hablan del mismo componente, y eso no está escrito en ninguna
 * parte del fichero. Un chequeo estático aquí o no caza el fallo o entierra
 * el que importe entre seis que no. Queda como límite documentado.
 *
 * LO QUE SÍ SE HIZO, que es mirarlo. Con la aplicación abierta y el DOM
 * medido, no razonando sobre el CSS: la ficha de Drain Spirit da seis tramos
 * de 60 píxeles cada uno y cero solapes, y la página de progresión cuatro
 * minigráficas de 240×34 y cero solapes. Está en `npm run ui:check`, que
 * levanta la aplicación de verdad. No entra en `npm test` porque necesita
 * pantalla y un histórico con datos.
 *
 * Esto de abajo es el cierre del fallo concreto: que nadie vuelva a juntar
 * los dos nombres sin enterarse.
 */
import fs from 'node:fs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const css = fs.readFileSync(new URL('../ui/styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');

console.log('\nlos dos nombres que se pisaban');

ok(/class="tramo"/.test(app), 'el bloque de un tramo se llama `tramo`');
ok(/\.tramo\s*\{/.test(css), 'y tiene su propia regla');
ok(!/class="serie"[^>]*>\s*<div class="serie-h"/.test(app),
  'la ficha del hechizo ya no usa `serie` para su bloque');

ok(/<svg class="serie"/.test(app), 'la minigráfica de progresión sigue siendo `serie`');
ok(/\.encrow\.serie-row \.serie\s*\{/.test(css),
  'con su regla acotada al contenedor: así no puede imponerle el tamaño a nadie más');
ok(!/^\.serie\s*\{[^}]*height/m.test(css),
  'y no hay ninguna `.serie` suelta que fije alto');

// La cabecera de un tramo, que se renombró con él.
ok(/class="tramo-h"/.test(app) && /\.tramo-h\s*\{/.test(css),
  'la cabecera del tramo también, que si no se queda sin estilo');

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
