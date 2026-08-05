/**
 * Clases inferidas, bandos por curación y avisos que piden un comando.
 *
 * Se prueba la CLASE de fallo, no el caso concreto. En EQL puedes cambiar de
 * trío de clases y el log no lo dice en ninguna parte: lo único que delata el
 * cambio es un hechizo que sólo una clase puede lanzar. Y lo único que da el
 * NIVEL es un /who, que sólo escribes tú. De ahí los dos avisos.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { proofOf, ownersOf } from '../src/classes.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};
const stamp = (s) => {
  const d = new Date(2026, 7, 4, 12, 0, 0);
  d.setSeconds(d.getSeconds() + s);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

/** Motor con parser y seguidor de verdad, sin log ni almacén. */
function motor() {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const e = new Engine();
  e.self = 'Campeon'; e.parser = p; e.tracker = tr;
  const alertas = [];
  e.on('alert', (a) => alertas.push(a));
  return { e, p, tr, alertas, meter: (s, l) => tr.feed(p.parse(`${stamp(s)} ${l}`)) };
}

// ── 1. El diccionario de hechizos exclusivos ─────────────────────────────
console.log('\nqué prueba un hechizo y qué no');
{
  ok(proofOf('Hechizo Que No Existe') === null,
    'un hechizo que no está en ninguna lista no prueba nada');
  ok(ownersOf('Hechizo Que No Existe').length === 0,
    'y tampoco tiene dueños');

  // La regla entera: sólo prueba si el dueño es UNO. Media inferencia es peor
  // que ninguna, porque sustituye una clase buena por otra a ciegas.
  let exclusivos = 0, compartidos = 0, malos = 0;
  const todos = new Set();
  for (const c of ['SHD', 'MAG', 'DRU', 'SHM', 'WIZ']) {
    for (const s of ownersOf.byClass?.(c) ?? []) todos.add(s);
  }
  // Si no hay índice inverso, se recorre lo que se pueda comprobar a mano.
  for (const s of todos.size ? todos : ['Burnout', 'Shield of Words']) {
    const n = ownersOf(s).length;
    if (n === 1) { exclusivos++; if (!proofOf(s)) malos++; }
    else if (n > 1) { compartidos++; if (proofOf(s)) malos++; }
  }
  ok(malos === 0, 'proofOf coincide con ownersOf en todos los hechizos conocidos',
    `${exclusivos} exclusivos, ${compartidos} compartidos, ${malos} discrepancias`);
}

// ── 2. Un hechizo exclusivo que no cuadra con el trío ────────────────────
console.log('\nun hechizo que no puede ser de tu trío');
{
  // Se busca un hechizo exclusivo de verdad en el diccionario para no atar
  // el test a un nombre concreto: si mañana cambia la lista del wiki, el test
  // sigue probando la regla.
  const candidatos = ['Burnout', 'Elemental Armor', 'Shield of Brambles', 'Skin like Wood'];
  const conDueno = candidatos.map((s) => [s, proofOf(s)]).filter(([, c]) => c);

  if (!conDueno.length) {
    ok(false, 'hay al menos un hechizo exclusivo con el que probar');
  } else {
    const [hechizo, clase] = conDueno[0];
    // Trío que NO incluye esa clase.
    const trio = ['WAR', 'CLR', 'ROG'].filter((c) => c !== clase).slice(0, 3);
    const { e, tr, alertas, meter } = motor();
    e.whoClasses = trio;
    e.level = 50; tr.level = 50;
    e.classSourceAt = '/who';
    for (const c of trio) e.lastProof.set(c, 1);

    meter(0, 'You slash a gorgon for 100 points of damage.');
    e.classProof({ t: 10, ability: hechizo });

    ok(e.whoClasses.includes(clase),
      `${hechizo} mete a ${clase} en el trío`, e.whoClasses.join('/'));
    ok(e.whoClasses.length === 3, 'el trío sigue siendo de tres', e.whoClasses.join('/'));
    ok(e.level === null,
      'el nivel se borra: no se puede deducir de un hechizo, sólo de un /who');
    ok(e.classPrompt?.spell === hechizo, 'queda pendiente el aviso en pantalla');

    const av = alertas.filter((a) => a.id === 'class-contradiction');
    ok(av.length === 1, 'avisa una vez', `${av.length}`);
    ok(av[0]?.speak === null, 'en pantalla, no por voz');
    ok(av[0]?.text.includes(hechizo), 'el aviso nombra el hechizo', av[0]?.text?.slice(0, 60));

    // El mismo hechizo otra vez no vuelve a avisar.
    e.classProof({ t: 20, ability: hechizo });
    ok(alertas.filter((a) => a.id === 'class-contradiction').length === 1,
      'no se repite por cada lanzamiento del mismo hechizo');
  }
}

console.log('\nun hechizo que sí cuadra no toca nada');
{
  const candidatos = ['Burnout', 'Elemental Armor', 'Shield of Brambles', 'Skin like Wood'];
  const conDueno = candidatos.map((s) => [s, proofOf(s)]).filter(([, c]) => c);
  if (conDueno.length) {
    const [hechizo, clase] = conDueno[0];
    const { e, tr, alertas } = motor();
    e.whoClasses = [clase, 'WAR', 'CLR'];
    e.level = 50; tr.level = 50;
    e.classProof({ t: 10, ability: hechizo });
    ok(e.level === 50, 'el nivel se queda como estaba');
    ok(alertas.filter((a) => a.id === 'class-contradiction').length === 0, 'y no avisa de nada');
  }
}

// ── 3. La regla del sanador ──────────────────────────────────────────────
console.log('\nquien cura a un enemigo es enemigo');
{
  const { e, meter } = motor();
  meter(0, 'You slash a ghoul knight for 100 points of damage.');
  meter(1, 'A ghoul knight hits YOU for 40 points of damage.');
  // El savant no pega a nadie: sólo cura. Sin esta regla se cuela en tu bando
  // y ensucia el DPS de grupo con un enemigo dentro.
  meter(2, 'A ghoul savant healed a ghoul knight for 200 hit points.');
  const f = e.snapshot().current;
  const savant = f.rows.find((r) => /savant/i.test(r.name));
  ok(!!savant, 'el sanador aparece en la pelea', savant ? savant.name : '(no aparece)');
  ok(savant?.side === 'enemy', 'y queda del lado del enemigo', savant?.side);
}

console.log('\ncurar a los tuyos no te hace enemigo');
{
  const { e, meter } = motor();
  meter(0, 'You slash a ghoul knight for 100 points of damage.');
  meter(1, 'Nimnen healed you for 200 hit points.');
  const f = e.snapshot().current;
  const n = f.rows.find((r) => r.name === 'Nimnen');
  ok(!n || n.side === 'ally', 'el que te cura sigue de los tuyos', n?.side ?? '(ausente)');
}

// ── 4. Aliados sin identificar ───────────────────────────────────────────
console.log('\naliados de los que no hay ningún /who');
{
  const { e, meter } = motor();
  meter(0, 'You slash a ghoul knight for 100 points of damage.');
  meter(1, 'Nimnen slashes a ghoul knight for 500 points of damage.');
  const f = e.snapshot().current;
  const n = f.rows.find((r) => r.name === 'Nimnen');
  ok(n?.side === 'ally', 'sigue en la pelea: hizo daño real', n?.side);
  ok(n?.unidentified === true, 'pero marcado como sin identificar', String(n?.unidentified));
  const yo = f.rows.find((r) => r.name === 'Campeon');
  ok(yo?.unidentified === false, 'tú nunca eres un desconocido', String(yo?.unidentified));
}

console.log('\ncon un /who deja de serlo');
{
  const { e, meter } = motor();
  e.whoSeen.add('Nimnen');
  meter(0, 'You slash a ghoul knight for 100 points of damage.');
  meter(1, 'Nimnen slashes a ghoul knight for 500 points of damage.');
  const n = e.snapshot().current.rows.find((r) => r.name === 'Nimnen');
  ok(n?.unidentified === false, 'ya no está sin identificar', String(n?.unidentified));
}

// ── 5. El aviso de la mascota ────────────────────────────────────────────
console.log('\naviso de mascota: uno por nombre y sesión');
{
  const { e, alertas, meter } = motor();
  meter(0, 'You slash a gorgon for 100 points of damage.');
  meter(1, 'Gyzrix slashes a gorgon for 60 points of damage.');
  const f = e.snapshot().current;
  e.petPrompt(f);
  e.petPrompt(f);
  e.petPrompt(f);
  const av = alertas.filter((a) => a.id === 'pet-unknown');
  ok(av.length === 1, 'avisa una sola vez por nombre', `${av.length} avisos`);
  ok(av[0]?.speak === null, 'en pantalla, no por voz');
  ok(av[0]?.text.includes('Gyzrix'), 'el aviso nombra a quién', av[0]?.text?.slice(0, 60));
}

console.log('\nel aviso de mascota se puede apagar');
{
  const { e, alertas, meter } = motor();
  e.narrator.setConfig({ combat: { petprompt: false } });
  meter(0, 'You slash a gorgon for 100 points of damage.');
  meter(1, 'Gyzrix slashes a gorgon for 60 points of damage.');
  e.petPrompt(e.snapshot().current);
  ok(alertas.filter((a) => a.id === 'pet-unknown').length === 0,
    'con la casilla apagada no aparece');
}

console.log('\nal releer el log no se avisa de nada');
{
  const { e, alertas, meter } = motor();
  e.backfilling = true;
  meter(0, 'You slash a gorgon for 100 points of damage.');
  meter(1, 'Gyzrix slashes a gorgon for 60 points of damage.');
  e.petPrompt(e.snapshot().current);
  e.whoClasses = ['WAR', 'CLR', 'ROG'];
  e.classProof({ t: 10, ability: 'Burnout' });
  ok(alertas.length === 0, 'reconstruir el histórico no dispara avisos', `${alertas.length}`);
}


// ── La etiqueta de procedencia no puede mentir ───────────────────────────
console.log('\nla interfaz dice de dónde salió el trío');
{
  // whoClasses ya no viene sólo de un /who: lo escriben también la tabla
  // manual y la inferencia. Si las tres dicen «leídas de tu /who», se pierde
  // justo la distinción que este programa existe para conservar.
  const { e: e1 } = motor();
  e1.whoClasses = ['SHD','DRU','MAG']; e1.classSourceAt = '/who';
  ok(e1.classSource === 'who', 'un /who se declara como /who', e1.classSource);

  const { e: e2 } = motor();
  e2.whoClasses = ['SHM','DRU','MAG']; e2.classSourceAt = 'inferido';
  ok(e2.classSource === 'hechizos', 'lo deducido se declara deducido', e2.classSource);

  const { e: e3 } = motor();
  e3.whoClasses = ['SHD','MAG','DRU']; e3.classSourceAt = 'manual';
  ok(e3.classSource === 'tabla', 'lo declarado se declara declarado', e3.classSource);
}
console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
