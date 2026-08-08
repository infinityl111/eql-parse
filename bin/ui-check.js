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
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador, capturaPagina } from './cdp.js';

const SALIDA = path.join(os.tmpdir(), 'eql-ui-check');
fs.mkdirSync(SALIDA, { recursive: true });

if (!(await puertoLibre())) {
  console.error('');
  console.error(`El puerto ${PUERTO} ya está ocupado: hay otra ventana abierta con`);
  console.error('depuración. Ciérrala antes, o esto mediría esa y no la de ahora.');
  console.error('');
  process.exit(2);
}

// Cada vista: cómo llegar, qué cajas no deben pisarse y por dónde pasar el
// ratón. `raton` es un selector: se le lanzan los eventos a cada elemento que
// case, uno a uno, y después se mira si saltó la caja de fallo.
// NAVEGAR POR ID Y NO POR TEXTO. Estos pasos buscaban el rótulo de la
// pestaña —/COMBATE/i, /ENCICLOPEDIA/i— y la aplicación tiene cinco idiomas:
// con la interfaz en inglés no encontraban nada y cinco vistas salían en rojo
// con cero cajas, que se lee como «la vista está rota» y no lo estaba. Los
// identificadores y los `data-` no se traducen.
const VISTAS = [
  {
    nombre: 'combate',
    // Hay que cargar una pelea del histórico: recién abierta, la lista de
    // combatientes está vacía y no hay nada por donde pasar el ratón.
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
    ],
    cajas: '.row',
    raton: '.row',
  },
  {
    // Los documentos de la pelea. Se entra pulsando la ÚLTIMA pestaña, que es
    // la que nunca está abierta por defecto: si el panel no se repinta al
    // cambiar de pestaña, aquí se ve, porque lo que se mide es el contenido y
    // no la barra. Y se miden las tres cajas de dentro —lo que pinte el
    // documento abierto— además de las propias pestañas.
    nombre: 'documentos',
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
      "[...document.querySelectorAll('.doctab')].at(-1)?.click()",
      // La captura es para mirarla: sin esto salía el principio de la pantalla
      // y las pestañas quedaban fuera del recorte.
      "document.querySelector('.docbar')?.scrollIntoView({ block: 'center' })",
    ],
    cajas: '.doctab',
    raton: '.doctab',
  },
  {
    // La reproducción: se abre, se lee el registro y se mide la escena. Es la
    // vista que más cosas nuevas junta —lectura de disco, SVG y un bucle— así
    // que si algo revienta al montarla, revienta aquí.
    nombre: 'reproduccion',
    llega: [
      "document.getElementById('tabCombat')?.click()",
      "document.querySelector('.fight[data-live=\"0\"]')?.click()",
      "document.getElementById('btnReplay')?.click()",
    ],
    espera: 2500,
    cajas: '.rp-act',
    raton: '.rp-act',
  },
  {
    // La LISTA, que es donde viven las filas pulsables. La vista de abajo se
    // mete en la ficha y allí ya no hay ninguna: sin este paso, la
    // comprobación del cursor no encontraba nada que mirar y daba verde.
    nombre: 'hechizos',
    // Se entra por la PESTAÑA, no por el migajero: viniendo de Combate no hay
    // migajero que pulsar, y la vista se quedaba en cero filas dando un rojo
    // por el motivo equivocado.
    llega: [
      "document.getElementById('tabEnc')?.click()",
      "document.querySelector('.enccard[data-enc=\"hechizos\"]')?.click()",
    ],
    cajas: '.cat-row',
    raton: '.cat-row.abre',
  },
  {
    nombre: 'hechizo',
    llega: [
      "document.getElementById('tabEnc')?.click()",
      "document.querySelector('.enccard[data-enc=\"hechizos\"]')?.click()",
      "document.querySelectorAll('.cat-row.abre')[0]?.click()",
    ],
    cajas: '.tramo',
  },
  {
    nombre: 'progreso',
    llega: [
      "document.getElementById('tabEnc')?.click()",
      "document.querySelector('.enccard[data-enc=\"progreso\"]')?.click()",
    ],
    cajas: '.encrow.serie-row',
  },
  {
    nombre: 'enemigo',
    llega: [
      "document.getElementById('tabEnc')?.click()",
      "document.querySelector('.enccard[data-enc=\"enemigos\"]')?.click()",
      "document.querySelectorAll('.encrow.foe .nm')[0]?.click()",
    ],
    cajas: '.difgrid > *',
  },
  {
    nombre: 'muertes',
    llega: [
      "document.getElementById('tabEnc')?.click()",
      "document.querySelector('.enccard[data-enc=\"muertes\"]')?.click()",
    ],
    cajas: '.encrow',
  },
];

// El binario directo, no `npx`: en Windows, Node 24 se niega a lanzar un
// `.cmd` sin shell y devuelve EINVAL. El paquete `electron` exporta la ruta.
const app = lanzar();

// Lo pulsable enseña la mano. No es adorno: el cursor es lo único que dice
// si algo se puede pulsar ANTES de pulsarlo. Se descubrió que la fila de la
// tabla de hechizos se quedaba con la flecha, y encima con el cursor de
// texto, que promete justo lo contrario de lo que hace.
//
// Estos selectores salen de los `addEventListener('click')` del propio
// `ui/app.js`: si mañana se ata otro, se añade aquí.
const PULSABLES = ['.cat-row.abre', '.enccard', '.enccell[data-base]', '.encrow.fight',
  '.periodo[data-uid]', '.encrow[data-foe]', '.fcell[data-foe]', '.fight', '.lang-item',
  '.loot-item', '.lootTab', '.lootfrom', '[data-crumb]'];
// Y lo que NO se puede pulsar no la enseña: las filas de marca sin pelea van
// deshabilitadas a propósito.
const NO_PULSABLES = ['.encrow.static'];

let mal = 0;
try {
  const pagina = await conecta();
  const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
  await listo;
  await manda('Runtime.enable');
  await manda('Page.enable');

  const evalua = evaluador(manda);

  console.log(`\n${pagina.title} — midiendo el DOM de verdad\n`);
  await espera(3000);

  for (const v of VISTAS) {
    for (const paso of v.llega) { await evalua(paso); await espera(1600); }
    if (v.espera) await espera(v.espera);
    let raton = 0;

    // EL RATÓN, que es lo que un recorrido de vistas no toca. El fallo de
    // «t is not a function» sólo saltaba al pasar por encima de una fila:
    // ninguna vista se ve mal, ninguna cifra sale torcida, y hasta que no
    // pasas el ratón no existe. Se lanzan los eventos de verdad —`mouseover`
    // y `mousemove` con coordenadas— porque los manejadores los leen.
    if (v.raton) {
      const n = await evalua(`(() => {
        const els = [...document.querySelectorAll(${JSON.stringify(v.raton)})].slice(0, 12);
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const o = { bubbles: true, clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.top + r.height / 2) };
          el.dispatchEvent(new MouseEvent('mouseover', o));
          el.dispatchEvent(new MouseEvent('mousemove', o));
          el.dispatchEvent(new MouseEvent('mouseenter', o));
          el.dispatchEvent(new MouseEvent('mouseleave', o));
        }
        return els.length;
      })()`);
      await espera(500);
      raton = n;
    }

    const m = await evalua(`(() => {
      const todos = [...document.querySelectorAll(${JSON.stringify(v.cajas)})];
      // NO PINTADO A PROPÓSITO NO ES NO PINTADO.
      //
      // Un elemento con «display: none» mide cero, y esta comprobación lo
      // contaba como «sin alto» — que es su forma de cazar lo contrario: algo
      // que SÍ se pinta y sale aplastado. La reproducción tiene actores
      // escondidos a propósito, los que aún no han entrado en la pelea, y eso
      // daba rojo por una decisión.
      //
      // Se separan y se cuentan aparte: ni se ignoran en silencio ni se
      // confunden con un fallo. Un getClientRects() vacío es exactamente «este
      // elemento no genera ninguna caja».
      const ocultos = todos.filter((x) => x.getClientRects().length === 0).length;
      const n = todos.filter((x) => x.getClientRects().length > 0);
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
      return { n: n.length, ocultos, solapes, sinAlto, desbordan,
        crash: caja && caja.style.display !== 'none' ? caja.textContent.slice(0, 160) : null,
        vacia: document.querySelector('.enc')?.textContent.trim().length < 40 };
    })()`);

    const bien = m.n > 0 && !m.solapes && !m.sinAlto && !m.desbordan && !m.crash && !m.vacia;
    if (!bien) mal++;
    console.log(`  ${bien ? 'ok ' : 'MAL'}  ${v.nombre.padEnd(10)} ${
      m.n} cajas «${v.cajas}» · ${m.solapes} solapes · ${m.sinAlto} sin alto · ${
      m.desbordan} desbordan${m.ocultos ? ` · ${m.ocultos} ocultos a propósito` : ''}${raton ? ` · ratón por ${raton}` : ''}${
      m.crash ? `\n         REVENTÓ: ${m.crash}` : ''}${m.vacia ? '\n         la vista salió vacía' : ''}`);

    // El cursor de lo que haya en esta vista.
    const cursores = await evalua(`(() => {
      const malos = [];
      for (const s of ${JSON.stringify(PULSABLES)}) {
        for (const el of [...document.querySelectorAll(s)].slice(0, 3)) {
          if (getComputedStyle(el).cursor !== 'pointer') { malos.push(s + ' → flecha'); break; }
        }
      }
      for (const s of ${JSON.stringify(NO_PULSABLES)}) {
        for (const el of [...document.querySelectorAll(s)].slice(0, 3)) {
          if (getComputedStyle(el).cursor === 'pointer') { malos.push(s + ' → mano sin serlo'); break; }
        }
      }
      return malos;
    })()`);
    if (cursores.length) {
      mal++;
      console.log(`         CURSOR: ${cursores.join(' · ')}`);
    }

    // Por la puerta común, que además comprueba que la página no creció entre
    // medir el alto y disparar: ver capturaPagina en cdp.js.
    const { png, creció } = await capturaPagina({ manda, evalua });
    if (creció) console.log(`         (la página creció al fijar el alto: ${creció.antes} → ${creció.despues})`);
    const shot = { data: png.toString('base64') };
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
