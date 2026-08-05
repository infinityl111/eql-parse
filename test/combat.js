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

// ── 5. Análisis: los huecos, el uptime y el daño perdido ─────────────────
console.log('\nanálisis posterior');
{
  const { analyse } = await import('../src/analysis.js');

  // Silencio REAL de 15 s: no pasa absolutamente nada en medio, y es más corto
  // que la inactividad que cierra la pelea (20 s), así que sigue siendo UNA.
  const guion = [];
  for (let s = 0; s < 20; s++) guion.push([s, 'You slash a gorgon for 100 points of damage.']);
  for (let s = 35; s < 70; s++) guion.push([s, 'You slash a gorgon for 100 points of damage.']);
  const f = correr(guion);
  ok(f.duration === 70, 'sigue siendo una sola pelea', `${f.duration}s`);
  const a = analyse(f, { self: 'Campeon', classes: ['WAR'] });
  const corta = a.phases.some((p) => Math.abs(p.from - 20) <= 1 || Math.abs(p.to - 20) <= 1);
  ok(corta, 'se corta una fase donde dejas de pegar', a.phases.map((p) => `${p.from}-${p.to}`).join(' '));
  const hueco = a.phases.find((p) => p.from >= 19 && p.to <= 36);
  ok(hueco && hueco.idle >= 12, 'y esa fase sale marcada como parada', `${hueco?.idle}s parado`);

  // Uptime perfecto: ni un segundo de más.
  const seguido = [];
  for (let s = 0; s < 40; s++) seguido.push([s, 'You slash a gorgon for 100 points of damage.']);
  const g = analyse(correr(seguido), { self: 'Campeon', classes: ['WAR'] });
  const dt = g.findings.find((x) => x.id === 'downtime' || x.id === 'uptime');
  ok(dt?.id === 'uptime', 'pegando sin parar no se reporta tiempo muerto', dt?.id);
  ok(/100\s*%/.test(dt?.detail ?? ''), 'y el uptime es del 100%, no del 97%', dt?.detail);

  // El daño perdido por fallar se mide en golpes de melé, no en el promedio de
  // todo lo que haces: un híbrido que castea la mitad no puede inflar la cifra.
  const hibrido = [];
  for (let s = 0; s < 40; s++) {
    hibrido.push([s, 'You slash a gorgon for 100 points of damage.']);
    hibrido.push([s, 'You try to slash a gorgon, but a gorgon parries!']);
    hibrido.push([s, 'Campeon hit a gorgon for 900 points of magic damage by Drain Spirit.']);
  }
  const h = analyse(correr(hibrido), { self: 'Campeon', classes: ['SHD'] });
  const acc = h.findings.find((x) => x.id === 'accuracy');
  const perdido = +(acc?.impact ?? '').replace(/[^\d]/g, '');
  ok(acc, 'con 50% de fallos se avisa de la precisión');
  // 40 fallos, 20 por encima del 25% esperado, a 100 por golpe de melé = 2.000.
  // Con el promedio de todo el daño (500/golpe) salían 10.000.
  ok(perdido > 0 && perdido < 4000,
    'y el daño perdido se calcula con el golpe de melé, no con el promedio total',
    `${perdido}`);
}

// ── 6. Un slow no es «segundos sin pegar» ────────────────────────────────
console.log('\ncontrol recibido');
{
  const { controlKind } = await import('../src/spells.js');
  ok(controlKind('root', 'Bonds of Force') === 'duro', 'una raíz es control duro');
  ok(controlKind('root', 'Tagar’s Insects') === 'blando', 'una ralentización no');
  ok(controlKind('root', 'Cripple') === 'blando', 'ni una debilitación');
  ok(controlKind('mez', 'Mesmerize') === 'duro' && controlKind('fear', 'Invoke Fear') === 'duro',
    'mez y miedo sí');
  ok(controlKind('heal', 'Word of Healing') === null, 'y una curación no es control');
}

// ── Los nombres de mascota se reciclan entre jugadores ────────────────────
//
// Fallo real y medido. En EQL el nombre de la mascota sale de una lista cerrada
// y cambia en cada invocación, así que el nombre que fue tuyo hace horas puede
// ser el de la mascota de otro jugador después. `parser.pets` no retiraba
// ninguno, y el filtro de relevancia daba por tuyo cualquier nombre de la
// lista: se guardó una pelea entera SIN TI dentro —el otro jugador, su mascota
// y el bicho— porque su mascota reutilizaba un nombre que había sido tuyo.
console.log('\nuna mascota vieja deja de ser tuya al invocar otra');
{
  const p = new Parser({ self: 'Campeon' });
  const línea = (s, txt) => p.parse(`${stamp(s)} ${txt}`, 0);

  línea(0, "Jobarn says, 'My leader is Campeon.'");
  ok(p.pets.has('Jobarn') && p.currentPet === 'Jobarn', 'la primera es tuya');

  línea(100, "Kabarer says, 'My leader is Campeon.'");
  ok(p.pets.has('Kabarer') && p.currentPet === 'Kabarer', 'la nueva es tuya');
  ok(!p.pets.has('Jobarn'),
    'y la anterior deja de serlo: sólo se tiene una a la vez',
    [...p.pets.keys()].join(', '));

  // La mitad que prueba que sirve de algo: con el nombre viejo suelto, la pelea
  // de un desconocido no puede abrirse como tuya.
  const guion = [
    [200, 'Krumka slashes a froglok shin knight for 300 points of damage.'],
    [201, 'Jobarn pierces a froglok shin knight for 100 points of damage.'],
    [202, 'a froglok shin knight hits Krumka for 50 points of damage.'],
    [230, 'a froglok shin knight has been slain by Krumka!'],
  ];
  const tracker = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  tracker.petNames = new Set(p.pets.keys());        // como hace el motor
  for (const [s, txt] of guion) {
    const ev = p.parse(`${stamp(s)} ${txt}`, 0);
    if (ev) tracker.feed(ev);
  }
  tracker.tick(1e12);
  ok(tracker.history.length === 0,
    'la pelea de un desconocido con una mascota de nombre reciclado no se abre',
    `${tracker.history.length} peleas`);

  // Y con la mascota de verdad sí, que es lo que no se puede romper.
  const t2 = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  t2.petNames = new Set(p.pets.keys());
  for (const [s, txt] of [
    [300, 'Kabarer pierces a froglok shin knight for 100 points of damage.'],
    [301, 'You slash a froglok shin knight for 200 points of damage.'],
    [330, 'a froglok shin knight has been slain by Campeon!'],
  ]) {
    const ev = p.parse(`${stamp(s)} ${txt}`, 0);
    if (ev) t2.feed(ev);
  }
  t2.tick(1e12);
  ok(t2.history.length === 1, 'y la tuya con tu mascota actual sí', `${t2.history.length}`);
}

// ── El nombre de una pelea en la que no llegaste a pegar ──────────────────
console.log('\nnombre de la pelea');
{
  // Lo normal: manda el abatido.
  const a = correr([
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'You have slain a gorgon!'],
  ]);
  ok(a.label === 'a gorgon', 'el enemigo abatido da nombre a la pelea', a.label);

  // Si no cae ninguno, aquel al que más pegaste.
  const b = correr([
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'You slash a rat for 10 points of damage.'],
  ]);
  ok(b.label === 'a gorgon', 'si no cae ninguno, al que más pegaste', b.label);

  // Y si no pegaste a nadie, el que te pegó a ti. Antes se quedaba sin nombre
  // y la lista la enseñaba como «escaramuza», que es lo que menos era.
  const c = correr([
    [0, 'a fire giant warrior hits Campeon for 3838 points of damage.'],
    [1, 'King Tranix hits Campeon for 472 points of damage.'],
    [2, 'You have been slain by a fire giant warrior!'],
  ]);
  ok(c.label === 'a fire giant warrior', 'quien más te pegó da nombre a la pelea', String(c.label));
  ok(c.total === 0 && c.enemyTotal === 4310,
    'sin inventarte daño tuyo por ponerle nombre', `${c.total} / ${c.enemyTotal}`);
  ok(c.losses.length === 1 && c.kills.length === 0,
    'y sigue contando como baja, no como abatido');
}

// ── Un compañero declarado clasifica, pero NO abre peleas ─────────────────
//
// La línea que no se puede cruzar. `#mine()` —tú y tus mascotas— decide si una
// pelea SE ABRE. Tu mascota pegando eres tú pegando; tu compañero pegando no lo
// es. Si un compañero declarado entrara ahí, su pelea al otro lado de la sala
// se guardaría como tuya: el mismo fallo que dieron los nombres de mascota
// reciclados, pero declarado y permanente.
console.log('\ncompañeros de grupo declarados');
{
  const conCompaneros = (guion, mates) => {
    const parser = new Parser({ self: 'Campeon' });
    const tracker = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
    const engine = new Engine();
    engine.self = 'Campeon';
    engine.parser = parser;
    engine.tracker = tracker;
    engine.setCompanions(mates);
    for (const [s, l] of guion) tracker.feed(parser.parse(`${stamp(s)} ${l}`));
    return { f: engine.snapshot().current, tracker, engine };
  };

  // Sin declarar: sale como «sin identificar», que es lo correcto mientras no
  // se sepa qué es.
  const sin = conCompaneros([
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'Notarino pierces a gorgon for 300 points of damage.'],
  ], []);
  const antes = sin.f.rows.find((r) => r.name === 'Notarino');
  ok(antes?.side === 'ally', 'sin declarar ya está en tu bando', antes?.side);
  ok(antes?.unidentified === true, 'pero marcado como sin identificar');

  // Declarado: deja de estarlo, y NO cambia ninguna cifra.
  const con = conCompaneros([
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'Notarino pierces a gorgon for 300 points of damage.'],
  ], ['Notarino']);
  const desp = con.f.rows.find((r) => r.name === 'Notarino');
  ok(desp?.unidentified === false, 'declarado deja de estar sin identificar');
  ok(desp?.side === 'ally', 'y sigue en tu bando');
  ok(con.f.total === sin.f.total && con.f.raidDps === sin.f.raidDps,
    'declararlo NO mueve ninguna cifra de la pelea',
    `${sin.f.total} -> ${con.f.total}`);
  ok(con.f.enemyTotal === sin.f.enemyTotal, 'ni las del enemigo');

  // Lo que no puede pasar bajo ningún concepto: que su pelea sea la tuya.
  const ajena = conCompaneros([
    [0, 'Notarino pierces a froglok for 300 points of damage.'],
    [1, 'a froglok hits Notarino for 50 points of damage.'],
    [2, 'a froglok has been slain by Notarino!'],
  ], ['Notarino']);
  ajena.tracker.tick(1e12);
  ok(ajena.tracker.history.length === 0,
    'una pelea suya en la que no estás NO se abre como tuya',
    `${ajena.tracker.history.length} peleas`);

  // Y no se le vuelve a preguntar si es una mascota: ya lo has contestado.
  const hint = ajena.engine.snapshot().petHint;
  const preguntados = hint?.candidates ?? [];
  ok(!preguntados.includes('Notarino'),
    'ni se pregunta si es tu mascota', preguntados.join(', ') || 'no se pregunta nada');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
