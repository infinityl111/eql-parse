/**
 * Nombre de zona -> base, modo y dificultad.
 *
 * EQL instancia cada zona con una dificultad de 0 a 4, y los enemigos cambian
 * de verdad: medido en un log real, Magus Rokyl tiene un 59% más de vida en D3
 * que en D2, pega 3,6 veces más fuerte y lanza dos hechizos que en D2 no tiene.
 * Promediar las dos describe un enemigo que no existe.
 *
 * La dificultad sólo aparece en UNA línea del log, la de entrada:
 *
 *     Player Campeon creating instance Nagafen's Lair 15001.   ← id, no dificultad
 *     Nagafen's Lair - Solo is now available to you.           ← modo, sin dificultad
 *     You have entered Nagafen's Lair - Solo 2 (Adaptive).     ← aquí, y sólo aquí
 *
 * LA TRAMPA: en «The Ruins of Old Guk 2 (Adaptive)» el 2 es parte del NOMBRE de
 * la zona —el /who la llama gukbottom— y no una dificultad. Por eso el número
 * sólo cuenta cuando va detrás del modo: «- Solo 3». La etiqueta entre
 * paréntesis es la que manda, y el número suelto no se toca.
 */

/** Nombres oficiales de los niveles (wiki de EQL). */
export const DIFICULTADES = {
  0: null, 1: 'Awakened', 2: 'Adaptive', 3: 'Fused', 4: 'Refined',
};
const POR_ETIQUETA = { Awakened: 1, Adaptive: 2, Fused: 3, Refined: 4 };
const MODOS = ['Solo', 'Group', 'Raid', 'Multiplayer'];

/**
 * @param {string} zona  tal cual la escribe el log
 * @returns {{name, base, mode, diff, tag}}
 *   name  el nombre completo, como se guardaba antes
 *   base  la zona sin modo ni dificultad
 *   mode  'Solo' | 'Group' | … | null
 *   diff  0-4. Sólo es null cuando no se sabe ni la zona: que el registro no
 *         diga dificultad no es no saberla, es que vale 0.
 *   tag   'Adaptive' | 'Fused' | … | null
 */
export function parseZone(zona) {
  const name = zona ?? null;
  if (!name) return { name: null, base: null, mode: null, diff: null, tag: null };

  let resto = name;
  let tag = null;
  // La etiqueta va al final y entre paréntesis. Sólo se acepta si es una de las
  // conocidas: hay zonas cuyo nombre lleva paréntesis por otros motivos.
  const par = /\s*\(([^)]+)\)\s*$/.exec(resto);
  if (par && POR_ETIQUETA[par[1]] !== undefined) {
    tag = par[1];
    resto = resto.slice(0, par.index).trim();
  }

  const m = new RegExp(`^(.*?)\\s+-\\s+(${MODOS.join('|')})(?:\\s+([0-4]))?$`).exec(resto);
  if (m) {
    const porNumero = m[3] !== undefined ? +m[3] : null;
    const porEtiqueta = tag ? POR_ETIQUETA[tag] : null;
    // ── «Nagafen's Lair - Group.» es D0, no «no consta» ──────────────────
    //
    // Un modo declarado sin número ni etiqueta es la dificultad base, y la
    // base no lleva etiqueta —por eso `DIFICULTADES[0]` es `null`—. Antes las
    // dos cosas caían en el mismo saco y la columna D0 de la rejilla contenía
    // East Freeport, que es una etiqueta que miente.
    //
    // No es una deducción por el formato: está medido. Mismo enemigo, misma
    // zona y mismo modo, la vida de estas instancias está un peldaño ENTERO
    // por debajo de D1 —mediana 0,873— y ese peldaño es del mismo tamaño que
    // el de D1 a D2 (0,853) y el de D2 a D3 (0,884). Once enemigos, nueve de
    // ellos entre 0,86 y 0,88. No cae en medio de nada: es el escalón de abajo.
    return { name, base: m[1], mode: m[2], diff: porNumero ?? porEtiqueta ?? 0, tag };
  }
  // ── Sin modo y sin etiqueta: D0, no «no consta» ──────────────────────────
  //
  // Esto decía antes que un nombre limpio es mundo abierto y que ahí no hay
  // dificultad que medir. Es falso, y lo corrige quien estuvo allí: en EQL, que
  // el registro no diga nada de dificultad SIGNIFICA dificultad 0. Da igual que
  // sea mundo abierto o una instancia; el cero es el mismo.
  //
  // La prueba de que ese silencio no es ignorancia está en el propio registro:
  //
  //     Player Campeon creating instance The Plane of Sky 25.
  //     The Plane of Sky is now available to you.
  //     You have entered The Plane of Sky.
  //
  // Tres líneas seguidas para una instancia recién creada, y ninguna trae
  // dificultad. Tratar eso como «no se sabe» dejaba sin asignar 84 de 410
  // peleas guardadas —un 20,5%—, y 70 de ellas eran esta misma zona.
  //
  // La etiqueta sigue mandando cuando la hay: «The Plane of Hate 3 (Fused)»
  // existe, no dice el modo y es D3.
  //
  // Lo que NO se toca es no saber dónde estabas: eso vive en `SIN_ZONA` y
  // llega aquí como `name` nulo, que sale arriba con `diff: null`.
  return { name, base: resto, mode: null, diff: tag ? POR_ETIQUETA[tag] : 0, tag };
}

/** Etiqueta corta para enseñar: «D3 Fused», «D2», o nada. */
export function labelDiff(diff, tag) {
  if (diff === null || diff === undefined) return null;
  return tag ? `D${diff} ${tag}` : `D${diff}`;
}

/** Las cinco columnas, en orden. El cajón de «no consta» NO es una de ellas. */
export const DIFFS = [0, 1, 2, 3, 4];

/**
 * Clave del cajón de una dificultad.
 *
 * Vive aquí y no repetida en cada fichero a propósito: era `nivel = (d) => d ?? 0`
 * lo que convertía «no consta» en D0, y estaba escrito en cinco sitios. Con una
 * sola definición, cambiarla es cambiarla en todos.
 */
export const SIN_MARCA = 'sin marca';
export const diffKey = (d) => (d === null || d === undefined ? SIN_MARCA : `D${d}`);

/**
 * Y un tercer cajón: no es lo mismo «mundo abierto, donde no hay dificultad
 * que declarar» que «no sé dónde estabas».
 *
 * Lo segundo pasa con las peleas anteriores a la primera línea de zona del
 * registro — seis en un log de 278.000 líneas, que no es nada hasta el día que
 * son sesenta. Meterlas en «sin marca» diría que sabemos que era mundo abierto,
 * y no lo sabemos.
 */
export const SIN_ZONA = 'sin zona';

/** Clave de agrupación de un enemigo: mismo enemigo, misma dificultad. */
export function foeKey(name, diff) {
  return diff === null || diff === undefined ? name : `${name}\u0000D${diff}`;
}
