import { t } from './i18n.js';
import { availableFor, normStance, STANCES } from './stances.js';
import { controlKind } from './spells.js';

/**
 * Análisis posterior a una pelea grande.
 *
 * Regla que gobierna todo el módulo: cada conclusión sale de una cifra medida
 * y viene con su impacto cuantificado. Nada de "podrías mejorar la rotación":
 * si no se puede medir desde el log, no se dice.
 *
 * Lo que el log NO permite y por tanto no se afirma:
 *  - Vida, vigor ni maná de nadie, así que no se puede decir si una cura
 *    llegó tarde ni si te faltó vigor para sostener una postura.
 *  - Posiciones, rango ni line of sight.
 *  - La postura de los demás: sólo la tuya.
 *  - El tiempo de reutilización real de tus habilidades.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

/** Serie completa segundo a segundo, rellenando los huecos con ceros. */
function fullSeries(f) {
  const by = new Map((f.series ?? []).map((p) => [p.s, p]));
  const out = [];
  for (let i = 0; i <= f.duration; i++) {
    // `mine` tiene que ir en el relleno como los demás. Sin él, los segundos
    // vacíos daban `undefined`, que no es `=== 0` ni `> 0`, así que el corte de
    // fase por «dejaste de pegar» no se disparaba nunca en un silencio de
    // verdad: sólo si en esos segundos pasaba algo más. Justo al revés de lo
    // que se busca, que es el hueco en el que no pasa nada.
    out.push(by.get(i) ?? { s: i, dmg: 0, taken: 0, heal: 0, tMelee: 0, tSpell: 0, mine: 0 });
  }
  return out;
}

/**
 * Fases: se cortan por sucesos, no por tiempo arbitrario. Un add que entra o
 * alguien que muere cambia la pelea; un tercio cronométrico no significa nada.
 */
function phases(f, series) {
  const marks = new Set([0, f.duration]);
  for (const c of f.casts ?? []) if ((c.cat === 'summon' || c.cat === 'fear') && (f.__foes?.has(c.source))) marks.add(c.t);

  // 1. Cambio de composición del daño entrante. Es el corte que más importa:
  //    si el jefe pasa de golpear a quemarte, la postura correcta cambia.
  const W = 8;
  let prev = null;
  for (let i = 0; i + W <= series.length; i++) {
    const w = series.slice(i, i + W);
    const me = sum(w, (p) => p.tMelee), sp = sum(w, (p) => p.tSpell);
    if (me + sp < 100) continue;
    const share = me / (me + sp);
    const band = share > 0.65 ? 'melee' : share < 0.35 ? 'spell' : 'mixed';
    if (prev && band !== prev) marks.add(i);
    prev = band;
  }

  // 2. Silencios tuyos: tramos de 8 s o más sin que conectes nada.
  let runStart = null;
  for (const p of series) {
    if (p.mine === 0 && runStart === null) runStart = p.s;
    else if (p.mine > 0 && runStart !== null) {
      if (p.s - runStart >= 8) { marks.add(runStart); marks.add(p.s); }
      runStart = null;
    }
  }
  if (runStart !== null && f.duration - runStart >= 8) marks.add(runStart);

  // 3. Picos de daño recibido, el triple de la media.
  const avgTaken = sum(series, (p) => p.taken) / Math.max(1, series.length);
  let inSpike = false;
  for (const p of series) {
    const spike = avgTaken > 0 && p.taken > avgTaken * 3;
    if (spike && !inSpike) { marks.add(p.s); inSpike = true; }
    else if (!spike && inSpike) { marks.add(p.s); inSpike = false; }
  }

  // 4. Red de seguridad: una pelea larga sin ningún corte no dice nada.
  if (marks.size <= 2 && f.duration >= 90) {
    for (let s2 = 45; s2 < f.duration; s2 += 45) marks.add(s2);
  }

  const cuts = [...marks].sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v - a[i - 1] >= 8);   // nada de fases de 2 segundos
  if (cuts[cuts.length - 1] !== f.duration) cuts.push(f.duration);

  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i], to = cuts[i + 1];
    const win = series.filter((p) => p.s >= from && p.s < to);
    if (!win.length) continue;
    const secs = Math.max(1, to - from);
    const mineSecs = win.filter((p) => p.mine > 0).length;
    const melee = sum(win, (p) => p.tMelee);
    const spell = sum(win, (p) => p.tSpell);
    out.push({
      from, to, secs,
      dmg: sum(win, (p) => p.dmg), dps: sum(win, (p) => p.dmg) / secs,
      taken: sum(win, (p) => p.taken), dtps: sum(win, (p) => p.taken) / secs,
      heal: sum(win, (p) => p.heal),
      rawMelee: melee, rawSpell: spell,
      meleeShare: (melee + spell) ? melee / (melee + spell) : null,
      idle: secs - mineSecs,
    });
  }
  return out;
}

/** Qué postura tenías en un segundo dado. */
function stanceAt(f, sec) {
  let cur = null;
  for (const sp of f.stanceSpans ?? []) if (sp.from <= sec) cur = sp.stance;
  return cur;
}

function bestStanceFor(melee, spell, classes, vistas = []) {
  // Las posturas de esta misma pelea cuentan como disponibles: las llevabas
  // puestas. Ver `availableFor` — sin ellas, unas clases mal deducidas dejan
  // fuera de la comparación la postura que de verdad usaste.
  const { stances } = availableFor(classes ?? [], vistas);
  const usable = stances.filter((s) => s.mit.melee || s.mit.spell);
  if (!usable.length || (melee + spell) <= 0) return null;
  return usable.map((s) => ({
    key: s.key, label: s.label, prevented: melee * s.mit.melee + spell * s.mit.spell,
  })).sort((a, b) => b.prevented - a.prevented)[0];
}

export function analyse(f, ctx = {}) {
  if (!f || !f.rows?.length) return null;
  const self = ctx.self ?? 'You';
  const classes = ctx.classes ?? [];
  const series = fullSeries(f);
  const mine = f.rows.find((r) => r.name === self);
  const findings = [];
  const add = (o) => findings.push(o);

  // ── Quién es quién ─────────────────────────────────
  const pets = new Set(ctx.pets ?? []);
  // El motor ya clasifica cada fila; sólo se recalcula si viniera sin marcar.
  const foes = new Set();
  if (f.rows.some((r) => r.side)) {
    for (const r of f.rows) if (r.side === 'enemy') foes.add(r.name);
  } else {
    for (const r of f.rows) {
      for (const tg of r.targets ?? []) if (tg.name === self || pets.has(tg.name)) foes.add(r.name);
    }
  }
  const allies = f.rows.filter((r) => !foes.has(r.name));
  const enemies = f.rows.filter((r) => foes.has(r.name));

  // Los casteos se filtran por bando: sin esto tus propias curaciones de
  // Druida se contaban como "el enemigo se curó".
  const enemyCasts = (f.casts ?? []).filter((c) => foes.has(c.source));
  f.__foes = foes;
  const ph = phases(f, series);

  // ── 1. Tiempo muerto ───────────────────────────────
  //
  // ESTE HALLAZGO ACUSABA AL ARMA. Contaba como parado todo segundo sin daño
  // tuyo, y eso son dos cosas que no son un parón:
  //
  //   · los segundos en que atacaste y FALLASTE. Medido sobre el registro:
  //     4.798 de los 15.156 segundos con ataque tuyo, el 31,7%.
  //   · los huecos que pone tu arma. Tus huecos entre ataques son 1s (34,7%),
  //     2s (30,5%) y 3s (27,0%): con una cadencia así, media pelea no tiene
  //     daño por construcción.
  //
  // El resultado era un aviso que no avisaba de nada: sobre 357 peleas de 20 s
  // o más, saltaba en el 98,9% y en rojo en el 82,4%, con una mediana del 42%
  // «sin pegar». Un aviso que sale siempre es ruido con forma de aviso.
  //
  // Ahora se mide contra TU cadencia —el p90 de tus propios huecos en esta
  // pelea— y sólo cuenta lo que cada hueco pasa de ella. Lo que queda sí es
  // algo que hiciste: correr, morir, mirar el inventario, no tener objetivo.
  //
  // Las peleas viejas no traen la cadencia. No se aproxima con lo anterior: se
  // callan, que es lo que se sabe de ellas hasta reconstruir.
  /**
   * Y NO SE TE COBRA EL TIEMPO QUE NO MANEJABAS EL PERSONAJE.
   *
   * Con miedo no puedes actuar y con encanto no decides: los dos son
   * involuntarios y ninguno de los dos puede contar ni a favor ni en contra.
   * `huecoReal` ya no incluye esos segundos —se descuentan al medirlo— y aquí
   * hay que sacarlos TAMBIÉN del denominador, o el porcentaje sube por el otro
   * lado: cero segundos parados sobre una pelea que en un tercio no era tuya
   * seguiría describiendo mal lo que hiciste.
   *
   * Medido en el registro de referencia: 464 segundos en 31 tramos de 12
   * peleas, con uno de 38 s. La duración tampoco es un dato sobre ti — no la
   * decides — así que se va entera del reparto.
   */
  const sinMando = mine?.sinMandoSec ?? f.sinMandoSec ?? 0;
  const duracionTuya = Math.max(1, f.duration - sinMando);
  if (mine && f.duration >= 20 && mine.cadencia && mine.huecoReal !== null
      && mine.huecoReal !== undefined) {
    const idle = mine.huecoReal;
    const share = idle / duracionTuya;
    // Diez segundos de parón real, o un quinto de la pelea. Con la vara buena
    // el umbral puede ser más exigente: ya no acusa a nadie por su arma.
    if (share > 0.20 && idle >= 10) {
      const activos = Math.max(1, mine.swingSec ?? mine.hitSec ?? mine.activeSec);
      const lost = Math.round(idle * (mine.damage / activos) / mine.cadencia);
      add({
        id: 'downtime', level: share > 0.35 ? 'bad' : 'warn',
        accion: 'tuya',
        title: t('an.downtime'),
        detail: t('an.downtimeDetail', { s: idle, pct: Math.round(share * 100), cad: mine.cadencia }),
        impact: t('an.downtimeImpact', { n: lost.toLocaleString('es-ES') }),
      });
    } else {
      add({ id: 'uptime', level: 'good', accion: 'tuya', title: t('an.uptime'),
        detail: t('an.uptimeDetail', { pct: Math.round((1 - share) * 100), cad: mine.cadencia }) });
    }
  }

  // ── 2. Postura por fases ───────────────────────────
  if (classes.length) {
    let wasted = 0;
    const bad = [];
    /**
     * EL VEREDICTO DE POSTURA NO MIRA LOS SEGUNDOS SIN MANDO.
     *
     * La postura no se puede cambiar mientras te tienen: acusar a alguien de
     * llevar la equivocada durante un miedo es acusarle de una decisión que no
     * pudo tomar. Así que el daño recibido en esos segundos sale del cómputo,
     * y con él la comparación entera de ese tramo.
     *
     * Se recalculan los dos cubos de la fase saltándose esos segundos, en vez de
     * recortar la fase: una fase puede tener un tramo dentro y el resto bueno, y
     * tirarla entera perdería lo que sí se puede juzgar.
     */
    const fuera = new Set();
    for (const x of f.sinControl ?? []) {
      for (let s2 = x.desde; s2 <= x.hasta; s2++) fuera.add(s2);
    }
    const crudos = (p) => {
      if (!fuera.size) return { melee: p.rawMelee, spell: p.rawSpell };
      const win = series.filter((q) => q.s >= p.from && q.s < p.to && !fuera.has(q.s));
      return { melee: sum(win, (q) => q.tMelee), spell: sum(win, (q) => q.tSpell) };
    };
    for (const p0 of ph) {
      const c = crudos(p0);
      const p = { ...p0, rawMelee: c.melee, rawSpell: c.spell,
        meleeShare: (c.melee + c.spell) ? c.melee / (c.melee + c.spell) : null };
      if (p.meleeShare === null || (p.rawMelee + p.rawSpell) < 200) continue;
      const best = bestStanceFor(p.rawMelee, p.rawSpell, classes,
        (f.stanceSpans ?? []).map((x) => x.stance));
      const had = normStance(stanceAt(f, p.from));
      if (!best) continue;
      const hadMit = STANCES[had];
      const hadPrev = hadMit ? p.rawMelee * (hadMit.mit.melee ?? 0) + p.rawSpell * (hadMit.mit.spell ?? 0) : 0;
      const gain = best.prevented - hadPrev;
      if (best.key !== had && gain > (p.rawMelee + p.rawSpell) * 0.08) {
        wasted += gain;
        bad.push({ from: p.from, to: p.to, best: best.label, had: had || '—', gain: Math.round(gain) });
      }
    }
    if (bad.length) {
      add({
        id: 'stance', accion: 'tuya', level: wasted > (mine?.taken ?? 0) * 0.15 ? 'bad' : 'warn',
        title: t('an.stance'),
        detail: bad.slice(0, 3).map((b) =>
          t('an.stanceWindow', { from: b.from, to: b.to, had: b.had, best: b.best, n: b.gain })).join(' '),
        impact: t('an.stanceImpact', { n: Math.round(wasted).toLocaleString('es-ES') }),
      });
    } else if (ph.length) {
      add({ id: 'stanceOk', accion: 'tuya', level: 'good', title: t('an.stanceOk'), detail: t('an.stanceOkDetail') });
    }
  }

  // ── 3. Precisión ───────────────────────────────────
  if (mine && mine.meleeHits + mine.misses >= 30) {
    const plainMiss = (mine.missReasons ?? []).find(([k]) => /fallo|miss/i.test(k));
    const missShare = mine.misses / (mine.meleeHits + mine.misses);
    if (missShare > 0.35) {
      const lostSwings = Math.round(mine.misses - (mine.meleeHits + mine.misses) * 0.25);
      // Un swing fallado cuesta un GOLPE DE MELÉ, no un impacto medio de todo
      // lo que haces. Dividir el daño total entre todos los impactos mete los
      // hechizos dentro, y en un híbrido que hace la mitad del daño casteando
      // eso infla el «daño perdido por fallar» sin que se note de dónde sale.
      const meleeDmg = (mine.schools ?? []).find((s) => s.name === 'melee')?.sum ?? 0;
      const perHit = mine.meleeHits ? meleeDmg / mine.meleeHits : 0;
      add({
        id: 'accuracy', accion: 'personaje', level: missShare > 0.5 ? 'bad' : 'warn',
        title: t('an.accuracy'),
        detail: t('an.accuracyDetail', { pct: Math.round(missShare * 100), n: mine.misses,
          reason: plainMiss ? plainMiss[0] : '—' }),
        impact: lostSwings > 0 ? t('an.accuracyImpact', { n: Math.round(lostSwings * perHit).toLocaleString('es-ES') }) : null,
      });
    }
  }

  // ── 4. El enemigo se curó ──────────────────────────
  const heals = enemyCasts.filter((c) => c.cat === 'heal');
  if (heals.length) {
    add({
      id: 'enemyHeal', accion: 'tuya', level: heals.length > 2 ? 'bad' : 'warn',
      title: t('an.enemyHeal'),
      detail: t('an.enemyHealDetail', { n: heals.length, who: heals[0].source,
        when: heals.slice(0, 4).map((h) => `${h.t}s`).join(', ') }, undefined),
      impact: t('an.enemyHealImpact'),
    });
  }

  // ── 5. Control perdido: charm, fear, mez ───────────
  // Sólo lo que de verdad te quita segundos de pelea. Una ralentización entra
  // en la misma categoría de aviso que una raíz porque avisa igual de urgente,
  // pero el impacto que se afirma aquí —«cada uno son segundos sin pegar»— de
  // un slow es sencillamente falso: sigues pegando, más despacio.
  const control = enemyCasts.filter((c) => controlKind(c.cat, c.ability) === 'duro');
  if (control.length >= 2) {
    add({
      id: 'control', accion: 'contexto', level: 'warn', title: t('an.control'),
      detail: t('an.controlDetail', { n: control.length,
        kinds: [...new Set(control.map((c) => c.cat))].map((c) => t(`cat.${c}`)).join(', ') }),
      impact: t('an.controlImpact'),
    });
  }

  // ── 6. Interrupciones y resistencias ───────────────
  if ((f.interrupts ?? 0) >= 3) {
    add({ id: 'interrupts', accion: 'personaje', level: 'warn', title: t('an.interrupts'),
      detail: t('an.interruptsDetail', { n: f.interrupts }), impact: t('an.interruptsImpact') });
  }
  if ((f.resistsCaused ?? 0) >= 3) {
    add({ id: 'resistsCaused', accion: 'contexto', level: 'good', title: t('an.resistsCaused'),
      detail: t('an.resistsCausedDetail', { n: f.resistsCaused }) });
  }
  if ((f.resistsSuffered ?? 0) >= 4) {
    add({ id: 'resists', accion: 'personaje', level: 'warn', title: t('an.resists'),
      detail: t('an.resistsDetail', { n: f.resistsSuffered }), impact: t('an.resistsImpact') });
  }

  // ── 7. Curación desperdiciada ──────────────────────
  const healers = allies.filter((r) => r.healingDone > 0);
  const wastedHeal = sum(healers, (r) => Math.max(0, (r.healPotential ?? 0) - r.healingDone));
  const totalHeal = sum(healers, (r) => r.healingDone);
  if (totalHeal > 0 && wastedHeal > totalHeal * 0.25) {
    add({
      id: 'overheal', accion: 'tuya', level: 'warn', title: t('an.overheal'),
      detail: t('an.overhealDetail', { pct: Math.round((wastedHeal / (wastedHeal + totalHeal)) * 100) }),
      impact: t('an.overhealImpact', { n: Math.round(wastedHeal).toLocaleString('es-ES') }),
    });
  }

  // ── 8. Foco: daño repartido entre varios enemigos ──
  if (enemies.length > 2 && mine) {
    const tot = sum(mine.targets ?? [], (x) => x.sum) || 1;
    const top = (mine.targets ?? [])[0];
    if (top && top.sum / tot < 0.55) {
      add({
        id: 'focus', accion: 'tuya', level: 'warn', title: t('an.focus'),
        detail: t('an.focusDetail', { n: (mine.targets ?? []).length, pct: Math.round((top.sum / tot) * 100) }),
        impact: t('an.focusImpact'),
      });
    }
  }

  // ── 9. Muertes ─────────────────────────────────────
  const dead = allies.filter((r) => r.deaths > 0);
  if (dead.length) {
    add({
      id: 'deaths', accion: 'contexto', level: 'bad', title: t('an.deaths'),
      detail: dead.map((r) => {
        const killer = (r.takenBySource ?? [])[0];
        return t('an.deathsDetail', { who: r.name, killer: killer ? killer.name : '—',
          pct: killer ? Math.round((killer.sum / Math.max(1, r.taken)) * 100) : 0 });
      }).join(' '),
      impact: null,
    });
  }

  // ── 10. Tramo más peligroso ────────────────────────
  const worst = ph.slice().sort((a, b) => b.dtps - a.dtps)[0];
  if (worst && worst.dtps > 0 && ph.length > 1) {
    add({
      id: 'danger', accion: 'contexto', level: 'info', title: t('an.danger'),
      detail: t('an.dangerDetail', { from: worst.from, to: worst.to, dtps: Math.round(worst.dtps),
        kind: worst.meleeShare === null ? '—'
          : worst.meleeShare > 0.7 ? t('adv.kind.fisico')
          : worst.meleeShare < 0.3 ? t('adv.kind.magico') : t('adv.kind.equilibrado') }),
      impact: null,
    });
  }

  // ── 11. Ráfaga contra sostenido ────────────────────
  if (mine && f.duration >= 30) {
    let best10 = 0;
    for (let i = 0; i + 10 <= series.length; i++) {
      best10 = Math.max(best10, sum(series.slice(i, i + 10), (p) => p.dmg) / 10);
    }
    const ratio = f.raidDps ? best10 / f.raidDps : 0;
    if (ratio > 2.2) {
      add({
        id: 'burst', accion: 'contexto', level: 'info', title: t('an.burst'),
        detail: t('an.burstDetail', { peak: Math.round(best10), avg: Math.round(f.raidDps),
          x: ratio.toFixed(1) }),
        impact: t('an.burstImpact'),
      });
    }
  }

  /**
   * EL ORDEN: primero lo grave, y dentro de lo grave, lo que puedes cambiar.
   *
   * La gravedad manda —una muerte va arriba aunque no sea una acción— pero
   * entre dos avisos igual de graves va delante el que señala algo que harías
   * distinto en la siguiente pelea. Que te enraícen cuatro veces y que lleves
   * la postura equivocada eran los dos «warn» y salían mezclados; sólo uno de
   * los dos se puede corregir.
   *
   * Y cada hallazgo lleva su clase escrita, que es la otra mitad: sin el rótulo,
   * ordenarlos sólo cambia el sitio y sigue sin decir por qué está ahí.
   */
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  const orderAccion = { tuya: 0, personaje: 1, contexto: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]
    || (orderAccion[a.accion] ?? 9) - (orderAccion[b.accion] ?? 9));

  return {
    phases: ph,
    findings,
    roles: {
      topDamage: allies.slice().sort((a, b) => b.damage - a.damage)[0]?.name ?? null,
      topHealing: healers.sort((a, b) => b.healingDone - a.healingDone)[0]?.name ?? null,
      tank: allies.slice().sort((a, b) => b.taken - a.taken)[0]?.name ?? null,
    },
    allies: allies.map((r) => r.name),
    enemies: enemies.map((r) => r.name),
    score: clamp(100 - findings.filter((x) => x.level === 'bad').length * 18
                     - findings.filter((x) => x.level === 'warn').length * 7, 0, 100),
  };
}
