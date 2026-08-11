#!/usr/bin/env node
/**
 * Reconstruye el almacén de peleas releyendo el log entero.
 *
 * Para qué: cuando el parser mejora, las peleas ya guardadas siguen teniendo lo
 * que se supo entender el día que se guardaron. Reconstruir es más barato y más
 * honesto que arrastrar registros a medias.
 *
 * Los ficheros actuales NO se borran: se apartan con marca de tiempo, así que
 * siempre se puede volver atrás. La lógica está en src/rebuild.js porque el
 * cartel de migración de la aplicación usa exactamente la misma.
 *
 * Uso:  npm run store:rebuild
 *       npm run store:rebuild -- --log "D:\\...\\eqlog_Campeon_erudin.txt"
 *       npm run store:rebuild -- --dir "C:\\...\\eql-parse" --self Campeon
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findLog, parseLogName } from '../src/engine.js';
import { rebuildStore } from '../src/rebuild.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

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

const dir = flag('--dir') ?? CANDIDATES.find(tieneAlmacen);
if (!dir) { console.error('No encuentro la carpeta del almacén. Pásala con --dir'); process.exit(1); }

// El log: el que digas, o el que ya estuviera en uso, o el más reciente.
let logPath = flag('--log');
if (!logPath) {
  try { logPath = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'resume.json'), 'utf8')))[0] ?? null; }
  catch { /* sin reanudación */ }
}
if (!logPath || !fs.existsSync(logPath)) logPath = findLog()[0]?.path ?? null;
if (!logPath) { console.error('No encuentro ningún eqlog_*.txt. Pásalo con --log'); process.exit(1); }

const self = flag('--self') ?? parseLogName(logPath).character;
const n = (v) => Math.round(v ?? 0).toLocaleString('es-ES');

console.log(`\n  almacén   ${dir}`);
console.log(`  log       ${logPath}`);
console.log(`  personaje ${self ?? '(desconocido)'}\n`);
/**
 * EL AVISO VA ANTES DE EMPEZAR, no en las notas de la versión ni en un
 * comentario del código: quien ejecuta esto no los lee, y para cuando termine ya
 * está hecho.
 *
 * Reconstruir hoy NO reproduce el histórico. El cierre de pelea se decide con el
 * reloj de pared en directo y con la marca del registro al reconstruir, así que
 * con un hueco de exactamente `idleSec` cada camino parte la pelea de una
 * manera. Medido sobre 441 peleas reales: una se funde con la siguiente y las
 * cifras de las dos cambian.
 */
console.log('  ─────────────────────────────────────────────────────────────');
console.log('  AVISO: esto NO reproduce exactamente el histórico que tienes.');
console.log('  El cierre de pelea usa el reloj de pared en directo y la marca');
console.log('  del registro al reconstruir. Donde el hueco entre dos peleas sea');
console.log('  de exactamente 20 s, la reconstrucción puede FUNDIRLAS o');
console.log('  PARTIRLAS de otra manera, y sus cifras cambian con ellas.');
console.log('  Lo anterior se aparta con marca de tiempo y se puede recuperar.');
console.log('  ─────────────────────────────────────────────────────────────\n');
console.log('  releyendo el log…\n');

// La tabla de tríos que declaraste a mano vive en la configuración de la
// aplicación: sin ella la reconstrucción recalcularía el nivel sin tu palabra.
let trios = [];
try { trios = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).trios ?? []; }
catch { /* sin configuración: sólo lo que diga el log */ }
if (trios.length) console.log(`  tríos declarados a mano: ${trios.length}`);

// Los compañeros salen de la misma configuración: sin ellos la
// reconstrucción descarta el daño que hacen contra bichos que tú no tocas.
let companions = [];
try { companions = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).companions ?? []; }
catch { /* sin configuración: ninguno */ }
if (companions.length) console.log(`  compañeros declarados: ${companions.join(', ')}`);

const r = await rebuildStore({ dir, logPath, self, idleSec: 20, trios, companions });

if (!r.ok) {
  const porQue = {
    'sin-log': 'no encuentro el fichero de log',
    'sin-carpeta': 'no me has dicho qué carpeta',
    'sin-permisos': 'no puedo escribir en la carpeta',
    'error-de-lectura': 'ha fallado la lectura del log',
    'sin-peleas': `el log no contiene ninguna pelea, y había ${n(r.peleasAntes)} guardadas.\n`
      + '  No se ha tocado nada: tu histórico sigue como estaba.',
  }[r.reason] ?? r.reason;
  console.error(`  NO SE HA RECONSTRUIDO — ${porQue}`);
  if (r.error) console.error(`  ${r.error}`);
  process.exit(2);
}

console.log(`  antes:   ${n(r.peleasAntes)} peleas · ${n(r.danoAntes)} de daño`);
console.log(`  después: ${n(r.peleasDespues)} peleas · ${n(r.danoDespues)} de daño · ${n(r.abatidos)} enemigos abatidos`);
console.log(`  líneas leídas: ${n(r.lineas)} · sin reconocer: ${n(r.sinReconocer)}`);
console.log(`  tiempo: ${r.segundos.toFixed(1)} s · almacén marcado como ${r.version}\n`);
const dif = r.peleasDespues - r.peleasAntes;
if (dif !== 0) console.log(`  ${dif > 0 ? '+' : ''}${dif} peleas respecto al almacén anterior.`);
if (r.copias.length) console.log(`  Si algo no cuadra, lo de antes está en: ${r.copias.join(', ')}\n`);

// LO BORRADO SE DICE, CON LOS NOMBRES. Una poda silenciosa no se distingue de
// una pérdida de datos, y quien mira esta salida es justamente quien va a
// querer saber qué copias le quedan.
if (r.podadas?.length) {
  console.log(`  Se han borrado ${n(r.podadas.length)} ficheros de copias antiguas`
    + ` (se conservan las 3 últimas tandas: ${r.tandasConservadas.join(', ')}):`);
  for (const f of r.podadas) console.log(`    ${f}`);
  console.log('');
}
if (r.podaFallida?.length) {
  console.log(`  No he podido borrar ${n(r.podaFallida.length)}: ${r.podaFallida.join(', ')}\n`);
}
