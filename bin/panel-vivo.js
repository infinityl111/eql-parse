#!/usr/bin/env node
/**
 * ¿SE ABRE EL PANEL DE TEMPORIZADORES, Y QUÉ PINTA DENTRO?
 *
 * El panel es OTRA VENTANA, así que `bin/ui-volcar.js` no lo ve: aquél busca el
 * objetivo cuya URL lleva `index.html`. Aquí se pide `overlay-cronos.html`.
 *
 * Y esto comprueba lo que ninguna prueba pura puede: **que la ventana exista**.
 * El constructor estaba verde desde el primer minuto y el panel no se abría —
 * lo pedía `renderCronos`, que sólo corre si estás mirando esa sección.
 *
 *     PRODUCIR NO ES PINTAR, Y PINTAR NO ES TENER VENTANA.
 *
 * La preparación —carpeta de datos, configuración real, `logPath`, almacén
 * sellado, esperas y la comprobación de que el motor enganchó— vive en
 * `bin/sonda.js`, porque tres sondas tropezaron con lo mismo y la cuarta
 * también lo habría hecho.
 *
 * Uso:  npm run panel  ·  node bin/panel-vivo.js
 */
import { arrancaListo, hace, espera } from './sonda.js';

const BASE = "Nagafen's Lair";

/**
 * DOS CRONOS Y NO UNO: con uno solo el orden no se puede comprobar, y el orden
 * —los vencidos arriba— es la mitad de lo que hace útil el panel.
 *
 * `vencido` murió hace rato y su tiempo es corto: sale VENCIDO.
 * `contando` acaba de morir y su tiempo es largo: sale CONTANDO.
 */
const CRONOS = [
  { nombre: 'contando', base: BASE, diff: 2, mode: null, manual: 3600 },
  { nombre: 'vencido', base: BASE, diff: 2, mode: null, manual: 60 },
];

const { lee, fin } = await arrancaListo({
  nombre: 'eql-panel-vivo',
  ventana: 'overlay-cronos.html',
  vivo: 'vencido',
  registro: [
    `[${hace(7200)}] Logging to 'eqlog.txt' is now *ON*.`,
    `[${hace(7195)}] You have entered ${BASE} 2 (Adaptive).`,
    // CADA MUERTE NECESITA SU COMBATE: sin daño el motor no abre pelea, y sin
    // pelea la muerte no llega al índice, que es de donde se leen.
    `[${hace(7010)}] You slash vencido for 120 points of damage.`,
    `[${hace(7000)}] You have slain vencido!`,
    `[${hace(5010)}] You slash vencido for 118 points of damage.`,
    `[${hace(5000)}] You have slain vencido!`,
    `[${hace(70)}] You slash contando for 240 points of damage.`,
    `[${hace(60)}] You have slain contando!`,
  ],
  config: { cronos: CRONOS },
});

/**
 * LA PRIMERA RESPUESTA NO VALE COMO RESPUESTA.
 *
 * El panel se abre, carga su módulo, pregunta la configuración y las muertes
 * por el puente, y sólo entonces pinta. Leyendo a los tres segundos salía unas
 * veces con contenido y otras vacío — y un vacío así es indistinguible de un
 * panel roto. Se espera a que **deje de cambiar**, no a que diga lo que quiero:
 * esperar a ver lo que espero sería una prueba que se aprueba sola.
 *
 * ── SE ESPERA A LA FORMA, NO AL TEXTO, Y ESO LO ENSEÑÓ UN ARREGLO ─────────
 *
 * Esto comparaba el `innerHTML` entero, y funcionaba porque el panel estaba
 * CONGELADO: no le llegaba ningún snapshot. Arreglado el empuje, la cuenta
 * atrás cambia cada medio segundo y el HTML no se repite jamás — así que la
 * espera se agotaba y la sonda declaraba roto un panel recién arreglado.
 *
 * **Una sonda escrita contra un artefacto quieto da por normal que esté
 * quieto.** Se espera a `dataset.sig`, que es la firma del panel sin lo
 * volátil: la propia definición de «la misma forma» que usa el pintor.
 */
async function esperaEstable() {
  let previo = null;
  let iguales = 0;
  for (let i = 0; i < 40; i++) {
    const ahora = await lee(`(() => {
      const h = document.getElementById('pan');
      return { sig: h?.dataset.sig ?? null, filas: h?.querySelectorAll('.pan-l, .pan-vacio').length ?? 0 };
    })()`);
    if (ahora?.filas && ahora.sig && ahora.sig === previo) {
      iguales += 1;
      if (iguales >= 2) return true;
    } else {
      iguales = 0;
    }
    previo = ahora?.sig ?? null;
    await espera(500);
  }
  return false;
}

if (!await esperaEstable()) {
  console.error('\nEl panel nunca se quedó quieto en 20 s.');
  console.error('Un panel vacío y sin decir por qué es indistinguible de uno roto.\n');
  fin(1);
}

const datos = await lee(`(() => {
  const h = document.getElementById('pan');
  const filas = [...h.querySelectorAll('.pan-l')].map((l) => ({
    nombre: l.querySelector('.pan-n')?.textContent,
    tiempo: l.querySelector('.pan-t')?.textContent,
    huecos: l.querySelector('.pan-h')?.textContent ?? null,
    ya: l.classList.contains('pan-ya'),
  }));
  return {
    filas,
    esquinas: h.querySelectorAll('[data-esq]').length,
    deslizador: !!h.querySelector('.mo-op input'),
    vacio: h.querySelector('.pan-vacio')?.textContent ?? null,
  };
})()`);

console.log('\nEL PANEL DE TEMPORIZADORES, en vivo\n');
if (!datos) { console.error('  no se pudo leer el panel'); fin(1); }

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

console.log('  filas pintadas:');
for (const f of datos.filas) {
  console.log(`     ${f.ya ? '▲' : ' '} ${String(f.nombre).padEnd(12)} ${
    String(f.tiempo).padEnd(18)} ${f.huecos ?? ''}`);
}
if (datos.vacio) console.log(`     (vacío: «${datos.vacio}»)`);
console.log('');

ok(datos.filas.length === CRONOS.length, `están los ${CRONOS.length} temporizadores`,
  `${datos.filas.length} filas`);
ok(datos.filas[0]?.ya === true, 'el vencido va ARRIBA',
  'el panel se mira de reojo: lo accionable primero');
ok(datos.filas.some((f) => f.tiempo && /\d:\d\d/.test(f.tiempo)), 'y el que cuenta enseña su reloj');
ok(datos.esquinas === 4, 'las cuatro esquinas de redimensión están puestas');
ok(datos.deslizador, 'y el deslizador de transparencia');

/**
 * Y EL TAMAÑO, comprobado por lo que HACE y no por estar puesto.
 *
 * Un deslizador que existe y no escala nada se ve igual que uno que funciona:
 * se mide la altura de una fila, se lleva el mando al máximo y se vuelve a
 * medir. Si no crece, el mando es un adorno.
 */
const letra = await lee(`(() => {
  const i = document.querySelector('.mo-le input');
  if (!i) return null;
  const antes = document.querySelector('.pan-l')?.getBoundingClientRect().height ?? 0;
  i.value = i.max;
  i.dispatchEvent(new Event('input', { bubbles: true }));
  const despues = document.querySelector('.pan-l')?.getBoundingClientRect().height ?? 0;
  return { antes, despues, max: i.max, mandos: !!document.querySelector('.mo-mandos') };
})()`);

ok(!!letra?.mandos, 'el tamaño está DENTRO del overlay, con la transparencia',
  'en Ajustes habría que cambiarlo, mirar la otra ventana y volver');
ok(letra && letra.despues > letra.antes,
  'y al llevarlo al máximo, las filas crecen de verdad',
  letra ? `${Math.round(letra.antes)} px → ${Math.round(letra.despues)} px (×${letra.max})` : 'sin mando');

// Y AGUANTA EL REPINTADO, que llega medio segundo después: lo elegido sale del
// modelo, y un modelo que no se entera lo deshace solo.
await espera(2500);
const tras = await lee(`(() => {
  const f = document.querySelector('.pan-l');
  const i = document.querySelector('.mo-le input');
  return { alto: f?.getBoundingClientRect().height ?? 0, valor: i?.value ?? null };
})()`);
ok(tras && tras.alto > (letra?.antes ?? 0),
  'y lo elegido sobrevive a los repintados',
  tras ? `${Math.round(tras.alto)} px · el mando marca ${tras.valor}` : 'sin panel');

// EL DENOMINADOR, siempre: «falla una» y «sólo miré una» se leen igual.
/**
 * EL PANEL ESTÁ VIVO, que es distinto de estar pintado.
 *
 * PINTAR NO ES SEGUIR PINTANDO. El panel se pintaba una vez al abrirse y se
 * quedaba quieto: el empuje del snapshot nombraba las ventanas una a una y el
 * panel vive en otro sitio, así que no le llegaba ni uno. La cuenta atrás no
 * avanzaba, una muerte no lo reiniciaba y cerrar un temporizador no quitaba su
 * fila. Se ve igual que uno que funciona hasta que miras el reloj dos veces.
 */
const reloj1 = await lee(`document.querySelector('.pan-contando .pan-t')?.textContent`);
await espera(2500);
const reloj2 = await lee(`document.querySelector('.pan-contando .pan-t')?.textContent`);
ok(!!reloj1 && reloj1 !== reloj2, 'la cuenta atrás AVANZA sola',
  `${reloj1} → ${reloj2}${reloj1 === reloj2 ? ' — el panel está congelado' : ''}`);

/**
 * Y LA × DE UNA FILA CIERRA ESE TEMPORIZADOR, no la ventana.
 *
 * Es lo que pidió Campeón y no se puede comprobar leyendo: el botón está en el
 * HTML desde la 1.21.0, y que esté no dice que la lista de la configuración
 * cambie. Se pulsa y se cuenta lo que queda.
 */
await lee(`document.querySelector('.pan-l .pan-x')?.click()`);
let quedan = null;
for (let i = 0; i < 20; i++) {
  quedan = await lee(`document.querySelectorAll('.pan-l').length`);
  if (quedan === CRONOS.length - 1) break;
  await espera(400);
}
ok(quedan === CRONOS.length - 1, 'la × de una fila cierra ESE temporizador',
  `quedan ${quedan} de ${CRONOS.length}`);

console.log(`\n${mal} de 10 comprobaciones fallan\n`);
fin(mal ? 1 : 0);
