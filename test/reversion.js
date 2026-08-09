/**
 * Qué daño recibido se reconstruye, y con qué precisión.
 *
 * DOS FALLOS REALES, LOS DOS MEDIDOS ANTES DE ARREGLARLOS:
 *
 *   El daño periódico y el escudo de daño se dividían por la mitigación mágica
 *   de la postura, como si la postura los redujera. Medido sobre un registro de
 *   385.656 líneas: NO los reduce. Nueve aplicaciones de daño periódico cruzan
 *   un cambio de postura con el hechizo ya puesto y el valor del tick no se
 *   mueve ni un punto en ninguna; el mismo escudo de daño pincha por 18 bajo
 *   Defensive, Channeler y Offensive. Eran 44.924 puntos inventados sobre 416
 *   peleas guardadas.
 *
 *   Y las reconstrucciones se guardaban con decimales, así que la suma de los
 *   cubos y el total no cuadraban: 3.143.441 contra 3.143.439 según se
 *   redondeara antes o después. Dos puntos que no describen nada.
 *
 * LO QUE ESTE FICHERO PROTEGE NO ES UN NÚMERO, ES UNA DISTINCIÓN. El hechizo
 * directo SÍ se mitiga, y con exactitud: `Soul Devour` pega 400 con Defensive,
 * 300 con Channeler y 250 con Mage Hunter sobre 368 impactos sin varianza. Así
 * que «no revertir nada mágico» sería el fallo simétrico y también falla aquí.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mitigationFor, STANCES, SIN_MITIGACION } from '../src/stances.js';
import { EncounterTracker } from '../src/encounter.js';
import { advise, liveAdvice } from '../src/advisor.js';
import { t } from '../src/i18n.js';
import { Parser } from '../src/parser.js';
import { FightStore, MODELO_MEDICION, MODELO_CON_DOT_DS } from '../src/store.js';

let failed = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra !== undefined ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eqlrev-'));

// ── 1. Qué escuelas mitiga la postura ─────────────────────────────────────
//
// Se recorre la tabla entera en vez de mirar dos posturas a mano: cualquier
// postura futura con mitigación mágica queda cubierta el día que se añada.
console.log('\nqué escuelas mitiga la postura');
{
  const conMagica = Object.entries(STANCES).filter(([, v]) => (v.mit.spell ?? 0) > 0);
  ok(conMagica.length >= 3, 'hay posturas con mitigación mágica que probar', conMagica.length);

  let malDot = 0, malDs = 0;
  for (const [key] of conMagica) {
    if (mitigationFor(key, 'dot') !== 0) malDot++;
    if (mitigationFor(key, 'ds') !== 0) malDs++;
  }
  // Éstas son las dos que fallan si alguien vuelve a meter `dot` o `ds` en el
  // saco de lo mágico. No dependen de cuánto mitigue cada postura: sólo de que
  // la escuela esté o no en la lista de las que se revierten.
  ok(malDot === 0, 'el daño periódico NO se mitiga con ninguna postura', `${malDot} posturas lo mitigan`);
  ok(malDs === 0, 'el escudo de daño NO se mitiga con ninguna postura', `${malDs} posturas lo mitigan`);

  // Y el fallo simétrico: pasarse de corrección y dejar de revertir lo que sí
  // está medido que se mitiga.
  let sinMagica = 0, sinMelee = 0;
  for (const [key, v] of conMagica) {
    if (mitigationFor(key, 'spell') !== v.mit.spell) sinMagica++;
    if (mitigationFor(key, 'melee') !== v.mit.melee) sinMelee++;
  }
  ok(sinMagica === 0, 'el hechizo directo sigue mitigándose con su cifra de tabla');
  ok(sinMelee === 0, 'y el melé también');

  // Una escuela que no conocemos no se trata como mágica por descarte.
  ok(mitigationFor('channeler', 'melee') === STANCES.channeler.mit.melee,
    'Channeler aplica su cifra de melé al melé', mitigationFor('channeler', 'melee'));
}

// ── 2. De punta a punta, con líneas de registro de verdad ─────────────────
//
// Las cuatro líneas son reales, copiadas del registro de referencia. Que la
// tabla diga lo correcto no basta: lo que cuenta es lo que sale del parser.
console.log('\nde la línea del registro al importe reconstruido');
{
  const p = new Parser({ self: 'Campeon' });
  const en = (texto) => p.parse(`[Tue Aug 04 13:26:38 2026] ${texto}`, 0);

  en('You assume a channeler stance.');   // mit mágica 0,40 · melé 0,40
  const mit = STANCES.channeler.mit;

  const dot = en('You have taken 100 damage from Rotting Flesh by a dracoliche.');
  ok(dot?.school === 'dot' && dot.rawAmount === 100,
    'el tick de daño periódico se guarda tal cual', `${dot?.rawAmount}`);

  const ds = en('YOU are pierced by a spite golem\'s thorns for 18 points of non-melee damage!');
  ok(ds?.school === 'ds' && ds.rawAmount === 18,
    'el escudo de daño se guarda tal cual', `${ds?.rawAmount}`);

  const nuke = en('Eye of Veeshan hit you for 300 points of magic damage by Soul Devour.');
  ok(nuke?.school === 'spell' && nuke.rawAmount === Math.round(300 / (1 - mit.spell)),
    'el hechizo directo SÍ se reconstruye', `${nuke?.rawAmount} (esperado ${Math.round(300 / (1 - mit.spell))})`);

  const melee = en('A fire giant warrior hits YOU for 60 points of damage.');
  ok(melee?.school === 'melee' && melee.rawAmount === Math.round(60 / (1 - mit.melee)),
    'y el melé también', `${melee?.rawAmount} (esperado ${Math.round(60 / (1 - mit.melee))})`);
}

// ── 3. Nada reconstruido sale con decimales ──────────────────────────────
//
// Se barre un rango entero de importes contra todas las posturas: basta un
// divisor que no sea potencia de dos para que aparezca un decimal, y el 0,60 de
// Channeler o el 0,80 de Defensive los producen a puñados.
console.log('\ntoda reconstrucción es entera');
{
  const p = new Parser({ self: 'Campeon' });
  let fraccionarios = 0, probados = 0;
  for (const key of Object.keys(STANCES)) {
    p.parse(`[Tue Aug 04 13:26:38 2026] You assume a ${key} stance.`, 0);
    for (let n = 1; n <= 200; n++) {
      const ev = p.parse(`[Tue Aug 04 13:26:38 2026] A fire giant warrior hits YOU for ${n} points of damage.`, 0);
      if (!ev) continue;
      probados++;
      if (!Number.isInteger(ev.rawAmount)) fraccionarios++;
    }
  }
  ok(probados > 1000, 'se han probado importes suficientes', probados);
  ok(fraccionarios === 0, 'ningún importe reconstruido tiene decimales', fraccionarios);
}

// ── 4. La pelea guardada con el modelo viejo se corrige al leerla ────────
console.log('\nuna pelea del modelo 1, leída hoy');

/**
 * Pelea guardada por el modelo 1: `dot` y `ds` vienen revertidos de más, y los
 * cubos traen decimales. Los importes son los de la reversión que se hacía:
 * Channeler dividía por 0,60.
 */
const peleaVieja = () => ({
  id: 1, label: 'a dracoliche', zone: 'Lower Guk', duration: 40,
  total: 5000, raidDps: 125, enemyTotal: 0, enemyDps: 0, healing: 0,
  kills: [], losses: [], loot: [], spellVsFoe: [],
  rows: [{
    name: 'Campeon', side: 'ally', damage: 5000, taken: 1000, healingDone: 0,
    hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
    deaths: 0, max: 100, activeSec: 40, types: [['melee', 5000]], abilities: [],
    targets: [{ name: 'a dracoliche', sum: 5000 }], takenBySource: [],
    rawMeleeOut: 2500.5,
    takenByType: [
      { name: 'melee', sum: 600, n: 12 },
      { name: 'dot', sum: 300, n: 3 },
      { name: 'ds', sum: 100, n: 5 },
    ],
    rawTakenByType: [
      { name: 'melee', sum: 1000.5, n: 12 },   // reconstruido de verdad
      { name: 'dot', sum: 500, n: 3 },         // 300 / 0,60 — inventado
      { name: 'ds', sum: 166.66666666666666, n: 5 },  // 100 / 0,60 — inventado
    ],
  }],
});

{
  const s = new FightStore(tmp(), 'Campeon');
  const sm = s.append(peleaVieja(), 1_000_000);
  s.cache.clear();                       // obligar a leerla del disco
  const f = s.get(sm.uid);
  const raw = new Map(f.rows[0].rawTakenByType.map((x) => [x.name, x.sum]));

  ok(raw.get('dot') === 300, 'el daño periódico vuelve a su importe observado', raw.get('dot'));
  ok(raw.get('ds') === 100, 'el escudo de daño vuelve al suyo', raw.get('ds'));
  ok(raw.get('melee') === 1001, 'el melé conserva su reconstrucción, ya redondeada', raw.get('melee'));
  ok(f.rows[0].rawMeleeOut === 2501, 'y el melé propio reconstruido también', f.rows[0].rawMeleeOut);

  const devuelto = (500 - 300) + (166.66666666666666 - 100);
  ok(Math.round(devuelto) === 267, 'se han devuelto los puntos que se inventaron', Math.round(devuelto));

  // Sube al modelo en que `dot`/`ds` ya están arreglados, y NI UNO MÁS. Leer no
  // puede darle el reparto por postura —eso no está en el disco, hay que releer
  // el registro— así que marcarla con el modelo vigente afirmaría algo que no
  // se ha hecho.
  ok(f.modelo === MODELO_CON_DOT_DS,
    'la pelea sube al modelo en que dot y ds ya están arreglados', f.modelo);
  ok(f.modelo < MODELO_MEDICION,
    'pero NO al modelo vigente, que exige releer el registro', `${f.modelo} < ${MODELO_MEDICION}`);
  ok(f.modeloOrigen === 1, 'y queda el modelo con el que se calculó', f.modeloOrigen);

  // La suma de los cubos cuadra con el total al punto, que es lo que el
  // redondeo fraccionario impedía.
  const suma = f.rows[0].rawTakenByType.reduce((a, x) => a + x.sum, 0);
  ok(Number.isInteger(suma), 'la suma de los cubos reconstruidos es entera', suma);
  ok(f.rows[0].rawTakenByType.every((x) => Number.isInteger(x.sum)),
    'y cada cubo por separado también');
}

// ── 5. Una pelea nacida hoy no se toca ───────────────────────────────────
//
// Releer no puede volver a aplicar la corrección: si lo hiciera, la segunda
// lectura de una pelea ya buena le quitaría daño de verdad.
console.log('\nlo que ya está bien no se vuelve a corregir');
{
  const s = new FightStore(tmp(), 'Campeon');
  const nueva = { ...peleaVieja(), modelo: MODELO_MEDICION };
  // Con el modelo nuevo, `dot` no viene revertido: observado y reconstruido son
  // el mismo importe.
  nueva.rows[0].rawTakenByType = [
    { name: 'melee', sum: 1001, n: 12 },
    { name: 'dot', sum: 300, n: 3 },
    { name: 'ds', sum: 100, n: 5 },
  ];
  const sm = s.append(nueva, 1_000_000);
  s.cache.clear();
  const f = s.get(sm.uid);
  const raw = new Map(f.rows[0].rawTakenByType.map((x) => [x.name, x.sum]));
  ok(raw.get('melee') === 1001 && raw.get('dot') === 300 && raw.get('ds') === 100,
    'los importes quedan como estaban');
  ok(f.modeloOrigen === undefined, 'y no se marca como corregida, porque no lo fue');
}

// ── 6. Lo que no se puede corregir NO se toca y se dice ──────────────────
//
// El arreglo copia el importe observado sobre el reconstruido, y eso sólo vale
// si los dos cubos describen la misma población. Si el número de impactos no
// coincide, no lo son: copiar ahí sería inventar por el otro lado.
console.log('\nun cubo que no cuadra deja la pelea en el modelo viejo');
{
  const s = new FightStore(tmp(), 'Campeon');
  const rota = peleaVieja();
  rota.rows[0].takenByType.find((x) => x.name === 'dot').n = 99;   // no casa con los 3
  const sm = s.append(rota, 1_000_000);
  s.cache.clear();
  const f = s.get(sm.uid);
  const raw = new Map(f.rows[0].rawTakenByType.map((x) => [x.name, x.sum]));
  ok(raw.get('dot') === 500, 'el cubo que no cuadra se queda como estaba', raw.get('dot'));
  ok(f.modelo === undefined || Number(f.modelo) < MODELO_MEDICION,
    'y la pelea NO se marca como corregida', f.modelo);
}

// ── 7. El consejo no se apunta como evitable lo que no lo es ────────────
//
// LA COMPROBACIÓN QUE MANDA ES LA DE LA INVARIANZA, no la de un número: se pasa
// la MISMA pelea con y sin daño periódico encima, y lo que cada postura habría
// evitado no puede moverse ni un punto. Si `dot` o `ds` vuelven a entrar en el
// cubo mágico, se mueve, y da igual cuánto valga la tabla de mitigaciones.
console.log('\nel consejo y el daño que ninguna postura para');
{
  /** Fila propia con daño recibido de las cuatro escuelas, o de dos. */
  const fila = ({ dot = 0, ds = 0 } = {}) => ({
    name: 'Campeon', damage: 9000, taken: 1000, healingDone: 0,
    types: [['melee', 9000]], defense: [['esquiva', 6]],
    rawMeleeOut: 9000,
    takenByType: [
      { name: 'melee', sum: 800, n: 20 },
      { name: 'magic', sum: 400, n: 8 },
      ...(dot ? [{ name: 'dot', sum: dot, n: 10 }] : []),
      ...(ds ? [{ name: 'ds', sum: ds, n: 10 }] : []),
    ],
    rawTakenByType: [
      { name: 'melee', sum: 1600, n: 20 },
      { name: 'magic', sum: 500, n: 8 },
      ...(dot ? [{ name: 'dot', sum: dot, n: 10 }] : []),
      ...(ds ? [{ name: 'ds', sum: ds, n: 10 }] : []),
    ],
  });
  const ctx = { classes: ['SHD'], stance: 'defensive',
    seenStances: ['defensive', 'channeler', 'mage hunter'] };

  const limpia = advise(fila(), ctx);
  const conDot = advise(fila({ dot: 3000, ds: 1000 }), ctx);

  ok(limpia && conDot, 'las dos peleas producen consejo');

  // Los cubos, cada uno en su sitio.
  ok(conDot.incoming.unmitigable === 4000,
    'el daño periódico y el escudo van a su propio cubo', conDot.incoming.unmitigable);
  ok(conDot.incoming.spell === limpia.incoming.spell,
    'y NO engordan el cubo mágico', `${conDot.incoming.spell} vs ${limpia.incoming.spell}`);
  ok(conDot.incoming.total === limpia.incoming.total + 4000,
    'pero sí cuentan como daño recibido: te lo comiste', conDot.incoming.total);
  ok(conDot.incoming.mitigable === limpia.incoming.total,
    'lo mitigable es lo de siempre', conDot.incoming.mitigable);

  // LA INVARIANZA. Ésta es la que falla si vuelven a contarse como evitables.
  const antes = new Map(limpia.defence.map((d) => [d.key, d.prevented]));
  let movidas = 0;
  for (const d of conDot.defence) {
    if (Math.abs((antes.get(d.key) ?? 0) - d.prevented) > 1e-9) movidas++;
  }
  ok(conDot.defence.length >= 2, 'hay varias posturas que comparar', conDot.defence.length);
  ok(movidas === 0,
    'meterle 4.000 de daño periódico no cambia lo que evita NINGUNA postura',
    `${movidas} posturas cambian`);

  // Y la cota sí se mueve: el porcentaje de cada postura baja, porque el mismo
  // ahorro pesa menos sobre un daño total mayor. Es lo que hace honesta la tabla.
  const shareAntes = limpia.defence[0].share, shareDespues = conDot.defence[0].share;
  ok(shareDespues < shareAntes,
    'y el porcentaje de la mejor postura BAJA, que es la cota',
    `${(shareAntes * 100).toFixed(1)}% → ${(shareDespues * 100).toFixed(1)}%`);

  // El reparto melé/mágico se decide sobre lo mitigable: si no, dos venenos
  // encima convertían una pelea de melé en «mágica».
  ok(Math.abs(conDot.incoming.meleeShare - limpia.incoming.meleeShare) < 1e-9,
    'el reparto melé/mágico tampoco se mueve',
    `${conDot.incoming.meleeShare.toFixed(3)} vs ${limpia.incoming.meleeShare.toFixed(3)}`);
}

// ── 8. Una pelea entera de daño que nadie para ──────────────────────────
console.log('\nuna pelea en la que no había nada que elegir');
{
  const soloDot = advise({
    name: 'Campeon', damage: 5000, taken: 3000, healingDone: 0,
    types: [['melee', 5000]], defense: [], rawMeleeOut: 5000,
    takenByType: [{ name: 'dot', sum: 3000, n: 30 }],
    rawTakenByType: [{ name: 'dot', sum: 3000, n: 30 }],
  }, { classes: ['SHD'], stance: 'defensive', seenStances: ['defensive', 'channeler'] });

  ok(soloDot.incoming.mitigable === 0, 'no hay nada mitigable', soloDot.incoming.mitigable);
  ok(soloDot.incoming.total === 3000, 'pero el daño recibido está entero', soloDot.incoming.total);
  ok(soloDot.defence.every((d) => d.prevented === 0),
    'ninguna postura habría evitado nada');
  // Y se dice así, en vez de «Channeler no compensa frente a Defensive», que
  // contestaría una pregunta que aquí no existe.
  ok(soloDot.verdict === t('adv.allUnmitigable', { n: 3000 }),
    'y el veredicto lo dice en vez de comparar posturas', soloDot.verdict);
}

// ── 9. Lo mismo en el consejo EN VIVO ───────────────────────────────────
//
// Es el que te saca del combate para pedirte un cambio, así que es donde más
// caro sale contar como evitable algo que no lo es.
console.log('\nel consejo en vivo');
{
  const base = { melee: 6000, spell: 2000, seconds: 20, hits: 40,
    landedMelee: 30, meleeSwings: 40 };
  const ctx = { classes: ['SHD'], stance: 'channeler', seenStances: ['defensive', 'channeler'] };

  const limpia = liveAdvice({ ...base, unmitigable: 0, total: 8000, observed: 8000 }, ctx);
  const conDot = liveAdvice({ ...base, unmitigable: 12000, total: 20000, observed: 20000 }, ctx);

  const antes = new Map(limpia.scored.map((s) => [s.key, s.prevented]));
  const movidas = conDot.scored.filter((s) => Math.abs((antes.get(s.key) ?? 0) - s.prevented) > 1e-9);
  ok(movidas.length === 0,
    'el daño periódico no cambia lo que evitaría ninguna postura', movidas.length);
  ok(conDot.unmitigable === 12000, 'y sale en el resultado para poder enseñarlo', conDot.unmitigable);
  // El reparto también aquí: `kind` es lo que se dice en voz alta por el
  // narrador y lo que decide entre Defensive y Mage Hunter. Con el periódico
  // dentro, una ventana de melé con dos venenos encima se anuncia como mágica.
  ok(conDot.kind === limpia.kind && Math.abs(conDot.meleeShare - limpia.meleeShare) < 1e-9,
    'y el reparto melé/mágico no se mueve',
    `${limpia.kind} ${limpia.meleeShare.toFixed(3)} → ${conDot.kind} ${conDot.meleeShare.toFixed(3)}`);
  // El umbral se mide contra TODO lo que entra: con tres cuartas partes del
  // daño en periódico, la misma mejora ya no justifica sacarte de la pelea.
  ok(conDot.worth < limpia.worth,
    'y la mejora relativa baja, que es lo que frena la sugerencia',
    `${(limpia.worth * 100).toFixed(1)}% → ${(conDot.worth * 100).toFixed(1)}%`);
}

// ── 10. NINGÚN acumulador mitigable recibe lo no mitigable ──────────────
//
// LA PRUEBA VA SOBRE LA CONSTANTE, NO SOBRE UNA LISTA ESCRITA AQUÍ. Se recorre
// `SIN_MITIGACION` y se comprueban TODOS los sitios donde el daño recibido se
// acumula. El día que se añada una tercera escuela a esa lista, este bloque la
// cubre sin que nadie se acuerde de venir a tocarlo; y si alguien vuelve a
// escribir «lo que no es melé es mágico» en cualquiera de los cuatro sitios,
// falla aquí.
//
// Los cuatro acumuladores, que son los que había que encontrar:
//   rawTakenByType   el cubo por escuela de la fila
//   takenByStance    el reparto por postura
//   series.tSpell    la serie por segundo — la que se le escapaba a todo el mundo
//   advise().incoming.spell   lo que el consejo trata como evitable
console.log('\nningún acumulador mitigable recibe lo que ninguna postura para');
{
  const LINEAS = {
    dot: 'You have taken 100 damage from Rotting Flesh by a dracoliche.',
    ds: 'YOU are pierced by a spite golem\'s thorns for 100 points of non-melee damage!',
  };
  /**
   * EL ANCLA, sin la cual esto no protege de nada. Recorrer la constante cubre
   * lo que se le añada, pero si alguien la ENCOGE el bucle se limita a dar
   * menos vueltas y todo sigue verde mientras el daño vuelve al cubo mágico.
   *
   * Así que las dos escuelas medidas se exigen por nombre, y no es un número
   * arbitrario: es lo que dice el registro. Nueve aplicaciones de daño periódico
   * cruzan un cambio de postura sin que el tick se mueva, y el mismo escudo
   * pincha por 18 bajo Defensive, Channeler y Offensive. Quitar una de las dos
   * de la lista contradice esa medición, y entonces hay que traer una medición
   * nueva, no borrar la prueba.
   */
  for (const medida of ['dot', 'ds']) {
    ok(SIN_MITIGACION.has(medida),
      `«${medida}» sigue en la lista de lo que ninguna postura mitiga`,
      [...SIN_MITIGACION].join(', '));
  }

  for (const escuela of SIN_MITIGACION) {
    const linea = LINEAS[escuela];
    if (!linea) {
      ok(false, `falta una línea de registro para la escuela «${escuela}»`,
        'añádela a LINEAS o esta escuela queda sin probar');
      continue;
    }
    const p = new Parser({ self: 'Campeon' });
    const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
    const en = (s, texto) => tr.feed(p.parse(`[Tue Aug 04 13:26:${String(38 + s).padStart(2, '0')} 2026] ${texto}`, 0));
    en(0, 'You assume a channeler stance.');
    en(1, 'You slash a gorgon for 500 points of damage.');
    en(2, linea);
    const fila = tr.current.totals().rows.find((r) => r.name === 'Campeon');
    const serie = [...tr.current.series.values()];

    const cubo = (lista, nombre) => (lista ?? []).find(([k]) => k === nombre)?.[1]?.sum ?? 0;
    ok(cubo(fila.rawTakenByType, escuela) === 100,
      `«${escuela}» va a su propio cubo por escuela`, cubo(fila.rawTakenByType, escuela));

    const tramo = (fila.takenByStance ?? [])[0];
    ok(tramo?.unmit === 100 && tramo?.spell === 0 && tramo?.melee === 0,
      `«${escuela}» va a lo no mitigable del tramo, no a melé ni a mágico`,
      `unmit=${tramo?.unmit} spell=${tramo?.spell} melee=${tramo?.melee}`);

    const sumar = (k) => serie.reduce((a, x) => a + (x[k] ?? 0), 0);
    ok(sumar('tUnmit') === 100 && sumar('tSpell') === 0 && sumar('tMelee') === 0,
      `«${escuela}» va al tercer cubo de la SERIE, no a tSpell`,
      `tUnmit=${sumar('tUnmit')} tSpell=${sumar('tSpell')} tMelee=${sumar('tMelee')}`);

    // El consejero recibe los cubos con la forma que les da el motor al armar
    // la pelea (`#b`), no los pares crudos del encuentro.
    const comoElMotor = (pares) => (pares ?? []).map(([name, v]) => ({ name, sum: v.sum, n: v.n }));
    const a = advise({ ...fila,
      rawTakenByType: comoElMotor(fila.rawTakenByType),
      takenByType: comoElMotor(fila.takenByType),
      types: [] },
    { classes: ['SHD'], stance: 'channeler', seenStances: ['channeler', 'defensive'] });
    ok(a?.incoming.unmitigable === 100 && a?.incoming.spell === 0,
      `y el consejo NO lo trata como evitable`,
      `unmitigable=${a?.incoming.unmitigable} spell=${a?.incoming.spell}`);
  }
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
