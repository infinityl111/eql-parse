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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NO HAY AVISO DE ENRAGE, Y NO ES UN OLVIDO: SE MIDIÓ Y NO HAY SEÑAL.
 *
 * Esto está escrito aquí —y no en un chat que se pierde— porque «avisar de los
 * enrages» es una idea que se le ocurre a cualquiera mirando un log, y va a
 * volver a proponerse. La respuesta tiene que ser un número.
 *
 * LA PREGUNTA. ¿Hay frases en el registro que anticipen un subidón de daño del
 * jefe, y con cuánta antelación?
 *
 * EL CONTROL, que es lo que hace que esto signifique algo. Un jefe pega más
 * según avanza la pelea —fases, adds, a ti se te acaban los recursos— así que
 * cualquier frase que tienda a salir tarde parece profética sin serlo. Se
 * midieron instantes repartidos por las mismas peleas con exactamente la misma
 * regla que las candidatas.
 *
 *   CONTROL   23.040 instantes · 576 peleas
 *             27 dps antes · 26 después · sube en el 46% de los casos
 *
 * El suelo es limpio: en ventanas de 10 s el daño NO sube solo. Si una frase
 * avisara, se vería.
 *
 * LAS CANDIDATAS, medidas como INICIOS DE RACHA y no como apariciones —una
 * línea que se repite cada 6 s durante un enrage sale «periódica», pero el
 * principio de la racha sigue siendo un suceso, así que se exigió 30 s de
 * silencio antes de contar un inicio—:
 *
 *   accelerated frenzy    449 arranques   sube en el 49%   Δ 0 dps
 *   <N> rages              13 arranques   sube en el 54%   Δ +5 dps
 *   goes berserk           23 arranques   sube en el 39%   Δ 0 dps
 *   begins to move faster  61 arranques   sube en el 36%   Δ −3 dps
 *   <N>'s voice booms     409 apariciones y CERO dentro de una pelea:
 *                         es ambiente de zona, no del jefe
 *
 * NINGUNA DESPEGA DEL 46% DEL AZAR. La muestra grande —449 arranques— da
 * exactamente el suelo. `rages` marca +5 dps con 13 arranques, que es muestra
 * insuficiente y una variación menor que el ruido normal.
 *
 * No se llegó a medir la antelación porque no hay subida cuya antelación medir.
 *
 * EL LÍMITE DEL INSTRUMENTO, que hay que leer antes de dar esto por cerrado: se
 * midió DAÑO ENTRANTE AL USUARIO en VENTANAS DE 10 s. Un pico dirigido al
 * tanque, o más corto que 10 s, no sería visible con esta medición.
 *
 * CONSECUENCIAS, y son dos:
 *   · `voice booms` sale de la lista de candidatas a aviso por las cero
 *     apariciones dentro de pelea.
 *   · Ninguna frase de esta familia entra como AVISO DE DAÑO mientras no se
 *     despegue del 46%. Pueden entrar como etiqueta descriptiva en la pista de
 *     estado del reproductor, que es otra cosa: describe lo que pasó y no
 *     promete anticipación.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const DEFAULT_NARRATE = {
  chat: {
    tell: true, group: true, guild: true, raid: true,
    say: false, ooc: false, shout: false, auction: false, channel: false,
  },
  combat: {
    stance: true, deaths: true, adds: true, summary: true, petdeath: true,
    resist: false, interrupt: true, levelup: true, bigcrit: true, loot: false,
    seeinvis: false, petprompt: true,
  },
  /**
   * CADA CUÁNTO SE DICE QUE TE HAN RESISTIDO. Dos modos y ninguno más.
   *
   *   'todas'   una por resistencia.
   *   'cada20'  una cada 20 s POR HECHIZO — mismo mecanismo que el
   *             estrangulador de 8 s de los casteos ajenos, con otra clave.
   *
   * El estrangulado es el que viene puesto, y sale de una medición: en la pelea
   * que trajo todo esto hubo 62 resistencias del mismo hechizo en 13 minutos
   * —una cada 12 s—, así que «todas» es hablar encima de la pelea entera. Quien
   * las quiera todas las pide; quien no diga nada no acaba silenciando la
   * casilla por hartazgo, que es como se pierde un aviso útil.
   */
  resistMode: 'cada20',
  /**
   * Supervivencia: sucesos donde un segundo de retraso cuesta el personaje.
   *
   * Van todos activados por defecto y cortan por delante de cualquier otra voz,
   * incluida la del combate. Y NO se deduplican: si la invisibilidad se te cae
   * dos veces en un minuto, las dos veces importan.
   */
  survival: {
    feign: true, invisFading: true, invisGone: true, levitateFading: true,
    summoned: true, invuln: true, unconscious: true, forgotten: true,
  },
  enemyCast: { ...DEFAULT_CAST_CATEGORIES },
  nukeNames: [],
  tts: { voice: null, rate: 1, volume: 1 },
  maxChars: 120,
  bigCritFactor: 2.5,   // un golpe se anuncia si supera 2,5 veces tu media
};

/**
 * Mezcla configuraciones de voz con la de fábrica, GRUPO A GRUPO.
 *
 * La mezcla plana —`{ ...DEFAULT_NARRATE, ...guardada }`— era un fallo
 * silencioso: sustituye el grupo entero, así que cada casilla nueva que se
 * añadiera nacía apagada para todo el que ya tuviera un fichero de
 * configuración, aunque su valor de fábrica fuese encendida. No se notaba,
 * porque una función que no avisa se parece mucho a una que no existe.
 *
 * Vive aquí y se usa desde el proceso principal y desde el narrador: había
 * una copia en cada sitio y las dos estaban mal de la misma forma.
 */
export function mergeNarrate(...fuentes) {
  const out = { ...DEFAULT_NARRATE };
  for (const f of fuentes) {
    for (const [grupo, valor] of Object.entries(f ?? {})) {
      out[grupo] = valor && typeof valor === 'object' && !Array.isArray(valor)
        ? { ...out[grupo], ...valor }
        : valor;
    }
  }
  return out;
}

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
    // Mismo mecanismo que `lastCast`, con la clave puesta en el hechizo.
    this.lastResist = new Map();
  }

  setConfig(c) { this.config = mergeNarrate(this.config, c); }
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
    if (!v) {
      this.lastStance = null; this.lastChat = null; this.lastCast.clear();
      // Al salir del silencio se olvida también la racha de avisos de caída:
      // si no, la primera racha en vivo podría venir ya con el cupo gastado por
      // una de hace horas leída durante el arranque.
      this.levWarns = 0; this.levAt = null; this.lastSeeInvis = null;
    }
  }

  #say(speak, opts = {}) {
    if (!speak || this.muted) return;
    this.emit('say', { speak, text: opts.text ?? null, kind: opts.kind ?? 'info',
      color: opts.color ?? null, queue: !!opts.queue, holdMs: opts.holdMs ?? 3000,
      // Prioridad: corta lo que se esté diciendo y no lo corta nadie mientras
      // suena. Un aviso de supervivencia pisado por un comentario de dps llega
      // igual que si no hubiera llegado.
      priority: !!opts.priority });
  }

  /**
   * Avisos de supervivencia.
   *
   * Sin deduplicación por tiempo, a propósito: estos sucesos importan cada vez
   * que pasan. La única excepción es la levitación, que el juego avisa dos o
   * tres veces cada seis segundos; la tercera llega en el mismo segundo que la
   * caída y ya no sirve para nada, así que se corta a las dos primeras.
   */
  #survival(ev) {
    const cfg = this.config.survival;
    if (!cfg || !ev.what) return false;

    // Fin de la racha de avisos de caída: al aterrizar se reinicia la cuenta.
    if (ev.what === 'levitateGone') { this.levWarns = 0; return false; }
    if (!cfg[ev.what]) return false;

    if (ev.what === 'levitateFading') {
      // Una racha nueva empieza cuando han pasado más de 20 s desde el último
      // aviso: los del juego van cada seis.
      if (ev.t - (this.levAt ?? -99) > 20) this.levWarns = 0;
      this.levAt = ev.t;
      if ((this.levWarns ?? 0) >= 2) return false;
      this.levWarns = (this.levWarns ?? 0) + 1;
    }

    // «Tus enemigos te han olvidado» no es una alarma: es la buena noticia de
    // que ya puedes moverte. Se encola y se dice con voz normal.
    if (ev.what === 'forgotten') {
      this.#say(t('sv.forgotten'), { kind: 'info', queue: true, text: t('sv.forgotten'), holdMs: 3500 });
      return true;
    }

    this.#say(t(`sv.${ev.what}`), {
      kind: 'bad', color: '#B0555F', priority: true, holdMs: 5000,
      text: t(`sv.${ev.what}`).toUpperCase(),
    });
    return true;
  }

  /** Una línea ya parseada. Devuelve true si ha dicho algo. */
  feed(ev) {
    if (!ev) return false;
    const c = this.config;

    if (ev.kind === 'chat') return this.#chat(ev);
    // Antes que nada: es lo que no puede llegar tarde.
    if (ev.kind === 'survival') return this.#survival(ev);

    if (!c.combat) return false;
    switch (ev.kind) {
      case 'seeinvis':
        // Sale de un /con que escribes tú, no es un peligro sobrevenido, y el
        // juego la repite cuatro veces en dos segundos: se deduplica.
        if (!c.combat.seeinvis) return false;
        if (ev.t - (this.lastSeeInvis ?? -99) < 30) return false;
        this.lastSeeInvis = ev.t;
        this.#say(t('sv.seeinvis'), { kind: 'warn', color: '#E08A4B', text: t('sv.seeinvis') });
        return true;

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

      /**
       * EL GUARDIÁN MIRA AL LANZADOR, NO AL OBJETIVO.
       *
       * Aquí ponía `ev.target !== this.self`, y en un suceso `resist` el
       * `target` es QUIEN RESISTE —el bicho—, nunca tú. La casilla «Te resisten
       * un hechizo» lleva marcada desde la 1.0.0 y no había sonado una sola vez
       * en los 1.188.684 sucesos que el análisis SÍ reconoce del registro de
       * referencia: cero disparos, medido. El denominador es ése y no las
       * 1.259.379 líneas del fichero — al narrador sólo le llega lo reconocido.
       *
       * La etiqueta siempre estuvo bien —«te resisten», y el respaldo del
       * nombre dice literalmente «tu hechizo»—; lo que estaba del revés era el
       * campo. Se pregunta lo mismo que `encounter.js` pregunta para contar una
       * resistencia sufrida: ¿el hechizo era MÍO?
       */
      case 'resist': {
        if (!c.combat.resist || ev.caster !== this.self) return false;
        /**
         * LA CLAVE ES EL HECHIZO Y NO EL ENEMIGO, que es lo que lo diferencia
         * del estrangulador de los casteos ajenos —allí la clave lleva el
         * lanzador—. Lo que cansa aquí no es el bicho: es oír catorce veces el
         * nombre del mismo hechizo. Y separando por hechizo, el segundo que
         * empieza a resistirse sí se oye en el acto aunque el primero esté
         * callado, que es cuando la información vale algo.
         */
        if ((this.config.resistMode ?? 'cada20') === 'cada20') {
          const clave = ev.ability ?? '?';
          if (ev.t - (this.lastResist.get(clave) ?? -99) < 20) return false;
          this.lastResist.set(clave, ev.t);
        }
        this.#say(t('say.resisted', { spell: ev.ability ?? t('say.theSpell') }), { kind: 'warn' });
        return true;
      }

      case 'interrupt':
        if (ev.source && ev.source !== this.self && ev.source !== 'You') return false;
        // Que te corten el Feign Death no es un casteo perdido más: creías estar
        // tumbado y sigues de pie. Es la forma de fallo más frecuente de las dos
        // que tiene en el log (10 interrupciones frente a 3 roturas).
        if (/feign death/i.test(ev.ability ?? '')) {
          if (!this.config.survival?.feign) return false;
          this.#say(t('sv.feignInterrupted'), {
            kind: 'bad', color: '#B0555F', priority: true, holdMs: 5000,
            text: t('sv.feignInterrupted').toUpperCase(),
          });
          return true;
        }
        if (!c.combat.interrupt) return false;
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
    // Sólo se anuncia a quien sabemos que es enemigo. Antes, si aún no
    // conocíamos ninguno, la comprobación se saltaba entera: fuera de combate
    // eso significaba anunciar el gate de cualquier jugador de la zona.
    if (!this.foes.has(ev.source)) return false;

    const cat = classifySpell(ev.ability, { nukeNames: this.config.nukeNames });
    if (!cat || !cfg[cat]) return false;

    // Un mismo enemigo recastando lo mismo cada pocos segundos no se repite.
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
