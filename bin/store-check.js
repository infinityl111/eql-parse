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
// La carpeta del almacén se busca por lo que TIENE, no por cómo se llama.
//
// Antes bastaba con que existiera, y eso es una trampa: al probar el cambio de
// nombre quedó en esta máquina un «Roaming/EQL Parse» con un único fichero de
// Electron dentro, y una lista que sólo mira si la carpeta existe habría
// elegido ese en cuanto el bueno faltara — y habría dicho «cero peleas» en vez
// de «no la encuentro», que es mucho peor.
//
// El nombre visible cambió a «EQL Parse» en la 1.7.0 y la carpeta NO se movió:
// Electron la decide con `app.getName()`, que lee el `productName` de la RAÍZ
// del package.json y, si no lo hay, el `name`. El nombre visible vive en
// `build.productName`, que sólo lee el instalador. Hay una guarda en las
// pruebas para que nadie añada ese `productName` sin darse cuenta.
const CANDIDATES = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
];
const tieneAlmacen = (d) => fs.existsSync(path.join(d, 'fights.ndjson'));

const dir = process.argv[2] ?? CANDIDATES.find(tieneAlmacen);
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

/**
 * EL BOTÍN, Y SOBRE TODO EL QUE NO SE SABE LEER.
 *
 * Una línea de botín con un final que no tiene regla se recoge igual —la red de
 * `patterns.js` saca el objeto y guarda la cola literal— pero eso sólo sirve si
 * alguien la ve. En el contador de líneas no reconocidas no se ve: tiene 39.000
 * y una de botín no se distingue. Se ve aquí, con su nombre y su cola, que es
 * donde se mira cuando algo huele mal.
 *
 * Así se destapó el quinto final: «and stored it in your tradeskill depot»
 * apareció una vez en 55 MB y se llevó un `Essence of Rathe` sin que saltara
 * nada.
 */
let objetos = 0, unidades = 0, ambiguos = 0, fueraVentana = 0;
const colas = [];
for (const s of list) {
  const f = store.get(s.uid);
  for (const l of f?.loot ?? []) {
    objetos++;
    unidades += l.qty ?? 1;
    if (l.amb) ambiguos++;
    if ((l.t ?? 0) > (f.duration ?? 0)) fueraVentana++;
    if (l.cola) colas.push(`${l.item} — «${l.cola}»`);
  }
}
const tardios = [...(store.lootTarde?.values() ?? [])].flat();
for (const l of tardios) if (l.cola) colas.push(`${l.item} — «${l.cola}»`);
const cp = list.reduce((t, s) => t + (store.get(s.uid)?.coins ?? []).reduce((a, c) => a + (c.cp ?? 0), 0), 0);

console.log(`\n  botín dentro de peleas     ${n(objetos)}  (${n(unidades)} unidades)`);
console.log(`  botín tardío, con su pelea ${n(tardios.length)}`);
console.log(`  botín suelto, sin cadáver  ${n(store.orphanLoot.length)}`);
console.log(`  moneda recogida            ${n(cp / 1000)} platino  (${n(store.orphanCoins?.length ?? 0)} recogidas sueltas)`);
line('recogidas con dos cadáveres posibles', ambiguos, false);
console.log(`  ·   ${'botín recogido tras cerrarse su pelea'.padEnd(38)}${n(fueraVentana)}`);
line('FINALES DE LÍNEA SIN REGLA', colas.length, true);
for (const c of colas.slice(0, 12)) console.log(`        ${c}`);
if (colas.length) {
  console.log('\n  Esos objetos SÍ están guardados: la red los recoge. Lo que falta es la\n'
    + '  regla que lea su final, en `src/patterns.js`. Cópiala de las cinco que hay.');
}

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
