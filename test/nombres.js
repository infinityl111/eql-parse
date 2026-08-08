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

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
