#!/usr/bin/env node
/**
 * ¿SE ABRE EL PANEL DE TEMPORIZADORES, Y QUÉ PINTA DENTRO?
 *
 * El panel es OTRA VENTANA, así que `bin/ui-volcar.js` no lo ve: aquel busca el
 * objetivo cuya URL lleva `index.html`. Aquí se busca `overlay-cronos.html`.
 *
 * Y esto comprueba lo que ninguna prueba pura puede: que la ventana **exista**.
 * El constructor está verde desde el primer minuto —`test/cronos-panel.js`— y
 * eso no dice nada de si alguien lo abre. Es la misma distinción de siempre:
 * producir no es pintar, y pintar no es tener ventana.
 *
 * Uso:  node bin/panel-vivo.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lanzar, espera, cdp, puertoLibre, PUERTO } from './cdp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(os.tmpdir(), 'eql-panel-vivo');

/** Lo mismo que hace `bin/rotulos.js`: partir de la configuración REAL. */
const REAL = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'config.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'config.json'),
].find((f) => fs.existsSync(f));
if (!REAL) {
  console.error('\nSin configuración real de la que partir, la aplicación arranca en');
  console.error('el asistente y esta comprobación no mide nada.\n');
  process.exit(3);
}

fs.rmSync(DATOS, { recursive: true, force: true });
fs.mkdirSync(DATOS, { recursive: true });

const BASE = "Nagafen's Lair";
/**
 * LA MUERTE TIENE QUE SER RECIENTE, o los dos salen vencidos y el orden no
 * prueba nada.
 *
 * Con la fecha fija que llevaba antes -4 de agosto- los dos temporizadores
 * estaban vencidos desde hacia dos semanas, asi que la fila que CUENTA no se
 * podia ejercitar. Es la misma trampa que en `bin/rotulos.js` con el visto:
 * una fijacion con fecha muerta no puede producir un estado vivo.
 */
const DIA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hace = (seg) => {
  const d = new Date(Date.now() - seg * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  return `${DIA[d.getDay()]} ${MES[d.getMonth()]} ${dd} ${d.toTimeString().slice(0, 8)} ${d.getFullYear()}`;
};

const LOG = path.join(DATOS, 'eqlog_Panel_erudin.txt');
fs.writeFileSync(LOG, [
  `[${hace(7200)}] Logging to 'eqlog.txt' is now *ON*.`,
  `[${hace(7195)}] You have entered ${BASE} 2 (Adaptive).`,
  // CADA MUERTE NECESITA SU COMBATE: sin dano el motor no abre pelea, y sin
  // pelea la muerte no llega al indice, que es de donde se leen.
  `[${hace(7010)}] You slash vencido for 120 points of damage.`,
  `[${hace(7000)}] You have slain vencido!`,
  `[${hace(5010)}] You slash vencido for 118 points of damage.`,
  `[${hace(5000)}] You have slain vencido!`,
  // `contando` acaba de morir y su tiempo es largo: sale CONTANDO.
  `[${hace(70)}] You slash contando for 240 points of damage.`,
  `[${hace(60)}] You have slain contando!`,
  '',
].join('\r\n'));

/**
 * DOS CRONOS Y NO UNO: con uno solo, el orden no se puede comprobar, y el orden
 * —los vencidos arriba— es la mitad de lo que hace útil el panel.
 */
const CRONOS = [
  { nombre: 'contando', base: BASE, diff: 2, mode: null, manual: 3600 },
  { nombre: 'vencido', base: BASE, diff: 2, mode: null, manual: 60 },
];

fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify({
  ...JSON.parse(fs.readFileSync(REAL, 'utf8')),
  // LA CLAVE ES logPath, no path: el arranque mira cfg.logPath para
  // engancharse al registro. Con la clave equivocada el motor no lee nada y
  // el almacen se queda vacio SIN FALLAR — los cronos salen «esperando su
  // primera muerte» teniendo su muerte escrita tres lineas mas arriba.
  lang: 'es', cronos: CRONOS, logPath: LOG, path: LOG, overlay: true,
}, null, 2));

const hijo = lanzar([`--user-data-dir=${DATOS}`]);
const fin = (c) => { try { hijo.kill(); } catch { /* ya no está */ } process.exit(c); };

/** El objetivo del PANEL, no el de la ventana principal. */
async function esperaPanel() {
  for (let i = 0; i < 60; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const p = lista.find((x) => x.url.includes('overlay-cronos.html'));
      if (p) return p;
    } catch { /* todavía no */ }
    await espera(500);
  }
  return null;
}

const ficha = await esperaPanel();
if (!ficha) {
  console.error('\nEL PANEL NO SE ABRIÓ.');
  console.error('Con dos temporizadores en la configuración tenía que abrirse solo.');
  console.error('Eso es el fallo: el constructor puede estar perfecto y no tener ventana.\n');
  fin(1);
}

/**
 * LA PRIMERA RESPUESTA NO VALE COMO RESPUESTA.
 *
 * El panel se abre, carga su modulo, pregunta la configuracion y las muertes
 * por el puente, y solo entonces pinta. Leyendo a los tres segundos salia unas
 * veces con contenido y otras vacio — y un vacio asi es indistinguible de un
 * panel roto. Se espera a que haya algo, con plazo.
 */
async function esperaEstable(lee) {
  let previo = null;
  let iguales = 0;
  for (let i = 0; i < 40; i++) {
    const ahora = await lee("document.getElementById('pan').innerHTML");
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

const cli = cdp(ficha.webSocketDebuggerUrl);
await cli.listo;


const lee = async (js) => {
  const r = await cli.manda('Runtime.evaluate', { expression: js, returnByValue: true });
  return r?.result?.value;
};

if (!await esperaEstable(lee)) {
  console.error('\nEl panel nunca se quedo quieto en 20 s.');
  console.error('Un panel vacio y sin decir por que es indistinguible de uno roto.\n');
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
    largo: h.innerHTML.length,
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
  console.log(`     ${f.ya ? '▲' : ' '} ${String(f.nombre).padEnd(12)} ${String(f.tiempo).padEnd(18)} ${f.huecos ?? ''}`);
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

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
fin(mal ? 1 : 0);
