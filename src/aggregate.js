/**
 * Suma de varias peleas en un único desglose.
 *
 * Lo interesante no es apilar cifras: es que el DPS resultante tenga sentido.
 * Sumar el daño de 40 peleas y dividirlo por las horas transcurridas daría un
 * número ridículo, porque la mayor parte del tiempo no estabas peleando. Aquí
 * se divide por los **segundos de combate**, que es la suma de las duraciones
 * de las peleas.
 */

const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);

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
  const foes = new Map();      // nombre -> {fights, kills, damageTo, seconds, taken}
  const loot = new Map();      // objeto -> {n, from:Set}
  let seconds = 0, total = 0, enemyTotal = 0, healing = 0, kills = 0, losses = 0;
  let firstAt = null, lastAt = null;

  for (const f of fights) {
    if (!f) continue;
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

    // Por enemigo: cuántas veces te lo has cruzado y cuánto costó cada vez.
    for (const r of f.rows ?? []) {
      if (r.side !== 'enemy') continue;
      const e = foes.get(r.name) ?? { name: r.name, fights: 0, kills: 0, damageTo: 0, seconds: 0, taken: 0, deaths: 0 };
      e.fights += 1;
      e.seconds += f.duration ?? 0;
      e.taken += r.damage ?? 0;                 // lo que ESE enemigo repartió
      if ((f.kills ?? []).includes(r.name)) e.kills += 1;
      foes.set(r.name, e);
    }
    for (const r of f.rows ?? []) {
      if (r.side === 'enemy') continue;
      for (const tg of r.targets ?? []) {
        const e = foes.get(tg.name);
        if (e) e.damageTo += tg.sum;
      }
    }

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
    foes: [...foes.values()]
      .map((e) => ({ ...e, dps: e.seconds ? e.damageTo / e.seconds : 0 }))
      .sort((a, b) => b.damageTo - a.damageTo),
    loot: [...loot.values()].map((l) => ({ item: l.item, n: l.n, from: [...l.from] }))
      .sort((a, b) => b.n - a.n || a.item.localeCompare(b.item)),
  };
}
