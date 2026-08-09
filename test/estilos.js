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

/**
 * NI `prompt()` NI `alert()` EN SITIOS NUEVOS.
 *
 * `window.prompt` NO EXISTE EN ELECTRON: lanza «prompt() is and will not be
 * supported» y se lleva por delante el manejador entero. Comprobado contra el
 * Electron de este proyecto (31.7.7): `prompt` lanza; `alert` y `confirm` sí
 * funcionan, con un cuadro nativo que desentona pero responde.
 *
 * Y NO ES UNA REGRESIÓN DE NINGUNA SUBIDA: el `prompt` de la tabla de tríos
 * entró en `d47f212` (1.1.0) con `electron: ^31.0.0`, la misma que hoy. Nunca
 * funcionó en la aplicación empaquetada. Por eso está aquí y no en las notas:
 * un fallo que nadie ve porque nadie usa el camino roto sobrevive años.
 *
 * ESTA PRUEBA NO PROHÍBE LOS QUE HAY, LOS CONGELA. Sustituir la interfaz de
 * tríos por un diálogo propio va en la 1.12.0, no en la 1.11.0: no es una
 * regresión y no se toca la interfaz después de haber probado el instalador.
 * Hasta entonces, lo que esta prueba impide es que aparezca uno NUEVO — que es
 * como se llegó a nueve sin que nadie lo notara.
 *
 * Cuando la 1.12.0 los quite, estos dos números bajan a cero y la prueba pasa a
 * ser una prohibición a secas.
 */
{
  const CONGELADOS = { prompt: 4, alert: 5, confirm: 0 };
  const fuentes = ['app.js', 'overlay.js', 'triggers.js', 'plates.js', 'grafica.js',
    'reproduccion.js', 'alerts.js', 'clip.js', 'fallo.js', 'rotulo.js']
    .map((f) => [f, fs.readFileSync(new URL(`../ui/${f}`, import.meta.url), 'utf8')]);

  for (const cual of Object.keys(CONGELADOS)) {
    // Sin punto delante, para no cazar `foo.alert(...)`, y sin `//` para no
    // contar los que sólo se nombran en un comentario.
    const re = new RegExp('(^|[^.A-Za-z0-9_])' + cual + '\\s*\\(');
    const encontrados = [];
    for (const [nombre, texto] of fuentes) {
      texto.split(String.fromCharCode(10)).forEach((linea, n) => {
        if (linea.trim().startsWith('*') || linea.trim().startsWith('//')) return;
        if (re.test(linea)) encontrados.push(`${nombre}:${n + 1}`);
      });
    }
    ok(encontrados.length === CONGELADOS[cual],
      `${cual}() sigue en ${CONGELADOS[cual]} sitios y ni uno más`,
      encontrados.length ? encontrados.join(' ') : 'ninguno');
    // Y los que quedan viven TODOS en la tabla de tríos. Uno que aparezca en
    // otra pantalla cambia la cuenta, pero si alguien mueve uno de sitio la
    // cuenta no se entera: esto sí.
    const fuera = encontrados.filter((sitio) => {
      const [f, n] = sitio.split(':');
      const linea = fuentes.find(([x]) => x === f)[1].split(String.fromCharCode(10))[Number(n) - 1];
      return !linea.includes('trio.');
    });
    ok(fuera.length === 0, `y los ${cual}() que quedan son todos de la tabla de tríos`,
      fuera.length ? `fuera: ${fuera.join(' ')}` : '');
  }
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
