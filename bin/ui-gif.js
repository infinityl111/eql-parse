/**
 * Una muestra animada de la reproducción, capturada de la aplicación de verdad.
 *
 * POR QUÉ ASÍ Y NO GRABANDO A MANO. Una grabación es de un día y de una versión:
 * cambias la interfaz y ya no vale, y nadie se acuerda de rehacerla. Esto se
 * vuelve a lanzar y sale otra vez, con lo que haya ahora.
 *
 * QUÉ PRODUCE. Un APNG, no un GIF. Un GIF exige reducir a 256 colores y
 * comprimir con LZW, y para hacerlo bien haría falta ffmpeg o ImageMagick — en
 * esta máquina no hay ninguno de los dos, y el `convert` de System32 es el que
 * convierte FAT a NTFS. El APNG se monta con lo que Chromium ya escribe al
 * capturar, sin recomprimir y sin perder un color. Ver `bin/apng.js`.
 *
 * Uso:  node bin/ui-gif.js [opciones]
 *
 *   --pelea "Nagafen"   sólo peleas cuyo nombre contenga eso
 *   --x 3               a cuántas veces la realidad se ve el clip (por defecto 1)
 *   --segundos 30       cuántos segundos de pelea capturar (por defecto 20)
 *   --salida nagafen    cómo se llama el fichero (por defecto «reproduccion»)
 *
 * Ejemplos:
 *   npm run ui:gif                                  la muestra de la web
 *   npm run ui:gif -- --pelea Nagafen --x 3 --salida nagafen
 *   npm run ui:gif -- --pelea "Cazic-Thule" --x 2 --segundos 40 --salida cazic
 *
 * LA DE LA WEB NO SE PISA. Sin `--salida` escribe `reproduccion.apng.png`, que
 * es la que usa `web/build.mjs`; con `--salida` escribe otro fichero y no toca
 * esa ni su resguardo de cifras. Sacar un clip para Discord no debería obligar
 * a rehacer la portada.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador,
  medirCaja, capturaComprobada, fijarTema, devolverTema } from './cdp.js';
import { montarAPNG, revisarAPNG } from './apng.js';

/** Opciones con nombre. Las posicionales de antes ya no se usaban en ningún sitio. */
const ARGS = process.argv.slice(2);
const opt = (nombre, porDefecto = null) => {
  const i = ARGS.indexOf(`--${nombre}`);
  return i >= 0 && ARGS[i + 1] !== undefined ? ARGS[i + 1] : porDefecto;
};

const SEGUNDOS = Number(opt('segundos', 20));
const NOMBRE = String(opt('salida', 'reproduccion')).replace(/[^a-z0-9_-]/gi, '');
const ES_LA_DE_LA_WEB = NOMBRE === 'reproduccion';

/**
 * Una pelea concreta, por si la automática no enseña lo que se quiere enseñar.
 *
 * El criterio de abajo elige por duración y por retrato, que es lo que hace
 * falta para que la muestra se vea. Lo que NO mira es si en esa pelea pasa lo
 * que quieres demostrar: la primera muestra con barra de casteo salió de una
 * pelea con tres barras y CERO casteos pasados de lo esperado, así que la
 * marca del exceso —lo que más información lleva— no aparecía por ninguna
 * parte. Comprobarlo automáticamente costaría medir la tabla de casteos de
 * cada candidata, unos tres segundos por pelea.
 */
const FILTRO = opt('pelea', null);

const SALIDA = path.join(os.tmpdir(), 'eql-ui-check');
fs.mkdirSync(SALIDA, { recursive: true });

/**
 * Cada cuánto se captura, y por qué no es el paso de la reproducción.
 *
 * Los flotantes viven entre 400 y 1.000 ms según la velocidad. Capturando una
 * vez por segundo de pelea saldrían siempre en la misma fase —recién nacidos— y
 * la muestra no enseñaría lo que se ve al mirarla. A 8 por segundo se ven subir.
 */
const MS_CAPTURA = 125;

/**
 * CUÁNTAS VECES LA REALIDAD, y por qué no es lo mismo que la velocidad del
 * reproductor.
 *
 * La aplicación sólo tiene tres velocidades —×1, ×2 y ×5— porque son las que
 * un jugador va a usar mirando una pelea. Un clip para Discord es otra cosa:
 * ahí lo que importa es que se lea, y ×3 no existe en la aplicación.
 *
 * Pero la velocidad del clip sale de DOS cosas: a qué velocidad corre la
 * reproducción mientras se captura, y cada cuánto se enseña cada fotograma
 * después. Con eso se llega a cualquier múltiplo:
 *
 *     veces = velocidad del reproductor × (125 ms / retraso del fotograma)
 *
 * Para ×3 se reproduce a ×2 y se enseña a 83 ms — la de la aplicación más
 * cercana, para que los flotantes se muevan como se mueven de verdad, y el
 * retraso ajusta el resto. Se imprimen las dos cifras: es una deducción, y una
 * deducción que no se enseña no se puede comprobar.
 */
const VECES = Math.max(0.25, Math.min(10, Number(opt('x', 1))));
const VELOCIDADES_APP = [1, 2, 5];
const VELOCIDAD = VELOCIDADES_APP.reduce((a, b) =>
  (Math.abs(b - VECES) < Math.abs(a - VECES) ? b : a));
const MS = Math.max(20, Math.round(MS_CAPTURA * VELOCIDAD / VECES));

if (!(await puertoLibre())) {
  console.error(`\nEl puerto ${PUERTO} está ocupado: cierra la otra ventana con depuración.\n`);
  process.exit(2);
}

/**
 * El tema de la muestra. La web y las capturas de `docs/` van en oscuro: una
 * muestra clara entre ellas se ve como otro programa.
 */
const TEMA = process.env.EQL_GIF_TEMA === 'light' ? 'light' : 'dark';

const app = lanzar();
let mal = 0;
let temaPrevio = null;
let evalua = null;
let socket = null;
try {
  const pagina = await conecta();
  const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
  socket = ws;
  await listo;
  await manda('Runtime.enable');
  await manda('Page.enable');
  evalua = evaluador(manda);

  /**
   * EL TAMAÑO SE FIJA ANTES DE NADA, y esto es un arreglo, no una precaución.
   *
   * El recorte de la captura se calcula UNA vez y se usa para todos los
   * fotogramas. Si la ventana cambia de tamaño por el camino —Electron
   * restaura sus dimensiones guardadas un par de segundos después de abrir— el
   * recorte deja de encuadrar lo mismo: como los dos bandos van pegados al
   * centro, al ensancharse la ventana los aliados se van a la derecha y los
   * enemigos se salen del recorte.
   *
   * El resultado era una muestra que empezaba bien y a los pocos segundos
   * enseñaba a los tuyos peleando contra un enemigo que no se ve, con la mitad
   * izquierda vacía. Nada de eso pasaba en la aplicación: pasaba en la cámara.
   */
  await manda('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 860, deviceScaleFactor: 1, mobile: false,
  });
  await espera(3000);

  temaPrevio = await fijarTema(evalua, TEMA);
  console.log(`\ntema ${TEMA} (estaba en ${temaPrevio})`);
  // Las dos cifras de las que sale la velocidad del clip, dichas antes de
  // empezar: son una deducción, y una deducción que no se enseña no se puede
  // comprobar. Si se pide ×3 y sale «×2 y 83 ms», se ve de dónde viene.
  console.log(`clip a ×${VECES} — reproductor a ×${VELOCIDAD}, ${MS} ms por fotograma`
    + (VECES !== VELOCIDAD ? `  (la aplicación no tiene ×${VECES}: se ajusta el retraso)` : ''));
  console.log(`salida «${NOMBRE}»${ES_LA_DE_LA_WEB ? ' — LA DE LA WEB, se va a reemplazar' : ' — la de la web no se toca'}`
    + (FILTRO ? `  ·  sólo peleas con «${FILTRO}»` : ''));

  // Llegar a la reproducción de una pelea concreta. Por identificadores, no por
  // el texto de los botones: la aplicación tiene cinco idiomas.
  console.log('\nabriendo la reproducción…');
  await evalua("document.querySelector('[data-sec=escena]')?.click()");
  await espera(1200);
  /**
   * EL HISTÓRICO ENTERO, no las últimas 24 horas.
   *
   * La lista arranca filtrada a un día. Una pelea contra Nagafen o Cazic-Thule
   * puede ser de hace un mes: buscarla ahí es no encontrarla, y el mensaje
   * diría «ninguna cumple el criterio» sin que nadie sospeche del filtro.
   */
  await evalua(`(() => {
    const s = document.getElementById('fltRange');
    if (!s) return false;
    s.value = 'all';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await espera(1500);
  /**
   * LA PELEA SE ELIGE POR CRITERIO Y NO POR POSICIÓN.
   *
   * «La primera de la lista» depende del filtro y del histórico de quien lo
   * lance, así que la muestra saldría distinta en cada máquina.
   *
   * Y el criterio incluye QUE EL ENEMIGO PRINCIPAL TENGA RETRATO. Sin eso salía
   * una pelea contra «a ghoul sentinel», que no lo tiene, y la muestra enseñaba
   * dos siluetas genéricas — cuando lo que hay que enseñar es el reproductor
   * con cara. De tus 196 enemigos sólo 51 tienen retrato, pero son el 58% del
   * daño y ocho de los diez principales: buscarlo merece la pena.
   *
   * Si ninguna lo cumple se avisa y se coge la mejor que haya, en vez de no
   * sacar nada: una muestra con siluetas es peor que una con retratos, pero
   * mucho mejor que ninguna.
   */
  const elegir = async (exigirRetrato, saltar = 0) => evalua(`(async () => {
    const cartas = [...document.querySelectorAll('.fight[data-live="0"]')];
    let vistas = 0;
    for (const c of cartas) {
      const txt = c.querySelector('.fight-sub')?.textContent ?? '';
      const m = txt.match(/(?:(\\d+)m\\s*)?(\\d+)s/);
      const segs = m ? (+(m[1] ?? 0)) * 60 + (+m[2]) : 0;
      if (segs < ${SEGUNDOS + 5}) continue;
      const nombre = c.querySelector('.fight-name')?.textContent ?? '?';
      ${FILTRO ? `if (!nombre.toLowerCase().includes(${JSON.stringify(String(FILTRO).toLowerCase())})) continue;` : ''}
      if (${exigirRetrato ? 'true' : 'false'}) {
        // El primer nombre de la etiqueta es el enemigo principal.
        const principal = nombre.split(',')[0].replace(/\\s*×\\d+\\s*$/, '').trim();
        const pares = await window.eql.foePortraits?.([principal]);
        if (!pares?.length || !pares[0]?.[1]) continue;
      }
      // Las ya probadas se saltan aquí y no antes: el salto cuenta candidatas
      // que cumplen TODO lo anterior, no cartas de la lista.
      if (vistas++ < ${saltar}) continue;
      c.click();
      return nombre;
    }
    return null;
  })()`);

  /** Abre la reproducción de la pelea ya seleccionada y lee sus umbrales. */
  const abrirReproduccion = async () => {
    await espera(1200);
    await evalua("document.getElementById('btnReplay')?.click()");
    await espera(3000);
    if (!await evalua("!!document.querySelector('.rp-escena')")) {
      throw new Error('la reproducción no llegó a montarse');
    }
    const r = await evalua(`(() => {
      const el = document.getElementById('rpReglas');
      if (!el) return null;
      return { pico: +el.dataset.pico, mediana: +el.dataset.mediana, conForma: el.dataset.forma === '1',
        // Los combatientes sin bando montan su propio bloque, y ese bloque
        // aparece cuando entran — a mitad de la reproducción. La escena crece,
        // le sale barra de desplazamiento y el recorte deja de encuadrar lo
        // mismo: la comprobación saltó en el fotograma 36 con «an abhorrent, a
        // haunted chest, an ire ghast». Para la muestra se prefiere una pelea
        // donde todo el mundo tenga bando y la caja no se mueva.
        sinBando: !!document.querySelector('.rp-sinbando') };
    })()`);
    if (!r || !Number.isFinite(r.pico)) {
      throw new Error('la reproducción no anotó los umbrales medidos en #rpReglas');
    }
    return r;
  };

  /**
   * LA PELEA DE LA MUESTRA TIENE QUE TENER FORMA DEL GOLPE.
   *
   * No es rigor de más: es que la portada enseña EL REPRODUCTOR, no el rigor.
   * Para el rigor está «Qué mide» entera. En una pelea guardada antes de que
   * se contara la forma del golpe, el pie dice que esa regla no se puede
   * aplicar — correcto en la aplicación, donde significa «a este dato le falta
   * origen», y una disculpa en la portada, donde se lee como que al producto
   * le faltan datos.
   *
   * Sólo se sabe al abrir la reproducción, así que se prueba y, si no la
   * tiene, se pasa a la siguiente candidata. Si ninguna de las primeras la
   * tiene, se usa la mejor que haya y SE DICE: una muestra con esa nota es
   * peor que sin ella, y mucho mejor que ninguna muestra.
   */
  // Con un filtro puesto hay muchas menos candidatas y conviene mirar más
  // lejos antes de rendirse; sin filtro, seis bastan y cada intento cuesta.
  const MAX_INTENTOS = FILTRO ? 20 : 6;
  let elegida = null;
  let reglas = null;
  let indice = 0;
  for (let i = 0; i < MAX_INTENTOS; i++) {
    const cand = await elegir(true, i);
    // Se acabaron las candidatas: se queda la última que sí se abrió.
    if (!cand) break;
    elegida = cand; indice = i;
    reglas = await abrirReproduccion();
    if (reglas.conForma && !reglas.sinBando) break;
    console.log(`  («${elegida}» ${reglas.sinBando ? 'tiene combatientes sin bando y la escena crece a mitad'
      : 'se guardó antes de la forma del golpe'}; probando otra)`);
    await evalua("document.querySelector('[data-sec=escena]')?.click()");
    await espera(1200);
  }
  if (!elegida) {
    console.log('  (ninguna pelea larga tiene retrato de su enemigo principal)');
    elegida = await elegir(false);
    if (!elegida) throw new Error(`no hay ninguna pelea cerrada de ${SEGUNDOS + 5}s o más en la lista`);
    reglas = await abrirReproduccion();
  }

  /**
   * VOLVER A DEJAR LA REPRODUCCIÓN ABIERTA.
   *
   * El bucle de arriba vuelve a la pestaña de combate para probar la siguiente
   * candidata, así que si se agota sin encontrar forma —o si `elegir` se queda
   * sin candidatas— lo que queda en pantalla es la lista, no la reproducción.
   * La primera versión de esto reventaba justo después con un `null` al buscar
   * `#rpReglas`, después de haber elegido bien la pelea. Se comprueba y se
   * reabre en vez de darlo por hecho.
   */
  if (!await evalua("!!document.querySelector('.rp-escena')")) {
    await elegir(true, indice);
    reglas = await abrirReproduccion();
    if (!await evalua("!!document.querySelector('.rp-escena')")) {
      throw new Error(`no se pudo reabrir la reproducción de «${elegida}»`);
    }
  }
  console.log(`  pelea: ${elegida}`);
  if (!reglas.conForma) {
    console.log('  OJO  esta pelea no lleva forma del golpe: el pie de la muestra');
    console.log('       dirá que esa regla no se aplica. Rehaz el histórico o pon');
    console.log('       otra pelea con el tercer argumento.');
  }
  if (reglas.sinBando) {
    console.log('  OJO  esta pelea tiene combatientes sin bando: su bloque aparece');
    console.log('       cuando entran y la escena crece, así que la comprobación de');
    console.log('       encuadre puede saltar a mitad de la captura.');
  }

  // La velocidad, y a reproducir.
  if (VELOCIDAD !== 1) {
    await evalua(`document.querySelector('.rp-v[data-vel="${VELOCIDAD}"]')?.click()`);
  }

  // El recorte: sólo la reproducción, no la ventana entera. Una captura de
  // 1.500 píxeles de ancho por sesenta fotogramas son quince megas de muestra.
  // El ancho de salida. Un fotograma completo por cada 125 ms suma rápido: a
  // tamaño natural, catorce segundos daban 8,5 MB. A 640 de ancho baja a un
  // tercio y sigue leyéndose el panel de texto, que es lo más pequeño.
  const ANCHO_MAX = Number(process.env.EQL_GIF_ANCHO ?? 640);

  /**
   * LA LÍNEA DE LOS UMBRALES SE QUEDA FUERA DEL RECORTE, y no por espacio.
   *
   * Es texto de la aplicación, así que se capturaba en el idioma en el que
   * estuviese abierta — y la muestra sale en las cinco páginas de la web. La
   * portada española enseñaba un párrafo en inglés dentro de la imagen.
   *
   * Traducirlo obligaría a cinco muestras de seis megas cada una. Así que se
   * recorta sin ella y se anotan sus cifras al lado: la web reescribe la frase
   * con su propio diccionario, con las mismas cifras medidas de esta pelea, y
   * de paso queda como texto de verdad, seleccionable y que pesa cero.
   */
  await evalua("document.getElementById('rpReglas').style.display = 'none'");
  fs.writeFileSync(path.join(SALIDA, NOMBRE + '.datos.json'),
    JSON.stringify({ ...reglas, pelea: elegida }, null, 1));
  await espera(300);

  await evalua("document.getElementById('rpPlay')?.click()");
  // El recorte se toma con la reproducción YA en marcha: al montarse, el
  // escenario y el panel de texto se asientan un par de píxeles, y medir antes
  // hacía saltar la comprobación de abajo en el primer fotograma.
  await espera(400);
  const caja = await medirCaja(evalua, '.rp');

  const escala = Math.min(1, ANCHO_MAX / caja.width);
  console.log(`  recorte ${caja.width}×${caja.height} a escala ${escala.toFixed(2)}`);

  // Se captura al ritmo de siempre —ocho por segundo de reloj— y lo que
  // cambia es cada cuánto se ENSEÑA cada fotograma después. Mezclar las dos
  // cadencias en una sola constante era lo que hacía que subir la velocidad
  // sacara clips a trompicones.
  const cuantos = Math.ceil((SEGUNDOS / VELOCIDAD) * 1000 / MS_CAPTURA);
  console.log(`  capturando ${cuantos} fotogramas cada ${MS_CAPTURA} ms de reloj…`);
  const fotogramas = [];
  for (let i = 0; i < cuantos; i++) {
    // Comprobado antes de cada disparo, por la puerta común: ver
    // `capturaComprobada` en cdp.js. Un encuadre que se descuadra no da ningún
    // error — da una muestra que parece bien en el primer fotograma.
    try {
      fotogramas.push(await capturaComprobada({ manda, evalua }, '.rp', caja, escala));
    } catch (e) {
      throw new Error(`fotograma ${i}: ${e.message}`);
    }
    await espera(MS_CAPTURA);
  }

  const buf = montarAPNG(fotogramas, { msPorFotograma: MS, vueltas: 0 });
  const destino = path.join(SALIDA, NOMBRE + '.apng.png');
  fs.writeFileSync(destino, buf);

  // Se revisa lo montado: un APNG mal cerrado se abre igual, enseñando sólo el
  // primer fotograma, así que mirarlo a ojo no dice si está bien.
  const rev = revisarAPNG(buf);
  if (!rev.ok) { mal++; console.error(`  MAL  el montaje no cuadra: ${JSON.stringify(rev)}`); }
  console.log(`\n  ${rev.ok ? 'ok ' : 'MAL'}  ${fotogramas.length} fotogramas · ${
    Math.round(buf.length / 1024)} KB · ${(cuantos * MS / 1000).toFixed(1)}s de reloj`);
  console.log(`  ${destino}`);
  console.log('\n  Se abre en el navegador, en Fotos de Windows, en GitHub y en Discord.');
  console.log('  Lleva extensión .png a propósito: un APNG ES un PNG, y quien no');
  console.log('  entienda la animación verá el primer fotograma en vez de nada.\n');

} catch (err) {
  mal++;
  console.error(`\nMAL  ${err.message}\n`);
} finally {
  // El tema ANTES de cerrar el socket: devolverlo es otra orden por el mismo
  // canal, y sobre un socket cerrado se queda esperando una respuesta que no
  // va a llegar.
  if (!await devolverTema(evalua, temaPrevio, TEMA)) mal++;
  try { socket?.close(); } catch { /* ya estaba cerrado */ }
  try { app.kill(); } catch { /* ya estaba muerta */ }
}
process.exit(mal ? 1 : 0);
