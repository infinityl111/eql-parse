/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETECTOR DE SUPERFICIES QUE NO SIGUEN EL TEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── LA CICATRIZ ───────────────────────────────────────────────────────────
 *
 * El panel de «Poner temporizador» de Escena se escribió cuando el claro era el
 * tema de por defecto:
 *
 *     background: var(--raised, #f6f2ea);
 *
 * `--raised` **no existe en ninguna parte del proyecto**, así que el respaldo
 * gana SIEMPRE: bloque crema con texto claro encima, ilegible en oscuro. Y nada
 * se rompe — el CSS es válido, la variable tiene su respaldo, la caja se pinta.
 *
 * **Ésa es la clase peor de todas**, y por eso va la primera: un `var()` con
 * respaldo *aparenta* seguir el tema. Un `#f6f2ea` a pelo se ve; éste no.
 *
 * ── TRES CUBOS, COMO EN `bin/rotulos.js` ──────────────────────────────────
 *
 * Ciento seis literales en bruto no son una lista de trabajo: son un número que
 * se archiva. Lo que hace falta es saber **cuál de ellos rompe un tema**:
 *
 *   1 · VARIABLE INEXISTENTE CON RESPALDO — el respaldo siempre gana. Rompe.
 *   2 · OPACO SIN CONTRAPARTE — un color de superficie en una regla que no
 *       está bajo ningún tema y que no tiene gemela en el otro. Rompe.
 *   3 · VELO TRANSLÚCIDO — `rgba(0,0,0,.4)` sobre lo que haya debajo. No rompe:
 *       oscurece o aclara igual en los dos temas.
 *   4 · YA ESTÁ BAJO UN TEMA — `:root[data-theme="light"] .x`. Es la mitad
 *       clara de una pareja, y ahí el literal es lo correcto.
 *
 * Sólo 1 y 2 se ponen rojas. Los otros dos se cuentan y se enseñan, porque un
 * rojo que no significa nada entrena a ignorar el que sí.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CSS = path.join(DIR, '..', 'ui', 'styles.css');
const fuente = fs.readFileSync(CSS, 'utf8');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

const NOMBRES = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'orange',
  'purple', 'gray', 'grey', 'pink', 'brown', 'cyan', 'magenta', 'gold',
  'silver', 'beige', 'ivory', 'khaki', 'salmon', 'teal', 'navy', 'olive'];
const OPACO = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:${NOMBRES.join('|')})\\b`, 'g');
const VELO = /\b(?:rgba|hsla)\s*\(/g;
const ES_PALETA = /^\s*:root(\[data-theme[^\]]*\])?\s*$/;
const BAJO_TEMA = /\[data-theme|@media[^{]*prefers-color-scheme/;

/** Las variables que el fichero define de verdad. */
const DEFINIDAS = new Set([...fuente.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));

function analiza(txt) {
  const lineas = txt.split(/\r?\n/);
  const rotas = [];
  const velos = [];
  const conTema = [];
  const fantasmas = [];
  let selector = '';
  let profundidad = 0;
  let enPaleta = false;
  let enComentario = false;
  let enMedia = '';

  lineas.forEach((cruda, i) => {
    let l = cruda;
    if (enComentario) {
      const c = l.indexOf('*/');
      if (c < 0) return;
      l = l.slice(c + 2);
      enComentario = false;
    }
    l = l.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const a = l.indexOf('/*');
    if (a >= 0) { enComentario = true; l = l.slice(0, a); }

    if (/^\s*@media/.test(l)) enMedia = l.trim();
    if (profundidad === 0 && l.includes('{')) {
      selector = l.slice(0, l.indexOf('{')).trim();
      enPaleta = ES_PALETA.test(selector);
    }
    profundidad += (l.match(/{/g) ?? []).length;
    profundidad -= (l.match(/}/g) ?? []).length;
    if (profundidad <= 0) { profundidad = 0; enMedia = ''; }

    // 1 · var(--que-no-existe, LITERAL): el respaldo manda siempre.
    for (const m of l.matchAll(/var\(\s*(--[\w-]+)\s*,\s*([^)]+)\)/g)) {
      // Un respaldo que es OTRA VARIABLE no rompe nada: cae en algo que si
      // existe y sigue el tema. Solo rompe el respaldo LITERAL.
      if (!DEFINIDAS.has(m[1]) && !m[2].includes('var(')) {
        fantasmas.push({ linea: i + 1, selector, variable: m[1], respaldo: m[2].trim() });
      }
    }
    if (enPaleta) return;

    const op = [...new Set(l.match(OPACO) ?? [])];
    const ve = (l.match(VELO) ?? []).length;
    const bajoTema = BAJO_TEMA.test(selector) || BAJO_TEMA.test(enMedia);
    if (op.length) (bajoTema ? conTema : rotas).push({ linea: i + 1, selector, que: op });
    if (ve) velos.push({ linea: i + 1, selector });
  });
  return { rotas, velos, conTema, fantasmas };
}

const r = analiza(fuente);

console.log('\n1 · VARIABLE QUE NO EXISTE, CON RESPALDO LITERAL — el respaldo gana siempre');
ok(r.fantasmas.length === 0, `${r.fantasmas.length} respaldos que mandan sobre el tema`,
  r.fantasmas.length ? 'aparentan seguir el tema y no lo siguen' : '');
for (const x of r.fantasmas) {
  console.log(`       styles.css:${String(x.linea).padStart(4)}  ${x.selector.slice(0, 30).padEnd(30)} var(${x.variable}, ${x.respaldo})`);
}

/**
 * EL TRINQUETE. Sesenta superficies son trece pantallas, y arreglarlas todas
 * en una version que es un arreglo corto seria cambiar sesenta reglas sin
 * poder mirar ninguna. Pero dejar la comprobacion roja es peor: un rojo que no
 * bloquea nada entrena a ignorar el rojo, y eso ya nos costo el de las vallas.
 *
 * Asi que la deuda se CONGELA: se declara lo que hay hoy y no puede crecer.
 * Rojo inmediato en cuanto alguien anada una; verde mientras se paga. Y el
 * numero va escrito aqui, a la vista, que es lo contrario de esconderlo.
 *
 * SE BAJA, NUNCA SE SUBE. Si tienes que subirlo, es que has anadido una.
 */
const DEUDA = 60;

console.log('\n2 · COLOR OPACO EN UNA REGLA QUE NO ESTÁ BAJO NINGÚN TEMA');
ok(r.rotas.length <= DEUDA, `${r.rotas.length} superficies fuera del tema (tope declarado: ${DEUDA})`,
  r.rotas.length > DEUDA ? 'HAS AÑADIDO UNA: se ve distinto en claro y en oscuro'
    : `deuda congelada; se baja, nunca se sube${r.rotas.length < DEUDA ? ` — BAJA EL TOPE A ${r.rotas.length}` : ''}`);
for (const x of r.rotas.slice(0, 30)) {
  console.log(`       styles.css:${String(x.linea).padStart(4)}  ${x.selector.slice(0, 42).padEnd(42)} ${x.que.join(' ')}`);
}
if (r.rotas.length > 30) console.log(`       … y ${r.rotas.length - 30} más`);

console.log('\n3 · LO QUE NO ROMPE, contado y no escondido');
console.log(`       velos translúcidos (rgba/hsla): ${r.velos.length}  — oscurecen igual en los dos temas`);
console.log(`       literales YA bajo un tema:      ${r.conTema.length}  — son la mitad clara de una pareja`);

console.log('\nCONTROL POSITIVO sobre el fichero real');
{
  const enfermo = fuente.replace('.pz-proc {', '.pz-proc { background: #f6f2ea;');
  ok(enfermo !== fuente, 'se ha podido inyectar la forma enferma en una regla real',
    enfermo === fuente ? '.pz-proc ha cambiado: ACTUALIZA ESTE CONTROL' : '');
  ok(analiza(enfermo).rotas.some((x) => x.selector.includes('pz-proc')),
    'y el cubo 2 lo caza', 'sin esto, el verde de arriba no diría nada');

  const fantasma = fuente.replace('.pz-proc {', '.pz-proc { background: var(--no-existe, #f6f2ea);');
  ok(analiza(fantasma).fantasmas.some((x) => x.selector.includes('pz-proc')),
    'y el cubo 1 caza el respaldo fantasma', 'que es la forma exacta del panel de Escena');

  const sano = fuente.replace('.pz-proc {', '.pz-proc { background: var(--slate-800);');
  ok(!analiza(sano).rotas.some((x) => x.selector.includes('pz-proc'))
    && !analiza(sano).fantasmas.some((x) => x.selector.includes('pz-proc')),
    'y una variable de verdad NO salta por ninguno de los dos',
    'si saltara, el detector no distinguiría la fuga del uso correcto');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
