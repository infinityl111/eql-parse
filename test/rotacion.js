/**
 * ROTAR EL LOG: lo que ya estaba guardado no se toca, ni se pierde, ni se dobla.
 *
 * ── POR QUÉ EXISTE ESTA BATERÍA ───────────────────────────────────────────
 *
 * Miguel se plantea renombrar el registro cuando crezca y empezar otro. Al
 * ritmo medido —6,2 MB y 79.349 líneas por día de juego, 12 días de juego en el
 * fichero de hoy— eso son 1,1 GB a seis meses y 2,3 GB al año, así que la
 * pregunta no es si va a rotar: es qué hace el código el día que lo haga.
 *
 * Y el camino de la rotación es el que más silenciosamente puede mentir. La
 * incidencia #9 del competidor sowoky es exactamente éste: cuando el fichero
 * encoge reinician el desplazamiento a cero alegando que una marca de agua
 * impide recontar, pero los bytes releídos entran por el camino en vivo, que
 * lleva esa marca DESACTIVADA. El invariante no se cumple justo en el camino
 * que lo cita, y a ellos les duplica las muertes.
 *
 * ── LOS DOS CAMINOS, Y EL QUE ESTABA MAL ─────────────────────────────────
 *
 * EN MARCHA — `LogTailer.#poll`. Si el tamaño es menor que el desplazamiento, o
 *   cambia la firma inodo:nacimiento, se pone el desplazamiento a 0 y se emite
 *   `rotate`: se vuelve a plegar el fichero entero. Correcto, y lo era ya.
 *
 * AL ARRANCAR — `LogTailer.start`. Aquí había DOS ramas para TRES situaciones:
 *   `st.size` contestaba a la vez a «no hay marca» —donde es correcto, es un
 *   enganche nuevo y se escucha desde el final— y a «la marca se pasa del
 *   final», donde es exactamente la respuesta contraria a la buena. El mismo
 *   módulo contestaba lo opuesto a la misma pregunta según por dónde entraras.
 *
 *   Lo que costaba: rotar con el juego cerrado, jugar tres horas y abrir la
 *   aplicación = tres horas que no se leían NUNCA. Sin error, sin hueco, sin
 *   aviso. Lo fija el bloque 5, drilado en rojo: con el comportamiento viejo se
 *   leen 0 de 25 líneas.
 *
 * Y `rotate` no lo escuchaba NADIE —una sola aparición en todo el árbol, la que
 * lo emite—, o sea salida muerta, que es una de nuestras familias. Ahora lo
 * escucha `src/engine.js` y lo cuenta en `describe()`; el bloque 5 exige que el
 * aviso llegue, para que no vuelva a quedarse sin oyente.
 *
 * ── Y LO QUE SALVA LA SITUACIÓN, que es lo que esta batería fija ──────────
 *
 * Que el almacén NO se defiende por posición sino por IDENTIDAD LÓGICA:
 * `logicalKey = at:total:duration` (`src/store.js:45`), comprobada en `append`
 * (`src/store.js:1202`) y repoblada desde el índice al cargar
 * (`src/store.js:844`). El botín, las AA y los hechizos llevan su propio
 * conjunto de vistos, también repoblado desde disco.
 *
 * Por eso volver a plegar el mismo contenido no duplica nada. Esta batería lo
 * fija como propiedad, para que nadie cambie la identidad a algo posicional
 * —un desplazamiento, un número de línea, un contador de sesión— sin que se
 * ponga roja.
 *
 * ── ES UN ORÁCULO, NO UNA EXPECTATIVA ─────────────────────────────────────
 *
 * No se compara contra un número escrito a mano: se compara el estado del
 * almacén ANTES y DESPUÉS de la rotación, y lo que se exige es que la
 * diferencia sea EXACTAMENTE lo que aporta el fichero nuevo. Un número a mano
 * envejece con el fichero de prueba; un oráculo no.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FightStore } from '../src/store.js';

let failed = 0;
const ok = (cond, label, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${label}${extra !== undefined ? ` — ${extra}` : ''}`);
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eqlrot-'));

/** Una pelea con la forma mínima que el almacén necesita para resumirla. */
const pelea = (id, foe, dmg, dur = 40) => ({
  id, label: foe, zone: 'Lower Guk', duration: dur, total: dmg, raidDps: dmg / dur,
  enemyTotal: 0, enemyDps: 0, healing: 0, kills: [foe], losses: [], loot: [], spellVsFoe: [],
  rows: [
    { name: 'Campeon', side: 'ally', damage: dmg, taken: 0, healingDone: 0, hits: 10,
      meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 100,
      activeSec: dur, types: [['melee', dmg]], abilities: [], targets: [{ name: foe, sum: dmg }],
      takenBySource: [] },
    { name: foe, side: 'enemy', damage: 0, taken: dmg, healingDone: 0, hits: 0, meleeHits: 0,
      misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 0, activeSec: dur,
      types: [], abilities: [], targets: [], takenBySource: [] },
  ],
});

/**
 * EL ESTADO OBSERVABLE DEL ALMACÉN, para comparar dos momentos.
 *
 * Lleva los recuentos y además la lista de identidades, porque «siguen siendo
 * 8» y «siguen siendo LAS MISMAS 8» son afirmaciones distintas: la primera la
 * cumple un almacén que ha perdido cuatro y ganado otras cuatro.
 */
const foto = (s) => ({
  peleas: s.index.length,
  // `kills` en el resumen es la LISTA de nombres abatidos, no un número
  // (`src/store.js`, `FightStore.summary`). Sumarla con `+` da una cadena, y una
  // cadena comparada con otra cadena pasa la prueba sin medir nada: el primer
  // intento de esta batería imprimía «0bicho 7bicho 6…» y se daba por bueno.
  muertes: s.index.reduce((a, x) => a + (Array.isArray(x.kills) ? x.kills.length : 0), 0),
  botin: (() => {
    try { return fs.readFileSync(path.join(s.dir, 'loot.ndjson'), 'utf8').split('\n').filter((l) => l.trim()).length; } catch { return 0; }
  })(),
  identidades: s.index.map((x) => `${x.at}:${x.total ?? 0}:${x.duration ?? 0}`).sort(),
});

const mismas = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ═══ 1. El log se rota y la aplicación vuelve a plegar el fichero VIEJO ═══
//
// Es el camino de `#poll`: desplazamiento a 0 y a releer. Si la identidad fuera
// posicional, aquí se doblaría todo.
console.log('\nreplegar lo ya guardado no lo duplica');
{
  const dir = tmp();
  const s1 = new FightStore(dir);
  s1.load();
  const T = 1_700_000_000_000;
  for (let i = 0; i < 8; i++) s1.append(pelea(i + 1, `bicho ${i}`, 1000 + i * 10), T + i * 60_000);
  // Botín suelto, que se deduplica por su propia clave (hora, objeto, cadáver)
  // y no por la identidad de una pelea: es otro camino y hay que probarlo.
  for (let i = 0; i < 4; i++) s1.appendLoot({ t: 1_700_000_000 + i, item: `objeto ${i}`, from: 'un cadáver' });
  const antes = foto(s1);
  ok(antes.peleas === 8, 'ocho peleas guardadas', antes.peleas);

  // La rotación: la aplicación arranca de cero y vuelve a leer lo mismo. La
  // numeración de la sesión empieza otra vez por 1, como en la vida real.
  const s2 = new FightStore(dir);
  s2.load();
  for (let i = 0; i < 8; i++) s2.append(pelea(i + 1, `bicho ${i}`, 1000 + i * 10), T + i * 60_000);
  for (let i = 0; i < 4; i++) s2.appendLoot({ t: 1_700_000_000 + i, item: `objeto ${i}`, from: 'un cadáver' });
  const despues = foto(s2);

  ok(despues.peleas === antes.peleas, 'el recuento no cambia', `${antes.peleas} -> ${despues.peleas}`);
  ok(mismas(antes.identidades, despues.identidades), 'y son LAS MISMAS, no otras tantas');
  // Sin esta línea, la de abajo pasaría con 0 === 0 y no probaría nada: es el
  // mismo fallo que ya cazamos una vez —un test en verde que no probaba el caso.
  ok(antes.muertes === 8, 'y hay ocho muertes que doblar, no cero', antes.muertes);
  ok(despues.muertes === antes.muertes, 'las muertes tampoco se doblan', `${antes.muertes} -> ${despues.muertes}`);
  ok(antes.botin > 0 && despues.botin === antes.botin,
    'y el botín tampoco', `${antes.botin} -> ${despues.botin}`);
}

// ═══ 2. El fichero nuevo aporta, y sólo aporta lo suyo ════════════════════
console.log('\ntras rotar, el fichero nuevo suma lo suyo y nada más');
{
  const dir = tmp();
  const s1 = new FightStore(dir);
  s1.load();
  const T = 1_700_000_000_000;
  for (let i = 0; i < 8; i++) s1.append(pelea(i + 1, `bicho ${i}`, 1000 + i * 10), T + i * 60_000);
  const antes = foto(s1);

  // Se rota: fichero nuevo y corto, con 3 peleas que no estaban.
  const s2 = new FightStore(dir);
  s2.load();
  ok(s2.index.length === antes.peleas, 'al recargar del disco está todo lo de antes', s2.index.length);
  const NUEVAS = 3;
  for (let i = 0; i < NUEVAS; i++) s2.append(pelea(i + 1, `bicho nuevo ${i}`, 5000 + i), T + 86_400_000 + i * 60_000);
  const despues = foto(s2);

  ok(despues.peleas === antes.peleas + NUEVAS,
    'el almacén crece EXACTAMENTE en lo que trae el fichero nuevo',
    `${antes.peleas} + ${NUEVAS} = ${despues.peleas}`);
  // Y las viejas siguen ahí, una a una: crecer no puede ser reemplazar.
  const sobreviven = antes.identidades.filter((k) => despues.identidades.includes(k));
  ok(sobreviven.length === antes.identidades.length,
    'y ninguna de las viejas se ha caído por el camino',
    `${sobreviven.length}/${antes.identidades.length}`);
}

// ═══ 3. La identidad NO puede depender de la posición ═════════════════════
//
// La guarda de verdad. Si alguien cambia `logicalKey` por algo posicional
// —el byte, el número de línea, el id de sesión— las dos comprobaciones de
// arriba seguirían pasando mientras el fichero de prueba no cambie, porque los
// bytes salen iguales. Ésta no: aquí la MISMA pelea se guarda desde un almacén
// que ya tiene otras cosas escritas delante, así que su byte de inicio es
// distinto y su identidad tiene que seguir siendo la misma.
console.log('\nla identidad es lógica, no el sitio donde cayó');
{
  const dir = tmp();
  const s = new FightStore(dir);
  s.load();
  const T = 1_700_000_000_000;
  // Primero, relleno: mueve el byte de inicio de todo lo que venga detrás.
  for (let i = 0; i < 5; i++) s.append(pelea(100 + i, `relleno ${i}`, 400 + i), T - 500_000 + i * 1000);
  const marcada = s.append(pelea(1, 'a shin ghoul knight', 12345, 77), T);
  ok(!!marcada, 'la pelea entra');
  const uidPrimero = marcada.uid;

  // Y ahora la misma pelea otra vez, con el fichero ya más largo.
  const otra = s.append(pelea(1, 'a shin ghoul knight', 12345, 77), T);
  ok(otra.uid === uidPrimero,
    'la misma pelea devuelve la MISMA identidad aunque el fichero haya crecido',
    `${uidPrimero} vs ${otra.uid}`);
  ok(s.index.filter((x) => x.label === 'a shin ghoul knight').length === 1,
    'y en el índice sigue habiendo una sola');
}

// ═══ 4. Un fichero nuevo MÁS CORTO no borra el histórico ═════════════════
//
// El miedo concreto de Miguel: renombrar `eqlog_Campeon_erudin.txt` y empezar
// otro deja un fichero de unos pocos kilobytes donde había 74 MB. Lo que no
// puede pasar es que el almacén se encoja con él.
console.log('\nun fichero nuevo y corto no encoge el almacén');
{
  const dir = tmp();
  const s1 = new FightStore(dir);
  s1.load();
  const T = 1_700_000_000_000;
  for (let i = 0; i < 20; i++) s1.append(pelea(i + 1, `bicho ${i}`, 1000 + i), T + i * 60_000);
  const antes = foto(s1);

  // Rotación: el almacén se vuelve a abrir contra un log de una sola pelea.
  const s2 = new FightStore(dir);
  s2.load();
  s2.append(pelea(1, 'el primero del log nuevo', 999), T + 172_800_000);
  const despues = foto(s2);

  ok(despues.peleas === antes.peleas + 1, 'las 20 de antes siguen y se suma la nueva', despues.peleas);
  ok(mismas(antes.identidades, despues.identidades.filter((k) => antes.identidades.includes(k))),
    'las 20 viejas están enteras y sin cambiar');
}

// ═══ 5. ROTADO CON LA APLICACIÓN CERRADA: lo del fichero nuevo ENTRA ══════
//
// Éste es el caso con fecha, y es el que fallaba. `LogTailer.start` tenía DOS
// ramas para TRES situaciones: `st.size` respondía a la vez a «no hay marca»
// —donde es correcto: enganche nuevo, se escucha desde el final— y a «la marca
// se pasa del final» —donde es la respuesta contraria a la buena—.
//
// La secuencia de Miguel: rota el log con el juego cerrado, juega tres horas,
// abre EQL Parse. La marca dice 77.841.561 y el fichero nuevo mide unos megas,
// así que el lector se plantaba AL FINAL y esas tres horas no se leían nunca.
// Sin error, sin hueco, sin aviso.
//
// Aquí se comprueba lo único que importa: QUE ESE CONTENIDO ENTRA.
console.log('\nrotado con la aplicación cerrada, lo escrito antes de abrir se lee');
{
  const { LogTailer } = await import('../src/tailer.js');
  const dir = tmp();
  const log = path.join(dir, 'eqlog_Campeon_erudin.txt');

  // El fichero viejo, grande, y la marca donde se quedó la sesión anterior.
  const viejo = Array.from({ length: 400 }, (_, i) => `[Tue Aug 11 10:00:00 2026] linea vieja ${i}`).join('\n');
  fs.writeFileSync(log, `${viejo}\n`);
  const marca = fs.statSync(log).size;

  // Rotación: el fichero se sustituye por uno nuevo y corto, con contenido YA
  // escrito — las tres horas que Miguel jugó antes de abrir la aplicación.
  const nuevas = Array.from({ length: 25 }, (_, i) => `[Wed Aug 12 21:00:00 2026] linea nueva ${i}`);
  fs.writeFileSync(log, `${nuevas.join('\n')}\n`);
  ok(fs.statSync(log).size < marca, 'el fichero nuevo es más corto que la marca guardada');

  const leidas = [];
  let avisos = 0;
  const t = new LogTailer(log, { pollMs: 10, startOffset: marca });
  t.on('line', (l) => leidas.push(l));
  t.on('rotate', () => { avisos++; });
  await t.start();
  await new Promise((r) => setTimeout(r, 250));
  t.stop();

  ok(leidas.length === nuevas.length,
    'se leen TODAS las líneas del fichero nuevo, no cero',
    `${leidas.length} de ${nuevas.length}`);
  ok(leidas[0] === nuevas[0], 'y desde la primera, no desde donde apuntaba la marca vieja');
  // `rotate` existía desde el primer día y no lo escuchaba nadie: salida muerta.
  // Que esta línea exija un oyente es lo que impide que vuelva a serlo.
  ok(avisos === 1, 'y se avisa exactamente una vez de que el registro se reinició', avisos);
}

// ═══ 6. Y el caso que NO debe cambiar: marca válida, se reanuda ═══════════
//
// La guarda de la guarda. Si alguien «arregla» lo de arriba poniendo el
// desplazamiento a 0 siempre, esta comprobación se pone roja: reanudar es lo
// normal y releer el registro entero en cada arranque costaría 25,5 s medidos.
console.log('\ny con una marca válida se sigue reanudando, no releyendo');
{
  const { LogTailer } = await import('../src/tailer.js');
  const dir = tmp();
  const log = path.join(dir, 'eqlog_Campeon_erudin.txt');
  const viejas = Array.from({ length: 30 }, (_, i) => `[Tue Aug 11 10:00:00 2026] vieja ${i}`);
  fs.writeFileSync(log, `${viejas.join('\n')}\n`);
  const marca = fs.statSync(log).size;
  const nuevas = Array.from({ length: 5 }, (_, i) => `[Tue Aug 11 10:05:00 2026] nueva ${i}`);
  fs.appendFileSync(log, `${nuevas.join('\n')}\n`);

  const leidas = [];
  let avisos = 0;
  const t = new LogTailer(log, { pollMs: 10, startOffset: marca });
  t.on('line', (l) => leidas.push(l));
  t.on('rotate', () => { avisos++; });
  await t.start();
  await new Promise((r) => setTimeout(r, 250));
  t.stop();

  ok(leidas.length === nuevas.length, 'sólo se lee lo escrito después de la marca', `${leidas.length} de ${nuevas.length}`);
  ok(avisos === 0, 'y no se avisa de ninguna rotación que no ha ocurrido', avisos);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
