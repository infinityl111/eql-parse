/**
 * NINGÚN MÓDULO QUE OTRO IMPORTE PUEDE HACER NADA AL IMPORTARSE.
 *
 * EL FALLO QUE LA TRAE. `web/build.mjs` acaba en `main()`, así que importarlo
 * para usar una función suelta CONSTRUÍA LA WEB ENTERA: borraba `web/dist`,
 * llamaba a la API de GitHub y reescribía veinte páginas. Lo hacía una prueba,
 * al arrancar, sin que nadie lo pidiera. Se vio porque imprime; si sólo hubiera
 * borrado la carpeta, no se habría visto.
 *
 * LA REGLA NO ES «ningún fichero se ejecuta»: `bin/*.js` y `test/*.js` son
 * puntos de entrada y ejecutar es su trabajo. La regla es la que dijo quien lo
 * encontró: una función que quieren dos sitios no puede vivir en un fichero que
 * se ejecuta al mirarlo.
 *
 * ── Y EL CENSO ESTABA ESCRITO A LA MEDIDA DE LO QUE YA SABÍAMOS MIRAR ──────
 *
 *     UNA GUARDA DEFINE MAL SU POBLACIÓN CUANDO EXCLUYE EL CASO QUE LA TRAJO.
 *
 * Esta población es «los módulos que alguien importa», y `build.mjs` —el fallo
 * que trajo esta prueba, nombrado aquí arriba— NO estaba dentro: no lo importa
 * ningún fichero del repositorio. La guarda existía por él y no lo cubría.
 *
 * Volvió a pasar el 18 de agosto: un `import` desde una consola para comprobar
 * la sintaxis borró `web/dist` y dejó `releases.json` en cero. La población
 * buena no era «los que alguien importa» sino «los que destruyen estado», y por
 * eso `build.mjs` lleva ahora su propia comprobación de ejecución directa —lo
 * que además lo devuelve a esta lista el día que alguien lo importe—.
 *
 * POR ESO LA LISTA SE DERIVA, NO SE ESCRIBE. Se leen todos los fuentes, se mira
 * QUIÉN IMPORTA A QUIÉN, y se comprueban sólo los que alguien importa. Dos
 * consecuencias buenas:
 *
 *   · `build.mjs` sale de la lista en cuanto deja de importarlo nadie — y
 *     VUELVE A ENTRAR el día que alguien lo importe otra vez, que es justo
 *     cuando hay que volver a mirarlo.
 *   · un módulo nuevo queda cubierto sin que nadie se acuerde de apuntarlo. Una
 *     enumeración a mano ya ha fallado dos veces en este proyecto.
 *
 * QUÉ CUENTA COMO «hacer algo»: escribir por la salida o tardar. No se puede
 * detectar cualquier efecto —una escritura silenciosa en disco se escapa— pero
 * un módulo que trabaja al importarse casi siempre imprime o tarda, y es lo que
 * pasó. Es una guarda barata para una clase entera, no una demostración.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['src', 'ui', 'web', 'bin', 'test', 'electron'];

const fuentes = [];
for (const c of CARPETAS) {
  const dir = path.join(RAIZ, c);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (/\.(js|mjs|cjs)$/.test(f)) fuentes.push(path.join(dir, f));
  }
}

// Quién importa a quién. Vale con las formas que usa el proyecto: `import x
// from './y.js'` y `await import('./y.js')`.
const importados = new Set();
for (const f of fuentes) {
  const texto = fs.readFileSync(f, 'utf8');
  for (const [, rel] of texto.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const destino = path.resolve(path.dirname(f), rel);
    if (fs.existsSync(destino)) importados.add(destino);
  }
}

console.log('\nlos módulos que alguien importa no hacen nada al importarse');
ok(importados.size > 5, 'se ha derivado la lista de quién importa a quién', `${importados.size} módulos`);

// Los de la interfaz corren en el navegador: sin un `document` mínimo no llegan
// ni a evaluarse, y lo que se quiere medir es si HACEN algo, no si el entorno
// les falta.
const REMEDO = "globalThis.document ??= { createElement: () => ({ style: {}, classList: { add(){}, remove(){} },"
  + " appendChild(){}, addEventListener(){}, setAttribute(){} }), body: { appendChild(){}, contains: () => false },"
  + " addEventListener(){}, querySelector: () => null, getElementById: () => null };"
  + " globalThis.window ??= { addEventListener(){}, matchMedia: () => ({ matches: false, addEventListener(){} }) };";

const TOPE_MS = 1500;
const ruidosos = [];
const lentos = [];
for (const f of [...importados].sort()) {
  // Los `.cjs` no se importan igual y ninguno los importa como módulo: fuera.
  if (f.endsWith('.cjs')) continue;
  const url = pathToFileURL(f).href;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `${REMEDO} await import(${JSON.stringify(url)});`],
    { encoding: 'utf8', timeout: 20000 });
  const ms = Date.now() - t0;
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  if (r.status !== 0) {
    ok(false, `${rel} se puede importar`, (r.stderr ?? '').split('\n').find((l) => l.includes('Error')) ?? `status ${r.status}`);
    continue;
  }
  if ((r.stdout ?? '').trim()) ruidosos.push(`${rel}: «${r.stdout.trim().split('\n')[0].slice(0, 60)}»`);
  if (ms > TOPE_MS) lentos.push(`${rel}: ${ms} ms`);
}

ok(ruidosos.length === 0, 'ninguno escribe por la salida al importarse',
  ruidosos.length ? ruidosos.join(' · ') : 'ninguno');
ok(lentos.length === 0, `ninguno tarda más de ${TOPE_MS} ms en importarse`,
  lentos.length ? lentos.join(' · ') : 'ninguno');

/**
 * Y LA GUARDA DE LA GUARDA: que esto esté mirando de verdad los módulos que
 * importan los demás, y no una lista vacía por un cambio en la forma de
 * importar. Si `src/store.js` no está, el detector se ha roto.
 *
 * Se comparan las RUTAS ENTERAS y no el final: `endsWith('store.js')` casaría
 * con un `bin/algo-store.js` cualquiera y daría por bueno un detector roto.
 */
const centrales = [path.join(RAIZ, 'src', 'store.js'), path.join(RAIZ, 'src', 'i18n.js')];
const faltan = centrales.filter((f) => !importados.has(f));
ok(faltan.length === 0, 'la lista incluye los módulos centrales: el detector sigue viendo',
  faltan.length ? `faltan ${faltan.map((f) => path.relative(RAIZ, f)).join(', ')}` : 'src/store.js y src/i18n.js');

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
