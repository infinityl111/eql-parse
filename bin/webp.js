/**
 * Convierte capturas a WebP para la web, sin añadir una dependencia.
 *
 * EL PROBLEMA. `docs/overlay.png` son 2,9 MB: es una foto del juego, y PNG es
 * el formato equivocado para una foto —comprime sin pérdida un contenido que
 * no la necesita—. Puesta en la portada, una sola imagen pesaba más que el
 * resto de la página junta.
 *
 * POR QUÉ NO UNA LIBRERÍA. El proyecto no tiene dependencias de ejecución y
 * las de desarrollo son dos. Un codificador de WebP en npm son varios megas de
 * binarios por plataforma para convertir una imagen de vez en cuando.
 *
 * LO QUE SE USA EN SU LUGAR: el Chrome que ya está en la máquina y que ya
 * conducimos por CDP para las capturas. Un canvas y `toDataURL('image/webp')`
 * — el codificador lo trae el navegador.
 *
 * EL PNG NO SE BORRA. Los README de GitHub siguen apuntando a él, y el WebP es
 * sólo para la web. Se escribe al lado y `web/build.mjs` lo prefiere si está.
 *
 * Uso:  npm run web:webp
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { espera, cdp, evaluador } from './cdp.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(RAIZ, 'docs');
const PUERTO = 9334;   // no el de `cdp.js`: esto no habla con la aplicación

/**
 * Qué se convierte y con qué calidad.
 *
 * Sólo la foto del juego. Las capturas de la interfaz son texto pequeño sobre
 * fondo plano: ahí WebP con pérdida emborrona los rótulos y apenas ahorra,
 * porque el PNG ya comprime muy bien las zonas planas. Se convierte lo que
 * gana, no todo lo que se puede.
 */
const IMAGENES = [
  { fichero: 'overlay.png', calidad: 0.82 },
];

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const navegador = CHROMES.find((p) => fs.existsSync(p));
if (!navegador) {
  console.error('\nNo hay Chrome ni Edge en las rutas conocidas. Sin navegador no hay');
  console.error('codificador de WebP: la web se construye igual, con los PNG.\n');
  process.exit(2);
}

const perfil = path.join(RAIZ, 'node_modules', '.cache', 'eql-webp');
fs.mkdirSync(perfil, { recursive: true });
const chrome = spawn(navegador, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

let mal = 0;
try {
  let ficha = null;
  for (let i = 0; i < 40 && !ficha; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      ficha = l.find((x) => x.type === 'page') ?? null;
    } catch { /* todavía no ha levantado */ }
    if (!ficha) await espera(400);
  }
  if (!ficha) throw new Error('el navegador no levantó el puerto de depuración');

  const { ws, manda, listo } = cdp(ficha.webSocketDebuggerUrl);
  await listo;
  const evalua = evaluador(manda);

  console.log(`\nconvirtiendo a WebP con ${path.basename(navegador)}\n`);
  for (const img of IMAGENES) {
    const origen = path.join(DOCS, img.fichero);
    if (!fs.existsSync(origen)) { console.log(`  (falta ${img.fichero})`); continue; }
    const antes = fs.statSync(origen).size;
    const b64 = fs.readFileSync(origen).toString('base64');

    /**
     * Se decodifica y se vuelve a codificar EN EL NAVEGADOR. El tamaño se lee
     * de la imagen decodificada, no se supone: una captura escalada por el
     * `deviceScaleFactor` no mide lo que dice su nombre.
     */
    const salida = await evalua(`(async () => {
      const im = new Image();
      im.src = 'data:image/png;base64,${b64}';
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      const url = c.toDataURL('image/webp', ${img.calidad});
      // Si el navegador no supiera WebP devolvería un PNG sin avisar.
      if (!url.startsWith('data:image/webp')) return { error: 'este navegador no codifica WebP' };
      return { datos: url.slice(url.indexOf(',') + 1), w: im.naturalWidth, h: im.naturalHeight };
    })()`);

    if (salida?.error) { mal++; console.error(`  MAL  ${img.fichero}: ${salida.error}`); continue; }
    const buf = Buffer.from(salida.datos, 'base64');

    // No se escribe un WebP que pese más que su PNG: pasa con imágenes muy
    // planas, y quedarse con el grande y llamarlo optimización es peor que no
    // hacer nada.
    if (buf.length >= antes) {
      console.log(`  --   ${img.fichero}: el WebP no baja (${(buf.length / 1024).toFixed(0)} KB`
        + ` frente a ${(antes / 1024).toFixed(0)} KB). Se queda el PNG.`);
      continue;
    }
    const destino = origen.replace(/\.png$/, '.webp');
    fs.writeFileSync(destino, buf);
    console.log(`  ok   ${img.fichero.padEnd(16)} ${salida.w}×${salida.h}  `
      + `${(antes / 1048576).toFixed(2)} MB → ${(buf.length / 1024).toFixed(0)} KB`
      + `  (${(100 - buf.length / antes * 100).toFixed(0)}% menos)`);
  }
  ws.close();
  console.log('');
} catch (err) {
  mal++;
  console.error(`\nMAL  ${err.message}\n`);
} finally {
  try { chrome.kill(); } catch { /* ya estaba muerto */ }
}
process.exit(mal ? 1 : 0);
