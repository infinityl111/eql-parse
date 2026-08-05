/**
 * Pruebas del motor de combate: muertes, vida estimada, resistencias y daño
 * sin atribuir.
 *
 * Todas parten de líneas de log con el formato real de EQL, no de objetos
 * fabricados a mano: si el diccionario de patrones cambia, estas pruebas se
 * enteran.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { aggregate } from '../src/aggregate.js';
import { Engine } from '../src/engine.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

const stamp = (s) => {
  const d = new Date(2026, 7, 4, 21, 0, 0);
  d.setSeconds(d.getSeconds() + s);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

/** Pasa un guion de [segundo, línea] por parser + agregador y cierra la pelea. */
function correr(guion, { self = 'Campeon', pets = [] } = {}) {
  const parser = new Parser({ self });
  const tracker = new EncounterTracker({ self, idleSec: 20 });
  tracker.petNames = new Set(pets);
  const engine = new Engine();
  engine.self = self;
  engine.parser = parser;
  engine.tracker = tracker;
  for (const [s, linea] of guion) tracker.feed(parser.parse(`${stamp(s)} ${linea}`));
  return engine.snapshot().current;
}

// ── 1. Las muertes se registran ───────────────────────────────────────────
console.log('\nmuertes');
{
  const f = correr([
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'a gorgon hits Campeon for 40 points of damage.'],
    [2, 'You slash a gorgon for 500 points of damage.'],
    [3, 'You have slain a gorgon!'],
  ]);
  ok(f.kills.length === 1 && f.kills[0] === 'a gorgon', 'se cuenta el enemigo abatido');
  ok(f.label === 'a gorgon', 'y la pelea se llama como él');
  ok(f.dead['a gorgon'] === 3, 'con el segundo en que cayó');

  // Tu propia muerte no es un abatido: es una baja.
  const g = correr([
    [0, 'You slash a gorgon for 100 points of damage.'],
    [1, 'a gorgon hits Campeon for 40 points of damage.'],
    [2, 'You have been slain by a gorgon!'],
  ]);
  ok(g.losses.length === 1 && g.kills.length === 0, 'tu muerte cuenta como baja, no como abatido');

  // La muerte de un desconocido a diez metros no abre ni contamina nada.
  const h = correr([
    [0, 'Un extraño has been slain by a rat!'],
    [1, 'You slash a gorgon for 100 points of damage.'],
    [2, 'You have slain a gorgon!'],
  ]);
  ok(h.kills.length === 1 && h.kills[0] === 'a gorgon', 'la muerte de un ajeno no entra');

  // Pero la de un compañero que lleva toda la pelea pegando, sí.
  const i = correr([
    [0, 'You slash a gorgon for 100 points of damage.'],
    [1, 'Xasaner pierces a gorgon for 80 points of damage.'],
    [2, 'a gorgon hits Xasaner for 40 points of damage.'],
    [3, 'Xasaner has been slain by a gorgon!'],
    [4, 'You have slain a gorgon!'],
  ]);
  const comp = i.rows.find((r) => r.name === 'Xasaner');
  ok(comp?.deaths === 1, 'la caída de un compañero de grupo se cuenta', String(comp?.deaths));
  ok(i.kills.length === 1 && i.kills[0] === 'a gorgon',
    'y no se confunde con un enemigo abatido');
}

// ── 2. Vida estimada: una muestra por muerte, no la suma de todas ─────────
console.log('\nvida estimada');
{
  // Tres gorgonas seguidas, 1.000 de daño cada una.
  const guion = [];
  let t = 0;
  for (let i = 0; i < 3; i++) {
    guion.push([t, 'You slash a gorgon for 600 points of damage.']);
    guion.push([t + 1, 'You slash a gorgon for 400 points of damage.']);
    guion.push([t + 2, 'You have slain a gorgon!']);
    t += 5;
  }
  const f = correr(guion);
  ok(f.kills.length === 3, 'tres muertes contadas');
  const m = f.hpSamples['a gorgon'];
  ok(m?.length === 3, 'tres muestras de vida, una por muerte', JSON.stringify(m));
  ok(m?.every((x) => x === 1000), 'y cada una vale 1.000, no 1.000/2.000/3.000');

  const ag = aggregate([{ ...f, at: Date.now() }], 'Campeon');
  const foe = ag.foes.find((x) => x.name === 'a gorgon');
  ok(foe?.kills === 3, 'el expediente cuenta las tres muertes', String(foe?.kills));
  ok(foe?.hp?.avg === 1000, 'y estima 1.000 de vida, no 3.000', String(foe?.hp?.avg));
}

// ── 3. Resistencias: el hechizo que abre la pelea y los de la mascota ─────
console.log('\nresistencias por hechizo');
{
  const f = correr([
    // El primero es el que abre la pelea: antes no se contaba como acertado.
    [0, 'Campeon hit a gorgon for 300 points of magic damage by Drain Spirit.'],
    [1, "a gorgon resisted Campeon's Drain Spirit!"],
    [2, 'Campeon hit a gorgon for 300 points of magic damage by Drain Spirit.'],
    // Y lo que lanza la mascota cuenta en los dos lados, no sólo en el malo.
    [3, 'Kabektik hit a gorgon for 90 points of magic damage by Shock of Blades.'],
    [4, "a gorgon resisted Kabektik's Shock of Blades!"],
  ], { pets: ['Kabektik'] });

  const drain = f.spellVsFoe.find((x) => x.spell === 'Drain Spirit');
  ok(drain?.landed === 2, 'cuenta los dos que entraron, incluido el que abrió la pelea',
    `entra ${drain?.landed}`);
  ok(drain?.resisted === 1, 'y la resistencia');

  const shock = f.spellVsFoe.find((x) => x.spell === 'Shock of Blades');
  ok(shock?.landed === 1 && shock?.resisted === 1,
    'el hechizo de la mascota cuenta acierto y resistencia',
    `entra ${shock?.landed} / resistido ${shock?.resisted}`);
}

// ── 4. Escudo de daño sin dueño: aparte, no en el total del grupo ─────────
console.log('\ndaño sin atribuir');
{
  const f = correr([
    [0, 'You slash a gorgon for 1000 points of damage.'],
    [1, 'a gorgon is pierced by shards of ice for 42 points of non-melee damage.'],
    [2, 'a gorgon hits Campeon for 40 points of damage.'],
  ]);
  ok(f.unattributed === 42, 'los 42 puntos sin dueño se apartan', String(f.unattributed));
  ok(f.total === 1000, 'y no entran en el total del grupo', String(f.total));
  ok(!f.rows.some((r) => r.name === 'Unknown'),
    'no aparece ningún combatiente llamado «Unknown»');
  const gorgon = f.rows.find((r) => r.name === 'a gorgon');
  ok(gorgon?.taken === 1042, 'pero el que los recibe sí los contabiliza', String(gorgon?.taken));
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
