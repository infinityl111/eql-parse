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
 * CÓMO SE ENCUENTRA EL CONTENEDOR QUE SCROLLEA, cada vez que hace falta.
 *
 * Es una expresión, no un nodo guardado: el que se guarda puede quedarse fuera
 * del documento en el siguiente repintado, y entonces se le da scroll a algo que
 * ya nadie ve. Se resuelve donde se usa.
 */
const SCROLLER = `(() => {
  ${PANEL}
  if (panel.scrollHeight - panel.clientHeight > 8) return panel;
  let cap = panel; let dif = 8;
  for (const el of panel.querySelectorAll('*')) {
    const ov = getComputedStyle(el).overflowY;
    if (ov !== 'auto' && ov !== 'scroll') continue;
    const d = el.scrollHeight - el.clientHeight;
    if (d > dif) { cap = el; dif = d; }
  }
  return cap;
})()`;

/**
 * Dispara, y si la vista no cabe en la ventana la parte en trozos.
 *
 * Una captura recortada por abajo es la trampa de siempre: sale el fichero, el
 * script termina en verde y lo que faltaba no está en ninguna parte.
 */
async function dispara(win, ejec, destino) {
  const m = await ejec(`(() => {
    ${PANEL}
    /**
     * QUIÉN SCROLLEA DE VERDAD, que no siempre es el panel.
     *
     * El resumen tiene su propio contenedor con scroll dentro —el .summary, que
     * conserva la posición al desplegar una fila— así que el panel de fuera NO
     * crece: mide lo mismo con veinte filas que con doscientas. Midiéndolo a él,
     *
     * (Y OJO CON LAS COMILLAS INVERTIDAS EN ESTE COMENTARIO: está DENTRO de una
     * plantilla, así que una comilla invertida aquí la cierra y el error sale
     * cinco líneas más abajo, hablando de otra cosa. Ya está escrito en
     * ui/app.js y he vuelto a tropezar con ello.)
     * el capturador daba la sección por entera con una sola foto y NI SIQUIERA
     * avisaba de píxeles sin capturar: 19.000 caracteres de resumen resumidos en
     * una pantalla, en silencio. La misma trampa de la familia quince, otra vez
     * dentro de la herramienta que existe para cazarla.
     *
     * Así que si el panel no desborda, se busca DENTRO de él quién lo hace. El
     * «dentro» es la parte que importa: buscándolo en todo el documento se
     * elegiría la lista de peleas, que scrollea 6.300 px y no es el contenido.
     */
    let cap = panel;
    if (panel.scrollHeight - panel.clientHeight <= 8) {
      let dif = 8;
      for (const el of panel.querySelectorAll('*')) {
        const ov = getComputedStyle(el).overflowY;
        if (ov !== 'auto' && ov !== 'scroll') continue;
        const d = el.scrollHeight - el.clientHeight;
        if (d > dif) { cap = el; dif = d; }
      }
    }
    cap.scrollTop = 0;
    return { alto: cap.scrollHeight, visible: cap.clientHeight,
             largo: panel.textContent.trim().length,
             // «No pude capturarlo» y «no había nada que capturar» son dos cosas
             // distintas y hasta ahora salían las dos en rojo. Una sección que
             // dice que está vacía —con su bloque de vacío o su nota— ES un
             // estado y se fotografía igual de bien; lo que no puede pasar es un
             // panel en blanco, sin un nodo ni una letra, que es la señal de que
             // el recorrido no llegó. Familia 22.
             declara: !!panel.querySelector('.empty, .hint, .hallazgo'),
             nodos: panel.children.length,
             dentro: cap !== panel };
  })()`);

  const quieren = Math.max(1, Math.ceil(m.alto / Math.max(1, m.visible)));
  const trozos = Math.min(quieren, TOPE_TROZOS);
  let viejos = 0;
  /**
   * DÓNDE ESTABA CADA DISPARO DE VERDAD, leído después de mover el scroll.
   *
   * No se apunta `i * visible` —lo que se PIDIÓ— sino el `scrollTop` que el
   * navegador dejó puesto. No es lo mismo: `scrollTop` se recorta solo al máximo
   * del contenedor, así que pedir 3.260 en un panel que sólo baja 2.100 deja el
   * disparo donde ya estaba y produce una foto repetida. Contando lo pedido, la
   * cobertura salía perfecta; contando lo que pasó, salen las repeticiones.
   */
  const vistos = [];
  /**
   * EL CONTENEDOR SE VUELVE A BUSCAR EN CADA PASO, no se guarda.
   *
   * Guardarlo en `window.__cap` parecía razonable hasta que la comprobación de
   * cobertura destapó lo que hacía: la enciclopedia se repinta sola cuando llega
   * la wiki, el nodo guardado deja de estar en el documento, y a partir de ahí
   * `scrollTop` se escribe en un elemento que ya no existe. Los cuatro trozos
   * salieron los cuatro de la primera pantalla y la línea decía «4 trozos».
   * Cuarto caso de la misma familia, y el primero que caza una cuenta y no un
   * ojo.
   */
  const posiciona = (y) => ejec(`(() => { const c = ${SCROLLER}; c.scrollTop = ${y};`
    + ' return { y: Math.round(c.scrollTop), h: c.clientHeight, alto: c.scrollHeight }; })()');
  const donde = () => ejec(`(() => { const c = ${SCROLLER};`
    + ' return { y: Math.round(c.scrollTop), h: c.clientHeight, alto: c.scrollHeight }; })()');

  for (let i = 0; i < trozos; i++) {
    if (i) {
      await posiciona(i * m.visible);
      await espera(350);
    }
    if (!(await esperaFotograma(ejec))) viejos++;
    const pos = await donde();
    const png = await disparoNoVacio(win, destino);
    fs.writeFileSync(i ? destino.replace(/\.png$/, `-${i + 1}.png`) : destino, png);
    vistos.push([pos.y, pos.y + pos.h]);
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
    await posiciona(m.alto);
    await espera(350);
    if (!(await esperaFotograma(ejec))) viejos++;
    const pos = await donde();
    const png = await disparoNoVacio(win, destino);
    fs.writeFileSync(destino.replace(/\.png$/, '-fin.png'), png);
    vistos.push([pos.y, pos.y + pos.h]);
    fin = true;
  }

  const fin2 = await donde();
  await posiciona(0);

  /**
   * ═══ LA COBERTURA SE DEMUESTRA, NO SE AFIRMA ═══
   *
   * Tres veces seguidas esta herramienta dijo haber cubierto más de lo que
   * cubrió: la carpeta vacía, el fotograma viejo y el resumen que scrollea por
   * dentro. Tres fallos distintos y los tres en la MISMA dirección — nunca
   * «capturé menos de lo que digo». Eso ya no es mala suerte, es un sesgo: quien
   * escribe la herramienta quiere que la tanda salga.
   *
   * Contra un sesgo no vale otra comprobación puntual, hace falta una CUENTA QUE
   * TENGA QUE CUADRAR. Se unen los intervalos realmente fotografiados y se
   * comparan con el alto del panel:
   *
   *     lo capturado + lo declarado sin capturar = el alto total, EXACTO
   *
   * Si no cuadra, la tanda no se entrega. Y el alto se vuelve a medir al final:
   * si el panel creció mientras se fotografiaba —el registro sigue vivo—, la
   * cuenta habla de una página que ya no existe y eso también es no cuadrar.
   */
  const orden = vistos.slice().sort((a2, b2) => a2[0] - b2[0]);
  const union = [];
  for (const [a2, b2] of orden) {
    const u = union.at(-1);
    if (u && a2 <= u[1]) u[1] = Math.max(u[1], b2);
    else union.push([a2, b2]);
  }
  const alto = Math.max(m.alto, fin2.alto);
  const cubierto = union.reduce((n, [a2, b2]) => n + (Math.min(b2, alto) - Math.max(0, a2)), 0);
  const fuera = alto - cubierto;

  /**
   * Y LA CUENTA SE CIERRA CONTRA LO PREVISTO, no contra sí misma.
   *
   * La primera versión de esta comprobación restaba: `fuera = alto - cubierto`,
   * y luego comprobaba que `cubierto + fuera === alto`. Eso no puede fallar
   * nunca — es la misma cifra dicha dos veces, una cuenta cierta que contesta a
   * una pregunta que nadie hizo. Exactamente el matiz de la familia quince, y
   * escrita por la misma mano que lo escribió.
   *
   * Lo que sí puede fallar, y es lo que hay que preguntar: ¿coincide lo que el
   * algoritmo CREE que cubrió con lo que las posiciones dicen que cubrió? Ahí
   * salen las repeticiones por `scrollTop` recortado, un trozo que se quedó
   * donde estaba y un panel que cambió de alto a media tanda.
   */
  const previstoArriba = Math.min(trozos * m.visible, m.alto);
  const previstoCola = fin ? Math.max(0, m.alto - Math.max(previstoArriba, m.alto - m.visible)) : 0;
  const previsto = previstoArriba + previstoCola;
  /**
   * DOS PÍXELES DE HOLGURA, Y SE DICE POR QUÉ.
   *
   * El alto de un panel no es entero —815,33 px— y `scrollTop` tampoco. Al
   * redondear para poder sumar intervalos aparece una diferencia de un píxel
   * entre lo previsto y lo medido que no es un hueco: es el redondeo. La primera
   * corrida con la comprobación puesta dio exactamente eso, 3.915 contra 3.914.
   *
   * La holgura es de DOS y no de veinte a propósito: un trozo perdido son
   * ochocientos, así que dos píxeles no pueden esconder ninguno.
   */
  const cuadra = Math.abs(previsto - cubierto) <= 2 && fin2.alto === m.alto;

  return {
    trozos,
    largo: m.largo,
    viejos,
    fin,
    fuera,
    cubierto,
    alto,
    creció: fin2.alto !== m.alto ? { antes: m.alto, despues: fin2.alto } : null,
    previsto,
    cuadra,
  };
}

let mal = 0;
// La cuenta de cobertura de cada captura, para que la tanda la lleve encima.
const cobertura = [];

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
          const r = await dispara(win, ejec, destino);
          // Vacío DECLARADO: la sección dice que no hay nada, y eso es una foto
          // buena de un estado. En blanco: no llegó el recorrido, y eso invalida.
          const enBlanco = r.largo < 40 && !r.declara;
          const vacio = r.largo < 40 && r.declara;
          const bien = !enBlanco && !r.viejos && r.cuadra;
          if (!bien) mal++;
          cobertura.push({ idioma, tema, seccion: v.nombre, ...r });
          console.log(`  ${bien ? 'ok ' : 'MAL'}  ${idioma}-${tema} ${v.nombre.padEnd(14)}`
            + ` · ${r.cubierto}/${r.alto} px`
            + `${r.trozos > 1 ? ` en ${r.trozos} trozos` : ''}`
            + `${r.fin ? ' + el final' : ''}`
            + `${r.fuera ? ` · ${r.fuera} px del medio sin capturar` : ''}`
            + `${r.viejos ? ` · ${r.viejos} SIN FOTOGRAMA NUEVO (la ventana estaba tapada)` : ''}`
            + `${r.creció ? ` · EL PANEL CRECIÓ MIENTRAS (${r.creció.antes} → ${r.creció.despues})` : ''}`
            + `${!r.cuadra && !r.creció ? ` · LA CUENTA NO CUADRA: previstos ${r.previsto}, medidos ${r.cubierto}` : ''}`
            + `${vacio ? ' · vacío declarado (es un estado, no un fallo)' : ''}`
            + `${enBlanco ? ` · EN BLANCO: ${r.nodos} nodos, el recorrido no llegó` : ''}`);
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

  /**
   * LA TANDA LLEVA SU PROPIA CUENTA ENCIMA.
   *
   * Un fichero al lado de las fotos con cuánto se cubrió de cada panel y cuánto
   * se declaró fuera. Sin él, la cobertura vive en una consola que se cierra y
   * la carpeta vuelve a parecer completa dentro de tres semanas.
   */
  fs.writeFileSync(path.join(SALIDA, 'cobertura.json'), JSON.stringify(cobertura, null, 1));
  const px = cobertura.reduce((n, c) => n + c.cubierto, 0);
  const total = cobertura.reduce((n, c) => n + c.alto, 0);
  console.log(`\n  ${cobertura.length} capturas · ${px} de ${total} px cubiertos`
    + ` (${total ? Math.round(px / total * 100) : 0}%) · cuenta en cobertura.json`);

  if (mal) {
    console.error(`\n  ${mal} captura(s) SIN CUADRAR: la tanda NO se entrega.`);
    console.error('  Lo capturado más lo declarado fuera tiene que dar el alto del panel.\n');
  } else {
    console.log(`\n  capturas en ${SALIDA}\n`);
  }
  app.exit(mal ? 1 : 0);
}).catch((e) => {
  console.error(`\n  MAL  ${e.message}\n`);
  app.exit(2);
});
