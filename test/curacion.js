/**
 * Curación: que cada una vaya a quien es, y que nadie se invente combatientes.
 *
 * Cuatro defectos distintos, todos medidos sobre un log real de 278.299 líneas
 * antes de arreglarlos. Los tres primeros son de ATRIBUCIÓN —la línea se lee
 * bien pero acaba en el sitio equivocado— y son los que se comprueban aquí. El
 * cuarto es de modelo (la vida estimada no descuenta lo que al enemigo le
 * curaron) y no se toca desde este fichero: cambiarlo mueve todas las vidas ya
 * guardadas y va con su propio informe de antes y después.
 *
 *   1.126  «You healed Campeon over time for 153 …»
 *          El sufijo del tic se pegaba al nombre. «Campeon over time» llegó a
 *          la tabla «a quién has curado» de la ficha en 105 peleas, con 147.772
 *          pv: un nombre inventado con aspecto de dato medido, al lado del
 *          «Campeon» de verdad.
 *
 *   1.131  «a worry wraith pet healed himself for 613 …»
 *          El pronombre se tomaba por un combatiente. La autocuración de un
 *          enemigo no llegaba nunca al enemigo, así que su vida estimada no
 *          podía descontarla.
 *
 *     321  «Lord Nagafen healed you for 451 hit points by Leech Touch I.»
 *          Tu propio drenaje, con el enemigo de sanador porque es quien recibió
 *          el golpe. Engordaba la curación hecha por cada jefe con la tuya.
 *
 * El caso que evita que el arreglo del tercero se pase de listo va al final:
 * un compañero que te cura de verdad tiene que seguir constando como sanador.
 * En el log son 25 líneas —todas de Kalforgelp o Notarino— y ninguna viene de
 * alguien a quien estuvierais pegando.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const linea = (cuerpo) => `[Tue Aug 04 12:37:24 2026] ${cuerpo}`;
const parse = (cuerpo) => new Parser({ self: 'Campeon' }).parse(linea(cuerpo));

/** Pasa un guion de líneas por el parser y el rastreador, y cierra la pelea. */
function correr(cuerpos, self = 'Campeon') {
  const p = new Parser({ self });
  const tr = new EncounterTracker({ self });
  const cerradas = [];
  tr.on('close', (e) => cerradas.push(e));
  cuerpos.forEach((c, i) => {
    const ev = p.parse(`[Tue Aug 04 12:37:${String(24 + i).padStart(2, '0')} 2026] ${c}`, i);
    if (ev) tr.feed(ev);
  });
  const enc = tr.current ?? cerradas[cerradas.length - 1];
  return { enc, filas: enc ? enc.totals().rows : [] };
}
const fila = (filas, n) => filas.find((r) => r.name === n);
const curadoA = (r, n) => (r?.healByTarget ?? []).find(([k]) => k === n)?.[1]?.sum ?? 0;

// ── 1. «over time» no es parte del nombre ──────────────────────────────────
console.log('\nel sufijo del tic no es un combatiente');
{
  const ev = parse('You healed Campeon over time for 153 hit points by Efflorescing Heal.');
  ok(ev.target === 'Campeon', 'el destino es Campeon, no «Campeon over time»', ev.target);
  ok(ev.overTime === true, 'queda marcado como tic de curación con duración', ev.overTime);

  const { filas } = correr([
    'You hit a froglok for 100 points of magic damage by Lifedraw.',
    'You healed Campeon for 200 hit points by Efflorescing Heal.',
    'You healed Campeon over time for 153 hit points by Efflorescing Heal.',
  ]);
  const yo = fila(filas, 'Campeon');
  ok(curadoA(yo, 'Campeon over time') === 0, 'no aparece en «a quién has curado»');
  ok(curadoA(yo, 'Campeon') === 353, 'las dos curaciones van al mismo nombre', curadoA(yo, 'Campeon'));
}

// ── 2. El pronombre es quien cura ──────────────────────────────────────────
console.log('\nel pronombre reflexivo se resuelve');
{
  for (const [pron, cuerpo] of [
    ['himself', 'a worry wraith pet healed himself for 613 hit points by Mend.'],
    ['itself', 'Lord Nagafen healed itself for 900 hit points by Mend.'],
    ['herself', 'a forsaken revenant healed herself for 300 hit points by Mend.'],
  ]) {
    const ev = parse(cuerpo);
    const quien = /^(.+?) healed/.exec(cuerpo)[1];
    ok(ev.target === quien, `«${pron}» se resuelve a «${quien}»`, ev.target);
  }
  // Las dos juntas, que es donde falla si se resuelven en el orden contrario.
  const ev = parse('the Spiroc Guardian healed itself over time for 120 hit points by Mend.');
  ok(ev.target === 'the Spiroc Guardian', '«itself over time»: sufijo primero, pronombre después', ev.target);
  ok(ev.overTime === true, 'y sigue constando como tic', ev.overTime);

  const { filas } = correr([
    'You hit Lord Nagafen for 100 points of magic damage by Lifedraw.',
    'Lord Nagafen healed itself for 900 hit points by Mend.',
  ]);
  const nag = fila(filas, 'Lord Nagafen');
  ok(nag?.healingTaken === 900, 'la autocuración del enemigo llega al enemigo', nag?.healingTaken);
  ok(curadoA(nag, 'itself') === 0, '«itself» no consta como curado');
}

// ── 3. La sanguijuela es tuya, no del que la recibe ────────────────────────
console.log('\nel drenaje se le apunta a quien lo lanza');
{
  const { enc, filas } = correr([
    'Lord Nagafen has taken 451 damage from your Harm Touch X.',
    'Lord Nagafen healed you for 451 hit points by Leech Touch I.',
  ]);
  const nag = fila(filas, 'Lord Nagafen');
  const yo = fila(filas, 'Campeon');
  ok((nag?.healingDone ?? 0) === 0, 'el enemigo no consta como sanador', nag?.healingDone);
  ok(yo?.healingDone === 451, 'la curación es tuya', yo?.healingDone);
  ok(yo?.healingTaken === 451, 'y la recibes tú', yo?.healingTaken);
  ok(enc.lifetaps === 1, 'queda contada como sanguijuela', enc.lifetaps);
}

// ── 4. …pero un compañero que te cura de verdad sigue siendo el sanador ────
//
// El arreglo de arriba mira si al «sanador» le estabais pegando. Un compañero
// al que curas primero NO cuenta: `foesSeen` se llena también con destinos de
// curación y por eso la regla usa un conjunto aparte, sólo de golpeados.
console.log('\nla curación de un compañero no se confunde con un drenaje');
{
  const { enc, filas } = correr([
    'You hit a froglok for 100 points of magic damage by Lifedraw.',
    'You healed Kalforgelp for 500 hit points by Greater Healing.',
    'Kalforgelp healed you for 300 hit points by Symbol of Ryltan.',
  ]);
  const kal = fila(filas, 'Kalforgelp');
  const yo = fila(filas, 'Campeon');
  ok(kal?.healingDone === 300, 'Kalforgelp sigue constando como sanador', kal?.healingDone);
  ok(yo?.healingTaken === 300, 'y tú como curado', yo?.healingTaken);
  ok(enc.lifetaps === 0, 'no se cuenta ninguna sanguijuela', enc.lifetaps);
  ok(yo?.healingDone === 500, 'tu curación a él no se toca', yo?.healingDone);
}

// ── 5. La vida estimada descuenta lo que al enemigo le curaron ─────────────
//
// Éste no es un fallo de atribución como los cuatro de arriba: es de MODELO. La
// muestra de vida era «daño hasta que cayó», y un enemigo al que sanan 5.000
// por el camino no tiene 5.000 puntos de vida más. Cambia la cifra de 59 de los
// 147 enemigos de un log real, un 3,9% menos en total.
console.log('\nla vida estimada no cuenta el daño deshecho');
{
  const { enc } = correr([
    'You hit a scareling for 1000 points of magic damage by Lifedraw.',
    'a scareling healed itself for 400 hit points by Mend.',
    'You hit a scareling for 400 points of magic damage by Lifedraw.',
    'You have slain a scareling!',
  ]);
  ok(enc.hpSamples.get('a scareling')?.[0] === 1000,
    '1400 de daño menos 400 de cura son 1000 de vida', enc.hpSamples.get('a scareling')?.[0]);
}
// Dos muertes seguidas: la resta va tramo a tramo, no repartida.
{
  const { enc } = correr([
    'You hit a froglok for 500 points of magic damage by Lifedraw.',
    'You have slain a froglok!',
    'You hit a froglok for 900 points of magic damage by Lifedraw.',
    'a froglok healed itself for 300 hit points by Mend.',
    'You hit a froglok for 300 points of magic damage by Lifedraw.',
    'You have slain a froglok!',
  ]);
  const m = enc.hpSamples.get('a froglok') ?? [];
  ok(m[0] === 500, 'la primera muerte no arrastra curación posterior', m[0]);
  ok(m[1] === 900, 'la segunda descuenta sólo la de su tramo', m[1]);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
