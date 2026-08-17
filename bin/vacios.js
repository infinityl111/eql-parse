#!/usr/bin/env node
/**
 * Qué textos del diccionario no los pinta nadie.
 *
 * Cada clave queda en uno de tres estados: PINTADA, POSIBLE —casa con un
 * prefijo de los que se arman al vuelo, y ésas no se afirman muertas sin
 * ejecutar— o SIN CAMINO.
 *
 * Uso:  npm run vacios              las de estado vacío
 *       npm run vacios -- --todas   todas las claves sin camino
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TODAS = process.argv.includes('--todas');

// ── Las claves del diccionario, por idioma ────────────────────────────────
const fuente = fs.readFileSync(path.join(RAIZ, 'src', 'i18n.js'), 'utf8');
const dicts = new Map();
for (const m of fuente.matchAll(/^const (ES|EN|FR|DE|PT) = \{$/gm)) {
  const desde = m.index;
  const hasta = fuente.indexOf('\n};', desde);
  const cuerpo = fuente.slice(desde, hasta);
  const claves = new Set([...cuerpo.matchAll(/'([a-zA-Z][\w.]*)':/g)].map((x) => x[1]));
  dicts.set(m[1], claves);
}
if (!dicts.size) {
  console.error('no se ha reconocido ningún diccionario en src/i18n.js');
  process.exit(2);
}

// ── Lo que el código usa ──────────────────────────────────────────────────
const ficheros = [];
for (const dir of ['ui', 'src', 'electron', 'bin']) {
  for (const f of fs.readdirSync(path.join(RAIZ, dir))) {
    if (!/\.(js|cjs|mjs|html)$/.test(f)) continue;
    if (dir === 'src' && f === 'i18n.js') continue;      // el diccionario no se usa a sí mismo
    ficheros.push(path.join(RAIZ, dir, f));
  }
}

const usadas = new Set();
const prefijos = new Set();
for (const f of ficheros) {
  const txt = fs.readFileSync(f, 'utf8');
  // Enteras. Se recoge CUALQUIER literal entrecomillado sin espacios y luego se
  // cruza con el diccionario: pedir que lleve un punto dejaba fuera las claves
  // de un solo tramo —`cancel`— y las daba por muertas.
  for (const m of txt.matchAll(/['"`]([a-zA-Z][\w.]{0,60})['"`]/g)) usadas.add(m[1]);
  // Armadas al vuelo: se guarda el trozo fijo de delante del primer `${`.
  for (const m of txt.matchAll(/`([a-zA-Z][\w.]*?)\$\{/g)) {
    if (m[1].includes('.')) prefijos.add(m[1]);
  }
}

// ── El veredicto, clave a clave ───────────────────────────────────────────
const ES = dicts.get('ES');
const casaPrefijo = (k) => [...prefijos].some((p) => k.startsWith(p));

// Un estado vacío se reconoce por el nombre —así se llaman en esta casa— y
// también por lo que DICE, que es lo que caza a los que se llaman de otra
// manera. Las dos cosas, porque ninguna de las dos sola vale.
const NOMBRE_VACIO = /(^|\.)(none|empty|noData|noMatch|noFindings|never|vacio|nada|sin[A-Z])|\.no[A-Z]/;
const TEXTO_VACIO = /^(sin |no hay|todav|aún no|ningun|nada |nunca|no loot|no data|no fights|nothing|keine|kein |noch|aucun|pas de|sem |nenhum|ainda)/i;

const valorES = (() => {
  const m = new Map();
  const desde = fuente.indexOf('const ES = {');
  const cuerpo = fuente.slice(desde, fuente.indexOf('\n};', desde));
  for (const x of cuerpo.matchAll(/'([a-zA-Z][\w.]*)':\s*'((?:[^'\\]|\\.)*)'/g)) m.set(x[1], x[2]);
  return m;
})();

const esVacio = (k) => NOMBRE_VACIO.test(k) || TEXTO_VACIO.test(valorES.get(k) ?? '');

/**
 * EL SINGULAR NO SE ESCRIBE NUNCA, Y NO ESTÁ MUERTO.
 *
 * `t()` cambia `metric.kills` por `metric.kills_1` cuando `n === 1`, así que la
 * forma en singular no aparece jamás en el código. Contarlas como muertas
 * llenaba la lista de veinte falsos positivos —«abatido», «1 objeto», «de una
 * muerte»— y una lista con veinte falsos es una lista que nadie vuelve a mirar.
 */
const pintada = (k) => usadas.has(k) || (/_\d+$/.test(k) && usadas.has(k.replace(/_\d+$/, '')));

const sinCamino = [];
const posibles = [];
for (const k of ES) {
  if (pintada(k)) continue;
  (casaPrefijo(k) ? posibles : sinCamino).push(k);
}

/**
 * LAS CLAVES MUERTAS CON FORMA DE RÓTULO.
 *
 * `an.tab` —«Análisis»— llevaba versiones traducida a los cinco idiomas sin que
 * la pintara nadie, y resultó ser EXACTAMENTE el rótulo corto que pedía la barra
 * lateral del armazón nuevo. No fue suerte: un diccionario grande lleva dentro
 * el diseño que alguien pensó y no llegó a hacer, y esas claves son nombres de
 * sección ya escritos y ya traducidos a cinco idiomas.
 *
 * Se reconocen por la FORMA —tres palabras como mucho, sin variables, sin punto
 * ni dos puntos—, que es la regla diecinueve otra vez: preguntar cómo está
 * puesto en vez de qué significa.
 */
const ROTULO = (k) => {
  const v = (valorES.get(k) ?? '').trim();
  if (!v || /[{}.:!?]/.test(v)) return false;
  return v.split(/\s+/).length <= 3 && v.length <= 26;
};

const ROTULOS = process.argv.includes('--rotulos');
const interesan = TODAS ? sinCamino : sinCamino.filter(ROTULOS ? ROTULO : esVacio);
interesan.sort();

console.log(`\n${ES.size} claves en español · ${usadas.size} escritas en el código`
  + ` · ${prefijos.size} prefijos dinámicos\n`);

if (!interesan.length) {
  console.log('  no hay ninguna sin camino\n');
} else {
  const qué = TODAS ? 'claves'
    : (process.argv.includes('--rotulos') ? 'claves con forma de RÓTULO' : 'textos de estado vacío');
  console.log(`  ${interesan.length} ${qué} SIN CAMINO QUE LOS PINTE:\n`);
  for (const k of interesan) {
    const falta = [...dicts].filter(([, c]) => !c.has(k)).map(([n]) => n);
    console.log(`   ${k.padEnd(28)} «${(valorES.get(k) ?? '').slice(0, 62)}»`
      + (falta.length ? `   [falta en ${falta.join(', ')}]` : ''));
  }
  console.log('');
}

/**
 * Y LAS DUDOSAS, QUE SON LAS QUE DE VERDAD HAY QUE MIRAR.
 *
 * Un prefijo dinámico como `enc.` casa con doscientas claves, así que meterlas
 * todas en «no se puede afirmar» y callarse es dar por revisado un cajón entero.
 * Las que casan con un prefijo Y tienen pinta de estado vacío se listan aparte
 * para mirarlas a mano: son pocas y son exactamente donde se esconde el
 * siguiente `loot.none`.
 */
const dudosas = posibles.filter(esVacio).sort();
if (dudosas.length) {
  console.log(`  ${dudosas.length} con pinta de vacío que se arman al vuelo — HAY QUE MIRARLAS A MANO:\n`);
  for (const k of dudosas) {
    console.log(`   ${k.padEnd(28)} «${(valorES.get(k) ?? '').slice(0, 62)}»`);
  }
  console.log('');
}
if (posibles.length) {
  console.log(`  (${posibles.length} claves casan con algún prefijo dinámico y no se pueden afirmar`
    + ` desde aquí: ${[...prefijos].sort().slice(0, 10).join(', ')}…)\n`);
}
