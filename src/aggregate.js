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

/**
 * Deduce el bando cuando la pelea se guardó sin él.
 *
 * El campo `side` es reciente; las peleas anteriores no lo llevan y, al faltar,
 * todo el mundo pasaba por aliado — incluidos los bichos. Se recalcula con la
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
  // eres tú, no es tuyo y no ayuda a nadie es casi siempre un bicho de la zona.
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

    // Por enemigo: cuántas veces te lo has cruzado y cuánto costó cada vez.
    for (const r of f.rows ?? []) {
      if (r.side !== 'enemy') continue;
      const e = foes.get(r.name) ?? {
        name: r.name, fights: 0, kills: 0, damageTo: 0, seconds: 0, taken: 0, deaths: 0,
        maxHit: 0, hpSamples: [], zones: new Set(), abil: new Map(), loot: new Map(),
        porDif: new Map(), niveles: new Set(), sinNivel: false,
      };
      e.fights += 1;
      e.seconds += f.duration ?? 0;
      e.taken += r.damage ?? 0;                 // lo que ESE enemigo repartió
      e.maxHit = Math.max(e.maxHit, r.max ?? 0);
      if (f.zone) e.zones.add(f.zone);

      // ── Lo que SÍ se separa por dificultad ────────────────────────────
      //
      // Medido en un log real: Magus Rokyl en D3 tiene un 59% más de vida que
      // en D2, pega 3,6 veces más fuerte y lanza dos hechizos que en D2 no
      // tiene. La media de los dos no describe a ninguno.
      //
      // Las resistencias NO se separan, y es una decisión medida, no un
      // olvido: en ese mismo log todo entra al 100% en las dos dificultades y
      // la única diferencia (95% contra 86%) sale de 14 intentos. Partirlas
      // fragmentaría una muestra que ya es corta a cambio de nada.
      //
      // Por nivel tampoco se separa, y por la misma razón medida: sólo dos
      // enemigos coinciden en los dos periodos de nivel del log, y la única
      // celda que difiere sale de dos intentos. Pero sí se anota con qué
      // niveles has peleado contra él, para poder avisar de que están
      // mezcladas — que es lo único que se puede afirmar hoy.
      if (f.level) e.niveles.add(f.level);
      else e.sinNivel = true;

      const d = f.diff ?? null;
      const kd = d === null ? 'sin marca' : `D${d}`;
      const pd = e.porDif.get(kd) ?? {
        diff: d, tag: f.diffTag ?? null, fights: 0, kills: 0, maxHit: 0,
        damageTo: 0, taken: 0, hpSamples: [], abil: new Map(),
      };
      pd.fights += 1;
      // En cuántos ENCUENTROS apareció cada habilidad, no sólo cuánto sumó.
      //
      // Es la evidencia en crudo y no se interpreta. En EQL las clases
      // secundarias de un enemigo se sortean por instancia, así que dos
      // encuentros con el mismo nombre pueden ser bichos distintos: medido en
      // este log, Lord Nagafen lanzó los tres hechizos de Druida en D2 y
      // ninguno en D3 pese a durar la pelea 182 segundos. Si fuera cosa de la
      // dificultad las habilidades se añadirían, nunca se perderían.
      //
      // Y que una habilidad NO aparezca tampoco prueba que no la tenga: las
      // notas de parche de EQL dicen que los NPC respetan tiempos de
      // reutilización. Por eso se guarda «en cuántos de cuántos» y se deja que
      // el que mira saque sus conclusiones.
      for (const nombre of new Set((r.abilities ?? []).map((a) => a.name))) {
        pd.abilFights = pd.abilFights ?? new Map();
        pd.abilFights.set(nombre, (pd.abilFights.get(nombre) ?? 0) + 1);
      }
      pd.taken += r.damage ?? 0;
      pd.maxHit = Math.max(pd.maxHit, r.max ?? 0);
      e.porDif.set(kd, pd);

      // Con qué te pega: sus habilidades, sumadas de todas las peleas.
      for (const a of r.abilities ?? []) {
        const c = e.abil.get(a.name) ?? { name: a.name, type: a.type, sum: 0, n: 0, max: 0 };
        c.sum += a.sum; c.n += a.n; c.max = Math.max(c.max, a.max ?? 0);
        e.abil.set(a.name, c);
        const cd2 = pd.abil.get(a.name) ?? { name: a.name, type: a.type, sum: 0, n: 0, max: 0 };
        cd2.sum += a.sum; cd2.n += a.n; cd2.max = Math.max(cd2.max, a.max ?? 0);
        pd.abil.set(a.name, cd2);
      }
      // Cuántas veces cayó: `kills` trae un nombre por muerte, así que matarlo
      // tres veces en una pelea son tres. Antes se contaba una.
      const caidas = (f.kills ?? []).filter((x) => x === r.name).length;
      if (caidas > 0) {
        e.kills += caidas;
        pd.kills += caidas;
        for (const m of f.hpSamples?.[r.name] ?? []) if (m > 0) pd.hpSamples.push(Math.round(m));
        // Vida estimada: lo que costó tumbarlo. El log no da la vida de nadie,
        // pero el daño hasta su muerte es una cota muy buena. Cada muerte deja
        // su propia muestra, medida en el instante en que cayó.
        const muestras = f.hpSamples?.[r.name];
        if (muestras?.length) {
          for (const m of muestras) if (m > 0) e.hpSamples.push(Math.round(m));
        } else {
          // Peleas guardadas antes de que se midiera al caer: sólo se puede
          // usar el daño total, y sólo vale si cayó una vez. Con más muertes la
          // suma describiría a los tres juntos, así que no se usa.
          const dealt = (f.rows ?? []).filter((x) => x.side !== 'enemy')
            .reduce((n, x) => n + ((x.targets ?? []).find((tg) => tg.name === r.name)?.sum ?? 0), 0);
          if (dealt > 0 && caidas === 1) e.hpSamples.push(Math.round(dealt));
        }
      }
      for (const l of f.loot ?? []) {
        const item = typeof l === 'string' ? l : l.item;
        const from = typeof l === 'object' ? l.from : null;
        if (item && from === r.name) e.loot.set(item, (e.loot.get(item) ?? 0) + 1);
      }
      foes.set(r.name, e);
    }
    for (const r of f.rows ?? []) {
      if (r.side === 'enemy') continue;
      for (const tg of r.targets ?? []) {
        const e = foes.get(tg.name);
        if (!e) continue;
        e.damageTo += tg.sum;
        const pd = e.porDif.get(f.diff === null || f.diff === undefined ? 'sin marca' : `D${f.diff}`);
        if (pd) pd.damageTo += tg.sum;
      }
    }

    // Qué hechizos tuyos entran contra cada enemigo y cuáles resiste.
    for (const x of f.spellVsFoe ?? []) {
      const e = foes.get(x.foe);
      if (!e) continue;
      if (!e.spells) e.spells = new Map();
      const c = e.spells.get(x.spell) ?? { spell: x.spell, landed: 0, resisted: 0, byInv: new Map() };
      c.landed += x.landed; c.resisted += x.resisted;
      const key = x.inv ?? '';
      const b = c.byInv.get(key) ?? { inv: x.inv ?? null, landed: 0, resisted: 0 };
      b.landed += x.landed; b.resisted += x.resisted;
      c.byInv.set(key, b);
      e.spells.set(x.spell, c);
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
      .map((e) => ({
        ...e,
        dps: e.seconds ? e.damageTo / e.seconds : 0,
        // Qué hechizos tuyos entran contra él y cuáles resiste, medido.
        zones: [...(e.zones ?? [])],
        levels: [...(e.niveles ?? [])].sort((a, b) => a - b),
        someWithoutLevel: !!e.sinNivel,
        abilities: [...(e.abil ?? new Map()).values()].sort((a, b) => b.sum - a.sum).slice(0, 15),
        lootList: [...(e.loot ?? new Map())].sort((a, b) => b[1] - a[1]).map(([item, n]) => ({ item, n })),
        hp: e.hpSamples?.length ? {
          n: e.hpSamples.length,
          avg: Math.round(e.hpSamples.reduce((a, b) => a + b, 0) / e.hpSamples.length),
          min: Math.min(...e.hpSamples), max: Math.max(...e.hpSamples),
        } : null,
        // Una ficha por dificultad, ordenadas. Cuando hay más de una, la de
        // arriba deja de tener sentido y la interfaz enseña éstas.
        dificultades: [...(e.porDif ?? new Map()).values()]
          .map((d) => ({
            diff: d.diff, tag: d.tag, fights: d.fights, kills: d.kills,
            maxHit: d.maxHit, damageTo: d.damageTo, taken: d.taken,
            hp: d.hpSamples.length ? {
              n: d.hpSamples.length,
              avg: Math.round(d.hpSamples.reduce((a, b) => a + b, 0) / d.hpSamples.length),
              min: Math.min(...d.hpSamples), max: Math.max(...d.hpSamples),
            } : null,
            // Cada habilidad con en cuántos encuentros salió: es lo que se
            // puede afirmar. «Sus habilidades en D2» no; «lo que lanzó en los
            // 2 encuentros de D2» sí.
            abilities: [...d.abil.values()]
              .map((a) => ({ ...a, inFights: d.abilFights?.get(a.name) ?? 0 }))
              .sort((a, b) => b.sum - a.sum).slice(0, 12),
          }))
          .sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99)),
        spells: [...(e.spells ?? new Map()).values()]
          .map((c) => ({
            ...c,
            rate: c.landed + c.resisted ? c.resisted / (c.landed + c.resisted) : 0,
            // Sólo se desglosa si hubo intentos con más de una invocación:
            // con una sola, repetir la misma cifra no aporta nada.
            byInv: [...(c.byInv ?? new Map()).values()]
              .filter((b) => b.landed + b.resisted >= 2)
              .map((b) => ({ ...b, rate: b.resisted / (b.landed + b.resisted) }))
              .sort((a, b) => (b.landed + b.resisted) - (a.landed + a.resisted)),
          }))
          .map((c) => ({ ...c, byInv: c.byInv.length > 1 ? c.byInv : [] }))
          .sort((a, b) => (b.landed + b.resisted) - (a.landed + a.resisted)).slice(0, 12),
      }))
      .sort((a, b) => b.damageTo - a.damageTo),
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
