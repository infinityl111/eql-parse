/**
 * El encanto del encantador: un enemigo que es tuyo durante un rato.
 *
 * LA MECÁNICA. Encantas a un enemigo y pelea para ti; cuando se rompe, vuelve
 * a atacarte. El mismo nombre cambia de bando a mitad de la pelea, y la regla
 * de bandos de la aplicación —enemigo es quien te pega o a quien pegas— no
 * tiene una sola respuesta para él. No está mal clasificado: es que la
 * pregunta está mal hecha si se hace una sola vez por pelea.
 *
 * LO QUE DICE EL REGISTRO, medido sobre uno real con cuatro encantos:
 *
 *   [20:32:37] a hardened skeleton has been charmed.
 *   [20:32:47] A hardened skeleton told you, 'Attacking a necro acolyte Master.'
 *   [20:34:44] Your Charm spell has worn off of a hardened skeleton.
 *
 * Los dos extremos están escritos. Y la línea del medio es LA MISMA que usa
 * una mascota invocada, que es de donde venían dos fallos:
 *
 *   1. ENCANTAR RETIRABA TU MASCOTA DE VERDAD. `pet_claim` llama a `#ownPet`,
 *      que jubila a la anterior porque sólo se tiene una a la vez. Medido: al
 *      encantar, `Kabarer` desaparecía de la lista. Pero un encantado no ocupa
 *      el sitio de la invocada: se tienen las dos.
 *
 *   2. SE GUARDABA CON MAYÚSCULA. EQ escribe «A hardened skeleton» al empezar
 *      la frase, y el nombre entraba así, sin normalizar, mientras sus filas
 *      de combate van en minúscula. Salía en la lista de mascotas y no se le
 *      atribuía ni un golpe.
 *
 * Y EL FALLO QUE MÁS COSTABA: sin cerrar la ventana, el bicho seguía contando
 * como tuyo el resto de la pelea, así que lo que te pegaba después de soltarse
 * caía en el cajón de los tuyos.
 *
 * DOS CAMINOS PARA CERRARLA, y hacen falta los dos: de los cuatro encantos
 * medidos, dos acabaron con el aviso de «worn off» y los otros dos porque el
 * bicho murió sin avisar de nada. Con n=4 no se puede afirmar que siempre haya
 * aviso, así que la muerte cierra también.
 *
 * LO QUE ESTO NO RESUELVE, y queda dicho: cuál de dos bichos con el MISMO
 * nombre es el encantado. El registro no lo dice. Eso se resuelve por
 * objetivo —un salvaje no pega a otros bichos, un encantado no te pega a ti—
 * y lo que quede de verdad ambiguo, estimado y rotulado como tal.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker as Encuentros } from '../src/encounter.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const HORA = (s) => `[Fri Aug 07 20:${String(Math.floor(s / 60)).padStart(2, '0')}:${
  String(s % 60).padStart(2, '0')} 2026] `;
const nuevo = () => new Parser({ self: 'Campeon' });

// ── 1. Las dos líneas dejan de ser desconocidas ────────────────────────────
console.log('\nlas líneas del encanto');
{
  const p = nuevo();
  const a = p.parse(`${HORA(0)}a hardened skeleton has been charmed.`);
  ok(a?.kind === 'charm_on', 'el encanto se reconoce', a?.kind);
  ok(a?.target === 'a hardened skeleton', 'y saca a quién', a?.target);

  const b = p.parse(`${HORA(60)}Your Charm spell has worn off of a hardened skeleton.`);
  ok(b?.kind === 'charm_off', 'y el final también', b?.kind);
  ok(b?.target === 'a hardened skeleton', 'con su nombre', b?.target);

  // Los intentos fallidos no abren nada, pero tampoco quedan sueltos.
  const c = nuevo().parse(`${HORA(0)}This NPC cannot be charmed.`);
  ok(c?.kind === 'noise', 'un NPC que no se puede encantar es ruido, no desconocido', c?.kind);
  const d = nuevo().parse(`${HORA(0)}Asaka L\`Rei resisted your Charm!`);
  ok(d?.kind === 'noise', 'y un resistido también', d?.kind);
}

// ── 2. La ventana, con sus dos extremos ────────────────────────────────────
console.log('\nla ventana');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a hardened skeleton has been charmed.`);
  ok(p.charmedAt('a hardened skeleton', p.charmed.get('a hardened skeleton')[0].desde + 5),
    'dentro de la ventana es tuyo');
  ok(!p.charmedAt('a hardened skeleton', p.charmed.get('a hardened skeleton')[0].desde - 5),
    'antes de encantarlo, no');

  const dentro = p.charmed.get('a hardened skeleton')[0].desde + 20;
  p.parse(`${HORA(70)}Your Charm spell has worn off of a hardened skeleton.`);
  const fuera = p.charmed.get('a hardened skeleton')[0].hasta + 5;
  ok(p.charmedAt('a hardened skeleton', dentro), 'lo de dentro sigue siendo suyo después');
  ok(!p.charmedAt('a hardened skeleton', fuera),
    'y al soltarse deja de serlo: aquí es donde se contaba mal lo que te pega');
}

// ── 3. Morirse cierra la ventana igual ─────────────────────────────────────
console.log('\nsin aviso de «worn off»');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a ghoul has been charmed.`);
  p.parse(`${HORA(70)}You have slain a ghoul!`);
  const v = p.charmed.get('a ghoul')[0];
  ok(v.hasta !== null, 'la muerte la cierra: la mitad de los casos acaban así', v.hasta);
  ok(!p.charmedAt('a ghoul', v.hasta + 5), 'y después ya no es tuyo');
}

// ── 4. No retira la mascota de verdad ──────────────────────────────────────
console.log('\ntu mascota invocada');
{
  const p = nuevo();
  p.parse(`${HORA(0)}Kabarer told you, 'Attacking a ghoul Master.'`);
  ok(p.pets.has('Kabarer'), 'tienes tu mascota', [...p.pets.keys()].join(','));

  p.parse(`${HORA(10)}a hardened skeleton has been charmed.`);
  p.parse(`${HORA(11)}A hardened skeleton told you, 'Attacking a necro acolyte Master.'`);
  ok(p.pets.has('Kabarer'),
    'y encantar NO te la quita: se tiene una invocada y los encantados que duren',
    [...p.pets.keys()].join(','));
  ok(!p.pets.has('a hardened skeleton') && !p.pets.has('A hardened skeleton'),
    'el encantado no entra en la lista de mascotas: tiene su propio registro');
}

// ── 5. El nombre, normalizado ──────────────────────────────────────────────
console.log('\nel nombre con mayúscula');
{
  const p = nuevo();
  // EQ escribe el artículo en mayúscula al empezar la frase.
  p.parse(`${HORA(10)}A hardened skeleton has been charmed.`);
  ok(p.charmed.has('a hardened skeleton'),
    'entra en minúscula, como sus filas de combate', [...p.charmed.keys()].join(','));

  const p2 = nuevo();
  p2.parse(`${HORA(0)}A ghoul told you, 'Attacking something Master.'`);
  ok(p2.pets.has('a ghoul'),
    'y una mascota normal también: antes se guardaba «A ghoul» y no casaba con nada',
    [...p2.pets.keys()].join(','));
}

// ── 6. Varias ventanas sobre el mismo nombre ───────────────────────────────
console.log('\nel mismo bicho encantado dos veces');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a hardened skeleton has been charmed.`);
  p.parse(`${HORA(70)}Your Charm spell has worn off of a hardened skeleton.`);
  p.parse(`${HORA(600)}a hardened skeleton has been charmed.`);
  const v = p.charmed.get('a hardened skeleton');
  ok(v.length === 2, 'se guardan las dos, no la última', v.length);
  ok(v[0].hasta !== null && v[1].hasta === null, 'la primera cerrada y la segunda abierta');
  ok(p.charmedAt('a hardened skeleton', v[0].desde + 5), 'y la primera sigue consultable');
}

// ── 7. El bando se decide por OBJETIVO, golpe a golpe ─────────────────────
//
// EL CASO DIFÍCIL: dos bichos con el mismo nombre, uno encantado y otro no. El
// registro no los distingue, pero no hace falta distinguirlos:
//
//   - un salvaje NO pega a otros bichos  -> si pega a un bicho, es el tuyo
//   - un encantado NO te pega a ti       -> si te pega, es el salvaje
//   - y a ti no te da por pegar al tuyo  -> si le pegas, es el salvaje
//
// Medido en el peor caso del registro: 83,3% resuelto sin estimar nada. Sobre
// las tres peleas afectadas, 2.389 de daño atribuidos contra 158 ambiguos, un
// 6,2%.
console.log('\nel bando, golpe a golpe');
{
  const tr = new Encuentros({ self: 'Campeon', idleSec: 20 });
  const p = nuevo();
  const mete = (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); };

  // La pelea la abres tú. Sin esto no se abre ninguna, y eso es correcto: un
  // encantado peleando con otros bichos en la otra punta de la zona no
  // convierte eso en una pelea tuya. Aquí hay que abrirla para poder mirar.
  mete(`${HORA(9)}Campeon hits a ghoul for 10 points of damage.`);
  mete(`${HORA(10)}a hardened skeleton has been charmed.`);
  // El encantado pega a otro bicho: es tuyo.
  mete(`${HORA(12)}A hardened skeleton hits a ghoul for 100 points of damage.`);
  mete(`${HORA(13)}A hardened skeleton hits a ghoul for 100 points of damage.`);
  // El salvaje del mismo nombre te pega a ti: no lo es.
  mete(`${HORA(14)}A hardened skeleton hits Campeon for 30 points of damage.`);
  // Y uno contra otro: ambiguo.
  mete(`${HORA(15)}A hardened skeleton hits a hardened skeleton for 50 points of damage.`);

  const t = tr.current.totals();
  const enc = t.rows.find((r) => r.charmed);
  const salvaje = t.rows.find((r) => r.name === 'a hardened skeleton' && !r.charmed);

  ok(!!enc, 'el encantado sale en su propia fila');
  ok(enc?.damage === 200, 'con lo que pegó a otros bichos, y sólo eso', enc?.damage);
  ok(salvaje?.damage === 80,
    'y el salvaje con lo que te pegó a ti más el ambiguo', salvaje?.damage);
  ok(enc?.name === salvaje?.name, 'los dos con el mismo nombre: es el mismo bicho');

  ok(t.charm?.daño === 50, 'lo ambiguo se aparta y se cuenta', t.charm?.daño);
  ok(t.charm?.golpes === 1, 'una sola vez por golpe, no dos', t.charm?.golpes);
  ok(typeof t.charm?.estimadoTuyo === 'number',
    'y se estima con el ritmo que cada uno demostró', t.charm?.estimadoTuyo);
  ok(enc.damage === 200,
    'lo estimado NO se suma al daño medido: medido y deducido nunca en la misma casilla',
    enc.damage);
}

// ── 8. Sin encanto no cambia nada ──────────────────────────────────────────
console.log('\nuna pelea normal');
{
  const tr = new Encuentros({ self: 'Campeon', idleSec: 20 });
  const p = nuevo();
  const mete = (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); };
  mete(`${HORA(10)}A hardened skeleton hits Campeon for 30 points of damage.`);
  mete(`${HORA(11)}Campeon hits a hardened skeleton for 90 points of damage.`);
  const t = tr.current.totals();
  ok(!t.rows.some((r) => r.charmed), 'nadie sale marcado como encantado');
  ok(t.charm === null, 'y no hay nada ambiguo que rotular', JSON.stringify(t.charm));
  const f = t.rows.find((r) => r.name === 'a hardened skeleton');
  ok(f?.damage === 30 && f?.taken === 90, 'una sola fila con sus dos mitades',
    `${f?.damage}/${f?.taken}`);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
