import { t, setLang, getLang, LANGS, langInfo, TRANSLATED } from '../src/i18n.js';
import { analyse } from '../src/analysis.js';
import { advise } from '../src/advisor.js';
import { RANGES } from '../src/ranges.js';
import { mergePets } from '../src/aggregate.js';
import { initTriggers, renderTriggers } from './triggers.js';
import { mountBanner, speak, playSound, listVoices } from './alerts.js';

const TYPES = ['magic', 'cold', 'fire', 'poison', 'disease', 'melee', 'ds', 'dot', 'spell'];
const typeClass = (t) => (TYPES.includes(t) ? t : 'other');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Math.round(v || 0).toLocaleString('es-ES');
const n1 = (v) => (v || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const pct = (v) => `${((v || 0) * 100).toFixed(1)}%`;
const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const $ = (id) => document.getElementById(id);

const state = {
  snap: null,
  selectedFight: 'live',
  expanded: new Set(),
  hover: null,
  setup: false,
  view: 'combat',
  cfg: {},
  rowNodes: new Map(),
  sideHeads: new Map(),
  detailStamp: new Map(),
  showAll: false,
  filter: { range: '24h', foe: '' },
  fights: [],
  fightCache: new Map(),
  foes: [],
  stats: null,
  summary: null,
  openFoes: new Set(),
  openSumRows: new Set(),
};

// ═══════════ Introducción de primera vez ═══════════
const WZ_STEPS = 6;

async function renderWizard() {
  const host = $('bodyGrid');
  const w = state.wizard;
  const cands = w.step === 3 ? await window.eql.detectLogs() : [];
  const cfg = state.cfg;

  const nav = (nextLabel, nextEnabled = true) => `<div class="wz-nav">
    <span class="eyebrow">${esc(t('wz.step', { n: w.step, total: WZ_STEPS }))}</span>
    <div class="wz-dots">${Array.from({ length: WZ_STEPS }, (_, i) =>
      `<i class="${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'past' : ''}"></i>`).join('')}</div>
    ${w.step > 1 ? `<button id="wzBack">${esc(t('wz.back'))}</button>` : `<button id="wzSkip">${esc(t('wz.skip'))}</button>`}
    <button class="primary" id="wzNext" ${nextEnabled ? '' : 'disabled'}>${esc(nextLabel)}</button>
  </div>`;

  const body = {
    1: () => `<h1>${esc(t('wz.1.title'))}</h1>
      <p>${esc(t('wz.1.body'))}</p>
      <div class="sec-title eyebrow">${esc(t('wz.1.lang'))}</div>
      <div class="wz-langs">${LANGS.map((l) => `<button class="wz-lang ${l.code === langInfo().code ? 'on' : ''}"
        data-code="${l.code}"><span class="flag">${l.flag}</span>${esc(l.name)}</button>`).join('')}</div>
      <p class="hint">${esc(t('wz.1.time'))}</p>`,

    2: () => `<h1>${esc(t('wz.2.title'))}</h1>
      <p>${esc(t('wz.2.body'))}</p>
      <div class="sec-title eyebrow">${esc(t('wz.2.cmd'))}</div>
      <div class="wz-cmd">/log on</div>
      <div class="wz-warn">
        <div class="wz-warn-h">${esc(t('wz.2.filters'))}</div>
        <p>${esc(t('wz.2.filtersBody'))}</p>
      </div>
      <label class="chk"><input type="checkbox" id="wzOk" ${w.loggingOk ? 'checked' : ''}> ${esc(t('wz.2.done'))}</label>`,

    3: () => `<h1>${esc(t('wz.3.title'))}</h1>
      <p>${esc(t('wz.3.body'))}</p>
      ${cands.length ? `<div class="candidates">${cands.map((c) => `
        <div class="cand ${w.logPath === c.path ? 'on' : ''}" data-path="${esc(c.path)}">${esc(c.path)}
          <small>${new Date(c.mtime).toLocaleString()}</small></div>`).join('')}</div>`
        : `<div class="wz-warn"><p>${esc(t('wz.3.none'))}</p></div>`}
      <div class="field"><label class="eyebrow">${esc(t('setup.path'))}</label>
        <input class="wide" id="wzPath" value="${esc(w.logPath ?? '')}"></div>
      <button id="wzBrowse">${esc(t('setup.browse'))}</button>
      <label class="chk" style="margin-top:12px"><input type="checkbox" id="wzHist" ${w.fromStart ? 'checked' : ''}> ${esc(t('wz.3.history'))}</label>`,

    4: () => `<h1>${esc(t('wz.4.title'))}</h1>
      <p>${esc(t('wz.4.body'))}</p>
      <div class="wz-classes">${[0, 1, 2].map((i) => `<select class="wzcls" data-i="${i}">${
        classList().map(([k, v]) => `<option value="${k}"${(w.classes?.[i] ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')
      }</select>`).join('')}</div>
      <p class="hint">${esc(t('wz.4.who'))}</p>
      <div class="wz-who" id="wzWho">${esc(t('wz.4.waiting'))}</div>
      <p class="hint" style="margin-top:12px">${esc(t('wz.classNote'))}</p>`,

    5: () => `<h1>${esc(t('wz.5.title'))}</h1>
      <p>${esc(t('wz.5.body'))}</p>
      <div class="sec-title eyebrow">${esc(t('wz.5.cmd'))}</div>
      <div class="wz-cmd">/pet who leader</div>
      <p>${esc(t('wz.5.body2'))}</p>
      <p class="hint">${esc(t('wz.petNote'))}</p>`,

    6: () => `<h1>${esc(t('wz.6.title'))}</h1>
      <p>${esc(t('wz.6.body'))}</p>
      <div class="tbl wz-keys" style="grid-template-columns:130px 1fr">
        <div class="th eyebrow">Ctrl+Alt+M</div><div class="td">${esc(t('hdr.overlay'))}</div>
        <div class="th eyebrow">Ctrl+Alt+O</div><div class="td">${esc(t('ov.passThrough'))}</div>
        <div class="th eyebrow">Ctrl+Alt+X</div><div class="td">${esc(t('ov.close'))}</div>
      </div>
      <div class="wz-warn"><p>${esc(t('wz.6.fullscreen'))}</p></div>
      <div class="wz-warn">
        <div class="wz-warn-h">${esc(t('ov.fpsTitle'))}</div>
        <p>${esc(t('ov.fpsBody'))}</p>
      </div>
      <button id="wzOverlay">${esc(t('wz.6.open'))}</button>
      <p class="hint" style="margin-top:14px">${esc(t('wz.6.ready'))}</p>`,
  }[w.step]();

  // Se mira el estado, no el DOM: al repintar, $('wzPath') aún es el anterior.
  const canNext = w.step !== 3 || !!(w.logPath ?? '').trim();
  host.innerHTML = `<div class="wizard"><div class="wz-card" id="wzCard">${body}
    ${nav(w.step === WZ_STEPS ? t('wz.finish') : t('wz.next'), canNext)}</div></div>`;

  const finish = async () => {
    const logPath = (w.logPath ?? '').trim();
    if (logPath && !w.attached) {
      await window.eql.attach({ logPath, self: '', fromStart: !!w.fromStart, idleSec: cfg.idleSec ?? 20 });
    }
    if (w.classes?.some(Boolean)) await window.eql.setClasses(w.classes);
    await window.eql.setOnboarded(true);
    state.cfg = await window.eql.getConfig();
    state.wizard = null;
    state.view = 'combat';
    host.innerHTML = '';
    renderApp();
  };

  $('wzSkip')?.addEventListener('click', finish);
  $('wzBack')?.addEventListener('click', () => { w.step--; renderWizard(); });
  $('wzNext')?.addEventListener('click', async () => {
    if (w.step === 3) {
      w.logPath = $('wzPath').value.trim();
      // Conectar aquí y no al final: si no, el /who del paso siguiente no se
      // lee y la promesa de que las clases se rellenan solas sería falsa.
      if (w.logPath && !w.attached) {
        await window.eql.attach({ logPath: w.logPath, self: '', fromStart: !!w.fromStart,
          idleSec: state.cfg.idleSec ?? 20 });
        w.attached = true;
      }
    }
    if (w.step === WZ_STEPS) { await finish(); return; }
    w.step++;
    renderWizard();
  });

  host.querySelectorAll('.wz-lang').forEach((el) => el.addEventListener('click', async () => {
    setLang(el.dataset.code);
    await window.eql.setLang(el.dataset.code);
    applyLangToChrome(); renderLangPicker(); renderWizard();
  }));
  $('wzOk')?.addEventListener('change', (e) => { w.loggingOk = e.target.checked; });
  $('wzHist')?.addEventListener('change', (e) => { w.fromStart = e.target.checked; });
  host.querySelectorAll('.cand').forEach((el) => el.addEventListener('click', () => {
    w.logPath = el.dataset.path; renderWizard();
  }));
  $('wzBrowse')?.addEventListener('click', async () => {
    const p = await window.eql.browseLog();
    if (p) { w.logPath = p; renderWizard(); }
  });
  $('wzPath')?.addEventListener('input', (e) => {
    w.logPath = e.target.value;
    const b = $('wzNext'); if (b) b.disabled = !e.target.value.trim();
  });
  host.querySelectorAll('.wzcls').forEach((el) => el.addEventListener('change', () => {
    w.classes = [...host.querySelectorAll('.wzcls')].map((x) => x.value);
    w.classesTouched = true;
  }));
  $('wzOverlay')?.addEventListener('click', () => window.eql.openOverlay());
}

/** El paso 4 sí escucha el motor, pero sólo toca los desplegables. */
function wizardWhoUpdate(snap) {
  const w = state.wizard;
  const box = $('wzWho');
  if (!box || !snap) return;
  const got = snap.classSource === 'who' && snap.classes?.length ? snap.classes : null;
  if (!got) { box.textContent = t('wz.4.waiting'); return; }
  const label = got.map((c) => CLASS_NAMES[c] ?? c).join(', ');
  if (box.dataset.got === label) return;
  box.dataset.got = label;
  box.textContent = t('wz.4.read', { classes: label });
  box.classList.add('ok');
  if (w.classesTouched) return;                 // lo tuyo manda sobre lo leído
  w.classes = [got[0] ?? '', got[1] ?? '', got[2] ?? ''];
  document.querySelectorAll('.wzcls').forEach((el, i) => { el.value = w.classes[i] ?? ''; });
}

// ═══════════ Configuración ═══════════
async function renderSetup() {
  const cands = await window.eql.detectLogs();
  const cfg = state.cfg;
  state.rowNodes.clear();
  $('bodyGrid').innerHTML = `<div class="setup" style="grid-column:1/-1">
    <h1>${t('setup.title')}</h1>
    <p>${esc(t('setup.intro'))}</p>
    ${cands.length ? `<div class="field"><label class="eyebrow">${t('setup.found')}</label>
      <div class="candidates">${cands.map((c) => `<div class="cand" data-path="${esc(c.path)}">${esc(c.path)}
        <small>${new Date(c.mtime).toLocaleString('es-ES')}</small></div>`).join('')}</div></div>`
      : `<p class="hint">${esc(t('setup.notFound'))}</p>`}
    <div class="field"><label class="eyebrow">${t('setup.path')}</label>
      <input class="wide" id="inPath" value="${esc(cfg.logPath ?? '')}" placeholder="D:\\EVERQUEST LEGENDS\\Logs\\eqlog_...txt"></div>
    <div class="field"><label class="eyebrow">${esc(t('setup.character'))} <span class="hint">${esc(t('setup.characterHint'))}</span></label>
      <input id="inSelf" value="${esc(cfg.self ?? '')}" placeholder="Campeon"></div>
    <div class="field"><label class="eyebrow">${t('setup.idle')}</label>
      <input id="inIdle" type="number" min="5" max="120" value="${cfg.idleSec ?? 20}" style="width:80px">
      <span class="hint">${t('setup.idleUnit')}</span></div>
    <div class="field"><label><input type="checkbox" id="inFromStart" ${cfg.fromStart ? 'checked' : ''}> ${t('setup.fromStart')}</label>
      <div class="hint">${esc(t('setup.fromStartHint'))}</div></div>
    <div class="actions">
      <button class="primary" id="btnAttach">${t('setup.start')}</button>
      <button id="btnBrowse">${t('setup.browse')}</button>
      ${state.snap?.path ? `<button id="btnCancel">${t('setup.cancel')}</button>` : ''}
    </div></div>`;

  document.querySelectorAll('.cand').forEach((el) =>
    el.addEventListener('click', () => { $('inPath').value = el.dataset.path; }));
  $('btnBrowse').addEventListener('click', async () => {
    const p = await window.eql.browseLog();
    if (p) $('inPath').value = p;
  });
  $('btnCancel')?.addEventListener('click', () => { state.setup = false; renderApp(); });
  $('btnAttach').addEventListener('click', async () => {
    const logPath = $('inPath').value.trim();
    if (!logPath) return;
    await window.eql.attach({
      logPath, self: $('inSelf').value.trim(),
      fromStart: $('inFromStart').checked, idleSec: +$('inIdle').value || 20,
    });
    state.cfg = await window.eql.getConfig();
    state.setup = false; state.selectedFight = 'live';
    renderApp();
  });
}

// ═══════════ Lista de peleas ═══════════
/** Aplica la fusión de mascotas si está activada. */
/** Nombres que cuentan como tu mascota: lo detectado más lo que marcaste tú. */
function petNames() {
  const det = state.snap?.allPets ?? state.snap?.pets ?? [];
  return [...new Set([...det, ...(state.cfg.myPets ?? [])])]
    .filter((n) => !(state.cfg.notPets ?? []).includes(n));
}
const isMyPet = (name) => petNames().includes(name);

/**
 * Los que has dicho que no son tuyos.
 *
 * Se aplica al MOSTRAR y no al guardar: así vale para todo el histórico sin
 * reconstruir nada y se puede deshacer desde Ajustes. Hace falta porque el log
 * de EQL no dice quién va en tu grupo —ni invitaciones, ni entradas, ni
 * salidas—, así que un jugador que pega a tus enemigos no se distingue de un
 * compañero por ningún dato. Siempre habrá excepciones que sólo tú sabes.
 */
const excluidos = () => new Set(state.cfg.excluded ?? []);

function withPets(f) {
  if (!f) return f;
  const fuera = excluidos();
  let rows = fuera.size ? f.rows.filter((r) => !fuera.has(r.name)) : f.rows;
  if (state.cfg.mergePets) {
    rows = mergePets(rows, t('pets.merged'), petNames(), state.snap?.self, state.cfg.notPets ?? []);
  }
  return rows === f.rows ? f : { ...f, rows };
}

// La pelea elegida se identifica por `uid` (el byte donde empieza en disco), no
// por `id`: el `id` vuelve a empezar en 1 en cada arranque y se repite entre
// sesiones. La viva no tiene uid, y eso es justo lo que la distingue.
const isLive = (f) => !!f && f.uid == null;

function fightFor(snap) {
  if (state.selectedFight === 'live') return snap.current ?? state.fightCache.get(state.fights[0]?.uid) ?? null;
  // Las cerradas viven en disco: se piden por su identificador y se cachean.
  return state.fightCache.get(state.selectedFight) ?? snap.current ?? null;
}

/** Trae del disco la pelea elegida y la deja en caché. */
async function loadFight(uid) {
  if (uid === 'live' || state.fightCache.has(uid)) return;
  try {
    const f = await window.eql.getFight?.(uid);
    // Se anota el uid en la pelea traída: es lo que la distingue de la viva.
    if (f) { state.fightCache.set(uid, { ...f, uid }); renderApp(); }
  } catch (err) { console.error('pelea:', err); }
}

/** Recarga el índice según el tramo y el enemigo elegidos. */
async function refreshFights() {
  const r = RANGES.find((x) => x.key === state.filter.range);
  const q = { sinceMs: r?.ms ?? null, foe: state.filter.foe || null, limit: 400 };
  // Si el almacén falla o no está disponible, la aplicación sigue funcionando
  // con la sesión en curso: quedarse en blanco es mucho peor que sin histórico.
  try {
    state.fights = (await window.eql.queryHistory?.(q)) ?? [];
    state.foes = (await window.eql.foeList?.(r?.ms ?? null)) ?? [];
    state.stats = (await window.eql.storeStats?.()) ?? null;
  } catch (err) {
    console.error('histórico:', err);
    state.fights = []; state.foes = []; state.stats = null;
  }
  const list = $('fightList');
  if (list) list.dataset.sig = '';
  // Si lo que estaba abierto se ha quedado fuera del filtro, abrimos lo primero.
  if (state.selectedFight !== 'live' && !state.fights.some((f) => f.uid === state.selectedFight)) {
    state.selectedFight = state.fights[0] ? state.fights[0].uid : 'live';
  }
  if (state.selectedFight !== 'live') await loadFight(state.selectedFight);
  renderApp();
}

const TRIVIAL = (f) => f.duration < 3 || f.total < 500;

function fightCard(f, live) {
  const active = live ? state.selectedFight === 'live' : state.selectedFight === f.uid;
  return `<div class="fight ${live ? 'live' : ''} ${active ? 'active' : ''}" data-uid="${f.uid}" data-live="${live ? 1 : 0}">
    <div class="fight-name">${esc(f.label ?? t('fight.skirmish'))}</div>
    <div class="fight-sub">
      <span class="num strong foe">${n0(f.enemyDps ?? 0)}</span><span class="u">dps</span>
      <span class="num">${n0(f.raidDps)}</span><span class="u">${esc(t('side.allies').toLowerCase())}</span>
      <span class="num dim">${secs(f.duration)}</span>
    </div>
  </div>`;
}

function renderFightList(snap) {
  const parts = [];

  parts.push(`<div class="flt">
    <select id="fltRange">${RANGES.map((r) => `<option value="${r.key}"${
      state.filter.range === r.key ? ' selected' : ''}>${esc(r.key === 'all' ? t('flt.all') : t(`flt.${r.key}`))}</option>`).join('')}</select>
    <input id="fltFoe" list="foeList" placeholder="${esc(t('flt.allFoes'))}"
      value="${esc(state.filter.foe ?? '')}" autocomplete="off">
    <datalist id="foeList">
      ${state.foes.map((f) => `<option value="${esc(f.name)}">${f.n}</option>`).join('')}
    </datalist>
  </div>
  <button class="sumbtn" id="btnSummary">${esc(t('sum.open'))}</button>
  <button class="sumbtn" id="btnCatalog">${esc(t('cat.open'))}</button>`);

  const shown = state.showAll ? state.fights : state.fights.filter((f) => !TRIVIAL(f));
  const hidden = state.fights.length - shown.length;

  if (snap.current) parts.push(fightCard(snap.current, true));

  let lastZone = null;
  for (const f of shown) {
    const zone = f.zone ?? t('fight.unknownZone');
    if (zone !== lastZone) { lastZone = zone; parts.push(`<div class="zone-sep eyebrow">${esc(zone)}</div>`); }
    parts.push(fightCard(f, false));
  }
  if (!shown.length && !snap.current) parts.push(`<div class="hint" style="padding:12px">${esc(t('flt.none'))}</div>`);
  if (hidden > 0 || state.showAll) {
    parts.push(`<button class="showall" id="btnShowAll">${state.showAll
      ? esc(t('fight.hideMinor')) : esc(t('fight.showMinor', { n: hidden }))}</button>`);
  }
  if (state.stats) {
    parts.push(`<div class="flt-foot eyebrow">${esc(t('flt.stored', {
      n: state.stats.fights, kb: Math.round(state.stats.bytes / 1024) }))}</div>`);
  }

  const html = parts.join('');
  const list = $('fightList');
  if (list.dataset.sig === html) return;
  list.dataset.sig = html;
  list.innerHTML = html;

  $('fltRange')?.addEventListener('change', (e) => { state.filter.range = e.target.value; refreshFights(); });
  // Se espera a que dejes de escribir: filtrar en cada tecla releería el índice
  // entero con cada letra.
  let foeTimer = null;
  $('fltFoe')?.addEventListener('input', (e) => {
    const v = e.target.value;
    clearTimeout(foeTimer);
    foeTimer = setTimeout(() => {
      if (state.filter.foe === v) return;
      state.filter.foe = v;
      refreshFights();
    }, 350);
  });
  $('fltFoe')?.addEventListener('change', (e) => {
    clearTimeout(foeTimer);
    if (state.filter.foe === e.target.value) return;
    state.filter.foe = e.target.value;
    refreshFights();
  });
  $('btnCatalog')?.addEventListener('click', async () => {
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.catalog = await window.eql.spellCatalog?.({ sinceMs: r?.ms ?? null }) ?? null;
    state.view = 'catalog';
    $('bodyGrid').innerHTML = '';
    renderApp();
  });
  $('btnSummary')?.addEventListener('click', async () => {
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.summary = await window.eql.aggregate({ sinceMs: r?.ms ?? null, foe: state.filter.foe || null,
      mergePets: !!state.cfg.mergePets, petLabel: t('pets.merged'),
      myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] });
    state.view = 'summary';
    $('bodyGrid').innerHTML = '';
    renderApp();
  });
  list.querySelectorAll('.fight').forEach((el) => {
    const uid = el.dataset.live === '1' ? null : +el.dataset.uid;
    const f = uid === null ? snap.current : state.fights.find((x) => x.uid === uid);
    if (!f?.loot?.length) return;
    el.addEventListener('mouseenter', () => showLootTip(f));
    el.addEventListener('mouseleave', hideTip);
  });
  list.querySelectorAll('.fight').forEach((el) => el.addEventListener('click', async () => {
    state.selectedFight = el.dataset.live === '1' ? 'live' : +el.dataset.uid;
    state.rowNodes.clear();
    if ($('rows')) $('rows').innerHTML = '';
    await loadFight(state.selectedFight);
    renderApp();
  }));
  $('btnShowAll')?.addEventListener('click', () => { state.showAll = !state.showAll; list.dataset.sig = ''; renderApp(); });
}

// ═══════════ Barra segmentada por tipo de daño ═══════════
function barHTML(types, widthPct) {
  const tot = types.reduce((a, [, v]) => a + v, 0) || 1;
  return `<div class="bar" style="width:${Math.max(2, widthPct).toFixed(1)}%">${
    types.map(([t, v]) => `<div class="seg ${typeClass(t)}" style="width:${(v / tot * 100).toFixed(2)}%"></div>`).join('')
  }</div>`;
}

// ═══════════ Fila: construcción una vez, actualización incremental ═══════════
function buildRow(name) {
  const el = document.createElement('div');
  el.className = 'row';
  el.dataset.name = name;
  el.innerHTML = `<div class="row-top">
      <span class="rank num"></span>
      <span class="name"></span>
      <span class="row-dps num"></span>
      <span class="row-share num"></span>
    </div>
    <div class="bar-slot"></div>
    <div class="row-stats"></div>
    <div class="detail-slot"></div>`;
  const refs = {
    rank: el.querySelector('.rank'),
    name: el.querySelector('.name'),
    dps: el.querySelector('.row-dps'),
    share: el.querySelector('.row-share'),
    bar: el.querySelector('.bar-slot'),
    stats: el.querySelector('.row-stats'),
    detail: el.querySelector('.detail-slot'),
    sig: '',
  };
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('.excl-btn');
    if (btn) {
      e.stopPropagation();
      state.cfg.excluded = await window.eql.setExcluded(btn.dataset.excl, true);
      state.rowNodes.clear();
      if ($('rows')) $('rows').innerHTML = '';
      state.summary = null;
      renderApp();
      return;
    }
    state.expanded.has(name) ? state.expanded.delete(name) : state.expanded.add(name);
    state.detailStamp.delete(name);
    hideTip();
    renderRows(state.snap);
  });
  el.addEventListener('mouseenter', () => { state.hover = name; showTip(); });
  el.addEventListener('mouseleave', () => { if (state.hover === name) { state.hover = null; hideTip(); } });
  return { el, refs };
}

function updateRow(node, r, snap, live, rank) {
  const { refs } = node;
  const sig = `${rank}|${r.damage}|${r.dps.toFixed(1)}|${r.share.toFixed(4)}|${r.hits}|${r.misses}|${r.crits}|${r.taken}|${r.healingDone}|${r.petOf ?? ''}`;
  const open = state.expanded.has(r.name);
  node.el.classList.toggle('open', open);

  if (refs.sig !== sig) {
    refs.sig = sig;
    refs.rank.textContent = rank;
    node.el.classList.toggle('me', r.name === snap.self);
        refs.name.textContent = r.petOf ? `${r.name} (${t('row.petOf', { who: r.petOf })})` : r.name;
    refs.name.className = `name ${r.name === snap.self ? 'self' : ''} ${
      r.pet || snap.pets.includes(r.name) ? 'pet' : ''} ${r.petOf ? 'otherpet' : ''}`;
    refs.name.title = r.petOf ? t('row.petOf', { who: r.petOf }) : '';
    refs.dps.textContent = n0(r.dps);
    refs.share.textContent = `${(r.share * 100).toFixed(1)}%`;
    refs.bar.innerHTML = `<div class="bar-track">${barHTML(r.types, r.share * 100)}</div>`;
    refs.stats.innerHTML = [
      `<span>${t('row.damage')} <b>${n0(r.damage)}</b></span>`,
      `<span>${t('row.max')} <b>${n0(r.max)}</b></span>`,
      r.meleeHits + r.misses ? `<span>${t('row.accuracy')} <b>${(r.accuracy * 100).toFixed(0)}%</b></span>` : '',
      r.crits ? `<span>${t('row.crits')} <b>${r.crits}</b></span>` : '',
      r.taken ? `<span>${t('row.taken')} <b>${n0(r.taken)}</b></span>` : '',
      r.healingDone ? `<span>${t('row.healed')} <b>${n0(r.healingDone)}</b></span>` : '',
    ].join('');
  }

  // El desglose se reconstruye sólo si la pelea está viva; en una cerrada
  // se pinta una vez para poder seleccionar texto con tranquilidad.
  if (open) {
    const stamp = live ? sig : 'static';
    if (state.detailStamp.get(r.name) !== stamp) {
      state.detailStamp.set(r.name, stamp);
      refs.detail.innerHTML = detailHTML(r);
    }
  } else if (refs.detail.innerHTML) {
    refs.detail.innerHTML = '';
    state.detailStamp.delete(r.name);
  }
}

function renderRows(snap) {
  const f = withPets(fightFor(snap));
  const host = $('rows');
  if (!f) { host.innerHTML = ''; state.rowNodes.clear(); return; }
  const live = isLive(f);
  const seen = new Set();

  // Cabecera al pasar de los tuyos a los enemigos: sin ella parecen el mismo
  // reparto, que es justo lo que confundía en el resumen.
  // Los sin identificar van en su propio grupo, no bajo «Los tuyos». Hicieron
  // daño real y se quedan, pero el log de EQL no dice quién va en tu grupo, así
  // que meterlos con los tuyos afirmaría algo que nadie ha comprobado.
  const grupo = (r) => (r.side === 'enemy' ? 'enemy' : r.unidentified ? 'unknown' : 'ally');
  const ROTULO = { enemy: 'side.enemies', ally: 'side.allies', unknown: 'side.unknownAllies' };
  const grupos = new Set(f.rows.map(grupo));
  let lastSide = null;

  let rankAlly = 0, rankFoe = 0;
  const ORDEN = { ally: 0, unknown: 1, enemy: 2 };
  [...f.rows].sort((a, b) => ORDEN[grupo(a)] - ORDEN[grupo(b)]).forEach((r, i) => {
    seen.add(r.name);
    let node = state.rowNodes.get(r.name);
    if (!node) { node = buildRow(r.name); state.rowNodes.set(r.name, node); }
    updateRow(node, r, snap, live, r.side === 'enemy' ? ++rankFoe : ++rankAlly);
    const g = grupo(r);
    if (grupos.size > 1 && g !== lastSide) {
      lastSide = g;
      let h = state.sideHeads.get(g);
      if (!h) {
        h = document.createElement('div');
        h.className = 'side-head eyebrow';
        state.sideHeads.set(g, h);
      }
      h.textContent = t(ROTULO[g]);
      h.title = g === 'unknown' ? t('side.unknownNote') : '';
      host.appendChild(h);
    }
    host.appendChild(node.el);
  });

  for (const [name, node] of state.rowNodes) {
    if (!seen.has(name)) { node.el.remove(); state.rowNodes.delete(name); }
  }
  if (state.hover) updateTip();
}

// ═══════════ Tabla auxiliar ═══════════
function table(cols, rows) {
  if (!rows.length) return `<div class="hint">${t('det.noData')}</div>`;
  const w = cols.map((c) => c.w ?? '1fr').join(' ');
  return `<div class="tbl" style="grid-template-columns:${w}">
    ${cols.map((c) => `<div class="th eyebrow ${c.right ? 'r' : ''}">${esc(c.label)}</div>`).join('')}
    ${rows.map((cells) => cells.map((v, i) => `<div class="td ${cols[i].right ? 'r num' : ''}">${v}</div>`).join('')).join('')}
  </div>`;
}

const section = (title, body) => `<div class="sec"><div class="sec-title eyebrow">${esc(title)}</div>${body}</div>`;

// ═══════════ Desglose completo ═══════════
function detailHTML(r) {
  const dmgTotal = r.damage || 1;
  const takenTotal = r.taken || 1;
  const healTotal = r.healingDone || 1;

  const composition = section(t('det.composition'), table(
    [{ label: t('det.type') }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: '', w: '110px' }],
    r.types.map(([t, v]) => [
      `<i class="seg ${typeClass(t)}"></i>${esc(t)}`, n0(v), pct(v / dmgTotal),
      `<div class="mini"><div class="seg ${typeClass(t)}" style="width:${(v / dmgTotal * 100).toFixed(1)}%"></div></div>`,
    ]),
  ));

  const abilities = section(t('det.byAbility'), table(
    [{ label: t('det.ability') }, { label: 'Tipo', w: '74px' }, { label: t('det.dmg'), right: true, w: '84px' },
     { label: t('det.share'), right: true, w: '58px' }, { label: t('det.uses'), right: true, w: '48px' },
     { label: t('det.avg'), right: true, w: '62px' }, { label: t('det.minmax'), right: true, w: '96px' },
     { label: t('det.crit'), right: true, w: '48px' }],
    r.abilities.map((a) => [
      esc(a.name), `<i class="seg ${typeClass(a.type)}"></i>${esc(a.type ?? '—')}`,
      n0(a.sum), pct(a.sum / dmgTotal), a.n, n0(a.sum / a.n),
      `${n0(a.min)}–${n0(a.max)}`, a.crits || '—',
    ]),
  ));

  const targets = r.targets.length > 1 ? section(t('det.byTarget'), table(
    [{ label: t('det.target') }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: t('det.hits'), right: true, w: '64px' }],
    r.targets.map((t) => [esc(t.name), n0(t.sum), pct(t.sum / dmgTotal), t.n]),
  )) : '';

  const stanceSec = (r.stances.length || r.invocations.length) ? section(t('det.byStance'), `
    ${r.stances.length ? table(
      [{ label: 'Stance' }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: t('det.hits'), right: true, w: '60px' }],
      r.stances.map((x) => [esc(x.name), n0(x.sum), pct(x.sum / dmgTotal), x.n]),
    ) : ''}
    ${r.invocations.length ? table(
      [{ label: t('adv.invocation') }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: t('det.hits'), right: true, w: '60px' }],
      r.invocations.map((x) => [esc(x.name), n0(x.sum), pct(x.sum / dmgTotal), x.n]),
    ) : ''}
    <div class="hint">${esc(t('det.stanceNote'))}</div>`) : '';

  const swings = r.meleeHits + r.misses;
  const offence = section(t('det.offence'), `<div class="kv">
      <span>${t('det.hitsLanded')} <b>${n0(r.hits)}</b></span>
      <span>${t('det.swings')} <b>${n0(swings)}</b></span>
      <span>${t('row.accuracy')} <b>${swings ? pct(r.accuracy) : '—'}</b></span>
      <span>${t('row.crits')} <b>${r.crits ? `${r.crits} · ${pct(r.critRate)} · ${n0(r.critDamage)} ${t('row.damage')}` : '—'}</b></span>
      ${r.flurries ? `<span>${t('det.flurry')} <b>${r.flurries}</b></span>` : ''}
      ${r.ripostes ? `<span>${t('det.ripostes')} <b>${r.ripostes}</b></span>` : ''}
      <span>${t('det.bigHit')} <b>${n0(r.max)}</b></span>
      <span>${t('det.smallHit')} <b>${n0(r.min)}</b></span>
    </div>${r.missReasons.length ? table(
      [{ label: t('det.missBy') }, { label: t('det.times'), right: true, w: '64px' }, { label: t('det.share'), right: true, w: '64px' }],
      r.missReasons.map(([k, n]) => [esc(k), n, swings ? pct(n / swings) : '—']),
    ) : ''}`);

  const defence = (r.taken || r.swingsAgainst) ? section(t('det.defence'), `<div class="kv">
      <span>${t('det.taken')} <b>${n0(r.taken)}</b></span>
      <span>${t('det.takenPerSec')} <b>${n1(r.taken / Math.max(1, r.ownSec))}</b></span>
      <span>${t('det.attacksTaken')} <b>${n0(r.swingsAgainst)}</b></span>
      <span>${t('det.avoidance')} <b>${r.swingsAgainst ? pct(r.avoidance) : '—'}</b></span>
      ${r.deaths ? `<span>${t('det.deaths')} <b>${r.deaths}</b></span>` : ''}
    </div>
    ${r.defense.length ? table(
      [{ label: t('det.avoidedWith') }, { label: t('det.times'), right: true, w: '64px' }, { label: t('det.share'), right: true, w: '64px' }],
      r.defense.map(([k, n]) => [esc(k), n, pct(n / r.swingsAgainst)]),
    ) : ''}
    ${r.takenBySource.length ? table(
      [{ label: t('det.takenFrom') }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: t('det.times'), right: true, w: '56px' }],
      r.takenBySource.map((s) => [esc(s.name), n0(s.sum), pct(s.sum / takenTotal), s.n]),
    ) : ''}
    ${r.takenByType.length > 1 ? table(
      [{ label: t('det.typeTaken') }, { label: t('det.dmg'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }],
      r.takenByType.map((s) => [`<i class="seg ${typeClass(s.name)}"></i>${esc(s.name)}`, n0(s.sum), pct(s.sum / takenTotal)]),
    ) : ''}`) : '';

  const healing = (r.healingDone || r.healingTaken) ? section(t('det.healing'), `<div class="kv">
      <span>${t('det.healDone')} <b>${n0(r.healingDone)}</b></span>
      <span>${t('det.healTaken')} <b>${n0(r.healingTaken)}</b></span>
      <span>HPS <b>${n1(r.healingDone / Math.max(1, r.ownSec))}</b></span>
      ${r.healPotential ? `<span>${t('det.overheal')} <b>${n0(Math.max(0, r.healPotential - r.healingDone))}</b></span>` : ''}
    </div>
    ${r.healBySpell.length ? table(
      [{ label: t('det.spell') }, { label: t('det.healed'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }, { label: t('det.uses'), right: true, w: '48px' }, { label: t('det.avg'), right: true, w: '64px' }],
      r.healBySpell.map((h) => [esc(h.name), n0(h.sum), pct(h.sum / healTotal), h.n, n0(h.sum / h.n)]),
    ) : ''}
    ${r.healByTarget.length ? table(
      [{ label: t('det.toWhom') }, { label: t('det.healed'), right: true, w: '90px' }, { label: t('det.share'), right: true, w: '64px' }],
      r.healByTarget.map((h) => [esc(h.name), n0(h.sum), pct(h.sum / healTotal)]),
    ) : ''}`) : '';

  const activity = section(t('det.pace'), `<div class="kv">
      <span>${t('det.dpsFight')} <b>${n1(r.dps)}</b></span>
      <span>${t('det.dpsOwn')} <b>${n1(r.dpsOwn)}</b></span>
      <span>${t('det.dpsActive')} <b>${n1(r.dpsActive)}</b></span>
      <span>${t('det.activeSecs')} <b>${r.activeSec} ${t('det.of')} ${r.ownSec}</b></span>
    </div>
    <div class="hint">${esc(t('det.paceNote'))}</div>`);

  // Sacar a alguien de tu bando. Va aquí, al desplegar la fila, porque es
  // donde estás mirando sus cifras y decidiendo que no pintan nada.
  const excluir = r.name === state.snap?.self ? '' : `<div class="sec">
    <button class="excl-btn" data-excl="${esc(r.name)}">${esc(t('excl.remove'))}</button>
    ${r.unidentified ? `<span class="hint">${esc(t('side.unknownNote'))}</span>` : ''}
  </div>`;

  return `<div class="detail">${composition}${abilities}${targets}${stanceSec}${offence}${defence}${healing}${activity}${excluir}</div>`;
}

// ═══════════ Tooltip de hover ═══════════
let tipEl = null;
let mouse = { x: 0, y: 0 };
document.addEventListener('mousemove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  if (tipEl && tipEl.style.display === 'block') placeTip();
});

function ensureTip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
function placeTip() {
  const t = ensureTip();
  const r = t.getBoundingClientRect();
  let x = mouse.x + 16, y = mouse.y + 14;
  if (x + r.width > window.innerWidth - 8) x = mouse.x - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
  t.style.left = `${Math.max(8, x)}px`;
  t.style.top = `${Math.max(8, y)}px`;
}
function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
function showTip() { updateTip(); if (tipEl) { tipEl.style.display = 'block'; placeTip(); } }

const wikiCache = new Map();     // nombre -> ficha, o null si la wiki no la tiene
let hoverItem = null;

/**
 * Ficha del objeto al pasar el ratón, con el aspecto del juego.
 *
 * La consulta va con retardo: pasar el ratón por encima de una lista no debe
 * disparar diez peticiones a la wiki.
 */
function showItemTip(name) {
  hoverItem = name;
  const paint = (data) => {
    if (hoverItem !== name) return;               // el ratón ya se fue
    const tip = ensureTip();
    tip.className = 'tip item-tip';
    tip.innerHTML = data
      ? `<div class="it-head">${esc(data.title)}</div>
         ${data.image ? `<img class="it-img" src="${esc(data.image)}" alt="">` : ''}
         <div class="it-lines">${data.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
      : `<div class="it-head">${esc(name)}</div>
         <div class="it-lines dim">${esc(t('loot.noWiki'))}</div>`;
    tip.style.display = 'block';
    placeTip();
  };

  if (wikiCache.has(name)) { paint(wikiCache.get(name)); return; }
  setTimeout(async () => {
    if (hoverItem !== name) return;
    const data = await window.eql.wikiItem?.(name).catch(() => null);
    wikiCache.set(name, data ?? null);
    paint(data ?? null);
  }, 220);
}

function hideItemTip() {
  hoverItem = null;
  const tip = document.querySelector('.tip');
  if (tip) { tip.className = 'tip'; tip.style.display = 'none'; }
}

/** Aviso con el botín, al pasar el ratón por una pelea de la lista. */
function showLootTip(f) {
  const el = ensureTip();
  el.innerHTML = `<div class="tip-head">${esc(t('loot.title'))}</div>
    <div class="tip-types">${(f.loot ?? []).slice(0, 12).map((l) =>
      `<div class="tip-type"><span>${esc(typeof l === 'string' ? l : l.item)}</span></div>`).join('')}
      ${(f.loot ?? []).length > 12 ? `<div class="dim" style="font-size:10.5px">${
        esc(t('tip.more', { n: f.loot.length - 12 }))}</div>` : ''}</div>`;
  el.style.display = 'block';
  placeTip();
}

function updateTip() {
  const f = fightFor(state.snap);
  const r = f?.rows.find((x) => x.name === state.hover);
  if (!r) { hideTip(); return; }
  if (state.expanded.has(r.name)) { hideTip(); return; }
  const t = ensureTip();
  const dmgTotal = r.damage || 1;
  t.innerHTML = `<div class="tip-head">${esc(r.name)}</div>
    <div class="tip-grid">
      <span class="eyebrow">DPS</span><b class="num">${n1(r.dps)}</b>
      <span class="eyebrow">${esc(t('det.dmg'))}</span><b class="num">${n0(r.damage)} · ${pct(r.share)}</b>
      ${r.meleeHits + r.misses ? `<span class="eyebrow">${esc(t('row.accuracy'))}</span><b class="num">${pct(r.accuracy)} · ${r.meleeHits}/${r.meleeHits + r.misses}</b>` : ''}
      ${r.crits ? `<span class="eyebrow">${esc(t('row.crits'))}</span><b class="num">${r.crits} · ${pct(r.critRate)}</b>` : ''}
      <span class="eyebrow">${esc(t('det.minmax'))}</span><b class="num">${n0(r.min)}–${n0(r.max)}</b>
      ${r.taken ? `<span class="eyebrow">${esc(t('row.taken'))}</span><b class="num">${n0(r.taken)}</b>` : ''}
      ${r.healingDone ? `<span class="eyebrow">Curado</span><b class="num">${n0(r.healingDone)}</b>` : ''}
    </div>
    <div class="tip-types">${r.types.map(([ty, v]) =>
      `<div class="tip-type"><i class="seg ${typeClass(ty)}"></i><span>${esc(ty)}</span><b class="num">${n0(v)}</b><span class="num dim">${pct(v / dmgTotal)}</span></div>`).join('')}</div>
    ${r.abilities.length ? `<div class="tip-abils">${r.abilities.slice(0, 4).map((a) =>
      `<div class="tip-type"><span>${esc(a.name)}</span><b class="num">${n0(a.sum)}</b><span class="num dim">×${a.n}</span></div>`).join('')}
      ${r.abilities.length > 4 ? `<div class="dim" style="font-size:10.5px">${t('tip.more', { n: r.abilities.length - 4 })}</div>` : ''}</div>` : ''}
    <div class="tip-foot eyebrow">${esc(t('tip.click'))}</div>`;
}


// ═══════════ Ajustes de voz ═══════════
const NARRATE_CHAT = ['tell','group','guild','raid','say','ooc','shout','auction','channel'].map((k) => [k, () => t(`ch.${k}`)]);
const NARRATE_CAST = ['heal','charm','mez','fear','root','summon','escape','resurrect','dispel','nuke'].map((k) => [k, () => t(`cat.${k}`)]);
const NARRATE_COMBAT = ['stance','deaths','petdeath','adds','summary','interrupt','resist','bigcrit','levelup','loot','seeinvis','petprompt'].map((k) => [k, () => t(`cb.${k}`)]);
const NARRATE_SURVIVAL = ['feign','invisFading','invisGone','levitateFading','summoned','invuln','unconscious','forgotten'].map((k) => [k, () => t(`cb.${k}`)]);

async function renderNarrate(host) {
  const n = await window.eql.getNarrate();
  state.cfg.tts = n.tts ?? state.cfg.tts;
  const box = (group, key, label) => `<label class="chk">
    <input type="checkbox" data-g="${group}" data-k="${key}"${n[group]?.[key] ? ' checked' : ''}> ${esc(label)}</label>`;
  host.innerHTML = `<div class="narrate">
    <div class="sec-title eyebrow">${esc(t('sv.title'))}</div>
    <div class="chks">${NARRATE_SURVIVAL.map(([k, l]) => box('survival', k, l())).join('')}</div>
    <div class="hint">${esc(t('sv.hint'))}</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${t('voice.readChat')}</div>
    <div class="chks">${NARRATE_CHAT.map(([k, l]) => box('chat', k, l())).join('')}</div>
    <div class="hint">${esc(t('voice.chatHint'))}</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${t('voice.combat')}</div>
    <div class="chks">${NARRATE_COMBAT.map(([k, l]) => box('combat', k, l())).join('')}</div>
    <div class="hint">${esc(t('voice.combatHint'))}</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${t('voice.enemyCasts')}</div>
    <div class="chks">${NARRATE_CAST.map(([k, l]) => box('enemyCast', k, l())).join('')}</div>
    <div class="narrate-row">
      <label class="eyebrow" style="flex:1">${t('voice.extraSpells')}
        <input id="nNukes" style="flex:1;min-width:220px" placeholder="Ice Comet, Lava Bolt"
          value="${esc((n.nukeNames ?? []).join(', '))}"></label>
    </div>
    <div class="hint">${esc(t('voice.castHint'))}</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('voice.voice'))}</div>
    <div class="voice-row">
      <select id="nVoice">
        <option value="">${esc(t('voice.default'))}</option>
        ${(() => {
          // Primero las del idioma de la interfaz, luego el resto agrupadas por
          // idioma: con varios paquetes instalados la lista plana es ilegible.
          const cur = (langInfo().speech ?? '').slice(0, 2).toLowerCase();
          const all = listVoices();
          const sel = (v) => ((n.tts?.voice ?? '') === v.name ? ' selected' : '');
          const opt = (v) => `<option value="${esc(v.name)}"${sel(v)}>${esc(v.name)} · ${esc(v.lang)}</option>`;
          const mine = all.filter((v) => (v.lang ?? '').toLowerCase().startsWith(cur));
          const rest = all.filter((v) => !(v.lang ?? '').toLowerCase().startsWith(cur));
          const byLang = new Map();
          for (const v of rest) {
            const k = (v.lang ?? '?').split('-')[0].toUpperCase();
            if (!byLang.has(k)) byLang.set(k, []);
            byLang.get(k).push(v);
          }
          return (mine.length ? `<optgroup label="${esc(t('voice.matching'))}">${mine.map(opt).join('')}</optgroup>` : '')
            + [...byLang].sort((a, b) => a[0].localeCompare(b[0]))
                .map(([k, vs]) => `<optgroup label="${esc(k)}">${vs.map(opt).join('')}</optgroup>`).join('');
        })()}
      </select>
      <label class="eyebrow">${esc(t('voice.rate'))}
        <input type="range" id="nRate" min="0.5" max="2" step="0.1" value="${n.tts?.rate ?? 1}"></label>
      <label class="eyebrow">${esc(t('voice.volume'))}
        <input type="range" id="nVol" min="0" max="1" step="0.05" value="${n.tts?.volume ?? 1}"></label>
    </div>
    <div class="hint">${esc(t('voice.moreVoices'))}</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('trio.title'))}</div>
    <div class="hint">${esc(t('trio.note'))}</div>
    <div class="trio-tbl" id="trioTbl">${(state.cfg.trios ?? []).length
      ? (state.cfg.trios ?? []).map((r, i) => `<div class="trio-row">
          <span class="trio-from">${r.at == null ? esc(t('trio.always'))
            : esc(new Date(r.at).toLocaleString())}</span>
          <span class="trio-cls"><b>${r.classes.map((c) => esc(t(`cl.${c}`))).join(' · ')}</b></span>
          <span class="trio-lvl">${r.level == null ? esc(t('trio.fromLog')) : esc(t('trio.level', { n: r.level }))}</span>
          <button class="petbtn" data-trio-del="${i}">${esc(t('trio.del'))}</button>
        </div>`).join('')
      : `<span class="hint">${esc(t('trio.empty'))}</span>`}</div>
    <button class="petbtn" id="trioAdd" style="margin-top:8px">${esc(t('trio.add'))}</button>
    <div id="trioConf"></div>

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('excl.title'))}</div>
    <div class="hint">${esc(t('excl.note'))}</div>
    <div class="excl-list" id="exclList">${(state.cfg.excluded ?? []).length
      ? (state.cfg.excluded ?? []).map((x) => `<span class="excl-item"><b>${esc(x)}</b>
          <button class="petbtn" data-restore="${esc(x)}">${esc(t('excl.restore'))}</button></span>`).join('')
      : `<span class="hint">${esc(t('excl.empty'))}</span>`}</div>

    <div class="narrate-row">
      <label class="eyebrow">${t('voice.cut')}
        <input type="number" id="nMax" min="40" max="400" value="${n.maxChars}" style="width:70px" ${t('voice.chars')}</label>
      <button id="nTest">${t('voice.test')}</button>
    </div>
  </div>`;

  const save = async () => {
    const next = { ...n, chat: { ...n.chat }, combat: { ...n.combat },
      enemyCast: { ...n.enemyCast }, survival: { ...n.survival } };
    host.querySelectorAll('input[type=checkbox]').forEach((el) => {
      next[el.dataset.g][el.dataset.k] = el.checked;
    });
    next.maxChars = +host.querySelector('#nMax').value || 120;
    next.nukeNames = host.querySelector('#nNukes').value.split(',').map((x) => x.trim()).filter(Boolean);
    next.tts = { ...(n.tts ?? {}), voice: host.querySelector('#nVoice').value || null,
      rate: +host.querySelector('#nRate').value, volume: +host.querySelector('#nVol').value };
    state.cfg.tts = next.tts;
    Object.assign(n, next);
    await window.eql.setNarrate(next);
  };
  host.querySelectorAll('input').forEach((el) => el.addEventListener('change', save));
  // Dónde tu tabla y el log no dicen lo mismo. Se señala, no se decide: lo
  // manual manda a propósito, y sólo tú sabes cuál de los dos está mal.
  const pintarConflictos = async () => {
    const host2 = $('trioConf');
    if (!host2) return;
    const c = await window.eql.trioConflicts?.().catch(() => []) ?? [];
    if (!c.length) { host2.innerHTML = ''; return; }
    host2.innerHTML = `<div class="trio-conf">
      <div class="trio-conf-h">${esc(t('trio.conflictTitle', { n: c.length }))}</div>
      ${c.map((x) => `<div class="trio-conf-row">
        <span class="trio-from">${esc(new Date(x.at).toLocaleString())}</span>
        <span>${esc(t('trio.conflictRow', {
          log: x.dice.map((k) => t(`cl.${k}`)).join('/'),
          you: x.declaras.map((k) => t(`cl.${k}`)).join('/'),
        }))}</span>
      </div>`).join('')}
      <div class="hint">${esc(t('trio.conflictNote'))}</div>
    </div>`;
  };
  pintarConflictos();

  const guardarTrios = async (lista) => {
    const r = await window.eql.setTrios(lista);
    state.cfg.trios = r.trios;
    state.needsRebuild = r.needsRebuild;
    showTrioRebuild();
    renderApp();
    pintarConflictos();
  };
  host.querySelector('#trioAdd')?.addEventListener('click', async () => {
    const cls = prompt(t('trio.askClasses'), 'SHD/MAG/DRU');
    if (!cls) return;
    const classes = cls.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    if (classes.length !== 3) { alert(t('trio.needThree')); return; }
    const fecha = prompt(t('trio.askFrom'), new Date().toISOString().slice(0, 16).replace('T', ' '));
    if (fecha === null) return;
    // Vacío quiere decir «desde siempre»: cubre las peleas anteriores a tu
    // primer /who, que si no se quedan sin nivel para siempre.
    let at = null;
    if (fecha.trim()) {
      at = new Date(fecha.trim().replace(' ', 'T')).getTime();
      if (!Number.isFinite(at)) { alert(t('trio.badDate')); return; }
    }
    const nivel = prompt(t('trio.askLevel'), '');
    if (nivel === null) return;
    const lvl = nivel.trim() ? Number(nivel.trim()) : null;
    if (lvl !== null && !(lvl > 0 && lvl < 200)) { alert(t('trio.badLevel')); return; }
    await guardarTrios([...(state.cfg.trios ?? []), { at, classes, level: lvl }]);
  });
  host.querySelectorAll('[data-trio-del]').forEach((el) => el.addEventListener('click', async () => {
    const i = Number(el.dataset.trioDel);
    await guardarTrios((state.cfg.trios ?? []).filter((_, k) => k !== i));
  }));
  host.querySelectorAll('[data-restore]').forEach((el) => el.addEventListener('click', async () => {
    state.cfg.excluded = await window.eql.setExcluded(el.dataset.restore, false);
    state.rowNodes.clear();
    state.summary = null;
    renderApp();
  }));
  host.querySelector('#nTest').addEventListener('click', () => {
    const tts = { voice: host.querySelector('#nVoice').value || null,
      rate: +host.querySelector('#nRate').value, volume: +host.querySelector('#nVol').value };
    speak(t('say.testPhrase'), { ...tts, speech: langInfo().speech });
  });
}

// ═══════════ Gráfica: daño por segundo + franja de postura ═══════════
const STANCE_COLOR = {
  defensive: 'var(--t-cold)', 'mage hunter': 'var(--t-magic)', channeler: 'var(--t-spell)',
  offensive: 'var(--t-fire)', balanced: 'var(--t-melee)', evasive: 'var(--t-poison)',
  striker: 'var(--t-ds)', ranged: 'var(--t-disease)', berserker: 'var(--t-dot)',
};

function chartHTML(f) {
  const dur = Math.max(1, f.duration);
  if (dur < 4 || !f.series?.length) return '';
  const W = 600, H = 96, BAND = 11;
  const byS = new Map(f.series.map((p) => [p.s, p]));
  const pts = [];
  for (let i = 0; i <= dur; i++) pts.push(byS.get(i) ?? { s: i, dmg: 0, taken: 0, heal: 0 });
  const peak = Math.max(1, ...pts.map((p) => p.dmg));
  const x = (i) => (i / dur) * W;
  const y = (v) => H - (v / peak) * (H - 6);

  const area = `M0,${H} ` + pts.map((p, i) => `L${x(i).toFixed(1)},${y(p.dmg).toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.dmg).toFixed(1)}`).join(' ');
  const takenMax = Math.max(1, ...pts.map((p) => p.taken));
  const taken = pts.some((p) => p.taken)
    ? pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - (p.taken / takenMax) * (H - 6) * 0.5).toFixed(1)}`).join(' ')
    : null;

  const band = (f.stanceSpans ?? []).map((sp) => {
    const x0 = x(sp.from), x1 = x(Math.max(sp.to, sp.from + 1));
    const key = String(sp.stance).toLowerCase().replace(/\s*stance\s*$/, '');
    return `<rect x="${x0.toFixed(1)}" y="0" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${BAND}"
      fill="${STANCE_COLOR[key] ?? 'var(--t-other)'}" opacity=".85"><title>${esc(sp.stance)}</title></rect>`;
  }).join('');

  const legend = [...new Set((f.stanceSpans ?? []).map((sp) =>
    String(sp.stance).toLowerCase().replace(/\s*stance\s*$/, '')))].map((k) =>
    `<span><i style="background:${STANCE_COLOR[k] ?? 'var(--t-other)'}"></i>${esc(k)}</span>`).join('');

  return `<div class="chart">
    ${band ? `<svg class="chart-band" viewBox="0 0 ${W} ${BAND}" preserveAspectRatio="none" role="img"
      aria-label="${esc(t('chart.bandLabel'))}">${band}</svg>` : ''}
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="${esc(t('chart.svgLabel', { v: n0(peak) }))}">
      <path d="${area}" fill="var(--t-cold)" opacity=".16"/>
      <path d="${line}" fill="none" stroke="var(--t-cold)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      ${taken ? `<path d="${taken}" fill="none" stroke="var(--t-ds)" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}
    </svg>
    <div class="chart-foot">
      <span class="eyebrow">${esc(t('chart.peak', { v: n0(peak) }))}</span>
      <span class="chart-legend eyebrow">${legend}${taken ? `<span><i class="dash"></i>${t('chart.taken')}</span>` : ''}</span>
      <span class="eyebrow">${secs(dur)}</span>
    </div>
  </div>`;
}

// ═══════════ Clases que no cuadran ═══════════
/**
 * Un hechizo que sólo puede lanzar una clase que no está en tu trío.
 *
 * En EQL puedes cambiar de trío y el log no lo dice en ninguna parte, así que
 * esto es lo único que delata el cambio. Se deduce el trío al vuelo, pero el
 * NIVEL no se puede deducir de nada: por eso el aviso pide /who en vez de
 * quedarse callado. En pantalla y no por voz, porque no cambia lo que haces
 * en los próximos tres segundos.
 */
function renderClassPrompt(snap) {
  const host = $('clsPrompt');
  if (!host) return;
  const p = snap.classPrompt;
  const viejo = snap.classSourceAt === 'inferido';
  const sig = p ? `c|${p.spell}|${p.clase}` : (viejo ? 'stale' : '');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  if (!sig) { host.innerHTML = ''; return; }

  host.innerHTML = `<div class="pethint">
    <div class="pethint-main">${esc(p
      ? t('cls.contradiction', { spell: p.spell, cls: t(`cl.${p.clase}`) })
      : t('cls.stale'))}</div>
    <div class="pethint-cmd">/who</div>
    ${p ? `<div class="pethint-sub">${esc(t('cls.inferred'))}: ${
      p.trio.map((c) => esc(t(`cl.${c}`))).join(' · ')}</div>` : ''}
  </div>`;
}

// ═══════════ Mascota sin identificar ═══════════
function renderPetHint(snap) {
  const host = $('petHint');
  if (!host) return;
  const h = snap.petHint;
  const sig = h ? h.candidates.join('|') : '';
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  if (!h) { host.innerHTML = ''; return; }

  const likely = new Set(h.likely ?? []);
  host.innerHTML = `<div class="pethint">
    <div class="pethint-main">${t('pet.which')}</div>
    <div class="pethint-cmd">/pet who leader</div>
    <div class="pethint-sub">${esc(t('pet.hint'))}</div>
    <div class="pethint-btns">${h.candidates.map((c) => `
      <span class="petcand ${likely.has(c) ? 'likely' : ''}">
        <b>${esc(c)}</b>
        <button class="petbtn yes" data-name="${esc(c)}">${esc(t('pet.mine'))}</button>
        <button class="petbtn no" data-name="${esc(c)}">${esc(t('pet.notMine'))}</button>
      </span>`).join('')}</div>
  </div>`;
  host.querySelectorAll('.petbtn.yes').forEach((el) => el.addEventListener('click', async () => {
    await window.eql.markPet(el.dataset.name, true);
    host.dataset.sig = '';
  }));
  host.querySelectorAll('.petbtn.no').forEach((el) => el.addEventListener('click', async () => {
    await window.eql.dismissPet(el.dataset.name);
    host.dataset.sig = '';
  }));
}

// ═══════════ Consejo de postura ═══════════
const CLASS_CODES = ['', 'BER', 'BRD', 'BST', 'CLR', 'DRU', 'ENC', 'MAG', 'MNK', 'NEC',
  'PAL', 'RNG', 'ROG', 'SHD', 'SHM', 'WAR', 'WIZ'];
// Función y no constante: los nombres cambian con el idioma.
const classList = () => CLASS_CODES.map((k) => [k, k ? t(`cl.${k}`) : '—']);
const CLASS_NAMES = new Proxy({}, { get: (_, c) => t(`cl.${String(c)}`) });

function renderAdvice(snap) {
  const host = $('advice');
  if (!host) return;
  // El consejo se calcula sobre la pelea SELECCIONADA. Antes venía del motor,
  // que siempre miraba la que estuviera en curso: bastaba una escaramuza suelta
  // donde no hubieras pegado para que no encontrara tu fila y no aconsejara nada.
  const f = withPets(fightFor(snap));
  const classes = snap.classes ?? [];
  const myRow = f?.rows.find((r) => r.name === snap.self);
  const a = (myRow && classes.length)
    ? advise(myRow, {
        classes, stance: snap.stance, invocation: snap.invocation,
        resistsSuffered: f.resistsSuffered, interrupts: f.interrupts,
      })
    : null;
  const live = snap.live;
  // Sin ninguna pelea el panel no aporta nada y encima pide las clases con
  // los desplegables ya rellenos, que despista.
  if (!f) { host.innerHTML = ''; host.dataset.sig = ''; return; }

  const conflict = snap.classConflict && state.dismissedConflict !== JSON.stringify(snap.classConflict)
    ? snap.classConflict : null;
  const sig = JSON.stringify([getLang(), f.uid ?? 'live', a?.incoming, a?.current,
    a?.defence.map((d) => d.prevented), classes, conflict,
    live && [live.kind, live.bestKey, live.suggest]]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  const trioBtn = `<button class="trio-now" id="trioNow" title="${esc(t('trio.nowHint'))}">${esc(t('trio.now'))}</button>`;
  // Se engancha en las dos ramas del panel: la normal y la de «faltan clases».
  // Declarar el trío es justo lo que hace falta cuando aún no se sabe cuál es.
  const engancharTrio = () => host.querySelector('#trioNow')?.addEventListener('click', async () => {
    const classes = [...host.querySelectorAll('.cls')].map((x) => x.value).filter(Boolean);
    if (classes.length !== 3) { alert(t('trio.needThree')); return; }
    // El nivel es opcional a propósito: si lo dejas vacío manda lo que diga el
    // log dentro del tramo, que es lo correcto mientras estés subiendo.
    const nivel = prompt(t('trio.askLevel'), String(state.snap?.level ?? ''));
    if (nivel === null) return;
    const lvl = nivel.trim() ? Number(nivel.trim()) : null;
    if (lvl !== null && !(lvl > 0 && lvl < 200)) { alert(t('trio.badLevel')); return; }
    const r = await window.eql.setTrios([...(state.cfg.trios ?? []), { at: Date.now(), classes, level: lvl }]);
    state.cfg.trios = r.trios;
    state.needsRebuild = r.needsRebuild;
    showTrioRebuild();
    host.dataset.sig = '';
    renderApp();
  });

  const sel = (i) => `<select class="cls" data-i="${i}">${classList().map(([k, v]) =>
    `<option value="${k}"${(classes[i] ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;

  const conflictBox = conflict ? `<div class="conflict">
      <div class="conflict-h">${esc(t('cls.conflict'))}</div>
      <div class="conflict-d">${esc(conflict.reason === 'message'
        ? t('cls.conflictMessage')
        : t('cls.conflictStance', { name: conflict.name,
            classes: (conflict.classes ?? []).map((c) => CLASS_NAMES[c] ?? c).join(' / ') }))}
        ${esc(t('cls.fix'))}</div>
      <button id="cfDismiss">${esc(t('cls.dismiss'))}</button>
    </div>` : '';

  // Sin clases no hay nada que aconsejar, pero el selector tiene que estar
  // visible o no habría forma de indicarlas.
  if (!a) {
    host.innerHTML = `<div class="advice need">
      <div class="adv-head">
        <span class="eyebrow">${t('adv.title')}</span>
        <span class="adv-classes">${sel(0)}${sel(1)}${sel(2)}</span>
        ${trioBtn}
      </div>
      <div class="adv-verdict">${t('adv.needClasses')}</div>
      <div class="hint">${esc(t('adv.needClassesHint'))}</div>
    </div>`;
    engancharTrio();
    host.querySelectorAll('.cls').forEach((el) => el.addEventListener('change', async () => {
      await window.eql.setClasses([...host.querySelectorAll('.cls')].map((x) => x.value));
      host.dataset.sig = '';
    }));
    return;
  }

  const liveBox = live ? `<div class="live ${live.suggest ? 'warn' : 'ok'}">
      <div class="live-main">${live.suggest
        ? `Cambia a <b>${esc(live.best)}</b>`
        : `<b>${esc(live.current ?? live.best)}</b> es la correcta ahora mismo`}</div>
      <div class="live-sub">${esc(t('adv.liveSub', { s: live.seconds, kind: live.kind,
        pct: Math.round(live.meleeShare * 100), dps: n0(live.dps) }))}</div>
    </div>` : '';

  const mix = a.incoming.meleeShare;
  const kind = a.incoming.total === 0 ? '—'
    : mix > 0.7 ? t('adv.mostlyMelee') : mix < 0.3 ? t('adv.mostlyMagic') : t('adv.mixed');

  host.innerHTML = `<div class="advice">
    <div class="adv-head">
      <span class="eyebrow">${t('adv.title')}</span>
      <span class="src eyebrow">${snap.classSource && snap.classSource !== 'desconocidas'
        ? esc(t(`adv.src.${snap.classSource}`)) : ''}</span>
      <span class="adv-classes">${sel(0)}${sel(1)}${sel(2)}</span>
      ${trioBtn}
    </div>
    ${conflictBox}
    ${liveBox}
    ${a.incoming.total ? `
      <div class="adv-verdict">${esc(a.lowSample
        ? t('adv.lowSample', { n: a.incoming.hits })
        : (a.verdict ?? ''))}</div>
      <div class="kv">
        <span>${esc(t('adv.taken'))} <b>${n0(a.incoming.observed)}</b></span>
        <span title="${esc(t('adv.rawNote', { n: a.incoming.hits }))}">${esc(t('adv.incoming'))} <b>${n0(a.incoming.total)}</b></span>
        <span>${esc(t('adv.split'))} <b>${kind}</b></span>
        <span>${esc(t('adv.melee'))} <b>${n0(a.incoming.melee)}</b></span>
        <span>${esc(t('adv.magic'))} <b>${n0(a.incoming.spell)}</b></span>
        <span>${esc(t('adv.now'))} <b>${esc(a.current.stance ?? '—')}${a.current.invocation ? ' · ' + esc(a.current.invocation) : ''}</b></span>
      </div>
      ${table(
        [{ label: 'Stance' }, { label: t('adv.wouldAvoid'), right: true, w: '84px' }, { label: t('adv.ofTotal'), right: true, w: '68px' },
         { label: t('adv.endurance'), right: true, w: '66px' }, { label: t('adv.mana'), right: true, w: '62px' }],
        a.defence.map((d) => [
          `${esc(d.label)}${d.key === (a.current.stance ?? '').toLowerCase().replace(/\s*stance\s*$/, '') ? ` <span class="dim">${esc(t('adv.active'))}</span>` : ''}`,
          n0(d.prevented), pct(d.share), n0(d.endurance), d.mana ? n0(d.mana) : '—',
        ]),
      )}
      <div class="hint">${esc(a.defence[0]?.noteKey ? t(a.defence[0].noteKey) : '')}</div>
    ` : `<div class="hint">${esc(t('adv.noDamage'))}</div>`}

    ${a.offence.filter((o) => o.bonus > 0).length ? `
      <div class="sec-title eyebrow" style="margin-top:12px">${esc(t('adv.ifYouHit'))}</div>
      ${table(
        [{ label: 'Stance' }, { label: t('adv.extraDamage'), right: true, w: '90px' }, { label: t('adv.costs'), right: true, w: '80px' }],
        a.offence.filter((o) => o.bonus > 0).map((o) => [esc(o.label), '+' + n0(o.bonus), n0(o.endurance) + ' ' + t('adv.endurance').toLowerCase()]),
      )}` : ''}

    ${a.invocations.filter((i) => i.score > 0).length ? `
      <div class="sec-title eyebrow" style="margin-top:12px">${esc(t('adv.invocation'))}</div>
      ${a.invocations.filter((i) => i.score > 0).slice(0, 3).map((i) => `
        <div class="adv-inv">
          <b>${esc(i.label)}</b>
          ${i.why.length ? `<span class="dim">${esc(i.why.join(' · '))}</span>` : ''}
          <div class="hint">${esc(i.noteKey ? t(i.noteKey) : '')}</div>
        </div>`).join('')}` : ''}

    <div class="hint" style="margin-top:10px">${esc(t('adv.footnote'))}</div>
  </div>`;

  engancharTrio();
  host.querySelectorAll('.cls').forEach((el) => el.addEventListener('change', async () => {
    const list = [...host.querySelectorAll('.cls')].map((x) => x.value);
    await window.eql.setClasses(list);
    state.dismissedConflict = null;
    host.dataset.sig = '';
  }));
  $('cfDismiss')?.addEventListener('click', () => {
    state.dismissedConflict = JSON.stringify(snap.classConflict);
    host.dataset.sig = '';
    renderAdvice(state.snap);
  });
}

// ═══════════ Cabecera de la pelea ═══════════
/** Botín de la pelea. Cada objeto abre su página en la wiki al pulsarlo. */
function lootHTML(f) {
  const loot = f.loot ?? [];
  if (!loot.length) return '';
  return `<div class="loot">
    <div class="sec-title eyebrow">${esc(t('loot.title'))} · ${esc(t('loot.count', { n: loot.length }))}</div>
    ${loot.map((l) => `<div class="loot-row">
      <button class="loot-item" data-item="${esc(l.item)}" title="${esc(t('loot.wiki'))}">${esc(l.item)}</button>
      ${l.from ? `<span class="dim">${esc(t('loot.from'))} ${esc(l.from)}</span>` : ''}
      ${l.upgraded ? `<span class="loot-up">${esc(t('loot.upgraded'))} ${esc(l.upgraded)}</span>` : ''}
      ${l.sold ? `<span class="dim">${esc(t('loot.sold'))} ${esc(l.sold)}</span>` : ''}
    </div>`).join('')}
  </div>`;
}

function renderHead(snap) {
  const f = withPets(fightFor(snap));
  const host = $('fightHead');
  if (!f) {
    host.innerHTML = `<div class="empty"><h2>${t('fight.none')}</h2>
      <p>${t('fight.noneHint')}</p></div>`;
    return;
  }
  const live = isLive(f);
  const sig = `${f.uid ?? 'live'}|${f.total}|${f.duration}|${live}|${f.series?.length ?? 0}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  const card = (v, label, cls = '') => `<div class="metric ${cls}">
    <div class="metric-v num">${v}</div><div class="metric-l eyebrow">${label}</div></div>`;

  host.innerHTML = `
    <div class="head-top">
      <div>
        <div class="head-title">${esc(f.label ?? t('fight.skirmish'))}</div>
        <div class="eyebrow">${live ? t('fight.live') : t('fight.closed')} · ${esc(f.zone ?? t('fight.unknownZone'))}${
          f.diff !== null && f.diff !== undefined ? ` · D${f.diff}${f.diffTag ? ' ' + esc(f.diffTag) : ''}` : ''}
          · ${f.level ? esc(t('lvl.level', { n: f.level }))
            : `<span class="gap" title="${esc(t('lvl.unknownNote'))}">${esc(t('lvl.unknown'))}</span>`}</div>
      </div>
      <div class="head-actions">
        ${!live ? `<button class="primary" id="btnAnalyse">${t('an.button')}</button>
        <button id="btnExport">${t('fight.save')}</button>` : ''}
      </div>
    </div>
    <div class="metrics">
      ${card(n0(f.raidDps), t('metric.raidDps'), 'lead')}
      ${card(n0(f.total), t('metric.total'))}
      ${card(secs(f.duration), t('metric.duration'))}
      ${f.enemyDps ? card(n0(f.enemyDps), t('metric.enemyDps'), 'foe') : ''}
      ${f.healing ? card(n0(f.healing), t('metric.healing')) : ''}
      ${f.kills.length ? card(f.kills.length, t('metric.kills', { n: f.kills.length })) : ''}
      ${f.losses?.length ? card(f.losses.length, t('metric.losses', { n: f.losses.length }), 'bad') : ''}
    </div>
    ${chartHTML(f)}
    ${lootHTML(f)}`;
  host.querySelectorAll('.loot-item').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); window.eql.openWiki(el.dataset.item); });
    el.addEventListener('mouseenter', () => showItemTip(el.dataset.item));
    el.addEventListener('mouseleave', hideItemTip);
  });
  $('btnExport')?.addEventListener('click', (e) => { e.stopPropagation(); window.eql.exportEncounter(f); });
  $('btnAnalyse')?.addEventListener('click', (e) => { e.stopPropagation(); state.view = 'analysis'; $('bodyGrid').innerHTML = ''; renderApp(); });
}

// ═══════════ Análisis del combate ═══════════
const LEVEL_ICON = { bad: '!', warn: '·', info: 'i', good: '✓' };

function renderAnalysis(snap) {
  const f = fightFor(snap);
  const host = $('anView');
  const back = `<button id="anBack">← ${esc(t('tab.combat'))}</button>`;

  // Sin esta guarda el snapshot de 250 ms rehacía la vista entera: el análisis
  // se recalculaba cuatro veces por segundo y, como #anView es el contenedor
  // que desplaza, el scroll volvía arriba en cuanto lo movías y no había forma
  // de seleccionar un texto. Es el mismo patrón que ya guardan el asistente, la
  // configuración, la pestaña de avisos y el resumen.
  const sig = JSON.stringify([getLang(), f?.uid ?? 'live', f?.total, f?.duration, snap.classes]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  if (!f || f.duration < 30) {
    host.innerHTML = `<div class="analysis"><div class="an-head"><h2>${esc(t('an.title'))}</h2>${back}</div>
      <div class="hint">${esc(t('an.tooShort'))}</div></div>`;
    $('anBack').addEventListener('click', () => { state.view = 'combat'; renderApp(); });
    return;
  }

  const a = analyse(f, { self: snap.self, classes: snap.classes, pets: snap.pets });
  if (!a) { host.innerHTML = ''; return; }

  const maxDps = Math.max(1, ...a.phases.map((p) => p.dps));
  const maxDtps = Math.max(1, ...a.phases.map((p) => p.dtps));

  const phaseRows = a.phases.map((p, i) => `<div class="an-phase">
      <div class="an-phase-h">
        <span class="eyebrow">${esc(t('an.phase'))} ${i + 1}</span>
        <span class="num">${p.from}–${p.to}s</span>
        ${p.meleeShare !== null ? `<span class="eyebrow">${Math.round(p.meleeShare * 100)}% ${esc(t('adv.melee'))}</span>` : ''}
      </div>
      <div class="an-bars">
        <div class="an-bar"><span class="eyebrow">dps</span>
          <div class="an-track"><div class="an-fill dmg" style="width:${(p.dps / maxDps * 100).toFixed(1)}%"></div></div>
          <b class="num">${n0(p.dps)}</b></div>
        <div class="an-bar"><span class="eyebrow">dtps</span>
          <div class="an-track"><div class="an-fill taken" style="width:${(p.dtps / maxDtps * 100).toFixed(1)}%"></div></div>
          <b class="num">${n0(p.dtps)}</b></div>
      </div>
    </div>`).join('');

  const findings = a.findings.length ? a.findings.map((x) => `<div class="an-find ${x.level}">
      <div class="an-find-h"><span class="an-ico">${LEVEL_ICON[x.level]}</span><b>${esc(x.title)}</b></div>
      <div class="an-find-d">${esc(x.detail)}</div>
      ${x.impact ? `<div class="an-find-i">${esc(x.impact)}</div>` : ''}
    </div>`).join('') : `<div class="hint">${esc(t('an.noFindings'))}</div>`;

  host.innerHTML = `<div class="analysis">
    <div class="an-head">
      <div><h2>${esc(f.label ?? t('fight.skirmish'))}</h2>
        <div class="eyebrow">${secs(f.duration)} · ${n0(f.total)} · ${esc(f.zone ?? '')}</div></div>
      <div class="an-score"><div class="an-score-v num">${a.score}</div>
        <div class="eyebrow">${esc(t('an.score'))}</div></div>
      ${back}
    </div>

    <div class="kv an-roles">
      <span>${esc(t('an.topDamage'))} <b>${esc(a.roles.topDamage ?? '—')}</b></span>
      <span>${esc(t('an.topHealing'))} <b>${esc(a.roles.topHealing ?? '—')}</b></span>
      <span>${esc(t('an.tank'))} <b>${esc(a.roles.tank ?? '—')}</b></span>
    </div>

    <div class="sec-title eyebrow">${esc(t('an.findings'))}</div>
    <div class="an-finds">${findings}</div>

    <div class="sec-title eyebrow" style="margin-top:20px">${esc(t('an.phases'))}</div>
    ${phaseRows}

    <div class="hint" style="margin-top:18px">${esc(t('an.limits'))}</div>
  </div>`;
  $('anBack').addEventListener('click', () => { state.view = 'combat'; renderApp(); });
}

// ═══════════ Orquestación ═══════════
function renderTimers(snap) {
  const host = $('timers');
  if (!host) return;
  const t = snap.timers ?? [];
  const sig = t.map((x) => `${x.id}:${x.left.toFixed(1)}`).join('|');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = t.map((x) => `<div class="timer">
      <div class="timer-fill" style="width:${(x.left / x.total * 100).toFixed(1)}%;background:${x.color ?? 'var(--t-cold)'}"></div>
      <span class="timer-label">${esc(x.label)}</span>
      <span class="timer-left num">${x.left < 10 ? x.left.toFixed(1) : Math.ceil(x.left)}s</span>
    </div>`).join('');
}

/** Todas las peleas del tramo en un único desglose, desplegable por enemigo. */
function renderSummary() {
  const a = state.summary;
  const host = $('bodyGrid');
  if (!a || !a.fights) {
    host.innerHTML = `<div class="empty"><h2>${esc(t('sum.empty'))}</h2>
      <button id="sumBack">${esc(t('sum.back'))}</button></div>`;
    $('sumBack')?.addEventListener('click', () => { state.view = 'combat'; $('bodyGrid').innerHTML = ''; renderApp(); });
    return;
  }
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const maxDmg = Math.max(...a.rows.map((r) => r.damage), 1);

  const scroll = host.querySelector('.summary')?.scrollTop ?? 0;
  host.innerHTML = `<div class="summary" id="sumRoot">
    <div class="sum-head">
      <h2>${esc(t('sum.title'))}</h2>
      <label class="chk mini" id="sumMergeL" title="${esc(t('pets.mergeHint'))}">
        <input type="checkbox" id="sumMerge"${state.cfg.mergePets ? ' checked' : ''}> ${esc(t('pets.mergePets'))}
        <span class="dim">(${petNames().length})</span></label>
      <button id="sumBack">${esc(t('sum.back'))}</button>
    </div>
    <div class="metrics">
      ${card(n0(a.dps), 'dps')}
      ${card(n0(a.total), t('metric.total'))}
      ${card(n0(a.enemyDps), t('metric.enemyDps'), 'foe')}
      ${card(secs(a.seconds), t('sum.combatTime'))}
      ${card(a.fights, t('sum.fights', { n: a.fights }))}
      ${a.kills ? card(a.kills, t('metric.kills', { n: a.kills })) : ''}
      ${a.losses ? card(a.losses, t('metric.losses', { n: a.losses }), 'bad') : ''}
      ${a.healing ? card(n0(a.healing), t('metric.healing')) : ''}
    </div>
    <div class="hint">${esc(t('sum.note'))}</div>
    ${(() => {
      // Aliados que pegan a tus enemigos pero no sabemos quiénes son. En vez de
      // llenar la vista de casillas, se pide el comando que lo resuelve solo.
      const unknown = a.rows.filter((r) => r.side !== 'enemy' && r.name !== state.snap?.self
        && !r.petOf && !r.merged && !isMyPet(r.name)).map((r) => r.name);
      if (!unknown.length) return '';
      return `<div class="pethint sum-pethint">
        <div class="pethint-main">${esc(t('pet.which'))}</div>
        <div class="pethint-cmd">/pet who leader</div>
        <div class="pethint-sub">${esc(t('pet.hintSum', { names: unknown.slice(0, 6).join(', ') }))}</div>
      </div>`;
    })()}

    ${state.filter.foe ? foeDossier(a) : ''}

    <div class="sec-title eyebrow" style="margin-top:20px">${esc(t('side.allies'))}</div>
    ${a.rows.filter((r) => r.side !== 'enemy' && !r.unidentified).map((r) => sumRow(r, maxDmg)).join('')}

    ${a.rows.some((r) => r.side !== 'enemy' && r.unidentified) ? `
      <div class="sec-title eyebrow" style="margin-top:20px">${esc(t('side.unknownAllies'))}</div>
      <div class="hint">${esc(t('side.unknownNote'))}</div>
      ${a.rows.filter((r) => r.side !== 'enemy' && r.unidentified).map((r) => sumRow(r, maxDmg)).join('')}` : ''}

    <div class="sec-title eyebrow" style="margin-top:20px">${esc(t('sum.byFoe'))}</div>
    ${a.foes.map((f) => `<div class="foe-row" data-foe="${esc(f.name)}">
        <div class="foe-top">
          <span class="foe-name">${esc(f.name)}</span>
          <span class="dim">${esc(t('sum.times', { n: f.fights }))}${
            f.kills ? ` · ${esc(t('sum.killed', { n: f.kills }))}` : ''}</span>
          <span class="num strong">${n0(f.damageTo)}</span>
          <span class="num dim">${n0(f.dps)} dps</span>
          <span class="num foe">${n0(f.taken)}</span>
        </div>
        ${state.openFoes.has(f.name) ? foeDetail(a, f) : ''}
      </div>`).join('')}

    ${a.loot.length ? `<div class="sec-title eyebrow" style="margin-top:20px">${esc(t('loot.title'))}</div>
      <div class="loot">${a.loot.map((l) => `<div class="loot-row">
        <button class="loot-item" data-item="${esc(l.item)}">${esc(l.item)}</button>
        ${l.n > 1 ? `<span class="num dim">×${l.n}</span>` : ''}
        ${l.from.length ? `<span class="dim">${esc(t('loot.from'))} ${esc(l.from.slice(0, 3).join(', '))}</span>` : ''}
      </div>`).join('')}</div>` : ''}
  </div>`;

  // Se conserva la posición: desplegar un enemigo no debe saltar al principio.
  const root = $('sumRoot');
  if (root && scroll) root.scrollTop = scroll;

  $('sumBack')?.addEventListener('click', () => { state.view = 'combat'; $('bodyGrid').innerHTML = ''; renderApp(); });
  // El botón de la ficha del enemigo. Su listener estaba registrado en la rama
  // del resumen VACÍO, donde ese botón no existe: con `?.` no daba error y el
  // botón se pintaba inerte.
  $('dosWiki')?.addEventListener('click', () => {
    const f = state.summary?.foes?.find((x) => x.name.toLowerCase()
      .includes((state.filter.foe ?? '').toLowerCase()));
    window.eql.openWiki(f?.name ?? state.filter.foe);
  });
  $('sumMerge')?.addEventListener('change', async (e) => {
    state.cfg.mergePets = e.target.checked;
    await window.eql.setMergePets(e.target.checked);
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.openSumRows.clear();
    state.summary = await window.eql.aggregate({ sinceMs: r?.ms ?? null, foe: state.filter.foe || null,
      mergePets: e.target.checked, petLabel: t('pets.merged'),
      myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] });
    renderSummary();
  });
  host.querySelectorAll('.sum-row').forEach((el) => el.addEventListener('click', () => {
    const nm = el.dataset.row;
    state.openSumRows.has(nm) ? state.openSumRows.delete(nm) : state.openSumRows.add(nm);
    renderSummary();
  }));
  host.querySelectorAll('.foe-row').forEach((el) => el.addEventListener('click', () => {
    const nm = el.dataset.foe;
    state.openFoes.has(nm) ? state.openFoes.delete(nm) : state.openFoes.add(nm);
    renderSummary();
  }));
  host.querySelectorAll('.loot-item').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); window.eql.openWiki(el.dataset.item); });
    el.addEventListener('mouseenter', () => showItemTip(el.dataset.item));
    el.addEventListener('mouseleave', hideItemTip);
  });
}

/**
 * Expediente completo de un enemigo, cuando lo has elegido en el filtro.
 * Junta lo medido en tus peleas con lo que cuenta la wiki.
 */
/**
 * Fichas por dificultad.
 *
 * Sólo aparecen si de verdad has peleado con ese bicho en más de una: si no,
 * repetirían la cabecera. Y llevan lo que cambia —vida, golpe máximo,
 * habilidades— y no las resistencias, que se han medido y apenas se distinguen.
 */
function diffBlocks(f) {
  const ds = (f.dificultades ?? []).filter((d) => d.fights > 0);
  if (ds.length < 2) return '';
  const nombre = (d) => (d.diff === null ? t('foe.noDiff') : `D${d.diff}${d.tag ? ' ' + d.tag : ''}`);
  return `<div class="dos-block">
    <div class="eyebrow">${esc(t('foe.byDiff'))} · ${esc(t('foe.measured'))}</div>
    <div class="hint">${esc(t('foe.diffNote'))}</div>
    <div class="difgrid">
      ${ds.map((d) => `<div class="difcard">
        <div class="difcard-h">${esc(nombre(d))}</div>
        <div class="difcard-kv">
          <span><b>${d.fights}</b> ${esc(t('sum.fights', { n: d.fights }))}</span>
          ${d.kills ? `<span><b>${d.kills}</b> ${esc(t('metric.kills', { n: d.kills }))}</span>` : ''}
          ${d.hp ? `<span>${esc(t('foe.hp'))} <b>${n0(d.hp.avg)}</b>${
            d.hp.n > 1 ? ` <span class="dim">${n0(d.hp.min)}–${n0(d.hp.max)}</span>` : ''}</span>`
            : `<span class="dim">${esc(t('foe.hp'))} —</span>`}
          <span>${esc(t('foe.maxHit'))} <b>${n0(d.maxHit)}</b></span>
          <span>${esc(t('foe.dealtYou'))} <b>${n0(d.taken)}</b></span>
        </div>
        <div class="difcard-cast">${esc(t('foe.castIn', { n: d.fights }))}</div>
        <div class="difcard-ab">${(d.abilities ?? []).slice(0, 8).map((x) =>
          `<span title="${esc(t('foe.inFights', { n: x.inFights, total: d.fights }))}"><i class="seg ${typeClass(x.type)}"></i>${
            esc(x.name)} <b>${n0(x.sum)}</b>${d.fights > 1
              ? ` <span class="dim">${x.inFights}/${d.fights}</span>` : ''}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="hint">${esc(t('foe.castNote'))}</div>
  </div>`;
}

function foeDossier(a) {
  const f = a.foes.find((x) => x.name.toLowerCase().includes(state.filter.foe.toLowerCase()))
    ?? a.foes[0];
  if (!f) return '';
  if (!mobCache.has(f.name)) loadMob(f.name);
  const mob = mobCache.get(f.name);
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const spells = (f.spells ?? []).filter((x) => x.landed + x.resisted >= 2);
  const abTot = (f.abilities ?? []).reduce((n, x) => n + x.sum, 0) || 1;

  return `<div class="dossier">
    <div class="dos-head">
      <h3>${esc(f.name)}</h3>
      ${mob ? `<button class="lnk" id="dosWiki">${esc(t('foe.seeWiki'))}</button>` : ''}
    </div>
    <div class="metrics">
      ${f.hp ? card(n0(f.hp.avg), t('foe.hp')) : ''}
      ${card(f.fights, t('sum.fights', { n: f.fights }))}
      ${f.kills ? card(f.kills, t('metric.kills', { n: f.kills })) : ''}
      ${card(n0(f.damageTo), t('foe.youDealt'))}
      ${card(n0(f.taken), t('foe.dealtYou'), 'foe')}
      ${f.maxHit ? card(n0(f.maxHit), t('foe.maxHit'), 'foe') : ''}
      ${card(n0(f.dps), 'dps')}
    </div>
    ${f.hp ? `<div class="hint">${esc(t('foe.hpNote'))} ${esc(t('foe.hpFrom', { n: f.hp.n }))}: ${
      n0(f.hp.min)} – ${n0(f.hp.max)}</div>` : ''}

    ${diffBlocks(f)}

    ${spells.length ? `<div class="dos-block"><div class="eyebrow">${esc(t('foe.weak'))} · ${esc(t('foe.measured'))}</div>
      ${(f.dificultades ?? []).length > 1 ? `<div class="hint">${esc(t('foe.resistNote'))}</div>` : ''}
      ${(f.levels ?? []).length > 1 || (f.levels ?? []).length && f.someWithoutLevel
        ? `<div class="hint">${esc(t('lvl.mixed', {
            levels: [...(f.levels ?? []), ...(f.someWithoutLevel ? [t('lvl.unknown')] : [])].join(', ') }))}</div>`
        : ''}
      ${spells.map((x) => `<div class="foe-det-l">
        <span>${esc(x.spell)}</span>
        <b class="${x.rate >= 0.6 ? 'bad' : x.rate <= 0.2 ? 'good' : ''}">${Math.round((1 - x.rate) * 100)}%</b>
        <span class="dim">${esc(t('foe.lands'))} · ${x.landed}/${x.landed + x.resisted}</span>
      </div>
      ${(x.byInv ?? []).map((b) => `<div class="foe-det-l sub">
        <span>${esc(b.inv ? t('foe.withInv', { inv: b.inv }) : t('foe.noInv'))}</span>
        <b class="${b.rate >= 0.6 ? 'bad' : b.rate <= 0.2 ? 'good' : ''}">${Math.round((1 - b.rate) * 100)}%</b>
        <span class="dim">${b.landed}/${b.landed + b.resisted}</span>
      </div>`).join('')}`).join('')}</div>` : ''}

    ${mob ? `<div class="dos-block"><div class="eyebrow">${esc(t('foe.wiki'))}</div>
      ${mob.lines.map((l) => `<div class="fw-line">${esc(l)}</div>`).join('')}</div>` : ''}

    ${f.abilities?.length ? `<div class="dos-block"><div class="eyebrow">${esc(t('foe.howHits'))}</div>
      ${f.abilities.map((x) => `<div class="foe-det-l">
        <i class="seg ${typeClass(x.type)}"></i><span>${esc(x.name)}</span>
        <b>${n0(x.sum)}</b><span class="dim">${Math.round(x.sum / abTot * 100)}% · ×${x.n}</span>
      </div>`).join('')}</div>` : ''}

    ${f.lootList?.length ? `<div class="dos-block"><div class="eyebrow">${esc(t('foe.drops'))}</div>
      <div class="loot">${f.lootList.map((l) => `<div class="loot-row">
        <button class="loot-item" data-item="${esc(l.item)}">${esc(l.item)}</button>
        ${l.n > 1 ? `<span class="num dim">×${l.n}</span>` : ''}</div>`).join('')}</div></div>` : ''}

    ${f.zones?.length ? `<div class="hint">${esc(t('foe.zones'))}: ${esc(f.zones.join(', '))}</div>` : ''}
  </div>`;
}

function sumRow(r, maxDmg) {
  const tot = r.types.reduce((x, [, v]) => x + v, 0) || 1;
  const open = state.openSumRows.has(r.name);
  return `<div class="sum-row ${open ? 'open' : ''}" data-row="${esc(r.name)}">
    <div class="sum-top">
      <span class="sum-name">${esc(r.name)}${
        r.petOf ? ` <span class="dim">(${esc(t('row.petOf', { who: r.petOf }))})</span>` : ''}</span>

      <span class="num strong">${n0(r.damage)}</span>
      <span class="num dim">${Math.round(r.share * 100)}%</span>
      ${r.accuracy !== null ? `<span class="num dim">${Math.round(r.accuracy * 100)}%</span>` : ''}
      ${r.crits ? `<span class="num dim">${r.crits} crit</span>` : ''}
      ${r.deaths ? `<span class="num foe">${r.deaths}†</span>` : ''}
    </div>
    <div class="bar-track"><div class="bar" style="width:${(r.damage / maxDmg * 100).toFixed(1)}%">${
      r.types.map(([ty, v]) => `<div class="seg ${typeClass(ty)}" style="width:${(v / tot * 100).toFixed(2)}%"></div>`).join('')
    }</div></div>
    <div class="sum-ab">${r.abilities.slice(0, 8).map((x) => `<span><i class="seg ${typeClass(x.type)}"></i>${
      esc(x.name)} <b>${n0(x.sum)}</b></span>`).join('')}</div>
    ${open ? sumRowDetail(r) : ''}
  </div>`;
}

/** Desglose completo de un combatiente sumando todas las peleas del tramo. */
function sumRowDetail(r) {
  const tbl = (title, rows, base) => rows.length ? `<div class="sd-block">
      <div class="eyebrow">${esc(title)}</div>
      ${rows.map(([name, val, extra, ty]) => `<div class="sd-l">
        ${ty !== undefined ? `<i class="seg ${typeClass(ty)}"></i>` : ''}
        <span>${esc(name)}</span>
        <b>${n0(val)}</b>
        <span class="dim">${base ? Math.round(val / base * 100) + '%' : ''}</span>
        <span class="dim">${extra ?? ''}</span>
      </div>`).join('')}
    </div>` : '';

  const dmg = r.damage || 1;
  return `<div class="sum-det">
    <div class="sd-kv">
      ${r.hits ? `<span>${esc(t('row.hits'))} <b>${n0(r.hits)}</b></span>` : ''}
      ${r.accuracy !== null ? `<span>${esc(t('row.accuracy'))} <b>${Math.round(r.accuracy * 100)}%</b></span>` : ''}
      ${r.crits ? `<span>${esc(t('row.crits'))} <b>${r.crits}</b></span>` : ''}
      ${r.flurries ? `<span>${esc(t('row.flurries'))} <b>${r.flurries}</b></span>` : ''}
      ${r.ripostes ? `<span>${esc(t('row.ripostes'))} <b>${r.ripostes}</b></span>` : ''}
      <span>${esc(t('row.max'))} <b>${n0(r.max)}</b></span>
      ${r.taken ? `<span>${esc(t('row.taken'))} <b>${n0(r.taken)}</b></span>` : ''}
      ${r.healingDone ? `<span>${esc(t('row.healed'))} <b>${n0(r.healingDone)}</b></span>` : ''}
      ${r.deaths ? `<span class="foe">${esc(t('metric.losses', { n: r.deaths }))} <b>${r.deaths}</b></span>` : ''}
      ${r.merged ? `<span class="dim">${esc(r.mergedFrom.join(', '))}</span>` : ''}
    </div>
    ${tbl(t('det.byAbility'), r.abilities.map((a) => [a.name, a.sum, `×${a.n}`, a.type]), dmg)}
    ${tbl(t('det.byType'), r.types.map(([ty, v]) => [ty, v, '', ty]), dmg)}
    ${tbl(t('det.byTarget'), (r.targets ?? []).map((x) => [x.name, x.sum, '']), dmg)}
    ${tbl(t('det.takenBy'), (r.takenBySource ?? []).map((x) => [x.name, x.sum, '']), r.taken || 1)}
  </div>`;
}

// ═══════════ Catálogo de hechizos ═══════════
/**
 * Marcas de fiabilidad, las tres que acordamos:
 *   medido     sale de tus peleas
 *   consultado sale de la wiki  (va en su propio bloque, nunca en la misma tabla)
 *   estimado   sale de tus peleas pero con poca muestra: cursiva, tilde y de
 *              dónde sale al pasar el ratón
 * Y por debajo del mínimo no se enseña el número: se explica qué falta. Un
 * hueco explicado informa; un número con un 65% de error desinforma.
 */
const MIN_USOS = 8;
const est = (valor, desde) =>
  `<i class="est" title="${esc(desde)}">~${valor}</i>`;
const hueco = (need, have) =>
  `<span class="gap" title="${esc(t('est.needMore', { need, have }))}">—</span>`;

function renderCatalog() {
  const c = state.catalog;
  const host = $('bodyGrid');
  if (!c) { host.innerHTML = `<div class="empty"><h2>${esc(t('cat.title'))}</h2>
    <button id="catBack">${esc(t('sum.back'))}</button></div>`;
    $('catBack').addEventListener('click', () => { state.view = 'combat'; host.innerHTML = ''; renderApp(); });
    return; }

  // Sólo se enseña «efectivo» si aporta algo: mientras todo entre al 100% es
  // una columna que repite a la de al lado.
  const hayResistencias = c.spells.some((s) => s.landRate !== null && s.landRate < 0.995);

  const fila = (s) => {
    const pocos = s.uses < MIN_USOS;
    const desde = t('est.from', { fights: s.fights, secs: s.uses });
    const medio = pocos ? est(n0(s.avg), desde) : `<b>${n0(s.avg)}</b>`;
    return `<div class="cat-row">
      <span class="cat-name">${esc(s.name)}${s.unresistable
        ? ` <span class="tagx" title="${esc(t('cat.unresistable'))}">∅</span>` : ''}</span>
      <span><i class="seg ${typeClass(s.types[0])}"></i>${esc(s.types[0] ?? '—')}</span>
      <span class="num">${n0(s.uses)}</span>
      <span class="num">${medio}</span>
      <span class="num dim">${n0(s.min)}–${n0(s.max)}</span>
      <span class="num">${s.crits ? `${s.crits} · ${pct(s.critRate)}` : '—'}</span>
      <span class="num">${s.landRate === null ? '—'
        : (s.landed + s.resisted) < 4 ? hueco(4, s.landed + s.resisted)
          : `${Math.round(s.landRate * 100)}%`}</span>
      ${hayResistencias ? `<span class="num">${s.effective === null ? '—' : n0(s.effective)}</span>` : ''}
      <span class="num dim">${s.cooldown ? secs(s.cooldown) : '—'}</span>
    </div>`;
  };

  const cds = (c.cooldowns ?? []).filter((x) => x.seconds > 0);
  host.innerHTML = `<div class="summary" id="catRoot">
    <div class="sum-head">
      <h2>${esc(t('cat.title'))}</h2>
      <button id="catBack">${esc(t('sum.back'))}</button>
    </div>
    <div class="hint">${esc(t('cat.note'))}</div>

    <div class="cat-head">
      <span>${esc(t('cat.spell'))}</span><span>${esc(t('cat.type'))}</span>
      <span class="r">${esc(t('cat.uses'))}</span><span class="r">${esc(t('cat.avg'))}</span>
      <span class="r">${esc(t('cat.range'))}</span><span class="r">${esc(t('cat.crit'))}</span>
      <span class="r">${esc(t('cat.lands'))}</span>
      ${hayResistencias ? `<span class="r">${esc(t('det.dmg'))}</span>` : ''}
      <span class="r">${esc(t('cat.cooldown'))}</span>
    </div>
    ${c.spells.map(fila).join('')}

    ${(c.marks ?? []).length ? `
      <div class="sec-title eyebrow" style="margin-top:22px">${esc(t('marks.title'))}</div>
      <div class="hint">${esc(t('marks.note'))}</div>
      ${c.marks.map((g) => `<div class="marks">
        <div class="marks-h">
          <span>${g.level === null ? esc(t('lvl.unknown')) : esc(t('lvl.level', { n: g.level }))}</span>
          <span class="dim">${g.fights} ${esc(t('sum.fights', { n: g.fights }))}</span>
          <span class="num">${esc(t('marks.best'))} <b>${n0(g.best)}</b> dps</span>
          <span class="num dim">${esc(t('marks.median'))} ${n0(g.median)}</span>
        </div>
        ${g.level === null ? `<div class="hint">${esc(t('lvl.unknownNote'))}</div>` : ''}
        ${g.top.map((x) => `<div class="foe-det-l">
          <b>${n0(x.dps)}</b>
          <span class="dim">${secs(x.duration)}</span>
          <span>${esc(x.label ?? t('fight.skirmish'))}</span>
          <span class="dim">${esc(x.zone ?? '')}${x.diff !== null ? ` · D${x.diff}` : ''}</span>
        </div>`).join('')}
      </div>`).join('')}` : ''}

    ${cds.length ? `<div class="sec-title eyebrow" style="margin-top:22px">${esc(t('cat.cdTitle'))}</div>
      <div class="hint">${esc(t('cat.cdNote'))}</div>
      ${cds.map((x) => `<div class="foe-det-l">
        <span>${esc(x.name)}</span>
        <b>${secs(x.seconds)}</b>
        <span class="dim">${x.attempts} ${esc(t('cat.cdAttempts'))}${
          x.source === 'una sola muestra' ? ` · ${esc(t('cat.oneSample'))}` : ''}</span>
        <span class="${x.countable ? 'dim' : 'gap'}" ${x.countable ? '' : `title="${esc(t('cat.notCountable'))}"`}>${
          x.countable ? `${n0(x.uses)} ${esc(t('cat.cdUses'))}` : esc(t('cat.notCountable'))}</span>
      </div>`).join('')}` : ''}
  </div>`;
  $('catBack').addEventListener('click', () => { state.view = 'combat'; host.innerHTML = ''; renderApp(); });
}

/** Quién le hizo qué a ese enemigo, sacado del reparto por objetivo. */
const mobCache = new Map();

/** Pide a la wiki las notas del bicho y repinta cuando llegan. */
async function loadMob(name) {
  if (mobCache.has(name)) return;
  mobCache.set(name, null);
  try {
    const d = await window.eql.wikiMob?.(name);
    mobCache.set(name, d ?? null);
    if (d && state.view === 'summary') renderSummary();
  } catch { /* sin red */ }
}

function foeDetail(a, f) {
  const who = a.rows.filter((r) => r.side !== 'enemy')
    .map((r) => ({ name: r.name, sum: (r.targets ?? []).find((tg) => tg.name === f.name)?.sum ?? 0 }))
    .filter((x) => x.sum > 0).sort((x, y) => y.sum - x.sum);
  const base = who.reduce((x, y) => x + y.sum, 0) || 1;
  if (!mobCache.has(f.name)) loadMob(f.name);
  const mob = mobCache.get(f.name);

  const spells = (f.spells ?? []).filter((x) => x.landed + x.resisted >= 2);
  const weak = spells.length || mob ? `<div class="foe-weak">
      <div class="eyebrow">${esc(t('foe.weak'))}</div>
      ${spells.length ? `<div class="fw-sub">${esc(t('foe.measured'))}</div>
        ${spells.map((x) => `<div class="foe-det-l">
          <span>${esc(x.spell)}</span>
          <b class="${x.rate >= 0.6 ? 'bad' : x.rate <= 0.2 ? 'good' : ''}">${
            Math.round((1 - x.rate) * 100)}%</b>
          <span class="dim">${esc(t('foe.lands'))} · ${x.landed}/${x.landed + x.resisted}</span>
        </div>`).join('')}` : ''}
      ${mob ? `<div class="fw-sub">${esc(t('foe.wiki'))}</div>
        ${mob.lines.map((l) => `<div class="fw-line">${esc(l)}</div>`).join('')}` : ''}
    </div>` : '';

  return `<div class="foe-det">${who.map((w) => `<div class="foe-det-l">
      <span>${esc(w.name)}</span><b>${n0(w.sum)}</b>
      <span class="dim">${Math.round(w.sum / base * 100)}%</span>
    </div>`).join('')}${weak}</div>`;
}

function renderApp() {
  if (state.view === 'catalog') {
    // Misma guarda que el resumen: es una vista con su propio scroll y el
    // snapshot de 250 ms la reconstruiría entera.
    if (!$('catRoot')) renderCatalog();
    return;
  }
  if (state.view === 'summary') {
    // Sólo se monta una vez. Sin esta guarda el snapshot de 250 ms reconstruye
    // la vista entera y el scroll vuelve arriba en cuanto lo mueves.
    if (!$('sumRoot')) renderSummary();
    return;
  }
  if (state.wizard) {
    // Sin esta guarda el snapshot de 250 ms reconstruiría la tarjeta entera y
    // ningún botón llegaría a recibir el clic. La navegación repinta a mano.
    if (!$('wzCard') && !state.wzMounting) {
      state.wzMounting = true;
      renderWizard().finally(() => { state.wzMounting = false; });
    } else if (state.wizard.step === 4) {
      wizardWhoUpdate(state.snap);
    }
    return;
  }
  if (state.view === 'analysis') {
    if (!$('anView')) $('bodyGrid').innerHTML = '<aside id="fightList"></aside><main id="anView"></main>';
    renderFightList(state.snap);
    renderAnalysis(state.snap);
    return;
  }
  if (state.view === 'triggers') {
    if (!$('narrateBox')) {
      $('bodyGrid').innerHTML = '<div class="tabpane"><div id="narrateBox"></div><div id="trigBox"></div></div>';
      renderNarrate($('narrateBox'));
      renderTriggers($('trigBox'));
    }
    return;
  }
  if (state.setup || !state.snap?.path) {
    // Sin esta guarda el snapshot de 250 ms reconstruiría el formulario
    // en cada refresco y sería imposible escribir en él.
    if (!document.getElementById('inPath') && !state.mountingSetup) {
      state.mountingSetup = true;
      renderSetup().finally(() => { state.mountingSetup = false; });
    }
    return;
  }
  if (!$('rows')) {
    $('bodyGrid').innerHTML = `<aside id="fightList"></aside>
      <main><div id="timers"></div><div id="fightHead"></div><div id="clsPrompt"></div><div id="petHint"></div><div id="advice"></div><div id="rows"></div>
      <div class="legend eyebrow">${TYPES.map((t) => `<span><i class="seg ${t}"></i>${t}</span>`).join('')}</div></main>`;
    state.rowNodes.clear();
  }
  renderFightList(state.snap);
  renderTimers(state.snap);
  renderHead(state.snap);
  renderPetHint(state.snap);

  renderClassPrompt(state.snap);
  renderAdvice(state.snap);
  renderRows(state.snap);
}

function renderChrome(snap) {
  $('dot').className = `dot ${snap.status}`;
  $('statusText').textContent = snap.error ?? t(`status.${snap.status}`);
  $('mChar').textContent = snap.self ?? '—';
  $('mZone').textContent = snap.zone ?? '—';
  const post = [snap.stance, snap.invocation].filter(Boolean).join(' · ');
  const el = $('mStance'); if (el) el.textContent = post || '—';
  $('fParsed').textContent = n0(snap.parsed);
  $('fUnknown').textContent = n0(snap.unknown);
  const fp = $('fPets');
  const sig = `${snap.pets.join(',')}|${(snap.allPets ?? []).length}|${state.cfg.mergePets ? 1 : 0}|${getLang()}`;
  if (snap.pets.length && fp.dataset.sig !== sig) {
    fp.dataset.sig = sig;
    fp.innerHTML = `${t('foot.pets')} <b class="num">${snap.pets.map(esc).join(', ')}</b>
      <label class="chk mini" title="${esc(t('pets.mergeHint'))}"><input type="checkbox" id="fMerge"${
        state.cfg.mergePets ? ' checked' : ''}> ${esc(t('pets.merge'))}${
        (snap.allPets ?? []).length > snap.pets.length ? ` (${snap.allPets.length})` : ''}</label>`;
    $('fMerge').addEventListener('change', async (e) => {
      state.cfg.mergePets = e.target.checked;
      await window.eql.setMergePets(e.target.checked);
      state.rowNodes.clear();
      if ($('rows')) $('rows').innerHTML = '';
      const l = $('bodyGrid'); if (l) l.dataset.sig = '';
      state.summary = null; state.view = 'combat';
      renderApp();
    });
  } else if (!snap.pets.length) { fp.innerHTML = ''; fp.dataset.sig = ''; }
  $('fPath').textContent = snap.path ?? '';
}

/**
 * El índice se relee cuando el motor dice que ha cambiado, no cuando cambia la
 * longitud de `snap.history`.
 *
 * `history` viene recortada a 60. Con 60 peleas guardadas o más su longitud se
 * queda clavada en 60 para siempre, así que la comparación nunca volvía a ser
 * cierta: la lista dejaba de refrescarse sola y una pelea recién terminada no
 * aparecía hasta tocar el filtro o reiniciar. Se veía en directo, se cerraba y
 * desaparecía. Estaba guardada en disco desde el primer momento.
 */
let lastStoreSeq = -1;
window.eql.onSnapshot((snap) => {
  state.snap = snap;
  if (snap.storeSeq !== lastStoreSeq) { lastStoreSeq = snap.storeSeq; refreshFights(); }
  // Un fallo pintando la cabecera no debe impedir que se pinte el resto,
  // ni dejar la interfaz congelada.
  try { renderChrome(snap); } catch (err) { console.error('renderChrome:', err); }
  try { renderApp(); } catch (err) { console.error('renderApp:', err); }
});

function renderLangPicker() {
  const host = $('langPick');
  if (!host) return;
  const cur = langInfo();
  host.innerHTML = `<button class="lang-btn" id="langBtn" aria-haspopup="listbox"
      aria-expanded="false" title="${esc(t('voice.language'))}">
      <span class="flag">${cur.flag}</span><span class="lang-name">${esc(cur.name)}</span>
      <span class="caret">▾</span></button>
    <div class="lang-menu" id="langMenu" role="listbox" hidden>${LANGS.map((l) => `
      <button class="lang-item ${l.code === cur.code ? 'on' : ''}" data-code="${l.code}" role="option">
        <span class="flag">${l.flag}</span><span>${esc(l.name)}</span>
        ${TRANSLATED.includes(l.code) ? '' : '<span class="soon">EN</span>'}
      </button>`).join('')}</div>`;

  const btn = $('langBtn'), menu = $('langMenu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', close);
  menu.querySelectorAll('.lang-item').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();
    const code = el.dataset.code;
    setLang(code);
    await window.eql.setLang(code);
    close();
    applyLangToChrome();
    state.rowNodes.clear();
    ['fightHead', 'advice', 'petHint', 'clsPrompt', 'fightList'].forEach((id) => { const n = $(id); if (n) n.dataset.sig = ''; });
    if ($('rows')) $('rows').innerHTML = '';
    if (state.view === 'triggers') $('bodyGrid').innerHTML = '';
    renderLangPicker();
    renderApp();
  }));
}

/** Textos fijos del marco que no pasan por renderApp. */
function applyLangToChrome() {
  const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
  set('tabCombat', t('tab.combat'));
  set('tabTriggers', t('tab.alerts'));
  set('lblChar', t('hdr.character'));
  set('lblZone', t('hdr.zone'));
  set('lblStance', t('hdr.stance'));
  set('lblLines', t('foot.lines'));
  set('lblUnknown', t('foot.unknown'));
  set('btnOverlay', t('hdr.overlay'));
  set('btnSetup', t('hdr.changeLog'));
  const h = $('btnHelp'); if (h) h.title = t('wz.reopen');
  set('brandTag', t('app.tagline'));
  const fp = $('fPath'); if (fp) fp.title = t('foot.openFolder');
  const b = $('btnTheme');
  if (b) b.textContent = state.theme === 'light' ? `◐ ${t('hdr.themeDark')}` : `◑ ${t('hdr.themeLight')}`;
}

function applyTheme(t2) {
  state.theme = t2;
  document.documentElement.dataset.theme = t2;
  const b = $('btnTheme');
  if (b) b.textContent = t2 === 'light' ? `◐ ${t('hdr.themeDark')}` : `◑ ${t('hdr.themeLight')}`;
}

$('btnTheme')?.addEventListener('click', async () => {
  const t = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(t);
  await window.eql.setTheme(t);
});

$('btnOverlay').addEventListener('click', async () => {
  window.eql.openOverlay();
  // Una sola vez: el tirón del juego al usar el overlay casi siempre es este
  // ajuste, y nadie lo relaciona por su cuenta.
  if (state.cfg.fpsWarned) return;
  state.cfg.fpsWarned = true;
  await window.eql.setFlag?.('fpsWarned', true);
  const bar = $('updBar');
  if (!bar) return;
  bar.innerHTML = `<span><b>${esc(t('ov.fpsTitle'))}.</b> ${esc(t('ov.fpsBody'))}</span>
    <button id="fpsOk">${esc(t('ov.fpsOk'))}</button>`;
  bar.style.display = 'flex';
  $('fpsOk').addEventListener('click', () => { bar.style.display = 'none'; });
});
$('btnSetup').addEventListener('click', () => {
  state.setup = true;
  $('bodyGrid').innerHTML = '';   // fuerza el repintado del formulario
  renderApp();
});
$('fPath').addEventListener('click', () => window.eql.reveal(state.snap?.path));

/** Reabre la introducción conservando lo ya configurado. */
function openWizard() {
  state.wizard = {
    step: 1,
    classes: [...(state.snap?.classes ?? []), '', '', ''].slice(0, 3),
    logPath: state.snap?.path ?? '',
    attached: !!state.snap?.path,   // ya está conectado: no reconectar
    fromStart: false,
  };
  state.view = 'combat';
  $('bodyGrid').innerHTML = '';
  renderApp();
}

$('btnHelp')?.addEventListener('click', openWizard);
$('btnSetup').addEventListener('contextmenu', (e) => { e.preventDefault(); openWizard(); });

// ═══════════ Avisos ═══════════
const showBanner = mountBanner();
window.eql.onAlert((a) => {
  if (a.speak) speak(a.speak, { ...(state.cfg.tts ?? {}), speech: langInfo().speech,
    queue: a.queue, priority: a.priority });
  if (a.sound && state.cfg.sound?.enabled !== false) playSound(a.sound, state.cfg.sound?.volume ?? 0.5);
  showBanner(a);
});

function setView(v) {
  state.view = v;
  $('tabCombat').classList.toggle('active', v === 'combat');
  $('tabTriggers').classList.toggle('active', v === 'triggers');
  $('bodyGrid').innerHTML = '';
  state.rowNodes.clear();
  renderApp();
}
$('tabCombat').addEventListener('click', () => setView('combat'));
$('tabTriggers').addEventListener('click', async () => { await initTriggers(); setView('triggers'); });

window.eql.onLang((c) => { setLang(c); applyLangToChrome(); renderLangPicker(); });

/**
 * Aviso de que has tocado la tabla de tríos y el histórico no lo sabe.
 *
 * Cambiar la tabla sólo afecta a lo que venga a partir de ahora: las peleas
 * guardadas conservan el nivel con el que se cerraron. Decirlo importa porque
 * el fallo es silencioso — los números siguen ahí, con el mismo aspecto de
 * siempre, sólo que con el nivel de antes.
 */
function showTrioRebuild() {
  if (!state.needsRebuild) return;
  const bar = $('migBar');
  if (!bar) return;
  bar.innerHTML = `<div class="mig-h">${esc(t('trio.title'))}</div>
    <p>${esc(t('trio.rebuild'))}</p>
    <div class="mig-btns">
      <button class="primary" id="trioGo">${esc(t('mig.button'))}</button>
      <button id="trioLater">${esc(t('mig.later'))}</button>
    </div>`;
  bar.style.display = 'block';
  $('trioLater').addEventListener('click', () => {
    state.needsRebuild = false;
    bar.style.display = 'none';
    bar.innerHTML = '';
  });
  $('trioGo').addEventListener('click', async () => {
    const b = $('trioGo');
    b.disabled = true;
    b.textContent = t('mig.working');
    $('trioLater').disabled = true;
    const r = await window.eql.rebuildStore().catch(() => null);
    state.needsRebuild = false;
    bar.style.display = 'none';
    bar.innerHTML = '';
    if (r?.ok) { state.summary = null; state.rowNodes.clear(); renderApp(); }
  });
}

/**
 * Aviso de que el histórico se guardó con cifras incorrectas.
 *
 * Va dentro de la aplicación y no en las notas de la versión porque quien
 * tiene la 1.0.7 instalada no lee las notas: abre el programa, ve unos números
 * y se los cree. Y son incorrectos de una forma que no se nota mirándolos.
 */
async function showMigration() {
  const m = await window.eql.migration?.().catch(() => null);
  if (!m?.needed) return;
  const bar = $('migBar');
  if (!bar) return;

  const pintar = (html) => { bar.innerHTML = html; bar.style.display = 'block'; };
  const cerrar = () => { bar.style.display = 'none'; bar.innerHTML = ''; };

  pintar(`<div class="mig-h">${esc(t('mig.title'))}</div>
    <p>${esc(t('mig.body', { n: m.fights }))}</p>
    <p class="mig-fix">${esc(t('mig.fix'))}</p>
    <div class="mig-btns">
      <button class="primary" id="migGo">${esc(t('mig.button'))}</button>
      <button id="migLater">${esc(t('mig.later'))}</button>
    </div>`);

  $('migLater').addEventListener('click', cerrar);
  $('migGo').addEventListener('click', async () => {
    const b = $('migGo');
    b.disabled = true;
    b.textContent = t('mig.working');
    $('migLater').disabled = true;
    const r = await window.eql.rebuildStore().catch((err) => ({ ok: false, reason: 'error-de-lectura', error: err.message }));
    if (r?.ok) {
      pintar(`<div class="mig-h">${esc(t('mig.doneTitle'))}</div>
        <p>${esc(t('mig.done', { fights: n0(r.peleasDespues), kills: n0(r.abatidos),
          lines: n0(r.lineas), secs: r.segundos.toFixed(1), backup: (r.copias ?? []).join(', ') }))}</p>
        <div class="mig-btns"><button id="migOk">${esc(t('mig.later'))}</button></div>`);
      $('migOk').addEventListener('click', cerrar);
      // El histórico es otro: se descarta lo que la interfaz tuviera en memoria.
      state.fightCache.clear();
      state.summary = null;
      state.selectedFight = 'live';
      lastStoreSeq = -1;
      refreshFights();
    } else {
      const motivo = t(`mig.fail.${r?.reason ?? 'error-de-lectura'}`);
      pintar(`<div class="mig-h bad">${esc(t('mig.failTitle'))}</div>
        <p>${esc(motivo)}</p>
        <div class="mig-btns">
          <button class="primary" id="migRetry">${esc(t('mig.button'))}</button>
          <button id="migOk">${esc(t('mig.later'))}</button>
        </div>`);
      $('migOk').addEventListener('click', cerrar);
      $('migRetry').addEventListener('click', () => showMigration());
    }
  });
}

/** Aviso de versión nueva. Sólo informa: la descarga la decides tú. */
function showUpdate(u) {
  const bar = $('updBar');
  if (!bar || !u) return;
  bar.innerHTML = `<span>${esc(t('upd.title', { v: u.version }))}</span>
    <button class="primary" id="updGet">${esc(t('upd.get'))}</button>
    <button id="updSkip">${esc(t('upd.skip'))}</button>`;
  bar.style.display = 'flex';
  $('updGet').addEventListener('click', () => window.eql.openUpdate());
  $('updSkip').addEventListener('click', () => {
    window.eql.skipUpdate(u.version);
    bar.style.display = 'none';
  });
}

window.eql.onUpdate?.(showUpdate);
window.eql.getUpdate?.().then((u) => { if (u) showUpdate(u); }).catch(() => {});

window.eql.getConfig().then((c) => {
  state.cfg = c;
  setLang(c.lang ?? 'es');
  if (!c.onboarded) state.wizard = { step: 1, classes: ['', '', ''], fromStart: false };
  applyTheme(c.theme ?? 'dark');
  renderLangPicker();
  applyLangToChrome();
  refreshFights();
  if (!c.logPath) renderApp();
  // Después del asistente: al primer arranque no hay histórico que corregir.
  if (c.onboarded) showMigration();
});
