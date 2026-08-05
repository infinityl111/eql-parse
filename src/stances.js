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

import { t } from './i18n.js';

export const CLASSES = ['BER','BRD','BST','CLR','DRU','ENC','MAG','MNK','NEC','PAL','RNG','ROG','SHD','SHM','WAR','WIZ'];


/** Nombre de la clase en el idioma activo. */
export const className = (c) => t(`cl.${c}`);
export const CLASS_NAMES = new Proxy({}, { get: (_, c) => t(`cl.${String(c)}`) });

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
    noteKey: 'sn.balanced',
  },
  defensive: {
    label: 'Defensive', mit: { melee: 0.50, spell: 0.20 },
    costModel: 'mitigated', classes: ['PAL','SHD','WAR'],
    noteKey: 'sn.defensive',
  },
  'mage hunter': {
    label: 'Mage Hunter', mit: { melee: 0.20, spell: 0.50 },
    costModel: 'mitigated', classes: ['BER','PAL','SHD'],
    noteKey: 'sn.magehunter',
  },
  channeler: {
    label: 'Channeler', mit: { melee: 0.40, spell: 0.40 },
    costModel: 'split', classes: ['CLR','DRU','ENC','MAG','NEC','SHM','WIZ'],
    noteKey: 'sn.channeler',
  },
  // Evasive NO mitiga: evita el golpe entero. El wiki de EQL es literal —
  // «You have a 95% chance to evade all incoming attacks», «each point of
  // damage evaded costs 2 endurance».
  //
  // La diferencia no es de matiz. Un golpe que aparece en el log estando en
  // Evasive es uno que NO se evitó, y llegó sin mitigar: revertirlo dividiendo
  // entre (1 - 0,95) le inventa veinte veces el daño que tuvo. Por eso el 0,95
  // vive en `evade` y `mit` está a cero: `mitigationFor` sólo mira `mit`, así
  // que ningún golpe recibido en Evasive se reconstruye.
  //
  // Lo que evita Evasive se mide contando golpes, no escalando daño: los
  // esquivados aparecen en el log como fallos, y el advisor los usa.
  evasive: {
    label: 'Evasive', mit: { melee: 0.00, spell: 0.00 }, evade: { melee: 0.95, spell: 0.00 },
    costModel: 'evaded2', classes: ['BRD','MNK','RNG','BST','ROG'],
    noteKey: 'sn.evasive',
  },
  offensive: {
    label: 'Offensive', mit: { melee: 0, spell: 0 }, meleeBonus: 1.00, hit: 0.25,
    costModel: 'dealt', classes: ['BER','BRD','BST','MNK','PAL','RNG','ROG','SHD','WAR'],
    noteKey: 'sn.offensive',
  },
  striker: {
    label: 'Striker', mit: { melee: 0, spell: 0 }, skillWeapon: 3, skillOther: 5, hit: 0.25,
    costModel: 'dealt', classes: ['BER','MNK','ROG','WAR'],
    noteKey: 'sn.striker',
  },
  ranged: {
    label: 'Ranged', mit: { melee: 0, spell: 0 }, hit: 0.25,
    costModel: 'dealt', classes: ['BER','MNK','RNG','ROG'],
    noteKey: 'sn.ranged',
  },
  berserker: {
    label: 'Berserker', mit: { melee: 0, spell: 0 }, hit: 0.25, selfDamage: 0.083,
    costModel: 'dealt', classes: ['BER'],
    noteKey: 'sn.berserker',
  },
};

export const INVOCATIONS = {
  'arcane mastery': {
    label: 'Arcane Mastery', classes: ['ENC','MAG','NEC','SHD','WIZ'],
    scale: INT_CLASSES,
    noteKey: 'iv.arcanemastery',
    good: ['casteo'],
  },
  divine: {
    label: 'Divine', classes: ['BST','CLR','DRU','PAL','RNG','SHM'], scale: WIS_CLASSES,
    noteKey: 'iv.divine',
    good: ['curacion', 'grupo'],
  },
  empower: {
    label: 'Empower', classes: ['CLR','DRU','ENC','MAG','NEC','SHM','WIZ'], scale: NON_HYBRID_CASTERS,
    noteKey: 'iv.empower',
    good: ['dano_hechizo'],
  },
  inversion: {
    label: 'Inversion', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    noteKey: 'iv.inversion',
    good: ['interrupciones', 'movilidad'],
  },
  inviolable: {
    label: 'Inviolable', classes: ['BRD','WIZ'],
    noteKey: 'iv.inviolable',
    good: ['interrupciones'],
  },
  'over channel': {
    label: 'Over Channel', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    scale: NON_HYBRID_CASTERS,
    noteKey: 'iv.overchannel',
    good: ['resistencias'],
  },
  recovery: {
    label: 'Recovery', classes: ['BRD','BST','PAL','CLR','DRU','ENC','MAG','NEC','RNG','SHD','SHM','WIZ'],
    noteKey: 'iv.recovery',
    good: ['sostenido'],
  },
  spellblade: {
    label: 'Spellblade', classes: ['BST','PAL','RNG','SHD'],
    noteKey: 'iv.spellblade',
    good: ['hibrido', 'dano_melee'],
  },
  unyielding: {
    label: 'Unyielding', classes: ['BER','MNK','ROG','WAR'],
    noteKey: 'iv.unyielding',
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
