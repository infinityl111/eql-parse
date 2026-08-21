/**
 * CUANDO UNO DE LOS TUYOS TE PEGA. La identidad declarada gana.
 *
 * LO QUE PASÓ, medido en el Plano del Miedo. `Kalforgelp` es un compañero
 * declarado, y durante veintitantos segundos estuvo pegándole al grupo. El
 * registro lo escribe golpe a golpe:
 *
 *   [00:33:25] Fright begins singing Solon's Bewitching Bravura.
 *   [00:33:30] Kalforgelp smites Fright for 8 points of damage.
 *   [00:33:33] Kalforgelp slashes YOU for 27 points of damage.
 *   [01:05:14] You slash Kalforgelp for 226 points of damage.
 *
 * LO QUE HACÍA LA APLICACIÓN. La regla de bandos es «enemigo es quien te pega»,
 * y se aplica una vez por pelea sobre el nombre. Así que UN golpe bastaba para
 * mandar a un compañero declarado al bando contrario durante toda la pelea, con
 * todo su daño detrás.
 *
 * MEDIDO sobre el registro entero, 709 peleas reconstruidas con cinco
 * compañeros declarados: 5 peleas con fuego amigo —5.977 de daño, 205 golpes,
 * TODAS en el Plano del Miedo— y 3 de ellas con el compañero en el bando
 * enemigo, donde 11.862 de 24.499 de «daño enemigo» —el 48%, y el 55% en la
 * peor— era del propio grupo. Sobre esa cifra falsa estaba calculado además el
 * veredicto de postura.
 *
 * Y ES EL MISMO FALLO QUE YA HABÍA APARECIDO CUATRO VECES: dejar que un dato
 * inestable mande sobre una identidad declarada: el nombre, la posición en una
 * lista, la ventana abierta, un golpe suelto. Cinco funciones distintas, cinco
 * fallos distintos, y la misma raíz.
 *
 * LO QUE ESTA PRUEBA FIJA:
 *
 *   1. un compañero declarado NUNCA acaba en el bando enemigo
 *   2. lo que os pegáis entre vosotros se aparta con su nombre, y no entra ni en
 *      la producción de tu bando ni en el daño enemigo
 *   3. lo RECIBIDO sigue contando, porque es vida que se perdió
 *   4. y sin declararlo, la regla vieja sigue en pie — que es lo que impide que
 *      esta prueba pase por no probar nada
 *
 * ESE CUARTO PUNTO NO ES ADORNO. Una prueba de «X ya no pasa» que no comprueba
 * también el caso en que X SÍ debe pasar se queda verde el día que la función se
 * borre entera.
 *
 * Y LA SEGUNDA MITAD: los tramos en que tu personaje deja de ser tuyo. El
 * registro los escribe por los dos extremos —«You lose control of yourself!» y
 * «You have control of yourself again.», 31 pares en el registro de referencia,
 * de 2 a 37 segundos— y no se leían. Lo que NO dice esa línea es la causa: el
 * miedo y el encanto dan la misma. Sólo se rotula «encantado» cuando dentro del
 * tramo le pegaste a los tuyos, que es conducta observada; en los 31 episodios
 * del registro eso no pasa ni una vez, así que los 31 fueron miedo.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { FightStore } from '../src/store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const HORA = (s) => `[Tue Aug 11 00:${String(Math.floor(s / 60)).padStart(2, '0')}:${
  String(s % 60).padStart(2, '0')} 2026] `;

/** Una pelea completa pasada por el motor, con o sin compañeros declarados. */
function pelea(guion, companeros = []) {
  const parser = new Parser({ self: 'Campeon' });
  const tracker = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const engine = new Engine();
  engine.self = 'Campeon';
  engine.parser = parser;
  engine.tracker = tracker;
  engine.setCompanions(companeros);
  for (const [s, l] of guion) tracker.feed(parser.parse(`${HORA(s)}${l}`));
  return engine.snapshot().current;
}

/**
 * El guion, recortado del episodio real. Kalforgelp le pega al jefe, luego al
 * grupo, y tú le devuelves un golpe.
 */
const GUION = [
  [30, 'You slash Fright for 100 points of damage.'],
  [31, 'Fright hits YOU for 124 points of damage.'],
  [32, "Fright begins singing Solon's Bewitching Bravura."],
  [33, 'Kalforgelp slashes Fright for 99 points of damage.'],
  [35, 'Kalforgelp slashes YOU for 27 points of damage.'],
  [38, 'Kalforgelp slashes YOU for 45 points of damage.'],
  [42, 'Kalforgelp bashes YOU for 10 points of damage.'],
  [44, 'You slash Kalforgelp for 226 points of damage.'],
  // A los 45 y no a los 50. El guion está recortado del episodio real, y el
  // recorte dejaba a `Fright` sin una sola línea entre el segundo 33 y el 50:
  // diecisiete de silencio, que con `PLAZO_ENEMIGO` = 12 cierran su ventana y
  // parten esto en dos peleas. En el episodio de verdad `Fright` no se calló —
  // el recorte se llevó sus líneas, no el bicho—, así que lo que se corrige es
  // el guion. Lo que la prueba mira, el fuego amigo, no se toca.
  [45, 'You slash Fright for 90 points of damage.'],
  [46, 'You have slain Fright!'],
];

// ── 1. La identidad declarada gana ─────────────────────────────────────────
console.log('\nun compañero declarado no cambia de bando por un golpe');
{
  const f = pelea(GUION, ['Kalforgelp']);
  const kal = f.rows.find((r) => r.name === 'Kalforgelp');
  ok(kal?.side === 'ally', 'Kalforgelp sigue en tu bando después de pegarte', kal?.side);
  ok(f.rows.find((r) => r.name === 'Fright')?.side === 'enemy',
    'y el enemigo de verdad sigue siendo enemigo');

  // El contraste, que es lo que impide que esto pase por no probar nada: sin
  // declararlo, la regla de siempre se aplica y acaba en el otro bando.
  const sin = pelea(GUION, []);
  ok(sin.rows.find((r) => r.name === 'Kalforgelp')?.side === 'enemy',
    'y SIN declararlo, la regla vieja sigue viva y lo manda al bando enemigo',
    sin.rows.find((r) => r.name === 'Kalforgelp')?.side);
}

// ── 2. El daño entre los tuyos, apartado y con su nombre ───────────────────
console.log('\nel daño que os hacéis entre vosotros');
{
  const f = pelea(GUION, ['Kalforgelp']);
  const e = f.entreTuyos;
  ok(!!e, 'la pelea trae el reparto del fuego amigo');
  ok(e?.daño === 82 + 226, 'con todo lo que os pegasteis', e?.daño);
  ok(e?.golpes === 4, 'y cuántos golpes fueron', e?.golpes);

  const kal = e?.quien.find((q) => q.name === 'Kalforgelp');
  ok(kal?.daño === 82, 'lo suyo va con su nombre', kal?.daño);
  ok(kal?.segundos === 8, 'y con los segundos que duró, del primer golpe al último',
    kal?.segundos);
  ok(kal?.contra.join() === 'Campeon', 'y contra quién', kal?.contra.join());

  // Tú también sales. Le pegaste a un compañero declarado y eso pasó: esconder
  // tu mitad haría el corchete más cómodo y menos cierto.
  const mio = e?.quien.find((q) => q.name === 'Campeon');
  ok(mio?.daño === 226, 'y tu golpe de vuelta también sale, con tu nombre', mio?.daño);

  // Y no está sumado en ningún total.
  ok(f.total === 100 + 90 + 99, 'no entra en la producción de tu bando', f.total);
  ok(f.enemyTotal === 124, 'ni en el daño enemigo', f.enemyTotal);
  const yo = f.rows.find((r) => r.name === 'Campeon');
  ok(yo?.damage === 190, 'ni en tu propio daño: pegar a uno de los tuyos no es pegar',
    yo?.damage);

  // Recibido sí: es vida que perdiste. La misma regla que la autolesión.
  ok(yo?.taken === 124 + 82, 'pero lo recibido cuenta entero, venga de quien venga',
    yo?.taken);
  ok(f.rows.find((r) => r.name === 'Kalforgelp')?.taken === 226,
    'y lo que él recibió de ti, también');
}

// ── 3. La pelea no se llama como tu compañero ──────────────────────────────
//
// `label` sale del que más daño recibió cuando no hay abatidos. Con el fuego
// amigo dentro de `targetTotals`, una pelea contra un golem se titulaba con el
// nombre del compañero al que le devolviste el golpe.
console.log('\nel nombre de la pelea');
{
  const sinMuerte = GUION.filter(([, l]) => !l.includes('slain'));
  const f = pelea(sinMuerte, ['Kalforgelp']);
  ok(f.label === 'Fright', 'la pelea se llama como el enemigo, no como tu compañero',
    f.label);
}

// ── 4. Un compañero pegando a otro no abre una pelea ───────────────────────
//
// La invariante es anterior a todo esto y sigue en pie: «lo que no puede pasar
// bajo ningún concepto es que su pelea sea la tuya». Con dos compañeros
// encantados pegándose en la otra punta de la sala, la puerta tiene que seguir
// cerrada.
console.log('\nla apertura de peleas');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  tr.setCompanions(['Kalforgelp', 'Notarino']);
  const mete = (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); };

  mete(`${HORA(10)}Kalforgelp slashes Notarino for 27 points of damage.`);
  mete(`${HORA(12)}Notarino pierces Kalforgelp for 24 points of damage.`);
  ok(!tr.current, 'dos compañeros pegándose entre ellos NO abren una pelea tuya');

  // Y con la pelea ya abierta, sus golpes tampoco la alargan por su cuenta.
  mete(`${HORA(20)}You slash Fright for 100 points of damage.`);
  const finAntes = tr.current.end;
  mete(`${HORA(60)}Kalforgelp slashes Notarino for 27 points of damage.`);
  ok(tr.current === null || tr.current.end === finAntes || tr.current.start > finAntes,
    'y con 40 s de por medio, el golpe entre ellos no revive la pelea de antes');
}

// ── 5. Los tramos sin mando, con sus dos extremos ──────────────────────────
console.log('\nlos segundos en que tu personaje no era tuyo');
{
  const f = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [40, 'You have control of yourself again.'],
    [45, 'You slash Fright for 90 points of damage.'],
  ], []);
  const sc = f.sinControl;
  ok(sc?.length === 1, 'se guarda el tramo', sc?.length);
  ok(sc?.[0].segundos === 10, 'con su duración, de un extremo al otro', sc?.[0].segundos);
  ok(sc?.[0].cierre === 'medido', 'y con el final marcado como escrito en el registro',
    sc?.[0].cierre);
  ok(sc?.[0].causa === 'miedo',
    'y se llama miedo, no encanto: no hiciste nada, que es lo que el miedo impide',
    sc?.[0].causa);
}

// ── 5a bis. «POR CONSTRUCCIÓN» TAMBIÉN SE COMPRUEBA ───────────────────────
//
// `#activosSinMando` suma tramos sin mirar si se solapan, y lo justifica así:
// «los tramos no se solapan por construcción —`abrirSinControl` no abre uno
// nuevo si hay otro abierto—». Es cierto hoy, y descansa en UNA línea de una
// función que nadie vigila. Una afirmación por construcción es una afirmación:
// si la construcción cambia, caduca en silencio y lo que se rompe es una suma.
{
  const f = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [35, 'You lose control of yourself!'],
    [40, 'You have control of yourself again.'],
    [45, 'You slash Fright for 90 points of damage.'],
  ], []);
  const sc = f.sinControl ?? [];
  ok(sc.length === 1, 'dos «pierdes el control» seguidos NO abren dos tramos', sc.length);
  ok(sc[0]?.segundos === 10, 'y el que hay va de la PRIMERA al cierre', sc[0]?.segundos);

  // Y el control por el otro lado: cerrado uno, el siguiente SÍ abre otro.
  // Los golpes van seguidos a propósito: con más de `idleSec` entre ellos la
  // pelea se parte en dos y el segundo tramo se queda en la otra mitad — que es
  // lo que le pasó a este control la primera vez que se escribió.
  const dos = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [33, 'You have control of yourself again.'],
    [36, 'You lose control of yourself!'],
    [38, 'You have control of yourself again.'],
    [42, 'You slash Fright for 90 points of damage.'],
  ], []);
  ok((dos.sinControl ?? []).length === 2,
    'CONTROL: cerrado el primero, el segundo sí abre otro tramo',
    'sin esto, el «no se solapan» de arriba lo cumpliría también una función que no abre nunca');
  // Ninguno empieza antes de que acabe el anterior: es lo que la suma da por hecho.
  const orden = [...(dos.sinControl ?? [])].sort((a, b) => a.desde - b.desde);
  ok(orden.every((x, i) => i === 0 || x.desde >= (orden[i - 1].hasta ?? Infinity)),
    'y no se solapan, que es lo que la suma da por hecho');
}

// ── 5b. EL FALSADOR: no es una tendencia, es un «no» ───────────────────────
//
// Con miedo no puedes actuar. No es que normalmente no actúes: no puedes. Así
// que UNA sola acción tuya dentro del tramo descarta el miedo, sin porcentajes,
// y el rótulo se escribe con la misma seguridad que una cifra de daño.
//
// Y con encanto tampoco decides —pegas a los tuyos, pero no lo eliges—, así que
// los dos son igual de involuntarios. Lo que los separa es sólo el rastro.
console.log('\nel falsador');
{
  const encantado = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [34, 'You slash Notarino for 50 points of damage.'],
    [40, 'You have control of yourself again.'],
  ], ['Notarino']);
  ok(encantado.sinControl?.[0].causa === 'encanto',
    'una acción contra los tuyos: encanto', encantado.sinControl?.[0].causa);
  ok(encantado.total === 100, 'y ese golpe sigue sin contar como producción', encantado.total);

  const miedo = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [40, 'You have control of yourself again.'],
  ], []);
  ok(miedo.sinControl?.[0].causa === 'miedo', 'cero acciones: miedo',
    miedo.sinControl?.[0].causa);

  // EMPEZAR A LANZAR NO ES ACTUAR, y sin esto la regla se cae sola: en el
  // registro de referencia hay 24 «You begin casting Ensnare.» dentro de 10 de
  // los 31 tramos, y NINGUNA tiene desenlace —ni impacto, ni resistencia, ni
  // interrupción—. Es la tecla que el juego rechaza. Contándola, 10 de 31
  // habrían dejado de ser miedo por aporrear un hotkey.
  const tecla = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [34, 'You begin casting Ensnare.'],
    [40, 'You have control of yourself again.'],
  ], []);
  ok(tecla.sinControl?.[0].causa === 'miedo',
    'empezar a lanzar sin que pase nada no descarta el miedo: es una tecla, no un acto',
    tecla.sinControl?.[0].causa);

  // Fallar SÍ es actuar: es un ataque que salió y no entró.
  const fallo = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'You lose control of yourself!'],
    [34, 'You try to slash Fright, but miss!'],
    [40, 'You have control of yourself again.'],
  ], []);
  ok(fallo.sinControl?.[0].causa === null,
    'atacaste al enemigo sin mando: ni miedo ni encanto, y no se rotula',
    fallo.sinControl?.[0].causa);
  ok(fallo.sinControl?.[0].aEnemigo === 1, 'pero queda contado, para poder mirarlo',
    fallo.sinControl?.[0].aEnemigo);
}

// ── 5b-bis. Ese tiempo no cuenta en tu contra en ningún sitio ──────────────
//
// Ni el miedo ni el encanto los decides tú, así que no pueden entrar en ninguna
// medida de actividad. Ni el tiempo, ni su duración.
console.log('\nel tiempo sin mando no se te cobra');
{
  const guion = [];
  // Veinte segundos pegando con cadencia de 2 s, para que haya cadencia medible.
  for (let s = 0; s <= 20; s += 2) guion.push([s, 'You slash Fright for 50 points of damage.']);
  // El tramo dura 15 s y no 30 A PROPÓSITO: por encima de `idleSec` la pelea se
  // parte en dos, porque durante el miedo no hay ni una línea de combate tuya.
  // Eso es otro asunto —y está anotado— pero aquí falsearía la prueba: mediría
  // dos peleas cortas en vez del descuento.
  const conMiedo = [...guion,
    [21, 'You lose control of yourself!'],
    [36, 'You have control of yourself again.'],
    [37, 'You slash Fright for 50 points of damage.'],
  ];
  const sin = [...guion, [37, 'You slash Fright for 50 points of damage.']];

  const a = pelea(conMiedo, []);
  const b = pelea(sin, []);
  const yoA = a.rows.find((r) => r.name === 'Campeon');
  const yoB = b.rows.find((r) => r.name === 'Campeon');
  ok(a.sinMandoSec === 16, 'la pelea cuenta los segundos sin mando', a.sinMandoSec);
  ok(a.duracionMando === a.duration - 16, 'y da la duración que sí manejaste',
    `${a.duracionMando} de ${a.duration}`);
  ok(yoA.sinMandoSec === 16, 'y tu fila también', yoA.sinMandoSec);
  ok(yoA.huecoReal <= yoB.huecoReal + 1,
    'el parón que se te cobra NO crece por los 15 s de miedo',
    `${yoA.huecoReal} contra ${yoB.huecoReal} sin miedo`);
  ok(yoA.huecoReal < 10,
    'y en absoluto: quince segundos secuestrado no son quince segundos parado', yoA.huecoReal);

  // Y a un compañero no se le regala nada: los tramos son tuyos.
  ok((a.rows.find((r) => r.name === 'Fright')?.sinMandoSec ?? 0) === 0,
    'el descuento sólo se aplica a tu fila');
}

// ── 5c. El tramo que se queda abierto ──────────────────────────────────────
console.log('\nel tramo que la pelea corta');
{
  const f = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [35, 'You lose control of yourself!'],
    [38, 'Fright hits YOU for 124 points of damage.'],
  ], []);
  ok(f.sinControl?.[0].cierre === 'pelea',
    'si la pelea acaba antes, el cierre dice que el final lo puso ella',
    f.sinControl?.[0].cierre);
}

// ── 5d. El hecho vecino es el DE ESE EPISODIO, y sea el que sea ────────────
//
// La primera versión ponía al lado del tramo un agregado de la pelea entera —«el
// jefe cantó un encanto 8 veces»— y eso es escoger el candidato bonito: la
// vecindad se lee antes que el descargo, así que una canción de encanto pegada a
// un tramo «sin control» se lee como «te encantaron».
//
// Y CONTRADECÍA LA MEDIDA. De los 31 tramos del registro de referencia, el
// lanzamiento inmediatamente anterior fue de miedo en 18 y de encanto en 10.
// Enseñar el encanto era enseñar el segundo candidato porque es el vistoso.
console.log('\nel hecho vecino de cada episodio');
{
  const f = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'Fright begins singing Solon\'s Bewitching Bravura.'],
    [40, 'Fright begins casting Dragon Fear.'],
    [41, 'You lose control of yourself!'],
    [50, 'You have control of yourself again.'],
  ], []);
  const p = f.sinControl?.[0].previo;
  ok(p?.ability === 'Dragon Fear',
    'sale lo último que lanzó el enemigo, aunque lo otro fuera más vistoso', p?.ability);
  ok(p?.dt === 1, 'con su distancia medida, que es lo que evita leer causa', p?.dt);
  ok(p?.source === 'Fright', 'y quién lo lanzó', p?.source);

  // Sin nada del enemigo cerca no se pone nada, que también es información.
  const g = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [31, 'Fright begins casting Dragon Fear.'],
    [90, 'You lose control of yourself!'],
    [95, 'You have control of yourself again.'],
  ], []);
  ok(g.sinControl?.[0].previo === null,
    'con el lanzamiento a un minuto, no se enseña: no era el vecino de nada',
    JSON.stringify(g.sinControl?.[0].previo));

  // Y sólo cuenta lo que lanza el ENEMIGO. Un hechizo tuyo o de un compañero
  // justo antes no explica que perdieras el mando.
  const h = pelea([
    [30, 'You slash Fright for 100 points of damage.'],
    [40, 'You begin casting Drain Spirit X.'],
    [41, 'You lose control of yourself!'],
    [50, 'You have control of yourself again.'],
  ], []);
  ok(h.sinControl?.[0].previo === null, 'un hechizo tuyo no es el vecino que se busca');
}

// ── 5e. UN TRAMO SIN MANDO NO PARTE LA PELEA ───────────────────────────────
//
// El silencio de un miedo no es que dejaras de combatir: es que NO PODÍAS, y
// por eso no hay líneas. Cortar ahí por inactividad es el mismo error que el
// resto de este cambio corrige, cometido con las fronteras en vez de con las
// cifras — y sale más caro, porque parte una pelea en dos trozos con cifras
// propias.
//
// Medido sobre el registro: 8 de los 31 tramos pasan de `idleSec`, y arreglarlo
// funde 5 peleas y mueve la frontera de otra. 714 pasan a 710.
console.log('\nel miedo no parte la pelea');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const mete = (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); };
  mete(`${HORA(10)}You slash Fright for 100 points of damage.`);
  mete(`${HORA(12)}You lose control of yourself!`);
  mete(`${HORA(50)}You have control of yourself again.`);
  mete(`${HORA(52)}You slash Fright for 90 points of damage.`);
  ok(tr.current && tr.current.totals().rows.find((r) => r.name === 'Campeon')?.damage === 190,
    'los 38 s de miedo NO parten la pelea: sigue siendo una',
    tr.current?.totals().rows.find((r) => r.name === 'Campeon')?.damage);
  ok(tr.history.length === 0, 'y no se ha cerrado ninguna por el camino', tr.history.length);

  // Y el reloj de pared tampoco la parte, que es el camino que fallaba en
  // directo: el aviso de vuelta llega al final del tramo y `tick` no espera.
  const q = new Parser({ self: 'Campeon' });
  const tr2 = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const mete2 = (l) => { const ev = q.parse(l); if (ev) tr2.feed(ev); };
  mete2(`${HORA(10)}You slash Fright for 100 points of damage.`);
  mete2(`${HORA(12)}You lose control of yourself!`);
  const t0 = tr2.current.end;
  tr2.tick(t0 + 40);
  ok(tr2.current !== null, 'con el tramo abierto, el reloj de pared no cierra');

  // Pero con un tope: si el registro se acaba a mitad de un miedo, la pelea
  // tiene que cerrarse igual o la última no se guarda nunca.
  tr2.tick(Number.MAX_SAFE_INTEGER);
  ok(tr2.current === null, 'y pasado el tope, sí cierra: la espera no es infinita');
}

// ── 6. Las tres líneas que faltaban ────────────────────────────────────────
console.log('\nlas líneas del registro que no se leían');
{
  const p = new Parser({ self: 'Campeon' });
  const a = p.parse(`${HORA(1)}You lose control of yourself!`);
  ok(a?.kind === 'control' && a.on === true, 'perder el mando se reconoce', a?.kind);
  const b = p.parse(`${HORA(9)}You have control of yourself again.`);
  ok(b?.kind === 'control' && b.on === false, 'y recuperarlo también', b?.kind);
  const c = p.parse(`${HORA(2)}Fright begins singing Solon's Bewitching Bravura.`);
  ok(c?.kind === 'cast' && c.source === 'Fright', 'cantar es lanzar', c?.kind);
  ok(c?.castCat === 'charm',
    'y esa canción es un encanto, que es lo único escrito cerca del fuego amigo',
    c?.castCat);
}

// ── 7. Las peleas viejas: detectadas al leer, sin reconstruir ──────────────
//
// Corregirlas exige releer el registro. Detectarlas es gratis: «hay un
// compañero declarado en el bando enemigo» se comprueba en lo guardado, sin
// tocar el formato. Así nadie reconstruye y ninguna pelea miente en silencio.
console.log('\nlas peleas ya guardadas con un compañero en el bando enemigo');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eqlali-'));
  const st = new FightStore(dir, 'Campeon');
  const vieja = {
    id: 1, label: 'Fright', duration: 60, total: 4000, raidDps: 66,
    enemyTotal: 3000, enemyDps: 50, kills: [], losses: [], loot: [], spellVsFoe: [],
    start: 1000,
    rows: [
      { name: 'Campeon', side: 'ally', damage: 4000, taken: 900 },
      { name: 'Fright', side: 'enemy', damage: 1350, taken: 4000 },
      { name: 'Kalforgelp', side: 'enemy', damage: 1650, taken: 226 },
    ],
  };
  const s = st.append(vieja, 1_700_000_000_000);

  ok(st.get(s.uid).duda === undefined,
    'sin compañeros declarados no se afirma nada: no hay con qué');

  st.setCompanions(['Kalforgelp']);
  const f = st.get(s.uid);
  ok(f.duda?.motivo === 'compa-en-bando-enemigo', 'declarado, la pelea sale marcada',
    f.duda?.motivo);
  ok(f.duda?.filas.join() === 'Kalforgelp', 'con quién es', f.duda?.filas.join());
  ok(f.duda?.daño === 1650 && f.duda?.total === 3000,
    'y con la cifra dentro, para poder decirla en vez de soltar un aviso genérico',
    `${f.duda?.daño} de ${f.duda?.total}`);
  ok(f.duda?.sobre === 'enemyTotal',
    'y sobre qué total se lee esa cifra: aquí lo inflado es el bando enemigo',
    f.duda?.sobre);
  ok(f.duda?.invalida.includes('enemyTotal') && !f.duda?.invalida.includes('mine'),
    'se tacha el total de los bandos y no tu daño personal');

  // Y se calla en cuanto deja de ser verdad, sin que nadie borre nada: es lo
  // que hará una reconstrucción, donde la regla nueva ya no manda a nadie
  // declarado al bando contrario.
  st.setCompanions([]);
  ok(st.get(s.uid).duda === undefined, 'y al dejar de ser compañero, la marca se va sola');

  // Una pelea limpia no se marca aunque haya compañeros declarados.
  const limpia = st.append({
    id: 2, label: 'Fright', duration: 30, total: 1000, enemyTotal: 500,
    kills: [], losses: [], loot: [], spellVsFoe: [], start: 2000,
    rows: [
      { name: 'Campeon', side: 'ally', damage: 1000, taken: 500 },
      { name: 'Kalforgelp', side: 'ally', damage: 400, taken: 0 },
      { name: 'Fright', side: 'enemy', damage: 500, taken: 1400 },
    ],
  }, 1_700_000_001_000);
  st.setCompanions(['Kalforgelp']);
  ok(st.get(limpia.uid).duda === undefined,
    'y una pelea donde está en su bando no se marca: la guarda mira el bando, no el nombre');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
