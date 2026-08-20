#!/usr/bin/env node
/**
 * TODOS LOS CAMPOS DE TODAS LAS SECCIONES, TOCADOS UNO A UNO.
 *
 * `bin/campos-vivos.js` prueba los tres de Reapariciones. Esto recorre **las
 * quince secciones**, se mete en cada `<select>`, `<input>` y `<textarea>`, le
 * cambia el valor, deja pasar ocho repintados y mira si sigue ahí.
 *
 * Un campo que se borra al escribir no se distingue de uno que nunca recibió lo
 * escrito, y ninguno de los dos se distingue de «no lo he probado». Por eso se
 * prueban TODOS y se dice cuántos, en vez de mirar el que alguien mencionó.
 *
 * Uso:  node bin/campos-todos.js [--seccion=cronos]
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lanzar, espera, cdp, PUERTO } from './cdp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { FightStore } = await import(`file://${RAIZ.replace(/\\/g, '/')}/src/store.js`);
const SOLO = (process.argv.find((a) => a.startsWith('--seccion=')) ?? '').slice(10) || null;

const DATOS = path.join(os.tmpdir(), 'eql-campos-todos');
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
  return `${DIA[d.getDay()]} ${MES[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${
    d.toTimeString().slice(0, 8)} ${d.getFullYear()}`;
};

const LOG = path.join(DATOS, 'eqlog_Todos_erudin.txt');
fs.writeFileSync(LOG, [
  `[${hace(7200)}] Logging to 'eqlog.txt' is now *ON*.`,
  `[${hace(7195)}] You have entered ${BASE} 2 (Adaptive).`,
  `[${hace(600)}] You slash uno for 120 points of damage.`,
  `[${hace(595)}] uno hits YOU for 40 points of damage.`,
  `[${hace(590)}] You have slain uno!`,
  `[${hace(300)}] You slash dos for 90 points of damage.`,
  `[${hace(290)}] You have slain dos!`,
  '',
].join('\r\n'));

new FightStore(DATOS).stamp();   // sin sello, el cartel tapa la pantalla entera
fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify({
  ...JSON.parse(fs.readFileSync(REAL, 'utf8')),
  lang: 'es',
  cronos: [{ nombre: 'uno', base: BASE, diff: 2, mode: null, manual: 1800 }],
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

for (let i = 0; i < 60; i++) {
  if (await lee(`!!document.querySelector('[data-sec]')`)) break;
  await espera(500);
}
const SECCIONES = (await lee(
  `[...document.querySelectorAll('[data-sec]')].map((e) => e.dataset.sec)`)) ?? [];
console.log(`\nTODOS LOS CAMPOS · ${SECCIONES.length} secciones\n`);

let mal = 0;
let probados = 0;
const rotos = [];

/**
 * UN VALOR QUE NO ES EL QUE HABÍA. Poner el mismo no prueba nada: si el campo
 * se reconstruyera con su valor de siempre, saldría verde igual.
 */
const nuevoValor = (tipo, actual) => {
  if (tipo === 'select') return null;                 // se resuelve mirando sus opciones
  if (tipo === 'checkbox' || tipo === 'radio') return null;
  if (tipo === 'range' || tipo === 'number') return null;
  return actual === 'zzTest' ? 'zzOtro' : 'zzTest';
};

for (const sec of SECCIONES) {
  if (SOLO && sec !== SOLO) continue;
  await lee(`document.querySelector('[data-sec=${JSON.stringify(sec).slice(1, -1)}]')?.click()`);
  await espera(900);

  const campos = (await lee(`(() => {
    // VISIBLE es lo que distingue una seccion de otra: las ocultas tienen alto
    // cero, y un campo de alto cero no lo puede tocar nadie.
    return [...document.querySelectorAll('input, select, textarea')]
      .filter((e) => e.offsetHeight > 0)
      .map((e, i) => ({ i, tag: e.tagName.toLowerCase(), tipo: e.type ?? '', id: e.id ?? '',
        cls: e.className ?? '', valor: e.value ?? '',
        ops: e.tagName === 'SELECT' ? [...e.options].map((o) => o.value) : null }));
  })()`)) ?? [];

  if (!campos.length) continue;
  console.log(`  ${sec} — ${campos.length} campo(s)`);

  for (const c of campos) {
    const tipo = c.tag === 'select' ? 'select' : c.tipo;
    let destino = nuevoValor(tipo, c.valor);
    if (tipo === 'select') {
      const otra = (c.ops ?? []).find((o) => o !== c.valor);
      if (!otra) continue;                            // una sola opción: nada que cambiar
      destino = otra;
    }
    if (destino === null) continue;                   // casillas y deslizadores, aparte

    probados += 1;
    // Se busca por posición dentro de la MISMA lista, que es lo único estable:
    // los identificadores se repiten entre secciones y las clases también.
    const sel = `[...document.querySelectorAll('input, select, textarea')].filter((e) => e.offsetHeight > 0)[${c.i}]`;
    await lee(`(() => { const e = ${sel}; if (!e) return null;
      e.focus(); e.value = ${JSON.stringify(destino)};
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return e.value; })()`);
    await espera(2400);                               // ocho repintados de 250 ms
    const ahora = await lee(`(() => { const e = ${sel}; return e ? e.value : '(ya no existe)'; })()`);
    const bien = ahora === destino;
    if (!bien) {
      mal += 1;
      rotos.push({ sec, campo: c.id || c.cls || `${c.tag}#${c.i}`, tipo, puse: destino, hay: ahora });
    }
    console.log(`     ${bien ? 'ok  ' : 'MAL '} ${(c.id || c.cls || c.tag).slice(0, 34).padEnd(34)} ${
      tipo.padEnd(8)} ${bien ? '' : `puse «${destino}», hay «${ahora}»`}`);
  }
}

console.log(`\n${probados} campos probados · ${mal} pierden lo escrito`);
if (rotos.length) {
  console.log('');
  for (const r of rotos) console.log(`  ${r.sec} · ${r.campo} (${r.tipo}) — puse «${r.puse}», hay «${r.hay}»`);
}
console.log('');
fin(mal ? 1 : 0);
