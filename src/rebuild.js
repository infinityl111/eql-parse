import fs from 'node:fs';
import path from 'node:path';
import { Engine } from './engine.js';
import { FightStore, STORE_VERSION } from './store.js';

/**
 * Reconstrucción del almacén releyendo el log entero.
 *
 * Vive aquí y no en bin/ porque la usan dos sitios: el comando
 * `npm run store:rebuild` y el cartel de migración de la aplicación. Quien
 * tenga la 1.0.7 instalada no va a leer las notas de la versión, así que la
 * reconstrucción tiene que poder dispararse desde dentro.
 *
 * Reglas que se cumplen siempre:
 *  - Los ficheros anteriores se APARTAN con marca de tiempo, nunca se borran.
 *  - Si la reconstrucción sale vacía y antes había peleas, se deshace y se
 *    devuelve el motivo. Un log rotado o recortado no puede llevarse por
 *    delante meses de histórico.
 */

/**
 * Lo que se aparta, y por qué la enciclopedia va en la lista.
 *
 * La ficha de la enciclopedia se construye a partir de estas mismas peleas y
 * apunta a la última por su posición en el fichero. Dejándola fuera, una
 * reconstrucción que falla a medias restauraba el histórico de antes y se
 * quedaba con la ficha a medio hacer del intento: dos cosas que ya no se
 * describen la una a la otra, y con posiciones que pueden coincidir por
 * casualidad —los dos ficheros empiezan en cero y crecen igual—, así que la
 * comprobación de divergencia podía darla por buena.
 *
 * Van juntas o no van: se apartan a la vez y se restauran a la vez.
 */
// `loot.ndjson` va en la lista por lo mismo que la enciclopedia: sale de releer
// el mismo registro, así que si se queda sin apartar, la reconstrucción escribe
// encima de un fichero que ya tenía las entradas de la lectura anterior. Se
// deduplica por (hora, objeto, de quién), así que no se duplicaría — pero
// entonces conservaría entradas de un log que ya no existe, y eso es peor:
// nadie sabría de dónde salieron. Van juntas o no van.
// `tramos.ndjson` va en la lista por un motivo DISTINTO de los demás, y conviene
// no confundirlos. Los otros laterales salen de releer el registro, así que se
// apartan para que la reconstrucción no escriba encima de las entradas de la
// lectura anterior. Éste NO se regenera: existe sólo para rellenar el reparto
// por postura de las peleas que se guardaron antes de que ese campo existiera, y
// una reconstrucción se lo pone a todas por dentro. Apartarlo es hacerlo
// desaparecer, y eso es exactamente lo correcto.
//
// QUÉ PASABA SIN ESTA LÍNEA, medido: el fichero sobrevivía a la reconstrucción y
// seguía estampando lo suyo sobre peleas que ya no eran las mismas. La pelea de
// las 11:43 se reconstruye entera —563 s, modelo 3, con su reparto dentro— y le
// caía encima el `motivo: frontera-idle-20s` de la versión partida: una pelea
// impecable rotulada como excepción. Y quedaba una entrada huérfana apuntando a
// una hora de inicio que ya no existe.
const FICHEROS = ['fights.ndjson', 'fights.idx', 'encyclopedia.json', 'loot.ndjson',
  'aa.ndjson', 'spells.ndjson', 'tramos.ndjson'];

/**
 * AVISO QUE VIAJA CON EL RESULTADO, no un comentario que nadie lee.
 *
 * Mientras el cierre de pelea se decida con dos relojes distintos —el de pared
 * en directo y la marca del registro al reconstruir— esta operación NO reproduce
 * el histórico: con un hueco de exactamente `idleSec` cada camino parte la pelea
 * de una manera. Medido el 9 de agosto de 2026 sobre 441 peleas: una se funde en
 * otra, y las cifras de las dos cambian.
 *
 * Se devuelve como dato y no se escribe aquí para que cada sitio lo enseñe a su
 * manera —la consola con texto, la aplicación con su cartel— y para que el día
 * que se arregle la tarea baste con quitar esta constante y ver qué se rompe.
 * Ver el comentario de `tick()` en `src/encounter.js`.
 */
export const AVISO_RECONSTRUIR = 'fronteras-dos-relojes';

export async function rebuildStore({
  dir, logPath, self = null, idleSec = 20, trios = [], companions = [],
} = {}) {
  if (!dir) return { ok: false, reason: 'sin-carpeta' };
  if (!logPath || !fs.existsSync(logPath)) return { ok: false, reason: 'sin-log' };

  const antes = new FightStore(dir);
  antes.load();
  const peleasAntes = antes.index.length;
  const danoAntes = antes.filter({}).reduce((a, s) => a + (s.total ?? 0), 0);

  // Apartar, no borrar.
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const apartados = [];
  try {
    for (const f of FICHEROS) {
      const src = path.join(dir, f);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(dir, `${f}.${marca}.bak`);
      fs.renameSync(src, dst);
      apartados.push([src, dst]);
    }
  } catch (err) {
    for (const [src, dst] of apartados) { try { fs.renameSync(dst, src); } catch { /* nada */ } }
    return { ok: false, reason: 'sin-permisos', error: err.message };
  }

  const deshacer = () => {
    for (const f of FICHEROS) { try { fs.rmSync(path.join(dir, f), { force: true }); } catch { /* nada */ } }
    for (const [src, dst] of apartados) { try { fs.renameSync(dst, src); } catch { /* nada */ } }
  };

  const t0 = Date.now();
  const engine = new Engine();
  try {
    engine.setStorePath(dir);
    // Lo que declaraste a mano tiene que estar puesto ANTES de releer, o el
    // nivel de cada pelea se recalcula sin ello.
    engine.setTrios(trios);
    // Y los compañeros declarados, por el mismo motivo: sin ellos la
    // reconstrucción se comporta como si no tuvieras ninguno, y el daño que
    // hacen contra bichos que tú no llegas a tocar se descarta entero.
    //
    // Es el caso normal en grupo: varios enemigos y cada uno se encarga de los
    // suyos, así que hay bichos que tú no tocas en toda la pelea. Medido con
    // dos compañeros declarados, eran 65.907 de daño suyo fuera del almacén.
    engine.setCompanions(companions);
    await engine.attach(logPath, { self, fromStart: true, idleSec });
    // attach() no resuelve hasta haber leído todo lo pendiente, pero la última
    // pelea queda abierta: se cierra con un reloj muy por delante.
    engine.tracker.tick(Number.MAX_SAFE_INTEGER);
    // El punto de lectura, antes de soltar el lector: `detach()` lo pone a null.
    engine.saveStore();
    engine.detach();
  } catch (err) {
    try { engine.detach(); } catch { /* nada */ }
    deshacer();
    return { ok: false, reason: 'error-de-lectura', error: err.message };
  }

  const despues = new FightStore(dir);
  despues.load();

  // Red de seguridad: si el log ya no contiene lo que había guardado, se
  // devuelve el histórico anterior y no se toca nada.
  if (peleasAntes > 0 && despues.index.length === 0) {
    deshacer();
    return { ok: false, reason: 'sin-peleas', peleasAntes };
  }

  despues.stamp(STORE_VERSION);
  const peleasDespues = despues.index.length;
  const resumenes = despues.filter({});
  return {
    ok: true,
    // Viaja con el resultado para que cada interfaz lo enseñe. Ver
    // `AVISO_RECONSTRUIR`.
    aviso: AVISO_RECONSTRUIR,
    version: STORE_VERSION,
    peleasAntes, peleasDespues,
    danoAntes,
    danoDespues: resumenes.reduce((a, s) => a + (s.total ?? 0), 0),
    abatidos: resumenes.reduce((a, s) => a + (s.kills ?? []).length, 0),
    lineas: engine.parser?.parsed ?? 0,
    sinReconocer: engine.parser?.unrecognized ?? 0,
    segundos: (Date.now() - t0) / 1000,
    copias: apartados.map(([, dst]) => path.basename(dst)),
  };
}
