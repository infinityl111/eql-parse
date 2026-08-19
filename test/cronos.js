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
import { valorDe, estadoCrono, avisoDeVarios, debeReiniciar, ESTADO, PERIODOS_SOSPECHA } from '../src/cronos.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── 1. Las tres fuentes, y cuál manda ──────────────────────────────────────
console.log('\nlas tres fuentes del valor');
{
  ok(valorDe({ medido: 265 }).fuente === 'medido', 'la repetición propia se rotula «medido»');
  ok(valorDe({ heredado: 484 }).fuente === 'heredado', 'el periodo de la zona, «heredado»');
  ok(valorDe({ manual: 300 }).fuente === 'manual', 'y lo que escribe el jugador, «manual»');

  ok(valorDe({ medido: 265, heredado: 484 }).fuente === 'medido',
    'entre medido y heredado gana el medido: es suyo, no de su vecindario');

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
  const ctx = { ahora: 1000, ultimaMuerte: 800, medido: 300 };
  const r = estadoCrono({ nombre: 'X' }, ctx);
  ok(r.estado === ESTADO.CONTANDO, 'está contando');
  ok(r.transcurrido === 200, 'han pasado 200 s desde su muerte', r.transcurrido);
  ok(r.restante === 100, 'así que quedan 100, no 300', r.restante);

  // Un cronómetro daría 300. Ésta es la diferencia, y es la razón de la función.
  ok(r.restante !== r.valor.segundos, 'no es un cronómetro: no empieza por el valor entero');
}

// ── 3. Sin ninguna muerte suya no es CERO: es que no ha empezado ───────────
console.log('\nsin ninguna muerte conocida');
{
  const r = estadoCrono({ nombre: 'X' }, { ahora: 1000, ultimaMuerte: null, medido: 300 });
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
  const justo = estadoCrono({ nombre: 'X' }, { ahora: 1100, ultimaMuerte: 800, medido: 300 });
  ok(justo.estado === ESTADO.A_CERO, 'justo al cumplirse, a cero', justo.estado);
  ok(justo.restante === 0, 'y el restante es 0, no negativo', justo.restante);

  const pasado = estadoCrono({ nombre: 'X' }, { ahora: 1250, ultimaMuerte: 800, medido: 300 });
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
  const casi = estadoCrono({ nombre: 'X' }, { ahora: 1100 + PERIODOS_SOSPECHA * v - 1, ultimaMuerte: 800, medido: v });
  ok(casi.estado === ESTADO.A_CERO, `con menos de ${PERIODOS_SOSPECHA} periodos a cero, no se sospecha`, casi.estado);
  ok(casi.aviso === null, 'y no hay aviso');

  const mucho = estadoCrono({ nombre: 'X' }, { ahora: 1100 + PERIODOS_SOSPECHA * v, ultimaMuerte: 800, medido: v });
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
  const corto = estadoCrono({ nombre: 'X' }, { ahora: t, ultimaMuerte: 800, medido: 100 });
  const largo = estadoCrono({ nombre: 'X' }, { ahora: t, ultimaMuerte: 800, medido: 600 });
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

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
