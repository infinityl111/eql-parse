#!/usr/bin/env node
/**
 * LOS CAMPOS DE LA SECCIÓN, TOCADOS DE VERDAD.
 *
 * `bin/ui-teclear.js` prueba UN campo de texto. Aquí se prueban los tres tipos
 * que tiene la sección y que el repintado puede pisar de tres maneras distintas:
 *
 *   · el buscador       — texto, siempre visible
 *   · el desplegable    — su valor NO lo conserva `devuelveFoco`, que sólo mira
 *                         `input, textarea`: tiene que venir del modelo
 *   · el campo de dentro de una fila — vive en un `<details>` que además puede
 *                         cerrarse solo al repintar
 *
 * Un campo que se borra al escribir y uno que vuelve a su valor por defecto se
 * ven distinto y se arreglan distinto. Por eso se miran los tres por separado.
 *
 * Uso:  node bin/campos-vivos.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lanzar, espera, cdp, PUERTO } from './cdp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { FightStore } = await import(`file://${RAIZ.replace(/\\/g, '/')}/src/store.js`);

const DATOS = path.join(os.tmpdir(), 'eql-campos-vivos');
const REAL = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'config.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'config.json'),
].find((f) => fs.existsSync(f));
if (!REAL) { console.error('\nSin configuración real de la que partir.\n'); process.exit(3); }

fs.rmSync(DATOS, { recursive: true, force: true });
fs.mkdirSync(DATOS, { recursive: true });

const BASE = "Nagafen's Lair";
const DIA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hace = (seg) => {
  const d = new Date(Date.now() - seg * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  return `${DIA[d.getDay()]} ${MES[d.getMonth()]} ${dd} ${d.toTimeString().slice(0, 8)} ${d.getFullYear()}`;
};

const LOG = path.join(DATOS, 'eqlog_Campos_erudin.txt');
fs.writeFileSync(LOG, [
  `[${hace(7200)}] Logging to 'eqlog.txt' is now *ON*.`,
  `[${hace(7195)}] You have entered ${BASE} 2 (Adaptive).`,
  `[${hace(600)}] You slash uno for 120 points of damage.`,
  `[${hace(590)}] You have slain uno!`,
  `[${hace(300)}] You slash dos for 90 points of damage.`,
  `[${hace(290)}] You have slain dos!`,
  '',
].join('\r\n'));

/**
 * EL ALMACEN, SELLADO.
 *
 * Sin sello sale el cartel de «tu historico lo escribio otra version» y TAPA LA
 * PANTALLA ENTERA: la seccion no se abre y todos los campos salen a cero, como
 * si estuvieran rotos. Era una de las cinco causas de `bin/rotulos.js`, y esta
 * sonda la ha repetido — lo que pasa cuando una leccion vive en un fichero
 * suelto en vez de en una pieza comun.
 */
new FightStore(DATOS).stamp();

fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify({
  ...JSON.parse(fs.readFileSync(REAL, 'utf8')),
  lang: 'es',
  cronos: [
    { nombre: 'uno', base: BASE, diff: 2, mode: null, manual: 1800 },
    { nombre: 'dos', base: BASE, diff: 2, mode: null, manual: 1800 },
  ],
  logPath: LOG,
}, null, 2));

const hijo = lanzar([`--user-data-dir=${DATOS}`]);
const fin = (c) => { try { hijo.kill(); } catch { /* ya no está */ } process.exit(c); };

let ficha = null;
for (let i = 0; i < 60 && !ficha; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    ficha = l.find((x) => x.url.includes('index.html'));
  } catch { /* todavía no ha levantado */ }
  if (!ficha) await espera(500);
}
if (!ficha) { console.error('la aplicación no levantó'); fin(1); }

const cli = cdp(ficha.webSocketDebuggerUrl);
await cli.listo;
const lee = async (js) => (await cli.manda('Runtime.evaluate', {
  expression: js, returnByValue: true, awaitPromise: true,
}))?.result?.value;

// A la sección, y a esperar a que pinte sus filas.
// A LA BARRA LATERAL HAY QUE ESPERARLA: pulsar antes de que exista no falla,
// no hace nada — y entonces todo lo de abajo mide la pantalla equivocada.
for (let i = 0; i < 60; i++) {
  if (await lee(`!!document.querySelector('[data-sec=cronos]')`)) break;
  await espera(500);
}
await lee(`document.querySelector('[data-sec=cronos]')?.click()`);
for (let i = 0; i < 60; i++) {
  if (await lee(`document.querySelectorAll('.pz-fila').length`)) break;
  await espera(500);
}
if (!await lee(`document.querySelectorAll('.pz-fila').length`)) {
  console.error('\\nLa seccion no pinto ni una fila: no hay campos que probar.');
  console.error('Mira si hay un cartel tapandola — el del historico viejo lo hace.\\n');
  fin(1);
}

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** Espera `n` repintados: el snapshot llega cada 250 ms. */
const tics = (n) => espera(n * 300);

console.log('\nLOS CAMPOS DE REAPARICIONES, tocados de verdad\n');

console.log('el desplegable de agrupar');
{
  const antes = await lee(`document.querySelector('.pz-agrupar')?.value ?? null`);
  ok(antes !== null, 'existe', `valor inicial «${antes}»`);
  await lee(`(() => { const s = document.querySelector('.pz-agrupar');
    s.value = 'nada'; s.dispatchEvent(new Event('input', { bubbles: true })); return s.value; })()`);
  await tics(8);
  const luego = await lee(`document.querySelector('.pz-agrupar')?.value ?? null`);
  ok(luego === 'nada', 'conserva lo elegido tras ocho repintados',
    `esperaba «nada», hay «${luego}»`);
  const grupos = await lee(`document.querySelectorAll('.pz-grupo').length`);
  ok(grupos === 0, 'y agrupar DE VERDAD deja de agrupar', `${grupos} cabeceras de grupo`);
}

console.log('\nel campo de poner tiempo, dentro de una fila');
{
  await lee(`(() => { const d = document.querySelector('details.pz-fila');
    if (d) d.open = true; return !!d; })()`);
  await tics(2);
  const hay = await lee(`document.querySelectorAll('.cro-in').length`);
  ok(hay > 0, 'la fila desplegada enseña su campo', `${hay} campos`);
  if (hay) {
    await lee(`(() => { const i = document.querySelector('.cro-in');
      i.focus(); i.value = '12:34';
      i.dispatchEvent(new Event('input', { bubbles: true })); return i.value; })()`);
    await tics(8);
    const v = await lee(`document.querySelector('.cro-in')?.value ?? null`);
    ok(v === '12:34', 'y lo escrito sobrevive a ocho repintados', `hay «${v}»`);
    const abierta = await lee(`!!document.querySelector('details.pz-fila')?.open`);
    ok(abierta, 'y la fila sigue desplegada', 'si se cierra, el campo desaparece con ella');
  }
}

console.log('\nel campo de añadir, en la otra pestaña');
{
  await lee(`[...document.querySelectorAll('.pz-pest button')][1]?.click()`);
  await tics(2);
  const visible = await lee(`(() => { const i = document.getElementById('croNuevo');
    return !!i && i.offsetHeight > 0; })()`);
  ok(visible, 'la pestaña de alta enseña su campo');
  if (visible) {
    await lee(`(() => { const i = document.getElementById('croNuevo');
      i.focus(); i.value = 'a kobold king';
      i.dispatchEvent(new Event('input', { bubbles: true })); return i.value; })()`);
    await tics(8);
    const v = await lee(`document.getElementById('croNuevo')?.value ?? null`);
    ok(v === 'a kobold king', 'y lo escrito sobrevive', `hay «${v}»`);
    const pest = await lee(`document.querySelector('.pz-pest button[aria-selected="true"]')?.dataset.ir ?? null`);
    ok(pest === 'sug', 'y la pestaña no se vuelve sola a la primera', `está en «${pest}»`);
  }
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
fin(mal ? 1 : 0);
