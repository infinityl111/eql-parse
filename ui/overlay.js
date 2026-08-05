import { t, setLang } from '../src/i18n.js';

/**
 * El overlay va combate a combate.
 *
 * Arriba, una tira fija con TU marcha de la sesión: daño acumulado y dps por
 * abatido. No rota nunca — es la referencia de cómo llevas la tarde.
 *
 * Debajo, una pila de combates. El de arriba es el que está pasando (o el
 * último, si ya no hay ninguno) y va desplegado; los cerrados van bajando
 * plegados a una línea y se abren al pincharlos. Se conservan ocho y el resto
 * se cae.
 *
 * TODAS las cifras de un bloque son de ESA pelea: el daño, el reparto y el
 * porcentaje. Lo de la sesión vive arriba y sólo arriba. Mezclarlo daría una
 * pantalla donde el 68% de una columna y el 41% de la de al lado se refieren a
 * cosas distintas sin decirlo.
 *
 * La pelea viva llega en cada snapshot; las cerradas por su propio canal, una
 * sola vez cada una: recortadas ocupan un par de kilobytes, pero mandarlas
 * todas dos veces por segundo serían cientos por segundo para unas cifras que
 * sólo cambian al terminar un combate.
 */

const TYPES = ['magic', 'cold', 'fire', 'poison', 'disease', 'melee', 'ds', 'dot', 'spell'];
const typeClass = (x) => (TYPES.includes(x) ? x : 'other');
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Math.round(v || 0).toLocaleString();
const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`);
const $ = (id) => document.getElementById(id);

const KIND = { 'físico': 'fisico', 'mágico': 'magico', equilibrado: 'equilibrado' };

/** Color estable por nombre: el mismo siempre del mismo color. */
const DOTS = ['#8B7BD8', '#6FC7D8', '#E08A4B', '#A8C74F', '#C77BA6', '#7E9B6A', '#C9B896', '#B0555F'];
const dotFor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOTS[h % DOTS.length];
};

const MAX_ENEMIES = 20;      // dentro de un bloque: los caídos más antiguos se dejan de listar
const VISIBLES = 8;          // combates cerrados que se conservan a la vista

let closed = [];             // peleas cerradas, la más reciente primero
// Filas desplegadas. La clave lleva la pelea delante: el mismo enemigo aparece
// en varios combates y, con el nombre a secas, desplegarlo en uno lo desplegaba
// en todos.
const openRows = new Set();
// Dos conjuntos con un significado cada uno, en vez de uno con dos.
//
// El bloque de arriba nace abierto y los de abajo nacen plegados, así que un
// solo conjunto de «desplegados» tendría que significar lo contrario según
// dónde estuviera el bloque. Éstos guardan sólo lo que TÚ has cambiado: qué
// cabecera de arriba has plegado y qué bloque de abajo has abierto. Al cerrarse
// una pelea se olvida de los dos: baja a la pila como cualquier otra.
const plegados = new Set();     // el bloque de arriba, si lo has plegado
const desplegados = new Set();  // bloques de la pila que has abierto
let nueva = null;            // la última en llegar, para el destello de entrada
let dpsMap = {};             // dps de sesión por combatiente, del motor
let flashUntil = 0;

const rowKey = (fightKey, name) => `${fightKey}\u0000${name}`;

/**
 * El ritmo que se enseña en la línea de una fila, y de dónde sale.
 *
 * En la pelea viva, los últimos 20 segundos: es lo único que describe lo que
 * está pasando ahora. En una cerrada, el dps de esa pelea. Nunca la media de
 * la sesión dentro del bloque de un combate — eso es la cifra de arriba.
 */
function rateFor(r, live) {
  const v = live ? (dpsMap[r.name]?.w20 || null) : (r.dps || null);
  return v ? `${n0(v)} dps` : '';
}

function bar(row, widthPct) {
  const tot = (row.types ?? []).reduce((a, [, v]) => a + v, 0) || 1;
  return `<div class="bar" style="width:${Math.max(3, widthPct).toFixed(1)}%">${
    (row.types ?? []).map(([ty, v]) => `<div class="seg ${typeClass(ty)}" style="width:${(v / tot * 100).toFixed(2)}%"></div>`).join('')
  }</div>`;
}

function detail(r, live) {
  const kv = [
    `${t('row.damage')} <b>${n0(r.damage)}</b>`,
    // En la viva caben las tres lecturas, cada una con su etiqueta: la de la
    // sesión por abatido y las dos ventanas móviles. En una pelea cerrada sólo
    // tiene sentido la suya.
    (() => {
      if (!live) return r.dps ? `dps <b>${n0(r.dps)}</b>` : '';
      const d = dpsMap[r.name];
      if (!d) return '';
      const parts = [];
      if (d.kill) parts.push(`${t('ov.dpsKill')} <b>${n0(d.kill)}</b>`);
      if (d.w10) parts.push(`10s <b>${n0(d.w10)}</b>`);
      if (d.w20) parts.push(`20s <b>${n0(d.w20)}</b>`);
      return parts.join('');
    })(),
    `${t('row.max')} <b>${n0(r.max)}</b>`,
    r.meleeHits + r.misses ? `${t('row.accuracy')} <b>${Math.round(r.accuracy * 100)}%</b>` : '',
    r.crits ? `${t('row.crits')} <b>${r.crits}</b>` : '',
    r.taken ? `${t('row.taken')} <b>${n0(r.taken)}</b>` : '',
    r.healingDone ? `${t('row.healed')} <b>${n0(r.healingDone)}</b>` : '',
  ].filter(Boolean).join('');
  const abil = (r.abilities ?? []).slice(0, 6).map((a) => `<div class="ov-det-l">
      <span><i class="seg ${typeClass(a.type)}" style="display:inline-block;width:6px;height:6px;margin-right:5px"></i>${esc(a.name)}</span>
      <b>${n0(a.sum)}</b><span class="dim">×${a.n}</span></div>`).join('');
  return `<div class="ov-det"><div class="ov-det-kv">${kv.replace(/(<\/b>)(?=\S)/g, '$1 ')}</div>${abil}</div>`;
}

function rowHTML(r, rank, self, dead, maxDmg, fightKey, live) {
  const isOpen = openRows.has(rowKey(fightKey, r.name));
  return `<div class="ov-row ${dead ? 'dead' : ''} ${isOpen ? 'open' : ''}" data-name="${esc(r.name)}">
      <div class="ov-top">
        <span class="ov-rank">${rank}</span>
        <i class="ov-dot" style="background:${dotFor(r.name)}"></i>
        <span class="ov-name ${r.name === self ? 'self' : ''} ${r.petOf ? 'otherpet' : ''}"
          title="${r.petOf ? esc(t('row.petOf', { who: r.petOf })) : ''}">${esc(r.name)}${
          r.petOf ? ` <span class="dim">(${esc(r.petOf)})</span>` : ''}</span>
        <span class="ov-dps num">${n0(r.damage)}</span>
        <span class="ov-rate num">${rateFor(r, live)}</span>
        <span class="ov-pct">${Math.round(r.share * 100)}%</span>
      </div>
      ${bar(r, maxDmg ? (r.damage / maxDmg) * 100 : 0)}
      ${isOpen ? detail(r, live) : ''}
    </div>`;
}

function columnHTML(rows, self, dead, fightKey, live) {
  if (!rows.length) return `<div class="ov-empty">${esc(t('ov.noCombat'))}</div>`;
  const maxDmg = Math.max(...rows.map((r) => r.damage), 1);
  return rows.map((r, i) => rowHTML(r, i + 1, self, dead[r.name] !== undefined, maxDmg, fightKey, live)).join('');
}

/** Un combate: cabecera siempre, cuerpo sólo si está desplegado. */
function fightHTML(f, self, { live = false, open = false } = {}) {
  const dead = f.dead ?? {};
  const rows = f.rows ?? [];
  const allies = rows.filter((r) => r.side !== 'enemy');
  // Vivos primero por daño; los caídos debajo, del más reciente al más antiguo.
  const enemies = rows.filter((r) => r.side === 'enemy').sort((a, b) => {
    const da = dead[a.name], db = dead[b.name];
    if ((da === undefined) !== (db === undefined)) return da === undefined ? -1 : 1;
    if (da !== undefined) return db - da;
    return b.damage - a.damage;
  }).slice(0, MAX_ENEMIES);

  const cuerpo = open ? `<div class="ovf-cols">
      <div class="ovf-col">
        <div class="ovf-colh"><span class="eyebrow">${esc(t('side.allies'))}</span><span class="n">${n0(f.total)}</span></div>
        ${columnHTML(allies, self, dead, f.key, live)}
      </div>
      <div class="ovf-col">
        <div class="ovf-colh"><span class="eyebrow">${esc(t('side.enemies'))}</span><span class="n">${n0(f.enemyTotal)}</span></div>
        ${columnHTML(enemies, self, dead, f.key, live)}
      </div>
    </div>` : '';

  return `<div class="ovf ${live ? 'live' : ''} ${f.key === nueva ? 'nueva' : ''}" data-key="${esc(f.key)}">
      <div class="ovf-h">
        <span class="ovf-caret">${open ? '▼' : '▶'}</span>
        <span class="ovf-label">${esc(f.label ?? t('fight.skirmish'))}</span>
        <span class="ovf-tot num">${n0(f.total)}</span>
        <span class="ovf-dur num">${secs(f.duration)}</span>
      </div>${cuerpo}</div>`;
}

/**
 * Pincha en una cabecera y se pliega o despliega; pincha en una fila y se abre
 * su desglose. Se repinta en el sitio para que la respuesta sea inmediata y no
 * haya que esperar al siguiente envío del motor.
 */
function wire(host, repintar, cabeza = false) {
  host.querySelectorAll('.ovf-h').forEach((el) => el.addEventListener('click', () => {
    const k = el.parentElement.dataset.key;
    const s = cabeza ? plegados : desplegados;
    s.has(k) ? s.delete(k) : s.add(k);
    repintar();
  }));
  host.querySelectorAll('.ov-row').forEach((el) => el.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = rowKey(el.closest('.ovf').dataset.key, el.dataset.name);
    openRows.has(k) ? openRows.delete(k) : openRows.add(k);
    repintar();
  }));
}

/** El bloque de arriba: la pelea viva, o la última cerrada si no hay ninguna. */
function renderHead(f, self, live) {
  const host = $('oLive');
  if (!f) {
    if (host.dataset.sig !== 'vacio') { host.dataset.sig = 'vacio'; host.innerHTML = ''; }
    return;
  }
  // Nace abierto; se pliega sólo si lo has plegado tú.
  const open = !plegados.has(f.key);
  // El dps queda FUERA de la firma: cambia cada segundo y reconstruiría el
  // bloque sin parar, perdiendo el clic a medias. Se refresca en su sitio.
  const sig = JSON.stringify([f.key, live, open, (f.rows ?? []).map((r) => [r.name, r.damage]),
    [...openRows], f.duration, f.label, nueva]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = fightHTML(f, self, { live, open });
  wire(host, () => { host.dataset.sig = ''; renderHead(f, self, live); }, true);
}

/** La pila de abajo: las cerradas que no están arriba. */
function renderClosed(headKey, self) {
  const host = $('oClosed');
  const lista = closed.filter((f) => f.key !== headKey).slice(0, VISIBLES);
  const sig = JSON.stringify([lista.map((f) => f.key), [...desplegados], [...openRows], nueva]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = lista.length
    ? lista.map((f) => fightHTML(f, self, { live: false, open: desplegados.has(f.key) })).join('')
    : (headKey ? '' : `<div class="ov-empty">${esc(t('ov.noFights'))}</div>`);
  wire(host, () => { host.dataset.sig = ''; renderClosed(headKey, self); });
}

const KILL_MS = 7000;         // cuánto se queda la tarjeta al caer un enemigo
let killShown = null;

/** Reparto de quién mató a quién, unos segundos tras la muerte. */
function renderKill(k) {
  const el = $('oKill');
  if (!el) return;
  if (!k || Date.now() - k.at > KILL_MS) {
    if (killShown !== null) { el.style.display = 'none'; el.innerHTML = ''; killShown = null; }
    return;
  }
  const id = `${k.victim}|${k.at}`;
  if (killShown === id) return;
  killShown = id;
  el.innerHTML = `<div class="ok-h"><b>${esc(k.victim)}</b>
      <span class="eyebrow">${esc(t('ov.killed'))}</span>
      <span class="eyebrow spacer">${n0(k.total)} · ${k.seconds}s</span></div>
    ${k.rows.slice(0, 8).map((r) => `<div class="ok-row">
      <i class="ov-dot" style="background:${dotFor(r.name)}"></i>
      <span class="ok-name">${esc(r.name)}</span>
      <span class="num">${n0(r.dps)}</span>
      <span class="ok-pct num">${Math.round(r.share * 100)}%</span>
      <div class="ok-bar"><div style="width:${(r.share * 100).toFixed(1)}%"></div></div>
    </div>`).join('')}`;
  el.style.display = 'block';
  setTimeout(() => { if (killShown === id) renderKill(null); }, KILL_MS + 100);
}

/**
 * La tira de sesión: tu daño acumulado y tu dps por abatido.
 *
 * Por abatido y no sobre el reloj: la sesión son horas, y la mayor parte no
 * estás pegando. Dividir el daño entre el tiempo de sesión daría una cifra que
 * no describe nada. Ésta es la media de las ventanas medidas en cada enemigo
 * que ha caído, que es lo que el motor ya lleva contado.
 */
function renderSession(S, self) {
  const el = $('oSession');
  if (!el) return;
  const mio = (S?.rows ?? []).find((r) => r.name === self);
  const kill = dpsMap[self]?.kill ?? null;
  const sig = `${mio?.damage ?? 0}|${Math.round(kill ?? 0)}|${self}`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.innerHTML = `<span class="eyebrow">${esc(t('ov.session'))}</span>
    <span class="who">${esc(self ?? '')}</span>
    <span class="tot num">${n0(mio?.damage ?? 0)}</span>
    <span class="rate">${kill ? `${n0(kill)} dps · ${esc(t('ov.dpsKill'))}` : ''}</span>`;
}

window.eql.onSnapshot((snap) => {
  const live = snap.current;
  renderKill(snap.lastKill);
  dpsMap = snap.sessionDps ?? {};

  const root = document.querySelector('.ov');
  if (root) {
    root.classList.toggle('active', !!live);
    root.classList.toggle('flash', Date.now() < flashUntil);
  }

  $('oReset').textContent = t('ov.reset');
  $('oPass').title = t('ov.passThrough');
  $('oClose').title = t('ov.close');

  const S = snap.session;
  renderSession(S, snap.self);

  const live10 = (S?.rows ?? []).filter((r) => r.side !== 'enemy')
    .reduce((a, r) => a + (dpsMap[r.name]?.w10 ?? 0), 0);
  $('oMeta').textContent = live10 > 0
    ? `${n0(live10)} dps · ${n0(S?.total ?? 0)} · ${secs(S?.duration ?? 0)}`
    : `${n0(S?.total ?? 0)} · ${secs(S?.duration ?? 0)}`;

  // Arriba va la viva; si no hay ninguna, la última que terminó. Y esa se
  // quita de la pila de abajo: durante medio segundo el motor puede tener la
  // pelea ya cerrada y el snapshot todavía con la viva, y saldría dos veces.
  const head = live ?? closed[0] ?? null;
  renderHead(head, snap.self, !!live);
  renderClosed(head?.key ?? null, snap.self);

  // Refresco del ritmo sin reconstruir nada: sólo en el bloque vivo, que es el
  // único donde la cifra cambia sola.
  if (live) {
    $('oLive')?.querySelectorAll('.ov-row').forEach((el) => {
      const cell = el.querySelector('.ov-rate');
      if (!cell) return;
      const d = dpsMap[el.dataset.name];
      const txt = d?.w20 ? `${n0(d.w20)} dps` : '';
      if (cell.textContent !== txt) cell.textContent = txt;
    });
  }

  const tip = snap.live?.suggest
    ? `${t('say.switchTo', { stance: snap.live.best })} · ${t(`adv.kind.${KIND[snap.live.kind] ?? 'equilibrado'}`)}`
    : null;
  const ad = $('oAdvice');
  if (ad) { ad.textContent = tip ?? ''; ad.style.display = tip ? 'block' : 'none'; }
});

/** Una pelea que acaba de cerrarse entra por arriba y empuja a las demás. */
function apilar(f) {
  if (!f?.key) return;
  if (closed.some((x) => x.key === f.key)) return;
  closed.unshift(f);
  if (closed.length > VISIBLES + 2) closed.length = VISIBLES + 2;
  // Baja a la pila como una más: se olvida de que estuvo arriba plegada o de
  // que la abriste en su día.
  plegados.delete(f.key);
  desplegados.delete(f.key);
  nueva = f.key;
  flashUntil = Date.now() + 4000;
  // El destello sólo marca la entrada: si se quedara puesto, cada repintado
  // posterior lo relanzaría.
  setTimeout(() => {
    if (nueva !== f.key) return;
    nueva = null;
    $('oLive').dataset.sig = ''; $('oClosed').dataset.sig = '';
  }, 1200);
  $('oLive').dataset.sig = '';
  $('oClosed').dataset.sig = '';
}

window.eql.onFightClosed?.(apilar);
window.eql.overlayFights?.().then((list) => {
  // Un overlay abierto a mitad de sesión arranca con lo que ya hay apilado.
  // Se añade lo que falte en vez de sustituir: entre pedirlo y recibirlo puede
  // haber terminado una pelea, y sustituir la borraría.
  if (!Array.isArray(list) || !list.length) return;
  const hay = new Set(closed.map((f) => f.key));
  closed = [...closed, ...list.filter((f) => f?.key && !hay.has(f.key))]
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, VISIBLES + 2);
  $('oClosed').dataset.sig = '';
}).catch(() => { /* sin nada apilado todavía */ });

window.eql.onSessionCleared?.(() => {
  closed = [];
  plegados.clear();
  desplegados.clear();
  openRows.clear();
  nueva = null;
  $('oLive').dataset.sig = '';
  $('oClosed').dataset.sig = '';
  $('oSession').dataset.sig = '';
});

// El overlay entero recupera el ratón al pasar por encima.
//
// Antes sólo lo hacía la barra superior, así que en modo atravesable los clics
// sobre las filas se iban al juego y no se desplegaba nada. Con el ratón fuera
// del overlay se vuelve a atravesar, que es lo que se quiere mientras juegas.
const root = document.querySelector('.ov');
root?.addEventListener('mouseenter', () => window.eql.overlayHover(true));
root?.addEventListener('mouseleave', () => window.eql.overlayHover(false));

$('oClose')?.addEventListener('click', () => window.eql.closeOverlay());
$('oPass')?.addEventListener('click', () => window.eql.toggleClickThrough());
// Borrón y cuenta nueva: la pila de combates y el acumulado de la sesión. El
// motor avisa por 'session:cleared' y el vaciado se hace allí, para que valga
// igual si el reset se pide desde la ventana principal.
$('oReset')?.addEventListener('click', () => window.eql.resetSession());

const repintarTodo = () => {
  for (const id of ['oLive', 'oClosed', 'oSession']) { const el = $(id); if (el) el.dataset.sig = ''; }
};
window.eql.onTheme((th) => { document.documentElement.dataset.theme = th; });
window.eql.onLang((c) => { setLang(c); repintarTodo(); });
window.eql.getConfig().then((c) => {
  document.documentElement.dataset.theme = c.theme ?? 'dark';
  setLang(c.lang ?? 'es');
  repintarTodo();
});
window.eql.onOverlayState(({ clickThrough }) => {
  const lk = $('oPass');
  if (lk) lk.style.color = clickThrough ? '' : 'var(--t-poison)';
});
