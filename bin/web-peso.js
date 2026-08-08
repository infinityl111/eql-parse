/**
 * Cuánto tarda la portada en una conexión normal, medido y no supuesto.
 *
 * POR QUÉ. La muestra animada es lo que explica el producto sin leer nada, y
 * pesa megas. «Va bien» dicho desde una máquina que lee el fichero del disco
 * no significa nada: aquí no hay red. Así que se levanta un servidor de
 * verdad, se estrangula la conexión a velocidades reales y se mide.
 *
 * QUÉ SE MIDE, y por qué estas tres cosas y no «el tiempo de carga»:
 *
 *   · PRIMER PINTADO      cuándo aparece algo en pantalla. Antes de esto, el
 *                         visitante ve una página en blanco.
 *   · PRIMER FOTOGRAMA    cuándo se ve la muestra QUIETA. Un APNG lleva su
 *                         primer fotograma al principio del fichero, así que
 *                         se ve mucho antes de que termine de bajar entera:
 *                         es la diferencia entre un hueco y una imagen.
 *   · ENTERA              cuándo termina de bajar y empieza a moverse.
 *
 * Uso:  npm run web:peso
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { espera, cdp, evaluador } from './cdp.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'web', 'dist');
const PUERTO_WEB = 8788;
const PUERTO_CDP = 9335;

/** Velocidades reales, en bits por segundo, con su latencia. */
const REDES = [
  { nombre: 'fibra (100 Mb)', bajada: 100e6, subida: 20e6, latencia: 10 },
  { nombre: 'ADSL / 4G (20 Mb)', bajada: 20e6, subida: 5e6, latencia: 30 },
  { nombre: 'móvil flojo (4 Mb)', bajada: 4e6, subida: 1e6, latencia: 100 },
];

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(path.join(DIST, 'es', 'index.html'))) {
  console.error('\nNo hay web construida. Lanza `npm run web:build` antes.\n');
  process.exit(2);
}

const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const f = path.join(DIST, rel);
  // Nada de subir por encima de dist: es un servidor de usar y tirar, pero un
  // servidor de usar y tirar con salto de directorio sigue siendo un fallo.
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(PUERTO_WEB, '127.0.0.1', r));

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const navegador = CHROMES.find((p) => fs.existsSync(p));
if (!navegador) { console.error('\nNo hay Chrome ni Edge.\n'); process.exit(2); }

const perfil = path.join(RAIZ, 'node_modules', '.cache', 'eql-peso');
fs.mkdirSync(perfil, { recursive: true });
const chrome = spawn(navegador, [
  '--headless=new', `--remote-debugging-port=${PUERTO_CDP}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

let mal = 0;
try {
  let ficha = null;
  for (let i = 0; i < 40 && !ficha; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/list`)).json();
      ficha = l.find((x) => x.type === 'page') ?? null;
    } catch { /* todavía no */ }
    if (!ficha) await espera(400);
  }
  if (!ficha) throw new Error('el navegador no levantó el puerto de depuración');

  const { ws, manda, listo } = cdp(ficha.webSocketDebuggerUrl);
  await listo;
  const evalua = evaluador(manda);
  await manda('Network.enable');
  await manda('Page.enable');

  const idioma = process.argv[2] ?? 'es';
  console.log(`\nportada /${idioma}/ desde http://127.0.0.1:${PUERTO_WEB}\n`);

  for (const red of REDES) {
    // Caché limpia en cada pasada: medir la segunda visita mide el disco.
    await manda('Network.clearBrowserCache');
    await manda('Network.emulateNetworkConditions', {
      offline: false, latency: red.latencia,
      downloadThroughput: red.bajada / 8, uploadThroughput: red.subida / 8,
    });
    await manda('Page.navigate', { url: 'about:blank' });
    await espera(300);

    const t0 = Date.now();
    await manda('Page.navigate', { url: `http://127.0.0.1:${PUERTO_WEB}/${idioma}/index.html` });

    let pintado = null, primerFotograma = null, entera = null;
    // Se sondea la página, que es quien sabe: `naturalWidth` deja de ser 0 en
    // cuanto la cabecera del PNG ha llegado —ahí ya hay algo que enseñar— y
    // `complete` no se pone hasta que ha bajado el fichero entero.
    for (let i = 0; i < 1200 && !entera; i++) {
      const s = await evalua(`(() => {
        const im = document.querySelector('.muestra');
        return {
          pintado: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          hay: !!im, ancho: im?.naturalWidth ?? 0, lista: !!im?.complete,
        };
      })()`).catch(() => null);
      if (!s) { await espera(100); continue; }
      if (pintado === null && s.pintado) pintado = Math.round(s.pintado);
      if (primerFotograma === null && s.ancho > 0) primerFotograma = Date.now() - t0;
      if (s.hay && s.lista && s.ancho > 0) entera = Date.now() - t0;
      await espera(100);
    }

    const bytes = await evalua(`performance.getEntriesByType('resource')
      .reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0)`);

    const seg = (x) => (x === null ? '  —  ' : `${(x / 1000).toFixed(1)}s`);
    console.log(`  ${red.nombre.padEnd(20)} primer pintado ${seg(pintado)}`
      + ` · primer fotograma ${seg(primerFotograma)} · entera ${seg(entera)}`
      + `   [${(bytes / 1048576).toFixed(1)} MB]`);
    if (entera === null) { mal++; console.error('    MAL  no terminó de cargar en 2 minutos'); }
  }

  console.log('');
  ws.close();
} catch (err) {
  mal++;
  console.error(`\nMAL  ${err.message}\n`);
} finally {
  try { chrome.kill(); } catch { /* ya estaba muerto */ }
  servidor.close();
}
process.exit(mal ? 1 : 0);
