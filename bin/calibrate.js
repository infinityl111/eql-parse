#!/usr/bin/env node
/**
 * Calibración: pasa tu log REAL por el parser y muestra qué NO reconoce.
 * Uso: node bin/calibrate.js "C:\\...\\eqlog_Miguel_Server.txt" [--self Miguel] [--top 60]
 *
 * Esto es el paso 0. No optimices DPS con un parser que se está comiendo
 * el 30% de tus líneas de daño.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import { Parser } from '../src/parser.js';
import { ALL_RULES } from '../src/patterns.js';

const args = process.argv.slice(2);
const file = args[0];
const self = args.includes('--self') ? args[args.indexOf('--self') + 1] : null;
const top = args.includes('--top') ? +args[args.indexOf('--top') + 1] : 60;
if (!file) { console.error('uso: calibrate.js <ruta-al-log> [--self Nombre] [--top N]'); process.exit(1); }

const parser = new Parser({ self });
const shapes = new Map();   // forma normalizada -> {n, sample}
const kinds = new Map();
let lines = 0, noHeader = 0;

// Normaliza para agrupar: números -> #, nombres propios capitalizados -> <N>
const normalize = (s) => s
  .replace(/\b\d+\b/g, '#')
  .replace(/\b[A-Z][a-z]{2,}\b/g, '<N>')
  .replace(/\s+/g, ' ')
  .slice(0, 160);

const rl = readline.createInterface({
  input: fs.createReadStream(file, { encoding: 'latin1' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line) continue;
  lines++;
  const ev = parser.parse(line);
  if (!ev) { noHeader++; continue; }
  kinds.set(ev.kind, (kinds.get(ev.kind) ?? 0) + 1);
  if (ev.kind === 'unknown') {
    const k = normalize(ev.raw);
    const e = shapes.get(k);
    if (e) e.n++;
    else shapes.set(k, { n: 1, sample: ev.raw });
  }
}

const pct = (n) => ((n / Math.max(1, lines)) * 100).toFixed(1) + '%';

console.log(`\n=== ${file}`);
console.log(`líneas: ${lines}   sin cabecera válida: ${noHeader}`);
console.log(`\n--- eventos reconocidos ---`);
[...kinds].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
  console.log(`${String(n).padStart(8)}  ${pct(n).padStart(7)}  ${k}`);
});

console.log(`\n--- reglas declaradas sin verificar contra EQL ---`);
ALL_RULES.filter(r => r.unverified).forEach(r => console.log(`  [${r.kind}] ${r.re.source.slice(0, 90)}`));

console.log(`\n--- TOP ${top} formas NO reconocidas (candidatas a nuevas reglas) ---`);
[...shapes.values()].sort((a, b) => b.n - a.n).slice(0, top).forEach((e, i) => {
  console.log(`${String(i + 1).padStart(3)}. ${String(e.n).padStart(6)}x  ${e.sample}`);
});
console.log();
