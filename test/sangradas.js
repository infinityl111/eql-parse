/**
 * LAS CITAS «>» DE LAS NOTAS, Y EL ORDEN EN QUE SE SACAN.
 *
 * ── EL FALLO, MEDIDO ANTES DE ARREGLARLO ──────────────────────────────────
 *
 * `md()` no sabía que las citas existían, y NO eran dos líneas sueltas. Contado
 * sobre `web/dist`, lo publicado traía 606 LÍNEAS con el «>» a la vista:
 *
 *     por versión   1.2.2 210 · 1.6.0 80 · 1.5.0 70 · 1.6.1 40 · 1.4.0 40
 *                   1.2.1 40 · 1.1.0 40 · 1.6.2 30 · 1.3.1 20 · 1.3.0 20
 *                   1.16.1 11 · 1.15.0 5          (doce versiones de cuarenta)
 *     por idioma    es 121 · en 121 · de 122 · fr 121 · pt 121
 *
 * Y lo que salía con la marca cruda por delante es justo el aviso de si la
 * versión pide reconstruir el histórico: la línea que más se lee de la nota.
 *
 * ── LA REGLA, QUE ES UNA RESTRICCIÓN DE ORDEN ─────────────────────────────
 *
 *     LAS CITAS SE EXTRAEN ANTES DE CUALQUIER OTRA TRANSFORMACIÓN.
 *
 * Es el MISMO fallo de orden que las vallas ```, que el filtro de
 * prelanzamientos y que la guarda de saturación. Una línea que empieza por «>»
 * no es un párrafo y no puede llegar a `junta.join(' ')`: si llega, `esc()`
 * convierte el «>» en `&gt;` y se queda impreso, y de paso las citas seguidas
 * se pegan todas en un renglón. Por eso el orden LLEVA SU ASERCIÓN aquí abajo y
 * no un comentario: un comentario que dice un orden tiene los días contados.
 *
 * Y las citas se sacan DESPUÉS de las vallas, no antes: un «>» dentro de un
 * volcado ``` es texto del volcado, no una cita. Eso también se asegura.
 *
 * ── LAS DOS DECISIONES DE DISEÑO, DICHAS ANTES DE ESCRIBIRLAS ─────────────
 *
 * DE VARIAS LÍNEAS. Una corrida de «>» seguidos es UNA sola cita, y por dentro
 * valen las mismas reglas que fuera —párrafos unidos a lo ancho, `###` titular,
 * `-` lista, ``` valla, negrita, código, enlaces—, porque el contenido se pasa
 * POR `md()` OTRA VEZ. Recursión y no un segundo juego de reglas: dos juegos se
 * separan con el tiempo, y el día que se separen nadie mirará el de dentro. Una
 * línea en blanco SIN «>» cierra la cita.
 *
 * VACÍA. Un «>» pelado es LA LÍNEA EN BLANCO DE DENTRO de la cita: separa
 * párrafos, no emite un `<p>` vacío y NO parte la cita en dos. En las fuentes
 * hay ocho —seis en la 1.2.2, dos en la 1.6.0— y las ocho son separadores. Y
 * una cita que sea SÓLO «>» pelados no emite NADA: ningún `<blockquote>` vacío,
 * porque un recuadro vacío en la página es peor que no pintar nada. De esas hay
 * CERO en las fuentes de hoy: esa segunda regla es guarda de futuro, y se dice.
 *
 * ── Y EL CONTROL POSITIVO ─────────────────────────────────────────────────
 *
 * Sin él, todo lo de arriba pasa en verde con un `md()` que haya dejado de
 * saber hacer nada: si devolviera '' o el texto pelado, «no hay &gt;» y «no hay
 * <blockquote> vacío» se cumplen solos. Por eso el punto 8 exige que lo que NO
 * es cita SIGA convirtiéndose, las seis formas, y que un «>» que no abre línea
 * —`a > b`, o el `<SPAIN>` real de la 1.7.0— quede como texto escapado y no
 * fabrique una cita.
 */
import { md } from '../web/build.mjs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};
const cuantos = (h, re) => (h.match(re) ?? []).length;

// ── 1. Una cita sale como <blockquote> y el «>» NO se imprime ──────────────
console.log('\nuna cita sale como <blockquote> y la marca no se imprime');
{
  const html = md('> Esta versión no pide reconstruir nada.', 'v1.6.2 (es)');
  ok(cuantos(html, /<blockquote>/g) === 1, 'exactamente un <blockquote>',
    cuantos(html, /<blockquote>/g));
  ok(html.includes('<blockquote><p>'), 'y el texto va en su párrafo dentro');
  ok(!html.includes('&gt;'), 'CERO «&gt;» a la vista en toda la salida',
    JSON.stringify(html));
  ok(!/<p>&gt;|>\s*&gt;/.test(html), 'y la marca no ha llegado al párrafo');
  ok(html.includes('Esta versión no pide reconstruir nada.'), 'el texto sigue entero');
}

// ── 2. Varias líneas seguidas son UNA cita, no una por línea ───────────────
console.log('\nuna corrida de «>» es UNA sola cita');
{
  // Cortada a lo ancho, que es como se escriben de verdad.
  const html = md([
    '> **No pide reconstruir nada.** Todo lo de esta versión se calcula al mirar,',
    '> no al guardar. Lo único que hace por su cuenta es preguntarle a la wiki qué',
    '> enemigos son jefes de raid.',
  ].join('\n'), 'v1.6.2 (es)');
  ok(cuantos(html, /<blockquote>/g) === 1, 'un solo <blockquote> para las tres líneas',
    cuantos(html, /<blockquote>/g));
  ok(cuantos(html, /<p>/g) === 1, 'y un solo párrafo dentro: las líneas se juntan',
    cuantos(html, /<p>/g));
  ok(html.includes('<strong>No pide reconstruir nada.</strong>'),
    'la negrita de dentro SÍ se convierte (una cita es prosa, no un volcado)');
  ok(html.includes('al mirar, no al guardar'),
    'y el corte de línea se cose con un espacio, sin comerse ni doblar nada');
  ok(!html.includes('&gt;'), 'ningún «&gt;» superviviente');
}

// ── 3. El «>» pelado separa párrafos y NO parte la cita ────────────────────
console.log('\nun «>» pelado separa párrafos dentro de la MISMA cita');
{
  // La forma exacta de la 1.6.0, que trae dos «>» pelados.
  const html = md([
    '> **Esta versión sí cambia lo guardado.** Al abrirla te lo ofrecerá.',
    '>',
    '> Merece la pena hacerlo. Lo que sigue llevaba meses sin contarse bien.',
  ].join('\n'), 'v1.6.0 (es)');
  ok(cuantos(html, /<blockquote>/g) === 1, 'sigue siendo UNA cita, no dos',
    cuantos(html, /<blockquote>/g));
  ok(cuantos(html, /<p>/g) === 2, 'con DOS párrafos dentro', cuantos(html, /<p>/g));
  ok(!/<p><\/p>/.test(html), 'y ningún párrafo vacío por el «>» pelado');
  ok(!html.includes('&gt;'), 'ningún «&gt;» superviviente');

  // Y pelados al principio y al final tampoco fabrican párrafos vacíos.
  const bordes = md('>\n> Texto.\n>', 'x');
  ok(cuantos(bordes, /<p>/g) === 1 && !/<p><\/p>/.test(bordes),
    'pelados en los bordes: un solo párrafo, ninguno vacío', cuantos(bordes, /<p>/g));
}

// ── 4. Una cita entera vacía no emite NADA ─────────────────────────────────
console.log('\nuna cita que es sólo «>» pelados no emite nada');
{
  ok(md('>', 'x') === '', 'un «>» solo no da salida', JSON.stringify(md('>', 'x')));
  ok(md('>\n>\n>', 'x') === '', 'ni tres seguidos', JSON.stringify(md('>\n>\n>', 'x')));
  ok(!md('>', 'x').includes('<blockquote>'), 'y desde luego ningún <blockquote> vacío');

  // Pero no se traga lo de alrededor.
  const conVecinos = md('Antes.\n\n>\n\nDespués.', 'x');
  ok(conVecinos.includes('<p>Antes.</p>') && conVecinos.includes('<p>Después.</p>'),
    'el texto de alrededor sigue ahí');
  ok(!conVecinos.includes('<blockquote>'), 'y sin cita vacía en medio');
}

/**
 * ── 5. LA ASERCIÓN DEL ORDEN ──────────────────────────────────────────────
 *
 * Si la extracción se hace ANTES de todo, el «>» desaparece como marca y lo de
 * dentro se convierte. Si alguien la mueve DETRÁS del bucle que escapa y junta
 * —que es donde estaba el fallo—, `esc()` deja `&gt;` impreso y `junta.join`
 * pega las tres líneas en un párrafo suelto. Cada mitad de esta prueba se cae
 * por un lado distinto, a propósito.
 */
console.log('\nlas citas se extraen ANTES que las demás transformaciones');
{
  const html = md([
    '> `código` y **negrita** y [un enlace](https://ejemplo.com)',
    '> ![una imagen](https://ejemplo.com/x.png)',
  ].join('\n'), 'trampa');

  ok(!html.includes('&gt;'), 'la marca NO ha pasado por esc(): cero «&gt;»',
    JSON.stringify(html.slice(0, 60)));
  ok(html.startsWith('<blockquote>'), 'la salida empieza por la cita, no por un <p> suelto',
    JSON.stringify(html.slice(0, 30)));
  ok(cuantos(html, /<p>/g) === 1 && html.includes('<blockquote><p>'),
    'y las dos líneas no se han quedado en un párrafo fuera de la cita');
  // Lo de dentro sí se convierte: una cita es prosa, al revés que una valla.
  ok(/<code>código<\/code>/.test(html), 'dentro de la cita el código en línea SÍ se convierte');
  ok(/<strong>negrita<\/strong>/.test(html), 'la negrita también');
  ok(/<a href="https:\/\/ejemplo\.com">un enlace<\/a>/.test(html), 'los enlaces también');
  ok(/<img src="https:\/\/ejemplo\.com\/x\.png"/.test(html), 'y las imágenes también');
}

// ── 6. Y las vallas van ANTES que las citas: un «>» de volcado es texto ────
console.log('\nun «>» dentro de un volcado ``` es texto del volcado, no una cita');
{
  const html = md('```\n> esto es una línea del volcado\n> y esta otra\n```', 'v1.6.2 (es)');
  ok(cuantos(html, /<pre>/g) === 1, 'sale un <pre>', cuantos(html, /<pre>/g));
  ok(!html.includes('<blockquote>'), 'y NINGÚN <blockquote>: dentro de la valla no hay citas');
  const dentro = /<pre><code>([\s\S]*?)<\/code><\/pre>/.exec(html)?.[1] ?? '';
  ok(dentro.split('\n').length === 2, 'las dos líneas siguen siendo dos',
    dentro.split('\n').length);
  ok(dentro.includes('&gt; esto es una línea del volcado'),
    'y el «>» se conserva literal, escapado, como parte del volcado');
}

// ── 7. Dentro de la cita valen las mismas reglas de bloque que fuera ───────
console.log('\ndentro de la cita valen las mismas reglas de bloque');
{
  // La 1.2.2 real trae un «### » dentro de la cita.
  const conTitular = md('> ### Esta versión corrige datos ya guardados.\n>\n> Dos fallos.', 'v1.2.2 (es)');
  ok(/<blockquote><h3>Esta versión corrige datos ya guardados\.<\/h3>/.test(conTitular),
    'un «###» dentro de la cita es un titular, no texto con almohadillas');
  ok(!conTitular.includes('###'), 'y no queda ninguna almohadilla a la vista');

  const conLista = md('> Dos cosas:\n> - una\n> - otra', 'x');
  ok(conLista.includes('<blockquote>') && cuantos(conLista, /<li>/g) === 2,
    'una lista dentro de la cita es una lista', cuantos(conLista, /<li>/g));

  const conValla = md('> Así queda:\n> ```\n> Lord Nagafen 6m49s\n> ```', 'x');
  ok(conValla.includes('<blockquote>') && conValla.includes('<pre><code>Lord Nagafen 6m49s'),
    'y una valla dentro de la cita sigue siendo un volcado literal');

  // Una línea en blanco SIN «>» cierra la cita.
  const cerrada = md('> Dentro.\n\nFuera.', 'x');
  ok(cuantos(cerrada, /<blockquote>/g) === 1, 'una sola cita', cuantos(cerrada, /<blockquote>/g));
  ok(/<\/blockquote>\s*<p>Fuera\.<\/p>/.test(cerrada),
    'y lo de después de la línea en blanco queda FUERA de la cita');

  // Dos citas separadas por texto son dos citas.
  const dos = md('> Una.\n\ntexto\n\n> Otra.', 'x');
  ok(cuantos(dos, /<blockquote>/g) === 2, 'dos citas separadas dan dos <blockquote>',
    cuantos(dos, /<blockquote>/g));
}

/**
 * ── 8. EL CONTROL POSITIVO ────────────────────────────────────────────────
 *
 * Lo que NO es cita tiene que SEGUIR convirtiéndose. Sin esto, los siete
 * apartados de arriba pasan verdes con un `md()` vacío: «no hay &gt;» y «no hay
 * blockquote vacío» los cumple cualquier función que no devuelva nada.
 */
console.log('\nCONTROL: lo que no es cita sigue convirtiéndose');
{
  const sinCita = [
    'esto es `código en línea`',
    'esto es **negrita**',
    'esto es [un enlace](https://ejemplo.com)',
    'esto es ![una imagen](https://ejemplo.com/x.png)',
    '',
    '- un punto de lista',
    '',
    '# un titular',
    '',
    '```',
    'un volcado',
    '```',
  ].join('\n');
  const html = md(sinCita, 'control');
  ok(/<code>/.test(html), 'CONTROL: el código en línea sigue convirtiéndose');
  ok(/<strong>/.test(html), 'CONTROL: la negrita sigue');
  ok(/<a /.test(html), 'CONTROL: los enlaces siguen');
  ok(/<img /.test(html), 'CONTROL: las imágenes siguen');
  ok(/<ul>/.test(html) && /<li>/.test(html), 'CONTROL: las listas siguen');
  ok(/<h3>/.test(html), 'CONTROL: los titulares siguen');
  ok(/<pre>/.test(html), 'CONTROL: las vallas siguen');
  ok(/<p>/.test(html), 'CONTROL: y los párrafos siguen saliendo');
  ok(!html.includes('<blockquote>'),
    'y NADA de esto ha fabricado una cita donde no había un «>»');

  /**
   * Y UN «>» QUE NO ABRE LÍNEA NO ES UNA CITA. El caso de `<SPAIN>` es real: en
   * la nota de la 1.7.0 sale «de <SPAIN> Guild», y `esc()` lo deja en
   * `&lt;SPAIN&gt;`. Si alguien buscara el «>» sin anclarlo al principio de la
   * línea, eso se convertiría en una cita a media frase.
   */
  const medio = md('El nombre viene de <SPAIN> Guild, y 3 > 2 en cualquier caso.', 'v1.7.0 (es)');
  ok(!medio.includes('<blockquote>'), 'un «>» a media línea NO fabrica una cita');
  ok(medio.includes('&lt;SPAIN&gt;'), 'y el <SPAIN> real de la 1.7.0 sigue escapándose entero');
  ok(medio.includes('3 &gt; 2'), 'igual que un «mayor que» normal, que sigue siendo texto');
  ok(/^<p>/.test(medio), 'la línea entera sigue siendo un párrafo', medio.slice(0, 20));
}

// ── 9. Y sobre las notas de verdad, que es donde se vio ────────────────────
console.log('\nsobre las notas publicadas de verdad');
{
  const real = [
    '## Español',
    '',
    '> ### Esta versión corrige datos ya guardados. Conviene reconstruir.',
    '>',
    '> Dos fallos hacían que el histórico guardara cosas que no ocurrieron. Los dos',
    '> se arreglan releyendo tu registro: al abrir la aplicación sale el cartel con',
    '> el botón, tarda unos segundos y lo anterior se guarda aparte.',
    '>',
    '> **1 · Si usas la tabla de tríos y cambias de trío, tus peleas podían quedar',
    '> con el nivel equivocado.** Un `/who` posterior que decía otro trío se tiraba',
    '> entero, clases y nivel, porque la tabla mandaba.',
    '',
    '# Lo demás',
    '',
    'Un párrafo normal.',
  ].join('\n');
  const html = md(real, 'v1.2.2 (es)');
  ok(cuantos(html, /<blockquote>/g) === 1, 'las nueve líneas dan UNA cita',
    cuantos(html, /<blockquote>/g));
  ok(!html.includes('&gt;'), 'y CERO «&gt;» en toda la nota', cuantos(html, /&gt;/g));
  const dentro = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(html)?.[1] ?? '';
  ok(cuantos(dentro, /<h3>/g) === 1, 'con su titular', cuantos(dentro, /<h3>/g));
  ok(cuantos(dentro, /<p>/g) === 2, 'y sus dos párrafos', cuantos(dentro, /<p>/g));
  ok(dentro.includes('<code>/who</code>'), 'el código en línea de dentro se convierte');
  ok(html.includes('<p>Un párrafo normal.</p>'), 'y lo de fuera de la cita sigue fuera');
  ok(cuantos(html, /<h3>/g) === 3, 'los titulares de fuera también siguen',
    cuantos(html, /<h3>/g));
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
