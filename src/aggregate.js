/**
 * Suma de varias peleas en un único desglose.
 *
 * Lo interesante no es apilar cifras: es que el DPS resultante tenga sentido.
 * Sumar el daño de 40 peleas y dividirlo por las horas transcurridas daría un
 * número ridículo, porque la mayor parte del tiempo no estabas peleando. Aquí
 * se divide por los **segundos de combate**, que es la suma de las duraciones
 * de las peleas.
 *
 * El expediente de cada enemigo NO se calcula aquí: lo lleva `FoeLedger`, que
 * es el mismo contador que usará la enciclopedia plegando pelea a pelea. Aquí
 * se le pasan las peleas del tramo y se le pide la lista.
 */

import { FoeLedger } from './foes.js';

const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);

/**
 * Deduce el bando cuando la pelea se guardó sin él.
 *
 * El campo `side` es reciente; las peleas anteriores no lo llevan y, al faltar,
 * todo el mundo pasaba por aliado — incluidos los enemigos. Se recalcula con la
 * misma regla que usa el motor: enemigo es quien te pega a ti o a los tuyos, o
 * a quien pegáis vosotros.
 */
export function ensureSides(f, self, petNames = []) {
  if (!f?.rows?.length || f.rows.some((r) => r.side)) return f;
  const ours = new Set([self, ...petNames].filter(Boolean));
  const foes = new Set();

  // Enemigo directo: te pegó a ti o a los tuyos, o vosotros le pegasteis.
  for (const r of f.rows) {
    if (ours.has(r.name)) continue;
    if ((r.targets ?? []).some((t) => ours.has(t.name))) foes.add(r.name);
  }
  for (const r of f.rows) {
    if (!ours.has(r.name)) continue;
    for (const t of r.targets ?? []) if (!ours.has(t.name)) foes.add(t.name);
  }

  // Aliado: alguien que pega a tus enemigos. Así entran los compañeros de grupo
  // y las mascotas sin depender de que nadie escriba nada.
  const allies = new Set(ours);
  for (const r of f.rows) {
    if (foes.has(r.name) || ours.has(r.name)) continue;
    if ((r.targets ?? []).some((t) => foes.has(t.name))) allies.add(r.name);
  }

  // Lo que queda sin decidir se da por enemigo, no por aliado: un nombre que no
  // eres tú, no es tuyo y no ayuda a nadie es casi siempre un enemigo de la zona.
  return {
    ...f,
    rows: f.rows.map((r) => ({ ...r, side: allies.has(r.name) ? 'ally' : 'enemy' })),
  };
}

function mergeRow(dst, r) {
  dst.damage += r.damage ?? 0;
  dst.taken += r.taken ?? 0;
  dst.healingDone += r.healingDone ?? 0;
  dst.hits += r.hits ?? 0;
  dst.meleeHits += r.meleeHits ?? 0;
  dst.misses += r.misses ?? 0;
  dst.crits += r.crits ?? 0;
  dst.flurries += r.flurries ?? 0;
  dst.ripostes += r.ripostes ?? 0;
  dst.deaths += r.deaths ?? 0;
  dst.max = Math.max(dst.max, r.max ?? 0);
  // LA RÁFAGA SÍ SE PUEDE FUNDIR, y con el máximo, no sumando. Una ventana de
  // diez segundos no cruza de una pelea a otra, así que la mejor del conjunto
  // es exactamente la mejor de alguna de ellas. No es una aproximación: es la
  // misma cifra. (Los percentiles de arriba no tienen esa suerte.)
  dst.rafaga10 = Math.max(dst.rafaga10 ?? 0, r.rafaga10 ?? 0);
  dst.activeSec += r.activeSec ?? 0;
  // LA FORMA DEL GOLPE NO SE FUNDE, y es a propósito.
  //
  // La suma y el máximo sí: uno se apila y el otro se compara. La mediana y los
  // percentiles no: sacarlos de los de las partes no se puede —harían falta las
  // muestras, y las muestras se quedan en la pelea que las midió—, así que aquí
  // se caen. La alternativa era arrastrar los de una de las peleas y enseñarlos
  // como si fueran los del conjunto, que es inventarse la muestra.
  //
  // Por eso `cur` nace sin ellos y de `a` nunca se copian.
  for (const a of r.abilities ?? []) {
    const k = `${a.name}\u0000${a.type ?? ''}`;
    const cur = dst.byAbility.get(k) ?? { name: a.name, type: a.type, sum: 0, n: 0, max: 0 };
    cur.sum += a.sum; cur.n += a.n; cur.max = Math.max(cur.max, a.max ?? 0);
    dst.byAbility.set(k, cur);
  }
  for (const [ty, v] of r.types ?? []) add(dst.byType, ty, v);
  for (const tg of r.targets ?? []) add(dst.byTarget, tg.name, tg.sum);
  for (const src of r.takenBySource ?? []) add(dst.takenBySource, src.name, src.sum);
  // Quién ES cada uno no se suma, se arrastra: son propiedades del nombre y no
  // de la pelea. Sin esto el resumen perdía el «(de Notarino)» y la marca de
  // mascota en cuanto juntaba dos peleas, y una mascota recién asignada volvía
  // a salir como un desconocido.
  //
  // `unidentified` va al revés que las demás: basta con que UNA pelea sepa
  // quién es para que deje de ser un desconocido. Afirmar lo contrario sería
  // dudar de algo que ya consta.
  if (r.petOf && !dst.petOf) dst.petOf = r.petOf;
  if (r.pet) dst.pet = true;
  if (r.mate) dst.mate = true;
  if (!r.unidentified) dst.unidentified = false;
  else if (dst.unidentified === undefined) dst.unidentified = true;
}

function emptyRow(name, side) {
  return {
    name, side, damage: 0, taken: 0, healingDone: 0, hits: 0, meleeHits: 0,
    misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 0, activeSec: 0,
    rafaga10: 0,
    byAbility: new Map(), byType: new Map(), byTarget: new Map(), takenBySource: new Map(),
  };
}

function finishRow(r, base) {
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    name: r.name, side: r.side, charmed: !!r.charmed,
    petOf: r.petOf ?? null, pet: !!r.pet, mate: !!r.mate, unidentified: !!r.unidentified,
    damage: r.damage, taken: r.taken, healingDone: r.healingDone,
    hits: r.hits, misses: r.misses, crits: r.crits, flurries: r.flurries,
    ripostes: r.ripostes, deaths: r.deaths, max: r.max, activeSec: r.activeSec,
    rafaga10: r.rafaga10 ?? 0,
    accuracy: r.meleeHits + r.misses ? r.meleeHits / (r.meleeHits + r.misses) : null,
    share: base ? r.damage / base : 0,
    // LOS TOPES DE ESTAS TRES LISTAS, medidos contra un histórico entero.
    //
    // Se pusieron a ojo y dos estaban recortando la mitad de los datos sin
    // decirlo: sobre 412 peleas resumidas, «a quién pegas» tiene 193 nombres
    // distintos y con tope 15 se ocultaban 178 —el 51,5% del daño—, y «de
    // quién te llega» tiene 181 y con tope 10 se ocultaban 171 —el 57,3%—.
    // Una tabla que enseña menos de la mitad y no lo dice miente por omisión.
    //
    // El de habilidades sí estaba bien: 33 distintas y las 13 que se caían son
    // el 0,4% del daño. Ahí la cola es de verdad cola.
    //
    // Suben a 60 —más que cualquier máximo medido en una pelea suelta— y lo
    // que se caiga se cuenta en `abilitiesMas`, `targetsMas` y `takenMas`,
    // para que la interfaz pueda decir cuánto falta en vez de callarlo.
    abilities: [...r.byAbility.values()].sort((a, b) => b.sum - a.sum).slice(0, 60),
    abilitiesMas: Math.max(0, r.byAbility.size - 60),
    targetsMas: Math.max(0, r.byTarget.size - 60),
    takenMas: Math.max(0, r.takenBySource.size - 60),
    types: top(r.byType),
    targets: top(r.byTarget).slice(0, 60).map(([name, sum]) => ({ name, sum })),
    takenBySource: top(r.takenBySource).slice(0, 60).map(([name, sum]) => ({ name, sum })),
  };
}

/**
 * @param {object[]} fights  peleas completas, ya leídas del almacén
 * @param {string} self
 */
export function aggregate(fights, self = null) {
  const rows = new Map();
  const ledger = new FoeLedger();
  const loot = new Map();      // objeto -> {n, from:Set}
  let seconds = 0, total = 0, enemyTotal = 0, healing = 0, kills = 0, losses = 0;
  let firstAt = null, lastAt = null;

  for (const raw of fights) {
    if (!raw) continue;
    const f = ensureSides(raw, self, []);
    seconds += f.duration ?? 0;
    total += f.total ?? 0;
    enemyTotal += f.enemyTotal ?? 0;
    healing += f.healing ?? 0;
    kills += (f.kills ?? []).length;
    losses += (f.losses ?? []).length;
    if (f.at) { firstAt = firstAt === null ? f.at : Math.min(firstAt, f.at); lastAt = Math.max(lastAt ?? 0, f.at); }

    for (const r of f.rows ?? []) {
      // El encantado va por su cuenta aunque comparta nombre con el salvaje:
      // son dos filas distintas dentro de la pelea y juntarlas aquí desharía
      // el reparto por objetivo justo al mirar varias peleas a la vez.
      const key = r.charmed ? `${r.name}\u0000charm` : r.name;
      if (!rows.has(key)) {
        const fila = emptyRow(r.name, r.side);
        fila.charmed = r.charmed === true;
        rows.set(key, fila);
      }
      mergeRow(rows.get(key), r);
    }

    // El expediente de cada enemigo lo lleva el contador compartido: es el
    // mismo que plegará la enciclopedia pelea a pelea.
    ledger.fold(f);

    for (const l of f.loot ?? []) {
      const item = typeof l === 'string' ? l : l.item;
      if (!item) continue;
      const cur = loot.get(item) ?? { item, n: 0, from: new Set() };
      // Unidades, no recogidas: «2 Bone Chips» son dos. Las peleas guardadas
      // antes de que la cantidad se capturase no traen `qty` y valen uno, que
      // es lo que se supo de ellas — reconstruir el almacén las corrige.
      cur.n += (typeof l === 'object' ? (l.qty ?? 1) : 1);
      if (typeof l === 'object' && l.from) cur.from.add(l.from);
      loot.set(item, cur);
    }
  }

  const allyBase = [...rows.values()].filter((r) => r.side !== 'enemy').reduce((a, r) => a + r.damage, 0);
  const foeBase = [...rows.values()].filter((r) => r.side === 'enemy').reduce((a, r) => a + r.damage, 0);

  const out = [...rows.values()]
    .map((r) => finishRow(r, r.side === 'enemy' ? foeBase : allyBase))
    .sort((a, b) => b.damage - a.damage);

  return {
    fights: fights.length,
    seconds,                                   // segundos EN COMBATE, no de reloj
    span: firstAt !== null ? { from: firstAt, to: lastAt } : null,
    total, enemyTotal, healing, kills, losses,
    dps: seconds ? total / seconds : 0,
    enemyDps: seconds ? enemyTotal / seconds : 0,
    rows: out,
    foes: ledger.list(),
    loot: [...loot.values()].map((l) => ({ item: l.item, n: l.n, from: [...l.from] }))
      .sort((a, b) => b.n - a.n || a.item.localeCompare(b.item)),
  };
}

/**
 * Funde todas las mascotas en una sola fila.
 *
 * En EQL la mascota cambia de nombre en cada invocación, así que dos días de
 * juego dejan cinco o seis filas que en realidad son la misma cosa. Se fusiona
 * al mostrar y no al guardar: los datos originales quedan intactos y la opción
 * se puede activar y desactivar sin reconstruir nada.
 */
export function mergePets(rows = [], label = 'Mascotas', known = [], self = null, notPets = []) {
  // La marca `pet` va dentro de cada pelea, así que las guardadas antes de que
  // existiera no la tienen. La lista de mascotas conocidas las rescata.
  const set = new Set(known);
  const no = new Set(notPets);   // lo que has desmarcado a mano nunca se funde
  const isPet = (r) => r.side !== 'enemy' && r.name !== self && r.name !== label
    && !r.petOf                                   // la de otro jugador no es tuya
    && !no.has(r.name)
    // Un encantado NO se pliega aquí. Pelea para ti, sí, pero comparte nombre
    // con el enemigo salvaje que está dos filas más abajo, y plegarlo hace
    // desaparecer justo lo que hay que poder ver: cuánto hizo el tuyo. Se
    // detectó al mirarlo en la aplicación — la fila existía en el almacén y no
    // llegaba a la pantalla, tragada por «juntar mascotas».
    && !r.charmed
    && (r.pet || set.has(r.name));
  const pets = rows.filter(isPet);
  // Con una sola mascota también se renombra: al sumar varias peleas, cada
  // una tendrá la suya con otro nombre y sin esto no se agruparían nunca.
  if (!pets.length) return rows;
  const dst = {
    ...pets[0], name: label, pet: true, merged: pets.length,
    mergedFrom: pets.map((p) => p.name),
    damage: 0, taken: 0, healingDone: 0, hits: 0, meleeHits: 0, misses: 0,
    crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 0, activeSec: 0, share: 0,
    rafaga10: null,
  };
  const ab = new Map(); const ty = new Map(); const tg = new Map();
  for (const p of pets) {
    dst.damage += p.damage ?? 0; dst.taken += p.taken ?? 0;
    dst.healingDone += p.healingDone ?? 0;
    dst.hits += p.hits ?? 0; dst.meleeHits += p.meleeHits ?? 0; dst.misses += p.misses ?? 0;
    dst.crits += p.crits ?? 0; dst.flurries += p.flurries ?? 0; dst.ripostes += p.ripostes ?? 0;
    dst.deaths += p.deaths ?? 0; dst.activeSec += p.activeSec ?? 0;
    dst.max = Math.max(dst.max, p.max ?? 0);
    dst.share += p.share ?? 0;
    for (const a of p.abilities ?? []) {
      const k = `${a.name}\u0000${a.type ?? ''}`;
      const c = ab.get(k) ?? { name: a.name, type: a.type, sum: 0, n: 0, max: 0 };
      c.sum += a.sum; c.n += a.n; c.max = Math.max(c.max, a.max ?? 0);
      ab.set(k, c);
    }
    for (const [k, v] of p.types ?? []) ty.set(k, (ty.get(k) ?? 0) + v);
    for (const x of p.targets ?? []) tg.set(x.name, (tg.get(x.name) ?? 0) + x.sum);
  }
  dst.accuracy = dst.meleeHits + dst.misses ? dst.meleeHits / (dst.meleeHits + dst.misses) : null;
  dst.dps = dst.activeSec ? dst.damage / dst.activeSec : (pets[0].dps ?? 0);
  dst.abilities = [...ab.values()].sort((a, b) => b.sum - a.sum);
  dst.types = [...ty.entries()].sort((a, b) => b[1] - a[1]);
  dst.targets = [...tg.entries()].sort((a, b) => b[1] - a[1]).map(([name, sum]) => ({ name, sum }));
  return [...rows.filter((r) => !isPet(r)), dst].sort((a, b) => b.damage - a.damage);
}

/**
 * SE PERSISTE LO OBSERVADO; SE RECALCULA LO DERIVADO. Aquí, la identidad.
 *
 * `unidentified` se guardaba con la pelea, y es un DERIVADO guardado como
 * HECHO — la tercera vez que este proyecto se lo encuentra. Se calculaba con
 * lo que se sabía EN LA SESIÓN en que se cerró la pelea, y las dos fuentes de
 * las que dependía viven sólo en memoria: `whoSeen` no se escribe nunca, y
 * `petSet` sólo guarda la mascota ACTUAL. Así que la misma criatura sale como
 * tuya a las 21:14 y como desconocida a las 21:19, porque entre medias
 * invocaste otra. «Identificado» no era una propiedad del combatiente: era una
 * propiedad del momento en que se guardó.
 *
 * Medido sobre 1.894 peleas: 369 (19,5 %) tenían a alguien sin identificar
 * sumando en el total de los tuyos. Recalculando al leer bajan a 248 (13,1 %).
 *
 * ── POR QUÉ NO SE MIRA `pet` DE OTRA PELEA, QUE SERÍA LO CÓMODO ──────────
 *
 * Porque `pet` sale de `petSet`, o sea del mismo estado de sesión que causó el
 * fallo: apoyarse en él sería arreglar un derivado con otro derivado. Y está
 * comprobado que no hace falta — de los 144 nombres con `pet:true` en alguna
 * pelea, los 144 están en `pets.json`, que es observado y ya llega al lector.
 * La regla no pierde ni un nombre por ser íntegramente observada.
 *
 * ── EL ORDEN, Y POR QUÉ CADA UNO ─────────────────────────────────────────
 *
 *   1. eres tú                      observado: sale del nombre del registro
 *   2. tiene dueño (`petOf`)        observado: `My leader is X` es literal
 *   3. `X`s warder` y X eres tú o un compañero declarado
 *   4. compañero declarado          lo dices tú
 *   5. está en las mascotas conocidas y no lo has desmentido
 *   6. encantado                    observado: `X has been charmed` es literal
 *
 * La guarda del 3 no es adorno: en el almacén hay `Innoruuk`s Chosen`, que es
 * un BICHO. Sin exigir que el dueño sea tuyo o declarado, esa regla convertiría
 * a un enemigo en aliado tuyo.
 *
 * ── LO QUE ESTO NO ARREGLA, Y HAY QUE SABERLO ────────────────────────────
 *
 * Quedan 248 peleas. El 95 % de ese resto no es un fallo de la regla:
 *   · 22 nombres con forma de mascota de invocador que NUNCA entraron en
 *     `pets.json` — son del segundo invocador del trío, y el registro que
 *     leemos es el del otro. Esa información no está en el fichero.
 *   · 5 nombres que tú mismo has declarado ajenos (`notPets`).
 * Y quedan 4 filas que se pierden de verdad: gente de la que hubo un `/who` en
 * su sesión y nadie escribió a disco. Se arreglaría persistiendo `whoSeen`,
 * que es exactamente el mismo remedio que se le dio a las mascotas.
 *
 * @param {object} ctx { self, companions, knownPets, notPets }
 */
const POSESIVO = /^(.+)`s (?:warder|pet|familiar)$/i;

export function identificado(r, ctx = {}) {
  const nombre = r?.name;
  if (!nombre) return false;
  const conj = (x) => (x instanceof Set ? x : new Set(x ?? []));
  const amigos = conj(ctx.companions);
  if (nombre === ctx.self) return true;
  if (r.petOf) return true;
  const m = POSESIVO.exec(nombre);
  if (m && (m[1] === ctx.self || amigos.has(m[1]))) return true;
  if (amigos.has(nombre)) return true;
  if (conj(ctx.knownPets).has(nombre) && !conj(ctx.notPets).has(nombre)) return true;
  if (r.charmed) return true;
  return false;
}

/**
 * Aplica la identidad a unas filas AL MOSTRAR, no al guardar.
 *
 * Se recalcula entera y no se cae al valor persistido: la regla es completa
 * por sí sola, y respetar el `unidentified` viejo cuando la regla dice otra
 * cosa sería conservar justo el error. Esto mueve casos en los DOS sentidos —
 * lo que declaras hoy en `notPets` se aplica también a lo de ayer, igual que
 * con los compañeros y las exclusiones.
 */
export function ensureIdentidad(rows = [], ctx = {}) {
  if (!rows.length) return rows;
  let cambia = false;
  const out = rows.map((r) => {
    if (r.side === 'enemy') return r;
    const sin = !identificado(r, ctx);
    if (!!r.unidentified === sin) return r;
    cambia = true;
    return { ...r, unidentified: sin };
  });
  return cambia ? out : rows;
}

/**
 * Quién es la mascota de quién, dicho por ti o sacado de un /pet who leader.
 *
 * Se aplica al MOSTRAR y no al guardar, como las exclusiones y los compañeros:
 * una pelea guardada hace media hora se rotula bien en cuanto lo declaras, sin
 * reconstruir nada. Y una mascota con dueño deja de estar «sin identificar»
 * porque ya consta lo que es.
 */
export function ownerPets(rows = [], owners = {}) {
  const m = owners instanceof Map ? owners : new Map(Object.entries(owners ?? {}));
  if (!m.size || !rows.some((r) => m.has(r.name))) return rows;
  return rows.map((r) => (m.has(r.name) && r.side !== 'enemy'
    ? { ...r, petOf: m.get(r.name), unidentified: false } : r));
}

/**
 * Pliega cada mascota ajena dentro de la fila de su dueño.
 *
 * Es la otra mitad de `mergePets`: aquella junta LAS TUYAS en una sola fila, y
 * ésta mete la de cada jugador dentro de él. Las dos responden a la misma
 * pregunta —«¿cuánto ha puesto cada persona?»— y por eso van con la misma
 * casilla.
 *
 * Sólo se pliega si el dueño está en la pelea. Si no está, su mascota se queda
 * como una fila propia con su rótulo: meterla en alguien que no aparece sería
 * inventarse una fila.
 */
export function mergeOwnerPets(rows = []) {
  const dueños = new Map();
  for (const r of rows) if (r.side !== 'enemy') dueños.set(r.name, r);
  const plegables = rows.filter((r) => r.side !== 'enemy' && r.petOf && dueños.has(r.petOf));
  if (!plegables.length) return rows;

  const porDueño = new Map();
  for (const p of plegables) {
    if (!porDueño.has(p.petOf)) porDueño.set(p.petOf, []);
    porDueño.get(p.petOf).push(p);
  }
  const fuera = new Set(plegables.map((p) => p.name));
  const salida = [];
  for (const r of rows) {
    if (fuera.has(r.name)) continue;
    const suyas = porDueño.get(r.name);
    if (!suyas) { salida.push(r); continue; }
    // Y LA RÁFAGA NO SE PLIEGA: aquí se juntan combatientes DISTINTOS, que
    // pegaban a la vez. Su mejor tramo de diez segundos no es la suma de los
    // dos —cada uno tuvo el suyo en otro momento— ni el mayor de ellos, que
    // se dejaría fuera lo que puso el otro durante esa misma ventana. Haría
    // falta la serie de los dos, y la serie no se guarda. Se dice que no se
    // sabe, que es distinto de un cero.
    const dst = { ...r, mergedPets: suyas.length, mergedPetsFrom: suyas.map((p) => p.name), rafaga10: null };
    const ab = new Map(); const ty = new Map(); const tg = new Map();
    for (const a of dst.abilities ?? []) ab.set(`${a.name}\u0000${a.type ?? ''}`, { ...a });
    for (const [k, v] of dst.types ?? []) ty.set(k, v);
    for (const x of dst.targets ?? []) tg.set(x.name, x.sum);
    for (const p of suyas) {
      dst.damage += p.damage ?? 0; dst.taken += p.taken ?? 0;
      dst.healingDone += p.healingDone ?? 0;
      dst.hits += p.hits ?? 0; dst.meleeHits += p.meleeHits ?? 0; dst.misses += p.misses ?? 0;
      dst.crits += p.crits ?? 0; dst.flurries += p.flurries ?? 0; dst.ripostes += p.ripostes ?? 0;
      dst.deaths += p.deaths ?? 0; dst.activeSec += p.activeSec ?? 0;
      dst.max = Math.max(dst.max ?? 0, p.max ?? 0);
      dst.share = (dst.share ?? 0) + (p.share ?? 0);
      // LA MASCOTA ES UNA LÍNEA, NO UN PUÑADO DE HABILIDADES SUELTAS.
      //
      // Aquí se volcaban sus habilidades dentro de la lista del dueño: los
      // «bites» de la mascota quedaban entre los del jugador sin nada que
      // dijera de quién eran. El total salía bien, y «cuánto puso la
      // mascota» dejaba de poderse contestar — pintado, pero no puesto. Es
      // el mismo fallo que el del tanqueo con otra ropa.
      //
      // Se pliega igual, porque el orden del reparto es lo que se midió,
      // pero entra como UNA entrada con su nombre. Su desglose por habilidad
      // no se pierde: sigue estando en la pelea sin plegar, a una casilla.
      //
      // No lleva forma del golpe, y no es un olvido: no es un ataque, es la
      // suma de todos los suyos, así que no tiene mediana que enseñar.
      if ((p.damage ?? 0) > 0) {
        ab.set(`${p.name} pet`, {
          name: p.name, type: null, pet: true,
          sum: p.damage ?? 0, n: p.hits ?? 0, max: p.max ?? 0, crits: p.crits ?? 0,
        });
      }
      for (const [k, v] of p.types ?? []) ty.set(k, (ty.get(k) ?? 0) + v);
      for (const x of p.targets ?? []) tg.set(x.name, (tg.get(x.name) ?? 0) + x.sum);
    }
    dst.accuracy = dst.meleeHits + dst.misses ? dst.meleeHits / (dst.meleeHits + dst.misses) : null;
    dst.abilities = [...ab.values()].sort((a, b) => b.sum - a.sum);
    dst.types = [...ty.entries()].sort((a, b) => b[1] - a[1]);
    dst.targets = [...tg.entries()].sort((a, b) => b[1] - a[1]).map(([name, sum]) => ({ name, sum }));
    salida.push(dst);
  }
  return salida.sort((a, b) => b.damage - a.damage);
}
