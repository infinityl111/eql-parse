import { t, setLang } from '../src/i18n.js';

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

const MAX_ENEMIES = 20;      // los caídos más antiguos dejan de listarse
const open = new Set();      // filas desplegadas, por nombre
let lastFightId = null;
let flashUntil = 0;

function bar(row, widthPct) {
  const tot = row.types.reduce((a, [, v]) => a + v, 0) || 1;
  return `<div class="bar" style="width:${Math.max(3, widthPct).toFixed(1)}%">${
    row.types.map(([ty, v]) => `<div class="seg ${typeClass(ty)}" style="width:${(v / tot * 100).toFixed(2)}%"></div>`).join('')
  }</div>`;
}

function detail(r) {
  const kv = [
    `${t('row.damage')} <b>${n0(r.damage)}</b>`,
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

function rowHTML(r, rank, self, dead, maxDps) {
  const isOpen = open.has(r.name);
  return `<div class="ov-row ${dead ? 'dead' : ''} ${isOpen ? 'open' : ''}" data-name="${esc(r.name)}">
      <div class="ov-top">
        <span class="ov-rank">${rank}</span>
        <i class="ov-dot" style="background:${dotFor(r.name)}"></i>
        <span class="ov-name ${r.name === self ? 'self' : ''}">${esc(r.name)}</span>
        <span class="ov-dps num">${n0(r.dps)}</span>
        <span class="ov-pct">${Math.round(r.share * 100)}%</span>
      </div>
      ${bar(r, maxDps ? (r.dps / maxDps) * 100 : 0)}
      ${isOpen ? detail(r) : ''}
    </div>`;
}

function renderColumn(host, rows, self, deadMap) {
  if (!rows.length) { host.innerHTML = `<div class="ov-empty">${esc(t('ov.noCombat'))}</div>`; return; }
  const maxDps = Math.max(...rows.map((r) => r.dps), 1);
  host.innerHTML = rows.map((r, i) => rowHTML(r, i + 1, self, deadMap[r.name] !== undefined, maxDps)).join('');
  host.querySelectorAll('.ov-row').forEach((el) => el.addEventListener('click', () => {
    const nm = el.dataset.name;
    open.has(nm) ? open.delete(nm) : open.add(nm);
    host.dataset.sig = '';           // fuerza el repintado inmediato
  }));
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

function showFinal(f) {
  const el = $('oFinal');
  if (!el) return;
  el.innerHTML = `<div class="eyebrow">${esc(f.label ?? t('fight.skirmish'))}</div>
    <b>${n0(f.raidDps)}</b> <span class="eyebrow">dps · ${secs(f.duration)}</span>`;
  el.style.display = 'block';
  flashUntil = Date.now() + 4000;
  setTimeout(() => { if (Date.now() >= flashUntil) el.style.display = 'none'; }, 4100);
}

window.eql.onSnapshot((snap) => {
  // El overlay muestra la SESIÓN acumulada, no la pelea suelta: sólo se pone a
  // cero con el botón de reset.
  const S = snap.session;
  const live = snap.current;

  const liveId = live?.id ?? null;
  if (lastFightId !== null && liveId === null && snap.history[0]) showFinal(snap.history[0]);
  lastFightId = liveId;

  renderKill(snap.lastKill);

  const root = document.querySelector('.ov');
  if (root) {
    root.classList.toggle('active', !!live);
    root.classList.toggle('flash', Date.now() < flashUntil);
  }

  $('oAlliesH').textContent = t('side.allies');
  $('oEnemiesH').textContent = t('side.enemies');
  $('oReset').textContent = t('ov.reset');
  $('oPass').title = t('ov.passThrough');
  $('oClose').title = t('ov.close');

  if (!S || !S.rows.length) {
    $('oMeta').textContent = '';
    renderColumn($('oAllies'), [], snap.self, {});
    renderColumn($('oEnemies'), [], snap.self, {});
    return;
  }

  const dead = S.dead ?? {};
  const allies = S.rows.filter((r) => r.side !== 'enemy');
  // Vivos primero por daño; los caídos debajo, del más reciente al más antiguo,
  // y sólo se conservan los últimos veinte.
  const enemies = S.rows.filter((r) => r.side === 'enemy').sort((a, b) => {
    const da = dead[a.name], db = dead[b.name];
    if ((da === undefined) !== (db === undefined)) return da === undefined ? -1 : 1;
    if (da !== undefined) return db - da;
    return b.damage - a.damage;
  }).slice(0, MAX_ENEMIES);

  $('oMeta').textContent = `${n0(S.raidDps)} dps · ${secs(S.duration)}`;
  $('oAlliesN').textContent = n0(S.total);
  $('oEnemiesN').textContent = n0(S.enemyTotal);

  const sigA = JSON.stringify([allies.map((r) => [r.name, r.damage]), [...open]]);
  const sigE = JSON.stringify([enemies.map((r) => [r.name, r.damage, dead[r.name]]), [...open]]);
  if ($('oAllies').dataset.sig !== sigA) { $('oAllies').dataset.sig = sigA; renderColumn($('oAllies'), allies, snap.self, dead); }
  if ($('oEnemies').dataset.sig !== sigE) { $('oEnemies').dataset.sig = sigE; renderColumn($('oEnemies'), enemies, snap.self, dead); }

  const tip = snap.live?.suggest
    ? `${t('say.switchTo', { stance: snap.live.best })} · ${t(`adv.kind.${KIND[snap.live.kind] ?? 'equilibrado'}`)}`
    : null;
  const ad = $('oAdvice');
  if (ad) { ad.textContent = tip ?? ''; ad.style.display = tip ? 'block' : 'none'; }
});

// La barra recupera el ratón al pasar por encima, para poder usar los botones
// incluso con el overlay en modo atravesable.
const barEl = document.querySelector('.ov-bar');
barEl?.addEventListener('mouseenter', () => window.eql.overlayHover(true));
barEl?.addEventListener('mouseleave', () => window.eql.overlayHover(false));

$('oClose')?.addEventListener('click', () => window.eql.closeOverlay());
$('oPass')?.addEventListener('click', () => window.eql.toggleClickThrough());
$('oReset')?.addEventListener('click', () => {
  open.clear();
  $('oAllies').dataset.sig = ''; $('oEnemies').dataset.sig = '';
  window.eql.resetSession();
});

window.eql.onTheme((th) => { document.documentElement.dataset.theme = th; });
window.eql.onLang((c) => { setLang(c); $('oAllies').dataset.sig = ''; $('oEnemies').dataset.sig = ''; });
window.eql.getConfig().then((c) => {
  document.documentElement.dataset.theme = c.theme ?? 'dark';
  setLang(c.lang ?? 'es');
});
window.eql.onOverlayState(({ clickThrough }) => {
  const lk = $('oPass');
  if (lk) lk.style.color = clickThrough ? '' : 'var(--t-poison)';
});
