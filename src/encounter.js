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
  constructor(id, startT, zone, ctx = {}) {
    this.id = id;
    this.zone = zone;
    // Nivel y clases EN ESTA PELEA, no los de ahora. En EQL el nivel efectivo
    // es el de la clase más baja del trío, así que meter una clase baja te
    // baja el nivel entero: medido en un log real, la mediana de dps cayó de
    // 127 a 44 al pasar de nivel 50 a 25. Comparar peleas de los dos periodos
    // sin distinguirlos no informa de nada.
    //
    // Si no se sabe, se queda en null y se dice. No se hereda hacia atrás: las
    // peleas anteriores al primer /who no tienen nivel conocido, y fingir que
    // sí sería justo lo que este programa no hace.
    this.level = ctx.level ?? null;
    this.classes = ctx.classes ?? null;
    this.start = startT;
    this.end = startT;
    this.combatants = new Map();
    this.kills = [];
    this.closed = false;
    this.series = new Map();        // segundo -> {dmg, taken, heal} para la gráfica
    this.stanceSpans = [];          // [{from, to, stance}] franja de postura
    this.targetTotals = new Map();  // para nombrar la pelea
    this.deadAt = new Map();       // nombre -> segundo en que cayó
    // Lo que costó tumbar a cada enemigo, una muestra por muerte. Se anota al
    // caer y no al acabar la pelea: si el mismo enemigo cae tres veces, sumar el
    // daño de las tres y llamarlo «su vida» la triplica.
    // Y se le descuenta lo que le curaron: la muestra es daño MENOS curación,
    // no daño a secas. Un enemigo al que sanan 5.000 por el camino no tiene
    // 5.000 puntos de vida más, y contarlos así se los inventa. Medido sobre un
    // log real, le cambia la cifra a 59 de 147 enemigos —un 3,9% menos en
    // total— y a los que más, los que van con sanador: `the Spiroc Guardian`
    // un 17% y `a scareling` un 17%.
    this.hpSamples = new Map();    // nombre -> [(daño - curación) hasta cada muerte]
    this.deathBase = new Map();    // nombre -> daño acumulado en su muerte anterior
    this.healTotals = new Map();   // nombre -> curación recibida en la pelea
    this.healBase = new Map();     // nombre -> curación recibida en su muerte anterior
    // Daño real que no se puede atribuir a nadie: escudos sin posesivo
    // («shards of ice»). No entra en el total de nadie ni en el del grupo.
    this.unattributed = 0;
    this.loot = [];                // {item, from, sold, upgraded, t}
    this.spellVsFoe = new Map();   // 'enemigo|hechizo' -> {landed, resisted}
    this.foesSeen = new Set();     // a quién estáis pegando en esta pelea
    // A quién habéis hecho daño, y sólo eso. `foesSeen` no sirve para esto:
    // se llena también con los destinos de vuestras curaciones, así que curar
    // a un compañero lo metería aquí y su curación de vuelta se confundiría
    // con una sanguijuela. Separados a propósito.
    this.golpeados = new Set();
    /** Curaciones tuyas que el log atribuyó al enemigo que las provocó. */
    this.lifetaps = 0;
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
    // Objetos recogidos sin ninguna pelea abierta a la que atribuirlos.
    this.lootSinPelea = 0;
    // Los pone el motor según van llegando los hitos: /who y subidas de nivel.
    // Cada pelea se queda con los que hubiera al abrirse.
    this.level = null;
    this.classes = null;
  }

  feed(ev) {
    if (!ev) return;
    if (ev.kind === 'zone') { this.zone = ev.zone; this.#close(); return; }
    // Una subárea NO es un cambio de zona: «You have entered an area where
    // levitation effects do not function» pasa dentro del Plano del Cielo y,
    // tratándola como zona, se llevaba por delante la zona real y su
    // dificultad. Se anota por si sirve, pero no cierra la pelea ni sustituye
    // nada.
    if (ev.kind === 'subarea') { this.subarea = ev.area; return; }

    // Señales que alimentan el consejo de invocación. No abren pelea por sí solas.
    if (this.current) {
      // Sólo cuenta como resistencia sufrida si el lanzador eras tú o tu mascota.
      if (ev.kind === 'resist') {
        if (this.#mine().has(ev.caster)) {
          this.current.resistsSuffered++;
          // Contra QUIÉN y con QUÉ hechizo: es lo que permite saber después a
          // qué es resistente cada enemigo, medido en tus propias peleas.
          this.#tally(this.current, ev.target, ev.ability, 'resisted', ev.invocation);
        }
      } else if (ev.kind === 'resist_by_you') this.current.resistsCaused++;
      else if (ev.kind === 'interrupt') this.current.interrupts++;
      else if (ev.kind === 'cast' && ev.ability && ev.castCat && ev.source) {
        this.current.casts.push({ t: Math.round(ev.t - this.current.start), source: ev.source, ability: ev.ability, cat: ev.castCat });
      }
      else if (ev.kind === 'stance' && ev.stance) this.current.stancesSeen.add(ev.stance);
      else if (ev.kind === 'invocation' && ev.invocation) this.current.invocationsSeen.add(ev.invocation);
    }

    // El botín llega tras la muerte, dentro de la ventana de la pelea.
    //
    // `qty` viaja con el objeto en vez de expandirse en dos entradas iguales:
    // «2 Bone Chips» es una recogida de dos unidades, no dos recogidas, y la
    // diferencia importa al contar de cuántos cadáveres ha salido algo.
    if (ev.kind === 'loot' && ev.item && this.current) {
      this.current.loot.push({
        item: ev.item, qty: ev.qty ?? 1, from: ev.from ?? null,
        sold: ev.sold ?? null, upgraded: ev.upgraded ?? null,
        stored: ev.stored ?? false,
        t: Math.max(0, Math.round(ev.t - this.current.start)),
      });
    } else if (ev.kind === 'loot' && ev.item) {
      // Sin pelea abierta no hay dónde guardarlo. Pasa cuando al enemigo lo
      // mata entero un compañero declarado: el filtro de relevancia sólo abre
      // pelea contigo o con tus mascotas, así que ese cadáver nunca tuvo una.
      // Se cuenta para poder decir cuánto se pierde, porque una lista de botín
      // con huecos silenciosos es peor que una con huecos anunciados.
      this.lootSinPelea++;
    }

    const isCombat = DAMAGE_KINDS.has(ev.kind) || ev.kind === 'miss' || ev.kind === 'heal' || ev.kind === 'death';
    if (!isCombat) return;

    // ── Filtro de relevancia ──────────────────────────────────────────────
    //
    // El log ve TODO lo que pasa a tu alrededor, incluido un desconocido
    // matando enemigos a diez metros. Sin este filtro su pelea entra en la tuya
    // y falsea el reparto entero.
    //
    // Cuenta un suceso si toca a los tuyos (tú o tus mascotas) o a alguien a
    // quien los tuyos ya estáis pegando. Con eso los compañeros de grupo
    // entran solos al golpear vuestro objetivo, y el de al lado no.
    const mine = this.#mine();
    // Sin saber quién eres no hay nada que filtrar: se acepta todo antes que
    // descartar la pelea entera. Pasa en pruebas y si el personaje aún no se
    // ha deducido del nombre del fichero.
    const rel = (n) => n && (mine.has(n) || this.current?.foesSeen?.has(n));
    // Las muertes no traen `source` ni `target`, sino `victim` y `killer`: hay
    // que mirar los cuatro. Mirando sólo los dos primeros se descartaban TODAS
    // las muertes, y con ellas los abatidos, las bajas, el nombre de la pelea y
    // la vida estimada del enemigo, que se deduce de lo que costó tumbarlo.
    //
    // Y en una muerte cuenta también quien ya esté peleando: un compañero de
    // grupo no es tuyo ni es enemigo, así que sin esto su caída no se contaba
    // aunque llevara toda la pelea pegando a tu objetivo.
    const enPelea = (nm) => nm && !!this.current?.combatants?.has(nm);
    const relevante = ev.kind === 'death'
      ? (rel(ev.victim) || rel(ev.killer) || enPelea(ev.victim) || enPelea(ev.killer))
      : (rel(ev.source) || rel(ev.target));
    if (mine.size && !relevante) return;

    // Y una pelea sólo se abre cuando estáis metidos vosotros.
    if (Number.isFinite(this.idleSec) && this.current && ev.t - this.current.end > this.idleSec) this.#close();
    if (!this.current) {
      // Una muerte suelta no abre pelea: sin golpes previos no hay nada que
      // contar, y la de un desconocido a diez metros no es asunto tuyo.
      if (ev.kind === 'death') return;
      if (mine.size && !mine.has(ev.source) && !mine.has(ev.target)) return;
      this.current = new Encounter(this.nextId++, ev.t, this.zone,
        { level: this.level ?? null, classes: this.classes ?? null });
      this.emit('open', this.current);
    }

    // A quién estáis pegando: define qué es «vuestra» pelea a partir de ahora.
    if (ev.amount > 0 && ev.target && mine.has(ev.source)) this.current.foesSeen.add(ev.target);
    if (ev.amount > 0 && ev.source && mine.has(ev.target)) this.current.foesSeen.add(ev.source);
    const enc = this.current;
    enc.end = Math.max(enc.end, ev.t);

    if (DAMAGE_KINDS.has(ev.kind) && ev.amount > 0) {
      // Un escudo de daño sin posesivo no dice de quién es. Adjudicárselo a un
      // combatiente llamado «Unknown» lo metía en el total del grupo y diluía
      // el porcentaje de todos los demás: se aparta, que es lo que promete el
      // README, y el que lo recibe sí lo contabiliza.
      const huerfano = ev.confidence === 'none' && ev.source === 'Unknown';
      if (huerfano) enc.unattributed += ev.amount;
      else if (ev.source) enc.actor(ev.source).addDamage(ev);
      if (ev.target) enc.actor(ev.target).addTaken(ev);
      if (!huerfano) enc.tick(ev.t, 'dmg', ev.amount);
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
      if (ev.target && mine.has(ev.source)) enc.golpeados.add(ev.target);
      // Un hechizo vuestro que sí entró, para saber la proporción contra ese
      // enemigo. Va AQUÍ y no en el bloque de señales de arriba porque aquél
      // exige que la pelea ya esté abierta, y el primer hechizo de la pelea es
      // justo el que la abre: se perdía siempre, y como las resistencias no
      // abren pelea, el porcentaje de resistencia salía inflado.
      //
      // Cuenta tú y tus mascotas, igual que el lado de las resistencias. Antes
      // sólo contaba lo tuyo, así que todo lo que lanzara la mascota salía con
      // 0 aciertos y N resistencias: un 100% de resistencia que no existía.
      if (ev.kind === 'spell' && ev.ability && ev.target && mine.has(ev.source)) {
        this.#tally(enc, ev.target, ev.ability, 'landed', ev.invocation);
      }
      if (ev.stance) enc.markStance(ev.t, ev.stance);
    } else if (ev.kind === 'miss') {
      if (ev.source) enc.actor(ev.source).addMissDealt(ev);
      if (ev.target) enc.actor(ev.target).addAvoided(ev);
    } else if (ev.kind === 'heal' && ev.amount > 0) {
      // ── Sanguijuela: el log pone al ENEMIGO de sanador ──────────────────
      //
      // «Lord Nagafen has taken 451 damage from your Harm Touch X.» y, en el
      // mismo segundo, «Lord Nagafen healed you for 451 hit points by Leech
      // Touch I.» — el drenaje te devuelve lo que hizo tu golpe, y el cliente
      // nombra sanador al que lo recibió. Son 321 líneas en un log real, y
      // engordaban la curación hecha por cada jefe con la tuya propia.
      //
      // El discriminador es el daño y no la habilidad: si el que «te cura» es
      // alguien a quien acabáis de pegar, la curación es tuya. Medido, separa
      // las dos poblaciones sin solaparse — las 321 sanguijuelas vienen todas
      // de un enemigo, y las 25 curaciones de verdad, todas de un compañero al
      // que nadie estaba pegando.
      const sanguijuela = ev.target === this.self
        && ev.source && ev.source !== this.self && enc.golpeados.has(ev.source);
      const quienCura = sanguijuela ? this.self : ev.source;
      if (sanguijuela) enc.lifetaps++;
      enc.tick(ev.t, 'heal', ev.amount);
      if (quienCura) enc.actor(quienCura).addHealDone({ ...ev, source: quienCura });
      if (ev.target) {
        enc.actor(ev.target).addHealTaken(ev);
        enc.healTotals.set(ev.target, (enc.healTotals.get(ev.target) ?? 0) + ev.amount);
      }
    } else if (ev.kind === 'death') {
      enc.kills.push({ t: ev.t, victim: ev.victim, killer: ev.killer });
      if (ev.victim) {
        enc.deadAt.set(ev.victim, Math.max(0, Math.round(ev.t - enc.start)));
        enc.actor(ev.victim).deaths++;
        // Lo que costó ESTA muerte: el daño acumulado contra él menos el que ya
        // llevaba cuando cayó la vez anterior. Sin restar, matar tres veces al
        // mismo enemigo daba una «vida» del triple.
        //
        // Y menos lo que le curaron en ese mismo tramo, por la misma razón que
        // se resta la muerte anterior: no es vida suya, es daño deshecho. La
        // resta va tramo a tramo y no repartida entre las muertes, que sería
        // una aproximación pudiendo tenerlo exacto.
        const acumulado = enc.targetTotals.get(ev.victim) ?? 0;
        const curado = enc.healTotals.get(ev.victim) ?? 0;
        const coste = (acumulado - (enc.deathBase.get(ev.victim) ?? 0))
          - (curado - (enc.healBase.get(ev.victim) ?? 0));
        if (coste > 0) {
          const muestras = enc.hpSamples.get(ev.victim) ?? [];
          muestras.push(Math.round(coste));
          enc.hpSamples.set(ev.victim, muestras);
        }
        enc.deathBase.set(ev.victim, acumulado);
        enc.healBase.set(ev.victim, curado);
      }
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

  /** Tú y tus mascotas. */
  #mine() {
    const m = new Set(this.petNames ?? []);
    if (this.self) m.add(this.self);
    return m;
  }

  #close() {
    if (!this.current) return;
    // Si la pelea empezó antes de saber la zona, se pone la conocida al cerrar.
    if (!this.current.zone && this.zone) this.current.zone = this.zone;
    const enc = this.current;
    enc.closed = true;
    this.current = null;
    this.history.push(enc);
    if (this.history.length > 200) this.history.shift();
    this.emit('close', enc);
  }
}
