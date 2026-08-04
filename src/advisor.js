import { t } from './i18n.js';
import { STANCES, INVOCATIONS, availableFor, normStance, normInvocation, CLASS_NAMES } from './stances.js';

const pct = (v) => `${Math.round(v * 100)}%`;

/**
 * Analiza una pelea y recomienda postura e invocación.
 *
 * La clave: el log guarda el daño YA MITIGADO. Si estabas en Defensive, el melé
 * que ves está a la mitad. Comparar posturas con esas cifras te empujaría
 * siempre hacia la que ya llevabas. Por eso el agregador guarda el daño BRUTO
 * (revertido con la mitigación de la postura activa en cada golpe) y todo el
 * análisis se hace sobre él.
 *
 * Lo que el log NO da: vigor y maná. Los costes se informan, pero no se puede
 * saber si te los puedes permitir. Eso lo pones tú.
 */
export function advise(row, ctx = {}) {
  if (!row) return null;
  const classes = ctx.classes ?? [];
  const { stances, invocations } = availableFor(classes);
  if (!stances.length && !invocations.length) return null;

  // ── Reparto del daño entrante, en bruto ──────────────
  const raw = row.rawTakenByType ?? [];
  let melee = 0, spell = 0;
  for (const t of raw) {
    if (t.name === 'melee' || t.name === 'physical') melee += t.sum;
    else spell += t.sum;
  }
  const incoming = melee + spell;

  // ── Defensa: cuánto habría evitado cada postura ──────
  const defence = stances
    .filter((s) => (s.mit.melee || s.mit.spell))
    .map((s) => {
      const prevented = melee * s.mit.melee + spell * s.mit.spell;
      let endurance = 0, mana = 0;
      if (s.costModel === 'mitigated') endurance = prevented;
      else if (s.costModel === 'split') { endurance = prevented / 2; mana = prevented / 2; }
      else if (s.costModel === 'evaded2') endurance = prevented * 2;
      return {
        key: s.key, label: s.label, prevented, endurance, mana,
        share: incoming ? prevented / incoming : 0,
        perEndurance: endurance ? prevented / endurance : Infinity,
        noteKey: s.noteKey, costModel: s.costModel,
      };
    })
    .sort((a, b) => b.prevented - a.prevented);

  // ── Ofensiva: qué aporta y a qué precio ──────────────
  const rawMeleeOut = row.rawMeleeOut ?? 0;
  const offence = stances
    .filter((s) => s.meleeBonus || s.skillWeapon)
    .map((s) => {
      const bonus = s.meleeBonus ? rawMeleeOut * s.meleeBonus : 0;
      return {
        key: s.key, label: s.label, bonus, endurance: bonus,
        noteKey: s.noteKey,
        approx: !s.meleeBonus,   // Striker/Ranged no se pueden estimar del log
      };
    })
    .sort((a, b) => b.bonus - a.bonus);

  // ── Invocación: se justifica con lo medido ───────────
  const signals = {
    resistencias: ctx.resistsSuffered ?? 0,
    interrupciones: ctx.interrupts ?? 0,
    curacion: row.healingDone ?? 0,
    dano_hechizo: (row.types ?? []).filter(([t]) => t !== 'melee').reduce((a, [, v]) => a + v, 0),
    dano_melee: (row.types ?? []).filter(([t]) => t === 'melee').reduce((a, [, v]) => a + v, 0),
  };
  const totalOut = signals.dano_hechizo + signals.dano_melee || 1;

  const invAdvice = invocations.map((iv) => {
    let score = 0;
    const why = [];
    if (iv.good?.includes('resistencias') && signals.resistencias) {
      score += signals.resistencias * 3;
      why.push(t('why.resists', { n: signals.resistencias }));
    }
    if (iv.good?.includes('interrupciones') && signals.interrupciones) {
      score += signals.interrupciones * 3;
      why.push(t('why.interrupts', { n: signals.interrupciones }));
    }
    if (iv.good?.includes('curacion') && signals.curacion) {
      score += 8;
      why.push(t('why.healing', { n: Math.round(signals.curacion) }));
    }
    if (iv.good?.includes('dano_hechizo') && signals.dano_hechizo / totalOut > 0.35) {
      score += 10;
      why.push(t('why.magicShare', { pct: pct(signals.dano_hechizo / totalOut) }));
    }
    if (iv.good?.includes('dano_melee') && signals.dano_melee / totalOut > 0.35 && signals.dano_hechizo > 0) {
      score += 9;
      why.push(t('why.mixed'));
    }
    if (iv.good?.includes('sostenido')) score += 1;
    return { key: iv.key, label: iv.label, score, why, noteKey: iv.noteKey };
  }).sort((a, b) => b.score - a.score);

  // ── Resumen ──────────────────────────────────────────
  const best = defence[0];
  const current = normStance(ctx.stance);
  const cur = defence.find((d) => d.key === current);
  let verdict = null;
  if (best && incoming > 0) {
    const gain = cur ? best.prevented - cur.prevented : best.prevented;
    if (cur && best.key === current) {
      verdict = t('adv.alreadyBest', { stance: best.label });
    } else if (gain > incoming * 0.04) {
      verdict = t('adv.wouldGain', { stance: best.label, n: Math.round(gain),
        current: cur ? cur.label : t('adv.yourStance') });
    } else {
      verdict = t('adv.notWorth', { stance: best.label, current: cur ? cur.label : t('adv.yourStance') });
    }
  }

  return {
    classes, classNames: classes.map((c) => CLASS_NAMES[c] ?? c),
    incoming: { melee, spell, total: incoming, meleeShare: incoming ? melee / incoming : 0 },
    defence, offence, invocations: invAdvice.slice(0, 4),
    current: { stance: ctx.stance ?? null, invocation: ctx.invocation ?? null },
    verdict,
  };
}

/** Una línea corta para el overlay. */
export function briefAdvice(a) {
  if (!a || !a.incoming.total) return null;
  const best = a.defence[0];
  if (!best) return null;
  const cur = normStance(a.current.stance);
  if (best.key === cur) return null;   // ya vas bien, no molestar
  const mix = a.incoming.meleeShare;
  const kind = mix > 0.7 ? 'fisico' : mix < 0.3 ? 'magico' : 'equilibrado';
  return t('ov.brief', { kind: t(`adv.kind.${kind}`), stance: best.label,
    pct: Math.round(best.share * 100) });
}

export { STANCES, INVOCATIONS };

/**
 * Consejo EN VIVO sobre una ventana móvil, no sobre la pelea entera.
 *
 * La lógica es la del wiki, pero resuelta con tus cifras:
 *   Defensive   evita  0,50·melé + 0,20·mágico
 *   Mage Hunter evita  0,20·melé + 0,50·mágico
 *   Channeler   evita  0,40·(melé + mágico)
 *
 * De ahí salen dos umbrales que no son evidentes a ojo:
 *   Channeler supera a Defensive cuando  mágico > melé/2
 *   Channeler supera a Mage Hunter cuando melé  > mágico/2
 * Es decir: Channeler es la elección correcta en la franja central,
 * no un término medio conformista.
 *
 * Sólo devuelve algo si el cambio merece la pena, para no dar la lata.
 */
/**
 * Sugerir un cambio de postura exige tres cosas a la vez, no una.
 *
 * Con sólo el 8% relativo bastaban dos ticks de veneno mientras te buffean
 * para pedirte Mage Hunter: sobre 40 puntos de daño, cualquier diferencia es
 * un porcentaje enorme. Un cambio de postura cuesta 6 segundos de reutilización
 * y tu atención en mitad de la pelea, así que hace falta que el daño medido sea
 * de verdad y que la ganancia sea apreciable en valor absoluto.
 */
const LIVE_MIN_RAW = 1200;   // daño bruto mínimo en la ventana
const LIVE_MIN_HITS = 5;     // golpes mínimos recibidos
const LIVE_MIN_GAIN = 350;   // ganancia mínima en puntos, no sólo en porcentaje

export function liveAdvice(win, ctx = {}) {
  const { melee = 0, spell = 0, total = 0, seconds = 20, hits = 0 } = win;
  if (total <= 0) return null;
  const { stances } = availableFor(ctx.classes ?? []);
  const usable = stances.filter((s) => s.mit.melee || s.mit.spell);
  if (!usable.length) return null;

  const scored = usable.map((s) => ({
    key: s.key, label: s.label,
    prevented: melee * s.mit.melee + spell * s.mit.spell,
    costModel: s.costModel,
  })).sort((a, b) => b.prevented - a.prevented);

  const best = scored[0];
  const cur = normStance(ctx.stance);
  const curScore = scored.find((s) => s.key === cur);
  const meleeShare = melee / total;
  const kind = meleeShare > 0.7 ? 'fisico' : meleeShare < 0.3 ? 'magico' : 'equilibrado';

  // Umbral: por debajo del 8% de mejora no compensa gastar el cambio de postura
  // (6 segundos de reutilización) ni la atención en mitad de la pelea.
  const gain = best.prevented - (curScore?.prevented ?? 0);
  const worth = total ? gain / total : 0;

  return {
    melee, spell, total, seconds, meleeShare, kind,
    dps: total / seconds,
    best: best.label, bestKey: best.key,
    current: ctx.stance ?? null,
    alreadyBest: curScore?.key === best.key,
    gain, worth,
    hits,
    // Sin muestra suficiente se informa del reparto, pero no se sugiere nada.
    enoughSample: total >= LIVE_MIN_RAW && hits >= LIVE_MIN_HITS,
    suggest: !!curScore && curScore.key !== best.key
      && total >= LIVE_MIN_RAW && hits >= LIVE_MIN_HITS
      && worth >= 0.08 && gain >= LIVE_MIN_GAIN,
    scored,
    text: t('ov.brief', { kind: t(`adv.kind.${kind}`), stance: best.label,
      pct: Math.round((best.prevented / total) * 100) }),
  };
}
