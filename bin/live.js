#!/usr/bin/env node
/**
 * Meter en vivo por terminal. Sirve como referencia de cableado:
 * tailer -> parser -> tracker -> render.
 * Uso: node bin/live.js "<ruta-log>" [--self Miguel] [--idle 20]
 */
import { LogTailer } from '../src/tailer.js';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

const args = process.argv.slice(2);
const file = args[0];
const self = args.includes('--self') ? args[args.indexOf('--self') + 1] : null;
const idle = args.includes('--idle') ? +args[args.indexOf('--idle') + 1] : 20;
if (!file) { console.error('uso: live.js <ruta-al-log> [--self Nombre] [--idle N]'); process.exit(1); }

const parser = new Parser({ self });
const tracker = new EncounterTracker({ idleSec: idle });
let seq = 0;
let dirty = true;

const tailer = new LogTailer(file, { pollMs: 100, fromStart: false });
tailer.on('line', (line) => {
  const ev = parser.parse(line, seq++);
  if (ev) { tracker.feed(ev); dirty = true; }
});
tailer.on('rotate', () => console.error('[i] log rotado / fichero nuevo'));
tailer.on('waiting', () => { });
tailer.on('error', (e) => console.error('[!]', e.message));

tracker.on('close', (enc) => {
  const { rows, total, duration, raidDps } = enc.totals();
  if (!rows.length) return;
  console.log(`\n=== Pelea #${enc.id} cerrada · ${duration}s · ${total} dmg · ${raidDps.toFixed(0)} dps grupo`);
  console.log(`    kills: ${enc.kills.map(k => k.victim).join(', ') || '—'}`);
});

const bar = (p, w = 18) => '█'.repeat(Math.round(p * w)).padEnd(w, '·');

setInterval(() => {
  tracker.tick(Date.now() / 1000);
  if (!dirty) return;
  dirty = false;
  const enc = tracker.current;
  process.stdout.write('\x1Bc');
  console.log(`EQL parse · ${parser.zone ?? 'zona ?'} · reconocidas ${parser.parsed} / desconocidas ${parser.unrecognized}`);
  if (!enc) { console.log('\n  esperando combate…'); return; }
  const { rows, total, duration, raidDps } = enc.totals();
  console.log(`Pelea #${enc.id}  ${duration}s  ${total} dmg  ${raidDps.toFixed(0)} dps\n`);
  for (const r of rows.slice(0, 12)) {
    console.log(
      `${r.name.slice(0, 18).padEnd(18)} ${bar(r.share)} ${r.dps.toFixed(0).padStart(6)} dps  ` +
      `${(r.share * 100).toFixed(1).padStart(5)}%  max ${String(r.max).padStart(5)}  ` +
      `acc ${(r.accuracy * 100).toFixed(0).padStart(3)}%  crit ${r.crits}`
    );
  }
}, 250);

await tailer.start();
console.log('monitorizando…');
