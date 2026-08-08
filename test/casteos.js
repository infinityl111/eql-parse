/**
 * Cuánto tarda cada hechizo, medido de sus propios lanzamientos.
 *
 * POR QUÉ HAY QUE MEDIRLO. El registro de EQL no escribe el tiempo de casteo, y
 * cada hechizo tiene el suyo — que además cambia con la postura y al mejorarlo.
 * Pero entre «You begin casting X» y la línea en la que X entra hay un tiempo, y
 * ese tiempo es el casteo.
 *
 * Y SE PUEDE: sobre el registro de referencia, 103 hechizos con ocho
 * lanzamientos o más y 84 de ellos con mediana de un segundo o más. De 7 s
 * (`Snails Healing`) a 4 s (`Efflorescing Heal`, 291 muestras).
 *
 * LA MEDIANA Y NO LA MEDIA. `Reckoning` da mediana 5 s y p90 17 s: los
 * lanzamientos interrumpidos y recasteados estiran la cola sin parar. La media
 * saldría de esa cola; la mediana describe el lanzamiento normal, que es lo que
 * la barra tiene que durar.
 *
 * LOS TRES ESTADOS, que es lo que se pierde si sólo se mira «¿hay barra?»:
 * medido, instantáneo y sin muestra. Los dos últimos acaban igual —sin barra—
 * y no son lo mismo: uno es un dato y el otro es no saber. Confundirlos diría
 * que un hechizo desconocido es instantáneo.
 */
import { Casteos, barra, MIN_LANZAMIENTOS } from '../src/casteos.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const lanza = (c, t, quien, que) => c.feed({ kind: 'cast', t, source: quien, ability: que });
const entra = (c, t, quien, que) => c.feed({ kind: 'spell', t, source: quien, ability: que, amount: 100 });

// ── 1. La duración sale de sus propios lanzamientos ────────────────────────
console.log('\nla duración se mide');
{
  const c = new Casteos();
  // Ocho lanzamientos de cuatro segundos.
  for (let i = 0; i < MIN_LANZAMIENTOS; i++) {
    lanza(c, i * 20, 'Campeon', 'Lifedraw');
    entra(c, i * 20 + 4, 'Campeon', 'Lifedraw');
  }
  const t = c.tabla();
  ok(t.Lifedraw?.estado === 'medido', 'con ocho muestras se afirma', t.Lifedraw?.estado);
  ok(t.Lifedraw?.segundos === 4, 'y dura lo que dura', t.Lifedraw?.segundos);
  ok(t.Lifedraw?.n === MIN_LANZAMIENTOS, 'diciendo de cuántas sale', t.Lifedraw?.n);
}

// ── 2. Con menos de ocho no se afirma nada ─────────────────────────────────
console.log('\ncon poca muestra');
{
  const c = new Casteos();
  for (let i = 0; i < MIN_LANZAMIENTOS - 1; i++) {
    lanza(c, i * 20, 'Campeon', 'Siphon Life');
    entra(c, i * 20 + 3, 'Campeon', 'Siphon Life');
  }
  const t = c.tabla();
  ok(t['Siphon Life']?.estado === 'sinMuestra', 'no se dice cuánto tarda', t['Siphon Life']?.estado);
  ok(t['Siphon Life']?.segundos === null, 'y no se inventa un número');
}

// ── 3. Instantáneo NO es lo mismo que no saber ─────────────────────────────
//
// Los dos acaban sin barra, y ahí está el peligro: si no se distinguen, un
// hechizo del que no sabemos nada se enseña como si fuera inmediato.
console.log('\ninstantáneo no es no saber');
{
  const c = new Casteos();
  for (let i = 0; i < 10; i++) {
    lanza(c, i * 20, 'Campeon', 'Frenzied Burnout');
    entra(c, i * 20, 'Campeon', 'Frenzied Burnout');     // el mismo segundo
  }
  const t = c.tabla();
  ok(t['Frenzied Burnout']?.estado === 'instantaneo', 'sale en el mismo segundo y se dice',
    t['Frenzied Burnout']?.estado);

  const b1 = barra(t, 'Frenzied Burnout');
  const b2 = barra(t, 'Un hechizo que nadie ha lanzado');
  ok(b1.estado === 'instantaneo' && b2.estado === 'sinMuestra',
    'y los dos casos sin barra se distinguen', `${b1.estado} / ${b2.estado}`);
  ok(b1.n === 10 && b2.n === 0, 'con su número de muestras cada uno', `${b1.n} / ${b2.n}`);
}

// ── 4. El registro manda sobre la mediana, y el exceso se ve ───────────────
//
// Que un hechizo de 4 s tardara 9 no es un detalle de dibujo: algo lo retrasó.
// Si la barra sólo acabara más tarde, eso se perdería.
console.log('\ncuando se pasa de lo suyo');
{
  const c = new Casteos();
  for (let i = 0; i < 10; i++) {
    lanza(c, i * 30, 'Campeon', 'Drain Spirit');
    entra(c, i * 30 + 4, 'Campeon', 'Drain Spirit');
  }
  const t = c.tabla();

  const normal = barra(t, 'Drain Spirit', 4);
  ok(normal.exceso === 0, 'lo que dura lo suyo no se marca', normal.exceso);

  const tarde = barra(t, 'Drain Spirit', 9);
  ok(tarde.esperado === 4 && tarde.real === 9, 'se conservan las dos cifras',
    `${tarde.esperado} vs ${tarde.real}`);
  ok(tarde.exceso === 5, 'y el exceso se calcula, para poder enseñarlo', tarde.exceso);

  // Más rápido de lo normal no es un exceso: es que fue más rápido.
  const pronto = barra(t, 'Drain Spirit', 2);
  ok(pronto.exceso === 0, 'ir más rápido no es pasarse', pronto.exceso);
}

// ── 5. Un interrumpido no cuenta como duración ─────────────────────────────
//
// Lo que duró hasta que lo cortaron no es lo que dura el hechizo. Pero sí tiene
// que cerrar el emparejamiento, o el siguiente desenlace se mediría desde el
// intento fallido y saldría un casteo larguísimo.
console.log('\nlos interrumpidos');
{
  const c = new Casteos();
  lanza(c, 0, 'Campeon', 'Fear');
  c.feed({ kind: 'interrupt', t: 1, source: 'Campeon', ability: 'Fear' });
  lanza(c, 10, 'Campeon', 'Fear');
  entra(c, 13, 'Campeon', 'Fear');
  const v = c.muestras.get('Fear');
  ok(v.length === 1, 'el interrumpido no deja muestra', v.length);
  ok(v[0] === 3, 'y el siguiente se mide desde SU lanzamiento, no desde el fallido', v[0]);
}

// ── 6. Recastear antes de que resuelva no mide el hueco ────────────────────
console.log('\nrecastear antes de que resuelva');
{
  const c = new Casteos();
  lanza(c, 0, 'Campeon', 'Lifetap');
  lanza(c, 2, 'Campeon', 'Lifetap');    // insiste antes de que salga el primero
  entra(c, 4, 'Campeon', 'Lifetap');
  const v = c.muestras.get('Lifetap');
  ok(v.length === 1 && v[0] === 4, 'manda el primer lanzamiento', JSON.stringify(v));
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
