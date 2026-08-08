/**
 * La forma del golpe: tres cifras que aguantan un golpe raro.
 *
 * POR QUÉ SE QUITÓ EL MÍN–MÁX. El mínimo y el máximo de un ataque son los dos
 * únicos números de su fila que UN SOLO golpe puede mover: son muestras de n=1
 * puestas al lado de sumas de cientos, y se leían como si valieran lo mismo.
 * Medido sobre el registro de referencia, `a zol ghoul knight · hits` con n=557
 * da 3 / 25 / 60: el mínimo es 0,12× la mediana. «Entre 3 y 60» de un ataque
 * que hace 25 casi siempre no informa de menos, informa de otra cosa.
 *
 * QUÉ SE GUARDA. Tres números por habilidad. El recuento entero se queda en
 * memoria mientras dura la pelea y no llega al disco: eran 60 habilidades por
 * 10 filas por pelea para pintar un dibujo que casi nadie abre.
 *
 * Y LO QUE NO SE PUEDE HACER CON ELLOS: fundirlos. Al sumar varias peleas los
 * percentiles se caen, porque sacarlos de los de las partes exigiría las
 * muestras y las muestras se quedaron en la pelea que las midió. La prueba de
 * abajo fija eso, que es lo que se rompería «arreglándolo» sin pensar.
 *
 * LA DOBLE JOROBA es lo único de aquí que se dice con palabras, y por eso es lo
 * que se prueba con más casos: es un hallazgo de atribución —bajo un nombre
 * puede haber dos cosas— y una frase que se equivoca cuesta más que un dibujo
 * que no se entiende. Se comprueba que NO salta con los críticos, que ya van
 * contados en su columna y harían bimodal a cualquier ataque.
 */
import { forma, MIN_MUESTRAS } from '../src/encounter.js';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { aggregate } from '../src/aggregate.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/** Un contador de habilidad con las muestras que se le den. */
const conta = (valores, criticos = []) => {
  const b = { n: 0, sum: 0, max: 0, min: Infinity, crits: 0, dist: new Map() };
  valores.forEach((v, i) => {
    const crit = criticos.includes(i);
    b.n++; b.sum += v;
    if (v > b.max) b.max = v;
    if (v < b.min) b.min = v;
    if (crit) b.crits++;
    const par = b.dist.get(v);
    if (par) { par[0]++; if (crit) par[1]++; } else b.dist.set(v, [1, crit ? 1 : 0]);
  });
  return b;
};

const repite = (valor, veces) => new Array(veces).fill(valor);

// ── 1. Los percentiles salen donde tienen que salir ────────────────────────
console.log('\nlos tres números');
{
  // 1..100, uno de cada: la mediana es 50, el p10 es 10 y el p90 es 90.
  const b = conta(Array.from({ length: 100 }, (_, i) => i + 1));
  const f = forma(b);
  ok(f.p50 === 50, 'la mediana parte la muestra por la mitad', f.p50);
  ok(f.p10 === 10, 'el p10 deja por debajo una décima parte', f.p10);
  ok(f.p90 === 90, 'y el p90 nueve décimas', f.p90);
}

// ── 2. El golpe raro no se lleva la cifra por delante ──────────────────────
//
// Ésta es la prueba de por qué existe todo esto: mismo ataque, y un solo golpe
// ridículo y otro enorme. El mínimo y el máximo se van a los extremos; la
// mediana y el p10–p90 no se mueven.
console.log('\nel golpe raro');
{
  const normales = repite(25, 200);
  const b = conta([...normales, 3, 60]);
  const f = forma(b);
  ok(b.min === 3 && b.max === 60, 'el mín–máx sí se va a los extremos', `${b.min}–${b.max}`);
  ok(f.p50 === 25, 'la mediana se queda donde estaba', f.p50);
  ok(f.p10 === 25 && f.p90 === 25, 'y el p10–p90 tampoco se inmuta', `${f.p10}–${f.p90}`);
}

// ── 3. Con poca muestra no se dice nada ────────────────────────────────────
console.log('\ncon poca muestra');
{
  ok(forma(conta(repite(10, MIN_MUESTRAS - 1))) === null,
    `por debajo de ${MIN_MUESTRAS} muestras no hay forma que dar`);
  ok(forma(conta(repite(10, MIN_MUESTRAS))) !== null,
    `y a partir de ${MIN_MUESTRAS} sí`);
  ok(forma({ n: 500, dist: null }) === null, 'sin recuento tampoco se inventa nada');
}

// ── 4. La doble joroba ─────────────────────────────────────────────────────
console.log('\nla doble joroba');
{
  // Dos montones separados con un valle vacío: dos armas bajo un nombre.
  const dos = conta([...repite(20, 60), ...repite(21, 20), ...repite(100, 60), ...repite(99, 20)]);
  ok(forma(dos).bimodal === true, 'dos montones separados se detectan');

  // Un solo montón ancho: NO es bimodal por ser ancho.
  const uno = conta(Array.from({ length: 300 }, (_, i) => 20 + (i % 80)));
  ok(forma(uno).bimodal === false, 'un montón ancho no es dos montones');

  // Con pocas muestras no se afirma, aunque la pinta sea de dos montones.
  const pocas = conta([...repite(20, 10), ...repite(100, 10)]);
  ok(forma(pocas).bimodal === false, 'con 20 muestras no se afirma una forma');

  // DOS VALORES PEGADOS NO SON DOS COSAS, y aquí es donde falló la primera
  // versión: los cubos se reparten sobre el rango observado, así que 20 y 21
  // acababan en los extremos opuestos del dibujo con un valle vacío enorme
  // entre ellos y salían como dos montones. Son el mismo golpe.
  const pegados = conta([...repite(20, 80), ...repite(21, 80)]);
  ok(forma(pegados).bimodal === false, 'veinte y veintiuno son el mismo montón');

  // Y la otra mitad de la misma regla: separados de verdad, sí.
  const lejos = conta([...repite(20, 80), ...repite(100, 80)]);
  ok(forma(lejos).bimodal === true, 'veinte y cien no lo son');
}

// ── 5. Los críticos NO son una doble joroba ────────────────────────────────
//
// La guarda de la condición. Un ataque con críticos tiene dos montones por
// definición —el normal y el multiplicado—, y eso ya está contado en su propia
// columna. Si esto se cayera, la frase saldría en casi todas las filas y
// dejaría de significar nada.
console.log('\nlos críticos no cuentan como joroba');
{
  const valores = [...repite(20, 100), ...repite(100, 40)];
  const criticos = valores.map((v, i) => (v === 100 ? i : -1)).filter((i) => i >= 0);
  const b = conta(valores, criticos);
  const f = forma(b);
  ok(b.crits === 40, 'los críticos están contados', b.crits);
  ok(f.bimodal === false, 'y no se anuncian otra vez como dos cosas distintas');
  ok(f.p90 === 100, 'aunque sí cuentan para los percentiles: el golpe fue ése', f.p90);
}

// ── 6. De punta a punta: del log a la pelea guardada ───────────────────────
console.log('\ndel log a la pelea');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const hora = (s) => {
    const m = 20 + Math.floor(s / 60);
    return `[Fri Aug 07 ${String(m).padStart(2, '0')}:00:${String(s % 60).padStart(2, '0')} 2026] `;
  };
  // Doce golpes iguales y uno ridículo, para que el p10 no sea el mínimo.
  const golpes = [...repite(30, 12), 2];
  golpes.forEach((d, i) => {
    tr.feed(p.parse(`${hora(i)}You slash a ghoul for ${d} points of damage.`));
  });
  const fila = tr.current.totals().rows.find((r) => r.name === 'Campeon');
  const hab = fila.byAbility.find(([k]) => k === 'slash')?.[1]
    ?? fila.byAbility[0][1];
  const f = forma(hab);
  ok(hab.n === 13, 'los trece golpes están', hab.n);
  ok(f && f.p50 === 30, 'la mediana es el golpe de siempre', f?.p50);
  ok(hab.min === 2, 'el mínimo sigue existiendo en el contador…', hab.min);
}

// ── 7. Al fundir peleas, los percentiles se caen ───────────────────────────
//
// No se «pierden»: no se pueden calcular sin las muestras, y arrastrar los de
// una de las peleas sería enseñarlos como si fueran los del conjunto.
console.log('\nal fundir varias peleas');
{
  const pelea = (p50) => ({
    duration: 10, total: 100, at: 1,
    rows: [{
      name: 'Campeon', side: 'ally', damage: 100, taken: 0, healingDone: 0,
      hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
      deaths: 0, max: 60, activeSec: 10,
      abilities: [{ name: 'slash', type: 'melee', sum: 100, n: 10, max: 60, p10: p50 - 5, p50, p90: p50 + 5 }],
      types: [], targets: [], takenBySource: [],
    }],
  });
  const una = aggregate([pelea(30)], 'Campeon');
  const dos = aggregate([pelea(30), pelea(80)], 'Campeon');
  const habUna = una.rows[0].abilities[0];
  const habDos = dos.rows[0].abilities[0];
  ok(habDos.sum === 200 && habDos.n === 20, 'lo que se puede sumar se suma', habDos.sum);
  ok(habDos.max === 60, 'y el máximo se compara', habDos.max);
  ok(habUna.p50 === undefined && habDos.p50 === undefined,
    'los percentiles no viajan al fundido, ni con una sola pelea');
}

/**
 * LA RÁFAGA: tu mejor tramo de diez segundos seguidos.
 *
 * QUÉ CONTESTA, que es lo que decide la forma: si lo tuyo fue un momento o fue
 * un rato. El número grande de la fila reparte tu daño entre la pelea entera y
 * el ritmo entre los segundos en que hiciste algo; con esos dos, quien mete
 * 3.000 en diez segundos y quien mete 3.000 repartidos en un minuto pueden
 * salir casi iguales.
 *
 * Y POR QUÉ NO ES «EL MEJOR SEGUNDO», que era lo apuntado. El registro de EQL
 * sella la hora al segundo y no hay nada por debajo: dos golpes separados 1,9 s
 * pueden caer en la misma marca y un frenesí mete tres en una. Un mejor segundo
 * es una muestra de n=1 y encima medio artefacto de la cuadrícula. El pico de
 * n=1 ya está puesto en la fila y se llama máximo.
 *
 * Diez segundos es la misma ventana que usa el análisis para la ráfaga del
 * grupo, para que las dos cifras se puedan comparar.
 */
console.log('\nla ráfaga');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 60 });
  const H = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `[Fri Aug 07 20:${mm}:${ss} 2026] `;
  };
  const mete = (s, d, quien = 'You') => {
    const l = quien === 'You'
      ? `${H(s)}You slash a ghoul for ${d} points of damage.`
      : `${H(s)}${quien} slashes a ghoul for ${d} points of damage.`;
    const ev = p.parse(l); if (ev) tr.feed(ev);
  };

  // Sesenta segundos de pelea. Tú metes 100/s durante diez segundos y nada más;
  // Notarino reparte lo mismo a 16,7/s durante los sesenta.
  for (let s = 0; s < 10; s++) mete(s, 100);
  for (let s = 0; s < 60; s++) mete(s, 1000 / 60 | 0, 'Notarino');
  mete(59, 1);   // para que la pelea llegue a los 60 s

  const rows = tr.current.totals().rows;
  const yo = rows.find((r) => r.name === 'Campeon');
  const otro = rows.find((r) => r.name === 'Notarino');

  ok(Math.abs(yo.dps - otro.dps) < 3,
    'los dos reparten casi lo mismo en toda la pelea', `${yo.dps.toFixed(1)} vs ${otro.dps.toFixed(1)}`);
  ok(yo.rafaga10 === 100, 'tu mejor tramo de diez segundos es 100/s', yo.rafaga10);
  ok(otro.rafaga10 < 20, 'y el suyo no llega a 20: nunca concentró', otro.rafaga10.toFixed(1));
  ok(yo.rafaga10 / yo.dps > 5, 'el múltiplo es lo que separa un pico de un rato',
    (yo.rafaga10 / yo.dps).toFixed(1));
}

// Una pelea más corta que la ventana no tiene ráfaga que comparar: repartir el
// total entre diez sería otra cifra, más pequeña, con nombre de ésta.
console.log('\nuna pelea de cinco segundos');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 60 });
  for (let s = 0; s < 5; s++) {
    const ev = p.parse(`[Fri Aug 07 20:00:0${s} 2026] You slash a ghoul for 100 points of damage.`);
    if (ev) tr.feed(ev);
  }
  const yo = tr.current.totals().rows.find((r) => r.name === 'Campeon');
  ok(yo.rafaga10 === 0, 'no hay ráfaga: no cabe la ventana', yo.rafaga10);
}

// Al sumar peleas SÍ se puede fundir, y con el máximo: una ventana de diez
// segundos no cruza de una pelea a otra, así que la mejor del conjunto es
// exactamente la mejor de alguna. Es el contraste con los percentiles.
console.log('\nal sumar peleas, la ráfaga sí viaja');
{
  const pelea = (rafaga) => ({
    duration: 60, total: 600, at: 1,
    rows: [{
      name: 'Campeon', side: 'ally', damage: 600, taken: 0, healingDone: 0,
      hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
      deaths: 0, max: 60, activeSec: 60, rafaga10: rafaga,
      abilities: [], types: [], targets: [], takenBySource: [],
    }],
  });
  const dos = aggregate([pelea(40), pelea(90)], 'Campeon');
  ok(dos.rows[0].rafaga10 === 90, 'se queda la mejor de las dos, no la suma',
    dos.rows[0].rafaga10);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
