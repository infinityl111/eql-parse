import { EventEmitter } from 'node:events';

/**
 * Motor de disparadores al estilo GINA.
 *
 * Un disparador observa CADA línea del log (la reconozca el parser o no) y,
 * al casar, lanza acciones: voz, sonido, texto en pantalla y temporizadores.
 *
 * Sustitución en los textos:
 *   ${0}    la coincidencia completa
 *   ${1}…${9}  grupos de captura
 *   ${line} la línea entera
 * En EQL esto es potente porque el log nombra el hechizo:
 *   patrón  ^(.+?) begins casting (.+?)\.$
 *   voz     "${1} lanza ${2}"
 */

const MAX_TIMERS = 40;

function substitute(text, m, line) {
  if (!text) return text;
  return text.replace(/\$\{(\d|line)\}/g, (_, k) => {
    if (k === 'line') return line;
    return m[+k] ?? '';
  });
}

function compile(def) {
  try {
    const flags = def.ignoreCase === false ? '' : 'i';
    const src = def.regex ? def.pattern : def.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { ...def, re: new RegExp(src, flags), error: null };
  } catch (err) {
    return { ...def, re: null, error: err.message };
  }
}

export class TriggerEngine extends EventEmitter {
  constructor() {
    super();
    this.defs = [];
    this.compiled = [];
    this.timers = new Map();   // id -> {id, label, endsAt, warnAt, warned, color, endSpeak, endText}
    this.nextTimerId = 1;
  }

  /**
   * Disparadores heredados que hay que neutralizar al cargar.
   *
   * Los disparadores se guardan en la configuración del usuario, así que
   * cambiar la plantilla en el código no arregla las instalaciones que ya
   * la tenían activada. Este de aquí saltaba con CUALQUIER muerte y decía
   * "mascota caída"; la muerte de la mascota la avisa ahora el narrador,
   * que sí sabe cuál es tu mascota.
   */
  static #LEGACY = [
    { id: 'pet-dead', badPattern: 'has been slain by' },
  ];

  load(defs = []) {
    for (const d of defs) {
      const bad = TriggerEngine.#LEGACY.find((L) => L.id === d.id && String(d.pattern ?? '').includes(L.badPattern));
      if (bad && d.enabled !== false) { d.enabled = false; d.retired = true; }
    }
    this.defs = defs;
    this.compiled = defs.filter((d) => d.enabled !== false).map(compile);
    return this.compiled.filter((c) => c.error).map((c) => ({ id: c.id, error: c.error }));
  }

  /** Comprueba un patrón contra una línea sin tocar el estado. Para el botón de probar. */
  static tryOne(def, line) {
    const c = compile(def);
    if (c.error) return { ok: false, error: c.error };
    const m = c.re.exec(line);
    if (!m) return { ok: true, matched: false };
    return {
      ok: true,
      matched: true,
      groups: m.slice(0, 10),
      speak: substitute(def.speak, m, line),
      text: substitute(def.text, m, line),
      timerLabel: substitute(def.timerLabel, m, line),
    };
  }

  match(line, _t) {
    for (const c of this.compiled) {
      if (!c.re) continue;
      const m = c.re.exec(line);
      if (!m) continue;

      const speak = substitute(c.speak, m, line);
      const text = substitute(c.text, m, line);

      if (speak || text || c.sound) {
        this.emit('alert', {
          id: c.id, name: c.name, speak, text, sound: c.sound ?? null,
          color: c.color ?? null, holdMs: c.holdMs ?? 4000, at: Date.now(),
        });
      }

      if (c.cancelTimer) {
        const want = substitute(c.cancelTimer, m, line).toLowerCase();
        for (const [id, tm] of this.timers) {
          if (tm.label.toLowerCase().includes(want)) this.timers.delete(id);
        }
      }

      if (c.timerSeconds > 0) {
        const label = substitute(c.timerLabel, m, line) || c.name;
        this.#startTimer({
          label,
          seconds: c.timerSeconds,
          warnAt: c.timerWarnAt ?? 0,
          restart: c.timerRestart ?? 'restart',   // restart | ignore | multiple
          color: c.color ?? null,
          endSpeak: substitute(c.timerEndSpeak, m, line),
          endText: substitute(c.timerEndText, m, line),
        });
      }
    }
  }

  #startTimer(t) {
    if (t.restart !== 'multiple') {
      const existing = [...this.timers.values()].find((x) => x.label === t.label);
      if (existing) {
        if (t.restart === 'ignore') return;
        this.timers.delete(existing.id);
      }
    }
    if (this.timers.size >= MAX_TIMERS) {
      const oldest = [...this.timers.values()].sort((a, b) => a.endsAt - b.endsAt)[0];
      this.timers.delete(oldest.id);
    }
    const id = this.nextTimerId++;
    this.timers.set(id, {
      id, label: t.label, color: t.color,
      startedAt: Date.now(), endsAt: Date.now() + t.seconds * 1000,
      total: t.seconds, warnAt: t.warnAt, warned: false,
      endSpeak: t.endSpeak, endText: t.endText,
    });
  }

  /** Llamar periódicamente. Devuelve los temporizadores vivos para pintarlos. */
  tick() {
    const now = Date.now();
    for (const [id, tm] of this.timers) {
      const left = (tm.endsAt - now) / 1000;
      if (!tm.warned && tm.warnAt > 0 && left <= tm.warnAt && left > 0) {
        tm.warned = true;
        this.emit('alert', {
          id: `timer-warn-${id}`, name: tm.label,
          speak: null, text: `${tm.label} · ${Math.ceil(left)}s`,
          sound: 'warn', color: tm.color, holdMs: 2500, at: now,
        });
      }
      if (left <= 0) {
        this.timers.delete(id);
        if (tm.endSpeak || tm.endText) {
          this.emit('alert', {
            id: `timer-end-${id}`, name: tm.label,
            speak: tm.endSpeak || null, text: tm.endText || null,
            sound: 'end', color: tm.color, holdMs: 4000, at: now,
          });
        }
      }
    }
    return this.snapshot();
  }

  snapshot() {
    const now = Date.now();
    return [...this.timers.values()]
      .map((t) => ({
        id: t.id, label: t.label, color: t.color, total: t.total,
        left: Math.max(0, (t.endsAt - now) / 1000),
      }))
      .sort((a, b) => a.left - b.left);
  }

  clearTimers() { this.timers.clear(); }
}

/** Plantillas de arranque. Las específicas de un jefe hay que verificarlas
 *  contra tu propio log: los emotes exactos de EQL no están documentados. */
export const STARTER_TRIGGERS = [
  {
    id: 'stunned', name: 'Te han aturdido', enabled: true,
    pattern: '^You are stunned!$', regex: true,
    speak: 'aturdido', text: 'ATURDIDO', sound: 'warn', color: '#E08A4B', holdMs: 2000,
  },
  {
    id: 'cast-any', name: 'Alguien empieza a castear', enabled: false,
    pattern: '^(.+?) begins casting (.+?)\\.$', regex: true,
    speak: '${1} lanza ${2}', text: '${1} → ${2}', holdMs: 3000,
    note: 'Inservible tal cual: en una pelea con adds salta decenas de veces. '
        + 'Para casteos importantes usa "Casteos enemigos" en Ajustes de voz, que filtra por '
        + 'categoría y sólo avisa de enemigos. Esta plantilla es para vigilar a UNO concreto: '
        + '^Lady Vox begins casting',
  },
  {
    id: 'boss-cast', name: 'Plantilla: casteo de un jefe', enabled: false,
    pattern: '^Lady Vox begins casting (.+?)\\.$', regex: true,
    speak: 'Vox lanza ${1}', text: 'VOX · ${1}', sound: 'alert', color: '#6FC7D8',
    timerLabel: 'Vox · ${1}', timerSeconds: 12, timerWarnAt: 3, timerRestart: 'restart',
    timerEndSpeak: 'Vox lista', holdMs: 5000,
    note: 'Cambia el nombre y los segundos por los del jefe que te interese.',
  },
  {
    id: 'pet-dead', name: 'Plantilla: muerte concreta', enabled: false,
    pattern: '^Nombre exacto has been slain by', regex: true,
    speak: 'ha caído', text: 'CAÍDO', sound: 'warn',
    note: 'La muerte de tu mascota ya se avisa sola en Ajustes de voz. Esta plantilla es '
        + 'para vigilar a alguien concreto: pon su nombre exacto o saltará con cualquier muerte.',
  },
  {
    id: 'my-death', name: 'Has muerto', enabled: true,
    pattern: '^You have been slain by (.+?)!$', regex: true,
    speak: 'has muerto', text: 'MUERTO · ${1}', sound: 'end', color: '#B0555F', holdMs: 6000,
  },
  {
    id: 'zone', name: 'Cambio de zona', enabled: false,
    pattern: '^You have entered (.+?)\\.$', regex: true,
    text: '${1}', holdMs: 2500,
  },
];
