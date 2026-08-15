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
    const n = String(bruto).charAt(0).toLowerCase() + String(bruto).slice(1);
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
 * El suelo de cada nombre de una pelea, con la actividad ya resuelta por quien
 * llama —que es quien tiene los segundos, no este módulo.
 *
 * @param {Iterable} kills
 * @param {(nombre: string, ultimaMuerte: number) => boolean} hayActividadDespues
 * @param {Map<string, number[]>} [instantes] nombre -> instantes de sus muertes
 */
export function suelosDe(kills, hayActividadDespues = () => false, instantes = null) {
  const muertes = muertesPorNombre(kills);
  const out = new Map();
  for (const [nombre, n] of muertes) {
    const ult = instantes?.get(nombre)?.slice().sort((a, b) => a - b).at(-1) ?? Infinity;
    out.set(nombre, sueloDeNombre(n, hayActividadDespues(nombre, ult)));
  }
  return out;
}
