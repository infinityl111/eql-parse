/**
 * El guion de una pelea: sus sucesos, segundo a segundo, para reproducirla.
 *
 * DE DÓNDE SALE. De las líneas del registro, releídas y parseadas al vuelo. No
 * de la pelea guardada: allí todo es agregado —el crítico es un contador por
 * habilidad, el contraataque un contador por combatiente— y un flotante sacado
 * de un contador estaría colocado a ojo. Medido sobre un registro real, las
 * 410 peleas del histórico siguen dentro del fichero, así que releer sale
 * gratis y da lo que agregar destruye.
 *
 * LO QUE SE PUEDE AFIRMAR Y LO QUE NO, que es lo que gobierna la forma:
 *
 *   EL ORDEN, SÍ. Dentro de un mismo segundo las líneas están en el orden en
 *   que ocurrieron: el juego escribe según pasa. No es una suposición, se
 *   comprobó con una predicción que podía fallar —el golpe que mata tiene que
 *   aparecer antes que la línea de muerte— y salió 952 de 952, sin una sola
 *   excepción. Por eso cada suceso lleva su `orden` y la reproducción lo
 *   respeta.
 *
 *   EL ESPACIADO, NO. El registro sella al segundo y no hay nada por debajo.
 *   Dos golpes del mismo segundo pudieron ir seguidos o casi un segundo
 *   separados, y eso no está escrito en ninguna parte. Así que los sucesos de
 *   un segundo salen A LA VEZ, escalonados en posición y no en tiempo:
 *   separarlos en el tiempo sería dibujar un dato que no existe.
 *
 * LOS EVITADOS CUENTAN COMO SUCESO, y no es un detalle: de 24.638 intentos
 * contra ti, 11.471 no entraron — el 46,6%. Una reproducción donde todo conecta
 * no se parece a la pelea, se parece a otro juego.
 */

/** Lo que se dibuja. Todo lo demás del registro no llega aquí. */
const DAÑO = new Set(['melee', 'spell', 'dot', 'ds']);
const ESTADOS = new Set(['stun', 'stagger', 'interrupt', 'knockdown', 'proc',
  'resist', 'resist_by_you', 'absorb']);

/**
 * @param {object} f      la pelea guardada: de ahí salen los actores y su bando
 * @param {object[]} lineas  `{t, texto}` tal y como las devuelve `registro.js`
 * @param {object} Parser la clase, inyectada para no atar este módulo a ella
 * @param {string} self
 */
export function guion(f, lineas, Parser, self = null) {
  // EL INSTANTE EN QUE EMPEZÓ, y hay que buscarlo en dos sitios.
  //
  // `at` en milisegundos vive en el ÍNDICE, que es lo que ve la lista de
  // peleas; el registro completo guarda `start` en segundos epoch. Según por
  // dónde llegue la pelea, trae uno o el otro. Sin este respaldo, `inicio`
  // quedaba en cero y todos los segundos salían del rango: 527 líneas leídas y
  // cero sucesos, sin un solo error por el camino.
  const inicio = f?.at ? Math.round(f.at / 1000) : Math.round(f?.start ?? 0);
  const dur = Math.max(1, Math.round(f?.duration ?? 0));
  if (!inicio) return { inicio: 0, duracion: dur, actores: [], segundos: [], sucesos: 0 };

  // EL REPARTO SALE DE LA PELEA, NO DEL REGISTRO. Quién es de tu bando ya se
  // decidió al guardarla, con las reglas de siempre —encantados, mascotas,
  // compañeros declarados—. Volver a deducirlo aquí podría dar otra respuesta
  // que la de la tabla de al lado, y dos respuestas distintas para la misma
  // pregunta es peor que una imperfecta.
  const actores = new Map();
  for (const r of f?.rows ?? []) {
    actores.set(r.name, {
      nombre: r.name,
      /**
       * TRES BANDOS Y NO DOS, igual que en la tabla de combate.
       *
       * Aquí ponía `side === 'enemy' ? enemigo : aliado`, y eso mete a los SIN
       * IDENTIFICAR en tu lado. El registro de EQL no dice quién va en tu grupo,
       * así que «pegó a tus enemigos» es todo lo que consta de ellos — la tabla
       * los separa por eso mismo y la reproducción no puede afirmar más.
       *
       * Se vio en una pelea de 17 combatientes: «a shadowknight», «Ice boned
       * skeleton» y «Kahaptra Z'Taj» aparecían de tu lado. Ninguno es tuyo.
       */
      lado: r.side === 'enemy' ? 'enemigo' : (r.unidentified ? 'sinBando' : 'aliado'),
      esTu: r.name === self,
      mascota: !!r.pet || !!r.petOf,
      danoTotal: r.damage ?? 0,
    });
  }
  const conocido = (n) => n && actores.has(n);

  // El parser se alimenta con el nombre para que «You» se resuelva a ti. No
  // arrastra el historial de mascotas de la sesión —esto es una pelea suelta—
  // así que quién es mascota se toma del reparto de arriba, que sí lo sabe.
  const p = new Parser({ self });
  const porSegundo = new Map();
  let orden = 0;
  /**
   * Los casteos abiertos, para poder cerrarlos con su desenlace.
   *
   * La barra necesita dos cosas distintas: cuánto SUELE durar ese hechizo —eso
   * viene de fuera, medido sobre toda la sesión— y cuánto duró ESTA vez, que
   * es lo que dice esta pelea. Cuando las dos no coinciden, manda la segunda y
   * la diferencia se enseña: si algo lo retrasó, eso es información.
   */
  const castOpen = new Map();
  const cierraCast = (quien, que, seg, como) => {
    const k = `${quien}|${que}`;
    const c = castOpen.get(k);
    if (!c) return;
    castOpen.delete(k);
    c.ref.duro = Math.max(0, seg - c.s);
    c.ref.desenlace = como;
  };

  const mete = (s, suceso) => {
    if (s < 0 || s > dur) return;
    if (!porSegundo.has(s)) porSegundo.set(s, []);
    porSegundo.get(s).push({ ...suceso, orden: orden++ });
  };

  for (const l of lineas ?? []) {
    if (l.t === null || l.t === undefined) continue;
    const ev = p.parseAt(l.t, l.texto, orden);
    if (!ev) continue;
    const s = Math.round(l.t) - inicio;

    if (DAÑO.has(ev.kind) && ev.amount > 0) {
      // Pegarte a ti mismo no es pegar: se dibuja sobre ti y no como una
      // flecha. Es la misma regla que el motor aplica al contar.
      if (ev.ability) cierraCast(ev.source, ev.ability, s, 'entra');
      mete(s, {
        tipo: 'daño', origen: ev.source, destino: ev.target,
        cantidad: ev.amount, escuela: ev.damageType ?? ev.school ?? 'other',
        propio: ev.selfInflicted === true,
        crit: !!ev.crit, contra: !!ev.riposte, frenesi: !!ev.flurry,
        habilidad: ev.ability ?? ev.verb ?? null,
      });
    } else if (ev.kind === 'miss') {
      mete(s, {
        tipo: 'evitado', origen: ev.source, destino: ev.target,
        motivo: ev.reason ?? 'fallo',
      });
    } else if (ev.kind === 'heal' && ev.amount > 0) {
      if (ev.ability) cierraCast(ev.source, ev.ability, s, 'entra');
      mete(s, {
        tipo: 'cura', origen: ev.source, destino: ev.target,
        cantidad: ev.amount, habilidad: ev.ability ?? null,
      });
    } else if (ev.kind === 'cast' && ev.ability) {
      mete(s, { tipo: 'lanza', origen: ev.source, habilidad: ev.ability, cat: ev.castCat ?? null });
      // Se anota abierto para poder cerrarlo con lo que pase después: así la
      // barra sabe cuánto duró ESTA vez, y no sólo cuánto suele durar.
      castOpen.set(`${ev.source}|${ev.ability}`, { s, ref: porSegundo.get(s).at(-1) });
    } else if (ev.kind === 'death' && ev.victim) {
      mete(s, { tipo: 'muere', destino: ev.victim, origen: ev.killer ?? null });
    } else if (ev.kind === 'interrupt' && ev.ability) {
      cierraCast(ev.source, ev.ability, s, 'interrumpido');
      mete(s, { tipo: 'estado', clase: 'interrupt', destino: ev.source, origen: ev.source, habilidad: ev.ability });
    } else if (ESTADOS.has(ev.kind)) {
      mete(s, {
        tipo: 'estado', clase: ev.kind,
        destino: ev.target ?? ev.source, origen: ev.source ?? null,
        cantidad: ev.amount ?? 0, habilidad: ev.ability ?? null,
      });
    }
  }

  // Actores que salen en el registro y no estaban en la pelea guardada: pasa
  // con quien apareció y no llegó a hacer ni recibir daño. Entran con su bando
  // sin decidir en vez de desaparecer, y la interfaz los pinta aparte.
  for (const lista of porSegundo.values()) {
    for (const x of lista) {
      for (const n of [x.origen, x.destino]) {
        if (n && !conocido(n)) {
          actores.set(n, { nombre: n, lado: 'sinBando', esTu: false, mascota: false, danoTotal: 0 });
        }
      }
    }
  }

  /**
   * CUÁNDO ENTRA CADA UNO, para que no salgan todos desde el segundo cero.
   *
   * Si el segundo enemigo no aparece hasta el 18, enseñarlo desde el principio
   * cuenta una pelea que no fue: se ve un dos contra dos donde hubo un uno
   * contra uno durante dieciocho segundos.
   *
   * ENTRAR NO ES PEGAR, y la diferencia importa. Un enemigo enraizado, dormido
   * o aturdido está en la pelea aunque no haga nada: se le sigue pegando, así
   * que aparece como destino y cuenta como presente. Lo que marca la entrada es
   * la primera vez que el registro lo nombra, haga lo que haga.
   *
   * Es el instante medido, ni un segundo antes. Adelantarlo «para que se vea
   * venir» sería dibujar lo que no consta.
   */
  for (let seg = 0; seg <= dur; seg++) {
    for (const x of porSegundo.get(seg) ?? []) {
      for (const n of [x.origen, x.destino]) {
        const a = n && actores.get(n);
        if (a && a.desde === undefined) a.desde = seg;
      }
    }
  }
  // Quien no sale en ninguna línea no llegó a entrar. Se queda fuera del
  // escenario en vez de aparecer de pie sin hacer nada toda la pelea.
  for (const a of actores.values()) if (a.desde === undefined) a.desde = null;

  return {
    inicio, duracion: dur,
    actores: [...actores.values()],
    // Un array indexado por segundo: la reproducción va a pedirlos en orden y
    // saltar a uno cualquiera, y para las dos cosas un array es lo natural.
    segundos: Array.from({ length: dur + 1 }, (_, s) => porSegundo.get(s) ?? []),
    sucesos: orden,
  };
}

/**
 * Los sucesos de un segundo, agrupados para que quepan.
 *
 * POR QUÉ HACE FALTA, con la medida delante. Sobre la misma figura y el mismo
 * segundo caen 3 sucesos de mediana, 7 en el p90 y hasta 39 en el peor caso; el
 * 6% de los segundos-figura traen nueve o más. A tiempo real eso es lo que se
 * ve en el juego y está bien. Acelerado no: a ×5 un segundo dura 200 ms, así
 * que los flotantes de cuatro o cinco segundos están vivos a la vez y lo que
 * queda es una mancha.
 *
 * Agrupando por figura y tipo, la mediana baja a 1 y el p90 a 3 — el 58% de los
 * casos queda en un solo flotante.
 *
 * Y NO SE PIERDE NADA MEDIDO: el flotante agrupado lleva el total y el `×n`, así
 * que el número de golpes sigue estando. Los importes sueltos siguen a un clic:
 * a ×1 y en pausa se ven uno a uno.
 */
export function agrupar(sucesos, agrupado) {
  if (!agrupado) return sucesos;
  const salida = [];
  const idx = new Map();
  for (const x of sucesos) {
    // Lo que ocurre una vez no se agrupa nunca: una muerte es una muerte.
    if (x.tipo === 'muere' || x.tipo === 'lanza' || x.tipo === 'estado') { salida.push(x); continue; }
    const clave = `${x.tipo}|${x.destino ?? ''}|${x.escuela ?? x.motivo ?? ''}`;
    const y = idx.get(clave);
    if (!y) {
      const nuevo = { ...x, veces: 1 };
      idx.set(clave, nuevo);
      salida.push(nuevo);
      continue;
    }
    y.veces++;
    y.cantidad = (y.cantidad ?? 0) + (x.cantidad ?? 0);
    // Las marcas se conservan si alguno la traía: que entre los tres golpes
    // hubiera un crítico es un dato, y perderlo al juntar sería tirarlo.
    y.crit = y.crit || x.crit;
    y.contra = y.contra || x.contra;
    y.frenesi = y.frenesi || x.frenesi;
    // Con varios orígenes el flotante deja de ser de uno solo, y se dice.
    if (y.origen !== x.origen) y.origen = null;
  }
  return salida;
}
