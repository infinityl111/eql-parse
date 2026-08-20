/**
 * ¿SE PUEDE ESCRIBIR? La prueba tosca, por la vía real.
 *
 * EL FALLO, DICHO POR CAMPEÓN: en Reapariciones no se puede escribir en el
 * campo del nombre. La causa medida: la sección reescribía su `innerHTML` en
 * cada snapshot —cada 250 ms— y destruía el `<input>` con el foco y lo tecleado
 * dentro.
 *
 * NINGUNA PRUEBA DE LÓGICA PUEDE VER ESTO, porque no hay DOM en ellas y porque
 * el fallo no está en lo que se pinta sino en CUÁNTAS VECES se pinta. Así que
 * esto abre la aplicación de verdad, escribe una letra cada vez, espera varios
 * empujones del motor y mira si el texto sigue ahí y si el nodo es el mismo.
 *
 * Lo que comprueba, y son dos cosas distintas:
 *   1. el TEXTO sobrevive        — es lo que sufre el usuario
 *   2. el NODO es el mismo       — es la causa; si cambia, el arreglo no está
 *
 * La segunda es la que importa para no volver aquí: se puede conservar el texto
 * a mano y seguir reconstruyendo, y entonces el cursor salta y la selección se
 * pierde aunque el valor «se vea bien».
 *
 * Uso:  node bin/ui-teclear.js [seccion] [--campo=#croNuevo] [--ticks=12]
 */
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador } from './cdp.js';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || d;
const SEC = (process.argv[2] ?? 'cronos').replace(/^--.*/, '') || 'cronos';
const CAMPO = arg('campo', '#croNuevo');
const TICKS = +arg('ticks', '12');          // 12 × 250 ms = 3 s de empujones
/**
 * HAY CAMPOS DONDE RECONSTRUIR ES LO CORRECTO. El buscador de la lista de
 * peleas filtra lo que hay debajo, así que al teclear la lista CAMBIA y tiene
 * que repintarse: exigirle el mismo nodo sería pedirle que no haga su trabajo.
 * Con `--rehace` se comprueba lo que sí debe cumplirse siempre —el texto, el
 * foco y LA POSICIÓN DEL CURSOR—, que es justo lo que una restauración a mano
 * se deja: conservar sólo el valor manda el cursor al final.
 */
const REHACE = process.argv.includes('--rehace');

if (!(await puertoLibre())) {
  console.error(`\nEl puerto ${PUERTO} está ocupado: hay otra ventana con depuración abierta.\n`);
  process.exit(2);
}

const hijo = lanzar();
const pagina = await conecta();
const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
await listo;
const evalua = evaluador(manda);
const fin = (cod) => { try { ws.close(); } catch { /* ya */ } hijo.kill(); process.exit(cod); };

const LETRAS = 'Nagafen';

try {
  await manda('Runtime.enable');
  await espera(2500);
  await evalua(`document.querySelector('[data-sec=${SEC}]')?.click()`);
  await espera(2500);

  const hay = await evalua(`!!document.querySelector(${JSON.stringify(CAMPO)})`);
  if (!hay) { console.error(`\nNo existe el campo ${CAMPO} en la sección «${SEC}».\n`); fin(3); }

  // Se marca el nodo para saber después si es EL MISMO o uno nuevo.
  await evalua(`document.querySelector(${JSON.stringify(CAMPO)}).dataset.marca = 'testigo'`);

  // Una letra cada 400 ms: entre letra y letra caben uno o dos empujones.
  for (const ch of LETRAS) {
    await evalua(`(() => {
      const i = document.querySelector(${JSON.stringify(CAMPO)});
      if (!i) return;
      i.focus();
      i.value += ${JSON.stringify(ch)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await espera(400);
  }

  // El cursor se pone A MITAD del texto a propósito: conservar sólo el valor lo
  // manda al final, y entonces «se ve bien» y escribir sigue siendo imposible.
  await evalua(`(() => {
    const i = document.querySelector(${JSON.stringify(CAMPO)});
    i.focus(); i.setSelectionRange(3, 3);
  })()`);

  // Y ahora se le deja al motor todo el tiempo del mundo sin tocar nada.
  await espera(TICKS * 250);

  const r = await evalua(`(() => {
    const i = document.querySelector(${JSON.stringify(CAMPO)});
    return JSON.stringify({
      existe: !!i,
      valor: i ? i.value : null,
      mismoNodo: i ? i.dataset.marca === 'testigo' : false,
      cursor: i ? i.selectionStart : null,
      tieneFoco: i ? document.activeElement === i : false,
    });
  })()`);
  const d = JSON.parse(r);

  const esperado = LETRAS;
  const okTexto = d.valor === esperado;
  const okNodo = REHACE || d.mismoNodo;
  const okCursor = d.cursor === 3;

  console.log(`\nsección «${SEC}» · campo ${CAMPO} · ${TICKS} empujones de 250 ms después de teclear\n`);
  console.log(`  el texto sobrevive   ${okTexto ? 'SÍ' : 'NO'}   (esperaba ${JSON.stringify(esperado)}, hay ${JSON.stringify(d.valor)})`);
  console.log(`  el nodo es el mismo  ${d.mismoNodo ? 'SÍ' : 'NO'}   ${d.mismoNodo ? ''
    : (REHACE ? '(esperado aquí: repintar es su trabajo)' : '← la sección se está reconstruyendo debajo')}`);
  console.log(`  conserva el foco     ${d.tieneFoco ? 'SÍ' : 'NO'}`);
  console.log(`  conserva el cursor   ${okCursor ? 'SÍ' : 'NO'}   (esperaba 3, hay ${d.cursor})\n`);

  if (!okTexto || !okNodo || !okCursor || !d.tieneFoco) {
    console.error('FALLO: no se puede escribir con normalidad en ese campo.\n');
    fin(1);
  }
  console.log('OK\n');
  fin(0);
} catch (e) {
  console.error('\n', e?.message ?? e, '\n');
  fin(4);
}
