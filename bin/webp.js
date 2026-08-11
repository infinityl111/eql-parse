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

/**
 * Y LAS MINIATURAS DEL AVISO, que además hay que ENCOGER.
 *
 * Son capturas de pantalla completas de otro proyecto: 2.000 píxeles de ancho y
 * más de dos megas cada una, para enseñarse a 112 de alto. Reencodear sin
 * redimensionar ahorraría la mitad y seguiría mandando veinte veces más píxeles
 * de los que se ven.
 *
 * Se guardan al DOBLE del alto en que se enseñan, no al mismo: en una pantalla
 * de densidad doble —cualquier portátil de los últimos diez años— una imagen
 * ajustada al tamaño exacto se ve borrosa.
 */
const ALTO_MINIATURA = 232;

/**
 * Y UNA VERSIÓN GRANDE PARA VERLAS, porque la miniatura no sirve de aumento.
 *
 * Enlazar la miniatura a sí misma es lo que parece obvio y no funciona: está
 * guardada a 232 px de alto y se enseña a 112, así que «verla más grande» sería
 * verla el doble — nada. La grande se guarda al ancho en el que se lee la
 * interfaz del juego, que es para lo que uno pincha.
 */
const ANCHO_GRANDE = 1500;
const MINIATURAS = fs.existsSync(path.join(RAIZ, 'web', 'promo'))
  ? fs.readdirSync(path.join(RAIZ, 'web', 'promo'))
    .filter((f) => /^aetheria-\d+\.png$/i.test(f))
    .sort()
  : [];

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
  for (const f of MINIATURAS) {
    const origen = path.join(RAIZ, 'web', 'promo', f);
    const antes = fs.statSync(origen).size;
    const b64 = fs.readFileSync(origen).toString('base64');
    const salida = await evalua(`(async () => {
      const im = new Image();
      im.src = 'data:image/png;base64,${b64}';
      await im.decode();
      const h = ${ALTO_MINIATURA};
      const w = Math.round(im.naturalWidth * (h / im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(im, 0, 0, w, h);
      const url = c.toDataURL('image/webp', 0.86);
      if (!url.startsWith('data:image/webp')) return { error: 'este navegador no codifica WebP' };
      return { datos: url.slice(url.indexOf(',') + 1), w, h, ow: im.naturalWidth, oh: im.naturalHeight };
    })()`);
    if (salida?.error) { mal++; console.error(`  MAL  ${f}: ${salida.error}`); continue; }
    const buf = Buffer.from(salida.datos, 'base64');
    fs.writeFileSync(origen.replace(/\.png$/i, '.webp'), buf);

    // La grande, del mismo original y en la misma pasada: volver a decodificar
    // dos megas de PNG por segunda vez no aporta nada.
    const gr = await evalua(`(async () => {
      const im = new Image();
      im.src = 'data:image/png;base64,${b64}';
      await im.decode();
      const w = Math.min(${ANCHO_GRANDE}, im.naturalWidth);
      const h = Math.round(im.naturalHeight * (w / im.naturalWidth));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(im, 0, 0, w, h);
      const url = c.toDataURL('image/webp', 0.84);
      return { datos: url.slice(url.indexOf(',') + 1), w, h };
    })()`);
    const bufG = Buffer.from(gr.datos, 'base64');
    fs.writeFileSync(origen.replace(/\.png$/i, '-grande.webp'), bufG);

    // El PNG enorme no se queda en el repositorio: ya no lo enlaza nadie.
    fs.unlinkSync(origen);
    console.log(`  ok   ${f.padEnd(16)} ${salida.ow}×${salida.oh} → ${salida.w}×${salida.h}`
      + ` (${(buf.length / 1024).toFixed(0)} KB) y ${gr.w}×${gr.h} (${(bufG.length / 1024).toFixed(0)} KB)`
      + `   desde ${(antes / 1048576).toFixed(2)} MB`);
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
