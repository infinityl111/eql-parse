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
  dst.activeSec += r.activeSec ?? 0;
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
    byAbility: new Map(), byType: new Map(), byTarget: new Map(), takenBySource: new Map(),
  };
}

function finishRow(r, base) {
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    name: r.name, side: r.side,
    petOf: r.petOf ?? null, pet: !!r.pet, mate: !!r.mate, unidentified: !!r.unidentified,
    damage: r.damage, taken: r.taken, healingDone: r.healingDone,
    hits: r.hits, misses: r.misses, crits: r.crits, flurries: r.flurries,
    ripostes: r.ripostes, deaths: r.deaths, max: r.max, activeSec: r.activeSec,
    accuracy: r.meleeHits + r.misses ? r.meleeHits / (r.meleeHits + r.misses) : null,
    share: base ? r.damage / base : 0,
    abilities: [...r.byAbility.values()].sort((a, b) => b.sum - a.sum).slice(0, 20),
    types: top(r.byType),
    targets: top(r.byTarget).slice(0, 15).map(([name, sum]) => ({ name, sum })),
    takenBySource: top(r.takenBySource).slice(0, 10).map(([name, sum]) => ({ name, sum })),
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
      const key = r.name;
      if (!rows.has(key)) rows.set(key, emptyRow(r.name, r.side));
      mergeRow(rows.get(key), r);
    }

    // El expediente de cada enemigo lo lleva el contador compartido: es el
    // mismo que plegará la enciclopedia pelea a pelea.
    ledger.fold(f);

    for (const l of f.loot ?? []) {
      const item = typeof l === 'string' ? l : l.item;
      if (!item) continue;
      const cur = loot.get(item) ?? { item, n: 0, from: new Set() };
      cur.n += 1;
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
    const dst = { ...r, mergedPets: suyas.length, mergedPetsFrom: suyas.map((p) => p.name) };
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
      for (const a of p.abilities ?? []) {
        const k = `${a.name}\u0000${a.type ?? ''}`;
        const c = ab.get(k) ?? { name: a.name, type: a.type, sum: 0, n: 0, max: 0 };
        c.sum += a.sum; c.n += a.n; c.max = Math.max(c.max ?? 0, a.max ?? 0);
        ab.set(k, c);
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
