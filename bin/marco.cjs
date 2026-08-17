/**
 * El armazón comprobado por ESTADO y no por pintura: qué sobrevive al ir a una
 * sección y volver — la lista con su selección, la pelea abierta y sus cifras,
 * el ancho sin huecos fantasma, las migas y el titular del registro.
 *
 * Si el fallo se ve en una foto es de `npm run capturas`; si hay que HACER algo
 * y luego mirar, es de aquí. No se solapan.
 *
 * Se ejecuta con `electron`.
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
  await ejec(pulsa('[data-sec="escena"]'));
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

  /**
   * ── 4 · LAS MIGAS DE UNA EXTRACCIÓN ──────────────────────────────────────
   *
   * Lo que más fácil se pierde al sacar unas páginas de un enrutador son las
   * migas: son NAVEGACIÓN y no contenido, así que no las echa de menos nadie
   * hasta que intenta volver del expediente a la rejilla y descubre que no
   * puede. Una captura del expediente sale perfecta con las migas rotas.
   *
   * Se comprueba el viaje entero y de vuelta, que es el único camino que
   * quedará cuando la pestaña vieja se haya ido.
   */
  const haySeccion = await ejec(`!!document.querySelector(${JSON.stringify('[data-sec="enemigos"]')})`);
  if (haySeccion) {
    await ejec(pulsa('[data-sec="enemigos"]'));
    await espera(3000);
    const rejilla = await ejec('document.querySelectorAll(".encrow.foe").length');
    di(rejilla > 0, `la rejilla de enemigos pinta ${rejilla} fichas`);

    await ejec(pulsa('.encrow.foe .nm'));
    await espera(2500);
    const ficha = await ejec(`(() => ({
      titulo: document.querySelector('.dos-head h3')?.textContent.trim() ?? null,
      migas: [...document.querySelectorAll('.enc-crumb > *')].map((x) => x.textContent.trim()),
      volver: !!document.querySelector('[data-crumb]'),
    }))()`);
    di(!!ficha.titulo, `se abre el expediente de «${ficha.titulo}»`);
    di(ficha.volver && ficha.migas.length >= 2,
      `con migas para volver: ${ficha.migas.join(' › ') || '(ninguna)'}`);

    await ejec(pulsa('[data-crumb]'));
    await espera(2500);
    const vuelto = await ejec('document.querySelectorAll(".encrow.foe").length');
    di(vuelto > 0, `la miga devuelve a la rejilla (${vuelto} fichas)`);
  }

  /**
   * ── 5 · CADA SECCIÓN ENSEÑA LO SUYO ──────────────────────────────────────
   *
   * Parece de perogrullo y es el fallo que más cerca estuvo de colarse: al
   * repartir las páginas de la enciclopedia en secciones, entrar en Progreso
   * viniendo de Botín rebotaba a Botín. La barra marcaba una cosa y la pantalla
   * enseñaba otra, las capturas salían perfectas y la cobertura cuadraba — sólo
   * que eran las MISMAS 29.284 px fotografiadas dos veces con dos nombres.
   *
   * Lo delató comparar los altos, no mirar las fotos. Así que aquí se exige que
   * cada sección traiga un elemento que sólo tiene ella: si el rebote vuelve, no
   * hace falta que nadie se fije.
   */
  const propios = [
    ['enemigos', '.encrow.foe'],
    ['botin-h', '.lootcard'],
    ['progreso', '.periodos'],
  ];
  for (const [id, sel] of propios) {
    const existe = await ejec(`!!document.querySelector(${JSON.stringify(`[data-sec="${id}"]`)})`);
    if (!existe) continue;
    await ejec(pulsa(`[data-sec="${id}"]`));
    await espera(3000);
    const n = await ejec(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
    di(n > 0, `«${id}» enseña lo suyo (${n} × ${sel})`);
  }

  /**
   * ── 6 · EL TITULAR DEL REGISTRO (D4) ─────────────────────────────────────
   *
   * Al sacar el Registro de la barra de documentos, lo primero que se cae es su
   * TITULAR: «12:36:35–12:38:06», la línea que contesta de qué tramo estamos
   * hablando sin abrir nada. Era lo que distinguía esa pestaña de un cajón, es
   * un elemento del inventario (D4), y una captura del registro sale igual de
   * bien con él y sin él.
   */
  const hayRegistro = await ejec(`!!document.querySelector(${JSON.stringify('[data-sec="registro"]')})`);
  if (hayRegistro) {
    await ejec(pulsa('[data-sec="registro"]'));
    await espera(3000);
    const titular = await ejec("document.querySelector('#secPane .sec-title')?.textContent.trim() ?? null");
    const horas = /\d{1,2}[:.]\d{2}[:.]\d{2}\s*[–-]\s*\d{1,2}[:.]\d{2}[:.]\d{2}/;
    di(!!titular && horas.test(titular), `el Registro conserva su titular (D4): «${titular ?? 'ninguno'}»`);
  }

  console.log(mal ? `\n  ${mal} comprobación(es) MAL\n` : '\n  el marco aguanta el ir y venir\n');
  app.exit(mal ? 1 : 0);
}).catch((e) => { console.error(`\n  MAL  ${e.message}\n`); app.exit(2); });
