/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL PANEL DE TEMPORIZADORES · un overlay, todos dentro
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UNO SOLO, no uno por temporizador. Menos ventanas que gestionar, y encaja con
 * lo que ya hace la cola: ordenar por **el que antes vuelve**.
 *
 * Una línea por crono: nombre, tiempo o «ya debería estar», y **el número de
 * huecos que sostiene la cota**. Ese número no es adorno: **más de la mitad de
 * las cotas se apoyan en un solo hueco** —56 de 108, remedido el 21/08/2026
 * sobre 2.118 peleas por muerte→muerte— y una cota de un hueco es cierta y
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
 *
 * ── «SIN ESTIMACIÓN» ESTUVO DELANTE DE «CONTANDO», Y ESCONDÍA EL RELOJ ────
 *
 * Lo trajo Campeón el 21/08/2026 y se comprobó mirándolo con cinco cronos
 * abiertos. Con el orden viejo, la lista salía así:
 *
 *     Ancient Croaker      Ya debería estar
 *     a shin ghoul knight  +16:50 desde que murió
 *     Kahaptra Z`Taj       +2:00 desde que murió
 *     a greater skeleton   0:20            ← lo que iba a pasar, el cuarto
 *     Lord Nagafen         8:40
 *
 * Un `+2:00` no es más accionable que un `0:20`: **es que no es accionable en
 * absoluto**. Y hay una razón por la que ese grupo nunca puede ganar el sitio
 * de arriba: se ordena por lo que LLEVA, que sólo crece y no cruza ningún
 * umbral. Nada de lo que hay ahí va a pasar nunca. «Contando», en cambio, es
 * el único grupo cuyo primero es el próximo suceso.
 *
 * Así que arriba va lo que el reloj dice —ya está, o va a estar— y abajo lo
 * que no sabemos: sin estimación y sin muerte son las dos caras de eso.
 */
export const RANGO = { vencido: 0, contando: 1, sinEstimacion: 2, esperando: 3 };

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
  /**
   * SIN ESTIMACION NO ES VENCIDO. Sabemos cuando murio y no sabemos cuanto
   * tarda: decir «ya deberia estar» seria afirmar algo que no tenemos con que
   * afirmar. Lo que si se puede decir es el reloj — `+16m 50s` desde su muerte.
   */
  if (!f.conEstimacion) return 'sinEstimacion';
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
    // Sin estimacion se ordenan por lo que llevan esperando, que es lo unico
    // que tienen. Los que ni han muerto no tienen ni eso.
    if (ra === RANGO.sinEstimacion) return (b.transcurrido ?? 0) - (a.transcurrido ?? 0);
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
    : est === 'sinEstimacion' ? esc(t('cro.desdeMuerte', { t: f.transcurridoTxt ?? '' }))
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
  'cro.title', 'cro.disponible', 'cro.esperando', 'cro.desdeMuerte',
  'cro.close', 'cro.vacio',
  'cro.cotaH1', 'cro.cotaHn', 'pan.fueraDeZona', 'mo.opacidad',
];
