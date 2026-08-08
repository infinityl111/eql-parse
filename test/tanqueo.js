/**
 * Aguantar: lo que llegó, lo que no, y lo que NO se puede decir.
 *
 * LO QUE ESTA VISTA NO DICE, Y ES LO PRIMERO. Si estuviste cerca de morir. El
 * registro no da la vida de nadie —ni la tuya— así que 3.000 recibidos son
 * una tragedia con 3.100 de vida y un paseo con 12.000, y la aplicación no
 * sabe cuál de las dos. Por eso no hay barras de presión, ni colores de
 * peligro, ni porcentajes que se parezcan a una barra de vida: hay cuentas.
 *
 * LOS DATOS YA ESTABAN, y ése fue el hallazgo al mirarlo: el desglose
 * defensivo se pintaba desde hacía versiones, pero DENTRO de la fila de cada
 * uno, al desplegarla. Eso sirve para saber cómo te fue a ti si te acuerdas de
 * abrir tu fila; no sirve para la pregunta del rol, que es quién aguantó en
 * esta pelea. Un dato al que hay que ir no es el mismo dato que uno puesto.
 *
 * Medido sobre el registro de referencia, defendiéndote tú: 19.939 fallos,
 * 1.450 paradas, 1.408 esquivas, 1.237 contraataques, 136 absorbidos. Y un
 * dato que se lee solo: bloqueas 0 veces y te bloquean 978.
 *
 * LO ÚNICO QUE HUBO QUE PARSEAR fue la runa. Absorbe el golpe entero, así que
 * no es daño ni es curación: es daño que NO llegó, y va en su propio sitio en
 * vez de sumarse a nada.
 *
 * Y SON POCAS: 29 líneas en todo el registro, 27 dentro de alguna pelea. Con
 * veintitantos datos no se saca ninguna proporción, así que se enseña el bruto
 * con la cuenta de runas al lado y nunca un porcentaje.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const HORA = (s) => `[Fri Aug 07 20:00:${String(s).padStart(2, '0')} 2026] `;
const monta = () => {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  return { tr, mete: (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); }, p };
};

// ── 1. La runa se reconoce y no es daño ni curación ────────────────────────
console.log('\nla runa');
{
  const { p } = monta();
  const ev = p.parse(`${HORA(0)}You gain a rune for 394 points of absorption.`);
  ok(ev?.kind === 'absorb', 'la línea deja de ser desconocida', ev?.kind);
  ok(ev?.amount === 394, 'con su cifra', ev?.amount);
  ok(ev?.target === 'Campeon', 'y a quién protegió', ev?.target);
}

// ── 2. No abre pelea por su cuenta ─────────────────────────────────────────
console.log('\nsola no abre pelea');
{
  const { tr, mete } = monta();
  mete(`${HORA(1)}You gain a rune for 394 points of absorption.`);
  ok(!tr.current, 'una runa suelta no inventa un combate: no dice ni contra quién');
}

// ── 3. Dentro de una pelea, cuenta aparte ──────────────────────────────────
console.log('\ndentro de una pelea');
{
  const { tr, mete } = monta();
  mete(`${HORA(1)}a ghoul hits Campeon for 100 points of damage.`);
  mete(`${HORA(2)}You gain a rune for 394 points of absorption.`);
  mete(`${HORA(3)}You gain a rune for 6 points of absorption.`);
  const yo = tr.current.totals().rows.find((r) => r.name === 'Campeon');
  ok(yo?.taken === 100, 'lo que llegó sigue siendo lo que llegó', yo?.taken);
  ok(yo?.absorbed === 400, 'y lo absorbido va por su cuenta, sin sumarse', yo?.absorbed);
  ok(yo?.absorbHits === 2, 'con su cuenta de runas, que es lo que da la escala',
    yo?.absorbHits);
}

// ── 4. El desglose de lo que no entró ──────────────────────────────────────
console.log('\nlo que no entró');
{
  const { tr, mete } = monta();
  mete(`${HORA(1)}a ghoul hits Campeon for 50 points of damage.`);
  mete(`${HORA(2)}a ghoul tries to hit Campeon, but Campeon parries!`);
  mete(`${HORA(3)}a ghoul tries to hit Campeon, but Campeon dodges!`);
  mete(`${HORA(4)}a ghoul tries to hit Campeon, but misses!`);
  const yo = tr.current.totals().rows.find((r) => r.name === 'Campeon');
  const d = new Map(yo.defense.map(([k, v]) => [k, v.n ?? v]));
  ok(yo.swingsAgainst === 4, 'se cuentan los cuatro intentos', yo.swingsAgainst);
  ok(d.get('parada') === 1 && d.get('esquiva') === 1,
    'y se distingue parar de esquivar', [...d].map(([k, n]) => `${k}:${n}`).join(' '));
  ok(d.get('fallo') === 1, 'del fallo a secas, que no es mérito de tu armadura', d.get('fallo'));
}

// ── 5. Nada aquí habla de vida ─────────────────────────────────────────────
//
// La guarda de la condición: si alguien añade un «% de vida», una barra de
// presión o un «casi mueres», esto se cae. No se puede calcular y no se va a
// insinuar.
console.log('\nnada que hable de vida');
{
  const fs = await import('node:fs');
  const app = fs.readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');
  const bloque = app.slice(app.indexOf('function tanqueoHTML'), app.indexOf('function renderRows'));
  ok(bloque.length > 200, 'la vista existe', bloque.length);
  const prohibido = ['hpPct', 'healthPct', 'vidaRestante', 'closeCall', 'nearDeath', 'presion'];
  const hay = prohibido.filter((x) => bloque.includes(x));
  ok(hay.length === 0, 'no calcula nada parecido a una barra de vida', hay.join(', '));
  ok(!/max(Hp|Health)/i.test(bloque), 'ni supone una vida máxima que el log no da');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
