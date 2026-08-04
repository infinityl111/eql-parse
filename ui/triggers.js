import { t } from '../src/i18n.js';
import { listVoices, speak, playSound } from './alerts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let defs = [];
let selected = null;
let testLine = 'Lady Vox begins casting Cascade of Hail.';
let cfg = {};
let onDirty = () => {};

const BLANK = () => ({
  id: uid(), name: t('tg.newName'), enabled: true,
  pattern: '', regex: true, ignoreCase: true,
  speak: '', text: '', sound: null, color: null, holdMs: 4000,
  timerLabel: '', timerSeconds: 0, timerWarnAt: 0, timerRestart: 'restart',
  timerEndSpeak: '', timerEndText: '', cancelTimer: '',
});

export async function initTriggers(notify) {
  onDirty = notify ?? (() => {});
  defs = await window.eql.getTriggers();
  cfg = await window.eql.getConfig();
}

async function persist() {
  const errors = await window.eql.saveTriggers(defs);
  onDirty(errors);
  return errors;
}

export function renderTriggers(host) {
  host.innerHTML = `<div class="trig">
    <div class="trig-list">
      <div class="trig-actions">
        <button class="primary" id="tAdd">${t('tg.new')}</button>
        <button id="tImport">${t('tg.import')}</button>
        <button id="tExport">${t('tg.export')}</button>
        <button id="tReset">${t('tg.templates')}</button>
      </div>
      <div id="tItems"></div>
      <div class="tts-panel">
        <div class="sec-title eyebrow">${t('tg.voiceSound')}</div>
        <label class="chk"><input type="checkbox" id="ttsOn" ${cfg.tts?.enabled ? 'checked' : ''}> ${t('tg.readAloud')}</label>
        <label class="eyebrow" style="margin-top:8px;display:block">${t('tg.voice')}</label>
        <select id="ttsVoice" class="wide"></select>
        <label class="eyebrow" style="margin-top:8px;display:block">${t('tg.rate')} <span class="num" id="rateVal">${cfg.tts?.rate ?? 1}</span></label>
        <input type="range" id="ttsRate" min="0.6" max="1.8" step="0.1" value="${cfg.tts?.rate ?? 1}" class="wide">
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="sndOn" ${cfg.sound?.enabled ? 'checked' : ''}> ${t('tg.sounds')}</label>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button id="ttsTest">${t('tg.testVoice')}</button>
          <button id="sndTest">${t('tg.testSound')}</button>
        </div>
      </div>
    </div>
    <div class="trig-edit" id="tEdit"></div>
  </div>`;

  renderList();
  renderEditor();
  wireGlobal();
  fillVoices();
}

function renderList() {
  const el = document.getElementById('tItems');
  if (!el) return;
  el.innerHTML = defs.length ? defs.map((d) => `
    <div class="trig-item ${selected === d.id ? 'active' : ''} ${d.enabled === false ? 'off' : ''}" data-id="${d.id}">
      <input type="checkbox" class="tg" data-id="${d.id}" ${d.enabled !== false ? 'checked' : ''}>
      <div class="trig-item-body">
        <div class="trig-name">${esc(d.name)}</div>
        <div class="trig-pat num">${esc((d.pattern || '—').slice(0, 46))}</div>
      </div>
      ${d.timerSeconds > 0 ? `<span class="badge">${d.timerSeconds}s</span>` : ''}
    </div>`).join('')
    : `<div class="hint" style="padding:12px">${t('tg.empty')}</div>`;

  el.querySelectorAll('.trig-item').forEach((n) => n.addEventListener('click', (e) => {
    if (e.target.classList.contains('tg')) return;
    selected = n.dataset.id;
    renderList(); renderEditor();
  }));
  el.querySelectorAll('.tg').forEach((n) => n.addEventListener('change', async () => {
    const d = defs.find((x) => x.id === n.dataset.id);
    d.enabled = n.checked;
    await persist(); renderList();
  }));
}

function field(label, id, value, ph = '', hint = '') {
  return `<div class="field"><label class="eyebrow">${esc(label)}</label>
    <input id="${id}" class="wide" value="${esc(value ?? '')}" placeholder="${esc(ph)}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}

function renderEditor() {
  const host = document.getElementById('tEdit');
  const d = defs.find((x) => x.id === selected);
  if (!d) {
    host.innerHTML = `<div class="empty"><h2>${t('tg.noneSel')}</h2><p>${t('tg.noneSelHint')}</p></div>`;
    return;
  }
  host.innerHTML = `
    ${field(t('tg.name'), 'fName', d.name)}
    <div class="field">
      <label class="eyebrow">${t('tg.pattern')}</label>
      <input id="fPattern" class="wide" value="${esc(d.pattern)}" placeholder="^(.+?) begins casting (.+?)\\.$">
      <div class="row-inline">
        <label class="chk"><input type="checkbox" id="fRegex" ${d.regex ? 'checked' : ''}> ${t('tg.regex')}</label>
        <label class="chk"><input type="checkbox" id="fCase" ${d.ignoreCase !== false ? 'checked' : ''}> ${t('tg.ignoreCase')}</label>
      </div>
      <div class="hint">${esc(t('tg.patternHelp'))}</div>
    </div>

    <div class="sec-title eyebrow" style="margin-top:18px">Al casar</div>
    ${field(t('tg.speak'), 'fSpeak', d.speak, '${1} lanza ${2}')}
    ${field(t('tg.show'), 'fText', d.text, 'VOX · ${1}')}
    <div class="grid3">
      <div class="field"><label class="eyebrow">${t('tg.sound')}</label>
        <select id="fSound" class="wide">
          <option value="">${t('tg.sndNone')}</option>
          <option value="alert" ${d.sound === 'alert' ? 'selected' : ''}>${t('tg.sndAlert')}</option>
          <option value="warn" ${d.sound === 'warn' ? 'selected' : ''}>${t('tg.sndWarn')}</option>
          <option value="end" ${d.sound === 'end' ? 'selected' : ''}>Cierre</option>
        </select></div>
      <div class="field"><label class="eyebrow">Color</label>
        <input id="fColor" class="wide" type="color" value="${esc(d.color ?? '#6FC7D8')}"></div>
      <div class="field"><label class="eyebrow">Segundos en pantalla</label>
        <input id="fHold" class="wide" type="number" min="1" max="30" value="${(d.holdMs ?? 4000) / 1000}"></div>
    </div>

    <div class="sec-title eyebrow" style="margin-top:18px">${t('tg.timerSec')}</div>
    <div class="grid3">
      <div class="field"><label class="eyebrow">${t('tg.duration')}</label>
        <input id="fSecs" class="wide" type="number" min="0" max="3600" value="${d.timerSeconds ?? 0}"></div>
      <div class="field"><label class="eyebrow">Avisar al quedar (s)</label>
        <input id="fWarn" class="wide" type="number" min="0" max="120" value="${d.timerWarnAt ?? 0}"></div>
      <div class="field"><label class="eyebrow">Si ya existe</label>
        <select id="fRestart" class="wide">
          <option value="restart" ${d.timerRestart === 'restart' ? 'selected' : ''}>Reiniciar</option>
          <option value="ignore" ${d.timerRestart === 'ignore' ? 'selected' : ''}>Ignorar</option>
          <option value="multiple" ${d.timerRestart === 'multiple' ? 'selected' : ''}>Permitir varios</option>
        </select></div>
    </div>
    ${field(t('tg.timerName'), 'fTLabel', d.timerLabel, 'Vox · ${1}')}
    ${field('Decir al terminar', 'fTEndSpeak', d.timerEndSpeak, 'Vox lista')}
    ${field('Mostrar al terminar', 'fTEndText', d.timerEndText)}
    ${field(t('tg.cancelTimers'), 'fCancel', d.cancelTimer, 'Vox', t('tg.cancelHint'))}

    <div class="sec-title eyebrow" style="margin-top:18px">Probar</div>
    <div class="field">
      <input id="fTestLine" class="wide num" value="${esc(testLine)}" placeholder="${esc(t('tg.testLine'))}">
      <div class="hint">${t('tg.testHelp')}</div>
    </div>
    <div id="tResult"></div>

    <div class="actions">
      <button class="primary" id="fSave">${t('tg.save')}</button>
      <button id="fTest">Probar</button>
      <button id="fDup">Duplicar</button>
      <button id="fDel">${t('tg.delete')}</button>
    </div>`;

  wireEditor(d);
}

function readEditor(d) {
  const v = (id) => document.getElementById(id)?.value ?? '';
  return {
    ...d,
    name: v('fName') || t('tg.noName'),
    pattern: v('fPattern'),
    regex: document.getElementById('fRegex').checked,
    ignoreCase: document.getElementById('fCase').checked,
    speak: v('fSpeak'), text: v('fText'),
    sound: v('fSound') || null,
    color: v('fColor'),
    holdMs: (+v('fHold') || 4) * 1000,
    timerSeconds: +v('fSecs') || 0,
    timerWarnAt: +v('fWarn') || 0,
    timerRestart: v('fRestart'),
    timerLabel: v('fTLabel'),
    timerEndSpeak: v('fTEndSpeak'),
    timerEndText: v('fTEndText'),
    cancelTimer: v('fCancel'),
  };
}

function wireEditor(d) {
  document.getElementById('fSave').addEventListener('click', async () => {
    const next = readEditor(d);
    defs = defs.map((x) => (x.id === d.id ? next : x));
    const errors = await persist();
    renderList();
    const bad = errors.find((e) => e.id === d.id);
    document.getElementById('tResult').innerHTML = bad
      ? `<div class="test bad">${esc(t('tg.badPattern', { err: bad.error }))}</div>`
      : '<div class="test good">Guardado y activo.</div>';
  });

  document.getElementById('fTest').addEventListener('click', async () => {
    testLine = document.getElementById('fTestLine').value;
    const def = readEditor(d);
    const r = await window.eql.testTrigger(def, testLine);
    const out = document.getElementById('tResult');
    if (!r.ok) { out.innerHTML = `<div class="test bad">${esc(t('tg.badPattern', { err: r.error }))}</div>`; return; }
    if (!r.matched) { out.innerHTML = `<div class="test">${t('tg.noMatch')}</div>`; return; }
    out.innerHTML = `<div class="test good">
      <div>Casa. Grupos capturados:</div>
      ${r.groups.slice(1).map((g, i) => `<div class="num">\${${i + 1}} = ${esc(g ?? '')}</div>`).join('') || '<div class="hint">Sin grupos.</div>'}
      ${r.speak ? `<div style="margin-top:6px">${t('tg.wouldSay')}: <b>${esc(r.speak)}</b></div>` : ''}
      ${r.text ? `<div>${t('tg.wouldShow')}: <b>${esc(r.text)}</b></div>` : ''}
      ${def.timerSeconds ? `<div>${t('tg.timerSec')}: <b>${esc(r.timerLabel || def.name)}</b> · ${def.timerSeconds}s</div>` : ''}
    </div>`;
    if (r.speak && cfg.tts?.enabled) speak(r.speak, cfg.tts);
    if (def.sound && cfg.sound?.enabled) playSound(def.sound, cfg.sound.volume);
  });

  document.getElementById('fDup').addEventListener('click', async () => {
    const copy = { ...readEditor(d), id: uid(), name: `${d.name} (copia)` };
    defs.push(copy); selected = copy.id;
    await persist(); renderList(); renderEditor();
  });

  document.getElementById('fDel').addEventListener('click', async () => {
    defs = defs.filter((x) => x.id !== d.id);
    selected = null;
    await persist(); renderList(); renderEditor();
  });
}

function fillVoices() {
  const sel = document.getElementById('ttsVoice');
  if (!sel) return;
  const paint = () => {
    const vs = listVoices();
    sel.innerHTML = `<option value="">${t('tg.auto')}</option>${
      vs.map((v) => `<option value="${esc(v.name)}" ${cfg.tts?.voice === v.name ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}`;
  };
  paint();
  // Windows tarda un instante en publicar la lista de voces.
  setTimeout(paint, 400);
}

function wireGlobal() {
  const save = async (patch) => { cfg = await window.eql.setConfig(patch); };

  document.getElementById('tAdd').addEventListener('click', async () => {
    const d = BLANK(); defs.push(d); selected = d.id;
    await persist(); renderList(); renderEditor();
  });
  document.getElementById('tReset').addEventListener('click', async () => {
    const starters = await window.eql.defaultTriggers();
    const have = new Set(defs.map((d) => d.id));
    defs = [...defs, ...starters.filter((s) => !have.has(s.id))];
    await persist(); renderList();
  });
  document.getElementById('tImport').addEventListener('click', async () => {
    const imported = await window.eql.importTriggers();
    if (!imported || imported.error) return;
    const have = new Set(defs.map((d) => d.id));
    defs = [...defs, ...imported.filter((s) => !have.has(s.id))];
    await persist(); renderList();
  });
  document.getElementById('tExport').addEventListener('click', () => window.eql.exportTriggers());

  document.getElementById('ttsOn').addEventListener('change', (e) => save({ tts: { ...cfg.tts, enabled: e.target.checked } }));
  document.getElementById('sndOn').addEventListener('change', (e) => save({ sound: { ...cfg.sound, enabled: e.target.checked } }));
  document.getElementById('ttsVoice').addEventListener('change', (e) => save({ tts: { ...cfg.tts, voice: e.target.value || null } }));
  document.getElementById('ttsRate').addEventListener('input', (e) => {
    document.getElementById('rateVal').textContent = e.target.value;
    save({ tts: { ...cfg.tts, rate: +e.target.value } });
  });
  document.getElementById('ttsTest').addEventListener('click', () => speak('Vox lanza Cascada de granizo', cfg.tts));
  document.getElementById('sndTest').addEventListener('click', () => playSound('alert', cfg.sound?.volume ?? 0.5));
}
