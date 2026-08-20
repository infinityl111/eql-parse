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
 */
async function esperaEstable() {
  let previo = null;
  let iguales = 0;
  for (let i = 0; i < 40; i++) {
    const ahora = await lee(`document.getElementById('pan').innerHTML`);
    const hay = /pan-l|pan-vacio/.test(ahora ?? '');
    if (hay && ahora === previo) {
      iguales += 1;
      if (iguales >= 2) return true;
    } else {
      iguales = 0;
    }
    previo = ahora;
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

// EL DENOMINADOR, siempre: «falla una» y «sólo miré una» se leen igual.
console.log(`\n${mal} de 5 comprobaciones fallan\n`);
fin(mal ? 1 : 0);
