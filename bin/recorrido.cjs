/**
 * El recorrido por las secciones, en un solo sitio: lo comparten `capturas` y
 * `pliegue`, para que mover una sección no deje a una de las dos dando verdes
 * de una pantalla que ya no existe.
 *
 * Quien lo requiera tiene que haber fijado ANTES el nombre y la carpeta de la
 * aplicación y haber requerido `electron/main.cjs`: eso depende de ser el
 * proceso principal y aquí no se puede hacer.
 */
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * NINGUNA ESPERA SIN PLAZO.
 *
 * El capturador esperaba a `requestAnimationFrame` para asegurarse de que la
 * ventana había pintado. Con la ventana tapada por otra, el navegador deja de
 * programar fotogramas: la promesa no se resolvió nunca y el recorrido se quedó
 * diez minutos sin escribir un fichero ni un error — la misma forma exacta del
 * cuelgue que está contado en `bin/cdp.js`.
 */
const conPlazo = (promesa, ms, quien) => Promise.race([
  promesa,
  espera(ms).then(() => { throw new Error(`«${quien}» no respondió en ${ms / 1000}s`); }),
]);

/** Los argumentos de la línea de órdenes, en un objeto. */
const argumentos = () => Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--'))
  .map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)];
  }));

/**
 * CUÁL ES EL PANEL DE CONTENIDO, que no es el que dice `index.html`.
 *
 * El esqueleto trae `<main id="mainPane">`, pero `renderApp()` reescribe
 * `#bodyGrid` entero y lo que queda dentro cambia de nombre según la vista:
 * `main` sin identificador en Combate, `#anView` en Análisis, `.tabpane` en la
 * Enciclopedia. Preguntar por `#mainPane` devuelve `null` SIEMPRE.
 *
 * Lo estable es la POSICIÓN: el contenido es el último hijo de `#bodyGrid`. El
 * primero, cuando hay dos, es la lista de peleas — que scrollea 6.300 px con
 * noventa peleas y se llevaría el recorte entero si se eligiera «el que más
 * scrollea».
 */
const PANEL = 'const panel = document.querySelector("#bodyGrid > :last-child") ?? document.body;';

/**
 * Cómo se llega a cada sección.
 *
 * SE NAVEGA POR IDENTIFICADOR, NUNCA POR TEXTO. Son cinco idiomas: un paso que
 * busque «Combate» no encuentra nada en inglés y la sección sale vacía — que se
 * lee como «esto está roto» y no lo está. El aprendizaje es de `bin/ui-check.js`.
 */
/**
 * PULSAR DICE SI HA PULSADO ALGO, y eso no es un detalle.
 *
 * Antes devolvía `undefined` pulsara o no. Un paso que no encuentra su elemento
 * —porque la pantalla anterior todavía estaba cargando— no hacía nada, el
 * recorrido seguía, y la sección se fotografiaba donde estuviera. Salieron así
 * `documentos` = `combate` en siete de diez capturas del ANTES y `enemigo` =
 * `enemigos` en nueve de diez de la sexta mudanza: fotos perfectas de la
 * pantalla equivocada, con su nombre correcto encima.
 *
 * Devolviendo `true`/`false` el que llama puede esperar y, si no aparece nunca,
 * decirlo en rojo en vez de fotografiar lo que hubiera.
 */
const pulsa = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)});`
  + ' if (!el) return false; el.click(); return true; })()';
const PELEA = '.fight[data-live="0"]';

const VISTAS = [
  // La vista vieja de Combate ya no pinta nada —las cuatro secciones de «esta
  // pelea» se lo han llevado todo— así que sale del recorrido: dejarla daría un
  // «el panel salió vacío» en rojo en cada tanda, y un rojo permanente que es
  // correcto entrena a ignorar los rojos. Vuelve si alguna vez vuelve a tener
  // contenido; se quita del todo con las pestañas, en la mudanza 10.
  {
    // Los documentos viven dentro de «Por habilidad» desde la mudanza 3: se
    // entra por la sección y se abre la última pestaña, que es la que nunca
    // está abierta por defecto.
    nombre: 'documentos',
    pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="habilidad"]'),
      '[...document.querySelectorAll(".doctab")].at(-1)?.click()'],
  },
  { nombre: 'registro', pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="registro"]')],
    espera: 3000 },
  // Las secciones del armazón nuevo se abren por la barra lateral. `data-sec`
  // no se traduce, igual que los identificadores de las pestañas viejas.
  { nombre: 'escena', pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="escena"]')] },
  { nombre: 'habilidad', pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="habilidad"]')] },
  { nombre: 'botin', pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="botin"]')] },
  { nombre: 'analisis', pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="analisis"]')] },
  { nombre: 'resumen', pasos: [pulsa('[data-sec="resumen"]')], espera: 2500 },
  // El botón de reproducir vive en la cabecera de la pelea, que se mudó a la
  // sección Escena en la mudanza 2: entrando por la pestaña vieja ya no hay
  // botón que pulsar, y la tanda salía fotografiando el Combate vacío. Lo cazó
  // la comprobación de «el panel salió vacío», diez veces seguidas.
  { nombre: 'reproduccion',
    pasos: [pulsa('[data-sec="escena"]'), pulsa(PELEA), pulsa('[data-sec="escena"]'), pulsa('#btnReplay')],
    espera: 2500 },
  { nombre: 'avisos', pasos: [pulsa('[data-sec="avisos"]')], espera: 2500 },
  { nombre: 'preferencias', pasos: [pulsa('[data-sec="preferencias"]')], espera: 2500 },
  { nombre: 'zonas', pasos: [pulsa('[data-sec="zonas"]')], espera: 2500 },
  { nombre: 'enemigos', pasos: [pulsa('[data-sec="enemigos"]')], espera: 3000 },
  { nombre: 'botin-h', pasos: [pulsa('[data-sec="botin-h"]')], espera: 3000 },
  { nombre: 'hechizos', pasos: [pulsa('[data-sec="hechizos"]')], espera: 3000 },
  { nombre: 'progreso', pasos: [pulsa('[data-sec="progreso"]')], espera: 3000 },
  { nombre: 'muertes', pasos: [pulsa('[data-sec="muertes"]')], espera: 2500 },
  {
    nombre: 'hechizo',
    pasos: [pulsa('[data-sec="hechizos"]'), pulsa('.cat-row.abre')],
    espera: 2500,
  },
  {
    nombre: 'enemigo',
    pasos: [pulsa('[data-sec="enemigos"]'), pulsa('.encrow.foe .nm')],
    espera: 3000,
  },
];

/** La ventana principal, cuando exista y haya terminado de cargar. */
function ventanaPrincipal(app) {
  return new Promise((res, rej) => {
    const reloj = setTimeout(() => rej(new Error('la ventana principal no apareció en 60 s')), 60_000);
    app.on('browser-window-created', (_e, win) => {
      win.webContents.once('did-finish-load', () => {
        // El overlay usa el mismo preload y la misma clase: se distingue por lo
        // que carga, no por ser el primero.
        if (!win.webContents.getURL().includes('index.html')) return;
        clearTimeout(reloj);
        res(win);
      });
    });
  });
}

/**
 * Que la aplicación tenga DATOS antes de empezar.
 *
 * Sin esto, una carpeta de configuración equivocada o un log que ya no está dan
 * exactamente lo mismo que un arranque lento: una ventana en pie y ni una
 * pelea. La diferencia es que lo segundo se arregla esperando y lo primero no,
 * y la única forma de no confundirlos es poner un plazo y reventar al pasarlo.
 */
async function esperaDatos(ejec) {
  for (let i = 0; i < 60; i++) {
    const n = await ejec('document.querySelectorAll(".fight").length');
    if (n > 0) return n;
    await espera(1000);
  }
  throw new Error('la lista de peleas sigue vacía después de 60 s: '
    + '¿es ésta la carpeta de configuración con tu histórico?');
}

/**
 * UNA VENTANA TAPADA DEVUELVE EL FOTOGRAMA DE ANTES.
 *
 * Con la ventana detrás de otra, Chromium deja de componer: `capturePage()`
 * sigue contestando —rápido, con una imagen válida y sin un solo error— pero lo
 * que devuelve es lo ÚLTIMO que se pintó. `requestAnimationFrame` sólo se
 * ejecuta cuando el compositor produce fotogramas, así que sirve de acuse de
 * recibo: si vuelve, lo que se mida o capture a continuación es NUEVO.
 */
async function esperaFotograma(ejec) {
  try {
    await conPlazo(ejec('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'),
      5000, 'un fotograma nuevo');
    return true;
  } catch { return false; }
}

/**
 * EL IDIOMA Y EL TEMA SON CONFIGURACIÓN, NO ESTADO DE VENTANA.
 *
 * Los dos se guardan en `config.json`, así que tocarlos se los cambia a quien
 * ejecute esto. Quien los cambie tiene que devolverlos, y decirlo en voz alta
 * si no puede. La lección es de `cdp.js`.
 */
async function fijarIdioma(ejec, code) {
  await ejec(pulsa(`#langPick .lang-item[data-code="${code}"]`));
  await espera(700);
}

async function fijarTema(ejec, css) {
  const ahora = await ejec("document.documentElement.dataset.theme || 'dark'");
  if (ahora === css) return;
  await ejec(pulsa('#btnTheme'));
  await espera(500);
}

/**
 * Arranca, coloca la ventana y espera a que haya datos.
 *
 * La ventana va DELANTE y sin frenos a propósito: tapada o en segundo plano
 * deja de producir fotogramas, y entonces lo que se capture es el pasado.
 */
async function arranque(app, { ancho = 1400, alto = 900, idioma = null } = {}) {
  const win = await ventanaPrincipal(app);
  // Electron dice «Script failed to execute» y nada más: sin saber QUÉ paso
  // reventó, un recorrido de quince secciones no se depura.
  const ejec = async (js) => {
    try { return await win.webContents.executeJavaScript(js, true); }
    catch (e) { throw new Error(`${e.message}\n       al evaluar: ${js.slice(0, 120)}`); }
  };
  if (win.isMaximized()) win.unmaximize();
  win.setContentSize(ancho, alto);
  win.webContents.setBackgroundThrottling(false);
  win.show();
  win.focus();
  await espera(2500);
  if (!(await esperaFotograma(ejec))) {
    console.log('  (aviso: la ventana no está pintando fotogramas — ponla delante)');
  }
  const peleas = await esperaDatos(ejec);
  const idiomaPrevio = await ejec('window.eql.getConfig().then((c) => c.lang)');
  if (idioma && idioma !== idiomaPrevio) await fijarIdioma(ejec, idioma);
  return { win, ejec, espera, peleas, idiomaPrevio };
}

/**
 * Da un paso del recorrido, esperando a que exista lo que hay que pulsar.
 *
 * Nueve segundos de plazo: la rejilla de enemigos tarda tres en pintarse con
 * cuatrocientas fichas y sus retratos. Si al cabo no aparece, se devuelve
 * `false` y quien llama decide — pero nadie sigue como si hubiera pulsado.
 */
async function paso(ejec, js, plazo = 9000) {
  const hasta = Date.now() + plazo;
  for (;;) {
    const r = await ejec(js);
    // Un paso que no es un `pulsa` devuelve otra cosa: se da por hecho.
    if (r !== false) return true;
    if (Date.now() > hasta) return false;
    await espera(400);
  }
}

module.exports = {
  espera, conPlazo, argumentos, PANEL, pulsa, paso, VISTAS,
  ventanaPrincipal, esperaDatos, esperaFotograma, fijarIdioma, fijarTema, arranque,
};
