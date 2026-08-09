/**
 * LA GUARDA DEL FORMATO: si cambia lo que se guarda, `STORE_VERSION` tiene que
 * moverse — y si no se mueve, esto revienta.
 *
 * DE DÓNDE SALE. Entre la 1.6.1 y la 1.9.2, trece versiones, `STORE_VERSION` se
 * quedó clavado en 5 mientras el parser y las cuentas cambiaban seis veces. El
 * aviso de reconstruir se dispara con `generacion(meta) < STORE_VERSION` y con
 * nada más, así que no salió ni una sola vez. Seis de esas versiones lo pedían
 * POR ESCRITO en sus notas —«RECONSTRUYE EL HISTÓRICO», en mayúsculas— y la
 * aplicación no lo pidió nunca. Quien leyó las notas y no vio el cartel
 * concluyó, razonablemente, que a él no le hacía falta.
 *
 * Ese fallo no se ve mirando el código: cada cambio, por separado, era correcto.
 * Lo que faltaba era la relación entre dos ficheros que nadie mira a la vez.
 *
 * CÓMO FUNCIONA. Se pasa un guion fijo por el parser y el agregador, se cierra
 * la pelea, se serializa EXACTAMENTE lo que `FightStore` escribiría, y se le
 * saca una huella. Si la huella cambia:
 *
 *   · y `STORE_VERSION` NO se ha movido → falla. Lo guardado cambió en silencio.
 *   · y `STORE_VERSION` sí se ha movido → pasa, y pide anotar la huella nueva.
 *
 * QUÉ HACER CUANDO FALLE, que es lo que importa a las tres de la mañana:
 *
 *   a) Si el cambio afecta a peleas ya guardadas —se cuenta distinto, se guarda
 *      un campo nuevo, se corrige un daño que se tiraba— sube `STORE_VERSION`,
 *      reescribe `mig.body` en los cinco idiomas y anota la huella nueva.
 *   b) Si de verdad no afecta a lo guardado, anota la huella y ya. Pero léelo
 *      dos veces: la huella sale de lo que se escribe al disco.
 *
 * Las claves se ordenan antes de la huella: reordenar un objeto no cambia lo
 * que se guarda, y una guarda que salta por eso se desactiva a la tercera.
 */
import crypto from 'node:crypto';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { STORE_VERSION } from '../src/store.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const stamp = (s) => {
  const d = new Date(2026, 7, 4, 21, 0, 0);
  d.setSeconds(d.getSeconds() + s);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

/**
 * El guion. Toca a propósito lo que cambió en las versiones que no avisaron:
 * golpes normales y críticos, «smites» y «shoots» (1.8.1), daño de un compañero
 * (1.9.2), curación, un fallo, daño recibido, autolesión (1.10.0), una muerte
 * y una mascota. Si mañana se cambia cualquiera de esas cuentas, la huella se
 * mueve.
 */
const GUION = [
  [0, 'You slash a zol ghoul knight for 25 points of damage.'],
  [1, 'You crush a zol ghoul knight for 61 points of damage. (Critical)'],
  [2, 'You smite a zol ghoul knight for 40 points of damage.'],
  [3, 'You shoot a zol ghoul knight for 18 points of damage.'],
  [4, 'You try to slash a zol ghoul knight, but miss!'],
  [5, 'Kalforgelp hits a zol ghoul knight for 33 points of damage.'],
  [6, 'Jonarn bites a zol ghoul knight for 12 points of damage.'],
  [7, 'A zol ghoul knight hits YOU for 47 points of damage.'],
  [8, 'A zol ghoul knight tries to hit YOU, but YOU parry!'],
  [9, 'You have healed Kalforgelp for 30 points of damage.'],
  [10, 'You hurt yourself for 9 points.'],
  [11, 'You have slain a zol ghoul knight!'],
];

function pelea() {
  const parser = new Parser({ self: 'Campeon' });
  const tracker = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  tracker.petNames = new Set(['Jonarn']);
  const engine = new Engine();
  engine.self = 'Campeon';
  engine.parser = parser;
  engine.tracker = tracker;
  for (const [s, l] of GUION) tracker.feed(parser.parse(`${stamp(s)} ${l}`));
  return engine.snapshot().current;
}

/** Ordena claves a cualquier profundidad, y deja Map y Set en algo estable. */
function estable(x) {
  if (x instanceof Map) return { '#map': [...x.entries()].map(([k, v]) => [k, estable(v)]).sort() };
  if (x instanceof Set) return { '#set': [...x].map(estable).sort() };
  if (Array.isArray(x)) return x.map(estable);
  if (x && typeof x === 'object') {
    const out = {};
    for (const k of Object.keys(x).sort()) out[k] = estable(x[k]);
    return out;
  }
  // Los instantes absolutos cambian en cada ejecución y no son formato.
  return x;
}

/**
 * La huella anotada, y con qué `STORE_VERSION` se anotó.
 *
 * Se anota A MANO, y a propósito: que haya que escribirla es lo que obliga a
 * pararse a pensar si lo guardado cambió. Una guarda que se actualiza sola no
 * guarda nada.
 */
/**
 * HAY UNA TERCERA RAMA, Y ÉSTA ES LA PRIMERA VEZ QUE SE USA. Léela antes de
 * copiarla, porque es la que puede desactivar esta guarda si se abusa de ella.
 *
 * El cartel de arriba plantea dos salidas: o el cambio afecta a lo ya guardado
 * y se sube `STORE_VERSION`, o no lo afecta y se anota la huella. El modelo de
 * medición cae en medio: SÍ afecta a lo ya guardado —las peleas viejas tienen
 * daño recibido reconstruido de más— pero NO hace falta que nadie relea su
 * registro, porque el importe observado está guardado al lado del reconstruido
 * y la corrección es una copia exacta que se hace al leer.
 *
 * Y eso es literalmente la condición que `STORE_VERSION` documenta para NO
 * subir: «se sube cuando lo guardado es incorrecto y no se puede arreglar
 * leyéndolo mejor». Aquí se puede. Subirlo pediría a todo el mundo una
 * reconstrucción de media hora para llegar exactamente al mismo sitio.
 *
 * LO QUE NO SE PUEDE HACER ES DEJARLO MUDO, y por eso el arreglo trae su propia
 * marca: cada pelea lleva `modelo`, un número que dice con qué reglas están
 * calculadas SUS cifras. `STORE_VERSION` no podía hacer ese trabajo porque
 * marca el almacén entero, y aquí conviven peleas nacidas con el modelo nuevo,
 * peleas viejas corregidas al leerlas y peleas que no se pudieron corregir.
 *
 * REGLA PARA LA PRÓXIMA VEZ: esta rama sólo vale si el arreglo es EXACTO sobre
 * lo guardado —no aproximado, no «casi»— y si queda una marca por pelea que
 * distinga lo corregido de lo que nació bien. Si falta cualquiera de las dos,
 * es la rama (a) y hay que subir la versión.
 *
 * SEGUNDA VEZ QUE SE USA (modelo 3), Y AQUÍ HAY UN MOTIVO EXTRA PARA NO SUBIR.
 *
 * El reparto del daño por postura NO se puede sacar de lo guardado: hay que
 * releer el registro. Eso lo acercaría a la rama (a) — «sube la versión y que
 * la gente reconstruya»— si no fuera por lo que sabemos desde el 9 de agosto de
 * 2026: `store:rebuild` NO reproduce el histórico. El cierre de pelea usa el
 * reloj de pared en directo y la marca del registro al reconstruir, así que con
 * un hueco de exactamente `idleSec` cada camino parte la pelea de una manera
 * (ver el comentario de `tick()` en `src/encounter.js`).
 *
 * Subir `STORE_VERSION` es exactamente lo que dispara el cartel de reconstruir.
 * Hacerlo hoy sería empujar a todo el mundo a una operación que puede fundir o
 * partir peleas de su histórico sin avisar. NO SE SUBE HASTA QUE ESA TAREA ESTÉ
 * HECHA. Mientras tanto, lo que se puede recalcular se recalcula pelea a pelea
 * comprobando que lo reconstruido coincide con lo guardado, y lo que no, se
 * queda marcado con su modelo y su motivo.
 *
 *   c4045f1d3fbe44fc  hasta el modelo 1
 *   a45eade630168e50  modelo 2: `dot` y `ds` fuera de la reversión, toda
 *                     reconstrucción redondeada al reconstruirla, y el campo
 *                     `modelo` en cada pelea.
 *   f59a4a958ff7278b  modelo 3: el daño recibido se guarda partido por la
 *                     postura de cada golpe (`takenByStance`), y el veredicto
 *                     del consejo compara contra lo que evitaste tramo a tramo.
 *
 * (Y una anécdota que vale como aviso: la huella de este cambio se anotó una
 * vez de más. `takenByStance` se construía bien en el encuentro y se caía al
 * armar la pelea en `engine.js`, así que la primera huella describía un formato
 * con el campo vacío. Lo cazó la migración —431 peleas pasaron a 0 de golpe—,
 * no esta guarda: la huella detecta que algo cambió, no que sea correcto.)
 *
 *   17f6d0ffda79de90  modelo 4: la serie por segundo pasa de dos cubos de daño
 *                     recibido a tres. `tSpell` llevaba dentro el daño periódico
 *                     y el escudo, así que todo el que leyera la serie decidía
 *                     con un «mágico» que no lo era.
 */
const ANOTADO = {
  version: 6,
  huella: '17f6d0ffda79de90',
};

console.log('\nel formato de lo guardado');

const f = pelea();
// Lo mismo que `FightStore.append` escribe al disco, sin los instantes.
const { at, start, end, ...resto } = f;
const serie = JSON.stringify(estable(resto));
const huella = crypto.createHash('sha256').update(serie).digest('hex').slice(0, 16);

if (ANOTADO.huella === 'PENDIENTE') {
  console.log(`  --   primera anotación: pon huella '${huella}' con version ${STORE_VERSION}`);
} else if (huella === ANOTADO.huella) {
  ok(STORE_VERSION >= ANOTADO.version, 'lo guardado no ha cambiado y la versión no ha bajado',
    `v${STORE_VERSION}`);
} else if (STORE_VERSION > ANOTADO.version) {
  console.log(`  ok   lo guardado cambió Y STORE_VERSION subió a ${STORE_VERSION}`);
  console.log(`       anota la huella nueva: '${huella}'`);
} else {
  failed++;
  console.log(`  MAL  LO GUARDADO CAMBIÓ Y STORE_VERSION SIGUE EN ${STORE_VERSION}`);
  console.log(`       huella anotada ${ANOTADO.huella} → ahora ${huella}`);
  console.log('       Si esto afecta a peleas ya guardadas: sube STORE_VERSION,');
  console.log('       reescribe mig.body en los cinco idiomas y anota la huella.');
  console.log('       Si de verdad no las afecta: anota la huella y ya.');
  console.log('       Entre la 1.6.1 y la 1.9.2 esto pasó seis veces sin que nadie lo viera,');
  console.log('       y seis versiones pedían reconstruir por escrito sin que saliera el cartel.');
}

// Y que la pelea de referencia siga midiendo lo que dice medir: si el guion
// dejara de producir daño, la huella sería estable por vacía.
ok(f.total > 0, 'el guion de referencia produce una pelea con daño', f.total);
ok((f.rows ?? []).length >= 2, 'y con más de un combatiente', (f.rows ?? []).length);

console.log(failed ? `\n${failed} mal\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
