/**
 * Una captura por SECCIÓN × IDIOMA × TEMA, de la aplicación de verdad.
 *
 * POR QUÉ EXISTE. El armazón de secciones mueve cosas de sitio, y lo único que
 * dice si algo se perdió por el camino es mirarlo. Son más de cien pantallas
 * —quince secciones, cinco idiomas, dos temas— y a mano no se revisan: se miran
 * las dos primeras, se supone el resto, y lo que se cayó estaba en la cuarenta.
 *
 * ── POR QUÉ NO PASA POR EL DEPURADOR ──────────────────────────────────────
 *
 * `bin/cdp.js` sabe hacer capturas y lleva semanas roto para esto:
 * `Page.captureScreenshot` se queda sin responder cada pocas llamadas —está
 * contado allí mismo, con su plazo y su reintento—. Con tres capturas por tanda
 * se sobrevive reintentando; con quinientas, no.
 *
 * `webContents.capturePage()` no pasa por el depurador: es el proceso principal
 * pidiéndole el fotograma a su propia ventana. Por eso este fichero ES un
 * proceso principal —se ejecuta con `electron`, no con `node`— y arranca la
 * aplicación de verdad requiriendo `electron/main.cjs`. Nada de esto toca el
 * camino roto, y nada de esto lo arregla: sigue ahí para quien lo use.
 *
 * ── LA TRAMPA DEL ARRANQUE, QUE ES LA QUE MÁS CARO SALE ───────────────────
 *
 * `electron .` lee el `package.json` de la raíz, así que la aplicación se llama
 * `eql-parse` y su configuración vive en `%APPDATA%/eql-parse`.
 * `electron bin/capturas.cjs` NO: sin `package.json` al lado, Electron la llama
 * «Electron» y le da otra carpeta — vacía. Sin log, sin histórico y sin peleas.
 *
 * Y no fallaría: levantaría la ventana, recorrería las secciones y escribiría
 * ciento cincuenta capturas de una aplicación recién instalada. Es la forma del
 * comodín que recoge de más (ver `PUBLICAR.md`, paso 8): no falla, entrega algo
 * plausible. Por eso el nombre y la carpeta se fijan aquí arriba, antes de
 * requerir nada, y por eso el recorrido exige peleas en la lista antes de
 * empezar (ver `esperaDatos` en `bin/recorrido.cjs`).
 *
 * Uso:
 *   npm run capturas -- --salida=antes
 *   npm run capturas -- --salida=despues-botin --solo=combate,botin
 *   npm run capturas -- --idiomas=es --temas=oscuro
 */
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

// ── ANTES DE REQUERIR LA APLICACIÓN: quién es y dónde vive su configuración.
app.setName('eql-parse');
app.setPath('userData', path.join(app.getPath('appData'), 'eql-parse'));

require('../electron/main.cjs');

const {
  espera, argumentos, PANEL, VISTAS, esperaFotograma, fijarIdioma, fijarTema, arranque,
} = require('./recorrido.cjs');

const args = argumentos();
const RAIZ = path.join(__dirname, '..');

/**
 * DÓNDE CAEN, y por qué es un argumento y no una constante.
 *
 * La tanda del ANTES y la del DESPUÉS son la comparación entera de este cambio.
 * Escribiéndose las dos en la misma carpeta, la segunda pisa a la primera
 * fichero a fichero —mismo nombre de sección, mismo idioma, mismo tema— y al
 * terminar no hay con qué comparar: hay una sola tanda que parece la buena.
 */
const SALIDA = path.join(RAIZ, 'tmp', `capturas${args.salida ? `-${args.salida}` : ''}`);

// El tamaño de ventana es FIJO y va aquí escrito: dos capturas del mismo sitio
// con distinta anchura no se pueden comparar, y comparar es para lo único que
// sirven. 1400×900 entra en la pantalla y deja ver la lista y el panel.
const ANCHO = +(args.ancho ?? 1400);
const ALTO = +(args.alto ?? 900);

const IDIOMAS = (args.idiomas ?? 'es,en,de,fr,pt').split(',').filter(Boolean);
const TEMAS = (args.temas ?? 'oscuro,claro').split(',').filter(Boolean);
const TEMA_CSS = { oscuro: 'dark', claro: 'light' };

const elegidas = args.solo ? args.solo.split(',') : null;
const RECORRIDO = elegidas ? VISTAS.filter((v) => elegidas.includes(v.nombre)) : VISTAS;

const TOPE_TROZOS = 4;

/**
 * UN PNG DE CERO BYTES NO ES UNA CAPTURA, Y SE ESCRIBÍA SIN CHISTAR.
 *
 * De las noventa y seis de la primera tanda, una salió vacía: la primera. La
 * ventana aún no había pintado su primer fotograma después de fijarle el
 * tamaño, `capturePage()` devolvió una imagen vacía, y `writeFileSync` la
 * escribió tan contento. En una carpeta con noventa y seis ficheros, el de cero
 * bytes no se distingue de los demás hasta que lo abres.
 *
 * Así que la captura se mide antes de escribirla —una imagen vacía es un error,
 * no un resultado— y se reintenta; y si el reintento hizo falta, se dice.
 */
async function disparoNoVacio(win, quien, veces = 4) {
  for (let i = 1; i <= veces; i++) {
    const img = await win.webContents.capturePage();
    const png = img.isEmpty() ? Buffer.alloc(0) : img.toPNG();
    if (png.length > 0) {
      if (i > 1) console.log(`       (${path.basename(quien)} salió al intento ${i} de ${veces})`);
      return png;
    }
    await espera(500);
  }
  throw new Error(`${path.basename(quien)}: cuatro capturas seguidas salieron vacías`);
}

/**
 * Dispara, y si la vista no cabe en la ventana la parte en trozos.
 *
 * Una captura recortada por abajo es la trampa de siempre: sale el fichero, el
 * script termina en verde y lo que faltaba no está en ninguna parte.
 */
async function dispara(win, ejec, destino) {
  const m = await ejec(`(() => {
    ${PANEL}
    window.__cap = panel.scrollHeight - panel.clientHeight > 8 ? panel : document.scrollingElement;
    window.__cap.scrollTop = 0;
    return { alto: window.__cap.scrollHeight, visible: window.__cap.clientHeight,
             largo: panel.textContent.trim().length };
  })()`);

  const quieren = Math.max(1, Math.ceil(m.alto / Math.max(1, m.visible)));
  const trozos = Math.min(quieren, TOPE_TROZOS);
  let viejos = 0;
  for (let i = 0; i < trozos; i++) {
    if (i) {
      await ejec(`window.__cap.scrollTop = ${i * m.visible}`);
      await espera(350);
    }
    if (!(await esperaFotograma(ejec))) viejos++;
    const png = await disparoNoVacio(win, destino);
    fs.writeFileSync(i ? destino.replace(/\.png$/, `-${i + 1}.png`) : destino, png);
  }

  /**
   * Y EL FINAL, SIEMPRE, CUANDO LA VISTA NO CABE EN LOS CUATRO TROZOS.
   *
   * Las listas largas se cortan por arriba y eso es aceptable —la fila 900 de
   * una tabla de botín no es un elemento distinto de la 12—, pero **el pie no
   * es más de lo mismo**: ahí viven las notas que cierran la sección, y son
   * elementos del inventario. `enc.lootNote`, `enc.foesGridNote` y las de
   * progreso quedaban fuera de la foto en las seis secciones largas, y sin
   * decirlo: «24.234 px sin capturar» se lee como «más filas».
   *
   * Un disparo más al final y el corte pasa a ser sólo del medio.
   */
  let fin = false;
  if (quieren > TOPE_TROZOS) {
    await ejec('window.__cap.scrollTop = window.__cap.scrollHeight');
    await espera(350);
    if (!(await esperaFotograma(ejec))) viejos++;
    const png = await disparoNoVacio(win, destino);
    fs.writeFileSync(destino.replace(/\.png$/, '-fin.png'), png);
    fin = true;
  }

  await ejec('window.__cap.scrollTop = 0');
  return {
    trozos,
    largo: m.largo,
    viejos,
    fin,
    fuera: quieren > TOPE_TROZOS ? m.alto - TOPE_TROZOS * m.visible : 0,
  };
}

let mal = 0;

app.whenReady().then(async () => {
  const { win, ejec, peleas, idiomaPrevio } = await arranque(app, { ancho: ANCHO, alto: ALTO });

  fs.mkdirSync(SALIDA, { recursive: true });
  const temaPrevio = await ejec("document.documentElement.dataset.theme || 'dark'");
  console.log(`\n${peleas} peleas en la lista · ${RECORRIDO.length} secciones × `
    + `${IDIOMAS.length} idiomas × ${TEMAS.length} temas\n`);

  try {
    for (const tema of TEMAS) {
      await fijarTema(ejec, TEMA_CSS[tema] ?? 'dark');
      for (const idioma of IDIOMAS) {
        await fijarIdioma(ejec, idioma);
        const dir = path.join(SALIDA, `${idioma}-${tema}`);
        fs.mkdirSync(dir, { recursive: true });
        for (const v of RECORRIDO) {
          for (const paso of v.pasos) { await ejec(paso); await espera(900); }
          if (v.espera) await espera(v.espera);
          const destino = path.join(dir, `${v.nombre}.png`);
          // Que la sección haya llegado a pintar algo. Una captura de un panel
          // vacío es indistinguible de una captura correcta de una sección que
          // hoy no tiene datos, y esa diferencia es justo la que hay que ver.
          const { trozos, fuera, largo, viejos, fin } = await dispara(win, ejec, destino);
          const flojo = largo < 40;
          if (flojo || viejos) mal++;
          console.log(`  ${flojo || viejos ? 'MAL' : 'ok '}  ${idioma}-${tema} ${v.nombre.padEnd(14)}`
            + `${trozos > 1 ? ` · ${trozos} trozos` : ''}`
            + `${fin ? ' + el final' : ''}`
            + `${fuera ? ` · ${fuera} px del medio sin capturar` : ''}`
            + `${viejos ? ` · ${viejos} SIN FOTOGRAMA NUEVO (la ventana estaba tapada)` : ''}`
            + `${flojo ? ' · el panel salió vacío' : ''}`);
        }
      }
    }
  } finally {
    try {
      await fijarTema(ejec, temaPrevio);
      await fijarIdioma(ejec, idiomaPrevio);
      console.log(`\n  devuelto a «${idiomaPrevio}» y tema «${temaPrevio}»`);
    } catch (e) {
      console.error(`\n  MAL  no se pudo devolver idioma/tema: ${e.message}`);
      console.error('       cámbialos a mano en la aplicación.');
      mal++;
    }
  }

  console.log(`\n  capturas en ${SALIDA}\n`);
  app.exit(mal ? 1 : 0);
}).catch((e) => {
  console.error(`\n  MAL  ${e.message}\n`);
  app.exit(2);
});
