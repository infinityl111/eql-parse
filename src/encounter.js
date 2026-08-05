import { EventEmitter } from 'node:events';

export const DAMAGE_KINDS = new Set(['melee', 'spell', 'dot', 'ds']);

function bucket(map, key) {
  let b = map.get(key);
  if (!b) { b = { n: 0, sum: 0, max: 0, min: Infinity, crits: 0 }; map.set(key, b); }
  return b;
}
function push(map, key, amt, crit) {
  const b = bucket(map, key);
  b.n++; b.sum += amt;
  if (amt > b.max) b.max = amt;
  if (amt < b.min) b.min = amt;
  if (crit) b.crits++;
  return b;
}
const sorted = (map) => [...map].sort((a, b) => b[1].sum - a[1].sum || b[1].n - a[1].n);

class Combatant {
  constructor(name) {
    this.name = name;

    // ofensiva
    this.damage = 0;
    this.hits = 0;
    this.meleeHits = 0;      // accuracy sólo cuenta swings, no hechizos
    this.misses = 0;
    this.crits = 0;
    this.critDamage = 0;
    this.flurries = 0;      // EQL: golpe extra
    this.ripostes = 0;      // golpe de contraataque
    this.healPotential = 0; // curación antes del tope (lo desperdiciado)
    this.max = 0;
    this.min = Infinity;
    this.byAbility = new Map();
    this.byTarget = new Map();
    this.bySchool = new Map();
    this.byType = new Map();     // EQL da el tipo: magic, cold, fire…
    this.byStance = new Map();   // sólo EQL
    this.byInvocation = new Map();
    this.missReasons = new Map();

    // defensiva
    this.taken = 0;
    this.swingsAgainst = 0;
    this.defense = new Map();    // parry / dodge / riposte / block que ha hecho
    this.takenByType = new Map();
    this.rawTakenByType = new Map();   // sin mitigar, para el consejo de postura
    this.rawMeleeOut = 0;              // melé propio sin el bono de Offensive
    this.takenBySource = new Map();
    this.deaths = 0;

    // curación
    this.healingDone = 0;
    this.healingTaken = 0;
    this.healBySpell = new Map();
    this.healByTarget = new Map();

    // actividad
    this.first = null;
    this.last = null;
    this.activeSeconds = new Set();
    this.hitSeconds = new Set();     // sólo cuando pegas: recibir no cuenta como actividad
  }

  #touch(t) {
    if (this.first === null) this.first = t;
    this.last = t;
    this.activeSeconds.add(t);
  }

  addDamage(ev) {
    const amt = ev.amount;
    this.hitSeconds.add(Math.round(ev.t));
    const type = ev.damageType ?? ev.school ?? 'other';
    this.damage += amt;
    this.hits++;
    if (ev.school === 'melee') this.meleeHits++;
    if (ev.crit) { this.crits++; this.critDamage += amt; }
    if (ev.rawOut) this.rawMeleeOut += ev.rawOut;
    if (ev.flurry) this.flurries++;
    if (ev.riposte) this.ripostes++;
    if (amt > this.max) this.max = amt;
    if (amt < this.min) this.min = amt;
    this.#touch(ev.t);

    const b = push(this.byAbility, ev.ability || ev.verb || ev.school || '?', amt, ev.crit);
    b.school = ev.school ?? '?';
    b.type = type;
    push(this.byTarget, ev.target ?? '?', amt, ev.crit);
    push(this.bySchool, ev.school ?? '?', amt, ev.crit);
    push(this.byType, type, amt, ev.crit);
    if (ev.stance) push(this.byStance, ev.stance, amt, ev.crit);
    if (ev.invocation) push(this.byInvocation, ev.invocation, amt, ev.crit);
  }

  addMissDealt(ev) {
    this.misses++;
    push(this.missReasons, ev.reason ?? 'fallo', 0, false);
    this.#touch(ev.t);
  }

  addTaken(ev) {
    this.taken += ev.amount;
    this.swingsAgainst++;
    push(this.takenByType, ev.damageType ?? ev.school ?? 'other', ev.amount, false);
    push(this.rawTakenByType, ev.school === 'melee' ? 'melee' : (ev.damageType ?? ev.school ?? 'other'), ev.rawAmount ?? ev.amount, false);
    push(this.takenBySource, ev.source ?? 'desconocido', ev.amount, false);
    this.#touch(ev.t);
  }

  addAvoided(ev) {
    this.swingsAgainst++;
    push(this.defense, ev.reason ?? 'fallo', 0, false);
  }

  addHealDone(ev) {
    this.healingDone += ev.amount;
    if (ev.potential) this.healPotential += ev.potential;
    push(this.healBySpell, ev.ability ?? 'cura', ev.amount, false);
    push(this.healByTarget, ev.target ?? '?', ev.amount, false);
    this.#touch(ev.t);
  }

  addHealTaken(ev) { this.healingTaken += ev.amount; }

  get accuracy() {
    const swings = this.meleeHits + this.misses;
    return swings ? this.meleeHits / swings : 0;
  }
  get avoidance() {
    return this.swingsAgainst ? [...this.defense.values()].reduce((a, b) => a + b.n, 0) / this.swingsAgainst : 0;
  }
  get critRate() { return this.hits ? this.crits / this.hits : 0; }
}

export class Encounter {
  constructor(id, startT, zone) {
    this.id = id;
    this.zone = zone;
    this.start = startT;
    this.end = startT;
    this.combatants = new Map();
    this.kills = [];
    this.closed = false;
    this.series = new Map();        // segundo -> {dmg, taken, heal} para la gráfica
    this.stanceSpans = [];          // [{from, to, stance}] franja de postura
    this.targetTotals = new Map();  // para nombrar la pelea
    this.deadAt = new Map();       // nombre -> segundo en que cayó
    this.loot = [];                // {item, from, sold, upgraded, t}
    this.spellVsFoe = new Map();   // 'enemigo|hechizo' -> {landed, resisted}
    this.targetFirst = new Map();  // nombre -> primer segundo en que le pegaron
    this.resistsSuffered = 0;
    this.casts = [];           // {t, source, ability, cat} — el análisis filtra por bando
    this.resistsCaused = 0;    // hechizos enemigos que TÚ resististe
    this.interrupts = 0;
    this.stancesSeen = new Set();
    this.invocationsSeen = new Set();
  }

  /** Acumula por segundo relativo al inicio. */
  tick(t, field, amount) {
    const k = Math.max(0, Math.round(t - this.start));
    let b = this.series.get(k);
    if (!b) b = { s: k, dmg: 0, taken: 0, heal: 0, tMelee: 0, tSpell: 0, mine: 0 };
    this.series.set(k, b);
    b[field] += amount;
  }

  markStance(t, stance) {
    const k = Math.max(0, Math.round(t - this.start));
    const last = this.stanceSpans[this.stanceSpans.length - 1];
    if (last && last.stance === stance) return;
    if (last) last.to = k;
    this.stanceSpans.push({ from: k, to: k, stance });
  }

  actor(name) {
    let c = this.combatants.get(name);
    if (!c) { c = new Combatant(name); this.combatants.set(name, c); }
    return c;
  }

  /**
   * Convenciones de duración. Importa en peleas cortas:
   *  span      = último - primero        (en pelea de 1s da 0 -> DPS infinito)
   *  inclusive = span + 1                (GamParse/ACT, la comparable)
   */
  durations() {
    const span = Math.max(0, this.end - this.start);
    return { span, inclusive: span + 1 };
  }

  #row(c, inclusive) {
    const own = (c.last ?? 0) - (c.first ?? 0) + 1;
    return {
      name: c.name,
      damage: c.damage,
      dps: c.damage / inclusive,
      dpsOwn: c.damage / own,
      dpsActive: c.damage / Math.max(1, c.activeSeconds.size),
      hits: c.hits, meleeHits: c.meleeHits, misses: c.misses,
      crits: c.crits, critDamage: c.critDamage, critRate: c.critRate,
      flurries: c.flurries, ripostes: c.ripostes, healPotential: c.healPotential,
      max: c.max, min: c.min === Infinity ? 0 : c.min,
      accuracy: c.accuracy, avoidance: c.avoidance,
      taken: c.taken, swingsAgainst: c.swingsAgainst, deaths: c.deaths,
      healingDone: c.healingDone, healingTaken: c.healingTaken,
      activeSec: c.activeSeconds.size, hitSec: c.hitSeconds.size, ownSec: own,
      byAbility: sorted(c.byAbility), byTarget: sorted(c.byTarget),
      bySchool: sorted(c.bySchool), byType: sorted(c.byType),
      byStance: sorted(c.byStance), byInvocation: sorted(c.byInvocation),
      missReasons: [...c.missReasons].sort((a, b) => b[1].n - a[1].n),
      defense: [...c.defense].sort((a, b) => b[1].n - a[1].n),
      takenByType: sorted(c.takenByType), takenBySource: sorted(c.takenBySource),
      rawTakenByType: sorted(c.rawTakenByType), rawMeleeOut: c.rawMeleeOut,
      healBySpell: sorted(c.healBySpell), healByTarget: sorted(c.healByTarget),
    };
  }

  totals() {
    const { inclusive } = this.durations();
    const rows = [];
    let total = 0, healing = 0;
    for (const c of this.combatants.values()) {
      if (c.damage <= 0 && c.healingDone <= 0 && c.taken <= 0) continue;
      total += c.damage;
      healing += c.healingDone;
      rows.push(this.#row(c, inclusive));
    }
    rows.sort((a, b) => b.damage - a.damage || b.healingDone - a.healingDone);
    for (const r of rows) r.share = total ? r.damage / total : 0;
    return { rows, total, healing, duration: inclusive, raidDps: total / inclusive };
  }
}

export class EncounterTracker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.self = opts.self ?? null;
    this.petNames = new Set();
    this.idleSec = opts.idleSec ?? 20;
    this.closeOnDeath = opts.closeOnDeath ?? false;
    this.current = null;
    this.history = [];
    this.nextId = 1;
    this.zone = null;
  }

  feed(ev) {
    if (!ev) return;
    if (ev.kind === 'zone') { this.zone = ev.zone; this.#close(); return; }

    // Señales que alimentan el consejo de invocación. No abren pelea por sí solas.
    if (this.current) {
      // Sólo cuenta como resistencia sufrida si el lanzador eras tú o tu mascota.
      if (ev.kind === 'resist') {
        if (ev.caster === this.self || this.petNames?.has(ev.caster)) {
          this.current.resistsSuffered++;
          // Contra QUIÉN y con QUÉ hechizo: es lo que permite saber después a
          // qué es resistente cada bicho, medido en tus propias peleas.
          this.#tally(this.current, ev.target, ev.ability, 'resisted', ev.invocation);
        }
      } else if (ev.kind === 'resist_by_you') this.current.resistsCaused++;
      else if (ev.kind === 'interrupt') this.current.interrupts++;
      else if (ev.kind === 'cast' && ev.ability && ev.castCat && ev.source) {
        this.current.casts.push({ t: Math.round(ev.t - this.current.start), source: ev.source, ability: ev.ability, cat: ev.castCat });
      }
      else if (ev.kind === 'stance' && ev.stance) this.current.stancesSeen.add(ev.stance);
      // Un hechizo tuyo que sí entró, para saber la proporción.
      if (ev.kind === 'spell' && ev.ability && ev.target && ev.source === this.self) {
        this.#tally(this.current, ev.target, ev.ability, 'landed', ev.invocation);
      }
      else if (ev.kind === 'invocation' && ev.invocation) this.current.invocationsSeen.add(ev.invocation);
    }

    // El botín llega tras la muerte, dentro de la ventana de la pelea.
    if (ev.kind === 'loot' && ev.item && this.current) {
      this.current.loot.push({
        item: ev.item, from: ev.from ?? null,
        sold: ev.sold ?? null, upgraded: ev.upgraded ?? null,
        t: Math.max(0, Math.round(ev.t - this.current.start)),
      });
    }

    const isCombat = DAMAGE_KINDS.has(ev.kind) || ev.kind === 'miss' || ev.kind === 'heal' || ev.kind === 'death';
    if (!isCombat) return;

    if (Number.isFinite(this.idleSec) && this.current && ev.t - this.current.end > this.idleSec) this.#close();
    if (!this.current) {
      this.current = new Encounter(this.nextId++, ev.t, this.zone);
      this.emit('open', this.current);
    }
    const enc = this.current;
    enc.end = Math.max(enc.end, ev.t);

    if (DAMAGE_KINDS.has(ev.kind) && ev.amount > 0) {
      if (ev.source) enc.actor(ev.source).addDamage(ev);
      if (ev.target) enc.actor(ev.target).addTaken(ev);
      enc.tick(ev.t, 'dmg', ev.amount);
      if (ev.source === this.self) enc.tick(ev.t, 'mine', ev.amount);
      if (ev.target === this.self) {
        // Bruto y separado por escuela: sin esto no se puede juzgar la
        // postura tramo a tramo, sólo la media de toda la pelea.
        const raw = ev.rawAmount ?? ev.amount;
        enc.tick(ev.t, 'taken', ev.amount);
        enc.tick(ev.t, ev.school === 'melee' ? 'tMelee' : 'tSpell', raw);
      }
      if (ev.target) {
        const b = enc.targetTotals.get(ev.target) ?? 0;
        enc.targetTotals.set(ev.target, b + ev.amount);
        if (!enc.targetFirst.has(ev.target)) enc.targetFirst.set(ev.target, ev.t);
      }
      if (ev.stance) enc.markStance(ev.t, ev.stance);
    } else if (ev.kind === 'miss') {
      if (ev.source) enc.actor(ev.source).addMissDealt(ev);
      if (ev.target) enc.actor(ev.target).addAvoided(ev);
    } else if (ev.kind === 'heal' && ev.amount > 0) {
      enc.tick(ev.t, 'heal', ev.amount);
      if (ev.source) enc.actor(ev.source).addHealDone(ev);
      if (ev.target) enc.actor(ev.target).addHealTaken(ev);
    } else if (ev.kind === 'death') {
      enc.kills.push({ t: ev.t, victim: ev.victim, killer: ev.killer });
      if (ev.victim) enc.deadAt.set(ev.victim, Math.max(0, Math.round(ev.t - enc.start)));
      if (ev.victim) enc.actor(ev.victim).deaths++;
      if (this.closeOnDeath) this.#close();
      return;
    }
    this.emit('update', enc, ev);
  }

  tick(nowSec) {
    if (!Number.isFinite(this.idleSec)) return;   // acumulador de sesión: no se cierra
    if (this.current && nowSec - this.current.end > this.idleSec) this.#close();
  }

  /** Anota si un hechizo tuyo entró o fue resistido contra ese enemigo. */
  #tally(enc, foe, spell, field, inv = null) {
    if (!enc || !foe || !spell) return;
    // La invocación forma parte de la clave: Over Channel resta 150 a la
    // resistencia del objetivo, así que mezclar intentos con y sin ella daría
    // una media que no describe ninguna de las dos situaciones.
    const k = `${foe}\u0000${spell}\u0000${inv ?? ''}`;
    const e = enc.spellVsFoe.get(k) ?? { foe, spell, inv: inv ?? null, landed: 0, resisted: 0 };
    e[field] += 1;
    enc.spellVsFoe.set(k, e);
  }

  #close() {
    if (!this.current) return;
    const enc = this.current;
    enc.closed = true;
    this.current = null;
    this.history.push(enc);
    if (this.history.length > 200) this.history.shift();
    this.emit('close', enc);
  }
}
