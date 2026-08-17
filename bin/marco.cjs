/**
 * EL ARMAZÓN, COMPROBADO POR ESTADO Y NO POR PINTURA.
 *
 * Las capturas cazan lo que se ve mal. No cazan lo que se PIERDE al ir y
 * volver: una selección que se olvida, una pelea que se cierra sola, una
 * columna que desaparece y deja su hueco. Eso no es una imagen fea — es una
 * imagen correcta de un estado equivocado, que es peor.
 *
 * Y hace falta ahora porque la mudanza 5 estrena la primera sección SIN la
 * lista de peleas al lado: el momento en que el armazón deja de ser un sitio
 * donde colgar paneles y pasa a tener dos formas distintas.
 *
 * Las tres preguntas, y las tres son de ida y vuelta:
 *
 *   1. Al entrar en una sección del histórico, ¿desaparece la lista? Y al
 *      volver a una de pelea, ¿VUELVE, con la misma pelea marcada?
 *   2. Sin lista, ¿la sección ocupa el ancho que queda, o queda un hueco
 *      fantasma donde estaba la columna?
 *   3. Al volver, ¿sigue abierta la misma pelea — el mismo título, las mismas
 *      cifras— o se ha reseteado a la primera?
 *
 * Uso:  npm run marco
 */
const path = require('node:path');
const { app } = require('electron');

app.setName('eql-parse');
app.setPath('userData', path.join(app.getPath('appData'), 'eql-parse'));

require('../electron/main.cjs');

const { arranque, espera, pulsa } = require('./recorrido.cjs');

let mal = 0;
const di = (bien, texto) => {
  if (!bien) mal++;
  console.log(`  ${bien ? 'ok ' : 'MAL'}  ${texto}`);
};

app.whenReady().then(async () => {
  const { ejec } = await arranque(app, { idioma: 'es' });

  // ── Punto de partida: una pelea abierta en una sección de pelea ──────────
  await ejec(pulsa('#tabCombat'));
  await espera(1000);
  await ejec(pulsa('[data-sec="escena"]'));
  await espera(1200);
  // La SEGUNDA de la lista, no la primera: si algo resetea la selección, caer
  // en la primera es indistinguible de conservarla.
  const abierta = await ejec(`(() => {
    const filas = [...document.querySelectorAll('.fight[data-live="0"]')];
    const el = filas[1] ?? filas[0];
    if (!el) return null;
    el.click();
    return { uid: el.dataset.uid, rotulo: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) };
  })()`);
  if (!abierta) { console.error('  MAL  no hay peleas cerradas en la lista'); app.exit(2); return; }
  await espera(1800);

  const antes = await ejec(`(() => {
    const act = document.querySelector('.fight.active');
    return {
      lista: !!document.getElementById('fightList'),
      activa: act ? act.dataset.uid : null,
      titulo: document.querySelector('.head-title')?.textContent.trim() ?? null,
      cifras: [...document.querySelectorAll('.metric')].map((x) => x.textContent.replace(/\\s+/g, ' ').trim()),
    };
  })()`);
  console.log(`\n  pelea de partida: ${abierta.rotulo}\n`);
  di(antes.lista && antes.activa === abierta.uid, `la lista está y la pelea ${abierta.uid} sale marcada`);

  // ── 1 y 2: una sección del histórico, sin lista ──────────────────────────
  await ejec(pulsa('[data-sec="resumen"]'));
  await espera(2500);
  const sin = await ejec(`(() => {
    const cuerpo = document.getElementById('bodyGrid');
    const pane = document.getElementById('secPane');
    const lateral = document.getElementById('lateral');
    const cb = cuerpo.getBoundingClientRect();
    const pb = pane ? pane.getBoundingClientRect() : null;
    return {
      lista: !!document.getElementById('fightList'),
      columnas: getComputedStyle(cuerpo).gridTemplateColumns,
      // El hueco fantasma se mide así: el panel tiene que empezar donde empieza
      // el cuerpo y acabar donde acaba. Un carril muerto de 272 px se ve aquí y
      // no en una captura, porque el fondo es del mismo color.
      hueco: pb ? Math.round(pb.left - cb.left) : null,
      sobra: pb ? Math.round(cb.right - pb.right) : null,
      ancho: pb ? Math.round(pb.width) : null,
      pintado: pane ? pane.textContent.trim().length : 0,
    };
  })()`);
  di(!sin.lista, 'sin la lista de peleas al lado');
  di(sin.hueco === 0 && sin.sobra === 0,
    `la sección ocupa el ancho entero (${sin.ancho} px, hueco ${sin.hueco}, sobra ${sin.sobra})`);
  di(sin.columnas.split(' ').length === 1, `una sola columna en el cuerpo (${sin.columnas})`);
  di(sin.pintado > 200, `el resumen ha pintado algo (${sin.pintado} caracteres)`);

  // ── 3: volver ────────────────────────────────────────────────────────────
  await ejec(pulsa('[data-sec="escena"]'));
  await espera(2000);
  const vuelta = await ejec(`(() => {
    const act = document.querySelector('.fight.active');
    return {
      lista: !!document.getElementById('fightList'),
      activa: act ? act.dataset.uid : null,
      titulo: document.querySelector('.head-title')?.textContent.trim() ?? null,
      cifras: [...document.querySelectorAll('.metric')].map((x) => x.textContent.replace(/\\s+/g, ' ').trim()),
    };
  })()`);
  di(vuelta.lista, 'la lista vuelve');
  di(vuelta.activa === abierta.uid, `sigue marcada la misma pelea (${vuelta.activa} vs ${abierta.uid})`);
  di(vuelta.titulo === antes.titulo, `sigue abierta la misma pelea: «${vuelta.titulo}»`);
  di(JSON.stringify(vuelta.cifras) === JSON.stringify(antes.cifras),
    `y con las mismas cifras (${vuelta.cifras.length} tarjetas)`);

  console.log(mal ? `\n  ${mal} comprobación(es) MAL\n` : '\n  el marco aguanta el ir y venir\n');
  app.exit(mal ? 1 : 0);
}).catch((e) => { console.error(`\n  MAL  ${e.message}\n`); app.exit(2); });
