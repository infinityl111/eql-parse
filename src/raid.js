/**
 * ¿Es este enemigo un jefe? Tres fuentes, y su orden importa.
 *
 *   manual    lo que TÚ has dicho en su ficha. Manda sobre todo.
 *   wiki      la categoría «Raid_Encounters» de su página. Lo declarado.
 *   deducido  una regla sobre lo medido, mientras la wiki no ha contestado.
 *
 * Están separadas a propósito y la respuesta dice de cuál viene, igual que con
 * las clases y con los compañeros: lo que has dicho tú, lo que consta y lo que
 * se ha supuesto no pueden verse iguales. Una etiqueta sin procedencia acaba
 * leyéndose como un hecho.
 *
 * POR QUÉ NO VALE «Named_Mobs»
 *
 * Era la categoría que sonaba bien. Medido sobre los 119 enemigos de un
 * registro real, la llevan 96 —el 81%—, entre ellos `a desert tarantula` con
 * 175 de vida. En esa wiki significa «tiene página». La que discrimina es
 * «Raid_Encounters»: 14 enemigos, vida mediana 32.005 contra 7.769.
 *
 * LO QUE LA DEDUCCIÓN ACIERTA Y LO QUE NO
 *
 * Sin artículo y con mucha vida atrapa a diez de los catorce jefes de ese
 * registro. Se le escapa `the Spiroc Lord` —lleva artículo y es un jefe— y
 * marca de más a `Lord of Ire` y `Warlord Skarlon`, que la wiki no considera
 * raid. Por eso es un apaño hasta que conteste la wiki y va rotulado como tal.
 */

/** Vida a partir de la cual un enemigo sin artículo se supone jefe. */
const VIDA_JEFE = 20000;

const esPet = (n) => / pet$/i.test(String(n ?? ''));
const conArticulo = (n) => /^(an?|the) /i.test(String(n ?? ''));

/**
 * @param {string} nombre
 * @param {object} ctx
 *   - manual  Map nombre -> true|false, lo que dijiste tú
 *   - wiki    Map nombre -> {raid}, lo que contestó la wiki
 *   - vida    vida estimada, para la deducción
 * @returns {{raid: boolean, src: 'manual'|'wiki'|'deducido'|'ninguna'}}
 */
export function clasificaJefe(nombre, { manual = null, wiki = null, vida = null } = {}) {
  if (esPet(nombre)) return { raid: false, src: 'ninguna' };

  const m = manual?.get?.(nombre);
  if (m !== undefined && m !== null) return { raid: !!m, src: 'manual' };

  const w = wiki?.get?.(nombre);
  // Sólo cuenta si la wiki ha contestado de verdad. Que aún no lo haya hecho no
  // es un «no»: es que no se sabe, y entonces se deduce.
  if (w && w.found) return { raid: !!w.raid, src: 'wiki' };

  if (!conArticulo(nombre) && (vida ?? 0) >= VIDA_JEFE) return { raid: true, src: 'deducido' };
  return { raid: false, src: 'deducido' };
}

/**
 * El conjunto de jefes de una pelea, listo para `fightToChat`.
 *
 * Devuelve sólo los que salen `raid`, que es lo que el texto del chat necesita:
 * a quién nombrar y a quién contar. La procedencia no viaja aquí porque en una
 * línea de chat no cabe y tampoco ayuda a quien la lee — vive en la ficha.
 */
export function jefesDe(rows = [], ctx = {}) {
  const out = new Set();
  for (const r of rows) {
    if (r.side !== 'enemy') continue;
    if (clasificaJefe(r.name, { ...ctx, vida: r.taken ?? 0 }).raid) out.add(r.name);
  }
  return out;
}
