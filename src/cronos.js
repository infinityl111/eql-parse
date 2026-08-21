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
 * CORREGIDO EL 20/08/2026: aquí decía «se siguen calculando y se guardan al
 * lado». **Era falso.** Nadie escribía `crono.medido` en ninguna parte del
 * árbol, así que no se calculaba ni se guardaba nada, y la fila de «lo que
 * vamos viendo» decía «aún no» para siempre — y `cro.retenido`, que era su
 * otra rama, resultó ser una cadena muerta e inalcanzable.
 *
 * Ahora sí se cuenta —`engine.observacionesDe()`— y la pantalla dice cuántas
 * observaciones lleva cada clave. Lo que sigue sin salir es la CIFRA, y eso es
 * lo que decide este bloque; que no salga un número no es excusa para no decir
 * si hay algo detrás.
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
/**
 * ── LAS TRES PROCEDENCIAS, Y LAS TRES SE ENSEÑAN SIEMPRE ─────────────────
 *
 * Decisión de Campeón, 19/08/2026. La ficha no elige por él: enseña las tres
 * líneas SIEMPRE, con hueco donde no hay dato, porque «no hay» también
 * informa y una línea que desaparece no se echa de menos.
 *
 *   manual   lo escribe él. MANDA sobre todo. Él juega y nosotros no.
 *   wiki     DECLARADO por `eqlwiki`, con la página de la que salió. Nunca
 *            se presenta como medido, y la página va al lado del número
 *            porque una cifra sin su fuente no se puede ir a comprobar.
 *   nuestro  observaciones propias. HOY NO SALEN, sólo se acumulan.
 *
 * ── QUÉ MUEVE LA CUENTA ATRÁS, que es una decisión y no se deduce ────────
 *
 * `manual` si lo hay; si no, `wiki`. Nuestras observaciones NUNCA.
 *
 * Que la wiki mueva la cuenta atrás no estaba dicho, y lo escribo aquí para
 * que se pueda corregir de un vistazo. El motivo: sin ella la sección no
 * sirve para ninguna zona hasta que Campeón escriba treinta números a mano, y
 * un valor DECLARADO, atribuido y comprobable es exactamente lo que este
 * proyecto acepta mientras no haya medida. Lo que NO se hace es callarlo: el
 * rótulo dice «de la wiki» y trae su página.
 *
 * ── Y SI LA WIKI Y LO NUESTRO DISCREPAN, SE DICE ─────────────────────────
 *
 * No se elige por él. La diferencia se enseña en segundos y sin signo de
 * juicio. Y hay razón para esperar que discrepen: `PERIODOS-CONGELADOS.md`
 * §12 midió que la wiki declara UNA cifra por zona mientras nuestras claves
 * contienen varios racimos a valores distintos. Es granularidad distinta, no
 * un error de nadie, y por eso la discrepancia es información y no una alarma.
 *
 * @param {object} v
 *   - manual, manualMargen      segundos, lo suyo
 *   - wiki, wikiPagina          segundos y la URL de donde salió
 *   - medido/heredado + margen  lo nuestro, que hoy no sale
 */
/**
 * CUÁNTAS OBSERVACIONES HACEN FALTA PARA DECIR «NO COINCIDE».
 *
 * Con una no se dice nada —un intervalo suelto no es una medida— y con dos
 * tampoco: dos puntos son dos puntos. Tres es el suelo mínimo por debajo del
 * cual afirmar una discrepancia sería afirmar ruido.
 *
 * Y no se dice CUÁNTO discrepa, ni cuál es lo nuestro: `NUESTRO_NO_SALE` sigue
 * en pie y decir la diferencia revelaría nuestro número por resta.
 */
export const MIN_OBS_DISCREPA = 3;

/**
 * ¿SE PUEDE AFIRMAR QUE LO OBSERVADO NO COINCIDE CON LO QUE ESCRIBIÓ CAMPEÓN?
 *
 * Dos condiciones, y la segunda es la que de verdad manda.
 *
 * 1. **Suficientes observaciones.** Con una no se dice nada —un intervalo suelto
 *    no es una medida— y con dos tampoco: dos puntos son dos puntos.
 *
 * 2. **Y que sea UN bicho.** «Lo observado no coincide» es una AFIRMACIÓN sobre
 *    nuestra cifra aunque no la imprima, y hereda sus problemas. Tres
 *    observaciones bastan para que no sea ruido de muestra, pero **no bastan si
 *    son de individuos distintos**: de un nombre del que hay cuarenta no
 *    sabemos cuál volvió, así que tampoco sabemos si SU tiempo discrepa del que
 *    él escribió. Tres colisiones siguen siendo tres colisiones.
 *
 * Con multiplicidad demostrada no se afirma nada: se enseña el recuento de
 * observaciones y se calla.
 *
 * `multiplicidad` es el máximo de individuos vistos a la vez. CERO NO ES «HAY
 * UNO»: es «no se ha demostrado que haya más», y eso sí deja afirmar.
 */
export function puedeAfirmarDiscrepancia({ observaciones = 0, multiplicidad = 0 } = {}) {
  if (observaciones < MIN_OBS_DISCREPA) return false;
  return (multiplicidad ?? 0) <= 1;
}

export function valorDe({
  manual = null, manualMargen = null,
  wiki = null, wikiPagina = null,
  medido = null, medidoMargen = null,
  heredado = null, heredadoMargen = null,
} = {}) {
  const observado = medido ?? heredado ?? null;
  const obsMargen = medido != null ? medidoMargen : (heredado != null ? heredadoMargen : null);
  const fuenteObs = medido != null ? 'medido' : (heredado != null ? 'heredado' : null);

  const nuestro = observado != null
    ? { segundos: observado, margenAbajo: obsMargen, precision: precisionDe(obsMargen), fuente: fuenteObs }
    : null;
  // La wiki declara en mm:ss, así que su precisión es el segundo. No lleva
  // margen: un valor declarado no trae incertidumbre, trae autor.
  const deWiki = wiki != null
    ? { segundos: wiki, pagina: wikiPagina ?? null, precision: PRECISION.SEG, fuente: 'wiki' }
    : null;

  // Las tres, SIEMPRE, en orden de mando. `manda` dice cuál mueve la cuenta.
  const fuentes = [
    { clave: 'manual', valor: manual != null
      ? { segundos: manual, margenAbajo: manualMargen, precision: precisionDe(manualMargen), fuente: 'manual' }
      : null },
    { clave: 'wiki', valor: deWiki },
    { clave: 'nuestro', valor: nuestro },
  ];
  const manda = manual != null ? 'manual' : (deWiki ? 'wiki' : null);
  for (const f of fuentes) f.manda = f.clave === manda;

  // La diferencia entre lo que se enseña y lo nuestro, y entre la wiki y lo
  // nuestro. Las dos en segundos y sin decir cuál está bien.
  const dif = (a, b) => (a != null && b != null && a !== b ? Math.abs(a - b) : null);
  const elQueManda = fuentes.find((f) => f.manda)?.valor ?? null;

  return {
    segundos: elQueManda?.segundos ?? null,
    margenAbajo: elQueManda?.margenAbajo ?? null,
    precision: elQueManda?.precision ?? null,
    fuente: manda,
    fuentes,
    // `otro` y `discrepa` se conservan con su significado de siempre: lo
    // nuestro, y en cuánto discrepa de lo que se está enseñando.
    otro: nuestro,
    discrepa: dif(elQueManda?.segundos ?? null, observado),
    discrepaWiki: dif(deWiki?.segundos ?? null, observado),
    // Tenemos observaciones y no las enseñamos. Distinto de no tener nada.
    retenido: nuestro != null,
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
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA COTA SUPERIOR DEL PERIODO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No es una estimacion. Es aritmetica:
 *
 *     hueco observado = periodo + lo que Campeon tarda en volver a verlo
 *     esa espera nunca es negativa
 *     ⇒  periodo ≤ hueco observado
 *
 * Luego el MINIMO hueco valido acota el periodo por arriba, **siempre**. No
 * depende de racimos, ni de remuestreo, ni de que nada se distinga del azar.
 * Una sola observacion ya la hace cierta; lo que cambia con mas huecos no es su
 * validez, es **cuanto aprieta**. Por eso el numero de huecos va SIEMPRE al
 * lado: una cota de un hueco es cierta y floja, y quien la mira necesita
 * saberlo.
 *
 * Y por eso esto NO contradice el veredicto de `REAPARICION`: alli se cerro la
 * puerta a la ESTIMACION PUNTUAL, que exigia distinguir senal de ruido. Una
 * cota no estima. Acota.
 *
 * ── LAS TRES CONDICIONES, Y DOS SALIERON MIDIENDO ─────────────────────────
 *
 * Un hueco solo acota si los dos extremos son EL MISMO BICHO:
 *
 *   a · SIN MULTIPLICIDAD DEMOSTRADA. Si el mismo nombre ha caido dos veces en
 *       una sola pelea, son dos individuos y el hueco no acota nada.
 *
 *   b · LOS DOS EXTREMOS, EN LA MISMA VISITA A LA ZONA. Con dificultad ≥ 1 la
 *       zona es una instancia: al salir y volver a entrar el bicho no ha
 *       reaparecido, **ha nacido con la instancia nueva**. Sin esta condicion
 *       la cobertura parecia el doble.
 *
 *   c · UN HUECO CORTO SE REFUTA SOLO. Medido, sin esta condicion salian cotas
 *       de tres segundos —«Noclin's Pet ≤ 0m 03s»—. Tres segundos no es un
 *       periodo corto: es la PRUEBA de que eran dos bichos distintos, que es
 *       justo lo que (a) no ve cuando murieron en peleas distintas.
 *
 *       El suelo no se elige a ojo: es el p90 de la duracion de una pelea. Por
 *       debajo de eso no da tiempo ni a matarlo, buscarlo y volver.
 *
 * ── DOS ORIGENES, Y SE PUBLICA EL MAS APRETADO ────────────────────────────
 *
 * · MUERTE → MUERTE. El hueco lleva dentro el periodo, lo que tarda en volver
 *   Y lo que tarda en matarlo.
 * · MUERTE → PRIMERA MENCION. Cualquier linea que lo nombre prueba que existe.
 *   Ese hueco no lleva lo que tarda en matarlo, asi que es **estrictamente mas
 *   apretado**, y valido por el mismo argumento.
 *
 * Medido sobre el historico: de las 50 claves que tienen las dos, **47 mas
 * apretadas, 3 iguales, 0 mas flojas** — y el «nunca mas floja» es la
 * aritmetica, no la suerte. Pero la de mencion se refuta 3,6 veces mas por el
 * suelo, y la de muerte cubre 15 claves donde no hay mencion valida.
 *
 * Asi que no hay una principal y otra de respaldo: **se publica la mas
 * apretada de las validas**, que es lo que una cota superior tiene que ser.
 */

/** El suelo: por debajo de esto, el hueco demuestra dos bichos, no un periodo. */
export const SUELO_COTA = 161;

/**
 * Los huecos validos de una serie de sucesos de la MISMA clave.
 *
 * `sucesos` es `[{ t, visita, tipo }]` con `tipo` 'muerte' o 'visto', en orden.
 * Devuelve `{ segundos, huecos, origen }` o `null` si no hay ninguno valido.
 */
export function mejorCota({
  huecosMuerte = [], huecosVisto = [], multiplicidad = 0, suelo = SUELO_COTA,
} = {}) {
  // (a) — con varios individuos demostrados no se acota nada.
  if ((multiplicidad ?? 0) >= 2) return null;

  /**
   * (c) — UN SOLO HUECO POR DEBAJO DEL SUELO REFUTA LA SERIE ENTERA. No se
   * descarta ese hueco y se sigue con los demas: si ahi habia dos bichos,
   * tampoco sabemos cual volvio en los otros. Medido, esto tumba 51 series de
   * menciones y 14 de muertes — y sin ello salian cotas de tres segundos.
   */
  const valida = (h) => (h.length && Math.min(...h) >= suelo ? h : null);
  const vM = valida(huecosMuerte);
  const vV = valida(huecosVisto);

  const cand = [];
  if (vV) cand.push({ segundos: Math.min(...vV), huecos: vV.length, origen: 'visto' });
  if (vM) cand.push({ segundos: Math.min(...vM), huecos: vM.length, origen: 'muerte' });
  if (!cand.length) return null;
  // La mas apretada de las validas. Con empate manda la de mas huecos.
  cand.sort((a, b) => a.segundos - b.segundos || b.huecos - a.huecos);
  return cand[0];
}

/**
 * La misma cota a partir de una serie de sucesos `[{ t, visita, tipo }]`.
 *
 * Es la forma comoda de probarla y de calcularla donde estan los sucesos; el
 * nucleo es `mejorCota`, que solo necesita los huecos ya recogidos.
 */
export function cotaDe(sucesos = [], { multiplicidad = 0, suelo = SUELO_COTA } = {}) {
  const orden = [...sucesos].filter((x) => x && x.t != null).sort((a, b) => a.t - b.t);
  const muertes = orden.filter((x) => x.tipo === 'muerte');
  const vistos = orden.filter((x) => x.tipo === 'visto');

  const recoge = (siguiente) => {
    const h = [];
    for (const m of muertes) {
      const s = siguiente(m);
      // (b) — el otro extremo, en la MISMA visita.
      if (s && s.visita === m.visita && s.t > m.t) h.push(s.t - m.t);
    }
    return h;
  };

  return mejorCota({
    huecosMuerte: recoge((m) => muertes.find((x) => x.t > m.t)),
    huecosVisto: recoge((m) => vistos.find((x) => x.t > m.t)),
    multiplicidad,
    suelo,
  });
}

/**
 * QUE DECIR DEL VISTO. Pura, y `ahora` entra por parametro.
 *
 * Vivia dentro del pintor, y por eso la unica forma de ejercitar la rama de
 * «esta ahi» era que la sonda escribiera una linea reciente y la aplicacion la
 * pintara antes de que pasaran `suelo` segundos — corriendo contra el reloj de
 * arranque, que tarda minutos. Aqui se prueba entera en microsegundos.
 *
 * Tres lecturas, y la tercera es la que hace util el temporizador:
 *
 *   · visto hace poco            → esta ahi
 *   · visto hace rato            → no se le ve desde hace X
 *   · sin verlo Y su techo pasado → deberia estar, y no lo has visto
 *
 * Sin mencion se cuenta desde su ULTIMA MUERTE, que no es una laguna: de un
 * bicho que muere en todas sus peleas no hay ninguna mencion posterior, y ese
 * es justo el caso normal.
 */
export function lecturaDelVisto({
  visto = null, ultimaMuerte = null, ahora = 0, cota = null, suelo = SUELO_COTA,
} = {}) {
  const desde = visto?.t != null ? Math.max(0, ahora - visto.t)
    : (ultimaMuerte != null ? Math.max(0, ahora - ultimaMuerte) : null);
  if (desde == null) return null;
  /**
   * Y DE DONDE SALE VIAJA CON EL DATO. `kind` puede ser una linea del registro
   * -`melee`, `spell`...- o `pelea`, que es el respaldo del almacen: «estuvo en
   * un combate». NO son la misma afirmacion y quien lo pinta tiene que poder
   * decir cual es; sin esto, un visto sacado de una pelea guardada se rotulaba
   * como «en una linea de combate», que es una procedencia prestada.
   */
  const kind = visto?.kind ?? null;
  // Recien nombrado es «esta ahi». El corte es el mismo suelo que usa la cota,
  // porque es lo que puede pasar sin que el registro lo nombre estando delante.
  if (visto?.t != null && desde <= suelo) return { segundos: desde, esta: true, kind };
  return {
    segundos: desde,
    esta: false,
    kind,
    pasado: cota?.segundos != null ? desde > cota.segundos : false,
  };
}

export function estadoCrono(crono, ctx = {}) {
  const { ahora = 0, ultimaMuerte = null } = ctx;
  const valor = valorDe({
    manual: crono?.manual ?? null,
    wiki: ctx.wiki ?? null, wikiPagina: ctx.wikiPagina ?? null,
    medido: ctx.medido ?? null, heredado: ctx.heredado ?? null,
  });

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

export function enemigosDeLaPelea(f) {
  const muertes = new Map();
  for (const k of (f?.killTimes ?? [])) {
    if (!k?.name) continue;
    const arr = muertes.get(k.name) ?? [];
    arr.push((f.start ?? 0) + (k.t ?? 0));
    muertes.set(k.name, arr);
  }
  return (f?.rows ?? [])
    .filter((r) => r.side === 'enemy')
    // Caso 2: las mascotas enemigas, fuera.
    .filter((r) => !r.petOf && !/ pet$/i.test(r.name))
    .map((r) => {
      const ts = (muertes.get(r.name) ?? []).slice().sort((a, b) => a - b);
      return {
        nombre: r.name,
        veces: ts.length,
        // Caso 4: la última.
        cuando: ts.length ? ts[ts.length - 1] : null,
        charmed: r.charmed === true,
      };
    })
    // Los que se pueden seguir, primero; dentro, por nombre.
    .sort((a, b) => (b.veces > 0) - (a.veces > 0) || a.nombre.localeCompare(b.nombre));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOS CANDIDATOS DEL HISTÓRICO ENTERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta hoy había dos formas de abrir un temporizador y las dos miraban al
 * PRESENTE: la pelea que tienes delante —que da la clave entera y correcta— y
 * un campo de texto donde escribir un nombre a mano —que la da coja: la zona
 * sale de donde estés AHORA, y la dificultad y el modo no se pueden poner—.
 *
 * Falta justo lo que uno quiere al sentarse a jugar: **la lista de todo lo que
 * has matado alguna vez**, con su zona y su dificultad ya puestas. Es lo que
 * hace esta función, y sale del ÍNDICE del almacén, que ya trae por pelea los
 * nombres abatidos, la zona base y la dificultad. No abre ni un fichero.
 *
 * ── LA CLAVE ES LA MISMA O NO SIRVE DE NADA ───────────────────────────────
 *
 * Un candidato no es un nombre: es una CLAVE —nombre + zona + dificultad—, la
 * misma que usan las cinco consultas del crono. Se construye con los campos
 * del resumen tal y como los leen ellas, y no con una versión «mejorada» aquí:
 * un candidato cuya clave no case con la que consulta `ultimaMuerte` nace
 * ciego, y ciego se ve exactamente igual que «aún no ha muerto nunca».
 *
 * Esa cura está donde tiene que estar —`rehacerZona`, al leer el índice—, y no
 * aquí. Medido antes de ponerla: 238 de 731 claves no habrían visto NINGUNA de
 * sus muertes.
 *
 * ── LAS MASCOTAS FUERA, Y CON UNA RESERVA DICHA ───────────────────────────
 *
 * Una mascota no reaparece por temporizador: la invoca su dueño. Se van por el
 * sufijo ` pet`, que es lo único que el índice permite mirar — `petOf` vive
 * dentro de la pelea y no en el resumen. Así que este filtro es MÁS FLOJO que
 * el de `enemigosDeLaPelea`, y se dice en vez de aparentar que son el mismo.
 * Medido sobre el histórico real: 78 claves con el sufijo.
 *
 * ── QUÉ CUENTA CADA CIFRA, dicho antes de operar con ella ─────────────────
 *
 *   muertes    veces que ese nombre ha caído en esa zona y dificultad
 *   peleas     en cuántos combates distintos — dos muertes en uno son dos
 *              individuos, no dos reapariciones, y por eso van separadas
 *   ultimaMs   el INSTANTE EN QUE EMPEZÓ la última pelea donde cayó, en
 *              milisegundos. NO es el instante de su muerte: ése hay que ir a
 *              buscarlo a la pelea, y lo hace `ultimaMuerte` para el que
 *              abras. Sirve para ordenar y para decir el DÍA, no la hora.
 *
 * @param {Array} peleas   resúmenes del índice: { at, zoneBase, diff, kills }
 * @param {Array} abiertos los cronos que ya existen, para marcarlos
 */
export function candidatosDe(peleas = [], { abiertos = [] } = {}) {
  const ya = new Set((abiertos ?? []).filter(Boolean).map((c) => claveCrono(c)));
  const porClave = new Map();

  for (const sm of peleas ?? []) {
    // `kills` viaja como nombres sueltos o como `{ victim }` según la versión
    // que guardó la pelea. Las dos formas se leen aquí igual que en el motor.
    const caidos = (sm?.kills ?? [])
      .map((k) => (typeof k === 'string' ? k : k?.victim))
      .filter(Boolean);
    if (!caidos.length) continue;
    const base = sm.zoneBase ?? null;
    const diff = sm.diff ?? null;
    const atMs = sm.at ?? null;

    // Cuántas veces cayó cada nombre EN ESTA pelea: es lo que separa «muertes»
    // de «peleas», y sin separarlas el recuento promete reapariciones que no ha
    // visto.
    const veces = new Map();
    for (const n of caidos) {
      if (/ pet$/i.test(n)) continue;
      veces.set(n, (veces.get(n) ?? 0) + 1);
    }

    for (const [nombre, n] of veces) {
      const c = { nombre, base, diff, mode: null };
      const k = claveCrono(c);
      let e = porClave.get(k);
      if (!e) {
        e = {
          ...c, diffTag: sm.diffTag ?? null,
          muertes: 0, peleas: 0, ultimaMs: null, ya: ya.has(k),
        };
        porClave.set(k, e);
      }
      e.muertes += n;
      e.peleas += 1;
      if (atMs != null && (e.ultimaMs == null || atMs > e.ultimaMs)) e.ultimaMs = atMs;
      if (e.diffTag == null && sm.diffTag != null) e.diffTag = sm.diffTag;
    }
  }

  /**
   * EL ORDEN ES EL DE LA ÚLTIMA VEZ QUE LO MATASTE, y no el alfabético.
   *
   * Lo que buscas al abrir esta lista es casi siempre de donde vienes: la zona
   * de anoche está arriba sin escribir nada. El alfabético no contesta ninguna
   * pregunta que alguien tenga.
   *
   * Y el desempate es el nombre, siempre, por lo mismo que en la cola: sin él
   * dos candidatos de la misma pelea bailan de sitio entre repintados.
   */
  return [...porClave.values()].sort((a, b) => (b.ultimaMs ?? 0) - (a.ultimaMs ?? 0)
    || b.muertes - a.muertes
    || String(a.nombre).localeCompare(String(b.nombre)));
}

/**
 * LO QUE CASA CON LO ESCRITO, y CUÁNTO SE HA DEJADO FUERA.
 *
 * Dos cosas y no una, y la segunda es la que no se puede callar: una lista de
 * cuarenta filas sacada de setecientas se lee como la lista entera. El recorte
 * viaja en la respuesta —`ocultos`— para que la pantalla lo diga con un
 * número, que es la misma regla del filtro que vacía.
 *
 * Se busca por NOMBRE Y POR ZONA a la vez: «Guk» tiene que traer lo de Old
 * Guk, y quien escribe «Guk» no está pensando en la diferencia.
 */
export function filtraCandidatos(lista = [], { q = '', tope = 0 } = {}) {
  const busca = String(q ?? '').trim().toLowerCase();
  const casa = (c) => !busca
    || String(c.nombre ?? '').toLowerCase().includes(busca)
    || String(c.base ?? '').toLowerCase().includes(busca);
  const casan = (lista ?? []).filter(casa);
  const filas = tope > 0 ? casan.slice(0, tope) : casan;
  return {
    filas,
    casan: casan.length,
    total: (lista ?? []).length,
    ocultos: casan.length - filas.length,
  };
}
