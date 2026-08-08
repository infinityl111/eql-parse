/**
 * La mayúscula de principio de frase no crea combatientes.
 *
 * EL FALLO. EQ capitaliza la primera letra de la línea, así que el mismo bicho
 * llega como «Ice boned skeleton» cuando pega y «ice boned skeleton» cuando le
 * pegan. El normalizador sólo bajaba el artículo —«A ghoul» a «a ghoul»—, y un
 * nombre SIN artículo se quedaba partido en dos filas: una con todo el daño y
 * cero recibido, otra al revés.
 *
 * El «recibido 0» era la firma: la forma capitalizada sólo aparece abriendo la
 * línea, o sea sólo pegando, nunca recibiendo.
 *
 * MEDIDO sobre 463 peleas del registro de referencia, antes y después:
 *
 *   heart harpie         3.378 daño / 31.979 recibido  ┐  11.760 / 35.454
 *   Heart harpie         8.382 daño /  3.475 recibido  ┘
 *   ice boned skeleton   1.101 daño /  5.410 recibido  ┐   3.346 /  5.410
 *   Ice boned skeleton   2.245 daño /      0 recibido  ┘
 *   giant wooly spider       0 daño /  4.952 recibido  ┐     212 /  5.471
 *   Giant wooly spider     212 daño /    519 recibido  ┘
 *   skeleton L`rodd          0 daño /    412 recibido  ┐       3 /    412
 *   Skeleton L`rodd          3 daño /      0 recibido  ┘
 *
 * Las sumas cuadran una a una: no se inventa nada, se vuelve a juntar. Los
 * combatientes distintos pasan de 267 a 263.
 *
 * POR QUÉ GANA LA MINÚSCULA, que no es una preferencia. Un nombre propio como
 * «Lord Nagafen» se escribe igual en medio de la frase que al principio, así
 * que NUNCA produce un par. Si hay dos formas, la de verdad es la minúscula y
 * la otra es la frase. Se ve en «skeleton L`rodd», que es un named y aun así
 * su nombre empieza en minúscula.
 *
 * Y POR QUÉ AQUÍ Y NO AL ANALIZAR. Se intentó allí con un registro de formas
 * aprendidas, y depende del orden: lo emitido antes de aprender la forma buena
 * se queda mal. Probado sobre el registro entero, salían tres nombres partidos
 * en vez de cuatro — mejor, pero todavía mal. En el embudo de combatientes no
 * hay orden que valga: si llega la minúscula después, se corrige la ficha ya
 * creada.
 */
import { EncounterTracker } from '../src/encounter.js';
import { Parser } from '../src/parser.js';

const HORA = (s) => `[Fri Aug 07 20:00:${String(s).padStart(2, '0')} 2026] `;

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const tracker = () => new EncounterTracker({ self: 'Campeon', idleSec: 20 });
const golpe = (t, source, target, amount) => ({
  t, seq: t, kind: 'melee', source, target, amount, verb: 'hits', school: 'melee',
});

console.log('\nel mismo bicho en dos formas');

// ── 1. Primero pega (capitalizado), luego le pegan (minúscula) ─────────────
{
  const tr = tracker();
  tr.feed(golpe(1, 'Ice boned skeleton', 'Campeon', 100));
  tr.feed(golpe(2, 'Campeon', 'ice boned skeleton', 50));
  const rows = tr.current.totals().rows;
  const suyas = rows.filter((r) => r.name.toLowerCase() === 'ice boned skeleton');
  ok(suyas.length === 1, 'una sola fila, no dos', suyas.map((r) => r.name).join(' || '));
  ok(suyas[0]?.name === 'ice boned skeleton', 'y con la forma buena, la minúscula', suyas[0]?.name);
  ok(suyas[0]?.damage === 100 && suyas[0]?.taken === 50,
    'con su daño Y su recibido juntos', `${suyas[0]?.damage}/${suyas[0]?.taken}`);
}

// ── 2. Y al revés, que es donde falla un registro que aprende ──────────────
{
  const tr = tracker();
  tr.feed(golpe(1, 'Campeon', 'ice boned skeleton', 50));
  tr.feed(golpe(2, 'Ice boned skeleton', 'Campeon', 100));
  const suyas = tr.current.totals().rows.filter((r) => r.name.toLowerCase() === 'ice boned skeleton');
  ok(suyas.length === 1, 'en el otro orden, también una sola', suyas.map((r) => r.name).join(' || '));
  ok(suyas[0]?.damage === 100 && suyas[0]?.taken === 50,
    'y las dos mitades en su sitio', `${suyas[0]?.damage}/${suyas[0]?.taken}`);
}

// ── 3. Un nombre propio no se toca ─────────────────────────────────────────
{
  const tr = tracker();
  tr.feed(golpe(1, 'Lord Nagafen', 'Campeon', 900));
  tr.feed(golpe(2, 'Campeon', 'Lord Nagafen', 300));
  const suyas = tr.current.totals().rows.filter((r) => r.name.toLowerCase() === 'lord nagafen');
  ok(suyas.length === 1 && suyas[0].name === 'Lord Nagafen',
    'sigue siendo «Lord Nagafen»: nunca produce par, así que nada que juntar',
    suyas[0]?.name);
}

// ── 4. Dos bichos que sí son distintos siguen distintos ────────────────────
{
  const tr = tracker();
  tr.feed(golpe(1, 'a ghoul', 'Campeon', 10));
  tr.feed(golpe(2, 'a ghoul knight', 'Campeon', 20));
  const n = tr.current.totals().rows.filter((r) => r.name.startsWith('a ghoul')).length;
  ok(n === 2, 'dos nombres parecidos no se funden: sólo casa la primera letra', n);
}

/**
 * «yourself» NO ES UN COMBATIENTE, y es el mismo fallo con otra ropa.
 *
 * El normalizador enumeraba a mano las formas de tu nombre —«You», «YOU»,
 * «you», «Yourself»— y faltaba la que el log escribe más: la minúscula de
 * mitad de frase. El log la usa para el daño que te haces tú:
 *
 *     You hurt yourself for 40 points.                                 ×133
 *     You hit yourself for 62 points of unresistable damage by Cannibalize. ×51
 *     You hit yourself for … by Siphon / Lifedraw                        ×4
 *
 * Medido sobre el almacén: una fila llamada «yourself» en 9 peleas, con 2.107
 * de daño recibido dentro y 0 hecho. El «0 hecho» es la firma, igual que en el
 * fallo de la mayúscula: ese nombre sólo aparece como destino.
 *
 * Y la cura es la misma que allí: comparar sin mirar la caja en vez de
 * enumerar variantes, que es lo que deja huecos.
 */
console.log('\nlos pronombres no son combatientes');
{
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const mete = (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); return ev; };

  mete(`${HORA(1)}a ghoul hits Campeon for 100 points of damage.`);
  mete(`${HORA(2)}You slash a ghoul for 50 points of damage.`);
  const ev = mete(`${HORA(3)}You hit yourself for 62 points of unresistable damage by Cannibalize.`);
  // La forma corta, sin escuela ni hechizo: 133 líneas del registro de
  // referencia que no casaban con ninguna regla y no se contaban en ninguna
  // parte. Entre las dos formas son 187 líneas y 2.244 de daño.
  const corto = mete(`${HORA(4)}You hurt yourself for 40 points.`);

  ok(ev?.target === 'Campeon', 'el destino «yourself» eres tú', ev?.target);
  ok(ev?.source === 'Campeon', 'y el origen también', ev?.source);
  ok(corto?.kind === 'spell' && corto?.amount === 40,
    '«You hurt yourself» se reconoce', `${corto?.kind}/${corto?.amount}`);

  const filas = tr.current.totals().rows;
  ok(!filas.some((r) => /yourself/i.test(r.name)),
    'y no aparece ninguna fila con ese nombre', filas.map((r) => r.name).join(', '));
  const yo = filas.find((r) => r.name === 'Campeon');
  ok(yo.taken === 202, 'el daño que te haces cuenta como tuyo recibido', yo.taken);

  // PEGARTE A TI MISMO NO ES PEGAR. Antes, Cannibalize entraba también como
  // daño HECHO: 62 puntos de tu propia vida sumando a tu DPS y al total del
  // grupo, contigo mismo en la tabla de «a quién pegas».
  ok(yo.damage === 50, 'pero NO como daño hecho: sólo cuenta el golpe al ghoul', yo.damage);
  ok(!yo.byAbility.some(([k]) => k === 'Cannibalize'),
    'ni aparece en tu tabla de habilidades',
    yo.byAbility.map(([k]) => k).join(', '));
  ok(!yo.byTarget.some(([k]) => k === 'Campeon'),
    'ni tú en la de objetivos', yo.byTarget.map(([k]) => k).join(', '));
}

/**
 * Y LA GUARDA DE ESA REGLA: mismo nombre no es el mismo bicho.
 *
 * La primera versión marcaba la autolesión comparando origen y destino. Con
 * eso, «A hardened skeleton hits a hardened skeleton» —un encantado pegando al
 * salvaje que se llama igual— se descontaba como si alguien se pegara a sí
 * mismo, y ese golpe sí ocurrió: está contado aparte como ambiguo, que es una
 * cosa distinta. Lo único que prueba que es el mismo es el pronombre.
 */
console.log('\nmismo nombre no es el mismo bicho');
{
  const p = new Parser({ self: 'Campeon' });
  const propio = p.parse(`${HORA(1)}You hurt yourself for 40 points.`);
  const ajeno = p.parse(`${HORA(2)}A hardened skeleton hits a hardened skeleton for 50 points of damage.`);
  ok(propio?.selfInflicted === true, 'el pronombre marca la autolesión');
  ok(ajeno?.source === ajeno?.target, 'los dos esqueletos se llaman igual…', ajeno?.source);
  ok(!ajeno?.selfInflicted, '…y aun así no es autolesión: no lo dice el registro');
}

// Y la otra mitad: el pronombre de OTRO no eres tú, es él. Sin esto, la
// autocuración de un enemigo se te atribuiría a ti.
//
// La línea es la de verdad del registro, con su cifra entre paréntesis: al
// escribirla de memoria sin ella no casaba ninguna regla y la prueba fallaba
// por el formato, no por lo que quería comprobar.
console.log('\nel pronombre de otro es de otro');
{
  const p = new Parser({ self: 'Campeon' });
  const ev = p.parse(`${HORA(1)}a worry wraith pet healed himself for 613 (1633) hit points by Lay on Hands.`);
  ok(ev?.target === 'a worry wraith pet', 'se resuelve al que lo lanzó, no a ti', ev?.target);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
