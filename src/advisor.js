import { t } from './i18n.js';
import { STANCES, INVOCATIONS, availableFor, normStance, normInvocation, CLASS_NAMES,
  SIN_MITIGACION } from './stances.js';

const pct = (v) => `${Math.round(v * 100)}%`;

/** Impactos recibidos por debajo de los cuales no se dictamina nada. */
const MIN_HITS_FOR_VERDICT = 8;

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
  // Lo que se te ha visto usar cuenta como disponible aunque las clases no lo
  // expliquen: ver `availableFor`. Sin esto, unas clases mal deducidas dejaban
  // el consejo mudo.
  const { stances, invocations } = availableFor(classes, ctx.seenStances, ctx.seenInvocations);
  if (!stances.length && !invocations.length) return null;

  // ── Reparto del daño entrante, en bruto ──────────────
  //
  // TRES CUBOS Y NO DOS, y el tercero es el que faltaba.
  //
  // Aquí ponía «lo que no es melé es mágico», y con eso el daño periódico y el
  // escudo de daño entraban en el cubo mágico y se les aplicaba la mitigación
  // de cada postura. Medido, ninguna postura los reduce (ver `mitigationFor`),
  // así que la tabla de abajo le apuntaba a Channeler un 40% de prevención
  // sobre un daño que Channeler no previene.
  //
  // No es un detalle: en un histórico real son 150.852 de los 717.467 puntos
  // no-melé recibidos, el 21,0% de lo que el consejo trataba como evitable.
  //
  // EL CUBO NO SE DESCUENTA DEL DAÑO RECIBIDO. Ese daño lo recibiste: sale del
  // total y de la vida que perdiste. Lo que no hace es entrar en `prevented` de
  // ninguna postura — y como `share` se divide por el total, el porcentaje de
  // cada postura baja al pasar por aquí, que es lo correcto: describe lo que
  // esa postura te habría ahorrado de TODO lo que te entró, no de la parte que
  // le convenía.
  const raw = row.rawTakenByType ?? [];
  let melee = 0, spell = 0, unmitigable = 0;
  for (const t of raw) {
    if (t.name === 'melee' || t.name === 'physical') melee += t.sum;
    else if (SIN_MITIGACION.has(t.name)) unmitigable += t.sum;
    else spell += t.sum;
  }
  const incoming = melee + spell + unmitigable;

  // ── Evasión: se mide contando golpes, no escalando daño ──
  //
  // Una postura que evita no reduce el golpe: lo quita entero. Así que lo que
  // ahorraría no es una fracción del daño recibido, sino
  //     golpes que te habrían entrado × daño medio por golpe.
  //
  // Los dos factores se miden en el log: los golpes que entraron traen su
  // cuenta en `rawTakenByType`, y los que fallaron están en `defense`. De ahí
  // sale también la tasa base a la que te entran los golpes sin postura, que es
  // lo que permite comparar evadir con mitigar en la misma escala.
  const meleeRaw = raw.find((t) => t.name === 'melee' || t.name === 'physical');
  const landedMelee = meleeRaw?.n ?? 0;
  const avoidedMelee = (row.defense ?? []).reduce((a, d) => a + (Array.isArray(d) ? d[1] : d.n ?? 0), 0);
  const meleeSwings = landedMelee + avoidedMelee;
  const avgMeleeHit = landedMelee ? melee / landedMelee : 0;
  // Tasa a la que te entran los golpes AHORA. Sólo describe la tasa base si la
  // postura activa no evade; si evade, esta cifra ya lleva su 95% dentro y no
  // se puede separar sin un tramo fuera de esa postura.
  const landRate = meleeSwings ? landedMelee / meleeSwings : 0;
  const activeEvades = !!STANCES[normStance(ctx.stance)]?.evade?.melee;
  // Con la postura activa evadiendo no hay forma de saber cuánto te entraría
  // sin ella: el log no distingue un esquive de postura de una parada normal.
  const unknownBase = activeEvades && landedMelee > 0;

  // ── Defensa: cuánto habría evitado cada postura ──────
  const defence = stances
    .filter((s) => (s.mit.melee || s.mit.spell || s.evade?.melee || s.evade?.spell))
    .map((s) => {
      // Mitigar: una fracción de cada golpe que entra.
      let prevented = melee * (s.mit.melee ?? 0) + spell * (s.mit.spell ?? 0);
      let approx = false;
      // Evadir: los golpes que dejarían de entrar, por su daño medio.
      if (s.evade?.melee && meleeSwings > 0) {
        // De los golpes que te entran ahora, cuántos seguirían entrando con
        // esta postura: evade el 95% de TODOS los ataques, no sólo de los que
        // habrían acertado.
        const entrarian = meleeSwings * (1 - s.evade.melee);
        prevented += Math.max(0, (landedMelee - entrarian) * avgMeleeHit);
        approx = unknownBase;
      }
      let endurance = 0, mana = 0;
      if (s.costModel === 'mitigated') endurance = prevented;
      else if (s.costModel === 'split') { endurance = prevented / 2; mana = prevented / 2; }
      else if (s.costModel === 'evaded2') endurance = prevented * 2;
      return {
        key: s.key, label: s.label, prevented, endurance, mana, approx,
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
  //
  // El daño entrante se reconstruye dividiendo cada golpe por lo que la postura
  // activa mitigaba, así que la reconstrucción sólo vale lo que valga la muestra
  // de golpes que la sostiene. Con Evasive al 95% el bruto sale de un puñado de
  // impactos multiplicados por veinte: dos golpes bastaban para pintar una tabla
  // de miles de puntos con aspecto de medición firme. Con muestra corta se
  // enseña el reparto, pero no se dictamina.
  const landed = (row.takenByType ?? []).reduce((a, x) => a + (x.n ?? 0), 0);
  const lowSample = landed > 0 && landed < MIN_HITS_FOR_VERDICT;

  // ── Lo que evitaste DE VERDAD, tramo a tramo ────────
  //
  // AQUÍ ESTABA EL FALLO. `cur` se buscaba con una sola postura —la que más
  // tiempo aguantó— y se aplicaba al daño ENTERO de la pelea. En una pelea
  // donde bailas eso acredita la postura equivocada durante todos los tramos
  // que no eran suyos, y como el veredicto compara contra `cur`, la ganancia
  // que anuncia describe una pelea que no ocurrió.
  //
  // Con el daño partido por postura la cuenta es directa: cada tramo con la
  // suya. Lo que evita una postura es lineal en el daño, así que sumar los
  // tramos da exactamente lo mismo que integrarlos uno a uno.
  //
  // LA TABLA DE CANDIDATAS NO CAMBIA, y conviene entender por qué: «cuánto
  // habría evitado Defensive» se aplica al daño entero en las dos versiones,
  // porque la hipótesis es haberla llevado TODA la pelea. Lo único que estaba
  // mal era el otro lado de la resta.
  /**
   * TRES ESTADOS Y NO DOS, y confundir los dos últimos rotula mal la pelea:
   *
   *   campo ausente   pelea guardada antes de que esto se midiera. Su veredicto
   *                   se calcula contra una sola postura y hay que decirlo.
   *   campo vacío     pelea medida, pero no consta ninguna postura en ella. No
   *                   es lo mismo, y merece que NO se le eche encima el cartel
   *                   de «esta pelea es vieja».
   *   con tramos      lo normal.
   */
  const medidoPorPostura = Array.isArray(row.takenByStance);
  const tramos = (row.takenByStance ?? []).filter((t) => t.stance);
  const prevenidoEn = (t) => {
    const st = STANCES[normStance(t.stance)];
    if (!st) return 0;            // postura desconocida: no se le acredita nada
    let p = (t.melee ?? 0) * (st.mit.melee ?? 0) + (t.spell ?? 0) * (st.mit.spell ?? 0);
    const swings = (t.landed ?? 0) + (t.avoided ?? 0);
    if (st.evade?.melee && swings > 0) {
      const avg = t.landed ? t.melee / t.landed : 0;
      const entrarian = swings * (1 - st.evade.melee);
      p += Math.max(0, ((t.landed ?? 0) - entrarian) * avg);
    }
    return p;
  };
  const conDano = tramos.filter((t) => (t.melee ?? 0) + (t.spell ?? 0) + (t.unmit ?? 0) > 0);
  const bailaste = conDano.length > 1;
  const prevenidoReal = tramos.length ? tramos.reduce((a, t) => a + prevenidoEn(t), 0) : null;

  const best = defence[0];
  const current = normStance(ctx.stance);
  const cur = defence.find((d) => d.key === current);
  let verdict = null;
  // Todo lo que te entró era de lo que ninguna postura para. No es que la que
  // llevabas fuera la mejor: es que la pregunta no tenía respuesta, y decir
  // «Defensive no compensa frente a Channeler» aquí sería contestar otra cosa.
  const nadaEvitable = incoming > 0 && melee + spell === 0;
  if (nadaEvitable) {
    verdict = t('adv.allUnmitigable', { n: Math.round(unmitigable) });
  }
  // Con una postura de evasión activa no se dictamina: lo que ves en el log es
  // el 5% de los ataques que se te colaron, y el log no distingue un esquive de
  // postura de una parada normal, así que no hay forma de saber cuánto te
  // entraría sin ella. Hace falta un tramo fuera de esa postura.
  let gain = null;
  if (best && incoming > 0 && !lowSample && !unknownBase && !nadaEvitable) {
    // Contra lo que evitaste DE VERDAD si la pelea trae sus tramos; contra la
    // postura única sólo cuando no los hay —peleas guardadas antes de que esto
    // se midiera— y entonces se dice, en `segmentado`.
    const base = prevenidoReal !== null ? prevenidoReal : (cur ? cur.prevented : 0);
    gain = best.prevented - base;
    if (bailaste) {
      // BAILASTE, así que «ya llevabas la mejor» no es una frase que se pueda
      // decir: no llevabas una, llevabas varias. La pregunta que sí tiene
      // sentido es si sostener UNA sola lo habría hecho mejor que el baile.
      const usadas = conDano.map((x) => STANCES[normStance(x.stance)]?.label ?? x.stance).join(' · ');
      if (gain > incoming * 0.04) {
        verdict = t('adv.dancedWorse', { stance: best.label, n: Math.round(gain), used: usadas });
      } else {
        verdict = t('adv.dancedFine', { used: usadas, stance: best.label });
      }
    } else if (cur && best.key === current) {
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
    incoming: {
      melee, spell, total: incoming,
      // Cuánto de lo que te entró no lo paraba NINGUNA postura. Es una cota al
      // valor de todo lo que hay debajo, así que sale a la vista y no se queda
      // dentro: con el 60% del daño en daño periódico, la mejor postura posible
      // te ahorra como mucho el 40%, y eso cambia si merece la pena el cambio.
      unmitigable, mitigable: melee + spell,
      unmitigableShare: incoming ? unmitigable / incoming : 0,
      // El reparto melé/mágico se mide sobre lo que SÍ se puede mitigar: es lo
      // que decide entre Defensive y Mage Hunter, y meter ahí el periódico
      // empujaba la elección hacia la postura mágica sin motivo.
      meleeShare: (melee + spell) ? melee / (melee + spell) : 0,
      // Lo que recibiste de verdad, junto a la reconstrucción: sin las dos, el
      // «daño entrante (bruto)» no se puede contrastar con nada.
      observed: row.taken ?? 0, hits: landed,
      // Golpes de melé: los que entraron, los que fallaron y a qué ritmo entran.
      // Es lo que sostiene la puntuación de las posturas que evaden.
      meleeSwings, landedMelee, avoidedMelee, landRate,
    },
    defence, offence, invocations: invAdvice.slice(0, 4),
    current: { stance: ctx.stance ?? null, invocation: ctx.invocation ?? null },
    lowSample, unknownBase, verdict,
    /**
     * De dónde sale la comparación, para que se pueda ver y no haya que
     * deducirlo. `segmentado` en falso significa una pelea guardada antes de
     * que el daño se partiera por postura: su veredicto SÍ está calculado
     * contra una sola, y eso hay que decirlo en vez de que parezca lo mismo.
     */
    segmentado: medidoPorPostura,
    conTramos: prevenidoReal !== null,
    bailaste,
    prevenidoReal,
    gain,
    tramos: conDano.map((x) => ({
      stance: x.stance,
      label: STANCES[normStance(x.stance)]?.label ?? x.stance,
      melee: x.melee ?? 0, spell: x.spell ?? 0, unmit: x.unmit ?? 0,
      hits: x.n ?? 0, avoided: x.avoided ?? 0,
      prevented: prevenidoEn(x),
    })).sort((a, b) => b.prevented - a.prevented),
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
 *
 * El mínimo va sobre el daño RECIBIDO, no sobre el reconstruido. Sobre el
 * reconstruido, una postura de evasión al 95% multiplica la ventana por veinte
 * y cruzaba el umbral con sesenta puntos de daño real: la guarda existía pero
 * era veinte veces más floja justo para las clases que llevan Evasive.
 *
 * La ganancia sí es directamente comparable: es una diferencia entre daños
 * recibidos —raw·(mit_mejor − mit_actual)— así que ya está en puntos reales.
 */
const LIVE_MIN_TAKEN = 1200; // daño RECIBIDO mínimo en la ventana
const LIVE_MIN_HITS = 5;     // golpes mínimos recibidos
const LIVE_MIN_GAIN = 350;   // ganancia mínima en puntos, no sólo en porcentaje

/**
 * EL UMBRAL DEL 8%, MEDIDO. Corpus, fecha y quién.
 *
 * CORPUS: 428 peleas guardadas de UN SOLO JUGADOR (Campeon, SHD/DRU/MAG y
 * SHD/SHM/MAG, niveles 24-50), sobre un registro de 378.299 líneas. Medido el
 * 9 de agosto de 2026 reproduciendo la ventana móvil segundo a segundo.
 *
 * ESTO ES CALIBRACIÓN DE UN JUGADOR, NO DEL JUEGO. Las posturas que salen aquí
 * son las de un Shadow Knight con secundarias de lanzador; un Monje con Evasive
 * o un Berserker con Striker tienen otros saltos y podrían apelmazarse en otros
 * valores. Quien tenga un corpus distinto debería volver a medir antes de creerse
 * este número.
 *
 * LA DISTRIBUCIÓN NO ES CONTINUA, y eso es lo que gobierna la elección. `worth`
 * se apelmaza en los saltos exactos entre mitigaciones de la tabla:
 *
 *     50,0%   101 peleas   de una postura sin mitigación a Defensive, melé puro
 *     10,0%    43 peleas   Channeler 0,40 → Defensive 0,50, melé puro
 *     30,0%    20 peleas   Mage Hunter 0,20 → Defensive 0,50
 *     el resto: valores sueltos, ninguno más de 2 peleas
 *
 * Así que mover el umbral no cuesta lo mismo en todas partes. Peleas que lo
 * cruzan en algún segundo, de 428:
 *
 *     4%  258      8%  232  ← el actual      10,0%  208
 *     6%  246      9%  229                   10,1%  174
 *
 * De 4% a 9% el comportamiento apenas se mueve —258 a 229 en cinco puntos—. El
 * 8% está en una meseta. El acantilado está en 10,1%: una décima por encima del
 * pico tira 34 peleas de golpe.
 *
 * Y EL PICO DEL 10% NO ES UN VALOR, ES UNA NUBE. De las 43 peleas que caen ahí,
 * sólo 15 valen exactamente 0.1 como número máquina; 19 valen
 * 0.10000000000000002 y las otras 9 rondan 0.09999999999999996. Coinciden todas
 * hasta la décima cifra significativa —es la misma cantidad por caminos de coma
 * flotante distintos—, pero NO son iguales entre sí. Consecuencia práctica: un
 * umbral puesto exactamente en 0.10 partiría ese grupo en dos por ruido de
 * redondeo, dejando fuera unas nueve peleas sin ningún motivo que se pueda
 * explicar. Otra razón para no poner el umbral encima de un pico.
 *
 * (Los otros dos picos sí son limpios: las 101 del 50% valen exactamente 0.5, y
 * 18 de las 20 del 30% valen exactamente 0.3.)
 *
 * QUÉ NO DICE ESTE NÚMERO: si el consejo acierta. Dice cuántas veces habla.
 */
const LIVE_MIN_WORTH = 0.08;

export function liveAdvice(win, ctx = {}) {
  const { melee = 0, spell = 0, unmitigable = 0, total = 0, seconds = 20, hits = 0,
    observed = total, landedMelee = 0, meleeSwings = 0 } = win;
  if (total <= 0) return null;
  // Lo que ninguna postura para. Entra en el total —te lo estás comiendo— pero
  // no en lo que se compara, y sobre todo no en el umbral: pedir un cambio de
  // postura por una ventana que es casi toda daño periódico sería pedirlo por
  // un daño que el cambio no va a tocar.
  const mitigable = melee + spell;
  const { stances } = availableFor(ctx.classes ?? [], ctx.seenStances);
  const usable = stances.filter((s) => s.mit.melee || s.mit.spell || s.evade?.melee || s.evade?.spell);
  if (!usable.length) return null;

  const avgMeleeHit = landedMelee ? melee / landedMelee : 0;
  const scored = usable.map((s) => {
    let prevented = melee * (s.mit.melee ?? 0) + spell * (s.mit.spell ?? 0);
    // Evadir se cuenta en golpes, no en daño: ver el bloque equivalente de
    // advise() para el porqué.
    if (s.evade?.melee && meleeSwings > 0) {
      const entrarian = meleeSwings * (1 - s.evade.melee);
      prevented += Math.max(0, (landedMelee - entrarian) * avgMeleeHit);
    }
    return { key: s.key, label: s.label, prevented, costModel: s.costModel };
  }).sort((a, b) => b.prevented - a.prevented);

  // Con una postura de evasión puesta, lo que se ve es el 5% de los ataques que
  // se colaron y no hay forma de saber cuánto entraría sin ella: se informa del
  // reparto, pero no se sugiere cambiar.
  const activeEvades = !!STANCES[normStance(ctx.stance)]?.evade?.melee;

  const best = scored[0];
  const cur = normStance(ctx.stance);
  const curScore = scored.find((s) => s.key === cur);
  // Físico o mágico se decide sobre lo MITIGABLE: es la pregunta «¿Defensive o
  // Mage Hunter?», y el daño periódico no vota en ella. Contándolo, una pelea
  // de melé con dos venenos encima salía «mágica» y el consejo iba al revés.
  const meleeShare = mitigable ? melee / mitigable : 0;
  const kind = meleeShare > 0.7 ? 'fisico' : meleeShare < 0.3 ? 'magico' : 'equilibrado';

  // Umbral: por debajo de `LIVE_MIN_WORTH` no compensa gastar el cambio de
  // postura (6 segundos de reutilización) ni la atención en mitad de la pelea.
  // De dónde sale ese número y sobre qué corpus, en su constante.
  //
  // Y SE DIVIDE POR EL TOTAL, no por lo mitigable, a propósito. La pregunta es
  // si el cambio te cambia la pelea, y con el 90% de lo que entra en daño
  // periódico, mejorar el 10% restante un 40% te ahorra el 4% de lo que te
  // están haciendo. Dividir por lo mitigable diría 40% y te sacaría del combate
  // por nada.
  const gain = best.prevented - (curScore?.prevented ?? 0);
  const worth = total ? gain / total : 0;

  return {
    melee, spell, total, observed, seconds, meleeShare, kind,
    unmitigable, mitigable, unmitigableShare: total ? unmitigable / total : 0,
    // El ritmo que se enseña es el que estás recibiendo de verdad, no el
    // reconstruido: es lo que el jugador puede contrastar con su barra de vida.
    dps: observed / seconds,
    best: best.label, bestKey: best.key,
    current: ctx.stance ?? null,
    alreadyBest: curScore?.key === best.key,
    gain, worth,
    hits,
    // Sin muestra suficiente se informa del reparto, pero no se sugiere nada.
    enoughSample: observed >= LIVE_MIN_TAKEN && hits >= LIVE_MIN_HITS,
    unknownBase: activeEvades,
    suggest: !!curScore && curScore.key !== best.key && !activeEvades
      && observed >= LIVE_MIN_TAKEN && hits >= LIVE_MIN_HITS
      && worth >= LIVE_MIN_WORTH && gain >= LIVE_MIN_GAIN,
    scored,
    text: t('ov.brief', { kind: t(`adv.kind.${kind}`), stance: best.label,
      pct: Math.round((best.prevented / total) * 100) }),
  };
}
