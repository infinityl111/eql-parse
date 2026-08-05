/**
 * Avisos de supervivencia.
 *
 * Todas las líneas de aquí están copiadas de un log real de EQL de 62.080
 * líneas, con su recuento al lado. Ninguna es inventada: si EQL cambia un
 * texto, esta prueba se entera antes que el usuario.
 */
import { Parser } from '../src/parser.js';
import { Narrator, DEFAULT_NARRATE } from '../src/narrator.js';
import { setLang } from '../src/i18n.js';

setLang('es');
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

// ── Las líneas, tal cual salen del log ────────────────────────────────────
const LINEAS = [
  ['You have been knocked unconscious!',                              'unconscious'],
  ['You are no longer feigning death, because a spell hit you.',      'feign'],
  ['You feel yourself starting to appear.',                           'invisFading'],
  ['Your skin stops tingling.',                                       'invisGone'],
  ['You appear.',                                                     'invisGone'],
  ['You feel as if you are about to fall.',                           'levitateFading'],
  ['You can no longer levitate.',                                     'levitateGone'],
  ['You have been summoned!',                                         'summoned'],
  ['Your invulnerability fades.',                                     'invuln'],
  ['Your enemies have forgotten you!',                                'forgotten'],
];

console.log('\nlas líneas del log se reconocen');
{
  const p = new Parser({ self: 'Campeon' });
  for (const [linea, what] of LINEAS) {
    const ev = p.parse(`${stamp(0)} ${linea}`);
    ok(ev?.kind === 'survival' && ev.what === what, `«${linea}»`, `${ev?.kind}/${ev?.what}`);
  }
  const ev = p.parse(`${stamp(0)} You suspect that this being can see you.`);
  ok(ev?.kind === 'seeinvis', '«You suspect that this being can see you.» va aparte', ev?.kind);
}

// ── El aviso previo ya no cuenta como muerte ──────────────────────────────
console.log('\nknocked unconscious no es una muerte');
{
  const p = new Parser({ self: 'Campeon' });
  // Secuencia real: siempre van juntas, en el mismo segundo.
  const a = p.parse(`${stamp(0)} You have been knocked unconscious!`);
  const b = p.parse(`${stamp(0)} You have been slain by King Tranix!`);
  ok(a.kind === 'survival', 'la primera es un aviso');
  ok(b.kind === 'death' && b.victim === 'Campeon', 'y sólo la segunda es la muerte');

  const c = p.parse(`${stamp(1)} You died.`);
  ok(c.kind === 'death' && c.victim === 'Campeon', '«You died.» también es muerte');
}

// ── El narrador: qué habla y con qué prioridad ────────────────────────────
const narrar = (lineas, cfg = {}) => {
  const p = new Parser({ self: 'Campeon' });
  const n = new Narrator(cfg);
  n.setSelf('Campeon');
  const dichos = [];
  n.on('say', (a) => dichos.push(a));
  for (const [s, linea] of lineas) n.feed(p.parse(`${stamp(s)} ${linea}`));
  return dichos;
};

console.log('\ncortan por delante de todo');
{
  const d = narrar([[0, 'You have been summoned!']]);
  ok(d.length === 1, 'se avisa de la invocación');
  ok(d[0].priority === true, 'con prioridad');
  ok(d[0].queue === false, 'sin encolar: corta lo que esté sonando');
  ok(d[0].kind === 'bad', 'y marcado como grave');
}

console.log('\nno se deduplican');
{
  // La invisibilidad se cae dos veces en menos de un minuto: dos avisos.
  const d = narrar([[0, 'You appear.'], [25, 'You appear.']]);
  ok(d.length === 2, 'dos caídas de invisibilidad, dos avisos', `${d.length}`);

  // Y tres roturas de Feign Death seguidas, tres avisos.
  const f = narrar([[0, 'You are no longer feigning death, because a spell hit you.'],
    [5, 'You are no longer feigning death, because a spell hit you.'],
    [9, 'You are no longer feigning death, because a spell hit you.']]);
  ok(f.length === 3, 'tres roturas de Feign Death, tres avisos', `${f.length}`);
}

console.log('\nla levitación corta a las dos primeras');
{
  // La racha real del log: tres avisos cada 6 s y la caída en el tercero.
  const d = narrar([[0, 'You feel as if you are about to fall.'],
    [6, 'You feel as if you are about to fall.'],
    [12, 'You feel as if you are about to fall.'],
    [12, 'You can no longer levitate.']]);
  ok(d.length === 2, 'de tres avisos se dicen dos', `${d.length}`);

  // Una racha nueva más tarde vuelve a tener sus dos.
  const e = narrar([[0, 'You feel as if you are about to fall.'],
    [6, 'You feel as if you are about to fall.'],
    [12, 'You feel as if you are about to fall.'],
    [12, 'You can no longer levitate.'],
    [200, 'You feel as if you are about to fall.'],
    [206, 'You feel as if you are about to fall.'],
    [212, 'You feel as if you are about to fall.']]);
  ok(e.length === 4, 'y la siguiente racha vuelve a avisar dos veces', `${e.length}`);
  ok(!d.some((x) => /levitateGone/.test(x.text ?? '')), 'la caída en sí no se anuncia: ya es tarde');
}

console.log('\n«te han perdido» es una buena noticia, no una alarma');
{
  const d = narrar([[0, 'Your enemies have forgotten you!']]);
  ok(d.length === 1, 'se dice');
  ok(d[0].queue === true, 'pero encolado, sin cortar a nadie');
  ok(!d[0].priority, 'y sin prioridad');
  ok(d[0].kind === 'info', 'con voz normal', d[0].kind);
}

console.log('\nFeign Death interrumpido');
{
  const d = narrar([[0, 'Your Feign Death spell is interrupted.']]);
  ok(d.length === 1 && d[0].priority === true,
    'es un aviso de supervivencia, no un casteo perdido más');
  // Un casteo cualquiera interrumpido sigue siendo un aviso normal.
  const e = narrar([[0, 'Your Drain Spirit spell is interrupted.']]);
  ok(e.length === 1 && !e[0].priority, 'otro hechizo interrumpido no lleva prioridad');
}

console.log('\ncada casilla apaga lo suyo');
{
  const d = narrar([[0, 'You have been summoned!'], [1, 'You appear.']],
    { survival: { summoned: false, invisGone: true, feign: true, invisFading: true,
      levitateFading: true, invuln: true, unconscious: true, forgotten: true } });
  ok(d.length === 1, 'apagar «te invocan» calla sólo eso', `${d.length}`);
}

console.log('\n«ese bicho te ve» va aparte y sí se deduplica');
{
  const linea = 'You suspect that this being can see you.';
  // Apagada por defecto.
  ok(narrar([[0, linea]]).length === 0, 'por defecto no dice nada');
  const cfg = { combat: { seeinvis: true } };
  // El juego la repite cuatro veces en dos segundos: sólo una.
  const d = narrar([[0, linea], [1, linea], [1, linea], [2, linea]], cfg);
  ok(d.length === 1, 'encendida, cuatro repeticiones en dos segundos son un aviso', `${d.length}`);
  ok(!d[0].priority, 'y no corta: no es un peligro sobrevenido');
}


// ── Opciones nuevas en una configuración vieja ───────────────────────────
console.log('\nuna casilla nueva no llega apagada a quien ya tenía configuración');
{
  // La clase de fallo: la mezcla plana sustituía el grupo entero, así que
  // cada opción que se añadiera después nacía apagada para todo el mundo,
  // en silencio. Una función que no avisa se parece a una que no existe.
  const n = new Narrator();
  n.setConfig({ combat: { stance: false } });   // configuración de hace tres versiones
  ok(n.config.combat.stance === false, 'lo que guardaste se respeta', String(n.config.combat.stance));
  ok(n.config.combat.petprompt === DEFAULT_NARRATE.combat.petprompt,
    'y lo que no guardaste coge el valor de fábrica', String(n.config.combat.petprompt));
  ok(n.config.survival !== undefined, 'los grupos que faltan aparecen enteros');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
