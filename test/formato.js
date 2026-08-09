/**
 * LA GUARDA DEL FORMATO: si cambia lo que se guarda, `FORMATO_VERSION` sube. Sin
 * excepciones, sin ramas de escape y sin criterio que aplicar.
 *
 * DE DÓNDE SALE. Entre la 1.6.1 y la 1.9.2, trece versiones, el número se quedó
 * clavado en 5 mientras el parser y las cuentas cambiaban seis veces. Seis de
 * esas versiones pedían reconstruir POR ESCRITO en sus notas —cuatro en
 * mayúsculas— y la aplicación no lo pidió nunca. Quien leyó las notas y no vio
 * el cartel concluyó, razonablemente, que a él no le hacía falta.
 *
 * POR QUÉ ESTA GUARDA TUVO UNA ESCAPATORIA HASTA LA 1.11.0, Y POR QUÉ YA NO.
 *
 * El número significaba dos cosas a la vez —«el formato cambió» y «hay que
 * reconstruir»— porque hasta entonces las dos respuestas siempre habían
 * coincidido. Con una sola perilla, decir «cambió el formato pero no
 * reconstruyas» exigía NO subirla, y entonces esta prueba había que
 * silenciarla. La escapatoria existía porque el modelo la obligaba, no porque
 * fuera buena idea.
 *
 * Separados los dos conceptos en `store.js` —`FORMATO_VERSION` y
 * `RECONSTRUIR_DESDE`— la escapatoria deja de hacer falta: se sube el formato
 * siempre y el cartel de reconstruir se decide por su cuenta. Así que esta
 * prueba pasa a ser incondicional. Si vuelves a necesitar una excepción, el
 * fallo está en el modelo de constantes, no aquí.
 *
 * CÓMO FUNCIONA. Se pasa un guion fijo por el parser y el agregador, se cierra
 * la pelea, se serializa EXACTAMENTE lo que `FightStore` escribiría, y se le
 * saca una huella. Si la huella cambia y el número no ha subido, falla.
 *
 * QUÉ HACER CUANDO FALLE, que es lo que importa a las tres de la mañana:
 * sube `FORMATO_VERSION`, anota la huella nueva con su número, y decide APARTE
 * —mirando `RECONSTRUIR_DESDE`— si además hay que pedir una reconstrucción.
 * Son dos decisiones y ahora se toman por separado.
 *
 * Las claves se ordenan antes de la huella: reordenar un objeto no cambia lo
 * que se guarda, y una guarda que salta por eso se desactiva a la tercera.
 */
import crypto from 'node:crypto';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { FORMATO_VERSION, RECONSTRUIR_DESDE, FightStore } from '../src/store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
 * La huella anotada, y con qué `FORMATO_VERSION` se anotó.
 *
 * Se anota A MANO, y a propósito: que haya que escribirla es lo que obliga a
 * pararse a pensar si lo guardado cambió. Una guarda que se actualiza sola no
 * guarda nada.
 *
 *   c4045f1d3fbe44fc  v6  hasta el modelo de medición 1
 *   17f6d0ffda79de90  v6  modelos 2, 3 y 4, anotados sin subir el número porque
 *                         el número todavía significaba dos cosas. Quedan aquí
 *                         como rastro de lo que hubo, no como precedente.
 *   17f6d0ffda79de90  v7  la 1.11.0. MISMA huella y número distinto, y no es un
 *                         error: el formato ya había cambiado —`dot` y `ds`
 *                         fuera de la reversión, el redondeo al reconstruir, el
 *                         daño partido por postura, la serie de dos cubos a
 *                         tres, el campo `modelo`— y lo que faltaba era
 *                         numerarlo. Ésta es la anotación que salda esa deuda.
 */
const ANOTADO = {
  version: 7,
  huella: '17f6d0ffda79de90',
};

console.log('\nel formato de lo guardado');

const f = pelea();
// Lo mismo que `FightStore.append` escribe al disco, sin los instantes.
const { at, start, end, ...resto } = f;
const serie = JSON.stringify(estable(resto));
const huella = crypto.createHash('sha256').update(serie).digest('hex').slice(0, 16);

if (ANOTADO.huella === 'PENDIENTE') {
  console.log(`  --   primera anotación: pon huella '${huella}' con version ${FORMATO_VERSION}`);
} else if (huella === ANOTADO.huella) {
  ok(FORMATO_VERSION >= ANOTADO.version, 'lo guardado no ha cambiado y la versión no ha bajado',
    `v${FORMATO_VERSION}`);
} else if (FORMATO_VERSION > ANOTADO.version) {
  console.log(`  ok   lo guardado cambió Y FORMATO_VERSION subió a ${FORMATO_VERSION}`);
  console.log(`       anota la huella nueva: '${huella}'`);
} else {
  failed++;
  console.log(`  MAL  LO GUARDADO CAMBIÓ Y FORMATO_VERSION SIGUE EN ${FORMATO_VERSION}`);
  console.log(`       huella anotada ${ANOTADO.huella} → ahora ${huella}`);
  console.log('       SUBE FORMATO_VERSION y anota la huella nueva con su número.');
  console.log('       No hay excepción que aplicar: cambió lo que se escribe, sube.');
  console.log('       Y decide APARTE, mirando RECONSTRUIR_DESDE, si además hay que');
  console.log('       pedir una reconstrucción. Son dos decisiones distintas desde la 1.11.0.');
  console.log('       Entre la 1.6.1 y la 1.9.2 esto pasó seis veces sin que nadie lo viera.');
}

// Y que la pelea de referencia siga midiendo lo que dice medir: si el guion
// dejara de producir daño, la huella sería estable por vacía.
ok(f.total > 0, 'el guion de referencia produce una pelea con daño', f.total);
ok((f.rows ?? []).length >= 2, 'y con más de un combatiente', (f.rows ?? []).length);

// -- Las dos preguntas, separadas y comprobadas ------------------------------
//
// Que existan dos constantes no sirve de nada si el cartel sigue colgado de la
// equivocada. Estas comprobaciones son el contrato de la 1.11.0: el formato
// sube, y aun asi NADIE ve el cartel de reconstruir por esta actualizacion.
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eqlver-'));
const conPeleas = (dir, n = 3) => {
  const st = new FightStore(dir, 'Campeon');
  for (let i = 1; i <= n; i++) {
    st.append({ id: i, label: 'a gorgon', duration: 10, total: 100, kills: [], losses: [],
      loot: [], spellVsFoe: [], start: 1000 + i,
      rows: [{ name: 'Campeon', side: 'ally', damage: 100 }] }, 1000000 + i);
  }
  return st;
};

console.log(`
el formato sube y el cartel de reconstruir no sale`);
{
  ok(FORMATO_VERSION > RECONSTRUIR_DESDE,
    'el formato va por delante de la condicion de reconstruir',
    `formato ${FORMATO_VERSION} / reconstruir por debajo de ${RECONSTRUIR_DESDE}`);

  const alDia = conPeleas(tmpDir());
  alDia.stamp(RECONSTRUIR_DESDE);
  alDia.load();
  ok(alDia.migration().needed === false,
    'con el almacen sellado en 6, esta actualizacion NO pide reconstruir',
    `sellado ${alDia.meta()?.version}`);

  const atrasado = conPeleas(tmpDir());
  atrasado.stamp(RECONSTRUIR_DESDE - 1);
  atrasado.load();
  ok(atrasado.migration().needed === true,
    'y quien no reconstruyo con la 1.10.0 lo sigue viendo');

  const vacio = new FightStore(tmpDir(), 'Campeon');
  vacio.load();
  ok(vacio.migration().needed === false, 'y un almacen vacio no pide nada');
}

console.log(`
el aviso de que las cifras cambian solas`);
{
  const viejo = conPeleas(tmpDir());
  viejo.stamp(RECONSTRUIR_DESDE);
  viejo.load();
  const a = viejo.avisoModelo();
  ok(a.needed === true, 'con peleas por debajo del formato de hoy, se avisa', `${a.fights} peleas`);
  ok(a.fights === 3 && a.desde === RECONSTRUIR_DESDE,
    'y se dice cuantas y desde que generacion');

  const nuevo = new FightStore(tmpDir(), 'Campeon');
  nuevo.load();
  ok(nuevo.avisoModelo().needed === false,
    'una instalacion sin historico NO ve el aviso');

  const puesto = conPeleas(tmpDir());
  puesto.stamp(FORMATO_VERSION);
  puesto.load();
  ok(puesto.avisoModelo().needed === false,
    'y un almacen ya sellado con el formato de hoy tampoco');
}

// -- Todo el que reconstruya, avisa ------------------------------------------
//
// EL FALLO QUE ESTO IMPIDE YA OCURRIO. El aviso de que reconstruir puede fundir
// o partir peleas en las fronteras de 20 s se escribio en el cartel de
// migracion —el camino raro— y falto en el de trios, que es el habitual: tiene
// su propio boton dentro de la pelea y se pulsa a menudo. Mismo `rebuildStore`,
// mismas consecuencias, y solo uno lo decia.
//
// Se comprueba por ENUMERACION sobre el fuente: se buscan TODAS las funciones
// que llaman a `rebuildStore(` y se exige que cada una traiga el aviso. Una
// tercera barra que aparezca manana queda cubierta sin que nadie se acuerde.
console.log(`
todo el que reconstruya, avisa`);
{
  const fuente = fs.readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');
  // Las funciones de este fichero se declaran a nivel superior y cierran con
  // una llave en la columna cero. Basta para trocearlo.
  // `async function` cuenta igual, y olvidarlo dejo esta prueba vacua un rato:
  // encontraba una sola funcion y la comprobacion pasaba sin comprobar nada.
  // Por eso hay tambien un minimo de dos.
  const CORTE = new RegExp(String.fromCharCode(10) + '(?:async )?function ');
  const FIN = String.fromCharCode(10) + '}';
  const trozos = fuente.split(CORTE).slice(1)
    .map((t) => ({ nombre: t.slice(0, t.indexOf('(')), cuerpo: t.split(FIN)[0] }));
  const reconstruyen = trozos.filter((t) => t.cuerpo.includes('rebuildStore('));

  ok(reconstruyen.length >= 2, 'hay mas de una funcion que reconstruye',
    reconstruyen.map((t) => t.nombre).join(', '));
  const sinAviso = reconstruyen.filter((t) => !t.cuerpo.includes('avisoFronteras('));
  ok(sinAviso.length === 0, 'todas avisan de que las fronteras pueden moverse',
    sinAviso.length ? `sin aviso: ${sinAviso.map((t) => t.nombre).join(', ')}` : '');
  ok(fuente.includes("t('mig.fronteras')"),
    'y el aviso sale de un texto traducido, no de una cadena suelta');
}

console.log(failed ? `\n${failed} mal\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
