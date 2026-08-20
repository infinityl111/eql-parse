/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS CINCO PIEZAS · el armazón compartido de las secciones
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pestañas, barra de control, pastillas, filas plegables y etiquetas compactas.
 * Salieron de hacer dos prototipos —uno vacío y uno denso— y descubrir que los
 * dos llevaban el mismo bloque duplicado. **Si las dos secciones lo necesitan,
 * no es de ninguna de las dos.**
 *
 * ── POR QUÉ UN MÓDULO Y NO QUINCE IMPLEMENTACIONES ────────────────────────
 *
 * Verificar un módulo compartido UNA VEZ cubre las quince pantallas; verificar
 * quince implementaciones cuesta quince veces. Ése es todo el argumento, y es
 * de Campeón.
 *
 * ── LO QUE ESTE MÓDULO NO NEGOCIA ─────────────────────────────────────────
 *
 * **La procedencia se ve SIN desplegar.** Una cosa escondida detrás de un clic,
 * en la práctica, no existe. Si al mirar la pantalla no se sabe qué cifra es
 * medida, cuál es de la wiki y cuál la escribió Campeón, la pieza está mal por
 * mucho que quepa más.
 *
 * **Toda fila lleva su etiqueta.** La ausencia no comunica: dos filas del mismo
 * nombre, una con «enemigo» y otra sin nada, se leen como un error. Y
 * `encantado` no es un cuarto bando fijo — es un ESTADO que cambia a mitad de
 * pelea, así que se distingue el que sigue encantado del que **se soltó** y
 * acabó peleando contra ti.
 *
 * **El recuento va DENTRO de la pastilla**, y se calcula sobre las filas
 * visibles. Sin el número no se sabe si merece la pena pulsarla, y el recuento
 * es la mitad de lo que hace útil una pastilla.
 *
 * ── PURO Y PROBABLE SIN NAVEGADOR ─────────────────────────────────────────
 *
 * Todo lo que construye HTML es una función pura que devuelve una cadena, así
 * que `test/piezas.js` la prueba sin DOM. Sólo `conectar()` toca el navegador.
 * Es lo que permite que la comprobación de rótulos apunte al módulo desde la
 * primera línea en vez de al final.
 */
import { t } from '../src/i18n.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── PIEZA 1 · PESTAÑAS ────────────────────────────────────────────────────
 * Cambian de VISTA. Nunca filtran: para eso están las pastillas, y tener los
 * dos controles diciendo lo mismo fue el primer fallo del prototipo. */
export function pestañas({ items = [], activa = null } = {}) {
  if (!items.length) return '';
  const act = activa ?? items[0].id;
  return `<div class="pz-pest" role="tablist">${items.map((x) => `<button role="tab"
    data-ir="${esc(x.id)}" aria-selected="${x.id === act}">${esc(x.rotulo)}${
  x.n != null ? ` <span class="pz-n">${x.n}</span>` : ''}</button>`).join('')}</div>`;
}

/* ── PIEZA 2 · BARRA DE CONTROL ───────────────────────────────────────────
 * Buscador SIEMPRE visible, agrupación elegida por quien mira, y densidad. */
export function barraControl({ buscarPh = null, agrupar = [], densidad = 'baja' } = {}) {
  const sel = agrupar.length ? `<select class="pz-agrupar">${agrupar
    .map((o) => `<option value="${esc(o.id)}">${esc(o.rotulo)}</option>`).join('')}</select>` : '';
  return `<div class="pz-barra">
    <label class="pz-buscar"><input type="search" placeholder="${esc(buscarPh ?? t('pz.buscarPh'))}"></label>
    ${sel}
    <div class="pz-dens" role="group" aria-label="${esc(t('pz.densidad'))}">
      <button data-d="baja" aria-pressed="${densidad !== 'alta'}">${esc(t('pz.comoda'))}</button>
      <button data-d="alta" aria-pressed="${densidad === 'alta'}">${esc(t('pz.densa'))}</button>
    </div></div>`;
}

/* ── PIEZA 3 · PASTILLAS ──────────────────────────────────────────────────
 * Filtran DENTRO de la vista, encendidas y apagadas a la vista, y **con su
 * recuento dentro**, que se rellena sobre las filas visibles. */
export function pastillas({ items = [] } = {}) {
  if (!items.length) return '';
  return `<div class="pz-pastillas">${items.map((x) => `<button class="pz-pastilla"
    data-et="${esc(x.et)}" aria-pressed="${x.on !== false}">${esc(x.rotulo)}
    <span class="pz-n" data-cuenta-et="${esc(x.et)}">${x.n ?? 0}</span></button>`).join('')}</div>`;
}

/* ── PIEZA 4 · FILAS PLEGABLES ────────────────────────────────────────────
 * Cincuenta en una línea; se abre la que interesa. La cabecera de grupo lleva
 * lo que sería igual en todas sus filas: una columna con el mismo valor en
 * todas no es información, es ruido con forma de dato. */
export function filas({ grupos = [], vacio = null } = {}) {
  const hay = grupos.some((g) => (g.filas ?? []).length);
  if (!hay) return `<div class="pz-vacio">${esc(vacio ?? t('pz.vacio'))}</div>`;
  return `<div class="pz-filas">${grupos.map((g) => `${g.rotulo
    ? `<div class="pz-grupo">${esc(g.rotulo)} <span class="pz-n">${(g.filas ?? []).length}</span></div>` : ''}
    ${(g.filas ?? []).map((f) => `<details class="pz-fila"
      data-id="${esc(f.id ?? '')}"${f.abierta ? ' open' : ''}
      data-busca="${esc(String(f.busca ?? '').toLowerCase())}" data-et="${esc((f.et ?? []).join(' '))}">
      <summary style="grid-template-columns:${esc(f.columnas ?? '14px 1fr auto')}">
        <span class="pz-giro">▶</span>${(f.celdas ?? []).join('')}
      </summary>${f.cuerpo ? `<div class="pz-cuerpo">${f.cuerpo}</div>` : ''}
    </details>`).join('')}`).join('')}</div>`;
}

/* ── PIEZA 5 · ETIQUETAS COMPACTAS ────────────────────────────────────────
 *
 * TODA FILA LLEVA LA SUYA. La ausencia no comunica nada: en una pelea con
 * encantados, «a fire elemental» sin etiqueta junto a «a fire elemental
 * enemigo» se lee como un error, y de hecho se leyó así.
 *
 * Y `encantado` NO ES UN BANDO: es un estado que cambia a mitad de pelea. Un
 * bicho que encantaste y **se soltó** acabó pegándote, así que llamarlo
 * «encantado» a secas miente igual que no decir nada.
 */
export const BANDOS = ['tuyo', 'enemigo', 'mascota', 'encantado', 'soltado'];
export function etiqueta(tipo) {
  if (!BANDOS.includes(tipo)) return '';
  return `<span class="pz-et pz-${tipo}">${esc(t(`pz.et.${tipo}`))}</span>`;
}

/* ── PROCEDENCIA · la que no se negocia ───────────────────────────────────
 * Las tres fuentes SIEMPRE en la fila. La que manda va rellena. */
export const FUENTES = ['tuyo', 'zona', 'visto'];
export function procedencia({ tuyo = null, zona = null, visto = null, manda = null } = {}) {
  const v = { tuyo, zona, visto };
  return `<span class="pz-proc">${FUENTES.map((f) => `<span class="pz-f pz-f-${f}${
    manda === f ? ' pz-manda' : ''}${v[f] == null ? ' pz-sin' : ''}">${esc(t(`pz.src.${f}`))}
    <span class="pz-v">${v[f] == null ? esc(t('pz.sinDato')) : esc(v[f])}</span></span>`).join('')}</span>`;
}

/**
 * La leyenda de las tres fuentes: PLEGABLE Y CON MEMORIA.
 *
 * Con un temporizador debajo ocupaba más alto que el contenido y se leía como
 * relleno. Se explica una vez, se pliega, y recuerda cómo la dejaste.
 */
export function leyendaProcedencia({ abierta = false } = {}) {
  return `<details class="pz-leyenda" data-memo="pz.leyenda"${abierta ? ' open' : ''}>
    <summary>${esc(t('pz.leyenda'))}</summary>
    <div class="pz-leyenda-c">
      ${FUENTES.map((f) => `<span><span class="pz-f pz-f-${f} pz-manda">${esc(t(`pz.src.${f}`))}</span>
        ${esc(t(`pz.leyenda.${f}`))}</span>`).join('')}
      <span class="pz-mini">${esc(t('pz.leyenda.manda'))}</span>
    </div></details>`;
}

/**
 * QUÉ FILAS ESTÁN DESPLEGADAS, para poder devolverlas así.
 *
 * `pintaEstable` reconstruye desde el modelo, y una fila plegada es ESTADO DEL
 * JUGADOR, no del modelo: si no viaja de vuelta, al primer suceso la fila se
 * cierra sola — con el campo de poner tiempo dentro y el cursor puesto. Es el
 * fallo del campo que no dejaba escribir, por la puerta de al lado.
 *
 * Por eso se identifican por `data-id` y no por posición: la cola se reordena
 * sola —manda «el que antes vuelve»— y con la posición se abriría otra fila.
 */
export function desplegadas(host) {
  if (!host) return new Set();
  return new Set([...host.querySelectorAll('.pz-fila[open][data-id]')].map((d) => d.dataset.id));
}
/* ── EL CABLEADO ──────────────────────────────────────────────────────────
 * Lo único que toca el navegador. Todo lo de arriba se prueba sin DOM. */
/**
 * SE LLAMA DESPUÉS DE CADA RECONSTRUCCIÓN, y por eso está partida en dos.
 *
 * Los escuchadores delegados van en `host`, que sobrevive a que le reescriban
 * los hijos: ésos se cuelgan UNA vez y volver a colgarlos los duplicaría. Pero
 * la leyenda y `aplica` sí son de los nodos nuevos, y si esta función se
 * plantara entera en la segunda llamada, tras cada reconstrucción la leyenda
 * dejaría de recordarse y las pastillas se quedarían sin recuento.
 *
 * Es la misma trampa que el `dataset` de `pintaEstable`, del otro lado: allí se
 * evita reconstruir de más, aquí se evita cablear de menos.
 */
export function conectar(host, { onCambio = null, memoria = null } = {}) {
  if (!host) return;
  const primera = host.dataset.pzConectado !== '1';
  host.dataset.pzConectado = '1';

  // La leyenda recuerda cómo la dejaste. Sin memoria, plegarla no sirve de nada:
  // vuelve abierta en el siguiente repintado.
  for (const d of host.querySelectorAll('.pz-leyenda[data-memo]')) {
    const k = d.dataset.memo;
    if (memoria?.leer && memoria.leer(k) === true) d.open = true;
    d.addEventListener('toggle', () => memoria?.guardar?.(k, d.open));
  }

  if (primera) {
    host.addEventListener('click', (e) => {
      const p = e.target.closest('.pz-pest button');
      if (p) {
        for (const b of p.parentElement.children) b.setAttribute('aria-selected', String(b === p));
        for (const s of host.querySelectorAll('[data-vista]')) s.hidden = s.dataset.vista !== p.dataset.ir;
        aplica(host); onCambio?.();
        return;
      }
      const d = e.target.closest('.pz-dens button');
      if (d) {
        for (const b of d.parentElement.children) b.setAttribute('aria-pressed', String(b === d));
        aplica(host); onCambio?.();
        return;
      }
      const f = e.target.closest('.pz-pastilla');
      if (f) {
        f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true'));
        aplica(host); onCambio?.();
      }
    });
    host.addEventListener('input', (e) => {
      if (e.target.matches('.pz-buscar input, .pz-agrupar')) { aplica(host); onCambio?.(); }
    });
  }
  aplica(host);
}

/**
 * Aplica buscador, pastillas y densidad, y **rellena los recuentos**.
 *
 * El recuento de una pastilla es cuántas filas quedarían con ELLA encendida y
 * el resto de filtros como están: es la respuesta a «¿merece la pena pulsarla?»,
 * que es para lo que sirve el número.
 */
export function aplica(host) {
  if (!host) return;
  const vista = host.querySelector('[data-vista]:not([hidden])') ?? host;
  const q = (vista.querySelector('.pz-buscar input')?.value ?? '').trim().toLowerCase();
  const pills = [...vista.querySelectorAll('.pz-pastilla')];
  const off = pills.filter((b) => b.getAttribute('aria-pressed') !== 'true').map((b) => b.dataset.et);
  const densa = vista.querySelector('.pz-dens button[aria-pressed=true]')?.dataset.d === 'alta';
  for (const l of vista.querySelectorAll('.pz-filas')) l.classList.toggle('pz-compacta', densa);

  const todas = [...vista.querySelectorAll('.pz-fila')];
  const casaBusca = (f) => !q || (f.dataset.busca ?? '').includes(q);
  for (const f of todas) {
    const ets = (f.dataset.et ?? '').split(' ').filter(Boolean);
    f.hidden = !casaBusca(f) || ets.some((x) => off.includes(x));
  }
  for (const b of pills) {
    const et = b.dataset.et;
    const otras = off.filter((x) => x !== et);
    const n = todas.filter((f) => casaBusca(f)
      && !(f.dataset.et ?? '').split(' ').filter(Boolean).some((x) => otras.includes(x))
      && (f.dataset.et ?? '').split(' ').includes(et)).length;
    const c = b.querySelector('[data-cuenta-et]');
    if (c) c.textContent = String(n);
  }
  // Un grupo sin filas visibles se esconde entero: una cabecera sola es ruido.
  for (const g of vista.querySelectorAll('.pz-grupo')) {
    let n = 0;
    for (let s = g.nextElementSibling; s && s.classList.contains('pz-fila'); s = s.nextElementSibling) {
      if (!s.hidden) n++;
    }
    g.hidden = n === 0;
    const c = g.querySelector('.pz-n');
    if (c) c.textContent = String(n);
  }
  for (const c of vista.querySelectorAll('[data-cuenta]')) {
    const l = vista.querySelector(c.dataset.cuenta);
    if (l) c.textContent = String([...l.querySelectorAll('.pz-fila')].filter((f) => !f.hidden).length);
  }
}

/** Todas las claves que este módulo puede producir. La usa `test/piezas.js`. */
export const CLAVES = [
  'pz.buscarPh', 'pz.densidad', 'pz.comoda', 'pz.densa', 'pz.vacio', 'pz.sinDato',
  'pz.leyenda', 'pz.leyenda.manda',
  ...FUENTES.map((f) => `pz.src.${f}`),
  ...FUENTES.map((f) => `pz.leyenda.${f}`),
  ...BANDOS.map((b) => `pz.et.${b}`),
];
