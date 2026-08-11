/**
 * Un diálogo propio para pedir datos.
 *
 * POR QUÉ EXISTE: `window.prompt` NO FUNCIONA EN ELECTRON. Lanza «prompt() is
 * and will not be supported» y se lleva por delante el manejador entero, así
 * que el botón que lo llamaba no hace nada — ni pide, ni falla visiblemente.
 * La tabla de tríos pedía por ahí sus tres datos desde la 1.1.0: **nunca
 * funcionó en la aplicación empaquetada**, y no se notó en año y medio porque
 * quien no consigue añadir un trío supone que no sabe hacerlo.
 *
 * TRES DATOS EN UN CUADRO Y NO TRES CUADROS SEGUIDOS. El flujo anterior
 * encadenaba tres `prompt` y dos `alert`: si te equivocabas en el tercero,
 * perdías los dos primeros y volvías a empezar. Aquí se ven los tres a la vez,
 * se corrige el que falle y no se pierde nada.
 *
 * Y LA VALIDACIÓN VA DENTRO, no en un `alert` detrás. Un cuadro nativo que te
 * dice «esa fecha no vale» y te devuelve a un formulario vacío es un castigo;
 * el mismo texto debajo del campo que falla es una instrucción.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Pide unos datos y devuelve un objeto con ellos, o `null` si se cancela.
 *
 * @param {object} opts
 *   titulo    encabezado del cuadro
 *   texto     una línea de contexto, opcional
 *   campos    [{ id, etiqueta, valor, ayuda, marcador }]
 *   aceptar   texto del botón de confirmar
 *   cancelar  texto del botón de cancelar
 *   validar   (valores) => null | { campo, mensaje }
 */
export function pedirDatos({ titulo, texto = '', campos = [], aceptar = 'OK', cancelar = 'Cancelar', validar = null }) {
  return new Promise((resolve) => {
    // Quien tenía el foco antes: se le devuelve al cerrar. Sin esto, cerrar el
    // cuadro deja el foco en el `body` y el teclado deja de servir para nada.
    const foco = document.activeElement;

    const fondo = document.createElement('div');
    fondo.className = 'dlg-fondo';
    fondo.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="dlg-h">${esc(titulo)}</div>
      ${texto ? `<p class="dlg-t hint">${esc(texto)}</p>` : ''}
      <form class="dlg-form">
        ${campos.map((c) => `<label class="dlg-campo">
          <span class="dlg-et">${esc(c.etiqueta)}</span>
          <input type="text" data-id="${esc(c.id)}" value="${esc(c.valor ?? '')}"
            placeholder="${esc(c.marcador ?? '')}" autocomplete="off" spellcheck="false">
          ${c.ayuda ? `<span class="dlg-ayuda hint">${esc(c.ayuda)}</span>` : ''}
          <span class="dlg-mal" data-mal="${esc(c.id)}"></span>
        </label>`).join('')}
        <div class="dlg-btns">
          <button type="button" class="dlg-no">${esc(cancelar)}</button>
          <button type="submit" class="dlg-si">${esc(aceptar)}</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(fondo);

    const inputs = [...fondo.querySelectorAll('input[data-id]')];
    const valores = () => Object.fromEntries(inputs.map((i) => [i.dataset.id, i.value]));

    const cerrar = (r) => {
      document.removeEventListener('keydown', teclas, true);
      fondo.remove();
      // El foco vuelve antes de resolver: quien esté esperando la promesa puede
      // repintar, y repintar sobre un foco perdido lo pierde otra vez.
      try { foco?.focus?.(); } catch { /* se fue de la página */ }
      resolve(r);
    };

    const marcarMal = (campo, mensaje) => {
      for (const el of fondo.querySelectorAll('.dlg-mal')) el.textContent = '';
      const el = fondo.querySelector(`[data-mal="${CSS.escape(campo)}"]`);
      if (el) el.textContent = mensaje;
      const inp = inputs.find((i) => i.dataset.id === campo);
      inp?.focus();
      inp?.select();
    };

    const enviar = (ev) => {
      ev?.preventDefault();
      const v = valores();
      const mal = validar?.(v);
      if (mal) { marcarMal(mal.campo, mal.mensaje); return; }
      cerrar(v);
    };

    // Escape cancela, y se captura EN LA FASE DE CAPTURA para llegar antes que
    // los atajos de la aplicación: la reproducción escucha Espacio y las
    // flechas en `document`, y sin esto escribir una fecha movería el vídeo de
    // debajo mientras escribes.
    const teclas = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(null); return; }
      if (!fondo.contains(e.target)) { e.stopPropagation(); return; }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); enviar(); }
    };
    document.addEventListener('keydown', teclas, true);

    fondo.querySelector('.dlg-form').addEventListener('submit', enviar);
    fondo.querySelector('.dlg-no').addEventListener('click', () => cerrar(null));
    // Pinchar fuera cancela, igual que Escape. Pinchar DENTRO no: sin esta
    // comprobación, soltar el ratón tras seleccionar texto cerraba el cuadro.
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(null); });

    inputs[0]?.focus();
    inputs[0]?.select();
  });
}
