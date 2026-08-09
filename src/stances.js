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

/**
 * Normaliza lo que escribe el log ("a defensive stance" -> "defensive").
 *
 * El artículo se quita aunque la regla del parser ya lo deje fuera del grupo:
 * esta función la llaman sitios que reciben la frase entera, y devolver
 * «a channeler» —que no casa con ninguna postura— no falla a la vista, se queda
 * callado. Ninguna postura empieza por «a» o «an», así que no hay nada que
 * perder quitándolo.
 */
export function normStance(s) {
  return String(s ?? '').toLowerCase()
    .replace(/\s*stance\s*$/, '').replace(/^an?\s+/, '').trim();
}
export function normInvocation(s) {
  return String(s ?? '').toLowerCase().replace(/\s*invocation\s*$/, '').trim()
    .replace('overchannel', 'over channel').replace('empowering', 'empower');
}

/**
 * Escuelas que la postura NO mitiga. MEDIDO, no supuesto.
 *
 * Aquí ponía que `dot` y `ds` iban con la mitigación mágica, y el registro dice
 * que no. La prueba es una que podía fallar y no falló:
 *
 *   NUEVE aplicaciones de daño periódico recibido cruzan un cambio de postura
 *   con el hechizo ya puesto. En las nueve, el valor del tick NO se mueve ni un
 *   punto. `Envenomed Breath` de `a loathling lich` cruza Offensive (0,00) ↔
 *   Defensive (0,20) dos veces y vale 90 siempre; `Rotting Flesh` de
 *   `a dracoliche` cruza Defensive (0,20) ↔ Channeler (0,40) en los dos
 *   sentidos y vale 100 en los 42 ticks.
 *
 *   Y tampoco se aplica al lanzar, que era la otra lectura posible: el mismo
 *   `Ignite Blood` del mismo `Amygdalan warrior` vale 125 bajo Defensive y 125
 *   bajo Channeler, en aplicaciones distintas.
 *
 *   Con el escudo de daño, igual: `a spite golem` te pincha por 18 bajo
 *   Defensive, bajo Channeler y bajo Offensive.
 *
 * NO ES SIMETRÍA CON `spell`, Y CONVIENE VERLO. El hechizo directo SÍ se
 * mitiga, y con exactitud de libro: `Soul Devour` de `Eye of Veeshan` pega 400
 * con Defensive (0,20), 300 con Channeler (0,40) y 250 con Mage Hunter (0,50)
 * —368 impactos, cero varianza dentro de cada postura— que es exactamente
 * 500×0,80, 500×0,60 y 500×0,50. Así que esto no es prudencia ante la duda:
 * son dos escuelas medidas por separado con dos resultados distintos.
 *
 * QUÉ COSTABA: reconstruir daño periódico y escudo dividiendo por (1 − mit)
 * inventaba 44.924 puntos sobre 416 peleas guardadas —27.342 de `dot` y 17.582
 * de `ds`— y el consejo de postura los usaba como si fueran daño recibido.
 *
 * SE EXPORTA PORQUE HAY TRES SITIOS QUE NECESITAN LA MISMA LISTA: aquí para no
 * revertir, el almacén para corregir lo ya guardado, y el consejero para no
 * apuntarse como evitable un daño que ninguna postura evita. Tres copias de una
 * lista de dos palabras acaban discrepando en cuanto se añada la tercera.
 */
export const SIN_MITIGACION = new Set(['dot', 'ds']);

/** Fracción de daño que una postura evita para una escuela dada. */
export function mitigationFor(stanceKey, school) {
  if (SIN_MITIGACION.has(school)) return 0;
  const st = STANCES[normStance(stanceKey)];
  if (!st) return 0;
  return school === 'spell' ? (st.mit.spell ?? 0) : (st.mit.melee ?? 0);
}

/**
 * Stances e invocaciones disponibles.
 *
 * DOS FUENTES, Y LA SEGUNDA MANDA MÁS QUE LA PRIMERA.
 *
 * La primera son tus clases, que muchas veces se deducen y se deducen mal. La
 * segunda es lo que se te ha visto usar, y ésa no se deduce: si el registro dice
 * «You assume a channeler stance», tienes Channeler. No hay nada más firme que
 * eso, y sin embargo era justo lo que se estaba tirando.
 *
 * QUÉ PASABA SIN ESTO. Con las clases desconocidas o mal deducidas, la lista de
 * posturas salía vacía o incompleta, el consejo de postura devolvía `null` y NO
 * SE AVISABA DE NADA — sin decir por qué. Caso real: en una sesión con Channeler
 * y Defensive vistas, `inferClasses` no encontraba ninguna clase común, la lista
 * quedaba vacía y el consejo se callaba durante horas de juego. Y con un
 * Berserker de por medio, la deducción se quedaba en BER a secas: entonces la
 * lista traía Balanced y Mage Hunter, y la postura que llevabas puesta ni
 * siquiera estaba en ella, así que tampoco había con qué comparar.
 *
 * Lo visto se añade, no sustituye: las clases siguen aportando las posturas que
 * tienes y aún no has usado, que son las que interesa proponerte.
 *
 * @param {string[]} classes        clases fijadas o deducidas
 * @param {string[]} vistas         posturas que el registro te ha visto asumir
 * @param {string[]} vistasInv      invocaciones vistas, por lo mismo
 */
export function availableFor(classes, vistas = [], vistasInv = []) {
  const cs = (classes ?? []).filter(Boolean);
  const has = (list) => list.some((c) => cs.includes(c));
  const vS = new Set((vistas ?? []).map(normStance).filter(Boolean));
  const vI = new Set((vistasInv ?? []).map(normInvocation).filter(Boolean));
  return {
    stances: Object.entries(STANCES).filter(([k, v]) => has(v.classes) || vS.has(k))
      .map(([k, v]) => ({ key: k, ...v })),
    invocations: Object.entries(INVOCATIONS).filter(([k, v]) => has(v.classes) || vI.has(k))
      .map(([k, v]) => ({ key: k, ...v })),
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
