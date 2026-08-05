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

const FICHEROS = ['fights.ndjson', 'fights.idx'];

export async function rebuildStore({ dir, logPath, self = null, idleSec = 20, trios = [] } = {}) {
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
