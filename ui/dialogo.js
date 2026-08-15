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

/**
 * ACERCA DE: versión, licencia y avisos de terceros.
 *
 * ── POR QUÉ EL TEXTO LEGAL VA EN INGLÉS ───────────────────────────────────
 *
 * Por lo mismo que la jerga del juego (`src/jerga.js`): traducir una licencia
 * la cambia. El nombre de la FSL, la frase de la conversión a MIT y el aviso de
 * los terceros son el texto que rige, y una versión española sería una
 * paráfrasis con aspecto de documento — que es peor que no tenerla, porque
 * alguien la leería como si valiese.
 *
 * Lo que SÍ se traduce es el rótulo que trae aquí y las frases que explican qué
 * es cada cosa. La regla es la de siempre: se traduce lo que orienta, no lo que
 * obliga.
 *
 * ── LOS AVISOS DE TERCEROS, Y QUÉ SE COMPROBÓ ─────────────────────────────
 *
 * El instalador empaqueta Chromium, Node y Electron, y los tres exigen que sus
 * avisos de copyright viajen con lo que se distribuye. Comprobado sobre el
 * paquete que generamos hoy (`dist/win-unpacked`): `LICENSE.electron.txt` y
 * `LICENSES.chromium.html` —9,45 MB, con 111 menciones de Node y OpenSSL
 * dentro— ya estaban, porque los pone electron-builder solo.
 *
 * La que NO estaba era la NUESTRA: `build.files` listaba `electron/`, `src/`,
 * `ui/`, el icono y el `package.json`, y no el `LICENSE`. O sea que
 * repartíamos los avisos de todos menos el propio. Añadido.
 */
export function acercaDe({ version, licencia, t }) {
  const foco = document.activeElement;
  const fondo = document.createElement('div');
  fondo.className = 'dlg-fondo';
  fondo.innerHTML = `<div class="dlg acerca" role="dialog" aria-modal="true" aria-label="${esc(t('about.title'))}">
    <div class="dlg-h">${esc(t('about.title'))}</div>
    <div class="acerca-v"><b>EQL Parse</b> <span class="num">${esc(version || '—')}</span></div>
    <p class="dlg-t hint">${esc(t('about.what'))}</p>

    <div class="acerca-sec">
      <div class="eyebrow">${esc(t('about.license'))}</div>
      <!-- En inglés a propósito: es el texto que rige. Ver la cabecera. -->
      <p class="acerca-legal">Functional Source License, Version 1.1, MIT Future License
        (<code>FSL-1.1-MIT</code>)<br>Copyright 2026 Miguel Ángel Fernández</p>
      <p class="hint">${esc(t('about.futureMit'))}</p>
    </div>

    <div class="acerca-sec">
      <div class="eyebrow">${esc(t('about.thirdParty'))}</div>
      <p class="acerca-legal">This application bundles Electron, Chromium and Node.js.
        Their copyright notices ship with the installer as
        <code>LICENSE.electron.txt</code> and <code>LICENSES.chromium.html</code>,
        in the same folder as the executable.</p>
    </div>

    <div class="dlg-btns"><button type="button" class="dlg-si">${esc(t('about.close'))}</button></div>
  </div>`;
  document.body.appendChild(fondo);

  const cerrar = () => {
    document.removeEventListener('keydown', teclas, true);
    fondo.remove();
    try { foco?.focus?.(); } catch { /* se fue de la página */ }
  };
  const teclas = (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(); } };
  document.addEventListener('keydown', teclas, true);
  fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
  fondo.querySelector('.dlg-si').addEventListener('click', cerrar);
  fondo.querySelector('.dlg-si').focus();
}
