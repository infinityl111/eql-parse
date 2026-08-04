import { listVoices, speak, playSound } from './alerts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let defs = [];
let selected = null;
let testLine = 'Lady Vox begins casting Cascade of Hail.';
let cfg = {};
let onDirty = () => {};

const BLANK = () => ({
  id: uid(), name: 'Disparador nuevo', enabled: true,
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
        <button class="primary" id="tAdd">Nuevo</button>
        <button id="tImport">Importar</button>
        <button id="tExport">Exportar</button>
        <button id="tReset">Plantillas</button>
      </div>
      <div id="tItems"></div>
      <div class="tts-panel">
        <div class="sec-title eyebrow">Voz y sonido</div>
        <label class="chk"><input type="checkbox" id="ttsOn" ${cfg.tts?.enabled ? 'checked' : ''}> Leer los avisos en voz alta</label>
        <label class="eyebrow" style="margin-top:8px;display:block">Voz</label>
        <select id="ttsVoice" class="wide"></select>
        <label class="eyebrow" style="margin-top:8px;display:block">Velocidad <span class="num" id="rateVal">${cfg.tts?.rate ?? 1}</span></label>
        <input type="range" id="ttsRate" min="0.6" max="1.8" step="0.1" value="${cfg.tts?.rate ?? 1}" class="wide">
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="sndOn" ${cfg.sound?.enabled ? 'checked' : ''}> Sonidos</label>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button id="ttsTest">Probar voz</button>
          <button id="sndTest">Probar sonido</button>
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
    : '<div class="hint" style="padding:12px">Sin disparadores. Crea uno o carga las plantillas.</div>';

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
    host.innerHTML = '<div class="empty"><h2>Ningún disparador seleccionado</h2><p>Elige uno de la lista o crea uno nuevo.</p></div>';
    return;
  }
  host.innerHTML = `
    ${field('Nombre', 'fName', d.name)}
    <div class="field">
      <label class="eyebrow">Patrón</label>
      <input id="fPattern" class="wide" value="${esc(d.pattern)}" placeholder="^(.+?) begins casting (.+?)\\.$">
      <div class="row-inline">
        <label class="chk"><input type="checkbox" id="fRegex" ${d.regex ? 'checked' : ''}> Expresión regular</label>
        <label class="chk"><input type="checkbox" id="fCase" ${d.ignoreCase !== false ? 'checked' : ''}> Ignorar mayúsculas</label>
      </div>
      <div class="hint">Con <code>\${1}</code>…<code>\${9}</code> insertas los grupos capturados en la voz y el texto.
        <code>\${line}</code> es la línea entera. En EQL el log nombra el hechizo, así que
        <code>^Lady Vox begins casting (.+?)\\.$</code> te da el hechizo en <code>\${1}</code>.</div>
    </div>

    <div class="sec-title eyebrow" style="margin-top:18px">Al casar</div>
    ${field('Decir en voz alta', 'fSpeak', d.speak, '${1} lanza ${2}')}
    ${field('Mostrar en pantalla', 'fText', d.text, 'VOX · ${1}')}
    <div class="grid3">
      <div class="field"><label class="eyebrow">Sonido</label>
        <select id="fSound" class="wide">
          <option value="">Ninguno</option>
          <option value="alert" ${d.sound === 'alert' ? 'selected' : ''}>Aviso</option>
          <option value="warn" ${d.sound === 'warn' ? 'selected' : ''}>Atención</option>
          <option value="end" ${d.sound === 'end' ? 'selected' : ''}>Cierre</option>
        </select></div>
      <div class="field"><label class="eyebrow">Color</label>
        <input id="fColor" class="wide" type="color" value="${esc(d.color ?? '#6FC7D8')}"></div>
      <div class="field"><label class="eyebrow">Segundos en pantalla</label>
        <input id="fHold" class="wide" type="number" min="1" max="30" value="${(d.holdMs ?? 4000) / 1000}"></div>
    </div>

    <div class="sec-title eyebrow" style="margin-top:18px">Temporizador</div>
    <div class="grid3">
      <div class="field"><label class="eyebrow">Duración (s)</label>
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
    ${field('Nombre del temporizador', 'fTLabel', d.timerLabel, 'Vox · ${1}')}
    ${field('Decir al terminar', 'fTEndSpeak', d.timerEndSpeak, 'Vox lista')}
    ${field('Mostrar al terminar', 'fTEndText', d.timerEndText)}
    ${field('Cancelar temporizadores que contengan', 'fCancel', d.cancelTimer, 'Vox', 'Útil para cortar una cuenta atrás cuando el jefe muere.')}

    <div class="sec-title eyebrow" style="margin-top:18px">Probar</div>
    <div class="field">
      <input id="fTestLine" class="wide num" value="${esc(testLine)}" placeholder="Pega aquí una línea de tu log">
      <div class="hint">Pega una línea real de tu log (sin la marca de tiempo) y comprueba qué saldría.</div>
    </div>
    <div id="tResult"></div>

    <div class="actions">
      <button class="primary" id="fSave">Guardar</button>
      <button id="fTest">Probar</button>
      <button id="fDup">Duplicar</button>
      <button id="fDel">Borrar</button>
    </div>`;

  wireEditor(d);
}

function readEditor(d) {
  const v = (id) => document.getElementById(id)?.value ?? '';
  return {
    ...d,
    name: v('fName') || 'Sin nombre',
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
      ? `<div class="test bad">El patrón no compila: ${esc(bad.error)}</div>`
      : '<div class="test good">Guardado y activo.</div>';
  });

  document.getElementById('fTest').addEventListener('click', async () => {
    testLine = document.getElementById('fTestLine').value;
    const def = readEditor(d);
    const r = await window.eql.testTrigger(def, testLine);
    const out = document.getElementById('tResult');
    if (!r.ok) { out.innerHTML = `<div class="test bad">El patrón no compila: ${esc(r.error)}</div>`; return; }
    if (!r.matched) { out.innerHTML = '<div class="test">No casa con esa línea.</div>'; return; }
    out.innerHTML = `<div class="test good">
      <div>Casa. Grupos capturados:</div>
      ${r.groups.slice(1).map((g, i) => `<div class="num">\${${i + 1}} = ${esc(g ?? '')}</div>`).join('') || '<div class="hint">Sin grupos.</div>'}
      ${r.speak ? `<div style="margin-top:6px">Diría: <b>${esc(r.speak)}</b></div>` : ''}
      ${r.text ? `<div>Mostraría: <b>${esc(r.text)}</b></div>` : ''}
      ${def.timerSeconds ? `<div>Temporizador: <b>${esc(r.timerLabel || def.name)}</b> · ${def.timerSeconds}s</div>` : ''}
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
    sel.innerHTML = `<option value="">Automática (es-ES)</option>${
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
