#!/usr/bin/env node
/**
 * Cuánto texto en español escrito a mano llega a la pantalla: mide la
 * afirmación «cinco idiomas» en vez de repetirla.
 *
 * Reparte lo que encuentra en PANTALLA —lo que un alemán ve en español—,
 * DIAGNÓSTICO y HERRAMIENTA, y es una COTA INFERIOR con su criterio escrito, no
 * un censo: una frase puede llegar a la pantalla desde algo clasificado como
 * diagnóstico, y al revés.
 *
 * Uso:  npm run espanol           el recuento por cajón
 *       npm run espanol -- --ver  con cada frase y su línea
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VER = process.argv.includes('--ver');

/**
 * Fuera los comentarios, conservando el número de línea.
 *
 * POR LÍNEAS Y NO CARÁCTER A CARÁCTER, y esto es una cicatriz de la primera
 * versión: recorriendo el fichero carácter a carácter hay que distinguir una
 * comilla de texto de una comilla DENTRO DE UNA EXPRESIÓN REGULAR —`/[&<>"]/g`
 * lleva una— y sin entender expresiones regulares el autómata se cree que
 * empieza un texto ahí, se traga el resto del fichero y saca «frases en
 * español» que son trozos de comentario. Salieron cuatro así en la primera
 * tanda, todas de dentro de un bloque de documentación.
 *
 * Por líneas no hace falta entender el lenguaje: en esta casa los bloques
 * empiezan con `/*` al principio de la línea y los de línea con `//`. Un `//`
 * al final de una línea sólo se corta si lo que va delante tiene las comillas
 * emparejadas, que es lo que distingue un comentario de una barra dentro de un
 * texto.
 */
function sinComentarios(txt) {
  let bloque = false;
  return txt.split('\n').map((l) => {
    const t2 = l.trim();
    if (bloque) { if (t2.includes('*/')) bloque = false; return ''; }
    if (t2.startsWith('/*')) { if (!t2.includes('*/')) bloque = true; return ''; }
    if (t2.startsWith('//')) return '';
    const i = l.indexOf('//');
    if (i < 0) return l;
    const antes = l.slice(0, i);
    const par = (c) => (antes.split(c).length - 1) % 2 === 0;
    return par("'") && par('"') && par('`') ? antes : l;
  }).join('\n');
}

// Dos o más palabras funcionales seguidas, o una palabra con acento o eñe: es
// lo que separa una frase de un identificador o de una clase.
const FUNCIONALES = '(?:de|la|el|los|las|un|una|que|no|se|en|y|con|por|para|sin|más|al|del|es|son|lo|su|te|ya|hay|pero|como|cuando|si|esta|este|esa|ese)';
// Y verbos, porque hay frases cortas sin ninguna palabra funcional española y
// son justo las de los botones: «Cambia a X» no lleva ni una, y es la frase que
// destapó todo esto. Sin ellos, el barrido se pierde lo que más se ve.
const VERBOS = '(?:cambia|pulsa|elige|mira|abre|cierra|guarda|copia|sube|baja|marca|quita|añade|borra|arregla|comprueba|vuelve|espera|juega|escribe|reproduce)';
const FRASE = new RegExp(`[áéíóúñÁÉÍÓÚÑ¿¡]|\\b${VERBOS}\\b|\\b${FUNCIONALES}\\s+\\w+\\s+${FUNCIONALES}\\b|\\b${FUNCIONALES}\\s+${FUNCIONALES}\\b`, 'i');
// Y algo que descartar: rutas, claves del diccionario y jerga del juego.
const RUIDO = /^[\w.\-/\\]+$/;

const ficheros = [];
const anda = (dir) => {
  for (const f of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    if (f.isDirectory()) { if (f.name !== 'node_modules') anda(path.join(dir, f.name)); continue; }
    // El HTML también: `index.html` trae los rótulos del marco escritos en
    // español, y aunque `applyLangToChrome()` los sustituye al arrancar, lo que
    // no pase por ahí —un `title`, un `aria-label`— se queda en español para
    // siempre y no lo ve nadie porque la pantalla parece traducida.
    if (/\.(js|cjs|mjs|html)$/.test(f.name)) ficheros.push(path.join(dir, f.name));
  }
};
['ui', 'src', 'electron', 'bin', 'web', 'test'].forEach(anda);

const cajon = (rel, linea) => {
  if (/^(bin|web|test)[\\/]/.test(rel)) return 'HERRAMIENTA';
  if (/\bthrow\b|console\.(log|error|warn)/.test(linea)) return 'DIAGNÓSTICO';
  return 'PANTALLA';
};

const hallazgos = [];
for (const rel of ficheros) {
  if (rel.endsWith(path.join('src', 'i18n.js'))) continue;          // el diccionario ES el español
  if (rel.endsWith(path.join('src', 'jerga.js'))) continue;         // jerga del juego, a propósito
  const txt = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const limpio = sinComentarios(txt);
  const lineas = limpio.split('\n');
  const crudas = txt.split('\n');
  lineas.forEach((l, i) => {
    // Cada literal de la línea, en las tres comillas.
    for (const m of l.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*?)`/g)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (s.length < 8 || RUIDO.test(s) || !FRASE.test(s)) continue;
      // De una plantilla se mira sólo el texto fijo: `${…}` no es texto.
      const fijo = s.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').trim();
      if (fijo.length < 8 || !FRASE.test(fijo)) continue;
      hallazgos.push({ rel, n: i + 1, cajon: cajon(rel, crudas[i] ?? ''), txt: fijo.replace(/\s+/g, ' ').slice(0, 90) });
    }
  });
}

/**
 * EL SEGUNDO DETECTOR, Y ES EL QUE DE VERDAD ENCUENTRA.
 *
 * Buscar «español» por acentos y palabras funcionales se pierde justo lo que
 * más se ve: «Cambia a», «Importar disparadores», «Guardar pelea», «aturdido».
 * Frases cortas, sin una tilde ni un «de la» que las delate. En la primera
 * tanda el detector lingüístico encontró 6 de las 23 reales — el 26%.
 *
 * Éste no mira el IDIOMA sino el SITIO: hay campos cuyo valor acaba
 * literalmente en la pantalla o en la voz —`name`, `speak`, `text`, `title`,
 * `placeholder`, `aria-label`…—, y en una aplicación de cinco idiomas ninguno
 * de ellos debería llevar un literal: deberían llevar una clave. Da igual en
 * qué idioma esté escrito el literal; si no pasa por `t()`, no se traduce.
 *
 * Es la misma diferencia que hay entre adivinar y medir: el primero pregunta
 * «¿esto parece español?» y el segundo «¿esto puede traducirse?».
 */
const CAMPOS = /(?:^|[\s{,(])(name|speak|text|title|label|timerLabel|timerEndSpeak|placeholder|aria-label)\s*[:=]\s*(?:'([^'\n]{3,})'|"([^"\n]{3,})"|`([^`\n$]{3,})`)/g;
const literales = [];
for (const rel of ficheros) {
  if (/^(bin|web|test)[\\/]/.test(rel)) continue;
  if (rel.endsWith(path.join('src', 'i18n.js'))) continue;
  const limpio = sinComentarios(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
  limpio.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(CAMPOS)) {
      const v = (m[2] ?? m[3] ?? m[4] ?? '').trim();
      // Una clave del diccionario o un identificador no son texto de pantalla.
      if (!v || RUIDO.test(v) || /^[A-Z_]+$/.test(v)) continue;
      // Lo que YA pasa por `t()` está traducido: es la mayoría, y sin quitarlo
      // la lista sale con cien entradas correctas y las seis que importan
      // enterradas dentro. Y lo que sólo es interpolación —`${…}` y nada más—
      // no es texto: es un hueco.
      if (/\bt\(/.test(v)) continue;
      if (!/[a-záéíóúñ]{3}/i.test(v.replace(/\$\{[^}]*\}/g, ' '))) continue;
      literales.push({ rel, n: i + 1, campo: m[1], txt: v.slice(0, 60) });
    }
  });
}

const cuenta = new Map();
for (const h of hallazgos) cuenta.set(h.cajon, (cuenta.get(h.cajon) ?? 0) + 1);

console.log(`\n${ficheros.length} ficheros barridos · ${hallazgos.length} frases en español escritas a mano\n`);
for (const c of ['PANTALLA', 'DIAGNÓSTICO', 'HERRAMIENTA']) {
  console.log(`   ${String(cuenta.get(c) ?? 0).padStart(4)}  ${c}`);
}

const porFichero = new Map();
for (const h of hallazgos.filter((x) => x.cajon === 'PANTALLA')) {
  if (!porFichero.has(h.rel)) porFichero.set(h.rel, []);
  porFichero.get(h.rel).push(h);
}
console.log('\n  Las de PANTALLA, por fichero:\n');
for (const [rel, hs] of [...porFichero].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`   ${String(hs.length).padStart(4)}  ${rel}`);
  if (!VER) continue;
  for (const h of hs) console.log(`         ${String(h.n).padStart(5)}  ${h.txt}`);
}

console.log(`\n  ${literales.length} campos de usuario con un literal en vez de una clave`
  + ' — el detector que no adivina el idioma:\n');
const porF2 = new Map();
for (const h of literales) {
  if (!porF2.has(h.rel)) porF2.set(h.rel, []);
  porF2.get(h.rel).push(h);
}
for (const [rel, hs] of [...porF2].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`   ${String(hs.length).padStart(4)}  ${rel}`);
  if (!VER) continue;
  for (const h of hs) console.log(`         ${String(h.n).padStart(5)}  ${h.campo}: ${h.txt}`);
}
console.log('');
