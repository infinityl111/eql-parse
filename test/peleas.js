/**
 * QUÉ ES UNA PELEA. La batería de la definición de la 1.14.0.
 *
 * Lo que se comprueba aquí y en ningún otro sitio:
 *
 *   1. El TEOREMA: `APERTURA + PLAZO_ENEMIGO ≤ 20`. Es lo que garantiza que la
 *      partición nueva refina la que el usuario ya tiene, así que rompe la
 *      batería y no se negocia sin leer la nota que tiene al lado.
 *   2. Que el modelo corta donde tiene que cortar —tirones encadenados— y no
 *      corta donde no —el mismo bicho con su cadencia—.
 *   3. Que la muerte cierra en el instante, salvo cuando hay homónimo.
 *   4. Que la pista de estado sostiene la ventana: mez, encanto, sin mando.
 *   5. Que el reloj de pared no parte lo que el registro no parte.
 */
import { Parser } from '../src/parser.js';
import {
  EncounterTracker, APERTURA, PLAZO_ENEMIGO, MARGEN_TICK, MEZ_MAX,
} from '../src/encounter.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const HORA = (s) => `[Tue Aug 11 00:${String(Math.floor(s / 60)).padStart(2, '0')}:${
  String(s % 60).padStart(2, '0')} 2026] `;

/** Devuelve TODAS las peleas del guion, cerradas. */
function peleas(guion, { self = 'Campeon' } = {}) {
  const parser = new Parser({ self });
  const tracker = new EncounterTracker({ self, idleSec: 20 });
  const out = [];
  tracker.on('close', (e) => out.push(e));
  for (const [s, l] of guion) tracker.feed(parser.parse(`${HORA(s)}${l}`));
  tracker.tick(Number.MAX_SAFE_INTEGER);
  return out;
}
const rel = (e, t) => t - e.start;

// ═══ 1. EL TEOREMA ═══════════════════════════════════════════════════════
console.log('\nel tope que hace de esto un refinamiento');
{
  /**
   * NO ES UNA COMPROBACIÓN DE ESTILO. Es la propiedad que separa «esta versión
   * reparte mejor tu histórico» de «esta versión te lo revuelve».
   *
   * La frontera vieja se traza cuando `ev.t - end > 20`. Una ventana nueva se
   * estira `APERTURA` hacia atrás y `PLAZO_ENEMIGO` hacia delante, así que dos
   * ventanas separadas por una frontera vieja sólo pueden tocarse si la suma
   * pasa de 20.
   *
   * ── Y AQUÍ VA EL ALCANCE, QUE NO ES EL QUE PONÍA ──────────────────────────
   *
   * Esto ponía «la partición nueva refina la vieja», a secas, y ESO ES FALSO.
   * Lo garantiza POR EL CAMINO DEL PLAZO, y hay un segundo camino: la pista de
   * estado (`#tapado`), acotada por `MEZ_MAX` y `CHARM_MAX_SEC` y no por 20. Un
   * mez o un encanto SÍ puede unir dos peleas de las de antes. Medido sobre el
   * histórico de referencia: pasa 10 veces en 845 peleas, ninguna por el plazo.
   *
   * Quien se apoye en la frase corta se estará apoyando en una garantía que no
   * existe. Lo que esta línea garantiza, con estas palabras: POR EL CAMINO DEL
   * PLAZO el modelo sólo corta. El otro camino lo guarda la comprobación
   * siguiente, que exige que cada unión pueda señalar su línea.
   *
   * SI ESTA LÍNEA SE PONE ROJA, no se sube el número de aquí. Se lee la nota de
   * `PLAZO_ENEMIGO` en `src/encounter.js`, que dice por qué el tope existe y en
   * qué condiciones se puede levantar a propósito — porque tiene fecha de
   * caducidad: en cuanto el usuario reconstruye, la partición vieja deja de
   * existir y esto deja de proteger nada.
   */
  ok(APERTURA + PLAZO_ENEMIGO <= 20,
    'APERTURA + PLAZO_ENEMIGO ≤ 20: por el camino del plazo, el modelo sólo corta',
    `${APERTURA} + ${PLAZO_ENEMIGO} = ${APERTURA + PLAZO_ENEMIGO}`);
  // Y las dos mitades por separado, que es lo que dice CÓMO se rompería.
  ok(PLAZO_ENEMIGO >= 10 && PLAZO_ENEMIGO <= 15,
    'y el plazo se queda en la banda medida (10–15)', String(PLAZO_ENEMIGO));
  ok(MEZ_MAX > PLAZO_ENEMIGO,
    'un mez puede tapar más silencio que el plazo, o no serviría de nada',
    `${MEZ_MAX} > ${PLAZO_ENEMIGO}`);
}

console.log('\nninguna unión sin una línea que la explique');
{
  /**
   * LA GUARDA DEL SEGUNDO CAMINO, y es la que convierte una excepción en una
   * propiedad.
   *
   * Diez casos justificados son comprobables; diez casos tolerados son una
   * grieta que se ensancha sola. Así que la regla no es «se permiten uniones»,
   * es: TODA unión por encima de lo que el plazo aguanta tiene que poder señalar
   * la línea del registro que la sostiene — `Encounter.sostenes`.
   *
   * El silencio de aquí, 40 s, pasa de largo la frontera vieja de 20, así que
   * esta pelea es de las que UNEN. Tiene que traer su recibo.
   */
  const conMez = [
    [0, 'You slash a greater skeleton for 300 points of damage.'],
    [1, 'a greater skeleton has been mesmerized.'],
    [40, 'Your Mesmerization spell has worn off of a greater skeleton.'],
    [41, 'You slash a greater skeleton for 300 points of damage.'],
  ];
  const f = peleas(conMez);
  ok(f.length === 1, 'el silencio de cuarenta segundos no parte la pelea', String(f.length));
  const s = f[0].sostenes;
  ok(s.length >= 1, 'y la pelea trae anotado qué la sostiene', String(s.length));
  ok(s[0]?.tipo === 'mez' && s[0]?.nombre === 'a greater skeleton',
    'con el tipo de estado y sobre quién', `${s[0]?.tipo} · ${s[0]?.nombre}`);
  ok(s[0]?.silencio >= 40 && s[0]?.cubre >= 20,
    'y cuánto silencio tapó, para poder discutirlo en vez de creérselo',
    `${s[0]?.silencio}s de silencio, ${s[0]?.cubre}s tapados`);

  /**
   * Y EL ESTRENO EN ROJO: a la misma pelea se le quita la cobertura. Sin las dos
   * líneas del mez, el silencio no lo explica nada y el modelo tiene que cortar.
   * Si esto diera 1, habría una unión sin recibo — que es exactamente lo que
   * esta prueba existe para impedir.
   */
  const sinMez = conMez.filter(([, l]) => !/mesmeriz|Mesmerization/.test(l));
  const g = peleas(sinMez);
  ok(g.length === 2, 'quitándole la cobertura, la unión desaparece', String(g.length));
  ok(g.every((e) => e.sostenes.length === 0),
    'y no queda ningún sostén anotado que no sostenga nada');
}

// ═══ LA ESPECIFICACIÓN, EN PALABRAS DEL USUARIO ══════════════════════════
//
// Esto no es un caso más: es la frase con la que Miguel describió lo que espera
// del modelo, y por eso está en la batería y no en un chat. Si estas dos dejan
// de pasar, el modelo ha dejado de hacer lo que se pidió, diga lo que diga el
// resto del fichero.
console.log('\ncinco muertos en dos minutos, todos pegando a la vez → UNA pelea');
{
  // «con sus nombres apareciendo a la vez en la lista de acciones». Cinco
  // bichos solapados: mientras pegas a uno, los otros cuatro siguen dando
  // señales. Sus ventanas se solapan, así que es un grupo, no cinco tirones.
  const g = [];
  const bichos = ['a shin ghoul knight', 'a vis ghoul knight', 'a zol ghoul knight',
    'a dar ghoul knight', 'a wan ghoul knight'];
  for (let s = 0; s < 120; s += 4) {
    // Todos pegando o casteando durante toda la pelea.
    for (const b of bichos) g.push([s, `${b} hits YOU for 20 points of damage.`]);
    g.push([s + 1, `You slash ${bichos[Math.floor(s / 24) % 5]} for 400 points of damage.`]);
  }
  // Y van cayendo de uno en uno, pero los demás siguen ahí.
  bichos.forEach((b, i) => g.push([25 + i * 20, `You have slain ${b}!`]));
  const f = peleas(g);
  ok(f.length === 1, 'una pelea', String(f.length));
  ok(f[0].kills.length === 5, 'con los cinco abatidos dentro', String(f[0].kills.length));
}

console.log('cinco muertos en dos minutos, de uno en uno → CINCO peleas');
{
  // «sin que se vea que otros hacen algo mientras atacas al anterior». Cada
  // bicho da señales sólo mientras es tu objetivo. Ninguna ventana se solapa
  // con otra, así que no hay grupo: hay cinco tirones seguidos.
  const g = [];
  const bichos = ['a shin ghoul knight', 'a vis ghoul knight', 'a zol ghoul knight',
    'a dar ghoul knight', 'a wan ghoul knight'];
  bichos.forEach((b, i) => {
    const t0 = i * 24;
    for (let s = 0; s < 14; s += 2) {
      g.push([t0 + s, `You slash ${b} for 400 points of damage.`]);
      g.push([t0 + s + 1, `${b} hits YOU for 20 points of damage.`]);
    }
    g.push([t0 + 14, `You have slain ${b}!`]);
  });
  const f = peleas(g);
  ok(f.length === 5, 'cinco peleas', String(f.length));
  ok(f.every((e) => e.kills.length === 1), 'una muerte en cada una',
    f.map((e) => e.kills.length).join('+'));
}

console.log('…y el dormido no rompe la primera, porque el registro lo sostiene');
{
  // El mismo grupo de cinco, pero a uno lo duermes y deja de dar señales
  // cuarenta segundos. El registro dice que sigue ahí, así que sigue siendo una.
  const g = [];
  const bichos = ['a shin ghoul knight', 'a vis ghoul knight'];
  for (let s = 0; s < 12; s += 2) for (const b of bichos) g.push([s, `${b} hits YOU for 20 points of damage.`]);
  g.push([12, 'a vis ghoul knight has been mesmerized.']);
  for (let s = 14; s < 54; s += 2) g.push([s, 'You slash a shin ghoul knight for 400 points of damage.']);
  g.push([54, 'You have slain a shin ghoul knight!']);
  g.push([55, 'Your Mesmerization spell has worn off of a vis ghoul knight.']);
  g.push([56, 'You slash a vis ghoul knight for 400 points of damage.']);
  g.push([58, 'You have slain a vis ghoul knight!']);
  const f = peleas(g);
  ok(f.length === 1, 'el dormido no rompe el grupo', String(f.length));
  ok(f[0].kills.length === 2, 'y los dos caen dentro de la misma', String(f[0].kills.length));
}

// ═══ LA MUERTE NO FUNDA NADA ═════════════════════════════════════════════
console.log('\nuna muerte no abre ventana: la cierra');
{
  // Un bicho al que dejaste atrás y que se muere solo —un veneno, o lo remató
  // otro— mientras peleas con OTRO. Su muerte no es de esta pelea.
  const g = [
    [0, 'You slash a gorgon for 300 points of damage.'],
    [3, 'You have slain a spectre!'],
    [5, 'You slash a gorgon for 300 points of damage.'],
    [6, 'You have slain a gorgon!'],
  ];
  const f = peleas(g);
  ok(f.length === 1, 'no funda una pelea nueva', String(f.length));
  ok(f[0].kills.length === 1 && f[0].kills[0].victim === 'a gorgon',
    'y no se cuenta como presa tuya', f[0].kills.map((k) => k.victim).join(','));
  ok(f[0].muertesHuerfanas.length === 1 && f[0].muertesHuerfanas[0].name === 'a spectre',
    'pero se anota, que es un hecho del registro',
    JSON.stringify(f[0].muertesHuerfanas[0]));
}

// ═══ 2. CORTA DONDE HAY QUE CORTAR, Y NO DONDE NO ════════════════════════
console.log('\ntres tirones encadenados son tres peleas');
{
  // El caso del 4 de agosto a las 11:17, recortado: tres bichos distintos,
  // seguidos, sin que las ventanas de dos de ellos se toquen nunca. Con
  // `idleSec` = 20 esto era UNA pelea de 154 s con tres nombres dentro.
  const g = [];
  for (const [t0, quien] of [[0, 'a boogeyman'], [22, 'a turmoil toad'], [45, 'Amygdalan warrior']]) {
    g.push([t0, `You slash ${quien} for 300 points of damage.`]);
    g.push([t0 + 2, `${quien} hits YOU for 40 points of damage.`]);
    g.push([t0 + 4, `You slash ${quien} for 300 points of damage.`]);
    g.push([t0 + 5, `You have slain ${quien}!`]);
  }
  const f = peleas(g);
  ok(f.length === 3, 'tres peleas y no una', String(f.length));
  ok(f.every((e) => e.kills.length === 1), 'una muerte en cada una',
    f.map((e) => e.kills.length).join('+'));
  ok(f[0].combatants.has('a boogeyman') && !f[0].combatants.has('a turmoil toad'),
    'y cada bicho en la suya');
}

console.log('\nun bicho con su cadencia es UNA pelea');
{
  // Doce segundos entre golpe y golpe es el p99 de la cadencia medida. Cabe.
  const g = [];
  for (let s = 0; s <= 60; s += 12) g.push([s, 'You slash a gorgon for 100 points of damage.']);
  const f = peleas(g);
  ok(f.length === 1, 'la cadencia no parte la pelea', String(f.length));
  ok(f[0].end - f[0].start === 60, 'y dura lo que dura', `${f[0].end - f[0].start}s`);
}

console.log('\ny el corte real está en el plazo MÁS la apertura');
{
  // Catorce entran y quince no, porque la ventana que viene empieza dos
  // segundos antes de su primera línea: lo que tiene que tocar la anterior es
  // `t - APERTURA`, no `t`. Ver `#sigueAbierta`.
  const conHueco = (h) => peleas([
    [0, 'You slash a gorgon for 100 points of damage.'],
    [h, 'You slash a gorgon for 100 points of damage.'],
  ]).length;
  ok(conHueco(PLAZO_ENEMIGO + APERTURA) === 1,
    'catorce segundos de silencio todavía son una pelea');
  ok(conHueco(PLAZO_ENEMIGO + APERTURA + 1) === 2,
    'quince ya son dos');
}

// ═══ 3. LA MUERTE, Y EL HOMÓNIMO ═════════════════════════════════════════
console.log('\nla muerte cierra en el instante');
{
  // Muere el único enemigo y ocho segundos después aparece otro bicho DISTINTO.
  // Ocho segundos caben en el plazo, así que si la muerte no cerrase, esto
  // sería una pelea sola. La muerte es una medición: cierra.
  const g = [
    [0, 'You slash a gorgon for 500 points of damage.'],
    [1, 'You have slain a gorgon!'],
    [9, 'You slash a spectre for 500 points of damage.'],
    [10, 'You have slain a spectre!'],
  ];
  const f = peleas(g);
  ok(f.length === 2, 'la gorgona muerta no sostiene la pelea del espectro', String(f.length));
}

console.log('\n…salvo cuando el nombre sigue dando señales: el homónimo');
{
  /**
   * Un muerto no pega. Si el nombre muere y siguen llegando líneas suyas, había
   * al menos dos — y la ventana del NOMBRE no se ha cerrado, porque uno de los
   * dos sigue de pie. Es el 32,3 % de las peleas del registro de referencia.
   */
  const g = [
    [0, 'You slash a shin ghoul knight for 500 points of damage.'],
    [1, 'You have slain a shin ghoul knight!'],
    [3, 'a shin ghoul knight hits YOU for 40 points of damage.'],
    [5, 'You slash a shin ghoul knight for 500 points of damage.'],
    [6, 'You have slain a shin ghoul knight!'],
  ];
  const f = peleas(g);
  ok(f.length === 1, 'sigue siendo UNA pelea', String(f.length));
  ok(f[0].kills.length === 2, 'con las dos muertes dentro', String(f[0].kills.length));
  // Y el suelo que eso demuestra: dos muertes del mismo nombre = al menos dos.
  ok(f[0].hpSamples.get('a shin ghoul knight')?.length === 2,
    'y dos muestras de vida, una por cadáver');
}

console.log('\npero el relevo tardío sí corta');
{
  const g = [
    [0, 'You slash a shin ghoul knight for 500 points of damage.'],
    [1, 'You have slain a shin ghoul knight!'],
    [20, 'a shin ghoul knight hits YOU for 40 points of damage.'],
    [21, 'You slash a shin ghoul knight for 500 points of damage.'],
  ];
  ok(peleas(g).length === 2,
    'otro igual diecinueve segundos después es otra pelea, no la misma');
}

// ═══ 4. LA PISTA DE ESTADO ═══════════════════════════════════════════════
console.log('\nun bicho dormido no cierra su ventana');
{
  // Treinta segundos sin una línea suya, con el mez escrito por el registro en
  // los dos extremos. Sin la pista serían dos peleas.
  const g = [
    [0, 'You slash a greater skeleton for 300 points of damage.'],
    [1, 'a greater skeleton has been mesmerized.'],
    [29, 'Your Mesmerization spell has worn off of a greater skeleton.'],
    [30, 'You slash a greater skeleton for 300 points of damage.'],
    [31, 'You have slain a greater skeleton!'],
  ];
  const f = peleas(g);
  ok(f.length === 1, 'el mez sostiene la ventana', String(f.length));
  ok(rel(f[0], f[0].end) === 31, 'y la pelea dura los treinta y un segundos',
    `${rel(f[0], f[0].end)}s`);
}

console.log('\ny el otro cierre del mez cuenta igual');
{
  const g = [
    [0, 'You slash a greater skeleton for 300 points of damage.'],
    [1, 'a greater skeleton has been mesmerized.'],
    [29, 'A greater skeleton has been awakened by Campeon.'],
    [30, 'You slash a greater skeleton for 300 points of damage.'],
  ];
  ok(peleas(g).length === 1, '«has been awakened by» también es un cierre medido');
}

console.log('\nun mez que ni siquiera se cierra: vale, pero con tope');
{
  const conMez = (hueco) => peleas([
    [0, 'You slash a greater skeleton for 300 points of damage.'],
    [1, 'a greater skeleton has been mesmerized.'],
    [hueco, 'You slash a greater skeleton for 300 points of damage.'],
  ]).length;
  ok(conMez(60) === 1, 'sin línea de cierre, el mez sigue tapando dentro del tope');
  ok(conMez(MEZ_MAX * 2 + 30) === 2,
    'pero no para siempre: pasado el tope, corta', `tope ${MEZ_MAX}s`);
}

console.log('\ny el encanto, que es la otra entrada con nombre');
{
  const g = [
    [0, 'You slash a large skeleton for 300 points of damage.'],
    [1, 'a large skeleton has been charmed.'],
    [30, 'Your Charm spell has worn off of a large skeleton.'],
    [31, 'You slash a large skeleton for 300 points of damage.'],
  ];
  ok(peleas(g).length === 1, 'un encantado no está callado: está de tu lado');
}

console.log('\nla raíz NO está, y es a propósito');
{
  /**
   * En 850.171 líneas del registro de referencia no hay ni una de aterrizaje de
   * root. Lo único con nombre es «X has been ensnared» —120 líneas—, que es un
   * ralentizador y no calla a nadie en cuerpo a cuerpo. Añadir la raíz «por
   * simetría» sería inventarse un estado que el registro no escribe.
   *
   * Esta prueba fija ESE techo: si algún día alguien mete `ensnared` en la
   * pista, esto se pone rojo y le obliga a traer la medida.
   */
  const g = [
    [0, 'You slash a fire giant warrior for 300 points of damage.'],
    [1, 'a fire giant warrior has been ensnared.'],
    [30, 'You slash a fire giant warrior for 300 points of damage.'],
  ];
  ok(peleas(g).length === 2, 'un ralentizador no tapa un silencio de treinta segundos');
}

// ═══ 5. EL RELOJ DE PARED ════════════════════════════════════════════════
console.log('\nel reloj de pared no parte lo que el registro no parte');
{
  const parser = new Parser({ self: 'Campeon' });
  const tracker = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const cerradas = [];
  tracker.on('close', (e) => cerradas.push(e));
  const t0 = new Date(2026, 7, 11, 0, 0, 0).getTime() / 1000;
  tracker.feed(parser.parse(`${HORA(0)}You slash a gorgon for 300 points of damage.`));
  tracker.feed(parser.parse(`${HORA(1)}a gorgon has been mesmerized.`));

  // El bicho lleva 40 s dormido y el reloj de pared va muy por delante. Si
  // `tick` no mirase la pista, cerraría aquí — y al releer en frío la pelea no
  // se parte, que es la divergencia que `MARGEN_TICK` lleva documentando.
  tracker.tick(t0 + 40);
  ok(cerradas.length === 0, 'con un mez puesto, el reloj espera', String(cerradas.length));

  /**
   * Y sin nada que lo sostenga, cierra: la espera no es infinita.
   *
   * OJO AL INSTANTE, que es donde se ve la regla de verdad. El silencio se mide
   * desde la ÚLTIMA LÍNEA SUYA —el segundo 0—, no desde que se le cayó el mez, y
   * la pista lo tapa mientras cubra la MITAD. Con 40 s de mez, el silencio deja
   * de estar tapado al pasar de 80 s; hasta ahí la ventana sigue abierta aunque
   * el mez ya no esté puesto.
   *
   * No es un descuido: es la misma regla con la que se midieron los 77 huecos
   * que la pista explica. Un mez de 40 s no deja de explicar nada por haberse
   * caído hace un segundo — lo que explica es el rato en el que el bicho no
   * podía hacer nada, y ese rato ya pasó.
   */
  tracker.feed(parser.parse(`${HORA(41)}Your Mesmerization spell has worn off of a gorgon.`));
  tracker.tick(t0 + 60 + MARGEN_TICK);
  ok(cerradas.length === 0, 'mientras el mez tape la mitad del silencio, sigue abierta');
  tracker.tick(t0 + 90 + MARGEN_TICK);
  ok(cerradas.length === 1, 'y cuando ya no queda nada abierto, cierra', String(cerradas.length));
}

console.log('\nla apertura recoge, pero no mide');
{
  const f = peleas([
    [10, 'You slash a gorgon for 300 points of damage.'],
    [12, 'You have slain a gorgon!'],
  ]);
  const e = f[0];
  const t10 = e.start;
  ok(e.desde === t10 - APERTURA, 'la ventana empieza dos segundos antes',
    `${t10 - e.desde}s`);
  ok(e.durations().inclusive === 3,
    'pero la duración se cuenta desde la primera línea real, no desde ahí',
    `${e.durations().inclusive}s`);
}

// ═══ El cambio de zona ═══════════════════════════════════════════════════
console.log('\nel cambio de zona cierra todo');
{
  const f = peleas([
    [0, 'You slash a gorgon for 300 points of damage.'],
    [2, 'You have entered Lower Guk.'],
    [3, 'You slash a spectre for 300 points of damage.'],
  ]);
  ok(f.length === 2, 'no se puede pelear con algo que está en otra zona', String(f.length));
}

console.log(failed ? `\n${failed} comprobaciones MAL` : '\ntodo bien');
process.exit(failed ? 1 : 0);
