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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PALABRAS CLAVE POR CATEGORÍA — CUÁLES ESTÁN PROBADAS Y CUÁLES SON DE MEMORIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Se comparan en minúsculas y sin acentos.
 *
 * MEDIDO sobre el registro de referencia (862.705 líneas, 643 nombres distintos
 * de hechizo vistos lanzar). El número al lado de cada clave son los
 * lanzamientos que atrapa; `·0` es que NO HA CASADO NUNCA:
 *
 *     de 62 palabras clave, 34 han casado alguna vez y 28 NO. El 45%.
 *
 * QUÉ SIGNIFICA UN CERO AQUÍ, Y QUÉ NO. En la pista de estado, «cero veces en
 * su registro» cierra el caso: su log ES la población, porque lo que se mide es
 * lo que le pasó a él. Aquí no: este clasificador viaja a los demás usuarios, y
 * un cero sólo dice que ÉL no ha visto ese hechizo — no que no exista. Un
 * paladín con `cure wounds` o un mago con `evacuat` los verán el primer día.
 *
 * POR ESO NO SE PODAN. Lo que sí se puede afirmar es de dónde salió cada una, y
 * eso es lo que faltaba: las que traen número están comprobadas contra un
 * registro real; las de `·0` se pusieron DE MEMORIA y siguen sin comprobar por
 * nadie. Son dos clases de cosa y hasta ahora se veían igual.
 *
 * LO QUE ESTE CERO SÍ PROHÍBE: presumir. `charm` tiene ocho claves y funciona
 * por dos —y la que la sostiene, `bewitch`, es justamente la única con una
 * medición escrita al lado—. `resurrect` entera se sostiene con UNA
 * coincidencia. Decir «clasificamos los encantos» es más de lo que se sabe.
 *
 * Y LA OTRA MITAD, QUE ES LA QUE IMPORTA MÁS: las claves muertas son ruido, y
 * los lanzamientos que ninguna clave atrapa son un aviso que no suena. Medido:
 * de los 30.152 lanzamientos del registro, 26.321 —el 87%— no caen en ninguna
 * categoría. La mayoría es correcto (ataques de mascota, escudos, buffs: no hay
 * nada que avisar), pero en ese residuo hay cosas que sí deberían sonar y hoy
 * no suenan. Están enumeradas por frecuencia en el informe del residuo, sin
 * tocar todavía: las claves que falten saldrán de esa medición y no de la
 * memoria de nadie.
 */
const KEYS = {
  // medido: heal=1617 healing=1566 remedy·0 renewal·0 mend·0 salve=53 cure wounds·0 celestial=49 restor=1 regenerat=26 rejuven·0
  heal: ['heal', 'healing', 'remedy', 'renewal', 'mend', 'salve', 'cure wounds',
         'celestial', 'restor', 'regenerat', 'rejuven'],
  // `bewitch` entra por lo medido: `Solon's Bewitching Bravura` sale 53 veces en
  // el registro de referencia, la canta el jefe del Plano del Miedo, y es la
  // única señal escrita que hay cerca de los tramos en que un compañero se puso
  // a pegarle al grupo. Sin ella el encanto cantado no era ninguna categoría.
  // Las demás canciones de bardo se quedan sin clasificar a propósito: sabría
  // ponerles nombre de memoria y en el registro no hay con qué comprobarlo.
  // medido: charm·0 beguile·0 bewitch=53 dominate·0 dominion·0 allure=5 cajol·0 command of·0
  charm: ['charm', 'beguile', 'bewitch', 'dominate', 'dominion', 'allure', 'cajol', 'command of'],
  // medido: mesmeriz=10 mez·0 enthrall=19 entrance·0 lull·0 sleep=10 dazzle·0 blanket of forgetful·0
  mez: ['mesmeriz', 'mez', 'enthrall', 'entrance', 'lull', 'sleep', 'dazzle', 'blanket of forgetful'],
  // medido: fear=28 panic=5 terror=34 horrify·0 invoke fear=3 scream of=2
  fear: ['fear', 'panic', 'terror', 'horrify', 'invoke fear', 'scream of'],
  // medido: root=419 ensnare=69 snare=69 immobiliz=838 paraly=99 engulfing dark=72 cripple·0 slow=1 tagar=6 clinging darkness=49 bonds of=58
  root: ['root', 'ensnare', 'snare', 'immobiliz', 'paraly', 'engulfing dark',
         'cripple', 'slow', 'tagar', 'clinging darkness', 'bonds of'],
  // Nota: `root` agrupa a propósito raíces y ralentizaciones, porque para
  // avisarte por voz son la misma urgencia. Para el análisis NO son lo mismo:
  // ver `controlKind`.
  // medido: summon=34 call of=23 gather=1 reinforce·0
  summon: ['summon', 'call of', 'gather', 'reinforce'],
  // medido: gate=90 evacuat·0 succor·0 translocate·0 teleport·0
  escape: ['gate', 'evacuat', 'succor', 'translocate', 'teleport'],
  // medido: resurrect·0 revive=1 reviviscence·0 convergence·0
  resurrect: ['resurrect', 'revive', 'reviviscence', 'convergence'],
  // medido: dispel=92 nullify=3 cancel magic·0 strip=3 annul·0
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
