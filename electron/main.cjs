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

function createMain() {
  mainWin = new BrowserWindow({
    width: 1180, height: 760, minWidth: 900, minHeight: 560,
    backgroundColor: '#12161E',
    title: 'EQL Parse <SPAIN> Guild (World Champion Again)',
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
    alwaysOnTop: true, hasShadow: false, focusable: !cfg.clickThrough,
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
  pushTimer = setInterval(() => {
    if (!engine) return;
    try {
      engine.tick();
      send('snapshot', engine.snapshot());
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
  triggerDefs = loadTriggers() ?? STARTER_TRIGGERS;
  engine.triggers.load(triggerDefs);
  // Sólo habla la ventana principal, para no oír el aviso dos veces.
  engine.on('alert', (a) => {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('alert', { ...a, speak: cfg.tts.enabled ? a.speak : null });
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('alert', { ...a, speak: null });
  });
  createMain();
  startPush();

  if (cfg.classes?.length) engine.setClasses(cfg.classes);
  if (cfg.narrate) engine.setNarrate(cfg.narrate);
  engine.setLang(cfg.lang ?? 'es');
  if (cfg.logPath && fs.existsSync(cfg.logPath)) {
    engine.attach(cfg.logPath, cfg).catch(() => {});
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
  const { DEFAULT_NARRATE } = await import('../src/narrator.js');
  return { ...DEFAULT_NARRATE, ...(cfg.narrate ?? {}) };
});

ipcMain.handle('narrate:set', (_e, n) => {
  cfg.narrate = n;
  saveConfig(cfg);
  engine.setNarrate(n);
  return cfg.narrate;
});

ipcMain.handle('pet:mark', (_e, { name, on }) => {
  if (on) engine.markPet(name); else engine.unmarkPet(name);
  return true;
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
  cfg = { ...cfg, logPath, self: self || null, fromStart: !!fromStart, idleSec: idleSec ?? cfg.idleSec };
  saveConfig(cfg);
  try {
    return await engine.attach(logPath, cfg);
  } catch (err) {
    return { status: 'error', error: err.message };
  }
});

ipcMain.handle('log:detach', () => { engine.detach(); return engine.describe(); });

ipcMain.handle('history:query', (_e, q) => engine.queryHistory(q ?? {}));
ipcMain.handle('history:fight', (_e, id) => engine.getFight(id));
ipcMain.handle('history:foes', (_e, sinceMs) => engine.foeList(sinceMs));
ipcMain.handle('history:stats', () => engine.storeStats());

ipcMain.handle('session:reset', () => engine.resetSession());

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

ipcMain.handle('shell:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });
