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

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
