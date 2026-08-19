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
 * ── LA CLAVE ES NOMBRE + ZONA + DIFICULTAD ────────────────────────────────
 *
 * Corregido el 19/08/2026 por indicación de Campeón. La clave era sólo el
 * NOMBRE, y eso da mal el número: el periodo es de la zona, no del bicho, así
 * que `a greater skeleton` de Befallen D2 y `a greater skeleton` de otra zona
 * son dos cronos distintos con dos tiempos distintos. Con la clave vieja el
 * segundo pisaba al primero, y la última muerte que lo reiniciaba podía ser de
 * la otra punta del mundo.
 *
 * La dificultad entra en la clave por la misma razón que entra en todo lo
 * demás de este proyecto: `Old Guk D2` mide 567 y `Old Guk D3` mide 568. Son
 * medidas distintas y juntarlas es inventar una tercera.
 *
 * `base` a null es «no consta la zona» y NO es «cualquier zona»: son los
 * cronos guardados antes de este cambio, que se conservan pero se marcan.
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
 *   heredado   del periodo de reaparición de su zona. RETIRADO como concepto
 *              el 19/08/2026: ver abajo. Sigue en el código porque el valor se
 *              guarda al lado, pero no es una vía y no debe volver a serlo.
 *   manual     lo escribe Campeón. NO existe todavía, y es la que hace que la
 *              sección sirva desde el primer día — sin ella, 8 enemigos.
 *
 * ── «HEREDADO» NO ES QUE FALTE MUESTRA: ES QUE LA UNIDAD NO ES LA ZONA ────
 *
 * `heredado` significaba «este nombrado no tiene datos propios, así que se le
 * presta el periodo de su zona». Era la vía de rescate de los nombrados, que son
 * justo los que casi no tienen intervalos: 2,21 por par de media.
 *
 * Se cae, y no por falta de datos. Medido: `The Ruins of Old Guk D2` tiene SEIS
 * racimos a valores distintos —100, 159, 219, 236, 483 y 567 s—, Befallen D2
 * tiene tres y The Warrens D0 tiene tres. «El periodo de la zona» no es un
 * número mal medido: es un objeto que no existe, y no se puede heredar de algo
 * que no está ahí.
 *
 * Y al medir la unidad que SÍ tiene sentido físico —la clave de este fichero:
 * zona + dificultad + nombre— sale peor todavía. Al partir por nombre, catorce
 * de los quince racimos no se parten: SE DISUELVEN. Estaban hechos de bichos
 * distintos, y cinco de ellos eran literalmente una observación por nombre. La
 * unidad nueva produce UN racimo en todo el corpus, de un común, que salta el
 * remuestreo y empata con el nulo de partición (P = 0,516).
 *
 * En NOMBRADOS ÚNICOS, que es donde el intervalo significaría algo, el recuento
 * es CERO — y es un cero vacío, no informativo: con 2,21 intervalos por clave,
 * en 1.000 réplicas del nulo tampoco sale ninguno. No se ha medido que no haya
 * periodo; no se ha podido medir nada.
 *
 * Por eso el texto de la ficha dice «aún no lo sabemos» y da el recuento de
 * observaciones: por la clave correcta, ese recuento tiene MEDIANA 2.
 *
 * De paso explica el desacuerdo con la wiki, que declara una cifra por zona: no
 * nos contradice, mide otra cosa.
 *
 * La unidad candidata es la que este fichero ya usa como clave —zona base +
 * dificultad + NOMBRE—, y si da muestra suficiente está por ver.
 *
 * ── Y DESDE EL 19/08/2026, EL MANUAL ES LA ÚNICA QUE SALE A PANTALLA ──────
 *
 * `NUESTRO_NO_SALE`. Ni `medido` ni `heredado` producen un número en pantalla.
 *
 * Y SUS ROTULOS SE HAN RETIRADO de los cinco idiomas —`cro.src.medido` y
 * `cro.src.heredado`—, en vez de dejarlos esperando dato. Una traducción
 * muerta no es inofensiva: acaba saliendo el día que alguien toque `valorDe`
 * sin conocer esta historia, y lo que aparecería en pantalla es «medido»
 * sobre un número que escribió Campeón. Un rótulo que miente sobre la
 * procedencia es peor que no tener rótulo.
 *
 * Si esto se reabre, HAY QUE VOLVER A ESCRIBIRLOS. Está anotado también en
 * la condición de reapertura del estudio, que es donde se mirará.
 * Se siguen calculando y se guardan al lado, y el día que haya muestra
 * suficiente se contrastarán con el suyo; hoy no.
 *
 * El motivo no es prudencia, es un veredicto medido: EL PERIODO DE
 * REAPARICIÓN DE ZONA NO ESTÁ MEDIDO. El criterio que produce esos números es
 * indistinguible del azar (15 racimos contra 12,5 ± 2,9 del nulo, z = 0,87),
 * diez de los quince desaparecen quitando al azar el 10 % de las
 * observaciones, y la fuente externa los contradice siempre en el mismo
 * sentido. Está entero en `REAPARICION-INSTANCIA.md`.
 *
 * Y la razón por la que no basta con marcarlos: LA GENTE LEE EL NÚMERO Y NO
 * LA MARCA. Un «567 s (poco fiable)» se recuerda como 567. Por eso donde no
 * hay valor suyo no se pone un número peor: se pone «aún no lo sabemos» con
 * el recuento de observaciones al lado, que es lo que de verdad se sabe.
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

/**
 * ── LA PRECISIÓN SALE DEL MARGEN DEL DATO, NO DEL RELOJ ──────────────────
 *
 *     NUNCA SE ENSEÑA MÁS PRECISIÓN DE LA QUE TIENE EL DATO.
 *
 * TODOS nuestros valores tienen incertidumbre, y lo que cambia entre orígenes
 * es su ANCHURA — de seis segundos en Befallen a doce horas en un jefe de
 * varios días.
 *
 * ── Y LA INCERTIDUMBRE VA HACIA ABAJO, NO A LOS DOS LADOS ────────────────
 *
 * Aquí ponía «Befallen no es 265: es 265–271», como si fuera un ±. **Es falso**,
 * y el error es de bulto: 265–271 es el rango de los INTERVALOS OBSERVADOS, y
 * cada intervalo observado es
 *
 *     periodo real  +  lo que el jugador tardó en volver
 *
 * y ese segundo término **nunca es negativo**. Así que el periodo real está en
 * 265 **o POR DEBAJO**, jamás en 271. El 271 no es el otro extremo de una barra
 * de error: es sencillamente la vez que más se tardó en volver.
 *
 * CONSECUENCIA PARA LO QUE SE ENSEÑA, y no es cosmética: **el aviso se da en el
 * borde inferior**. Llegar pronto cuesta esperar; llegar tarde cuesta la vuelta
 * entera. Los dos errores no valen lo mismo, así que el que se elige es el
 * barato — y por eso la cuenta atrás corre contra `segundos`, que ES el borde
 * inferior, y nunca contra el centro ni contra el borde alto.
 *
 * Y una cuenta atrás al segundo sobre un valor con ±12 h **parece medida al
 * segundo porque está escrita al segundo**. La precisión del formato es una
 * afirmación sobre el dato, y escribirla de más es afirmar de más. Es el mismo
 * fallo que persigue toda la aplicación, cometido en la última pulgada.
 *
 * Así que el formato lo decide EL MARGEN HACIA ABAJO:
 *
 *     margen en SEGUNDOS       mm:ss          una cuenta atrás de verdad
 *     margen en MINUTOS        mm             sin segundos: no los tenemos
 *     margen en HORAS o DÍAS   calendario     no es un cronómetro, es un
 *                                             rango de fechas
 *
 * El valor MANUAL de Campeón, si lo escribe sin margen, se enseña con la
 * precisión que él le haya dado —si escribe «4:25», se lee 4:25— y marcado
 * como suyo. No se le añade un margen que él no ha declarado, ni se le quita
 * precisión que él sí ha escrito: es su dato.
 *
 * Y SE LLAMA `margenAbajo`, NO `ventana`. «Ventana» decía que la incertidumbre
 * está a los dos lados, y no lo está: sólo va hacia abajo. Un nombre que mete
 * un supuesto es peor que uno feo, que es la misma lección que las unidades en
 * `engine.ultimaMuerte`.
 */
export const PRECISION = { SEG: 'segundos', MIN: 'minutos', CAL: 'calendario' };

/**
 * @param {number|null} margenAbajoSeg  cuánto puede bajar el valor, en segundos
 * @returns {'segundos'|'minutos'|'calendario'}
 */
export function precisionDe(margenAbajoSeg) {
  // Sin margen declarado, la precisión la pone quien escribió el valor. Eso
  // sólo pasa con el valor manual, y por eso aquí es el caso «tal cual».
  if (margenAbajoSeg == null) return PRECISION.SEG;
  if (margenAbajoSeg < 60) return PRECISION.SEG;
  if (margenAbajoSeg < 3600) return PRECISION.MIN;
  return PRECISION.CAL;
}

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
export function valorDe({
  manual = null, manualMargen = null,
  medido = null, medidoMargen = null,
  heredado = null, heredadoMargen = null,
} = {}) {
  const observado = medido ?? heredado ?? null;
  const obsMargen = medido != null ? medidoMargen : (heredado != null ? heredadoMargen : null);
  const fuenteObs = medido != null ? 'medido' : (heredado != null ? 'heredado' : null);

  const nuestro = observado != null
    ? { segundos: observado, margenAbajo: obsMargen, precision: precisionDe(obsMargen), fuente: fuenteObs }
    : null;

  if (manual != null) {
    return {
      segundos: manual,
      // Sin margen declarado por él, se respeta su precisión tal cual.
      margenAbajo: manualMargen,
      precision: precisionDe(manualMargen),
      fuente: 'manual',
      // Con las dos cosas se enseñan las dos. La diferencia va en segundos y
      // sin signo de juicio: no se dice cuál está bien, se dice que no coinciden.
      discrepa: observado != null && observado !== manual ? Math.abs(manual - observado) : null,
      otro: nuestro,
      retenido: false,
    };
  }

  /**
   * SIN VALOR SUYO NO SALE NINGÚN NÚMERO. Antes salía el nuestro, y eso ya no
   * se puede hacer: `retenido` dice que lo tenemos y que no lo enseñamos, que
   * es distinto de no tener nada, y quien pinta necesita esa distinción para
   * poder decir «van N observaciones» en vez de «no hay nada».
   */
  return {
    segundos: null, margenAbajo: null, precision: null, fuente: null, discrepa: null,
    otro: nuestro, retenido: nuestro != null,
  };
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

/**
 * LA CLAVE DE UN CRONO: nombre + zona base + dificultad.
 *
 * Se separa con `\u0000` y no con un guion porque los nombres del juego traen
 * de todo —`Kahaptra Z`Taj`, `Notarino\`s warder`— y cualquier separador
 * imprimible acabaría dentro de un nombre antes o después. `\u0000` no puede
 * salir en una línea del registro.
 *
 * `base` null se guarda como cadena vacía: el crono existe, pero sin zona.
 *
 * ── EL MODO ENTRA EN LA CLAVE, PERO NO ARREGLA NADA HOY ──────────────────
 *
 * Escribí que `Nagafen's Lair Solo` y `Nagafen's Lair Grupo` compartían crono.
 * **Es falso, y lo comprobé después de escribirlo:** `parseZone` deja el modo
 * DENTRO de `base` —devuelve `base: "Nagafen's Lair Solo"` y `mode: null`—,
 * así que las dos copias ya tenían claves distintas. No había colisión.
 *
 * El campo se queda porque no cuesta nada y porque el día que `parseZone`
 * aprenda a separar el modo, la clave ya lo espera. Pero HOY es siempre null,
 * y decir que arregla algo sería vender un arreglo inventado.
 *
 * Lo que sí se vio al abrir un crono de verdad es el efecto de esa mezcla en
 * pantalla: la ficha rotula la zona como `New Sebilis Expedition`, con el modo
 * pegado al nombre. Es legible, así que se deja; pero es la razón por la que
 * la zona y el modo no se pueden enseñar por separado.
 */
export const claveCrono = (c) => [c?.nombre ?? '', c?.base ?? '', c?.diff ?? '', c?.mode ?? '']
  .join('\u0000');

/** Dos cronos son el mismo si coinciden nombre, zona base y dificultad. */
export const mismaClave = (a, b) => claveCrono(a) === claveCrono(b);

/**
 * EL ORDEN DE LA COLA: el que antes vuelve arriba, y los que ya están, encima.
 *
 * Pedido por Campeón con sus palabras, y es lo que hace que la sección sirva:
 * un crono correcto en el sitio equivocado de la lista no se lee. Con seis
 * abiertos, el orden de alta obliga a repasarlos todos para saber cuál toca.
 *
 * Tres grupos, y el reparto no es de estilo:
 *
 *   1. LOS QUE YA DEBERÍAN ESTAR. Es a lo que se va: son los que se pueden
 *      ir a buscar ahora mismo.
 *   2. LOS QUE CUENTAN, por lo que les queda. El siguiente que va a caer es
 *      el que decide adónde te mueves.
 *   3. LOS QUE NO SABEN CUÁNDO. Sin valor o sin una sola muerte suya no
 *      pueden competir con los que sí lo saben, y arriba sólo estorbarían.
 *
 * DENTRO DEL PRIMER GRUPO, EL MÁS RECIENTE PRIMERO, y esto es una decisión
 * con motivo: cuanto más lleva uno a cero, más probable es que ya se lo haya
 * llevado otro o que no estemos viendo su línea de muerte —que es justo lo
 * que avisa `ESTADO.A_CERO_LARGO`—. Así los sospechosos se hunden solos
 * dentro de su grupo, sin necesidad de una regla aparte.
 *
 * Y EL DESEMPATE ES EL NOMBRE, siempre. Sin él, dos cronos con el mismo
 * restante bailan de sitio en cada repintado —y esto repinta cada segundo—,
 * que es la clase de movimiento que hace imposible pulsar un botón.
 *
 * @param {Array<{crono, estado}>} filas  cada una con su `estadoCrono` hecho
 */
export function ordenCola(filas = []) {
  const grupo = (st) => {
    if (st?.estado === ESTADO.A_CERO || st?.estado === ESTADO.A_CERO_LARGO) return 0;
    if (st?.estado === ESTADO.CONTANDO) return 1;
    return 2;
  };
  // Dentro del grupo: los que están a cero, por lo POCO que llevan; los que
  // cuentan, por lo poco que les queda. Las dos veces, «menos es antes».
  const dentro = (st) => (grupo(st) === 0
    ? (st.restante == null ? 0 : -st.restante)   // `restante` es 0 o negativo
    : (st?.restante ?? 0));
  return filas.slice().sort((a, b) => grupo(a.estado) - grupo(b.estado)
    || dentro(a.estado) - dentro(b.estado)
    || String(a.crono?.nombre ?? '').localeCompare(String(b.crono?.nombre ?? '')));
}
