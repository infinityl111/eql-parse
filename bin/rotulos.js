#!/usr/bin/env node
/**
 * ¿QUÉ RÓTULOS PUEDE PRODUCIR DE VERDAD UNA SECCIÓN?
 *
 * ── POR QUÉ NO BASTA CON QUE ESTÉN REFERENCIADOS ──────────────────────────
 *
 * `cro.retenido` estaba referenciado en `ui/app.js` y llevaba meses siendo
 * **inalcanzable**: su rama iba detrás de un `if (!valor)` que siempre se
 * cumplía. Un barrido de referencias lo daba por vivo. Las 39 claves `cro.*`
 * están referenciadas; eso no distingue nada.
 *
 *     UN RÓTULO QUE NINGUNA PRUEBA PUEDE HACER APARECER ES UN RÓTULO MUERTO.
 *
 * ── SE EMPAREJA POR CLAVE, NO POR TEXTO ───────────────────────────────────
 *
 * La primera versión buscaba el texto del diccionario dentro de lo pintado, y
 * eso **no puede funcionar**:
 *
 *   · el CSS pone los botones en mayúsculas — el diccionario dice «Cerrar» y la
 *     pantalla dice «CERRAR»;
 *   · un rótulo con interpolación —`según {pagina}`— sale con un valor dentro
 *     que no está en el diccionario, así que **jamás** casa;
 *   · y normalizar más —minúsculas, acentos, espacios— es perseguir al
 *     traductor en vez de dejar de traducir.
 *
 * Así que `t()` lleva un gancho apagado por defecto: con `__ROTULOS__` puesto
 * anota **la clave y el texto que de verdad produjo**. Emparejar por clave es
 * comparar por identidad; comparar textos es comparar apariencias.
 *
 * ── TRES CUBOS, NO DOS ────────────────────────────────────────────────────
 *
 * «No alcanzado» y «muerto» no son lo mismo, y mezclarlos invita a retirar algo
 * vivo. Lo que esta sonda no ejercita va DECLARADO abajo con su motivo.
 *
 * Uso:  node bin/rotulos.js [prefijo]        (por defecto `cro.`)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador } from './cdp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Sólo los argumentos DE VERDAD: `argv[0]` es la ruta de node y `argv[1]` la de
// este fichero, y las dos llevan puntos dentro. Cogiendo el primero que casara,
// el prefijo salía la ruta del ejecutable de node.
const PREFIJO = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'cro.';
const { FightStore } = await import(`file://${RAIZ.replace(/\\/g, '/')}/src/store.js`);

// ── 1 · Un rincón propio: ni el almacén ni la configuración de nadie ───────
/**
 * LA CARPETA QUE SE LE PASA A `--user-data-dir` **ES** `userData`. Lo supuse al
 * revés y la aplicación arrancaba en el asistente: 39 de 39 muertos, incluidos
 * los que se veían en pantalla. Lo soltó listar la carpeta, no deducir.
 */
const DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-rotulos-'));
const AHORA = Math.floor(Date.now() / 1000);
const BASE = "Nagafen's Lair";

const store = new FightStore(DATOS);
store.self = 'Campeon';
const pelea = (hace, kills, killTimes, diff = 2) => store.append({
  zone: `${BASE} ${diff} (Adaptive)`, zoneBase: BASE, diff, diffTag: 'Adaptive',
  duration: 60, total: 1000, start: AHORA - hace, kills, killTimes,
  rows: [{ name: 'Campeon', side: 'ally' }, ...[...new Set(kills)].map((k) => ({ name: k, side: 'enemy' }))],
}, (AHORA - hace) * 1000);

pelea(60 * 60, ['contando'], [{ name: 'contando', t: 5 }]);
pelea(30 * 60, ['contando'], [{ name: 'contando', t: 5 }]);
pelea(48 * 3600, ['vencido'], [{ name: 'vencido', t: 5 }]);
pelea(2 * 3600, ['variosDemostrado', 'variosDemostrado'],
  [{ name: 'variosDemostrado', t: 5 }, { name: 'variosDemostrado', t: 40 }]);
for (const h of [20, 16, 12, 8]) pelea(h * 3600, ['conObs'], [{ name: 'conObs', t: 5 }]);

const CRONOS = [
  { nombre: 'contando', base: BASE, diff: 2, mode: null },
  { nombre: 'vencido', base: BASE, diff: 2, mode: null },
  { nombre: 'nuncaMuerto', base: BASE, diff: 2, mode: null },
  { nombre: 'variosDemostrado', base: BASE, diff: 2, mode: null, aviso: 'varios-a-la-vez' },
  { nombre: 'quizaVarios', base: BASE, diff: 2, mode: null, aviso: 'probablemente-varios', muertes: 14 },
  { nombre: 'conObs', base: BASE, diff: 2, mode: null },
  { nombre: 'conManual', base: BASE, diff: 2, mode: null, manual: 900 },
  { nombre: 'sinZona', base: null, diff: null, mode: null },
];

/** La configuración se COPIA de la real: escrita de cero, sale el asistente. */
const REAL = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'config.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'config.json'),
].find((f) => fs.existsSync(f));
if (!REAL) {
  console.error('\nSin configuración real de la que partir, la aplicación arranca en');
  console.error('el asistente y esta comprobación no mide nada.\n');
  process.exit(3);
}
/** Y el registro pequeño: con el de 114 MB el motor no engancha antes de mirar. */
const LOG = path.join(DATOS, 'eqlog_Prueba_erudin.txt');
fs.writeFileSync(LOG, [
  "[Tue Aug 04 11:04:10 2026] Logging to 'eqlog.txt' is now *ON*.",
  `[Tue Aug 04 11:04:15 2026] You have entered ${BASE} 2 (Adaptive).`,
  '[Tue Aug 04 11:04:20 2026] You have slain contando!',
  '',
].join('\r\n'));
/** Y el almacén SELLADO: sin sello sale el cartel de histórico viejo y tapa todo. */
store.stamp();
fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify({
  ...JSON.parse(fs.readFileSync(REAL, 'utf8')), lang: 'es', cronos: CRONOS, path: LOG,
}, null, 1));

// ── 2 · Las claves a vigilar ───────────────────────────────────────────────
const i18n = fs.readFileSync(path.join(RAIZ, 'src', 'i18n.js'), 'utf8');
const es = i18n.slice(i18n.indexOf('const ES = {'), i18n.indexOf('const EN = {'));
const rePref = PREFIJO.replace(/\./g, '\\.');
const CLAVES = [...new Set([...es.matchAll(new RegExp(`'(${rePref}[a-zA-Z0-9.]+)'`, 'g'))].map((m) => m[1]))];

/**
 * LO QUE ESTA SONDA NO EJERCITA, declarado con su motivo.
 * No son muertos: son SIN PROBAR, y llamarlos muertos invitaría a retirarlos.
 */
const NO_EJERCITADOS = {
  'cro.escBoton': 'el panel de Escena necesita una pelea abierta; el registro de prueba no la tiene',
  'cro.escTitulo': 'ídem', 'cro.escSub': 'ídem', 'cro.escNoMurio': 'ídem',
  'cro.escYaEsta': 'ídem', 'cro.escDosVeces': 'ídem', 'cro.escMurio': 'ídem',
  'cro.escEncantado': 'ídem', 'cro.escPoner': 'ídem', 'cro.escVacio': 'ídem',
  'cro.vacio': 'hace falta CERO temporizadores; la sonda abre ocho a propósito',
};

// ── 3 · Levantar la aplicación de verdad ───────────────────────────────────
if (!(await puertoLibre())) { console.error(`\nPuerto ${PUERTO} ocupado.\n`); process.exit(2); }
const hijo = lanzar([`--user-data-dir=${DATOS}`]);
const pagina = await conecta();
const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
await listo;
const evalua = evaluador(manda);
const fin = (c) => {
  try { ws.close(); } catch { /* ya */ }
  hijo.kill();
  try { fs.rmSync(DATOS, { recursive: true, force: true }); } catch { /* da igual */ }
  process.exit(c);
};

let producidos = [];
let pintado = '';
try {
  await manda('Runtime.enable');
  await espera(3000);
  // El cesto se pone ANTES de navegar: lo que se anota es lo que se pinta desde
  // aquí, no lo que ya estaba.
  await evalua('window.__ROTULOS__ = []');
  for (const sec of ['cronos', 'escena']) {
    await evalua(`document.querySelector('[data-sec=${sec}]')?.click()`);
    await espera(5000);
    if (sec === 'escena') { await evalua("document.querySelector('#croEscBtn')?.click()"); await espera(1500); }
    // LO PINTADO SE ACUMULA POR SECCIÓN. Capturándolo sólo al final, el DOM
    // enseñaba Escena y TODOS los rótulos de Reapariciones salían «producidos y
    // no llegan a pantalla» — incluido el encabezado, que estaba a la vista un
    // momento antes. Cada sección se lleva su foto.
    pintado += await evalua(`(() => {
    const t = [document.body.innerText];
    for (const e of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
      t.push(e.getAttribute('placeholder') || '', e.getAttribute('title') || '', e.getAttribute('aria-label') || '');
    }
    return t.join(String.fromCharCode(10));
  })()`) + String.fromCharCode(10);
  }
  producidos = JSON.parse(await evalua('JSON.stringify(window.__ROTULOS__ || [])'));
} catch (e) { console.error('\n', e?.message ?? e, '\n'); }

// ── 4 · El veredicto, por CLAVE ────────────────────────────────────────────
const baja = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const lienzo = baja(pintado);
const textoDe = new Map();
for (const [k, s] of producidos) if (!textoDe.has(k) || String(s).length > String(textoDe.get(k)).length) textoDe.set(k, s);

const enPantalla = [], soloProducidos = [], sinProbar = [], sinCaso = [];
for (const k of CLAVES) {
  if (textoDe.has(k)) {
    const s = baja(textoDe.get(k));
    (s && lienzo.includes(s) ? enPantalla : soloProducidos).push([k, textoDe.get(k)]);
  } else if (k in NO_EJERCITADOS) sinProbar.push([k, NO_EJERCITADOS[k]]);
  else sinCaso.push([k, '']);
}

/**
 * EL CANARIO, y hacen falta dos. `cro.title` sólo prueba que la sección puso su
 * encabezado; `cro.close` va en el botón de CADA ficha, así que prueba que las
 * fichas se pintaron, que es donde vive casi todo lo que se mide.
 */
const vivo = (k) => enPantalla.some(([x]) => x === k) || soloProducidos.some(([x]) => x === k);
if (!producidos.length || !vivo(`${PREFIJO}close`)) {
  console.error('\nESTA COMPROBACIÓN NO ESTÁ MIDIENDO NADA.\n');
  console.error(producidos.length
    ? `«${PREFIJO}close» va en el botón de cada ficha: si la sección pinta, se produce.`
    : 'El gancho de `t()` no anotó ni una clave: la sección no llegó a pintarse.');
  console.error('NO se publica ningún recuento.\n');
  console.error('Lo que se vio en pantalla, en crudo:');
  console.error(JSON.stringify(lienzo.slice(0, 500)));
  console.error('');
  fin(1);
}

console.log(`\nclaves «${PREFIJO}» en el diccionario: ${CLAVES.length}\n`);
console.log(`${enPantalla.length} SALEN A PANTALLA — producidas y encontradas en lo pintado`);
console.log(`${soloProducidos.length} SE PRODUCEN Y NO LLEGAN A LA PANTALLA:`);
for (const [k, s] of soloProducidos) console.log(`   ${k.padEnd(22)} «${String(s).slice(0, 46)}»`);
console.log(`\n${sinProbar.length} que esta sonda NO EJERCITA (no es lo mismo que muertos):`);
for (const [k, p] of sinProbar) console.log(`   ${k.padEnd(22)} ${p}`);
console.log(`\n${sinCaso.length} SIN NINGÚN CASO QUE LOS GENERE — los muertos de verdad:`);
for (const [k] of sinCaso) console.log(`   ${k}`);
console.log('\nCada uno de ésos o falta por implementar, o sobra por retirar.');
console.log('Lo que NO puede es seguir sin distinguirse de los vivos.\n');
fin(0);
