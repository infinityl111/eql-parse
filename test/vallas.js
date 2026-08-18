/**
 * LOS BLOQUES ``` DE LAS NOTAS, Y EL ORDEN EN QUE SE SACAN.
 *
 * ── EL FALLO ──────────────────────────────────────────────────────────────
 *
 * `md()` no sabía que las vallas existían. Cuatro versiones publicadas traen
 * volcados del medidor entre ``` —1.6.2 y 1.1.0 con cuatro bloques, 1.6.0 y
 * 1.3.0 con dos— y salían por el camino del párrafo normal. Dos destrozos a la
 * vez, y ninguno visible desde la consola de quien construye:
 *
 *   · `junta.join(' ')` pegaba el volcado entero en un renglón. Una tabla de
 *     DPS de cinco líneas salía como una frase corrida, sin columnas;
 *   · la regex del código en línea emparejaba el SEGUNDO acento con el TERCERO
 *     y dejaba los otros dos a la vista: ``<code>…</code>``.
 *
 * ── LA REGLA, QUE ES UNA RESTRICCIÓN DE ORDEN ─────────────────────────────
 *
 *     LOS BLOQUES SE EXTRAEN ANTES DE CUALQUIER OTRA TRANSFORMACIÓN.
 *
 * Es el mismo fallo de orden que el filtro de prelanzamientos contra la guarda
 * de saturación, y van dos en dos días. Por eso el orden LLEVA SU ASERCIÓN y no
 * un comentario: se mete dentro del bloque, a propósito, todo lo que `md()`
 * sabe transformar —acentos, asteriscos, corchetes, una imagen, un enlace— y se
 * exige que salga LITERAL. Si algún día alguien mueve la extracción detrás de
 * las regex, eso se convierte en <code>, <strong> y <a>, y esta prueba se cae.
 *
 * Lo demás que se comprueba, de los cuatro puntos del encargo: la etiqueta de
 * lenguaje se ignora y no se imprime, los saltos de línea se conservan uno a
 * uno, y una valla sin cerrar PARA nombrando la versión.
 */
import { md } from '../web/build.mjs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const VOLCADO = [
  ' Lord Nagafen 6m49s - 141.0k (345dps)',
  ' Campeon +pet   79184 (194dps 56%)',
  ' Kalforgelp     42230 (103dps 30%)',
  ' Jarektik       10609 (26dps 8%)',
].join('\n');

// ── 1. Un bloque da exactamente un <pre>, y nada se escapa ─────────────────
console.log('\nun bloque sale como un <pre> y no como un párrafo');
{
  const html = md(`Antes.\n\n\`\`\`\n${VOLCADO}\n\`\`\`\n\nDespués.`, 'v1.6.2 (es)');
  ok((html.match(/<pre>/g) ?? []).length === 1, 'exactamente un <pre>',
    (html.match(/<pre>/g) ?? []).length);
  ok(html.includes('<pre><code>'), 'y va envuelto en <pre><code>');
  ok(!html.includes('`'), 'CERO acentos graves a la vista en toda la salida',
    (html.match(/`/g) ?? []).length + ' acentos');
  ok(html.includes('<p>Antes.</p>') && html.includes('<p>Después.</p>'),
    'y el texto de alrededor sigue siendo texto normal');
}

// ── 2. Los saltos de línea se conservan uno a uno ──────────────────────────
console.log('\ndentro del bloque los saltos se conservan');
{
  const html = md(`\`\`\`\n${VOLCADO}\n\`\`\``, 'v1.6.2 (es)');
  const dentro = /<pre><code>([\s\S]*?)<\/code><\/pre>/.exec(html)?.[1] ?? '';
  const original = VOLCADO.split('\n').length;
  ok(dentro.split('\n').length === original,
    'el mismo número de líneas dentro que en el original', `${dentro.split('\n').length} de ${original}`);
  ok(dentro.includes('Campeon +pet   79184'),
    'y con su alineación: los espacios interiores no se tocan');
  ok(!/<p>/.test(dentro) && !/ Lord Nagafen 6m49s - 141\.0k \(345dps\)  Campeon/.test(dentro),
    'no se ha pegado todo en un renglón');
}

/**
 * ── 3. LA ASERCIÓN DEL ORDEN ──────────────────────────────────────────────
 *
 * Todo lo que `md()` sabe transformar, metido dentro de un bloque. Si la
 * extracción se hace ANTES, sale literal. Si alguien la mueve detrás de las
 * regex, cada una de estas líneas se convierte y la prueba se cae por cuatro
 * sitios a la vez.
 */
console.log('\nlos bloques se extraen ANTES que las demás transformaciones');
{
  const trampa = [
    'esto es `código en línea` y no debería serlo',
    'esto es **negrita** y no debería serlo',
    'esto es [un enlace](https://ejemplo.com) y no debería serlo',
    'esto es ![una imagen](https://ejemplo.com/x.png) y no debería serlo',
    '- esto parece un punto de lista',
    '# esto parece un titular',
  ].join('\n');
  const html = md(`\`\`\`\n${trampa}\n\`\`\``, 'trampa');
  const dentro = /<pre><code>([\s\S]*?)<\/code><\/pre>/.exec(html)?.[1] ?? '';

  ok(!/<code>/.test(dentro), 'el código en línea NO se convierte dentro del bloque');
  ok(!/<strong>/.test(dentro), 'la negrita tampoco');
  ok(!/<a /.test(dentro), 'los enlaces tampoco');
  ok(!/<img /.test(dentro), 'las imágenes tampoco');
  ok(!/<ul>|<li>/.test(dentro), 'ni el guion se vuelve una lista');
  ok(!/<h3>/.test(dentro), 'ni la almohadilla un titular');
  ok(dentro.includes('&lt;') === false && dentro.split('\n').length === 6,
    'y las seis líneas siguen siendo seis', dentro.split('\n').length);
  /**
   * Y EL CONTROL, sin el cual lo de arriba no demuestra nada: las mismas seis
   * líneas FUERA del bloque sí se transforman. Si `md()` hubiera dejado de
   * saber convertir negrita y enlaces, los seis `ok` anteriores pasarían verdes
   * sin que la extracción estuviera haciendo su trabajo.
   */
  const fuera = md(trampa, 'control');
  ok(/<code>/.test(fuera) && /<strong>/.test(fuera) && /<a /.test(fuera)
    && /<img /.test(fuera) && /<li>/.test(fuera) && /<h3>/.test(fuera),
    'CONTROL: esas mismas líneas fuera del bloque SÍ se convierten, las seis');

  // Lo único que SÍ pasa dentro es esc(), que es lo que evita inyectar HTML.
  const conHtml = md('```\n<script>alert(1)</script>\n```', 'x');
  ok(conHtml.includes('&lt;script&gt;') && !conHtml.includes('<script>'),
    'lo único que se aplica dentro es esc(), que sigue escapando el HTML');
}

// ── 4. La etiqueta de lenguaje se ignora y no se imprime ───────────────────
console.log('\nla etiqueta de lenguaje de la valla no se imprime');
{
  const html = md('```js\nconst x = 1;\n```', 'x');
  const dentro = /<pre><code>([\s\S]*?)<\/code><\/pre>/.exec(html)?.[1] ?? '';
  ok(dentro === 'const x = 1;', 'sólo queda el contenido', JSON.stringify(dentro));
  ok(!html.includes('js'), 'la etiqueta «js» no aparece en ningún sitio de la salida');
  // Y sin etiqueta se comporta igual.
  ok(/<pre><code>const x = 1;<\/code><\/pre>/.test(md('```\nconst x = 1;\n```', 'x')),
    'y sin etiqueta, lo mismo');
}

// ── 5. Una valla sin cerrar PARA, y nombra la versión ──────────────────────
console.log('\nuna valla sin cerrar para la construcción');
{
  let msg = null;
  try { md('Texto.\n\n```\nvolcado sin cerrar\ny más cosas', 'v9.9.9 (de)'); } catch (e) { msg = e.message; }
  ok(msg !== null, 'una valla abierta y sin cerrar lanza');
  ok(!!msg && msg.includes('v9.9.9 (de)'), 'y nombra la versión y el idioma', msg?.slice(0, 40));
  ok(!!msg && /línea 3/.test(msg), 'y dice en qué línea se abrió', msg?.match(/línea \d+/)?.[0]);

  // Un número PAR de vallas no es «sin cerrar»: dos bloques seguidos valen.
  const dos = md('```\nuno\n```\n\ntexto\n\n```\ndos\n```', 'x');
  ok((dos.match(/<pre>/g) ?? []).length === 2, 'dos bloques seguidos dan dos <pre>',
    (dos.match(/<pre>/g) ?? []).length);
}

// ── 6. Y lo de siempre sigue funcionando ───────────────────────────────────
console.log('\nlo que no lleva vallas no cambia');
{
  const html = md('Una **negrita** y un `código` y un [enlace](https://x.y).\nSegunda línea del mismo párrafo.\n\n- punto uno\n- punto dos', 'x');
  ok(html.includes('<strong>negrita</strong>'), 'la negrita sigue');
  ok(html.includes('<code>código</code>'), 'el código en línea sigue');
  ok(html.includes('<a href="https://x.y">enlace</a>'), 'los enlaces siguen');
  ok(html.includes('<ul>') && (html.match(/<li>/g) ?? []).length === 2, 'las listas siguen');
  ok(!html.includes('<pre>'), 'y no aparece ningún <pre> donde no hay vallas');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
