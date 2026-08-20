import { t, setLang, getLang, LANGS, langInfo, TRANSLATED } from '../src/i18n.js';
import { analyse } from '../src/analysis.js';
import { advise } from '../src/advisor.js';
import { RANGES } from '../src/ranges.js';
import { mergePets, mergeOwnerPets, ownerPets, ensureIdentidad } from '../src/aggregate.js';
import { fightToChat } from '../src/share.js';
import { construye as construyeCronos } from './cronos-vista.js';
import { conectar as conectarPiezas, desplegadas } from './piezas.js';
import { SUELO_COTA, lecturaDelVisto } from '../src/cronos.js';
import { estadoCrono, avisoDeVarios, claveCrono, ordenCola, ESTADO, PERIODOS_SOSPECHA, PRECISION, enemigosDeLaPelea, MIN_OBS_DISCREPA, puedeAfirmarDiscrepancia } from '../src/cronos.js';
import { clasificaJefe, jefesDe } from '../src/raid.js';
import { mismoNombre } from '../src/nombres.js';
import { parseZone, labelDiff } from '../src/zones.js';
import { tiempoDeZona } from '../src/wiki-zonas.js';
import { muertesPorNombre } from '../src/suelo.js';
import { copiarAlPortapapeles } from './clip.js';
import { pedirDatos, acercaDe } from './dialogo.js';
import { initTriggers, renderTriggers } from './triggers.js';
import { plate, DIBUJADAS } from './plates.js';
import { grafica, STANCE_COLOR, W, H, BAND } from './grafica.js';
import { montarReproduccion } from './reproduccion.js';
import { cajaRotulo, colocarRotulo, ocultarRotulo } from './rotulo.js';
import { mountBanner, speak, playSound, listVoices } from './alerts.js';
import { crearFallo } from './fallo.js';

const TYPES = ['magic', 'cold', 'fire', 'poison', 'disease', 'melee', 'ds', 'dot', 'spell'];
const typeClass = (t) => (TYPES.includes(t) ? t : 'other');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Math.round(v || 0).toLocaleString('es-ES');
const n1 = (v) => (v || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const pct = (v) => `${((v || 0) * 100).toFixed(1)}%`;
const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const $ = (id) => document.getElementById(id);

/**
 * ¿CAYÓ ESTE BICHO EN ESTA PELEA? Comparando sin la mayúscula inicial.
 *
 * `kills` se guarda con el nombre TAL CUAL venía en la línea de muerte —EQ
 * capitaliza al abrir frase— mientras que el nombre de la ficha viene de la
 * fila del combatiente, que `Encounter.actor` normaliza. Las dos formas
 * conviven en la misma pelea guardada.
 *
 * MEDIDO sobre el histórico: 9 filas de esta lista decían «sobrevivió» de un
 * bicho que había caído —`heart harpie` ×2, `orc legionnaire` ×2, `dry bones
 * skeleton`, `phoboplasm`, `royal guard`, `royal guard pet`, `orc centurion`—.
 * Es el mismo fallo que le quitaba 25 abatidos al bestiario, por la otra
 * puerta: la regla se había arreglado en `foes.js` y no aquí. Ver la nota de
 * deuda en `src/store.js`.
 */
const cayoEn = (pelea, nombre) => (pelea?.kills ?? []).some((k) => mismoNombre(k, nombre));

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TÍTULO DE UNA PELEA DICE QUÉ CAYÓ. NO DICE CUÁNTOS HUBO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 16 de agosto ponía «a shin ghoul knight ×2», y ese «×2» se lee como
 * «había dos». No es lo que cuenta: cuenta ABATIDOS —`muertesPorNombre` sobre
 * `kills`, o sea lo que el registro escribió que cayó—. El reproductor contesta
 * la otra pregunta con `suelosDe`, que añade uno cuando el nombre siguió
 * actuando después de su última muerte.
 *
 * LAS DOS RESPUESTAS COINCIDÍAN POR ACCIDENTE hasta que se arregló el suelo:
 * las dos contaban sólo muertes. Desde entonces difieren en 64 nombres del
 * histórico, y una pantalla que enseña dos números distintos sin decir que son
 * dos preguntas es peor que una que enseñaba uno mal.
 *
 * SE CONSTRUYE AQUÍ Y NO SE LEE `f.label`, a propósito: `label` es una cadena
 * guardada con la pelea, así que cambiar la palabra en `engine.js` sólo
 * arreglaría las peleas futuras y dejaría el histórico con «×2». Rehacerlo al
 * pintar lo arregla hacia atrás sin reconstruir nada — la misma decisión que la
 * 1.11.0 y por el mismo motivo. `f.label` se queda de respaldo para las peleas
 * sin abatidos, que es donde lleva el nombre del que te pegó.
 */
const rotuloPelea = (f) => {
  const m = muertesPorNombre((f?.kills ?? []).map((k) => (typeof k === 'string' ? k : k?.victim)));
  if (!m.size) return f?.label ?? t('fight.skirmish');
  return [...m]
    .map(([n, x]) => (x > 1 ? `${n} · ${t('fight.abatidos', { n: x })}` : n))
    .join(', ');
};

// La red de seguridad, montada antes que nada: si algo revienta al arrancar,
// tiene que verse igual que si revienta luego.
let version = '';
const { pintar: pintarSeguro, vigilar } = crearFallo({
  doc: document, t, copiar: copiarAlPortapapeles, version: () => version,
});
vigilar(window);

const state = {
  snap: null,
  selectedFight: 'live',
  picked: new Set(),      // peleas elegidas a mano, para verlas como una
  pickAnchor: null,       // desde dónde extiende el rango Mayúsculas+clic
  expanded: new Set(),
  hover: null,
  setup: false,
  view: 'sec',
  // La sección abierta de la barra lateral, cuando `view` es 'sec'. Vive aparte
  // de `view` porque las secciones son una lista que crece, no un estado más.
  seccion: 'escena',
  cfg: {},
  rowNodes: new Map(),
  sideHeads: new Map(),
  detailStamp: new Map(),
  showAll: false,
  // Qué documento de la pelea está abierto. Vive aquí y no en el DOM porque la
  // barra se repinta con el snapshot; y se conserva al cambiar de pelea, que es
  // lo que quieres cuando comparas la misma pregunta en dos peleas seguidas.
  doc: 'tank',
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
    state.view = 'sec';
    state.seccion = state.seccion ?? 'escena';
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
    <!--
      LA PROCEDENCIA DEL NOMBRE, donde ya se enseña la de todo lo demás de esta
      fila. Que sea deducido significa que el registro NUNCA escribe ese nombre
      a mitad de frase, así que su forma —la mayúscula incluida— es una apuesta
      nuestra y no una medida. Son 25 de 440 en el histórico.

      Y sin comillas invertidas en este comentario: está DENTRO de una plantilla,
      así que una comilla invertida aquí la cierra. Se rompió así al escribirlo.
    -->
    ${r.nombreDeducido ? `<span class="hint">${esc(t('name.deducido'))}</span>` : ''}
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
  // Y la identidad entera, por la misma razón y una más: el `unidentified`
  // guardado dependía de lo que hubiera en MEMORIA cuando se cerró la pelea,
  // así que la misma mascota tuya salía identificada en una y desconocida en
  // la siguiente. Se recalcula con lo que hay en disco ahora.
  rows = ensureIdentidad(rows, {
    self: state.snap?.self,
    companions: companeros(),
    knownPets: petNames(),
    notPets: state.cfg?.notPets ?? [],
    whoSeen: state.snap?.whoSeen ?? [],
  });
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
    <div class="fight-name">${esc(rotuloPelea(f))}</div>
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
  /**
   * EL FOCO SOBREVIVE AL REPINTADO, y sin esto no sobrevivía.
   *
   * La barra de filtros vive dentro de la misma lista que se repinta, así que
   * al aplicarse el filtro —350 ms después de la última tecla— el `innerHTML`
   * destruía el campo de búsqueda y creaba otro. Escribías tres letras, la
   * lista se actualizaba, y la cuarta se perdía: había que volver a pinchar en
   * el campo para seguir. Desde fuera parece que el buscador «se cansa».
   *
   * ESTO ERA LA CUARTA COPIA A MANO de la misma guarda —asistente,
   * configuración, Reapariciones y aquí—, cada una escrita entera y ninguna
   * enterada de las otras. Ahora la hace `pintaEstable`, que conserva foco,
   * valor y cursor. El texto hace falta porque el campo se vuelve a pintar con
   * `state.filter.foe`, que va un rebote por detrás de lo tecleado: lo escrito
   * durante esos 350 ms no está todavía en el estado y se perdería al
   * restaurar sólo la posición.
   *
   * Aquí no hay parte volátil: la lista entera ES la firma, así que el
   * constructor devuelve lo mismo con números y sin ellos.
   */
  if (pintaEstable(list, () => html, null, 'sig') === 'refrescado') return;

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
    abrirSeccion('resumen');
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
    renderApp();
  });
  $('pickOpen')?.addEventListener('click', async () => {
    state.summaryFrom = 'pick';
    state.summary = await window.eql.aggregate({ uids: [...state.picked],
      mergePets: state.cfg.mergePets, petLabel: t('pets.merged'),
      myPets: state.cfg.myPets ?? [], notPets: state.cfg.notPets ?? [] });
    abrirSeccion('resumen');
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
  const sig = `${rank}|${r.damage}|${r.dps.toFixed(1)}|${r.share.toFixed(4)}|${r.hits}|${r.misses}|${r.crits}|${r.taken}|${r.healingDone}|${r.petOf ?? ''}|${Math.round(r.rafaga10 ?? 0)}`;
  const open = state.expanded.has(r.name);
  node.el.classList.toggle('open', open);

  if (refs.sig !== sig) {
    refs.sig = sig;
    refs.rank.textContent = rank;
    node.el.classList.toggle('me', r.name === snap.self);
    // El encantado lleva su nombre y la marca: es el mismo bicho que el
    // salvaje de al lado, pero durante ese rato peleaba para ti. Sin la marca,
    // la pelea enseña dos filas con el mismo nombre y una de ellas en tu bando,
    // que sin explicación parece un error de la aplicación.
    refs.name.textContent = r.charmed ? `${r.name} (${t('row.charmed')})`
      : (r.petOf ? `${r.name} (${t('row.petOf', { who: r.petOf })})` : r.name);
    refs.name.className = `name ${r.name === snap.self ? 'self' : ''} ${
      r.pet || snap.pets.includes(r.name) ? 'pet' : ''} ${r.petOf ? 'otherpet' : ''} ${
      r.charmed ? 'charmed' : ''}`;
    refs.name.title = r.charmed ? t('row.charmedNote')
      : (r.petOf ? t('row.petOf', { who: r.petOf }) : '');
    /**
     * DOS COSAS DISTINTAS, Y AHORA SE DICE CUÁL ES CUÁL.
     *
     * El número grande es una TASA —daño ÷ duración de la pelea— y el
     * porcentaje de al lado es una APORTACIÓN —qué parte del total pusiste—.
     * Salían pegados, sin rótulo, y se leían como si fueran dos vistas del
     * mismo dato. No lo son: se dividen por cosas distintas y contestan
     * preguntas distintas, y el fallo clásico es llamar tasa a una aportación.
     *
     * EL DPS NO SE TOCA: sigue siendo daño ÷ duración de la pelea, que es la
     * cifra comparable con cualquier otro medidor. Aquí sólo se rotula.
     */
    refs.dps.textContent = n0(r.dps);
    refs.dps.title = t('row.tasaNote');
    refs.share.textContent = `${(r.share * 100).toFixed(1)}%`;
    refs.share.title = t('row.aportacionNote');
    refs.bar.innerHTML = `<div class="bar-track">${barHTML(r.types, r.share * 100)}</div>`;
    // LAS DOS VELOCIDADES, y no es una duplicada.
    //
    // El número grande de la fila es el daño partido por la pelea ENTERA: lo
    // que pones en el reloj del grupo, que es la pregunta del reparto. Éste de
    // aquí es el daño partido por los segundos en los que de verdad hiciste
    // algo: tu ritmo. Un lanzador que entra tarde puede tener un ritmo altísimo
    // y aportar poco, y con una sola cifra no se distinguen esos dos casos.
    //
    // Las dos se calculaban desde siempre y las dos se pintaban... dentro del
    // desplegable. Ésta sube a la línea que se ve sin abrir nada.
    refs.stats.innerHTML = [
      `<span>${t('row.damage')} <b>${n0(r.damage)}</b></span>`,
      r.dpsActive && Math.abs(r.dpsActive - r.dps) > 1
        ? `<span title="${esc(t('row.paceNote'))}">${t('row.pace')} <b>${n1(r.dpsActive)}</b></span>` : '',
      /**
       * LA VENTANA PROPIA, que estaba calculada y sólo se veía abriendo la ficha.
       *
       * Daño ÷ desde su primera acción hasta la última. Sube a la línea porque
       * es la que responde a «¿entró tarde?»: quien llega a mitad de pelea tiene
       * una tasa baja y una ventana propia normal, y con el número grande solo
       * esos dos casos no se distinguen. Sale únicamente cuando difiere, como el
       * ritmo — un dato repetido no informa, ocupa.
       */
      r.dpsOwn && Math.abs(r.dpsOwn - r.dps) > 1
        ? `<span title="${esc(t('row.ownNote'))}">${t('row.own')} <b>${n1(r.dpsOwn)}</b></span>` : '',
      // LA TERCERA VELOCIDAD: tu mejor tramo de diez segundos seguidos.
      //
      // Las otras dos contestan cuánto pusiste y a qué ritmo; ésta contesta si
      // fue un momento o fue un rato. Va aquí, en la línea que se ve sin abrir
      // nada, y no dentro del desplegable — que es donde estaban las otras dos
      // hasta que aprendimos que un dato al que hay que ir no está puesto.
      //
      // Sale con el múltiplo al lado porque el número solo no dice nada: 300 de
      // ráfaga es enorme para quien sostiene 100 y normal para quien sostiene
      // 280.
      //
      // Y EL MÚLTIPLO SE MIDE CONTRA EL RITMO, no contra el reparto. Medido
      // sobre el registro entero, 1.585 filas: contra el reparto la mediana es
      // ×2,28 y el 97,1% de las filas pasaría cualquier umbral —el denominador
      // está diluido por los segundos en que no hiciste nada, así que casi
      // todo el mundo «tiene ráfaga» y la cifra no separa a nadie—. Contra el
      // ritmo la mediana es ×1,29, el p90 ×1,97 y la mitad de las filas se
      // queda por debajo del umbral: entonces sí dice algo cuando aparece.
      //
      // Puede ser MENOR que 1 y es correcto: si sólo actuaste en cinco segundos
      // sueltos, tu ritmo es alto y ninguna ventana de diez los contiene.
      //
      // Aparece sólo cuando hay pico, igual que «ritmo» sólo aparece cuando
      // difiere del reparto: es la regla que ya tenía esta línea.
      (() => {
        const base = r.dpsActive || r.dps;
        if (!(r.rafaga10 > 0 && base > 0 && r.rafaga10 / base >= 1.3)) return '';
        return `<span title="${esc(t('row.burstNote'))}">${t('row.burst')} <b>${
          n0(r.rafaga10)}</b> <span class="dim">×${(r.rafaga10 / base).toFixed(1)}</span></span>`;
      })(),
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

/**
 * Cuánto tiempo estuvo puesto cada cosa que lanzaste.
 *
 * SE MIDE DE LANZAMIENTO A CAÍDA, y no de entrada a caída, porque el registro
 * no deja hacerlo de la otra forma. Medido sobre uno real: las 1.020 líneas de
 * caída llevan el nombre del hechizo, y las 2.839 de entrada NO llevan ninguno
 * —«notas una curación floreciendo en ti» no dice de qué—. Así que la entrada
 * es inservible para emparejar y el lanzamiento ocupa su sitio.
 *
 * CUATRO CASOS, y tres se pueden medir dentro de la pelea:
 *
 *   lanzado dentro + caído dentro   -> el intervalo exacto
 *   lanzado dentro, sin caer        -> desde el lanzamiento hasta el final;
 *                                      si hubiera caído habría línea de caída
 *   caído dentro, lanzado antes     -> desde el principio hasta la caída
 *   ni lanzado ni caído dentro      -> INVISIBLE, y se dice
 *
 * El cuarto es el agujero de verdad: un buff que te pusieron antes de empezar
 * y que sigue puesto al acabar no deja ni una línea en esta pelea. No se
 * cuenta como 0% ni como 100%: no se cuenta, y la nota lo dice.
 *
 * Y NO SE MIDE EL MANÁ NI EL VIGOR. El rendimiento sostenido de un lanzador se
 * lee de tres cosas —cuánto tiempo estuvo puesto el buff, cuánto maná costó y
 * cuánto vigor—, y el registro de EQL no da ninguna de las dos últimas. Esto es
 * la parte que sí se puede: el tiempo.
 */
function uptimeDatos(f) {
  const dur = Math.max(1, Math.round(f?.duration ?? 0));
  const casts = f?.casts ?? [];
  const fades = f?.fades ?? [];
  if (!fades.length && !casts.length) return null;

  // Sólo lo tuyo: el uptime de un buff ajeno no se puede seguir, porque de sus
  // caídas el registro sólo cuenta las que te tocan a ti.
  const yo = f.self ?? 'Campeon';
  const mios = casts.filter((c) => c.source === yo && c.ability);

  // Emparejar por nombre, en orden: cada lanzamiento con la primera caída
  // posterior que no esté ya cogida.
  const usadas = new Set();
  const tramos = new Map();          // hechizo -> [[desde, hasta], …]
  const anota = (nombre, a, b) => {
    if (!tramos.has(nombre)) tramos.set(nombre, []);
    tramos.get(nombre).push([Math.max(0, a), Math.min(dur, b)]);
  };

  for (const c of mios) {
    const i = fades.findIndex((x, k) => !usadas.has(k) && x.ability === c.ability && x.t >= c.t);
    if (i >= 0) { usadas.add(i); anota(c.ability, c.t, fades[i].t); }
  }
  // Las caídas sin lanzamiento delante: venía puesto de antes.
  const deAntes = new Set();
  fades.forEach((x, k) => {
    if (usadas.has(k)) return;
    anota(x.ability, 0, x.t);
    deAntes.add(x.ability);
  });
  // Y lo lanzado que nunca cayó: si hubiera caído habría línea.
  const sinCaer = new Set();
  for (const c of mios) {
    const yaTiene = (tramos.get(c.ability) ?? []).some(([a]) => a === c.t);
    if (yaTiene) continue;
    // Sólo si es algo que en esta partida SÍ produce línea de caída; si no, no
    // se sabe si era un buff o un nuke, y un nuke no tiene «tiempo puesto».
    if (!fades.some((x) => x.ability === c.ability)) continue;
    anota(c.ability, c.t, dur);
    sinCaer.add(c.ability);
  }
  if (!tramos.size) return null;

  const filas = [...tramos].map(([nombre, ts]) => {
    // Se unen los solapes: relanzar antes de que caiga no suma dos veces.
    const orden = ts.slice().sort((a, b) => a[0] - b[0]);
    const unidos = [];
    for (const [a, b] of orden) {
      const u = unidos.at(-1);
      if (u && a <= u[1]) u[1] = Math.max(u[1], b);
      else unidos.push([a, b]);
    }
    const seg = unidos.reduce((n, [a, b]) => n + Math.max(0, b - a), 0);
    return { nombre, unidos, seg, pct: seg / dur, veces: ts.length };
  }).sort((a, b) => b.seg - a.seg);

  return { filas, deAntes, sinCaer, dur };
}

function uptimeHTML(f) {
  const datos = uptimeDatos(f);
  if (!datos) return '';
  const { filas, deAntes, sinCaer, dur } = datos;

  const barra = (u) => u.map(([a, b]) => `<i style="left:${(a / dur * 100).toFixed(2)}%;width:${
    Math.max(0.6, (b - a) / dur * 100).toFixed(2)}%"></i>`).join('');

  return `<div class="uptime">
    <div class="hint">${esc(t('up.note'))}</div>
    ${filas.map((x) => `<div class="up-lane">
      <span class="up-name">${spellIcon(x.nombre)}${esc(x.nombre)}${
  deAntes.has(x.nombre) ? `<i class="up-mark" title="${esc(t('up.beforeNote'))}">${esc(t('up.before'))}</i>` : ''}${
  sinCaer.has(x.nombre) ? `<i class="up-mark" title="${esc(t('up.openNote'))}">${esc(t('up.open'))}</i>` : ''}</span>
      <span class="up-track">${barra(x.unidos)}</span>
      <span class="num"><b>${Math.round(x.pct * 100)}%</b></span>
      <span class="num dim">${secs(x.seg)}</span>
    </div>`).join('')}
    <div class="hint">${esc(t('up.blind'))}</div>
  </div>`;
}

/**
 * Qué lanzó cada uno y cuándo, en orden.
 *
 * PARA QUÉ SIRVE, que es lo que decide la forma: para ver si alguien estaba
 * usando lo suyo. Un líder de raid mira esto y ve que el que va equipado tiene
 * la fila medio vacía. Con una tabla de totales eso no se ve —puede haber
 * lanzado mucho al principio y nada después— y con una lista cronológica sin
 * separar por persona tampoco, porque se mezclan todos.
 *
 * Por eso es UNA FILA POR LANZADOR: la pregunta es de quién, no de cuándo.
 *
 * LO QUE NO SE GUARDABA. Hasta ahora sólo se guardaba el lanzamiento que
 * tuviera CATEGORÍA, y la categoría la tienen las utilidades: curas, raíces,
 * mez, miedo. Medido, se guardaba el 12% — y lo que se caía eran justo los
 * nukes, que es lo que se viene a mirar aquí. De 6.457 lanzamientos tuyos se
 * guardaban 702.
 *
 * NO ES UNA ESCALA DE TIEMPO REAL en el sentido de que cada marca tenga
 * anchura: una marca es un instante, no una duración. Lo que sí es real es su
 * POSICIÓN: el segundo en el que se lanzó, sobre la duración de la pelea.
 */
function lanzamientosHTML(f) {
  const casts = f?.casts ?? [];
  const dur = Math.max(1, f?.duration ?? 1);
  if (casts.length < 2) return '';

  const porQuien = new Map();
  for (const c of casts) {
    if (!c.source || !c.ability) continue;
    if (!porQuien.has(c.source)) porQuien.set(c.source, []);
    porQuien.get(c.source).push(c);
  }
  if (!porQuien.size) return '';

  // Los tuyos primero y luego por número de lanzamientos: la pregunta habitual
  // es sobre tu grupo, y los enemigos son contexto.
  const mios = new Set([f.self, ...(f.rows ?? []).filter((r) => r.side !== 'enemy').map((r) => r.name)]);
  const filas = [...porQuien].sort((a, b) => {
    const ma = mios.has(a[0]) ? 0 : 1, mb = mios.has(b[0]) ? 0 : 1;
    return ma - mb || b[1].length - a[1].length;
  });

  const marca = (c) => `<i class="cast-tick${c.cat ? ` cat-${esc(c.cat)}` : ''}"
    style="left:${(Math.min(dur, Math.max(0, c.t)) / dur * 100).toFixed(2)}%"
    title="${esc(`${secs(c.t)} · ${c.ability}`)}"></i>`;

  return `<div class="casts">
    <div class="hint">${esc(t('casts.note'))}</div>
    ${filas.map(([quien, lista]) => `<div class="cast-lane${mios.has(quien) ? ' mine' : ''}">
      <span class="cast-who">${esc(quien)}</span>
      <span class="cast-track">${lista.map(marca).join('')}</span>
      <span class="num dim">${lista.length}</span>
    </div>`).join('')}
    <div class="cast-foot eyebrow"><span>0s</span><span>${esc(secs(Math.round(dur)))}</span></div>
    ${f.castsCut ? `<div class="hint">${esc(t('casts.cut', { n: f.castsCut }))}</div>` : ''}
  </div>`;
}

/**
 * Aguantar, puesto como un rol.
 *
 * LOS DATOS ESTABAN TODOS y no se veían: el desglose defensivo ya se pintaba,
 * pero DENTRO de la fila de cada uno, al desplegarla. Así se puede saber cómo
 * te fue a ti si te acuerdas de abrir tu fila; lo que no se puede es mirar
 * quién aguantó en esta pelea, que es la pregunta del rol. Un dato al que hay
 * que ir no es el mismo dato que uno que está puesto.
 *
 * LO QUE ESTO NO DICE, Y NO ES UN DESCUIDO: si estuviste cerca de morir. El
 * registro no da la vida de nadie —ni la tuya— así que se puede decir cuánto
 * te llegó, cuántos golpes te tiraron y cuántos pararon en tu armadura, pero
 * no qué parte de tu barra quedaba. Cualquier cosa que lo sugiriese estaría
 * inventando: 3.000 recibidos es una tragedia con 3.100 de vida y un paseo con
 * 12.000, y la aplicación no sabe cuál de las dos.
 *
 * Por eso no hay barras de «presión», ni colores de peligro, ni un porcentaje
 * de nada que se parezca a la vida. Hay cuentas.
 */
function tanqueoHTML(f) {
  const filas = (f?.rows ?? []).filter((r) => r.taken > 0 || r.absorbed > 0)
    .sort((a, b) => b.taken - a.taken);
  if (!filas.length) return '';

  const total = filas.reduce((a, r) => a + r.taken, 0) || 1;
  // Las runas son pocas y eso se dice con la cifra al lado: con veintitantos
  // datos no hay proporción que valga, así que se enseña el bruto y cuántas
  // veces pasó, nunca un porcentaje.
  const runas = filas.reduce((a, r) => a + (r.absorbHits ?? 0), 0);

  const fila = (r) => {
    const paradas = (r.defense ?? []).filter(([k]) => k !== 'fallo');
    const detenidos = paradas.reduce((a, [, n]) => a + n, 0);
    return `<div class="tank-row">
      <span class="tank-name">${esc(r.name)}</span>
      <span class="num"><b>${n0(r.taken)}</b></span>
      <span class="num dim">${pct(r.taken / total)}</span>
      <span class="num dim">${n1(r.taken / Math.max(1, r.ownSec ?? f.duration ?? 1))}/s</span>
      <span class="num dim">${r.healingTaken ? n0(r.healingTaken) : '—'}</span>
      <span class="num dim">${n0(r.swingsAgainst)}</span>
      <span class="tank-def">${paradas.length
    ? paradas.map(([k, n]) => `<i class="tank-chip">${esc(k)} <b>${n}</b></i>`).join('')
    : `<span class="dim">—</span>`}</span>
      <span class="num dim">${detenidos ? `${n0(detenidos)}` : '—'}</span>
      <span class="num">${r.absorbed
    ? `<b class="abs">${n0(r.absorbed)}</b> <span class="dim">${
      esc(t('tank.inRunes', { n: r.absorbHits }))}</span>` : '<span class="dim">—</span>'}</span>
    </div>`;
  };

  return `<div class="tank">
    <div class="hint">${esc(t('tank.note'))}</div>
    <div class="tank-head eyebrow">
      <span>${esc(t('tank.who'))}</span>
      <span class="r">${esc(t('det.taken'))}</span>
      <span class="r">${esc(t('det.share'))}</span>
      <span class="r">${esc(t('det.takenPerSec'))}</span>
      <span class="r">${esc(t('det.healTaken'))}</span>
      <span class="r">${esc(t('det.attacksTaken'))}</span>
      <span>${esc(t('tank.stopped'))}</span>
      <span class="r">${esc(t('tank.stoppedN'))}</span>
      <span class="r">${esc(t('tank.absorbed'))}</span>
    </div>
    ${filas.map(fila).join('')}
    ${runas ? `<div class="hint">${esc(t('tank.runeNote', { n: runas }))}</div>` : ''}
  </div>`;
}

/**
 * EL CORCHETE DEL FUEGO AMIGO. Dice lo que está medido y se calla lo demás.
 *
 * Lo que se puede afirmar sin deducir nada es esto: dos miembros declarados de
 * tu grupo se estuvieron pegando durante N segundos. Eso es exactamente lo que
 * se ve al jugar —«¿por qué me está pegando mi compañero?»— y es una frase que
 * el registro respalda línea a línea.
 *
 * LO QUE NO DICE, Y LA TENTACIÓN ERA DECIRLO: «te encantaron». La explicación
 * casi segura es que al compañero lo encantó el jefe, pero el registro no
 * escribe ni una línea que nombre al encantado — comprobado sobre el episodio
 * real, donde no hay NADA entre el último golpe suyo al jefe y el primero al
 * grupo. Poner la causa sería vestir una deducción de medida.
 *
 * SÍ SE PUEDE PONER AL LADO UN HECHO VECINO, Y ES EL DE ESE EPISODIO: qué fue
 * lo último que lanzó el enemigo antes de que empezara, sea lo que sea, con la
 * distancia en segundos al lado. Ver `previoDe` en `src/engine.js`, donde está
 * medido por qué NO puede ser un agregado de la pelea entera.
 */
// «Hace 0 s» no es una distancia, es el mismo segundo, y decirlo con un cero
// obliga a traducirlo mentalmente. Son 16 de los 31 tramos medidos, así que no
// es un caso raro que se pueda despachar con la frase general.
const vecinoHTML = (p) => (p
  ? `<div class="hint">${esc(t(p.dt ? 'ally.previo' : 'ally.previoYa',
    { spell: p.ability, who: p.source, s: p.dt }))}</div>`
  : '');

function entreTuyosHTML(f) {
  const e = f?.entreTuyos;
  if (!e?.quien?.length) return '';
  return `<div class="nota-bloque">
    <div class="nota-h">${esc(t('ally.title'))}</div>
    ${e.quien.map((q) => `<div class="nota-fila">
      <b>${esc(t('ally.row', { who: q.name, s: q.segundos }))}</b>
      <span class="dim">${esc(t('ally.rowNote', {
    n: q.golpes, d: n0(q.daño), contra: q.contra.join(', '), a: q.desde, b: q.hasta }))}</span>
      ${vecinoHTML(q.previo)}
    </div>`).join('')}
    <div class="hint">${esc(t('ally.note'))}</div>
  </div>`;
}

/**
 * LOS SEGUNDOS EN QUE TU PERSONAJE NO ERA TUYO.
 *
 * Los dos extremos están escritos en el registro, así que el tramo es medido de
 * punta a punta. Lo que NO está escrito es la causa: la misma línea la produce
 * un encanto y un miedo.
 *
 * Y por eso el rótulo no dice «encantado» salvo cuando hay con qué: que dentro
 * del tramo le pegaras a los tuyos. Eso es conducta observada. En el registro
 * de referencia son 31 tramos y ninguno lo cumple —los 31 fueron miedo—, así
 * que un rótulo fijo de «encantado» habría mentido 31 veces de 31.
 *
 * AL LADO DE CADA TRAMO VA SU PROPIO VECINO, y no el de la pelea. La primera
 * versión ponía aquí un agregado de la canción de encanto del jefe, y eso era
 * escoger el candidato bonito contra la propia medición: de los 31 tramos, 18
 * venían detrás de un miedo y 10 detrás del encanto. Ver `previoDe` en
 * `src/engine.js`.
 */
// El rótulo sale del falsador, y las tres respuestas son excluyentes: sin
// acciones es miedo, con golpes a los tuyos es encanto, y si actuaste contra el
// enemigo no es ninguna de las dos y se dice así en vez de elegir.
const FILA_CTRL = { miedo: 'ctrl.rowMiedo', encanto: 'ctrl.rowCharm' };

function sinControlHTML(f) {
  const sc = f?.sinControl;
  if (!sc?.length) return '';
  const total = sc.reduce((a, x) => a + x.segundos, 0);
  return `<div class="nota-bloque">
    <div class="nota-h">${esc(t('ctrl.title', { s: total }))}</div>
    ${sc.map((x) => `<div class="nota-fila">
      <b>${esc(t(FILA_CTRL[x.causa] ?? 'ctrl.row', { s: x.segundos, a: x.desde, b: x.hasta }))}</b>
      ${x.causa === 'encanto'
    ? `<span class="dim">${esc(t('ctrl.charmed', { n: x.aTuyos, d: n0(x.daño) }))}</span>` : ''}
      ${x.causa === null
    ? `<span class="dim">${esc(t('ctrl.rara', { n: x.aEnemigo }))}</span>` : ''}
      ${x.cierre === 'pelea' ? `<span class="dim">${esc(t('ctrl.open'))}</span>` : ''}
      ${vecinoHTML(x.previo)}
    </div>`).join('')}
    <div class="hint">${esc(t('ctrl.note'))}</div>
    <div class="hint">${esc(t('ctrl.nocuenta', { s: total }))}</div>
    ${dpsMandoHTML(f)}
  </div>`;
}

/**
 * TU DPS SOBRE EL TIEMPO QUE SÍ MANEJABAS, al lado del de siempre.
 *
 * El denominador es donde más te penaliza un secuestro: veinte segundos
 * encantado te hunden la cifra por un rato en el que no decidías nada. Y sin
 * embargo `dps` NO se cambia — divide por la pelea entera, que es la convención
 * de siempre, y moverla en silencio dejaría tus números sin poder compararse con
 * ningún otro.
 *
 * Así que se enseñan los dos, con la resta delante. Es la misma solución que el
 * resto del programa da cuando hay dos maneras legítimas de contar: las dos, con
 * su nombre, en vez de elegir una y callarse la otra.
 *
 * La fila tuya se reconoce por `sinMandoSec`, que sólo la tuya trae: el registro
 * no dice nada del mando de los demás.
 */
function dpsMandoHTML(f) {
  const yo = (f?.rows ?? []).find((r) => (r.sinMandoSec ?? 0) > 0);
  if (!yo || !f.duracionMando || f.duracionMando >= f.duration) return '';
  return `<div class="nota-fila">${esc(t('ctrl.dps', {
    a: n1(yo.damage / f.duracionMando), b: n1(yo.dps ?? 0), s: f.duracionMando, d: f.duration }))}</div>`;
}

/**
 * LO QUE ESTA PELEA NO SABE. Los contadores de incertidumbre, encendidos.
 *
 * ═══ EL FALLO QUE ESTO CIERRA, Y ES EL MÁS GRAVE DE LA SEMANA ═══
 *
 * El programa llevaba versiones CALCULANDO SU PROPIA INCERTIDUMBRE Y TIRÁNDOLA.
 * Tres cifras, las tres correctas, las tres sin un solo lector:
 *
 *   `unattributed`     daño real que no se puede adjudicar a nadie —un escudo
 *                      de daño sin posesivo—. Fuera de todos los totales, con
 *                      un comentario al lado que dice «se aparta, que es lo que
 *                      promete el README, y la ficha lo dice». La ficha no lo
 *                      decía.
 *   `charm.soltado`    daño contado como enemigo apoyándose en una DEDUCCIÓN
 *                      —que el encanto se rompió al encadenar otro— y no en una
 *                      línea. Ni un lector, ni siquiera una prueba.
 *   botín ambiguo      recogidas donde dos cadáveres eran igual de buenos
 *                      candidatos, con el comentario «se cuentan para poder
 *                      decir cuánto no se sabe, NO PARA TAPARLO». Se estaba
 *                      tapando.
 *
 * Los dos últimos comentarios no son documentación: son promesas escritas que
 * el código incumplía. Eso los separa del resto de la salida muerta, que sólo
 * estaba sin usar.
 *
 * Y LA IRONÍA QUE LO EXPLICA TODO: al diseñar la guarda del botín se decidió no
 * marcar el 32% de las recogidas porque «marcarlo todo dejaría la ficha llena de
 * dudas que no lo son», y se afinó hasta el 0,2% que de verdad es dudoso. El
 * razonamiento era bueno. Lo que nadie comprobó es que ese 0,2% tampoco se
 * enseñaba: llevábamos versiones marcando el 0%.
 *
 * CÓMO SE ENSEÑA. Juntos y no repartidos, porque son la misma pregunta —«¿de
 * qué parte de esta pelea no me puedo fiar?»— y separados vuelven a ser tres
 * notas que nadie relaciona. Cada uno con su certeza dicha: lo de `soltado` va
 * marcado como deducido con la misma señal que el resto del programa, porque no
 * tiene ni una línea que lo respalde.
 *
 * Y NO CUESTA NI UN CAMPO NUEVO NI UNA RECONSTRUCCIÓN: los tres números ya
 * estaban calculados y guardados. Lo único que faltaba era leerlos.
 */
function incertidumbreHTML(f) {
  if (!f) return '';
  const filas = [];
  if (f.unattributed > 0) {
    filas.push({ txt: t('inc.unattributed', { n: n0(f.unattributed) }), dedu: false });
  }
  const sol = f.charm?.soltado;
  if (sol?.daño > 0) {
    filas.push({ txt: t('inc.soltado', { n: n0(sol.daño), g: sol.golpes }), dedu: true });
  }
  // El botín ambiguo se cuenta de la propia pelea y no de un contador aparte:
  // la marca por objeto ya viaja en `amb`, así que el número sale de sumarla y
  // no hace falta guardar nada nuevo.
  const amb = (f.loot ?? []).filter((l) => l.amb).length;
  if (amb > 0) filas.push({ txt: t('inc.loot', { n: amb }), dedu: true });
  if (!filas.length) return '';
  return `<div class="nota-bloque">
    <div class="nota-h">${esc(t('inc.title'))}</div>
    ${filas.map((x) => `<div class="nota-fila">${esc(x.txt)}${
    x.dedu ? ` <span class="dim">· ${esc(t('inc.dedu'))}</span>` : ''}</div>`).join('')}
    <div class="hint">${esc(t('inc.note'))}</div>
  </div>`;
}

/**
 * LA PELEA QUE SE SABE QUE ESTÁ MAL, DICHO DONDE SE VEN SUS CIFRAS.
 *
 * `f.duda` lleva desde la 1.11.0 calculándose en el almacén —con su fichero, su
 * comprobación de contenido y su prueba— y NO SE PINTABA EN NINGUNA PARTE. Es el
 * caso de manual: medirlo no es enseñarlo, y un dato al que hay que ir no es un
 * dato puesto. Una pelea marcada como incorrecta que enseña sus cifras como si
 * fueran buenas está exactamente igual de mal que si nadie la hubiera marcado,
 * con el agravante de que parece resuelto.
 *
 * VA ARRIBA Y NO EN UNA NOTA AL PIE, pegado a las tarjetas cuyos números
 * invalida. Y dice cuáles: el daño personal está bien, y tacharlo todo haría que
 * la gente dejara de creerse una pelea que en su mayor parte es correcta.
 */
function dudaHTML(f) {
  const d = f?.duda;
  if (!d) return '';
  const quien = (d.filas ?? []).join(', ');
  // El texto se elige por `motivo` —qué pasó— y la cifra se lee sobre el total
  // que dice `sobre`, que es OTRA cosa: una duda infla el bando enemigo y la
  // otra el tuyo. Sin mirar `sobre`, la frase sería correcta en un caso y
  // exactamente al revés en el otro.
  const cuerpo = t(d.motivo === 'compa-en-bando-enemigo' ? 'duda.compa' : 'duda.charm',
    { n: n0(d.daño), total: n0(d.total ?? 0), quien,
      cual: t(d.sobre === 'enemyTotal' ? 'metric.enemyTotal' : 'metric.total') });
  const CAMPOS = { total: 'metric.total', raidDps: 'metric.raidDps',
    enemyTotal: 'metric.enemyTotal', enemyDps: 'metric.enemyDps' };
  const campos = (d.invalida ?? []).map((k) => (CAMPOS[k] ? t(CAMPOS[k]) : k)).join(', ');
  return `<div class="duda">
    <div class="duda-h">${esc(t('duda.head'))}</div>
    <p>${esc(cuerpo)}</p>
    <p class="hint">${esc(t('duda.invalida', { campos }))}</p>
    <p class="hint">${esc(t('duda.arregla'))}</p>
  </div>`;
}

/**
 * Enseña una caja de notas, o la esconde si no hay ninguna.
 *
 * El «o la esconde» no es un detalle: una caja con borde y sin contenido se lee
 * como algo que se cargó a medias. Lo hacía `renderRows` para su bloque; ahora
 * lo necesitan dos secciones y vive aquí para que no se separen.
 */
function pinta(caja, trozos) {
  if (!caja) return;
  const html = trozos.filter(Boolean).join('');
  caja.style.display = html ? 'block' : 'none';
  if (html) caja.innerHTML = html;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PINTAR SIN DESTRUIR LO QUE SE ESTÁ ESCRIBIENDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EL FALLO, TRES VECES: el motor empuja un snapshot **cada 250 ms**. Una
 * sección que reescribe su `innerHTML` en cada pasada destruye y recrea sus
 * `<input>` cuatro veces por segundo, y entonces **no se puede escribir en
 * ellos**: la letra recién tecleada se va con el nodo viejo.
 *
 * Pasó en el asistente, pasó en la pantalla de configuración y pasó en
 * Reapariciones. Las dos primeras se arreglaron **con un comentario y una
 * guarda a mano en cada sitio**, y la tercera no las copió — porque copiar un
 * patrón exige acordarse de que existe. La cuarta tampoco se acordaría.
 *
 * ASÍ QUE LA GUARDA ES ESTA FUNCIÓN, y no un patrón. Se llama, y ya está.
 *
 * ── EL CONTRATO ───────────────────────────────────────────────────────────
 *
 * `construye(conVolatil)` devuelve el HTML de la sección. Con `false` devuelve
 * **el mismo HTML sin las partes que cambian solas** —los relojes, las cuentas
 * atrás, las barras—, y eso es la FIRMA.
 *
 * Que la firma se genere con el mismo constructor es la parte que importa. Una
 * firma escrita a mano —una lista de los campos que afectan al HTML— es más
 * barata y se queda coja en cuanto la sección cambie: bastaría con añadir un
 * rótulo y olvidarse de meterlo en la lista para que ese rótulo **no se
 * repintara nunca**, sin ningún síntoma. Generando el mismo HTML dos veces, la
 * firma no se puede desincronizar de lo que se pinta.
 *
 * `refresca(host)` actualiza a mano lo volátil sobre el DOM que ya está puesto.
 * Se llama SÓLO cuando la firma no ha cambiado, así que puede dar por hecho que
 * la estructura es la que dejó.
 *
 * Devuelve `'refrescado'` o `'reconstruido'`. Los escuchadores se cuelgan tras
 * una reconstrucción y sólo tras ella: los nodos de antes siguen vivos y con
 * los suyos puestos.
 *
 * ── Y CUANDO SÍ HAY QUE RECONSTRUIR ───────────────────────────────────────
 *
 * Se conserva **foco, valor y posición del cursor**. No sobra: reordenar una
 * cola mientras escribes también te quita el campo de debajo. Y conservar sólo
 * el valor no basta —el cursor salta al final y la selección se pierde—, que es
 * justo lo que `bin/ui-teclear.js` distingue mirando si el NODO es el mismo.
 *
 * Lo vigila `test/campos-editables.js`, que lee este fichero y exige que toda
 * función que reescriba DOM con un campo editable dentro pase por aquí.
 */
function focoDentroDe(host) {
  const el = document.activeElement;
  if (!el || !host.contains(el)) return null;
  if (!el.matches?.('input, textarea, [contenteditable]')) return null;
  const campos = [...host.querySelectorAll('input, textarea, [contenteditable]')];
  return {
    id: el.id || null,
    // La posición entre los campos es el respaldo cuando no hay `id`: un entero
    // no tiene nada que un parser pueda estropear, que es la lección del
    // ` ` en un atributo.
    idx: campos.indexOf(el),
    valor: el.value,
    ini: el.selectionStart, fin: el.selectionEnd,
  };
}

function devuelveFoco(host, f) {
  if (!f) return;
  const campos = [...host.querySelectorAll('input, textarea, [contenteditable]')];
  const el = (f.id && host.querySelector(`#${CSS.escape(f.id)}`)) || campos[f.idx];
  if (!el) return;
  if (f.valor !== undefined && el.value !== undefined) el.value = f.valor;
  el.focus();
  try { el.setSelectionRange(f.ini, f.fin); } catch { /* no todo campo lo admite */ }
}

/**
 * LA IDENTIDAD DE UN CAMPO, para poder devolverle lo suyo tras reconstruir.
 *
 * Su `id` si lo tiene; si no, el atributo que lo distingue de sus hermanos.
 * NUNCA la posicion: la cola de temporizadores se reordena sola -manda el que
 * antes vuelve- y el tercer campo de antes no es el tercero de ahora.
 */
function identidadDeCampo(e) {
  if (e.id) return `#${e.id}`;
  for (const a of ['man', 'set', 'quita', 'et', 'campo']) {
    if (e.dataset?.[a] != null) return `${a}=${e.dataset[a]}`;
  }
  return null;
}

/**
 * LO QUE EL JUGADOR HA TOCADO NO LO PISA EL MODELO.
 *
 * `devuelveFoco` conserva UN campo: el que tuviera el foco. Eso deja fuera el
 * caso normal — escribir, mover el raton, y que el siguiente repintado devuelva
 * el campo a su valor de siempre.
 *
 * Medido sobre las quince secciones con `bin/campos-todos.js`: de veintidos
 * campos, uno perdia lo escrito. Y no se quedaba en blanco, que se veria: volvia
 * a «30:00», el valor del modelo. **Un campo que vuelve a un valor plausible es
 * peor que uno que se borra**, porque el segundo se nota.
 */
function tocados(host) {
  const out = new Map();
  for (const e of host.querySelectorAll('[data-sucio="1"]')) {
    const k = identidadDeCampo(e);
    if (k) out.set(k, e.value);
  }
  return out;
}

function devuelveTocados(host, guardados) {
  if (!guardados?.size) return;
  for (const e of host.querySelectorAll('input, textarea, select')) {
    const k = identidadDeCampo(e);
    if (k == null || !guardados.has(k)) continue;
    e.value = guardados.get(k);
    e.dataset.sucio = '1';
  }
}

function pintaEstable(host, construye, refresca, clave = 'sigEstable') {
  if (!host) return 'sin hueco';
  // Marcar lo tocado se cuelga UNA vez por hueco: el escuchador es delegado y
  // sobrevive a que le reescriban los hijos.
  if (host.dataset.moSucio !== '1') {
    host.dataset.moSucio = '1';
    host.addEventListener('input', (e) => {
      if (e.target.matches?.('input, textarea, select')) e.target.dataset.sucio = '1';
    });
  }
  const firma = construye(false);
  if (host.dataset[clave] === firma && host.firstElementChild) {
    refresca?.(host);
    return 'refrescado';
  }
  const foco = focoDentroDe(host);
  const suyos = tocados(host);
  host.innerHTML = construye(true);
  host.dataset[clave] = firma;
  devuelveTocados(host, suyos);
  devuelveFoco(host, foco);
  return 'reconstruido';
}

/**
 * Lo que el encanto dejó sin poder atribuir, dicho y no escondido.
 *
 * Sale sólo cuando dos bichos del MISMO nombre se pegaron entre ellos y uno
 * estaba encantado: ahí el registro no dice cuál era cuál. Todo lo demás se
 * reparte por el objetivo y es medido. La cifra estimada va aparte y no está
 * sumada al daño de nadie.
 */
function charmHTML(f) {
  const c = f?.charm;
  if (!c) return '';
  return `<div>${esc(t('charm.amb', { n: c.golpes, d: n0(c.daño) }))}`
    + (c.estimadoTuyo !== null ? ` ${esc(t('charm.est', { d: n0(c.estimadoTuyo) }))}` : '')
    + '</div>';
}

function renderRows(snap) {
  const f = withPets(fightFor(snap));
  const host = $('rows');
  if (!f) { host.innerHTML = ''; state.rowNodes.clear(); return; }
  const live = isLive(f);
  const seen = new Set();

  // LA NOTA, PARTIDA EN DOS POR EL ARMAZÓN.
  //
  // Las cuatro cosas que vivían aquí juntas contestan dos preguntas distintas y
  // se van a dos secciones: lo que la pelea NO SABE —el encanto ambiguo y los
  // contadores de incertidumbre— es qué pasó, y va a Escena; el fuego amigo y
  // los tramos sin mando son cómo fue la pelea, y van a Análisis. Aquí se queda
  // lo segundo hasta que Análisis exista (mudanza 4).
  pinta($('charmNote'), [entreTuyosHTML(f), sinControlHTML(f)]);

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
    // La clave lleva la marca: el encantado y el salvaje tienen el MISMO
    // nombre y son dos filas. Con la clave a secas, la segunda pisaba a la
    // primera y sólo se veía una, con los datos de una sola.
    //
    // Y `seen` va con la MISMA clave. Con el nombre a secas, la limpieza de
    // abajo —que recorre `rowNodes` por su clave— no encontraba la del
    // encantado y la borraba justo después de crearla: se pintaba y
    // desaparecía dentro del mismo repintado, y desde fuera parecía que esa
    // fila no llegaba a existir nunca.
    const clave = r.charmed ? `${r.name}\u0000charm` : r.name;
    seen.add(clave);
    let node = state.rowNodes.get(clave);
    if (!node) { node = buildRow(r.name); state.rowNodes.set(clave, node); }
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

  // Aguantar, lanzamientos y uptime: tres preguntas más sobre la misma pelea,
  // cada una con su pestaña y su titular puesto en ella.
  renderDocs(f);
  if (state.hover) updateTip();
}

/**
 * Los documentos de la pelea: una pregunta cada uno, uno visible a la vez.
 *
 * POR QUÉ UNA BARRA Y NO EL APILADO DE ANTES. Aguantar, lanzamientos y uptime
 * son tres preguntas distintas sobre la misma pelea, y estaban una debajo de
 * otra al final de una pantalla que ya traía cabecera, gráfica, consejo y el
 * reparto entero. El tercero no lo veía nadie: no porque estuviera cerrado,
 * sino porque estaba a un gesto —bajar del todo— que nadie hace.
 *
 * Y AQUÍ ESTÁ LA CONDICIÓN QUE HACE QUE ESTO NO SEA UN CAJÓN: cada pestaña
 * lleva su TITULAR, y el titular es la respuesta en una línea. «Aguantar ·
 * Notarino 62%» contesta la pregunta sin abrir nada; lo que queda dentro es el
 * detalle de esa respuesta. Una pestaña que sólo dijera «Aguantar» sería un
 * cajón, y esconder un dato en un cajón es exactamente lo que se quería evitar.
 *
 * Por eso `head()` es obligatorio y no adorno: si un documento no sabe decir su
 * titular en cuatro palabras, no está listo para ser una pestaña.
 *
 * `head(f)` devuelve null cuando esa pelea no tiene ese dato. Entonces la
 * pestaña no se pinta: una pestaña vacía es una promesa incumplida.
 */
/**
 * AGUANTAR DEJA DE SER PESTAÑA Y PASA A SER BLOQUE, en la mudanza 4.
 *
 * Se va a Análisis —quién aguantó es cómo fue la pelea, no qué pasó— y allí no
 * hay barra de documentos: sería una barra de una sola pestaña.
 *
 * PERO NO PIERDE SU TITULAR, que es lo que lo distinguía de un cajón: «Aguantar
 * · Notarino 62%» contesta la pregunta sin abrir nada, y esa línea es un
 * elemento del inventario (D1), no un adorno. El bloque la lleva de subtítulo, y
 * conserva la otra regla de las pestañas: si `head()` devuelve null —esa pelea
 * no tiene a nadie que aguantara— el bloque no se pinta. Sale de aquí y no de
 * una copia, para que no puedan divergir.
 */
const DOC_AGUANTAR = {
  id: 'tank',
  label: () => t('tank.title'),
  head: (f) => {
    const filas = (f?.rows ?? []).filter((r) => r.taken > 0 || r.absorbed > 0)
      .sort((a, b) => b.taken - a.taken);
    if (!filas.length) return null;
    const total = filas.reduce((a, r) => a + r.taken, 0) || 1;
    return `${filas[0].name} ${pct(filas[0].taken / total)}`;
  },
  body: tanqueoHTML,
};

const DOCS = [
  {
    id: 'casts',
    label: () => t('casts.title'),
    head: (f) => {
      const n = (f?.casts ?? []).filter((c) => c.source && c.ability).length;
      return n < 2 ? null : n0(n);
    },
    body: lanzamientosHTML,
  },
  {
    id: 'uptime',
    label: () => t('up.title'),
    head: (f) => {
      const d = uptimeDatos(f);
      if (!d?.filas?.length) return null;
      const x = d.filas[0];
      return `${x.nombre} ${Math.round(x.pct * 100)}%`;
    },
    body: uptimeHTML,
  },
];

/**
 * EL REGISTRO: de dónde sale todo lo demás. Extracción 11.
 *
 * No es un dato más. Todo lo que enseña esta aplicación es una cuenta sobre
 * estas líneas, así que la última pregunta que se puede hacer de cualquier cifra
 * es ésta, y aquí está la respuesta entera.
 *
 * Es el único que no sale de la pelea guardada: las líneas se leen del fichero
 * cuando lo abres, por hora. Por eso su cuerpo es asíncrono y los otros no — se
 * pinta un aviso de espera y se rellena al llegar.
 *
 * ── POR QUÉ SALE DEL ARRAY Y NO SE QUEDA COMO PESTAÑA ─────────────────────
 *
 * Ha cambiado de categoría: era uno de varios documentos y ahora es una sección.
 * **Lo que deja su categoría no conserva la maquinaria de la que abandonó** — una
 * barra de una sola pestaña se siente mal porque el control pertenece a un
 * problema que ya no tiene: elegir entre varios.
 *
 * LA DEFINICIÓN SE QUEDA ÚNICA. Rótulo, titular y cuerpo salen de aquí, y la
 * sección los usa; no hay copia que pueda divergir en su contenido.
 *
 * Y EL RIESGO DE ESTE CAMINO, escrito para poder cazarlo: **el día que cambie
 * cómo se pintan los documentos, el Registro puede no seguirlo; eso es la
 * divergencia que hay que cazar.** No comparte el `renderDocs` que decide qué
 * pestaña está abierta, cómo se repinta y cuándo se pide lo asíncrono: eso lo
 * hace ahora `renderRegistro` por su cuenta.
 */
const DOC_REGISTRO = {
  id: 'log',
  label: () => t('log.title'),
  head: (f) => {
    const at = f?.at ?? (f?.start ? f.start * 1000 : null);
    if (!at) return null;
    const h = (ms) => new Date(ms).toLocaleTimeString(langInfo().code,
      { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${h(at)}–${h(at + (f.duration ?? 0) * 1000)}`;
  },
  body: registroHTML,
  async: true,
};

/**
 * El registro de una pelea, leído del fichero.
 *
 * Se cachea por pelea: abrir la pestaña, mirar otra cosa y volver no vuelve a
 * leer el disco. La pelea viva no se cachea — sigue creciendo.
 */
const registroCache = new Map();

function registroHTML(f) {
  const at = f?.at ?? (f?.start ? f.start * 1000 : null);
  if (!at) return `<div class="hint">${esc(t('log.noTime'))}</div>`;
  const clave = f.uid ?? 'live';
  const r = registroCache.get(clave);
  if (!r) return `<div class="hint">${esc(t('log.loading'))}</div>`;

  if (!r.ok) {
    // NUNCA UNA LISTA VACÍA. Que no haya líneas y que no se puedan leer son dos
    // cosas distintas, y la segunda tiene un motivo que se puede decir.
    const detalle = r.motivo === 'fuera-de-rango' && r.span
      ? t('log.outOfRangeSpan', {
        desde: cuando(r.span.desde * 1000), hasta: cuando(r.span.hasta * 1000),
      })
      : '';
    return `<div class="hallazgo">${esc(t(`log.err.${r.motivo}`) )} ${esc(detalle)}</div>`;
  }

  const hora = (ms) => new Date(ms).toLocaleTimeString(langInfo().code, { hour12: false });
  return `<div class="hint">${esc(t('log.note'))}</div>
    <div class="logbox">${r.lineas.map((l) => `<div class="logline">
      <span class="lt">${l.t ? esc(hora(l.t * 1000)) : ''}</span><span class="lx">${esc(l.texto)}</span>
    </div>`).join('')}</div>
    ${r.recortadas ? `<div class="hint">${esc(t('log.cut', { n: r.recortadas }))}</div>` : ''}`;
}

/** Pide las líneas de una pelea y repinta cuando llegan. */
async function pedirRegistro(f, repintar) {
  const at = f?.at ?? (f?.start ? f.start * 1000 : null);
  if (!at) return;
  const clave = f.uid ?? 'live';
  if (registroCache.has(clave) && clave !== 'live') return;
  const desde = Math.round(at / 1000);
  const hasta = desde + (f.duration ?? 0);
  try {
    const r = await window.eql.logContext?.(desde, hasta);
    registroCache.set(clave, r ?? { ok: false, motivo: 'error' });
  } catch {
    registroCache.set(clave, { ok: false, motivo: 'error' });
  }
  repintar?.();
}

/**
 * La barra de documentos y el que esté abierto.
 *
 * Se repinta con guarda de firma porque en una pelea viva esto pasa cuatro
 * veces por segundo: sin ella, el documento abierto se reconstruiría entero y
 * no se podría ni seleccionar una cifra para copiarla.
 */
function renderDocs(f) {
  const bar = $('docBar');
  const pane = $('docPane');
  if (!bar || !pane) return;

  const vivos = DOCS.map((d) => ({ d, titular: f ? d.head(f) : null })).filter((x) => x.titular !== null);
  if (!vivos.length) { bar.innerHTML = ''; pane.innerHTML = ''; bar.dataset.sig = ''; pane.dataset.sig = ''; return; }

  // El elegido sigue siéndolo mientras esa pelea lo tenga; si no, el primero.
  // Se cae al primero y no a «ninguno» porque un panel vacío desperdicia el
  // sitio: siempre hay un documento abierto.
  const abierto = vivos.some((x) => x.d.id === state.doc) ? state.doc : vivos[0].d.id;
  if (abierto !== state.doc) state.doc = abierto;

  const sigBar = `${getLang()}|${abierto}|${vivos.map((x) => `${x.d.id}:${x.titular}`).join('|')}`;
  if (bar.dataset.sig !== sigBar) {
    bar.dataset.sig = sigBar;
    bar.innerHTML = vivos.map(({ d, titular }) => `<button class="doctab${
      d.id === abierto ? ' on' : ''}" data-doc="${d.id}" title="${esc(d.label())}">
      <span class="doctab-l">${esc(d.label())}</span>
      <span class="doctab-h">${esc(titular)}</span>
    </button>`).join('');
  }

  const doc = DOCS.find((d) => d.id === abierto);
  // El registro se lee del disco, así que su firma incluye si ya llegó: sin
  // esto el panel se quedaría con el «cargando…» para siempre.
  const listo = doc.async ? (registroCache.has(f.uid ?? 'live') ? 1 : 0) : '';
  const sigPane = `${getLang()}|${abierto}|${f.uid ?? 'live'}|${f.total}|${f.duration}|${f.casts?.length ?? 0}|${listo}`;
  if (pane.dataset.sig !== sigPane) {
    pane.dataset.sig = sigPane;
    pane.innerHTML = doc.body(f);
  }
  // Se pide DESPUÉS de pintar el aviso de espera, y sólo si el documento
  // abierto es el que lo necesita: leer el registro de una pelea que nadie está
  // mirando sería trabajo de disco para nada.
  if (doc.async && !listo) pedirRegistro(f, () => renderDocs(withPets(fightFor(state.snap))));
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

/**
 * El rótulo de una caja de la página apilada, reescrito en cada pasada.
 *
 * LAS CUATRO SE PRESENTAN IGUAL, y hasta ahora sólo lo hacían dos: Botín lo
 * saca de `lootHTML` y El registro del suyo, pero Escena y Por habilidad no
 * tenían ninguno. Sueltas en el panel daba lo mismo —la barra lateral las
 * nombraba—, apiladas se tocaban sin nada que dijera dónde acaba una.
 *
 * Se escribe aquí y no en el `innerHTML` de cada sección porque ese armazón se
 * monta UNA VEZ, detrás de una guarda por id: un título horneado dentro se
 * quedaría con el idioma del arranque y no cambiaría al cambiar de idioma.
 */
function ponRotulo(id, clave) {
  const n = $(id);
  if (n) n.textContent = t(clave);
}

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

  // LA FORMA DEL GOLPE, en lugar del mínimo y el máximo.
  //
  // La columna «mín–máx» que había aquí eran dos muestras de n=1 puestas al
  // lado de sumas de cientos, y se leían como si valieran lo mismo. Un ataque
  // medido en el registro de referencia con n=557 daba 3–60 cuando hace 25 casi
  // siempre. La mediana y el p10–p90 contestan esa misma pregunta y no se las
  // lleva un golpe raro. El máximo se queda: el mayor golpe SÍ es una pregunta,
  // y está en la línea de la fila y en el rótulo emergente.
  //
  // No se deja el mín–máx al lado de la mediana a propósito. Una cifra frágil
  // junto a cifras robustas invita a leerla como las demás, que es justo lo que
  // hacía daño.
  const dosModas = r.abilities.filter((a) => a.bimodal);
  // Distinguir «pocos golpes» de «pelea vieja» se puede, así que se dice cuál
  // de las dos es: la primera se arregla peleando y la segunda reconstruyendo.
  // La línea de la mascota no cuenta para ninguna de las dos: no es un ataque.
  const sinContar = r.abilities.some((a) => !a.pet && a.p50 === undefined && a.n >= 8);

  const celdas = (a) => {
    if (a.p50 !== undefined) return { med: n0(a.p50), rango: `${n0(a.p10)}–${n0(a.p90)}` };
    // La mascota plegada es una fila de otra naturaleza: la suma de todos sus
    // ataques. No tiene mediana que enseñar, y decir «reconstruye para verla»
    // prometería algo que no va a aparecer nunca.
    const falta = a.pet ? t('det.petLine')
      : a.n < 8 ? t('det.shapeFew', { n: 8 - a.n })
        : t('det.shapeOld');
    return { med: `<span class="gap" title="${esc(falta)}">—</span>`, rango: '' };
  };

  const abilities = section(t('det.byAbility'), `${table(
    [{ label: t('det.ability') }, { label: 'Tipo', w: '74px' }, { label: t('det.dmg'), right: true, w: '84px' },
     { label: t('det.share'), right: true, w: '58px' }, { label: t('det.uses'), right: true, w: '48px' },
     { label: t('det.avg'), right: true, w: '62px' }, { label: t('det.median'), right: true, w: '62px' },
     { label: t('det.spread'), right: true, w: '86px' }, { label: t('det.max'), right: true, w: '62px' },
     { label: t('det.crit'), right: true, w: '48px' }],
    r.abilities.map((a) => {
      const fa = celdas(a);
      return [
        `${esc(a.name)}${a.pet ? `<i class="petline" title="${esc(t('det.petLine'))}">${
          esc(t('det.pet'))}</i>` : ''}${a.bimodal ? `<i class="dosmodas" title="${esc(t('det.twoModesTip'))}">${
          esc(t('det.twoModes'))}</i>` : ''}`,
        a.pet ? '<span class="dim">—</span>'
          : `<i class="seg ${typeClass(a.type)}"></i>${esc(a.type ?? '—')}`,
        n0(a.sum), pct(a.sum / dmgTotal), a.n, n0(a.sum / a.n),
        fa.med, fa.rango, n0(a.max), a.crits || '—',
      ];
    }),
  )}
    ${dosModas.length ? `<div class="hallazgo">${esc(t('det.twoModesNote', {
    list: dosModas.map((a) => a.name).join(', '),
  }))}</div>` : ''}
    ${sinContar ? `<div class="hint">${esc(t('det.shapeOld'))}</div>` : ''}`);

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
// LA CAJA es de `ui/rotulo.js`, compartida con la reproducción; el CONTENIDO
// se queda aquí, porque no es el mismo dato: en combate son los totales de una
// pelea cerrada y allí es lo que se lleva hasta el segundo que estás mirando.
const ensureTip = cajaRotulo;
const placeTip = colocarRotulo;
const hideTip = ocultarRotulo;
function showTip() { updateTip(); const el = cajaRotulo(); el.style.display = 'block'; placeTip(); }

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
  // `caja`, no `t`. `t` es la función de traducir, importada arriba, y aquí
  // la tapaba una variable local: las siete llamadas de abajo intentaban
  // traducir contra un <div> y el rótulo emergente reventaba con «t is not a
  // function» cada vez que pasabas el ratón por una fila. Los datos no tenían
  // nada que ver, y no lo veía ninguna prueba: sólo salta al pasar el ratón.
  const caja = ensureTip();
  const dmgTotal = r.damage || 1;
  caja.innerHTML = `<div class="tip-head">${esc(r.name)}</div>
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
    ${/*
      CADA CUÁNTO SE DICE QUE TE HAN RESISTIDO, y sólo dos opciones.
      Va pegado a su casilla y no en un panel aparte: es un ajuste DE ella, y
      separarlo obligaría a buscarlo. La clave del estrangulador es el hechizo
      —no el enemigo—, porque lo que cansa es oír catorce veces el mismo nombre.
    */''}
    <div class="narrate-row">
      <label class="eyebrow" style="flex:1">${esc(t('voice.resistMode'))}
        <select id="nResistMode">
          <option value="cada20"${n.resistMode !== 'todas' ? ' selected' : ''}>${esc(t('voice.resistEvery20'))}</option>
          <option value="todas"${n.resistMode === 'todas' ? ' selected' : ''}>${esc(t('voice.resistAll'))}</option>
        </select></label>
    </div>
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
      ? (state.cfg.trios ?? []).map((r) => `<div class="trio-row">
          <span class="trio-from">${r.at == null ? esc(t('trio.always'))
            : esc(new Date(r.at).toLocaleString())}</span>
          <span class="trio-cls"><b>${r.classes.map((c) => esc(t(`cl.${c}`))).join(' · ')}</b></span>
          <span class="trio-lvl">${r.level == null ? esc(t('trio.fromLog')) : esc(t('trio.level', { n: r.level }))}</span>
          <button class="petbtn" data-trio-at="${r.at ?? ''}">${esc(t('trio.del'))}</button>
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
    next.resistMode = host.querySelector('#nResistMode').value === 'todas' ? 'todas' : 'cada20';
    next.maxChars = +host.querySelector('#nMax').value || 120;
    next.nukeNames = host.querySelector('#nNukes').value.split(',').map((x) => x.trim()).filter(Boolean);
    next.tts = { ...(n.tts ?? {}), voice: host.querySelector('#nVoice').value || null,
      rate: +host.querySelector('#nRate').value, volume: +host.querySelector('#nVol').value };
    state.cfg.tts = next.tts;
    Object.assign(n, next);
    await window.eql.setNarrate(next);
  };
  host.querySelectorAll('input').forEach((el) => el.addEventListener('change', save));
  // El desplegable del modo se cablea aparte: el selector de voz no tiene
  // oyente propio y engancharlos juntos guardaría de más sin pedirlo.
  host.querySelector('#nResistMode')?.addEventListener('change', save);
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
    // Y SE REPINTA ESTE PANEL, que `renderApp` no toca: sólo lo construye si no
    // existe (`if (!$('narrateBox'))`), así que la tabla se quedaba enseñando
    // los renglones de antes de guardar. Con el borrado por `at` eso ya no
    // borra nada equivocado, pero una tabla que no refleja lo guardado hace
    // dudar de si se guardó — y encima el trío recién añadido no aparecía.
    // No hace falta `pintarConflictos()` detrás: repintar el panel ya lo llama.
    await renderNarrate(host);
  };
  host.querySelector('#trioAdd')?.addEventListener('click', async () => {
    // Los tres datos a la vez y validados dentro. Antes eran tres `prompt`
    // encadenados que en Electron NO SE ABREN: el botón no hacía nada desde la
    // 1.1.0. Ver `ui/dialogo.js`.
    const r = await pedirDatos({
      titulo: t('trio.addTitle'),
      aceptar: t('trio.addOk'),
      cancelar: t('cancel'),
      campos: [
        { id: 'clases', etiqueta: t('trio.askClasses'), valor: '', marcador: 'SHD/MAG/DRU' },
        { id: 'desde', etiqueta: t('trio.askFrom'), valor: '', marcador: 'AAAA-MM-DD HH:MM',
          ayuda: t('trio.fromHint') },
        { id: 'nivel', etiqueta: t('trio.askLevel'), valor: '', ayuda: t('trio.levelHint') },
      ],
      validar: (v) => {
        const classes = v.clases.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
        if (classes.length !== 3) return { campo: 'clases', mensaje: t('trio.needThree') };
        if (v.desde.trim() && !Number.isFinite(new Date(v.desde.trim().replace(' ', 'T')).getTime())) {
          return { campo: 'desde', mensaje: t('trio.badDate') };
        }
        const lvl = v.nivel.trim() ? Number(v.nivel.trim()) : null;
        if (lvl !== null && !(lvl > 0 && lvl < 200)) return { campo: 'nivel', mensaje: t('trio.badLevel') };
        return null;
      },
    });
    if (!r) return;
    const classes = r.clases.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    // Vacío quiere decir «desde siempre»: cubre las peleas anteriores a tu
    // primer /who, que si no se quedan sin nivel para siempre.
    const at = r.desde.trim() ? new Date(r.desde.trim().replace(' ', 'T')).getTime() : null;
    const lvl = r.nivel.trim() ? Number(r.nivel.trim()) : null;
    await guardarTrios([...(state.cfg.trios ?? []), { at, classes, level: lvl }]);
  });
  /**
   * SE BORRA POR `at`, NO POR POSICIÓN: LA IDENTIDAD DE UNA FILA NO PUEDE SER
   * SU SITIO EN LA LISTA.
   *
   * `normalizeTrios` ordena por fecha, así que insertar un trío recoloca a los
   * de detrás: el índice que se pintó en el botón deja de señalar lo que
   * señalaba y el borrado se lleva otra fila. `at` no se mueve nunca y
   * `normalizeTrios` garantiza que es único. Se repinta igual, porque una
   * tabla que no refleja lo guardado despista aunque no borre nada.
   */
  host.querySelectorAll('[data-trio-at]').forEach((el) => el.addEventListener('click', async () => {
    // El atributo vacío es el `null` de «desde siempre», no un cero.
    const crudo = el.dataset.trioAt;
    const at = crudo === '' ? null : Number(crudo);
    await guardarTrios((state.cfg.trios ?? []).filter((x) => (x.at ?? null) !== at));
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

// Los puntos de la gráfica que está puesta ahora, para el rótulo del ratón.
let chartPuntos = null;
let chartDur = 0;

/**
 * El rótulo que sigue al ratón por la gráfica.
 *
 * SIN ESTO LA GRÁFICA NO SE PUEDE LEER. Son dos líneas por segundo y no había
 * forma de saber qué valía un pico ni en qué momento pasó: sólo el máximo, en
 * el pie. Preguntaste si los picos eran los golpes más fuertes, y no: son los
 * SEGUNDOS en los que más daño se acumuló, que puede ser un golpe grande o
 * cinco pequeños. Eso ahora lo dice la nota de abajo y lo confirma el rótulo,
 * que enseña el segundo exacto con sus tres cifras.
 */
function cablearGrafica() {
  const zona = $('chartHit');
  const tip = $('chartTip');
  if (!zona || !tip || !chartPuntos) return;
  const guia = zona.querySelector('.chart-guide');

  zona.addEventListener('mousemove', (e) => {
    const r = zona.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    const i = Math.round(rel * chartDur);
    const p = chartPuntos[i];
    if (!p) return;
    guia.style.left = `${(rel * 100).toFixed(2)}%`;
    guia.style.display = 'block';
    tip.innerHTML = `<b>${esc(secs(p.s))}</b>`
      + `<span>${esc(t('chart.dealt'))} <b>${n0(p.dmg)}</b></span>`
      + (p.taken ? `<span class="tk">${esc(t('chart.taken'))} <b>${n0(p.taken)}</b></span>` : '')
      + (p.heal ? `<span class="hl">${esc(t('chart.healed'))} <b>${n0(p.heal)}</b></span>` : '');
    tip.style.display = 'block';
    // Que no se salga por la derecha: a partir de la mitad, se pinta a la
    // izquierda del cursor.
    const ancho = tip.offsetWidth || 150;
    const px = rel * r.width;
    tip.style.left = `${Math.max(0, Math.min(r.width - ancho, px - ancho / 2))}px`;
  });

  zona.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    guia.style.display = 'none';
  });
}

function chartHTML(f) {
  // El DIBUJO vive en `ui/grafica.js`, compartido con la reproducción, que usa
  // esta misma gráfica como línea de tiempo. Dos funciones dibujando la misma
  // gráfica se separan con el tiempo y acaban diciendo cosas distintas de la
  // misma pelea; aquí sólo queda lo que esta pantalla hace con ella.
  const gr = grafica(f);
  if (!gr) return '';
  const { dur, pts, peak, legend, band, taken, svg, hitos } = gr;

  // Los puntos, para el rótulo del ratón. Van en una variable del módulo y no
  // en el HTML: son uno por segundo, y una pelea de cinco minutos son
  // trescientos — meterlos en un atributo es cargar la página de texto que
  // nadie lee.
  chartPuntos = pts;
  chartDur = dur;

  return `<div class="chart">
    ${band ? `<svg class="chart-band" viewBox="0 0 ${W} ${BAND}" preserveAspectRatio="none" role="img"
      aria-label="${esc(t('chart.bandLabel'))}">${band}</svg>` : ''}
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="${esc(t('chart.svgLabel', { v: n0(peak) }))}">${svg}</svg>
    ${hitos.filter((h) => h.clase === 'muerte').map((h) => `<i class="chart-death"
      style="left:${(h.s / dur * 100).toFixed(2)}%"
      title="${esc(`${secs(h.s)} · ${h.texto}`)}"></i>`).join('')}
    <div class="chart-hit" id="chartHit"><div class="chart-guide"></div></div>
    <div class="chart-tip" id="chartTip"></div>
    <div class="chart-foot">
      <span class="eyebrow">${esc(t('chart.peak', { v: n0(peak) }))}</span>
      <span class="chart-legend eyebrow">${legend}${taken ? `<span><i class="dash"></i>${t('chart.taken')}</span>` : ''}</span>
      <span class="eyebrow">${secs(dur)}</span>
    </div>
    <div class="hint">${esc(t('chart.note'))}${
  (f.killTimes ?? []).length ? ` ${esc(t('chart.deaths', { n: f.killTimes.length }))}` : ''}</div>
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
  const enVivo = f ? isLive(f) : true;

  /**
   * EL TRÍO Y LA POSTURA SON LOS DE LA PELEA, NO LOS DE AHORA.
   *
   * El consejo ya se calculaba sobre la pelea seleccionada, pero el trío y la
   * postura seguían saliendo del snapshot, que describe este instante. Mirando
   * una pelea de anoche eso pintaba el trío que llevas AHORA sobre ella —y con
   * el rótulo «clases fijadas por ti», que la da por buena.
   *
   * Se vio así: 94 peleas en The Ruins of Old Guk guardadas con SHD/SHM/MAG, y
   * el panel enseñando SHD/DRU/MAG en todas, que es el trío de la sesión de
   * después. Los datos estaban bien; lo que mentía era la etiqueta.
   *
   * Y no era sólo la etiqueta: con el trío de ahora cambian las posturas que se
   * comparan, así que el consejo de una pelea vieja se calculaba con una lista
   * de posturas que no eran las que tenías entonces.
   *
   * Lo mismo con la postura: «ya estabas en Defensive» salía de la postura
   * actual, no de la que llevabas en esa pelea. De las que llevaste se toma la
   * que aguantó más tiempo, que es la que describe la pelea.
   */
  const trioDe = (x) => (x?.classesAt?.length ? x.classesAt : null);
  const classes = (enVivo ? snap.classes : trioDe(f)) ?? snap.classes ?? [];
  const posturaDe = (x) => {
    const spans = x?.stanceSpans ?? [];
    if (!spans.length) return null;
    const dur = new Map();
    spans.forEach((sp, i) => {
      const fin = i === spans.length - 1 ? Math.max(sp.to, x.duration ?? sp.to) : sp.to;
      dur.set(sp.stance, (dur.get(sp.stance) ?? 0) + Math.max(0, fin - sp.from));
    });
    return [...dur].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const postura = (enVivo ? snap.stance : posturaDe(f)) ?? snap.stance;
  // El trío de la pelea puede no ser el de ahora, y eso hay que decirlo en vez
  // de dejar que parezca el tuyo de hoy.
  const trioViejo = !enVivo && trioDe(f) && (snap.classes ?? []).join('/') !== trioDe(f).join('/');

  const myRow = f?.rows.find((r) => r.name === snap.self);
  const a = (myRow && classes.length)
    ? advise(myRow, {
        classes, stance: postura, invocation: snap.invocation,
        seenStances: (f.stanceSpans ?? []).map((x) => x.stance),
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
    a?.defence.map((d) => d.prevented), a?.tramos, a?.segmentado, classes, postura, trioViejo, conflict,
    live && [live.kind, live.bestKey, live.suggest]]);
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  const trioBtn = `<button class="trio-now" id="trioNow" title="${esc(t('trio.nowHint'))}">${esc(t('trio.now'))}</button>`;
  // Se engancha en las dos ramas del panel: la normal y la de «faltan clases».
  // Declarar el trío es justo lo que hace falta cuando aún no se sabe cuál es.
  const engancharTrio = () => host.querySelector('#trioNow')?.addEventListener('click', async () => {
    const classes = [...host.querySelectorAll('.cls')].map((x) => x.value).filter(Boolean);
    // El nivel es opcional a propósito: si lo dejas vacío manda lo que diga el
    // log dentro del tramo, que es lo correcto mientras estés subiendo.
    //
    // Las clases salen de tres desplegables, así que «no son tres» sólo puede
    // pasar si alguno está vacío. Se valida dentro del cuadro, como todo lo
    // demás, en vez de con un aviso nativo antes de abrirlo.
    const d = await pedirDatos({
      titulo: t('trio.nowTitle'),
      texto: classes.length === 3 ? classes.map((c) => t(`cl.${c}`)).join(' · ') : '',
      aceptar: t('trio.addOk'),
      cancelar: t('cancel'),
      campos: [{ id: 'nivel', etiqueta: t('trio.askLevel'), valor: String(state.snap?.level ?? ''), ayuda: t('trio.levelHint') }],
      validar: (v) => {
        if (classes.length !== 3) return { campo: 'nivel', mensaje: t('trio.needThree') };
        const n = v.nivel.trim() ? Number(v.nivel.trim()) : null;
        if (n !== null && !(n > 0 && n < 200)) return { campo: 'nivel', mensaje: t('trio.badLevel') };
        return null;
      },
    });
    if (!d) return;
    const lvl = d.nivel.trim() ? Number(d.nivel.trim()) : null;
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
      <span class="src eyebrow">${trioViejo
        ? esc(t('adv.src.pelea'))
        : (snap.classSource && snap.classSource !== 'desconocidas'
          ? esc(t(`adv.src.${snap.classSource}`)) : '')}</span>
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
        ${/*
          LA COTA AL VALOR DEL CONSEJO, A LA VISTA Y NO EN UN COMENTARIO.
          Con la mitad del daño en periódico, la mejor postura posible te ahorra
          como mucho la otra mitad — y eso decide si el cambio compensa. Sólo
          sale cuando lo hay: una fila con un cero al lado sería ruido.
        */''}
        ${a.incoming.unmitigable > 0 ? `<span class="adv-nomit"
          title="${esc(t('adv.unmitigableNote', { n: n0(a.incoming.total),
            u: n0(a.incoming.unmitigable), pct: pct(a.incoming.unmitigableShare) }))}"
          >${esc(t('adv.unmitigable'))} <b>${n0(a.incoming.unmitigable)}</b>
          <span class="dim num">${pct(a.incoming.unmitigableShare)}</span></span>` : ''}
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
      ${/*
        LO QUE EVITASTE TRAMO A TRAMO, y sólo cuando bailaste.
        Con una sola postura esta caja repetiría la fila de arriba. Con dos o
        más es lo que explica el veredicto: la tabla de candidatas supone que
        sostuviste UNA toda la pelea, y tú no.
      */''}
      ${a.bailaste ? `<div class="adv-tramos">
        <div class="eyebrow">${esc(t('adv.byStance'))}</div>
        ${table(
    [{ label: 'Stance' }, { label: t('adv.wouldAvoid'), right: true, w: '84px' },
      { label: t('adv.melee'), right: true, w: '72px' }, { label: t('adv.magic'), right: true, w: '72px' }],
    a.tramos.map((x) => [esc(x.label), n0(x.prevented), n0(x.melee), n0(x.spell)]),
  )}
      </div>` : ''}
      ${/*
        Y si la pelea es anterior a que el daño se partiera por postura, se dice:
        su veredicto SÍ está calculado contra una sola, y callarlo lo haría
        indistinguible de uno medido tramo a tramo.
      */''}
      ${a.segmentado ? '' : `<div class="hint">${esc(t('adv.notSegmented'))}</div>`}
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

/**
 * Los objetos de una lista de botín, enganchados.
 *
 * Vivía suelto dentro de `renderHead`, que es de donde el botín se ha mudado.
 * Se saca a su propia función porque ahora hace falta en la sección de Botín y
 * porque el mismo trío —abrir la wiki, enseñar la ficha, quitarla— se repite en
 * el resumen y en la enciclopedia: el día que cambie, que se cambie una vez.
 */
function cablearBotin(host) {
  host?.querySelectorAll('.loot-item').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); window.eql.openWiki(el.dataset.item); });
    el.addEventListener('mouseenter', () => showItemTip(el.dataset.item));
    el.addEventListener('mouseleave', hideItemTip);
  });
}

/**
 * SECCIÓN · ESCENA. La segunda mudanza: qué pasó en esta pelea.
 *
 * Se lleva la cabecera entera —título por abatidos, zona, dificultad, nivel,
 * los cuatro botones, el aviso de pelea dudosa, las siete tarjetas y la
 * gráfica—, los dos avisos que interrumpen lo que estás mirando —el trío que no
 * cuadra y la mascota sin identificar— y «lo que esta pelea no sabe».
 *
 * NADA DE ESTO SE HA TOCADO POR DENTRO: son `renderHead`, `renderClassPrompt`,
 * `renderPetHint`, `charmHTML` e `incertidumbreHTML` tal cual, pintando en los
 * mismos identificadores de siempre. Por eso el esqueleto los repite: mientras
 * la sección exista, esos nodos viven aquí y no en la vista vieja, así que no
 * hay dos con el mismo `id` — hay uno, mudado.
 *
 * EL CRITERIO QUE DECIDE QUÉ ENTRA: Escena es QUÉ PASÓ; Análisis es QUÉ DICE DE CÓMO LO HICISTE. Por eso el consejo de postura,
 * el fuego amigo y los tramos sin mando no están aquí, y sí está el aviso de la
 * pelea dudosa: uno juzga tu actuación, el otro dice que estas cifras no valen.
 */
function renderEscena(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  /**
   * AL CAMBIAR DE PELEA, EL REPRODUCTOR SE VA CON LA ANTERIOR.
   *
   * Sin esto, la escena montada seguiría abajo enseñando figuras de la pelea que
   * ya no está abierta — con las cifras de arriba de una pelea y los muñecos de
   * otra, que es peor que no tener muñecos.
   */
  const abierta = withPets(fightFor(snap))?.uid ?? 'live';
  if (host.dataset.pelea !== undefined && host.dataset.pelea !== String(abierta)) {
    repro?.destruir();
    repro = null;
    if ($('rpView')) { $('rpView').innerHTML = ''; $('rpView').dataset.sig = ''; }
    host.classList.remove('con-reproductor');
  }
  host.dataset.pelea = String(abierta);
  if (!$('fightHead')) {
    host.innerHTML = '<div class="sec-title eyebrow" id="escenaTit"></div>'
      + '<div id="fightHead"></div><div id="clsPrompt"></div>'
      + '<div id="petHint"></div>'
      + '<div id="croEsc"></div>'
      + '<div class="charm-note" id="escenaNota" style="display:none"></div>'
      + '<div id="rpView"></div>';
  }
  // El rótulo se escribe en CADA pasada y no dentro del `innerHTML` de arriba:
  // ese armazón se monta una sola vez, así que un título horneado ahí se
  // quedaría en el idioma con el que arrancó la aplicación. Ver `renderPorHabilidad`.
  ponRotulo('escenaTit', 'sec.escena');
  renderHead(snap);
  renderClassPrompt(snap);
  renderPetHint(snap);
  const f = withPets(fightFor(snap));
  pinta($('escenaNota'), [charmHTML(f), incertidumbreHTML(f)]);
  renderCroEscena(f, $('croEsc'));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PONER UN TEMPORIZADOR DESDE LA PELEA, que es donde están los datos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Desde Reapariciones sólo se puede escribir un NOMBRE, y con eso el crono nace
 * cojo: la zona se coge de donde estés AHORA —que puede no ser donde murió— y
 * la dificultad y el modo, que son parte de la clave, no se pueden poner de
 * ninguna manera.
 *
 * Desde una pelea vienen los cuatro gratis y correctos:
 *
 *   · el NOMBRE tal y como lo escribió el registro, sin teclearlo
 *   · la ZONA, el MODO y la DIFICULTAD de esa pelea — las tres partes de la
 *     clave que desde el otro sitio faltaban
 *   · el INSTANTE EXACTO de la muerte de ESE enemigo en ESTE combate, que no es
 *     lo mismo que «la última vez que murió ese nombre»
 *
 * ── LOS CUATRO CASOS QUE NO SE INVENTAN ───────────────────────────────────
 *
 * 1. UN ENEMIGO QUE NO MURIÓ NO PUEDE LLEVAR CRONO: no hay instante desde el
 *    que contar. Sale en la lista, marcado y sin poder marcarse — no escondido,
 *    porque no verlo se lee como que no estuvo.
 * 2. LAS MASCOTAS ENEMIGAS SE QUEDAN FUERA. Una mascota no reaparece por
 *    temporizador: la invoca su dueño. Se van por `petOf` y por el sufijo
 *    ` pet`, que son las dos formas en que llegan.
 * 3. LOS QUE YA TIENEN CRONO ABIERTO van marcados, para no abrir el mismo dos
 *    veces. La comparación es por CLAVE COMPLETA —nombre + zona + modo +
 *    dificultad—, que es la misma que usa la sección.
 * 4. SI EL MISMO NOMBRE MUERE DOS VECES EN LA MISMA PELEA SON DOS INDIVIDUOS,
 *    y se dice con todas las letras. Se usa la ÚLTIMA muerte, porque es desde
 *    la que queda menos por esperar y es la que el jugador acaba de ver.
 *    `killTimes` conserva las dos; `dead` no —es un mapa por nombre y se queda
 *    con una—, así que aquí se lee `killTimes` y no `dead`.
 */
/** La hora de una muerte, en el idioma de la aplicación y sin am/pm. */
const horaCorta = (seg) => (seg
  ? new Date(seg * 1000).toLocaleTimeString(langInfo().code, { hour12: false })
  : '');

function renderCroEscena(f, caja) {
  if (!caja) return;
  if (!f) { caja.innerHTML = ''; caja.dataset.croEscSig = ''; return; }

  const lista = state.cfg?.cronos ?? [];
  /**
   * LA CLAVE SE VUELVE A PARSEAR DESDE `f.zone`, y no se cogen los campos ya
   * guardados.
   *
   * Medido sobre el almacén: hay peleas viejas cuyo `zoneBase` dice
   * «The Ruins of Old Guk 3» —con el dígito dentro—, mientras que `parseZone`
   * de hoy devuelve «The Ruins of Old Guk» y saca el 3 a `diff`. Guardar la
   * clave con el dígito pegado la haría IMPOSIBLE DE CASAR con la que calcula
   * Reapariciones, y el crono nacería duplicado y sin reiniciarse nunca.
   *
   * Así que manda el texto original de la zona, que es el dato crudo, y los
   * campos guardados sólo son el respaldo de cuando no lo hay.
   */
  const z = f.zone ? parseZone(f.zone) : null;
  const base = z?.base ?? f.zoneBase ?? null;
  const diff = z?.diff ?? f.diff ?? null;
  const mode = z?.mode ?? f.zoneMode ?? null;
  const tag = z?.tag ?? f.diffTag ?? null;
  const abiertas = new Set(lista.map((c) => claveCrono(c)));
  const enemigos = enemigosDeLaPelea(f).map((e) => ({
    ...e,
    ya: abiertas.has(claveCrono({ nombre: e.nombre, base, diff, mode })),
  }));
  const abierto = caja.dataset.abierto === '1';

  const construye = () => {
    const cab = `<div class="croesc-cab"><button id="croEscBtn" class="croesc-btn"${
      enemigos.length ? '' : ' disabled'}>${esc(t('cro.escBoton'))}</button></div>`;
    if (!abierto) return cab;
    if (!enemigos.length) return `${cab}<div class="croesc"><p class="sub">${esc(t('cro.escVacio'))}</p></div>`;

    const donde = base
      ? `${esc(base)}${mode ? ` · ${esc(mode)}` : ''}${diff != null ? ` · ${esc(labelDiff(diff, tag))}` : ''}`
      : esc(t('cro.sinZona'));

    const filas = enemigos.map((e, i) => {
      const puede = e.veces > 0 && !e.ya;
      const nota = e.veces === 0 ? `<span class="croesc-no">${esc(t('cro.escNoMurio'))}</span>`
        : e.ya ? `<span class="croesc-ya">${esc(t('cro.escYaEsta'))}</span>`
          : e.veces > 1 ? `<span class="croesc-dos">${esc(t('cro.escDosVeces', { n: e.veces }))}</span>`
            : `<span class="croesc-hora">${esc(t('cro.escMurio', { hora: horaCorta(e.cuando) }))}</span>`;
      return `<label class="croesc-fila${puede ? '' : ' no'}">
        <input type="checkbox" data-esc="${i}"${puede ? '' : ' disabled'}>
        <b>${esc(e.nombre)}</b>${e.charmed ? ` <span class="croesc-ch">${esc(t('cro.escEncantado'))}</span>` : ''}
        ${nota}</label>`;
    }).join('');

    return `${cab}<div class="croesc">
      <div class="croesc-tit">${esc(t('cro.escTitulo'))}</div>
      <div class="croesc-zona">${donde}</div>
      <p class="sub">${esc(t('cro.escSub'))}</p>
      ${filas}
      <button id="croEscPon" class="croesc-pon">${esc(t('cro.escPoner'))}</button>
    </div>`;
  };

  // Escena se repinta con el snapshot, cuatro veces por segundo. Sin esto, un
  // clic en una casilla no llegaría nunca. Ver `pintaEstable`.
  if (pintaEstable(caja, construye, null, 'croEscSig') === 'refrescado') return;

  caja.querySelector('#croEscBtn')?.addEventListener('click', () => {
    caja.dataset.abierto = abierto ? '0' : '1';
    caja.dataset.croEscSig = '';        // que la próxima pasada reconstruya
    renderCroEscena(f, caja);
  });

  caja.querySelector('#croEscPon')?.addEventListener('click', async () => {
    const marcados = [...caja.querySelectorAll('input[data-esc]:checked')]
      .map((el) => enemigos[+el.dataset.esc]).filter((e) => e && e.veces > 0 && !e.ya);
    if (!marcados.length) return;
    const nuevos = marcados.map((e) => ({
      nombre: e.nombre, base, diff, mode,
      /**
       * EL INSTANTE VIAJA CON EL CRONO. Sin él, la cuenta arrancaría desde «la
       * última muerte de ese nombre en esa clave», que puede ser otra copia y
       * otro momento. Con él, arranca desde la muerte que el jugador acaba de
       * ver, que es lo que ha pedido seguir.
       */
      desde: e.cuando,
      // Y de dónde salió, porque un dato sin procedencia acaba leyéndose como
      // un hecho: éste viene de una pelea concreta, no de teclearlo.
      origen: 'pelea',
      muertes: e.veces,
    }));
    const l = [...(state.cfg?.cronos ?? []), ...nuevos];
    await window.eql.setFlag('cronos', l);
    state.cfg.cronos = l;
    caja.dataset.croEscSig = '';
    renderCroEscena(f, caja);
  });
}

/**
 * SECCIONES · AVISOS y PREFERENCIAS. Las mudanzas 9 y 10.
 *
 * Las dos salen de la misma pantalla vieja —la pestaña de Avisos montaba
 * `renderNarrate` y `renderTriggers` una encima de otra— y se separan porque son
 * dos preguntas: qué te avisa y cómo se comporta el programa. Ninguna de las dos
 * funciones se toca; lo único que cambia es que cada una tiene su sitio.
 *
 * `initTriggers()` va antes de pintar los disparadores y sólo una vez: es lo que
 * hacía la pestaña, y sin ello la lista sale vacía sin decir por qué.
 */
function renderAvisos(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  if ($('trigBox')) return;
  host.innerHTML = '<div class="tabpane"><div id="trigBox"></div></div>';
  const caja = $('trigBox');
  caja.innerHTML = `<div class="hint">${esc(t('log.loading'))}</div>`;
  initTriggers().then(() => renderTriggers(caja));
}

function renderPreferencias(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  if ($('narrateBox')) return;
  host.innerHTML = '<div class="tabpane"><div id="narrateBox"></div></div>';
  renderNarrate($('narrateBox'));
}

/**
 * SECCIÓN · ENEMIGOS. La sexta, y la primera EXTRACCIÓN disfrazada de mudanza.
 *
 * Las otras cinco movían un panel que ya era suyo. Aquí no hay panel: hay tres
 * páginas —la rejilla, el expediente y la ficha de una dificultad— que viven
 * dentro de un enrutador, `state.enc.page`, al que se entra por una tarjeta del
 * índice de la enciclopedia. Sacarlas es desmontar ese camino sin romper el que
 * queda para las otras seis páginas.
 *
 * QUÉ SE HACE Y QUÉ NO: no se parte `renderEncyclopedia`. Sigue siendo la que
 * pinta cualquier página y la que engancha todos los clics; lo único que cambia
 * es DÓNDE pinta —en la sección si hay una abierta— y quién decide en qué
 * página estás. La sección se limita a exigir que la página sea una de las
 * suyas y a pedirla si no lo es.
 *
 * LAS MIGAS SE QUEDAN DENTRO, y son lo que más fácil se pierde en una
 * extracción: son navegación, no contenido, así que no las echa de menos nadie
 * hasta que intenta volver del expediente a la rejilla y no puede. `encCrumb`
 * ya las construye para estas tres páginas y aquí siguen funcionando: lo que se
 * pierde es el escalón de más arriba —«Enciclopedia»—, que era el índice y ya
 * no existe como sitio.
 */
/**
 * DE QUÉ SECCIÓN ES CADA PÁGINA DE LA ENCICLOPEDIA.
 *
 * Hace falta porque las páginas se enlazan ENTRE SÍ y esos enlaces cruzan
 * secciones: desde una tarjeta de botín se salta al enemigo que lo suelta, y
 * desde una zona a uno de sus bichos. Sin esta tabla, el salto pintaría el
 * expediente de un enemigo DENTRO de la sección de Botín — con la barra lateral
 * marcando Botín y la pantalla enseñando otra cosa, que es la contradicción que
 * el armazón viene a quitar.
 *
 * Con ella, el salto cambia de sección solo y la barra sigue diciendo la verdad.
 */
const SECCION_DE_PAGINA = {
  enemigos: 'enemigos', foe: 'enemigos', foeDif: 'enemigos',
  botin: 'botin-h',
  progreso: 'progreso',
  zonas: 'zonas', zona: 'zonas',
  hechizos: 'hechizos', hechizo: 'hechizos',
  muertes: 'muertes',
};

/**
 * El cuerpo compartido de las secciones que salen de la enciclopedia.
 *
 * Las tres —y las tres que faltan— hacen exactamente lo mismo: exigir que la
 * página del enrutador sea una de las suyas, pedirla si no lo es, mandar a otra
 * sección si la página es de ella, y dejar pintar a `renderEncyclopedia`.
 * Escrito una vez, porque tres copias de esto se separan en cuanto una necesite
 * un arreglo.
 */
function pintaPaginaEnc(id, paginas) {
  const host = $('secPane');
  if (!host) return;
  const page = state.enc.page;
  if (!paginas.includes(page)) {
    const otra = SECCION_DE_PAGINA[page];
    if (otra && otra !== id && SECCIONES.some((x) => x.id === otra && x.listo)) {
      abrirSeccion(otra);
      return;
    }
    // Pedir la página es asíncrono y repinta al llegar; mientras, se dice que
    // está cargando en vez de dejar el hueco, que se lee como «no hay nada».
    if (state.cargandoEnc === id) return;
    state.cargandoEnc = id;
    host.innerHTML = `<div class="hint">${esc(t('log.loading'))}</div>`;
    encGo(paginas[0]).finally(() => { state.cargandoEnc = null; });
    return;
  }
  if (!$('encRoot')) renderEncyclopedia();
}

const renderEnemigos = () => pintaPaginaEnc('enemigos', ['enemigos', 'foe', 'foeDif']);

/**
 * SECCIÓN · BOTÍN DEL HISTÓRICO. La séptima.
 *
 * Es la misma obra que la sexta: una página del enrutador con su buscador, sus
 * pestañas de dificultad y sus saltos al enemigo que suelta cada cosa.
 */
const renderBotinHistorico = () => pintaPaginaEnc('botin-h', ['botin']);

/** SECCIÓN · PROGRESO. La octava, y la tercera con la misma forma. */
const renderProgreso = () => pintaPaginaEnc('progreso', ['progreso']);

/**
 * SECCIONES · ZONAS, HECHIZOS y MUERTES. Extracciones 12, 13 y 14.
 *
 * Las tres últimas páginas del enrutador de la enciclopedia, y las tres con la
 * misma forma que la sexta: lista, ficha y migas. Que sean tres líneas y no
 * trescientas es el resultado de haber escrito `pintaPaginaEnc` una vez.
 *
 * Con esto el enrutador `state.enc.page` queda repartido entero y el índice de
 * tarjetas se queda sin nada que indexar.
 */
const renderZonas = () => pintaPaginaEnc('zonas', ['zonas', 'zona']);
const renderHechizos = () => pintaPaginaEnc('hechizos', ['hechizos', 'hechizo']);
const renderMuertes = () => pintaPaginaEnc('muertes', ['muertes']);

/**
 * SECCIÓN · RESUMEN. La quinta mudanza, y la primera de «todo el histórico».
 *
 * Es también la primera sección SIN la lista de peleas al lado, así que es la
 * que prueba el armazón y no un panel: si la estructura está mal pensada, se ve
 * aquí y no en la novena.
 *
 * Y ESO TRAE UNA DIFERENCIA DE VERDAD: sin lista no hay botón de «ver resumen»,
 * que es quien pedía los datos. Así que la sección los pide ella al abrirse, con
 * los mismos criterios que tenga puesto el filtro —`recargarResumen` es la misma
 * función que ya se usa al declarar a alguien—. Mientras llegan se dice que está
 * cargando: un resumen vacío y uno que aún no ha llegado se ven igual, y uno de
 * los dos es mentira.
 */
function renderResumen(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  if (!state.summary) {
    if (state.cargandoResumen) return;
    state.cargandoResumen = true;
    host.innerHTML = `<div class="hint">${esc(t('log.loading'))}</div>`;
    recargarResumen().finally(() => { state.cargandoResumen = false; });
    return;
  }
  if (!$('sumRoot')) renderSummary();
}

/**
 * SECCIÓN · ANÁLISIS. La cuarta mudanza: qué dice de cómo lo hiciste.
 *
 * Recoge las cuatro piezas que estaban de paso y la vista de análisis entera:
 * el consejo de postura con su procedencia y sus desplegables, el fuego amigo,
 * los tramos sin mando con el dps sobre el tiempo que manejabas, «Aguantar», y
 * la nota, los roles, los hallazgos y las fases de `renderAnalysis`.
 *
 * CON ESTA SE VACÍA LA PANTALLA VIEJA. Lo que queda en Combate después de esto
 * es literalmente nada: por eso las tres pestañas se pueden quitar en la
 * mudanza 10 sin que se caiga nada por el camino.
 *
 * El botón «← Combate» que pinta `renderAnalysis` se esconde por CSS dentro de
 * la sección: es de la navegación vieja y se va con ella. Esconderlo es
 * reversible; quitarlo sería tocar la función, y esto sólo mueve.
 */
function renderAnalisis(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  if (!$('anView')) {
    host.innerHTML = '<div id="advice"></div>'
      + '<div class="charm-note" id="anNota" style="display:none"></div>'
      + '<div id="anTank"></div><div id="anView"></div>';
  }
  renderAdvice(snap);
  const f = withPets(fightFor(snap));
  pinta($('anNota'), [entreTuyosHTML(f), sinControlHTML(f)]);

  const caja = $('anTank');
  const titular = f ? DOC_AGUANTAR.head(f) : null;
  const sig = `${getLang()}|${f?.uid ?? 'live'}|${titular ?? ''}`;
  if (caja && caja.dataset.sig !== sig) {
    caja.dataset.sig = sig;
    caja.innerHTML = titular
      ? `<div class="sec-title eyebrow">${esc(DOC_AGUANTAR.label())} · ${esc(titular)}</div>`
        + DOC_AGUANTAR.body(f)
      : '';
  }
  renderAnalysis(snap);
}

/**
 * SECCIÓN · REGISTRO. La extracción 11.
 *
 * Conserva las dos cosas que lo distinguían de un cajón: **su titular** —la hora
 * de inicio y fin de la pelea, que contesta «¿de qué tramo estamos hablando?»
 * sin abrir nada— y el aviso de espera mientras se lee el disco, que no es lo
 * mismo que un registro vacío.
 */
function renderRegistro(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  const f = withPets(fightFor(snap));
  const listo = f && registroCache.has(f.uid ?? 'live') ? 1 : 0;
  const sig = `${getLang()}|${f?.uid ?? 'live'}|${listo}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  if (!f) {
    const hayPeleas = (state.fights?.length ?? 0) > 0;
    host.innerHTML = `<div class="empty">
      <h2>${esc(hayPeleas ? t('fight.pick') : t('fight.none'))}</h2>
      <p>${esc(hayPeleas ? t('fight.pickHint') : t('fight.noneHint'))}</p></div>`;
    return;
  }

  const titular = DOC_REGISTRO.head(f);
  host.innerHTML = (titular
    ? `<div class="sec-title eyebrow">${esc(DOC_REGISTRO.label())} · ${esc(titular)}</div>`
    : '') + DOC_REGISTRO.body(f);

  // Se pide DESPUÉS de pintar el aviso de espera, igual que hacía la pestaña.
  if (!listo) {
    pedirRegistro(f, () => {
      // Su caja si está apilada, y el panel si va suelta.
      const h2 = document.getElementById('ap-registro') ?? $('secPane');
      if (h2 && EN_LA_PAGINA.includes(state.seccion)) { h2.dataset.sig = ''; renderRegistro(state.snap, h2); }
    });
  }
}

/**
 * SECCIÓN · POR HABILIDAD. La tercera mudanza: de dónde sale el daño.
 *
 * El reparto entero —las filas con su barra, su desglose y sus controles— y los
 * documentos de la pelea. `renderRows` y `renderDocs` sin tocar; lo único que
 * cambia es dónde cuelgan sus nodos.
 *
 * DOS COSAS ESTÁN AQUÍ DE PASO Y ESTÁ ESCRITO PARA QUE NO SE OLVIDE:
 *
 *   `#charmNote` con el fuego amigo y los tramos sin mando (A9, A10). Los pinta
 *   `renderRows`, así que se mudan con él o dejan de verse — y una mudanza que
 *   apaga algo no es una mudanza. Su sitio es Análisis, en la cuarta.
 *
 *   Los documentos de Aguantar y Registro. La barra de documentos se mueve
 *   entera porque `renderDocs` la construye entera: partirla sería cirugía sobre
 *   una función, no un cambio de sitio. Aguantar se va a Análisis en la cuarta y
 *   Registro a su propia sección en la extracción once.
 */
function renderPorHabilidad(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  if (!$('rows')) {
    host.innerHTML = `<div class="sec-title eyebrow" id="habilidadTit"></div>
      <div class="charm-note" id="charmNote" style="display:none"></div>
      <div id="rows"></div>
      <div class="legend eyebrow">${TYPES.map((x) => `<span><i class="seg ${x}"></i>${x}</span>`).join('')}</div>
      <div class="docbar" id="docBar"></div><div class="docpane" id="docPane"></div>`;
    state.rowNodes.clear();
    // La barra no se repinta en cada snapshot, así que el clic se atiende por
    // delegación en el contenedor, que sí es estable.
    $('docBar').addEventListener('click', (e) => {
      const b = e.target.closest?.('.doctab');
      if (!b) return;
      state.doc = b.dataset.doc;
      renderDocs(withPets(fightFor(state.snap)));
    });
  }
  ponRotulo('habilidadTit', 'sec.habilidad');
  renderRows(snap);
}

/**
 * SECCIÓN · BOTÍN DE ESTA PELEA. La primera mudanza del armazón.
 *
 * No hay nada nuevo aquí dentro: es `lootHTML`, el mismo que llevaba dentro de
 * la cabecera de la pelea, con los mismos objetos, la misma procedencia y la
 * misma nota. Lo único que cambia es que ahora tiene sitio propio en vez de ir
 * colgando debajo de la gráfica.
 *
 * Y ESTRENA UN VACÍO QUE YA ESTABA ESCRITO: `loot.none` —«Sin botín en esta
 * pelea»— existe en los cinco diccionarios desde hace versiones y no lo pintaba
 * nadie, porque dentro de la cabecera un botín vacío simplemente no se dibujaba.
 * Una sección sí tiene que decir que está vacía: si no, no se distingue de una
 * que falló al cargar.
 */
function renderBotinPelea(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  const f = withPets(fightFor(snap));
  const sig = `${getLang()}|${f?.uid ?? 'live'}|${(f?.loot ?? []).length}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  if (!f) {
    const hayPeleas = (state.fights?.length ?? 0) > 0;
    host.innerHTML = `<div class="empty">
      <h2>${esc(hayPeleas ? t('fight.pick') : t('fight.none'))}</h2>
      <p>${esc(hayPeleas ? t('fight.pickHint') : t('fight.noneHint'))}</p></div>`;
    return;
  }
  const html = lootHTML(f);
  host.innerHTML = html || `<div class="empty"><h2>${esc(t('loot.title'))}</h2>
    <p>${esc(t('loot.none'))}</p></div>`;
  cablearBotin(host);
}

function renderHead(snap) {
  const f = withPets(fightFor(snap));
  const host = $('fightHead');
  if (!f) {
    /**
     * DOS VACÍOS QUE NO SON EL MISMO, y usar el texto de uno para el otro
     * afirma algo falso en lo primero que se ve al abrir.
     *
     *   no hay peleas       el histórico está vacío de verdad. «Pega a algo y
     *                       aparecerán aquí» describe lo que pasa.
     *   ninguna cargada     hay peleas en la lista de la izquierda y ninguna
     *                       está abierta todavía — al arrancar, la seleccionada
     *                       es la viva y no hay combate. Decir aquí «todavía no
     *                       hay peleas» con cuatrocientas al lado es mentir
     *                       sobre lo único que el usuario puede comprobar de un
     *                       vistazo.
     */
    const hayPeleas = (state.fights?.length ?? 0) > 0;
    host.innerHTML = `<div class="empty">
      <h2>${esc(hayPeleas ? t('fight.pick') : t('fight.none'))}</h2>
      <p>${esc(hayPeleas ? t('fight.pickHint') : t('fight.noneHint'))}</p></div>`;
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
        <div class="head-title">${esc(rotuloPelea(f))}</div>
        <div class="eyebrow">${live ? t('fight.live') : t('fight.closed')} · ${esc(f.zone ?? t('fight.unknownZone'))}${
          f.diff !== null && f.diff !== undefined ? ` · D${f.diff}${f.diffTag ? ' ' + esc(f.diffTag) : ''}` : ''}
          · ${f.level ? esc(t('lvl.level', { n: f.level }))
            : `<span class="gap" title="${esc(t('lvl.unknownNote'))}">${esc(t('lvl.unknown'))}</span>`}</div>
      </div>
      <div class="head-actions">
        ${!live ? `<button class="primary" id="btnAnalyse">${t('an.button')}</button>
        <button id="btnReplay">${t('rp.button')}</button>
        <button id="btnExport">${t('fight.save')}</button>` : ''}
        <button id="btnChat" title="${esc(t('share.tip'))}">${t('share.copy')}</button>
      </div>
    </div>
    ${/*
      Lo que se sabe que está mal, ANTES de las cifras que invalida. Debajo de
      ellas sería una nota al pie de unos números que ya te has creído.
    */''}
    ${dudaHTML(f)}
    <div class="metrics">
      ${card(n0(f.raidDps), t('metric.raidDps'), 'lead')}
      ${card(n0(f.total), t('metric.total'))}
      ${card(secs(f.duration), t('metric.duration'))}
      ${f.enemyDps ? card(n0(f.enemyDps), t('metric.enemyDps'), 'foe') : ''}
      ${f.healing ? card(n0(f.healing), t('metric.healing')) : ''}
      ${f.kills.length ? card(f.kills.length, t('metric.kills', { n: f.kills.length })) : ''}
      ${f.losses?.length ? card(f.losses.length, t('metric.losses', { n: f.losses.length }), 'bad') : ''}
    </div>
    ${chartHTML(f)}`;
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
  $('btnAnalyse')?.addEventListener('click', (e) => { e.stopPropagation(); abrirSeccion('analisis'); });
  /**
   * EL REPRODUCTOR SE MONTA DENTRO DE ESCENA, no en otra pantalla.
   *
   * Es la extracción 15 y la decisión (a) del mapa: la Escena del prototipo
   * dibuja las figuras y los cambios de estado, y esas dos cosas sólo existen
   * dentro del reproductor. Escena ES el reproductor parado.
   *
   * Y SE MONTA AL PULSAR, no al abrir la pelea: el reproductor lee el registro
   * del disco y puede fallar, así que montarlo siempre cambiaría el coste y el
   * modo de fallo de abrir una pelea — que es lo que más se hace en toda la
   * aplicación. Pulsar es barato; abrir no puede serlo menos que ahora.
   *
   * Y ya no hay «fuera de la sección»: si se pulsa sin la Escena montada —queda
   * el camino desde una pelea abierta en otra sección—, se abre Escena, que es
   * donde vive el reproductor.
   */
  $('btnReplay')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.seccion === 'escena' && $('rpView')) {
      // Y la gráfica de la cabecera se esconde: la del reproductor es la misma
      // de `ui/grafica.js` con el cursor encima, así que enseñar las dos es
      // enseñar dos veces lo mismo y dejar al lector eligiendo cuál mirar.
      $('secPane').classList.add('con-reproductor');
      $('rpView').dataset.sig = '';
      renderReplay(state.snap);
      return;
    }
    abrirSeccion('escena');
  });
  // Después del innerHTML, que si no los nodos de la gráfica no existen aún.
  cablearGrafica();
}

// ═══════════ Reproducción ═══════════
/**
 * La reproducción de una pelea, leyendo sus líneas del registro.
 *
 * NO SALE DE LA PELEA GUARDADA, y no por capricho: allí el crítico es un
 * contador por habilidad y el contraataque un contador por combatiente, así que
 * un flotante sacado de ahí estaría colocado a ojo. Las líneas sí tienen su
 * instante, y las 410 peleas del histórico siguen dentro del fichero.
 *
 * Cuando la pelea ya no está en el registro no se reproduce nada y se dice por
 * qué. Es la misma regla que la pestaña del registro.
 */
let repro = null;

async function renderReplay(snap) {
  const host = $('rpView');
  if (!host) return;
  const f = withPets(fightFor(snap));
  const back = `<button id="rpBack">← ${esc(t('sec.escena'))}</button>`;
  const sig = `${getLang()}|${f?.uid ?? 'live'}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  repro?.destruir();
  repro = null;

  if (!f || isLive(f)) {
    host.innerHTML = `<div class="an-head">${back}</div>
      <div class="hint">${esc(t('rp.soloCerradas'))}</div>`;
    host.querySelector('#rpBack').addEventListener('click', volverACombate);
    return;
  }

  host.innerHTML = `<div class="an-head">${back}
      <h2>${esc(rotuloPelea(f))}</h2></div>
    <div class="hint" id="rpCarga">${esc(t('log.loading'))}</div>`;
  host.querySelector('#rpBack').addEventListener('click', volverACombate);

  // El mismo respaldo que en `guion`: la pelea completa guarda `start` en
  // segundos y `at` sólo vive en el índice. Según por dónde llegue, trae uno.
  const desde = f.at ? Math.round(f.at / 1000) : Math.round(f.start ?? 0);
  const r = desde ? await window.eql.logContext?.(desde, desde + (f.duration ?? 0), 20000) : null;
  if (host.dataset.sig !== sig) return;      // te has ido mientras leía

  /**
   * DESPUÉS DE UNA ESPERA, EL DOM PUEDE NO SER EL QUE ESCRIBISTE.
   *
   * Aquí se hacía `host.querySelector('#rpCarga')` y luego `caja.remove()` sin
   * mirar, y reventaba de verdad:
   *
   *     TypeError: Cannot read properties of null (reading 'remove')
   *     ui/app.js:3474
   *
   * `#rpCarga` lo escribe el `innerHTML` de veinte líneas más arriba, y entre
   * ese `innerHTML` y esta captura está la espera de `logContext`. Durante
   * ella cualquier otro repintado sustituye el contenido de `host`, así que
   * `querySelector` devuelve null EN EL ACTO: no es que el elemento se
   * estropee después de cogerlo, es que ya no está cuando se busca.
   *
   * La primera explicación que escribí aquí —«cogido antes del await, usado
   * después»— era falsa, y no era inocua: la prueba que salió de ella daba
   * cero sobre el fichero enfermo. Está en `test/repintado.js`.
   *
   * La guarda de `sig` no cubre esto: sólo atrapa que te hayas ido a OTRA
   * sección, no que se haya repintado LA MISMA.
   *
   * Y el fallo estaba en las dos ramas: `caja.classList` de abajo tenía el
   * mismo agujero, y ésa es la que se ve cuando el registro no da líneas.
   *
   * Se vuelve a preguntar por el elemento DESPUÉS de la espera. Si ya no está,
   * es que el panel es de otro repintado y no hay nada que quitar: se sale sin
   * tocar nada, que es lo correcto — pintar encima de lo que puso otro sería
   * peor que no pintar.
   */
  const caja = host.querySelector('#rpCarga');
  if (!caja) return;
  if (!r?.ok || !r.lineas?.length) {
    caja.classList.add('hallazgo');
    caja.textContent = t('rp.noLineas');
    return;
  }
  caja.remove();
  const zona = document.createElement('div');
  host.appendChild(zona);
  // LOS RETRATOS SE ESPERAN, no se piden y se sigue.
  //
  // Se pedían en paralelo y la escena se montaba con lo que hubiera en la
  // caché — que la primera vez está vacía—, así que un enemigo CON retrato en
  // la wiki salía con la silueta genérica y ya no cambiaba: nada repinta la
  // escena después. Es un viaje más antes de empezar, y la reproducción ya
  // estaba esperando a que se leyera el registro.
  await pedirRetratos((f.rows ?? []).filter((x) => x.side === 'enemy').map((x) => x.name), null);
  if (host.dataset.sig !== sig) return;      // te has ido mientras llegaban
  // Cuánto tarda cada hechizo, medido por el motor al leer el registro.
  // Si falla, la barra sale sin duración en vez de no salir: ver `barra()`.
  let casteos = {};
  try { casteos = (await window.eql.castTimes?.(desde)) ?? {}; } catch { /* sin tabla */ }
  if (host.dataset.sig !== sig) return;
  // El botín que se recogió con la pelea ya cerrada. Vive en el fichero lateral
  // y no dentro de la pelea —`fights.ndjson` sólo crece por el final—, así que
  // hay que pedirlo aparte o la ficha enseñaría una lista incompleta sin saberlo.
  let tardio = null;
  try { tardio = (await window.eql.lootDe?.(f.at ?? Math.round((f.start ?? 0) * 1000))) ?? null; } catch { /* sin lateral */ }
  if (host.dataset.sig !== sig) return;
  repro = montarReproduccion(zona, {
    f, self: snap.self, lineas: r.lineas, retratos: retratoCache, casteos, tardio,
    // La ficha del objeto es la misma que en la lista de botín: vive aquí con
    // su caché de la wiki, y la reproducción la pide en vez de traérsela.
    onObjeto: showItemTip, onObjetoFuera: hideItemTip,
  });
}

/** Salir de la reproducción: se vuelve a Escena, que es de donde se entra. */
function volverACombate() {
  repro?.destruir();
  repro = null;
  abrirSeccion('escena');
}

// ═══════════ Análisis del combate ═══════════
const LEVEL_ICON = { bad: '!', warn: '·', info: 'i', good: '✓' };

function renderAnalysis(snap) {
  const f = fightFor(snap);
  const host = $('anView');
  const back = `<button id="anBack">← ${esc(t('sec.escena'))}</button>`;

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
    $('anBack').addEventListener('click', () => abrirSeccion('escena'));
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
      <div class="an-find-h"><span class="an-ico">${LEVEL_ICON[x.level]}</span><b>${esc(x.title)}</b>${
  // QUÉ CLASE DE COSA ES, escrito al lado del título.
  //
  // Sin esto, «llevabas la postura equivocada» y «te enraizaron cuatro veces»
  // salían con la misma pinta y el mismo color, y sólo uno de los dos se puede
  // corregir peleando distinto. El rótulo dice de cuál de los tres se trata, y
  // al pasar el ratón, por qué.
  x.accion ? `<i class="acc acc-${esc(x.accion)}" title="${esc(t(`an.accion.${x.accion}Note`))}">${
    esc(t(`an.accion.${x.accion}`))}</i>` : ''}</div>
      <div class="an-find-d">${esc(x.detail)}</div>
      ${/*
        LAS FILAS, CADA UNA CON SU DENOMINADOR. Nunca «62 resistidas» a secas:
        62 de 62 y 62 de 300 son dos peleas distintas y dos consejos distintos.
        Y el 100 % se dice con palabras además del número, porque «44 de 44» hay
        que restarlo mentalmente y «no entra nunca» no.
      */''}
      ${/*
        LA POBLACIÓN, PRIMERO. Sin ella la tabla enseña cinco filas y no dice de
        cuántos hechizos salen: se lee «cinco se resistieron» sin saber si
        lanzaste cinco o veinte. Pasó de verdad leyéndola con atención.
      */''}
      ${x.poblacion?.conResistencia ? `<div class="an-find-pob">${esc(t('an.resistsPoblacion', {
    hechizos: x.poblacion.hechizos, con: x.poblacion.conResistencia,
    resistidas: x.poblacion.resistidas, lanzadas: x.poblacion.lanzadas,
  }))}</div>` : ''}
      ${(x.filas ?? []).length ? `<div class="an-find-filas">${x.filas.map((r) => {
    const pct100 = r.resisted === r.intentos;
    return `<div class="an-fila${pct100 ? ' nunca' : ''}">
        <span>${esc(r.spell)} <span class="dim">${esc(t('an.contra'))} ${esc(r.foe)}</span></span>
        <b>${r.resisted} ${esc(t('an.de'))} ${r.intentos}</b>
        <span class="${pct100 ? 'bad' : 'dim'}">${pct100 ? esc(t('an.nuncaEntra'))
      : `${Math.round((r.resisted / r.intentos) * 100)}%`}</span>
      </div>`;
  }).join('')}</div>` : ''}
      ${x.impact ? `<div class="an-find-i">${esc(x.impact)}</div>` : ''}
    </div>`).join('') : `<div class="hint">${esc(t('an.noFindings'))}</div>`;

  host.innerHTML = `<div class="analysis">
    <div class="an-head">
      <div><h2>${esc(rotuloPelea(f))}</h2>
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
  $('anBack').addEventListener('click', () => abrirSeccion('escena'));
}

// ═══════════ Orquestación ═══════════
function renderTimers(snap) {
  const host = $('timers');
  if (!host) return;
  const ts = snap.timers ?? [];
  const sig = ts.map((x) => `${x.id}:${x.left.toFixed(1)}`).join('|');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = ts.map((x) => `<div class="timer">
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
  /**
   * DÓNDE PINTA, que desde la mudanza 5 no es siempre el mismo sitio.
   *
   * El resumen vive en su sección, y `#secPane` sólo existe cuando hay una
   * abierta. Se resuelve aquí y no con un parámetro porque esta función la
   * llaman cinco sitios —el botón, la recarga tras declarar a alguien, la
   * casilla de juntar mascotas, la wiki cuando llega tarde— y pasarles el
   * destino a todos sería cinco oportunidades de que uno se quede pintando en
   * la pantalla vieja sin que nadie lo note.
   */
  const host = $('secPane') ?? $('bodyGrid');
  if (!a || !a.fights) {
    host.innerHTML = `<div class="empty"><h2>${esc(t('sum.empty'))}</h2>
      <button id="sumBack">${esc(t('sum.back'))}</button></div>`;
    $('sumBack')?.addEventListener('click', () => abrirSeccion('escena'));
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

  $('sumBack')?.addEventListener('click', () => abrirSeccion('escena'));
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

    ${/*
      LO QUE LE RESISTES A ÉL. Es el sentido contrario del bloque de arriba, y
      hasta la 1.13.0 no existía: se contaban 1.972 resistencias tuyas en todo
      un registro y se guardaban como UN número por pelea, `resistsCaused`, que
      no se puede usar para nada. Ahora van con su lanzador y su hechizo, que es
      lo que convierte «resististe 7» en «a éste le paras el miedo».
      Vacío no se enseña: cero resistencias puede ser que no te haya lanzado
      nada, y eso no es un hallazgo.
    */''}
    ${(d.resisted ?? []).length ? `<div class="dos-block">
      <div class="eyebrow">${esc(t('foe.youResist'))}</div>
      <div class="hint">${esc(t('foe.youResistNote'))}</div>
      ${d.resisted.map((x) => `<div class="foe-det-l">
        <span>${esc(x.spell)}</span><b>×${n0(x.n)}</b>
      </div>`).join('')}</div>` : ''}

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
      ${retratoCache.get(f.name)
    ? `<img class="foeportrait" src="${retratoCache.get(f.name)}" alt="">` : ''}
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
/**
 * «Y N más», cuando una tabla no los enseña todos.
 *
 * Las tres listas del resumen tienen tope, y dos estaban recortando la mitad
 * de los datos sin decirlo: al resumir un histórico entero, «a quién pegas»
 * tenía 193 nombres con tope 15 —el 51,5% del daño oculto— y «de quién te
 * llega» 181 con tope 10 —el 57,3%—. Subidos a 60 se enseña el 89% y el 92%,
 * y lo que sigue faltando se dice aquí en vez de callarse.
 */
const resto = (n) => (n > 0 ? `<div class="hint">${esc(t('det.andMore', { n }))}</div>` : '');

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
    ${resto(r.abilitiesMas)}
    ${tbl(t('det.byType'), r.types.map(([ty, v]) => [ty, v, '', ty]), dmg)}
    ${tbl(t('det.byTarget'), (r.targets ?? []).map((x) => [x.name, x.sum, '']), dmg)}
    ${resto(r.targetsMas)}
    ${tbl(t('det.takenBy'), (r.takenBySource ?? []).map((x) => [x.name, x.sum, '']), r.taken || 1)}
    ${resto(r.takenMas)}
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
      ${d.series.map((g) => `<div class="tramo">
        <div class="tramo-h">
          <b>${esc(g.level ? t('lvl.level', { n: g.level }) : t('lvl.unknown'))}</b>
          <span class="dpill">${esc(encDiffLabel(g.diff))}</span>
          <span class="dim">${n0(g.fights)} ${esc(t('sum.fights', { n: g.fights }))}</span>
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
          <span>${esc(rotuloPelea(x))}</span>
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

/**
 * El retrato de un enemigo, si la wiki lo tiene.
 *
 * SÓLO LOS FICHEROS «Npc», nunca los del botín. Las páginas de bicho llevan
 * también iconos de los objetos que suelta, y poner uno al lado de un nombre
 * sería una imagen que miente sobre lo que es.
 *
 * NO HAY LISTA Y NO HACE FALTA: se cruza el nombre con el índice de ficheros
 * de la wiki, que caduca a la semana. El bicho que hoy no tiene foto la tendrá
 * en cuanto alguien la suba, sin tocar una línea. Hoy son 51 de tus 196
 * enemigos, un 26%.
 *
 * Y donde no hay, no va nada: ni hueco, ni interrogante, ni silueta genérica.
 */
const retratoCache = new Map();

async function pedirRetratos(nombres, repintar) {
  const faltan = [...new Set(nombres.filter(Boolean))].filter((n) => !retratoCache.has(n));
  if (!faltan.length) return;
  for (const n of faltan) retratoCache.set(n, null);
  try {
    const pares = (await window.eql.foePortraits?.(faltan)) ?? [];
    for (const [n, d] of pares) retratoCache.set(n, d);
    if (pares.length) repintar?.();
  } catch { /* sin red: se queda sin retrato, que no es un error */ }
}

/** El retrato pequeño, al lado del nombre. */
const foeIcon = (name) => {
  const d = retratoCache.get(name);
  return d ? `<img class="foeicon" src="${d}" alt="" aria-hidden="true">` : '';
};

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
      pedirRetratos(e.todos.map((x) => x.name), renderEncyclopedia);
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
      pedirRetratos([e.name], renderEncyclopedia);
      pedirIconos((e.foeDif?.abilities ?? []).map((a) => a.name), renderEncyclopedia);
    }
    if (page === 'foe') {
      e.foe = (await window.eql.encFoe?.(e.name)) ?? null;
      pedirRetratos([e.name], renderEncyclopedia);
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
  /**
   * EL ESCALÓN DE «ENCICLOPEDIA» SÓLO EXISTE DENTRO DE LA PESTAÑA VIEJA.
   *
   * Lo destapó `npm run marco` al comprobar el viaje de ida y vuelta de la
   * mudanza 6: dentro de la sección de Enemigos la miga seguía empezando por
   * «Enciclopedia › Enemigos › a zol ghoul knight», y ese primer escalón lleva
   * al ÍNDICE de tarjetas, que en una sección de la barra no es un sitio — lo
   * habría pintado dentro de Enemigos, que es una sección enseñando otra cosa.
   *
   * Dentro de una sección la miga empieza en la propia sección, que es lo que
   * la barra ya está diciendo a la izquierda. Cuando la pestaña se vaya en la
   * mudanza 10, esta condición se queda sola y la línea de arriba se borra.
   */
  // Ya no hay índice de enciclopedia sobre las páginas: se entra por la
  // sección, así que la primera miga es la página, no un cajón que la contenga.
  const partes = [];
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
        <span class="nm">${foeIcon(f.name)}${esc(f.name)}</span>
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
        <span class="nm">${foeIcon(f.name)}${esc(f.name)}</span>
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
    // ANCHO y ALTO, no W y H: esos nombres son ahora los de la gráfica compartida
    // y un local con el mismo nombre haría leer 600 donde pone 240.
    const ANCHO = 240; const ALTO = 34;
    const px = (i) => (m.serie.length === 1 ? ANCHO / 2 : (i / (m.serie.length - 1)) * ANCHO);
    const py = (y) => ALTO - ((y - min) / Math.max(1, max - min)) * (ALTO - 6) - 3;
    const d = m.serie.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(x.dps).toFixed(1)}`).join('');
    return `<svg class="serie" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" aria-hidden="true">
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

/**
 * El expediente, con todos los combates que has tenido contra él debajo.
 *
 * Estuvo borrada en la 1.7.1. No la quitó nadie a mano: un script de los que
 * uso para editar cortaba «desde este comentario hasta `renderEncyclopedia`»
 * y el ancla cayó una función más arriba de la cuenta. Se llevó ésta por
 * delante y la ficha de cualquier enemigo dejó de abrirse.
 *
 * Lo encontró `npm run ui:check`, que abre la aplicación y mide el DOM. No lo
 * habría cogido nada más: `node --check` da por buena una función que no
 * existe hasta que se la llama, y las pruebas de datos ni pasan por aquí.
 */
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
        <span class="num dim">${cayoEn(s, f.name)
    ? esc(t('enc.fell')) : esc(t('enc.survived'))}</span>
      </button>`).join('')}</div>` : `<div class="hint">${esc(t('flt.none'))}</div>`}`;
}

function renderEncyclopedia() {
  // Igual que el resumen desde la mudanza 5: las páginas de la enciclopedia se
  // están repartiendo en secciones y `#secPane` sólo existe cuando hay una
  // abierta. Mientras queden páginas en la pestaña vieja, las dos conviven.
  const host = $('secPane') ?? $('bodyGrid');
  const e = state.enc;
  // El título de la vista lo pone la pestaña, que está justo encima y marcada.
  // Repetirlo aquí costaba una línea de las que hacen falta para que las siete
  // secciones quepan de un vistazo, que es el trabajo de esa pantalla.
  const cuerpo = pintarSeguro(() => (e.page === 'zonas' ? encZonas()
    : e.page === 'zona' ? encZona()
      : e.page === 'enemigos' ? encEnemigos()
        : e.page === 'botin' ? encBotin()
          : e.page === 'hechizos' ? encHechizos()
            : e.page === 'progreso' ? encProgreso()
              : e.page === 'muertes' ? encMuertes()
                : e.page === 'foe' ? encFoe()
                  : e.page === 'foeDif' ? encFoeDif()
                    : e.page === 'hechizo' ? encHechizo()
                      : encIndex()), `Enciclopedia · ${e.page}`);
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
    abrirSeccion('escena');
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
    if (d && state.enc.page === 'foe') renderEncyclopedia();
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
    if (d && state.seccion === 'resumen') renderSummary();
    if (d && state.enc.page === 'foe') renderEncyclopedia();
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL ARMAZÓN: LAS SECCIONES DE LA BARRA LATERAL, AGRUPADAS POR ALCANCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta pelea · Todo el histórico · Ajustes. Por ALCANCE y no por tipo de dato,
 * y la razón es que lo primero que hay que saber de un número es de qué está
 * hablando. «Botín» dentro de «esta pelea» y «Botín» dentro de «todo el
 * histórico» son dos preguntas distintas, y agrupados por tipo se leerían como
 * la misma con dos vistas.
 *
 * SÓLO SE PINTA LO QUE YA EXISTE (`listo`). Una sección dibujada y vacía es una
 * promesa, y el prototipo trae varias que hoy no tienen datos. Mientras el
 * armazón esté a medias, la lista crece de una en una y LA NAVEGACIÓN VIEJA
 * —las tres pestañas de la cabecera— sigue funcionando al lado: se quita cuando
 * no quede nada en ella, no antes.
 *
 * `lista` dice si esa sección se ve con la columna de peleas al lado. Las de
 * «esta pelea» sí: elegir otra pelea es el gesto que las cambia.
 *
 * TODA SECCIÓN NECESITA TRES ESTADOS DIFERENCIABLES: CARGANDO, VACÍO Y CON
 * DATOS. Si dos de los tres se ven igual, uno está mintiendo — «todavía no ha
 * llegado» y «no hay nada» invitan a cosas distintas, y una de ellas es cerrar
 * la aplicación pensando que no funciona. Y hay un cuarto, falló, que tampoco
 * puede verse como el vacío.
 */
/**
 * TEMPORIZADORES DE REAPARICIÓN. Sección propia, activación MANUAL.
 *
 * La lógica está en `src/cronos.js` y se prueba sin interfaz. Aquí sólo se
 * pinta, se pregunta al puente por la última muerte, y se guarda la lista.
 *
 * NO LO ENCIENDE NINGUNA MUERTE. Con cien bichos por sala, un crono que
 * aparece solo cada vez que matas algo es ruido en pantalla justo cuando estás
 * mirando otra cosa. Lo abre el jugador y lo cierra el jugador.
 *
 * LA CIFRA LLEVA SIEMPRE DE DÓNDE SALE, y son tres sitios distintos: su propia
 * repetición, el ritmo de su zona, o lo que escribió Campeón. Es la misma
 * doctrina que el resto de la aplicación —medido, deducido, declarado— y aquí
 * importa más que en ningún sitio, porque un «vuelve en 4:25» de un común
 * estaría prometiendo que el que vuelve es el mismo, y eso no lo sabemos.
 */
/**
 * NUNCA MÁS PRECISIÓN DE LA QUE TIENE EL DATO.
 *
 * El formato lo decide la VENTANA del valor, no el reloj. Escribir «2:59:58»
 * sobre un jefe con ±12 horas de ventana afirma una precisión al segundo que
 * el dato no tiene, y quien lo lee no puede saberlo — está escrito igual que
 * el de Befallen, que sí la tiene.
 */
const cronoRestante = (r, precision = PRECISION.SEG) => {
  if (r == null) return '—';
  if (precision === PRECISION.CAL) {
    // Con ventana de horas o días esto no es una cuenta atrás: es un rango de
    // fechas, y se dice como tal. La ventana la pone quien llama.
    const d = new Date(Date.now() + r * 1000);
    return d.toLocaleString(getLang(), { weekday: 'long', hour: 'numeric' });
  }
  if (precision === PRECISION.MIN) {
    // Ventana de minutos: los segundos que se escribieran aquí serían
    // inventados, así que no se escriben.
    return `${Math.round(r / 60)} min`;
  }
  const m = Math.floor(r / 60), sg = Math.round(r % 60);
  return `${m}:${String(sg).padStart(2, '0')}`;
};

/** «mm:ss» o «ss» a segundos. Devuelve null si no se entiende. */
const cronoParse = (txt) => {
  const v = String(txt ?? '').trim();
  if (!v) return null;
  const m = /^(\d+):([0-5]?\d)$/.exec(v);
  if (m) return (+m[1]) * 60 + (+m[2]);
  return /^\d+$/.test(v) ? +v : null;
};

/**
 * ESTA SECCIÓN NUNCA HABÍA PINTADO NADA, y no lo delataba ningún síntoma.
 *
 * Estaba escrita como `renderCronos(host)`, recibiendo el contenedor. Pero las
 * secciones del grupo `historico` NO lo reciben: el despachador las llama con
 * `s.pinta(state.snap)` y cada una busca su hueco con `$('secPane')`, igual que
 * `renderResumen(snap)`.
 *
 * Así que `host` era el SNAPSHOT. `host.innerHTML = ...` no falla —es asignar
 * una propiedad a un objeto normal— y por eso no había error ahí; el reventón
 * llegaba dos líneas después, en `host.querySelector('#croAdd')`, que no es una
 * función. Resultado: la sección salía en blanco, siempre, desde el primer día.
 *
 * Y no lo vio nadie porque nadie la había mirado: la sección cambió cinco veces
 * en un día —clave, retención del valor, textos, rótulos en cinco idiomas— y
 * todo eso se probó con pruebas de lógica, que pasan sin DOM. Se destapó al
 * volcar la vista a fichero con `bin/ui-volcar.js`, que es lo que había que
 * haber hecho antes de la primera de las cinco.
 */
async function renderCronos(snap, cajaSec) {
  const host = huecoSeccion(cajaSec);
  if (!host) return;
  const lista = state.cfg?.cronos ?? [];
  // LA CLAVE ES NOMBRE + ZONA + DIFICULTAD, no el nombre. El periodo es de la
  // zona, así que dos zonas con el mismo bicho son dos cronos con dos tiempos,
  // y la muerte que reinicia uno no puede ser la de la otra punta del mundo.
  // Las CUATRO partes de la clave, no tres: si aquí se olvida el modo, el mapa
  // que vuelve se indexa con una clave y se consulta con otra, y hoy no se nota
  // sólo porque el modo es siempre null.
  const claves = lista.map((c) => ({
    nombre: c.nombre, base: c.base ?? null, diff: c.diff ?? null, mode: c.mode ?? null,
  }));
  // La última muerte se pregunta cada vez que se pinta: el registro está vivo y
  // una marca cacheada dejaría el crono contando desde una muerte vieja.
  const muertes = claves.length ? (await window.eql.ultimaMuerte?.(claves)) ?? {} : {};
  /**
   * CUÁNTAS OBSERVACIONES LLEVA CADA UNO. Se pregunta al pintar, como las
   * muertes: el registro está vivo y un recuento cacheado envejece solo.
   */
  const obs = claves.length ? (await window.eql.observacionesDe?.(claves)) ?? {} : {};
  /**
   * LA MULTIPLICIDAD SE PREGUNTA AL PINTAR, no se coge la del dia que se abrio
   * el crono: un nombre puede demostrar que hay varios en cualquier pelea
   * posterior, y un valor congelado seguiria diciendo lo viejo.
   */
  const mult = claves.length ? (await window.eql.multiplicidadDe?.(claves)) ?? {} : {};
  /**
   * CUANDO SE LE VIO POR ULTIMA VEZ. Cualquier linea que lo nombre prueba que
   * existe: hay 145 de esas por cada una que dice que ha muerto, y el 97% de
   * las reapariciones vienen anunciadas por una antes de la muerte siguiente,
   * con un minuto de adelanto mediano.
   *
   * Es lo que retira el «lleva N periodos a cero, puede que ya este ahi»: ya no
   * hay que suponerlo.
   */
  const visto = claves.length ? (await window.eql.vistoDe?.(claves)) ?? {} : {};
  /** Y la cota superior, que es aritmetica y no depende de nada estadistico. */
  const cotas = claves.length ? (await window.eql.cotaDe?.(claves)) ?? {} : {};
  const ahora = Math.floor(Date.now() / 1000);

  /**
   * EL ESTADO SE CALCULA ANTES DE ORDENAR, y no puede ser de otra manera: el
   * orden es «el que antes vuelve», y cuánto le queda a cada uno es
   * precisamente lo que devuelve `estadoCrono`. Por eso son dos pasadas y no
   * un `map` con `sort` encima.
   */
  const conEstado = lista.map((c) => ({
    crono: c,
    clave: claveCrono(c),
    estado: estadoCrono(c, {
      ahora,
      /**
       * EL INSTANTE QUE TRAE EL CRONO CUENTA COMO UNA MUERTE MÁS, y se coge el
       * más reciente de los dos.
       *
       * `desde` lo pone quien abre el crono desde una pelea: es la muerte de
       * ESE enemigo en ESE combate. El motor, en cambio, contesta «la última
       * muerte de esa clave», que es lo correcto en cuanto vuelva a morir.
       * Tomando el máximo, el crono arranca desde lo que el jugador acaba de
       * ver y sigue reiniciándose con las muertes que vengan después.
       */
      ultimaMuerte: Math.max(muertes[claveCrono(c)] ?? 0, c.desde ?? 0) || null,
      /**
       * LO NUESTRO ENTRA AQUI, y solo para CONTRASTAR.
       *
       * `valorDe` nunca deja que `medido` mande el numero —`manda` es manual o
       * wiki, jamas lo nuestro— asi que enchufarlo no lo saca a pantalla. Lo
       * unico que habilita es la comparacion, que llevaba escrita desde
       * siempre y sin entrada: al retirar `medido` como concepto se quedo
       * calculando contra `null` para siempre y nadie lo comprobo.
       *
       * Con menos de `MIN_OBS_DISCREPA` no se pasa: afirmar que algo no
       * coincide con dos observaciones seria afirmar ruido.
       */
      /**
       * Y LA MULTIPLICIDAD MANDA SOBRE EL RECUENTO.
       *
       * «Lo observado no coincide» es una AFIRMACION sobre nuestra cifra aunque
       * no la imprima, y hereda sus problemas. Tres observaciones bastan para
       * que no sea ruido de muestra, pero **no bastan si son de bichos
       * distintos**: de un nombre del que hay cuarenta no sabemos cual volvio,
       * asi que tampoco sabemos si SU tiempo discrepa del que escribio Campeon.
       *
       * Con multiplicidad demostrada no se afirma nada: se ensena el recuento
       * de observaciones y se calla. Es la misma linea de siempre.
       */
      medido: puedeAfirmarDiscrepancia({
        observaciones: obs[claveCrono(c)]?.observaciones ?? 0,
        multiplicidad: mult[claveCrono(c)] ?? 0,
      }) ? (obs[claveCrono(c)]?.minimo ?? null) : null,
      heredado: null,
      // La wiki se consulta AL PINTAR y no se guarda con el crono: la tabla se
      // corrige con una versión nueva, y un valor congelado en la configuración
      // seguiría diciendo lo viejo sin que nadie lo supiera.
      wiki: tiempoDeZona(c.base)?.segundos ?? null,
      wikiPagina: tiempoDeZona(c.base)?.pagina ?? null,
    }),
  }));

  /**
   * LA CLAVE NO PUEDE VIAJAR EN UN ATRIBUTO DEL DOM, y esto no era una teoría.
   *
   * `claveCrono` separa con `\u0000` a propósito: es lo único que no puede salir
   * dentro del nombre de un bicho. Pero al escribirlo en un atributo, **el
   * navegador lo sustituye por U+FFFD al parsear el HTML**, así que lo que se lee
   * de vuelta en `dataset` NO ES la clave que se escribió. La comparación fallaba
   * siempre y el botón «Cerrar» NO CERRABA. «Poner tiempo» tenía el mismo
   * agujero.
   *
   * Se vio volcando el HTML renderizado con `bin/ui-volcar.js` y mirando el
   * atributo crudo. Leyendo el código no aparece: el `esc()` está puesto, la
   * clave es correcta y la comparación es la buena.
   *
   * Así que por el DOM viaja la POSICIÓN, y la fila se resuelve por identidad de
   * objeto contra la lista ordenada. Una posición es un entero y no tiene nada
   * que un parser pueda estropear.
   */
  const orden = ordenCola(conEstado);
  /**
   * SE CONSTRUYE DOS VECES A PROPÓSITO: con las cuentas atrás y sin ellas.
   *
   * La de sin números es la FIRMA de la sección. Ver el bloque «EL TIC NO
   * RECONSTRUYE LA SECCIÓN» de más abajo, que explica por qué existe.
   *
   * Podría haberse escrito una firma declarativa —una lista de los campos que
   * afectan al HTML— y sería más barata. No se ha hecho, y el motivo es que una
   * firma escrita a mano se queda coja en cuanto la fila cambie: bastaría con
   * añadir un rótulo nuevo y olvidarse de meterlo, y entonces ese rótulo no se
   * repintaría NUNCA y no habría ningún síntoma. Generando el mismo HTML dos
   * veces, la firma no se puede desincronizar de lo que se pinta.
   */
  /**
   * EL PINTOR NO CONSTRUYE HTML. Reúne los datos, los formatea, y se los da al
   * CONSTRUCTOR —`ui/cronos-vista.js`—, que es puro y se prueba sin navegador.
   *
   * Aquí es donde se formatea y en ningún otro sitio: el constructor no sabe de
   * `cronoRestante` ni de `labelDiff`, y por eso se puede llamar desde una
   * prueba sin arrancar nada. Lo vigila `test/contrato-pintores.js`.
   */
  const modelo = {
    /**
     * LA PESTAÑA Y LA LEYENDA SE LEEN DE DONDE ESTÁN, no de una variable.
     *
     * Las mueve el jugador pulsando, y `pintaEstable` reconstruye desde el
     * modelo: si el modelo no dijera en cuál está, cada reconstrucción lo
     * devolvería a la primera pestaña. La pestaña viva la sabe el DOM; la
     * leyenda, que sobrevive a cerrar la aplicación, la configuración.
     */
    vista: host.querySelector('.pz-pest button[aria-selected="true"]')?.dataset.ir || 'vig',
    // Y qué filas dejó desplegadas, por la misma razón y con más motivo: el
    // campo de poner tiempo vive dentro de una.
    abiertas: desplegadas(host),
    // Agrupar SÍ es estructura y no se puede aplicar sobre el DOM ya pintado:
    // vuelve al modelo y la sección se reconstruye agrupada de otra manera.
    agruparPor: host.querySelector('.pz-agrupar')?.value || 'zona',
    leyendaAbierta: state.cfg?.croLeyenda === true,
    fichas: orden.map(({ crono: c, estado: st }) => ({
      crono: {
        ...c,
        manualTxt: c.manual != null ? cronoRestante(c.manual) : '',
        zonaTxt: c.base ? `${c.base}${c.mode ? ` · ${c.mode}` : ''}${
          c.diff != null ? ` · ${labelDiff(c.diff, c.diffTag)}` : ''}` : null,
        /**
         * LA COTA Y EL VISTO SE FORMATEAN AQUI, que es donde estan los relojes.
         * El constructor recibe cadenas ya hechas y por eso se puede probar sin
         * levantar nada.
         */
        cota: (() => {
          const k = cotas[claveCrono(c)];
          return k ? { txt: cronoRestante(k.segundos), huecos: k.huecos, origen: k.origen } : null;
        })(),
        /**
         * LA DECISION es de `lecturaDelVisto`, que es pura y recibe `ahora`.
         * Aqui solo se le da lo que sabe este sitio —los relojes— y se formatea
         * lo que devuelve.
         */
        visto: (() => {
          const l = lecturaDelVisto({
            visto: visto[claveCrono(c)] ?? null,
            ultimaMuerte: Math.max(muertes[claveCrono(c)] ?? 0, c.desde ?? 0) || null,
            ahora,
            cota: cotas[claveCrono(c)] ?? null,
          });
          if (!l) return null;
          return l.esta
            ? { txt: cronoRestante(l.segundos), esta: true }
            : { desdeTxt: cronoRestante(l.segundos), pasado: l.pasado };
        })(),
      },
      estado: {
        ...st,
        restanteTxt: cronoRestante(st.restante, st.valor?.precision),
        valor: {
          ...st.valor,
          segundosTxt: st.valor?.segundos != null ? cronoRestante(st.valor.segundos, st.valor.precision) : null,
          zonaTxt: (() => {
            const w = (st.valor?.fuentes ?? []).find((f) => f.clave === 'wiki')?.valor;
            return w?.segundos != null ? cronoRestante(w.segundos, w.precision) : null;
          })(),
          pagina: (st.valor?.fuentes ?? []).find((f) => f.clave === 'wiki')?.valor?.pagina ?? null,
        },
      },
      obs: obs[claveCrono(c)] ?? { observaciones: 0, muertes: 0 },
    })),
  };
  const paginaDe = (conNumero) => construyeCronos(modelo, conNumero);

  /**
   * EL TIC NO RECONSTRUYE LA SECCIÓN. La guarda es `pintaEstable`, que está
   * arriba en este mismo fichero con el relato entero: el snapshot llega cada
   * 250 ms y esta sección reescribía su `innerHTML` en cada pasada, así que el
   * campo del nombre se destruía cuatro veces por segundo.
   *
   * Aquí sólo se dice QUÉ es lo volátil: las cuentas atrás. Todo lo demás
   * —comparar, conservar el foco, no tocar el DOM si nada cambió— lo hace ella.
   */
  const modo = pintaEstable(host, paginaDe, (h) => {
    for (const nodo of h.querySelectorAll('.cro-num[data-num]')) {
      const o = orden[+nodo.dataset.num];
      // Sólo los que cuentan. Un cambio de estado altera la firma y no llega
      // hasta aquí, así que esto no puede pisar el rótulo de «disponible».
      if (o && o.estado.estado === ESTADO.CONTANDO) {
        nodo.textContent = cronoRestante(o.estado.restante, o.estado.valor.precision);
      }
    }
  }, 'croSig');
  // Los escuchadores se cuelgan tras una reconstrucción y sólo tras ella: si no
  // la hubo, los nodos de antes siguen vivos y con los suyos puestos.
  if (modo === 'refrescado') return;

  // Pestañas, pastillas, buscador y densidad son del módulo y los cablea él.
  // La leyenda se recuerda entre sesiones, así que su memoria es la
  // configuración y no una variable que muere al cerrar.
  conectarPiezas(host, {
    memoria: {
      leer: () => state.cfg?.croLeyenda === true,
      guardar: (_k, v) => { state.cfg.croLeyenda = v; window.eql.setFlag('croLeyenda', v); },
    },
  });

  const guardar = async (l) => {
    await window.eql.setFlag('cronos', l);
    state.cfg.cronos = l;
    await renderCronos(snap, host);
  };

  host.querySelector('#croAdd')?.addEventListener('click', async () => {
    const nombre = host.querySelector('#croNuevo')?.value?.trim();
    if (!nombre) return;
    // La zona se coge de donde está AHORA, y no se pregunta: el crono se abre
    // estando delante del bicho. Si no consta zona se abre igual —vale más un
    // crono sin zona que ninguno— pero la ficha lo dice.
    const z = state.snap?.zone ? parseZone(state.snap.zone) : null;
    // El modo va en la clave por si algún día `parseZone` lo separa. HOY es
    // siempre null, y las copias ya no colisionaban: el modo viaja dentro de
    // `base` —«Nagafen's Lair Solo»—, así que las claves ya eran distintas.
    const alta = { nombre, base: z?.base ?? null, diff: z?.diff ?? null, mode: z?.mode ?? null };
    if (lista.some((c) => claveCrono(c) === claveCrono(alta))) return;
    // El aviso de «hay varios» se calcula AL ABRIRLO y se guarda con el crono:
    // después ya se ha creído lo que decía, y avisar entonces no sirve.
    const ficha = (state.enc?.foes ?? []).find((f) => f.name === nombre) ?? null;
    /**
     * AQUÍ SE LEÍAN `ficha.respawnMedido` y `ficha.respawnZona`, Y NO EXISTEN.
     *
     * No es que estuvieran vacíos a veces: la enciclopedia no escribe esos dos
     * campos en ninguna parte del proyecto. O sea que `medido` y `heredado` han
     * sido `null` desde el primer día, y el crono nunca ha podido enseñar un
     * número nuestro aunque se le dejara.
     *
     * Se quitan en vez de rellenarlos, y la razón ya no es de estilo: no hay
     * periodo que poner. Medido —`PERIODOS-CONGELADOS.md` §13— la unidad que
     * este crono usa como clave produce UN racimo en todo el corpus, de un
     * común, que salta el remuestreo y empata con el nulo; y en nombrados
     * únicos, cero. El día que haya dato, esto vuelve por `valorDe`, que sigue
     * sabiendo recibirlo y tiene sus pruebas.
     */
    /**
     * EL RECUENTO ES EL DE ESTA CLAVE, no el del bicho en todo el mundo.
     *
     * `ficha.kills` suma sus muertes en TODAS las zonas y dificultades, y la
     * clave de este crono es nombre+zona+dificultad+modo. Con el recuento
     * global, el «van N muertes observadas» de la ficha promete una muestra
     * que no es de aquí — que es exactamente el error que este proyecto
     * persigue: una cifra correcta contestando otra pregunta.
     *
     * Se pide por zona y dificultad, que es hasta donde llega la enciclopedia.
     * El modo no lo distingue todavía, así que en esa dimensión el recuento
     * SIGUE CONTANDO DE MÁS y hay que decirlo aquí en vez de aparentar que no.
     */
    const aqui = alta.base
      ? ((await window.eql.encZoneFoes?.(alta.base, alta.diff)) ?? [])
        .find((f) => f.name === nombre) ?? null
      : null;
    const muertes = aqui?.kills ?? (alta.base ? 0 : ficha?.kills ?? 0);
    /**
     * Y CUÁNTOS SE HAN VISTO A LA VEZ, que es la rama FUERTE del aviso.
     *
     * Se pasaba `null` y por eso esa rama no podía dispararse nunca: quedaba
     * sólo la deducida —«ha muerto muchas veces, probablemente haya varios»—.
     * Medido, la fuerte caza 117 claves que la débil no ve.
     */
    const vistos = ((await window.eql.multiplicidadDe?.([alta])) ?? {})[claveCrono(alta)] ?? null;
    await guardar([...lista, {
      ...alta, manual: null,
      muertes, vistos,
      aviso: avisoDeVarios(vistos, muertes),
    }]);
  });
  // La posición es la de la lista ORDENADA, y la fila se resuelve por identidad
  // de objeto: `orden[i].crono` es literalmente el mismo objeto que está en
  // `lista`, así que el filtro no necesita comparar ninguna cadena.
  host.querySelectorAll('[data-quita]').forEach((el) => el.addEventListener('click', () => {
    const ese = orden[+el.dataset.quita]?.crono;
    if (!ese) return;
    guardar(lista.filter((c) => c !== ese));
  }));
  host.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('click', () => {
    const i = +el.dataset.set;
    const ese = orden[i]?.crono;
    const txt = host.querySelector(`[data-man="${i}"]`)?.value;
    if (!ese) return;
    guardar(lista.map((c) => (c === ese ? { ...c, manual: cronoParse(txt) } : c)));
  }));
}

/**
 * EL CONTRATO DE `pinta`: SIEMPRE `(snap, caja)`, Y `caja` SIEMPRE ES UN NODO.
 *
 * No lo era. Unas secciones recibían el contenedor y otras el snapshot, según
 * si estaban en `EN_LA_PAGINA` o no, y cada una se defendía por su cuenta con
 * un `caja ?? $('secPane')`. `renderCronos` no copió esa defensa y recibió el
 * snapshot como si fuera el hueco.
 *
 * Y ESO NO DIO NINGÚN ERROR DONDE ESTABA EL FALLO. En JavaScript,
 * `objetoCualquiera.innerHTML = '<div>'` es una asignación perfectamente
 * válida: crea una propiedad y sigue. El reventón llegaba dos líneas después,
 * en el primer `querySelector`, y para entonces el rastro ya no señalaba a la
 * llamada equivocada. La sección salió en blanco durante días.
 *
 * Por eso esto no es sólo un `??`: es una ASERCIÓN DE ENTRADA. Si llega algo
 * que no es un elemento, revienta AQUÍ, con el nombre de lo que llegó. Un fallo
 * de contrato tiene que doler en la frontera, no en el interior.
 */
function huecoSeccion(caja) {
  if (caja != null && !(caja instanceof Element)) {
    const q = caja?.constructor?.name ?? typeof caja;
    throw new TypeError(`pinta() esperaba un elemento del DOM y recibió ${q}. `
      + 'El contrato es pinta(snap, caja): mira la llamada, no esta función.');
  }
  return caja ?? $('secPane');
}

const SECCIONES = [
  { id: 'escena', grupo: 'pelea', ico: '▮', rotulo: () => t('sec.escena'),
    listo: true, lista: true, pinta: renderEscena },
  { id: 'habilidad', grupo: 'pelea', ico: '≡', rotulo: () => t('sec.habilidad'),
    listo: true, lista: true, pinta: renderPorHabilidad },
  { id: 'botin', grupo: 'pelea', ico: '◈', rotulo: () => t('loot.title'),
    listo: true, lista: true, pinta: renderBotinPelea },
  // `an.tab` —«Análisis»— existía traducida a los cinco idiomas y no la pintaba
  // nadie: la destapó `npm run vacios`. Es el rótulo corto que pide una barra
  // lateral; `an.title` es «Análisis del combate», que es el título de la vista.
  { id: 'registro', grupo: 'pelea', ico: '☰', rotulo: () => t('log.title'),
    listo: true, lista: true, pinta: renderRegistro },
  { id: 'analisis', grupo: 'pelea', ico: '◑', rotulo: () => t('an.tab'),
    listo: true, lista: true, pinta: renderAnalisis },
  // `sum.title` es «Resumen del tramo», que es el título de la vista; en una
  // barra lateral de 176 px un rótulo de tres palabras se parte. Rótulo corto
  // propio, con sus cinco idiomas.
  { id: 'resumen', grupo: 'historico', ico: '▤', rotulo: () => t('sec.resumen'),
    listo: true, lista: false, pinta: renderResumen },
  { id: 'enemigos', grupo: 'historico', ico: '✦', rotulo: () => t('enc.enemigos'),
    listo: true, lista: false, pinta: renderEnemigos },
  { id: 'botin-h', grupo: 'historico', ico: '◇', rotulo: () => t('enc.botin'),
    listo: true, lista: false, pinta: renderBotinHistorico },
  // `enc.progreso` es «Mi progresión» / «A minha progressão», que en 176 px se
  // parte en dos líneas. Rótulo corto propio, con sus cinco.
  { id: 'progreso', grupo: 'historico', ico: '▲', rotulo: () => t('sec.progreso'),
    listo: true, lista: false, pinta: renderProgreso },
  { id: 'zonas', grupo: 'historico', ico: '◆', rotulo: () => t('enc.zonas'),
    listo: true, lista: false, pinta: renderZonas },
  { id: 'hechizos', grupo: 'historico', ico: '✧', rotulo: () => t('sec.hechizos'),
    listo: true, lista: false, pinta: renderHechizos },
  { id: 'muertes', grupo: 'historico', ico: '†', rotulo: () => t('sec.muertes'),
    listo: true, lista: false, pinta: renderMuertes },
  { id: 'cronos', grupo: 'historico', ico: '◷', rotulo: () => t('sec.cronos'),
    listo: true, lista: false, pinta: renderCronos },
  { id: 'avisos', grupo: 'ajustes', ico: '◉', rotulo: () => t('tab.alerts'),
    listo: true, lista: false, pinta: renderAvisos },
  { id: 'preferencias', grupo: 'ajustes', ico: '⚙', rotulo: () => t('sec.preferencias'),
    listo: true, lista: false, pinta: renderPreferencias },
];

function renderLateral() {
  const host = $('lateral');
  if (!host) return;
  // Durante la introducción y la configuración del log no hay secciones a las
  // que ir: la barra se quita en vez de ofrecer un sitio al que no se puede
  // entrar todavía. `.lateral:empty` se encarga de que no quede el carril.
  const hay = state.setup || state.wizard ? [] : SECCIONES.filter((s) => s.listo);
  const activa = state.seccion;
  const sig = `${getLang()}|${activa ?? ''}|${hay.map((s) => s.id).join(',')}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  host.innerHTML = ['pelea', 'historico', 'ajustes'].map((g) => {
    const items = hay.filter((s) => s.grupo === g);
    if (!items.length) return '';
    return `<div class="lat-g">${esc(t(`sec.g.${g}`))}</div>${items.map((s) => `
      <button class="lat-item${s.id === activa ? ' on' : ''}" data-sec="${s.id}">
        <span class="ico">${s.ico}</span>${esc(s.rotulo())}</button>`).join('')}`;
  }).join('');

  host.querySelectorAll('[data-sec]').forEach((el) =>
    el.addEventListener('click', () => abrirSeccion(el.dataset.sec)));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS CUATRO DE «ESTA PELEA» SON UNA SOLA PÁGINA QUE SE DESPLAZA.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MEDIDO ANTES DE MOVER NADA, a 1920×1080 y sobre 961 px de alto útil: Escena
 * llenaba el 32,6 %, Por habilidad el 89,4 %, Botín el 14,2 % y El registro el
 * 53,4 %. Tres de las cuatro no pasaban de media pantalla. Juntas suman lo que
 * la página de Combate de la 1.15.0 medía entera, así que la mudanza no había
 * repartido contenido: había repartido AIRE.
 *
 * Análisis se queda aparte a propósito: ella sola mide 2.330 px, más que las
 * cuatro juntas, y meterla haría de esto un rollo de pergamino.
 *
 * ── EL REQUISITO QUE SÍ ES REQUISITO ──────────────────────────────────────
 *
 * EL REGISTRO CONSERVA SU DESPLAZADOR. Su caja esconde unos 21.000 px detrás
 * de un `.logbox` con `max-height: 420px`. Dejándolo crecer, la página pasa de
 * 1.875 px a casi 23.000 y deja de ser una página. El desplazador interno no
 * es una preferencia: es lo que hace posible esto.
 *
 * ── Y LA PUERTA DE VISIBILIDAD QUE AQUÍ NO ESTÁ ───────────────────────────
 *
 * Hubo una, y se quitó CON LA MEDICIÓN DELANTE. La idea era repintar sólo las
 * cajas a la vista, porque cuatro secciones vivas a 4 Hz parecían cuatro veces
 * el trabajo. El banco —`tmp/banco.cjs`, cinco tandas de 25 s con 12,4 líneas
 * por segundo de tráfico real— dijo que no:
 *
 *     una sección sola   p50 16,7 ms · p99 24,0 · CPU 0,5 %
 *     las cuatro, con puerta   p50 16,7 ms · p99 23,3 · CPU 0,5 %
 *     las cuatro, SIN puerta   p50 16,7 ms · p99 24,2 · CPU 0,6 %
 *
 * Las tres iguales, y la diferencia entre tandas mayor que la diferencia entre
 * versiones. Lo que ya mantenía el coste plano son las guardas de firma que
 * cada sección tiene desde siempre —`if (host.dataset.sig === sig) return;`,
 * `if (!$('rows'))`—: repintar una sección que no ha cambiado ya era gratis.
 *
 * Y la puerta no salía gratis: al saltarse las cajas de abajo dejaba CONTENIDO
 * VIEJO esperando. Al montar aún no hay pelea elegida, así que las cuatro se
 * pintaban con «Elige una pelea»; al elegirla se repintaban las tres visibles
 * y El registro se quedaba con el cartel puesto hasta que alguien bajara. Hizo
 * falta un repintado en el desplazamiento sólo para tapar eso.
 *
 *     UNA OPTIMIZACIÓN QUE NO SE MIDE EN EL BANCO Y SÍ SE VE EN LA PANTALLA
 *     ESTÁ COSTANDO DINERO, NO AHORRÁNDOLO.
 *
 * Se pintan las cuatro en cada tic y ya está. La medición queda aquí escrita
 * por si la página crece: el día que estas cuatro cajas se vuelvan diez, o que
 * una pierda su guarda de firma, hay que volver a medir — y entonces la puerta
 * tendrá algo que ahorrar.
 */
const EN_LA_PAGINA = ['escena', 'habilidad', 'botin', 'registro'];

/** Pinta la página de «esta pelea»: las cuatro, siempre. */
function pintaLaPagina(snap) {
  const pane = $('secPane');
  if (!pane) return;
  const montando = !pane.querySelector('.enlapagina');
  if (montando) {
    pane.innerHTML = EN_LA_PAGINA.map((id) => `<section class="enlapagina" id="ap-${id}" data-ap="${id}"></section>`).join('');
    pane.addEventListener('scroll', alDesplazarse, { passive: true });
  }
  for (const id of EN_LA_PAGINA) {
    const caja = document.getElementById(`ap-${id}`);
    if (caja) SECCIONES.find((x) => x.id === id)?.pinta(snap, caja);
  }
  if (montando) irALaSeccion(state.seccion, false);
  /**
   * Y LA MARCA SE RECALCULA TAMBIÉN AQUÍ, no sólo al desplazarse.
   *
   * Atarla únicamente al evento de desplazamiento la deja mentir en cuanto el
   * contenido cambia de alto SIN que nadie se desplace, que en vivo pasa todo
   * el rato: una pelea nueva encoge Botín y El registro, el navegador recorta
   * el desplazamiento hasta lo que quepa —medido, de 998 a 4— y la marca se
   * queda señalando la sección que había ahí antes. Salió en el banco: la
   * barra decía «Por habilidad» con la página arriba del todo.
   */
  else marcaLaQueSeVe();
}

/**
 * ── LA MARCA DE LA BARRA SIGUE AL DESPLAZAMIENTO ──────────────────────────
 *
 * No es pulido. Agrupar por alcance sirve para saber DE QUÉ HABLA CADA NÚMERO
 * antes de leerlo, y una barra que señala Escena mientras estás mirando El
 * registro informa mal justo en lo único que el índice prometía. Con cuatro
 * secciones en una página, la barra ya no es un conmutador: es un índice, y un
 * índice que no sigue a la página está roto.
 *
 * MANDA LA QUE OCUPA LA LÍNEA DE LECTURA, no la que más área ocupa. A un
 * tercio de la altura del panel: es donde está mirando quien lee, y evita que
 * una caja alta de abajo se lleve la marca en cuanto asoma por el borde.
 *
 * LOS DOS EXTREMOS MANDAN SOBRE LA LÍNEA, y los dos por el mismo motivo: en
 * ellos la línea de lectura da una respuesta que nadie diría.
 *
 *   · Arriba del todo manda la PRIMERA. Escena mide 251 px y el panel 961, así
 *     que a un tercio la línea ya cae dentro de Por habilidad: pulsabas
 *     «Escena», la página subía al principio y la marca saltaba sola a la
 *     siguiente. Salió en el banco —«habilidad» con `scrollTop 4`— y es
 *     justo el fallo que esto venía a arreglar, cometido al revés.
 *   · Abajo del todo manda la ÚLTIMA. Si El registro es más corto que el panel
 *     nunca llegaría a cruzar la línea, y su botón no se encendería jamás por
 *     mucho que lo tengas delante.
 */
function seccionALaVista(pane) {
  const linea = pane.getBoundingClientRect().top + pane.clientHeight / 3;
  if (pane.scrollTop <= 4) return EN_LA_PAGINA[0];
  if (pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 4) return EN_LA_PAGINA.at(-1);
  let cual = EN_LA_PAGINA[0];
  for (const id of EN_LA_PAGINA) {
    const caja = document.getElementById(`ap-${id}`);
    if (caja && caja.getBoundingClientRect().top <= linea) cual = id;
  }
  return cual;
}

/**
 * Poner la marca en la sección que se está viendo.
 *
 * SÓLO LA MARCA: no monta ni desmonta nada. Cambiar de sección de verdad aquí
 * volvería a montar la página bajo los pies de quien se está desplazando.
 */
function marcaLaQueSeVe() {
  const pane = $('secPane');
  if (!pane || !pane.querySelector('.enlapagina')) return;
  const id = seccionALaVista(pane);
  if (!id || id === state.seccion) return;
  state.seccion = id;
  renderLateral();
}

/** Encolado en un fotograma: el desplazamiento dispara muchas veces seguidas. */
function alDesplazarse() {
  const pane = $('secPane');
  if (!pane || pane.dataset.enCola === '1') return;
  pane.dataset.enCola = '1';
  requestAnimationFrame(() => { pane.dataset.enCola = '0'; marcaLaQueSeVe(); });
}

/** Llevar la página hasta la sección pedida. */
function irALaSeccion(id, suave = true) {
  const caja = document.getElementById(`ap-${id}`);
  if (!caja) return;
  caja.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
}

/**
 * Entrar en una sección.
 *
 * Y APAGA LAS PESTAÑAS VIEJAS, que es lo que evita que las dos navegaciones se
 * contradigan mientras conviven: si «Combate» sigue encendida mientras miras
 * Botín, la cabecera está diciendo que estás en otro sitio.
 */
function abrirSeccion(id) {
  state.view = 'sec';
  state.seccion = id;
  /**
   * Y LA PÁGINA DE LA ENCICLOPEDIA SE OLVIDA AL CAMBIAR DE SECCIÓN A MANO.
   *
   * Sin esto, pulsar «Progreso» viniendo de «Botín» rebotaba: la sección nueva
   * veía que la página puesta —`botin`— es de OTRA sección y saltaba de vuelta,
   * así que la barra marcaba Progreso y la pantalla enseñaba el botín. Y las dos
   * capturas salían idénticas, con su cobertura cuadrada y todo: 29.284 px de
   * botín fotografiados dos veces con dos nombres.
   *
   * La regla de reenvío es para los SALTOS ENTRE PÁGINAS —de una tarjeta de
   * botín al enemigo que la suelta—, no para un clic en la barra: ahí el usuario
   * ya ha dicho a dónde quiere ir.
   */
  state.enc.page = null;
  /**
   * Y ENTRE LAS CUATRO DE LA PÁGINA NO SE DESMONTA NADA: se baja hasta ellas.
   * Borrar `#bodyGrid` aquí tiraría la página entera para volver a montarla
   * igual, perdiendo por el camino el sitio del desplazador del registro.
   */
  if (EN_LA_PAGINA.includes(id) && $('secPane')?.querySelector('.enlapagina')) {
    renderLateral();
    irALaSeccion(id);
    return;
  }
  $('bodyGrid').innerHTML = '';
  state.rowNodes.clear();
  renderApp();
}

function renderApp() {
  if (!state.setup && !state.wizard && state.snap?.path) {
    /**
     * NO HAY OTRA COSA QUE UNA SECCIÓN. Una sección que no existe —una
     * configuración vieja, un identificador cambiado— cae en la PRIMERA de la
     * barra en vez de dejar la pantalla en blanco: es la única rama de esta
     * función que puede quedarse sin nada que pintar.
     */
    const s = SECCIONES.find((x) => x.id === state.seccion) ?? SECCIONES[0];
    state.seccion = s.id;
    if (!$('secPane')) {
      $('bodyGrid').innerHTML = `${s.lista ? '<aside id="fightList"></aside>' : ''}<main id="secPane"></main>`;
      $('bodyGrid').classList.toggle('solo', !s.lista);
    }
    if (s.lista) renderFightList(state.snap);
    if (EN_LA_PAGINA.includes(s.id)) pintaLaPagina(state.snap);
    // Las dos cosas SIEMPRE, aunque la sección sólo use una: media docena de
    // secciones se defendían con un `?? $('secPane')` porque el despachador
    // les pasaba una cosa distinta según el grupo. Eso es lo que dejó pasar el
    // fallo de `renderCronos` — cuando el contrato es «depende», nadie lo lee.
    else s.pinta(state.snap, $('secPane'));
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
  if (state.setup || !state.snap?.path) {
    // Sin esta guarda el snapshot de 250 ms reconstruiría el formulario
    // en cada refresco y sería imposible escribir en él.
    if (!document.getElementById('inPath') && !state.mountingSetup) {
      state.mountingSetup = true;
      renderSetup().finally(() => { state.mountingSetup = false; });
    }
    return;
  }
}

function renderChrome(snap) {
  // La barra lateral es marco, como la cabecera: se pinta aquí y no en
  // `renderApp`, que reescribe `#bodyGrid` y no la toca. Tiene su guarda de
  // firma, así que pasar por aquí cuatro veces por segundo no cuesta nada.
  renderLateral();
  // Los temporizadores son del marco desde que hay secciones: dentro de la vista
  // de Combate se apagaban al entrar en cualquier otra, que es un reloj que deja
  // de avisar justo cuando te has ido a mirar otra cosa.
  renderTimers(snap);
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
      state.summary = null;
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
    renderLangPicker();
    renderApp();
  }));
}

/** Textos fijos del marco que no pasan por renderApp. */
function applyLangToChrome() {
  const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
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
  const otro = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(otro);
  await window.eql.setTheme(otro);
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
  $('bodyGrid').innerHTML = '';
  renderApp();
}

// La versión en el pie, al lado del crédito. No estaba en ninguna parte de la
// interfaz: para saber qué versión tenías había que mirar el instalador.
window.eql.appVersion?.().then((v) => {
  const el = $('fVer');
  if (el && v) el.textContent = v;
  // Y la lleva el informe de fallo: sin versión, un pantallazo no sirve.
  version = v ?? '';
}).catch(() => { /* si no la da, el pie se queda con el nombre y el crédito */ });

$('btnHelp')?.addEventListener('click', openWizard);

// ACERCA DE, colgado del crédito del pie.
//
// No lleva botón propio en la barra: el pie ya enseña el nombre y la versión,
// así que es donde mira quien busca ese dato. Un botón más arriba sería una
// cosa más que estorba a diario para algo que se abre dos veces en la vida.
$('fCredit')?.addEventListener('click', () => acercaDe({ version, licencia: 'FSL-1.1-MIT', t }));
$('btnSetup').addEventListener('contextmenu', (e) => { e.preventDefault(); openWizard(); });

// ═══════════ Avisos ═══════════
const showBanner = mountBanner();
window.eql.onAlert((a) => {
  if (a.speak) speak(a.speak, { ...(state.cfg.tts ?? {}), speech: langInfo().speech,
    queue: a.queue, priority: a.priority });
  if (a.sound && state.cfg.sound?.enabled !== false) playSound(a.sound, state.cfg.sound?.volume ?? 0.5);
  showBanner(a);
});

/**
 * Los recuentos y el estado se piden al entrar y no en cada repintado: salen de
 * la ficha, que ya está en memoria del otro lado, pero el viaje por el puente
 * no es gratis y esta pantalla se repinta con cada snapshot.
 */
async function encRefresh() {
  state.encCounts = (await window.eql.encCounts?.().catch(() => null)) ?? null;
  state.encStatus = (await window.eql.encStatus?.().catch(() => null)) ?? null;
}

window.eql.onLang((c) => { setLang(c); applyLangToChrome(); renderLangPicker(); });

/**
 * Aviso de que has tocado la tabla de tríos y el histórico no lo sabe.
 *
 * Cambiar la tabla sólo afecta a lo que venga a partir de ahora: las peleas
 * guardadas conservan el nivel con el que se cerraron. Decirlo importa porque
 * el fallo es silencioso — los números siguen ahí, con el mismo aspecto de
 * siempre, sólo que con el nivel de antes.
 */
/**
 * EL AVISO DE LAS FRONTERAS, EN UN SOLO SITIO.
 *
 * Reconstruir no reproduce exactamente el histórico mientras el cierre de pelea
 * se decida con dos relojes: donde el hueco entre dos peleas sea de exactamente
 * `idleSec`, la relectura puede fundirlas o partirlas de otra manera.
 *
 * Esto estuvo escrito sólo en el cartel de migración —el camino raro, el de
 * encontrarse un almacén viejo— y faltaba en el de tríos, que es el NORMAL:
 * tiene su propio botón «cambié de trío» dentro de la pelea y se pulsa a
 * menudo. Mismo `rebuildStore()`, mismas consecuencias, y sólo uno avisaba.
 *
 * Va en una función y no copiado en los dos sitios para que no se puedan volver
 * a separar, y hay una prueba que recorre este fichero y exige que TODA función
 * que llame a `rebuildStore()` la use.
 */
const avisoFronteras = () => `<p class="mig-aviso">${esc(t('mig.fronteras'))}</p>`;

function showTrioRebuild() {
  if (!state.needsRebuild) return;
  const bar = $('migBar');
  if (!bar) return;
  bar.innerHTML = `<div class="mig-h">${esc(t('trio.title'))}</div>
    <p>${esc(t('trio.rebuild'))}</p>
    ${avisoFronteras()}
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
/**
 * LAS CIFRAS DE TU HISTÓRICO HAN CAMBIADO, Y NADIE TE LO HA PREGUNTADO.
 *
 * La 1.10.0 pedía permiso: cartel, botón, tú decidías, y el histórico anterior
 * se apartaba con fecha. La 1.11.0 no lo pide — su corrección se hace al leer,
 * así que las peleas viejas enseñan otros números la primera vez que se abren y
 * no hay nada que pulsar. Eso, sin decirlo, es exactamente lo que este programa
 * no hace.
 *
 * VA DENTRO Y NO EN LAS NOTAS, por lo mismo que el cartel de migración: quien
 * tiene una versión instalada no lee las notas, abre el programa, ve unos
 * números y se los cree. Y desde la 1.10.0 hay una razón más — se actualiza
 * desde dentro, así que ni siquiera pasa por la página de la release.
 *
 * EL DISPARADOR NO ES LA MARCA DE LA CONFIGURACIÓN, es tener peleas por debajo
 * del formato de hoy (ver `avisoModelo` en store.js). Quien instale de cero no
 * tiene cifras que cambiar y no ve nada; la marca sólo evita repetirlo.
 */
async function showAvisoModelo() {
  const a = await window.eql.avisoModelo?.().catch(() => null);
  if (!a?.needed) return;
  const bar = $('migBar');
  if (!bar) return;
  bar.innerHTML = `<div class="mig-h">${esc(t('mod.title'))}</div>
    <p>${esc(t('mod.body', { n: n0(a.fights) }))}</p>
    <p>${esc(t('mod.why'))}</p>
    <p class="mig-fix">${esc(t('mod.mixed'))}</p>
    <div class="mig-btns"><button class="primary" id="modOk">${esc(t('mod.ok'))}</button></div>`;
  bar.style.display = 'block';
  $('modOk').addEventListener('click', () => {
    window.eql.avisoModeloVisto?.();
    bar.style.display = 'none';
    bar.innerHTML = '';
  });
}

async function showMigration() {
  const m = await window.eql.migration?.().catch(() => null);
  // El cartel de reconstruir manda sobre el del modelo: si hay que releer el
  // registro entero, lo que se corrige al leer es lo de menos.
  if (!m?.needed) { await showAvisoModelo(); return; }
  const bar = $('migBar');
  if (!bar) return;

  const pintar = (html) => { bar.innerHTML = html; bar.style.display = 'block'; };
  const cerrar = () => { bar.style.display = 'none'; bar.innerHTML = ''; };

  pintar(`<div class="mig-h">${esc(t('mig.title'))}</div>
    <p>${esc(t('mig.body', { n: m.fights }))}</p>
    ${/*
      El aviso va JUNTO AL BOTÓN, antes de pulsarlo. Mientras el cierre de pelea
      se decida con dos relojes, reconstruir puede mover fronteras: quien pulsa
      tiene que saberlo antes, no leerlo en las notas de la versión después.
    */''}
    ${avisoFronteras()}
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
        ${/* Lo borrado se dice aquí también, y no sólo en la consola: quien
             reconstruye desde el cartel no ve la consola nunca. */ ''}
        ${r.podadas?.length ? `<p class="hint">${esc(t('mig.podadas', {
    n: r.podadas.length, tandas: (r.tandasConservadas ?? []).join(', '),
  }))}</p>` : ''}
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
/**
 * El cartel de versión nueva, con la descarga dentro.
 *
 * TRES REGLAS, y las tres se ven en la pantalla:
 *
 *   EL TAMAÑO ANTES DE PULSAR. Son 75 MB. Quien esté con datos limitados o mala
 *   conexión tiene que poder decir que no con el número delante, no descubrirlo
 *   cuando ya va por la mitad. Sale de la propia release, no de una estimación.
 *
 *   DESCARGAR NO ES INSTALAR. Son dos botones y dos decisiones. Con la descarga
 *   hecha no pasa nada hasta que lo digas, ni siquiera al cerrar.
 *
 *   Y SI NO SE PUEDE HACER CON SEGURIDAD, SE QUEDA EL ENLACE. Sin `latest.yml`
 *   en la release no hay sha512 con el que comprobar lo descargado, y un
 *   ejecutable que no se puede comprobar no se lanza: el cartel se queda como
 *   siempre, con su enlace manual.
 */
function showUpdate(u) {
  const bar = $('updBar');
  if (!bar || !u) return;
  const mb = (n) => `${(n / 1024 / 1024).toFixed(0)} MB`;

  const pintar = (estado, extra = '') => {
    bar.innerHTML = `<span>${esc(t('upd.title', { v: u.version }))}</span>${extra}
      ${estado === 'listo' && u.descargable
    ? `<button class="primary" id="updDl">${esc(t('upd.download', { mb: mb(u.bytes) }))}</button>` : ''}
      ${estado === 'listo' && !u.descargable
    ? `<button class="primary" id="updGet">${esc(t('upd.get'))}</button>` : ''}
      ${estado === 'bajando' ? `<button id="updCancel">${esc(t('upd.cancel'))}</button>` : ''}
      ${estado === 'hecho' ? `<button class="primary" id="updInstall">${esc(t('upd.install'))}</button>` : ''}
      ${estado !== 'bajando' ? `<button id="updSkip">${esc(t('upd.skip'))}</button>` : ''}
      ${/*
        LAS NOTAS DE LA VERSIÓN, AQUÍ. `actualizar.js` se las traía desde la
        1.10.0 y no las pintaba nadie: quien actualizaba desde dentro —el camino
        que estrenó esa misma versión— no leía el registro de cambios NUNCA. Y
        entonces una versión que corrige cifras ya guardadas se instala sin que
        se haya podido leer qué va a cambiar.

        Plegadas, porque el cartel es una fila y esto son cuatro mil caracteres.
        Sin interpretar el markdown: no hay intérprete en esta aplicación y meter
        uno para esto sería traerse una dependencia entera. El texto se lee bien
        tal cual —es lo que se escribió para leerse— y así no hay forma de que
        lo que venga de la red se convierta en etiquetas.
      */''}
      ${u.notas ? `<details class="upd-notas">
        <summary>${esc(t('upd.notes'))}</summary>
        <pre>${esc(u.notas)}</pre>
      </details>` : ''}`;
    bar.style.display = 'flex';
    cablear(estado);
  };

  function cablear(estado) {
    $('updGet')?.addEventListener('click', () => window.eql.openUpdate());
    $('updSkip')?.addEventListener('click', () => {
      window.eql.skipUpdate(u.version);
      bar.style.display = 'none';
    });
    $('updCancel')?.addEventListener('click', async () => {
      await window.eql.cancelUpdate?.();
      pintar('listo');
    });
    $('updDl')?.addEventListener('click', async () => {
      pintar('bajando', `<span class="upd-prog"><i style="width:0%"></i></span>
        <span class="upd-pct num">0%</span>`);
      const r = await window.eql.downloadUpdate?.();
      if (r?.ok) {
        // El aviso de Windows: lo que se puede afirmar y lo que no. Bajarlo
        // desde aquí evita el cartel de «Windows protegió su PC», que lo
        // dispara la marca de Internet que añade el navegador. Lo que haga
        // Defender por reputación no se puede prometer, así que se dice.
        pintar('hecho', `<span class="upd-nota">${esc(t('upd.smartscreen'))}</span>`);
      } else if (r?.motivo === 'cancelado') {
        pintar('listo');
      } else {
        pintar('listo', `<span class="upd-nota bad">${esc(t(`upd.err.${r?.motivo ?? 'error'}`))}</span>`);
      }
    });
    $('updInstall')?.addEventListener('click', async () => {
      const r = await window.eql.installUpdate?.();
      if (!r?.ok) pintar('listo', `<span class="upd-nota bad">${esc(t('upd.err.sin-fichero'))}</span>`);
    });
  }

  // UNA SOLA VEZ. `showUpdate` se llama al arrancar y otra vez cuando llega el
  // aviso del proceso principal; registrando aquí sin guarda quedaban dos
  // escuchadores pintando la misma barra, y al tercer aviso tres.
  if (!showUpdate.escuchando) {
    showUpdate.escuchando = true;
    window.eql.onUpdateProgress?.((p) => {
      const barra = document.querySelector('#updBar .upd-prog i');
      const pct = document.querySelector('#updBar .upd-pct');
      if (!barra) return;
      barra.style.width = `${(p.pct * 100).toFixed(1)}%`;
      if (pct) pct.textContent = `${Math.round(p.pct * 100)}% · ${mb(p.hechos)} / ${mb(p.total)}`;
    });
  }

  pintar('listo');
}

window.eql.onUpdate?.(showUpdate);
/**
 * SI LA COMPROBACION DE VERSION FALLA, SE DICE — al registro, no en pantalla.
 *
 * Un cartel por no poder mirar si hay version nueva seria peor que el problema:
 * se soluciona solo a la siguiente. Pero tragarselo del todo deja «nunca hay
 * actualizaciones» y «no puedo preguntar» con la misma cara.
 */
window.eql.getUpdate?.().then((u) => { if (u) showUpdate(u); })
  .catch((e) => console.warn('[EQL Parse] no se pudo comprobar la version:', e?.message ?? e));

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
