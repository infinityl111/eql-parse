import { mountBanner } from './alerts.js';

const TYPES = ['magic','cold','fire','poison','disease','melee','ds','dot','spell'];
const typeClass = (t) => (TYPES.includes(t) ? t : 'other');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n0 = (v) => Math.round(v).toLocaleString('es-ES');
const secs = (s) => (s >= 60 ? `${Math.floor(s/60)}m${s%60}s` : `${s}s`);

const $ = (id) => document.getElementById(id);

/** Color estable por nombre: el mismo jugador siempre del mismo color. */
const DOTS = ['#8B7BD8','#6FC7D8','#E08A4B','#A8C74F','#C77BA6','#7E9B6A','#C9B896','#B0555F'];
const dotFor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOTS[h % DOTS.length];
};

const KIND = { 'físico': 'fisico', 'mágico': 'magico', 'equilibrado': 'equilibrado' };
let lastFightId = null;
let flashUntil = 0;

/** Aviso corto: sólo si la postura actual NO es la mejor, para no dar la lata. */
function briefFrom(a) {
  const best = a.defence?.[0];
  if (!best) return null;
  const cur = String(a.current.stance ?? '').toLowerCase().replace(/\s*stance\s*$/, '').trim();
  if (best.key === cur) return null;
  const mix = a.incoming.meleeShare;
  const kind = mix > 0.7 ? 'melé' : mix < 0.3 ? 'mágico' : 'mixto';
  return t('ov.brief', { kind: t(`adv.kind.${KIND[kind] ?? 'equilibrado'}`), stance: best.label,
    pct: Math.round(best.share * 100) });
}
const MAX_ROWS = 8;

function renderTimers(list) {
  const host = $('oTimers');
  const sig = list.map((x) => `${x.id}:${x.left.toFixed(1)}`).join('|');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = list.map((x) => `<div class="timer">
      <div class="timer-fill" style="width:${(x.left / x.total * 100).toFixed(1)}%;background:${x.color ?? 'var(--t-cold)'}"></div>
      <span class="timer-label">${esc(x.label)}</span>
      <span class="timer-left num">${x.left < 10 ? x.left.toFixed(1) : Math.ceil(x.left)}s</span>
    </div>`).join('');
}

function showFinal(f) {
  const el = $('oFinal');
  if (!el) return;
  el.innerHTML = `<div class="eyebrow">${esc(f.label ?? t('ov.fightEnded'))}</div>
    <b>${n0(f.raidDps)}</b> <span class="eyebrow">dps · ${secs(f.duration)}</span>`;
  el.style.display = 'block';
  flashUntil = Date.now() + 4000;
  setTimeout(() => { if (Date.now() >= flashUntil) el.style.display = 'none'; }, 4100);
}

window.eql.onSnapshot((snap) => {
  renderTimers(snap.timers ?? []);
  const tip = snap.live?.suggest
    ? `${t('say.switchTo', { stance: snap.live.best })} · ${t(`adv.kind.${KIND[snap.live.kind] ?? 'equilibrado'}`)}`
    : null;
  const el = document.getElementById('oAdvice');
  if (el) { el.textContent = tip ?? ''; el.style.display = tip ? 'block' : 'none'; }
  const f = snap.current ?? snap.history[0];

  // Al cerrarse una pelea, resumen destacado unos segundos.
  const liveId = snap.current?.id ?? null;
  if (lastFightId !== null && liveId === null && snap.history[0]) showFinal(snap.history[0]);
  lastFightId = liveId;

  // Atenuado fuera de combate: presente pero sin estorbar.
  const root = document.querySelector('.ov');
  if (root) {
    root.classList.toggle('active', !!snap.current);
    root.classList.toggle('flash', Date.now() < flashUntil);
  }
  const ft = $('oFight');
  if (ft) ft.textContent = f?.label ?? '';
  $('oMeta').textContent = f ? `${n0(f.raidDps)} dps · ${secs(f.duration)}` : '';
  if (!f || !f.rows.length) {
    $('oRows').innerHTML = `<div class="ov-empty">${t('ov.noCombat')}</div>`;
    return;
  }
  $('oRows').innerHTML = f.rows.slice(0, MAX_ROWS).map((r) => {
    const tot = r.types.reduce((a, [, v]) => a + v, 0) || 1;
    return `<div class="ov-row">
      <div class="ov-top">
        <i class="ov-dot" style="background:${dotFor(r.name)}"></i>
        <span class="ov-name ${r.name === snap.self ? 'self' : ''}">${esc(r.name)}</span>
        <span class="ov-dps num">${n0(r.dps)}</span>
        <span class="ov-pct">${(r.share * 100).toFixed(0)}%</span>
      </div>
      <div class="bar" style="width:${Math.max(3, r.share * 100).toFixed(1)}%">
        ${r.types.map(([t, v]) => `<div class="seg ${typeClass(t)}" style="width:${(v/tot*100).toFixed(2)}%"></div>`).join('')}
      </div>
    </div>`;
  }).join('');
});

// La barra recupera el ratón al pasar por encima, para poder pulsar la X
// incluso con el overlay en modo atravesable.
const bar = document.querySelector('.ov-bar');
bar?.addEventListener('mouseenter', () => window.eql.overlayHover(true));
bar?.addEventListener('mouseleave', () => window.eql.overlayHover(false));

$('oClose')?.addEventListener('click', () => window.eql.closeOverlay());
$('oPass')?.addEventListener('click', () => window.eql.toggleClickThrough());

window.eql.onTheme((t) => { document.documentElement.dataset.theme = t; });
window.eql.getConfig().then((c) => { document.documentElement.dataset.theme = c.theme ?? 'dark'; });

window.eql.onOverlayState(({ clickThrough }) => {
  $('oLock').textContent = clickThrough ? 'clics al juego' : 'clics al overlay';
  $('oLock').className = clickThrough ? 'eyebrow locked' : 'eyebrow';
});

const showBanner = mountBanner();
window.eql.onAlert((a) => showBanner(a));
