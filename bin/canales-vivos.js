#!/usr/bin/env node
/**
 * ¿HAY ALGUNA VENTANA QUE SE PINTE UNA VEZ Y SE QUEDE QUIETA?
 *
 * La segunda mitad del barrido. El panel de temporizadores estuvo congelado
 * desde que existe **con un comentario al lado que decía que el reparto llegaba
 * a todos los overlays**, y nadie lo vio leyendo el fuente: apareció cuando una
 * sonda exigió ver moverse una cifra.
 *
 *     CONTAR MENSAJES NO VALE. Un mensaje que llega y cuyo manejador no hace
 *     nada se cuenta igual que uno que pinta. Se mide EN EL DOM.
 *
 * Por cada ventana abierta se toma una FIRMA de lo pintado —el texto de las
 * cifras y de las filas, no el `innerHTML`, que cambia por cosas cosméticas— en
 * dos instantes, y entre medias se escribe en el registro para que el estado
 * cambie de verdad. Una ventana cuya firma no se mueve cuando el estado sí,
 * está congelada.
 *
 * Y CON CONTROL POSITIVO OBLIGATORIO: si no se mueve NINGUNA, la rota es la
 * sonda. Sin ese verde, el resto no vale nada.
 *
 * Uso:  npm run canales  ·  node bin/canales-vivos.js
 */
import fs from 'node:fs';
import { arrancaListo, hace, espera } from './sonda.js';
import { cdp, PUERTO } from './cdp.js';

const BASE = "Nagafen's Lair";
const CRONOS = [
  { nombre: 'contando', base: BASE, diff: 2, mode: null, manual: 3600 },
  { nombre: 'vencido', base: BASE, diff: 2, mode: null, manual: 60 },
];

const { lee, fin, LOG } = await arrancaListo({
  nombre: 'eql-canales-vivos',
  ventana: 'index.html',
  vivo: 'vencido',
  registro: [
    `[${hace(600)}] Logging to 'eqlog.txt' is now *ON*.`,
    `[${hace(595)}] You have entered ${BASE} 2 (Adaptive).`,
    `[${hace(400)}] You slash vencido for 120 points of damage.`,
    `[${hace(395)}] You have slain vencido!`,
    `[${hace(70)}] You slash contando for 240 points of damage.`,
    `[${hace(60)}] You have slain contando!`,
  ],
  config: { cronos: CRONOS },
});

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

// Se abre el overlay principal desde la ventana principal: así están las tres.
await lee('window.eql.openOverlay?.()');
await espera(2500);

/** Todas las ventanas de la aplicación, con su lector. */
async function ventanas() {
  const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
  const out = [];
  for (const t of lista.filter((x) => x.type === 'page' && /\.html/.test(x.url))) {
    const cli = cdp(t.webSocketDebuggerUrl);
    await cli.listo;
    out.push({
      nombre: t.url.split('/').pop(),
      lee: async (js) => (await cli.manda('Runtime.evaluate', {
        expression: js, returnByValue: true, awaitPromise: true,
      }))?.result?.value,
    });
  }
  return out;
}

/**
 * LA FIRMA: el texto de las cifras y de las filas.
 *
 * No el `innerHTML` entero — cambia por una clase de foco o un atributo y daría
 * «se mueve» de una ventana muerta. Y no un contador de mensajes: eso es lo que
 * esta sonda existe para no hacer.
 */
const FIRMA = `(() => {
  const sel = ['.num', '.name', '.pan-n', '.pan-t', '.cro-num', '.ov-nom', '.ov-num',
    '#oMeta', '#oSession', '.ok-row', '.row', '.enccell', '.res'];
  const t = [...document.querySelectorAll(sel.join(','))]
    .map((n) => n.textContent.trim()).filter(Boolean).join('|');
  return { firma: t.slice(0, 4000), nodos: t.length };
})()`;

const vs = await ventanas();
console.log(`\nVENTANAS ABIERTAS: ${vs.map((v) => v.nombre).join(' · ')}\n`);
ok(vs.length >= 3, 'están abiertas las tres ventanas de la aplicación',
  vs.map((v) => v.nombre).join(', '));

const antes = [];
for (const v of vs) antes.push(await v.lee(FIRMA));

/**
 * EL CAMBIO DE ESTADO, escrito en el registro de verdad: daño entrando y una
 * muerte. Es lo que mueve las cifras de la ventana principal y del overlay, y
 * lo que reinicia el temporizador del panel.
 */
const lineas = [
  `[${hace(3)}] You slash contando for 355 points of damage.`,
  `[${hace(2)}] You crush contando for 402 points of damage. (Critical)`,
  `[${hace(1)}] contando hits YOU for 47 points of damage.`,
  // La muerte DE LO QUE SE HA GOLPEADO: una muerte sin daño de por medio no
  // entra en la pelea igual, y el crono no tendría de dónde reiniciarse.
  `[${hace(0)}] You have slain contando!`,
];
fs.appendFileSync(LOG, `${lineas.join('\r\n')}\r\n`);
await espera(4000);

const despues = [];
for (const v of vs) despues.push(await v.lee(FIRMA));

console.log('  ventana                   nodos   ¿se mueve?');
const movidas = [];
vs.forEach((v, i) => {
  const a = antes[i]?.firma ?? '';
  const b = despues[i]?.firma ?? '';
  const mueve = a !== b;
  if (mueve) movidas.push(v.nombre);
  console.log(`  ${v.nombre.padEnd(24)} ${String(despues[i]?.nodos ?? 0).padStart(5)}   ${mueve ? 'sí' : 'NO'}`);
});
console.log('');

/**
 * EL CONTROL POSITIVO VA ANTES QUE CUALQUIER VEREDICTO NEGATIVO. Si no se movió
 * ninguna, lo que está roto es la sonda —el registro no llegó, la aplicación no
 * enganchó— y decir «todas congeladas» sería publicar el silencio del
 * instrumento.
 */
ok(movidas.length > 0, 'CONTROL POSITIVO: al menos una ventana se mueve',
  movidas.length ? `se movieron: ${movidas.join(', ')}` : 'NINGUNA: la rota es la sonda, no las ventanas');

if (movidas.length) {
  for (const v of vs) {
    ok(movidas.includes(v.nombre), `${v.nombre}: repinta con el estado`,
      movidas.includes(v.nombre) ? '' : 'CONGELADA: llega el estado y no cambia lo pintado');
  }
}

/**
 * Y AHORA LO QUE LA FIRMA GENÉRICA NO PUEDE DECIR.
 *
 * El panel repinta cada medio segundo por su cuenta atrás, y la ventana
 * principal tiene relojes: las dos «se mueven» aunque no les llegara el estado.
 * Así que se comprueba algo que SÓLO puede venir del estado nuevo:
 *
 *   · el temporizador de «contando» tiene que REINICIARSE con su muerte;
 *   · y el overlay tiene que apilar la pelea cuando se cierre — que es el canal
 *     `fight:closed`, el único que va a una sola ventana a mano.
 */
const panel = vs.find((v) => v.nombre === 'overlay-cronos.html');
const over = vs.find((v) => v.nombre === 'overlay.html');

// La pelea se cierra por inactividad: `idleSec` es 20 s.
let apiladas = 0;
for (let i = 0; i < 40; i++) {
  apiladas = await over.lee(`document.querySelectorAll('#oClosed .ok-row, #oClosed .ov-cerrada, #oClosed > *').length`);
  if (apiladas > 0) break;
  await espera(1000);
}
ok(apiladas > 0, 'el overlay RECIBE `fight:closed`: apila la pelea cerrada',
  apiladas > 0 ? `${apiladas} en la pila` : 'no apiló ninguna: el canal va sólo a esta ventana y no llegó');


let reinicio = null;
for (let i = 0; i < 45 && !reinicio; i++) {
  const t = await panel.lee(`(() => {
    const l = [...document.querySelectorAll('.pan-l')].find((x) => /contando/.test(x.textContent));
    return l?.querySelector('.pan-t')?.textContent ?? null;
  })()`);
  /**
   * SE ESPERA A QUE LA PELEA CIERRE, y por eso este bloque va DESPUÉS del de
   * arriba: el crono se reinicia con lo que dice el ALMACÉN, y la muerte no
   * llega al almacén hasta que la pelea se cierra por inactividad —`idleSec`,
   * 20 s—. Con doce segundos de espera daba «no se reinicia» y la conclusión
   * habría sido que el panel no recibe el estado. Era la sonda con prisa.
   */
  // Con `manual: 3600` y la muerte recién escrita, la cuenta vuelve cerca de 60:00.
  if (t && /^(59|60):/.test(t)) reinicio = t;
  else await espera(600);
}
ok(!!reinicio, 'el panel RECIBE el estado: la muerte reinicia su cuenta atrás',
  reinicio ? `vuelve a ${reinicio}` : 'la cuenta no volvió a empezar: llega el reloj pero no el estado');


console.log(`\n${mal} de ${5 + vs.length} comprobaciones fallan\n`);
fin(mal ? 1 : 0);
