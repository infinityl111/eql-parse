import fs from 'node:fs';
import path from 'node:path';
import { Engine } from './engine.js';
import { FightStore, FORMATO_VERSION } from './store.js';

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
// `dudas.ndjson` va por el mismo motivo que `tramos.ndjson` —no se regenera, y
// una reconstrucción deja sin sentido lo que dice— pero con una diferencia que
// conviene no perder: éste NO DEPENDE de que lo apartemos. Cada duda guarda el
// importe mal atribuido, y `aplicarDudas` sólo se la cree si la pelea sigue
// teniendo esas cifras; en cuanto la reconstrucción la cambia, la entrada se
// descarta sola. Apartarlo es el cinturón; la comprobación por contenido, los
// tirantes. Van los dos porque el fallo que esta lista evita —un aviso viejo
// estampado sobre una pelea que ya está bien— es silencioso.
const FICHEROS = ['fights.ndjson', 'fights.idx', 'encyclopedia.json', 'loot.ndjson',
  'aa.ndjson', 'spells.ndjson', 'tramos.ndjson', 'dudas.ndjson'];

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

/**
 * PENDIENTE PARA LA 1.12.0: PODAR LAS COPIAS. Decidido, no implementado.
 *
 * Apartar antes de reconstruir es lo que hace segura la operación, pero nadie
 * borra nunca lo apartado. Medido en una carpeta real el 9 de agosto de 2026:
 * 113 ficheros `.bak` y 140,7 MB, contra 18 MB de almacén vivo. Veintisiete
 * generaciones de `fights.ndjson` en cuatro días.
 *
 * LA POLÍTICA, con el porqué de cada pieza:
 *
 *   SE BORRA POR TANDA, NUNCA POR FICHERO. Cada reconstrucción aparta los seis
 *   con la misma marca de tiempo, y arriba está escrito por qué van juntas.
 *   Media tanda es peor que ninguna: restaurarías un `fights.ndjson` con el
 *   índice de otro momento. Una regla ingenua «los N ficheros más nuevos de
 *   cada nombre» rompe justo esto, porque los recuentos no coinciden —27, 27,
 *   17, 15, 13, 12— cuando alguna vez faltó alguno.
 *
 *   SE GUARDAN LAS 3 ÚLTIMAS TANDAS, y el criterio es la POSICIÓN, no la edad.
 *   Una regla de «los últimos 30 días» borra la única red de quien reconstruye
 *   cada dos meses, que es exactamente quien más la necesita. La antigüedad no
 *   dice nada del valor de una copia; su posición en la pila sí. Tres y no una
 *   porque se puede reconstruir dos veces antes de notar que el problema venía
 *   de la primera.
 *
 *   SE PODA DESPUÉS DE UNA RECONSTRUCCIÓN CON ÉXITO, jamás al arrancar. Borrar
 *   es destructivo y el único instante en que consta que lo nuevo está bien es
 *   cuando acaba de salir bien. Podar al abrir tiraría copias sin haber
 *   comprobado nada.
 *
 *   Y SE DICE lo que se ha borrado, con los nombres, en el resultado.
 *
 * LOS PUNTOS DE CONTROL CON NOMBRE QUEDAN FUERA, y esto hay que dejarlo escrito
 * porque el día que alguien generalice la regla se los lleva por delante:
 * `config.json.antes-de-trios.bak` y `config.json.antes-del-who.bak` no llevan
 * marca de tiempo, no pertenecen a ninguna tanda y ocupan dos kilobytes. Los
 * puso una persona antes de una operación concreta y su valor es justamente que
 * siguen ahí. La poda sólo mira ficheros cuyo nombre acabe en
 * `.<marca ISO>.bak`; cualquier otro `.bak` no se toca.
 *
 * DESCARTADO: «las 3 últimas más la primera de todas». La tanda más vieja sólo
 * parece valiosa desde una circunstancia irrepetible —la semana en que se
 * corrigió el modelo de medición—. Para un usuario cualquiera es la que menos
 * vale: la más lejana de su estado actual y la que más probablemente ya no
 * cuadre con su registro. Una política permanente no se construye alrededor de
 * un caso que no se va a repetir.
 *
 * NO VA EN LA 1.11.0 a propósito: su instalador ya está probado, y meter
 * después de las comprobaciones código que BORRA ficheros del usuario invalida
 * lo que se acaba de verificar. Y es la clase de fallo que no se nota hasta que
 * alguien necesita la copia que ya no está.
 */

/**
 * LO QUE CUENTA COMO UNA TANDA, y qué se puede tocar.
 *
 * Una reconstrucción aparta varios ficheros a la vez con LA MISMA marca de
 * tiempo: `fights.ndjson.2026-08-11T19-30-47.bak`, `fights.idx.<misma>.bak`,
 * etcétera. Esa marca ES la tanda, y por eso se poda por marcas y no por
 * ficheros: media tanda es peor que ninguna —restaurarías un `fights.ndjson`
 * con el índice de otro momento— y ese razonamiento ya está escrito arriba.
 *
 * SÓLO SE MIRA LO QUE ACABA EN `.<marca ISO>.bak`. Cualquier otro `.bak` no se
 * toca, y esto no es una precaución vaga: en una carpeta real conviven
 * `config.json.antes-de-trios.bak` y `config.json.antes-del-who.bak`, que no
 * llevan marca, no pertenecen a ninguna tanda, ocupan dos kilobytes y su valor
 * es justamente que siguen ahí. Los puso una persona antes de una operación
 * concreta. Una poda que generalice «los .bak viejos» se los lleva.
 */
const MARCA = /\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.bak$/;

export function tandas(dir) {
  let nombres = [];
  try { nombres = fs.readdirSync(dir); } catch { return []; }
  const por = new Map();
  for (const n of nombres) {
    const m = MARCA.exec(n);
    if (!m) continue;
    const lista = por.get(m[1]) ?? [];
    lista.push(n);
    por.set(m[1], lista);
  }
  // De la más nueva a la más vieja. La marca es ISO recortada, así que ordenar
  // el texto ordena el tiempo: no hay que mirar la fecha del fichero, que es
  // otra cosa y se mueve al copiar la carpeta.
  return [...por.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([marca, ficheros]) => ({ marca, ficheros: ficheros.sort() }));
}

/**
 * Deja las `conservar` tandas más recientes y borra las demás.
 *
 * POR POSICIÓN Y NO POR ANTIGÜEDAD, decidido y medido: en cuatro días hubo
 * cinco generaciones de `fights.ndjson` en esta carpeta, y con un criterio de
 * días quien reconstruye cada dos meses —que es exactamente quien más la
 * necesita— se queda sin ninguna. La posición en la pila sí dice algo; la edad
 * no dice nada del valor de una copia.
 *
 * SE LLAMA DESPUÉS DE UNA RECONSTRUCCIÓN CON ÉXITO, jamás al arrancar. Borrar
 * es destructivo y el único instante en que consta que lo nuevo está bien es
 * cuando acaba de salir bien.
 *
 * Devuelve los nombres borrados para que quien la llame PUEDA DECIRLOS. Una
 * poda silenciosa es indistinguible de una pérdida de datos.
 */
export function podar(dir, conservar = 3) {
  const todas = tandas(dir);
  const sobran = todas.slice(conservar);
  const borrados = [];
  const fallidos = [];
  for (const t of sobran) {
    for (const f of t.ficheros) {
      try { fs.rmSync(path.join(dir, f), { force: true }); borrados.push(f); }
      catch { fallidos.push(f); }
    }
  }
  return {
    borrados, fallidos,
    tandasAntes: todas.length,
    tandasDespues: Math.min(todas.length, conservar),
    conservadas: todas.slice(0, conservar).map((t) => t.marca),
  };
}

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

  despues.stamp(FORMATO_VERSION);
  // AQUÍ, Y NO ANTES: la poda va después de que la reconstrucción haya salido
  // bien Y esté sellada. Todo lo de arriba tiene un camino de vuelta —`deshacer`
  // restaura lo apartado— y ese camino deja de existir en cuanto se borra algo,
  // así que borrar es lo último que se hace.
  //
  // La tanda que acaba de crearse cuenta como una de las tres, y es lo
  // correcto: es la copia de lo que había hasta hace un segundo, la más
  // valiosa de todas.
  const poda = podar(dir, 3);
  const peleasDespues = despues.index.length;
  const resumenes = despues.filter({});
  return {
    ok: true,
    // Lo borrado viaja con el resultado, con los nombres. Ver `podar`.
    podadas: poda.borrados,
    tandasConservadas: poda.conservadas,
    podaFallida: poda.fallidos,
    // Viaja con el resultado para que cada interfaz lo enseñe. Ver
    // `AVISO_RECONSTRUIR`.
    aviso: AVISO_RECONSTRUIR,
    version: FORMATO_VERSION,
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
