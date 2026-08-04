/**
 * Datos de stances e invocaciones de EQL (wiki, revisión de julio 2026).
 *
 * Las cifras de mitigación son las que permiten dos cosas:
 *   1. Revertir la mitigación del daño ya recibido, para comparar posturas
 *      sobre daño BRUTO. Sin esto el consejo se sesga siempre hacia la
 *      postura que ya llevabas puesta.
 *   2. Estimar cuánto habría evitado cada alternativa.
 *
 * El log no registra vigor ni maná, así que los costes son informativos:
 * dicen el precio, no si puedes pagarlo.
 */

export const CLASSES = ['BER','BRD','BST','CLR','DRU','ENC','MAG','MNK','NEC','PAL','RNG','ROG','SHD','SHM','WAR','WIZ'];
export const CLASS_NAMES = {
  BER:'Berserker', BRD:'Bardo', BST:'Beastlord', CLR:'Clérigo', DRU:'Druida',
  ENC:'Encantador', MAG:'Mago', MNK:'Monje', NEC:'Nigromante', PAL:'Paladín',
  RNG:'Explorador', ROG:'Pícaro', SHD:'Shadow Knight', SHM:'Chamán',
  WAR:'Guerrero', WIZ:'Brujo',
};

export const INT_CLASSES = ['ENC','MAG','NEC','WIZ'];
export const WIS_CLASSES = ['CLR','DRU','SHM'];
export const HYBRID_CLASSES = ['BST','BRD','RNG','PAL','SHD'];
const NON_HYBRID_CASTERS = [...INT_CLASSES, ...WIS_CLASSES];

/**
 * mit: fracción de daño evitada, por escuela.
 * costModel: cómo se paga.
 *   'free'          sin coste de mantenimiento
 *   'mitigated'     1 de vigor por punto reducido
 *   'split'         mitad del mitigado a vigor y mitad a maná
 *   'evaded2'       2 de vigor por punto evitado
 *   'dealt'         vigor igual al daño extra infligido
 */
export const STANCES = {
  balanced: {
    label: 'Balanced', mit: { melee: 0.10, spell: 0.10 }, hit: 0.10,
    costModel: 'free', classes: ['BER','BRD','BST','MNK','PAL','RNG','ROG','SHD','WAR'],
    note: 'Sin coste y duplica la regeneración de vigor. Es la de reserva.',
  },
  defensive: {
    label: 'Defensive', mit: { melee: 0.50, spell: 0.20 },
    costModel: 'mitigated', classes: ['PAL','SHD','WAR'],
    note: 'La mejor contra melé puro.',
  },
  'mage hunter': {
    label: 'Mage Hunter', mit: { melee: 0.20, spell: 0.50 },
    costModel: 'mitigated', classes: ['BER','PAL','SHD'],
    note: 'Espejo de Defensive: para daño mágico.',
  },
  channeler: {
    label: 'Channeler', mit: { melee: 0.40, spell: 0.40 },
    costModel: 'split', classes: ['CLR','DRU','ENC','MAG','NEC','SHM','WIZ'],
    note: 'Cobertura ante daño mixto y mejora el canalizado. Cuesta la mitad de vigor por punto, pero grava el maná.',
  },
  evasive: {
    label: 'Evasive', mit: { melee: 0.95, spell: 0.00 }, evade: 0.95,
    costModel: 'evaded2', classes: ['BRD','MNK','RNG','BST','ROG'],
    note: 'Evita el 95% de los ataques entrantes, pero falla si te quedas sin vigor.',
  },
  offensive: {
    label: 'Offensive', mit: { melee: 0, spell: 0 }, meleeBonus: 1.00, hit: 0.25,
    costModel: 'dealt', classes: ['BER','BRD','BST','MNK','PAL','RNG','ROG','SHD','WAR'],
    note: 'Duplica el daño melé. Por debajo del 25% de vigor pierdes precisión.',
  },
  striker: {
    label: 'Striker', mit: { melee: 0, spell: 0 }, skillWeapon: 3, skillOther: 5, hit: 0.25,
    costModel: 'dealt', classes: ['BER','MNK','ROG','WAR'],
    note: 'Multiplica las habilidades de combate, no el autoataque.',
  },
  ranged: {
    label: 'Ranged', mit: { melee: 0, spell: 0 }, hit: 0.25,
    costModel: 'dealt', classes: ['BER','MNK','RNG','ROG'],
    note: 'Sin distancia mínima, y el ataque a distancia puede doblar y triplicar.',
  },
  berserker: {
    label: 'Berserker', mit: { melee: 0, spell: 0 }, hit: 0.25, selfDamage: 0.083,
    costModel: 'dealt', classes: ['BER'],
    note: 'Duplica velocidad de ataque, pero te llevas el 8,3% de tu propio daño.',
  },
};

export const INVOCATIONS = {
  'arcane mastery': {
    label: 'Arcane Mastery', classes: ['ENC','MAG','NEC','SHD','WIZ'],
    scale: INT_CLASSES,
    note: 'Reduce tiempo de lanzamiento y recuperación un 20%, más un 10% por cada clase de inteligencia extra.',
    good: ['casteo'],
  },
  divine: {
    label: 'Divine', classes: ['BST','CLR','DRU','PAL','RNG','SHM'], scale: WIS_CLASSES,
    note: 'El maná gastado cura al miembro del grupo con menos vida. Convierte cualquier gasto en curación pasiva.',
    good: ['curacion', 'grupo'],
  },
  empower: {
    label: 'Empower', classes: ['CLR','DRU','ENC','MAG','NEC','SHM','WIZ'], scale: NON_HYBRID_CASTERS,
    note: 'Daño de hechizo +20% (y +10% por clase lanzadora no híbrida extra) a cambio de un 20% más de maná.',
    good: ['dano_hechizo'],
  },
  inversion: {
    label: 'Inversion', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    note: 'Pasa dos tercios del tiempo de lanzamiento a recuperación global: te expone menos a interrupciones.',
    good: ['interrupciones', 'movilidad'],
  },
  inviolable: {
    label: 'Inviolable', classes: ['BRD','WIZ'],
    note: 'Los hechizos no se pueden interrumpir, al precio del doble de maná más lo mismo en vigor.',
    good: ['interrupciones'],
  },
  'over channel': {
    label: 'Over Channel', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    scale: NON_HYBRID_CASTERS,
    note: 'Ajuste de resistencia de −150, más −15 por clase lanzadora no híbrida. Contra enemigos que te resisten mucho.',
    good: ['resistencias'],
  },
  recovery: {
    label: 'Recovery', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    note: 'Regeneras maná al doble y los hechizos cuestan un 5% menos. La de reserva para lanzadores.',
    good: ['sostenido'],
  },
  spellblade: {
    label: 'Spellblade', classes: ['BST','PAL','RNG','SHD'],
    note: 'Convierte la primera gema de hechizo en un proc. Pensada para builds que pegan a melé mientras procan.',
    good: ['hibrido', 'dano_melee'],
  },
  unyielding: {
    label: 'Unyielding', classes: ['BER','MNK','ROG','WAR'],
    note: 'Duplica la regeneración de vida y da un 25% de resistencia a miedo, mez y encanto. Sin coste.',
    good: ['sostenido', 'control'],
  },
};

/** Normaliza lo que escribe el log ("a defensive stance" -> "defensive"). */
export function normStance(s) {
  return String(s ?? '').toLowerCase().replace(/\s*stance\s*$/, '').trim();
}
export function normInvocation(s) {
  return String(s ?? '').toLowerCase().replace(/\s*invocation\s*$/, '').trim()
    .replace('overchannel', 'over channel').replace('empowering', 'empower');
}

/** Fracción de daño que una postura evita para una escuela dada. */
export function mitigationFor(stanceKey, school) {
  const st = STANCES[normStance(stanceKey)];
  if (!st) return 0;
  const isSpell = school === 'spell' || school === 'dot' || school === 'ds';
  return isSpell ? (st.mit.spell ?? 0) : (st.mit.melee ?? 0);
}

/** Stances e invocaciones disponibles para una combinación de clases. */
export function availableFor(classes) {
  const cs = (classes ?? []).filter(Boolean);
  const has = (list) => list.some((c) => cs.includes(c));
  return {
    stances: Object.entries(STANCES).filter(([, v]) => has(v.classes)).map(([k, v]) => ({ key: k, ...v })),
    invocations: Object.entries(INVOCATIONS).filter(([, v]) => has(v.classes)).map(([k, v]) => ({ key: k, ...v })),
  };
}

/**
 * Deduce las clases a partir de lo observado en el log.
 *
 * Principio: sólo se afirma lo que se puede demostrar. Se buscan TODAS las
 * combinaciones de hasta tres clases compatibles con lo visto y se devuelven
 * únicamente las clases presentes en todas ellas. Si no hay ninguna común, no
 * se devuelve nada y la interfaz pregunta.
 *
 * Adivinar mal es peor que no adivinar: viendo sólo Balanced, la versión
 * anterior proponía Bardo y Beastlord, y acababa recomendando Evasive a un
 * Shadow Knight, que no la tiene.
 */
export function inferClasses(seenStances = [], seenInvocations = []) {
  const wanted = [];
  for (const x of seenStances) { const v = STANCES[normStance(x)]; if (v) wanted.push(v.classes); }
  for (const x of seenInvocations) { const v = INVOCATIONS[normInvocation(x)]; if (v) wanted.push(v.classes); }
  const empty = { classes: [], inferred: true, confident: false, candidates: [] };
  if (!wanted.length) return empty;

  const covers = [];
  for (let a = 0; a < CLASSES.length; a++) {
    for (let b = a + 1; b < CLASSES.length; b++) {
      for (let c = b + 1; c < CLASSES.length; c++) {
        const combo = [CLASSES[a], CLASSES[b], CLASSES[c]];
        if (wanted.every((list) => list.some((k) => combo.includes(k)))) covers.push(combo);
      }
    }
  }
  if (!covers.length) return empty;

  const common = CLASSES.filter((c) => covers.every((t) => t.includes(c)));
  return {
    classes: covers.length === 1 ? covers[0] : common,
    inferred: true,
    confident: covers.length === 1,
    candidates: covers.slice(0, 8),
  };
}
