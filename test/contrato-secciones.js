/**
 * EL CONTRATO DE `pinta` ES UNO SOLO: `(snap, caja)`.
 *
 * ── EL FALLO QUE TRAJO ESTA PRUEBA ────────────────────────────────────────
 *
 * La sección del temporizador salía EN BLANCO desde el primer día y nadie lo
 * vio. Estaba escrita como `renderCronos(host)` —esperando el contenedor— y el
 * despachador le pasaba el SNAPSHOT, porque a las secciones que no están en
 * `EN_LA_PAGINA` las llamaba con un solo argumento.
 *
 * Y no reventó donde estaba el fallo. En JavaScript esto es legal:
 *
 *     const snap = { self: 'Campeon' };
 *     snap.innerHTML = '<div>hola</div>';     // no falla: crea una propiedad
 *
 * El error llegaba dos líneas después, en el primer `querySelector`, y para
 * entonces el rastro señalaba al interior de la función y no a la llamada.
 *
 * ── LA CAUSA REAL NO ERA `renderCronos` ───────────────────────────────────
 *
 * Era que `pinta` NO TENÍA UN CONTRATO ÚNICO: unas secciones recibían el
 * contenedor y otras el snapshot, y cada una se defendía sola con un
 * `caja ?? $('secPane')`. Cuando el contrato es «depende», nadie lo lee, y la
 * sección nueva copió la forma equivocada del vecino que tenía al lado.
 *
 * Por eso esta prueba no vigila `renderCronos`: vigila LAS QUINCE.
 *
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO, no un observable: decide cuál es el
 * contrato. Si se pone roja hay que leerla, no acallarla.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = fs.readFileSync(path.join(RAIZ, 'ui', 'app.js'), 'utf8').replace(/\r/g, '');

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/** Las secciones declaradas, con el nombre de su pintor. */
function secciones(fuente) {
  const i = fuente.indexOf('const SECCIONES = [');
  const bloque = fuente.slice(i, fuente.indexOf('\n];', i));
  const out = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?pinta:\s*(\w+)\s*\}/g;
  let m;
  while ((m = re.exec(bloque))) out.push({ id: m[1], pinta: m[2] });
  return out;
}

/**
 * ¿Qué hace ese pintor con lo que le llega? Tres respuestas posibles:
 *   'puerta'  lo resuelve por `huecoSeccion`, que es el contrato
 *   'ignora'  no usa el argumento del hueco en absoluto — también es válido
 *   'suelto'  se lo cree sin pasar por la puerta — eso es el fallo
 */
function comoResuelve(fuente, nombre) {
  const decl = new RegExp(`^(?:async )?function ${nombre}\\(([^)]*)\\)|^const ${nombre} = (?:async )?\\(([^)]*)\\)`, 'm');
  const m = decl.exec(fuente);
  if (!m) return { forma: 'no-existe' };
  const args = (m[1] ?? m[2] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const desde = m.index;
  // Hasta la siguiente declaración a columna cero, que es donde acaba.
  const sig = fuente.slice(desde + 1).search(/^(?:async )?function \w+|^const \w+ = /m);
  const cuerpo = fuente.slice(desde, sig < 0 ? undefined : desde + 1 + sig);
  if (/huecoSeccion\(/.test(cuerpo)) return { forma: 'puerta', args, cuerpo };
  if (/\$\('secPane'\)|innerHTML|querySelector/.test(cuerpo)) return { forma: 'suelto', args, cuerpo };
  return { forma: 'ignora', args, cuerpo };
}

const SECS = secciones(APP);

console.log('\nlas secciones declaradas se encuentran y tienen pintor');
{
  ok(SECS.length >= 15, 'hay al menos quince secciones declaradas', SECS.length);
  const sinPintor = SECS.filter((s) => comoResuelve(APP, s.pinta).forma === 'no-existe');
  ok(sinPintor.length === 0, 'todas tienen un pintor que existe en el fuente',
    sinPintor.map((s) => `${s.id}→${s.pinta}`).join(', ') || '0');
}

console.log('\nninguna sección se cree el hueco sin pasar por la puerta');
{
  const sueltas = SECS.map((s) => ({ ...s, ...comoResuelve(APP, s.pinta) }))
    .filter((s) => s.forma === 'suelto');
  ok(sueltas.length === 0,
    'las quince resuelven por `huecoSeccion` o no usan el hueco',
    sueltas.map((s) => `${s.id} (${s.pinta})`).join(', ') || '0');
  sueltas.forEach((s) => console.log(`        «${s.id}» → ${s.pinta}(${s.args.join(', ')})`));
}

console.log('\nel despachador pasa SIEMPRE las dos cosas');
{
  /**
   * El fallo entraba por aquí: `s.pinta(state.snap)` con un solo argumento. Con
   * dos llamadas distintas al mismo contrato, la sección nueva no podía saber
   * cuál le tocaba.
   */
  ok(!/\bs\.pinta\(state\.snap\)\s*;/.test(APP),
    'no queda ninguna llamada con un solo argumento');
  ok(/\bs\.pinta\(state\.snap, \$\('secPane'\)\)/.test(APP),
    'la llamada del despachador pasa el snapshot Y el hueco');
  ok(/\?\.pinta\(snap, caja\)/.test(APP),
    'y la de la página, igual');
}

/**
 * ── EL CONTROL POSITIVO ───────────────────────────────────────────────────
 *
 * Sin esto, las tres aserciones de arriba pasan en verde con un detector que no
 * encuentre nada nunca — que es exactamente lo que pasó con la primera versión
 * de otra prueba de este proyecto el mismo día. Se le da el fallo real, tal
 * como estaba escrito, y tiene que cazarlo.
 */
console.log('\nCONTROL: el detector caza la forma que falló');
{
  const enfermo = `
const SECCIONES = [
  { id: 'buena', grupo: 'x', pinta: renderBuena },
  { id: 'mala', grupo: 'x', pinta: renderMala },
];
function renderBuena(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  host.innerHTML = 'hola';
}
async function renderMala(host) {
  host.innerHTML = 'hola';
  host.querySelector('#x').addEventListener('click', () => {});
}
`;
  const s2 = secciones(enfermo);
  ok(s2.length === 2, 'CONTROL: se leen las dos secciones del caso', s2.length);
  ok(comoResuelve(enfermo, 'renderBuena').forma === 'puerta',
    'CONTROL: la que pasa por la puerta se ve como buena');
  ok(comoResuelve(enfermo, 'renderMala').forma === 'suelto',
    'CONTROL: y la que se cree el hueco se ve como SUELTA — el fallo se caza',
    comoResuelve(enfermo, 'renderMala').forma);

  // Y el otro lado: una que ni toca el DOM no puede salir «suelta».
  const limpia = `
function renderNada() { return pintaPaginaEnc('x', ['y']); }
`;
  ok(comoResuelve(limpia, 'renderNada').forma === 'ignora',
    'CONTROL: la que no usa el hueco no se marca — no es un aviso constante');
}

console.log('\nla puerta revienta con lo que no es un nodo');
{
  /**
   * La aserción tiene que estar escrita como una excepción y no como un `??`
   * silencioso: el `??` es lo que había antes en cada sección por separado, y es
   * lo que dejó pasar el fallo — tapaba el error en vez de señalarlo.
   */
  const i = APP.indexOf('function huecoSeccion(caja) {');
  const cuerpo = APP.slice(i, APP.indexOf('\n}', i));
  ok(i > 0, 'la puerta existe');
  ok(/instanceof Element/.test(cuerpo), 'comprueba que es un elemento del DOM de verdad');
  ok(/throw new TypeError/.test(cuerpo), 'y LANZA: no devuelve null ni se calla');
  ok(/caja \?\? \$\('secPane'\)/.test(cuerpo),
    'y sin hueco cae al de la página, que es el caso legítimo');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
