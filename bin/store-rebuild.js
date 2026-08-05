#!/usr/bin/env node
/**
 * Reconstruye el almacén de peleas releyendo el log entero.
 *
 * Para qué: cuando el parser mejora, las peleas ya guardadas siguen teniendo lo
 * que se supo entender el día que se guardaron. Reconstruir es más barato y más
 * honesto que arrastrar registros a medias.
 *
 * Los ficheros actuales NO se borran: se apartan con marca de tiempo, así que
 * siempre se puede volver atrás.
 *
 * Uso:  npm run store:rebuild
 *       npm run store:rebuild -- --log "D:\\...\\eqlog_Campeon_erudin.txt"
 *       npm run store:rebuild -- --dir "C:\\...\\eql-parse" --self Campeon
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Engine, findLog, parseLogName } from '../src/engine.js';
import { FightStore } from '../src/store.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const CANDIDATES = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
];

const dir = flag('--dir') ?? CANDIDATES.find((d) => fs.existsSync(d));
if (!dir) { console.error('No encuentro la carpeta del almacén. Pásala con --dir'); process.exit(1); }

// El log: el que digas, o el que ya estuviera en uso, o el más reciente.
const resumePath = path.join(dir, 'resume.json');
let logPath = flag('--log');
if (!logPath) {
  try { logPath = Object.keys(JSON.parse(fs.readFileSync(resumePath, 'utf8')))[0] ?? null; } catch { /* sin reanudación */ }
}
if (!logPath || !fs.existsSync(logPath)) logPath = findLog()[0]?.path ?? null;
if (!logPath) { console.error('No encuentro ningún eqlog_*.txt. Pásalo con --log'); process.exit(1); }

const self = flag('--self') ?? parseLogName(logPath).character;
const n = (v) => Math.round(v ?? 0).toLocaleString('es-ES');

// ── Antes ────────────────────────────────────────────────────────────────
const antes = new FightStore(dir);
antes.load();
const totalAntes = antes.filter({}).reduce((a, s) => a + (s.total ?? 0), 0);
console.log(`\n  almacén   ${dir}`);
console.log(`  log       ${logPath}`);
console.log(`  personaje ${self ?? '(desconocido)'}\n`);
console.log(`  antes:  ${n(antes.index.length)} peleas · ${n(totalAntes)} de daño\n`);

// ── Apartar, no borrar ───────────────────────────────────────────────────
const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const apartados = [];
for (const f of ['fights.ndjson', 'fights.idx']) {
  const src = path.join(dir, f);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(dir, `${f}.${marca}.bak`);
  fs.renameSync(src, dst);
  apartados.push(path.basename(dst));
}
if (apartados.length) console.log(`  apartados: ${apartados.join(', ')}\n`);

// ── Reconstruir ──────────────────────────────────────────────────────────
console.log('  releyendo el log…');
const t0 = Date.now();
const engine = new Engine();
engine.setStorePath(dir);
await engine.attach(logPath, { self, fromStart: true, idleSec: 20 });
// attach() no resuelve hasta haber leído todo lo pendiente, pero la última
// pelea queda abierta: se cierra por inactividad con un reloj muy por delante.
engine.tracker.tick(Number.MAX_SAFE_INTEGER);
// El punto de lectura se guarda ANTES de soltar el lector: `detach()` lo pone a
// null y entonces se guardaría vacío, con lo que la próxima apertura empezaría
// al final del fichero y se perdería lo escrito entre medias.
engine.saveStore();
engine.detach();
const secs = ((Date.now() - t0) / 1000).toFixed(1);

// ── Después ──────────────────────────────────────────────────────────────
const despues = new FightStore(dir);
despues.load();
const totalDespues = despues.filter({}).reduce((a, s) => a + (s.total ?? 0), 0);
const kills = despues.filter({}).reduce((a, s) => a + (s.kills ?? []).length, 0);

console.log(`\n  después: ${n(despues.index.length)} peleas · ${n(totalDespues)} de daño · ${n(kills)} enemigos abatidos`);
console.log(`  líneas leídas: ${n(engine.parser?.parsed)} · sin reconocer: ${n(engine.parser?.unrecognized)}`);
console.log(`  tiempo: ${secs} s\n`);

const dif = despues.index.length - antes.index.length;
if (dif !== 0) console.log(`  ${dif > 0 ? '+' : ''}${dif} peleas respecto al almacén anterior.`);
console.log(`  Si algo no cuadra, los ficheros de antes siguen ahí con la marca ${marca}.\n`);
