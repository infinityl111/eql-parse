/**
 * LA PISTA DE ESTADO: los extremos abiertos y el principio que hay que recuperar.
 *
 * Sale de una barra real: «58 s aturdido, ya estaba al empezar la pelea», del
 * Plano del Miedo. El aturdimiento más largo emparejado de TODO el registro dura
 * 20 s, así que 58 no era una duración — era la distancia del principio de la
 * pelea al cierre, calculada desde un borde recortado y enseñada como un hecho.
 *
 * Lo que esta batería guarda:
 *
 *   1. que el principio se recupera de «You can't cast spells while stunned!»
 *      cuando el juego no escribe la apertura;
 *   2. que el ANCLA es el cierre anterior y no la prueba más cercana — con la
 *      ráfaga real del 10 de agosto, que es donde anclar por cercanía daba 67 s;
 *   3. que un extremo abierto de verdad NO imprime duración;
 *   4. y que toda barra dice a quién le pasó.
 */
// `ui/reproduccion.js` arrastra `ui/rotulo.js`, que engancha al `document` al
// cargarse. Aquí no hay navegador y no hace falta: el cálculo de los tramos es
// puro. Se le pone el mínimo para que el módulo cargue — la misma idea que
// tener el cálculo separado del pintado, que es lo que permite probarlo así.
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }), body: { appendChild() {} } };
globalThis.window = globalThis;
const { tramosDePista } = await import('../ui/reproduccion.js');

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const on = (s) => ({ s, clase: 'stun', on: true, quien: 'Campeon' });
const off = (s) => ({ s, clase: 'stun', on: false, quien: 'Campeon' });
const prueba = (s) => ({ s, clase: 'stun', prueba: true, quien: 'Campeon' });

// ── 1. El caso que lo destapó ─────────────────────────────────────────────
console.log('\nel principio que el juego no escribió');
{
  // La pelea del Plano del Miedo, 15 ago: la prueba en el segundo 57 y el
  // cierre en el 58, SIN apertura. Antes salía una barra de 58 s.
  const { tramos } = tramosDePista([prueba(57), off(58)], 352);
  ok(tramos.length === 1, 'una barra', String(tramos.length));
  const b = tramos[0];
  ok(b.desde === 57, 'el principio se recupera de la prueba, no del borde', `desde ${b.desde}`);
  ok(b.hasta - b.desde === 1, 'y dura 1 s, no 58', `${b.hasta - b.desde} s`);
  ok(b.abre === false, 'así que la barra NO está abierta por la izquierda');
  ok(b.reconstruido === true, 'y queda marcada como principio reconstruido');
}

// ── 2. El ancla, con la ráfaga real ───────────────────────────────────────
console.log('\nel ancla es el cierre anterior, no la prueba más cercana');
{
  /**
   * La ráfaga del 10 de agosto, en segundos relativos: cinco cierres entre las
   * 01:21:59 y las 01:23:06, con pruebas repartidas. Anclando por CERCANÍA
   * —hacia atrás mientras no haya un hueco de 20 s— el agrupador encadenaba
   * varios aturdimientos y daba 30, 37, 55 y 67 s. Ninguno existe: el máximo
   * medido del registro entero son 20.
   */
  const sucesos = [
    prueba(0), off(0),          // primer aturdimiento, instantáneo
    prueba(28), off(30),        // segundo: empieza DESPUÉS del cierre anterior
    prueba(35), off(37),        // tercero
    prueba(53), off(55),        // cuarto
    prueba(65), off(67),        // quinto
  ];
  const { tramos } = tramosDePista(sucesos, 200);
  ok(tramos.length === 5, 'cinco barras, una por cierre', String(tramos.length));
  const dur = tramos.map((b) => b.hasta - b.desde);
  ok(dur.every((d) => d <= 20), 'ninguna pasa del máximo medido (20 s)', dur.join(', '));
  ok(dur.join(',') === '0,2,2,2,2', 'y cada una mide lo suyo', dur.join(', '));
  // La guarda explícita: si alguien vuelve a anclar por cercanía, la última
  // barra se comería toda la ráfaga y saldrían los 67 s de nuevo.
  ok(tramos.at(-1).desde === 65, 'la última empieza en su propia prueba, no en la primera de la ráfaga',
    `desde ${tramos.at(-1).desde}`);
}

// ── 3. Un extremo abierto de verdad ───────────────────────────────────────
console.log('\nsin prueba, la barra sigue abierta y no se inventa un principio');
{
  const { tramos } = tramosDePista([off(58)], 352);
  const b = tramos[0];
  ok(b.abre === true, 'queda abierta por la izquierda');
  ok(b.reconstruido !== true, 'y NO marcada como reconstruida');
  // Lo único cierto es hasta cuándo duró. Que el rótulo no imprima duración lo
  // comprueba `pintaBarras`; aquí se comprueba que la bandera llega bien.
}

console.log('\ny por la derecha, lo mismo');
{
  const { tramos } = tramosDePista([on(300)], 352);
  ok(tramos[0].cierra === true, 'queda abierta por la derecha');
  ok(tramos[0].abre === false, 'y no por la izquierda: son dos cosas distintas');
}

// ── 4. El sujeto ──────────────────────────────────────────────────────────
console.log('\ncada barra sabe a quién le pasó');
{
  const { tramos } = tramosDePista([
    { s: 10, clase: 'stun', on: true, quien: 'Campeon' },
    { s: 12, clase: 'stun', on: false, quien: 'Campeon' },
  ], 60);
  ok(tramos[0].quien === 'Campeon', 'el aturdimiento es tuyo y lo dice', tramos[0].quien);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
