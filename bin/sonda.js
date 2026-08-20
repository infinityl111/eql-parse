/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARRANCAR LA APLICACIÓN LISTA PARA MEDIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tres sondas distintas han tropezado con lo mismo, y la cuarta lo habría
 * hecho: **preparar la aplicación para que una sonda mida algo no es una nota,
 * es una pieza**. Misma jugada que `pintaEstable` y que el marco de los
 * overlays — se arregla una vez y sirve para todas.
 *
 * ── LO QUE HAY QUE HACER BIEN, Y CADA UNO COSTÓ UNA TARDE ─────────────────
 *
 *  1 · `--user-data-dir` **ES** la carpeta de datos de Electron, no su padre.
 *      Escribir la configuración un nivel más abajo la deja sin leer.
 *
 *  2 · La configuración se COPIA de la real. Escrita de cero sale el asistente
 *      de bienvenida y tapa la aplicación entera.
 *
 *  3 · La clave del registro es **`logPath`**, no `path`. Con la equivocada el
 *      motor no engancha: la sonda arranca, pinta, mide y da su informe **sobre
 *      una aplicación sin datos**, sin fallar ni una vez.
 *
 *  4 · El almacén va **SELLADO**. Sin sello sale el cartel de «tu histórico lo
 *      escribió otra versión» y **tapa la pantalla**: las secciones no se abren
 *      y todo sale a cero, exactamente igual que si estuviera roto.
 *
 *  5 · Y hay que **esperar**: a la ventana, a la barra lateral, y a que la
 *      sección pinte. Pulsar antes de que exista no falla — no hace nada.
 *
 *  6 · Y al final, **comprobar que el motor enganchó** en vez de suponerlo. La
 *      pregunta que sirve es la que estuvo rota: ¿sabe la aplicación cuándo
 *      murió un bicho que muere en el registro de prueba?
 *
 * Los seis juntos son la diferencia entre medir la aplicación y medir una
 * pantalla vacía que se le parece.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lanzar, espera, cdp, PUERTO } from './cdp.js';

/** Se reexporta para que una sonda importe de un solo sitio. */
export { espera };

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El formato de fecha del registro del juego. */
const DIA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Una marca de tiempo de hace `seg` segundos, como la escribe el juego.
 *
 * Una fijación con fecha muerta no puede producir un estado vivo: con las
 * fechas fijas de siempre, «visto hace X» caía en «no se le ve desde hace
 * dieciséis días» y la rama de «está ahí» no se podía ejercitar nunca.
 */
export const hace = (seg) => {
  const d = new Date(Date.now() - seg * 1000);
  return `${DIA[d.getDay()]} ${MES[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${
    d.toTimeString().slice(0, 8)} ${d.getFullYear()}`;
};

/** La configuración REAL, de la que se parte. Sin ella sale el asistente. */
export function configReal() {
  const p = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'config.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'config.json'),
  ].find((f) => fs.existsSync(f));
  if (!p) {
    console.error('\nSin configuración real de la que partir, la aplicación arranca en');
    console.error('el asistente y esta comprobación no mide nada.\n');
    process.exit(3);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Arranca la aplicación lista para medir y devuelve con qué mirarla.
 *
 * @param {object} o
 * @param {string} o.nombre     carpeta de datos, propia de cada sonda
 * @param {string[]} o.registro líneas del registro de prueba
 * @param {object} o.config     lo que se añade a la configuración real
 * @param {string} o.vivo       nombre de un bicho que MUERE en el registro
 * @param {string} o.ventana    trozo de la URL de la ventana a mirar
 */
export async function arrancaListo({
  nombre, registro = [], config = {}, vivo = null, ventana = 'index.html',
  siembra = null,
} = {}) {
  // (1) `--user-data-dir` ES la carpeta de datos, no su padre.
  const DATOS = path.join(os.tmpdir(), nombre);
  fs.rmSync(DATOS, { recursive: true, force: true });
  fs.mkdirSync(DATOS, { recursive: true });

  const LOG = path.join(DATOS, `eqlog_${nombre}_erudin.txt`);
  fs.writeFileSync(LOG, [...registro, ''].join('\r\n'));

  // (4) el almacén, sellado: sin sello el cartel tapa la pantalla entera.
  const { FightStore } = await import(`file://${RAIZ.replace(/\\/g, '/')}/src/store.js`);
  const store = new FightStore(DATOS);
  /**
   * Y si la sonda quiere peleas a medida, las siembra aqui.
   *
   * Algunas necesitan un historico concreto -tantas muertes de tal bicho, a
   * tales horas- y construirlo con lineas de registro seria escribir un
   * juego. El sello va DESPUES: sellar es lo que apaga el cartel, y sembrar
   * despues de sellar lo volveria a encender.
   */
  await siembra?.(store);
  store.stamp();

  // (2) y (3): de la real, y con `logPath`.
  fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify({
    ...configReal(), lang: 'es', ...config, logPath: LOG,
  }, null, 2));

  const hijo = lanzar([`--user-data-dir=${DATOS}`]);
  const fin = (c) => { try { hijo.kill(); } catch { /* ya no está */ } process.exit(c); };

  // (5) esperar a la ventana.
  let ficha = null;
  for (let i = 0; i < 80 && !ficha; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      ficha = l.find((x) => x.url.includes(ventana));
    } catch { /* todavía no ha levantado el puerto */ }
    if (!ficha) await espera(500);
  }
  if (!ficha) {
    console.error(`\nLa ventana «${ventana}» no llegó a abrirse.\n`);
    fin(1);
  }

  const cli = cdp(ficha.webSocketDebuggerUrl);
  await cli.listo;
  const lee = async (js) => (await cli.manda('Runtime.evaluate', {
    expression: js, returnByValue: true, awaitPromise: true,
  }))?.result?.value;

  // (6) ¿enganchó? La pregunta que estuvo rota.
  if (vivo) {
    const js = `window.eql.ultimaMuerte([${JSON.stringify({
      nombre: vivo, base: config.cronos?.[0]?.base ?? null, diff: config.cronos?.[0]?.diff ?? null, mode: null,
    })}]).then((r) => Object.values(r ?? {}).filter(Boolean).length)`;
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      ok = (await lee(js)) > 0;
      if (!ok) await espera(500);
    }
    if (!ok) {
      console.error('\nEL MOTOR NO ENGANCHÓ.');
      console.error(`La aplicación no sabe cuándo murió «${vivo}», y esa muerte está en el`);
      console.error('registro de prueba. Todo lo que midiera esta sonda a partir de aquí');
      console.error('sería de una aplicación vacía — que es lo que le pasó a bin/rotulos.js.\n');
      fin(1);
    }
  }

  // (5b) Y A LA BARRA LATERAL. Consultar las secciones antes de que exista no
  // falla: devuelve una lista vacia, y una sonda que recorre cero secciones
  // informa «0 de 0» — verde por no haber mirado.
  for (let i = 0; i < 60; i++) {
    if (await lee(`!!document.querySelector('[data-sec]')`)) break;
    await espera(500);
  }

  return { DATOS, LOG, cli, lee, fin, hijo };
}

/**
 * Abre una sección y espera a que pinte. Devuelve `false` si no llegó a pintar.
 *
 * Pulsar antes de que exista la barra lateral no falla: no hace nada, y todo lo
 * que se mida después es de la pantalla equivocada.
 */
export async function abreSeccion(lee, sec, señal = '.pz-fila, .cro, section') {
  for (let i = 0; i < 60; i++) {
    if (await lee(`!!document.querySelector('[data-sec=${sec}]')`)) break;
    await espera(500);
  }
  await lee(`document.querySelector('[data-sec=${sec}]')?.click()`);
  for (let i = 0; i < 60; i++) {
    if (await lee(`document.querySelectorAll('${señal}').length`)) return true;
    await espera(500);
  }
  return false;
}
