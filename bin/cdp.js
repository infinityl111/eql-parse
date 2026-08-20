/**
 * Levantar la aplicación de verdad y hablar con ella.
 *
 * Lo usan dos herramientas: `ui-check`, que mide el DOM, y `ui-gif`, que captura
 * fotogramas de la reproducción. Las dos necesitan exactamente lo mismo —abrir
 * la ventana con depuración, engancharse y evaluar cosas dentro— y tenerlo dos
 * veces significaba que el día que cambiara el arranque sólo se arreglaría uno.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

export const PUERTO = 9222;
export const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * Comprueba que el puerto está libre.
 *
 * Si estuviera cogido, esto se engancharía a la ventana ANTERIOR y mediría el
 * código viejo dando un verde que no vale nada. Pasó: una prueba de revertir
 * salió limpia porque estaba mirando la instancia de antes.
 */
export async function puertoLibre() {
  try {
    await fetch(`http://127.0.0.1:${PUERTO}/json/version`, { signal: AbortSignal.timeout(1500) });
    return false;
  } catch { return true; }
}

/** Lanza la aplicación con el puerto de depuración abierto. */
/**
 * @param {string[]} extra  argumentos de mas para Electron.
 *   `--user-data-dir=<ruta>` es el que permite levantar la aplicacion sobre una
 *   carpeta de datos preparada sin tocar la de nadie. Es un conmutador de
 *   Chromium, asi que no hace falta cambiar nada de la aplicacion.
 */
export function lanzar(extra = []) {
  // El binario directo, no `npx`: en Windows, Node 24 se niega a lanzar un
  // `.cmd` sin shell y devuelve EINVAL. El paquete `electron` exporta la ruta.
  const bin = createRequire(import.meta.url)('electron');
  return spawn(bin, ['.', `--remote-debugging-port=${PUERTO}`, ...extra], { stdio: 'ignore', detached: false });
}

/** Espera a que la ventana principal esté disponible y devuelve su ficha. */
export async function conecta() {
  for (let i = 0; i < 40; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const p = lista.find((x) => x.url.includes('index.html'));
      if (p) return p;
    } catch { /* todavía no ha levantado */ }
    await espera(500);
  }
  throw new Error('la aplicación no levantó el puerto de depuración');
}

/**
 * Cuánto se espera a una orden antes de darla por perdida.
 *
 * NINGUNA ORDEN ESPERA PARA SIEMPRE, y esto es un arreglo con víctima. Una
 * captura se quedó veintidós minutos sin escribir un fotograma: la promesa de
 * `Page.captureScreenshot` nunca se resolvió, y como no había plazo, el script
 * se quedó esperando una respuesta que no iba a llegar. Sin error, sin salida y
 * sin nada en pantalla — indistinguible de estar trabajando.
 *
 * Treinta segundos son de sobra: la orden más lenta de todas, una captura de
 * página entera de tres mil píxeles, tarda menos de dos.
 */
const PLAZO = 30_000;

/** Un cliente mínimo del protocolo: mandar y esperar respuesta. */
export function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pend = new Map();
  const zanjar = (n, fn, arg) => {
    const p = pend.get(n);
    if (!p) return;
    clearTimeout(p.reloj);
    pend.delete(n);
    p[fn](arg);
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!m.id || !pend.has(m.id)) return;
    if (m.error) zanjar(m.id, 'rej', new Error(JSON.stringify(m.error)));
    else zanjar(m.id, 'res', m.result);
  };
  // Y si el socket se cae, TODO lo que estuviera esperando se cae con él. Sin
  // esto, cerrar el navegador a mitad tiene el mismo efecto que colgarse.
  const caer = (por) => {
    for (const n of [...pend.keys()]) zanjar(n, 'rej', new Error(`el socket ${por}`));
  };
  ws.onclose = () => caer('se cerró');
  ws.onerror = () => caer('dio error');

  const manda = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    const reloj = setTimeout(() => {
      zanjar(n, 'rej', new Error(`«${method}» no respondió en ${PLAZO / 1000}s`));
    }, PLAZO);
    // El reloj no debe mantener vivo el proceso por sí solo.
    reloj.unref?.();
    pend.set(n, { res, rej, reloj });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const listo = new Promise((r) => { ws.onopen = r; });
  return { ws, manda, listo };
}

/**
 * CAPTURAR ES MEDIR, Y UNA MEDIDA SE COMPRUEBA.
 *
 * Esto no es una comodidad: es la norma para cualquier captura, y sale de un
 * fallo que costó una muestra entera.
 *
 * El recorte de una captura se decide una vez y se usa muchas. Si la página
 * cambia de tamaño por el camino —Electron restaura las dimensiones guardadas
 * de la ventana un par de segundos después de abrir— el recorte deja de
 * encuadrar lo mismo, y NADIE AVISA: la captura sale, el fichero se escribe, el
 * script termina en verde. Lo que se produjo así fue una animación que empezaba
 * bien y a los pocos segundos enseñaba a los personajes peleando contra un
 * enemigo fuera de cuadro.
 *
 * Y el patrón es el de siempre, un nivel más arriba: la herramienta que
 * habíamos hecho para verificar tenía el fallo, y produjo una prueba que
 * parecía correcta. Por eso la comprobación vive aquí y no dentro de un script:
 * cualquier captura nueva pasa por esta puerta.
 *
 * @param {object} io        { manda, evalua }
 * @param {string} selector  el elemento que se encuadra
 * @param {object} ref       la caja de referencia, de `medirCaja`
 * @param {number} escala    reducción de la salida
 * @param {number} tol       píxeles de holgura: asentarse sí, moverse no
 */
export async function medirCaja(evalua, selector) {
  return evalua(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.floor(r.left), y: Math.floor(r.top),
             width: Math.ceil(r.width), height: Math.ceil(r.height) };
  })()`);
}

/**
 * Reintenta una captura que se queda sin respuesta, y LO DICE.
 *
 * `Page.captureScreenshot` se cuelga de vez en cuando: con la misma caja y la
 * misma página responde en 410 ms, y una vez de cada muchas no responde nunca.
 * No es un error de uso —se probó la caja exacta, dentro y fuera del alto de la
 * ventana, y las dos van— sino el compositor atascado después de mucho
 * redimensionar.
 *
 * Contra eso, reintentar es lo correcto; callarlo, no. Si un fotograma necesitó
 * dos intentos, eso se imprime: una tanda que reintenta la mitad de las veces
 * está diciendo que algo va mal aunque acabe en verde.
 */
async function conReintento(quien, fn, veces = 3) {
  let ultimo = null;
  for (let i = 1; i <= veces; i++) {
    try {
      const r = await fn();
      if (i > 1) console.log(`       (${quien} salió al intento ${i} de ${veces})`);
      return r;
    } catch (e) {
      ultimo = e;
      if (!/no respondió en/.test(e.message)) throw e;   // sólo los cuelgues
      console.log(`       (${quien}: intento ${i} sin respuesta, reintentando)`);
      await espera(1000);
    }
  }
  throw ultimo;
}

export async function capturaComprobada({ manda, evalua }, selector, ref, escala = 1, tol = 8) {
  const ahora = await medirCaja(evalua, selector);
  if (!ahora) throw new Error(`no existe «${selector}» al capturar`);
  if (Math.abs(ahora.x - ref.x) > tol || Math.abs(ahora.y - ref.y) > tol
      || Math.abs(ahora.width - ref.width) > tol) {
    throw new Error(`el encuadre se ha movido: ${ref.width}×${ref.height} en (${ref.x},${ref.y})`
      + ` → ${ahora.width}×${ahora.height} en (${ahora.x},${ahora.y})`);
  }
  const r = await conReintento(`recorte de ${selector}`, () => manda('Page.captureScreenshot', {
    format: 'png', clip: { x: ref.x, y: ref.y, width: ref.width, height: ref.height, scale: escala },
  }));
  return Buffer.from(r.data, 'base64');
}

/**
 * La captura de la página entera, con la misma exigencia: el alto se mide, se
 * fija y se vuelve a mirar. Si la página creció entre una cosa y la otra, el
 * recorte se queda corto y la captura miente por abajo.
 */
/**
 * @param {number|null} altoFijo  alto de ventana impuesto, para las vistas que
 *   SCROLLEAN POR DENTRO. En ellas `body.scrollHeight` no crece con el
 *   contenido —vive en un panel con su propio scroll—, así que deducir el alto
 *   de ahí recorta la captura sin que nada avise: la enciclopedia salió con
 *   dos fichas partidas por la mitad y el script terminó en verde.
 */
export async function capturaPagina({ manda, evalua }, ancho = 1500, maxAlto = 3200, altoFijo = null) {
  const antes = await evalua('document.body.scrollHeight');
  await manda('Emulation.setDeviceMetricsOverride', {
    width: ancho, height: altoFijo ?? Math.min(antes + 60, maxAlto), deviceScaleFactor: 1, mobile: false,
  });
  await espera(500);
  const despues = await evalua('document.body.scrollHeight');
  const shot = await conReintento('captura de página', () => manda('Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: true }));
  await manda('Emulation.clearDeviceMetricsOverride');
  return {
    png: Buffer.from(shot.data, 'base64'),
    // No se revienta: una página que crece al fijar el alto es normal si tiene
    // contenido que depende del ancho. Se DICE, que es lo que faltaba.
    // Con alto impuesto no dice nada: ahí el alto no se dedujo de esto.
    creció: !altoFijo && despues > antes + 60 ? { antes, despues } : null,
  };
}

/**
 * EL TEMA DE UNA CAPTURA SE FIJA, Y SE DEVUELVE COMO ESTABA.
 *
 * Vive aquí por lo mismo que `capturaComprobada`: es una condición de la
 * captura, no una comodidad de un script. Las cuatro imágenes de la
 * documentación se hicieron a mano en días distintos y salieron en tres temas
 * — puestas en fila en la portada leen como tres programas.
 *
 * Y `setTheme` NO es un ajuste de ventana: lo guarda en la configuración. Sin
 * devolverlo, capturar le cambiaría el tema a quien capture, que es un efecto
 * que nadie pidió. Por eso son dos funciones y no una: la segunda va en el
 * `finally`, y antes de matar la aplicación — con el proceso muerto ya no hay
 * a quién pedírselo.
 *
 * @returns {Promise<string>} el tema que había, para devolvérselo después
 */
export async function fijarTema(evalua, tema) {
  const previo = await evalua("document.documentElement.dataset.theme || 'dark'");
  if (previo !== tema) {
    await evalua(`window.eql.setTheme(${JSON.stringify(tema)})`);
    await evalua(`document.documentElement.dataset.theme = ${JSON.stringify(tema)}`);
    await espera(600);
  }
  return previo;
}

export async function devolverTema(evalua, previo, tema) {
  if (!evalua || !previo || previo === tema) return true;
  try {
    await evalua(`window.eql.setTheme(${JSON.stringify(previo)})`);
    console.log(`  tema devuelto a «${previo}»`);
    return true;
  } catch (e) {
    console.error(`  MAL  no se pudo devolver el tema a «${previo}»: ${e.message}`);
    console.error('       cámbialo a mano en la aplicación.');
    return false;
  }
}

/** Evalúa dentro de la página y devuelve el valor, o revienta con su error. */
export function evaluador(manda) {
  return async (expr) => {
    const r = await manda('Runtime.evaluate', {
      expression: expr, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? 'error al evaluar');
    }
    return r.result.value;
  };
}
