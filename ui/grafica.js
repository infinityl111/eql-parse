/**
 * La gráfica de una pelea, dibujada una sola vez.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE LA PANTALLA DE COMBATE. La reproducción usa
 * la misma gráfica como línea de tiempo —arrastras hasta el pico y ves lo que
 * pasó allí—, y dos funciones que dibujan la misma gráfica se separan: una gana
 * las marcas de lanzamiento, la otra cambia la escala, y al cabo de un mes la
 * de arriba y la de abajo ya no dicen lo mismo de la misma pelea. Se dibuja una
 * vez y se usa dos.
 *
 * Lo que NO vive aquí es el rótulo del ratón ni el arrastre: eso es lo que cada
 * sitio hace con la gráfica, y es distinto en cada uno. Aquí sólo está lo que
 * se ve.
 *
 * LA ESCALA ES COMÚN A LAS DOS LÍNEAS. Antes la punteada se dibujaba contra su
 * propio máximo y a media altura, así que sus subidas no se podían comparar con
 * las tuyas: parecía que recibías tanto como pegabas cuando no. Cabe de sobra —
 * medido sobre 393 peleas, el pico de lo recibido es la cuarta parte del de lo
 * hecho en la mediana, y en ninguna lo supera.
 */

import { posEnTiempo } from './tiempo.js';

/**
 * EL PRÓXIMO QUE CAMBIE ESTE DIBUJO PAGA SU PRUEBA DE DIBUJO.
 *
 * No es una tarea suelta que nadie hará: es el peaje de tocar esto, y se cobra
 * cuando hay una razón para tocarlo.
 *
 * POR QUÉ. En una semana, seis fallos pasaron con la batería en verde, y la
 * línea que ninguno cruzaba era la misma: EL CÁLCULO ESTABA PROBADO Y EL DIBUJO
 * NO. El último fue un `import` que faltaba —un `ReferenceError` en tiempo de
 * ejecución, no un error de sintaxis— que dejaba una pista entera vacía; se vio
 * abriendo la aplicación y contando cero marcas. Las guardas que hay
 * —«todo ui/*.js compila» y «nadie hace nada al importarse»— son de CARGA, no
 * de función: compilar no es funcionar.
 *
 * CÓMO SE PAGA, que es barato porque esto devuelve cadenas: se construye una
 * pelea de fixture, se llama a `grafica()`, y se cuenta lo que sale —puntos,
 * hitos, franjas—. Si sale cero, cae. Ver `test/loot.js`, donde la pista de
 * estados ya lo hace, y `test/tiempo.js`, que compara esta gráfica contra la
 * función de posición compartida.
 *
 * Y LA GUARDA NUEVA SE ESTRENA ROMPIÉNDOLA contra el fallo que la motivó, con
 * el error que sale escrito en el informe. Una prueba que nunca se ha visto
 * fallar no protege de nada.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const W = 600, H = 96, BAND = 11;

/** Cada postura con su color, para la franja de arriba. */
export const STANCE_COLOR = {
  defensive: 'var(--t-cold)', 'mage hunter': 'var(--t-magic)', channeler: 'var(--t-spell)',
  offensive: 'var(--t-fire)', balanced: 'var(--t-melee)', evasive: 'var(--t-poison)',
  striker: 'var(--t-ds)', ranged: 'var(--t-disease)', berserker: 'var(--t-dot)',
};

const normStance = (s) => String(s ?? '').toLowerCase().replace(/\s*stance\s*$/, '');

/**
 * @param {object} f  la pelea
 * @param {object} opciones
 *   marcas: `true` para pintar también los lanzamientos. La pantalla de combate
 *           no los quiere —ya tienen su propio documento— y la reproducción sí,
 *           porque allí la gráfica es el mapa por el que se navega.
 * @returns {{svg, band, pts, peak, dur, legend}|null}
 */
export function grafica(f, { marcas = false } = {}) {
  const dur = Math.max(1, f?.duration ?? 0);
  if (dur < 4 || !f?.series?.length) return null;

  const byS = new Map(f.series.map((p) => [p.s, p]));
  const pts = [];
  for (let i = 0; i <= dur; i++) pts.push(byS.get(i) ?? { s: i, dmg: 0, taken: 0, heal: 0 });
  const peak = Math.max(1, ...pts.map((p) => p.dmg));
  // La posición en el tiempo sale de `posEnTiempo`, compartida con los hitos y
  // con la pista de estados: aquí sólo se multiplica por el ancho del viewBox.
  const x = (i) => posEnTiempo(i, dur) * W;
  const y = (v) => H - (v / peak) * (H - 6);

  const area = `M0,${H} ` + pts.map((p, i) => `L${x(i).toFixed(1)},${y(p.dmg).toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.dmg).toFixed(1)}`).join(' ');
  const taken = pts.some((p) => p.taken)
    ? pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.taken).toFixed(1)}`).join(' ')
    : null;

  const band = (f.stanceSpans ?? []).map((sp) => {
    const x0 = x(sp.from), x1 = x(Math.max(sp.to, sp.from + 1));
    return `<rect x="${x0.toFixed(1)}" y="0" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${BAND}"
      fill="${STANCE_COLOR[normStance(sp.stance)] ?? 'var(--t-other)'}" opacity=".85"><title>${esc(sp.stance)}</title></rect>`;
  }).join('');

  const legend = [...new Set((f.stanceSpans ?? []).map((sp) => normStance(sp.stance)))].map((k) =>
    `<span><i style="background:${STANCE_COLOR[k] ?? 'var(--t-other)'}"></i>${esc(k)}</span>`).join('');

  return {
    dur, pts, peak, legend, band, taken,
    /**
     * LAS DOS SERIES VAN CON LA PALETA DE SERIES, no con la de tipos de daño.
     *
     * Estaban pintadas con `--t-cold` y `--t-ds`, que son el frío y el escudo
     * de daño: colores del vocabulario del juego usados aquí por cómo se ven.
     * Leído al pie de la letra, esta gráfica decía que tu daño es de frío.
     *
     * EN UNA MISMA VISTA, SÓLO UNA PREGUNTA PUEDE USAR EL COLOR; las demás usan
     * tinta, grosor, forma o rótulo. Aquí la pregunta del color es QUIÉN. El
     * tipo de daño y la postura tienen sus propios sitios y no entran por aquí:
     * tres categorías compartiendo paleta no se leen, se adivinan.
     *
     * `--s1` y `--s2` son dos de los seis colores calculados del prototipo, y
     * son los mismos que usará el dps por combatiente cuando llegue: una línea
     * tuya será del mismo color en las dos gráficas, que es justo lo que hace
     * que dos gráficas se puedan leer juntas.
     *
     * `--s3` —el resto del grupo— todavía no tiene línea que pintar aquí.
     */
    svg: `<path d="${area}" fill="var(--s1)" opacity=".16"/>
      <path d="${line}" fill="none" stroke="var(--s1)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      ${taken ? `<path d="${taken}" fill="none" stroke="var(--s2)" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}`,
    /**
     * Las marcas con instante propio. Sólo entran las que lo tienen medido:
     * muertes y lanzamientos. Nada colocado por proporción — una marca en el
     * sitio equivocado es peor que ninguna marca, porque se arrastra hasta ella.
     */
    hitos: [
      ...(f.killTimes ?? []).map((k) => ({
        clase: 'muerte', s: Math.min(dur, Math.max(0, k.t)), texto: k.name,
      })),
      ...(marcas ? (f.casts ?? []).filter((c) => c.ability).map((c) => ({
        clase: `lanza${c.cat ? ` cat-${c.cat}` : ''}`, s: Math.min(dur, Math.max(0, c.t)),
        texto: `${c.source} · ${c.ability}`,
      })) : []),
    ],
  };
}
