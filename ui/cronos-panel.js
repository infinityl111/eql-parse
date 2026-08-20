/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL PANEL DE TEMPORIZADORES · un overlay, todos dentro
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UNO SOLO, no uno por temporizador. Menos ventanas que gestionar, y encaja con
 * lo que ya hace la cola: ordenar por **el que antes vuelve**.
 *
 * Una línea por crono: nombre, tiempo o «ya debería estar», y **el número de
 * huecos que sostiene la cota**. Ese número no es adorno: de las 95 claves con
 * cota, 46 se apoyan en un solo hueco, y una cota de un hueco es cierta y
 * floja. Sin el número al lado, las dos se leen igual.
 *
 * ── LOS QUE YA DEBERÍAN ESTAR, ARRIBA ─────────────────────────────────────
 *
 * Y no por orden alfabético ni por antigüedad: el panel se mira de reojo
 * mientras se juega, y lo accionable va primero. Entre los vencidos manda el
 * que lleva más tiempo vencido; entre los que cuentan, el que antes vuelve.
 *
 * ── UN FILTRO QUE VACÍA TIENE QUE DECIR QUÉ DEJÓ FUERA ────────────────────
 *
 * Si se filtra por zona y no queda ninguno, **no se deja en blanco**: se dice
 * cuántos hay en otras zonas. Una lista vacía y una lista filtrada a cero se
 * ven idénticas, y son cosas distintas — la primera dice «no tienes ninguno» y
 * la segunda «los tienes en otro sitio». Es la misma familia que la ausencia de
 * prueba codificada como un cero.
 *
 * Aquí no se toca el DOM ni se lee ningún reloj: entra un modelo con los textos
 * ya formateados, sale una cadena.
 */
import { marco } from './marco-overlay.js';
import { t } from '../src/i18n.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * EL ORDEN. Puro y aparte, porque es una decisión y no una plantilla.
 *
 * `restante` en `null` o `<= 0` es «ya debería estar». `transcurrido` desempata
 * entre vencidos: el que lleva más tiempo esperando va antes.
 */
export const RANGO = { vencido: 0, contando: 1, esperando: 2 };

/**
 * TRES ESTADOS Y NO DOS. Un crono sin ninguna muerte suya en el registro no
 * esta vencido: **esta esperando su primera muerte**. Decir «ya deberia estar»
 * de un bicho del que no sabemos ni cuando murio es inventarse una afirmacion.
 *
 * Y no es un caso raro: es el estado en que nace todo crono abierto desde el
 * overlay principal, donde el enemigo suele estar vivo.
 */
export function estadoDe(f) {
  if (f.esperando) return 'esperando';
  return f.restante == null || f.restante <= 0 ? 'vencido' : 'contando';
}

export function ordena(fichas = []) {
  return [...fichas].sort((a, b) => {
    const ra = RANGO[estadoDe(a)];
    const rb = RANGO[estadoDe(b)];
    if (ra !== rb) return ra - rb;
    // Entre vencidos manda el que lleva mas esperando; entre los que cuentan,
    // el que antes vuelve. Los que esperan no tienen con que ordenarse.
    if (ra === RANGO.vencido) return (b.transcurrido ?? 0) - (a.transcurrido ?? 0);
    if (ra === RANGO.contando) return (a.restante ?? 0) - (b.restante ?? 0);
    return 0;
  });
}

/**
 * Qué decir cuando el filtro no deja nada. Devuelve CLAVE y variables.
 *
 * Tres estados y no dos: sin cronos, con cronos pero todos fuera del filtro, y
 * con cronos visibles. El de en medio es el que se dejaba en blanco.
 */
export function claveDelVacio({ total = 0, visibles = 0 } = {}) {
  if (visibles > 0) return null;
  if (total === 0) return { clave: 'cro.vacio', vars: {} };
  return { clave: 'pan.fueraDeZona', vars: { n: total } };
}

/** Una línea del panel. */
function lineaDe(f) {
  const est = estadoDe(f);
  const vencido = est === 'vencido';
  const huecos = f.cota?.huecos
    ? `<span class="pan-h">${esc(f.cota.huecos === 1
      ? t('cro.cotaH1') : t('cro.cotaHn', { n: f.cota.huecos }))}</span>`
    : '';
  return `<li class="pan-l pan-${est}${vencido ? ' pan-ya' : ''}" data-i="${f.i}">
    <span class="pan-n">${esc(f.nombre)}</span>
    <span class="pan-t">${est === 'esperando' ? esc(t('cro.esperando'))
    : vencido ? esc(t('cro.disponible')) : esc(f.restanteTxt ?? '')}</span>
    ${huecos}
    <button class="pan-x" data-quita="${f.i}" title="${esc(t('cro.close'))}">×</button>
  </li>`;
}

/**
 * EL PANEL. `conNumero` en false vacía las cuentas atrás, que es lo que deja
 * usar la misma llamada como firma de `pintaEstable` — igual que en la sección.
 */
export function construye(modelo = {}, conNumero = true) {
  const { fichas = [], total = null, opacidad = 1, zona = null } = modelo;
  const orden = ordena(fichas).map((f) => (conNumero ? f : { ...f, restanteTxt: '' }));
  const vacio = claveDelVacio({ total: total ?? fichas.length, visibles: orden.length });

  return `${marco({ opacidad })}
    <div class="pan-bar">
      <span class="eyebrow">${esc(t('cro.title'))}</span>
      ${zona ? `<span class="pan-z">${esc(zona)}</span>` : ''}
      <span class="spacer"></span>
      <button class="ov-btn close" data-cerrar>×</button>
    </div>
    ${vacio
    ? `<div class="pan-vacio">${esc(t(vacio.clave, vacio.vars))}</div>`
    : `<ul class="pan-lista">${orden.map(lineaDe).join('')}</ul>`}`;
}

/**
 * TODO LO QUE ESTE PANEL PUEDE PRODUCIR, declarado.
 *
 * Lo exige `test/cronos-panel.js`, y en las dos direcciones: una clave
 * declarada que nadie produce es un rótulo muerto; una producida y sin declarar
 * es una declaración que miente.
 */
export const CLAVES = [
  'cro.title', 'cro.disponible', 'cro.esperando', 'cro.close', 'cro.vacio',
  'cro.cotaH1', 'cro.cotaHn', 'pan.fueraDeZona', 'mo.opacidad',
];
