#!/usr/bin/env node
/**
 * Corre las imposibilidades —cosas que no pueden ser— sobre el histórico en
 * disco, y sale en rojo si alguna salta.
 *
 *     npm run imposibles -- --lista <ruta>
 *     npm run imposibles -- --lista <ruta> --dir "C:\ruta\al\almacen"
 *     npm run imposibles -- --lista <ruta> --log <eqlog.txt> --self TuPJ
 *
 * LA LISTA NO VIVE AQUÍ. Es un módulo aparte que exporta
 * `imposibles({ claveDeNombre })` y devuelve `{ IMPOSIBLES, IMPOSIBLES_RP }`;
 * se pasa con `--lista` o con la variable de entorno `EQL_IMPOSIBLES`. Sin
 * lista esto NO comprueba nada, y por eso sale en rojo en vez de en verde: un
 * cero de «no ha saltado ninguna» y un cero de «no se ha mirado ninguna» se
 * escriben igual.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { claveDeNombre } from '../src/nombres.js';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const CANDIDATOS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
];
const dir = flag('--dir') ?? CANDIDATOS.find((d) => fs.existsSync(path.join(d, 'fights.ndjson')));
if (!dir) { console.error('No encuentro el almacén. Pásalo con --dir'); process.exit(1); }

// Sin lista no hay comprobación, y una comprobación que no corre no puede
// salir en verde: se para aquí y se dice por qué.
const rutaLista = flag('--lista') ?? process.env.EQL_IMPOSIBLES ?? null;
if (!rutaLista) {
  console.error('\n  No hay lista de imposibilidades: esto NO ha comprobado nada.');
  console.error('  Pásala con  --lista <ruta>  o con la variable EQL_IMPOSIBLES.\n');
  process.exit(2);
}
if (!fs.existsSync(rutaLista)) {
  console.error(`\n  No existe la lista: ${rutaLista}\n`);
  process.exit(2);
}
const { imposibles } = await import(pathToFileURL(path.resolve(rutaLista)).href);
const { IMPOSIBLES, IMPOSIBLES_RP } = imposibles({ claveDeNombre });


const hora = (f) => new Date((f.at ? f.at / 1000 : f.start ?? 0) * 1000).toLocaleString('es-ES');

const cuenta = new Map(IMPOSIBLES.map((i) => [i.id, { n: 0, ejemplos: [] }]));
let peleas = 0;
const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'fights.ndjson')), crlfDelay: Infinity });
for await (const l of rl) {
  if (!l.trim()) continue;
  let f; try { f = JSON.parse(l); } catch { continue; }
  peleas++;
  for (const imp of IMPOSIBLES) {
    let motivo = null;
    try { motivo = imp.mira(f); } catch (e) { motivo = `la comprobación reventó: ${e.message}`; }
    if (!motivo) continue;
    const c = cuenta.get(imp.id);
    c.n++;
    if (c.ejemplos.length < 3) c.ejemplos.push(`${hora(f)} · ${motivo}`);
  }
}

// ── Y las del reproductor, si se ha pasado el registro ────────────────────
const logPath = flag('--log');
const quienSoy = flag('--self') ?? 'Campeon';
const cuentaRp = new Map(IMPOSIBLES_RP.map((i) => [i.id, { n: 0, ejemplos: [] }]));
let peleasRp = 0;
if (logPath) {
  if (!fs.existsSync(logPath)) { console.error(`No existe el registro: ${logPath}`); process.exit(1); }
  const { reproducirTodo } = await import('./reproductor.js');
  await reproducirTodo({
    dir,
    logPath,
    self: quienSoy,
    cada: ({ pelea, escena }) => {
      peleasRp++;
      for (const imp of IMPOSIBLES_RP) {
        let motivo = null;
        try { motivo = imp.mira({ pelea, escena, self: quienSoy }); } catch (e) { motivo = `la comprobación reventó: ${e.message}`; }
        if (!motivo) continue;
        const c = cuentaRp.get(imp.id);
        c.n++;
        if (c.ejemplos.length < 3) c.ejemplos.push(`${hora(pelea)} · ${motivo}`);
      }
    },
  });
}

console.log(`\n  almacén   ${dir}`);
console.log(`  peleas    ${peleas.toLocaleString('es-ES')}\n`);
let saltaron = 0;
const pinta = (lista, cuentaDe) => {
  for (const imp of lista) {
    const c = cuentaDe.get(imp.id);
    console.log(`  ${c.n ? 'SALTA' : ' ok  '}  ${imp.frase}`);
    if (!c.n) continue;
    saltaron++;
    console.log(`         ${c.n} peleas`);
    for (const e of c.ejemplos) console.log(`           ${e}`);
  }
};
pinta(IMPOSIBLES, cuenta);
let total = IMPOSIBLES.length;
if (logPath) {
  console.log(`\n  ── sobre lo que dibuja el reproductor (${peleasRp.toLocaleString('es-ES')} escenas) ──\n`);
  pinta(IMPOSIBLES_RP, cuentaRp);
  total += IMPOSIBLES_RP.length;
} else {
  console.log(`\n  (las ${IMPOSIBLES_RP.length} del reproductor no se han corrido: hace falta --log)`);
}
console.log(saltaron
  ? `\n  ${saltaron} imposibilidades de ${total} han saltado. Cada una es un fallo o una imposibilidad mal escrita.\n`
  : `\n  las ${total} en silencio.\n`);
process.exit(saltaron ? 1 : 0);
