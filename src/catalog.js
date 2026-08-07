import { baseSpell } from './spells.js';

/**
 * Catálogo de tus hechizos, construido SOLO desde tu histórico.
 *
 * No hay una base de datos de hechizos de EQL, así que todo lo de aquí sale de
 * lo que has hecho: cuántas veces lo lanzaste, cuánto pegó, su rango, sus
 * críticos, contra quién entra y cuánto tarda en volver. Nada consultado.
 *
 * Lo que el log NO da, y por tanto no está: el coste en maná, el tiempo de
 * lanzamiento, y el cooldown de lo que nunca lanzaste. Tampoco los hechizos que
 * tienes memorizados y no has usado: si no aparecen, no existen para esto.
 *
 * LA MITAD QUE FALTABA
 *
 * Esto leía sólo `abilities`, que es daño. Todo lo que cura vive en
 * `healBySpell` y no se enseñaba en ninguna parte. Medido sobre un histórico
 * real: `Leech Touch I` con 190.380 de curación, `Efflorescing Heal` con
 * 170.565 y ocho más, invisibles del todo. Y `Drain Spirit`, que hace 1.093.644
 * de daño y 796.751 de curación, se enseñaba a medias.
 *
 * Un hechizo que drena describe mal lo que hace si sólo se cuenta lo que quita.
 */

/** Muestra mínima para que una cifra se enseñe como medida y no como estimación. */
export const MIN_USOS = 8;

/**
 * @param {object[]} fights peleas completas ya leídas del almacén
 * @param {string} self
 * @param {Map<string,object>} cooldowns  de `cooldownsFromLog`, opcional
 */
export function catalog(fights, self, cooldowns = new Map()) {
  const porHechizo = new Map();

  for (const f of fights) {
    if (!f) continue;
    const mio = (f.rows ?? []).find((r) => r.name === self);
    if (!mio) continue;

    // Lo que cura. Va antes que el daño para que un hechizo que SÓLO cura
    // exista igualmente en el catálogo: si se creara sólo desde `abilities`,
    // «Efflorescing Heal» no llegaría nunca a tener ficha.
    for (const h of mio.healBySpell ?? []) {
      const e = get(porHechizo, h.name);
      e.heal += h.sum ?? 0;
      e.healN += h.n ?? 0;
      e.healMax = Math.max(e.healMax, h.max ?? 0);
      e.peleas.add(f.uid ?? f.id);
    }

    for (const a of mio.abilities ?? []) {
      const e = get(porHechizo, a.name);
      e.sum += a.sum ?? 0;
      e.n += a.n ?? 0;
      e.crits += a.crits ?? 0;
      e.max = Math.max(e.max, a.max ?? 0);
      if ((a.min ?? 0) > 0) e.min = Math.min(e.min, a.min);
      // EQL etiqueta el tipo de daño, y entre ellos hay uno que no estábamos
      // usando: `unresistable`. Que un hechizo no se pueda resistir es
      // exactamente lo que quieres saber contra un enemigo que resiste todo.
      if (a.type) e.tipos.set(a.type, (e.tipos.get(a.type) ?? 0) + (a.sum ?? 0));
      e.peleas.add(f.uid ?? f.id);
    }

    // Aciertos y resistencias contra cada enemigo, con su dificultad.
    for (const x of f.spellVsFoe ?? []) {
      const e = get(porHechizo, x.spell);
      e.landed += x.landed ?? 0;
      e.resisted += x.resisted ?? 0;
      const k = f.diff === null || f.diff === undefined ? x.foe : `${x.foe} · D${f.diff}`;
      const c = e.porFoe.get(k) ?? { foe: x.foe, diff: f.diff ?? null, landed: 0, resisted: 0 };
      c.landed += x.landed ?? 0; c.resisted += x.resisted ?? 0;
      e.porFoe.set(k, c);
    }
  }

  const out = [];
  for (const [nombre, e] of porHechizo) {
    const intentos = e.landed + e.resisted;
    const tasa = intentos ? e.landed / intentos : null;
    const medio = e.n ? e.sum / e.n : 0;
    const base = baseSpell(nombre);
    const cd = cooldowns.get(base) ?? null;
    out.push({
      name: nombre, base,
      total: e.sum, uses: e.n, avg: medio,
      min: e.min === Infinity ? 0 : e.min, max: e.max,
      crits: e.crits, critRate: e.n ? e.crits / e.n : 0,
      types: [...e.tipos].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      // `unresistable` es un tipo de daño de EQL, no una deducción nuestra.
      unresistable: e.tipos.has('unresistable'),
      landed: e.landed, resisted: e.resisted, landRate: tasa,
      // Rendimiento efectivo por intento: daño medio descontando lo resistido.
      // Se calcula siempre y la interfaz decide si vale la pena enseñarlo: si
      // todo entra al 100%, esta columna repite la de al lado y no informa.
      effective: tasa === null ? null : medio * tasa,
      fights: e.peleas.size,
      cooldown: cd?.seconds ?? null,
      cooldownSource: cd?.source ?? null,
      byFoe: [...e.porFoe.values()]
        .filter((c) => c.landed + c.resisted >= 2)
        .map((c) => ({ ...c, rate: c.resisted / (c.landed + c.resisted) }))
        .sort((a, b) => (b.landed + b.resisted) - (a.landed + a.resisted))
        .slice(0, 12),
      // Lo que cura, que es la otra mitad de lo que hace un hechizo.
      heal: e.heal, healN: e.healN, healMax: e.healMax,
      healAvg: e.healN ? e.heal / e.healN : 0,
      kind: claseDe(nombre, e),
      // Por debajo de esto se enseña, pero marcado como poca muestra.
      enough: e.n >= MIN_USOS,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

/**
 * Qué clase de cosa es esto, porque no todo lo que sale aquí es un hechizo.
 *
 *   ds      escudo de daño. `thorns` y `flames` suman 18.325 usos en un
 *           histórico real y ninguno es algo que lances: se disparan solos
 *           cuando te pegan. Darles gráfica de uso sería describir mal lo que
 *           son, así que se marcan y se dejan sin ella.
 *   cura?   la línea de curación no siempre dice de qué hechizo vino, y el
 *           analizador pone «cura». No es un hechizo llamado así: es curación
 *           sin identificar, y se rotula con ese nombre.
 *   heal    sólo cura, nunca ha hecho daño.
 *   spell   lo demás.
 */
function claseDe(nombre, e) {
  if (nombre === 'cura') return 'unknownHeal';
  if (nombre === 'thorns' || nombre === 'flames') return 'ds';
  if (e.n === 0 && e.healN > 0) return 'heal';
  return 'spell';
}

function get(m, nombre) {
  let e = m.get(nombre);
  if (!e) {
    e = { sum: 0, n: 0, crits: 0, max: 0, min: Infinity, landed: 0, resisted: 0,
      heal: 0, healN: 0, healMax: 0,
      tipos: new Map(), porFoe: new Map(), peleas: new Set() };
    m.set(nombre, e);
  }
  return e;
}

/**
 * Cooldowns medidos, y los que no se pueden medir.
 *
 * «You can use the ability X again in 1 minute(s) 30 seconds.» sale cuando lo
 * intentas DEMASIADO PRONTO, así que da el tiempo que falta, no el cooldown
 * entero. El máximo observado es una cota inferior, y sólo se acerca al valor
 * real si alguna vez lo reintentaste justo después de usarlo.
 *
 * Y hay habilidades cuyos usos no dejan rastro ninguno en el log: Companion's
 * Fury aparece 283 veces avisando de que aún no está lista y ni una sola vez
 * diciendo que se usó. De ésas se puede saber el cooldown y NO el
 * aprovechamiento, y la respuesta honesta es decirlo.
 */
export function cooldownsFromLog(eventos) {
  const cd = new Map();
  const usos = new Map();
  for (const ev of eventos) {
    if (ev.kind === 'ability_cd' && ev.ability) {
      const base = baseSpell(ev.ability);
      const s = parseLeft(ev.left);
      const e = cd.get(base) ?? { name: base, seconds: 0, attempts: 0, samples: [] };
      e.attempts++;
      if (s > e.seconds) e.seconds = s;
      e.samples.push(s);
      cd.set(base, e);
    }
    if ((ev.kind === 'cast' || ev.kind === 'spell' || ev.kind === 'dot') && ev.ability) {
      const base = baseSpell(ev.ability);
      usos.set(base, (usos.get(base) ?? 0) + 1);
    }
  }
  for (const [base, e] of cd) {
    e.uses = usos.get(base) ?? 0;
    // Con un solo aviso, o con avisos siempre a punto de expirar, la cota no
    // dice gran cosa: se marca para que la interfaz no la presente como firme.
    e.source = e.attempts >= 3 ? 'medido' : 'una sola muestra';
    // Sin rastro de uso no hay aprovechamiento que calcular. No es un cero.
    e.countable = e.uses > 0;
  }
  return cd;
}

function parseLeft(txt) {
  const t = String(txt ?? '');
  const h = /(\d+)\s*hour/.exec(t);
  const m = /(\d+)\s*minute/.exec(t);
  const s = /(\d+)\s*second/.exec(t);
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
}

/** Peleas mínimas para que una serie se dibuje. Con menos hay puntos, no tendencia. */
export const MIN_SERIE = 5;

/**
 * La ficha de UN hechizo: lo mismo que en la lista, más su historia.
 *
 * Va aparte de `catalog()` a propósito. El catálogo es la lista y se pide
 * entera; esto son 205 puntos de un solo hechizo y sólo hace falta al abrirlo.
 * Metiéndolo en la lista, cada consulta mandaría veinticuatro series por el
 * puente para enseñar una tabla.
 *
 * LA GRANULARIDAD, DICHA: un punto por PELEA, no por lanzamiento. El almacén
 * guarda por pelea cuánto sumó un hechizo y cuántas veces se usó, no el daño de
 * cada uso. Los lanzamientos sueltos sí llevan hora, pero no el daño asociado.
 * Así que aquí se ve cómo se comporta pelea a pelea, no la distribución de los
 * golpes.
 *
 * Y SE PARTE POR NIVEL Y POR DIFICULTAD, las dos cosas:
 *
 *   El nivel, porque en un histórico real hay peleas a nivel 24-29 y a 50, y
 *   cinco habilidades se usaron a los dos lados. Una línea que cruce ese salto
 *   dibuja un cambio de nivel y lo hace pasar por una mejora.
 *
 *   La dificultad, porque un hechizo que entra al 100% en D0 y se resiste en D4
 *   son dos cosas distintas. Promediarlas describe una que no existe.
 *
 * Lo que no llega a `MIN_SERIE` peleas NO se dibuja, y se devuelve aparte en
 * `descartadas` para poder decir cuánto se ha dejado fuera. Un hueco anunciado
 * es honesto; uno silencioso hace creer que no había nada.
 */
export function spellDetail(fights, self, nombre, cooldowns = new Map()) {
  const ficha = catalog(fights, self, cooldowns).find((x) => x.name === nombre);
  if (!ficha) return null;

  // Un punto por pelea, con el nivel y la dificultad que tenía esa pelea.
  const puntos = [];
  for (const f of fights) {
    if (!f) continue;
    const mio = (f.rows ?? []).find((r) => r.name === self);
    if (!mio) continue;
    const a = (mio.abilities ?? []).find((x) => x.name === nombre);
    const h = (mio.healBySpell ?? []).find((x) => x.name === nombre);
    if (!a && !h) continue;
    puntos.push({
      at: f.at ?? null,
      uid: f.uid ?? null,
      label: f.label ?? null,
      level: f.level ?? null,
      diff: f.diff ?? null,
      tag: f.diffTag ?? null,
      n: a?.n ?? 0,
      sum: a?.sum ?? 0,
      avg: a?.n ? a.sum / a.n : 0,
      max: a?.max ?? 0,
      crits: a?.crits ?? 0,
      heal: h?.sum ?? 0,
      healN: h?.n ?? 0,
    });
  }
  puntos.sort((x, y) => (x.at ?? 0) - (y.at ?? 0));

  // Una serie por (nivel, dificultad). La clave lleva las dos porque separar
  // sólo por una de ellas deja la otra mezclada dentro.
  const porTerna = new Map();
  for (const p of puntos) {
    const k = `${p.level ?? '?'}\u0000${p.diff ?? '?'}`;
    if (!porTerna.has(k)) {
      porTerna.set(k, { level: p.level, diff: p.diff, tag: p.tag, puntos: [] });
    }
    const g = porTerna.get(k);
    if (!g.tag && p.tag) g.tag = p.tag;
    g.puntos.push(p);
  }

  // El resumen de un tramo lleva las dos mitades. Un hechizo que sólo cura
  // tiene cero usos de DAÑO, y ese cero es «no aplica», no una medida: si la
  // ficha enseñara «media 0» al lado de 190.380 de curación, el cero se leería
  // como que pega flojo. Cada mitad con sus cifras y la interfaz elige.
  const resumen = (ps) => {
    const usos = ps.reduce((a, p) => a + p.n, 0);
    const sum = ps.reduce((a, p) => a + p.sum, 0);
    const heal = ps.reduce((a, p) => a + p.heal, 0);
    const healN = ps.reduce((a, p) => a + p.healN, 0);
    const crits = ps.reduce((a, p) => a + p.crits, 0);
    return {
      fights: ps.length,
      uses: usos, total: sum,
      avg: usos ? sum / usos : null,
      max: usos ? Math.max(0, ...ps.map((p) => p.max)) : null,
      crits, critRate: usos ? crits / usos : null,
      heal, healN, healAvg: healN ? heal / healN : null,
    };
  };

  const todas = [...porTerna.values()]
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.diff ?? 99) - (b.diff ?? 99));
  const series = todas.filter((g) => g.puntos.length >= MIN_SERIE)
    .map((g) => ({ ...g, ...resumen(g.puntos) }));
  const descartadas = todas.filter((g) => g.puntos.length < MIN_SERIE)
    .map((g) => ({ level: g.level, diff: g.diff, tag: g.tag, fights: g.puntos.length }));

  return {
    ...ficha,
    puntos,
    series,
    descartadas,
    minSerie: MIN_SERIE,
    // Con qué niveles se ha usado: si son varios, la ficha lo avisa aunque no
    // haya serie que dibujar.
    levels: [...new Set(puntos.map((p) => p.level).filter(Boolean))].sort((a, b) => a - b),
  };
}

/**
 * Tu libro de hechizos: los que CONSTA que tienes, los uses o no.
 *
 * LO QUE FALTABA. El catálogo sólo conocía los hechizos que habías LANZADO, y
 * peor aún, sólo los que hicieron daño. Un hechizo que tienes y no usas nunca
 * era invisible — y son justo los que interesa mirar.
 *
 * Y estaba en el registro sin que nadie lo leyera. Tres líneas distintas dicen
 * que un hechizo es tuyo, y medido sobre un histórico real dan 84 hechizos
 * frente a los 63 que llegaste a lanzar: cuarenta que tienes y no has usado
 * jamás.
 *
 *   escrito      «You have finished scribing X»          22 en ese registro
 *   comprado     «You purchased 1 Spell: X from Y»       23
 *   memorizado   «Beginning to memorize X»               62
 *
 * LAS TRES NO VALEN LO MISMO y por eso se guarda cuál fue. Escribir y comprar
 * son actos deliberados; memorizar es la más abundante y la más floja como
 * prueba —2.328 líneas para 62 hechizos distintos—, pero sigue significando que
 * lo tenías puesto.
 *
 * LO QUE NO PUEDE DECIR: los hechizos que ya tenías antes de que empezara el
 * registro. Se sabe que existen porque hay lanzados sin constancia de posesión
 * —19 en ese histórico— y se cuentan aparte en vez de callarlos.
 *
 * El fichero de `/output spellbook` daría el libro completo, 554 en vez de 84.
 * No se pide: quien no exporte nada tiene que tener la aplicación entera, y
 * esto funciona con lo que el juego ya escribe solo.
 */
export function spellbook(store, fights, self) {
  const conocidos = new Map();          // nombre -> Set de procedencias
  const lanzadosLog = new Set();        // lo que consta lanzado, del registro
  for (const e of store?.spellbook ?? []) {
    if (!e?.name) continue;
    // «lanzado» no es una procedencia del libro: es haberlo usado. Se anota
    // aparte para que no aparezca como si fuera prueba de que lo tienes — que
    // lo es, pero de otra manera, y la lista debe decir de dónde consta cada uno.
    if (e.via === 'lanzado') { lanzadosLog.add(e.name); continue; }
    if (!conocidos.has(e.name)) conocidos.set(e.name, { name: e.name, vias: new Set(), at: e.at ?? null });
    const c = conocidos.get(e.name);
    c.vias.add(e.via);
    // La primera constancia, que es cuando se supo que era tuyo.
    if (e.at && (!c.at || e.at < c.at)) c.at = e.at;
  }

  // Lo lanzado sale de los casteos, no del daño: un hechizo que no pega —una
  // cura, un buff— también se ha usado, y contarlo por el daño lo dejaría fuera.
  //
  // Y nunca del daño ni como respaldo. Las habilidades de una fila son tipos de
  // golpe, no conjuros: por ahí se colaron «bash», «punch», «slash», «flames»,
  // «thorns» y «reave» a la lista de hechizos lanzados. Con el registro entero
  // anotando cada casteo, el respaldo no cubría nada y ensuciaba seis nombres.
  const lanzados = new Map();
  for (const f of fights ?? []) {
    for (const c of f?.casts ?? []) {
      if (c.source !== self || !c.ability) continue;
      const e = lanzados.get(c.ability) ?? { n: 0, ultima: null };
      e.n++;
      const cuando = (f.at ?? 0) + (c.t ?? 0) * 1000;
      if (!e.ultima || cuando > e.ultima) e.ultima = cuando;
      lanzados.set(c.ability, e);
    }
  }

  const lista = [...conocidos.values()].map((c) => {
    const u = lanzados.get(c.name);
    return {
      name: c.name,
      vias: [...c.vias],
      at: c.at,
      uses: u?.n ?? 0,
      lastUsed: u?.ultima ?? null,
      // Usado si consta en el registro O en alguna pelea guardada. Lo primero
      // es más ancho: incluye lo lanzado fuera de combate.
      used: !!u || lanzadosLog.has(c.name),
    };
  }).sort((a, b) => (a.used === b.used ? b.uses - a.uses || a.name.localeCompare(b.name) : (a.used ? 1 : -1)));

  // Lanzados sin constancia de posesión: de antes del registro. No es un fallo
  // y no se esconde — es la parte del libro que este registro no puede ver.
  const sinConstancia = [...new Set([...lanzados.keys(), ...lanzadosLog])]
    .filter((n) => !conocidos.has(n)).sort();

  return {
    spells: lista,
    known: lista.length,
    unused: lista.filter((x) => !x.used).length,
    sinConstancia,
  };
}
