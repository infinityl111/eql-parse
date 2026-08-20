#!/usr/bin/env node
/**
 * TODOS LOS CAMPOS DE TODAS LAS SECCIONES, TOCADOS UNO A UNO.
 *
 * El aviso fue «los select y textfield están fallando», sin decir cuáles.
 * Probar el que uno supone es contestar a la suposición, así que esto recorre
 * las quince secciones, toca cada `<select>`, `<input>` y `<textarea>` visible,
 * deja pasar ocho repintados y mira si sigue lo escrito.
 *
 *     UN INFORME DE FALLOS SIN DENOMINADOR NO DICE CUÁNTO SE HA MIRADO.
 *
 * Por eso el resultado es una fracción —«1 de 22, en 15 secciones»— y no «hay
 * un campo roto». «Encontré uno» y «sólo miré uno» se leen igual y llevan a
 * decisiones opuestas.
 *
 * Uso:  npm run campos          ·  node bin/campos-todos.js [--seccion=cronos]
 */
import { arrancaListo, hace, espera } from './sonda.js';

const SOLO = (process.argv.find((a) => a.startsWith('--seccion=')) ?? '').slice(10) || null;
const BASE = "Nagafen's Lair";

const { lee, fin } = await arrancaListo({
  nombre: 'eql-campos-todos',
  vivo: 'uno',
  registro: [
    `[${hace(7200)}] Logging to 'eqlog.txt' is now *ON*.`,
    `[${hace(7195)}] You have entered ${BASE} 2 (Adaptive).`,
    `[${hace(600)}] You slash uno for 120 points of damage.`,
    `[${hace(595)}] uno hits YOU for 40 points of damage.`,
    `[${hace(590)}] You have slain uno!`,
    `[${hace(300)}] You slash dos for 90 points of damage.`,
    `[${hace(290)}] You have slain dos!`,
  ],
  config: {
    cronos: [{ nombre: 'uno', base: BASE, diff: 2, mode: null, manual: 1800 }],
  },
});

const SECCIONES = (await lee(
  `[...document.querySelectorAll('[data-sec]')].map((e) => e.dataset.sec)`)) ?? [];
console.log(`\nTODOS LOS CAMPOS · ${SECCIONES.length} secciones\n`);

/** VISIBLE es lo que distingue una sección de otra: las ocultas miden cero. */
const LISTA = "[...document.querySelectorAll('input, select, textarea')].filter((e) => e.offsetHeight > 0)";

let mal = 0;
let probados = 0;
const rotos = [];

/**
 * UN VALOR QUE NO ES EL QUE HABÍA. Poner el mismo no prueba nada: un campo que
 * se reconstruyera con su valor de siempre saldría verde igual.
 */
const nuevoValor = (tipo, actual) => {
  if (['select', 'checkbox', 'radio', 'range', 'number'].includes(tipo)) return null;
  return actual === 'zzTest' ? 'zzOtro' : 'zzTest';
};

for (const sec of SECCIONES) {
  if (SOLO && sec !== SOLO) continue;
  await lee(`document.querySelector('[data-sec=${JSON.stringify(sec).slice(1, -1)}]')?.click()`);

  /**
   * A QUE LA SECCION DEJE DE CAMBIAR, no un rato fijo.
   *
   * La lista de voces se rellena sola cuando el sistema la entrega, asi que
   * tocar el desplegable antes deja puesto un valor que la recarga se lleva —
   * y la sonda informaba de un fallo que era suyo. Dos lecturas iguales.
   */
  let previo = null;
  for (let i = 0; i < 20; i++) {
    const ahora = await lee(`${LISTA}.map((e) => e.tagName + e.id + (e.options ? e.options.length : 0)).join()`);
    if (ahora === previo) break;
    previo = ahora;
    await espera(400);
  }

  const campos = (await lee(`${LISTA}.map((e, i) => ({
    i, tag: e.tagName.toLowerCase(), tipo: e.type ?? '', id: e.id ?? '',
    cls: e.className ?? '', valor: e.value ?? '',
    ops: e.tagName === 'SELECT' ? [...e.options].map((o) => o.value) : null }))`)) ?? [];
  if (!campos.length) continue;
  console.log(`  ${sec} — ${campos.length} campo(s)`);

  for (const c of campos) {
    const tipo = c.tag === 'select' ? 'select' : c.tipo;
    let destino = nuevoValor(tipo, c.valor);
    if (tipo === 'select') {
      const otra = (c.ops ?? []).find((o) => o !== c.valor);
      if (!otra) continue;                       // una sola opción: nada que cambiar
      destino = otra;
    }
    if (destino === null) continue;              // casillas y deslizadores, aparte

    probados += 1;
    // Se busca por POSICIÓN DENTRO DE LA MISMA LISTA, que es lo único estable:
    // los identificadores se repiten entre secciones y las clases también.
    const sel = `${LISTA}[${c.i}]`;
    await lee(`(() => { const e = ${sel}; if (!e) return null;
      e.focus(); e.value = ${JSON.stringify(destino)};
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return e.value; })()`);
    await espera(2400);                          // ocho repintados de 250 ms
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

// EL DENOMINADOR, siempre. «Encontré uno roto» y «sólo miré uno» se leen igual.
console.log(`\n${mal} de ${probados} campos pierden lo escrito, en ${SECCIONES.length} secciones`);
if (rotos.length) {
  console.log('');
  for (const r of rotos) {
    console.log(`  ${r.sec} · ${r.campo} (${r.tipo}) — puse «${r.puse}», hay «${r.hay}»`);
  }
}
console.log('');
fin(mal ? 1 : 0);
