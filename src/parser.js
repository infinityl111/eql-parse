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

/** «himself», «itself»… El log los usa como destino de una curación propia. */
const REFLEXIVO = /^(?:himself|herself|itself|themselves)$/i;

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
    // Los encantados: nombre -> LISTA de ventanas { desde, hasta }. Aparte de
    // `pets` porque un encantado es tuyo DURANTE UN RATO y luego vuelve a ser
    // enemigo, con el mismo nombre; una mascota invocada no hace eso.
    //
    // Y una lista, no una ventana suelta: al mismo bicho lo encantas varias
    // veces. En el registro de referencia hay cuatro encantos sobre tres
    // nombres, y guardando sólo la última el primero de «a hardened skeleton»
    // se perdía —dos peleas distintas, con veinte minutos de por medio—.
    this.charmed = new Map();
    this.manualPets = new Set(); // las que has dicho tú: mandan sobre lo detectado
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
  #ownPet(nombre) {
    // Normalizado como cualquier otro nombre. Sin esto, «A hardened skeleton»
    // —que es como EQ lo escribe al empezar la frase de «told you… Master»—
    // se guardaba con la mayúscula y no casaba con sus propias filas de
    // combate, que van en minúscula. Medido: el encantado salía en la lista
    // de mascotas y no se le atribuía ni un golpe.
    const name = this.#norm(nombre);
    if (!name) return;
    // Retirar la anterior es correcto —sólo se tiene una a la vez— salvo que la
    // hubieras puesto TÚ. Lo que dices a mano no lo deshace una detección: si
    // el registro se contradice contigo, gana lo que has dicho, y para quitarla
    // hay un control en su fila. Sin esta excepción, marcar una mascota y que
    // llegara un «My leader is» de otra la desmarcaba sola y sin avisar.
    if (this.currentPet && this.currentPet !== name && !this.manualPets.has(this.currentPet)) {
      this.pets.delete(this.currentPet);
    }
    this.pets.set(name, this.self ?? 'You');
    this.petMaybe.delete(name);
    this.currentPet = name;
  }

  /**
   * Abre la ventana del encanto: a partir de aquí pelea para ti.
   *
   * El registro lo dice con todas las letras —«X has been charmed.»— así que
   * esto es MEDIDO, no deducido. Lo que no dice es CUÁL de los X, si hay dos
   * con el mismo nombre; eso se resuelve por objetivo, no aquí.
   */
  #charmOn(nombre, t) {
    const name = this.#norm(nombre);
    if (!name) return;
    if (!this.charmed.has(name)) this.charmed.set(name, []);
    const v = this.charmed.get(name);
    // Si quedaba una abierta, encantarlo otra vez la cierra: no puede estar
    // encantado dos veces a la vez.
    const ultima = v.at(-1);
    if (ultima && ultima.hasta === null) ultima.hasta = t ?? 0;
    v.push({ desde: t ?? 0, hasta: null });
  }

  /**
   * Y la cierra: «Your Charm spell has worn off of X.», o su muerte.
   *
   * Cerrarla importa más que abrirla. Sin esto el bicho seguía contando como
   * tuyo el resto de la pelea, así que lo que te pegaba después de soltarse
   * caía en el cajón de los tuyos. En el registro de referencia los cuatro
   * encantos tienen final: dos por este aviso y dos porque el bicho muere.
   * Con n=4 no se puede afirmar que SIEMPRE haya aviso, y por eso la muerte
   * cierra también: dos caminos para no depender de uno.
   */
  #charmOff(nombre, t) {
    const name = this.#norm(nombre);
    const v = name && this.charmed.get(name);
    const ultima = v && v.at(-1);
    if (!ultima || ultima.hasta !== null) return;
    ultima.hasta = t ?? 0;
  }

  /** ¿Estaba encantado en este instante? */
  charmedAt(nombre, t) {
    const v = this.charmed.get(this.#norm(nombre));
    if (!v) return false;
    return v.some((c) => t >= c.desde && (c.hasta === null || t <= c.hasta));
  }

  /**
   * Marca manual desde la interfaz, cuando el registro no lo aclara.
   *
   * `manualPets` es lo que has dicho tú, y se guarda aparte de lo detectado
   * porque manda sobre ello: ni la detección la retira ni se pierde al invocar
   * otra. Es reversible con `unmarkPet`, que es el mismo camino al revés.
   */
  markPet(name) {
    if (!name) return;
    this.pets.set(name, this.self ?? 'You');
    this.manualPets.add(name);
    this.petMaybe.delete(name);
    this.currentPet = name;
  }

  /** Y el camino de vuelta, que es lo que hace reversible lo de arriba. */
  unmarkPet(name) {
    if (!name) return;
    this.pets.delete(name);
    this.manualPets.delete(name);
    this.petMaybe.delete(name);
    if (this.currentPet === name) this.currentPet = null;
  }

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


    // ¿Estaban encantados en este instante? El analizador sólo dice eso; de
    // decidir el bando se encarga el encuentro, que es quien sabe qué es tuyo.
    if (this.charmed.size) {
      if (ev.source && this.charmedAt(ev.source, ev.t)) ev.charmSrc = true;
      if (ev.target && this.charmedAt(ev.target, ev.t)) ev.charmTgt = true;
    }

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
        //
        // Salvo si es un encantado: responde «Master» igual que una mascota
        // invocada, pero NO ocupa su sitio. Medido en un registro real: al
        // encantar, `Kabarer` —la mascota de verdad— desaparecía de la lista,
        // porque `#ownPet` retira la anterior. Se tiene una invocada y todos
        // los encantados que te duren.
        if (this.charmedAt(ev.pet, ev.t)) break;
        this.#ownPet(ev.pet);
        break;

      case 'charm_on':
        this.#charmOn(ev.target, ev.t);
        break;

      case 'charm_off':
        this.#charmOff(ev.target, ev.t);
        break;

      case 'death':
        // Morirse también cierra el encanto, y hace falta: de los cuatro del
        // registro de referencia, dos acabaron así y nunca dieron el aviso de
        // «worn off». Depender sólo del aviso dejaría la ventana abierta para
        // siempre en la mitad de los casos.
        this.#charmOff(ev.victim, ev.t);
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

      // ═══ CURACIÓN: dos nombres que no son de nadie ═══
      //
      // El destino de una curación llega de dos formas que no son combatientes,
      // y las dos acababan en la tabla «a quién has curado» de la ficha, con
      // aspecto de dato medido. Contadas en un log real de 278.299 líneas:
      //
      //   1.126  «You healed Campeon over time for 153 …» — el sufijo es del
      //          tic de una curación con duración, no parte del nombre. Partía
      //          a cada objetivo en dos: «Campeon» y «Campeon over time», éste
      //          con 147.772 pv repartidos por 105 peleas.
      //   1.131  «a worry wraith pet healed himself for 613 …» — el pronombre
      //          es quien cura, no un combatiente nuevo. Al perderse, la
      //          autocuración de un enemigo no llegaba nunca al enemigo.
      //
      // El orden importa: existen las dos juntas —«healed itself over time»,
      // 43 veces— así que primero se quita el sufijo y luego se resuelve el
      // pronombre. Al revés, «itself over time» no casaría con el pronombre.
      case 'heal':
        if (typeof ev.target === 'string' && / over time$/.test(ev.target)) {
          // Se marca en vez de perderse: que la curación fuera un tic es un
          // dato del hechizo, y es lo que distingue un HoT de una cura directa.
          ev.overTime = true;
          ev.target = this.#norm(ev.target.replace(/ over time$/, ''));
        }
        if (REFLEXIVO.test(ev.target ?? '')) ev.target = ev.source;
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
