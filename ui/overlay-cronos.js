/**
 * EL PINTOR DEL PANEL DE TEMPORIZADORES.
 *
 * No construye HTML: reúne los datos, los formatea y llama a `construye()` de
 * `ui/cronos-panel.js`, que es puro y declara sus claves. Lo mismo que
 * `renderCronos`, y lo vigila `test/contrato-pintores.js`.
 *
 * ── LO QUE ESTE SITIO SABE Y EL CONSTRUCTOR NO ────────────────────────────
 *
 * Los relojes. `estadoCrono` necesita «ahora» y la última muerte de cada clave,
 * y eso se pregunta al motor en cada snapshot: el registro está vivo y una
 * marca cacheada dejaría la cuenta corriendo desde una muerte vieja.
 */
import { construye, ordena } from './cronos-panel.js';
import { conectar as conectarMarco } from './marco-overlay.js';
import { estadoCrono, claveCrono, ESTADO } from '../src/cronos.js';
import { setLang } from '../src/i18n.js';

const ID = 'cronos';
const host = document.getElementById('pan');
let cfg = null;
let ultimo = { orden: [] };

/** «mm:ss», sin depender del formateador de la ventana principal. */
const reloj = (r) => {
  if (r == null) return '';
  const m = Math.floor(Math.max(0, r) / 60);
  const s = Math.round(Math.max(0, r) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * REPINTAR SÓLO CUANDO CAMBIA LA FORMA, no cada segundo.
 *
 * La misma guarda que `pintaEstable` en la ventana principal, y por el mismo
 * motivo: el snapshot llega cuatro veces por segundo y aquí hay un deslizador
 * de transparencia que el jugador puede estar arrastrando.
 */
function pinta(modelo) {
  const firma = construye(modelo, false);
  if (host.dataset.sig === firma && host.firstElementChild) {
    for (const nodo of host.querySelectorAll('.pan-l')) {
      const f = ultimo.orden[+nodo.dataset.i];
      const t = nodo.querySelector('.pan-t');
      if (f && t && f.restante != null && f.restante > 0) t.textContent = reloj(f.restante);
    }
    return false;
  }
  host.innerHTML = construye(modelo, true);
  host.dataset.sig = firma;
  return true;
}

async function refresca(snap) {
  cfg = cfg ?? (await window.eql.getConfig?.()) ?? {};
  if (cfg.lang) setLang(cfg.lang);
  if (cfg.theme) document.documentElement.dataset.theme = cfg.theme;

  const lista = cfg.cronos ?? [];
  // EL PANEL SE ABRE Y SE CIERRA SOLO. Con cero temporizadores no hay panel que
  // enseñar, y dejarlo abierto y vacío sería una ventana que pide sitio a
  // cambio de nada.
  if (!lista.length) { window.eql.panelCronos?.(0); return; }

  const claves = lista.map((c) => ({
    nombre: c.nombre, base: c.base ?? null, diff: c.diff ?? null, mode: c.mode ?? null,
  }));
  const muertes = (await window.eql.ultimaMuerte?.(claves)) ?? {};
  const cotas = (await window.eql.cotaDe?.(claves)) ?? {};
  const ahora = Math.floor(Date.now() / 1000);

  /**
   * EL FILTRO POR ZONA, y el recuento de lo que deja fuera.
   *
   * `total` es cuántos hay en TODAS partes, no cuántos se pintan. El
   * constructor lo necesita para poder decir «tienes N en otras zonas» en vez
   * de quedarse en blanco, que es lo que hace un filtro que vacía.
   */
  const zona = snap?.zone ? String(snap.zone) : null;
  const enZona = (c) => !zona || !c.base || zona.startsWith(c.base);

  const fichas = [];
  lista.forEach((c, i) => {
    if (!enZona(c)) return;
    const st = estadoCrono(c, {
      ahora,
      ultimaMuerte: Math.max(muertes[claveCrono(c)] ?? 0, c.desde ?? 0) || null,
      wiki: null, medido: null, heredado: null,
    });
    fichas.push({
      i,
      nombre: c.nombre,
      /**
       * SIN MUERTE NO ES VENCIDO. `ESTADO.SIN_MUERTE` significa que no hay
       * desde cuando contar, y pintarlo como «ya deberia estar» seria una
       * afirmacion inventada sobre un bicho que quiza sigue vivo delante.
       */
      esperando: st.estado === ESTADO.SIN_MUERTE,
      restante: st.estado === ESTADO.CONTANDO ? st.restante : 0,
      restanteTxt: reloj(st.restante),
      transcurrido: st.transcurrido ?? 0,
      cota: cotas[claveCrono(c)] ?? null,
    });
  });

  ultimo = { orden: [] };
  for (const f of ordena(fichas)) ultimo.orden[f.i] = f;

  const reconstruido = pinta({
    fichas, total: lista.length, zona, opacidad: cfg.overlays?.[ID]?.opacidad ?? 1,
  });
  if (reconstruido) engancha(lista);
}

/** Los escuchadores se cuelgan tras una reconstrucción y sólo tras ella. */
function engancha(lista) {
  conectarMarco(host, {
    bounds: () => window.eql.marcoBounds?.(),
    mueve: (b) => window.eql.marcoMueve?.(b),
    opacidad: (v) => window.eql.marcoOpacidad?.(ID, v),
  });
  /**
   * LA X DE UNA LÍNEA CIERRA EL CRONO, no la ventana.
   *
   * Es lo que pidió Campeón y no es un detalle: una X que sólo esconde la fila
   * deja el temporizador corriendo y sin forma de verlo, que es peor que no
   * tener botón.
   */
  for (const b of host.querySelectorAll('[data-quita]')) {
    b.addEventListener('click', async () => {
      const i = +b.dataset.quita;
      const nueva = lista.filter((_, k) => k !== i);
      await window.eql.setFlag('cronos', nueva);
      cfg.cronos = nueva;
      // Y cuando se cierra el último, se cierra el panel.
      if (!nueva.length) window.eql.panelCronos?.(0);
    });
  }
  host.querySelector('[data-cerrar]')?.addEventListener('click', () => {
    window.eql.panelCronos?.(0);
  });
}

/**
 * UN FALLO AQUI SE ENSENA, no se traga.
 *
 * Estaba escrito , y con eso el panel se abria vacio y sin
 * decir nada: indistinguible de no tener temporizadores. Es la forma exacta
 * del fallo que este proyecto persigue — salida limpia, resultado plausible.
 */
function cae(e) {
  host.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'pan-vacio';
  d.textContent = String(e?.message ?? e);
  host.appendChild(d);
}

window.eql.onSnapshot?.((snap) => { refresca(snap).catch(cae); });
window.eql.onFlags?.((c) => { cfg = c; });
refresca(null).catch(cae);
