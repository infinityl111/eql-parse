/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PASAR UN INSTANTE A SEGUNDOS DE PELEA, CON LA INVARIANTE PUESTA.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LA CICATRIZ, y es de las baratas de contar. `src/guion.js` calculaba el
 * segundo de cada caída así:
 *
 *     Math.max(0, Math.round(kt.t - inicio))
 *
 * sobre un `kt.t` que **ya venía relativo**. La resta daba `107 −
 * 1.786.358.914`: un número de once cifras y negativo, o sea un grito. Y el
 * `Math.max(0, …)` lo convertía en **cero**, que es un segundo perfectamente
 * válido. Resultado: todas las figuras se apagaban en el segundo cero de la
 * reproducción, en el 79,9 % de las peleas —4.310 caídas de 4.573— y no falló
 * nada.
 *
 *     UNA PINZA QUE CORRIGE UN IMPOSIBLE LO CONVIERTE EN UN DATO CREÍBLE.
 *
 * ── POR QUÉ LA PINZA SE QUEDA Y AUN ASÍ HAY GUARDA ────────────────────────
 *
 * El `Math.max(0, …)` **es correcto y no se quita**: hay tramos que empiezan
 * antes que la pelea porque la apertura mueve el inicio, y ahí «desde el
 * segundo 0» es la respuesta buena. Un negativo pequeño es un caso del mundo.
 *
 * Lo que no es un caso del mundo es un negativo de once cifras. Así que la
 * pinza sigue pinzando lo esperable y **la guarda para lo imposible**:
 *
 *     donde el valor fuera de rango es ESPERABLE y significa algo -> pinza
 *     donde es IMPOSIBLE -> se lanza
 *
 * ── DÓNDE SE USA ─────────────────────────────────────────────────────────
 *
 * En los trece sitios de `src/encounter.js` que tenían la expresión literal
 * `Math.max(0, Math.round(t - this.start))`. Hoy son correctos —los dos lados
 * son epoch— y por eso son exactamente el sitio donde hay que ponerla: el día
 * que alguien pase un `t` ya relativo no habrá un error, habrá un cero.
 *
 * Una invariante, trece sitios cubiertos.
 */

/**
 * Por encima de esto, un «segundo de pelea» es un epoch disfrazado.
 * 11,5 días. La pelea más larga del histórico son 2.174 segundos.
 */
export const SEG_IMPOSIBLE = 1_000_000;

/**
 * @param {number} t       instante, en segundos epoch
 * @param {number} inicio  inicio de la pelea, en segundos epoch
 * @param {string} donde   para que el error diga quién lo lanzó
 * @returns {number} segundos de pelea, nunca negativos
 */
export function segundosDePelea(t, inicio, donde = '') {
  const d = (t ?? 0) - (inicio ?? 0);
  if (!Number.isFinite(d) || Math.abs(d) > SEG_IMPOSIBLE) {
    throw new RangeError(
      `segundosDePelea${donde ? ` (${donde})` : ''}: ${t} − ${inicio} = ${d}. `
      + 'Una pelea no dura eso: alguien ha mezclado escalas.');
  }
  return Math.max(0, Math.round(d));
}
