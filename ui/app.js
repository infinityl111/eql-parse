import { t, setLang, getLang, LANGS, langInfo, TRANSLATED } from '../src/i18n.js';
import { analyse } from '../src/analysis.js';
import { advise } from '../src/advisor.js';
import { RANGES } from '../src/ranges.js';
import { mergePets, mergeOwnerPets, ownerPets } from '../src/aggregate.js';
import { fightToChat } from '../src/share.js';
import { clasificaJefe, jefesDe } from '../src/raid.js';
import { copiarAlPortapapeles } from './clip.js';
import { initTriggers, renderTriggers } from './triggers.js';
import { plate, DIBUJADAS } from './plates.js';
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
  picked: new Set(),      // peleas elegidas a mano, para verlas como una
  pickAnchor: null,       // desde dónde extiende el rango Mayúsculas+clic
  expanded: new Set(),
  hover: null,
  setup: false,
  view: 'combat',
  cfg: {},
  rowNodes: new Map(),
  sideHeads: new Map(),
  detailStamp: new Map(),
  showAll: false,
  filter: { range: '24h', foe: '', mates: [] },
  fights: [],
  fightCache: new Map(),
  foes: [],
  stats: null,
  summary: null,
  openFoes: new Set(),
  openSumRows: new Set(),
  // El desplegable de compañeros del filtro. Vive en el estado y no en el DOM
  // porque la lista se repinta sola cada 250 ms con el snapshot: guardarlo en
  // una clase del nodo lo cerraría al cuarto de segundo de abrirlo.
  matesOpen: false,
  // Recuentos de la enciclopedia, por sección. Vacío mientras no existan las
  // fichas: la tarjeta enseña entonces su descripción, que es lo que hay.
  encCounts: null,
  // Dónde estás dentro de la enciclopedia. Es una ruta y no un `view` más
  // porque tiene cuatro niveles y hay que poder volver por donde viniste.
  enc: { page: 'index', base: null, name: null, zonas: [], foes: [], fights: [] },
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
      <p class="hint" style="margin-top:14px">${esc(t('wz.6.ready'))}</p>
      <p class="hint" style="margin-top:18px;opacity:.6">${esc(t('app.credit'))}</p>`,
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

/**
 * Los que has declarado compañeros de grupo.
 *
 * Es el espejo de la lista de arriba y funciona igual: se aplica al MOSTRAR, no
 * al guardar. Por eso vale para todo el histórico sin reconstruir nada y se
 * puede deshacer — declarar a alguien reclasifica al instante las peleas de
 * ayer donde salía, y quitarlo las devuelve a como estaban.
 *
 * `unidentified` significa «no consta que sea tuyo». Declararlo es que conste,
 * así que la marca se re-deriva aquí en vez de creerse la que quedó guardada.
 */
const companeros = () => new Set(state.cfg.companions ?? []);

/**
 * Quién es jefe: lo que ha contestado la wiki y lo que has dicho tú.
 *
 * Se pregunta en lote y se cachea aquí además de en el cliente de la wiki: una
 * ficha de zona son veinte enemigos y repintar no puede disparar veinte viajes
 * por el puente cada vez.
 */
const raidWiki = new Map();     // nombre -> {raid, named} | null
const raidPedidos = new Set();
function pedirRaid(nombres, luego) {
  const faltan = [...new Set(nombres)].filter((n) => n && !raidPedidos.has(n));
  if (!faltan.length) return;
  faltan.forEach((n) => raidPedidos.add(n));
  window.eql.raidFlags?.(faltan).then((res) => {
    let algo = false;
    for (const [n, v] of Object.entries(res ?? {})) {
      if (v?.wiki) { raidWiki.set(n, { found: true, ...v.wiki }); algo = true; }
    }
    if (algo && luego) luego();
  }).catch(() => { /* sin red: se queda la deducción */ });
}
/** Lo que dijiste tú, en la forma que espera `clasificaJefe`. */
const raidManual = () => new Map(Object.entries(state.cfg.raidMobs ?? {}));
const jefeDe = (nombre, vida) => clasificaJefe(nombre, {
  manual: raidManual(), wiki: raidWiki, vida,
});

/**
 * El interruptor de «esto es un jefe», en la ficha.
 *
 * `auto` no es «no»: borra tu marca y devuelve la palabra a la wiki. Sin esa
 * tercera opción, corregirte a ti mismo sería imposible — te quedarías con un
 * «no» tuyo tapando para siempre lo que diga la wiki.
 */
function cablearRaid(host) {
  host?.querySelectorAll('[data-raid]').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();
    const v = el.dataset.to;
    const r = await window.eql.setRaid?.(el.dataset.raid, v === 'auto' ? null : v === '1');
    state.cfg.raidMobs = r ?? state.cfg.raidMobs;
    renderApp();
  }));
}

/**
 * De dónde salió que alguien es compañero: lo dijiste tú o se dedujo del canal.
 *
 * Se enseña siempre, como con las clases, y por lo mismo: medido y deducido no
 * son la misma cosa y no pueden verse igual. Lo que no conste se da por dicho
 * por ti, que es lo que era antes de que existiera la detección.
 */
const fuenteDe = (nombre) => ((state.cfg.companionSrc ?? {})[nombre] === 'auto' ? 'auto' : 'manual');

/**
 * Guarda la respuesta del puente sobre compañeros.
 *
 * Las tres listas —los declarados, de dónde salió cada uno y los que quitaste—
 * viajan juntas y se aplican juntas. Copiar sólo una dejaba la insignia de
 * procedencia describiendo un estado anterior, que es la clase de detalle que
 * nadie mira hasta que miente.
 */
function aplicarCompaneros(r) {
  if (!r) return;
  if (r.companions) state.cfg.companions = r.companions;
  if (r.companionSrc) state.cfg.companionSrc = r.companionSrc;
  if (r.notCompanions) state.cfg.notCompanions = r.notCompanions;
  // Quien deja de ser compañero deja de poder filtrar por él.
  const vivos = new Set(state.cfg.companions ?? []);
  state.filter.mates = (state.filter.mates ?? []).filter((x) => vivos.has(x));
}

// Un compañero detectado por el canal de grupo llega solo, sin haberlo pedido.
window.eql.onCompanions?.((c) => {
  aplicarCompaneros(c);
  state.rowNodes.clear();
  state.summary = null;
  renderApp();
});

/**
 * Decir quién es alguien: excluirlo, declararlo compañero o asignar su
 * mascota a su dueño.
 *
 * Va en el desglose de la fila y hace falta en LOS DOS SITIOS donde miras
 * filas: la pelea suelta y el resumen. La primera versión sólo lo puso en la
 * pelea, y el resumen es justo donde se ve el reparto y donde decides que ese
 * 20% es de alguien — allí no había nada que pulsar.
 *
 * @param {object} r     la fila
 * @param {object[]} filas  las de al lado, de donde salen los dueños posibles
 */
/**
 * «Es la mascota de X.»
 *
 * Si ese X eres tú, no es una mascota ajena: es tuya, y va donde van las tuyas.
 * Son dos sitios distintos a propósito —las tuyas cuentan en el filtro de
 * relevancia y las de otro no— así que elegirte a ti en el desplegable tiene
 * que acabar en `markPet` y no en la lista de ajenas.
 */
async function asignarMascota(pet, dueno) {
  const yo = state.snap?.self;
  const eraMia = isMyPet(pet);
  if (dueno && dueno === yo) {
    await window.eql.setPetOwner(pet, null);
    const r = await window.eql.markPet(pet, true);
    if (r?.myPets) { state.cfg.myPets = r.myPets; state.cfg.notPets = r.notPets; }
    return;
  }
  // Quitártela es tan explícito como ponértela. Sin esta línea, elegir «nadie»
  // sobre una mascota tuya no hacía absolutamente nada: la decisión de que era
  // tuya sólo se podía deshacer editando el fichero de configuración a mano.
  if (eraMia) {
    const r = await window.eql.markPet(pet, false);
    if (r?.myPets) { state.cfg.myPets = r.myPets; state.cfg.notPets = r.notPets; }
  }
  await window.eql.setPetOwner(pet, dueno);
}

/**
 * Los controles de una fila, y por qué salen SIEMPRE.
 *
 * Aquí había un `if (esMio) return ''` que dejaba sin controles a tu personaje
 * y a tus mascotas. Para tu personaje está bien —no te asignas dueño a ti
 * mismo—, pero para una mascota era un callejón sin salida: en cuanto la
 * marcabas tuya, la fila perdía el desplegable y no había forma de deshacerlo
 * desde la aplicación. Una decisión que sólo se revierte editando un fichero
 * no es reversible.
 *
 * Ahora el desplegable sale también cuando ya es tuya, con tu nombre elegido, y
 * volver a «nadie» la suelta.
 */
function controlesDeFila(r, filas = []) {
  const yo = state.snap?.self;
  if (r.name === yo) return '';
  const mia = isMyPet(r.name);
  const yaEs = companeros().has(r.name);
  // Los dueños posibles: quien esté en lo que estás mirando, más TÚ siempre, y
  // más los compañeros que hayas declarado aunque no salgan en esta pelea. Antes
  // salían sólo los presentes, así que la mascota de un compañero que no había
  // llegado a pegar no tenía a quién asignarse.
  const presentes = filas
    .filter((x) => x.side !== 'enemy' && x.name !== r.name && !x.petOf
      && !isMyPet(x.name) && !x.merged)
    .map((x) => x.name);
  const duenos = [...new Set([yo, ...presentes, ...companeros()])]
    .filter((n) => n && n !== r.name);
  // Si ya es tuya, el dueño actual eres tú: se dice en el desplegable en vez de
  // dejarlo en «nadie», que sería mentir sobre lo que hay puesto.
  const actual = mia ? yo : (r.petOf ?? '');
  const asignar = !duenos.length ? '' : `<label class="petof">
    ${esc(t('pet.ownerOf'))}
    <select class="petof-sel" data-pet="${esc(r.name)}">
      <option value=""${actual ? '' : ' selected'}>${esc(t('pet.ownerNone'))}</option>
      ${duenos.map((n) => `<option value="${esc(n)}"${
    actual === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}
    </select></label>`;
  return `<div class="sec">
    ${mia ? '' : `<button class="excl-btn" data-excl="${esc(r.name)}">${esc(t('excl.remove'))}</button>`}
    ${r.petOf || mia ? '' : `<button class="excl-btn mate" data-mate="${esc(r.name)}" data-on="${yaEs ? '0' : '1'}">${
    esc(yaEs ? t('mate.remove') : t('mate.add'))}</button>`}
    ${asignar}
    ${mia ? `<span class="hint">${esc(t('pet.isMineNote'))}</span>`
    : r.petOf ? `<span class="hint">${esc(t('pet.ownedBy', { who: r.petOf }))}</span>`
      : yaEs ? `<span class="hint">${esc(t('mate.declared'))}</span>`
        : r.unidentified ? `<span class="hint">${esc(t('side.unknownNote'))}</span>` : ''}
  </div>`;
}

/** Aplica la declaración a unas filas, vengan de la pelea o del resumen. */
function marcarCompaneros(rows) {
  const amigos = companeros();
  if (!amigos.size || !rows?.some((r) => amigos.has(r.name))) return rows;
  return rows.map((r) => (amigos.has(r.name)
    ? { ...r, unidentified: false, mate: true } : r));
}

function withPets(f) {
  if (!f) return f;
  const fuera = excluidos();
  let rows = fuera.size ? f.rows.filter((r) => !fuera.has(r.name)) : f.rows;
  rows = marcarCompaneros(rows);
  // De quién es cada mascota se aplica AHORA y no como quedó guardado: lo
  // asignas a mitad de sesión y las peleas de hace media hora se rotulan bien.
  rows = ownerPets(rows, state.snap?.petOwners ?? {});
  if (state.cfg.mergePets) {
    rows = mergePets(rows, t('pets.merged'), petNames(), state.snap?.self, state.cfg.notPets ?? []);
    // La misma casilla pliega también la mascota de cada jugador dentro de él:
    // es la misma pregunta —cuánto ha puesto cada persona— y de nada sirve
    // juntar las tuyas si la de al lado sigue contando aparte.
    rows = mergeOwnerPets(rows);
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
  const q = { sinceMs: r?.ms ?? null, foe: state.filter.foe || null,
    mates: state.filter.mates ?? [], limit: 400 };
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
  const picked = !live && state.picked.has(f.uid);
  return `<div class="fight ${live ? 'live' : ''} ${active ? 'active' : ''} ${
    picked ? 'picked' : ''}" data-uid="${f.uid}" data-live="${live ? 1 : 0}">
    <div class="fight-name">${esc(f.label ?? t('fight.skirmish'))}</div>
    <div class="fight-sub">
      <span class="num strong foe">${n0(f.enemyDps ?? 0)}</span><span class="u">dps</span>
      <span class="num">${n0(f.raidDps)}</span><span class="u">${esc(t('side.allies').toLowerCase())}</span>
      <span class="num dim">${secs(f.duration)}</span>
    </div>
  </div>`;
}

/**
 * Los tres filtros, en una sola línea.
 *
 * El de compañeros era una fila de fichas, una por cada uno declarado. Con dos
 * ya empujaba al tramo y al enemigo fuera de la barra —272 px de columna no dan
 * para tres controles y una fila que crece—, y en una raid de veinte nombres no
 * habría cabido nada. Un desplegable ocupa lo mismo con dos que con veinte: la
 * lista se va por dentro y la barra no se entera.
 */
function matesFilter() {
  const todos = state.cfg.companions ?? [];
  // Sin nadie declarado no hay nada que filtrar: el control no se pinta y la
  // barra se queda con los dos de siempre.
  if (!todos.length) return '';
  const on = state.filter.mates ?? [];
  return `<button class="mates-btn ${on.length ? 'on' : ''}" id="fltMates"
      title="${esc(t('mate.title'))}" aria-haspopup="true" aria-expanded="${state.matesOpen}"
      >${esc(t('mate.filter'))}${on.length ? ` <b class="num">${on.length}</b>` : ''}<span class="caret">▾</span></button>
    ${state.matesOpen ? `<div class="mates-pop" id="matesPop">
      <div class="eyebrow">${esc(t('mate.title'))}</div>
      ${todos.map((n) => `<label class="chk mini"><input type="checkbox" data-mate="${esc(n)}"${
        on.includes(n) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}
      ${on.length > 1 ? `<div class="hint">${esc(t('mate.filterAll'))}</div>` : ''}
      ${on.length ? `<button class="pick-clear" id="matesClear">${esc(t('pick.clear'))}</button>` : ''}
    </div>` : ''}`;
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
    ${matesFilter()}
  </div>
  <button class="sumbtn" id="btnSummary">${esc(t('sum.open'))}</button>`);

  // Selección a mano: manda sobre el tramo y el enemigo mientras esté puesta,
  // así que tiene que verse y tiene que poder deshacerse de un clic.
  if (state.picked.size) {
    parts.push(`<div class="pick-bar">
      <span class="eyebrow">${esc(t('pick.n', { n: state.picked.size }))}</span>
      <button class="sumbtn" id="pickOpen">${esc(t('pick.open'))}</button>
      <button class="pick-clear" id="pickClear">${esc(t('pick.clear'))}</button>
    </div>`);
  } else {
    parts.push(`<div class="hint pick-hint">${esc(t('pick.hint'))}</div>`);
  }

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
  $('fltMates')?.addEventListener('click', (e) => {
    // Sin esto el clic sube hasta el documento, que es quien cierra el
    // desplegable: se abriría y se cerraría con el mismo clic.
    e.stopPropagation();
    state.matesOpen = !state.matesOpen;
    list.dataset.sig = '';
    renderApp();
  });
  // El desplegable se queda abierto mientras marcas: marcar a uno solo casi
  // nunca es lo que quieres, y volver a abrirlo por cada nombre sobra.
  $('matesPop')?.addEventListener('click', (e) => e.stopPropagation());
  // Marcar varios es «estuvieron todos», no «alguno»: ver el porqué en
  // FightStore.filter. Aquí sólo se recogen los marcados.
  list.querySelectorAll('#matesPop input[data-mate]').forEach((el) => el.addEventListener('change', () => {
    const m = new Set(state.filter.mates ?? []);
    el.checked ? m.add(el.dataset.mate) : m.delete(el.dataset.mate);
    state.filter.mates = [...m];
    state.summary = null;
    refreshFights();
  }));
  $('matesClear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.filter.mates = [];
    state.summary = null;
    refreshFights();
  });
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
  $('btnSummary')?.addEventListener('click', async () => {
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.summaryFrom = 'range';
    state.summary = await window.eql.aggregate({ sinceMs: r?.ms ?? null, foe: state.filter.foe || null,
      mates: state.filter.mates ?? [],
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
  /**
   * Elegir varias peleas a mano y verlas como una.
   *
   * Una «sesión» son combates seguidos, así que Mayúsculas+clic coge el rango
   * desde la última que pinchaste: dos clics y tienes de la primera a la
   * última. Ctrl+clic añade o quita una suelta, para corregir el rango. Un clic
   * normal deshace la selección y abre esa pelea, como siempre.
   *
   * El orden del rango se lee del DOM y no del estado: lo que se selecciona es
   * lo que ves, con el filtro y los menores ocultos que haya puestos en ese
   * momento.
   */
  const enPantalla = () => [...list.querySelectorAll('.fight[data-live="0"]')].map((x) => +x.dataset.uid);

  list.querySelectorAll('.fight').forEach((el) => el.addEventListener('click', async (e) => {
    const viva = el.dataset.live === '1';
    const uid = viva ? null : +el.dataset.uid;
    // La pelea en curso no se puede seleccionar: aún no está guardada y no
    // tiene identidad con la que pedirla.
    if (!viva && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const orden = enPantalla();
      if (e.shiftKey && state.pickAnchor != null && orden.includes(state.pickAnchor)) {
        const a = orden.indexOf(state.pickAnchor);
        const b = orden.indexOf(uid);
        state.picked = new Set(orden.slice(Math.min(a, b), Math.max(a, b) + 1));
      } else {
        const p = new Set(state.picked);
        p.has(uid) ? p.delete(uid) : p.add(uid);
        state.picked = p;
        state.pickAnchor = uid;
      }
      state.summary = null;
      list.dataset.sig = '';
      renderApp();
      return;
    }
    state.picked = new Set();
    state.pickAnchor = uid;
    state.selectedFight = viva ? 'live' : uid;
    state.rowNodes.clear();
    if ($('rows')) $('rows').innerHTML = '';
    await loadFight(state.selectedFight);
    renderApp();
  }));
  $('pickClear')?.addEventListener('click', () => {
    state.picked = new Set();
    state.summary = null;
    list.dataset.sig = '';
    if (state.view === 'summary') state.view = 'combat';
    renderApp();
  });
  $('pickOpen')?.addEventListener('click', async () => {
    state.summaryFrom = 'pick';
    state.summary = await window.eql.aggregate({ uids: [...state.picked],
      mergePets: state.cfg.mergePets, petLabel: t('pets.merged'),
      myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] });
    state.view = 'summary';
    $('bodyGrid').innerHTML = '';
    renderApp();
  });
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
  // El desplegable de dueño no es un clic en la fila: se atiende aparte para
  // que elegir no despliegue ni pliegue nada.
  el.addEventListener('change', async (e) => {
    const sel = e.target.closest?.('.petof-sel');
    if (!sel) return;
    e.stopPropagation();
    await asignarMascota(sel.dataset.pet, sel.value || null);
    state.rowNodes.clear();
    if ($('rows')) $('rows').innerHTML = '';
    state.summary = null;
    renderApp();
  });
  el.addEventListener('click', (e) => { if (e.target.closest?.('.petof')) e.stopPropagation(); });
  el.addEventListener('click', async (e) => {
    if (e.target.closest?.('.petof')) return;
    const btn = e.target.closest?.('.excl-btn');
    if (btn) {
      e.stopPropagation();
      const r = btn.dataset.mate
        ? await window.eql.setCompanion(btn.dataset.mate, btn.dataset.on === '1')
        : await window.eql.setExcluded(btn.dataset.excl, true);
      state.cfg.excluded = r.excluded ?? state.cfg.excluded;
      aplicarCompaneros(r);
      state.rowNodes.clear();
      if ($('rows')) $('rows').innerHTML = '';
      state.summary = null;
      // Declarar o retirar a alguien cambia qué peleas casan con el filtro de
      // compañeros, así que la lista se vuelve a pedir.
      if (btn.dataset.mate) refreshFights();
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
    // Y no se toca mientras estés usando algo de dentro. En una pelea viva el
    // desglose se reconstruye cuatro veces por segundo, y reconstruirlo
    // destruye el <select> de asignar mascota: el desplegable se abría y se
    // cerraba solo antes de poder elegir nada. Con el foco dentro se deja
    // quieto; las cifras se ponen al día en cuanto sueltes.
    const usandolo = refs.detail.contains(document.activeElement);
    if (!usandolo && state.detailStamp.get(r.name) !== stamp) {
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

  /**
   * Coloca un nodo en su sitio, y SÓLO si no estaba ya en él.
   *
   * `appendChild` sobre un nodo que ya está puesto no es gratis: lo saca del
   * documento y lo vuelve a meter, y al sacarlo se pierde el foco de lo que
   * hubiera dentro. La lista se repinta cuatro veces por segundo, así que el
   * desplegable de asignar mascota perdía el foco un cuarto de segundo después
   * de abrirlo; entonces el desglose dejaba de estar «en uso», se reconstruía,
   * y el desplegable desaparecía debajo del cursor antes de poder elegir nada.
   *
   * La guarda de la 1.3.1 —no tocar el desglose mientras tengas el foco dentro—
   * estaba bien; lo que fallaba es que el foco se lo quitaba esto de aquí.
   */
  let pos = 0;
  const colocar = (nodo) => {
    if (host.children[pos] !== nodo) host.insertBefore(nodo, host.children[pos] ?? null);
    pos++;
  };

  let rankAlly = 0, rankFoe = 0;
  const ORDEN = { ally: 0, unknown: 1, enemy: 2 };
  [...f.rows].sort((a, b) => ORDEN[grupo(a)] - ORDEN[grupo(b)]).forEach((r) => {
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
      // El texto sólo se toca si cambió: escribirlo igual también cuenta como
      // tocar el DOM, y en una lista que se repinta cuatro veces por segundo
      // conviene no tocar nada que no haga falta.
      const rotulo = t(ROTULO[g]);
      if (h.textContent !== rotulo) h.textContent = rotulo;
      const titulo = g === 'unknown' ? t('side.unknownNote') : '';
      if (h.title !== titulo) h.title = titulo;
      colocar(h);
    }
    colocar(node.el);
  });

  // Lo que quede por detrás sobra: cabeceras de un grupo que ya no está.
  while (host.children.length > pos) host.lastChild.remove();

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
  //
  // Y al lado, lo contrario: declararlo compañero. El log de EQL no da ninguna
  // señal de grupo, así que decirlo tú es la única forma de que deje de salir
  // como «sin identificar». No se ofrece para tus mascotas ni para las de otro
  // jugador, que ya se saben lo que son.
  const excluir = controlesDeFila(r, withPets(fightFor(state.snap))?.rows ?? []);

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

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('mate.title'))}</div>
    <div class="hint">${esc(t('mate.note'))}</div>
    <div class="excl-list" id="mateList">${(state.cfg.companions ?? []).length
      ? (state.cfg.companions ?? []).map((x) => `<span class="excl-item mate"><b>${esc(x)}</b>
          <span class="src ${fuenteDe(x)}">${esc(t(`mate.src.${fuenteDe(x)}`))}</span>
          <button class="petbtn" data-unmate="${esc(x)}">${esc(t('mate.remove'))}</button></span>`).join('')
      : `<span class="hint">${esc(t('mate.empty'))}</span>`}</div>
    ${(state.cfg.notCompanions ?? []).length ? `<div class="hint" style="margin-top:8px">${
    esc(t('mate.rejected'))}</div>
    <div class="excl-list" id="notMateList">${(state.cfg.notCompanions ?? []).map((x) => `<span class="excl-item"><b>${esc(x)}</b>
      <button class="petbtn" data-remate="${esc(x)}">${esc(t('mate.add'))}</button></span>`).join('')}</div>` : ''}

    <!--
      Las mascotas que has declarado tuyas, y las que has dicho que no lo son.
      Esta lista no existía y hacía falta: las declaradas por versiones
      anteriores se quedaban en la configuración sin ningún botón que las
      quitase, porque el único camino para borrarlas nunca se llamó desde aquí.
    -->
    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('share.prefixTitle'))}</div>
    <div class="hint">${esc(t('share.prefixNote'))}</div>
    <input id="sharePrefix" type="text" maxlength="12" style="width:120px"
      placeholder="${esc(t('share.prefixPh'))}" value="${esc(state.cfg.sharePrefix ?? '')}">

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('share.petsTitle'))}</div>
    <div class="hint">${esc(t('share.petsNote'))}</div>
    <select id="sharePets">
      <option value="merge"${(state.cfg.sharePets ?? 'merge') === 'merge' ? ' selected' : ''}>${esc(t('share.petsMerge'))}</option>
      <option value="group"${state.cfg.sharePets === 'group' ? ' selected' : ''}>${esc(t('share.petsGroup'))}</option>
    </select>

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('share.pctTitle'))}</div>
    <div class="hint">${esc(t('share.pctNote'))}</div>
    <select id="sharePct">
      <option value="%"${(state.cfg.sharePct ?? '%') === '%' ? ' selected' : ''}>30%</option>
      <option value="pct"${state.cfg.sharePct === 'pct' ? ' selected' : ''}>30pct</option>
    </select>

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('pet.mineTitle'))}</div>
    <div class="hint">${esc(t('pet.mineNote'))}</div>
    <div class="excl-list" id="petList">${(state.cfg.myPets ?? []).length
      ? (state.cfg.myPets ?? []).map((x) => `<span class="excl-item"><b>${esc(x)}</b>
          <button class="petbtn" data-unpet="${esc(x)}">${esc(t('pet.notMine'))}</button></span>`).join('')
      : `<span class="hint">${esc(t('pet.mineEmpty'))}</span>`}</div>
    ${(state.cfg.notPets ?? []).length ? `<div class="hint" style="margin-top:8px">${esc(t('pet.notMineTitle'))}</div>
    <div class="excl-list" id="notPetList">${(state.cfg.notPets ?? []).map((x) => `<span class="excl-item"><b>${esc(x)}</b>
      <button class="petbtn" data-repet="${esc(x)}">${esc(t('pet.mine'))}</button></span>`).join('')}</div>` : ''}

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
    const r = await window.eql.setExcluded(el.dataset.restore, false);
    state.cfg.excluded = r.excluded ?? r;
    state.rowNodes.clear();
    state.summary = null;
    renderApp();
  }));
  // «Ya no es mía» y «vuelve a serlo»: el mismo camino en los dos sentidos.
  const declararMascota = async (nombre, on) => {
    const r = await window.eql.markPet(nombre, on);
    if (r?.myPets) { state.cfg.myPets = r.myPets; state.cfg.notPets = r.notPets; }
    state.rowNodes.clear();
    state.summary = null;
    refreshFights();
    renderApp();
  };
  // El prefijo se guarda al salir del campo, no en cada tecla: escribir «[EQL]»
  // son seis escrituras en disco y seis avisos al overlay para nada.
  const pref = host.querySelector('#sharePrefix');
  pref?.addEventListener('change', async () => {
    state.cfg.sharePrefix = pref.value;
    await window.eql.setFlag('sharePrefix', pref.value);
  });
  const pets = host.querySelector('#sharePets');
  pets?.addEventListener('change', async () => {
    state.cfg.sharePets = pets.value;
    await window.eql.setFlag('sharePets', pets.value);
  });
  const pct = host.querySelector('#sharePct');
  pct?.addEventListener('change', async () => {
    state.cfg.sharePct = pct.value;
    await window.eql.setFlag('sharePct', pct.value);
  });
  host.querySelectorAll('[data-unpet]').forEach((el) => el.addEventListener('click',
    () => declararMascota(el.dataset.unpet, false)));
  host.querySelectorAll('[data-repet]').forEach((el) => el.addEventListener('click',
    () => declararMascota(el.dataset.repet, true)));
  host.querySelectorAll('[data-remate]').forEach((el) => el.addEventListener('click', async () => {
    const r = await window.eql.setCompanion(el.dataset.remate, true);
    aplicarCompaneros(r);
    state.rowNodes.clear();
    state.summary = null;
    refreshFights();
    renderApp();
  }));
  host.querySelectorAll('[data-unmate]').forEach((el) => el.addEventListener('click', async () => {
    const n = el.dataset.unmate;
    const r = await window.eql.setCompanion(n, false);
    aplicarCompaneros(r);
    state.cfg.excluded = r.excluded ?? state.cfg.excluded;
    // Quien deja de ser compañero deja de poder filtrar por él.
    state.filter.mates = (state.filter.mates ?? []).filter((x) => x !== n);
    state.rowNodes.clear();
    state.summary = null;
    refreshFights();
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
  const sig = p ? `c|${p.spell}|${p.clase}|${(p.declarado ?? []).join('')}` : (viejo ? 'stale' : '');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  // Si ya dijiste que no a ESTA contradicción, no se vuelve a plantear. Otra
  // distinta sí: es otra pregunta.
  if (!sig || sig === state.dismissedPrompt) { host.innerHTML = ''; return; }

  // Dos avisos distintos con la misma forma.
  //
  // Si el trío venía del log, la inferencia ya lo ha corregido sola y lo único
  // que falta es un /who que lo confirme con nivel. Si lo declaraste tú, no se
  // ha tocado nada —tu tabla manda— y lo que hace falta es que decidas: aquí se
  // dice qué se ha medido y se ofrece el renglón nuevo hecho.
  const dec = p?.declarado ?? null;
  const hora = (ms) => (ms ? new Date(ms).toLocaleTimeString() : null);
  const nom = (l) => l.map((c) => t(`cl.${c}`)).join('/');
  // Tres avisos con la misma forma y motivos distintos:
  //   sin `declarado`  — el trío venía del log, la inferencia ya lo corrigió y
  //                      sólo falta un /who que lo confirme con nivel.
  //   fuente 'hechizo' — tu tabla manda y no se ha tocado nada; cuál de las
  //                      tres sale no se mide, así que lo eliges tú.
  //   fuente 'who'     — el juego ha dado el trío entero y el nivel, ya se ha
  //                      tomado, y lo que falta es que la tabla lo recoja.
  const porWho = dec && p.fuente === 'who';

  host.innerHTML = `<div class="pethint">
    <div class="pethint-main">${esc(!p ? t('cls.stale')
      : porWho ? t('cls.whoBeatsTable', { trio: nom(dec), who: nom(p.trio) })
        : dec ? t('cls.contradictionTable', { spell: p.spell, cls: t(`cl.${p.clase}`), trio: nom(dec) })
          : t('cls.contradiction', { spell: p.spell, cls: t(`cl.${p.clase}`) }))}</div>
    ${dec ? '' : '<div class="pethint-cmd">/who</div>'}
    ${p ? `<div class="pethint-sub">${esc(dec ? t('cls.tableAsk') : t('cls.inferred'))}: ${
      p.trio.map((c) => esc(t(`cl.${c}`))).join(' · ')}${
      porWho && p.nivel ? ` · ${esc(p.declaradoNivel && p.declaradoNivel !== p.nivel
        ? t('cls.levelWas', { antes: p.declaradoNivel, ahora: p.nivel })
        : `${t('cls.level')} ${p.nivel}`)}` : ''}</div>` : ''}
    ${porWho ? `
      <div class="pethint-sub">${esc(t('cls.whoWhy'))}</div>
      <div class="pethint-btns">
        <button class="petbtn yes clsSale" data-trio="${esc(p.trio.join(','))}"
          data-level="${p.nivel ?? ''}">${esc(t('cls.tableUpdate'))}</button>
        <button class="petbtn no" id="clsSkip">${esc(t('cls.dismiss'))}</button>
      </div>`
    : dec ? `
      <div class="pethint-sub">${esc(t('cls.tableWins'))}</div>
      <div class="pethint-sub">${esc(p.desde
        ? t('cls.tableWindow', { desde: hora(p.desde), hasta: hora(p.atLog) })
        : t('cls.tableWindowOpen', { hasta: hora(p.atLog) }))}</div>
      <div class="pethint-sub">${esc(t('cls.whichLeft', { cls: t(`cl.${p.clase}`) }))}</div>
      <div class="pethint-btns">${(p.candidatos ?? []).map((c) => `
        <span class="petcand">
          <b>${esc(t(`cl.${c.clase}`))}</b>
          <span class="dim">${esc(c.visto
            ? t('cls.lastSeen', { when: hora(c.visto) })
            : t('cls.neverSeen'))}</span>
          <button class="petbtn yes clsSale" data-trio="${esc(c.trio.join(','))}" data-level=""
            >${esc(t('cls.tableUpdate'))}</button>
        </span>`).join('')}
        <button class="petbtn no" id="clsSkip">${esc(t('cls.dismiss'))}</button>
      </div>` : ''}
  </div>`;

  // El renglón se añade con la hora del hechizo que lo demuestra, no con la de
  // ahora: entre que cambiaste y que pulsas esto pueden haber pasado peleas, y
  // fecharlo al pulsar dejaría fuera justo las que motivaron el aviso.
  //
  // Y sin nivel: cambiar de trío puede hundirlo —manda la clase más baja— así
  // que heredar el del tramo anterior sería justo la mentira que la tabla
  // existe para no contar. Se queda desconocido hasta el primer /who.
  host.querySelectorAll('.clsSale').forEach((el) => el.addEventListener('click', async () => {
    const classes = el.dataset.trio.split(',');
    const r = await window.eql.setTrios([...(state.cfg.trios ?? []),
      { at: p.atLog, classes, level: null, note: `${p.spell} -> ${t(`cl.${p.clase}`)}` }]);
    state.cfg.trios = r.trios;
    state.needsRebuild = r.needsRebuild;
    showTrioRebuild();
    host.dataset.sig = '';
    renderApp();
  }));
  host.querySelector('#clsSkip')?.addEventListener('click', () => {
    state.dismissedPrompt = sig;
    host.innerHTML = '';
  });
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
  // Responder aquí es una declaración como cualquier otra: se guarda, se puede
  // ver en Ajustes y se puede deshacer desde allí o desde la fila.
  host.querySelectorAll('.petbtn.yes').forEach((el) => el.addEventListener('click', async () => {
    const r = await window.eql.markPet(el.dataset.name, true);
    if (r?.myPets) { state.cfg.myPets = r.myPets; state.cfg.notPets = r.notPets; }
    host.dataset.sig = '';
    state.rowNodes.clear();
    renderApp();
  }));
  host.querySelectorAll('.petbtn.no').forEach((el) => el.addEventListener('click', async () => {
    await window.eql.dismissPet(el.dataset.name);
    // «No es mía» también se recuerda: si no, la siguiente invocación con ese
    // mismo nombre —en EQL se reciclan— volvería a preguntarte por ella.
    const r = await window.eql.markPet(el.dataset.name, false);
    if (r?.myPets) { state.cfg.myPets = r.myPets; state.cfg.notPets = r.notPets; }
    host.dataset.sig = '';
    state.rowNodes.clear();
    renderApp();
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
        <button id="btnChat" title="${esc(t('share.tip'))}">${t('share.copy')}</button>
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
  // Copiar para el chat. Mismo texto que el botón del overlay —sale del mismo
  // sitio, `src/share.js`— para que no acaben divergiendo dos formatos que
  // deberían ser uno. El aviso va en el propio botón, sin nodos nuevos.
  $('btnChat')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const b = e.currentTarget;
    // Los jefes salen de la wiki y de lo que hayas dicho tú; sin respuesta aún,
    // `jefesDe` deduce. Se piden por si acaso, para la próxima vez.
    pedirRaid((f.rows ?? []).filter((r) => r.side === 'enemy').map((r) => r.name), null);
    const { texto } = fightToChat(f, {
      prefijo: state.cfg.sharePrefix ?? '', pct: state.cfg.sharePct ?? undefined,
      self: state.snap?.self ?? null, pets: state.cfg.sharePets ?? undefined,
      named: jefesDe(f.rows ?? [], { manual: raidManual(), wiki: raidWiki }),
    });
    const bien = await copiarAlPortapapeles(texto);
    b.textContent = t(bien ? 'share.done' : 'share.fail');
    b.classList.add(bien ? 'ok' : 'bad');
    clearTimeout(b._t);
    b._t = setTimeout(() => { b.textContent = t('share.copy'); b.classList.remove('ok', 'bad'); }, 1600);
  });
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
/**
 * Vuelve a pedir el resumen con los mismos criterios con que se abrió.
 *
 * Hace falta porque decir quién es alguien cambia el reparto: asignar una
 * mascota a su dueño mueve su daño de sitio, y volver a pintar lo que ya
 * teníamos en memoria enseñaría las cifras de antes.
 */
async function recargarResumen() {
  const base = { mergePets: state.cfg.mergePets, petLabel: t('pets.merged'),
    myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] };
  if (state.summaryFrom === 'pick') {
    state.summary = await window.eql.aggregate({ ...base, uids: [...state.picked] });
  } else {
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.summary = await window.eql.aggregate({ ...base, sinceMs: r?.ms ?? null,
      foe: state.filter.foe || null, mates: state.filter.mates ?? [] });
  }
  renderSummary();
}

function renderSummary() {
  // La declaración se aplica también aquí, y por la misma razón que en la
  // pelea: se guarda lo que se midió, y quién es cada uno lo dices tú después.
  const a = state.summary && { ...state.summary, rows: marcarCompaneros(state.summary.rows) };
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
      <h2>${esc(state.summaryFrom === 'pick' ? t('pick.title') : t('sum.title'))}</h2>
      ${state.summaryFrom !== 'pick' && (state.filter.mates ?? []).length
        ? `<span class="mates-tag" title="${esc(t('mate.filterAll'))}">${esc(t('mate.filter'))} ${
            esc(state.filter.mates.join(', '))}</span>` : ''}
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
        && !r.petOf && !r.merged && !isMyPet(r.name) && !r.mate).map((r) => r.name);
      if (!unknown.length) return '';
      return `<div class="pethint sum-pethint">
        <div class="pethint-main">${esc(t('pet.which'))}</div>
        <div class="pethint-cmd">/pet who leader</div>
        <div class="pethint-sub">${esc(t('pet.hintSum', { names: unknown.slice(0, 6).join(', ') }))}</div>
      </div>`;
    })()}

    ${state.filter.foe
      ? foeDossier(a.foes.find((x) => x.name.toLowerCase().includes(state.filter.foe.toLowerCase()))
        ?? a.foes[0])
      : ''}

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
  // botón se pintaba inerte. Ahora el nombre va en el propio botón, así que el
  // expediente funciona igual aquí que en la enciclopedia.
  host.querySelector('.dos-wiki')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.eql.openWiki(e.currentTarget.dataset.wiki);
  });
  cablearRaid(host);
  $('sumMerge')?.addEventListener('change', async (e) => {
    state.cfg.mergePets = e.target.checked;
    await window.eql.setMergePets(e.target.checked);
    const r = RANGES.find((x) => x.key === state.filter.range);
    state.openSumRows.clear();
    state.summaryFrom = 'range';
    state.summary = await window.eql.aggregate({ sinceMs: r?.ms ?? null, foe: state.filter.foe || null,
      mates: state.filter.mates ?? [],
      mergePets: e.target.checked, petLabel: t('pets.merged'),
      myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] });
    renderSummary();
  });
  host.querySelectorAll('.sum-row').forEach((el) => el.addEventListener('click', () => {
    const nm = el.dataset.row;
    state.openSumRows.has(nm) ? state.openSumRows.delete(nm) : state.openSumRows.add(nm);
    renderSummary();
  }));
  // Los controles de «quién es quién» viven dentro de la fila desplegada, y la
  // fila entera responde al clic plegándose. Se atienden en fase de captura
  // para cortar el suceso antes de que llegue a ella: si no, pulsar un botón
  // cerraría el desglose bajo el cursor.
  //
  // Y se cuelgan de `#sumRoot`, que se construye entero en cada repintado, y NO
  // de `#bodyGrid`, que sobrevive a todos: reemplazar el contenido de un nodo no
  // le quita sus escuchadores, así que colgarlos ahí apilaba uno por repintado y
  // al elegir un dueño se llamaba al puente tantas veces como veces se hubiera
  // pintado el resumen.
  const raiz = $('sumRoot');
  raiz.addEventListener('click', async (e) => {
    if (e.target.closest?.('.petof')) { e.stopPropagation(); return; }
    const btn = e.target.closest?.('.excl-btn');
    if (!btn) return;
    e.stopPropagation();
    const r = btn.dataset.mate
      ? await window.eql.setCompanion(btn.dataset.mate, btn.dataset.on === '1')
      : await window.eql.setExcluded(btn.dataset.excl, true);
    state.cfg.excluded = r.excluded ?? state.cfg.excluded;
    aplicarCompaneros(r);
    state.rowNodes.clear();
    if (btn.dataset.mate) refreshFights();
    await recargarResumen();
  }, true);
  raiz.addEventListener('change', async (e) => {
    const sel = e.target.closest?.('.petof-sel');
    if (!sel) return;
    e.stopPropagation();
    await asignarMascota(sel.dataset.pet, sel.value || null);
    state.rowNodes.clear();
    await recargarResumen();
  }, true);
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
 * Sólo aparecen si de verdad has peleado con ese enemigo en más de una: si no,
 * repetirían la cabecera. Y llevan lo que cambia —vida, golpe máximo,
 * habilidades— y no las resistencias, que se han medido y apenas se distinguen.
 */
/**
 * Las cinco dificultades de un enemigo, una al lado de otra.
 *
 * Sale SIEMPRE, aunque sólo haya peleado en una. Antes hacía falta `ds.length
 * >= 2` y con ello «sólo lo he visto en D2» y «D2 es la única que hay» se veían
 * igual: sin bloque. La rejilla completa dice cuál es cuál, porque la celda
 * vacía afirma que ahí no has entrado y eso es un dato.
 *
 * Cada tarjeta es un enlace: dentro de una ficha no caben cinco juegos de
 * resistencias, vida, golpe máximo, habilidades y botín, así que desde aquí se
 * entra a una dificultad y se ve entera y sola.
 */
function diffBlocks(f) {
  const ds = (f.dificultades ?? []).filter((d) => d.fights > 0);
  if (!ds.length) return '';
  const porClave = new Map(ds.map((d) => [d.key, d]));
  // Las cinco columnas siempre, y detrás los dos cajones de ausencia, que sólo
  // se pintan si existen: no haberte cruzado nunca una pelea sin zona no es
  // información que merezca un hueco.
  const celdas = [...[0, 1, 2, 3, 4].map((n) => [`D${n}`, n]),
    ['sin marca', null], ['sin zona', 'z']];

  const tarjeta = ([clave, valor]) => {
    const d = porClave.get(clave);
    const rotulo = valor === 'z' ? t('enc.noZone')
      : (valor === null ? t('enc.noDiffCol') : `D${valor}${DIF_TAGS[valor] ? ' ' + DIF_TAGS[valor] : ''}`);
    if (!d) {
      // Sin peleas no se pinta hueco para los dos cajones de ausencia: no
      // haberte encontrado nunca una pelea «sin zona» no es información.
      if (valor === null || valor === 'z') return '';
      return `<div class="difcard void" title="${esc(t('enc.notFought'))}">
        <div class="difcard-h">${esc(rotulo)}</div>
        <div class="difcard-none">—</div></div>`;
    }
    const res = (d.spells ?? []).slice(0, 3);
    return `<button class="difcard has" data-foedif="${esc(f.name)}" data-dkey="${esc(clave)}">
      <div class="difcard-h">${esc(rotulo)}
        ${(d.modes ?? []).length ? `<span class="dim">${esc(d.modes.map((m) => `${m.mode} ${m.n}`).join(' · '))}</span>` : ''}</div>
      <div class="difcard-kv">
        <span><b>${d.fights}</b> ${esc(t('sum.fights', { n: d.fights }))}</span>
        ${d.kills ? `<span><b>${d.kills}</b> ${esc(t('metric.kills', { n: d.kills }))}</span>` : ''}
        ${d.deaths ? `<span class="foe"><b>${d.deaths}</b> ${esc(t('enc.killedYouShort'))}</span>` : ''}
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
      ${res.length ? `<div class="difcard-res">${res.map((x) => resistCell(x)).join('')}</div>` : ''}
      ${(d.lootList ?? []).length ? `<div class="difcard-loot">${
      d.lootList.slice(0, 4).map((l) => `<span>${esc(l.item)}${l.n > 1 ? ` <b>×${l.n}</b>` : ''}</span>`).join('')}${
      d.lootList.length > 4 ? `<span class="dim">${esc(t('tip.more', { n: d.lootList.length - 4 }))}</span>` : ''}</div>` : ''}
      <span class="difcard-go">${esc(t('enc.openDiff'))}</span>
    </button>`;
  };

  return `<div class="dos-block">
    <div class="eyebrow">${esc(t('foe.byDiff'))} · ${esc(t('foe.measured'))}</div>
    <div class="hint">${esc(t('foe.diffNote'))}</div>
    <div class="difgrid five">${celdas.map(tarjeta).join('')}</div>
    <div class="hint">${esc(t('foe.castNote'))}</div>
  </div>`;
}

/**
 * Una resistencia con su tamaño de muestra, siempre.
 *
 * El `n` no es un adorno: partido por dificultad, un «86% entra» puede venir de
 * 14 intentos o de 400 y sobre la pantalla se leen igual. Por debajo de seis
 * intentos se marca en gris, que es la forma de decir «esto no afirma nada» sin
 * escondértelo ni escribir un párrafo al lado.
 */
function resistCell(x) {
  const n = x.n ?? (x.landed + x.resisted);
  const flojo = n < 6;
  return `<span class="res${flojo ? ' thin' : ''}" title="${esc(t('enc.sampleNote', { n }))}">
    ${esc(x.spell)} <b class="${flojo ? 'dim' : (x.rate >= 0.6 ? 'bad' : x.rate <= 0.2 ? 'good' : '')}">${
  Math.round((1 - x.rate) * 100)}%</b> <span class="dim">n=${n}</span></span>`;
}

/**
 * Un enemigo en UNA dificultad, entera y sola.
 *
 * Nada de lo que sale aquí está promediado con otra dificultad: la vida, el
 * golpe máximo, las resistencias, las habilidades y el botín son los de esta
 * celda. Lo único que viene de la ficha común son los niveles y las zonas, y va
 * dicho.
 */
function encFoeDif() {
  const d = state.enc.foeDif;
  if (!d) return `${encCrumb()}<div class="hint">${esc(t('enc.noMatch'))}</div>`;
  const abTot = (d.abilities ?? []).reduce((n, x) => n + x.sum, 0) || 1;

  return `${encCrumb()}
    <div class="enc-h">
      <h2>${esc(d.name)}</h2>
      <span class="difpill">${esc(d.label ?? t('enc.noDiffCol'))}</span>
      ${(d.modes ?? []).length ? `<span class="hint">${esc(modosDe(d))}</span>` : ''}
    </div>
    <div class="dhermanas">${(d.hermanas ?? []).map((h) => `<button class="dtab${
    h.key === d.key ? ' on' : ''}" data-foedif="${esc(d.name)}" data-dkey="${esc(h.key)}">${esc(h.label ?? t('enc.noDiffCol'))} <span class="dim">${h.fights}</span></button>`).join('')}</div>

    <div class="metrics">
      ${d.hp ? `<div class="metric"><b>${n0(d.hp.avg)}</b><span>${esc(t('foe.hp'))}</span></div>` : ''}
      <div class="metric"><b>${d.fights}</b><span>${esc(t('sum.fights', { n: d.fights }))}</span></div>
      ${d.kills ? `<div class="metric"><b>${d.kills}</b><span>${esc(t('metric.kills', { n: d.kills }))}</span></div>` : ''}
      ${d.deaths ? `<div class="metric foe"><b>${d.deaths}</b><span>${esc(t('enc.killedYouShort'))}</span></div>` : ''}
      <div class="metric"><b>${n0(d.damageTo)}</b><span>${esc(t('foe.youDealt'))}</span></div>
      <div class="metric foe"><b>${n0(d.taken)}</b><span>${esc(t('foe.dealtYou'))}</span></div>
      ${d.maxHit ? `<div class="metric foe"><b>${n0(d.maxHit)}</b><span>${esc(t('foe.maxHit'))}</span></div>` : ''}
    </div>
    ${d.hp && d.hp.n > 1 ? `<div class="hint">${esc(t('foe.hpNote'))} ${
    esc(t('foe.hpFrom', { n: d.hp.n }))}: ${n0(d.hp.min)} – ${n0(d.hp.max)}</div>` : ''}

    ${(d.spells ?? []).length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('foe.weak'))} · ${esc(t('foe.measured'))}</div>
      <div class="hint">${esc(t('enc.resistDiffNote'))}</div>
      <div class="reslist">${d.spells.map((x) => resistCell(x)).join('')}</div>
    </div>` : ''}

    ${(d.abilities ?? []).length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('foe.howHits'))}</div>
      <div class="hint">${esc(t('enc.abilitiesNote'))}</div>
      ${d.abilities.map((x) => `<div class="foe-det-l">
        <i class="seg ${typeClass(x.type)}"></i><span>${esc(x.name)}</span>
        <b>${n0(x.sum)}</b><span class="dim">${Math.round(x.sum / abTot * 100)}% · ×${x.n}${
      d.fights > 1 ? ` · ${x.inFights}/${d.fights}` : ''}</span>
      </div>`).join('')}</div>` : ''}

    ${(d.lootList ?? []).length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('foe.drops'))}</div>
      <div class="hint">${esc(t('enc.lootDiffNote', { d: d.label ?? t('enc.noDiffCol'), k: d.kills }))}</div>
      <div class="loot">${d.lootList.map((l) => `<div class="loot-row">
        <button class="loot-item" data-item="${esc(l.item)}">${esc(l.item)}</button>
        ${l.n > 1 ? `<span class="num dim">×${l.n}</span>` : ''}</div>`).join('')}</div></div>` : ''}

    ${(d.zones ?? []).length ? `<div class="hint">${esc(t('foe.zones'))}: ${esc(d.zones.join(', '))}</div>` : ''}
    ${(d.levels ?? []).length > 1 || d.someWithoutLevel
    ? `<div class="hint">${esc(t('lvl.mixed', {
      levels: [...(d.levels ?? []), ...(d.someWithoutLevel ? [t('lvl.unknown')] : [])].join(', ') }))}</div>` : ''}`;
}

/**
 * @param {object} f  la ficha del enemigo, tal cual la devuelve el contador
 *
 * Recibe la ficha en vez de buscarla: el resumen la saca de lo que tengas
 * escrito en el filtro y la enciclopedia de lo aprendido, y son la misma cosa
 * con la misma forma. Buscándola aquí dentro sólo podía servir a uno de los dos.
 */
/**
 * @param {string} habilidades  el bloque detallado de sus habilidades, cuando
 *   quien llama tiene con qué construirlo. En el resumen del tramo no lo hay y
 *   se cae a la lista corta de siempre.
 */
function foeDossier(f, habilidades = '') {
  if (!f) return '';
  if (!mobCache.has(f.name)) loadMob(f.name);
  pedirRaid([f.name], renderApp);
  const mob = mobCache.get(f.name);
  const jefe = jefeDe(f.name, f.hp?.avg ?? 0);
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const spells = (f.spells ?? []).filter((x) => x.landed + x.resisted >= 2);
  const abTot = (f.abilities ?? []).reduce((n, x) => n + x.sum, 0) || 1;

  return `<div class="dossier">
    <div class="dos-head">
      <h3>${esc(f.name)}</h3>
      <!--
        La insignia dice DOS cosas, y las dos hacen falta: si es jefe y de dónde
        se sabe. Igual que con las clases y con los compañeros — una etiqueta
        sin procedencia acaba leyéndose como un hecho, y mientras la wiki no
        conteste esto es una suposición sobre la vida y el artículo del nombre.
      -->
      <span class="raidmark ${jefe.raid ? 'si' : 'no'} ${jefe.src}"
        title="${esc(t(`raid.src.${jefe.src}`))}">${
  esc(jefe.raid ? t('raid.isRaid') : t('raid.notRaid'))} <i>${esc(t(`raid.short.${jefe.src}`))}</i></span>
      <button class="lnk" data-raid="${esc(f.name)}" data-to="${jefe.raid ? '0' : '1'}"
        title="${esc(t('raid.setNote'))}">${esc(jefe.raid ? t('raid.unset') : t('raid.set'))}</button>
      ${state.cfg.raidMobs?.[f.name] !== undefined && state.cfg.raidMobs?.[f.name] !== null
    ? `<button class="lnk" data-raid="${esc(f.name)}" data-to="auto">${esc(t('raid.clear'))}</button>` : ''}
      ${mob ? `<button class="lnk dos-wiki" data-wiki="${esc(f.name)}">${esc(t('foe.seeWiki'))}</button>` : ''}
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

    ${habilidades || (f.abilities?.length
      ? `<div class="dos-block"><div class="eyebrow">${esc(t('foe.howHits'))}</div>
      ${f.abilities.map((x) => `<div class="foe-det-l">
        <i class="seg ${typeClass(x.type)}"></i><span>${esc(x.name)}</span>
        <b>${n0(x.sum)}</b><span class="dim">${Math.round(x.sum / abTot * 100)}% · ×${x.n}</span>
      </div>`).join('')}</div>` : '')}

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
    ${controlesDeFila(r, state.summary?.rows ?? [])}
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

/**
 * Mis hechizos, dentro de la enciclopedia.
 *
 * Era una pantalla propia detrás de un botón de la barra de combate, que es un
 * sitio raro para algo que no se mira durante una pelea sino después. La tabla,
 * las marcas de fiabilidad y los cooldowns son los mismos que llevaban dos
 * versiones funcionando: lo único que cambia es por dónde se llega y que ahora
 * abre con un resumen.
 */
/**
 * La fecha y la hora de un instante, en el idioma elegido.
 *
 * VIVE AQUÍ Y NO DENTRO DE CADA PÁGINA. Estaba declarada como `const` local en
 * tres funciones y usada en SEIS, así que la ficha de un hechizo, el bloque de
 * periodos y la página de progreso lanzaban ReferenceError al pintarse. Y un
 * fallo al construir la cadena revienta antes de asignar el `innerHTML`: la
 * página no se queda a medias, es que no cambia — pulsas y no pasa nada, que
 * es lo más difícil de reconocer como avería.
 *
 * Las dos que había además fijaban 'es-ES' a mano, en una aplicación con cinco
 * idiomas.
 */
const cuando = (at) => new Date(at).toLocaleString(langInfo().code,
  { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * La ficha de un hechizo: las dos mitades de lo que hace, y su historia.
 *
 * La sección leía sólo el daño. Un drenaje que hace 1.093.644 de daño y 796.751
 * de curación estaba contado a medias, y diez hechizos que sólo curan no
 * existían en ninguna parte. Aquí salen los dos lados.
 *
 * Y la historia va PARTIDA por nivel y dificultad, con las dos condiciones de
 * siempre: lo que no llega a `minSerie` peleas no se dibuja —con tres puntos no
 * hay tendencia, hay tres puntos— y lo que se queda fuera se dice.
 */
function encHechizo() {
  const d = state.enc.spell;
  if (!d) return `${encCrumb()}<div class="hint">${esc(t('enc.noMatch'))}</div>`;
  const soloCura = d.kind === 'heal' || d.kind === 'unknownHeal';
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;

  // Una barra por punto, con su altura relativa. No es una gráfica de tiempo
  // real: los puntos van en orden pero no a escala, porque entre dos peleas
  // pueden pasar diez segundos o dos días y estirar el eje por eso no dice nada.
  const barras = (g) => {
    const campo = soloCura ? 'heal' : 'sum';
    const tope = Math.max(1, ...g.puntos.map((p) => p[campo]));
    return `<div class="sparks">${g.puntos.map((p) => `<i style="height:${
      Math.max(4, Math.round(p[campo] / tope * 100))}%" title="${esc([
      p.label ?? '', cuando(p.at),
      soloCura ? `${t('cat.healed')} ${n0(p.heal)} · ${p.healN} ${t('cat.uses')}`
        : `${n0(p.sum)} · ${p.n} ${t('cat.uses')}${p.crits ? ` · ${p.crits} crit` : ''}`,
    ].filter(Boolean).join('\n'))}"></i>`).join('')}</div>`;
  };

  return `${encCrumb()}
    <div class="enc-h">
      <h2>${spellIcon(d.name)}${esc(d.name)}</h2>
      ${d.kind === 'ds' ? `<span class="difpill">${esc(t('cat.ds'))}</span>` : ''}
      ${d.kind === 'unknownHeal' ? `<span class="difpill">${esc(t('cat.unknownHeal'))}</span>` : ''}
      ${d.unresistable ? `<span class="difpill">${esc(t('cat.unresistable'))}</span>` : ''}
    </div>
    ${d.kind === 'ds' ? `<div class="hint">${esc(t('cat.dsNote'))}</div>` : ''}
    ${d.kind === 'unknownHeal' ? `<div class="hint">${esc(t('cat.unknownHealNote'))}</div>` : ''}

    <div class="metrics">
      ${d.uses ? card(n0(d.uses), t('cat.uses')) : ''}
      ${d.uses ? card(n0(d.total), t('cat.damage')) : ''}
      ${d.uses ? card(n0(d.avg), t('cat.avg')) : ''}
      ${d.uses ? card(`${n0(d.min)}–${n0(d.max)}`, t('cat.range')) : ''}
      ${d.uses ? card(`${Math.round(d.critRate * 100)}%`, t('cat.crits')) : ''}
      ${d.heal ? card(n0(d.heal), t('cat.healed'), 'heal') : ''}
      ${d.healN ? card(n0(d.healAvg), t('cat.healAvg'), 'heal') : ''}
      ${card(n0(d.fights), t('cat.inFights'))}
    </div>
    ${d.heal && d.uses ? `<div class="hint">${esc(t('cat.drainNote'))}</div>` : ''}

    ${(d.levels ?? []).length > 1 ? `<div class="hint">${esc(t('cat.levelsNote', {
    levels: d.levels.join(', ') }))}</div>` : ''}

    ${d.series.length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('cat.byTranche'))} · ${esc(t('foe.measured'))}</div>
      <div class="hint">${esc(t('cat.trancheNote', { n: d.minSerie }))}</div>
      ${d.series.map((g) => `<div class="serie">
        <div class="serie-h">
          <b>${esc(g.level ? t('lvl.level', { n: g.level }) : t('lvl.unknown'))}</b>
          <span class="dpill">${esc(encDiffLabel(g.diff))}</span>
          <span class="dim">${esc(t('sum.fights', { n: g.fights }))}</span>
          ${g.uses ? `<span class="num">${esc(t('cat.avg'))} <b>${n0(g.avg)}</b></span>` : ''}
          ${g.uses ? `<span class="num dim">${esc(t('cat.max'))} ${n0(g.max)}</span>` : ''}
          ${g.uses ? `<span class="num dim">${Math.round(g.critRate * 100)}% crit</span>` : ''}
          ${g.healN ? `<span class="num heal">${esc(t('cat.healAvg'))} <b>${n0(g.healAvg)}</b></span>` : ''}
        </div>
        ${barras(g)}
      </div>`).join('')}
    </div>` : `<div class="hint">${esc(t('cat.noTranche', { n: d.minSerie }))}</div>`}

    ${d.descartadas.length ? `<div class="hint">${esc(t('cat.dropped', {
    n: d.descartadas.length,
    f: d.descartadas.reduce((a, x) => a + x.fights, 0),
  }))} — ${d.descartadas.map((x) => `${x.level ? `n${x.level}` : t('lvl.unknown')} ${encDiffLabel(x.diff)} (${x.fights})`).join(', ')}</div>` : ''}

    ${(d.byFoe ?? []).length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('cat.vsFoes'))}</div>
      <div class="hint">${esc(t('cat.vsFoesNote'))}</div>
      ${d.byFoe.map((c) => `<div class="foe-det-l">
        <span>${esc(c.foe)} <span class="dim">${esc(encDiffLabel(c.diff))}</span></span>
        <b class="${c.rate >= 0.6 ? 'bad' : c.rate <= 0.2 ? 'good' : ''}">${Math.round((1 - c.rate) * 100)}%</b>
        <span class="dim">${c.landed}/${c.landed + c.resisted}</span>
      </div>`).join('')}</div>` : ''}

    ${d.cooldown ? `<div class="hint">${esc(t('cat.cdNote', { s: secs(d.cooldown) }))}</div>` : ''}`;
}

function encHechizos() {
  const c = state.catalog;
  if (!c || !c.spells?.length) {
    return `${encCrumb()}<div class="empty"><h2>${esc(t('enc.emptySpells'))}</h2>
      <p class="hint">${esc(t('enc.emptySpellsNote'))}</p></div>`;
  }

  // Sólo se enseña «efectivo» si aporta algo: mientras todo entre al 100% es
  // una columna que repite a la de al lado.
  const hayResistencias = c.spells.some((s) => s.landRate !== null && s.landRate < 0.995);

  const fila = (s) => {
    const pocos = s.uses < MIN_USOS;
    const desde = t('est.from', { fights: s.fights, secs: s.uses });
    const medio = pocos ? est(n0(s.avg), desde) : `<b>${n0(s.avg)}</b>`;
    // La fila abre la ficha del hechizo. Los escudos de daño y la curación sin
    // identificar también: tienen menos que contar, pero tienen historia.
    return `<div class="cat-row abre" data-spell="${esc(s.name)}">
      <span class="cat-name">${spellIcon(s.name)}${esc(s.name)}${s.unresistable
        ? ` <span class="tagx" title="${esc(t('cat.unresistable'))}">∅</span>` : ''}${
  s.kind === 'ds' ? ` <span class="tagx" title="${esc(t('cat.dsNote'))}">${esc(t('cat.ds'))}</span>` : ''}${
  s.kind === 'unknownHeal' ? ` <span class="tagx" title="${esc(t('cat.unknownHealNote'))}">?</span>` : ''}${
  s.heal ? ` <span class="tagheal" title="${esc(t('cat.alsoHeals', { n: n0(s.heal) }))}">+${n0(s.heal)}</span>` : ''}</span>
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

  // ── El resumen con el que abre ────────────────────────────────────────
  const usos = c.spells.reduce((n, s) => n + s.uses, 0);
  const daño = c.spells.reduce((n, s) => n + s.total, 0);
  const entran = c.spells.reduce((n, s) => n + s.landed, 0);
  const intentos = c.spells.reduce((n, s) => n + s.landed + s.resisted, 0);
  const mejor = c.spells.filter((s) => s.uses >= MIN_USOS).sort((a, b) => b.avg - a.avg)[0] ?? null;
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const cds = (c.cooldowns ?? []).filter((x) => x.seconds > 0);

  return `${encCrumb()}
    <div class="enc-h"><h2>${esc(t('enc.hechizos'))}</h2></div>
    <div class="metrics">
      ${card(c.spells.length, t('enc.spellsN', { n: c.spells.length }))}
      ${card(n0(usos), t('cat.uses'))}
      ${card(n0(daño), t('metric.total'))}
      ${intentos >= 4 ? card(`${Math.round(entran / intentos * 100)}%`, t('cat.lands')) : ''}
      ${card(n0(c.fights ?? 0), t('sum.fights', { n: c.fights ?? 0 }))}
    </div>
    ${mejor ? `<div class="hint">${esc(t('enc.spellsTop', {
      name: mejor.name, avg: n0(mejor.avg), n: mejor.uses }))}</div>` : ''}
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
        <span>${spellIcon(x.name)}${esc(x.name)}</span>
        <b>${secs(x.seconds)}</b>
        <span class="dim">${x.attempts} ${esc(t('cat.cdAttempts'))}${
          x.source === 'una sola muestra' ? ` · ${esc(t('cat.oneSample'))}` : ''}</span>
        <span class="${x.countable ? 'dim' : 'gap'}" ${x.countable ? '' : `title="${esc(t('cat.notCountable'))}"`}>${
          x.countable ? `${n0(x.uses)} ${esc(t('cat.cdUses'))}` : esc(t('cat.notCountable'))}</span>
      </div>`).join('')}` : ''}

    ${libroHTML(c.book)}`;
}

/**
 * El libro: lo que consta que tienes, y de eso, lo que no usas.
 *
 * La tabla de arriba mide lo lanzado. Esto mide lo contrario, que es un dato
 * distinto y que ninguna tabla de uso puede dar: un hechizo que no aparece en
 * ningún sitio puede ser que no lo tengas o que lo tengas parado, y son cosas
 * muy diferentes. El registro sabe distinguirlas porque anota cuándo escribes,
 * memorizas o compras.
 *
 * Cada uno lleva de dónde consta, porque las tres constancias no valen igual:
 * escrito es tenerlo en el libro, comprado es haberlo pagado, y memorizado es
 * haberlo llevado puesto. Un hechizo que sólo consta memorizado pudo haberse
 * quedado atrás hace veinte niveles.
 *
 * Y los lanzados sin constancia se enseñan aparte en vez de esconderlos: son
 * los de antes de que empezara este registro —en esta partida, también los de
 * clases anteriores— y decir cuántos hay es más honesto que dar 84 como si
 * fuera el libro entero.
 */
function libroHTML(b) {
  if (!b || !b.known) return '';
  const sinUsar = b.spells.filter((x) => !x.used);
  const via = (v) => `<span class="tagx" title="${esc(t(`book.via.${v}.note`))}">${esc(t(`book.via.${v}`))}</span>`;
  // El libro enseña el día, sin la hora: aquí la constancia es de una fecha,
  // no de un instante.
  const soloFecha = (at) => new Date(at).toLocaleDateString(langInfo().code,
    { day: 'numeric', month: 'short', year: 'numeric' });
  return `
    <div class="sec-title eyebrow" style="margin-top:22px">${esc(t('book.title'))}</div>
    <div class="hint">${esc(t('book.note'))}</div>
    <div class="metrics">
      <div class="metric"><b>${b.known}</b><span>${esc(t('book.known'))}</span></div>
      <div class="metric"><b>${b.unused}</b><span>${esc(t('book.unused'))}</span></div>
    </div>
    ${sinUsar.length ? sinUsar.map((x) => `<div class="foe-det-l">
      <span>${spellIcon(x.name)}${esc(x.name)}</span>
      <span>${x.vias.map(via).join(' ')}</span>
      <span class="dim">${x.at ? esc(soloFecha(x.at)) : ''}</span>
    </div>`).join('') : `<div class="hint">${esc(t('book.allUsed'))}</div>`}
    ${b.sinConstancia.length ? `<div class="hint" style="margin-top:12px">${
      esc(t('book.noRecord', { n: b.sinConstancia.length }))}<br>${
      esc(b.sinConstancia.join(' · '))}</div>` : ''}`;
}

// ═══════════ Enciclopedia ═══════════
/**
 * La rejilla de entrada.
 *
 * El acento de cada tarjeta no se elige por gusto: es el color que esa cosa ya
 * tiene en la aplicación. El botín es verde porque su bloque lleva el filete
 * verde desde siempre, el enemigo es rojo porque lo es su expediente, y las
 * zonas se llevan el azul, que es el color con el que la interfaz señala.
 */
/**
 * Seis, no siete.
 *
 * «Habilidades de los enemigos» era una sección propia y ahora vive dentro de
 * cada enemigo, que es donde se busca: llegar dos veces al mismo sitio por dos
 * caminos distintos no es más información, es más camino.
 *
 * Con cuatro columnas, seis salen 4+2 y no dejan ninguna huérfana en su fila
 * —el problema era el 6+1—, así que el hueco no hay que rellenarlo. Inventar
 * una sección para tapar un hueco es la peor razón para construirla.
 */
const ENC_SECTIONS = [
  { key: 'zonas', accent: 'var(--t-cold)' },
  { key: 'enemigos', accent: 'var(--t-ds)' },
  { key: 'botin', accent: 'var(--t-poison)' },
  { key: 'hechizos', accent: 'var(--t-magic)' },
  { key: 'progreso', accent: 'var(--t-fire)' },
  { key: 'muertes', accent: 'var(--t-disease)' },
];

/** Las secciones que ya se pueden abrir. Las demás se pintan y no responden. */
const ENC_ABIERTAS = ['zonas', 'enemigos', 'botin', 'hechizos', 'progreso', 'muertes'];

/**
 * Los iconos de hechizo de la wiki, por nombre.
 *
 * Se piden en lote para lo que se va a pintar y se guardan del otro lado, así
 * que a partir de la segunda vez no hay viaje. Mientras no han llegado, las
 * filas se pintan sin icono y no pasa nada: el icono identifica, no informa.
 */
const iconCache = new Map();

async function pedirIconos(nombres, repintar) {
  const faltan = [...new Set(nombres.filter(Boolean))].filter((n) => !iconCache.has(n));
  if (!faltan.length) return;
  for (const n of faltan) iconCache.set(n, null);   // no se pide dos veces
  try {
    const pares = (await window.eql.spellIcons?.(faltan)) ?? [];
    for (const [n, d] of pares) iconCache.set(n, d);
    if (pares.length) repintar?.();
  } catch { /* sin red: se queda sin icono, que no es un error */ }
}

/**
 * El icono de un hechizo, o nada.
 *
 * Que no haya icono NO es un hueco que rellenar: `hits` no lo tiene porque no
 * es un hechizo, y ahí no debe verse ni un recuadro vacío ni un interrogante.
 * Lo que no es un hechizo simplemente no lleva imagen.
 */
const spellIcon = (name) => {
  const d = iconCache.get(name);
  return d ? `<img class="sicon" src="${d}" alt="" aria-hidden="true">` : '';
};

/**
 * Con separador de millares, pero sin romper el singular.
 *
 * `t()` elige la forma de «1 combate» comparando `n === 1`, y un `'1'` con
 * comillas no es 1: pasando siempre el número formateado, el singular dejaba de
 * existir y salía «1 combates».
 */
const nPlural = (v) => (v === 1 ? 1 : n0(v));

/** El recuento de una sección, ya redactado, o `null` si aún no hay nada. */
function encCount(key) {
  const c = state.encCounts?.[key];
  if (!c) return null;
  if (key === 'zonas') return c.zonas
    ? `${t('enc.nZones', { n: nPlural(c.zonas) })} · ${t('enc.nSheets', { n: nPlural(c.fichas) })}` : null;
  if (key === 'enemigos') return c.fichas
    ? `${t('enc.nSheets', { n: nPlural(c.fichas) })} · ${t('enc.nFights', { n: nPlural(c.peleas) })}` : null;
  if (key === 'botin') return c.objetos
    ? `${t('enc.nItems', { n: nPlural(c.objetos) })} · ${t('enc.fromN', { n: nPlural(c.de) })}` : null;
  if (key === 'habilidades') return c.habilidades
    ? `${t('enc.nAbilities', { n: nPlural(c.habilidades) })}` : null;
  return null;
}

/** Ida y vuelta por la enciclopedia. Cada nivel pide sus datos y repinta. */
async function encGo(page, args = {}) {
  const e = state.enc;
  // Lo escrito en el buscador es de la lista que estabas mirando: llevarlo a la
  // siguiente enseñaría una lista filtrada por algo que no has escrito ahí.
  if (page !== e.page) e.q = '';
  // Entrar por una sección de primer nivel fija de dónde vienes; si no, volver
  // al índice y entrar por otra dejaba la miga contando el camino anterior.
  if (['zonas', 'enemigos', 'botin', 'hechizos', 'progreso', 'muertes'].includes(page)) e.from = page;
  // La zona señalada sólo dura el salto que la señala.
  e.marcada = args.marcada ?? null;
  e.page = page;
  if (page === 'index') { e.base = null; e.foe = null; delete e.diff; }
  if ('base' in args) e.base = args.base;
  if ('diff' in args) e.diff = args.diff;
  if ('dkey' in args) e.dkey = args.dkey;
  if ('name' in args) e.name = args.name;
  try {
    if (page === 'zonas') e.zonas = (await window.eql.encZones?.()) ?? [];
    if (page === 'zona') e.foes = (await window.eql.encZoneFoes?.(e.base, e.diff)) ?? [];
    if (page === 'enemigos') {
      e.todos = (await window.eql.encFoes?.()) ?? [];
      // Las zonas hacen falta aquí para poder sugerirlas: el buscador encuentra
      // enemigos por su zona, así que la zona tiene que ser un destino.
      if (!e.zonas?.length) e.zonas = (await window.eql.encZones?.()) ?? [];
    }
    if (page === 'botin' && !e.todos?.length) e.todos = (await window.eql.encFoes?.()) ?? [];
    if (page === 'botin') e.loot = (await window.eql.encLoot?.()) ?? [];
    if (page === 'hechizos') {
      // El catálogo se pide sobre TODO el histórico y no sobre el tramo que
      // tengas puesto en el filtro: aquí no miras una sesión, miras tus
      // hechizos.
      e.catalog = (await window.eql.spellCatalog?.({ sinceMs: null })) ?? null;
      state.catalog = e.catalog;
      pedirIconos((e.catalog?.spells ?? []).map((s) => s.name), renderEncyclopedia);
    }
    if (page === 'hechizo') {
      e.spell = (await window.eql.spellDetail?.(e.name, { sinceMs: null })) ?? null;
      pedirIconos([e.name], renderEncyclopedia);
    }
    if (page === 'muertes') e.deaths = (await window.eql.encDeaths?.()) ?? null;
    if (page === 'progreso') e.progress = (await window.eql.encProgress?.()) ?? null;
    if (page === 'foeDif') {
      // Un enemigo EN una dificultad: la ficha entera de esa celda y nada
      // promediado con las demás. `diff` puede ser `null` a propósito — es el
      // cajón de «no consta», y es un destino como cualquier otro.
      e.foeDif = (await window.eql.encFoeAt?.(e.name, e.dkey)) ?? null;
      pedirIconos((e.foeDif?.abilities ?? []).map((a) => a.name), renderEncyclopedia);
    }
    if (page === 'foe') {
      e.foe = (await window.eql.encFoe?.(e.name)) ?? null;
      // Desde la lista de enemigos no hay zona ni dificultad de por medio, así
      // que salen TODOS sus combates. Desde una zona salen los de esa zona y
      // esa dificultad, que es de donde vienes mirando.
      const q = { name: e.name };
      if (e.from === 'zonas') { q.base = e.base; q.diff = e.diff; }
      e.fights = (await window.eql.encFights?.(q)) ?? [];
      // Los iconos de sus habilidades, y lo que la wiki cuenta de cada una.
      const abil = (e.foe?.abilities ?? []).map((a) => a.name);
      pedirIconos(abil, renderEncyclopedia);
      for (const a of abil.slice(0, 8)) loadAbility(a);
    }
  } catch (err) {
    console.error('enciclopedia:', err);
  }
  renderEncyclopedia();
}

/**
 * El camino recorrido, y cada tramo se puede pulsar para volver a él.
 *
 * Al mismo enemigo se llega por dos sitios, así que el camino sale de por dónde
 * viniste y no de una jerarquía inventada: llegar por Enemigos y que la miga
 * dijera «Zonas › Plane of Fear» sería contarte un camino que no hiciste.
 */
function encCrumb() {
  const e = state.enc;
  const desde = e.from ?? 'zonas';
  const partes = [{ label: t('tab.encyclopedia'), page: 'index' }];
  if (e.page !== 'index') partes.push({ label: t(`enc.${desde}`), page: desde });
  if (e.page === 'zona' || (e.page === 'foe' && desde === 'zonas')) {
    partes.push({ label: e.base, page: 'zona' });
    partes.push({ label: encDiffLabel(e.diff), page: 'zona' });
  }
  if (e.page === 'foe') partes.push({ label: e.name, page: 'foe' });
  return `<div class="enc-crumb">${partes.map((p, i) => (i === partes.length - 1
    ? `<b>${esc(p.label)}</b>`
    : `<button class="lnk" data-crumb="${p.page}">${esc(p.label)}</button><i>›</i>`)).join('')}</div>`;
}

/**
 * Cómo se rotula una dificultad.
 *
 * Son cinco, de la 0 a la 4. La 0 —el mundo abierto— es la única sin nombre
 * oficial, y la línea de entrada del registro no la escribe: una zona sin
 * instanciar no dice «- Solo 0», no dice nada. Por eso lo que llega como
 * `null` se rotula D0 y no «sin dificultad»: la pregunta tiene respuesta.
 */
// `null` NO es D0. Era `D${d ?? 0}` lo que rotulaba «no consta» como si fuera
// la dificultad base, y con ello una ausencia de dato pasaba por medida.
const encDiffLabel = (d) => (d === null || d === undefined
  ? t('enc.noDiff')
  : `D${d}${DIF_TAGS[d] ? ` ${DIF_TAGS[d]}` : ''}`);

/** Los nombres oficiales de los niveles (wiki de EQL). La 0 no tiene. */
const DIF_TAGS = { 0: null, 1: 'Awakened', 2: 'Adaptive', 3: 'Fused', 4: 'Refined' };

function encIndex() {
  return `<div class="hint enc-note">${esc(t('enc.note'))}</div>
    <div class="encgrid">
      ${ENC_SECTIONS.map((s) => {
        const abierta = ENC_ABIERTAS.includes(s.key);
        // Lo visible es el recuento en cuanto hay fichas; la descripción no se
        // pierde, se va al rótulo emergente. El recuento sirve al que ya sabe
        // qué hay dentro —o sea a partir de la segunda visita— y la descripción
        // sirve la primera. No hay que elegir: una a la vista, otra a un ratón.
        const desc = t(`enc.${s.key}Sub`);
        const cuenta = encCount(s.key);
        return `<button class="enccard${abierta ? '' : ' pend'}" data-enc="${s.key}"
          style="--enc-accent:${s.accent}" title="${esc(desc)}"
          ${abierta ? '' : `aria-disabled="true"`}>
          ${plate(s.key)}
          <span class="enccard-t">${esc(t(`enc.${s.key}`))}</span>
          <span class="enccard-s">${esc(cuenta ?? desc)}</span>
        </button>`;
      }).join('')}
    </div>
    ${encEstado()}`;
}

/**
 * El estado de la ficha, al pie del índice.
 *
 * Dice cuánto lleva incorporado y, si al abrir hubo que rehacerla, por qué. Una
 * ficha que se aprende sola puede desfasarse sin que se note —los números
 * siguen ahí, con el mismo aspecto—, así que lo mínimo es que diga desde cuándo
 * y que se pueda rehacer sin abrir una consola.
 */
function encEstado() {
  const s = state.encStatus;
  if (!s || !s.fights) return '';
  const l = s.load;
  return `<div class="enc-foot">
    <span class="eyebrow">${esc(t('enc.stateLine', { foes: s.foes, fights: s.fights - s.pending }))}</span>
    ${l?.rebuilt ? `<span class="hint" title="${esc(l.reason)}">${esc(t('enc.rebuilt'))}</span>` : ''}
    ${s.backfilled ? `<span class="hint">${esc(t('enc.backfilled', { n: s.backfilled }))}</span>` : ''}
    <button class="lnk" id="encRebuild" title="${esc(t('enc.rebuildNote'))}">${esc(t('enc.rebuild'))}</button>
  </div>`;
}

/**
 * Las zonas: una fila por zona, cinco columnas de dificultad y una sexta,
 * separada, para lo que no la declara.
 *
 * La celda vacía dice que ahí no has entrado, y eso no es lo mismo que decir
 * que no hay nada.
 *
 * La sexta columna NO es una dificultad y por eso va detrás de un hueco, con su
 * propio rótulo y sin número: antes el mundo abierto caía dentro de D0 y la
 * columna afirmaba una medida que no existía. Un dato ausente que parece un
 * dato medido es peor que no tener la columna.
 */
function encZonas() {
  const z = state.enc.zonas ?? [];
  if (!z.length) return `<div class="empty"><h2>${esc(t('enc.emptyZones'))}</h2>
    <p class="hint">${esc(t('enc.emptyNote'))}</p></div>`;
  // `diff` viaja como texto porque una de las columnas no es un número: se lee
  // con `difFromCell`, que devuelve `null` para la de «no consta».
  const celda = (base, c, diff) => (c
    ? `<button class="enccell" data-base="${esc(base)}" data-diff="${diff}"
        title="${esc(modosDe(c))}">
        <b class="num">${c.foes}</b> <span>${esc(t('enc.foesWord', { n: c.foes }))}</span>
        <span class="dim num" title="${esc(t('enc.cellNote'))}">${
          c.fights}${c.kills ? ` · ${c.kills}†` : ''}</span>
      </button>`
    : `<span class="enccell void" title="${esc(t('enc.notBeen'))}">—</span>`);

  const fila = (row) => `<tr${row.base === state.enc.marcada ? ' class="zmark"' : ''}>
      <td class="zname">${esc(row.base)}</td>
      ${row.celdas.map((c, i) => `<td>${celda(row.base, c, String(i))}</td>`).join('')}
      <td class="zgap"></td>
      <td>${celda(row.base, row.sinMarca, 'null')}</td>
    </tr>`;

  return `${encCrumb()}
    <div class="zscroll"><table class="ztable">
      <thead><tr><th>${esc(t('enc.zoneCol'))}</th>
        ${[0, 1, 2, 3, 4].map((d) => `<th>D${d}${
          DIF_TAGS[d] ? ` · ${DIF_TAGS[d]}` : ''}</th>`).join('')}
        <th class="zgap"></th>
        <th class="zunknown" title="${esc(t('enc.openWorld'))}">${esc(t('enc.noDiffCol'))}</th>
      </tr></thead>
      <tbody>${z.map(fila).join('')}</tbody>
    </table></div>
    <div class="hint">${esc(t('enc.zonesNote'))}</div>`;
}

/** Los modos en que peleaste una celda. Dato de la celda, nunca un eje. */
function modosDe(c) {
  const m = c?.modes ?? [];
  if (!m.length) return '';
  return `${t('enc.modes')}: ${m.map((x) => `${x.mode} ${x.n}`).join(' · ')}`;
}

/** Lee el `data-diff` de una celda. «null» es «no consta» y NO es cero. */
const difFromCell = (v) => (v === 'null' || v === null || v === undefined ? null : +v);

/** Los enemigos de una zona y dificultad, de los que tienes datos por pelear. */
function encZona() {
  const l = state.enc.foes ?? [];
  return `${encCrumb()}
    <div class="enc-h">
      <h2>${esc(state.enc.base)}</h2>
      <span class="difpill">${esc(encDiffLabel(state.enc.diff))}</span>
      <span class="hint">${esc(t('enc.foes', { n: l.length }))}</span>
    </div>
    ${l.length ? `<div class="encrows">${l.map((f) => `
      <button class="encrow" data-foe="${esc(f.name)}">
        <span class="nm">${esc(f.name)}</span>
        <span class="num">${f.hp ? `${esc(t('foe.hp'))} ${n0(f.hp.avg)}` : ''}</span>
        <span class="num dim">${esc(t('sum.times', { n: f.fights }))}</span>
        <span class="num dim">${f.kills ? esc(t('sum.killed', { n: f.kills })) : esc(t('enc.neverFell'))}</span>
      </button>`).join('')}</div>
      <div class="hint">${esc(t('enc.zoneNote'))}</div>` : `<div class="hint">${esc(t('flt.none'))}</div>`}`;
}

/**
 * Lo que coincide con lo escrito, como accesos directos.
 *
 * El buscador hace dos cosas a la vez —encuentra enemigos y encuentra zonas— y
 * eso no se ve filtrando una lista de enemigos: escribiendo «Nag» salen los
 * enemigos cuya zona encaja, pero no se entiende por qué. Las sugerencias lo
 * enseñan: «Lord Nagafen» con una marca y «Nagafen's Lair» con otra.
 *
 * Van en la fila del título, a la izquierda del campo, y no flotando encima de
 * la lista: mientras escribes quieres ver las dos cosas.
 */
function encSuggest() {
  const e = state.enc;
  const q = (e.q ?? '').trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const f of e.todos ?? []) {
    if (f.name.toLowerCase().includes(q)) out.push({ kind: 'foe', label: f.name });
  }
  // Las zonas sólo son un destino desde la lista de enemigos: en el botín no
  // hay nada indexado por zona a lo que saltar.
  if (e.page === 'enemigos') {
    for (const z of e.zonas ?? []) {
      if (z.base.toLowerCase().includes(q)) out.push({ kind: 'zone', label: z.base, zona: z });
    }
  }
  // Lo que empieza por lo que has escrito va primero: es lo que estabas
  // escribiendo, y lo que contiene el trozo por el medio casi nunca lo es.
  const empieza = (s) => (s.label.toLowerCase().startsWith(q) ? 0 : 1);
  return out
    .sort((a, b) => empieza(a) - empieza(b) || a.label.localeCompare(b.label))
    .slice(0, 5);
}

/** El marco de las dos láminas, en pequeño: la marca dice de qué es cada uno. */
const SUG_GLIFO = {
  zone: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.6 7.2 4.8 11.4 6 7.2 7.2 6 11.4 4.8 7.2 0.6 6 4.8 4.8Z"/></svg>',
  foe: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.8 11 3.4v5.2L6 11.2 1 8.6V3.4Z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6" r="1.6"/></svg>',
};

function encSuggestHTML() {
  const sug = encSuggest();
  if (!sug.length) return '';
  return `<div class="suggs">${sug.map((s, i) => `
    <button class="sugg ${s.kind}" data-sug="${i}" data-kind="${s.kind}"
      data-label="${esc(s.label)}"
      aria-label="${esc(`${t(s.kind === 'zone' ? 'enc.sugZone' : 'enc.sugFoe')}: ${s.label}`)}"
      title="${esc(t(s.kind === 'zone' ? 'enc.sugZone' : 'enc.sugFoe'))}"
      >${SUG_GLIFO[s.kind]}<span>${esc(s.label)}</span></button>`).join('')}</div>`;
}

/**
 * Ir a lo que se ha sugerido.
 *
 * Una zona no es un destino por sí sola: hace falta decir en qué dificultad. Si
 * sólo hay una con datos se entra directo, y si hay varias se abre la rejilla
 * con esa fila señalada, que es donde se elige. Entrar en una cualquiera sería
 * elegir por ti.
 */
async function encIrA(kind, label) {
  if (kind === 'foe') {
    state.enc.from = state.enc.page === 'botin' ? 'botin' : 'enemigos';
    await encGo('foe', { name: label });
    return;
  }
  const z = (state.enc.zonas ?? []).find((x) => x.base === label);
  const conDatos = (z?.celdas ?? []).filter(Boolean);
  if (z && conDatos.length === 1 && !z.sinMarca) {
    await encGo('zona', { base: z.base, diff: conDatos[0].diff });
    return;
  }
  if (z && !conDatos.length && z.sinMarca) {
    await encGo('zona', { base: z.base, diff: null });
    return;
  }
  await encGo('zonas', { marcada: label });
}

/**
 * Todos los enemigos con ficha, con buscador.
 *
 * El buscador filtra sobre lo que ya está en memoria y no vuelve a preguntar:
 * son ochenta y seis fichas, no ochenta y seis mil, y hacerlo por el puente en
 * cada tecla sería el mismo error que filtrar el histórico letra a letra.
 */
function encEnemigos() {
  const q = (state.enc.q ?? '').toLowerCase();
  const todos = state.enc.todos ?? [];
  const l = q ? todos.filter((f) => f.name.toLowerCase().includes(q)
    || f.zonas.some((z) => z.toLowerCase().includes(q))) : todos;

  // La misma rejilla que en Zonas, y por lo mismo: «no lo he matado en D0» y
  // «no he peleado con él en D0» son cosas distintas, y sólo una celda vacía
  // puede decir la segunda. Con las pastillas de antes no se veía el hueco:
  // sólo salían las dificultades que había, así que faltar y valer cero se
  // veían igual —que es, exactamente, no verse.
  //
  // Cada celda lleva las veces que cayó, que es lo que preguntaste: si lo has
  // matado en D0, se ve en la columna de D0.
  const celda = (f, c, diff) => (c
    ? `<span class="fcell${c.kills ? ' has' : ''}" title="${esc([
      `${encDiffLabel(c.diff)} · ${t('sum.times', { n: c.fights })}`,
      c.kills ? t('sum.killed', { n: c.kills }) : t('enc.neverFell'),
      c.hp === null ? `${t('foe.hp')} —` : `${t('foe.hp')} ${n0(c.hp)}`,
      c.deaths ? t('enc.killedYou', { n: c.deaths }) : '',
      modosDe(c),
    ].filter(Boolean).join('\n'))}" data-foe="${esc(f.name)}" data-dkey="${diff}"
      ><b class="num">${c.kills || '·'}</b></span>`
    : `<span class="fcell void" title="${esc(t('enc.notFought'))}">—</span>`);

  return `${encCrumb()}
    <div class="enc-h">
      <h2>${esc(t('enc.enemigos'))}</h2>
      ${encSuggestHTML()}
      <input id="encQ" class="enc-find" type="search" autocomplete="off"
        placeholder="${esc(t('enc.find'))}" value="${esc(state.enc.q ?? '')}">
      <span class="hint">${esc(t('enc.foes', { n: l.length }))}${
        q && l.length !== todos.length ? ` ${esc(t('enc.ofN', { n: todos.length }))}` : ''}</span>
    </div>
    ${l.length ? `<div class="fgrid-head">
        <span></span>
        ${[0, 1, 2, 3, 4].map((d) => `<span class="num">D${d}</span>`).join('')}
        <span class="zgap"></span>
        <span class="num zunknown" title="${esc(t('enc.openWorld'))}">${esc(t('enc.noDiffCol'))}</span>
        <span></span>
      </div>
      <div class="encrows">${l.map((f) => `
      <div class="encrow foe fgrid" data-foe="${esc(f.name)}">
        <span class="nm">${esc(f.name)}</span>
        ${(f.rejilla ?? []).map((c, i) => celda(f, c, `D${i}`)).join('')}
        <span class="zgap"></span>
        ${celda(f, f.sinMarca, 'sin marca')}
        <span class="num dim">${f.hp
          ? `${esc(t('foe.hp'))} ${n0(f.hp.avg)} <span class="dim">${
            esc(encDiffLabel(f.hp.diff))}</span>` : ''}</span>
      </div>`).join('')}</div>
      <div class="hint">${esc(t('enc.foesGridNote'))}</div>`
    : `<div class="hint">${esc(t('enc.noMatch'))}</div>`}`;
}

/**
 * El botín: cada objeto, de quién ha caído y en qué dificultad.
 *
 * «2 de 11» son dos cifras medidas puestas una al lado de la otra, no una
 * probabilidad de caída, y por eso el número va con la palabra «de» y no con un
 * porcentaje, que sí prometería otra cosa.
 *
 * Lo que cambió: hasta ahora esas dos cifras mezclaban las cinco dificultades,
 * y no se puede — medido en un log real, `a fire giant warrior` suelta
 * «Throwing Boulder» y «+1» en D0 y «Throwing Boulder +2» en D2. Son tablas de
 * botín distintas, y sumadas describían una que no existe. Ahora cada fuente
 * trae su reparto, y las veces que lo mataste al lado son las de ESA celda.
 */
function encBotin() {
  const q = (state.enc.q ?? '').toLowerCase();
  const todos = state.enc.loot ?? [];
  const porDif = state.enc.lootDiff ?? null;   // null = todas
  let l = q ? todos.filter((o) => o.item.toLowerCase().includes(q)
    || o.from.some((f) => f.name.toLowerCase().includes(q))) : todos;
  // El filtro por dificultad recorta la tarjeta entera a esa celda: enseñar el
  // total con las fuentes filtradas descuadraría las dos cifras.
  if (porDif !== undefined && state.enc.lootDifSet) {
    l = l.map((o) => {
      const g = (o.porDif ?? []).find((x) => x.diff === porDif);
      if (!g) return null;
      return {
        ...o, n: g.n, sinFuente: 0,
        from: o.from.map((f) => {
          const c = (f.porDif ?? []).find((x) => x.diff === porDif);
          return c ? { ...f, n: c.n, kills: c.kills } : null;
        }).filter(Boolean),
      };
    }).filter(Boolean);
  }

  const pestana = (d, etiqueta) => {
    const activa = state.enc.lootDifSet ? state.enc.lootDiff === d : d === undefined;
    return `<button class="lootTab${activa ? ' on' : ''}" data-lootdif="${
      d === undefined ? 'all' : (d === null ? 'null' : d)}">${esc(etiqueta)}</button>`;
  };

  return `${encCrumb()}
    <div class="enc-h">
      <h2>${esc(t('enc.botin'))}</h2>
      ${encSuggestHTML()}
      <input id="encQ" class="enc-find" type="search" autocomplete="off"
        placeholder="${esc(t('enc.findItem'))}" value="${esc(state.enc.q ?? '')}">
      <span class="hint">${esc(t('enc.nItems', { n: nPlural(l.length) }))}</span>
    </div>
    <div class="loottabs">
      ${pestana(undefined, t('enc.allDiffs'))}
      ${[0, 1, 2, 3, 4].map((d) => pestana(d, `D${d}`)).join('')}
      ${pestana(null, t('enc.noDiffCol'))}
    </div>
    ${l.length ? `<div class="lootgrid">${l.map((o) => `<div class="lootcard">
      <div class="lootcard-h">
        <button class="loot-item" data-item="${esc(o.item)}">${esc(o.item)}</button>
        ${o.n > 1 ? `<span class="num dim">×${o.n}</span>` : ''}
      </div>
      ${!state.enc.lootDifSet && (o.porDif ?? []).length > 1 ? `<div class="lootdifs">${
    o.porDif.map((g) => `<span class="dpill" title="${esc(t('enc.outOf', { n: g.n, k: g.kills }))}">${
      esc(encDiffLabel(g.diff))} <b>×${g.n}</b></span>`).join('')}</div>` : ''}
      ${o.from.map((f) => `<button class="lootfrom" data-foe="${esc(f.name)}">
        <span>${esc(f.name)}</span>
        <span class="num">${esc(t('enc.outOf', { n: f.n, k: f.kills }))}</span>
      </button>`).join('')}
      ${o.sinFuente ? `<div class="hint">${esc(t('enc.noSource', { n: o.sinFuente }))}</div>` : ''}
      ${o.sinPelea ? `<div class="hint">${esc(t('enc.noFight', { n: o.sinPelea }))}</div>` : ''}
    </div>`).join('')}</div>
    <div class="hint">${esc(t('enc.lootNote'))}</div>`
    : `<div class="hint">${esc(t('enc.noMatch'))}</div>`}`;
}

/**
 * Sus habilidades: lo visto en el chat, y lo que la wiki dice de cada una.
 *
 * Esto era una sección propia de la enciclopedia y vive aquí porque es aquí
 * donde se busca. Lo medido manda y va primero: qué lanzó, en cuántos de
 * cuántos encuentros, cuánto sumó y su golpe más fuerte. Lo consultado va
 * detrás, marcado, y sólo si dice algo.
 */
function encHabilidades(f) {
  const abil = f.abilities ?? [];
  if (!abil.length) return '';
  const tot = abil.reduce((n, x) => n + x.sum, 0) || 1;
  // En cuántos encuentros salió cada una, por dificultad. Es el dato que impide
  // leer la lista como «sus habilidades»: son las que le has visto lanzar.
  const encuentros = (nombre) => (f.dificultades ?? [])
    .map((d) => {
      const a = (d.abilities ?? []).find((x) => x.name === nombre);
      return a ? `${encDiffLabel(d.diff)} ${a.inFights}/${d.fights}` : null;
    }).filter(Boolean);

  return `<div class="dos-block">
    <div class="eyebrow">${esc(t('enc.abilities'))} · ${esc(t('foe.measured'))}</div>
    <div class="hint">${esc(t('enc.abilitiesNote'))}</div>
    <div class="abils">
      ${abil.map((x) => {
        const wiki = mobCache.get(`hab:${x.name}`);
        return `<div class="abil">
          <div class="abil-h">
            ${spellIcon(x.name)}
            <span class="abil-n">${esc(x.name)}</span>
            <i class="seg ${typeClass(x.type)}" title="${esc(x.type ?? '')}"></i>
            <span class="num strong">${n0(x.sum)}</span>
            <span class="num dim">${Math.round(x.sum / tot * 100)}%</span>
          </div>
          <div class="abil-kv">
            <span>${esc(t('enc.abTimes'))} <b class="num">${n0(x.n)}</b></span>
            <span>${esc(t('foe.maxHit'))} <b class="num">${n0(x.max)}</b></span>
            ${encuentros(x.name).map((e) => `<span class="dim num">${esc(e)}</span>`).join('')}
          </div>
          ${wiki?.lines?.length ? `<div class="abil-wiki">
            <span class="tagw">${esc(t('foe.wiki'))}</span>
            ${wiki.lines.slice(0, 2).map((l) => `<span>${esc(l)}</span>`).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/**
 * Mis muertes.
 *
 * El enemigo que sale al lado de cada caída es **el que más daño te hizo en esa
 * pelea**, y así está rotulado. No es quien te dio el golpe final: el registro
 * no lo enlaza, y perfectamente puede haberte rematado el que menos te pegó.
 */
function encMuertes() {
  const d = state.enc.deaths;
  if (!d) return `${encCrumb()}<div class="hint">${esc(t('flt.none'))}</div>`;
  if (!d.total) {
    return `${encCrumb()}<div class="empty"><h2>${esc(t('enc.noDeaths'))}</h2>
      <p class="hint">${esc(t('enc.noDeathsNote'))}</p></div>`;
  }
  const card = (v, l, cls = '') => `<div class="metric ${cls}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const lista = (titulo, filas) => (filas.length ? `<div class="dos-block">
      <div class="eyebrow">${esc(titulo)}</div>
      ${filas.slice(0, 10).map((x) => `<div class="foe-det-l">
        <span>${esc(x.k)}</span><b>${x.n}</b>
        <span class="dim">${Math.round(x.n / d.total * 100)}%</span>
      </div>`).join('')}
    </div>` : '');

  return `${encCrumb()}
    <div class="enc-h"><h2>${esc(t('enc.muertes'))}</h2></div>
    <div class="metrics">
      ${card(d.total, t('metric.losses', { n: d.total }), 'foe')}
      ${card(`${(d.total / Math.max(1, d.fights) * 100).toFixed(1)}%`, t('enc.deathsRate'))}
      ${card(n0(d.fights), t('sum.fights', { n: d.fights }))}
    </div>
    <div class="hint">${esc(t('enc.deathsNote'))}</div>
    ${lista(t('enc.deathsByZone'), d.porZona)}
    ${lista(t('enc.deathsByFoe'), d.porEnemigo)}
    <div class="sec-title eyebrow" style="margin-top:18px">${esc(t('enc.deathsEach'))}</div>
    <div class="encrows">${d.muertes.map((m) => `
      <button class="encrow fight" data-uid="${m.uid}">
        <span class="nm">${esc(cuando(m.at))}${m.veces > 1 ? ` <span class="dim">×${m.veces}</span>` : ''}</span>
        <span class="num dim">${esc(m.zoneBase ?? '—')} ${esc(encDiffLabel(m.diff))}</span>
        <span class="num">${m.masDaño ? esc(m.masDaño.name) : '—'}</span>
        <span class="num dim">${m.masDaño?.share !== null && m.masDaño
          ? `${Math.round(m.masDaño.share * 100)}%` : ''}</span>
      </button>`).join('')}</div>`;
}

/**
 * Mi progresión.
 *
 * NO hay curva de dps en el tiempo y es a propósito: sube al subir de nivel y
 * baja al pelear con algo más duro, así que mide las dos cosas a la vez y
 * ninguna. Lo comparable es la terna (enemigo, dificultad, nivel), y la línea
 * sólo se dibuja dentro de una terna y con muestra suficiente.
 */
/**
 * Tu nivel a lo largo del tiempo, y lo que pasó en cada tramo.
 *
 * NO es una progresión: en EQL cambiar una clase por otra más baja te BAJA el
 * nivel, así que la línea va y viene. De diez cambios medidos en un histórico
 * real, tres son bajadas. Por eso se enseñan periodos y no una cuesta, y una
 * bajada se rotula como cambio de clase y no como retroceso.
 *
 * El instante del cambio no se sabe —el registro no lo dice cuando baja— pero
 * queda acotado entre la última pelea de un nivel y la primera del siguiente.
 * Se enseña ese margen en vez de una hora inventada.
 *
 * Los hitos van AL LADO, no como explicación. Que en un periodo subieras diez
 * puntos de habilidad y te quedaras una pieza +4 es un hecho, y que tu récord
 * subiera es otro. Ponerlos juntos deja que los relaciones tú; afirmarlo aquí
 * sería inventar una causa que no se ha medido.
 */
function periodosHTML(p) {
  const per = p.periodos ?? [];
  if (!per.length) return '';
  const tope = Math.max(1, ...per.map((x) => x.best));
  const cambio = (i) => (p.cambios ?? [])[i - 1];

  const fila = (x) => {
    const c = cambio(x.i);
    const salto = !c ? '' : `<div class="salto ${c.sube ? 'sube' : 'baja'}">
      <span>${c.sube ? '↑' : '↓'} ${esc(t(c.sube ? 'per.up' : 'per.down', { de: c.de, a: c.a }))}</span>
      <span class="dim">${esc(t('per.between', { m: Math.max(1, Math.round(c.margen / 60000)) }))}</span>
    </div>`;
    const hitos = [
      x.aa ? `<span class="hito aa">${esc(t('per.aa', { n: x.aa }))}</span>` : '',
      x.piezasN ? `<span class="hito eq" title="${esc(x.piezas.map((q) => q.item).join('\n'))}">${
        esc(t('per.gear', { n: x.piezasN }))}${x.mejorTier ? ` <b>+${x.mejorTier}</b>` : ''}</span>` : '',
    ].filter(Boolean).join('');
    return `${salto}
      <button class="periodo${x.bastante ? '' : ' flojo'}" data-uid="${x.bestUid}"
        ${x.bestUid === null ? 'disabled' : ''}>
        <span class="per-lvl">${esc(t('lvl.level', { n: x.level }))}</span>
        <span class="per-barra"><i style="width:${Math.round(x.best / tope * 100)}%"></i></span>
        <span class="num">${esc(t('marks.best'))} <b>${n0(x.best)}</b></span>
        <span class="num dim">${esc(t('marks.median'))} ${n0(x.median)}</span>
        <span class="num dim">${x.fights} ${esc(t('sum.fights', { n: x.fights }))}</span>
        <span class="per-hitos">${hitos}</span>
        <span class="num dim">${esc(cuando(x.desde))}</span>
      </button>`;
  };

  // La única comparación que dice algo: mismo nivel, momentos distintos.
  const comp = (p.comparables ?? []).map((c) => {
    const l = c.periodos.map((i) => per.find((x) => x.i === i)).filter(Boolean);
    const meds = l.map((x) => n0(x.median)).join(' → ');
    const bests = l.map((x) => n0(x.best)).join(' → ');
    return `<div class="hint">${esc(t('per.same', { n: c.level, k: l.length }))}
      <b>${esc(t('marks.median'))} ${meds}</b> · <b>${esc(t('marks.best'))} ${bests}</b></div>`;
  }).join('');

  return `<div class="sec-title eyebrow" style="margin-top:16px">${esc(t('per.title'))}</div>
    <div class="hint">${esc(t('per.note'))}</div>
    <div class="periodos">${per.map(fila).join('')}</div>
    ${comp ? `<div class="sec-title eyebrow" style="margin-top:14px">${esc(t('per.compTitle'))}</div>
      <div class="hint">${esc(t('per.compNote'))}</div>${comp}` : ''}`;
}

function encProgreso() {
  const p = state.enc.progress;
  if (!p) return `${encCrumb()}<div class="hint">${esc(t('flt.none'))}</div>`;
  if (!p.fights) {
    return `${encCrumb()}<div class="empty"><h2>${esc(t('enc.noProgress'))}</h2>
      <p class="hint">${esc(t('enc.noProgressNote'))}</p></div>`;
  }
  const conSerie = p.marcas.filter((m) => m.serie);

  /** La línea de una terna. Sin ejes ni promesas: los puntos que hay. */
  const serie = (m) => {
    const v = m.serie.map((x) => x.dps);
    const max = Math.max(...v) || 1;
    const min = Math.min(...v);
    const W = 240; const H = 34;
    const px = (i) => (m.serie.length === 1 ? W / 2 : (i / (m.serie.length - 1)) * W);
    const py = (y) => H - ((y - min) / Math.max(1, max - min)) * (H - 6) - 3;
    const d = m.serie.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(x.dps).toFixed(1)}`).join('');
    return `<svg class="serie" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="var(--t-fire)" stroke-opacity=".85" stroke-width="1.6"/>
      ${m.serie.map((x, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(x.dps).toFixed(1)}" r="2"
        fill="var(--t-fire)" fill-opacity=".9"/>`).join('')}
    </svg>`;
  };

  return `${encCrumb()}
    <div class="enc-h"><h2>${esc(t('enc.progreso'))}</h2></div>
    <div class="hint">${esc(t('enc.progressNote'))}</div>
    ${p.sinDato ? `<div class="hint">${esc(t('enc.progressMissing', { n: p.sinDato }))}</div>` : ''}

    ${periodosHTML(p)}

    <div class="sec-title eyebrow" style="margin-top:16px">${esc(t('marks.title'))}</div>
    <div class="hint">${esc(t('marks.openNote'))}</div>
    <div class="encrows">${p.niveles.map((l) => `<button class="encrow fight" data-uid="${l.bestUid}"
      ${l.bestUid === null ? 'disabled' : ''}>
      <span class="nm">${l.level === null ? esc(t('lvl.unknown')) : esc(t('lvl.level', { n: l.level }))}</span>
      <span class="num">${esc(t('marks.best'))} <b>${n0(l.best)}</b></span>
      <span class="num dim">${esc(t('marks.median'))} ${n0(l.median)}</span>
      <span class="num dim">${l.n} ${esc(t('sum.fights', { n: l.n }))}</span>
      <span class="num dim">${l.bestAt ? esc(cuando(l.bestAt)) : ''}</span>
    </button>`).join('')}</div>

    <div class="sec-title eyebrow" style="margin-top:18px">${esc(t('enc.progressByFoe'))}</div>
    <div class="hint">${esc(t('enc.progressByFoeNote'))}</div>
    <div class="encrows">${p.marcas.slice(0, 40).map((m) => `<button class="encrow fight" data-uid="${m.bestUid}"
      ${m.bestUid === null ? 'disabled' : ''}>
      <span class="nm">${esc(m.name)}
        <span class="dpills"><span class="dpill">${esc(encDiffLabel(m.diff))}</span>${
  m.level === null ? '' : `<span class="dpill">${esc(t('lvl.level', { n: m.level }))}</span>`}</span></span>
      <span class="num">${esc(t('marks.best'))} <b>${n0(m.best)}</b></span>
      <span class="num dim">${m.n >= 3 ? `${esc(t('marks.median'))} ${n0(m.median)}` : ''}</span>
      <!-- Con una sola pelea el «récord» ES esa pelea. Decirlo evita que se lea
           como una marca sacada de varias. -->
      <span class="num dim">${m.n === 1 ? esc(t('marks.onlyOne'))
    : `${m.n} ${esc(t('sum.fights', { n: m.n }))}`}</span>
      <span class="num dim">${m.bestAt ? esc(cuando(m.bestAt)) : ''}</span>
    </button>`).join('')}</div>

    ${conSerie.length ? `
      <div class="sec-title eyebrow" style="margin-top:18px">${esc(t('enc.progressSeries'))}</div>
      <div class="hint">${esc(t('enc.progressSeriesNote', { n: p.minSerie }))}</div>
      <div class="encrows">${conSerie.map((m) => `<div class="encrow static serie-row">
        <span class="nm">${esc(m.name)} <span class="dim">${esc(encDiffLabel(m.diff))}${
          m.level === null ? '' : ` · ${esc(t('lvl.level', { n: m.level }))}`}</span></span>
        ${serie(m)}
        <span class="num dim">${m.n} ${esc(t('sum.fights', { n: m.n }))}</span>
      </div>`).join('')}</div>`
    : `<div class="hint" style="margin-top:16px">${esc(t('enc.progressNoSeries', { n: p.minSerie }))}</div>`}`;
}

/** El expediente, con todos los combates que has tenido contra él debajo. */
function encFoe() {
  const f = state.enc.foe;
  if (!f) return `${encCrumb()}<div class="hint">${esc(t('foe.noData'))}</div>`;
  const fs2 = state.enc.fights ?? [];
  return `${encCrumb()}
    ${foeDossier(f, encHabilidades(f))}
    <div class="sec-title eyebrow" style="margin-top:18px">${
      esc(t('enc.fightsHere', { n: fs2.length }))}</div>
    ${fs2.length ? `<div class="encrows">${fs2.map((s) => `
      <button class="encrow fight" data-uid="${s.uid}">
        <span class="nm">${esc(cuando(s.at))}</span>
        <span class="num dim">${secs(s.duration)}</span>
        <span class="num">${n0(s.raidDps)} dps</span>
        <span class="num dim">${(s.kills ?? []).includes(f.name)
          ? esc(t('enc.fell')) : esc(t('enc.survived'))}</span>
      </button>`).join('')}</div>` : `<div class="hint">${esc(t('flt.none'))}</div>`}`;
}

function renderEncyclopedia() {
  const host = $('bodyGrid');
  const e = state.enc;
  // El título de la vista lo pone la pestaña, que está justo encima y marcada.
  // Repetirlo aquí costaba una línea de las que hacen falta para que las siete
  // secciones quepan de un vistazo, que es el trabajo de esa pantalla.
  const cuerpo = e.page === 'zonas' ? encZonas()
    : e.page === 'zona' ? encZona()
      : e.page === 'enemigos' ? encEnemigos()
        : e.page === 'botin' ? encBotin()
          : e.page === 'hechizos' ? encHechizos()
            : e.page === 'progreso' ? encProgreso()
              : e.page === 'muertes' ? encMuertes()
                : e.page === 'foe' ? encFoe()
                  : e.page === 'foeDif' ? encFoeDif()
                    : e.page === 'hechizo' ? encHechizo()
                      : encIndex();
  host.innerHTML = `<div class="tabpane"><div class="enc" id="encRoot">${cuerpo}</div></div>`;

  host.querySelectorAll('.enccard').forEach((el) => el.addEventListener('click', () => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    encGo(el.dataset.enc);
  }));
  $('encRebuild')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    b.textContent = t('enc.rebuilding');
    await window.eql.encRebuild?.().catch(() => null);
    await encRefresh();
    renderEncyclopedia();
  });
  host.querySelectorAll('[data-crumb]').forEach((el) => el.addEventListener('click', () => {
    encGo(el.dataset.crumb);
  }));
  // Sólo las celdas con datos. La vacía es un hueco, no un enlace a una lista
  // vacía: sin este filtro se abría una zona «undefined» en dificultad NaN.
  host.querySelectorAll('.enccell[data-base]').forEach((el) => el.addEventListener('click', () => {
    encGo('zona', { base: el.dataset.base, diff: difFromCell(el.dataset.diff) });
  }));
  // De dónde vienes se apunta al saltar, que es cuando se sabe.
  host.querySelectorAll('.encrow[data-foe]').forEach((el) => el.addEventListener('click', (ev) => {
    // Pulsar una celda de la rejilla entra a ESA dificultad, no a la ficha
    // entera: se atiende antes y se para, o el clic haría las dos cosas.
    if (ev.target.closest?.('.fcell')) return;
    state.enc.from = el.classList.contains('foe') ? 'enemigos' : 'zonas';
    encGo('foe', { name: el.dataset.foe });
  }));
  // Una celda con datos de la rejilla de enemigos, y sólo con datos: la vacía
  // es un hueco que dice «ahí no has peleado», no un enlace a una ficha vacía.
  host.querySelectorAll('.fcell[data-foe]').forEach((el) => el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    state.enc.from = 'enemigos';
    encGo('foeDif', { name: el.dataset.foe, dkey: el.dataset.dkey });
  }));
  // Y desde la ficha del enemigo, o desde las pestañas de una dificultad.
  host.querySelectorAll('[data-foedif]').forEach((el) => el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    encGo('foeDif', { name: el.dataset.foedif, dkey: el.dataset.dkey });
  }));
  // Las pestañas de dificultad del botín. `all` es «todas» y no es lo mismo que
  // «las que no la declaran», que es `null`: por eso hacen falta dos estados y
  // no basta con que `lootDiff` sea nulo.
  host.querySelectorAll('.lootTab').forEach((el) => el.addEventListener('click', () => {
    const v = el.dataset.lootdif;
    state.enc.lootDifSet = v !== 'all';
    state.enc.lootDiff = v === 'all' ? undefined : (v === 'null' ? null : +v);
    renderEncyclopedia();
  }));
  host.querySelectorAll('.cat-row.abre').forEach((el) => el.addEventListener('click', () => {
    state.enc.from = 'hechizos';
    encGo('hechizo', { name: el.dataset.spell });
  }));
  host.querySelectorAll('.lootfrom').forEach((el) => el.addEventListener('click', () => {
    state.enc.from = 'botin';
    encGo('foe', { name: el.dataset.foe });
  }));
  // El buscador filtra lo que ya está cargado: no vuelve a preguntar por el
  // puente, así que puede repintar en cada tecla sin coste.
  const busca = $('encQ');
  if (busca) {
    busca.addEventListener('input', (ev) => {
      state.enc.q = ev.target.value;
      renderEncyclopedia();
      const n = $('encQ');
      // Repintar mata el foco y el cursor; sin esto sólo se puede escribir una
      // letra por clic.
      if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    });
    /**
     * Con el teclado, sin tocar el ratón.
     *
     * Intro va a la primera sugerencia, que es la que estabas escribiendo.
     * Abajo entra en la fila para elegir otra, y a partir de ahí las flechas se
     * mueven entre ellas. Escape vuelve al campo.
     *
     * Las flechas izquierda y derecha NO se tocan dentro del campo: ahí mueven
     * el cursor, y robárselas para navegar haría imposible corregir una letra.
     */
    busca.addEventListener('keydown', (ev) => {
      const chips = [...host.querySelectorAll('.sugg')];
      if (ev.key === 'Enter' && chips.length) { ev.preventDefault(); chips[0].click(); }
      else if (ev.key === 'ArrowDown' && chips.length) { ev.preventDefault(); chips[0].focus(); }
      else if (ev.key === 'ArrowUp' && chips.length) { ev.preventDefault(); chips.at(-1).focus(); }
      else if (ev.key === 'Escape' && state.enc.q) {
        ev.preventDefault();
        state.enc.q = '';
        renderEncyclopedia();
        $('encQ')?.focus();
      }
    });
  }
  host.querySelectorAll('.sugg').forEach((el) => {
    el.addEventListener('click', () => encIrA(el.dataset.kind, el.dataset.label));
    el.addEventListener('keydown', (ev) => {
      const chips = [...host.querySelectorAll('.sugg')];
      const i = chips.indexOf(el);
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault(); chips[(i + 1) % chips.length].focus();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault(); chips[(i - 1 + chips.length) % chips.length].focus();
      } else if (ev.key === 'Escape') {
        ev.preventDefault(); $('encQ')?.focus();
      }
    });
  });
  // Un combate concreto se abre donde se ven los combates, que es la otra
  // pestaña: aquí no se repite el desglose de una pelea.
  host.querySelectorAll('.encrow.fight, .periodo[data-uid]').forEach((el) => el.addEventListener('click', async () => {
    // `uid` es el byte donde empieza el registro, así que 0 es un uid válido —
    // pero «null» convertido a número también da 0, y ésa abriría la primera
    // pelea del histórico en vez de la que se pulsó. Se filtra por texto.
    const crudo = el.dataset.uid;
    if (crudo === undefined || crudo === '' || crudo === 'null') return;
    state.selectedFight = +crudo;
    state.rowNodes.clear();
    await loadFight(state.selectedFight);
    setView('combat');
  }));
  host.querySelector('.dos-wiki')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    window.eql.openWiki(ev.currentTarget.dataset.wiki);
  });
  cablearRaid(host);
  host.querySelectorAll('.loot-item').forEach((el) => {
    el.addEventListener('click', (ev) => { ev.stopPropagation(); window.eql.openWiki(el.dataset.item); });
    el.addEventListener('mouseenter', () => showItemTip(el.dataset.item));
    el.addEventListener('mouseleave', hideItemTip);
  });
}

/** Quién le hizo qué a ese enemigo, sacado del reparto por objetivo. */
const mobCache = new Map();

/**
 * Lo que la wiki cuenta de una HABILIDAD concreta.
 *
 * Hasta ahora sólo se consultaba la página del enemigo. Las habilidades tienen
 * la suya, y ahí es donde pone si algo no se puede resistir o si es un golpe de
 * muerte. Se guarda en el mismo mapa con otro prefijo para no mezclar «lo que
 * dice la wiki de Lord Nagafen» con «lo que dice de Ice Comet».
 */
async function loadAbility(name) {
  const k = `hab:${name}`;
  if (mobCache.has(k)) return;
  mobCache.set(k, null);
  try {
    const d = await window.eql.wikiMob?.(name);
    mobCache.set(k, d ?? null);
    if (d && state.view === 'encyclopedia' && state.enc.page === 'foe') renderEncyclopedia();
  } catch { /* sin red */ }
}

/** Pide a la wiki las notas del enemigo y repinta cuando llegan. */
async function loadMob(name) {
  if (mobCache.has(name)) return;
  mobCache.set(name, null);
  try {
    const d = await window.eql.wikiMob?.(name);
    mobCache.set(name, d ?? null);
    // El expediente vive en dos sitios y la wiki llega tarde a los dos.
    if (d && state.view === 'summary') renderSummary();
    if (d && state.view === 'encyclopedia' && state.enc.page === 'foe') renderEncyclopedia();
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
  if (state.view === 'summary') {
    // Sólo se monta una vez. Sin esta guarda el snapshot de 250 ms reconstruye
    // la vista entera y el scroll vuelve arriba en cuanto lo mueves.
    if (!$('sumRoot')) renderSummary();
    return;
  }
  if (state.view === 'encyclopedia') {
    // La misma guarda: es una vista con su propio scroll.
    if (!$('encRoot')) renderEncyclopedia();
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
  // El texto de la cabecera se recorta cuando no cabe, así que el valor entero
  // tiene que estar en algún sitio: el nombre de zona es justo el que se recorta
  // y justo el que necesitas leer entero.
  $('mZone').parentElement.title = snap.zone ?? '';
  if (el) el.parentElement.title = post;
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
  set('tabEnc', t('tab.encyclopedia'));
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

// Un clic fuera cierra el desplegable de compañeros. Se registra UNA vez y aquí
// fuera: dentro de renderFightList se apilaría un manejador por repintado, y la
// lista se repinta con cada snapshot.
document.addEventListener('click', () => {
  if (!state.matesOpen) return;
  state.matesOpen = false;
  const l = $('fightList');
  if (l) l.dataset.sig = '';
  renderApp();
});

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

// La versión en el pie, al lado del crédito. No estaba en ninguna parte de la
// interfaz: para saber qué versión tenías había que mirar el instalador.
window.eql.appVersion?.().then((v) => {
  const el = $('fVer');
  if (el && v) el.textContent = v;
}).catch(() => { /* si no la da, el pie se queda con el nombre y el crédito */ });

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
  $('tabEnc').classList.toggle('active', v === 'encyclopedia');
  $('bodyGrid').innerHTML = '';
  state.rowNodes.clear();
  renderApp();
}
$('tabCombat').addEventListener('click', () => setView('combat'));
$('tabTriggers').addEventListener('click', async () => { await initTriggers(); setView('triggers'); });
/**
 * Los recuentos y el estado se piden al entrar y no en cada repintado: salen de
 * la ficha, que ya está en memoria del otro lado, pero el viaje por el puente
 * no es gratis y esta pantalla se repinta con cada snapshot.
 */
async function encRefresh() {
  state.encCounts = (await window.eql.encCounts?.().catch(() => null)) ?? null;
  state.encStatus = (await window.eql.encStatus?.().catch(() => null)) ?? null;
}

$('tabEnc').addEventListener('click', async () => {
  await encRefresh();
  state.enc.page = 'index';
  setView('encyclopedia');
});

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
