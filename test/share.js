/**
 * El texto para pegar en el chat del juego.
 *
 * Todo lo que se comprueba aquí sale de medir el chat de un registro real
 * —9.934 mensajes de chat, 8.098 de canal humano, 568 emisores— y no de suponer
 * cómo es EQ:
 *
 *   · El límite NO son 250. El texto más largo escrito por una persona son 423
 *     caracteres, hay UNO solo de esa longitud y la cola es suave; un cliente
 *     que corta se delata con una pila de mensajes clavados en el mismo número,
 *     y el más repetido pasando de 100 son 26 mensajes de 102. La wiki de EQL
 *     lista los canales y describe la ventana de chat sin dar ningún máximo.
 *     240 es un presupuesto cómodo, no el techo. (Antes ponía 491: eso era la
 *     línea entera del registro, con marca de tiempo y cabecera de canal.)
 *
 *   · El chat es ASCII. El único carácter no-ASCII en todo el chat es U+FFFD
 *     once veces —el rombo de «no sé pintar esto»— y en los mensajes propios
 *     en español no hay ni una tilde. Por eso el recorte dice «+3 mas».
 *
 *   · El «|» llega. Siete líneas del registro lo llevan: tres son de otras
 *     personas escribiendo en un canal, una es la ayuda del juego y DOS son
 *     este mismo texto, pegado en el chat de gremio y devuelto por el registro
 *     con las barras intactas. El viaje completo no se come el carácter.
 *
 *   · «%» SÍ llega, y la medida que decía lo contrario era una trampa. Sale
 *     216 veces en el registro y cero en un mensaje de chat, todas escritas por
 *     el juego. De ahí se dedujo que el cuadro de texto se lo comía. Probado
 *     dentro del juego: «prueba 30%» sale tal cual. La ausencia tenía una
 *     explicación aburrida —nadie escribe porcentajes charlando— y 451
 *     jugadores sin usar un carácter no demuestran que no se pueda.
 *
 * Y lo que decide la forma: lo que desborda la línea es la lista de nombres de
 * bichos, no la de los tuyos.
 */
import { fightToChat, esNamed, LIMITE } from '../src/share.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const aliado = (name, damage) => ({ name, side: 'ally', damage, taken: 0, max: 0 });
const enemigo = (name, damage, taken, max = 0) => ({ name, side: 'enemy', damage, taken, max });
const pelea = (rows, duration = 100, label = 'pelea') => ({ rows, duration, label });

// ── 1. Nada de lo que sale puede salirse del ASCII ─────────────────────────
console.log('\nsólo ASCII, porque el chat no pinta otra cosa');
{
  const f = pelea([
    aliado('Muñoz', 1000), aliado('Renée', 500),
    enemigo('a fetid fiend', 200, 1500, 40),
  ]);
  const { texto } = fightToChat(f);
  ok(!/[^\x20-\x7e\n]/.test(texto), 'no queda un solo carácter fuera del ASCII imprimible');
  ok(texto.includes('Munoz'), 'una tilde se degrada a su letra y se sigue leyendo');
  ok(texto.includes('%'), 'el «%» pasa: comprobado dentro del juego, no deducido');
  // El separador no es una suposición: está en el registro de ida y vuelta.
  ok(texto.includes(' | '), 'y el «|» sobrevive al saneador, que es donde moriría');
}

// ── 2. El presupuesto se respeta recortando por el final ───────────────────
console.log('\nel presupuesto por línea');
{
  const muchos = Array.from({ length: 12 }, (_, i) => aliado(`Jugadorconnombrelargo${i}`, 5000 - i * 100));
  const f = pelea([...muchos, enemigo('a fetid fiend', 200, 1500, 40)]);
  const r = fightToChat(f);
  ok(r.lineas[0].length <= LIMITE, 'la línea cabe en el presupuesto', r.lineas[0].length);
  ok(r.fuera > 0 && /\| \+\d+ mas$/.test(r.lineas[0]), 'y se dice cuántos se quedaron fuera',
    r.lineas[0].slice(-12));
  // Cortar en silencio no omite: afirma que el grupo era más pequeño. El número
  // del rótulo tiene que ser el de verdad, no «alguno más».
  ok(Number(/\+(\d+) mas$/.exec(r.lineas[0])[1]) === r.fuera,
    'y el número que dice es el que falta de verdad', `dice +${r.fuera}`);
  // Lo que NUNCA se recorta: la cabecera, el total y el «vs».
  ok(r.lineas[0].includes('TOTAL GRUPO'), 'el total sobrevive al recorte');
  ok(r.lineas[1].startsWith('vs '), 'y la línea de enemigos entera');
  // Caen de menor a mayor daño: el primero de la lista es el que más pegó y no
  // puede faltar; el último de los que quedan tiene que pegar más que el que se
  // fue justo detrás.
  ok(r.lineas[0].includes('Jugadorconnombrelargo0 5000'),
    'el que más pegó nunca es el que cae');
  ok(!r.lineas[0].includes(`Jugadorconnombrelargo${12 - r.fuera}`),
    'y los que caen son los de menos daño, por el final');
  // Un nombre a medias parece un nombre. Nunca se corta por la mitad.
  ok(!/Jugadorconnombrelarg\b/.test(r.lineas[0].replace(/Jugadorconnombrelargo\d+/g, '')),
    'nunca se parte un nombre por la mitad');

  // Con uno solo se deja pasar aunque no quepa: mejor largo que vacío.
  const unico = pelea([aliado('X'.repeat(400), 100)]);
  ok(fightToChat(unico).lineas[0].length > LIMITE,
    'con un solo compañero se deja pasar aunque se salga');
}

// ── 3. Lo que se recorta es la cabecera, no el grupo ───────────────────────
//
// Medido: «a worry wraith, a turmoil toad pet, a turmoil toad, a scareling ×2,
// a shiverback» son 78 caracteres de nombres de bichos antes de contar a nadie.
console.log('\nlos bichos se cuentan, no se listan');
{
  const bichos = Array.from({ length: 6 }, (_, i) => enemigo(`a very long monster name ${i}`, 100, 900, 30));
  const f = pelea([aliado('Campeon', 9000), ...bichos]);
  const r = fightToChat(f);
  ok(r.lineas[0].startsWith('6 enemigos'), 'seis normales son «6 enemigos»', r.lineas[0].slice(0, 20));
  ok(!r.lineas[0].includes('very long monster'), 'y ninguno se nombra en la cabecera');
  ok(r.fuera === 0, 'así que no hace falta recortar a nadie de los tuyos');
}

// ── 4. Un named se nombra; los normales, agregados ─────────────────────────
console.log('\nel named aparte de los normales');
{
  const f = pelea([
    aliado('Campeon', 50000), aliado('Notarino', 30000),
    enemigo('Lord Nagafen', 20000, 140000, 711),
    enemigo('a fire giant warrior', 500, 9000, 120),
    enemigo('a fire giant wizard', 300, 8000, 90),
  ], 400);
  const r = fightToChat(f);
  ok(r.lineas[0].startsWith('Lord Nagafen +2'), 'la cabecera nombra al jefe y cuenta el resto',
    r.lineas[0].slice(0, 18));
  ok(r.lineas[1].includes('Lord Nagafen'), 'la segunda línea le da su propio hueco');
  ok(r.lineas[1].includes('2 normales'), 'y agrega a los normales');
  ok(!r.lineas[1].includes('fire giant'), 'sin nombrarlos uno a uno');
}

// ── 5. Las mascotas enemigas no son enemigos de los que se hable ───────────
console.log('\nlas mascotas enemigas se pliegan');
{
  const f = pelea([
    aliado('Campeon', 5000),
    enemigo('a turmoil toad', 400, 9000, 80),
    enemigo('a turmoil toad pet', 50, 1600, 20),
  ]);
  const r = fightToChat(f);
  ok(r.lineas[0].startsWith('a turmoil toad '), 'con una mascota delante, el enemigo sigue siendo uno',
    r.lineas[0].slice(0, 18));
  ok(!r.lineas[1].includes('pet'), 'y la mascota no sale en la línea de enemigos');
}

// ── 6. Un enemigo solo se llama por su nombre ──────────────────────────────
//
// Agregar tiene sentido con muchos, porque sus nombres en montón no dicen nada.
// Con uno no hay nada que agregar y «1 normal» tapaba justo el dato que se
// busca al preguntar qué te mató.
console.log('\nun enemigo solo tiene nombre');
{
  const uno = fightToChat(pelea([aliado('Campeon', 100), enemigo('a rat', 10, 90, 5)]));
  ok(uno.lineas[1].includes('a rat - 10'), 'con un normal, sale su nombre', uno.lineas[1]);
  ok(!/\d normal/.test(uno.lineas[1]), 'y no «1 normal», que no nombraba a nadie');

  // Con varios sí se agregan, y entonces el recuento va en plural siempre: al
  // rótulo nunca le llega un 1.
  const muchos = fightToChat(pelea([
    aliado('Campeon', 100),
    enemigo('a rat', 10, 90, 5), enemigo('a bat', 8, 80, 4), enemigo('a cat', 6, 70, 3),
  ]));
  ok(muchos.lineas[1].includes('3 normales'), 'con tres, se agregan', muchos.lineas[1]);
}

// ── 6b. En la segunda mención, el nombre va corto ──────────────────────────
console.log('\nel título se dice una vez');
{
  const f = pelea([
    aliado('Campeon', 61585), aliado('Kabaner', 23263),
    enemigo('Innoruuk, the Prince of Hate', 45200, 84848, 820),
  ], 258);
  const r = fightToChat(f);
  ok(r.lineas[0].startsWith('Innoruuk, the Prince of Hate 4m18s'),
    'la cabecera lo nombra entero, una vez', r.lineas[0].slice(0, 40));
  ok(r.lineas[1] === 'vs Innoruuk - 45200 (175dps, max 820)',
    'y la segunda línea lo llama por el nombre corto', r.lineas[1]);
  ok(r.lineas[0] === 'Innoruuk, the Prince of Hate 4m18s | TOTAL GRUPO 84848 (329dps)'
    + ' | Campeon 61585 (239dps 73%) | Kabaner 23263 (90dps 27%)',
    'y la línea entera es la acordada', r.lineas[0]);

  // Sin título no hay nada que cortar: los nombres normales pasan enteros.
  const g = fightToChat(pelea([aliado('Campeon', 50000), enemigo('Lord Nagafen', 20000, 50000, 711)], 100));
  ok(g.lineas[1].includes('vs Lord Nagafen - 20000'), 'un nombre sin coma no se toca', g.lineas[1]);
}

// ── 6c. Los números, todos con la misma forma ──────────────────────────────
//
// Convivían «84.8k» y «61585» en la misma línea por casualidad, no por criterio.
// Abreviar no ahorraba un solo carácter —«.», el decimal y la «k» sustituyen
// exactamente a los tres dígitos que se tiran—, así que costaba precisión y no
// compraba sitio.
console.log('\nlos números');
{
  const f = pelea([
    aliado('Campeon', 61585), aliado('Kabaner', 23263),
    enemigo('a big thing', 45200, 84848, 820),
  ], 258);
  const r = fightToChat(f);
  ok(!/\d\.\dk/.test(r.texto), 'no queda una sola cifra abreviada', r.texto);
  ok(r.lineas[0].includes('TOTAL GRUPO 84848'), 'el total va exacto y se puede sumar');
  ok(r.lineas[1].includes('- 45200 '), 'y el del enemigo también');

  // El umbral de 10.000 era lo peor de las dos formas: dos formatos en la misma
  // columna, según de qué lado del número cayera cada uno.
  const cruce = fightToChat(pelea([aliado('Aa', 10200), aliado('Bb', 9800)], 100));
  ok(/Aa 10200 /.test(cruce.lineas[0]) && /Bb 9800 /.test(cruce.lineas[0]),
    '9800 y 10200 se escriben igual, que antes no', cruce.lineas[0]);
}

// ── 7. El prefijo, configurable y vacío por defecto ────────────────────────
console.log('\nel prefijo');
{
  const f = pelea([aliado('Campeon', 100), enemigo('a rat', 10, 90, 5)]);
  ok(!fightToChat(f).lineas[0].startsWith('['), 'por defecto no lleva nada delante');
  ok(fightToChat(f, { pct: 'pct' }).lineas[0].includes('pct'),
    'y el sufijo del reparto se puede cambiar, por si un cliente se porta distinto');
  const con = fightToChat(f, { prefijo: '[EQL] ' });
  ok(con.lineas.every((l) => l.startsWith('[EQL] ')), 'y si lo pides, va en las DOS líneas');
}

// ── 8. La mascota no puede pasar por un jugador ────────────────────────────
//
// Suelta y ordenada por daño parece uno más del grupo, y sesga el reparto.
// Medido en una pelea real: «Campeon 15363 (40%)» con «Gekab 8025 (21%)» tres
// puestos más abajo describe a dos personas donde hay una. Sumadas son 23388,
// el 61%, y el orden entero cambia.
console.log('\nla mascota no es un jugador más');
{
  const f = pelea([
    aliado('Campeon', 7225), { name: 'Gabobtik', side: 'ally', damage: 11694, pet: true, taken: 0, max: 0 },
    aliado('Notarino', 5000),
    enemigo('an ire ghast', 100, 9000, 40),
  ], 100);

  // Por defecto se suma al dueño, con la marca que avisa de que no es sólo suyo.
  const m = fightToChat(f, { self: 'Campeon' });
  ok(m.lineas[0].includes('Campeon +pet 18919'), 'sumada al dueño, con «+pet»', m.lineas[0]);
  ok(!m.lineas[0].includes('Gabobtik'), 'y la mascota deja de tener fila propia');
  ok(m.lineas[0].indexOf('Campeon') < m.lineas[0].indexOf('Notarino'),
    'y el orden cambia: 18919 pone a Campeon por delante de Notarino');

  // Aparte, va rotulada y pegada a su dueño.
  const g = fightToChat(f, { self: 'Campeon', pets: 'group' });
  ok(g.lineas[0].includes("Gabobtik (Campeon's Pet)"), 'aparte, se dice de quién es', g.lineas[0]);
  const iD = g.lineas[0].indexOf('Campeon 7225');
  const iP = g.lineas[0].indexOf('Gabobtik');
  ok(iD >= 0 && iP > iD, 'y va justo detrás de su dueño, no ordenada por daño');
}

// El orden entre grupos sale del daño CONJUNTO, y hace falta un caso donde las
// dos formas de ordenar den resultados distintos: si el dueño solo pega menos
// que otro jugador pero con su mascota pega más, ordenar por el daño suelto lo
// mandaría al final siendo quien más pone. Con los números de arriba no se
// distingue —Campeon gana de las dos maneras—, así que va aparte.
console.log('\nel orden sale del daño del bloque, no del jugador solo');
{
  const f = pelea([
    aliado('Campeon', 3000), { name: 'Gabobtik', side: 'ally', damage: 11694, pet: true, taken: 0, max: 0 },
    aliado('Notarino', 5000),
    enemigo('an ire ghast', 100, 9000, 40),
  ], 100);
  const g = fightToChat(f, { self: 'Campeon', pets: 'group' });
  ok(g.lineas[0].indexOf('Campeon 3000') < g.lineas[0].indexOf('Notarino'),
    'Campeon pega 3000 y Notarino 5000, pero con la mascota son 14694 y va primero',
    g.lineas[0]);
}

console.log('\nla mascota de OTRO jugador, igual');
{
  const f = pelea([
    aliado('Campeon', 9000),
    { name: 'Jobarn', side: 'ally', damage: 4000, petOf: 'Notarino', taken: 0, max: 0 },
    aliado('Notarino', 3000),
    enemigo('an ire ghast', 100, 9000, 40),
  ], 100);
  const g = fightToChat(f, { self: 'Campeon', pets: 'group' });
  ok(g.lineas[0].includes("Jobarn (Notarino's Pet)"), 'se rotula con SU dueño, no contigo', g.lineas[0]);
  const m = fightToChat(f, { self: 'Campeon' });
  ok(m.lineas[0].includes('Notarino +pet 7000'), 'y se suma a él, no a ti', m.lineas[0]);
}

console.log('\nlo que no consta de quién es, no se toca');
{
  // Sin `self` no se sabe de quién es una mascota tuya: la marca `pet` dice que
  // lo es, no de quién. Inventar un dueño sería peor que dejarla suelta.
  const f = pelea([
    aliado('Campeon', 7000), { name: 'Gabobtik', side: 'ally', damage: 3000, pet: true, taken: 0, max: 0 },
    enemigo('an ire ghast', 100, 9000, 40),
  ], 100);
  const sinSelf = fightToChat(f, { pets: 'group' });
  ok(sinSelf.lineas[0].includes('Gabobtik 3000'), 'sin saber tu nombre, sale suelta y sin etiqueta');
  ok(!sinSelf.lineas[0].includes("'s Pet"), 'y no se le inventa un dueño');

  // Una mascota cuyo dueño no pegó no se puede sumar a nadie: sale sola pero
  // rotulada, que es lo único que impide que pase por jugador.
  const huerfana = pelea([
    { name: 'Jobarn', side: 'ally', damage: 4000, petOf: 'Notarino', taken: 0, max: 0 },
    enemigo('an ire ghast', 100, 9000, 40),
  ], 100);
  const r = fightToChat(huerfana, { self: 'Campeon' });
  ok(r.lineas[0].includes("Jobarn (Notarino's Pet)"),
    'si el dueño no pegó, la mascota sale sola pero con su etiqueta', r.lineas[0]);
}

// ── 9. La lista de named manda sobre la deducción ──────────────────────────
//
// La heurística falla y está medido: `a spite golem` lleva artículo y tiene
// 49.452 de vida; `King Thex`Ka IV` no lo lleva y tiene 1.417. La wiki
// categoriza las páginas como «Raid Encounters» y «Named Mobs», y cuando eso
// esté, se pasa aquí y la deducción no se usa.
console.log('\nlo declarado manda sobre lo deducido');
{
  ok(esNamed('Lord Nagafen', 86000) === true, 'sin lista: sin artículo y grande, se deduce named');
  ok(esNamed('a fire giant warrior', 11000) === false, 'con artículo, no');
  ok(esNamed('a spite golem', 49452) === false, 'y aquí la deducción FALLA: es grande y lleva artículo');

  const lista = new Set(['a spite golem']);
  ok(esNamed('a spite golem', 49452, lista) === true, 'con la lista buena, acierta');
  ok(esNamed('Lord Nagafen', 86000, lista) === false, 'y lo que no está en ella, no lo es');
  ok(esNamed('Lord Nagafen pet', 86000) === false, 'una mascota nunca es un named');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
