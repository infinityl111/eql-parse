/**
 * Que una pantalla que revienta deje rastro.
 *
 * EL FALLO NO FUE EL ÁMBITO DE UNA VARIABLE, fue esto. Cada vista se
 * construye como una cadena y se asigna entera al final:
 *
 *     const cuerpo = `…${loQueSea()}…`;   // <- si esto lanza…
 *     host.innerHTML = cuerpo;            // <- …esto no llega
 *
 * Así que un error a mitad no deja media pantalla ni un hueco: deja la
 * pantalla anterior intacta. Pulsas y no pasa nada, y eso se lee como «esto
 * no está hecho», no como una avería. La 1.6.3 salió con dos de sus cuatro
 * partes sin verse por esto, y la aplicación no tenía ningún manejador de
 * errores: sin la consola abierta no quedaba señal en ninguna parte.
 *
 * LA RED DE SEGURIDAD SE PRUEBA, que si no es fe. Con un documento de
 * mentira: se le da algo que revienta y se comprueba que (a) devuelve HTML
 * en vez de propagar, y (b) deja una caja visible en el documento.
 */
import { crearFallo } from '../ui/fallo.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// Un documento de mentira con lo justo que toca `ui/fallo.js`.
function docFalso() {
  const nodos = new Map();
  const nuevo = (id = '') => {
    const n = {
      id, className: '', style: {}, onclick: null,
      hijos: [],
      set innerHTML(v) {
        this._html = v;
        // Los botones de dentro tienen que poder buscarse, como en el navegador.
        for (const m of String(v).matchAll(/id="([^"]+)"/g)) nodos.set(m[1], nuevo(m[1]));
      },
      get innerHTML() { return this._html ?? ''; },
    };
    return n;
  };
  const body = nuevo('body');
  return {
    body,
    createElement: () => nuevo(),
    getElementById: (id) => nodos.get(id) ?? null,
    _registra: (n) => nodos.set(n.id, n),
    _nodos: nodos,
  };
}

const idioma = (k) => ({
  'crash.title': 'Algo ha reventado',
  'crash.copy': 'Copiar',
  'crash.note': 'Esta parte no se ha podido pintar.',
  'crash.where': 'al pintar',
  'crash.async': 'en una tarea de fondo',
}[k] ?? k);

// ── 1. Lo que revienta devuelve HTML, no propaga ───────────────────────────
console.log('\nuna vista que revienta');
{
  const doc = docFalso();
  const original = doc.body.appendChild;
  doc.body.appendChild = (n) => { doc._registra(n); doc.body.hijos.push(n); return original; };
  const { pintar } = crearFallo({ doc, t: idioma, copiar: null });

  let html = null;
  let propago = false;
  try {
    html = pintar(() => { noExisteEstaFuncion(); }, 'Enciclopedia · hechizo');
  } catch { propago = true; }

  ok(!propago, 'no propaga: quien la llama sigue pudiendo asignar el innerHTML');
  ok(typeof html === 'string' && html.includes('crash-inline'),
    'y devuelve un bloque que ocupa el hueco', html ? html.slice(0, 40) : html);
  ok(html.includes('Enciclopedia · hechizo'), 'diciendo QUÉ vista falló');
  ok(doc.body.hijos.length === 1, 'y deja una caja en el documento', doc.body.hijos.length);
  const caja = doc.body.hijos[0];
  ok(caja.style.display === 'block', 'visible, no escondida', caja.style.display);
  ok(caja.innerHTML.includes('noExisteEstaFuncion'),
    'con el error dentro, que es lo único que sirve para arreglarlo');
}

// ── 2. Lo que no revienta pasa limpio ──────────────────────────────────────
console.log('\nuna vista que va bien');
{
  const doc = docFalso();
  doc.body.appendChild = (n) => { doc._registra(n); doc.body.hijos.push(n); };
  const { pintar } = crearFallo({ doc, t: idioma, copiar: null });
  const html = pintar(() => '<div>todo bien</div>', 'Enciclopedia · zonas');
  ok(html === '<div>todo bien</div>', 'devuelve lo suyo sin tocarlo', html);
  ok(doc.body.hijos.length === 0, 'y no monta ninguna caja');
}

// ── 3. El mismo fallo en ráfaga no reescribe la caja sesenta veces ─────────
console.log('\nel mismo fallo repetido');
{
  const doc = docFalso();
  doc.body.appendChild = (n) => { doc._registra(n); doc.body.hijos.push(n); };
  const { mostrar } = crearFallo({ doc, t: idioma, copiar: null });
  const err = new Error('lo mismo otra vez');
  const a = mostrar('sitio', err);
  const b = mostrar('sitio', err);
  ok(a !== null, 'la primera vez sale');
  ok(b === null, 'la segunda no repite: los repintados van en ráfaga');
  ok(doc.body.hijos.length === 1, 'y sigue habiendo una sola caja', doc.body.hijos.length);
}

// ── 4. El informe lleva la versión ─────────────────────────────────────────
console.log('\nel informe que se copia');
{
  const doc = docFalso();
  doc.body.appendChild = (n) => { doc._registra(n); doc.body.hijos.push(n); };
  let copiado = null;
  const { mostrar } = crearFallo({
    doc, t: idioma, copiar: (x) => { copiado = x; }, version: () => '1.7.1',
  });
  mostrar('Enciclopedia · progreso', new Error('vaya'));
  const boton = doc.getElementById('crashCopy');
  ok(!!boton, 'hay botón de copiar');
  boton.onclick();
  ok(copiado?.includes('1.7.1'), 'y lo copiado lleva la versión: sin ella no se reproduce',
    copiado?.split('\n')[0]);
  ok(copiado?.includes('Enciclopedia · progreso'), 'y dónde pasó');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
