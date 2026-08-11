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
import { Parser, CHARM_MAX_SEC } from '../src/parser.js';
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

// ── 3. La muerte de un NOMBRE no cierra nada ───────────────────────────────
//
// Aquí se probaba lo contrario, y era el fallo. La línea de muerte no trae
// distintivo: con tres «a large skeleton» delante, «A large skeleton has been
// slain» no dice cuál. Cerrar con eso dejaba al encantado suelto para que la
// siguiente línea de «Master» lo ascendiera a mascota permanente.
console.log('\nla muerte de un homónimo');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a ghoul has been charmed.`);
  p.parse(`${HORA(70)}You have slain a ghoul!`);
  const v = p.charmed.get('a ghoul')[0];
  ok(v.hasta === null, 'la muerte NO cierra la ventana: no identifica a nadie', v.hasta);
  ok(p.charmedAt('a ghoul', v.desde + 120), 'y el bicho sigue siendo tuyo hasta que algo fiable lo diga');
}

// ── 3b. Uno a la vez: encantar a otro cierra el anterior, y es DEDUCIDO ─────
console.log('\nencadenar');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a ghoul has been charmed.`);
  p.parse(`${HORA(70)}an ogre guard has been charmed.`);
  const g = p.charmed.get('a ghoul')[0];
  ok(g.hasta !== null, 'el encanto nuevo cierra el anterior: sólo se tiene uno', g.hasta);
  ok(g.cierre === 'encadenado', 'y queda marcado como lo que es', g.cierre);
  ok(!p.charmedAt('a ghoul', g.hasta + 5), 'después ya no es tuyo');
  ok(p.charmedAt('an ogre guard', g.hasta + 5), 'y el nuevo sí');
  ok(p.charmCierre('a ghoul', g.hasta + 5) === 'encadenado',
    'y se puede preguntar de dónde sale ese cierre, que es una deducción y no una medida');

  // El aviso escrito es otra cosa: eso sí está medido.
  const q = nuevo();
  q.parse(`${HORA(10)}a ghoul has been charmed.`);
  q.parse(`${HORA(70)}Your Charm spell has worn off of a ghoul.`);
  ok(q.charmed.get('a ghoul')[0].cierre === 'worn-off', 'el «worn off» se marca como medido',
    q.charmed.get('a ghoul')[0].cierre);
}

// ── 3c. Un encantado NO asciende nunca a mascota invocada ──────────────────
//
// El fallo que costaba dinero: 10.004 puntos de daño enemigo metidos en tu
// bando en siete peleas, porque una ventana mal cerrada dejaba pasar la línea
// de «Master». Ahora la puerta mira si el nombre estuvo encantado alguna vez.
console.log('\nel ascenso que no puede ocurrir');
{
  const p = nuevo();
  p.parse(`${HORA(0)}Kabarer told you, 'Attacking a ghoul Master.'`);
  p.parse(`${HORA(10)}a large skeleton has been charmed.`);
  // La muerte de OTRO igual ya no cierra nada, pero aunque cerrara…
  p.parse(`${HORA(32)}A large skeleton has been slain by a large skeleton!`);
  p.parse(`${HORA(86)}A large skeleton told you, 'Attacking an ogre guard Master.'`);
  ok(!p.pets.has('a large skeleton'),
    'el encantado no entra en mascotas ni con la ventana cerrada a destiempo',
    [...p.pets.keys()].join(','));
  ok(p.pets.has('Kabarer'), 'y tu mascota de verdad sigue en su sitio',
    [...p.pets.keys()].join(','));
  ok(p.currentPet === 'Kabarer', 'sin que le hayan quitado el puesto', p.currentPet);

  // Ni por la puerta del /pet who leader, que es la más fiable de las tres.
  p.parse(`${HORA(120)}A large skeleton says, 'My leader is Campeon.'`);
  ok(!p.pets.has('a large skeleton'), 'tampoco por «My leader is»',
    [...p.pets.keys()].join(','));

  // Lo que digas tú a mano sí manda: es tu decisión, no una detección.
  p.markPet('a large skeleton');
  ok(p.pets.has('a large skeleton'), 'pero marcarlo a mano sigue funcionando');
}

// ── 3d. Caducidad: una ventana no puede durar más que el hechizo ───────────
//
// El límite NO sale de una tabla del juego: sale de las ventanas que el propio
// registro cierra con «worn off», que son las únicas medidas. Ver
// `CHARM_MAX_SEC`. Es una deducción y va marcada como tal.
console.log('\nla caducidad');
{
  const p = nuevo();
  p.parse(`${HORA(10)}a ghoul has been charmed.`);
  const v = p.charmed.get('a ghoul')[0];
  ok(p.charmedAt('a ghoul', v.desde + CHARM_MAX_SEC - 1), 'dentro del tope sigue siendo tuyo');
  ok(!p.charmedAt('a ghoul', v.desde + CHARM_MAX_SEC + 1),
    'pasado el tope ya no, aunque el registro no haya dicho nada');

  // Y cualquier línea con hora vale de reloj: no hace falta otra de charm.
  p.parse(`${HORA(10 + CHARM_MAX_SEC + 60)}Campeon hits a rat for 5 points of damage.`);
  ok(v.hasta === v.desde + CHARM_MAX_SEC,
    'la ventana se cierra en el tope, no en la hora del evento que lo destapa', v.hasta - v.desde);
  ok(v.cierre === 'caducado', 'y el cierre dice de dónde sale', v.cierre);
}

// ── 3e. LA COTA, RECALCULADA ───────────────────────────────────────────────
//
// `CHARM_MAX_SEC` son 690 s = 2 × los 333 s de la ventana medida más larga del
// registro de referencia. Esta guarda no comprueba la constante: comprueba que
// el margen sigue siendo de ×2. Si algún día una ventana cerrada por «worn
// off» pasa de la mitad del tope, la muestra está diciendo que 333 s se quedó
// corto, y entonces hay que volver a medir en vez de seguir confiando.
console.log('\nel margen de la cota');
{
  const p = nuevo();
  // Las cuatro más largas del registro real, con su nombre y su duración.
  const medidas = [
    ['a Teir`Dal priest', 333], ['a Teir`Dal rogue', 246],
    ['an ogre guard', 226], ['a fire elemental', 177],
  ];
  let peor = 0;
  for (const [name, dur] of medidas) {
    const q = nuevo();
    q.parse(`${HORA(0)}${name} has been charmed.`);
    q.parse(`${HORA(dur)}Your Charm spell has worn off of ${name}.`);
    const w = q.charmed.get(name.replace(/^An? /, (m) => m.toLowerCase()))[0];
    if (w.cierre === 'worn-off') peor = Math.max(peor, w.hasta - w.desde);
  }
  ok(peor === 333, 'la ventana medida más larga sigue siendo la de 333 s', peor);
  ok(peor * 2 <= CHARM_MAX_SEC,
    `el margen sigue siendo de al menos ×2 (${peor} × 2 ≤ ${CHARM_MAX_SEC})`,
    `${(CHARM_MAX_SEC / peor).toFixed(2)}×`);
  void p;
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
