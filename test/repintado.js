/**
 * DESPUÉS DE UNA ESPERA, EL DOM PUEDE NO SER EL QUE ESCRIBISTE.
 *
 * ── EL FALLO, QUE PASÓ DE VERDAD ──────────────────────────────────────────
 *
 * De una captura de la aplicación en uso:
 *
 *     TypeError: Cannot read properties of null (reading 'remove')
 *     ui/app.js:3474:8
 *
 * ── Y LA PRIMERA EXPLICACIÓN QUE ESCRIBÍ ERA FALSA ────────────────────────
 *
 * Escribí que el elemento se cogía ANTES de la espera y se usaba DESPUÉS. Con
 * el fichero delante, no: la espera está arriba y la captura debajo. El orden
 * real es
 *
 *     host.innerHTML = `... <div id="rpCarga"> ...`;   <- lo escribe
 *     const r = await window.eql.logContext(...);      <- espera
 *     const caja = host.querySelector('#rpCarga');     <- lo busca: ya no está
 *     caja.remove();                                   <- revienta
 *
 * `querySelector` devuelve null EN EL ACTO. Lo que la espera separa no es la
 * captura del uso: separa el `innerHTML` que escribió el elemento de la
 * captura que lo busca. Durante ella, cualquier otro repintado sustituyó el
 * contenido de `host`.
 *
 * Esto importa para la prueba, no sólo para el relato: con la teoría falsa el
 * detector daba CERO sobre el fichero enfermo — o sea, habría entrado en verde
 * sin vigilar nada.
 *
 * La guarda que ya había —`if (host.dataset.sig !== sig) return`— no cubre
 * esto: atrapa que te hayas ido a OTRA sección, no que se haya repintado LA
 * MISMA. Y el agujero estaba en las DOS ramas: `caja.classList` de abajo tenía
 * el mismo, y ésa es la que se ve cuando el registro no da líneas.
 *
 * ── LA REGLA QUE SE VIGILA ────────────────────────────────────────────────
 *
 *     DENTRO DE UNA FUNCIÓN ASÍNCRONA, UNA VEZ QUE HA HABIDO UN `await`, TODO
 *     LO QUE SE SAQUE DEL DOM SE COMPRUEBA ANTES DE USARLO.
 *
 * Antes de la primera espera no hace falta: el `innerHTML` de arriba garantiza
 * que está. Después, no lo garantiza nadie.
 *
 * ── POR QUÉ MIRA EL FUENTE Y NO EJECUTA NADA ──────────────────────────────
 *
 * No hay DOM en las pruebas de este proyecto, así que el repintado no se puede
 * reproducir. Pero el fallo no es de ese elemento: es de una FORMA de escribir,
 * y una forma sí se vigila en el fuente. Arreglar sólo la línea 3491 dejaría el
 * patrón vivo en los demás sitios.
 *
 *     LO QUE SE FIJA AQUÍ ES EL CASO, NO LA GUARDA.
 *
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO, no un observable: decide qué cuenta como
 * «comprobado» y dónde empieza y acaba un ámbito. Si se pone roja hay que
 * leerla, no acallarla.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sangria = (l) => l.length - l.trimStart().length;

/** Abre ámbito: función suelta, o retrollamada anidada `async (...) => {`. */
const ABRE = /^\s*(async\s+)?function\s+\w+|^\s*(?:const|let)\s+\w+\s*=\s*(async\s*)?\(|(async\s*)\([^)]*\)\s*=>|(async\s*)\w+\s*=>/;

/**
 * Elementos del DOM usados tras una espera sin comprobar que siguen ahí.
 *
 * Los ámbitos se llevan por SANGRÍA y no contando llaves, porque el fuente está
 * lleno de plantillas con `${...}` y contar llaves cuenta también las suyas.
 * Vale porque el fichero tiene sangría uniforme; si algún día deja de tenerla,
 * el control de abajo lo dirá.
 */
function sospechosos(fuente) {
  const L = fuente.replace(/\r/g, '').split('\n');
  const fuera = [];
  const pila = [{ sang: -1, esAsync: false, huboAwait: false, capturados: new Map() }];

  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (/^\s*\*/.test(l) || /^\s*\/\*/.test(l) || !l.trim()) continue;
    const codigo = l.replace(/\/\/.*$/, '');
    const s = sangria(l);

    // Se cierra todo ámbito cuya apertura estaba a esta sangría o más adentro.
    while (pila.length > 1 && s <= pila[pila.length - 1].sang) pila.pop();

    if (ABRE.test(codigo)) {
      pila.push({ sang: s, esAsync: /\basync\b/.test(codigo), huboAwait: false, capturados: new Map() });
      continue;
    }

    const m = pila[pila.length - 1];
    if (!m.esAsync) continue;
    if (/\bawait\b/.test(codigo)) m.huboAwait = true;

    const cap = /(?:const|let)\s+(\w+)\s*=\s*(?:[\w.$]*\.(?:querySelector|getElementById)\(|\$\()/.exec(codigo);
    if (cap) { m.capturados.set(cap[1], { linea: i + 1, tras: m.huboAwait, comprobado: false }); continue; }

    for (const [nom, v] of m.capturados) {
      const n = esc(nom);
      // Comprobarlo cuenta: `if (!x)`, `if (x)`, `x?.`, `x &&`, `x ||`
      if (new RegExp(`if \\(!?${n}[\\s)]`).test(codigo) || new RegExp(`${n}\\s*(\\?\\.|&&|\\|\\|)`).test(codigo)) v.comprobado = true;
      if (!v.tras || v.comprobado) continue;
      if (new RegExp(`\\b${n}\\.\\w`).test(codigo)) {
        fuera.push({ nom, cogido: v.linea, usado: i + 1, txt: l.trim().slice(0, 64) });
        v.comprobado = true;      // se avisa una vez por variable, no veinte
      }
    }
  }
  return fuera;
}

const APP = fs.readFileSync(path.join(RAIZ, 'ui', 'app.js'), 'utf8');

console.log('\nningún elemento del DOM se usa tras una espera sin comprobarlo');
{
  const malos = sospechosos(APP);
  ok(malos.length === 0, 'ui/app.js: cero usos sin comprobar tras una espera',
    malos.length ? malos.map((m) => `${m.nom} (${m.cogido}→${m.usado})`).join(', ') : '0');
  malos.forEach((m) => console.log(`        ${m.usado}: ${m.txt}`));
}

/**
 * ── EL CONTROL, SOBRE EL FICHERO REAL ─────────────────────────────────────
 *
 * Sin esto, el cero de arriba pasa en verde con un detector que no encuentre
 * nada nunca — que es literalmente lo que pasó con la primera versión. Así que
 * no se le da un caso de juguete: se le da `ui/app.js` con la guarda de
 * `renderReplay` quitada, o sea el fichero tal como estaba el día que reventó,
 * y tiene que cazarlo.
 *
 * Si algún día no se encuentra la guarda para quitarla, esto se pone rojo. Es
 * lo correcto: significa que el control ya no está probando lo que dice.
 */
console.log('\nCONTROL: el detector caza el fallo original en el fichero real');
{
  const L = APP.replace(/\r/g, '').split('\n');
  const iCap = L.findIndex((x) => x.includes("const caja = host.querySelector('#rpCarga')"));
  const anclado = iCap >= 0 && /^\s*if \(!caja\) return;/.test(L[iCap + 1] ?? '');
  ok(anclado, 'CONTROL: se localiza la guarda de renderReplay para poder quitarla',
    anclado ? `línea ${iCap + 2}` : 'NO ENCONTRADA — este control ya no prueba nada');

  if (anclado) {
    const enfermo = [...L.slice(0, iCap + 1), ...L.slice(iCap + 2)].join('\n');
    const cazados = sospechosos(enfermo);
    const caja = cazados.filter((c) => c.nom === 'caja');
    ok(caja.length === 1, 'CONTROL: sin la guarda, caza «caja»',
      cazados.map((c) => `${c.nom}@${c.usado}`).join(', ') || 'NADA — EL DETECTOR NO SIRVE');
    ok(cazados.length === 1, 'CONTROL: y no caza nada más — no es un aviso constante',
      `${cazados.length}`);
  }
}

/**
 * Y los tres casos de forma, que fijan dónde está la frontera de la regla.
 */
console.log('\nCONTROL: la frontera de la regla');
{
  const tras = `
async function f(host) {
  const r = await pide();
  const caja = host.querySelector('#x');
  caja.remove();
}`;
  ok(sospechosos(tras).length === 1, 'cogido DESPUÉS de una espera y usado sin comprobar: avisa');

  const antes = `
async function f(host) {
  host.innerHTML = '<i id="x"></i>';
  const caja = host.querySelector('#x');
  caja.remove();
  const r = await pide();
  return r;
}`;
  ok(sospechosos(antes).length === 0,
    'cogido ANTES de cualquier espera y usado seguido: NO avisa — lo acaba de escribir');

  const sinEspera = `
function f(host) {
  const caja = host.querySelector('#x');
  caja.remove();
}`;
  ok(sospechosos(sinEspera).length === 0, 'función que no espera: NO avisa');

  /**
   * El anidado es el que me dio un falso positivo: una `async () => {}` dentro
   * de otra función que sí había esperado heredaba su espera, y avisaba de un
   * elemento que el `pintar()` de la línea de arriba acababa de escribir.
   */
  const anidado = `
async function f() {
  const r = await pide();
  $('bot').addEventListener('click', async () => {
    const b = $('bot');
    b.disabled = true;
  });
}`;
  ok(sospechosos(anidado).length === 0,
    'la espera de la función de fuera NO se hereda dentro de una retrollamada');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
