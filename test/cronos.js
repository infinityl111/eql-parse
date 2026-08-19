/**
 * EL TEMPORIZADOR DE REAPARICIÓN, Y LAS TRES FUENTES DE SU CIFRA.
 *
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO EN PARTE: lo que decide qué manda entre el
 * valor del jugador y el nuestro es una DECISIÓN, no un observable. Si algún
 * día se cambia, esta tanda se pondrá roja y hay que releerla, no arreglarla a
 * ciegas. Lo demás —la aritmética de la cuenta atrás— sí es observable.
 *
 * ── LO QUE ESTO GUARDA ────────────────────────────────────────────────────
 *
 * Especificado por Campeón el 19/08/2026:
 *
 *   · activación MANUAL: no lo dispara ninguna muerte;
 *   · al abrirlo, descuenta lo ya transcurrido desde la última muerte;
 *   · sin ninguna muerte suya, «esperando primera muerte» — que NO es cero;
 *   · al llegar a 0 se QUEDA a 0: ni desaparece ni se reinicia solo;
 *   · sólo lo reinicia otra muerte suya, y sólo lo cierra el jugador;
 *   · un crono por NOMBRE, con aviso al abrirlo si de ése hay varios;
 *   · MANDA EL VALOR MANUAL, y si hay observación también, se enseñan los dos.
 *
 * ── Y EL FALLO SILENCIOSO QUE CUBRE ───────────────────────────────────────
 *
 * Un cero permanente parece «ya está disponible» y puede ser «no reconozco su
 * línea de muerte». Medido el 19/08/2026 sobre 1.334.362 líneas: 6.040 muertes
 * reconocidas y **3** líneas de muerte que ninguna regla reconoce, de la forma
 * `<Nombre> dies.`. Son el 0,05 %: el riesgo es pequeño, no nulo, y basta una
 * forma desconocida para dejar un crono a cero para siempre.
 */
import {
  valorDe, estadoCrono, avisoDeVarios, debeReiniciar,
  precisionDe, ESTADO, PERIODOS_SOSPECHA, PRECISION, claveCrono, mismaClave } from '../src/cronos.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// El valor lo pone el JUGADOR: desde el 19/08/2026 es el único que sale a
// pantalla, así que es con el que hay que probar la maquinaria de la cuenta
// atrás. Antes se probaba con `medido`, y `medido` ya no produce número.
const CRONO = { nombre: 'X', manual: 300 };

// ── 1. Las tres fuentes, y cuál manda ──────────────────────────────────────
console.log('\nlas tres fuentes del valor');
{
  /**
   * Desde el 19/08/2026 lo nuestro NO SALE A PANTALLA. Se sigue calculando y se
   * guarda en `otro`, pero no produce `segundos` ni `fuente`: el periodo de zona
   * no está medido y un número marcado se lee como número.
   */
  ok(valorDe({ medido: 265 }).segundos === null,
    'lo medido por nosotros NO sale como valor');
  ok(valorDe({ heredado: 484 }).segundos === null,
    'ni el ritmo de la zona');
  ok(valorDe({ medido: 265 }).otro?.segundos === 265 && valorDe({ medido: 265 }).retenido === true,
    'pero se guarda al lado y se dice que se está reteniendo', 'retenido');
  ok(valorDe({}).retenido === false,
    'y no tener nada NO es lo mismo que retener algo');
  ok(valorDe({ manual: 300 }).fuente === 'manual', 'y lo que escribe el jugador, «manual»');

  ok(valorDe({ medido: 265, heredado: 484 }).otro?.fuente === 'medido',
    'entre medido y heredado sigue ganando el medido, aunque sea para guardarlo');

  /**
   * MANDA EL MANUAL. Es una decisión y por eso está aquí: él juega y nosotros
   * no. Lo que NO se hace es sustituir el suyo por el nuestro en silencio.
   */
  const dos = valorDe({ manual: 300, medido: 265 });
  ok(dos.fuente === 'manual' && dos.segundos === 300,
    'con valor del jugador y medición nuestra, cuenta EL SUYO', `${dos.segundos} (${dos.fuente})`);
  ok(dos.otro && dos.otro.segundos === 265 && dos.otro.fuente === 'medido',
    'pero la nuestra sigue ahí para poder enseñarla', JSON.stringify(dos.otro));
  ok(dos.discrepa === 35, 'y se dice CUÁNTO discrepan, sin decidir quién acierta', dos.discrepa);

  const iguales = valorDe({ manual: 265, medido: 265 });
  ok(iguales.discrepa === null, 'si coinciden, no hay nada que avisar');

  ok(valorDe({}).segundos === null, 'sin ninguna de las tres, no hay valor');
}

// ── 2. La cuenta atrás descuenta lo transcurrido ───────────────────────────
console.log('\nal abrirlo se descuenta lo ya transcurrido');
{
  const ctx = { ahora: 1000, ultimaMuerte: 800 };
  const r = estadoCrono(CRONO, ctx);
  ok(r.estado === ESTADO.CONTANDO, 'está contando');
  ok(r.transcurrido === 200, 'han pasado 200 s desde su muerte', r.transcurrido);
  ok(r.restante === 100, 'así que quedan 100, no 300', r.restante);

  // Un cronómetro daría 300. Ésta es la diferencia, y es la razón de la función.
  ok(r.restante !== r.valor.segundos, 'no es un cronómetro: no empieza por el valor entero');
}

// ── 3. Sin ninguna muerte suya no es CERO: es que no ha empezado ───────────
console.log('\nsin ninguna muerte conocida');
{
  const r = estadoCrono(CRONO, { ahora: 1000, ultimaMuerte: null });
  ok(r.estado === ESTADO.SIN_MUERTE, 'el estado es «esperando primera muerte»', r.estado);
  ok(r.restante === null, 'y el restante es NULO, no cero');
  /**
   * La distinción no es cosmética: un 0 se lee «ya está disponible». Decir cero
   * donde no se sabe nada es afirmar algo que no se ha medido.
   */
  ok(r.restante !== 0, 'CONTROL: cero y «no se sabe» no pueden verse igual');

  // Y al revés: con muerte pero sin valor, se sabe cuándo murió y nada más.
  const sinValor = estadoCrono({ nombre: 'X' }, { ahora: 1000, ultimaMuerte: 800 });
  ok(sinValor.aviso === 'sin-valor', 'con muerte pero sin cifra, se dice que falta la cifra');
  ok(sinValor.transcurrido === 200, 'y aun así se sabe cuánto hace que murió', sinValor.transcurrido);
}

// ── 4. Al llegar a cero SE QUEDA a cero ────────────────────────────────────
console.log('\nal llegar a cero se queda a cero');
{
  const justo = estadoCrono(CRONO, { ahora: 1100, ultimaMuerte: 800 });
  ok(justo.estado === ESTADO.A_CERO, 'justo al cumplirse, a cero', justo.estado);
  ok(justo.restante === 0, 'y el restante es 0, no negativo', justo.restante);

  const pasado = estadoCrono(CRONO, { ahora: 1250, ultimaMuerte: 800 });
  ok(pasado.estado === ESTADO.A_CERO, 'medio periodo después, sigue a cero y sigue existiendo');
  ok(pasado.restante === 0, 'sin números negativos en pantalla', pasado.restante);
}

/**
 * ── 5. EL FALLO SILENCIOSO: un cero permanente puede ser una muerte que no vemos
 *
 * Es la aserción que justifica la sección entera de la guarda. Sin ella, «a
 * cero» y «llevo a cero desde ayer porque no reconozco su línea de muerte» se
 * ven exactamente igual.
 */
console.log('\nun cero demasiado largo se avisa');
{
  const v = 300;
  const casi = estadoCrono({ nombre: 'X', manual: v }, { ahora: 1100 + PERIODOS_SOSPECHA * v - 1, ultimaMuerte: 800 });
  ok(casi.estado === ESTADO.A_CERO, `con menos de ${PERIODOS_SOSPECHA} periodos a cero, no se sospecha`, casi.estado);
  ok(casi.aviso === null, 'y no hay aviso');

  const mucho = estadoCrono({ nombre: 'X', manual: v }, { ahora: 1100 + PERIODOS_SOSPECHA * v, ultimaMuerte: 800 });
  ok(mucho.estado === ESTADO.A_CERO_LARGO, `a ${PERIODOS_SOSPECHA} periodos, se sospecha`, mucho.estado);
  ok(mucho.aviso === 'quizá-no-vemos-su-muerte',
    'y el aviso dice la causa probable, no «error»', mucho.aviso);

  /**
   * CONTROL POSITIVO: el umbral tiene que depender del PERIODO, no ser un
   * número de segundos fijo. Un bicho de 8 minutos y otro de 100 no pueden
   * sospechar a la vez.
   */
  // «Tres periodos A CERO» es el tiempo pasado DESPUÉS de cumplirse, así que
  // el transcurrido total son cuatro periodos: uno para llegar y tres de más.
  const t = 800 + 4 * 100;
  const corto = estadoCrono({ nombre: 'X', manual: 100 }, { ahora: t, ultimaMuerte: 800 });
  const largo = estadoCrono({ nombre: 'X', manual: 600 }, { ahora: t, ultimaMuerte: 800 });
  ok(corto.estado === ESTADO.A_CERO_LARGO,
    'CONTROL: con periodo 100 y 400 s transcurridos, sospecha', corto.estado);
  ok(largo.estado === ESTADO.CONTANDO,
    'CONTROL: con periodo 600 y los MISMOS 400 s, ni siquiera ha llegado a cero', largo.restante);
}

// ── 6. Un crono por NOMBRE, con su aviso ───────────────────────────────────
console.log('\nun crono por nombre, y se avisa si hay varios');
{
  ok(avisoDeVarios(3, 5) === 'varios-a-la-vez',
    'si el censo vio varios a la vez, se dice al abrirlo');
  ok(avisoDeVarios(null, 40) === 'probablemente-varios',
    'sin esa cuenta, muchas muertes del mismo nombre ya lo sugieren');
  ok(avisoDeVarios(1, 3) === null, 'y de un nombrado único no se avisa nada');
  /**
   * Los dos avisos son DISTINTOS a propósito: uno es una observación y el otro
   * una sospecha, y mezclarlos sería vender una deducción como un hecho.
   */
  ok(avisoDeVarios(3, 5) !== avisoDeVarios(null, 40),
    'CONTROL: la observación y la sospecha no dicen lo mismo');
}

// ── 7. Sólo reinicia una muerte NUEVA ──────────────────────────────────────
console.log('\nsólo lo reinicia una muerte nueva');
{
  ok(debeReiniciar({ vistaHasta: 800 }, 900) === true, 'una muerte posterior lo reinicia');
  ok(debeReiniciar({ vistaHasta: 900 }, 900) === false, 'la misma muerte, no: no se reinicia solo');
  ok(debeReiniciar({ vistaHasta: 900 }, 800) === false, 'ni una anterior que aparezca al releer');
  ok(debeReiniciar({}, 900) === true, 'y recién abierto, la última muerte conocida lo arranca');
  ok(debeReiniciar({ vistaHasta: 800 }, null) === false, 'sin muertes no hay nada que reiniciar');
}

/**
 * ── 8. LA PRECISIÓN SALE DE LA VENTANA, NO DEL RELOJ ──────────────────────
 *
 *     NUNCA SE ENSEÑA MÁS PRECISIÓN DE LA QUE TIENE EL DATO.
 *
 * TODOS nuestros valores tienen margenAbajo: Befallen no es 265, es 265–271. Lo
 * que cambia entre orígenes es la ANCHURA. Y una cuenta atrás escrita al
 * segundo sobre un valor con ±12 h **parece medida al segundo porque está
 * escrita al segundo**: la precisión del formato es una afirmación sobre el
 * dato, y escribirla de más es afirmar de más.
 */
console.log('\nla precisión la decide la ventana');
{
  ok(precisionDe(6) === PRECISION.SEG, 'margen de 6 s (Befallen: 265 o menos) → al segundo', precisionDe(6));
  ok(precisionDe(59) === PRECISION.SEG, 'y hasta 59 s, al segundo');
  ok(precisionDe(60) === PRECISION.MIN, 'un minuto de ventana ya no tiene segundos que enseñar');
  ok(precisionDe(1800) === PRECISION.MIN, 'media hora de ventana, en minutos');
  ok(precisionDe(3600) === PRECISION.CAL, 'una hora de ventana ya no es un cronómetro', precisionDe(3600));
  ok(precisionDe(12 * 3600) === PRECISION.CAL,
    'y con ±12 h —Innoruuk, 3 días— es un calendario, no una cuenta atrás');

  /**
   * EL CONTROL POSITIVO: la precisión tiene que BAJAR al ensanchar la ventana,
   * nunca subir. Sin esto, una función que devolviera siempre lo mismo pasaría
   * todas las aserciones de arriba.
   */
  const orden = { [PRECISION.SEG]: 3, [PRECISION.MIN]: 2, [PRECISION.CAL]: 1 };
  const anchuras = [1, 6, 30, 59, 60, 300, 3599, 3600, 86400, 3 * 86400];
  const niveles = anchuras.map((a) => orden[precisionDe(a)]);
  ok(niveles.every((v, i) => i === 0 || v <= niveles[i - 1]),
    'CONTROL: la precisión nunca sube al ensanchar la ventana', niveles.join(' '));
  ok(new Set(niveles).size === 3, 'CONTROL: y usa las TRES precisiones, no una sola', new Set(niveles).size);
}

console.log('\nel valor manual conserva la precisión que le dio Campeón');
{
  const suyo = valorDe({ manual: 265 });
  ok(suyo.margenAbajo === null, 'si no declara ventana, no se le inventa una');
  ok(suyo.precision === PRECISION.SEG, 'y se enseña con la precisión que él escribió', suyo.precision);

  // Y si la declara, manda la suya.
  const conVentana = valorDe({ manual: 3 * 86400, manualMargen: 24 * 3600 });
  ok(conVentana.precision === PRECISION.CAL,
    'con ±12 h declaradas por él, calendario igual que si fuera nuestra');

  /**
   * Y LO QUE NO SE HACE: quitarle precisión que él sí escribió. Un valor suyo
   * al segundo se enseña al segundo aunque el nuestro para ese bicho sea ancho.
   */
  const mixto = valorDe({ manual: 265, medido: 3 * 86400, medidoMargen: 12 * 3600 });
  ok(mixto.precision === PRECISION.SEG, 'el suyo manda también en la precisión', mixto.precision);
  ok(mixto.otro.precision === PRECISION.CAL,
    'y el nuestro se enseña al lado con LA SUYA, que es otra', mixto.otro.precision);
}

console.log('\nlas observaciones traen su ventana');
{
  const bef = valorDe({ medido: 265, medidoMargen: 6 });
  ok(bef.otro?.segundos === 265 && bef.otro?.margenAbajo === 6, 'Befallen: 265 con ventana de 6 s');
  ok(bef.otro?.precision === PRECISION.SEG, 'y su precisión se conserva, para el día que se contraste');
  ok(bef.segundos === null, 'aunque hoy no salga a pantalla');

  const jefe = valorDe({ heredado: 3 * 86400, heredadoMargen: 24 * 3600 });
  ok(jefe.otro?.precision === PRECISION.CAL, 'un jefe de 3 días ±12 h, en calendario', jefe.otro?.precision);
  ok(jefe.otro?.fuente === 'heredado', 'y sigue diciendo de dónde sale');

  ok(valorDe({}).precision === null, 'sin valor no hay precisión que declarar');
}

console.log('\nla clave es NOMBRE + ZONA + DIFICULTAD');
{
  /**
   * EL CASO QUE MOTIVA EL CAMBIO, y por eso va primero.
   *
   * `a greater skeleton` existe en más de una zona. Con la clave vieja —sólo el
   * nombre— el segundo crono no se podía ni abrir, y la muerte que reiniciaba al
   * primero podía ser de la otra punta del mundo. El periodo es de la ZONA, así
   * que son dos cronos con dos tiempos.
   */
  const befallen = { nombre: 'a greater skeleton', base: 'Befallen', diff: 2 };
  const guk = { nombre: 'a greater skeleton', base: 'The Ruins of Old Guk', diff: 2 };
  ok(!mismaClave(befallen, guk),
    'el mismo bicho en dos zonas son DOS cronos, no uno');

  /**
   * Y la dificultad entra por la misma razón que en todo lo demás: Old Guk D2
   * mide 567 y Old Guk D3 mide 568. Son dos medidas y juntarlas inventa una
   * tercera que no se ha observado.
   */
  ok(!mismaClave(guk, { ...guk, diff: 3 }),
    'la dificultad también parte: D2 y D3 son dos medidas distintas');

  ok(mismaClave(befallen, { ...befallen }), 'y lo idéntico sigue siendo idéntico');

  /**
   * CONTROL POSITIVO de que la clave separa por lo que decimos y no por el
   * objeto: dos objetos distintos con los mismos tres campos dan la misma clave,
   * y cambiar CUALQUIERA de los tres la cambia. Sin esto, un `claveCrono` que
   * devolviera siempre algo distinto pasaría los tres 'ok' de arriba.
   */
  ok(claveCrono(befallen) === claveCrono({ ...befallen, extra: 1 }),
    'CONTROL: un campo de más no cambia la clave — no depende del objeto');
  const campos = [
    ['nombre', 'otro bicho'], ['base', 'otra zona'], ['diff', 4],
  ];
  campos.forEach(([k, v]) => ok(claveCrono({ ...befallen, [k]: v }) !== claveCrono(befallen),
    `CONTROL: cambiar ${k} cambia la clave`));

  /**
   * Los cronos guardados antes de este cambio no traen zona. Se conservan —vale
   * más un crono sin zona que ninguno— pero NO se confunden con uno que sí la
   * tiene, o al abrir el de Befallen se estaría reabriendo el viejo.
   */
  const viejo = { nombre: 'a greater skeleton' };
  ok(!mismaClave(viejo, befallen),
    'un crono sin zona no es el mismo que uno con zona');
  ok(mismaClave(viejo, { nombre: viejo.nombre, base: null, diff: null }),
    'y «sin zona» es una sola cosa: falte el campo o valga null');

  /**
   * El separador no puede salir en un nombre del juego. Si fuera imprimible,
   * `Notarino's warder` en la zona X y `Notarino` en la zona `s warder|X`
   * darían la misma clave. Con `\u0000` eso no puede pasar: no hay línea del
   * registro que lo contenga.
   */
  ok(claveCrono({ nombre: 'a', base: 'b|c' }) !== claveCrono({ nombre: 'a|b', base: 'c' }),
    'el separador no se puede falsificar desde un nombre');
  ok(claveCrono({ nombre: 'x' }).includes('\u0000'),
    'y es \\u0000, que no puede salir en el registro');
}

console.log('\nningún número NUESTRO sale a pantalla');
{
  /**
   * EL VEREDICTO QUE FIJA ESTE BLOQUE, y por qué es una prueba y no una opinión.
   *
   * El periodo de reaparición de zona NO ESTÁ MEDIDO: el criterio que produce
   * esas cifras es indistinguible del azar —15 racimos contra 12,5 ± 2,9 del
   * nulo, z = 0,87—, diez de los quince desaparecen quitando al azar el 10 % de
   * las observaciones, y la fuente externa los contradice siempre en el mismo
   * sentido. Mientras eso siga así, en pantalla no sale ningún número nuestro.
   *
   * Y NO BASTA CON MARCARLO. La gente lee el número y no la marca: un
   * «567 s (poco fiable)» se recuerda como 567. Por eso la regla es que no haya
   * número, no que lo haya con una advertencia.
   */
  const soloNuestro = { ahora: 2000, ultimaMuerte: 1000, medido: 300, heredado: 480 };
  const st = estadoCrono({ nombre: 'X' }, soloNuestro);
  ok(st.valor.segundos === null,
    'con medido Y heredado y sin valor suyo, no hay número');
  ok(st.restante === null,
    'y por tanto no hay cuenta atrás que enseñar');
  ok(st.valor.retenido === true,
    'pero se dice que hay algo retenido, para poder contar las observaciones');

  /**
   * CONTROL POSITIVO. Sin esto, las tres de arriba pasarían en verde con un
   * `valorDe` roto que devolviera null siempre — que es justo el fallo que este
   * cambio podría introducir. Con valor del jugador, el crono cuenta igual que
   * antes: lo que se ha retirado es NUESTRO número, no la maquinaria.
   */
  const conSuyo = estadoCrono({ nombre: 'X', manual: 1500 }, soloNuestro);
  ok(conSuyo.valor.segundos === 1500,
    'CONTROL: con valor suyo SÍ hay número, y es el suyo');
  ok(conSuyo.restante === 500,
    'CONTROL: y descuenta lo transcurrido — la maquinaria sigue entera', conSuyo.restante);
  ok(conSuyo.valor.discrepa === 1200,
    'CONTROL: y sigue diciendo en cuánto discrepa de lo nuestro', conSuyo.valor.discrepa);

  /**
   * Y el control por el otro lado: «no hay nada» y «hay algo y no lo enseño»
   * tienen que verse distintos, o quien pinta no puede decir «van N
   * observaciones» en un caso y «esperando su primera muerte» en el otro.
   */
  const vacio = estadoCrono({ nombre: 'X' }, { ahora: 2000, ultimaMuerte: 1000 });
  ok(vacio.valor.retenido === false && vacio.valor.otro === null,
    'sin observaciones, no se retiene nada — y se distingue');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
