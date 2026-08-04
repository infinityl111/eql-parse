import fs from 'node:fs';
import { LogTailer } from '../src/tailer.js';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

const F = (process.env.TEMP || '/tmp') + '/eqlog_Test_Legends.txt';
fs.writeFileSync(F, '');
const stamp = (s) => {
  const d = new Date(2026, 7, 4, 21, 30, s);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (n) => String(n).padStart(2,'0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};
const L = [
  [0,'You have entered Lower Guk.'],
  [1,'You slash a froglok tad for 42 points of damage.'],
  [1,'You score a critical hit! (98)'],
  [1,'You slash a froglok tad for 98 points of damage.'],
  [2,'Gorgo says, \'Yes, Master.\''],
  [2,'Gorgo hits a froglok tad for 33 points of damage.'],
  [3,'You begin casting Shock of Blades.'],
  [3,'a froglok tad was hit by non-melee for 156 points of damage.'],
  [4,'a froglok tad has taken 65 damage from your Envenomed Bolt.'],
  [4,'You try to slash a froglok tad, but a froglok tad parries!'],
  [5,'a froglok tad hits YOU for 27 points of damage.'],
  [6,'You have slain a froglok tad!'],
];

const parser = new Parser({ self: 'Miguel' });
const tracker = new EncounterTracker({ idleSec: 20 });
const t = new LogTailer(F, { pollMs: 20 });
let seq = 0;
t.on('line', (l) => tracker.feed(parser.parse(l, seq++)));
await t.start();

fs.appendFileSync(F, L.map(([s, m]) => `${stamp(s)} ${m}\n`).join(''));
await new Promise(r => setTimeout(r, 300));
t.stop();

const enc = tracker.current;
const { rows, total, duration, raidDps } = enc.totals();
console.log(`duración ${duration}s · total ${total} · grupo ${raidDps.toFixed(1)} dps`);
for (const r of rows) {
  console.log(` ${r.name.padEnd(10)} ${String(r.damage).padStart(5)}  ${r.dps.toFixed(1).padStart(6)} dps  ${(r.share*100).toFixed(1)}%  crit ${r.crits}  acc ${(r.accuracy*100).toFixed(0)}%  max ${r.max}`);
  for (const [ab, b] of r.byAbility) console.log(`    · ${ab.padEnd(20)} ${String(b.sum).padStart(5)} (${b.n})`);
}
console.log('kills:', enc.kills.map(k=>k.victim).join(','));
console.log('desconocidas:', parser.unrecognized);
