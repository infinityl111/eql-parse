import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { LogTailer } from './tailer.js';
import { Parser } from './parser.js';
import { EncounterTracker } from './encounter.js';
import { TriggerEngine } from './triggers.js';
import { advise, liveAdvice } from './advisor.js';
import { Narrator } from './narrator.js';
import { setLang } from './i18n.js';
import { FightStore } from './store.js';
import { aggregate } from './aggregate.js';
import { inferClasses, availableFor, normStance, normInvocation, STANCES, INVOCATIONS } from './stances.js';

/**
 * Dónde buscar el log.
 *
 * La ruta cambia por completo entre instalaciones, así que se recorren todas
 * las unidades con una lista de subrutas probables. No se escanea el disco
 * entero: sería lento y molesto. Si aun así no aparece, está el botón de
 * buscar el fichero a mano.
 */
const SUBPATHS = [
  'EVERQUEST LEGENDS\\Logs',
  'EverQuest Legends\\Logs',
  'Games\\EverQuest Legends\\Logs',
  'Program Files\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'Program Files (x86)\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
  'SteamLibrary\\steamapps\\common\\EverQuest Legends\\Logs',
  'Steam\\steamapps\\common\\EverQuest Legends\\Logs',
];

function drives() {
  if (process.platform !== 'win32') return ['/'];
  const out = [];
  for (let i = 67; i <= 90; i++) {           // C: hasta Z:
    const d = `${String.fromCharCode(i)}:\\`;
    try { fs.accessSync(d); out.push(d); } catch { /* unidad ausente */ }
  }
  return out;
}

/** Carpetas candidatas: subrutas conocidas más lo que haya en la raíz. */
function candidateDirs() {
  const dirs = [];
  for (const d of drives()) {
    for (const sub of SUBPATHS) dirs.push(path.join(d, sub));
    // Un vistazo a la raíz por si la carpeta se llama de otra forma.
    try {
      for (const name of fs.readdirSync(d)) {
        if (/everquest.*legend/i.test(name)) dirs.push(path.join(d, name, 'Logs'));
      }
    } catch { /* sin permisos de lectura en la raíz */ }
  }
  return dirs;
}

/** Busca el eqlog_*.txt modificado más recientemente. */
export function findLog(extraDirs = []) {
  const found = [];
  const seen = new Set();
  for (const dir of [...extraDirs, ...candidateDirs()]) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!/^eqlog_.+\.txt$/i.test(f)) continue;
        const full = path.join(dir, f);
        found.push({ path: full, mtime: fs.statSync(full).mtimeMs });
      }
    } catch { /* carpeta inexistente, siguiente */ }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found;
}

/** eqlog_Campeon_erudin.txt -> { character: 'Campeon', server: 'erudin' } */
export function parseLogName(p) {
  const m = /^eqlog_([^_]+)_(.+)\.txt$/i.exec(path.basename(p));
  return m ? { character: m[1], server: m[2] } : { character: null, server: null };
}

export class Engine extends EventEmitter {
  constructor() {
    super();
    this.tailer = null;
    this.parser = null;
    this.tracker = null;
    this.seq = 0;
    this.path = null;
    this.self = null;
    this.server = null;
    this.status = 'idle';   // idle | reading | monitoring | missing | error
    this.error = null;
    this.classes = null;        // manual; si no, se deduce del log
    this.seenStances = new Set();
    this.seenInvocations = new Set();
    this.whoClasses = null;
    this.whoAt = 0;
    this.level = null;
    this.classConflict = null;
    this.backfilling = false;
    this.lastKill = null;
    // DPS con sentido: por enemigo abatido, desde el primer golpe hasta que cae.
    this.killAgg = new Map();   // nombre -> {damage, seconds, kills}
    this.recentHits = [];       // {t, name, amount} de los últimos 20 s
    this.storePath = null;      // fichero de peleas guardadas
    this.store = null;
    this.history = [];          // peleas cerradas, la más reciente primero
    this.saveTimer = null;
    this.foes = new Set();
    this.recent = [];           // daño recibido reciente, para el consejo en vivo
    this.windowSec = 20;
    // Los disparadores viven fuera del ciclo de attach: sobreviven
    // a un cambio de log y siguen activos aunque no haya combate.
    this.triggers = new TriggerEngine();
    this.triggers.on('alert', (a) => this.emit('alert', a));
    // El narrador vive fuera del attach, como los disparadores.
    this.narrator = new Narrator();
    this.narrator.on('say', (a) => this.emit('alert', a));
  }

  attach(logPath, opts = {}) {
    this.detach();
    const { character, server } = parseLogName(logPath);
    this.path = logPath;
    this.self = opts.self || character;
    this.server = server;
    this.seq = 0;
    this.error = null;

    this.parser = new Parser({ self: this.self });
    this.narrator.setSelf(this.self);
    this.narrator.setPets([]);
    this.tracker = new EncounterTracker({
      self: this.self,
      idleSec: opts.idleSec ?? 20,
      closeOnDeath: opts.closeOnDeath ?? false,
    });
    this.tracker.on('close', (enc) => {
      const f = this.#enc(enc);
      this.narrator.fightEnd(f);
      if (f && (f.total > 0 || f.enemyTotal > 0)) {
        const sum = this.store?.append(f, Date.now()) ?? f;
        this.history.unshift(sum);
        if (this.history.length > 60) this.history.length = 60;
        this.saveStore();
      }
      this.emit('encounter');
    });
    this.tracker.on('open', () => { this.foes.clear(); this.narrator.fightStart(); });
    // Acumulador de sesión: mismos eventos, pero no se cierra nunca. Es lo que
    // ve el overlay, que sólo se pone a cero cuando tú lo pides.
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });

    // Se recupera lo guardado de ESTE log y se reanuda por donde iba, así que
    // sólo se relee lo que se escribió mientras la aplicación estaba cerrada.
    this.history = this.store ? this.store.filter({ limit: 60 }) : [];
    let resume = opts.fromStart ? null : this.#resumeOffset(logPath);

    // Primera vez con este log: sin nada guardado y sin punto de reanudación,
    // se lee entero aunque no lo pidas. Depender de una casilla para algo que
    // sólo tiene una respuesta razonable es pedirle al usuario que adivine.
    // Basta con que el almacén esté vacío: si quedó un punto de reanudación
    // de una sesión anterior pero no hay peleas guardadas, seguir desde ahí
    // dejaría el histórico vacío para siempre.
    const firstTime = !opts.fromStart && (this.store?.index.length ?? 0) === 0;
    if (firstTime) { opts = { ...opts, fromStart: true }; resume = null; }
    this.autoFullRead = firstTime;

    this.tailer = new LogTailer(logPath, { pollMs: 100, fromStart: !!opts.fromStart, startOffset: resume });
    this.tailer.on('line', (l) => {
      const ev = this.parser.parse(l, this.seq++);
      if (!ev) return;
      if (ev.kind === 'pet_claim' || ev.kind === 'pet_leader' || ev.kind === 'pet_order') {
        this.narrator.setPets([...this.parser.pets.keys()]);
        if (this.tracker) this.tracker.petNames = new Set(this.parser.pets.keys());
      }
      if (ev.kind === 'stance' && ev.stance) this.seenStances.add(ev.stance);
      if (ev.kind === 'invocation' && ev.invocation) this.seenInvocations.add(ev.invocation);
      // El /who de tu propio personaje es la única fuente que no admite dudas.
      if (ev.kind === 'who' && ev.who === (this.self ?? 'You') && ev.classes?.length) {
        const changed = this.whoClasses && this.whoClasses.join() !== ev.classes.join();
        this.whoClasses = ev.classes;
        this.whoAt = ev.t;
        this.level = ev.level;
        // Un /who nuevo es la verdad: se descarta lo anterior y lo observado.
        if (changed || this.classes?.length) {
          this.classes = null;
          this.seenStances.clear();
          this.seenInvocations.clear();
        }
        this.classConflict = null;
      }
      if (ev.kind === 'class_change') this.classConflict = { reason: 'message', raw: ev.raw };
      if (ev.kind === 'stance' && ev.stance) this.#checkConflict('stance', ev.stance);
      if (ev.kind === 'invocation' && ev.invocation) this.#checkConflict('invocation', ev.invocation);
      // Golpes recientes de todo el mundo, para el DPS de los últimos segundos.
      if (ev.amount > 0 && ev.source && !this.backfilling) {
        this.recentHits.push({ t: ev.t, name: ev.source, amount: ev.amount });
        const cut = ev.t - 20;
        while (this.recentHits.length && this.recentHits[0].t < cut) this.recentHits.shift();
      }

      // Ventana móvil: sólo daño que TE entra, en bruto.
      if (ev.amount && ev.target === (this.self ?? 'You')) {
        this.recent.push({ t: ev.t, school: ev.school, raw: ev.rawAmount ?? ev.amount });
        const cut = ev.t - this.windowSec;
        while (this.recent.length && this.recent[0].t < cut) this.recent.shift();
      }
      this.tracker.feed(ev);
      this.session?.feed(ev);
      if (ev.kind === 'death' && ev.victim && !this.backfilling) this.#makeKillCard(ev);
      // Durante la lectura del histórico no se habla ni se disparan avisos: son
      // sucesos de hace horas. La guarda anterior miraba el estado, que pasaba
      // a "monitorizando" en el primer volcado, a mitad de la lectura.
      this.narrator.feed(ev);
      if (ev.amount && ev.source && ev.source !== (this.self ?? 'You') && ev.target === (this.self ?? 'You')) {
        this.narrator.add(ev.source);
      }
      // Enemigo = a quien pegas tú o tu mascota. Es el filtro que evita
      // que los hechizos de tus compañeros de grupo se anuncien.
      if (ev.amount && ev.target && (ev.source === (this.self ?? 'You') || this.parser.pets.has(ev.source))) {
        this.foes.add(ev.target);
        this.narrator.setFoes([...this.foes]);
      }
      // ev.raw es la línea sin la marca de tiempo, la reconozca el parser o no.
      if (!this.backfilling) this.triggers.match(ev.raw, ev.t);
    });
    this.tailer.on('waiting', () => { this.status = 'missing'; });
    this.tailer.on('flush', () => { this.status = 'monitoring'; });
    this.tailer.on('error', (e) => { this.status = 'error'; this.error = e.message; });

    this.status = opts.fromStart ? 'reading' : 'monitoring';
    this.backfilling = true;
    this.narrator.setMuted(true);
    // El precargado va ANTES de arrancar el lector: si no, las primeras líneas
    // nuevas crean peleas antes de que sepamos la zona, la postura o la mascota.
    return Promise.resolve(opts.fromStart ? 0 : this.#primeFromTail(logPath))
      .then(() => this.tailer.start())
      .then(() => {
        // start() no resuelve hasta que ha leído todo lo pendiente, así que
        // aquí el histórico ya está procesado y lo que llegue es de ahora.
        this.backfilling = false;
        this.narrator.setMuted(false);
        this.status = 'monitoring';
        return this.describe();
      });
  }

  /**
   * Al conectar, leer los últimos KB del fichero para recuperar el contexto:
   * tu /who, la zona, la postura activa y las mascotas.
   *
   * No se alimenta al agregador ni al narrador: sólo se actualiza el estado
   * del parser. Si se metiera en el agregador aparecerían peleas viejas como
   * si acabaran de pasar, y el narrador leería en voz alta chat de hace media
   * hora.
   */
  async #primeFromTail(logPath, bytes = 512 * 1024) {
    const before = { parsed: this.parser.parsed, unknown: this.parser.unrecognized };
    try {
      const st = await fsp.stat(logPath);
      const from = Math.max(0, st.size - bytes);
      const fh = await fsp.open(logPath, 'r');
      const buf = Buffer.allocUnsafe(st.size - from);
      await fh.read(buf, 0, buf.length, from);
      await fh.close();
      const lines = buf.toString('latin1').split(/\r?\n/);
      if (from > 0) lines.shift();          // la primera vendrá cortada
      let n = 0;
      for (const line of lines) {
        if (!line) continue;
        const ev = this.parser.parse(line, 0);
        if (!ev) continue;
        n++;
        if (ev.kind === 'who' && ev.who === (this.self ?? 'You') && ev.classes?.length) {
          this.whoClasses = ev.classes;
          this.whoAt = ev.t;
          this.level = ev.level;
        }
        if (ev.kind === 'stance' && ev.stance) this.seenStances.add(ev.stance);
        if (ev.kind === 'invocation' && ev.invocation) this.seenInvocations.add(ev.invocation);
      }
      // El precargado no debe contar como lectura en vivo, pero tampoco puede
      // borrar lo que ya se hubiera leído del fichero al reanudar.
      this.parser.parsed = before.parsed;
      this.parser.unrecognized = before.unknown;
      this.narrator.setPets([...this.parser.pets.keys()]);
      // El agregador tiene su propia zona y no se entera del precargado: sin
      // esto, las peleas de la sesión nacen sin zona hasta el siguiente cambio.
      if (this.parser.zone) {
        if (this.tracker) this.tracker.zone = this.parser.zone;
        if (this.session) this.session.zone = this.parser.zone;
      }
      return n;
    } catch { return 0; }
  }

  detach() {
    this.narrator?.setMuted(false);
    this.tailer?.stop();
    this.tailer = null;
    this.status = 'idle';
  }

  describe() {
    return {
      path: this.path, self: this.self, server: this.server,
      status: this.status, error: this.error,
      zone: this.parser?.zone ?? null,
      stance: this.parser?.stance ?? null,
      invocation: this.parser?.invocation ?? null,
    };
  }

  /** Cierra peleas por inactividad y avanza los temporizadores. */
  tick() {
    this.tracker?.tick(Date.now() / 1000);
    return this.triggers.tick();
  }

  #b(list) { return list.map(([k, v]) => ({ name: k, sum: v.sum, n: v.n, max: v.max, min: v.min === Infinity ? 0 : v.min, crits: v.crits, school: v.school, type: v.type })); }

  #row(r) {
    return {
      name: r.name,
      damage: r.damage, dps: r.dps, dpsOwn: r.dpsOwn, dpsActive: r.dpsActive, share: r.share,
      hits: r.hits, meleeHits: r.meleeHits, misses: r.misses,
      crits: r.crits, critDamage: r.critDamage, critRate: r.critRate,
      flurries: r.flurries, ripostes: r.ripostes, healPotential: r.healPotential,
      max: r.max, min: r.min, accuracy: r.accuracy, avoidance: r.avoidance,
      taken: r.taken, swingsAgainst: r.swingsAgainst, deaths: r.deaths,
      healingDone: r.healingDone, healingTaken: r.healingTaken,
      activeSec: r.activeSec, hitSec: r.hitSec, ownSec: r.ownSec,
      types: r.byType.map(([k, v]) => [k, v.sum]),
      abilities: this.#b(r.byAbility),
      targets: this.#b(r.byTarget),
      schools: this.#b(r.bySchool),
      stances: this.#b(r.byStance),
      invocations: this.#b(r.byInvocation),
      missReasons: r.missReasons.map(([k, v]) => [k, v.n]),
      defense: r.defense.map(([k, v]) => [k, v.n]),
      takenByType: this.#b(r.takenByType),
      rawTakenByType: this.#b(r.rawTakenByType), rawMeleeOut: r.rawMeleeOut,
      takenBySource: this.#b(r.takenBySource),
      healBySpell: this.#b(r.healBySpell),
      healByTarget: this.#b(r.healByTarget),
    };
  }

  /**
   * Quién es enemigo y quién de los tuyos.
   *
   * Enemigo = te ha pegado a ti o a tu mascota, o tú o tu mascota le habéis
   * pegado. Sin esta separación el "dps del grupo" sumaba los dos bandos y los
   * porcentajes repartían entre atacantes y atacados a la vez.
   */
  #sides(rows, me, petSet) {
    const foes = new Set();
    const ours = new Set([me, ...petSet]);
    for (const r of rows) {
      const hitsUs = (r.byTarget ?? []).some(([n]) => ours.has(n));
      if (hitsUs && !ours.has(r.name)) foes.add(r.name);
    }
    for (const r of rows) {
      if (!ours.has(r.name)) continue;
      for (const [n] of r.byTarget ?? []) if (!ours.has(n)) foes.add(n);
    }
    return foes;
  }

  #enc(enc) {
    if (!enc) return null;
    const t = enc.totals();
    const me = this.self ?? 'You';
    const petSet = new Set(this.parser?.pets.keys() ?? []);
    const foeSet = this.#sides(t.rows, me, petSet);
    const allyRows = t.rows.filter((r) => !foeSet.has(r.name));
    const foeRows = t.rows.filter((r) => foeSet.has(r.name));
    const allyTotal = allyRows.reduce((a, r) => a + r.damage, 0);
    const foeTotal = foeRows.reduce((a, r) => a + r.damage, 0);
    return {
      id: enc.id,
      zone: enc.zone,
      duration: t.duration,
      healing: t.healing,
      // Matar a un enemigo y perder a un tuyo son cosas distintas: si se
      // mezclan, una pelea donde caíste dos veces se titula "Campeon ×2".
      dead: Object.fromEntries(enc.deadAt ?? new Map()),
      loot: (enc.loot ?? []).slice(0, 200),
      kills: enc.kills.filter((k) => k.victim !== me && !petSet.has(k.victim)).map((k) => k.victim),
      // Los totales del grupo son sólo de los tuyos; el enemigo va aparte.
      total: allyTotal,
      raidDps: allyTotal / t.duration,
      enemyTotal: foeTotal,
      enemyDps: foeTotal / t.duration,
      losses: enc.kills.filter((k) => k.victim === me || petSet.has(k.victim)).map((k) => k.victim),
      series: [...(enc.series ?? new Map()).values()].sort((a, b) => a.s - b.s),
      stanceSpans: (enc.stanceSpans ?? []).map((x, i, arr) => ({
        ...x, to: i === arr.length - 1 ? Math.max(x.to, enc.end - enc.start) : x.to,
      })),
      label: (() => {
        // Nombre de la pelea: el enemigo abatido, nunca los tuyos.
        const foesDown = enc.kills.filter((k) => k.victim !== me && !petSet.has(k.victim));
        if (foesDown.length) {
          const c = {};
          for (const k of foesDown) c[k.victim] = (c[k.victim] ?? 0) + 1;
          return Object.entries(c).map(([n, x]) => (x > 1 ? `${n} ×${x}` : n)).join(', ');
        }
        const foes = [...enc.targetTotals].filter(([n]) => n !== (this.self ?? 'You'));
        foes.sort((a, b) => b[1] - a[1]);
        return foes.length ? foes[0][0] : null;
      })(),

      resistsSuffered: enc.resistsSuffered,
      casts: (enc.casts ?? []).slice(0, 300),
      resistsCaused: enc.resistsCaused,
      interrupts: enc.interrupts,
      closed: enc.closed,
      start: enc.start,
      rows: t.rows.map((r) => {
        const enemy = foeSet.has(r.name);
        const base = enemy ? foeTotal : allyTotal;
        return { ...this.#row(r), side: enemy ? 'enemy' : 'ally', share: base ? r.damage / base : 0 };
      }),
    };
  }

  /**
   * ¿Has usado algo que tu combinación no tiene? Entonces cambiaste de clase.
   * Es la única señal que no depende de que nadie escriba ningún comando.
   */
  #checkConflict(kind, name) {
    const cs = this.activeClasses;
    if (!cs.length) return;
    const key = kind === 'stance' ? normStance(name) : normInvocation(name);
    const table = kind === 'stance' ? STANCES : INVOCATIONS;
    const def = table[key];
    if (!def) return;                                  // no lo conocemos, no opinamos
    if (def.classes.some((c) => cs.includes(c))) return;
    this.classConflict = { reason: kind, name: def.label ?? name, classes: cs };
  }

  /** Clases: las que hayas fijado, o las deducidas de las posturas vistas. */
  get activeClasses() {
    // El /who es lo que dice el juego ahora mismo: manda sobre lo que fijaste
    // a mano hace horas, porque en EQL las clases se pueden cambiar.
    if (this.whoClasses?.length) return this.whoClasses;
    if (this.classes?.length) return this.classes;
    return inferClasses([...this.seenStances], [...this.seenInvocations]).classes;
  }

  /** De dónde salen las clases, para que la interfaz lo diga sin engañar. */
  get classSource() {
    if (this.whoClasses?.length) return 'who';
    if (this.classes?.length) return 'manual';
    const r = inferClasses([...this.seenStances], [...this.seenInvocations]);
    return r.classes.length ? (r.confident ? 'deducidas' : 'parciales') : 'desconocidas';
  }

  setClasses(list) {
    this.classes = (list ?? []).filter(Boolean);
    // Fijarlas a mano zanja el aviso y descarta el /who anterior.
    this.whoClasses = null;
    this.classConflict = null;
    this.seenStances.clear();
    this.seenInvocations.clear();
  }

  #advice(enc) {
    // El histórico son resúmenes sin filas: sólo se aconseja sobre una pelea
    // completa. Sin esta guarda el snapshot entero fallaba al no haber combate.
    if (!enc?.rows) return null;
    const me = this.self ?? 'You';
    const row = enc.rows.find((r) => r.name === me);
    if (!row) return null;
    return advise(row, {
      classes: this.activeClasses,
      stance: this.parser?.stance,
      invocation: this.parser?.invocation,
      resistsSuffered: enc.resistsSuffered,
      casts: enc.casts.slice(0, 300),
      resistsCaused: enc.resistsCaused,
      interrupts: enc.interrupts,
    });
  }

  /** Consejo en vivo sobre los últimos segundos, no sobre la pelea entera. */
  #live() {
    const now = this.tracker?.current?.end ?? (Date.now() / 1000);
    const cut = now - this.windowSec;
    const win = this.recent.filter((r) => r.t >= cut);
    if (!win.length) return null;
    let melee = 0, spell = 0;
    for (const r of win) (r.school === 'melee' ? (melee += r.raw) : (spell += r.raw));
    const total = melee + spell;
    return liveAdvice({ melee, spell, total, seconds: this.windowSec },
      { classes: this.activeClasses, stance: this.parser?.stance });
  }

  setNarrate(cfg) { this.narrator.setConfig(cfg); }

  /** Dónde se guardan las peleas. Lo fija el proceso principal. */
  setStorePath(dir) {
    this.store = new FightStore(dir);
    const n = this.store.load();
    this.history = this.store.filter({ limit: 60 });
    return n;
  }

  /** Guarda el punto de lectura para reanudar en la próxima sesión. */
  saveStore(now = false) {
    if (!this.store || !this.path) return;
    try {
      fs.mkdirSync(this.store.dir, { recursive: true });
      fs.writeFileSync(path.join(this.store.dir, 'resume.json'), JSON.stringify({
        [this.path]: { offset: this.tailer?.offset ?? null, self: this.self, at: Date.now() },
      }));
    } catch { /* disco lleno o permisos */ }
  }

  #resumeOffset(logPath) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(this.store.dir, 'resume.json'), 'utf8'));
      return r[logPath]?.offset ?? null;
    } catch { return null; }
  }

  /** Peleas del índice según tramo y enemigo. */
  queryHistory(q = {}) {
    if (!this.store) return [];
    return this.store.filter(q);
  }
  getFight(id) { return this.store?.get(id) ?? null; }

  /** Todas las peleas del tramo sumadas en un solo desglose. */
  aggregate(q = {}) {
    if (!this.store) return null;
    const list = this.store.filter({ ...q, limit: q.limit ?? 300 });
    const full = list.map((sm) => {
      const f = this.store.get(sm.id);
      return f ? { ...f, at: sm.at } : null;
    }).filter(Boolean);
    return aggregate(full, this.self);
  }
  foeList(sinceMs) { return this.store?.foeList(sinceMs) ?? []; }
  storeStats() { return this.store?.stats() ?? null; }

  /**
   * Al caer un enemigo, quién le hizo cuánto.
   *
   * Se calcula sobre ESE objetivo, no sobre la pelea: en una pelea con varios
   * bichos el reparto general no dice nada de quién mató a cuál. El dps va
   * sobre el tiempo que ese enemigo estuvo recibiendo golpes.
   */
  #makeKillCard(ev) {
    const enc = this.tracker?.current;
    if (!enc) return;
    const me = this.self ?? 'You';
    const pets = new Set(this.parser?.pets.keys() ?? []);
    if (ev.victim === me || pets.has(ev.victim)) return;      // los tuyos no

    const first = enc.targetFirst.get(ev.victim) ?? enc.start;
    const secs = Math.max(1, Math.round(ev.t - first) + 1);
    const rows = [];
    for (const c of enc.combatants.values()) {
      const b = c.byTarget.get(ev.victim);
      if (!b || b.sum <= 0 || c.name === ev.victim) continue;
      rows.push({ name: c.name, damage: b.sum, dps: b.sum / secs, hits: b.n });
    }
    if (!rows.length) return;
    const total = rows.reduce((a, r) => a + r.damage, 0);
    rows.sort((a, b) => b.damage - a.damage);
    for (const r of rows) r.share = total ? r.damage / total : 0;
    // Cada muerte aporta una ventana medida: daño y segundos reales de pelea
    // contra ESE enemigo. La media de la sesión es la suma de las ventanas,
    // no el promedio de los promedios, que pesaría igual una pelea de 3
    // segundos que una de tres minutos.
    for (const r of rows) {
      const a = this.killAgg.get(r.name) ?? { damage: 0, seconds: 0, kills: 0 };
      a.damage += r.damage;
      a.seconds += secs;
      a.kills += 1;
      this.killAgg.set(r.name, a);
    }
    this.lastKill = { victim: ev.victim, seconds: secs, total, rows, at: Date.now() };
  }

  /**
   * DPS por combatiente, en tres lecturas distintas y ninguna intercambiable:
   *   kill  media de las ventanas de cada enemigo abatido
   *   w10   últimos 10 segundos
   *   w20   últimos 20 segundos
   */
  #sessionDps() {
    const now = this.tracker?.current?.end ?? (Date.now() / 1000);
    const out = {};
    for (const [name, a] of this.killAgg) {
      out[name] = { kill: a.seconds ? a.damage / a.seconds : null, kills: a.kills, w10: 0, w20: 0 };
    }
    for (const h of this.recentHits) {
      const age = now - h.t;
      if (age > 20) continue;
      if (!out[h.name]) out[h.name] = { kill: null, kills: 0, w10: 0, w20: 0 };
      out[h.name].w20 += h.amount / 20;
      if (age <= 10) out[h.name].w10 += h.amount / 10;
    }
    return out;
  }

  /** Pone a cero el acumulado del overlay sin tocar el histórico de peleas. */
  resetSession() {
    this.lastKill = null;
    this.killAgg.clear();
    this.recentHits.length = 0;
    this.session = new EncounterTracker({ self: this.self, idleSec: Number.POSITIVE_INFINITY });
    if (this.tracker) this.session.zone = this.tracker.zone;
    return true;
  }
  setLang(code) { setLang(code); }

  markPet(name) { this.parser?.markPet(name); this.narrator.setPets([...(this.parser?.pets.keys() ?? [])]); }
  unmarkPet(name) { this.parser?.unmarkPet(name); this.narrator.setPets([...(this.parser?.pets.keys() ?? [])]); }

  /**
   * Aliados sin identificar: pegan a lo mismo que tú pero no se sabe qué son.
   * En EQL la mascota cambia de nombre en cada invocación, así que no vale
   * memorizarlos: hay que pedirle al usuario un /pet who leader.
   */
  #petHint(enc) {
    if (!enc?.rows) return null;
    const me = this.self ?? 'You';
    const known = new Set(this.parser?.pets.keys() ?? []);
    const mine = enc.rows.find((r) => r.name === me);
    if (!mine) return null;
    const myFoes = new Set(mine.targets.map((t) => t.name));
    const candidates = enc.rows
      .filter((r) => r.name !== me && !known.has(r.name) && r.damage > 0)
      .filter((r) => r.targets.some((t) => myFoes.has(t.name)))
      .filter((r) => !myFoes.has(r.name))       // no es uno de tus enemigos
      .map((r) => r.name);
    if (!candidates.length) return null;
    return { candidates, currentPet: this.parser?.currentPet ?? null };
  }

  snapshot() {
    const current = this.#enc(this.tracker?.current);
    return {
      ...this.describe(),
      classes: this.activeClasses,
      classSource: this.classSource,
      autoFullRead: !!this.autoFullRead,
      classConflict: this.classConflict,
      level: this.level,
      parsed: this.parser?.parsed ?? 0,
      unknown: this.parser?.unrecognized ?? 0,
      pets: this.parser ? [...this.parser.pets.keys()] : [],
      timers: this.triggers.snapshot(),
      current,
      history: this.history,
      session: this.#enc(this.session?.current),
      lastKill: this.lastKill ?? null,
      sessionDps: this.#sessionDps(),
      advice: this.#advice(current ?? this.history[0]),
      petHint: this.#petHint(current ?? this.history[0]),
      currentPet: this.parser?.currentPet ?? null,
      live: (() => { const l = this.#live(); this.narrator.stance(l); return l; })(),
    };
  }
}
