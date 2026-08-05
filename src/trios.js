/**
 * La tabla de tríos que declaras a mano.
 *
 * En EQL cambias de trío de clases y el log no lo dice en ninguna parte. Hay
 * tres fuentes de verdad, y esta es la de arriba:
 *
 *   1. Esta tabla     — la escribes tú, y tú estabas allí.
 *   2. El /who         — dice trío y nivel, pero sólo del instante en que lo
 *                        escribes, y sólo si te acuerdas de escribirlo.
 *   3. La inferencia   — un hechizo exclusivo prueba una CLASE. Nunca el nivel.
 *
 * Lo manual manda sobre las otras dos: si dices que a las 14:00 ibas a nivel
 * 50, eso vale aunque un /who de las 14:43 diga otra cosa, porque ese /who
 * describe un momento posterior. Lo que no puede es mandar hacia el futuro:
 * dentro de un tramo, una subida de nivel sí cuenta, porque es un suceso y no
 * una descripción.
 *
 * Una regla importante y contraintuitiva: **cambiar de trío borra el nivel
 * heredado**. En EQL el nivel efectivo es el de tu clase más baja, así que
 * meter una clase nueva puede tirarlo por los suelos. Si un tramo no declara
 * nivel, las peleas anteriores al primer hito DE ESE TRAMO se quedan sin
 * nivel, en vez de arrastrar el del tramo anterior, que sería mentira.
 */

/** Códigos válidos, para no guardar basura desde la interfaz. */
export const CLASES = [
  'BER', 'BRD', 'BST', 'CLR', 'DRU', 'ENC', 'MAG', 'MNK',
  'NEC', 'PAL', 'RNG', 'ROG', 'SHD', 'SHM', 'WAR', 'WIZ',
];

/**
 * Deja la tabla en un estado utilizable: descarta lo que no vale, ordena por
 * fecha y quita duplicados en el mismo instante (gana el último escrito).
 *
 * @param {Array} lista renglones tal cual vienen de la configuración
 * @returns {Array<{at:number|null, classes:string[], level:number|null}>}
 */
export function normalizeTrios(lista) {
  const out = [];
  for (const r of Array.isArray(lista) ? lista : []) {
    const classes = (r?.classes ?? []).filter((c) => CLASES.includes(c));
    if (classes.length !== 3) continue;
    const at = r.at == null ? null : Number(r.at);
    if (at != null && !Number.isFinite(at)) continue;
    const level = r.level == null ? null : Number(r.level);
    out.push({
      at,
      classes,
      level: Number.isFinite(level) && level > 0 ? level : null,
      note: typeof r.note === 'string' ? r.note.slice(0, 120) : '',
    });
  }
  // null es «desde siempre»: va el primero.
  out.sort((a, b) => (a.at ?? -Infinity) - (b.at ?? -Infinity));
  const limpio = [];
  for (const r of out) {
    const prev = limpio.at(-1);
    if (prev && prev.at === r.at) limpio[limpio.length - 1] = r;
    else limpio.push(r);
  }
  return limpio;
}

/**
 * El renglón que estaba en vigor en un instante dado.
 *
 * @param {Array} tabla ya normalizada
 * @param {number} ms epoch en milisegundos
 */
export function trioAt(tabla, ms) {
  let cur = null;
  for (const r of tabla) {
    if (r.at == null || r.at <= ms) cur = r;
    else break;
  }
  return cur;
}

/**
 * ¿Contradice esta tabla lo que dice el log?
 *
 * No se corrige nada: se enseña. La tabla manda, pero si dices que ibas con
 * el druida a una hora en la que el /who dice chamán, uno de los dos está mal
 * y sólo tú sabes cuál.
 *
 * @param {Array} tabla normalizada
 * @param {Array<{at:number, level:number|null, classes:string[]}>} hitos del log
 */
export function conflicts(tabla, hitos) {
  const out = [];
  for (const h of hitos) {
    if (!h.classes?.length) continue;
    const r = trioAt(tabla, h.at);
    if (!r) continue;
    if (r.classes.join('/') !== h.classes.join('/')) {
      out.push({ at: h.at, dice: h.classes, declaras: r.classes, desde: r.at });
    }
  }
  return out;
}
