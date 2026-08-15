/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL VOCABULARIO DEL JUEGO NO SE TRADUCE. Todo lo demás, sí.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LA POLÍTICA, en una línea: los términos que EverQuest escribe en su registro
 * se quedan en inglés en los cinco idiomas; el resto de la interfaz se traduce
 * entera. Un jugador reconoce «feared» y no «atemorizado», porque «feared» es lo
 * que ha leído mil veces en su propio log.
 *
 * ── POR QUÉ ESTO ES UN FICHERO Y NO UNA DECISIÓN SUELTA ───────────────────
 *
 * Porque YA SE HABÍA APLICADO SIN QUE NADIE LO SUPIERA. `rp.estado.proc` decía
 * «proc» en los cinco diccionarios desde hace versiones — alguien tomó esta
 * decisión, la aplicó a un rótulo y no la escribió en ninguna parte. Los otros
 * veintidós rótulos del mismo vocabulario siguieron traduciéndose. Una política
 * que vive en la cabeza de quien la aplicó se aplica una vez.
 *
 * ── Y POR QUÉ UNA SOLA FUENTE ─────────────────────────────────────────────
 *
 * Si «feared» se escribe cinco veces —una por diccionario— dentro de tres meses
 * alguien traduce la francesa porque le chirría, y nadie se entera: los cinco
 * ficheros son correctos por separado y el conjunto ha dejado de serlo. Es la
 * misma forma que `posEnTiempo`.
 *
 * Los cinco diccionarios REFERENCIAN esto. `test/jerga.js` comprueba que los
 * cinco devuelven exactamente la misma cadena.
 *
 * ── QUÉ ENTRA Y QUÉ NO ────────────────────────────────────────────────────
 *
 * 1. SÓLO RÓTULOS Y NOMBRES DE ESTADO. Nunca dentro de una frase: «{n} de tus
 *    hechizos fueron resisted» se lee peor que cualquiera de las dos opciones
 *    puras. Por eso `an.resistsDetail` y sus parientes se quedan traducidos
 *    enteros — son frases, no etiquetas.
 *
 * 2. SÓLO TÉRMINOS QUE LA APLICACIÓN PUEDA PRODUCIR DE VERDAD. Un vocabulario
 *    con palabras que no se usan es la familia muerta de siempre.
 *
 *    EL CASO A VIGILAR ES `rooted`, Y SE QUEDA FUERA. Aquí conviene precisar,
 *    porque la primera medición se hizo mal: se dijo que no había ni una línea
 *    de aterrizaje de raíz, y eso es cierto sólo para la raíz SOBRE UN ENEMIGO
 *    —«X has been rooted» no existe—. Sobre TI el registro sí la escribe:
 *
 *        «Your feet adhere to the ground» y variantes    612
 *        «Your feet come free.»                          765
 *
 *    O sea que el estado es real y medible. Lo que pasa es otra cosa: `PISTA` en
 *    `ui/reproduccion.js` no tiene entrada `root`, porque se decidió a propósito
 *    no pintarla —no te impide pegar, así que no explica ningún hueco de la
 *    curva—. Así que `rp.est.root` es hoy un rótulo sin nadie que lo enseñe.
 *
 *    ENTRA EL DÍA QUE LA PISTA LO PINTE, no antes. Que un término esté en la
 *    lista y no pueda aparecer nunca es exactamente lo que esta nota impide.
 */

/**
 * Los términos, en la forma que usa el juego. Minúscula salvo que EQ la escriba
 * de otro modo: son palabras dentro de un rótulo, no títulos.
 */
export const JERGA = {
  stunned: 'stunned',
  charmed: 'charmed',
  charmBroken: 'charm broken',
  feared: 'feared',
  fear: 'fear',
  mez: 'mez',
  proc: 'proc',
  resist: 'resist',
  resisted: 'resisted',
  dispel: 'dispel',
};

/**
 * FUERA DE LA LISTA, y por qué. Se enumera para que nadie los añada sin leer.
 *
 *   rooted / snared  el estado existe y se mide, pero la pista no lo pinta por
 *                    decisión escrita. Entra cuando lo pinte. Ver arriba.
 *   pull / add       los escribe la comunidad, no el registro: EQ no dice
 *                    «pull» en ninguna línea. Un término de jerga que el juego
 *                    no produce no es vocabulario del juego, es argot nuestro.
 */
export const FUERA = ['rooted', 'snared', 'pull', 'add'];
