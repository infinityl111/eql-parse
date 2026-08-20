/**
 * UN PINTOR NO CONSTRUYE HTML.
 *
 * ── LA REGLA ──────────────────────────────────────────────────────────────
 *
 * Una sección se parte en dos: un CONSTRUCTOR puro —recibe un modelo, devuelve
 * una cadena, se prueba sin navegador— y un PINTOR delgado que reúne los datos,
 * los formatea y llama al constructor.
 *
 * El pintor puede tocar el DOM. Lo que no puede es **escribir etiquetas**: en
 * cuanto lo hace, esa parte de la pantalla vuelve a necesitar Electron para
 * saber qué produce, y volvemos a las siete causas y las dos tandas.
 *
 * ── POR QUÉ ES UNA ASERCIÓN Y NO UNA INTENCIÓN ────────────────────────────
 *
 * Hoy hemos visto tres veces qué pasa con lo que hay que acordarse de cumplir:
 * la guarda del repintado escrita a mano en tres sitios y olvidada en el
 * cuarto; `--branch main` puesto a mano y perdido a la versión siguiente; y la
 * carpeta de construcción que `PUBLICAR.md` mandaba retirar y no se retiró ni
 * una vez.
 *
 *     UN PATRÓN HAY QUE RECORDARLO. UNA PRUEBA, NO.
 *
 * ── SIRVE PARA LAS CATORCE SECCIONES ──────────────────────────────────────
 *
 * `MIGRADAS` es la lista de las que ya están sobre el módulo. Cada una que se
 * migre entra aquí, y a partir de ese momento no puede volver a escribir HTML
 * sin ponerse roja. Las que aún no están migradas no se vigilan: se sabe que
 * construyen, y decirlo cada vez sería ruido.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(DIR, '..', 'ui', 'app.js'), 'utf8');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** Las que ya viven sobre `ui/piezas.js`. Cada migración añade la suya. */
const MIGRADAS = ['renderCronos'];

/** El cuerpo de una función de primer nivel, sin comentarios. */
function cuerpoDe(nombre) {
  const lineas = APP.split(/\r?\n/);
  const re = new RegExp(`^(?:async )?function ${nombre}\\s*\\(`);
  const i = lineas.findIndex((l) => re.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^(?:async )?function /.test(lineas[j])) j++;
  return lineas.slice(i, j).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/**
 * ESCRIBIR HTML es abrir una etiqueta dentro de una plantilla. No cuenta pasar
 * una cadena ya construida ni leer del DOM: cuenta FABRICAR marcado.
 */
const FABRICA_HTML = /`[^`]*<\s*(?:div|span|p|h[1-6]|button|input|details|summary|table|tr|td|ul|li|section|label|select|option|b|i|a)\b/gi;

console.log('\nlas secciones migradas no construyen HTML');
for (const n of MIGRADAS) {
  const c = cuerpoDe(n);
  ok(c !== null, `${n} existe en ui/app.js`);
  if (c === null) continue;
  const trozos = [...c.matchAll(FABRICA_HTML)].map((m) => m[0].slice(0, 40));
  ok(trozos.length === 0, `${n} no fabrica marcado`,
    trozos.length ? trozos.join(' · ') : 'ni una etiqueta');
  ok(/construye\w*\(/.test(c), `${n} llama a un constructor`, 'reúne, formatea y delega');
}

console.log('\nCONTROL: la guarda caza el marcado de verdad');
{
  // Se le devuelve al cuerpo real una plantilla con etiquetas, que es la forma
  // exacta que tenía antes de migrarlo. Una mutación cualquiera no valdría.
  const enfermo = `${cuerpoDe('renderCronos')}\n  const x = \`<div class="cro">\${y}</div>\`;`;
  FABRICA_HTML.lastIndex = 0;
  ok(FABRICA_HTML.test(enfermo), 'devolviéndole una plantilla con <div>, salta',
    'sin esto, el verde de arriba no diría nada');
  const sano = 'const x = `${a} · ${b}`; const y = host.querySelector(".cro");';
  FABRICA_HTML.lastIndex = 0;
  ok(!FABRICA_HTML.test(sano), 'y no salta con una plantilla sin etiquetas',
    'formatear texto y leer del DOM siguen permitidos');
}

console.log('\ny el constructor de cada migrada existe y declara qué produce');
for (const n of MIGRADAS) {
  const mod = n.replace(/^render/, '').toLowerCase();
  const f = path.join(DIR, '..', 'ui', `${mod}-vista.js`);
  ok(fs.existsSync(f), `ui/${mod}-vista.js existe`);
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  ok(/export const CLAVES\s*=/.test(src), `y declara CLAVES`,
    'una sección que no declara qué produce vuelve a necesitar Electron');
  ok(!/document\.|window\./.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'y no toca el DOM', 'si lo tocara, no se podría probar sin navegador');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
