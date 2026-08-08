const { app, BrowserWindow, ipcMain, dialog, globalShortcut, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// src/ es ESM y este fichero CommonJS: se cargan con import() dinámico.
let Engine, findLog, TriggerEngine, STARTER_TRIGGERS, engine;

const CONFIG = () => path.join(app.getPath('userData'), 'config.json');
const TRIGGERS = () => path.join(app.getPath('userData'), 'triggers.json');
const DEFAULTS = {
  logPath: null, self: null, idleSec: 20, fromStart: false,
  overlayBounds: null, clickThrough: false, classes: null, theme: 'dark', narrate: null, lang: 'es', onboarded: false,
  skipVersion: null, trios: [], mergePets: false, myPets: [], notPets: [], fpsWarned: false, excluded: [],
  notCompanions: [], companionSrc: {},
  raidMobs: {},
  companions: [],
  tts: { enabled: true, voice: null, rate: 1, volume: 1 },
  sound: { enabled: true, volume: 0.5 },
};

function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG(), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG(), JSON.stringify(cfg, null, 2)); } catch { /* disco lleno o permisos */ }
}

function loadTriggers() {
  try { return JSON.parse(fs.readFileSync(TRIGGERS(), 'utf8')); }
  catch { return null; }
}
function saveTriggers(defs) {
  try { fs.writeFileSync(TRIGGERS(), JSON.stringify(defs, null, 2)); } catch { /* permisos */ }
}

// El icono de electron-builder sólo aplica al instalador; en desarrollo hay
// que dárselo a cada BrowserWindow o Windows enseña el de Electron.
const ICON = (() => {
  // Empaquetado el icono va incrustado en el .exe; en desarrollo hay que
  // dárselo a la ventana. Si no está, Electron usa el suyo sin quejarse.
  const p1 = path.join(__dirname, '..', 'build', 'icon.ico');
  try { return fs.existsSync(p1) ? p1 : undefined; } catch { return undefined; }
})();

let cfg = { ...DEFAULTS };
let triggerDefs = [];
let mainWin = null;
let overlayWin = null;
let pushTimer = null;
let wiki = null;      // cliente de la wiki
let latest = null;    // { version, url } si hay una versión más nueva publicada
let migration = null; // { needed, from, fights } si el almacén es de una versión anterior

const REPO = 'infinityl111/eql-parse-spain';

/** Compara 1.2.10 con 1.3.0 sin traerse una librería para tres números. */
function newerThan(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

/**
 * Mira si hay versión nueva publicada. Sólo consulta y avisa: no descarga ni
 * instala nada. Con un ejecutable sin firmar, actualizar solo dispararía el
 * aviso de Windows cada vez, y es mejor que la descarga sea una decisión
 * consciente.
 */
async function checkUpdate() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'EQL-Parse', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return;
    const j = await r.json();
    const tag = j.tag_name ?? '';
    if (!tag || !newerThan(tag, app.getVersion())) { latest = null; return; }
    latest = { version: tag.replace(/^v/, ''), url: j.html_url };
    if (cfg.skipVersion !== latest.version) mainWin?.webContents.send('update', latest);
  } catch { /* sin red: se reintenta en la próxima comprobación */ }
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1180, height: 760, minWidth: 900, minHeight: 560,
    backgroundColor: '#12161E',
    title: 'EQL Parse',
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  // Cerrar la principal se lleva el overlay y termina la app. Sin esto el
  // overlay queda huérfano: sin barra de tareas, siempre encima y sin
  // recibir clics, es decir, imposible de cerrar.
  mainWin.on('closed', () => {
    mainWin = null;
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
    overlayWin = null;
    app.quit();
  });
}

function createOverlay() {
  if (overlayWin) { overlayWin.show(); return; }
  const b = cfg.overlayBounds ?? { x: 40, y: 40, width: 640, height: 420 };
  overlayWin = new BrowserWindow({
    ...b,
    frame: false, transparent: true, resizable: true, skipTaskbar: true, icon: ICON,
    alwaysOnTop: true, hasShadow: false,
    // Nunca recibe el foco. Antes lo tomaba al desactivar el modo atravesable,
    // y al pincharlo el juego dejaba de ser la ventana activa: EverQuest limita
    // los fotogramas en segundo plano, de ahí los tirones. Aquí no hay nada que
    // escribir, así que el foco no hace falta para nada.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  // 'screen-saver' mantiene la ventana por encima de juegos en modo ventana/borderless.
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile(path.join(__dirname, '..', 'ui', 'overlay.html'));
  applyClickThrough();
  const remember = () => { cfg.overlayBounds = overlayWin.getBounds(); saveConfig(cfg); };
  overlayWin.on('moved', remember);
  overlayWin.on('resized', remember);
  overlayWin.on('closed', () => { overlayWin = null; });
}

function applyClickThrough() {
  if (!overlayWin) return;
  overlayWin.setFocusable(false);          // por si algo lo hubiera revertido
  overlayWin.setIgnoreMouseEvents(cfg.clickThrough, { forward: true });
  send('overlay:state', { clickThrough: cfg.clickThrough });
}

function send(channel, payload) {
  for (const w of [mainWin, overlayWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function startPush() {
  clearInterval(pushTimer);
  let lastErr = null;
  let n = 0;
  pushTimer = setInterval(() => {
    if (!engine) return;
    try {
      engine.tick();
      const snap = engine.snapshot();
      mainWin?.webContents.send('snapshot', snap);
      // El overlay va a la mitad de ritmo: está encima del juego y cada
      // repintado suyo compite con los fotogramas de EQ. Medio segundo es de
      // sobra para unas cifras que se leen de reojo.
      if (++n % 2 === 0) overlayWin?.webContents.send('snapshot', snap);
      lastErr = null;
    } catch (err) {
      // Un fallo aquí solía matar el temporizador entero: la ventana y el
      // overlay se quedaban congelados con el último dato recibido.
      if (err.message !== lastErr) { lastErr = err.message; console.error('[snapshot]', err); }
    }
  }, 250);
}

async function boot() {
  // Sin esto Windows agrupa la ventana bajo "Electron" y usa su icono
  // en la barra de tareas, ignorando el de la ventana.
  if (process.platform === 'win32') app.setAppUserModelId('dev.miguelangelfernandez.eqlparse');

  const mod = await import('../src/engine.js');
  const trig = await import('../src/triggers.js');
  Engine = mod.Engine; findLog = mod.findLog;
  TriggerEngine = trig.TriggerEngine; STARTER_TRIGGERS = trig.STARTER_TRIGGERS;
  engine = new Engine();
  cfg = loadConfig();
  engine.setStorePath(app.getPath('userData'));

  // ¿El almacén lo escribió una versión anterior? Entonces sus cifras no
  // describen lo que pasó, y hay que decírselo al usuario dentro de la
  // aplicación: quien tenga la 1.0.7 instalada no va a leer las notas.
  // Un almacén vacío no tiene nada que corregir: se marca y en paz.
  migration = engine.store.migration();
  if (!migration.needed) engine.store.stamp();
  import('../src/wiki.js').then(({ WikiClient }) => { wiki = new WikiClient(app.getPath('userData')); });
  triggerDefs = loadTriggers() ?? STARTER_TRIGGERS;
  engine.triggers.load(triggerDefs);
  // Una pelea cerrada va al overlay por su propio canal y no en el snapshot:
  // ocupa demasiado para mandarla dos veces por segundo cuando sólo cambia al
  // terminar un combate.
  engine.on('encounter', (f) => {
    if (f && overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('fight:closed', f);
  });
  // Alguien ha hablado por el canal de grupo: esta en tu grupo.
  //
  // Se anade solo y se dice que ha sido automatico, en vez de preguntar. Un
  // cartel por cada companero que abre la boca seria peor que el problema: la
  // senal es fiable —cero falsos positivos sobre un registro real— y quitarlo
  // cuesta un clic, en su fila o en Ajustes. Lo que NO se hace es anadir en
  // silencio: la lista dice de donde salio cada uno.
  //
  // Si ya lo quitaste una vez, no vuelve. Sin `notCompanions`, quitarlo duraria
  // hasta que ese jugador dijera la siguiente frase.
  engine.on('groupmate', (name) => {
    if (!name) return;
    if ((cfg.companions ?? []).includes(name)) return;
    if ((cfg.notCompanions ?? []).includes(name)) return;
    if ((cfg.excluded ?? []).includes(name)) return;
    cfg.companions = [...(cfg.companions ?? []), name];
    cfg.companionSrc = { ...(cfg.companionSrc ?? {}), [name]: 'auto' };
    engine.setCompanions(cfg.companions);
    saveConfig(cfg);
    send('companions', {
      companions: cfg.companions, companionSrc: cfg.companionSrc,
      notCompanions: cfg.notCompanions ?? [], detected: name,
    });
  });
  // Sólo habla la ventana principal, para no oír el aviso dos veces.
  engine.on('alert', (a) => {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('alert', { ...a, speak: cfg.tts.enabled ? a.speak : null });
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('alert', { ...a, speak: null });
  });
  createMain();
  setTimeout(checkUpdate, 4000);            // sin retrasar el arranque
  setInterval(checkUpdate, 6 * 3600e3);
  startPush();

  if (cfg.classes?.length) engine.setClasses(cfg.classes);
  engine.setTrios(cfg.trios ?? []);
  engine.setCompanions(cfg.companions ?? []);
  if (cfg.narrate) engine.setNarrate(cfg.narrate);
  engine.setLang(cfg.lang ?? 'es');
  if (cfg.logPath && fs.existsSync(cfg.logPath)) {
    // Al arrancar se reanuda por donde iba; la relectura completa sólo ocurre
    // si la pides a mano, o sola la primera vez (lo decide engine.attach).
    engine.attach(cfg.logPath, { ...cfg, fromStart: false }).catch(() => {});
  }

  globalShortcut.register('Control+Alt+O', () => {
    cfg.clickThrough = !cfg.clickThrough;
    saveConfig(cfg);
    applyClickThrough();
  });
  globalShortcut.register('Control+Alt+M', () => {
    if (overlayWin?.isVisible()) overlayWin.hide(); else createOverlay();
  });
  // Salida de emergencia: cierra el overlay pase lo que pase.
  globalShortcut.register('Control+Alt+X', () => {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
    overlayWin = null;
  });
}

app.whenReady().then(boot);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => {
  engine?.saveStore(true);      // sin esto se perderían las peleas del final
  globalShortcut.unregisterAll();
});

// ─────────── IPC ───────────

ipcMain.handle('config:get', () => cfg);

ipcMain.handle('narrate:get', async () => {
  // Grupo a grupo, no plano: si no, cada casilla nueva sale desmarcada para
  // quien ya tenga configuración guardada. Ver mergeNarrate().
  const { mergeNarrate } = await import('../src/narrator.js');
  return mergeNarrate(cfg.narrate);
});

ipcMain.handle('narrate:set', (_e, n) => {
  cfg.narrate = n;
  saveConfig(cfg);
  engine.setNarrate(n);
  return cfg.narrate;
});

/**
 * «Esta mascota es mía» / «ya no». Una sola puerta, y persistente.
 *
 * Antes había DOS: ésta, que sólo se lo decía al analizador y se olvidaba al
 * cerrar, y `pets:names`, que sí guardaba pero no la llamaba nadie desde la
 * interfaz. El resultado era que marcar una mascota duraba la sesión, y que las
 * que había en la configuración de versiones anteriores no tenían forma de
 * quitarse: la única vía para borrarlas estaba huérfana.
 *
 * `notPets` no es sólo «quítala»: es «y no vuelvas a proponérmela». Por eso una
 * desmarcada se apunta ahí y no basta con sacarla de `myPets` — la detección la
 * volvería a añadir en la siguiente invocación con ese mismo nombre, que en EQL
 * se reciclan.
 */
ipcMain.handle('pet:mark', (_e, { name, on }) => {
  const my = new Set(cfg.myPets ?? []);
  const not = new Set(cfg.notPets ?? []);
  if (on) { my.add(name); not.delete(name); engine.markPet(name); }
  else { my.delete(name); not.add(name); engine.unmarkPet(name); }
  cfg.myPets = [...my];
  cfg.notPets = [...not];
  saveConfig(cfg);
  return { myPets: cfg.myPets, notPets: cfg.notPets };
});

ipcMain.handle('onboarding:set', (_e, v) => { cfg.onboarded = !!v; saveConfig(cfg); return cfg.onboarded; });

ipcMain.handle('lang:set', (_e, code) => {
  cfg.lang = code;
  saveConfig(cfg);
  engine.setLang(code);
  send('lang', code);
  return code;
});

ipcMain.handle('theme:set', (_e, t) => {
  cfg.theme = t === 'light' ? 'light' : 'dark';
  saveConfig(cfg);
  send('theme', cfg.theme);
  return cfg.theme;
});

ipcMain.handle('classes:set', (_e, list) => {
  cfg.classes = (list ?? []).filter(Boolean);
  saveConfig(cfg);
  engine.setClasses(cfg.classes);
  return cfg.classes;
});

/**
 * La tabla de tríos declarada a mano.
 *
 * Es la fuente de verdad de arriba: manda sobre el /who y sobre la inferencia
 * por hechizos, porque tú estabas allí y el log no. Cambiarla no reescribe el
 * histórico: hace falta una reconstrucción, y se dice al devolver.
 */
ipcMain.handle('trios:set', (_e, lista) => {
  cfg.trios = Array.isArray(lista) ? lista : [];
  saveConfig(cfg);
  return { trios: engine.setTrios(cfg.trios), needsRebuild: true };
});

/**
 * Dónde tu tabla y el log no dicen lo mismo.
 *
 * Lo manual manda sobre todo, y por eso hace falta esto: si te equivocas al
 * declarar un tramo no hay nada que te corrija. Se señala, no se decide.
 *
 * Se relee el log en vez de guardar los hitos porque al arrancar se reanuda
 * por donde iba, así que los /who de ayer no vuelven a pasar por el motor.
 * Son dos expresiones regulares sobre el fichero: es barato y siempre completo.
 */
ipcMain.handle('trios:conflicts', async () => {
  if (!cfg.trios?.length || !cfg.logPath || !fs.existsSync(cfg.logPath)) return [];
  const { normalizeTrios, conflicts } = await import('../src/trios.js');
  const { Parser } = await import('../src/parser.js');
  const self = cfg.self ?? path.basename(cfg.logPath).split('_')[1] ?? null;
  const p = new Parser({ self });
  const hitos = [];
  for (const l of fs.readFileSync(cfg.logPath, 'latin1').split(/\r?\n/)) {
    if (!/^\[.{24}\] \[\d+ /.test(l)) continue;      // sólo las líneas de /who
    const ev = p.parse(l);
    if (ev?.kind === 'who' && ev.who === self && ev.classes?.length) {
      hitos.push({ at: ev.t * 1000, level: ev.level, classes: ev.classes });
    }
  }
  return conflicts(normalizeTrios(cfg.trios), hitos);
});

ipcMain.handle('config:set', (_e, patch) => {
  cfg = { ...cfg, ...patch };
  saveConfig(cfg);
  return cfg;
});

ipcMain.handle('triggers:get', () => triggerDefs);

ipcMain.handle('triggers:save', (_e, defs) => {
  triggerDefs = defs;
  saveTriggers(defs);
  return engine.triggers.load(defs);   // devuelve errores de compilación
});

ipcMain.handle('triggers:defaults', () => STARTER_TRIGGERS);

ipcMain.handle('triggers:test', async (_e, { def, line }) => {
  const trig = await import('../src/triggers.js');
  return trig.TriggerEngine.tryOne(def, line);
});

ipcMain.handle('triggers:clearTimers', () => { engine.triggers.clearTimers(); return true; });

ipcMain.handle('triggers:import', async () => {
  const r = await dialog.showOpenDialog(mainWin, {
    title: 'Importar disparadores', properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('triggers:export', async () => {
  const r = await dialog.showSaveDialog(mainWin, {
    title: 'Exportar disparadores', defaultPath: 'disparadores-eql.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, JSON.stringify(triggerDefs, null, 2));
  return r.filePath;
});

ipcMain.handle('log:detect', async () => (findLog() ?? []).slice(0, 8));

ipcMain.handle('log:browse', async () => {
  const r = await dialog.showOpenDialog(mainWin, {
    title: 'Elige tu fichero de log',
    properties: ['openFile'],
    filters: [{ name: 'Log de EverQuest', extensions: ['txt'] }],
    defaultPath: cfg.logPath ? path.dirname(cfg.logPath) : undefined,
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('log:attach', async (_e, { logPath, self, fromStart, idleSec }) => {
  // `fromStart` es una ACCIÓN, no una preferencia, y por eso no se guarda.
  // Guardándola, marcar una vez «leer el registro entero» hacía que cada
  // arranque posterior releyera el log completo y volviera a añadir todas las
  // peleas al almacén, multiplicando el histórico en cada apertura.
  cfg = { ...cfg, logPath, self: self || null, fromStart: false, idleSec: idleSec ?? cfg.idleSec };
  saveConfig(cfg);
  try {
    return await engine.attach(logPath, { ...cfg, fromStart: !!fromStart });
  } catch (err) {
    return { status: 'error', error: err.message };
  }
});

ipcMain.handle('log:detach', () => { engine.detach(); return engine.describe(); });

ipcMain.handle('history:query', (_e, q) => engine.queryHistory(q ?? {}));
// `uid` (byte de inicio del registro), no el `id` de la pelea: el id se repite
// entre sesiones y devolvía la pelea equivocada.
ipcMain.handle('history:fight', (_e, uid) => engine.getFight(uid));
ipcMain.handle('history:aggregate', (_e, q) => engine.aggregate(q ?? {}));
ipcMain.handle('history:foes', (_e, sinceMs) => engine.foeList(sinceMs));
ipcMain.handle('history:stats', () => engine.storeStats());
// Catalogo de hechizos construido desde el historico, con los cooldowns medidos.
ipcMain.handle('catalog:spells', (_e, q) => engine.spellCatalog(q ?? {}));
ipcMain.handle('catalog:spell', (_e, { name, q }) => engine.spellDetail(name, q ?? {}));

ipcMain.handle('enc:zones', () => engine.encZones());
ipcMain.handle('enc:zoneFoes', (_e, { base, diff }) => engine.encZoneFoes(base, diff));
ipcMain.handle('enc:foe', (_e, name) => engine.encFoe(name));
ipcMain.handle('enc:foeAt', (_e, { name, diff }) => engine.encFoeAt(name, diff));
ipcMain.handle('enc:foes', () => engine.encFoes());
ipcMain.handle('enc:loot', () => engine.encLoot());
ipcMain.handle('enc:deaths', () => engine.encDeaths());
ipcMain.handle('enc:progress', () => engine.encProgress());
ipcMain.handle('enc:fights', (_e, q) => engine.encFights(q ?? {}));
ipcMain.handle('enc:counts', () => engine.encCounts());
ipcMain.handle('enc:status', () => engine.encStatus());
ipcMain.handle('enc:rebuild', () => engine.encRebuild());

ipcMain.handle('session:reset', () => {
  const r = engine.resetSession();
  // El reset puede venir del overlay o de la ventana principal: se avisa a las
  // dos, o la que no lo pidió se queda con la pila de combates de antes.
  send('session:cleared', null);
  return r;
});

// Un overlay que se abre a mitad de sesión arranca con lo que ya hay apilado:
// si no, no enseñaría nada hasta que terminase el siguiente combate.
ipcMain.handle('overlay:fights', () => engine?.closedFights ?? []);

ipcMain.handle('overlay:open', () => { createOverlay(); return true; });
ipcMain.handle('overlay:close', () => { overlayWin?.close(); return true; });
// Con click-through activo ningún botón del overlay recibe clics. El renderer
// avisa al entrar/salir de la barra superior para devolver el ratón un momento.
ipcMain.handle('overlay:hover', (_e, over) => {
  if (!overlayWin || overlayWin.isDestroyed() || !cfg.clickThrough) return false;
  overlayWin.setIgnoreMouseEvents(!over, { forward: true });
  return true;
});

ipcMain.handle('overlay:toggleClickThrough', () => {
  cfg.clickThrough = !cfg.clickThrough;
  saveConfig(cfg);
  applyClickThrough();
  return cfg.clickThrough;
});

ipcMain.handle('encounter:export', async (_e, enc) => {
  const r = await dialog.showSaveDialog(mainWin, {
    title: 'Guardar pelea',
    defaultPath: `pelea-${enc.id}-${enc.kills[0] ?? 'sin-kill'}.json`.replace(/[\\/:*?"<>|]/g, '-'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, JSON.stringify(enc, null, 2));
  return r.filePath;
});

// Sólo se abre la wiki de EQL: no se acepta cualquier URL que llegue por IPC.
// Ficha del objeto. Devuelve null si la wiki no lo tiene o no hay red.
ipcMain.handle('pet:dismiss', (_e, n) => engine.dismissPet(n));

ipcMain.handle('cfg:flag', (_e, { key, value }) => { cfg[key] = value; saveConfig(cfg); return true; });

// Aquí vivía `pets:names`, que hacía exactamente esto mismo pero sin avisar al
// analizador y sin que lo llamara nadie. Dos puertas para la misma decisión son
// dos sitios donde puede quedarse a medias: la que queda es `pet:mark`.

// Combatientes que has dicho que no son tuyos. Se aplica al MOSTRAR, no al
// guardar: vale para todo el historico sin reconstruir y se puede deshacer.
ipcMain.handle('excluded:set', (_e, { name, on }) => {
  const s = new Set(cfg.excluded ?? []);
  if (on) s.add(name); else s.delete(name);
  cfg.excluded = [...s];
  // Las dos listas dicen lo contrario la una de la otra: nadie puede estar en
  // ambas, o una fila seria a la vez «no es de los mios» y «es mi compañero».
  if (on) cfg.companions = (cfg.companions ?? []).filter((x) => x !== name);
  engine?.setCompanions(cfg.companions ?? []);
  saveConfig(cfg);
  return { excluded: cfg.excluded, companions: cfg.companions ?? [] };
});

// Compañeros de grupo: declarados por ti o detectados por el canal de grupo.
//
// Aqui ponia que «el log de EQL no da ninguna senal de grupo — se busco y no
// hay». Era FALSO: quien habla por el canal `group` esta en tu grupo, y esas
// lineas ya se analizaban para leerlas en voz alta. Medido sobre un registro
// real, los emisores de ese canal son exactamente los companeros declarados a
// mano, sin un solo falso positivo. El de gremio no vale: un companero de
// gremio no esta en tu grupo.
//
// Como las exclusiones, se aplican al MOSTRAR y se recuerdan entre sesiones.
//
// `companionSrc` guarda de donde salio cada uno —'auto' o 'manual'— y se
// ensena, igual que con las clases: no es lo mismo lo que has dicho tu que lo
// que se ha deducido. Declarar a mano uno detectado lo asciende a 'manual', que
// es lo correcto: tu palabra es mas firme que una deduccion.
//
// `notCompanions` es «lo he quitado, no me lo vuelvas a proponer». Sin ella, la
// deteccion volveria a anadirlo en cuanto ese jugador hablase otra vez, y
// quitarlo no seria quitarlo.
ipcMain.handle('companions:set', (_e, { name, on, src = 'manual' }) => {
  const s = new Set(cfg.companions ?? []);
  const no = new Set(cfg.notCompanions ?? []);
  const fuentes = { ...(cfg.companionSrc ?? {}) };
  if (on) {
    s.add(name);
    no.delete(name);
    // Lo detectado no pisa una declaracion tuya; lo tuyo si asciende lo detectado.
    if (src === 'manual' || !fuentes[name]) fuentes[name] = src;
  } else {
    s.delete(name);
    delete fuentes[name];
    no.add(name);
  }
  cfg.companions = [...s];
  cfg.notCompanions = [...no];
  cfg.companionSrc = fuentes;
  if (on) cfg.excluded = (cfg.excluded ?? []).filter((x) => x !== name);
  engine?.setCompanions(cfg.companions);
  saveConfig(cfg);
  return {
    companions: cfg.companions, excluded: cfg.excluded ?? [],
    companionSrc: cfg.companionSrc, notCompanions: cfg.notCompanions,
  };
});

// «Esa mascota es de aquel», a mano. Dura la sesion, como el /pet who leader:
// los nombres se reciclan entre jugadores y la frase solo vale mientras esa
// mascota este invocada.
ipcMain.handle('pet:owner', (_e, { pet, owner }) => engine.assignPetOwner(pet, owner));

ipcMain.handle('pets:merge', (_e, v) => { cfg.mergePets = !!v; saveConfig(cfg); return cfg.mergePets; });

// ── Migración del almacén ───────────────────────────────────────────────
ipcMain.handle('store:migration', () => migration);

/**
 * Reconstruye el histórico desde el log, con el motor parado.
 *
 * Hay que soltar el lector antes: si sigue leyendo mientras se apartan los
 * ficheros, la pelea en curso se guardaría en el almacén que acabamos de
 * mover. Al terminar se vuelve a enganchar donde estaba.
 */
ipcMain.handle('store:rebuild', async () => {
  const dir = app.getPath('userData');
  const logPath = cfg.logPath;
  if (!logPath || !fs.existsSync(logPath)) return { ok: false, reason: 'sin-log' };
  const { rebuildStore } = await import('../src/rebuild.js');
  const eraTicking = !!pushTimer;
  clearInterval(pushTimer); pushTimer = null;    // nada de snapshots a medias
  engine.detach();
  let r;
  try {
    r = await rebuildStore({
      dir, logPath, self: cfg.self, idleSec: cfg.idleSec ?? 20,
      trios: cfg.trios ?? [], companions: cfg.companions ?? [],
    });
  } catch (err) {
    r = { ok: false, reason: 'error-de-lectura', error: err.message };
  }
  // Pase lo que pase, la aplicación vuelve a funcionar.
  try {
    engine.setStorePath(dir);
    await engine.attach(logPath, { ...cfg, fromStart: false });
  } catch { /* el usuario puede reconectar a mano desde Cambiar log */ }
  if (eraTicking) startPush();
  if (r.ok) migration = { needed: false, from: r.version, fights: r.peleasDespues, current: r.version };
  return r;
});

ipcMain.handle('update:get', () => (cfg.skipVersion === latest?.version ? null : latest));
ipcMain.handle('update:open', () => { if (latest) shell.openExternal(latest.url); return true; });
ipcMain.handle('update:skip', (_e, v) => { cfg.skipVersion = v; saveConfig(cfg); return true; });
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('wiki:spellIcons', async (_e, names) => {
  if (!wiki || !Array.isArray(names)) return [];
  // Se devuelve como pares y no como Map: el puente los serializa igual, pero
  // una lista se lee sin sorpresas al otro lado.
  try { return [...(await wiki.spellIcons(names))]; } catch { return []; }
});

ipcMain.handle('wiki:foePortraits', async (_e, names) => {
  if (!wiki || !Array.isArray(names)) return [];
  try { return [...(await wiki.foePortraits(names))]; } catch { return []; }
});

ipcMain.handle('wiki:item', async (_e, name) => {
  if (!wiki) return null;
  try { return await wiki.item(name); } catch { return null; }
});

ipcMain.handle('wiki:mob', async (_e, name) => {
  if (!wiki) return null;
  try { return await wiki.mob(name); } catch { return null; }
});

/**
 * Quien es jefe y de donde se sabe.
 *
 * Se piden en lote: una ficha de zona tiene veinte enemigos y veinte viajes por
 * el puente para una etiqueta serian veinte repintados. La wiki los cachea, asi
 * que a partir de la segunda vez esto no toca la red.
 */
ipcMain.handle('raid:flags', async (_e, nombres) => {
  const out = {};
  const lista = [...new Set(nombres ?? [])].filter(Boolean);
  await Promise.all(lista.map(async (n) => {
    let w = null;
    try { w = wiki ? await wiki.classify(n) : null; } catch { w = null; }
    out[n] = {
      wiki: w?.found ? { raid: !!w.raid, named: !!w.named } : null,
      manual: (cfg.raidMobs ?? {})[n] ?? null,
    };
  }));
  return out;
});

// «Esto es un jefe» / «no lo es», dicho a mano. Manda sobre la wiki, que es lo
// acordado: la wiki declara, la heuristica deduce y tu corriges. `null` borra
// tu marca y devuelve la palabra a la wiki.
ipcMain.handle('raid:set', (_e, { name, value }) => {
  const m = { ...(cfg.raidMobs ?? {}) };
  if (value === null || value === undefined) delete m[name];
  else m[name] = !!value;
  cfg.raidMobs = m;
  saveConfig(cfg);
  return cfg.raidMobs;
});

ipcMain.handle('shell:wiki', (_e, item) => {
  const name = String(item ?? '').trim();
  if (!name) return false;
  const q = encodeURIComponent(name.replace(/\s*\+\d+$/, ''));   // el "+2" no existe en la wiki
  shell.openExternal(`https://eqlwiki.com/index.php?search=${q}&go=Go`);
  return true;
});

ipcMain.handle('shell:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });
