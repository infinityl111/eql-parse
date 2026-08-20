/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL MARCO · lo que TODO overlay tiene, y ninguno escribe dos veces
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Redimensionar por las esquinas, un deslizador de transparencia, y que la
 * posición, el tamaño y la opacidad se recuerden **por overlay**.
 *
 * Es la misma jugada que `ui/piezas.js`: se verifica una vez y sirve para los
 * que vengan. El overlay principal lo hereda igual que el de temporizadores, y
 * el día que haya un tercero no hay nada que copiar.
 *
 * ── POR QUÉ LAS ESQUINAS SE PINTAN Y NO SE HEREDAN ────────────────────────
 *
 * Una ventana `frame: false` con `transparent: true` **no trae bordes de
 * redimensión que funcionen**: el marco nativo es justo lo que se ha quitado.
 * Así que las cuatro esquinas son nodos nuestros, y el arrastre viaja al
 * proceso principal, que es el único que puede mover una ventana.
 *
 * ── Y POR QUÉ LA OPACIDAD NO ES `opacity` DE CSS ──────────────────────────
 *
 * Porque el overlay ya usa `opacity` para atenuarse cuando no lo miras —ver
 * `.ov` en `overlay.html`— y dos cosas en el mismo canal se pisan: al pasar el
 * ratón volvería a la opacidad de reposo y no a la que eligió el jugador.
 * Aquí se guarda como variable y la regla la multiplica.
 *
 * Aquí no se toca el DOM: entra un modelo, sale una cadena. El cableado vive
 * en `conectar`, abajo, y es lo único que necesita navegador.
 */
import { t } from '../src/i18n.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Las cuatro esquinas, con el eje que mueve cada una. */
export const ESQUINAS = [
  { id: 'no', x: -1, y: -1 }, { id: 'ne', x: 1, y: -1 },
  { id: 'so', x: -1, y: 1 }, { id: 'se', x: 1, y: 1 },
];

/** El mínimo por debajo del cual un overlay deja de poder leerse. */
export const MINIMO = { ancho: 220, alto: 120 };

/** Los extremos del deslizador. Por debajo de 0,25 no se ve que está ahí. */
export const OPACIDAD = { min: 0.25, max: 1, paso: 0.05, por_defecto: 1 };

/**
 * Encaja unas medidas dentro de lo permitido.
 *
 * Pura y con los mínimos dentro: redimensionar por la esquina de arriba mueve
 * el origen además del tamaño, y sin esta función cada esquina tendría su
 * propia aritmética — que es como se cuela un signo cambiado en una de las
 * cuatro y nadie lo nota hasta que la arrastra.
 */
export function encaja({ x, y, width, height }, esquina, dx, dy) {
  const e = ESQUINAS.find((q) => q.id === esquina);
  if (!e) return { x, y, width, height };
  let w = width + dx * e.x;
  let h = height + dy * e.y;
  // El mínimo se aplica ANTES de mover el origen: si no, la ventana encoge
  // hasta el tope y sigue desplazándose, que es el síntoma de «se me escapa».
  w = Math.max(MINIMO.ancho, w);
  h = Math.max(MINIMO.alto, h);
  return {
    x: e.x < 0 ? x + (width - w) : x,
    y: e.y < 0 ? y + (height - h) : y,
    width: w,
    height: h,
  };
}

/** Una opacidad válida, venga como venga. */
export function opacidadValida(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return OPACIDAD.por_defecto;
  return Math.min(OPACIDAD.max, Math.max(OPACIDAD.min, n));
}

/** Las cuatro esquinas y el deslizador, para meter en cualquier overlay. */
export function marco({ opacidad = OPACIDAD.por_defecto } = {}) {
  return `${ESQUINAS.map((e) => `<div class="mo-esq mo-${e.id}" data-esq="${e.id}"></div>`).join('')}
    <label class="mo-op" title="${esc(t('mo.opacidad'))}">
      <span class="mo-op-i">◐</span>
      <input type="range" min="${OPACIDAD.min}" max="${OPACIDAD.max}"
        step="${OPACIDAD.paso}" value="${opacidadValida(opacidad)}">
    </label>`;
}

/* ── EL CABLEADO ──────────────────────────────────────────────────────────
 * Lo único que toca el navegador. Todo lo de arriba se prueba sin DOM. */

/**
 * @param {HTMLElement} host  dónde viven las esquinas y el deslizador
 * @param {object} api        `{ bounds(), mueve(b), opacidad(v) }`
 */
export function conectar(host, api = {}) {
  if (!host || host.dataset.moConectado === '1') return;
  host.dataset.moConectado = '1';

  const pinta = (v) => host.style.setProperty('--mo-op', opacidadValida(v));

  const slider = host.querySelector('.mo-op input');
  if (slider) {
    pinta(slider.value);
    slider.addEventListener('input', () => {
      pinta(slider.value);
      api.opacidad?.(opacidadValida(slider.value));
    });
  }

  /**
   * EL ARRASTRE SE MIDE EN COORDENADAS DE PANTALLA, no de ventana.
   *
   * Mientras redimensionas, la ventana se está moviendo bajo el ratón: un
   * `clientX` medido dentro de ella cambia por las dos cosas a la vez —lo que
   * mueves tú y lo que se mueve ella— y el arrastre se acelera solo. Con
   * `screenX` la referencia está quieta.
   */
  for (const nodo of host.querySelectorAll('[data-esq]')) {
    nodo.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      nodo.setPointerCapture(e.pointerId);
      const inicio = await api.bounds?.();
      if (!inicio) return;
      const x0 = e.screenX;
      const y0 = e.screenY;
      const mueve = (ev) => {
        api.mueve?.(encaja(inicio, nodo.dataset.esq, ev.screenX - x0, ev.screenY - y0));
      };
      const suelta = () => {
        nodo.removeEventListener('pointermove', mueve);
        nodo.removeEventListener('pointerup', suelta);
        nodo.removeEventListener('pointercancel', suelta);
      };
      nodo.addEventListener('pointermove', mueve);
      nodo.addEventListener('pointerup', suelta);
      nodo.addEventListener('pointercancel', suelta);
    });
  }
}

/** Lo que este módulo produce, declarado. */
export const CLAVES = ['mo.opacidad'];
