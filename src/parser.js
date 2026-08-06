import { RULES_BY_HINT, HINTS } from './patterns.js';
import { STANCES, mitigationFor, normStance } from './stances.js';
import { classifySpell } from './spells.js';

/** "YOU parry!" / "misses!" / "a gorgon dodges!" -> palabra clave limpia. */
export function normReason(raw) {
  const r = String(raw ?? '').toLowerCase();
  if (r.includes('parr')) return 'parada';
  if (r.includes('ripost')) return 'contraataque';
  if (r.includes('dodge')) return 'esquiva';
  if (r.includes('block') || r.includes('shield')) return 'bloqueo';
  if (r.includes('invulnerable')) return 'invulnerable';
  if (r.includes('absorb') || r.includes('rune')) return 'absorbido';
  if (r.includes('magical skin') || r.includes('skin')) return 'absorbido';
  if (r.includes('miss')) return 'fallo';
  return r.slice(0, 24) || 'fallo';
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/**
 * Formato: [Www Mmm DD HH:MM:SS YYYY] mensaje
 * Parseo manual: new Date(string) es ~20x más lento y aquí procesamos
 * decenas de miles de líneas en la calibración.
 * Devuelve segundos epoch (resolución del log = 1 segundo, no hay más).
 */
export function parseHeader(line) {
  if (line.charCodeAt(0) !== 91 /* [ */ || line.charCodeAt(25) !== 93 /* ] */) return null;
  const mon = MONTHS[line.slice(5, 8)];
  if (mon === undefined) return null;
  const day = +line.slice(9, 11);
  const h = +line.slice(12, 14);
  const mi = +line.slice(15, 17);
  const s = +line.slice(18, 20);
  const year = +line.slice(21, 25);
  if (Number.isNaN(day + h + mi + s + year)) return null;
  const t = new Date(year, mon, day, h, mi, s).getTime() / 1000;
  return { t, body: line.slice(27) };
}

export class Parser {
  /**
   * @param {object} opts
   *  - self: nombre de tu personaje (para normalizar "You" <-> nombre real)
   *  - castWindowMs: ventana para atribuir "was hit by non-melee" al último casteo
   */
  constructor(opts = {}) {
    this.self = opts.self ?? null;
    this.castWindow = (opts.castWindowSec ?? 12);
    this.recentCasts = [];      // [{t, source, ability}]
    this.pets = new Map();      // nombre de mascota -> dueño (confirmadas)
    this.petMaybe = new Set();  // sospechosas, sin confirmar
    this.otherPets = new Map(); // mascota ajena -> dueño, sacado de su /pet who leader
    this.currentPet = null;     // la última vista: en EQL el nombre cambia por invocación
    this.pendingCrit = null;    // {t, source, amount}
    this.unrecognized = 0;
    this.parsed = 0;
    this.zone = null;
    this.stance = null;       // sólo existe en EQL
    this.invocation = null;
  }

  /** Devuelve un evento normalizado o null. `seq` desempata dentro del mismo segundo. */
  parse(line, seq = 0) {
    const head = parseHeader(line);
    if (!head) return null;
    const { t, body } = head;

    for (const hint of HINTS) {
      if (body.indexOf(hint) === -1) continue;
      for (const rule of RULES_BY_HINT.get(hint)) {
        const m = rule.re.exec(body);
        if (!m) continue;
        this.parsed++;
        const ev = { t, seq, kind: rule.kind, raw: body, ...rule.map(m) };
        // `what` distingue variantes dentro de un mismo `kind` sin multiplicar
        // los kinds: los avisos de supervivencia son todos 'survival' y se
        // separan por aquí. Va declarado en la regla, junto al kind, porque es
        // parte de qué ES la línea y no de lo que se extrae de ella.
        if (rule.what) ev.what = rule.what;
        return this.#post(ev);
      }
    }
    this.unrecognized++;
    return { t, seq, kind: 'unknown', raw: body };
  }

  /**
   * Tu mascota es la de AHORA, no todas las que has tenido.
   *
   * En EQL el nombre sale de una lista cerrada y se recicla entre jugadores: el
   * mismo nombre que fue tuyo hace cuatro horas puede ser el de la mascota de
   * otro cuando la tuya ya se llama de otra forma. Al no retirar nunca los
   * viejos, cualquier cosa que tocara ese nombre entraba en el filtro de
   * relevancia como tuya.
   *
   * Medido en un log real: `Jobarn` fue tuya a las 20:07 y a las 23:51
   * invocaste `Kabarer`. A las 00:01 apareció otro `Jobarn`, el de `Krumka`, y
   * se guardó una pelea entera en la que tú no estabas — su dueño, su mascota y
   * el enemigo— como si fuera tuya.
   *
   * Sólo se tiene una a la vez, así que confirmar una nueva retira la anterior.
   * Las tres señales que llegan aquí son inequívocas en el instante en que
   * ocurren: «My leader is <tú>», «told you 'Attacking… Master'» y tus propias
   * órdenes. Lo que se corrige no es la señal, es darla por buena para siempre.
   */
  #ownPet(name) {
    if (!name) return;
    if (this.currentPet && this.currentPet !== name) this.pets.delete(this.currentPet);
    this.pets.set(name, this.self ?? 'You');
    this.petMaybe.delete(name);
    this.currentPet = name;
  }

  /** Marca manual desde la interfaz, cuando el log no lo aclara. */
  markPet(name) {
    if (!name) return;
    this.pets.set(name, this.self ?? 'You');
    this.petMaybe.delete(name);
    this.currentPet = name;
  }
  unmarkPet(name) { this.pets.delete(name); this.petMaybe.delete(name); if (this.currentPet === name) this.currentPet = null; }

  #norm(name) {
    if (name == null) return null;
    if (name === 'You' || name === 'YOU' || name === 'you' || name === 'Yourself') {
      return this.self ?? 'You';
    }
    // EQ capitaliza al principio de frase: "A fire giant warrior" y
    // "a fire giant warrior" son el mismo enemigo. Sólo tocamos el artículo,
    // para no estropear nombres propios como "King Tranix".
    return name.replace(/^(An?|The) /, (m) => m.toLowerCase());
  }

  #post(ev) {
    // EQL marca el resultado entre paréntesis al final de la línea:
    // (Critical), (Riposte), (Flurry)… Sin esto los críticos no se contaban.
    if (ev.flag) {
      const f = ev.flag.toLowerCase();
      if (f.includes('critical')) ev.crit = true;
      if (f.includes('riposte')) ev.riposte = true;
      if (f.includes('flurry')) ev.flurry = true;
      if (f.includes('strikethrough')) ev.strikethrough = true;
    }

    // Damage shield EQL: "Xasaner is burned by a gorgon's flames for 12 points…"
    // El emisor va en posesivo dentro del efecto. Si no hay posesivo
    // (p.ej. "shards of ice") no hay forma de saber de quién es el DS.
    if (ev.kind === 'ds' || ev.kind === 'ds_nodmg') {
      const own = /^YOUR (.+)$/.exec(ev.effect ?? '');   // "YOUR thorns" -> tuyo
      const m = own ? null : /^(.+?)'s (.+)$/.exec(ev.effect ?? '');
      ev.source = own ? (this.self ?? 'You') : (m ? m[1] : 'Unknown');
      ev.ability = own ? own[1] : (m ? m[2] : ev.effect);
      ev.target = ev.victim;
      ev.confidence = (own || m) ? 'exact' : 'none';
    }

    // Todos los campos que pueden traer "You" deben normalizarse, no sólo
    // source y target: si no, tu muerte queda a nombre de un "You" fantasma.
    ev.source = this.#norm(ev.source);
    ev.target = this.#norm(ev.target);
    ev.victim = this.#norm(ev.victim);
    ev.killer = this.#norm(ev.killer);
    ev.caster = this.#norm(ev.caster);

    switch (ev.kind) {
      case 'zone':
        this.zone = ev.zone;
        break;

      case 'stance':
        if (ev.stance) this.stance = ev.stance;
        break;

      case 'invocation':
        if (ev.invocation) this.invocation = ev.invocation;
        break;

      case 'pet_claim':
        // Lo que te responde con "Master" obedece órdenes tuyas.
        this.#ownPet(ev.pet);
        break;

      case 'pet_order':
        // Tú le has dado la orden, así que es tuya.
        this.#ownPet(ev.pet);
        break;

      case 'pet_maybe':
        // Podría ser de otro jugador del grupo: se anota como candidata.
        this.petMaybe.add(ev.pet);
        break;

      case 'pet_leader':
        // La única fuente inequívoca de a quién pertenece una mascota.
        if (ev.leader === (this.self ?? 'You') || ev.leader === 'You') {
          this.#ownPet(ev.pet);
          this.otherPets.delete(ev.pet);
        } else {
          // Es de otro jugador: se anota para nombrarla bien y no preguntarla.
          this.otherPets.set(ev.pet, ev.leader);
          this.petMaybe.delete(ev.pet);
          this.pets.delete(ev.pet);
        }
        break;

      case 'cast':
        if (ev.ability) ev.castCat = classifySpell(ev.ability);
        this.recentCasts.push({ t: ev.t, source: ev.source, ability: ev.ability });
        if (this.recentCasts.length > 64) this.recentCasts.shift();
        break;

      case 'miss':
        ev.reason = normReason(ev.reason);
        break;

      case 'crit':
        // El crítico llega como línea aparte; se adjunta al siguiente golpe
        // del mismo actor con el mismo importe.
        this.pendingCrit = { t: ev.t, source: ev.source, amount: ev.amount };
        break;

      case 'melee':
      case 'dot':
      case 'ds':
        if (this.pendingCrit &&
            this.pendingCrit.source === ev.source &&
            ev.t - this.pendingCrit.t <= 1 &&
            (this.pendingCrit.amount === ev.amount || this.pendingCrit.amount === 0)) {
          ev.crit = true;
          this.pendingCrit = null;
        }
        break;

      case 'nonmelee_orphan': {
        // Atribución por correlación: el casteo más reciente dentro de ventana.
        // Es heurístico por diseño — el cliente no incluye el emisor en esta línea.
        const cand = this.#lastCast(ev.t);
        if (cand) {
          ev.source = cand.source;
          ev.ability = cand.ability;
          ev.confidence = 'inferred';
          ev.kind = 'spell';
        } else {
          ev.source = 'Unknown';
          ev.confidence = 'none';
          ev.kind = 'spell';
        }
        break;
      }
    }

    // La postura sólo se conoce para tu personaje: el log no dice la de los demás.
    const me = this.self ?? 'You';
    // También cuando el lanzador eres tú: en una resistencia, tu nombre viene
    // en `caster`, no en `source`, y sin esto no sabríamos con qué invocación
    // se lanzó el hechizo que te resistieron.
    if (ev.caster === me && !ev.invocation) ev.invocation = this.invocation;
    if (ev.caster === me && !ev.stance) ev.stance = this.stance;

    if (ev.source && ev.source === me) {
      ev.stance = ev.stance ?? this.stance;
      ev.invocation = ev.invocation ?? this.invocation;
      // Offensive duplica el melé: para comparar hay que descontar el bono.
      if (ev.amount && ev.school === 'melee') {
        const st = STANCES[normStance(this.stance)];
        ev.rawOut = st?.meleeBonus ? ev.amount / (1 + st.meleeBonus) : ev.amount;
      }
    }
    // El log guarda el daño YA mitigado. Se revierte para poder comparar
    // posturas sin sesgarse hacia la que ya llevabas puesta.
    if (ev.target === me && ev.amount) {
      ev.stanceAtHit = this.stance;
      const red = mitigationFor(this.stance, ev.school);
      ev.rawAmount = red > 0 && red < 1 ? ev.amount / (1 - red) : ev.amount;
    }
    // Aquí había un `ev.pet = dueño de ev.source`, que pisaba el nombre de la
    // mascota que traen los eventos pet_*. No lo leía nadie —quien mira si una
    // fila es mascota usa la marca de la fila, no la del evento— y dejaba una
    // trampa puesta para el siguiente que leyera `ev.pet` fuera del switch.
    return ev;
  }

  #lastCast(t) {
    for (let i = this.recentCasts.length - 1; i >= 0; i--) {
      const c = this.recentCasts[i];
      if (t - c.t > this.castWindow) return null;
      if (t >= c.t) return c;
    }
    return null;
  }
}
