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
  const x = (i) => (i / dur) * W;
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
    svg: `<path d="${area}" fill="var(--t-cold)" opacity=".16"/>
      <path d="${line}" fill="none" stroke="var(--t-cold)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      ${taken ? `<path d="${taken}" fill="none" stroke="var(--t-ds)" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}`,
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
