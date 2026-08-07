/**
 * La ficha de un hechizo: las dos mitades, y los tramos que se pueden dibujar.
 *
 * LA MITAD QUE FALTABA. El catálogo leía sólo `abilities`, que es daño. Lo que
 * cura vive en `healBySpell` y no se enseñaba en ninguna parte. Medido sobre un
 * histórico real: diez hechizos invisibles del todo —`Leech Touch I` con
 * 190.380 de curación, `Efflorescing Heal` con 170.565— y `Drain Spirit`
 * enseñado a medias, con sus 1.093.644 de daño y sin sus 796.751 de curación.
 *
 * LA GRANULARIDAD, DICHA. Un punto por PELEA, no por lanzamiento: el almacén
 * guarda cuánto sumó un hechizo en cada pelea y cuántas veces se usó, no el
 * daño de cada uso.
 *
 * Y LAS TRES CONDICIONES:
 *
 *   muestra      con menos de `MIN_SERIE` peleas no hay tendencia, hay puntos.
 *                No se dibuja, y se dice cuánto se ha dejado fuera.
 *   dificultad   un hechizo que entra al 100% en D0 y se resiste en D4 son dos
 *                cosas. Medido en `Drain Spirit`: cura 286 de media en D0 y 406
 *                en D4. Promediarlo describe una curación que no existe.
 *   nivel        en un histórico real hay peleas a nivel 24-29 y a 50, y cinco
 *                habilidades se usaron a los dos lados. Una línea que cruce ese
 *                salto dibuja un cambio de nivel y lo hace pasar por mejora.
 */
import { catalog, spellDetail, MIN_SERIE } from '../src/catalog.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/** Una pelea tuya con un hechizo que pega, otro que cura, o los dos. */
const pelea = ({ id, at, level, diff, dano = [], cura = [] }) => ({
  id, uid: id, at, level, diff, diffTag: null, duration: 60,
  rows: [{
    name: 'Campeon', side: 'ally', damage: dano.reduce((a, x) => a + x.sum, 0),
    abilities: dano.map((x) => ({ name: x.name, sum: x.sum, n: x.n, max: x.max ?? x.sum, min: x.min ?? 1, crits: x.crits ?? 0, type: 'magic' })),
    healBySpell: cura.map((x) => ({ name: x.name, sum: x.sum, n: x.n, max: x.max ?? x.sum })),
    healByTarget: [], targets: [], takenBySource: [], types: [],
  }],
  spellVsFoe: [],
});

// ── 1. Un hechizo que sólo cura existe en el catálogo ──────────────────────
console.log('\nlo que sólo cura también es un hechizo');
{
  const fs = [
    pelea({ id: 1, at: 1000, level: 50, diff: 2, cura: [{ name: 'Leech Touch I', sum: 900, n: 2 }] }),
    pelea({ id: 2, at: 2000, level: 50, diff: 2, cura: [{ name: 'Leech Touch I', sum: 500, n: 1 }] }),
  ];
  const c = catalog(fs, 'Campeon');
  const lt = c.find((x) => x.name === 'Leech Touch I');
  ok(!!lt, 'aparece en el catálogo aunque nunca haya hecho daño');
  ok(lt.heal === 1400 && lt.healN === 3, 'con su curación y sus usos', `${lt.heal} en ${lt.healN}`);
  ok(lt.kind === 'heal', 'y marcado como que sólo cura', lt.kind);
  ok(lt.total === 0, 'su daño es cero de verdad', lt.total);
}

// ── 2. Un hechizo que hace las dos cosas ───────────────────────────────────
console.log('\nun drenaje hace dos cosas y se cuentan las dos');
{
  const fs = [pelea({
    id: 1, at: 1000, level: 50, diff: 4,
    dano: [{ name: 'Drain Spirit', sum: 1000, n: 2, max: 600, crits: 1 }],
    cura: [{ name: 'Drain Spirit', sum: 700, n: 2 }],
  })];
  const d = spellDetail(fs, 'Campeon', 'Drain Spirit');
  ok(d.total === 1000 && d.heal === 700, 'daño Y curación, los dos', `${d.total} / ${d.heal}`);
  ok(d.kind === 'spell', 'y sigue siendo un hechizo de daño', d.kind);
}

// ── 3. Las dos entradas que no son hechizos ────────────────────────────────
console.log('\nlo que no es un hechizo se dice que no lo es');
{
  const fs = [pelea({
    id: 1, at: 1000, level: 50, diff: 0,
    dano: [{ name: 'thorns', sum: 500, n: 30 }],
    cura: [{ name: 'cura', sum: 200, n: 4 }],
  })];
  const c = catalog(fs, 'Campeon');
  ok(c.find((x) => x.name === 'thorns').kind === 'ds',
    '«thorns» es un escudo de daño, no algo que lances');
  ok(c.find((x) => x.name === 'cura').kind === 'unknownHeal',
    '«cura» es curación sin identificar, no un hechizo llamado así');
}

// ── 4. La serie se parte por nivel Y por dificultad ────────────────────────
console.log('\nla serie se parte por las dos cosas');
{
  const fs = [];
  // Seis peleas a nivel 29 y seis a 50, todas en D2. Son dos tramos.
  for (let i = 0; i < 6; i++) fs.push(pelea({ id: i, at: 1000 + i, level: 29, diff: 2, dano: [{ name: 'Lifedraw', sum: 100, n: 1 }] }));
  for (let i = 0; i < 6; i++) fs.push(pelea({ id: 10 + i, at: 2000 + i, level: 50, diff: 2, dano: [{ name: 'Lifedraw', sum: 900, n: 1 }] }));
  const d = spellDetail(fs, 'Campeon', 'Lifedraw');
  ok(d.series.length === 2, 'nivel 29 y nivel 50 son dos series, no una', d.series.length);
  const n29 = d.series.find((g) => g.level === 29);
  const n50 = d.series.find((g) => g.level === 50);
  ok(n29.avg === 100 && n50.avg === 900,
    'y cada una con su media: juntarlas daría 500, que no describe ninguna',
    `${n29.avg} y ${n50.avg}`);

  // Mismo nivel, dos dificultades: también son dos.
  const fs2 = [];
  for (let i = 0; i < 6; i++) fs2.push(pelea({ id: i, at: 1000 + i, level: 50, diff: 0, dano: [{ name: 'X', sum: 100, n: 1 }] }));
  for (let i = 0; i < 6; i++) fs2.push(pelea({ id: 10 + i, at: 2000 + i, level: 50, diff: 4, dano: [{ name: 'X', sum: 400, n: 1 }] }));
  const d2 = spellDetail(fs2, 'Campeon', 'X');
  ok(d2.series.length === 2, 'D0 y D4 también son dos series', d2.series.length);
}

// ── 5. Sin muestra no se dibuja, y se dice ─────────────────────────────────
console.log('\ncon pocos puntos no hay tendencia');
{
  const fs = [];
  for (let i = 0; i < MIN_SERIE; i++) fs.push(pelea({ id: i, at: 1000 + i, level: 50, diff: 2, dano: [{ name: 'X', sum: 100, n: 1 }] }));
  // Una dificultad con uno menos del mínimo: no se dibuja.
  for (let i = 0; i < MIN_SERIE - 1; i++) fs.push(pelea({ id: 20 + i, at: 2000 + i, level: 50, diff: 3, dano: [{ name: 'X', sum: 100, n: 1 }] }));
  const d = spellDetail(fs, 'Campeon', 'X');
  ok(d.series.length === 1 && d.series[0].diff === 2, 'sólo se dibuja la que llega', d.series.length);
  ok(d.descartadas.length === 1 && d.descartadas[0].diff === 3,
    'y la que no llega se devuelve aparte para poder decirlo');
  ok(d.descartadas[0].fights === MIN_SERIE - 1, 'con cuántas peleas se quedaron fuera',
    d.descartadas[0].fights);
  ok(d.puntos.length === MIN_SERIE * 2 - 1,
    'los puntos siguen todos ahí: lo que no se dibuja es la línea, no el dato');
}

// ── 6. Los ceros que no son medidas ────────────────────────────────────────
//
// Un hechizo que sólo cura tiene cero usos de daño. Ese cero es «no aplica»:
// enseñar «media 0» al lado de 190.380 de curación se leería como que pega
// flojo. Por eso va `null` y no cero.
console.log('\nun cero que no se ha medido no es un cero');
{
  const fs = [];
  for (let i = 0; i < MIN_SERIE; i++) {
    fs.push(pelea({ id: i, at: 1000 + i, level: 50, diff: 2, cura: [{ name: 'Leech Touch I', sum: 500, n: 1 }] }));
  }
  const d = spellDetail(fs, 'Campeon', 'Leech Touch I');
  const g = d.series[0];
  ok(g.avg === null, 'la media de daño es null, no 0', String(g.avg));
  ok(g.critRate === null, 'y el porcentaje de críticos también', String(g.critRate));
  ok(g.max === null, 'y el máximo', String(g.max));
  ok(g.healAvg === 500 && g.healN === MIN_SERIE, 'pero la curación sí tiene sus cifras',
    `${g.healAvg} en ${g.healN}`);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
