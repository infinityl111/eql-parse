import { t } from './i18n.js';

/**
 * Clasificación de hechizos por categoría.
 *
 * Avisar de cada casteo es inservible: en una pelea con adds salen decenas por
 * minuto. Lo que importa es un puñado de categorías que cambian el combate, y
 * sólo cuando las lanza un enemigo.
 *
 * Se clasifica por palabras clave del nombre, no por una lista cerrada: EQL
 * añade hechizos y no hay base de datos pública. Falla en algún nombre
 * exótico, pero acierta en lo que importa y se puede ampliar desde la interfaz.
 */

export const CAT_KEYS = ['heal','charm','mez','fear','root','summon','escape','resurrect','dispel','nuke'];
export const CATEGORIES = Object.fromEntries(CAT_KEYS.map((k) => [k, {
  label: () => t(`cat.${k}`),
  say: (who, spell) => t(`cast.${k}`, { who, spell }),
}]));

/** Palabras clave por categoría. Se comparan en minúsculas, sin acentos. */
const KEYS = {
  heal: ['heal', 'healing', 'remedy', 'renewal', 'mend', 'salve', 'cure wounds',
         'celestial', 'restor', 'regenerat', 'rejuven'],
  // `bewitch` entra por lo medido: `Solon's Bewitching Bravura` sale 53 veces en
  // el registro de referencia, la canta el jefe del Plano del Miedo, y es la
  // única señal escrita que hay cerca de los tramos en que un compañero se puso
  // a pegarle al grupo. Sin ella el encanto cantado no era ninguna categoría.
  // Las demás canciones de bardo se quedan sin clasificar a propósito: sabría
  // ponerles nombre de memoria y en el registro no hay con qué comprobarlo.
  charm: ['charm', 'beguile', 'bewitch', 'dominate', 'dominion', 'allure', 'cajol', 'command of'],
  mez: ['mesmeriz', 'mez', 'enthrall', 'entrance', 'lull', 'sleep', 'dazzle', 'blanket of forgetful'],
  fear: ['fear', 'panic', 'terror', 'horrify', 'invoke fear', 'scream of'],
  root: ['root', 'ensnare', 'snare', 'immobiliz', 'paraly', 'engulfing dark',
         'cripple', 'slow', 'tagar', 'clinging darkness', 'bonds of'],
  // Nota: `root` agrupa a propósito raíces y ralentizaciones, porque para
  // avisarte por voz son la misma urgencia. Para el análisis NO son lo mismo:
  // ver `controlKind`.
  summon: ['summon', 'call of', 'gather', 'reinforce'],
  escape: ['gate', 'evacuat', 'succor', 'translocate', 'teleport'],
  resurrect: ['resurrect', 'revive', 'reviviscence', 'convergence'],
  dispel: ['dispel', 'nullify', 'cancel magic', 'strip', 'annul'],
};

const norm = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * @param {string} name  nombre del hechizo tal cual aparece en el log
 * @param {object} opts  { nukeNames: [] } nombres extra que quieres tratar como daño fuerte
 * @returns {string|null} categoría, o null si no es relevante
 */
export function classifySpell(name, opts = {}) {
  const n = norm(name);
  if (!n) return null;
  for (const [cat, keys] of Object.entries(KEYS)) {
    if (keys.some((k) => n.includes(k))) return cat;
  }
  const extra = (opts.nukeNames ?? []).map(norm).filter(Boolean);
  if (extra.some((k) => n.includes(k))) return 'nuke';
  return null;
}

/**
 * ¿Este hechizo te quita segundos de pelea, o sólo te empeora?
 *
 * El análisis afirma que cada efecto de control «son segundos sin pegar», y de
 * un slow eso es falso: sigues pegando, más despacio. Contarlos juntos inflaba
 * el hallazgo con una afirmación que no se sostiene.
 *
 *   'duro'   no puedes actuar o no puedes moverte: raíz, mez, miedo, encantar
 *   'blando' sigues peleando peor: ralentizar, debilitar
 */
const BLANDOS = ['slow', 'cripple', 'tagar'];

export function controlKind(nameOrCat, ability) {
  const cat = nameOrCat;
  if (cat === 'charm' || cat === 'fear' || cat === 'mez') return 'duro';
  if (cat !== 'root') return null;
  const n = norm(ability ?? '');
  return BLANDOS.some((k) => n.includes(k)) ? 'blando' : 'duro';
}

/**
 * Nombre sin el rango.
 *
 * EQL numera los rangos con romanos —«Harm Touch V», «Harm Touch X»— pero el
 * aviso de reutilización nombra la habilidad a secas: «You can use the ability
 * Harm Touch again in…». Sin quitar el numeral, el cooldown medido y los usos
 * medidos no se pueden cruzar y el aprovechamiento sale a cero.
 *
 * El numeral sólo se quita si va al final y es un romano de verdad: hay
 * hechizos que acaban en número («Torn Page of Magi`kot pg. 3») y no son rangos.
 */
const ROMANO = /\s+(X{0,3}(?:IX|IV|V?I{0,3}))$/;
export function baseSpell(name) {
  const s = String(name ?? '').trim();
  const m = ROMANO.exec(s);
  return m && m[1] ? s.slice(0, m.index) : s;
}

/** Nombres de enemigo más cortos al hablarlos: "a fire giant warrior" -> "fire giant warrior". */
export function shortName(name) {
  return String(name ?? '').replace(/^(an?|the) /i, '');
}

export const DEFAULT_CAST_CATEGORIES = {
  heal: true, charm: true, mez: true, fear: true, root: true,
  summon: true, escape: true, resurrect: false, dispel: false, nuke: false,
};
