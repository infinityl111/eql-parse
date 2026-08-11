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
import { spawnSync } from 'node:child_process';

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
 * YA NO CONGELA: PROHÍBE. La 1.12.0 se llevó los nueve —cuatro `prompt` y cinco
 * `alert`, todos de la tabla de tríos— a `ui/dialogo.js`, que pide los tres
 * datos a la vez y valida dentro. Los tres contadores están en cero, así que
 * esto pasó de «que no aparezca uno nuevo» a «que no aparezca ninguno», que es
 * lo que su propio comentario decía que tocaba hacer al quitarlos.
 *
 * Y NO SE VUELVE A SUBIR NINGUNO «temporalmente»: `prompt` no se abre en
 * Electron, así que un camino que lo llame no está a medias, está muerto, y no
 * se nota — quien lo pulsa supone que no sabe usarlo. Año y medio duró el
 * anterior.
 */
{
  const PROHIBIDOS = { prompt: 0, alert: 0, confirm: 0 };
  // La lista se saca de la carpeta y no se escribe a mano: `dialogo.js` es de
  // esta misma tanda, y una enumeración a mano habría dejado fuera justo al
  // fichero nuevo — que es donde más falta hace mirar.
  const fuentes = fs.readdirSync(new URL('../ui/', import.meta.url))
    .filter((f) => f.endsWith('.js')).sort()
    .map((f) => [f, fs.readFileSync(new URL(`../ui/${f}`, import.meta.url), 'utf8')]);

  for (const cual of Object.keys(PROHIBIDOS)) {
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
    ok(encontrados.length === PROHIBIDOS[cual],
      `${cual}() no se usa en ninguna parte de la interfaz`,
      encontrados.length ? encontrados.join(' ') : 'ninguno');
  }
}

/**
 * QUE CADA MÓDULO DE LA INTERFAZ SE PUEDA LEER. Nada más, y hacía falta.
 *
 * EL FALLO que la trajo: un comentario HTML dentro de una plantilla de texto,
 * con una clave entre comillas invertidas. Las comillas cerraban la plantilla
 * en medio, y `ui/reproduccion.js` dejaba de compilar entero. La aplicación no
 * arranca a medias con eso: `app.js` lo importa, así que la ventana se queda en
 * blanco — y NINGUNA prueba se enteraba, porque ninguna importa la interfaz.
 * Las 34 pruebas seguían en verde con la aplicación rota.
 *
 * Es la comprobación más barata que existe —¿esto es JavaScript?— y cubre la
 * clase entera de fallo, no el caso. `ui:check` la habría cazado también, pero
 * necesita pantalla y un histórico, así que no está en `npm test`; ésta sí.
 */
console.log('\ncada módulo de la interfaz compila');
{
  const dir = new URL('../ui/', import.meta.url);
  const modulos = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  ok(modulos.length > 0, 'hay módulos que comprobar', modulos.length);
  for (const m of modulos) {
    const ruta = new URL(m, dir);
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'],
      { input: fs.readFileSync(ruta, 'utf8'), encoding: 'utf8' });
    const err = (r.stderr ?? '').split(String.fromCharCode(10))
      .find((l) => l.includes('Error')) ?? '';
    ok(r.status === 0, `ui/${m}`, r.status === 0 ? '' : err.trim());
  }
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
