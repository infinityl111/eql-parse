/**
 * Zonas, dificultad y nivel.
 *
 * Las tres cosas que hacen que un enemigo del expediente sea comparable con
 * otro. Todas las líneas de aquí salen de un log real de EQL.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { parseZone, labelDiff } from '../src/zones.js';
import { aggregate } from '../src/aggregate.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};
const stamp = (s) => {
  const d = new Date(2026, 7, 4, 12, 0, 0);
  d.setSeconds(d.getSeconds() + s);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

// ── 1. Descomponer el nombre de zona ─────────────────────────────────────
console.log('\nnombre de zona -> base, modo y dificultad');
{
  const c = (z) => parseZone(z);
  ok(c("Nagafen's Lair - Solo 2 (Adaptive)").diff === 2, 'Solo 2 (Adaptive) es D2');
  ok(c("Nagafen's Lair - Solo 3 (Fused)").diff === 3, 'Solo 3 (Fused) es D3');
  ok(c("Nagafen's Lair - Solo 3 (Fused)").base === "Nagafen's Lair", 'y la base queda limpia');
  ok(c("Nagafen's Lair - Solo 3 (Fused)").mode === 'Solo', 'con su modo');

  /**
   * EL DÍGITO PEGADO AL NOMBRE ES LA DIFICULTAD, Y SALE DE LA BASE.
   *
   * Aquí se afirmaba lo contrario —que el 2 de «Old Guk 2» era parte del
   * nombre porque el /who la llama gukbottom— y era falso. Lo desmiente el
   * registro por tres sitios: los 22 dígitos pegados coinciden con el índice
   * de su etiqueta las 22 veces, Old Guk aparece con 1, 2, 3 y 4 —si el 2
   * fuera el nombre no existirían los otros tres—, y ningún dígito del corpus
   * viene sin etiqueta.
   *
   * Costaba 15 visitas de Hate y 4 de Fear en el censo de jefes, porque
   * «The Plane of Hate 4» y «The Plane of Hate» eran bases distintas.
   */
  const guk = c('The Ruins of Old Guk 2 (Adaptive)');
  ok(guk.base === 'The Ruins of Old Guk 2'.replace(/ 2$/, ''),
    'el 2 de «Old Guk 2» SALE de la base: es la dificultad', guk.base);
  ok(guk.diff === 2, 'y la dificultad es 2, que es lo que decía el dígito y la etiqueta');
  ok(c('The Plane of Hate 4 (Refined)').base === c('The Plane of Hate').base,
    'CONTROL: «The Plane of Hate 4 (Refined)» y «The Plane of Hate» son la MISMA base',
    `${c('The Plane of Hate 4 (Refined)').base} vs ${c('The Plane of Hate').base}`);
  ok(c('The Plane of Hate 4 (Refined)').base === c('The Plane of Hate - Solo 4 (Refined)').base,
    'y también la misma que la forma con modo');

  /**
   * PERO SÓLO CUANDO COINCIDE CON LA ETIQUETA. De dígitos sin etiqueta no hay
   * ni un caso en el corpus, así que no se legisla sobre lo que no se ha visto:
   * se dejan donde están.
   */
  ok(c('The Ruins of Old Guk 2').diff === 0,
    'sin etiqueta, un número suelto NO es una dificultad: el silencio es D0',
    String(c('The Ruins of Old Guk 2').diff));
  ok(c('The Ruins of Old Guk 2').base === 'The Ruins of Old Guk 2',
    'y sin etiqueta el dígito se queda: no hay medida que diga otra cosa');
  ok(c('The Ruins of Old Guk 3 (Adaptive)').base === 'The Ruins of Old Guk 3',
    'y si el dígito NO coincide con la etiqueta, tampoco sale',
    c('The Ruins of Old Guk 3 (Adaptive)').base);

  // Esta afirmación estaba al revés, y estaba bien estarlo: sin medida, decir
  // que «- Solo» a secas era D0 habría sido inventar. Lo que cambió no es el
  // criterio, es que ahora hay medida.
  //
  // Mismo enemigo, misma zona y mismo modo, la vida de estas instancias está un
  // peldaño ENTERO por debajo de D1 —mediana 0,873 sobre once enemigos, nueve
  // entre 0,86 y 0,88— y ese peldaño mide lo mismo que el de D1 a D2 (0,853) y
  // el de D2 a D3 (0,884). No cae en medio de nada: es el escalón de abajo, y
  // la base no lleva etiqueta porque `DIFICULTADES[0]` es `null`.
  //
  ok(c('The Ruins of Old Paineel - Solo').diff === 0,
    'un modo declarado sin número es la dificultad base, D0');
  ok(c('The Ruins of Old Paineel - Solo').mode === 'Solo', 'y el modo consta');

  // ── EL SILENCIO ES D0, y esto lo corrige quien estuvo allí ───────────────
  //
  // Aquí se afirmaba que un nombre limpio es mundo abierto y que ahí no hay
  // dificultad que medir. No: en EQL, que el registro no diga nada de
  // dificultad significa dificultad 0, sea mundo abierto o una instancia.
  //
  // El registro lo enseña sin ambigüedad — tres líneas seguidas de una
  // instancia recién creada, y ninguna trae dificultad:
  //
  //     Player Campeon creating instance The Plane of Sky 25.
  //     The Plane of Sky is now available to you.
  //     You have entered The Plane of Sky.
  //
  // Con la regla anterior se quedaban sin asignar 84 de 410 peleas guardadas
  // —el 20,5%— y 70 de ellas eran esta misma zona.
  ok(c('The Plane of Sky').diff === 0, 'una zona sin modo ni etiqueta es D0',
    String(c('The Plane of Sky').diff));
  ok(c('The Plane of Sky').base === 'The Plane of Sky', 'y la base es el nombre entero');
  ok(c('East Freeport').diff === 0, 'el mundo abierto también es D0');

  // Lo único que sigue siendo «no se sabe»: no saber ni dónde estabas. Eso no
  // llega por aquí con un nombre, llega sin él.
  ok(c(null).diff === null, 'sin zona no hay dificultad que deducir');
  ok(labelDiff(3, 'Fused') === 'D3 Fused' && labelDiff(null, null) === null, 'la etiqueta corta');
}

// ── 2. Una subárea no es un cambio de zona ───────────────────────────────
console.log('\nsubáreas');
{
  const p = new Parser({ self: 'Campeon' });
  const zona = p.parse(`${stamp(0)} You have entered The Plane of Sky.`);
  const sub = p.parse(`${stamp(1)} You have entered an area where levitation effects do not function.`);
  ok(zona.kind === 'zone' && zona.zone === 'The Plane of Sky', 'una zona es una zona');
  ok(sub.kind === 'subarea', 'y una frase en minúscula es una subárea', sub.kind);
  ok(p.zone === 'The Plane of Sky', 'la subárea NO machaca la zona del parser', p.zone);

  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  tr.feed(zona); tr.feed(sub);
  ok(tr.zone === 'The Plane of Sky', 'ni la del agregador', tr.zone);
}

// ── 3. Nivel y clases, guardados en la pelea ─────────────────────────────
console.log('\nnivel de la pelea');
{
  const correr = (guion) => {
    const p = new Parser({ self: 'Campeon' });
    const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
    const e = new Engine();
    e.self = 'Campeon'; e.parser = p; e.tracker = tr;
    for (const [s, l] of guion) {
      const ev = p.parse(`${stamp(s)} ${l}`);
      if (ev?.kind === 'who' && ev.who === 'Campeon') { tr.level = ev.level; tr.classes = ev.classes; }
      if (ev?.kind === 'levelup') tr.level = ev.level;
      tr.feed(ev);
    }
    return e.snapshot().current;
  };

  // Sin ningún hito antes: no se sabe, y no se inventa.
  const sinNivel = correr([[0, 'You slash a gorgon for 100 points of damage.']]);
  ok(sinNivel.level === null, 'una pelea antes del primer /who no tiene nivel', String(sinNivel.level));

  // Con /who antes: nivel y clases de ese momento.
  const con = correr([
    [0, '[50 SHD/DRU/MAG] Campeon (Iksar) <Spain> ZONE: The Plane of Sky (airplane)'],
    [1, 'You slash a gorgon for 100 points of damage.'],
  ]);
  ok(con.level === 50, 'con /who antes, la pelea guarda el nivel', String(con.level));
  ok(con.classesAt?.join('/') === 'SHD/DRU/MAG', 'y las clases de entonces', con.classesAt?.join('/'));

  // Y la subida de nivel también cuenta como hito.
  const subida = correr([
    [0, '[50 SHD/DRU/MAG] Campeon (Iksar) <Spain> ZONE: The Plane of Sky (airplane)'],
    [1, 'You have gained a level! Welcome to level 25!'],
    [2, 'You slash a gorgon for 100 points of damage.'],
  ]);
  ok(subida.level === 25, 'una subida de nivel actualiza el nivel', String(subida.level));
  ok(subida.classesAt?.join('/') === 'SHD/DRU/MAG', 'y no toca las clases, que no las dice');
}

// ── 4. El /who con AFK y sin él ──────────────────────────────────────────
console.log('\nlectura del /who');
{
  const p = new Parser({ self: 'Campeon' });
  const normal = p.parse(`${stamp(0)} [50 SHD/DRU/MAG] Campeon (Iksar) <Spain> ZONE: New Sebilis Expedition (newsebexp)`);
  ok(normal?.kind === 'who' && normal.level === 50, 'un /who normal se lee');
  ok(normal.race === 'Iksar' && normal.guild === 'Spain', 'con raza y hermandad', `${normal.race} · ${normal.guild}`);
  // Ésta se perdía: el prefijo AFK lleva un espacio delante y el patrón anclaba en ^\[
  const afk = p.parse(`${stamp(1)}  AFK [35 WAR/SHM/NEC] Thalix (Iksar)  ZONE: New Sebilis Expedition (newsebexp)`);
  ok(afk?.kind === 'who' && afk.who === 'Thalix', 'y el de alguien ausente también', afk?.who);
  ok(afk?.classes.join('/') === 'WAR/SHM/NEC', 'con sus clases', afk?.classes.join('/'));
}

// ── 5. class_change fuera; scribe como dato ──────────────────────────────
console.log('\ncambio de clase');
{
  const p = new Parser({ self: 'Campeon' });
  // No existe mensaje de cambio de clase: en 63.000 líneas reales, cero.
  ok(p.parse(`${stamp(0)} You are now an elemental.`)?.kind !== 'class_change',
    'no se inventa un cambio de clase donde no lo hay');
  ok(p.parse(`${stamp(1)} You are now A.F.K. (Away From Keyboard).`)?.kind !== 'class_change',
    'ni con el aviso de ausencia');
  // Lo que sí deja huella es escribir el libro de la clase nueva.
  const sc = p.parse(`${stamp(2)} You have finished scribing Togor's Insects.`);
  ok(sc?.kind === 'scribe' && sc.ability === "Togor's Insects",
    'escribir un hechizo se reconoce, como dato', `${sc?.kind}/${sc?.ability}`);
}

// ── 6. El expediente, separado por dificultad y avisando del nivel ───────
console.log('\nexpediente por dificultad');
{
  const pelea = (diff, tag, level, vida, maxHit, hab) => ({
    duration: 40, total: vida, kills: ['Magus Rokyl'], losses: [], loot: [], spellVsFoe: [],
    diff, diffTag: tag, level, hpSamples: { 'Magus Rokyl': [vida] },
    rows: [
      { name: 'Campeon', side: 'ally', damage: vida, taken: 0, healingDone: 0, hits: 10,
        meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 100,
        activeSec: 40, types: [], abilities: [], targets: [{ name: 'Magus Rokyl', sum: vida }], takenBySource: [] },
      { name: 'Magus Rokyl', side: 'enemy', damage: 3000, taken: vida, healingDone: 0, hits: 20,
        meleeHits: 20, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: maxHit,
        activeSec: 40, types: [], abilities: hab.map((h) => ({ name: h, type: 'magic', sum: 100, n: 1, max: 100 })),
        targets: [], takenBySource: [] },
    ],
  });
  // Las cifras son las medidas de verdad en el log: D2 14.688, D3 23.295.
  const ag = aggregate([
    pelea(2, 'Adaptive', 50, 14688, 204, ['hits']),
    pelea(3, 'Fused', 50, 23295, 744, ['hits', 'Ice Comet', 'Force']),
  ], 'Campeon');
  const rokyl = ag.foes.find((f) => f.name === 'Magus Rokyl');

  ok(rokyl.dificultades.length === 2, 'salen dos fichas, una por dificultad');
  const d2 = rokyl.dificultades.find((d) => d.diff === 2);
  const d3 = rokyl.dificultades.find((d) => d.diff === 3);
  ok(d2.hp.avg === 14688 && d3.hp.avg === 23295,
    'cada una con su vida, sin promediar', `${d2.hp.avg} y ${d3.hp.avg}`);
  ok(rokyl.hp.avg === 18992,
    'la cifra conjunta sigue ahí y sigue sin describir a ninguno', String(rokyl.hp.avg));
  ok(d2.maxHit === 204 && d3.maxHit === 744, 'y su golpe máximo');
  ok(d3.abilities.some((a) => a.name === 'Ice Comet') && !d2.abilities.some((a) => a.name === 'Ice Comet'),
    'los hechizos que sólo tiene en D3 no se le atribuyen en D2');
  ok(rokyl.levels.join(',') === '50', 'se anota con qué niveles has peleado');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
