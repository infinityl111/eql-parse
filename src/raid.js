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

/**
 * ¿ES UN NOMBRADO? LA MAYÚSCULA INICIAL, NO EL ARTÍCULO.
 *
 * Aquí se usaba «no lleva artículo», y tumbaba a `The Spiroc Lord`, que es un
 * nombrado con 32.132 de vida —por encima de siete de los que sí entraban—.
 * El artículo no distingue nada: lo que distingue es que el nombre propio va en
 * MAYÚSCULA, y ahí «The» es parte del nombre igual que en «The Plane of Sky».
 *
 * SOBRE EL NOMBRE CANÓNICO, Y ESO HAY QUE MEDIRLO ANTES DE FIARSE. El registro
 * capitaliza a principio de línea, así que conviven «a dracoliche» y
 * «A dracoliche». Medido el 19/08/2026 sobre las líneas de muerte del log:
 *
 *     196 pares que difieren sólo en la inicial
 *     196 son EL MISMO BICHO — la variante en mayúscula NUNCA sale en media
 *         frase, y la de minúscula sí
 *       0 son dos criaturas distintas
 *       0 indecidibles
 *
 * Así que la mayúscula es SIEMPRE del renglón, y sólo es fiable sobre el nombre
 * canónico —el que se ve en mitad de una frase—. La enciclopedia ya guarda ése:
 * sus 461 fichas no tienen ni un par que difiera sólo en la inicial. Si algún
 * día se le pasa a esta función un nombre sacado a pelo del principio de una
 * línea, el criterio mentirá, y por eso queda dicho aquí.
 *
 * Y SE SALTAN LOS SIGNOS DE DELANTE. El registro trae `*Inte Akera`, con un
 * asterisco por delante y 31.089 de vida: un nombrado de manual. Mirando el
 * primer carácter a secas se caía de la lista, y habría sido un jefe perdido
 * por un signo de puntuación.
 */
const esNombrado = (n) => /^[^\p{L}]*\p{Lu}/u.test(String(n ?? ''));

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

  if (esNombrado(nombre) && (vida ?? 0) >= VIDA_JEFE) return { raid: true, src: 'deducido' };
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
  /**
   * LA VIDA QUE ENTRA AQUÍ VA SIN LO QUE LE CURARON, y antes no.
   *
   * `r.taken` es lo que el bicho recibió, y si un sanador se lo repara por el
   * camino eso NO es vida suya: es daño deshecho. La muestra de vida de una
   * pelea ya lo descuenta desde hace versiones —`hpSamples` resta `healTotals`,
   * comprobado sobre el histórico: de 153 enemigos con curación, 151 coinciden
   * con la cifra NETA y ninguno con la bruta— pero esta función no usaba esa
   * cifra sino `taken` a pelo, así que la corrección no llegaba al único sitio
   * donde el número decide algo: quién es un jefe.
   *
   * MEDIDO sobre las 2.664 filas enemigas del almacén: 538 recibieron curación,
   * y en DOS la deducción cambia de lado.
   *
   *     Cleric of Innoruuk   recibió 22.633 · le curaron 2.803 · neto 19.830
   *
   * Con la cifra bruta cruza `VIDA_JEFE` y sale rotulado como jefe de raid; con
   * la suya, no llega. Son dos filas de 2.664 y se arregla igual, porque el
   * error no es de tamaño: es una cifra derivada de una suma que incluye algo
   * que no debería, que es la familia que este proyecto lleva diez fallos
   * persiguiendo.
   *
   * Y NO TOCA A LOS DEMÁS CAMINOS: lo que dice la wiki y lo que has dicho tú
   * mandan por encima de la deducción, así que esto sólo mueve a los enemigos
   * de los que no se sabe nada — que son justo aquellos donde la deducción es
   * lo único que hay.
   */
  const curado = new Map();
  for (const r of rows) {
    for (const h of r.healByTarget ?? []) {
      const n = Array.isArray(h) ? h[0] : h.name;
      const v = Array.isArray(h) ? (h[1]?.sum ?? 0) : (h.sum ?? 0);
      if (n) curado.set(n, (curado.get(n) ?? 0) + v);
    }
  }
  const out = new Set();
  for (const r of rows) {
    if (r.side !== 'enemy') continue;
    const vida = Math.max(0, (r.taken ?? 0) - (curado.get(r.name) ?? 0));
    if (clasificaJefe(r.name, { ...ctx, vida }).raid) out.add(r.name);
  }
  return out;
}
