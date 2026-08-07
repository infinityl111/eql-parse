/**
 * Abre la aplicación de verdad, recorre las vistas y mide el DOM.
 *
 * POR QUÉ HACE FALTA. Hay una clase de fallo que ninguna prueba de las otras
 * ve: el cálculo está bien y lo que falla es dibujarlo. Pasó dos veces
 * seguidas. Primero un ReferenceError a mitad de construir la cadena, que
 * dejaba la pantalla anterior intacta —pulsabas y no pasaba nada—. Después
 * una clase de CSS con dos dueños, `.serie`, que clavaba los seis tramos de
 * la ficha de un hechizo a 34 píxeles de alto y los apilaba unos encima de
 * otros. Los dos con los datos perfectos detrás.
 *
 * Y NO SE PUEDE MIRAR EN EL FICHERO. Se intentó: un chequeo estático de
 * colisiones de clase o no caza el caso o saca siete falsos por cada bueno,
 * porque «base compartida más refinamiento» y «un nombre con dos dueños» se
 * escriben igual. La diferencia sólo aparece al pintar.
 *
 * Así que esto pinta. Levanta la aplicación con depuración remota, navega,
 * mide las cajas y avisa si alguna se solapa con la anterior o si saltó la
 * caja de fallo. Deja además una captura por vista para mirarla.
 *
 * NO ESTÁ EN `npm test` a propósito: necesita pantalla, un histórico con
 * datos y unos veinte segundos. Es para antes de publicar, no para cada
 * cambio.
 *
 * Uso:  npm run ui:check
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PUERTO = 9222;
const SALIDA = path.join(os.tmpdir(), 'eql-ui-check');
fs.mkdirSync(SALIDA, { recursive: true });

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function conecta() {
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

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { res, rej } = pend.get(m.id);
      pend.delete(m.id);
      if (m.error) rej(new Error(JSON.stringify(m.error)));
      else res(m.result);
    }
  };
  const manda = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    pend.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const listo = new Promise((r) => { ws.onopen = r; });
  return { ws, manda, listo };
}

// Cada vista: cómo llegar, y qué cajas no deben pisarse.
const VISTAS = [
  {
    nombre: 'hechizo',
    llega: [
      "[...document.querySelectorAll('.tab')].find((x) => /ENCICLOPEDIA/i.test(x.textContent))?.click()",
      "[...document.querySelectorAll('.enccard')].find((x) => /hechizos/i.test(x.textContent))?.click()",
      "document.querySelectorAll('.cat-row.abre')[0]?.click()",
    ],
    cajas: '.tramo',
  },
  {
    nombre: 'progreso',
    llega: [
      "[...document.querySelectorAll('[data-crumb]')].find((x) => /ENCICLOPEDIA/i.test(x.textContent))?.click()",
      "[...document.querySelectorAll('.enccard')].find((x) => /progres/i.test(x.textContent))?.click()",
    ],
    cajas: '.encrow.serie-row',
  },
  {
    nombre: 'enemigo',
    llega: [
      "[...document.querySelectorAll('[data-crumb]')].find((x) => /ENCICLOPEDIA/i.test(x.textContent))?.click()",
      "[...document.querySelectorAll('.enccard')].find((x) => /enemigos/i.test(x.textContent))?.click()",
      "document.querySelectorAll('.encrow.foe .nm')[0]?.click()",
    ],
    cajas: '.difgrid > *',
  },
  {
    nombre: 'muertes',
    llega: [
      "[...document.querySelectorAll('[data-crumb]')].find((x) => /ENCICLOPEDIA/i.test(x.textContent))?.click()",
      "[...document.querySelectorAll('.enccard')].find((x) => /muertes/i.test(x.textContent))?.click()",
    ],
    cajas: '.encrow',
  },
];

// El binario directo, no `npx`: en Windows, Node 24 se niega a lanzar un
// `.cmd` sin shell y devuelve EINVAL. El paquete `electron` exporta la ruta.
const { createRequire } = await import('node:module');
const bin = createRequire(import.meta.url)('electron');
const app = spawn(bin, ['.', `--remote-debugging-port=${PUERTO}`],
  { stdio: 'ignore', detached: false });

let mal = 0;
try {
  const pagina = await conecta();
  const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
  await listo;
  await manda('Runtime.enable');
  await manda('Page.enable');

  const evalua = async (expr) => {
    const r = await manda('Runtime.evaluate', {
      expression: expr, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? 'error al evaluar');
    }
    return r.result.value;
  };

  console.log(`\n${pagina.title} — midiendo el DOM de verdad\n`);
  await espera(3000);

  for (const v of VISTAS) {
    for (const paso of v.llega) { await evalua(paso); await espera(1600); }

    const m = await evalua(`(() => {
      const n = [...document.querySelectorAll(${JSON.stringify(v.cajas)})];
      const c = n.map((x) => { const r = x.getBoundingClientRect();
        return { t: Math.round(r.top), b: Math.round(r.bottom),
          l: Math.round(r.left), rr: Math.round(r.right), h: Math.round(r.height),
          // Lo que delata el apilado no es que las CAJAS se solapen —no lo
          // hacían— sino que el CONTENIDO se sale de la suya: con un alto
          // fijo de 34px, cada bloque medía sus 34 obedientes y se pintaba
          // encima del siguiente. Comprobado devolviendo el fallo: la medida
          // de solapes daba verde y ésta no.
          desborda: x.scrollHeight > x.clientHeight + 2
            && getComputedStyle(x).overflowY === 'visible' }; });
      // Solape de verdad: en los DOS ejes. Mirando sólo el vertical, las cinco
      // columnas de dificultad de un enemigo —que van una al lado de otra—
      // salían como tres solapes, y no lo son.
      let solapes = 0, sinAlto = 0, desbordan = 0;
      for (let i = 0; i < c.length; i++) {
        if (c[i].h < 2) sinAlto++;
        if (c[i].desborda) desbordan++;
        for (let j = i + 1; j < c.length; j++) {
          const v = Math.min(c[i].b, c[j].b) - Math.max(c[i].t, c[j].t);
          const hh = Math.min(c[i].rr, c[j].rr) - Math.max(c[i].l, c[j].l);
          if (v > 1 && hh > 1) solapes++;
        }
      }
      const caja = document.getElementById('crashBox');
      return { n: n.length, solapes, sinAlto, desbordan,
        crash: caja && caja.style.display !== 'none' ? caja.textContent.slice(0, 160) : null,
        vacia: document.querySelector('.enc')?.textContent.trim().length < 40 };
    })()`);

    const bien = m.n > 0 && !m.solapes && !m.sinAlto && !m.desbordan && !m.crash && !m.vacia;
    if (!bien) mal++;
    console.log(`  ${bien ? 'ok ' : 'MAL'}  ${v.nombre.padEnd(10)} ${
      m.n} cajas «${v.cajas}» · ${m.solapes} solapes · ${m.sinAlto} sin alto · ${
      m.desbordan} desbordan${
      m.crash ? `\n         REVENTÓ: ${m.crash}` : ''}${m.vacia ? '\n         la vista salió vacía' : ''}`);

    const alto = await evalua('document.body.scrollHeight');
    await manda('Emulation.setDeviceMetricsOverride', {
      width: 1500, height: Math.min(alto + 60, 3200), deviceScaleFactor: 1, mobile: false,
    });
    await espera(500);
    const shot = await manda('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(SALIDA, `${v.nombre}.png`), Buffer.from(shot.data, 'base64'));
    await manda('Emulation.clearDeviceMetricsOverride');
    await espera(300);
  }

  ws.close();
  console.log(`\n  capturas en ${SALIDA}`);
} finally {
  app.kill();
}

console.log(mal ? `\n${mal} vista(s) MAL\n` : '\ntodo bien\n');
process.exit(mal ? 1 : 0);
