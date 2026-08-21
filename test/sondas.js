/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS SONDAS SIEMBRAN LAS CLAVES QUE LA APLICACIÓN LEE DE VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── LA CICATRIZ ───────────────────────────────────────────────────────────
 *
 * `bin/rotulos.js` escribía `path: LOG` en la configuración que sembraba. El
 * arranque lee **`cfg.logPath`**. Con la clave equivocada el motor no se
 * enganchaba a nada: el almacén quedaba vacío, y los temporizadores salían
 * «esperando su primera muerte» **teniendo su muerte escrita en el propio
 * registro de prueba**.
 *
 * Y no falló nunca. La sonda arrancaba, pintaba, medía y daba su informe. Sólo
 * que medía una aplicación sin datos.
 *
 *     UNA CLAVE QUE NADIE LEE NO DA ERROR: DA UN VALOR POR DEFECTO.
 *
 * Es la misma familia que la ausencia de prueba codificada como un cero, y que
 * `var(--raised, #f6f2ea)`: el respaldo silencioso gana y todo parece normal.
 *
 * ── QUÉ SE COMPRUEBA ──────────────────────────────────────────────────────
 *
 * Que **toda clave que una sonda siembre exista en el vocabulario que la
 * aplicación lee**. El vocabulario no se escribe aquí: se saca de
 * `electron/main.cjs`, que es quien lee la configuración. Así no puede
 * desincronizarse — si mañana el arranque renombra una clave, esto se pone
 * rojo solo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(DIR, '..');
const lee = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** El vocabulario de verdad: lo que `main.cjs` y el preload leen de `cfg`. */
const VOCABULARIO = new Set([
  ...[...lee('electron/main.cjs').matchAll(/\bcfg\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]),
  ...[...lee('electron/main.cjs').matchAll(/\bcfg\[['"]([a-zA-Z][a-zA-Z0-9]*)['"]\]/g)].map((m) => m[1]),
  // `attach` recibe la configuración entera y usa lo suyo.
  ...[...lee('src/engine.js').matchAll(/\bopts\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]),
]);

/**
 * LAS CLAVES QUE UNA SONDA SIEMBRA.
 *
 * Van todas en una línea —`lang: 'es', cronos: CRONOS, logPath: LOG,`— así
 * que buscarlas a principio de renglón no encontraba ninguna, y el barrido
 * daba «0 claves sembradas: todas se leen». Verde por no mirar, que es
 * exactamente lo que este fichero existe para impedir.
 *
 * Lo cazó su propio control positivo. Se busca dentro del objeto que se
 * escribe como `config.json`, y a cualquier altura del renglón.
 */
function claves(src) {
  const i = src.indexOf("'config.json'");
  if (i < 0) return [];
  const j = src.indexOf('{', src.indexOf('JSON.stringify', i));
  if (j < 0) return [];
  // Se anda el objeto por sus llaves: sin esto la ventana cogia palabras de
  // los comentarios de al lado y de objetos anidados como {recursive: true}.
  let n = 0;
  let k = j;
  for (; k < src.length; k += 1) {
    if (src[k] === '{') n += 1;
    if (src[k] === '}') { n -= 1; if (n === 0) break; }
  }
  const trozo = src.slice(j, k)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
  return [...new Set([...trozo.matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map((m) => m[1]))];
}

/** Las sondas que siembran una configuración de cero. */
const SONDAS = ['bin/rotulos.js', 'bin/panel-vivo.js', 'bin/candidatos-vivos.js',
  'bin/canales-vivos.js'];

console.log('\nel vocabulario sale de quien lee, no de una lista escrita aquí');
ok(VOCABULARIO.size > 15, `${VOCABULARIO.size} claves que la aplicación lee`);
ok(VOCABULARIO.has('logPath'), 'y entre ellas está logPath', 'la que faltaba');

console.log('\nninguna sonda siembra una clave que nadie lee');
for (const s of SONDAS) {
  const src = lee(s);
  // El objeto que se escribe como config.json: se localiza por su escritura.
  const sembradas = claves(src);
  const huerfanas = [...new Set(sembradas)].filter((k) => !VOCABULARIO.has(k));
  ok(huerfanas.length === 0, `${s}: ${sembradas.length} claves sembradas`,
    huerfanas.length ? `NADIE LEE: ${huerfanas.join(', ')}` : 'todas se leen');
}

console.log('\ny toda sonda tiene su logPath: propio o heredado de la pieza');
/**
 * O LO SIEMBRA ELLA, O LO DELEGA EN `bin/sonda.js`.
 *
 * Esta comprobación exigía que cada sonda escribiera `logPath` de su puño.
 * Al sacar la preparación a una pieza común, la que la usa dejó de escribirlo
 * — y la prueba se puso roja teniendo razón en el sitio equivocado.
 *
 * Es «al migrar código, la vigilancia migra con él», otra vez: un detector que
 * mira una forma fija deja de mirar en cuanto la forma cambia.
 */
ok(/\blogPath\s*:/.test(lee('bin/sonda.js')), 'la pieza común lo siembra',
  'de ella lo heredan las que la usan');
for (const s of SONDAS) {
  const src = lee(s);
  const propio = /\blogPath\s*:/.test(src);
  const heredado = /arrancaListo\s*\(/.test(src);
  ok(propio || heredado, `${s}`,
    propio ? 'lo siembra ella' : heredado ? 'lo hereda de bin/sonda.js' : 'NI PROPIO NI HEREDADO');
}

console.log('\nCONTROL POSITIVO sobre una sonda real');
{
  /**
   * Se le mete a `bin/rotulos.js` una clave que nadie lee, en la forma exacta
   * que tenía el fallo: un nombre plausible al lado de los buenos.
   */
  const src = lee('bin/rotulos.js');
  const enfermo = src.replace("lang: 'es', cronos: CRONOS,", "lang: 'es', cronos: CRONOS, rutaDelLog: LOG,");
  ok(enfermo !== src, 'se ha podido inyectar una clave huérfana',
    enfermo === src ? 'la sonda ha cambiado de forma: ACTUALIZA ESTE CONTROL' : '');
  const sembradas = claves(enfermo);
  ok(sembradas.includes('rutaDelLog') && !VOCABULARIO.has('rutaDelLog'),
    'y el barrido la caza', 'sin esto, el verde de arriba no diría nada');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
