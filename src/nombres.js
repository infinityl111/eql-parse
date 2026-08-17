/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ¿SON EL MISMO NOMBRE? UNA PREGUNTA, UN SITIO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EQ capitaliza la primera letra de cada línea, así que el mismo bicho llega
 * como «A shin ghoul knight has been slain» al abrir frase y como «You slash a
 * shin ghoul knight» a mitad. Las dos formas conviven en el mismo fichero y en
 * la misma pelea, y decidir si son el mismo nombre es una pregunta que esta
 * casa se hace en cinco sitios distintos.
 *
 * ── POR QUÉ GANA LA MINÚSCULA, que no es una preferencia ───────────────────
 *
 * Un nombre propio —«Lord Nagafen»— se escribe igual a mitad de frase que al
 * principio, así que NUNCA produce un par. Si de un nombre hay DOS formas, la
 * de verdad es la minúscula y la otra es la frase. Se ve en «skeleton L`rodd»,
 * que es un named y aun así aparece en minúscula cuando le pegan.
 *
 * ── LO QUE COSTÓ TENERLA CINCO VECES ──────────────────────────────────────
 *
 * Nada, hasta que costó dos veces el mismo día. La regla se arregló en
 * `src/foes.js` y seguía cruda en `ui/app.js`: 25 abatidos que no llegaban al
 * bestiario —`orc legionnaire` perdía 14 de sus muertes— y 9 filas de la
 * enciclopedia diciendo «sobrevivió» de un bicho que había caído.
 *
 * Es la forma que este proyecto lleva trece familias persiguiendo:
 *
 *     UNA REGLA PUESTA EN UN SITIO Y NO EN EL OTRO NO ES MEDIA REGLA,
 *     ES OTRA REGLA.
 *
 * Y aún el 16 de agosto, midiendo el suelo del reproductor, salían
 * `orc centurion` y `Orc centurion` como DOS actores distintos en la misma
 * escena. El fallo de la mayúscula no era sólo cosmético: estaba contaminando
 * el suelo de individuos.
 *
 * ── LOS CINCO LLAMADORES ──────────────────────────────────────────────────
 *
 *   `src/encounter.js`   al resolver el combatiente de una línea
 *   `src/suelo.js`       al contar muertes por nombre
 *   `src/foes.js`        al casar una muerte con su fila del bestiario
 *   `src/guion.js`       al agrupar los sucesos de la reproducción
 *   `ui/app.js`          al preguntar si un bicho cayó en esta pelea
 *
 * ── Y LO QUE ESTA FUNCIÓN NO ES ───────────────────────────────────────────
 *
 *     ESTO DEVUELVE UNA CLAVE, NUNCA UN TEXTO DE PANTALLA.
 *
 * La regla, y es general: *los nombres están sucios, así que se normalizan en
 * los BORDES y se muestran CRUDOS*. La contradecimos a propósito durante meses:
 * la clave plegada se estaba usando como rótulo, así que la interfaz enseñaba
 * nombres con la primera letra caída que el juego no escribe así nunca. Quien
 * necesite escribir un nombre en la interfaz NO llama aquí.
 */

/**
 * La clave de un nombre: la primera letra en minúscula y el resto intacto.
 *
 * NO se baja el nombre entero, y es deliberado: «a shin GHOUL knight» no
 * existe, pero «Ice boned skeleton» e «ice boned skeleton» sí, y bajar sólo la
 * primera letra es exactamente lo que deshace la capitalización de frase sin
 * tocar nada más. Bajar todo juntaría nombres que el juego distingue.
 *
 * @param {string|null|undefined} nombre
 * @returns {string} la clave; cadena vacía si no había nombre
 */
export function claveDeNombre(nombre) {
  const s = String(nombre ?? '');
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * ¿Son el mismo nombre? Lo que preguntaban `mismoNombre` en `foes.js` y
 * `cayoEn` en `ui/app.js`, cada uno por su cuenta.
 */
export function mismoNombre(a, b) {
  return a === b || claveDeNombre(a) === claveDeNombre(b);
}
