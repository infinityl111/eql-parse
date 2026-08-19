/**
 * EL TEMPORIZADOR DE REAPARICIÓN. Sección propia y activación MANUAL.
 *
 * Especificado por Campeón el 19/08/2026. Aquí vive sólo la LÓGICA: qué estado
 * tiene un crono y de dónde sale su cifra. Lo que pinta está en `ui/app.js` y
 * lo que lo guarda, en la configuración.
 *
 * ── POR QUÉ NO SE DISPARA SOLO ────────────────────────────────────────────
 *
 * No lo arranca ninguna muerte. Lo abre el jugador y lo cierra el jugador. Un
 * temporizador que aparece solo cada vez que matas algo es ruido en pantalla
 * cuando estás matando cien bichos, que es justo lo que se hace en este juego.
 *
 * ── UN CRONO POR NOMBRE, NO POR MUERTE ────────────────────────────────────
 *
 * Con cien individuos del mismo nombre en la zona, matar a tres seguidos no
 * puede dar tres cuentas atrás del mismo bicho. Hay UNO por nombre y se
 * reinicia con la ÚLTIMA muerte. Y cuando se abre uno de un nombre del que hay
 * varios, se avisa AL ABRIRLO: el crono se reiniciará cuando muera cualquiera
 * de ellos, no el que tú miraras.
 *
 * ── LAS TRES FUENTES DEL VALOR, Y HAY QUE DECIR CUÁL ES ───────────────────
 *
 *   medido     de su propia repetición confirmada. Hoy: 2 enemigos.
 *   heredado   del periodo de reaparición de su zona. Hoy: 6 claves de 52.
 *   manual     lo escribe Campeón. NO existe todavía, y es la que hace que la
 *              sección sirva desde el primer día — sin ella, 8 enemigos.
 *
 * MANDA EL MANUAL, y no es una preferencia: es que él juega y nosotros no. Si
 * hay valor suyo Y observaciones, se enseñan LOS DOS y se dice si discrepan.
 * Sustituir el suyo por el nuestro sería decidir por él con menos información.
 *
 * ── Y EL FALLO SILENCIOSO QUE ESTO PUEDE TENER ────────────────────────────
 *
 * Un crono parado en cero parece «ya está disponible» y puede ser «no estoy
 * reconociendo su línea de muerte». Las dos cosas se ven igual en pantalla, que
 * es la definición de la familia que este proyecto persigue.
 *
 * Medido el 19/08/2026 sobre 1.334.362 líneas: de 6.040 muertes reconocidas hay
 * **3** líneas de muerte que ninguna regla del parser reconoce —las tres de la
 * forma `<Nombre> dies.`, que no está entre las cuatro que se manejan—. Son el
 * 0,05 %, así que el riesgo es pequeño; pero no es cero, y una forma
 * desconocida basta para dejar un crono a cero para siempre.
 *
 * Por eso, a partir de TRES PERIODOS a cero, el crono lo dice. Tres y no uno
 * porque uno es lo normal —matas algo y te vas a otra sala—, y tres es ya raro
 * de explicar por el juego.
 *
 * ── LO QUE ESTA GUARDA NO PUEDE DISTINGUIR, Y HAY QUE DECIRLO ─────────────
 *
 * «Llevo a cero porque no reconozco su muerte» y «llevo a cero porque hace una
 * semana que no piso esa zona» se ven EXACTAMENTE IGUAL desde aquí. Comprobado
 * al enchufarlo al almacén real: abrir un crono de `Kahaptra Z`Taj`, que murió
 * el 10 de agosto, sale «sospechoso» al instante, y no hay nada roto — es que
 * no ha vuelto a Befallen.
 *
 * Para separarlas haría falta saber si el registro está trayendo líneas de esa
 * zona ahora mismo, y eso no está aquí: lo sabe quien pinta. Mientras no se le
 * pase, EL AVISO DICE «QUIZÁ» Y NO «ERROR», que es lo único honesto que se
 * puede decir con lo que esta función ve. Una guarda que no puede distinguir
 * sus dos causas no debe elegir una.
 */

/** Estados posibles. Se exportan para que la interfaz no los escriba a mano. */
export const ESTADO = {
  SIN_MUERTE: 'esperando-primera-muerte',
  CONTANDO: 'contando',
  A_CERO: 'a-cero',
  A_CERO_LARGO: 'a-cero-sospechoso',
};

/** Cuántos periodos a cero hacen sospechar de que no vemos su muerte. */
export const PERIODOS_SOSPECHA = 3;

/**
 * El valor del crono y de dónde sale.
 *
 * @param {object} obs
 *   - manual     segundos escritos por el jugador, o null
 *   - medido     segundos de su propia repetición confirmada, o null
 *   - heredado   segundos del periodo de su zona, o null
 * @returns {{segundos, fuente, discrepa, otro}}
 *   `discrepa` sólo tiene sentido cuando hay manual Y observación: es la
 *   diferencia en segundos, para poder enseñarla sin decidir por nadie.
 */
export function valorDe({ manual = null, medido = null, heredado = null } = {}) {
  const observado = medido ?? heredado ?? null;
  const fuenteObs = medido != null ? 'medido' : (heredado != null ? 'heredado' : null);

  if (manual != null) {
    return {
      segundos: manual,
      fuente: 'manual',
      // Con las dos cosas se enseñan las dos. La diferencia va en segundos y
      // sin signo de juicio: no se dice cuál está bien, se dice que no coinciden.
      discrepa: observado != null && observado !== manual ? Math.abs(manual - observado) : null,
      otro: observado != null ? { segundos: observado, fuente: fuenteObs } : null,
    };
  }
  if (observado != null) return { segundos: observado, fuente: fuenteObs, discrepa: null, otro: null };
  return { segundos: null, fuente: null, discrepa: null, otro: null };
}

/**
 * El estado de un crono abierto.
 *
 * @param {object} crono   { nombre, manual }
 * @param {object} ctx
 *   - ahora          epoch en segundos
 *   - ultimaMuerte   epoch de su última muerte conocida, o null si nunca murió
 *   - medido, heredado  segundos, o null
 * @returns {{estado, restante, transcurrido, valor, aviso}}
 */
export function estadoCrono(crono, ctx = {}) {
  const { ahora = 0, ultimaMuerte = null } = ctx;
  const valor = valorDe({ manual: crono?.manual ?? null, medido: ctx.medido ?? null, heredado: ctx.heredado ?? null });

  // Sin una sola muerte suya en el registro no hay desde cuándo contar. No es
  // un cero: es que la cuenta no ha empezado, y decir «0» sería decir «ya está».
  if (ultimaMuerte == null) {
    return { estado: ESTADO.SIN_MUERTE, restante: null, transcurrido: null, valor, aviso: null };
  }
  // Y sin valor tampoco hay cuenta atrás: se sabe cuándo murió y nada más.
  if (valor.segundos == null) {
    return {
      estado: ESTADO.SIN_MUERTE, restante: null,
      transcurrido: Math.max(0, ahora - ultimaMuerte), valor, aviso: 'sin-valor',
    };
  }

  /**
   * AL ABRIRLO SE DESCUENTA LO YA TRANSCURRIDO, que es la diferencia entre un
   * temporizador y un cronómetro. Si mataste al bicho hace tres minutos y su
   * periodo son cinco, al abrirlo quedan dos — no cinco.
   */
  const transcurrido = Math.max(0, ahora - ultimaMuerte);
  const restante = valor.segundos - transcurrido;

  if (restante > 0) {
    return { estado: ESTADO.CONTANDO, restante, transcurrido, valor, aviso: null };
  }

  /**
   * AL LLEGAR A CERO SE QUEDA A CERO. No desaparece ni se reinicia solo: sólo
   * lo reinicia otra muerte suya, y sólo lo cierra el jugador. Un crono que se
   * borra al llegar a cero le quita al jugador justo la información que pidió.
   */
  const deMas = -restante;
  const sospechoso = deMas >= PERIODOS_SOSPECHA * valor.segundos;
  return {
    estado: sospechoso ? ESTADO.A_CERO_LARGO : ESTADO.A_CERO,
    restante: 0, transcurrido, valor,
    aviso: sospechoso ? 'quizá-no-vemos-su-muerte' : null,
  };
}

/**
 * ¿Hay que avisar al abrirlo de que el nombre tiene varios individuos?
 *
 * El censo ya lo sabe: si en esa zona se le han contado más muertes que
 * apariciones distinguibles, o simplemente más de una a la vez, el crono no
 * habla de UN bicho sino de un NOMBRE. Se avisa al abrir y no después, porque
 * después ya se ha creído lo que decía.
 *
 * @param {number} individuosVistos  cuántos se han visto a la vez, si se sabe
 * @param {number} muertes           cuántas veces ha muerto ese nombre
 */
export function avisoDeVarios(individuosVistos = null, muertes = 0) {
  if (individuosVistos != null && individuosVistos > 1) return 'varios-a-la-vez';
  // Sin la cuenta de simultáneos, muchas muertes del mismo nombre en la misma
  // zona ya lo sugieren. No es prueba, y por eso el aviso es distinto.
  if (muertes >= 10) return 'probablemente-varios';
  return null;
}

/**
 * Reinicio: sólo con una muerte NUEVA, y con la ÚLTIMA si hay varias.
 *
 * @returns {boolean} si el crono debe reiniciarse
 */
export const debeReiniciar = (crono, ultimaMuerte) =>
  ultimaMuerte != null && (crono?.vistaHasta == null || ultimaMuerte > crono.vistaHasta);
