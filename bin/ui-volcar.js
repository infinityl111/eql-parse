/**
 * VOLCAR UNA VISTA A FICHERO PARA PODER LEERLA. La forma tosca de verla.
 *
 * `ui:check` mide el DOM y deja una captura por vista, pero en algunas máquinas
 * `Page.captureScreenshot` no contesta —aquí, tres intentos y treinta segundos
 * cada uno— y entonces no queda NADA que mirar. Y una sección que nadie ha
 * mirado nunca es peor que una sección con un fallo conocido: la del
 * temporizador de reaparición cambió cinco veces en un día sin que ningún par
 * de ojos la viera.
 *
 * Esto no sustituye a la captura. Vuelca lo que sí se puede sacar sin ella:
 *
 *   · el HTML renderizado de la sección, con el texto ya traducido
 *   · la caja de cada elemento —posición, tamaño— para ver si algo se sale,
 *     se solapa o tiene alto cero
 *   · los estilos que de verdad le han tocado, para ver cuáles NO existen
 *
 * Lo último es el motivo real de escribirlo: `ui/styles.css` no tiene ni una
 * regla `.cro`, así que la sección se pinta con lo que herede del cuerpo. Eso
 * no se ve leyendo el código —el HTML es correcto— y sí se ve aquí.
 *
 * Uso:  node bin/ui-volcar.js [seccion] [--demo=NOMBRE]
 *
 * `--demo` abre un temporizador POR LA VÍA REAL —escribe el nombre y pulsa el
 * botón— y lo cierra al terminar, también por la vía real. Sin él sólo se ve el
 * estado vacío, que es el que no tiene nada que mirar. Deja la configuración
 * como estaba: si el volcado se cae a mitad, el temporizador se queda abierto y
 * hay que cerrarlo a mano.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador } from './cdp.js';

const SEC = (process.argv[2] ?? 'cronos').replace(/^--.*/, '') || 'cronos';
const DEMO = (process.argv.find((a) => a.startsWith('--demo=')) ?? '').slice(7);
const SALIDA = path.join(os.tmpdir(), 'eql-ui-volcado');
fs.mkdirSync(SALIDA, { recursive: true });

if (!(await puertoLibre())) {
  console.error(`\nEl puerto ${PUERTO} está ocupado: hay otra ventana con depuración abierta.\n`);
  process.exit(2);
}

const hijo = lanzar();
const pagina = await conecta();
// `cdp` devuelve una promesa de apertura y hay que esperarla: mandar antes da
// «Sent before connected», que es lo que pasó a la primera.
const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
await listo;
const evalua = evaluador(manda);

const fin = (cod) => { try { ws.close(); } catch { /* ya */ } hijo.kill(); process.exit(cod); };

try {
  await manda('Runtime.enable');
  await espera(2500);

  // Se navega por identificador y NUNCA por el rótulo: la aplicación tiene
  // cinco idiomas y buscar el texto falla en cuatro de ellos.
  const hay = await evalua(`!!document.querySelector('[data-sec=${JSON.stringify(SEC).slice(1, -1)}]')`);
  if (!hay) {
    const secs = await evalua("[...document.querySelectorAll('[data-sec]')].map((e) => e.dataset.sec)");
    console.error(`\nNo existe la sección «${SEC}». Las que hay: ${secs.join(', ')}\n`);
    fin(3);
  }
  await evalua(`document.querySelector('[data-sec=${SEC}]').click()`);
  // El temporizador pregunta al motor por la última muerte antes de pintar, así
  // que hay que darle su viaje: sin esto se vuelca el hueco y no la sección.
  await espera(2500);

  // Se abre por donde lo abriría una persona: escribiendo y pulsando. Montarlo
  // a mano en el DOM enseñaría el HTML que YO espero, no el que produce el
  // programa, que es justo lo que se quiere comprobar.
  if (DEMO) {
    await evalua(`(() => {
      const i = document.querySelector('#croNuevo');
      i.value = ${JSON.stringify(DEMO)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#croAdd').click();
    })()`);
    await espera(2000);
  }

  const datos = await evalua(`(() => {
    const host = document.querySelector('.vista:not([hidden]), #vista, main') ?? document.body;
    const dentro = [...host.querySelectorAll('*')].slice(0, 400).map((e) => {
      const r = e.getBoundingClientRect();
      const c = getComputedStyle(e);
      return {
        tag: e.tagName.toLowerCase(),
        clase: e.className && typeof e.className === 'string' ? e.className : '',
        id: e.id || '',
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        color: c.color, fondo: c.backgroundColor, fuente: c.fontSize, display: c.display,
        borde: c.borderStyle === 'none' ? '' : \`\${c.borderWidth} \${c.borderStyle}\`,
        pad: c.padding === '0px' ? '' : c.padding,
        txt: (e.children.length ? '' : (e.textContent ?? '').trim().slice(0, 90)),
      };
    });
    return { html: host.innerHTML, dentro, ancho: innerWidth, alto: innerHeight,
      cuerpoFondo: getComputedStyle(document.body).backgroundColor };
  })()`);

  // ¿Qué reglas del CSS tocan de verdad a esta sección? La respuesta interesante
  // es la lista de clases que NO casa con ninguna.
  const css = await evalua(`(() => {
    const usadas = new Set();
    for (const h of document.styleSheets) {
      let reglas; try { reglas = h.cssRules; } catch { continue; }
      for (const r of reglas ?? []) if (r.selectorText) usadas.add(r.selectorText);
    }
    return [...usadas];
  })()`);

  const clases = new Set();
  for (const e of datos.dentro) for (const c of e.clase.split(/\\s+/)) if (c) clases.add(c);
  const huerfanas = [...clases].filter((c) => !css.some((s) => s.includes(`.${c}`)));

  const f = path.join(SALIDA, `${SEC}.html`);
  fs.writeFileSync(f, datos.html);

  const t = path.join(SALIDA, `${SEC}.txt`);
  const filas = datos.dentro.filter((e) => e.w || e.h || e.txt).map((e) => {
    const q = `${e.tag}${e.id ? `#${e.id}` : ''}${e.clase ? `.${e.clase.split(/\\s+/).join('.')}` : ''}`;
    return `${String(e.y).padStart(5)} ${String(e.x).padStart(4)} ${String(e.w).padStart(5)}×${String(e.h).padStart(4)}  `
      + `${q.padEnd(38).slice(0, 38)}  ${e.fuente.padStart(6)} ${e.color.padEnd(20).slice(0, 20)}`
      + `${(e.borde || e.pad ? `[${e.borde}${e.borde && e.pad ? ' ' : ''}${e.pad}]` : '').padEnd(22)}${e.txt}`;
  });
  fs.writeFileSync(t, [
    `SECCIÓN «${SEC}» · ventana ${datos.ancho}×${datos.alto} · fondo del cuerpo ${datos.cuerpoFondo}`,
    '',
    '    y    x   ancho×alto  elemento                                fuente color               [borde padding]      texto',
    ...filas,
    '',
    huerfanas.length
      ? `CLASES SIN NINGUNA REGLA DE ESTILO (${huerfanas.length}): ${huerfanas.join(', ')}`
      : 'todas las clases tienen al menos una regla',
  ].join('\n'));

  console.log(`\n  sección «${SEC}» volcada`);
  console.log(`    ${f}`);
  console.log(`    ${t}`);
  const sinAlto = datos.dentro.filter((e) => e.txt && e.h === 0);
  if (sinAlto.length) console.log(`    ⚠ ${sinAlto.length} elementos con TEXTO y alto CERO`);
  const fuera = datos.dentro.filter((e) => e.w && e.x + e.w > datos.ancho + 2);
  if (fuera.length) console.log(`    ⚠ ${fuera.length} elementos que se salen por la derecha`);
  if (huerfanas.length) console.log(`    ⚠ ${huerfanas.length} clases sin ninguna regla: ${huerfanas.slice(0, 12).join(', ')}`);
  // Y se cierra por donde se cerraría a mano, para no dejarle a nadie un
  // temporizador que no abrió.
  if (DEMO) {
    await evalua("document.querySelectorAll('[data-quita]').forEach((b) => b.click())");
    await espera(1200);
    const quedan = await evalua("document.querySelectorAll('[data-quita]').length");
    if (quedan) console.log(`    ⚠ quedan ${quedan} temporizadores abiertos: ciérralos a mano`);
    else console.log('    (el temporizador de prueba queda cerrado)');
  }
  console.log('');
  fin(0);
} catch (e) {
  console.error(`\n  falló el volcado: ${e.message}\n`);
  fin(1);
}
