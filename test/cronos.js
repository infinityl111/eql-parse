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
  precisionDe, ESTADO, PERIODOS_SOSPECHA, PRECISION, claveCrono, mismaClave, ordenCola,
  candidatosDe } from '../src/cronos.js';
import * as V2 from '../src/cronos.js';

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

  /**
   * El MODO entra en la clave, y hay que decir para qué NO sirve: escribí que
   * arreglaba una colisión entre `Solo` y `Grupo`, y al comprobarlo resultó
   * falso. `parseZone` deja el modo DENTRO de `base` —devuelve
   * `base: "Nagafen's Lair Solo"`, `mode: null`—, así que esas dos copias ya
   * tenían claves distintas.
   *
   * El campo se queda como guarda para el día que `parseZone` lo separe. Hoy
   * es siempre null. Esta prueba fija que la clave LO MIRARÍA, no que hoy
   * cambie nada.
   */
  ok(!mismaClave({ ...guk, mode: 'Solo' }, { ...guk, mode: 'Grupo' }),
    'si el modo llega, la clave lo separa');
  ok(!mismaClave(guk, { ...guk, mode: 'Solo' }),
    'y sin modo no es lo mismo que con modo');

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

console.log('\nla cola: el que antes vuelve arriba, y los que ya están, encima');
{
  /**
   * LO PIDIÓ CAMPEÓN CON SUS PALABRAS, y es lo que hace que la sección sirva:
   * un crono correcto en el sitio equivocado de la lista no se lee. Se decidió
   * y NO ESTABA EN EL CÓDIGO — `renderCronos` recorría la lista en orden de
   * alta—, y no se vio porque nadie había mirado la pantalla.
   */
  const f = (nombre, estado, restante) => ({ crono: { nombre }, estado: { estado, restante } });
  const nombres = (l) => ordenCola(l).map((x) => x.crono.nombre).join(' ');

  const mezcla = [
    f('cuenta-largo', ESTADO.CONTANDO, 300),
    f('sin-valor', ESTADO.SIN_MUERTE, null),
    f('a-cero', ESTADO.A_CERO, -10),
    f('cuenta-corto', ESTADO.CONTANDO, 12),
    f('cero-viejo', ESTADO.A_CERO_LARGO, -9000),
  ];
  ok(nombres(mezcla) === 'a-cero cero-viejo cuenta-corto cuenta-largo sin-valor',
    'los tres grupos en su sitio y ordenados dentro', nombres(mezcla));

  /**
   * Dentro del primer grupo, EL MÁS RECIENTE PRIMERO. Cuanto más lleva uno a
   * cero, más probable es que ya se lo haya llevado otro o que no estemos
   * viendo su línea de muerte. Así los sospechosos se hunden solos, sin regla
   * aparte.
   */
  const ceros = [f('lleva-mucho', ESTADO.A_CERO_LARGO, -5000), f('acaba-de', ESTADO.A_CERO, -3)];
  ok(nombres(ceros) === 'acaba-de lleva-mucho',
    'entre los que están a cero, el que acaba de cumplirse va primero', nombres(ceros));

  /**
   * EL DESEMPATE ES EL NOMBRE, y no es cosmético: esto repinta cada segundo, y
   * dos cronos con el mismo restante que se intercambian en cada repintado
   * hacen imposible pulsar su botón.
   */
  const iguales = [f('zeta', ESTADO.CONTANDO, 60), f('alfa', ESTADO.CONTANDO, 60)];
  ok(nombres(iguales) === 'alfa zeta', 'con el mismo restante manda el nombre', nombres(iguales));
  ok(nombres(iguales) === nombres(iguales.slice().reverse()),
    'y el orden no depende de cómo vinieran: no baila entre repintados');

  /**
   * CONTROL POSITIVO. Sin esto, todo lo de arriba pasaría con un `ordenCola`
   * que devolviera la lista tal cual, si la entrada ya viniera ordenada. Se le
   * da la entrada EXACTAMENTE AL REVÉS y tiene que darle la vuelta entera.
   */
  const alReves = mezcla.slice().reverse();
  ok(nombres(alReves) === 'a-cero cero-viejo cuenta-corto cuenta-largo sin-valor',
    'CONTROL: con la entrada al revés, la salida es la misma — ordena de verdad',
    nombres(alReves));

  // Y no destruye la entrada: `renderCronos` la reusa.
  const antes = mezcla.map((x) => x.crono.nombre).join(' ');
  ordenCola(mezcla);
  ok(mezcla.map((x) => x.crono.nombre).join(' ') === antes,
    'CONTROL: no reordena la lista original');

  ok(ordenCola([]).length === 0, 'y sin cronos no revienta');
}

console.log('\nel aviso de varios: la rama fuerte ya se puede disparar');
{
  /**
   * Se llamaba SIEMPRE con `individuosVistos = null`, así que la rama fuerte era
   * inalcanzable y sólo quedaba la deducida por número de muertes. El dato lo da
   * ahora `engine.multiplicidadDe`: dos muertes del mismo nombre en la MISMA
   * pelea son dos bichos, porque dentro de una pelea un muerto no vuelve.
   *
   * Y midiéndolo resultó MEJOR que la deducida, no un adorno: de 709 claves con
   * muertes, 200 tienen multiplicidad demostrada, y 117 de ellas no llegan a las
   * 10 muertes que dispara la débil. Se perdían.
   */
  ok(avisoDeVarios(2, 0) === 'varios-a-la-vez',
    'con dos vistos a la vez el aviso es el fuerte, y no hace falta ni una muerte más');
  ok(avisoDeVarios(1, 0) === null, 'con uno solo visto, no se avisa de nada');

  /**
   * CERO NO ES «HAY UNO». Es «no se ha demostrado que haya más», y por eso cae a
   * la rama deducida en vez de afirmar que está solo.
   */
  ok(avisoDeVarios(0, 12) === 'probablemente-varios',
    'sin multiplicidad demostrada sigue valiendo la deducida por muertes');
  ok(avisoDeVarios(0, 3) === null, 'y con pocas muertes, ninguna de las dos');

  /**
   * CONTROL: la fuerte MANDA sobre la débil. Si no, un bicho con dos vistos y
   * cincuenta muertes daría el aviso deducido teniendo el demostrado delante,
   * que es enseñar la prueba peor habiendo la buena.
   */
  ok(avisoDeVarios(2, 50) === 'varios-a-la-vez',
    'CONTROL: con las dos cosas manda la demostrada, no la deducida');
}

console.log('\nel visto dice DE DÓNDE sale');
{
  /**
   * Una línea del registro y una pelea guardada del almacén no son la misma
   * afirmación. `lecturaDelVisto` saca `kind` con el dato para que el rótulo
   * pueda decir cuál es: sin él, el respaldo del almacén salía rotulado «en una
   * línea de combate», que es una procedencia prestada.
   */
  const l1 = V2.lecturaDelVisto({ visto: { t: 990, kind: 'melee' }, ahora: 1000 });
  ok(l1.esta === true && l1.kind === 'melee', 'una línea reciente: está ahí, y dice de qué línea',
    JSON.stringify(l1));
  const l2 = V2.lecturaDelVisto({ visto: { t: 100, kind: 'pelea' }, ahora: 1000 });
  ok(l2.esta === false && l2.kind === 'pelea', 'y una pelea vieja se marca como pelea',
    JSON.stringify(l2));
  const l3 = V2.lecturaDelVisto({ ultimaMuerte: 100, ahora: 1000 });
  ok(l3 && l3.kind === null, 'CONTROL: sin visto, no se inventa procedencia',
    'se cuenta desde su última muerte y `kind` va en null');
}

console.log('\nlos candidatos del histórico entero');
{
  /**
   * Resúmenes como los del índice. La clave de un candidato es la MISMA que
   * consultan `ultimaMuerte` y las otras cuatro —nombre + zona base +
   * dificultad—, y por eso se construye con los campos del resumen tal cual.
   */
  const pelea = (at, base, diff, kills) => ({ at, zoneBase: base, diff, diffTag: null, kills });
  const D = 86400e3;
  const T = 1787000000000;
  const peleas = [
    pelea(T, 'Befallen', 2, ['a greater skeleton', 'a greater skeleton']),
    pelea(T + D, 'Befallen', 2, ['a greater skeleton']),
    pelea(T + 2 * D, 'The Ruins of Old Guk', 3, ['Ancient Croaker', "Vroth`s pet"]),
    pelea(T + 3 * D, 'Befallen', 3, ['a greater skeleton']),
    pelea(T + 4 * D, 'Befallen', 2, []),
  ];

  const l = candidatosDe(peleas);
  ok(l.length === 3, 'una entrada por CLAVE, no por nombre ni por pelea',
    l.map((c) => `${c.nombre}·D${c.diff}`).join(' '));
  ok(l[0].nombre === 'a greater skeleton' && l[0].diff === 3,
    'el orden es el de la última vez que lo mataste', l.map((c) => c.nombre).join(' '));

  const bef = l.find((c) => c.base === 'Befallen' && c.diff === 2);
  ok(bef.muertes === 3 && bef.peleas === 2,
    'las muertes y las peleas se cuentan por separado',
    'dos muertes en un mismo combate son dos individuos, no dos reapariciones');
  ok(bef.ultimaMs === T + D, 'la última es la más reciente de SU clave',
    'y es cuándo empezó la pelea, no el instante de la muerte: por eso se enseña el día');

  /**
   * LA MISMA ZONA EN DOS DIFICULTADES SON DOS CANDIDATOS, por lo mismo que son
   * dos cronos: el periodo es de la copia de la zona, no del bicho.
   */
  ok(l.filter((c) => c.nombre === 'a greater skeleton').length === 2,
    'la dificultad parte la clave');

  // Una mascota no reaparece por temporizador: la invoca su dueño.
  ok(!l.some((c) => / pet$/i.test(c.nombre)), 'las mascotas se quedan fuera');
  ok(peleas.some((p) => (p.kills ?? []).some((k) => / pet$/i.test(k))),
    'CONTROL: y había una en la entrada — si no, el de arriba no diría nada');

  // Los ya abiertos vienen marcados, y la marca es por clave entera.
  const marcada = candidatosDe(peleas, {
    abiertos: [{ nombre: 'a greater skeleton', base: 'Befallen', diff: 2, mode: null }],
  });
  ok(marcada.find((c) => c.base === 'Befallen' && c.diff === 2).ya === true, 'el abierto se marca');
  ok(marcada.find((c) => c.base === 'Befallen' && c.diff === 3).ya === false,
    'CONTROL: y el de la otra dificultad no, que es otra clave');

  ok(candidatosDe([]).length === 0, 'sin histórico, lista vacía y sin reventar');
  ok(candidatosDe([pelea(T, 'Befallen', 2, [])]).length === 0,
    'y una pelea sin muertes no produce candidato', 'no hay desde cuándo contar');

  /**
   * `kills` VIAJA DE DOS FORMAS según la versión que guardó la pelea: nombres
   * sueltos o `{ victim }`. Las dos se leen igual aquí que en el motor.
   */
  const conVictim = candidatosDe([{ at: T, zoneBase: 'Befallen', diff: 2, kills: [{ victim: 'a greater skeleton' }] }]);
  ok(conVictim.length === 1 && conVictim[0].nombre === 'a greater skeleton',
    'la forma `{ victim }` se entiende igual');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
