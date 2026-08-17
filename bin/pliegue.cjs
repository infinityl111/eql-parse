/**
 * QUÉ NOTAS DE MATIZ VIVEN POR DEBAJO DEL PLIEGUE.
 *
 * En esta aplicación casi ninguna cifra va sola: al lado hay una nota que dice
 * de dónde sale o qué no significa —«la vida estimada descontando lo que se
 * curaron», «2 en 9 caídas son dos cifras medidas juntas, no una
 * probabilidad»—. Esa nota es parte del dato: sin ella el número afirma más de
 * lo que se midió.
 *
 * Y las notas tienden a irse al final del bloque que matizan, que es donde se
 * escriben cómodas. Cuando el bloque no cabe en la pantalla, la nota queda
 * debajo del pliegue: el número se ve siempre y su matiz sólo si alguien baja.
 *
 * Esto lo MIDE en vez de opinarlo: recorre las secciones, mira dónde cae cada
 * `.hint` y cada `.hallazgo` respecto del alto visible del panel, y lista las
 * que se quedan fuera de la primera pantalla.
 *
 * NO CAMBIA NADA. Es la entrada de una decisión posterior — qué notas hay que
 * subir, cuáles pueden quedarse donde están y cuáles sobran.
 *
 * Uso:  npm run pliegue            (español, tema oscuro)
 *       npm run pliegue -- --idioma=en
 */
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

app.setName('eql-parse');
app.setPath('userData', path.join(app.getPath('appData'), 'eql-parse'));

require('../electron/main.cjs');

const { VISTAS, PANEL, arranque } = require('./recorrido.cjs');

const args = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--'))
  .map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)]; }));

const SALIDA = path.join(__dirname, '..', 'tmp', 'pliegue.json');

app.whenReady().then(async () => {
  const { ejec, espera } = await arranque(app, { idioma: args.idioma ?? 'es' });

  const todo = [];
  for (const v of VISTAS) {
    for (const paso of v.pasos) { await ejec(paso); await espera(900); }
    if (v.espera) await espera(v.espera);

    const r = await ejec(`(() => {
      ${PANEL}
      const caja = panel.getBoundingClientRect();
      const notas = [...panel.querySelectorAll('.hint, .hallazgo')].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          y: Math.round(b.top - caja.top + panel.scrollTop),
          texto: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120),
        };
      }).filter((x) => x.texto);
      return { visible: panel.clientHeight, alto: panel.scrollHeight, notas };
    })()`);

    const bajo = r.notas.filter((n) => n.y >= r.visible);
    todo.push({ seccion: v.nombre, ...r, bajo: bajo.length });
    console.log(`\n== ${v.nombre} · ${r.alto} px de alto, ${r.visible} visibles `
      + `· ${r.notas.length} notas, ${bajo.length} bajo el pliegue`);
    for (const n of bajo) console.log(`   ${String(n.y).padStart(6)} px  ${n.texto}`);
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(todo, null, 1));
  console.log(`\n  ${todo.reduce((n, x) => n + x.bajo, 0)} notas bajo el pliegue · detalle en ${SALIDA}\n`);
  app.exit(0);
}).catch((e) => { console.error(`\n  MAL  ${e.message}\n`); app.exit(2); });
