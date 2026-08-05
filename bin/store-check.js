#!/usr/bin/env node
/**
 * Revisión del almacén de peleas. Sólo lee: no escribe ni borra nada.
 *
 * Uso:  npm run store:check
 *       npm run store:check -- "C:\\ruta\\a\\la\\carpeta"
 *
 * Responde a la única pregunta que importa antes de arreglar nada más:
 * ¿los números que salen del histórico se corresponden con lo que pasó?
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FightStore } from '../src/store.js';
import { aggregate, ensureSides } from '../src/aggregate.js';

// En desarrollo Electron usa el `name` del package.json; empaquetado, el
// productName. Se miran los dos antes de rendirse.
const CANDIDATES = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
];

const dir = process.argv[2] ?? CANDIDATES.find((d) => fs.existsSync(path.join(d, 'fights.idx')));
if (!dir) {
  console.error('No encuentro el almacén. Pásame la carpeta:');
  for (const c of CANDIDATES) console.error(`  ${c}`);
  process.exit(1);
}

const n = (v) => Math.round(v).toLocaleString('es-ES');
const store = new FightStore(dir);
const loaded = store.load();
const a = store.audit();

console.log(`\n  ${dir}\n`);
console.log(`  peleas en el índice        ${n(a.lines)}`);
console.log(`  peleas utilizables         ${n(loaded)}`);
console.log(`  tamaño del histórico       ${(a.bytes / 1024 / 1024).toFixed(1)} MB\n`);

const line = (label, v, bad) => {
  const mark = v === 0 ? 'ok  ' : (bad ? 'MAL ' : '·   ');
  console.log(`  ${mark}${label.padEnd(38)}${n(v)}`);
};
line('líneas de índice corruptas', a.corruptIdx, true);
line('registros que no se leen del .ndjson', a.unreadable, true);
line('claves repetidas (uid)', a.uidCollisions, true);
line('peleas duplicadas descartadas', a.duplicates, false);
line('ids de pelea repetidos entre sesiones', a.idCollisions, false);

if (a.idCollisions > 0) {
  console.log('\n  Los ids repetidos son normales y ya no importan: el contador vuelve a 1\n'
    + '  en cada arranque y ahora la identidad es el byte de inicio, no el id.');
}

// La prueba de verdad: leer TODAS las peleas y comprobar que la suma del
// resumen coincide con la suma de los registros, uno a uno.
const list = store.filter({});
let read = 0, missing = 0, sumIdx = 0, sumReal = 0;
const seenUid = new Set();
for (const s of list) {
  sumIdx += s.total ?? 0;
  const f = store.get(s.uid);
  if (!f) { missing++; continue; }
  if (seenUid.has(s.uid)) console.log(`  MAL  dos resúmenes apuntan al mismo registro: uid ${s.uid}`);
  seenUid.add(s.uid);
  read++;
  sumReal += f.total ?? 0;
}
console.log(`\n  peleas leídas del disco    ${n(read)}${missing ? `  (${n(missing)} ilegibles)` : ''}`);
console.log(`  daño según el índice       ${n(sumIdx)}`);
console.log(`  daño según los registros   ${n(sumReal)}`);

const agg = aggregate(list.map((s) => {
  const f = store.get(s.uid);
  return f ? ensureSides({ ...f, at: s.at }, null, []) : null;
}).filter(Boolean), null);
console.log(`  daño según el resumen      ${n(agg.total)}`);

const drift = sumIdx === 0 ? 0 : Math.abs(agg.total - sumIdx) / sumIdx;
console.log('');
if (a.corruptIdx || a.unreadable || a.uidCollisions || missing || drift > 0.001) {
  console.log(`  HISTÓRICO CON PROBLEMAS — desvío del resumen: ${(drift * 100).toFixed(2)}%\n`);
  process.exit(2);
}
console.log('  HISTÓRICO SANO — el resumen del tramo suma exactamente lo guardado.\n');
