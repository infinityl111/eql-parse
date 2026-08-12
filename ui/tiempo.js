/**
 * DÓNDE CAE UN INSTANTE EN LA LÍNEA DE TIEMPO. Un sitio, tres consumidores.
 *
 * POR QUÉ EXISTE. Colocar en el tiempo estaba escrito tres veces, cada una en
 * su unidad:
 *
 *   la gráfica    `(i / dur) * W`            píxeles de un viewBox de 600
 *   los hitos     `(h.s / g.duracion) * 100` por ciento de CSS
 *   el cursor     lo mismo, otra vez
 *
 * Y COINCIDÍAN POR CASUALIDAD, NO POR CONSTRUCCIÓN: las tres son lineales en
 * `s/duracion`, así que dan lo mismo mientras nadie toque ninguna. Encima
 * usaban denominadores distintos —`grafica` divide por `f.duration` en crudo y
 * el guion por `Math.round(f.duration)`—, que hoy da igual porque las 700
 * duraciones del histórico son enteras, y dejaría de darlo el día que una no lo
 * fuera. Eso no es acuerdo: es que aún no se han separado.
 *
 * DEVUELVE UNA FRACCIÓN, DE 0 A 1, Y NO PÍXELES. Es lo único que sirve a los
 * tres: la gráfica la multiplica por 600, los hitos por 100, y la pista de
 * estados por el ancho REAL medido —que va de 838 px en la ventana por defecto
 * a 2.003 maximizada—. Una función que devolviera píxeles no le valdría a la
 * gráfica, y una que devolviera por ciento obligaría a la pista a deshacer la
 * multiplicación.
 *
 * SE RECORTA A [0, 1] A PROPÓSITO. Lo que cae más allá del final se dibuja en
 * el final: no hay sitio donde ponerlo y sacarlo del marco sería peor. Ojo, que
 * eso ESCONDE una diferencia real —hay botín recogido después del último
 * suceso, y por eso su ficha enseña la hora de verdad al lado en vez de fiarlo
 * a la posición—.
 */

/**
 * @param {number} s         segundo dentro de la pelea
 * @param {number} duracion  duración de la pelea, en segundos
 * @returns {number} 0..1
 */
export function posEnTiempo(s, duracion) {
  const d = Math.max(1, Math.round(duracion ?? 0));
  const x = (Number(s) || 0) / d;
  return x < 0 ? 0 : (x > 1 ? 1 : x);
}

/**
 * EL ANCHO DE UN CUBO DE COLAPSO, EN FRACCIÓN. Se deriva de lo mismo, y ésa es
 * la razón de que viva aquí y no en la pista.
 *
 * EL COLAPSO NO SE PUEDE DEFINIR EN SEGUNDOS, aunque sea lo primero que se le
 * ocurre a cualquiera. Medido sobre las 700 peleas y el ancho real:
 *
 *   pelea mediana, 84 s      0,10 s por píxel   el segundo sobra como unidad
 *   p99, 563 s               0,67 s por píxel
 *   la más larga, 1.434 s    1,71 s por píxel   dos segundos comparten píxel
 *
 * O sea que «fundir lo del mismo segundo» no hace nada en la pelea larga —donde
 * hace falta— y funde de más en la corta. La unidad tiene que ser la resolución
 * a la que se dibuja de verdad.
 *
 * Y 4 PÍXELES Y NO 1: una marca de un píxel no se ve. Ojo, que 4 px es la
 * unidad de DIBUJO y no la de PINCHAR — el objetivo del ratón se busca por
 * cercanía, porque una marca visible que no se deja abrir es peor que no
 * dibujarla.
 *
 * Al derivarse del ancho medido, cualquier redibujado —cambiar el tamaño de la
 * ventana, y lo que venga después— recalcula los cubos solo, sin que nadie
 * tenga que acordarse.
 *
 * @param {number} anchoPx  ancho REAL medido, no el del viewBox
 * @param {number} pxCubo   píxeles por cubo
 */
export function anchoCubo(anchoPx, pxCubo = 4) {
  return pxCubo / Math.max(1, Number(anchoPx) || 1);
}

/** En qué cubo cae un instante. Misma función de posición, sin excepciones. */
export function cuboDe(s, duracion, anchoPx, pxCubo = 4) {
  return Math.floor(posEnTiempo(s, duracion) / anchoCubo(anchoPx, pxCubo));
}
