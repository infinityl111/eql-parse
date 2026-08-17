/**
 * Qué notas de matiz caen por debajo del pliegue: mide dónde queda cada
 * `.hint` y cada `.hallazgo` respecto del alto visible de su panel y lista las
 * que no entran en la primera pantalla. NO CAMBIA NADA — es la entrada de una
 * decisión, no la decisión.
 *
 * Se ejecuta con `electron`.
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
      /**
       * LOS DATOS VESTIDOS DE NOTA NO SE CUENTAN COMO NOTAS.
       *
       * En \`periodosHTML\` hay doce renglones con clase \`.hint\` que no son
       * notas: son las comparaciones entre periodos —«Nivel 50, 10 periodos:
       * mediana 129 → 122 → …»—, y llevan esa clase sólo porque querían verse
       * en gris. Contándolas, Progreso salía como la peor sección del programa
       * en notas escondidas, y es falso: es la peor en datos disfrazados.
       *
       * Se reconocen por un rasgo del contenido —llevan un \`<b>\` y una flecha
       * de serie— y ESO ES UN PARCHE CON FECHA: el arreglo de verdad es darles
       * su propia clase, que es contenido y va con las familias 16 y 17. En
       * cuanto la tengan, esta condición se cambia por la clase y se acabó.
       */
      const disfrazado = (el) => !!el.querySelector('b') && el.textContent.includes('→');
      const todas = [...panel.querySelectorAll('.hint, .hallazgo')];
      const notas = todas.filter((el) => !disfrazado(el)).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          y: Math.round(b.top - caja.top + panel.scrollTop),
          texto: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120),
        };
      }).filter((x) => x.texto);
      return { visible: panel.clientHeight, alto: panel.scrollHeight, notas,
               disfrazados: todas.filter(disfrazado).length };
    })()`);

    const bajo = r.notas.filter((n) => n.y >= r.visible);
    todo.push({ seccion: v.nombre, ...r, bajo: bajo.length });
    console.log(`\n== ${v.nombre} · ${r.alto} px de alto, ${r.visible} visibles `
      + `· ${r.notas.length} notas, ${bajo.length} bajo el pliegue`
      + (r.disfrazados ? ` · ${r.disfrazados} datos con clase de nota, fuera de la cuenta` : ''));
    for (const n of bajo) console.log(`   ${String(n.y).padStart(6)} px  ${n.texto}`);
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(todo, null, 1));
  console.log(`\n  ${todo.reduce((n, x) => n + x.bajo, 0)} notas bajo el pliegue · detalle en ${SALIDA}\n`);
  app.exit(0);
}).catch((e) => { console.error(`\n  MAL  ${e.message}\n`); app.exit(2); });
