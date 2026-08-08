/**
 * Rehace las capturas de la documentación desde la aplicación de verdad, en
 * los cinco idiomas y en el mismo tema.
 *
 * POR QUÉ HACÍA FALTA. Estaban hechas a mano, y a mano cada una salió el día
 * que salió: dos en tema claro, una en oscuro, las tres en inglés. Puestas en
 * fila en la portada de la web, tres temas en tres fotos leen como tres
 * programas — y la portada española enseñaba la aplicación en inglés, que es
 * justo lo contrario de lo que la web quiere decir. Nadie iba a rehacer quince
 * capturas a mano, así que el arreglo tenía que ser un script.
 *
 * Y LA WEB DEMUESTRA LA TRADUCCIÓN EN VEZ DE DECIRLA: cada página enseña la
 * aplicación en su idioma. Es lo que la separa de un medidor que sólo existe
 * en inglés, y contarlo con una frase convence menos que enseñarlo.
 *
 * EL TEMA Y EL IDIOMA SE DEVUELVEN COMO ESTABAN. Ninguno de los dos es un
 * ajuste de ventana: los dos se guardan en la configuración. Sin restaurarlos,
 * ejecutar esto le dejaría la aplicación en portugués y en oscuro a quien lo
 * lance, que es un efecto que nadie pidió.
 *
 * EL ALTO NO SE ADIVINA: SE AJUSTA HASTA QUE NO SE CORTA NADA. Ver `ajustaAlto`
 * más abajo — es la corrección de un fallo que ya se ha repetido tres veces.
 *
 * LO QUE ESTO NO PUEDE HACER: `docs/overlay.png` es el overlay ENCIMA DEL
 * JUEGO. Hace falta EverQuest corriendo, así que ésa se queda a mano.
 *
 * Uso:  npm run ui:docs [tema]     tema: dark (por defecto) o light
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador,
  capturaPagina, medirCaja, capturaComprobada, fijarTema, devolverTema } from './cdp.js';

const TEMA = process.argv[2] === 'light' ? 'light' : 'dark';
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(RAIZ, 'docs');
const ANCHO = 1500;
const ALTO_MIN = 900;
const ALTO_MAX = 2600;

/** Los mismos cinco que la web, y en el mismo orden. */
const IDIOMAS = ['es', 'en', 'fr', 'de', 'pt'];
/** El que se copia a `docs/` para los README, que enlazan un solo juego. */
const CANONICO = 'en';

/**
 * Las vistas, con los mismos identificadores que usa `ui-check.js`: los
 * rótulos están traducidos a cinco idiomas y los `id` no.
 */
const VISTAS = [
  {
    fichero: 'combate.png',
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
    ],
    espera: 1500,
  },
  {
    fichero: 'analisis.png',
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
      "document.getElementById('btnAnalyse')?.click()",
    ],
    espera: 3500,   // el análisis tarda: relee y calcula
  },
  {
    fichero: 'enciclopedia.png',
    llega: ["document.getElementById('tabEnc')?.click()"],
    espera: 2000,
  },
  {
    /**
     * EL BLOQUE DE POSTURA SOLO, que es la imagen de la cabecera de la web.
     *
     * Recortado al elemento y no a la pantalla: puesta a ancho de página, la
     * vista de combate entera no se lee en diez segundos, y ahí lo que hay que
     * entender de un vistazo es que esto no cuenta daño, dice qué cambiar.
     *
     * Se salta la pelea que no lo tenga: el bloque sólo aparece cuando la
     * aplicación ha podido deducir tus clases. Antes que una captura vacía o
     * de otra cosa, ninguna y un aviso.
     */
    fichero: 'postura.png',
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
    ],
    espera: 2000,
    recorte: '#advice',
  },
];

/**
 * AJUSTA LA VENTANA HASTA QUE EL PANEL NO TENGA NADA POR DEBAJO.
 *
 * Ésta es la corrección de un fallo que ya ha salido tres veces, y las tres
 * por lo mismo: medir el encuadre desde fuera de lo que se está mirando.
 * `capturaPagina` deduce el alto de `document.body.scrollHeight`, y esta
 * aplicación es de escritorio: cabecera fija, pie fijo y un panel que scrollea
 * POR DENTRO. El cuerpo mide siempre lo mismo pase lo que pase, así que el
 * alto deducido de ahí es el de la ventana y no el del contenido. La captura
 * sale cortada, el fichero se escribe y el script termina en verde — la
 * enciclopedia salió con dos fichas partidas por la mitad.
 *
 * Así que no se deduce: se mide DENTRO del panel, se agranda y se vuelve a
 * mirar, porque al ensanchar reflui el contenido y el sobrante cambia. Si al
 * llegar al tope sigue sobrando, revienta diciendo cuánto falta. Cortar una
 * captura es admisible; cortarla sin que nadie se entere, no.
 *
 * `#fightList` queda fuera a propósito: son 410 peleas y siempre va a
 * scrollear. Una lista está para eso. Lo que no puede quedar cortado es el
 * panel, que es lo que la captura viene a enseñar.
 *
 * Y NO SE BUSCA POR IDENTIFICADOR. El primer intento midió `#mainPane`, que
 * está en el HTML — y las quince capturas fallaron con «no existe #mainPane»,
 * porque cada vista reemplaza el contenido de `#bodyGrid` por el suyo:
 * `<main id="anView">` el análisis, `<main id="rpView">` la reproducción, un
 * `<main>` sin identificador el combate. Buscar un nombre concreto es otra vez
 * mirar desde fuera. Así que se buscan LOS QUE SCROLLEAN, sean los que sean:
 * cualquier descendiente con `overflow-y` de scroll y contenido por debajo.
 * Una vista nueva queda cubierta sin tocar esto.
 */
async function ajustaAlto(manda, evalua) {
  const MIDE = `(() => {
    const grid = document.getElementById('bodyGrid');
    if (!grid) return { no: true };
    const lista = document.getElementById('fightList');
    let peor = null;
    for (const el of [grid, ...grid.querySelectorAll('*')]) {
      if (lista && (el === lista || lista.contains(el))) continue;
      const ov = getComputedStyle(el).overflowY;
      if (ov !== 'auto' && ov !== 'scroll') continue;
      const sobra = el.scrollHeight - el.clientHeight;
      if (sobra <= 2) continue;
      if (!peor || sobra > peor.sobra) {
        peor = { sobra, quien: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '') };
      }
    }
    return peor ?? { sobra: 0, quien: null };
  })()`;

  let alto = ALTO_MIN;
  for (let i = 0; i < 7; i++) {
    await manda('Emulation.setDeviceMetricsOverride', {
      width: ANCHO, height: alto, deviceScaleFactor: 1, mobile: false,
    });
    await espera(500);
    const m = await evalua(MIDE);
    if (m?.no) return { alto, error: 'no existe #bodyGrid: la aplicación no ha montado' };
    if (m.sobra === 0) return { alto, sobra: 0 };
    if (alto >= ALTO_MAX) return { alto, sobra: m.sobra, quien: m.quien };
    alto = Math.min(ALTO_MAX, alto + m.sobra + 24);
  }
  return { alto, error: 'el alto no se estabiliza' };
}

if (!(await puertoLibre())) {
  console.error(`\nEl puerto ${PUERTO} está ocupado: cierra la otra ventana con depuración.\n`);
  process.exit(2);
}

const app = lanzar();
let mal = 0;
let temaPrevio = null;
let idiomaPrevio = null;
let evalua = null;
let manda = null;
let socket = null;

/** Cambia el idioma POR EL SELECTOR y no por IPC. */
async function ponIdioma(codigo) {
  // `window.eql.setLang` sólo guarda: el que vuelve a pintar las vistas con
  // las cadenas nuevas es el manejador del botón. Llamando al IPC a secas, las
  // capturas salían con la interfaz a medio traducir.
  const ok = await evalua(`(() => {
    document.getElementById('langBtn')?.click();
    const b = document.querySelector('.lang-item[data-code=${JSON.stringify(codigo)}]');
    if (!b) return false;
    b.click();
    return true;
  })()`);
  if (!ok) throw new Error(`no está el idioma «${codigo}» en el selector`);
  await espera(1500);
  return true;
}

try {
  const pagina = await conecta();
  const io = cdp(pagina.webSocketDebuggerUrl);
  socket = io.ws;
  await io.listo;
  await io.manda('Runtime.enable');
  await io.manda('Page.enable');
  evalua = evaluador(io.manda);
  manda = io.manda;

  await manda('Emulation.setDeviceMetricsOverride', {
    width: ANCHO, height: ALTO_MIN, deviceScaleFactor: 1, mobile: false,
  });
  await espera(3000);

  temaPrevio = await fijarTema(evalua, TEMA);
  // El idioma se lee del selector y NO de `document.documentElement.lang`:
  // ese atributo está escrito a mano en el HTML y vale «es» siempre, así que
  // devolver el idioma «como estaba» habría dejado en español a quien lo
  // tuviera en cualquier otro.
  idiomaPrevio = await evalua("document.querySelector('.lang-item.on')?.dataset.code ?? null");
  if (!idiomaPrevio) throw new Error('no se pudo leer el idioma actual del selector');
  console.log(`\ncapturas de docs/ en tema ${TEMA} (estaba en ${temaPrevio}/${idiomaPrevio})\n`);

  for (const lang of IDIOMAS) {
    await ponIdioma(lang);
    const dir = path.join(DOCS, 'i18n', lang);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ${lang}`);

    for (const v of VISTAS) {
      for (const paso of v.llega) { await evalua(paso); await espera(1400); }
      if (v.espera) await espera(v.espera);

      // El tema, en cada vista. Repintar puede releer la configuración, y una
      // sola captura clara en la fila delata el truco.
      const puesto = await evalua('document.documentElement.dataset.theme');
      if (puesto !== TEMA) {
        mal++;
        console.error(`    MAL  ${v.fichero}: la vista quedó en tema «${puesto}»`);
        continue;
      }

      const enc = await ajustaAlto(manda, evalua);
      if (enc.error) {
        mal++;
        console.error(`    MAL  ${v.fichero}: ${enc.error}`);
        continue;
      }
      if (enc.sobra > 0) {
        mal++;
        console.error(`    MAL  ${v.fichero}: «${enc.quien}» se corta por abajo, sobran`
          + ` ${enc.sobra}px con la ventana ya en el tope de ${ALTO_MAX}.`
          + ' Sube ALTO_MAX o acorta la vista.');
        continue;
      }

      let png; let medida;
      if (v.recorte) {
        // Por `capturaComprobada`, que vuelve a medir el elemento justo antes
        // de disparar: la misma puerta que todo lo demás.
        const caja = await medirCaja(evalua, v.recorte);
        if (!caja || caja.height < 40) {
          mal++;
          console.error(`    MAL  ${v.fichero}: «${v.recorte}» no está o está vacío en esta pelea`);
          continue;
        }
        png = await capturaComprobada({ manda, evalua }, v.recorte, caja);
        medida = `${caja.width}×${caja.height}`;
      } else {
        ({ png } = await capturaPagina({ manda, evalua }, ANCHO, ALTO_MAX, enc.alto));
        medida = `${ANCHO}×${enc.alto}`;
      }
      fs.writeFileSync(path.join(dir, v.fichero), png);
      if (lang === CANONICO) fs.writeFileSync(path.join(DOCS, v.fichero), png);
      console.log(`    ok   ${v.fichero.padEnd(20)} ${medida.padEnd(11)} `
        + `${(png.length / 1024).toFixed(0)} KB${lang === CANONICO ? '  (y a docs/ para los README)' : ''}`);
    }
  }

  console.log('\n  docs/overlay.png se queda como está: es el overlay encima del');
  console.log('  juego, y eso hay que capturarlo con EverQuest abierto.\n');
} catch (err) {
  mal++;
  console.error(`\nMAL  ${err.message}\n`);
} finally {
  // Tema e idioma como estaban, y ANTES de cerrar el socket y de matar la
  // aplicación: las dos cosas se guardan por IPC, y con el proceso muerto no
  // hay a quién pedírselas. Sobre todo si ha reventado a mitad, que es cuando
  // se quedarían cambiados sin que nadie lo sepa.
  if (evalua && idiomaPrevio) {
    try { await ponIdioma(idiomaPrevio); console.log(`  idioma devuelto a «${idiomaPrevio}»`); }
    catch (e) {
      mal++;
      console.error(`  MAL  no se pudo devolver el idioma a «${idiomaPrevio}»: ${e.message}`);
    }
  }
  if (!await devolverTema(evalua, temaPrevio, TEMA)) mal++;
  try { socket?.close(); } catch { /* ya estaba cerrado */ }
  try { app.kill(); } catch { /* ya estaba muerta */ }
}
process.exit(mal ? 1 : 0);
