import { EventEmitter } from 'node:events';
import { SIN_MITIGACION } from './stances.js';

/**
 * En cuál de los tres cubos cae un golpe que recibes, EN UN SOLO SITIO.
 *
 * Melé, mágico, y lo que ninguna postura para. La tercera categoría no es un
 * matiz: si el daño periódico y el escudo caen en el cubo mágico, cualquiera
 * que mire la serie para preguntar «¿qué me está entrando?» concluye que es
 * mágico y decide con eso —cortar una fase, recomendar una postura— sobre un
 * daño que ninguna postura toca.
 *
 * Y sale de `SIN_MITIGACION`, la misma lista que usan el analizador al revertir,
 * el almacén al corregir lo guardado y el consejero al puntuar. Un cuarto
 * criterio propio aquí sería el cuarto sitio donde discrepar.
 */
export const cuboRecibido = (school) => (school === 'melee' ? 'tMelee'
  : (SIN_MITIGACION.has(school) ? 'tUnmit' : 'tSpell'));

export const DAMAGE_KINDS = new Set(['melee', 'spell', 'dot', 'ds']);

/**
 * CUÁNTO TIEMPO SIGUE SIENDO SAQUEABLE UN CADÁVER. 10 minutos.
 *
 * No es un número redondo elegido a ojo: sale de medir el hueco entre cada
 * recogida y la muerte más reciente de ese mismo nombre, sobre las 1.870 líneas
 * de botín de un registro real de 55 MB.
 *
 *   mediana 0 s · p90 8 s · p95 14 s · p99 42 s · p99,5 96 s
 *   dentro de 600 s: 1.865 de 1.870 (99,73%)
 *
 * Y LO QUE DECIDE EL NÚMERO ES EL HUECO QUE VIENE DESPUÉS: entre 600 s y 44.062
 * s no hay ni una sola recogida. Ninguna. Las cinco que quedan fuera están
 * TODAS a más de doce horas, que es un bicho con el mismo nombre muerto al día
 * siguiente — un emparejamiento falso, no un saqueo tardío. Cualquier tope
 * entre 10 minutos y 12 horas da exactamente la misma respuesta; se elige el
 * borde de abajo porque es el que menos falsos deja pasar el día que el
 * histórico crezca.
 */
export const VENTANA_CADAVER = 600;

/**
 * CUÁNDO DOS CADÁVERES DEL MISMO NOMBRE SON DE VERDAD INDISTINGUIBLES. 30 s.
 *
 * «Hay otro bicho con ese nombre muerto hace un rato» NO es una ambigüedad: es
 * lo normal, pasa en el 32% de las recogidas, y marcarlo todo dejaría la ficha
 * llena de dudas que no lo son. Lo que hace dudosa una elección es que el otro
 * candidato esté TAN CERCA como el elegido.
 *
 * Medido sobre las 1.875 recogidas del registro de referencia, las dos
 * poblaciones no se tocan:
 *
 *   de la recogida al cadáver elegido        mediana 0 s · p90 7 s · p99 29 s
 *   del elegido al competidor de otra pelea  MÍNIMO 30 s · mediana 267 s
 *
 * Ni un solo competidor a menos de 30 segundos. Entre «el cadáver que acabas de
 * saquear» y «el de la pelea de antes» hay medio minuto de margen limpio, así
 * que quedarse con el más reciente no es echarlo a suertes.
 *
 * Con este tope se marcan 3 recogidas de 1.875 —el 0,2%— y son las únicas donde
 * la regla podría estar eligiendo mal. Ése es el número que la ficha puede
 * enseñar sin mentir, y el que se pierde si se marca todo.
 */
export const AMBIGUO_SEG = 30;

/**
 * El nombre de un cadáver, para poder emparejarlo con su muerte.
 *
 * Dos cosas y ninguna más, porque cada normalización de más es un
 * emparejamiento falso esperando su turno:
 *
 *   minúsculas   la muerte abre frase —«A zol ghoul knight has been slain»— y
 *                la recogida va a mitad —«from a zol ghoul knight's corpse»—.
 *                El juego capitaliza la primera, así que sin esto no casan.
 *   el artículo  por lo mismo: «orc legionnaire» y «an orc legionnaire»
 *                aparecen los dos, y son el mismo bicho.
 */
export const nombreCadaver = (s) => String(s ?? '').toLowerCase().trim()
  .replace(/^(?:an?|the)\s+/, '');

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

/**
 * LA FORMA DEL GOLPE, y por qué no basta con el mínimo y el máximo.
 *
 * El mínimo y el máximo de un ataque son los dos únicos números de su fila que
 * UN SOLO golpe raro puede mover: son muestras de n=1. Medido sobre el registro
 * de referencia, `a zol ghoul knight · hits` con n=557 da 3 / 25 / 60 — el
 * mínimo es 0,12× la mediana. Decir «entre 3 y 60» de un ataque que hace 25
 * casi siempre no es informar de menos: es informar de otra cosa.
 *
 * Así que se cuenta la distribución y se enseñan tres cifras que sí aguantan
 * un golpe raro: p10, mediana y p90.
 *
 * QUÉ SE GUARDA Y QUÉ NO. El recuento vive AQUÍ, en memoria, mientras dura la
 * pelea. A disco van tres números por habilidad. Guardar los cubos habría sido
 * multiplicar el almacén por un dibujo que casi nadie abre: 60 habilidades por
 * 10 filas por pelea.
 *
 * El precio de eso, dicho: los percentiles NO se pueden fundir. Al sumar varias
 * peleas se caen a propósito en vez de arrastrar el de una de ellas, que sería
 * inventarse la muestra.
 *
 * Cada valor guarda [cuántas veces, de ellas críticas]. Las críticas hacen
 * falta aparte por lo de la doble joroba: un ataque con críticos tiene dos
 * montones por definición, y eso ya se cuenta en su columna. La joroba que
 * merece decirse es la que queda DESPUÉS de quitarlos.
 */
const DIST_TOPE = 2000;     // guarda contra un ataque con miles de valores distintos

function pushDist(b, amt, crit) {
  if (!b.dist) b.dist = new Map();
  const v = b.dist.get(amt);
  if (v) { v[0]++; if (crit) v[1]++; return; }
  // Al llegar al tope se deja de anotar valores NUEVOS y se marca: con la
  // cuenta incompleta los percentiles ya no son exactos, y prefiero no darlos
  // a darlos mal.
  if (b.dist.size >= DIST_TOPE) { b.distTrunc = true; return; }
  b.dist.set(amt, [1, crit ? 1 : 0]);
}

/** El valor que deja por debajo la fracción `q` de las muestras. */
function percentil(pares, total, q) {
  const meta = q * total;
  let acc = 0;
  for (const [valor, n] of pares) {
    acc += n;
    if (acc >= meta) return valor;
  }
  return pares.length ? pares[pares.length - 1][0] : 0;
}

/**
 * ¿Hay dos montones bajo este nombre?
 *
 * No es un adorno del dibujo: es un hallazgo de atribución. Si los golpes de un
 * mismo nombre se agrupan en dos sitios y el valle entre ellos está vacío, lo
 * más probable es que bajo ese nombre haya DOS cosas —dos armas, dos ataques
 * que el registro llama igual— y entonces la media de la fila no describe a
 * ninguna de las dos.
 *
 * Se mira sobre los golpes NO críticos, porque el crítico ya tiene su columna y
 * un ataque con críticos es bimodal por construcción: decirlo sería anunciar
 * como hallazgo algo que ya está contado al lado.
 *
 * Las condiciones son deliberadamente duras, porque esto se dice CON PALABRAS y
 * una frase que se equivoca cuesta más que un dibujo que no se entiende:
 *   · 40 muestras o más — con menos, cualquier hueco es azar
 *   · dos cimas separadas, cada una con el 15% de las muestras como poco
 *   · un valle que baje al 40% de la cima más baja
 *   · y las dos cimas separadas por un cuarto del golpe mayor: dos montones
 *     pegados son el mismo montón visto con demasiado aumento
 *
 * LA ÚLTIMA CONDICIÓN SE MIDE EN DAÑO, no en anchura del dibujo, y ahí estaba
 * el fallo que cazó la prueba. Medida en anchura, un ataque que sólo hace 20 o
 * 21 salía bimodal: los cubos se reparten sobre el rango observado, así que dos
 * valores pegados acaban en los extremos opuestos del dibujo y parecen dos
 * montones. Veinte y veintiuno son el mismo golpe; veinte y cien no.
 */
function dosJorobas(dist) {
  const base = [...dist].map(([v, [n, c]]) => [v, n - c]).filter(([, n]) => n > 0)
    .sort((a, b) => a[0] - b[0]);
  const total = base.reduce((a, [, n]) => a + n, 0);
  if (total < 40 || base.length < 2) return false;

  const lo = base[0][0], hi = base[base.length - 1][0];
  if (hi <= lo) return false;
  const BINS = 12;
  const bins = new Array(BINS).fill(0);
  for (const [v, n] of base) {
    bins[Math.min(BINS - 1, Math.floor((v - lo) / (hi - lo) * BINS))] += n;
  }
  // Suavizado de tres: sin él, un valor repetido mucho abre valles de mentira.
  const s = bins.map((_, i) => (bins[i - 1] ?? 0) + bins[i] + (bins[i + 1] ?? 0));

  const cimas = [];
  for (let i = 0; i < BINS; i++) {
    if (s[i] >= (s[i - 1] ?? -1) && s[i] > (s[i + 1] ?? -1) && s[i] >= total * 0.15) cimas.push(i);
  }
  if (cimas.length < 2) return false;

  const centro = (i) => lo + (i + 0.5) * (hi - lo) / BINS;
  for (let a = 0; a < cimas.length; a++) {
    for (let b = a + 1; b < cimas.length; b++) {
      const i = cimas[a], j = cimas[b];
      if (j - i < 2) continue;                       // cimas pegadas: un montón
      const alto = centro(j), bajo = centro(i);
      if (alto - bajo < alto * 0.25) continue;       // y separadas en DAÑO
      const valle = Math.min(...s.slice(i + 1, j));
      if (valle <= Math.min(s[i], s[j]) * 0.4) return true;
    }
  }
  return false;
}

/**
 * De la cuenta a lo que viaja: tres cifras y, si acaso, el aviso.
 *
 * Por debajo de ocho muestras no se dan percentiles. Es el mismo mínimo que ya
 * usa el catálogo de hechizos para decir «medido»: un hueco explicado informa,
 * y tres cifras sacadas de cuatro golpes desinforman.
 */
export const MIN_MUESTRAS = 8;

export function forma(b) {
  if (!b?.dist || b.distTrunc || b.n < MIN_MUESTRAS) return null;
  // En una pelea viva esto se pide cuatro veces por segundo para cada
  // habilidad de cada fila. La cuenta sólo cambia cuando entra un golpe nuevo,
  // así que se guarda con el número de muestras del que salió.
  if (b.formaN === b.n) return b.formaCache;
  const pares = [...b.dist].map(([v, [n]]) => [v, n]).sort((a, b2) => a[0] - b2[0]);
  const total = pares.reduce((a, [, n]) => a + n, 0);
  if (!total) return null;
  const out = {
    p10: percentil(pares, total, 0.10),
    p50: percentil(pares, total, 0.50),
    p90: percentil(pares, total, 0.90),
    bimodal: dosJorobas(b.dist),
  };
  b.formaN = b.n; b.formaCache = out;
  return out;
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
    // Daño que NO llegó porque una runa se lo comió. Aparte de `taken`, que
    // es lo que sí llegó, y aparte de la curación, que repara lo que llegó.
    this.absorbed = 0;
    this.absorbHits = 0;
    this.defense = new Map();    // parry / dodge / riposte / block que ha hecho
    this.takenByType = new Map();
    this.rawTakenByType = new Map();   // sin mitigar, para el consejo de postura
    this.rawMeleeOut = 0;              // melé propio sin el bono de Offensive
    /**
     * EL DAÑO RECIBIDO, PARTIDO POR LA POSTURA QUE LLEVABAS EN CADA GOLPE.
     *
     * Sin esto, `rawTakenByType` funde en un solo cubo los golpes de todas las
     * posturas de la pelea, y el consejo no tiene más remedio que colapsar la
     * pelea a UNA postura —la que más duró— para decir cuánto evitaste. En una
     * pelea donde bailas eso es falso por construcción: te acredita la postura
     * equivocada durante todos los tramos que no eran suyos.
     *
     * Se agrupa POR POSTURA y no por franja, y no se pierde nada: lo que evita
     * una postura es lineal en el daño, así que sumar dos tramos de Defensive
     * en un cubo da exactamente lo mismo que llevarlos por separado. Cuándo fue
     * cada tramo ya está en `stanceSpans`.
     *
     * Los fallos también entran: una postura que evade no reduce el golpe, lo
     * quita, y eso se puntúa contando ataques. Sin los fallos del tramo no se
     * sabe cuántos ataques hubo en él.
     */
    this.takenByStance = new Map();
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
    /**
     * TU MEJOR RATO, que no es tu mejor segundo.
     *
     * La pregunta que contesta: ¿esto fue un momento o fue un rato? El número
     * grande de la fila reparte el daño entre la pelea entera y el ritmo entre
     * los segundos en que hiciste algo; ninguno de los dos distingue a quien dio
     * un pico de quien sostuvo.
     *
     * Y NO SE MIDE POR SEGUNDOS SUELTOS, aunque fuera lo apuntado. El registro
     * de EQL sella la hora al segundo y no hay nada por debajo: dos golpes
     * separados 1,9 s pueden caer en la misma marca y un frenesí mete tres en
     * una. Un «mejor segundo» es una muestra de n=1 y encima medio artefacto de
     * la cuadrícula. El pico de n=1 ya está puesto en la fila: es el máximo.
     *
     * Diez segundos es la misma ventana que ya usa el análisis para la ráfaga
     * del grupo, así que las dos cifras se pueden comparar entre sí.
     *
     * Se guarda el daño por segundo —no la serie del jugador— y la ventana se
     * calcula al pedir los totales. A disco va UN número por fila.
     */
    this.porSegundo = new Map();     // segundo -> daño hecho
    /**
     * SEGUNDOS EN LOS QUE ATACASTE, y fallar es atacar.
     *
     * `hitSeconds` sólo cuenta los segundos en que hiciste daño, y con eso se
     * medía el «tiempo sin pegar». Medido sobre el registro: de los 15.156
     * segundos en que atacaste, 4.798 —el 31,7%— fueron sólo fallos, y todos
     * ellos contaban como tiempo parado. Estabas pegando; no entró.
     */
    this.swingSeconds = new Set();
  }

  /**
   * TU CADENCIA, deducida de tus propios huecos entre ataques.
   *
   * Por qué hace falta: el registro sella al segundo y tu arma no golpea cada
   * segundo, así que una pelea con uptime perfecto tiene la mitad de los
   * segundos sin daño. Medido sobre el registro entero, los huecos entre
   * segundos con ataque tuyo son 1s (34,7%), 2s (30,5%) y 3s (27,0%): el 92,2%
   * está entre uno y tres, y a partir de cuatro se desploma al 3,9%. Hay una
   * cadencia natural y hay un codo.
   *
   * Se toma el p90 de tus huecos en esta pelea: el hueco más largo que aún es
   * tu arma. Lo que pase de ahí ya no lo explica el arma.
   *
   * Es una propiedad de tu equipo, no de cómo jugaste, y por eso sirve de vara:
   * medir contra cero acusaba al arma; medir contra esto acusa a los parones.
   */
  cadencia() {
    const segs = [...this.swingSeconds].sort((a, b) => a - b);
    if (segs.length < 5) return null;          // sin muestra no se afirma un ritmo
    const huecos = [];
    for (let i = 1; i < segs.length; i++) {
      const d = segs[i] - segs[i - 1];
      if (d <= 12) huecos.push(d);             // un hueco de dos minutos no es el arma
    }
    if (huecos.length < 4) return null;
    huecos.sort((a, b) => a - b);
    const p90 = huecos[Math.min(huecos.length - 1, Math.floor(huecos.length * 0.9))];
    // Tope: si una pelea rara da un p90 enorme, dejaría de acusar cualquier
    // parón. Seis segundos es más del doble del p90 medido en el registro.
    return Math.max(1, Math.min(6, p90));
  }

  /**
   * Lo que de verdad estuviste parado: la suma de lo que cada hueco pasa de tu
   * cadencia. Un hueco de tu tamaño no es un parón, es el arma.
   */
  huecoReal(desde, hasta) {
    const cad = this.cadencia();
    if (cad === null) return null;
    const segs = [...this.swingSeconds].sort((a, b) => a - b);
    let muerto = 0;
    // La entrada y la salida cuentan igual: si llegaste tarde a la pelea o la
    // dejaste antes de acabar, eso también fue tiempo sin atacar.
    const puntos = [desde - cad, ...segs, hasta + 1];
    for (let i = 1; i < puntos.length; i++) {
      muerto += Math.max(0, puntos[i] - puntos[i - 1] - cad);
    }
    return Math.round(muerto);
  }

  /** El mejor tramo de `ventana` segundos seguidos, en daño por segundo. */
  mejorRafaga(ventana = 10) {
    if (!this.porSegundo.size) return 0;
    if (this.rafagaN === this.hits) return this.rafagaCache;
    const segs = [...this.porSegundo.keys()];
    const desde = Math.min(...segs);
    const hasta = Math.max(...segs);
    // Una pelea más corta que la ventana no tiene ráfaga que comparar: sería
    // el total repartido entre diez, que es otra cifra y más pequeña.
    if (hasta - desde + 1 < ventana) { this.rafagaN = this.hits; this.rafagaCache = 0; return 0; }
    let suma = 0;
    for (let s = desde; s < desde + ventana; s++) suma += this.porSegundo.get(s) ?? 0;
    let mejor = suma;
    for (let s = desde + ventana; s <= hasta; s++) {
      suma += (this.porSegundo.get(s) ?? 0) - (this.porSegundo.get(s - ventana) ?? 0);
      if (suma > mejor) mejor = suma;
    }
    this.rafagaN = this.hits;
    this.rafagaCache = mejor / ventana;
    return this.rafagaCache;
  }

  #touch(t) {
    if (this.first === null) this.first = t;
    this.last = t;
    this.activeSeconds.add(t);
  }

  addDamage(ev) {
    const amt = ev.amount;
    const seg = Math.round(ev.t);
    this.hitSeconds.add(seg);
    this.porSegundo.set(seg, (this.porSegundo.get(seg) ?? 0) + amt);
    this.swingSeconds.add(seg);
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
    // La forma sólo se cuenta por habilidad. Es donde se pregunta «¿cuánto pega
    // esto?»; el reparto por objetivo o por escuela contesta otra cosa y no
    // merece el recuento.
    pushDist(b, amt, ev.crit);
    push(this.byTarget, ev.target ?? '?', amt, ev.crit);
    push(this.bySchool, ev.school ?? '?', amt, ev.crit);
    push(this.byType, type, amt, ev.crit);
    if (ev.stance) push(this.byStance, ev.stance, amt, ev.crit);
    if (ev.invocation) push(this.byInvocation, ev.invocation, amt, ev.crit);
  }

  addMissDealt(ev) {
    this.misses++;
    // Fallar es atacar: este segundo NO es tiempo parado.
    this.swingSeconds.add(Math.round(ev.t));
    push(this.missReasons, ev.reason ?? 'fallo', 0, false);
    this.#touch(ev.t);
  }

  /** El cubo de una postura, creándolo si es el primer golpe bajo ella. */
  #tramo(stance) {
    const k = stance ?? '';
    let t = this.takenByStance.get(k);
    if (!t) {
      t = { stance: stance ?? null, melee: 0, spell: 0, unmit: 0, n: 0, landed: 0, avoided: 0 };
      this.takenByStance.set(k, t);
    }
    return t;
  }

  addTaken(ev) {
    this.taken += ev.amount;
    this.swingsAgainst++;
    push(this.takenByType, ev.damageType ?? ev.school ?? 'other', ev.amount, false);
    push(this.rawTakenByType, ev.school === 'melee' ? 'melee' : (ev.damageType ?? ev.school ?? 'other'), ev.rawAmount ?? ev.amount, false);
    push(this.takenBySource, ev.source ?? 'desconocido', ev.amount, false);
    // Y el mismo golpe otra vez, bajo la postura que llevabas puesta. Los tres
    // cubos son los del consejero: melé, mágico y lo que ninguna postura para.
    const t = this.#tramo(ev.stanceAtHit);
    const raw = ev.rawAmount ?? ev.amount;
    t.n++;
    if (ev.school === 'melee') { t.melee += raw; t.landed++; }
    else if (SIN_MITIGACION.has(ev.school)) t.unmit += raw;
    else t.spell += raw;
    this.#touch(ev.t);
  }

  addAvoided(ev) {
    this.swingsAgainst++;
    push(this.defense, ev.reason ?? 'fallo', 0, false);
    this.#tramo(ev.stanceAtHit).avoided++;
  }

  addHealDone(ev) {
    this.healingDone += ev.amount;
    if (ev.potential) this.healPotential += ev.potential;
    push(this.healBySpell, ev.ability ?? 'cura', ev.amount, false);
    push(this.healByTarget, ev.target ?? '?', ev.amount, false);
    this.#touch(ev.t);
  }

  addHealTaken(ev) { this.healingTaken += ev.amount; }

  addAbsorbed(ev) {
    this.absorbed += ev.amount || 0;
    this.absorbHits++;
    this.#touch(ev.t);
  }

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
    // Lo que no se puede atribuir: golpes entre dos bichos del mismo nombre
    // cuando uno está encantado. Se cuenta para poder decir cuánto no se sabe.
    this.charmAmbiguo = { golpes: 0, daño: 0 };
    // Lo que se cuenta como enemigo PORQUE HEMOS DEDUCIDO que su encanto se
    // rompió al encadenar otro. El registro no escribe nada cuando eso pasa, así
    // que este montón no tiene una sola línea que lo respalde y no puede
    // enseñarse junto a lo medido sin decirlo.
    this.charmSoltado = { golpes: 0, daño: 0 };
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
    this.loot = [];                // {item, from, sold, upgraded, t, via, amb}
    // La moneda de los cadáveres, con su instante. Aparte del botín porque se
    // cuelga con otra regla —ventana, no cadáver— y mezclarlas haría creer que
    // las dos se saben igual de bien. `cp` es el total en cobres.
    this.coins = [];               // {t, cp, raw}
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
    // Cuándo se cayó cada buff, con su nombre. Es la MITAD que se puede
    // emparejar: la caída lleva nombre en las 1.020 líneas del registro de
    // referencia, y la entrada NO lo lleva en ninguna de las 2.839 —«notas una
    // curación floreciendo en ti» no dice de qué hechizo—. Así que el tiempo
    // que algo estuvo puesto se mide de LANZAMIENTO a caída, nunca de entrada
    // a caída.
    this.fades = [];           // {t, ability}
    this.resistsCaused = 0;    // hechizos enemigos que TÚ resististe
    this.interrupts = 0;
    this.stancesSeen = new Set();
    this.invocationsSeen = new Set();
  }

  /** Acumula por segundo relativo al inicio. */
  tick(t, field, amount) {
    const k = Math.max(0, Math.round(t - this.start));
    let b = this.series.get(k);
    // `tUnmit` es el tercer cubo del daño que recibes: lo que ninguna postura
    // para. Estaba dentro de `tSpell`, así que todo consumidor de la serie que
    // preguntara «¿cuánto mágico me está entrando?» contaba también el daño
    // periódico y el escudo, y decidía con ello. Ver `SIN_MITIGACION`.
    if (!b) b = { s: k, dmg: 0, taken: 0, heal: 0, tMelee: 0, tSpell: 0, tUnmit: 0, mine: 0 };
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

  /**
   * El combatiente con ese nombre, creándolo si es la primera vez.
   *
   * LA MAYÚSCULA DE PRINCIPIO DE FRASE NO CREA COMBATIENTES. EQ capitaliza la
   * primera letra de la línea, así que el mismo bicho llega como «Ice boned
   * skeleton» cuando pega y «ice boned skeleton» cuando le pegan, y se
   * partía en dos filas: una con todo el daño y cero recibido, otra al revés.
   * Medido sobre 415 peleas guardadas: 10 afectadas, 4 nombres partidos y unos
   * 14.800 de daño repartido entre filas que no existen. La mayor, «Heart
   * harpie» contra «heart harpie», con 11.260.
   *
   * Y SI CHOCAN, GANA LA MINÚSCULA, que no es una preferencia sino lo único
   * que puede ser: un nombre propio como «Lord Nagafen» se escribe igual en
   * medio de la frase que al principio, así que NUNCA produce un par. Si hay
   * dos formas, la de verdad es la minúscula y la otra es la frase.
   *
   * Se hace aquí y no al analizar porque aquí no depende del orden: al
   * analizar, lo emitido antes de aprender la forma buena se quedaba mal, y
   * probándolo salían tres nombres partidos en vez de cuatro — mejor, pero
   * todavía mal.
   */
  /**
   * El encantado y el salvaje del mismo nombre son dos combatientes.
   *
   * Se separan con una clave interna; el nombre que se enseña es el mismo, con
   * la marca `charmed` al lado. Sin separarlos, la única alternativa era
   * elegir un bando para todo el nombre y equivocarse en la mitad.
   */
  actorCharmed(name) {
    const clave = `${name}\u0000charm`;
    let c = this.combatants.get(clave);
    if (!c) {
      c = new Combatant(name);
      c.charmed = true;
      this.combatants.set(clave, c);
    }
    return c;
  }

  actor(name) {
    let c = this.combatants.get(name);
    if (c) return c;

    const baja = name && name.charAt(0).toLowerCase() + name.slice(1);
    if (baja !== name) {
      // Llega capitalizado: si ya está el mismo en minúscula, es ése.
      const yaEsta = this.combatants.get(baja);
      if (yaEsta) return yaEsta;
    } else {
      // Llega en minúscula: si estaba guardado capitalizado, se corrige.
      const alta = name.charAt(0).toUpperCase() + name.slice(1);
      const viejo = this.combatants.get(alta);
      if (viejo) {
        viejo.name = name;
        this.combatants.delete(alta);
        this.combatants.set(name, viejo);
        return viejo;
      }
    }

    c = new Combatant(name);
    this.combatants.set(name, c);
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
      // El encantado se enseña con su nombre y esta marca al lado: es el
      // mismo bicho, pero durante ese rato peleaba para ti.
      charmed: c.charmed === true,
      damage: c.damage,
      dps: c.damage / inclusive,
      dpsOwn: c.damage / own,
      dpsActive: c.damage / Math.max(1, c.activeSeconds.size),
      // Tu mejor tramo de diez segundos seguidos. Cero cuando la pelea no llega
      // a diez, que no es «no tuviste ráfaga» sino que no cabe la pregunta.
      rafaga10: c.mejorRafaga(10),
      // Tu cadencia de ataque y lo que de verdad estuviste parado, medido
      // contra ella y no contra cero. Ver `cadencia()`.
      cadencia: c.cadencia(),
      swingSec: c.swingSeconds.size,
      huecoReal: c.huecoReal(this.start, this.end),
      hits: c.hits, meleeHits: c.meleeHits, misses: c.misses,
      crits: c.crits, critDamage: c.critDamage, critRate: c.critRate,
      flurries: c.flurries, ripostes: c.ripostes, healPotential: c.healPotential,
      max: c.max, min: c.min === Infinity ? 0 : c.min,
      accuracy: c.accuracy, avoidance: c.avoidance,
      taken: c.taken, swingsAgainst: c.swingsAgainst, deaths: c.deaths,
      absorbed: c.absorbed, absorbHits: c.absorbHits,
      healingDone: c.healingDone, healingTaken: c.healingTaken,
      activeSec: c.activeSeconds.size, hitSec: c.hitSeconds.size, ownSec: own,
      byAbility: sorted(c.byAbility), byTarget: sorted(c.byTarget),
      bySchool: sorted(c.bySchool), byType: sorted(c.byType),
      byStance: sorted(c.byStance), byInvocation: sorted(c.byInvocation),
      missReasons: [...c.missReasons].sort((a, b) => b[1].n - a[1].n),
      defense: [...c.defense].sort((a, b) => b[1].n - a[1].n),
      takenByType: sorted(c.takenByType), takenBySource: sorted(c.takenBySource),
      rawTakenByType: sorted(c.rawTakenByType), rawMeleeOut: c.rawMeleeOut,
      // Sólo si hubo golpes bajo alguna postura conocida: en una pelea sin
      // postura observada, una lista con un cubo `null` no dice nada y encima
      // se confundiría con haber medido algo.
      takenByStance: [...c.takenByStance.values()].filter((t) => t.stance && (t.n || t.avoided)),
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
    return {
      rows, total, healing, duration: inclusive, raidDps: total / inclusive,
      charm: this.#charm(rows),
    };
  }

  /**
   * Lo que no se pudo atribuir del encanto, y una estimación de cuánto era
   * tuyo — APARTE, nunca sumada a las filas.
   *
   * El reparto por objetivo resuelve casi todo: en el registro de referencia,
   * 2.389 de daño atribuidos con certeza y 158 ambiguos, un 6,2%. Lo ambiguo
   * son golpes entre dos bichos del MISMO nombre, uno encantado y otro no, y
   * ahí el registro no da ninguna pista.
   *
   * `estimadoTuyo` reparte ese resto según el ritmo que cada uno demostró en
   * lo que SÍ se pudo medir. Es una deducción y va rotulada como tal: no entra
   * en el daño de nadie, viaja en su propio campo para que la interfaz pueda
   * decir «de esto, tanto probablemente era tuyo» sin ensuciar una cifra
   * medida. Medido y deducido nunca en la misma casilla.
   *
   * Si no hubo nada ambiguo —dos de las tres peleas— esto es cero y no hay
   * nada que rotular.
   */
  #charm(rows) {
    const amb = this.charmAmbiguo ?? { golpes: 0, daño: 0 };
    const sol = this.charmSoltado ?? { golpes: 0, daño: 0 };
    // Puede no haber nada ambiguo y sí haber algo deducido: son dos cosas
    // distintas —quién pegó, y si seguía siendo tuyo— y la ficha necesita las
    // dos por separado.
    if (!amb.daño && !sol.daño) return null;
    if (!amb.daño) {
      return { golpes: 0, daño: 0, estimadoTuyo: null, medidoTuyo: 0, medidoSuyo: 0, soltado: sol };
    }
    const tuyo = rows.filter((r) => r.charmed).reduce((a, r) => a + r.damage, 0);
    const suyo = rows.filter((r) => !r.charmed
      && rows.some((x) => x.charmed && x.name === r.name)).reduce((a, r) => a + r.damage, 0);
    const base = tuyo + suyo;
    return {
      golpes: amb.golpes,
      daño: amb.daño,
      // Sin nada medido con lo que comparar, no se estima: se dice que no.
      estimadoTuyo: base ? Math.round(amb.daño * (tuyo / base)) : null,
      medidoTuyo: tuyo,
      medidoSuyo: suyo,
      // Daño contado como enemigo apoyándose en una deducción, no en una línea.
      soltado: sol,
    };
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
    /**
     * Compañeros de grupo declarados o detectados por el canal.
     *
     * Sólo deciden si una pelea SE ABRE. No entran en `#mine()` —de quién es
     * el daño— ni cuentan como tuyos en ningún reparto: un compañero pegando
     * no eres tú pegando.
     */
    this.companions = new Set();
    // Objetos recogidos sin ningún cadáver conocido al que atribuirlos.
    this.lootSinPelea = 0;
    // Objetos cuyo cadáver murió en una pelea que ya estaba cerrada.
    this.lootTarde = 0;
    // Y aquéllos cuyo cadáver podía ser de dos peleas distintas. Se cuentan
    // para poder decir cuánto no se sabe, no para taparlo. Ver `#deQuePelea`.
    this.lootAmbiguo = 0;
    /**
     * LOS CADÁVERES RECIENTES, que es lo que permite colgar el botín de su
     * pelea y no de la que esté abierta. `{clave, t, enc}`, en orden.
     *
     * Vive en el rastreador y no en la pelea A PROPÓSITO: su razón de ser es
     * justamente sobrevivir al cierre, porque el saqueo tardío es el caso que
     * hay que arreglar. Se poda por `VENTANA_CADAVER`, así que no crece.
     */
    this.cadaveres = [];
    // Los pone el motor según van llegando los hitos: /who y subidas de nivel.
    // Cada pelea se queda con los que hubiera al abrirse.
    this.level = null;
    this.classes = null;
  }

  /**
   * Los compañeros declarados. Los fija el motor cuando cambia la lista.
   *
   * Acepta lista o conjunto porque le llegan las dos cosas: la configuración
   * guarda una lista y el motor lleva un `Set`. Exigir sólo lista rompía la
   * reconstrucción entera con un «filter is not a function» que salía como
   * «error-de-lectura», sin decir dónde.
   */
  setCompanions(list) { this.companions = new Set([...(list ?? [])].filter(Boolean)); }

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
      else if (ev.kind === 'buff_fade' && ev.ability) {
        this.current.fades.push({ t: Math.round(ev.t - this.current.start), ability: ev.ability });
      }
      // TODOS los lanzamientos, no sólo los categorizados.
      //
      // Antes hacía falta `castCat` para guardarlo, y la categoría sólo la
      // tienen las utilidades —curas, raíces, mez, miedo—. Medido: de 18.921
      // lanzamientos con nombre se guardaban 2.333, un 12%. Y de los TUYOS,
      // 702 de 6.457.
      //
      // Lo que se caía era justo lo que hace falta para leer una línea de
      // tiempo: los nukes. «Water Elemental Attack» 4.408 veces, «Drain
      // Spirit» 1.851, «Cinder Bolt» 371 — nada de eso se guardaba, así que la
      // pregunta «¿estaba usando sus hechizos?» no se podía contestar.
      //
      // Cuesta 1,3 MB sobre un almacén de 7. La categoría se sigue guardando
      // cuando se conoce, que es lo que usa el consejero.
      else if (ev.kind === 'cast' && ev.ability && ev.source) {
        this.current.casts.push({
          t: Math.round(ev.t - this.current.start),
          source: ev.source, ability: ev.ability, cat: ev.castCat ?? null,
        });
      }
      else if (ev.kind === 'stance' && ev.stance) this.current.stancesSeen.add(ev.stance);
      else if (ev.kind === 'invocation' && ev.invocation) this.current.invocationsSeen.add(ev.invocation);
    }

    // ── EL BOTÍN SE CUELGA DE SU CADÁVER, NO DE LA VENTANA ───────────────────
    //
    // Ver `#deQuePelea`. Aquí sólo se decide dónde va lo que salga de allí.
    //
    // `qty` viaja con el objeto en vez de expandirse en dos entradas iguales:
    // «2 Bone Chips» es una recogida de dos unidades, no dos recogidas, y la
    // diferencia importa al contar de cuántos cadáveres ha salido algo.
    if (ev.kind === 'loot' && ev.item) {
      const comun = {
        item: ev.item, qty: ev.qty ?? 1, from: ev.from ?? null,
        sold: ev.sold ?? null, upgraded: ev.upgraded ?? null,
        stored: ev.stored ?? false, depot: ev.depot ?? false,
        // La cola desconocida de un final que aún no tiene regla. Viaja hasta la
        // ficha en vez de perderse: ver la red del final del botín en
        // `patterns.js`.
        cola: ev.cola ?? null,
      };
      const d = this.#deQuePelea(ev);
      if (d.enc && d.enc === this.current) {
        // El caso normal: el cadáver murió en la pelea que sigue abierta.
        this.current.loot.push({
          ...comun, via: 'cadaver', amb: d.amb, dt: d.dt,
          t: Math.max(0, Math.round(ev.t - this.current.start)),
        });
      } else if (d.enc) {
        // ── Botín que llega TARDE ──────────────────────────────────────────
        //
        // El cadáver murió en una pelea que ya está cerrada —y guardada, y
        // `fights.ndjson` sólo se añade por el final: meterlo dentro correría
        // todos los bytes siguientes y dejaría el índice entero apuntando a
        // sitios equivocados—. Así que va al fichero lateral CON la pelea a la
        // que pertenece, igual que `tramos.ndjson`. No se pierde y no se le
        // cuelga a la pelea siguiente, que es lo que pasaba: 34 objetos de un
        // histórico real colgados de una pelea posterior, mediana 10 minutos.
        this.lootTarde++;
        this.emit('lateLoot', {
          ...comun, via: 'cadaver', amb: d.amb, dt: d.dt,
          t: ev.t, de: Math.round(d.enc.start * 1000),
          zone: d.enc.zone ?? this.zone ?? null,
        });
      } else {
        // ── Botín sin cadáver que case ─────────────────────────────────────
        //
        // Pasa cuando al enemigo lo remata entero un compañero: el filtro de
        // relevancia sólo abre pelea contigo o con tus mascotas, así que esa
        // muerte nunca se registró y no hay cadáver al que mirar.
        //
        // Y NO se arregla dejando que un compañero abra pelea. Se probó y se
        // midió: recupera 3 de 5 y abre la puerta a que su pelea en la otra
        // punta de la zona entre en tu histórico, que es lo que `test/combat.js`
        // prohíbe «bajo ningún concepto».
        //
        // Se arregla entendiendo qué es esto: recoger un objeto es un suceso
        // TUYO, no de una pelea. La prueba de que estabas allí es que lo
        // cogiste, no que él pegara. Sale por su cuenta y se guarda por su
        // cuenta, sin inventar un encuentro que no existió — y la ficha lo
        // dice, que es distinto de no enseñarlo.
        this.lootSinPelea++;
        this.emit('orphanLoot', {
          ...comun, via: 'suelto', porQue: d.porQue,
          t: ev.t, zone: this.zone ?? null,
        });
      }
      return;
    }

    // ── LA MONEDA ────────────────────────────────────────────────────────────
    //
    // Sólo por ventana, y no por descuido: `You receive 2 gold from the corpse`
    // NO DICE DE QUÉ CADÁVER. Sin nombre no hay nada que emparejar, así que la
    // regla del cadáver no se le puede aplicar y se queda con la única que hay.
    // La ficha lo etiqueta distinto porque es una certeza distinta.
    if (ev.kind === 'coin') {
      if (this.current) this.current.coins.push({ t: Math.max(0, Math.round(ev.t - this.current.start)), cp: ev.cp ?? 0, raw: ev.coin ?? null });
      else this.emit('orphanCoin', { cp: ev.cp ?? 0, raw: ev.coin ?? null, t: ev.t, zone: this.zone ?? null });
      return;
    }

    const isCombat = DAMAGE_KINDS.has(ev.kind) || ev.kind === 'miss'
      || ev.kind === 'heal' || ev.kind === 'death' || ev.kind === 'absorb';
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
    // Un compañero declarado PEGANDO también cuenta, y es lo que permite que la
    // pelea de tu grupo exista cuando tú no llegaste a tocar al enemigo. Sólo
    // pegando: un fallo o una curación suya abrirían un encuentro vacío.
    const compaPega = this.companions.size > 0
      && DAMAGE_KINDS.has(ev.kind) && ev.amount > 0
      && (this.companions.has(ev.source) || this.companions.has(ev.target));
    // `compaPega` ENTRA AQUÍ, que es donde llevaba sin entrar desde que se
    // escribió. Estaba calculado tres líneas más arriba y no se usaba en
    // ninguna parte del fichero: una sola aparición, la declaración.
    //
    // Lo que costaba, medido sobre un registro real con dos compañeros
    // declarados: 43.028 de daño suyo descartado —75.688 de uno y 33.543 del
    // otro, que salen en 67 y 68 de las peleas—. Y 4 peleas partidas de más:
    // durante unos segundos sólo pegaba el compañero, sus eventos se tiraban,
    // y el hueco parecía inactividad. Es el mismo fallo que cortaba peleas en
    // dos con las curaciones reflexivas, con otro disfraz.
    //
    // Y NO ABRE LA PUERTA A CUALQUIERA: pide `this.companions.has(…)`, o sea
    // declarado a mano. El caso que motivó el filtro sigue igual — en ese
    // mismo registro, `Hartemis` tiene 76.626 de daño descartado y cero peleas
    // tuyas, y sigue fuera. El escape es para los tuyos, no para quien pase.
    const relevante = ev.kind === 'death'
      ? (rel(ev.victim) || rel(ev.killer) || enPelea(ev.victim) || enPelea(ev.killer))
      : (rel(ev.source) || rel(ev.target) || compaPega);
    if (mine.size && !relevante) return;

    // Y una pelea sólo se abre cuando estáis metidos vosotros.
    if (Number.isFinite(this.idleSec) && this.current && ev.t - this.current.end > this.idleSec) this.#close();
    if (!this.current) {
      // Una muerte suelta no abre pelea: sin golpes previos no hay nada que
      // contar, y la de un desconocido a diez metros no es asunto tuyo.
      if (ev.kind === 'death') return;
      // Y una runa tampoco: dice que algo te iba a dar y no dice qué ni quién.
      // Sin un golpe delante no hay pelea que abrir.
      if (ev.kind === 'absorb') return;
      // ── Un compañero declarado también abre pelea, pero sólo PEGANDO ──
      //
      // Aquí ponía que los compañeros no debían entrar nunca en esta regla,
      // porque «una pelea suya al otro lado de la sala se guardaría como
      // tuya». El aviso era razonable y resultó no cumplirse: medido sobre un
      // registro real, dejarles abrir pelea añade 4 encuentros y los 4 tienen
      // cero daño tuyo Y cero daño total, así que el almacén no guarda ninguno
      // —sólo se guarda lo que tuvo daño— y las peleas almacenadas siguen
      // siendo 306 exactamente. Lo que sí recupera son 3 objetos de botín que
      // antes no tenían dónde ir.
      //
      // La condición de que sea DAÑO y no cualquier suceso es lo que evita el
      // problema de verdad: sin ella, un fallo o una curación suya abrían un
      // encuentro vacío que no se guarda pero sí llega al narrador, y te
      // anunciaba el final de una pelea que no había existido.
      //
      // Sigue sin entrar en `#mine()`, y eso no ha cambiado: `#mine()` decide
      // de quién es el daño, no sólo si la pelea se abre. Un compañero pegando
      // no eres tú pegando.
      // AQUÍ NO. Se probó a meter `compaPega` también en esta guarda y lo cazó
      // una prueba que ya existía, con su invariante escrita: «lo que no puede
      // pasar bajo ningún concepto es que su pelea sea la tuya». Un compañero
      // peleando solo, sin ti en ninguna parte, NO abre una pelea tuya.
      //
      // El comentario del escape decía «permite que la pelea de tu grupo
      // exista cuando tú no llegaste a tocar al enemigo», y esa frase se puede
      // leer de dos maneras: estás en la pelea pero no has tocado a ESE bicho
      // —cierto, y lo resuelve la guarda de relevancia— o no estás en absoluto
      // —falso, y es lo que la prueba prohíbe—. Vale la primera.
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

      // PEGARTE A TI MISMO NO ES PEGAR, y se estaba contando como tal.
      //
      // «You hit yourself for 62 points of unresistable damage by Cannibalize»
      // entraba como daño HECHO por ti además de recibido: 62 puntos de tu
      // propia vida sumando a tu DPS y al total del grupo, con Cannibalize
      // apareciendo en tu tabla de habilidades y tú mismo en la de objetivos.
      // Lo mismo hace «You hurt yourself for N points».
      //
      // Recibido sí: es vida que pierdes. Hecho no: no se lo has quitado a
      // nadie. Y fuera del total del grupo, que es la suma de lo que le habéis
      // hecho al enemigo.
      //
      // LA MARCA VIENE DEL PRONOMBRE, no de comparar nombres. Que origen y
      // destino se llamen igual no prueba que sean el mismo: un encantado
      // pegando a un salvaje del mismo nombre son dos bichos, y esa línea ya
      // está contada aparte como ambigua. Comparando nombres, aquello caía aquí
      // dentro y se descontaba un golpe que sí ocurrió.
      const aTiMismo = ev.selfInflicted === true;

      if (huerfano) enc.unattributed += ev.amount;
      else if (ev.source && !aTiMismo) this.#deQuien(enc, ev, true).addDamage(ev);
      if (ev.target) this.#deQuien(enc, ev, false).addTaken(ev);
      if (!huerfano && !aTiMismo) enc.tick(ev.t, 'dmg', ev.amount);
      // `mine` es la línea de TU daño en la gráfica: la autolesión tampoco
      // pinta ahí, por lo mismo.
      if (ev.source === this.self && !aTiMismo) enc.tick(ev.t, 'mine', ev.amount);
      if (ev.target === this.self) {
        // Bruto y separado por escuela: sin esto no se puede juzgar la
        // postura tramo a tramo, sólo la media de toda la pelea.
        const raw = ev.rawAmount ?? ev.amount;
        enc.tick(ev.t, 'taken', ev.amount);
        // Los tres cubos salen de la MISMA lista que usan el analizador, el
        // almacén y el consejero. Aquí ponía «lo que no es melé es mágico», y
        // ésa es la decisión que ningún consumidor debe volver a tomar por su
        // cuenta: en cuanto hay dos criterios, discrepan.
        enc.tick(ev.t, cuboRecibido(ev.school), raw);
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
    } else if (ev.kind === 'absorb' && ev.amount > 0) {
      // La runa se come el golpe entero. No abre pelea por sí sola —no dice
      // contra quién fue— pero si ya hay una, cuenta.
      if (ev.target) enc.actor(ev.target).addAbsorbed(ev);
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
      // Cae un bicho: queda un cadáver, y el cadáver sobrevive a la pelea. Se
      // anota aquí —donde ya se sabe de qué encuentro es— y se poda por la
      // ventana medida, así que la lista se queda en las decenas.
      if (ev.victim) {
        this.cadaveres.push({ clave: nombreCadaver(ev.victim), t: ev.t, enc });
        const corte = ev.t - VENTANA_CADAVER;
        if (this.cadaveres.length > 64 && this.cadaveres[0].t < corte) {
          this.cadaveres = this.cadaveres.filter((c) => c.t >= corte);
        }
      }
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

  /**
   * PENDIENTE, Y NO ES UN DETALLE: EL ALMACÉN NO ES FUNCIÓN PURA DEL REGISTRO.
   *
   * Una pelea se puede cerrar por dos caminos y NO usan el mismo reloj:
   *
   *   `feed`, línea 830   `ev.t - this.current.end > this.idleSec`
   *                       reloj del REGISTRO. Es el que corre al reconstruir.
   *   `tick`, aquí        `nowSec - this.current.end > this.idleSec`, y quien
   *                       lo llama es `engine.js:893` con `Date.now()/1000`:
   *                       reloj de PARED. Sólo corre en directo.
   *
   * Con un hueco de EXACTAMENTE `idleSec` los dos caminos deciden distinto. El
   * registro da 20,0 y `20 > 20` es falso, así que en frío la pelea NO se parte;
   * en directo el reloj de pared sigue corriendo entre líneas, llega a 20,4
   * antes de que aparezca la siguiente y la pelea SÍ se parte.
   *
   * CASO REAL MEDIDO (9 de agosto de 2026, 428 peleas). Última línea de combate
   * a las 11:48:33, siguiente a las 11:48:53, `idleSec` = 20. En directo se
   * guardaron dos peleas (334 s y 210 s); releyendo en frío sale una sola de
   * 563 s. Es la ÚNICA discrepancia de todo el histórico —las otras 426 peleas
   * emparejadas coinciden campo por campo— pero basta para que `store:rebuild`
   * no reproduzca lo que había, y para que dos usuarios con el mismo registro
   * puedan acabar con historiales distintos.
   *
   * EL ARREGLO es que el cierre se decida SIEMPRE con la marca del registro.
   * Y tiene una arista que hay que resolver al hacerlo, no después: si `tick`
   * deja de poder cerrar, una pelea interrumpida por cerrar el juego se queda
   * abierta para siempre, porque no va a llegar ninguna línea más. Así que no
   * vale con borrar esta comprobación: hace falta que cerrar por reloj de pared
   * no fije la frontera que se guarda, o que lo haga con margen suficiente para
   * que ninguna línea que el registro pondría dentro llegue después.
   */
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

  /**
   * De quién es este golpe cuando hay un encantado con ese nombre.
   *
   * EL OBJETIVO DELATA AL ATACANTE, que es lo que resuelve el caso difícil:
   * dos bichos con el mismo nombre, uno encantado y otro no, y el registro sin
   * forma de distinguirlos. No hace falta distinguirlos:
   *
   *   - un salvaje NO pega a otros bichos  -> si pega a un bicho, es el tuyo
   *   - un encantado NO te pega a ti       -> si te pega, es el salvaje
   *   - y a ti no te da por pegar al tuyo  -> si le pegas, es el salvaje
   *
   * Medido en el peor caso del registro de referencia —los dos «a hardened
   * skeleton» a la vez durante 1m42s—: 727 de daño a otros bichos, 60 a mí y
   * 158 de un «X pega a X». O sea 83,3% resuelto sin estimar nada.
   *
   * Ese resto, el X contra X, es el único de verdad ambiguo. No se reparte a
   * ojo: se aparta en `charmAmbiguo` y se cuenta, para que la interfaz pueda
   * decir cuánto no sabe en vez de inventarlo.
   */
  #deQuien(enc, ev, esFuente) {
    const nombre = esFuente ? ev.source : ev.target;
    const otro = esFuente ? ev.target : ev.source;
    const marcado = esFuente ? ev.charmSrc : ev.charmTgt;
    if (!marcado) {
      // Vuelve a ser enemigo, sí — pero si eso lo sabemos porque encadenaste
      // otro encanto, no lo sabemos: lo hemos deducido. Se cuenta aparte.
      if (ev.charmSoltado && esFuente) {
        enc.charmSoltado.golpes++;
        enc.charmSoltado.daño += ev.amount || 0;
      }
      return enc.actor(nombre);
    }

    // X contra X: los dos extremos son el mismo nombre y los dos podrían ser
    // cualquiera de los dos bichos.
    if (otro && otro === nombre) {
      // Se cuenta una sola vez por golpe: esto se llama dos veces, una por el
      // que pega y otra por el que recibe, y sin la condición el ambiguo salía
      // exactamente al doble — 316 donde el registro tiene 158.
      if (esFuente) {
        enc.charmAmbiguo.golpes++;
        enc.charmAmbiguo.daño += ev.amount || 0;
      }
      return enc.actor(nombre);
    }

    const mio = this.#mine();
    if (esFuente) {
      // Pega a los tuyos -> es el salvaje. Pega a otra cosa -> es el tuyo.
      return mio.has(otro) ? enc.actor(nombre) : enc.actorCharmed(nombre);
    }
    // Lo golpea alguien: si eres tú, le estás pegando al salvaje.
    return mio.has(otro) ? enc.actor(nombre) : enc.actorCharmed(nombre);
  }

  /**
   * DE QUÉ PELEA ES ESTE OBJETO. Del cadáver del que salió, no de la ventana.
   *
   * ES UNA DEDUCCIÓN Y VIAJA MARCADA COMO TAL. El registro no numera los
   * cadáveres: dice «from a zol ghoul knight's corpse» y de ésos han muerto
   * nueve esta tarde. Lo único que se puede afirmar es «el más reciente de ese
   * nombre anterior a la recogida», que es una regla, no una medición.
   *
   * LA GUARDA ES LA MISMA QUE LA DEL ENCANTO, y por el mismo motivo: cuando dos
   * candidatos son indistinguibles no se reparte a ojo ni se calla. Pero hay que
   * afinar QUÉ es indistinguible, o la guarda deja de avisar de nada:
   *
   *   que haya otro del mismo nombre         no es ambiguo. Es lo normal.
   *   que esté en otra pelea                 tampoco: 32% de las recogidas.
   *   que esté a menos de `AMBIGUO_SEG`      SÍ. Ahí los dos pueden serlo, y
   *                                          son 3 de 1.875 en un log real.
   *
   * Sin cadáver que case no se inventa uno: sale como suelto y se dice por qué.
   */
  #deQuePelea(ev) {
    if (!ev.from) return { enc: null, amb: false, porQue: 'sin-cadaver-en-la-linea' };
    const clave = nombreCadaver(ev.from);
    const desde = ev.t - VENTANA_CADAVER;
    const cand = this.cadaveres.filter((c) => c.clave === clave && c.t <= ev.t + 1 && c.t >= desde);
    if (!cand.length) {
      // Distinguir «nunca vi morir a ése» de «lo vi, pero hace demasiado» no es
      // un lujo: el primero es un cadáver que remató un compañero y el segundo
      // es un tope que a lo mejor está mal puesto. Con un solo motivo, el día
      // que la ventana se quede corta nadie podría notarlo.
      const viejo = this.cadaveres.some((c) => c.clave === clave);
      return { enc: null, amb: false, porQue: viejo ? 'cadaver-fuera-de-ventana' : 'sin-muerte-registrada' };
    }
    const ultimo = cand[cand.length - 1];
    const amb = cand.some((c) => c.enc !== ultimo.enc && ultimo.t - c.t <= AMBIGUO_SEG);
    if (amb) this.lootAmbiguo++;
    // `dt` es lo único MEDIDO de todo esto: cuánto pasó entre esa muerte y esta
    // recogida. Viaja con el objeto para que la ficha pueda enseñar la distancia
    // en vez de pedir que se confíe en la regla.
    return { enc: ultimo.enc, amb, dt: Math.round(ev.t - ultimo.t), porQue: null };
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
