import { t, setLang, LANGS, langInfo, TRANSLATED } from '../src/i18n.js';
import { analyse } from '../src/analysis.js';
import { initTriggers, renderTriggers } from './triggers.js';
import { mountBanner, speak, playSound } from './alerts.js';

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
  detailStamp: new Map(),
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
        CLASS_LIST.map(([k, v]) => `<option value="${k}"${(w.classes?.[i] ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')
      }</select>`).join('')}</div>
      <p class="hint">${esc(t('wz.4.who'))}</p>
      <div class="wz-who" id="wzWho">${esc(t('wz.4.waiting'))}</div>`,

    5: () => `<h1>${esc(t('wz.5.title'))}</h1>
      <p>${esc(t('wz.5.body'))}</p>
      <div class="sec-title eyebrow">${esc(t('wz.5.cmd'))}</div>
      <div class="wz-cmd">/pet who leader</div>
      <p>${esc(t('wz.5.body2'))}</p>`,

    6: () => `<h1>${esc(t('wz.6.title'))}</h1>
      <p>${esc(t('wz.6.body'))}</p>
      <div class="tbl wz-keys" style="grid-template-columns:130px 1fr">
        <div class="th eyebrow">Ctrl+Alt+M</div><div class="td">${esc(t('hdr.overlay'))}</div>
        <div class="th eyebrow">Ctrl+Alt+O</div><div class="td">${esc(t('ov.passThrough'))}</div>
        <div class="th eyebrow">Ctrl+Alt+X</div><div class="td">${esc(t('ov.close'))}</div>
      </div>
      <div class="wz-warn"><p>${esc(t('wz.6.fullscreen'))}</p></div>
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
    <p>Activa el registro en el juego con <code>/log on</code> y pon los filtros de daño al máximo
       detalle, o el daño de los demás no llegará al fichero.</p>
    ${cands.length ? `<div class="field"><label class="eyebrow">${t('setup.found')}</label>
      <div class="candidates">${cands.map((c) => `<div class="cand" data-path="${esc(c.path)}">${esc(c.path)}
        <small>${new Date(c.mtime).toLocaleString('es-ES')}</small></div>`).join('')}</div></div>`
      : '<p class="hint">No he encontrado ningún <code>eqlog_*.txt</code> en las rutas habituales. Búscalo a mano.</p>'}
    <div class="field"><label class="eyebrow">${t('setup.path')}</label>
      <input class="wide" id="inPath" value="${esc(cfg.logPath ?? '')}" placeholder="D:\\EVERQUEST LEGENDS\\Logs\\eqlog_...txt"></div>
    <div class="field"><label class="eyebrow">Tu personaje <span class="hint">(vacío = deducir del fichero)</span></label>
      <input id="inSelf" value="${esc(cfg.self ?? '')}" placeholder="Campeon"></div>
    <div class="field"><label class="eyebrow">${t('setup.idle')}</label>
      <input id="inIdle" type="number" min="5" max="120" value="${cfg.idleSec ?? 20}" style="width:80px">
      <span class="hint">${t('setup.idleUnit')}</span></div>
    <div class="field"><label><input type="checkbox" id="inFromStart" ${cfg.fromStart ? 'checked' : ''}> ${t('setup.fromStart')}</label>
      <div class="hint">Recupera el historial de peleas anteriores. En logs grandes tarda unos segundos.</div></div>
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
function fightFor(snap) {
  if (state.selectedFight === 'live') {
    // Sin combate activo, abrimos la última pelea con sustancia en vez del vacío.
    return snap.current ?? snap.history.find((h) => !TRIVIAL(h)) ?? snap.history[0] ?? null;
  }
  return snap.history.find((h) => h.id === state.selectedFight) ?? snap.current;
}

const TRIVIAL = (f) => f.duration < 3 || f.total < 500;

function fightCard(f, live) {
  const active = live ? state.selectedFight === 'live' : state.selectedFight === f.id;
  return `<div class="fight ${live ? 'live' : ''} ${active ? 'active' : ''}" data-id="${f.id}" data-live="${live ? 1 : 0}">
    <div class="fight-name">${esc(f.label ?? t('fight.skirmish'))}</div>
    <div class="fight-sub">
      <span class="num strong">${n0(f.raidDps)}</span><span class="u">dps</span>
      <span class="num">${secs(f.duration)}</span>
      <span class="num dim">${n0(f.total)}</span>
    </div>
  </div>`;
}

function renderFightList(snap) {
  const all = [...(snap.current ? [{ f: snap.current, live: true }] : []),
               ...snap.history.map((f) => ({ f, live: false }))];
  const shown = state.showAll ? all : all.filter((x) => x.live || !TRIVIAL(x.f));
  const hidden = all.length - shown.length;

  const parts = [];
  let lastZone = null;
  for (const { f, live } of shown) {
    const zone = f.zone ?? t('fight.unknownZone');
    if (zone !== lastZone) {
      lastZone = zone;
      parts.push(`<div class="zone-sep eyebrow">${esc(zone)}</div>`);
    }
    parts.push(fightCard(f, live));
  }
  if (hidden > 0 || state.showAll) {
    parts.push(`<button class="showall" id="btnShowAll">${state.showAll
      ? t('fight.hideMinor') : t('fight.showMinor', { n: hidden })}</button>`);
  }

  const html = parts.join('');
  const list = $('fightList');
  if (list.dataset.sig === html) return;
  list.dataset.sig = html;
  list.innerHTML = html || `<div class="hint" style="padding:12px">${t('fight.willAppear')}</div>`;
  list.querySelectorAll('.fight').forEach((el) => el.addEventListener('click', () => {
    state.selectedFight = el.dataset.live === '1' ? 'live' : +el.dataset.id;
    state.rowNodes.clear();
    if ($('rows')) $('rows').innerHTML = '';
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
  el.addEventListener('click', () => {
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
  const sig = `${rank}|${r.damage}|${r.dps.toFixed(1)}|${r.share.toFixed(4)}|${r.hits}|${r.misses}|${r.crits}|${r.taken}|${r.healingDone}`;
  const open = state.expanded.has(r.name);
  node.el.classList.toggle('open', open);

  if (refs.sig !== sig) {
    refs.sig = sig;
    refs.rank.textContent = rank;
    node.el.classList.toggle('me', r.name === snap.self);
    refs.name.textContent = r.name;
    refs.name.className = `name ${r.name === snap.self ? 'self' : ''} ${snap.pets.includes(r.name) ? 'pet' : ''}`;
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
  const f = fightFor(snap);
  const host = $('rows');
  if (!f) { host.innerHTML = ''; state.rowNodes.clear(); return; }
  const live = !!snap.current && f.id === snap.current.id;
  const seen = new Set();

  f.rows.forEach((r, i) => {
    seen.add(r.name);
    let node = state.rowNodes.get(r.name);
    if (!node) { node = buildRow(r.name); state.rowNodes.set(r.name, node); }
    updateRow(node, r, snap, live, i + 1);
    if (host.children[i] !== node.el) host.insertBefore(node.el, host.children[i] ?? null);
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
    <div class="hint">Stances e invocaciones sólo existen en EQL. Se atribuyen a la
    postura activa en el momento del golpe; el log no informa de la de los demás.</div>`) : '';

  const swings = r.meleeHits + r.misses;
  const offence = section(t('det.offence'), `<div class="kv">
      <span>${t('det.hitsLanded')} <b>${n0(r.hits)}</b></span>
      <span>${t('det.swings')} <b>${n0(swings)}</b></span>
      <span>${t('row.accuracy')} <b>${swings ? pct(r.accuracy) : '—'}</b></span>
      <span>${t('row.crits')} <b>${r.crits ? `${r.crits} · ${pct(r.critRate)} · ${n0(r.critDamage)} daño` : '—'}</b></span>
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
    <div class="hint">El log de EQ marca la hora al segundo, así que en peleas de pocos segundos
    estas tres cifras divergen bastante. La primera es la comparable con otros parsers.</div>`);

  return `<div class="detail">${composition}${abilities}${targets}${stanceSec}${offence}${defence}${healing}${activity}</div>`;
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
      <span class="eyebrow">Daño</span><b class="num">${n0(r.damage)} · ${pct(r.share)}</b>
      ${r.meleeHits + r.misses ? `<span class="eyebrow">Precisión</span><b class="num">${pct(r.accuracy)} · ${r.meleeHits}/${r.meleeHits + r.misses}</b>` : ''}
      ${r.crits ? `<span class="eyebrow">Críticos</span><b class="num">${r.crits} · ${pct(r.critRate)}</b>` : ''}
      <span class="eyebrow">Mín–Máx</span><b class="num">${n0(r.min)}–${n0(r.max)}</b>
      ${r.taken ? `<span class="eyebrow">Recibido</span><b class="num">${n0(r.taken)}</b>` : ''}
      ${r.healingDone ? `<span class="eyebrow">Curado</span><b class="num">${n0(r.healingDone)}</b>` : ''}
    </div>
    <div class="tip-types">${r.types.map(([ty, v]) =>
      `<div class="tip-type"><i class="seg ${typeClass(ty)}"></i><span>${esc(ty)}</span><b class="num">${n0(v)}</b><span class="num dim">${pct(v / dmgTotal)}</span></div>`).join('')}</div>
    ${r.abilities.length ? `<div class="tip-abils">${r.abilities.slice(0, 4).map((a) =>
      `<div class="tip-type"><span>${esc(a.name)}</span><b class="num">${n0(a.sum)}</b><span class="num dim">×${a.n}</span></div>`).join('')}
      ${r.abilities.length > 4 ? `<div class="dim" style="font-size:10.5px">y ${r.abilities.length - 4} más</div>` : ''}</div>` : ''}
    <div class="tip-foot eyebrow">Clic para el desglose completo</div>`;
}


// ═══════════ Ajustes de voz ═══════════
const NARRATE_CHAT = ['tell','group','guild','raid','say','ooc','shout','auction','channel'].map((k) => [k, () => t(`ch.${k}`)]);
const NARRATE_CAST = ['heal','charm','mez','fear','root','summon','escape','resurrect','dispel','nuke'].map((k) => [k, () => t(`cat.${k}`)]);
const NARRATE_COMBAT = ['stance','deaths','petdeath','adds','summary','interrupt','resist','bigcrit','levelup','loot'].map((k) => [k, () => t(`cb.${k}`)]);

async function renderNarrate(host) {
  const n = await window.eql.getNarrate();
  const box = (group, key, label) => `<label class="chk">
    <input type="checkbox" data-g="${group}" data-k="${key}"${n[group]?.[key] ? ' checked' : ''}> ${esc(label)}</label>`;
  host.innerHTML = `<div class="narrate">
    <div class="sec-title eyebrow">${t('voice.readChat')}</div>
    <div class="chks">${NARRATE_CHAT.map(([k, l]) => box('chat', k, l())).join('')}</div>
    <div class="hint">Se lee «Notarino te dice que dónde vamos». Lo que escribes tú no se lee,
      ni se repite el mismo mensaje dos veces seguidas. Los mensajes largos se cortan.</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${t('voice.combat')}</div>
    <div class="chks">${NARRATE_COMBAT.map(([k, l]) => box('combat', k, l())).join('')}</div>
    <div class="hint">El chat se encola y los avisos de combate cortan: un aviso tardío no sirve.</div>

    <div class="sec-title eyebrow" style="margin-top:16px">${t('voice.enemyCasts')}</div>
    <div class="chks">${NARRATE_CAST.map(([k, l]) => box('enemyCast', k, l())).join('')}</div>
    <div class="narrate-row">
      <label class="eyebrow" style="flex:1">${t('voice.extraSpells')}
        <input id="nNukes" style="flex:1;min-width:220px" placeholder="Ice Comet, Lava Bolt"
          value="${esc((n.nukeNames ?? []).join(', '))}"></label>
    </div>
    <div class="hint">Sólo se avisa de lo que lanza un enemigo (alguien a quien pegáis tú o tu mascota),
      nunca de tus compañeros, y no se repite la misma categoría del mismo bicho en 8 segundos.</div>

    <div class="narrate-row">
      <label class="eyebrow">${t('voice.cut')}
        <input type="number" id="nMax" min="40" max="400" value="${n.maxChars}" style="width:70px" ${t('voice.chars')}</label>
      <button id="nTest">${t('voice.test')}</button>
    </div>
  </div>`;

  const save = async () => {
    const next = { ...n, chat: { ...n.chat }, combat: { ...n.combat }, enemyCast: { ...n.enemyCast } };
    host.querySelectorAll('input[type=checkbox]').forEach((el) => {
      next[el.dataset.g][el.dataset.k] = el.checked;
    });
    next.maxChars = +host.querySelector('#nMax').value || 120;
    next.nukeNames = host.querySelector('#nNukes').value.split(',').map((x) => x.trim()).filter(Boolean);
    Object.assign(n, next);
    await window.eql.setNarrate(next);
  };
  host.querySelectorAll('input').forEach((el) => el.addEventListener('change', save));
  host.querySelector('#nTest').addEventListener('click', () =>
    speak(t('say.testPhrase'), { ...(state.cfg.tts ?? {}), speech: langInfo().speech }));
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
      aria-label="Postura activa a lo largo de la pelea">${band}</svg>` : ''}
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Daño por segundo, pico ${n0(peak)}">
      <path d="${area}" fill="var(--t-cold)" opacity=".16"/>
      <path d="${line}" fill="none" stroke="var(--t-cold)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      ${taken ? `<path d="${taken}" fill="none" stroke="var(--t-ds)" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}
    </svg>
    <div class="chart-foot">
      <span class="eyebrow">pico ${n0(peak)}/s</span>
      <span class="chart-legend eyebrow">${legend}${taken ? `<span><i class="dash"></i>${t('chart.taken')}</span>` : ''}</span>
      <span class="eyebrow">${secs(dur)}</span>
    </div>
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

  host.innerHTML = `<div class="pethint">
    <div class="pethint-main">${t('pet.which')}</div>
    <div class="pethint-sub">En EQL la mascota cambia de nombre en cada invocación, así que no puedo
      darla por conocida. Escribe <code>/pet who leader</code> en el juego y se identifica sola,
      o márcala aquí.</div>
    <div class="pethint-btns">${h.candidates.map((c) =>
      `<button class="petbtn" data-name="${esc(c)}">${t('pet.mark', { name: esc(c) })}</button>`).join('')}</div>
  </div>`;
  host.querySelectorAll('.petbtn').forEach((el) => el.addEventListener('click', async () => {
    await window.eql.markPet(el.dataset.name, true);
    host.dataset.sig = '';
  }));
}

// ═══════════ Consejo de postura ═══════════
const CLASS_LIST = [['','—'],['BER','Berserker'],['BRD','Bardo'],['BST','Beastlord'],['CLR','Clérigo'],
  ['DRU','Druida'],['ENC','Encantador'],['MAG','Mago'],['MNK','Monje'],['NEC','Nigromante'],
  ['PAL','Paladín'],['RNG','Explorador'],['ROG','Pícaro'],['SHD','Shadow Knight'],['SHM','Chamán'],
  ['WAR','Guerrero'],['WIZ','Brujo']];
const CLASS_NAMES = Object.fromEntries(CLASS_LIST.filter(([k]) => k).map(([k, v]) => [k, v]));

function renderAdvice(snap) {
  const host = $('advice');
  if (!host) return;
  const a = snap.advice;
  const classes = a?.classes ?? snap.classes ?? [];
  const live = snap.live;
  const conflict = snap.classConflict && state.dismissedConflict !== JSON.stringify(snap.classConflict)
    ? snap.classConflict : null;
  const sig = JSON.stringify([a?.incoming, a?.current, a?.defence.map((d) => d.prevented), classes,
    conflict, live && [live.kind, live.bestKey, live.suggest]]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  const sel = (i) => `<select class="cls" data-i="${i}">${CLASS_LIST.map(([k, v]) =>
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
      </div>
      <div class="adv-verdict">${t('adv.needClasses')}</div>
      <div class="hint">Sin ellas no puedo aconsejarte, porque cada clase tiene unas posturas y no otras.
      Deducirlas del log no siempre es posible: Shadow Knight y Paladín comparten Defensive, Mage Hunter y
      Spellblade, así que son indistinguibles por las posturas. También se leen solas de tu <code>/who</code>.</div>
    </div>`;
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
      <div class="live-sub">últimos ${live.seconds}s · daño ${esc(live.kind)}
        (${Math.round(live.meleeShare * 100)}% melé) · ${n0(live.dps)}/s entrante</div>
    </div>` : '';

  const mix = a.incoming.meleeShare;
  const kind = a.incoming.total === 0 ? '—' : mix > 0.7 ? 'casi todo melé' : mix < 0.3 ? 'casi todo mágico' : 'mixto';

  host.innerHTML = `<div class="advice">
    <div class="adv-head">
      <span class="eyebrow">${t('adv.title')}</span>
      <span class="src eyebrow">${{ manual: 'clases fijadas por ti', who: 'clases leídas de tu /who',
        deducidas: 'clases deducidas del log', parciales: 'clases deducidas a medias', desconocidas: '' }[snap.classSource] ?? ''}</span>
      <span class="adv-classes">${sel(0)}${sel(1)}${sel(2)}</span>
    </div>
    ${conflictBox}
    ${liveBox}
    ${a.incoming.total ? `
      <div class="adv-verdict">${esc(a.verdict ?? '')}</div>
      <div class="kv">
        <span>Daño entrante (bruto) <b>${n0(a.incoming.total)}</b></span>
        <span>Reparto <b>${kind}</b></span>
        <span>Melé <b>${n0(a.incoming.melee)}</b></span>
        <span>Mágico <b>${n0(a.incoming.spell)}</b></span>
        <span>Ahora <b>${esc(a.current.stance ?? '—')}${a.current.invocation ? ' · ' + esc(a.current.invocation) : ''}</b></span>
      </div>
      ${table(
        [{ label: 'Stance' }, { label: 'Evitaría', right: true, w: '84px' }, { label: 'Del total', right: true, w: '68px' },
         { label: 'Vigor', right: true, w: '66px' }, { label: 'Maná', right: true, w: '62px' }],
        a.defence.map((d) => [
          `${esc(d.label)}${d.key === (a.current.stance ?? '').toLowerCase().replace(/\s*stance\s*$/, '') ? ' <span class="dim">(activa)</span>' : ''}`,
          n0(d.prevented), pct(d.share), n0(d.endurance), d.mana ? n0(d.mana) : '—',
        ]),
      )}
      <div class="hint">${esc(a.defence[0]?.note ?? '')}</div>
    ` : '<div class="hint">Sin daño recibido en esta pelea: no hay nada que mitigar.</div>'}

    ${a.offence.filter((o) => o.bonus > 0).length ? `
      <div class="sec-title eyebrow" style="margin-top:12px">Si prefieres pegar</div>
      ${table(
        [{ label: 'Stance' }, { label: 'Daño extra', right: true, w: '90px' }, { label: 'Cuesta', right: true, w: '80px' }],
        a.offence.filter((o) => o.bonus > 0).map((o) => [esc(o.label), '+' + n0(o.bonus), n0(o.endurance) + ' vigor']),
      )}` : ''}

    ${a.invocations.filter((i) => i.score > 0).length ? `
      <div class="sec-title eyebrow" style="margin-top:12px">Invocación</div>
      ${a.invocations.filter((i) => i.score > 0).slice(0, 3).map((i) => `
        <div class="adv-inv">
          <b>${esc(i.label)}</b>
          ${i.why.length ? `<span class="dim">${esc(i.why.join(' · '))}</span>` : ''}
          <div class="hint">${esc(i.note)}</div>
        </div>`).join('')}` : ''}

    <div class="hint" style="margin-top:10px">El log no registra vigor ni maná, así que los costes indican
    el precio pero no si puedes pagarlo. El daño entrante se muestra sin mitigar, revertido según la postura
    que tenías en cada golpe.</div>
  </div>`;

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
function renderHead(snap) {
  const f = fightFor(snap);
  const host = $('fightHead');
  if (!f) {
    host.innerHTML = `<div class="empty"><h2>${t('fight.none')}</h2>
      <p>${t('fight.noneHint')}</p></div>`;
    return;
  }
  const live = !!snap.current && f.id === snap.current.id;
  const sig = `${f.id}|${f.total}|${f.duration}|${live}|${f.series?.length ?? 0}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  const card = (v, label, cls = '') => `<div class="metric ${cls}">
    <div class="metric-v num">${v}</div><div class="metric-l eyebrow">${label}</div></div>`;

  host.innerHTML = `
    <div class="head-top">
      <div>
        <div class="head-title">${esc(f.label ?? t('fight.skirmish'))}</div>
        <div class="eyebrow">${live ? t('fight.live') : t('fight.closed')} · ${esc(f.zone ?? t('fight.unknownZone'))}</div>
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
      ${f.healing ? card(n0(f.healing), t('metric.healing')) : ''}
      ${f.kills.length ? card(f.kills.length, t('metric.kills', { n: f.kills.length })) : ''}
      ${f.losses?.length ? card(f.losses.length, t('metric.losses', { n: f.losses.length }), 'bad') : ''}
    </div>
    ${chartHTML(f)}`;
  $('btnExport')?.addEventListener('click', (e) => { e.stopPropagation(); window.eql.exportEncounter(f); });
  $('btnAnalyse')?.addEventListener('click', (e) => { e.stopPropagation(); state.view = 'analysis'; $('bodyGrid').innerHTML = ''; renderApp(); });
}

// ═══════════ Análisis del combate ═══════════
const LEVEL_ICON = { bad: '!', warn: '·', info: 'i', good: '✓' };

function renderAnalysis(snap) {
  const host = $('mainPane') ?? $('rows');
  const f = fightFor(snap);
  const back = `<button id="anBack">← ${esc(t('tab.combat'))}</button>`;
  if (!f || f.duration < 30) {
    $('anView').innerHTML = `<div class="analysis"><div class="an-head"><h2>${esc(t('an.title'))}</h2>${back}</div>
      <div class="hint">${esc(t('an.tooShort'))}</div></div>`;
    $('anBack').addEventListener('click', () => { state.view = 'combat'; renderApp(); });
    return;
  }

  const a = analyse(f, { self: snap.self, classes: snap.classes, pets: snap.pets });
  if (!a) { $('anView').innerHTML = ''; return; }

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

  $('anView').innerHTML = `<div class="analysis">
    <div class="an-head">
      <div><h2>${esc(f.label ?? '')}</h2>
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

function renderApp() {
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
      <main><div id="timers"></div><div id="fightHead"></div><div id="petHint"></div><div id="advice"></div><div id="rows"></div>
      <div class="legend eyebrow">${TYPES.map((t) => `<span><i class="seg ${t}"></i>${t}</span>`).join('')}</div></main>`;
    state.rowNodes.clear();
  }
  renderFightList(state.snap);
  renderTimers(state.snap);
  renderHead(state.snap);
  renderPetHint(state.snap);
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
  $('fPets').innerHTML = snap.pets.length ? `${t('foot.pets')} <b class="num">${snap.pets.map(esc).join(', ')}</b>` : '';
  $('fPath').textContent = snap.path ?? '';
}

window.eql.onSnapshot((snap) => {
  state.snap = snap;
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
    ['fightHead', 'advice', 'petHint', 'fightList'].forEach((id) => { const n = $(id); if (n) n.dataset.sig = ''; });
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

$('btnOverlay').addEventListener('click', () => window.eql.openOverlay());
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
  if (a.speak) speak(a.speak, { ...(state.cfg.tts ?? {}), queue: a.queue });
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

window.eql.getConfig().then((c) => {
  state.cfg = c;
  setLang(c.lang ?? 'es');
  if (!c.onboarded) state.wizard = { step: 1, classes: ['', '', ''], fromStart: false };
  applyTheme(c.theme ?? 'dark');
  renderLangPicker();
  applyLangToChrome();
  if (!c.logPath) renderApp();
});
