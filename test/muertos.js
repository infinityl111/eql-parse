/**
 * LA GUARDA DE LA SALIDA MUERTA: un campo que se calcula y no lo lee nadie.
 *
 * ES LA SÉPTIMA FAMILIA DE FALLOS Y LA ÚNICA QUE NO TENÍA GUARDA, precisamente
 * porque no falla nada. `f.duda` —la marca de «esta pelea está mal contada»—
 * llevaba DOS VERSIONES calculándose bien, con su fichero lateral, su
 * comprobación de contenido y su prueba en verde, y sin pintarse en ninguna
 * parte. Nadie la vio nunca. No había nada roto que detectar.
 *
 * Y LA TASA DICE QUE VUELVE. En la sesión que encontró aquello, un barrido a
 * mano cazó siete campos viejos sin lector —`f.duda`, `charm.soltado`,
 * `unattributed`, el botín ambiguo, `phases().idle`, `par: true`, `modelo`— y
 * DOS RECIÉN NACIDOS EN ESA MISMA SESIÓN: `duda.sobre` y `duracionMando`, los
 * dos leídos sólo por su prueba. Nueve en una tarde. Un barrido que se hace una
 * vez no sirve para algo que aparece a ese ritmo.
 *
 * ═══ LA LISTA SE DERIVA, NO SE MANTIENE A MANO ═══
 *
 * Es la misma forma que la enumeración de `FICHEROS` en `rebuild.js` y que la
 * comprobación de «todo el que reconstruya, avisa» en `test/formato.js`: los
 * campos se sacan LEYENDO EL FUENTE, no de una lista que alguien recuerde
 * actualizar. Una lista mantenida a mano se queda corta justo en lo que se
 * acaba de añadir, que es lo único que hace falta vigilar.
 *
 * ═══ QUÉ EXIGE DE CADA CAMPO ═══
 *
 * Una de estas dos, y nada más:
 *
 *   UN CONSUMIDOR   alguien fuera de quien lo produce lo lee por su nombre: la
 *                   interfaz, el proceso principal, el que escribe texto.
 *   UNA ANOTACIÓN   la palabra `DORMIDA` en un comentario, con el caso que la
 *                   despierta escrito al lado. Ver `dudaCompa` en `store.js`:
 *                   no marcará nada mientras nadie llegue sin reconstruir, pero
 *                   salta el día que alguien rompa `#sides`.
 *
 * La diferencia entre una guarda dormida y una salida muerta es que la primera
 * tiene un caso de despertar y está escrito cuál. Sin eso, cae.
 *
 * ═══ LO QUE ESTA PRUEBA NO ES ═══
 *
 * No es un analizador. Busca el nombre del campo en los ficheros que consumen,
 * así que un campo leído por `...spread`, recorriendo claves o desde una
 * plantilla le parecerá muerto. Cuando eso pase, la salida correcta NO es
 * ampliar la lista de excusas: es anotar el campo diciendo quién lo lee y cómo,
 * que es justo la información que faltaba el día que `f.duda` se quedó muda.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// `fileURLToPath` y no `url.pathname`: la ruta de este proyecto lleva un espacio
// —«D:/EQL SPAIN»— que en una URL viaja como `%20`, y con `pathname` a secas la
// carpeta no existe. Falla ruidosamente, que es lo bueno, pero falla.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CR = String.fromCharCode(13);
const lee = (p) => {
  try { return fs.readFileSync(path.join(RAIZ, p), 'utf8').split(CR).join(''); }
  catch { return ''; }
};

/**
 * PRODUCTORES: los objetos literales que salen de la aplicación hacia fuera.
 *
 * Se localizan por una marca de inicio y otra de fin en el propio fuente. Si
 * alguien renombra la función, la marca deja de casar, el bloque sale con cero
 * campos y la guarda de abajo lo caza: una lista vacía es un fallo, no un
 * aprobado.
 */
const BLOQUES = [
  ['la pelea que se guarda', 'src/engine.js',
    '    return {\n      id: enc.id,', '\n  /**\n   * ¿Has usado algo'],
  ['la fila de cada combatiente', 'src/engine.js',
    '    return {\n      name: r.name,', '\n  /**\n   * Quién es enemigo'],
  ['el resumen del índice', 'src/store.js',
    '  static summary(f, at, off, len, self = null) {', '\n  load()'],
  ['lo que devuelve el análisis', 'src/analysis.js',
    '  return {\n    phases: ph,', '\n}'],
];

/**
 * ═══ LO QUE ESTA GUARDA TODAVÍA NO MIRA, MEDIDO Y CON NOMBRES ═══
 *
 * FALTA `snapshot()`, que es lo que el motor le pasa a la interfaz cuatro veces
 * por segundo — o sea el sitio donde más se produce. Se probó a añadirlo y
 * cayeron tres campos con CERO lectores:
 *
 *   `advice`        el consejo en vivo. Y no es que no se lea: es que se dejó
 *                   de leer. El comentario de `renderAdvice` en `ui/app.js` lo
 *                   dice — «antes venía del motor»— porque ahora se calcula
 *                   sobre la pelea SELECCIONADA. El motor lo sigue calculando
 *                   cuatro veces por segundo para nadie.
 *   `currentPet`    la mascota de ahora, que ya viaja en `pets` y `allPets`
 *   `autoFullRead`  una marca de si la relectura completa fue automática
 *
 * NO SE AÑADE TODAVÍA, Y EL MOTIVO NO ES LA PRISA: al añadirlo salieron también
 * `allies` del índice y `allies`/`enemies` del análisis, y ésos SÍ tienen lector
 * — los lee `src/store.js` al filtrar por compañero, que en esta guarda está en
 * el lado de los productores. O sea que la guarda tiene un fallo de diseño: un
 * fichero puede producir una cosa y consumir otra, y aquí se clasifican ficheros
 * enteros. Con eso, ampliar ahora sólo añadiría tres hallazgos buenos y dos
 * falsos, y una guarda que se equivoca dos de cada cinco se desactiva a la
 * tercera.
 *
 * Y HAY UN FALSO NEGATIVO CONOCIDO, del mismo tamaño y en el otro sentido: el
 * comparador busca `.campo`, y una clave de diccionario como `'lvl.unknown'`
 * lleva un punto y un nombre dentro de unas comillas. Con eso, un campo que se
 * llame como el final de una clave de i18n parece leído sin serlo. Se probó a
 * quitar las claves entrecomilladas antes de buscar y aparecieron los mismos
 * dos falsos positivos de arriba: la mejora es correcta y no se puede aplicar
 * hasta que el problema de fondo esté resuelto.
 *
 * QUÉ HAY QUE HACER, para que no se quede en una nota: separar productor de
 * consumidor POR LITERAL y no por fichero — «quién lee este campo aparte del
 * objeto donde nace»— y entonces meter `snapshot()` y quitar las claves de
 * i18n. Los tres de arriba caen solos ese día, y el falso negativo también.
 *
 * Se escribe aquí y no en un cuaderno porque es exactamente lo que este fichero
 * persigue: un hallazgo que existe sólo en la memoria de una sesión ya no
 * existe.
 */

/** Las claves de un objeto literal, del fuente, sin comentarios. */
function claves(txt, desde, hasta) {
  const i = txt.indexOf(desde);
  if (i < 0) return null;                       // la marca no casa: es un fallo
  const j = hasta ? txt.indexOf(hasta, i) : -1;
  const out = new Set();
  for (const linea of txt.slice(i, j < 0 ? txt.length : j).split('\n')) {
    const l = linea.trim();
    if (l.startsWith('*') || l.startsWith('//') || l.startsWith('/*')) continue;
    const m = /^([A-Za-zÁ-Úá-úñÑ_$][\w$ñÑáéíóúÁÉÍÓÚ]*)\s*:/.exec(l);
    if (m) out.add(m[1]);
  }
  return [...out];
}

/**
 * CONSUMIDORES: todo lo que está fuera del motor y del almacén.
 *
 * Se enumeran los DIRECTORIOS y se leen enteros, así que un fichero nuevo entra
 * solo. Los módulos de `src/` que existen para producir texto cuentan como
 * consumidores: un campo que sólo lee el narrador SÍ llega a alguien.
 */
const DIRS = ['ui', 'electron'];
const SUELTOS = ['src/share.js', 'src/guion.js', 'src/narrator.js', 'src/advisor.js',
  'src/encyclopedia.js', 'src/foes.js', 'src/raid.js', 'src/aggregate.js',
  'src/catalog.js', 'src/wiki.js', 'src/analysis.js', 'src/rebuild.js'];

const consumidores = [
  ...DIRS.flatMap((d) => fs.readdirSync(path.join(RAIZ, d))
    .filter((f) => /\.(js|cjs|html)$/.test(f)).map((f) => `${d}/${f}`)),
  ...SUELTOS,
];
const TEXTO = consumidores.map(lee).join('\n');
/** Todo el fuente, para buscar la anotación de guarda dormida. */
const FUENTE = [...consumidores, ...BLOQUES.map((b) => b[1]),
  'src/encounter.js', 'src/store.js', 'src/parser.js'].map(lee).join('\n');

/** Leer un campo es acceder a él por su nombre, no que la palabra aparezca. */
const leido = (txt, k) => new RegExp(
  `\\.${k}\\b|\\['${k}'\\]|\\["${k}"\\]|\\{[^{}\\n]*\\b${k}\\b[^{}\\n]*\\}\\s*=`).test(txt);

/**
 * ¿Está anotado como guarda dormida, CON su caso de despertar?
 *
 * Se pide la palabra y algo detrás: una anotación que sólo diga «dormida» no
 * dice cuándo deja de estarlo, y entonces es indistinguible de una excusa.
 */
const dormida = (k) => {
  const re = new RegExp(`DORMIDA[\\s\\S]{0,600}?\\b${k}\\b|\\b${k}\\b[\\s\\S]{0,600}?DORMIDA`);
  return re.test(FUENTE);
};

console.log('\nlos campos que se calculan y no lee nadie');

const muertos = [];
for (const [nombre, fichero, ini, fin] of BLOQUES) {
  const lista = claves(lee(fichero), ini, fin);
  // La marca no casa, o casa con nada: la guarda se ha quedado ciega y eso es
  // un fallo, no un aprobado. Es la lección de la prueba que encontraba una
  // sola función y pasaba sin comprobar nada.
  ok(lista !== null, `${nombre}: la marca del fuente sigue casando`, fichero);
  ok((lista?.length ?? 0) >= 5, `${nombre}: y saca campos`, `${lista?.length ?? 0}`);
  for (const k of lista ?? []) {
    if (leido(TEXTO, k) || dormida(k)) continue;
    muertos.push(`${k} (${nombre})`);
  }
}

ok(muertos.length === 0,
  'ningún campo se calcula sin que alguien lo lea, o sin decir por qué duerme',
  muertos.length ? muertos.join(' · ') : 'ninguno');

if (muertos.length) {
  console.log('');
  console.log('       QUÉ HACER. Para cada uno, una de dos y no hay tercera:');
  console.log('       · enseñarlo, que suele ser barato porque el número ya está calculado');
  console.log('       · o borrarlo. Y si de verdad tiene que quedarse sin lector, anotar');
  console.log('         DORMIDA junto al campo con el caso que lo despierta escrito.');
  console.log('       Dejarlo «por si acaso» es exactamente cómo se propagó esta familia:');
  console.log('       `f.duda` estuvo dos versiones calculándose bien y sin verla nadie.');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
