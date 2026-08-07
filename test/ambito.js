/**
 * Ningún ayudante declarado dentro de una función se usa fuera de ella.
 *
 * EL FALLO QUE LA TRAJO. `cuando` —la fecha de un instante— estaba declarada
 * como `const` dentro de tres funciones y se usaba en SEIS. Las otras tres
 * lanzaban ReferenceError al pintarse: la ficha de un hechizo, el bloque de
 * periodos y la página de progreso. Dos de las cuatro partes que se
 * publicaron en la 1.6.3 no llegaban a verse.
 *
 * Y NO SE NOTÓ PORQUE NO SE VE. La página se construye como una cadena y se
 * asigna entera al final; si algo revienta a mitad, el `innerHTML` no se
 * asigna nunca. No sale media página ni un hueco: la pantalla se queda
 * exactamente como estaba. Pulsas la fila y no pasa nada, y eso se parece
 * mucho más a «esto todavía no está hecho» que a una avería.
 *
 * POR QUÉ NO LO COGIÓ NINGUNA PRUEBA. Las que hay miden lo que calcula la
 * aplicación, y el cálculo estaba bien: `spellDetail` devolvía su ficha para
 * las 42 filas de la tabla. Lo roto era pintarla. `node --check` tampoco lo
 * ve: una variable que no existe es sintaxis válida hasta que se ejecuta.
 *
 * QUÉ MIRA, Y QUÉ NO. Sólo los nombres declarados con sangrado —dentro de una
 * función— que NO existen además arriba del fichero ni entran por un
 * `import`. De ésos calcula en qué funciones están declarados y comprueba que
 * no se llamen desde ninguna otra. Que dos funciones tengan cada una su
 * `card` es correcto y no se señala.
 *
 * POR QUÉ TAN ESTRECHO, que es la parte interesante. El primer intento
 * pretendía comprobar TODAS las llamadas, y para eso hay que saber qué trozo
 * del fichero es código: hay que borrar comentarios, cadenas y el texto de
 * los literales de plantilla conservando sus `${…}`, que es donde vive lo que
 * se rompió. Se hizo, y se desincronizaba en `/[&<>"]/g`: la comilla de una
 * expresión regular abría una cadena que no se cerraba nunca, y a partir de
 * ahí el escáner daba por texto el código y por código el HTML. Distinguir
 * `/` de división de `/` de expresión regular es el problema difícil de
 * analizar JavaScript, y esta prueba no va a resolverlo.
 *
 * Restringido a los nombres que sólo existen dentro de una función, nada de
 * eso hace falta: un `$` o un `encGo` que estén arriba no se miran, y el
 * único falso positivo posible es un comentario que mencione justo ese nombre
 * seguido de un paréntesis. Cubre el fallo que hubo y no inventa otros.
 */
import fs from 'node:fs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const FICHEROS = ['ui/app.js', 'ui/overlay.js', 'ui/clip.js', 'ui/plates.js',
  'ui/alerts.js', 'ui/triggers.js'];

console.log('\námbito de los ayudantes de la interfaz');

for (const rel of FICHEROS) {
  const url = new URL(`../${rel}`, import.meta.url);
  if (!fs.existsSync(url)) continue;
  const bruto = fs.readFileSync(url, 'utf8');
  const lineas = bruto.split(/\r?\n/);

  // ── Las funciones de primer nivel y dónde acaban ────────────────────────
  // Empiezan en la columna cero y cierran con una llave en la columna cero.
  const bloques = [];
  for (let i = 0; i < lineas.length; i++) {
    if (!/^(?:export\s+)?(?:async\s+)?function\s+[\w$]+/.test(lineas[i])) continue;
    let fin = lineas.length - 1;
    for (let j = i + 1; j < lineas.length; j++) {
      if (lineas[j] === '}') { fin = j; break; }
    }
    bloques.push({ desde: i, hasta: fin });
  }
  const bloqueDe = (n) => bloques.find((b) => n >= b.desde && n <= b.hasta) ?? null;

  // ── Lo que vale en todo el fichero: la columna cero y los `import` ──────
  const global = new Set();
  for (const m of bruto.matchAll(/import\s+([^;]+?)\s+from\s+/g)) {
    for (const n of m[1].matchAll(/([\w$]+)/g)) global.add(n[1]);
  }
  lineas.forEach((l) => {
    const m = /^(?:export\s+)?(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))/.exec(l);
    if (m) global.add(m[1] ?? m[2]);
  });

  // Los nombres que en algún sitio son parámetro quedan fuera de la
  // comprobación. `NARRATE_CHAT.map(([k, l]) => box(k, l()))` declara su
  // propia `l` y no tiene nada que ver con el `const l` de otra función; un
  // nombre de una letra reaparece en veinte sitios y decidir cuál es cuál
  // pide justo el análisis que esta prueba no hace.
  const parametros = new Set();
  for (const m of bruto.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const n of m[1].matchAll(/([\w$]+)/g)) parametros.add(n[1]);
  }
  for (const m of bruto.matchAll(/(?:^|[^.\w$])([\w$]+)\s*=>/g)) parametros.add(m[1]);
  for (const m of bruto.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)) {
    for (const n of m[1].matchAll(/([\w$]+)/g)) parametros.add(n[1]);
  }

  // ── Lo que sólo vive dentro de una función, y en cuáles ─────────────────
  const locales = new Map();            // nombre -> [bloques donde se declara]
  lineas.forEach((l, i) => {
    const m = /^\s+(?:const|let|var)\s+([\w$]+)\s*=/.exec(l);
    if (!m || global.has(m[1]) || parametros.has(m[1])) return;
    const b = bloqueDe(i);
    if (!b) return;
    if (!locales.has(m[1])) locales.set(m[1], []);
    locales.get(m[1]).push(b);
  });

  // ── Cada llamada suya, dentro de alguna de sus funciones ────────────────
  const rotos = [];
  for (const [nombre, suyos] of locales) {
    const re = new RegExp(`(?:^|[^.\\w$])${nombre.replace(/\$/g, '\\$')}\\s*\\(`);
    lineas.forEach((l, i) => {
      // Un comentario que lo mencione no es una llamada.
      if (/^\s*(?:\/\/|\*|\/\*)/.test(l)) return;
      if (!re.test(l)) return;
      if (suyos.some((b) => i >= b.desde && i <= b.hasta)) return;
      rotos.push(`${rel}:${i + 1}  ${nombre}() — declarada sólo en ${
        suyos.map((b) => `líneas ${b.desde + 1}–${b.hasta + 1}`).join(', ')}`);
    });
  }

  ok(rotos.length === 0, `${rel}: ${locales.size} ayudantes locales, ninguno usado fuera`,
    rotos.length ? `\n      ${rotos.join('\n      ')}` : undefined);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
