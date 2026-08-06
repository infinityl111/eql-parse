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
      // Por debajo de esto se enseña, pero marcado como poca muestra.
      enough: e.n >= MIN_USOS,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

function get(m, nombre) {
  let e = m.get(nombre);
  if (!e) {
    e = { sum: 0, n: 0, crits: 0, max: 0, min: Infinity, landed: 0, resisted: 0,
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
