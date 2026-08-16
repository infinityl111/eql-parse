/**
 * EL REPRODUCTOR NO TIENE SU PROPIA DEFINICIÓN DE PELEA.
 *
 * ── EL FALLO QUE ESTRENA ESTA BATERÍA, con nombre y hora ──────────────────
 *
 * 11 de agosto de 2026, 19:34:32 HORA LOCAL. Una pelea de 99 segundos con TRES
 * combatientes: tú, `Vobn` y `a rock golem`. El reproductor dibujaba TRECE
 * figuras, porque además metía diez actores de dos combates ajenos que ocurrían
 * en los mismos segundos —468 golpes entre ellos, ninguno contra nadie de la
 * pelea—.
 *
 * (Se escribió primero como «17:34:32, 98 s, catorce figuras, once ajenos, 495
 * golpes». Era la misma pelea con la hora en UTC y con cifras de un arnés que
 * contaba nombres en la ventana en vez de figuras dibujadas. Ver `relevancia.js`.)
 *
 * ── POR QUÉ PASABA, Y POR QUÉ NO ERA UN FILTRO FLOJO ──────────────────────
 *
 * El guion se construye releyendo el registro ENTRE EL INICIO Y EL FIN de la
 * pelea, y `guion.js` metía como actor a cualquiera que apareciera en esa
 * ventana. Una ventana de tiempo usada como si fuera una lista de pertenencia
 * — la misma forma exacta que el combate contra cadáveres.
 *
 * Lo grave no era la debilidad de la regla: era que había DOS. `encounter.js`
 * ya contesta esta pregunta bien, y el reproductor la contestaba otra vez, peor.
 * El propio `guion.js` decía ciento treinta líneas más arriba que «el reparto
 * sale de la pelea, no del registro» y que «dos respuestas distintas para la
 * misma pregunta es peor que una imperfecta».
 *
 * ── LO QUE COSTABA, MEDIDO sobre 1.493 peleas con combatientes ────────────
 *
 *                                          antes          después
 *     peleas con alguna figura AJENA      446 (29,9 %)    190 (12,7 %)
 *     ...con combate ENTRE dos ajenos      49 ( 3,3 %)      0 (0,0 %)
 *
 * Después de que el reproductor llame a la guarda: combate entre ajenos, CERO.
 *
 * ── LO QUE SE CONSERVA, y por eso hay una comprobación para ello ──────────
 *
 * La categoría «apareció y no hizo ni recibió daño» —un sanador, alguien que
 * sólo falló— sigue entrando. Lo que se le exige no es haber hecho daño: es
 * haber tocado a ALGÚN MIEMBRO de la pelea.
 *
 *     QUIEN SÓLO INTERACTÚA CON QUIEN NO ESTÁ EN LA PELEA, NO ESTÁ EN LA PELEA.
 */
import { Parser } from '../src/parser.js';
import { guion } from '../src/guion.js';
import { esRelevante } from '../src/relevancia.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const H = (s) => `[Tue Aug 11 17:${String(34 + Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} 2026] `;
const INICIO = Math.round(new Date(2026, 7, 11, 17, 34, 0).getTime() / 1000);
const linea = (s, texto) => ({ t: INICIO + s, texto });

/** La pelea real, reducida a su reparto: tú, tu aliado y el bicho. */
const PELEA = {
  start: INICIO, duration: 98,
  rows: [
    { name: 'Campeon', side: 'ally', damage: 3000 },
    { name: 'Vobn', side: 'ally', damage: 1200 },
    { name: 'a rock golem', side: 'enemy', damage: 400 },
  ],
};

// ═══ 1. El caso real: tres figuras, no catorce ═══════════════════════════
console.log('\nel combate de al lado no entra en tu pelea');
{
  const lineas = [
    // Tu pelea.
    linea(1, 'Campeon slashes a rock golem for 120 points of damage.'),
    linea(2, 'a rock golem hits Campeon for 40 points of damage.'),
    linea(3, 'Vobn pierces a rock golem for 80 points of damage.'),
    // Y el combate de un desconocido, en los mismos segundos. Ninguno de estos
    // cuatro toca a nadie de la pelea: es la pelea de Matherdon, no la tuya.
    linea(2, 'Matherdon slashes a flighty fiend for 300 points of damage.'),
    linea(2, 'a flighty fiend hits Matherdon for 90 points of damage.'),
    linea(3, 'Kabartik pierces a ratman warrior for 150 points of damage.'),
    linea(4, 'a ratman warrior hits Kabartik for 60 points of damage.'),
  ];
  const g = guion(PELEA, lineas, Parser, 'Campeon');
  const nombres = g.actores.map((a) => a.nombre).sort();
  ok(g.actores.length === 3, 'se dibujan TRES figuras, no siete', `${g.actores.length}: ${nombres.join(', ')}`);
  ok(!nombres.includes('Matherdon') && !nombres.includes('a flighty fiend'),
    'ni Matherdon ni su bicho salen en tu reproducción');
  ok(!nombres.includes('Kabartik') && !nombres.includes('a ratman warrior'),
    'ni Kabartik ni el suyo');
}

// ═══ 2. Y el que SÍ tocó a alguien de la pelea sigue entrando ════════════
//
// La mitad que impide «arreglarlo» filtrando por el reparto guardado a secas:
// si esto se pone rojo, hemos borrado a los sanadores.
console.log('\nquien toca a alguien de la pelea SÍ entra, aunque no haga daño');
{
  const lineas = [
    linea(1, 'Campeon slashes a rock golem for 120 points of damage.'),
    // Un sanador que no estaba en el reparto guardado y no hace daño ninguno.
    linea(2, 'Zurhk healed Campeon for 200 hit points by Superior Healing.'),
    // Y alguien que sólo falla contra tu bicho.
    linea(3, 'Trisfhal tries to slash a rock golem, but misses!'),
  ];
  const g = guion(PELEA, lineas, Parser, 'Campeon');
  const nombres = g.actores.map((a) => a.nombre);
  ok(nombres.includes('Zurhk'), 'el sanador entra, aunque no pegara', nombres.join(', '));
  ok(nombres.includes('Trisfhal'), 'y el que sólo falló contra tu enemigo, también');
  const zurhk = g.actores.find((a) => a.nombre === 'Zurhk');
  ok(zurhk?.lado === 'sinBando', 'y entran SIN BANDO, que es lo único que consta de ellos', zurhk?.lado);
}

// ═══ 3. La guarda, directamente ═════════════════════════════════════════
//
// Las dos de arriba comprueban el efecto a través del guion; ésta comprueba la
// pieza, para que un fallo diga cuál de las dos cosas se rompió.
console.log('\nla guarda contesta lo mismo para los dos llamadores');
{
  const reparto = new Set(['Campeon', 'Vobn', 'a rock golem']);
  const ctx = { mios: new Set(['Campeon']), objetivos: reparto, enPelea: reparto, companions: new Set() };
  ok(esRelevante({ kind: 'melee', source: 'Campeon', target: 'a rock golem', amount: 10 }, ctx),
    'tu golpe a tu enemigo, sí');
  ok(esRelevante({ kind: 'heal', source: 'Zurhk', target: 'Campeon', amount: 10 }, ctx),
    'una curación a alguien de la pelea, sí');
  ok(!esRelevante({ kind: 'melee', source: 'Matherdon', target: 'a flighty fiend', amount: 300 }, ctx),
    'dos desconocidos pegándose entre ellos, NO');
  ok(esRelevante({ kind: 'death', victim: 'a rock golem', killer: 'Campeon' }, ctx),
    'la muerte de tu enemigo, sí — y se mira `victim`/`killer`, no `source`/`target`');
  ok(!esRelevante({ kind: 'death', victim: 'a flighty fiend', killer: 'Matherdon' }, ctx),
    'y la muerte del bicho de otro, no');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
