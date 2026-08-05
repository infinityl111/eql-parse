/**
 * La tabla de tríos declarada a mano.
 *
 * Tres fuentes de verdad y un orden entre ellas: lo que tú declaras, el /who,
 * y la inferencia por hechizos. Lo que se prueba aquí es el ORDEN, no un caso
 * concreto, porque es donde está el fallo caro: un dato inventado con aspecto
 * de medido contamina todas las medianas del histórico.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { normalizeTrios, trioAt, conflicts } from '../src/trios.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

const BASE = new Date(2026, 7, 4, 12, 0, 0);
const stamp = (s) => {
  const d = new Date(BASE.getTime() + s * 1000);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};
const ms = (s) => BASE.getTime() + s * 1000;

/** Corre un guion de líneas con una tabla puesta, y devuelve el motor. */
function correr(tabla, guion) {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const e = new Engine();
  e.self = 'Campeon'; e.parser = p; e.tracker = tr;
  e.setTrios(tabla);
  const peleas = [];
  tr.on('close', (enc) => peleas.push(e.snapshot ? { level: enc.level, classes: enc.classes } : null));
  for (const [s, l] of guion) {
    const ev = p.parse(`${stamp(s)} ${l}`);
    if (!ev) continue;
    e.feedEvent(ev);
  }
  tr.tick(Number.MAX_SAFE_INTEGER);
  return { e, tr, peleas };
}

// ── 1. Normalizar la tabla ───────────────────────────────────────────────
console.log('\nla tabla se limpia antes de usarse');
{
  const t = normalizeTrios([
    { at: 300, classes: ['SHD', 'SHM', 'MAG'] },
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 100, classes: ['SHD', 'X!!', 'MAG'] },        // clase inválida
    { at: 200, classes: ['SHD', 'DRU'] },               // sólo dos
    { at: 'ayer', classes: ['SHD', 'DRU', 'MAG'] },     // fecha basura
    { at: 400, classes: ['WAR', 'CLR', 'ROG'], level: -3 },
  ]);
  ok(t.length === 3, 'se descarta lo que no vale', `${t.length} renglones`);
  ok(t[0].at === null, 'el «desde siempre» va el primero');
  ok(t[1].at === 300 && t[2].at === 400, 'y el resto por fecha');
  ok(t[2].level === null, 'un nivel imposible se convierte en «no declarado»');
}

console.log('\ndos renglones en el mismo instante: gana el último');
{
  const t = normalizeTrios([
    { at: 100, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 100, classes: ['SHD', 'SHM', 'MAG'], level: 25 },
  ]);
  ok(t.length === 1, 'queda uno solo', `${t.length}`);
  ok(t[0].classes.join('/') === 'SHD/SHM/MAG', 'el último escrito', t[0].classes.join('/'));
}

console.log('\nqué tramo estaba en vigor');
{
  const t = normalizeTrios([
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 1000, classes: ['SHD', 'SHM', 'MAG'] },
    { at: 2000, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
  ]);
  ok(trioAt(t, 0)?.classes[1] === 'DRU', 'antes de todo manda el «desde siempre»');
  ok(trioAt(t, 999)?.classes[1] === 'DRU', 'justo antes del corte, el anterior');
  ok(trioAt(t, 1000)?.classes[1] === 'SHM', 'en el corte exacto, el nuevo');
  ok(trioAt(t, 5000)?.classes[1] === 'DRU', 'después del último, el último');
  ok(trioAt([], 5000) === null, 'sin tabla no se afirma nada');
}

// ── 2. El orden entre las tres fuentes ───────────────────────────────────
console.log('\nlo declarado a mano manda sobre el /who');
{
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    // Un /who POSTERIOR que dice otra cosa: describe un instante, y tú
    // describiste el tramo entero. No debe ganar.
    [20, '[25 SHD/SHM/MAG] Campeon (Iksar) <Spain> ZONE: The Ruins of Old Guk 2 (gukbottom)  '],
  ]);
  ok(e.whoClasses?.join('/') === 'SHD/DRU/MAG',
    'el trío sigue siendo el que declaraste', e.whoClasses?.join('/'));
  ok(e.level === 50, 'y el nivel también', String(e.level));
  ok(e.classSourceAt === 'manual', 'la fuente queda marcada como manual', String(e.classSourceAt));
}

console.log('\nsi el tramo no declara nivel, el log lo pone');
{
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'SHM', 'MAG'], level: null }]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [20, 'You have gained a level! Welcome to level 25!'],
  ]);
  ok(e.level === 25, 'la subida de nivel dentro del tramo sí cuenta', String(e.level));
  ok(e.whoClasses?.join('/') === 'SHD/SHM/MAG', 'pero el trío no se toca', e.whoClasses?.join('/'));
}

console.log('\ncambiar de trío borra el nivel heredado');
{
  // Lo contraintuitivo y lo importante: en EQL el nivel efectivo es el de tu
  // clase más baja, así que meter una clase nueva puede hundirlo. Arrastrar
  // el 50 del tramo anterior sería inventarse un dato.
  const tabla = normalizeTrios([
    { at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: ms(100), classes: ['SHD', 'SHM', 'MAG'], level: null },
  ]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [110, 'You slash a gorgon for 100 points of damage.'],
  ]);
  ok(e.level === null, 'sin nivel hasta el primer hito del tramo nuevo', String(e.level));
  ok(e.whoClasses?.join('/') === 'SHD/SHM/MAG', 'con el trío nuevo puesto', e.whoClasses?.join('/'));
}

console.log('\nla inferencia por hechizos se calla dentro de un tramo');
{
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const { e } = correr(tabla, [[10, 'You slash a gorgon for 100 points of damage.']]);
  const avisos = [];
  e.on('alert', (a) => avisos.push(a));
  e.classProof({ t: (ms(20)) / 1000, ability: 'Burnout' });   // exclusivo de mago
  ok(e.whoClasses.join('/') === 'SHD/DRU/MAG',
    'un hechizo no cambia lo que declaraste', e.whoClasses.join('/'));
  ok(avisos.length === 0, 'y no te da la lata pidiendo /who', `${avisos.length}`);
}

console.log('\nsin tabla, todo sigue como estaba');
{
  const { e } = correr([], [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [20, '[25 SHD/SHM/MAG] Campeon (Iksar) <Spain> ZONE: The Ruins of Old Guk 2 (gukbottom)  '],
  ]);
  ok(e.level === 25, 'el /who manda cuando no hay nada declarado', String(e.level));
}

// ── 3. Contradicciones: se enseñan, no se corrigen ───────────────────────
console.log('\ncontradicciones entre tu tabla y el log');
{
  const tabla = normalizeTrios([
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 1000, classes: ['SHD', 'SHM', 'MAG'] },
  ]);
  const hitos = [
    { at: 500, level: 50, classes: ['SHD', 'DRU', 'MAG'] },   // cuadra
    { at: 1500, level: 25, classes: ['SHD', 'DRU', 'MAG'] },  // no cuadra
  ];
  const c = conflicts(tabla, hitos);
  ok(c.length === 1, 'se detecta la que no cuadra, y sólo esa', `${c.length}`);
  ok(c[0].at === 1500, 'con su hora', String(c[0]?.at));
  ok(c[0].dice.join('/') === 'SHD/DRU/MAG' && c[0].declaras.join('/') === 'SHD/SHM/MAG',
    'diciendo las dos versiones, sin elegir por ti');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
