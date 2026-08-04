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
  charm: ['charm', 'beguile', 'dominate', 'dominion', 'allure', 'cajol', 'command of'],
  mez: ['mesmeriz', 'mez', 'enthrall', 'entrance', 'lull', 'sleep', 'dazzle', 'blanket of forgetful'],
  fear: ['fear', 'panic', 'terror', 'horrify', 'invoke fear', 'scream of'],
  root: ['root', 'ensnare', 'snare', 'immobiliz', 'paraly', 'engulfing dark',
         'cripple', 'slow', 'tagar', 'clinging darkness', 'bonds of'],
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

/** Nombres de bicho más cortos al hablarlos: "a fire giant warrior" -> "fire giant warrior". */
export function shortName(name) {
  return String(name ?? '').replace(/^(an?|the) /i, '');
}

export const DEFAULT_CAST_CATEGORIES = {
  heal: true, charm: true, mez: true, fear: true, root: true,
  summon: true, escape: true, resurrect: false, dispel: false, nuke: false,
};
