/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CUÁNTOS BICHOS HUBO CON ESE NOMBRE. El suelo, no la cuenta.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EQL no numera los enemigos. «a shin ghoul knight» son tres bichos distintos
 * escritos igual, y el registro no trae nada que los separe: ni un identificador,
 * ni una posición, ni un apellido. Así que la pregunta «¿cuántos eran?» no tiene
 * respuesta exacta — tiene un SUELO, y el suelo es lo único que se puede afirmar.
 *
 * EL RAZONAMIENTO, que es de Miguel y es medible: un muerto no pega. Si un
 * nombre muere y siguen llegando líneas suyas, había al menos dos.
 *
 *     suelo = muertes del nombre + 1 si hay actividad DESPUÉS de la última
 *
 * Medido sobre el histórico: 2.306 individuos de más de los que se ven hoy,
 * repartidos por 394 peleas de 1.474 — una de cada cuatro.
 *
 * ── POR QUÉ ESTO ES UN MÓDULO Y NO DOS FUNCIONES PARECIDAS ────────────────
 *
 * Porque ya hay DOS sitios que cuentan muertes por nombre: el rótulo de la
 * pelea —el «a shin ghoul knight ×4» que se lee en la lista— y ahora las
 * figuras del reproductor. Dos recuentos del mismo hecho en dos ficheros es
 * exactamente la forma que este proyecto lleva once fallos persiguiendo: la
 * regla puesta en un sitio y no en el otro no es media regla, es otra regla.
 * Cuentan aquí los dos.
 *
 * ── LO QUE EL SUELO NO AUTORIZA ───────────────────────────────────────────
 *
 * DECIR CUÁNTOS HUBO NO ES DECIR QUIÉN HIZO QUÉ. El daño se sigue contando por
 * NOMBRE y no se reparte entre las figuras: cuál de los tres recibió cada golpe
 * no se puede saber nunca, y un reparto a partes iguales sería inventarse un
 * dato con pinta de medido. Ver `dpsPorNombre` en `ui/reproduccion.js`.
 *
 * Y CUÁL DE LAS FIGURAS CAE EN CADA MUERTE ES ARBITRARIO. El registro dice que
 * cayó uno, no cuál. Se apaga una cualquiera y la interfaz lo dice donde se lee.
 */
// ¿Son el mismo nombre? Una pregunta, un sitio. Ver `src/nombres.js`.
import { claveDeNombre } from './nombres.js';

/**
 * Muertes por nombre. `kills` es la lista de la pelea guardada —un nombre por
 * muerte, así que matarlo tres veces son tres entradas— o una lista de
 * `{victim}` como la que lleva el encuentro en vivo.
 *
 * Compara sin la mayúscula inicial: EQ escribe «A shin ghoul knight has been
 * slain» al abrir frase y «a shin ghoul knight» a mitad, y las dos formas
 * conviven en la misma pelea. Ver la deuda apuntada en `src/store.js`.
 *
 * @returns {Map<string, number>} nombre normalizado -> muertes
 */
export function muertesPorNombre(kills = []) {
  const out = new Map();
  for (const k of kills) {
    const bruto = typeof k === 'string' ? k : k?.victim;
    if (!bruto) continue;
    const n = claveDeNombre(bruto);
    out.set(n, (out.get(n) ?? 0) + 1);
  }
  return out;
}

/**
 * El suelo de un nombre: cuántos individuos hubo, como mínimo.
 *
 * @param {number} muertes        cuántas veces cayó ese nombre
 * @param {boolean} actividadDespues  ¿hubo líneas suyas después de la última?
 */
export function sueloDeNombre(muertes = 0, actividadDespues = false) {
  // Sin muertes hay uno: el que está delante. Con muertes, tantos como muertes,
  // y uno más si después seguía habiendo alguien con ese nombre.
  if (muertes <= 0) return 1;
  return muertes + (actividadDespues ? 1 : 0);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA UNIDAD VA EN EL NOMBRE, Y AQUÍ ES OBLIGATORIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este módulo compara DOS instantes que vienen de sitios distintos: la última
 * muerte de un nombre y su última actividad. Los dos tienen que estar en
 * SEGUNDOS DE PELEA, y no hay nada en la firma que lo obligue: son dos números.
 *
 * Al lado, en `src/guion.js`, esos mismos instantes se restaban DOS VECES —una
 * en `engine.js` al guardarlos y otra al leerlos— y el resultado, enorme y
 * negativo, lo aplanaba un `Math.max(0, …)`: todas las figuras se apagaban en el
 * segundo cero. No falló nada. Cero es un segundo válido.
 *
 * Por eso los parámetros llevan la unidad pegada al nombre —`muertesSeg`,
 * `ultimaMuerteSeg`— y por eso hay una guarda que PARA. Ver la regla del número
 * desnudo en `ui/app.js`.
 */

// La invariante de escala vive en un solo sitio. Ver `src/reloj.js`.
import { SEG_IMPOSIBLE } from './reloj.js';

/**
 * El suelo de cada nombre de una pelea, con la actividad ya resuelta por quien
 * llama —que es quien tiene los segundos, no este módulo.
 *
 * @param {Iterable} kills
 * @param {(nombre: string, ultimaMuerteSeg: number) => boolean} hayActividadDespues
 *   SEGUNDOS DE PELEA, no epoch. Y «actividad» es ser SUJETO: pegar, castear,
 *   fallar, matar. Que a uno lo nombren no es actividad suya.
 * @param {Map<string, number[]>} [muertesSeg] nombre -> SEGUNDOS DE PELEA de sus muertes
 */
export function suelosDe(kills, hayActividadDespues = () => false, muertesSeg = null) {
  const muertes = muertesPorNombre(kills);
  const out = new Map();
  for (const [nombre, n] of muertes) {
    const lista = muertesSeg?.get(nombre);
    /**
     * LA INVARIANTE QUE HABRÍA CAZADO EL FALLO EN EL SITIO, y por eso lanza en
     * vez de avisar: una alarma que no PARA nada no la lee nadie. Una pelea de
     * 1.785.835.073 segundos no existe, así que ese número es una hora epoch
     * que alguien no convirtió.
     */
    if (lista?.some((s) => !Number.isFinite(s) || Math.abs(s) > SEG_IMPOSIBLE)) {
      throw new RangeError(
        `suelosDe: «${nombre}» trae muertes fuera de escala (${lista.join(', ')}). ` +
        'Se esperan SEGUNDOS DE PELEA y esto parece epoch.');
    }
    const ultimaMuerteSeg = lista?.slice().sort((a, b) => a - b).at(-1) ?? Infinity;
    out.set(nombre, sueloDeNombre(n, hayActividadDespues(nombre, ultimaMuerteSeg)));
  }
  return out;
}
