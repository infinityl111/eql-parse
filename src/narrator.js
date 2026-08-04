import { EventEmitter } from 'node:events';
import { t } from './i18n.js';
import { classifySpell, shortName, CATEGORIES, DEFAULT_CAST_CATEGORIES } from './spells.js';

/**
 * Narrador de voz.
 *
 * Dos cosas distintas bajo el mismo techo:
 *   1. Leer el chat entrante, con una casilla por canal.
 *   2. Comentar lo que pasa en combate, también por casillas.
 *
 * Decisiones que importan al usarlo de verdad:
 *  - El chat se ENCOLA, no interrumpe. Los avisos de combate sí cortan, porque
 *    un aviso tardío no sirve de nada. Si se mezclan, manda el combate.
 *  - Los mensajes largos no se leen enteros: se cortan. Nadie quiere que le
 *    reciten un párrafo de subasta en mitad de una pelea.
 *  - Nada de leer lo que escribes tú, ni repetir el mismo mensaje seguido.
 */

export const DEFAULT_NARRATE = {
  chat: {
    tell: true, group: true, guild: true, raid: true,
    say: false, ooc: false, shout: false, auction: false, channel: false,
  },
  combat: {
    stance: true, deaths: true, adds: true, summary: true, petdeath: true,
    resist: false, interrupt: true, levelup: true, bigcrit: true, loot: false,
  },
  enemyCast: { ...DEFAULT_CAST_CATEGORIES },
  nukeNames: [],
  maxChars: 120,
  bigCritFactor: 2.5,   // un golpe se anuncia si supera 2,5 veces tu media
};

/** Cómo se enuncia cada canal. El verbo dice de dónde viene sin nombrarlo. */
const FRAME = (channel, who, msg) => t(`say.${channel}`, { who, msg });

/** Limpia el mensaje para que se lea bien en voz alta. */
function tidy(text, maxChars) {
  let t2 = String(text ?? '')
    .replace(/https?:\/\/\S+/g, t('say.aLink'))
    .replace(/[<>*_~`|]/g, ' ')
    .replace(/([!?.,])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t2) return null;
  if (t2.length > maxChars) {
    const cut = t2.slice(0, maxChars);
    const sp = cut.lastIndexOf(' ');
    t2 = (sp > maxChars * 0.6 ? cut.slice(0, sp) : cut) + t('say.andMore');
  }
  return t2;
}

export class Narrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_NARRATE, ...config };
    this.self = null;
    this.lastChat = null;
    this.lastChatAt = 0;
    this.muted = false;
    this.lastStance = null;
    this.seenFoes = new Set();
    this.hitSamples = [];
    this.pets = new Set();
    this.foes = new Set();
    this.lastCast = new Map();
  }

  setConfig(c) { this.config = { ...DEFAULT_NARRATE, ...this.config, ...c }; }
  setSelf(s) { this.self = s; }
  setPets(list) { this.pets = new Set(list ?? []); }
  setFoes(list) { this.foes = new Set(list ?? []); }

  /**
   * Silencio total. Se usa al leer el histórico: son sucesos de hace horas.
   *
   * Va aquí y no en quien llama porque el narrador habla desde cinco sitios
   * distintos (línea suelta, cierre de pelea, add, postura, resumen) y poner
   * una guarda en cada uno ya se ha demostrado que se olvida alguna.
   */
  setMuted(v) {
    this.muted = !!v;
    if (!v) { this.lastStance = null; this.lastChat = null; this.lastCast.clear(); }
  }

  #say(speak, opts = {}) {
    if (!speak || this.muted) return;
    this.emit('say', { speak, text: opts.text ?? null, kind: opts.kind ?? 'info',
      color: opts.color ?? null, queue: !!opts.queue, holdMs: opts.holdMs ?? 3000 });
  }

  /** Una línea ya parseada. Devuelve true si ha dicho algo. */
  feed(ev) {
    if (!ev) return false;
    const c = this.config;

    if (ev.kind === 'chat') return this.#chat(ev);

    if (!c.combat) return false;
    switch (ev.kind) {
      case 'death':
        if (ev.victim === this.self) {
          if (!c.combat.deaths) return false;
          this.#say(t('say.youDied'), { kind: 'bad', color: '#B0555F', holdMs: 6000, text: t('say.youDied').toUpperCase() });
          return true;
        }
        // Sólo si es TU mascota. El disparador genérico saltaba con cualquier
        // muerte del combate, incluida la del enemigo.
        if (c.combat.petdeath && this.pets.has(ev.victim)) {
          this.#say(t('say.petDied'), { kind: 'bad', color: '#B0555F', text: t('say.petDied').toUpperCase(), holdMs: 4000 });
          return true;
        }
        return false;

      case 'resist':
        if (!c.combat.resist || ev.target !== this.self) return false;
        this.#say(t('say.resisted', { spell: ev.ability ?? t('say.theSpell') }), { kind: 'warn' });
        return true;

      case 'interrupt':
        if (!c.combat.interrupt) return false;
        if (ev.source && ev.source !== this.self && ev.source !== 'You') return false;
        this.#say(t('say.interrupted'), { kind: 'warn', text: t('say.interrupted').toUpperCase() });
        return true;

      case 'skillup':
        if (!c.combat.levelup) return false;
        this.#say(`${ev.skill} a ${ev.value}`, { queue: true });
        return true;

      case 'loot':
        if (!c.combat.loot || !ev.item) return false;
        this.#say(t('say.looted', { item: ev.item }), { queue: true });
        return true;

      case 'cast':
        return this.#cast(ev);

      case 'melee':
      case 'spell':
        return this.#hit(ev);

      default:
        return false;
    }
  }

  /**
   * Casteos ajenos. Tres filtros encadenados, y los tres hacen falta:
   * que lo lance un enemigo, que la categoría importe, y que no lo repita.
   */
  #cast(ev) {
    const cfg = this.config.enemyCast;
    if (!cfg || !ev.ability || !ev.source) return false;
    if (ev.source === this.self || this.pets.has(ev.source)) return false;
    // Sin esto avisaría también de los hechizos de tus compañeros de grupo.
    if (this.foes.size && !this.foes.has(ev.source)) return false;

    const cat = classifySpell(ev.ability, { nukeNames: this.config.nukeNames });
    if (!cat || !cfg[cat]) return false;

    // Un mismo bicho recastando lo mismo cada pocos segundos no se repite.
    const key = `${ev.source}|${cat}`;
    if (ev.t - (this.lastCast.get(key) ?? -99) < 8) return false;
    this.lastCast.set(key, ev.t);

    const who = shortName(ev.source);
    this.#say(CATEGORIES[cat].say(who, ev.ability), {
      kind: 'warn', color: '#E08A4B', holdMs: 4000,
      text: `${who} → ${ev.ability}`,
    });
    return true;
  }

  #chat(ev) {
    const c = this.config;
    if (ev.channel === 'outgoing') return false;
    if (ev.from === this.self) return false;
    if (!c.chat?.[ev.channel]) return false;

    const msg = tidy(ev.text, c.maxChars);
    if (!msg) return false;

    // Nada de repetir el mismo mensaje dos veces seguidas (spam de subasta).
    const key = `${ev.from}|${msg}`;
    if (key === this.lastChat && ev.t - this.lastChatAt < 30) return false;
    this.lastChat = key;
    this.lastChatAt = ev.t;

    this.#say(FRAME(ev.channel in { tell: 1, group: 1, guild: 1, raid: 1, say: 1, ooc: 1, shout: 1, auction: 1, channel: 1 } ? ev.channel : 'say', ev.from, msg), {
      kind: 'chat', queue: true, holdMs: 4500,
      text: `${ev.from}: ${ev.text}`,
    });
    return true;
  }

  /** Golpes: sólo se anuncian los tuyos y sólo si son muy superiores a tu media. */
  #hit(ev) {
    if (!this.config.combat.bigcrit) return false;
    if (ev.source !== this.self) return false;
    this.hitSamples.push(ev.amount);
    if (this.hitSamples.length > 120) this.hitSamples.shift();
    if (this.hitSamples.length < 25) return false;
    const avg = this.hitSamples.reduce((a, b) => a + b, 0) / this.hitSamples.length;
    if (ev.amount < avg * this.config.bigCritFactor) return false;
    this.#say(`${Math.round(ev.amount)}${ev.crit ? ' ' + t('say.crit') : ''}`, {
      kind: 'good', color: '#A8C74F', text: `${n(ev.amount)}${ev.crit ? ' ' + t('say.crit').toUpperCase() : ''}`, holdMs: 2500,
    });
    return true;
  }

  /** Un enemigo nuevo se suma a la pelea en curso. */
  add(name) {
    if (!this.config.combat.adds || !name) return;
    if (this.seenFoes.has(name)) return;
    this.seenFoes.add(name);
    if (this.seenFoes.size < 2) return;   // el primero no es un "add"
    this.#say(t('say.addJoins', { who: name }), { kind: 'warn', color: '#E08A4B', text: `+ ${name}` });
  }

  fightStart() { this.seenFoes.clear(); }

  /** Resumen hablado al cerrar la pelea. */
  fightEnd(enc) {
    if (!this.config.combat.summary || !enc) return;
    if (enc.duration < 8 || enc.total < 1000) return;
    const mine = enc.rows.find((r) => r.name === this.self);
    const parts = [`${Math.round(enc.raidDps)} dps`];
    if (mine) parts.push(t('say.you', { dps: Math.round(mine.dps) }));
    if (enc.kills.length) parts.push(enc.kills.length === 1 ? t('say.oneKill') : t('say.nKills', { n: enc.kills.length }));
    this.#say(parts.join(', '), { queue: true, kind: 'info', holdMs: 4000 });
  }

  /** Cambio de postura recomendado, sólo cuando cambia la recomendación. */
  stance(live) {
    if (!this.config.combat.stance || !live) return;
    const key = live.suggest ? live.bestKey : null;
    if (key === this.lastStance) return;
    this.lastStance = key;
    if (!key) return;
    this.#say(t('say.switchTo', { stance: live.best }), {
      kind: 'warn', color: '#E08A4B', text: `→ ${live.best}`, holdMs: 5000,
    });
  }
}

const n = (v) => Math.round(v).toLocaleString('es-ES');
