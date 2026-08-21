// El suelo de individuos por nombre, compartido con el «×N» del título.
import { suelosDe } from './suelo.js';
import { esRelevante } from './relevancia.js';
// ¿Son el mismo nombre? Una pregunta, un sitio. Ver `src/nombres.js`.
import { claveDeNombre } from './nombres.js';
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

/**
 * La clave de un nombre: sin la mayúscula inicial. EQ escribe «A shin ghoul
 * knight has been slain» al abrir frase y «a shin ghoul knight» a mitad, y las
 * dos formas conviven en la misma pelea. Mismo plegado que `src/suelo.js`.
 */
const plegar = claveDeNombre;

/** Lo que se dibuja. Todo lo demás del registro no llega aquí. */
const DAÑO = new Set(['melee', 'spell', 'dot', 'ds']);
/**
 * Lo que se emite como cambio de estado al guion del reproductor.
 *
 * ESTO SÓLO DECIDE QUÉ SE EMITE. No toca la máquina del encanto —`charmed`,
 * `everCharmed`, `#deQuien`, `charmAmbiguo`, que viven en `parser.js` y
 * `encounter.js`— ni el bando de nadie: ningún otro fichero lee este conjunto.
 * Comprobado antes de tocarlo, y por eso el encanto puede entrar aquí sin que
 * cambie una sola atribución de daño.
 *
 * `charm_on` y `charm_off` entran en la 1.13.0 para la pista de estados. Un
 * encanto tuyo explica la curva más que ningún otro suceso —es de dónde sale la
 * mitad del daño— y con el filtro anterior no habría aparecido ninguno: la
 * línea lleva el bicho de destino y no a ti.
 */
const ESTADOS = new Set(['stun', 'stagger', 'interrupt', 'knockdown', 'proc',
  'resist', 'resist_by_you', 'absorb', 'charm_on', 'charm_off', 'survival', 'root',
  // `control` entra por lo mismo que el encanto: son los segundos en los que tu
  // personaje no era tuyo, y explican la curva mejor que casi nada. El registro
  // los escribe por los dos extremos —«You lose control of yourself!» y «You
  // have control of yourself again.»— así que llega emparejado como el
  // aturdimiento, con su `on`, y la pista puede pintar el tramo entero en vez
  // de dos marcas sueltas. Ver `sinControl` en `src/encounter.js`.
  'control']);

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

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * QUÉ ES DE ESTA PELEA: SE PREGUNTA, NO SE DECIDE AQUÍ.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Estas líneas vienen de releer el registro ENTRE EL INICIO Y EL FIN de la
   * pelea, así que la ventana trae también lo que pasaba al lado: un
   * desconocido matando bichos a diez metros sale en los mismos segundos.
   *
   * Este fichero ya decía, ciento treinta líneas más arriba, que «el reparto
   * sale de la pelea, no del registro» y que «dos respuestas distintas para la
   * misma pregunta es peor que una imperfecta». Y luego daba la segunda
   * respuesta: metía como actor a cualquiera que apareciera en la ventana.
   *
   * MEDIDO CORRIENDO LOS DOS: este fichero antes del arreglo y después, sobre
   * el mismo almacén (1.493 peleas con combatientes) y el mismo registro, el 16
   * de agosto de 2026. La cifra es de FIGURAS DIBUJADAS, no de nombres en la
   * ventana — ver el detalle y la cifra mala que sustituye en `relevancia.js`:
   *
   *                                          antes          después
   *     peleas con alguna figura AJENA      446 (29,9 %)    190 (12,7 %)
   *     ...con combate ENTRE dos ajenos      49 ( 3,3 %)      0 (0,0 %)
   *
   * La peor —11 de agosto, 19:34:32 hora local— es una pelea de 99 s con TRES
   * combatientes de verdad. El reproductor dibujaba TRECE figuras: diez ajenas,
   * con 468 golpes entre ellas dentro. Hoy dibuja tres.
   *
   * LA REGLA, que es la del componente conexo aplicada al dibujo:
   *
   *     QUIEN SÓLO INTERACTÚA CON QUIEN NO ESTÁ EN LA PELEA, NO ESTÁ EN LA PELEA.
   *
   * Y SE CONSERVA la categoría «apareció y no hizo ni recibió daño» —un
   * sanador, alguien que sólo falló—: lo que se le exige no es haber hecho
   * daño, es haber tocado a ALGÚN MIEMBRO de la pelea.
   *
   * El reparto ya está decidido, así que se le pasa entero a la guarda como
   * respuesta cerrada. El motor le pasa sus conjuntos vivos. Misma pregunta,
   * la información que cada uno tiene.
   */
  const reparto = new Set(actores.keys());
  const mios = new Set([...actores.values()].filter((a) => a.esTu || a.mascota).map((a) => a.nombre));
  if (self) mios.add(self);
  const ctx = { mios, objetivos: reparto, enPelea: reparto, companions: new Set() };

  for (const l of lineas ?? []) {
    if (l.t === null || l.t === undefined) continue;
    const ev = p.parseAt(l.t, l.texto, orden);
    if (!ev) continue;
    // Lo que no es de esta pelea no llega ni a existir en el guion.
    if (!esRelevante(ev, ctx)) continue;
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
      /**
       * SE ANOTA ABIERTO PARA PODER CERRARLO con lo que pase después: así la
       * barra sabe cuánto duró ESTA vez, y no sólo cuánto suele durar.
       *
       * ── Y SÓLO SI `mete` LO HA METIDO ────────────────────────────────
       *
       * `mete` descarta lo que cae FUERA de la pelea —`s < 0` o `s > dur`—,
       * así que en esas líneas `porSegundo.get(s)` no existe y esto reventaba
       * con `Cannot read properties of undefined (reading 'at')`. La pelea
       * entera se quedaba sin pista, y el reproductor sin nada que enseñar.
       *
       * Hoy no es alcanzable desde la aplicación —pide el tramo exacto,
       * `[inicio, inicio+duración]`— pero la guarda no estaba y una sonda
       * tropezó con ella a la primera pidiendo dos segundos de margen. Una
       * función que revienta según qué ventana le den no puede depender de
       * que su único llamador de hoy la pida bien.
       *
       * Lo que se hace con lo de fuera es NADA, que es lo mismo que hace
       * `mete`: ni se dibuja ni se abre. Ver `test/reproduccion.js`.
       */
      const ref = porSegundo.get(s)?.at(-1);
      if (ref) castOpen.set(`${ev.source}|${ev.ability}`, { s, ref });
    } else if (ev.kind === 'death' && ev.victim) {
      mete(s, { tipo: 'muere', destino: ev.victim, origen: ev.killer ?? null });
    } else if (ev.kind === 'interrupt' && ev.ability) {
      cierraCast(ev.source, ev.ability, s, 'interrumpido');
      mete(s, { tipo: 'estado', clase: 'interrupt', destino: ev.source, origen: ev.source, habilidad: ev.ability });
    } else if (ESTADOS.has(ev.kind)) {
      /**
       * DOS COSAS QUE SE PERDÍAN AQUÍ, Y LAS DOS SON LA MISMA FAMILIA.
       *
       * `on` — un aturdimiento son DOS líneas, «You are stunned!» y «You are no
       * longer stunned.», y las dos salían de aquí idénticas. Quien las dibuje
       * pinta dos marcas donde hay un estado, y encima tira la duración que el
       * registro sí da: emparejan al 100% con 2 s de mediana. Medido: 2.853
       * sucesos `stun` son 1.429 aturdimientos.
       *
       * EL SUJETO CUANDO LA LÍNEA NO LO NOMBRA. «You appear.» o «You are no
       * longer feigning death» no traen `target` ni `source`, así que `destino`
       * salía indefinido y cualquier filtro por «¿es mío?» los descartaba —
       * `survival` no se dibujaba nunca pese a estar en la lista—. La línea SÍ
       * lo dice, con la primera palabra, y es lo que se mira. Es la misma
       * trampa de siempre con otro traje: identificar por algo que puede NO
       * ESTAR.
       */
      /**
       * ── ESTO SE ROMPERÁ CUANDO… ─────────────────────────────────────────
       *
       * NO ESTÁ ARREGLADO A PROPÓSITO. Es la decimotercera familia —«toda forma
       * en primera persona tiene una gemela en tercera»— y hoy NO expone nada,
       * porque las familias de estado de `src/patterns.js` están todas ancladas
       * en `You`/`Your` y una línea de estado de OTRO no llega a parsearse: no
       * hay evento, así que no hay `destino` que deducir mal.
       *
       * SE ROMPERÁ EL DÍA QUE SE AÑADA LA PRIMERA REGLA DE ESTADO EN TERCERA
       * PERSONA. En ese momento llegará aquí un `ev` de `stun`, `root` o
       * `survival` cuya línea empieza por un NOMBRE, este test dará `false`, y
       * si además el evento viene sin `target` ni `source` —que es justo el
       * caso para el que se escribió esta línea— el estado se anotará con
       * `destino: null`. No dará error: dará una marca en la pista sin dueño,
       * que es un dato plausible y silencioso.
       *
       * Y HAY UNA SEGUNDA PUERTA, más estrecha: si algún día `self` puede ser
       * `null` —una sesión sin personaje resuelto— esto ya devuelve `null` hoy
       * y el resultado es el mismo.
       *
       * QUÉ LO ARREGLARÁ, para no tener que volver a pensarlo: el sujeto sale
       * de la PRIMERA PALABRA de la línea, no de que esa palabra sea `You`.
       * Con `You` se resuelve a `self` y con un nombre se resuelve al nombre.
       * No se hace hoy porque no hay ni una línea que lo ejercite y un arreglo
       * sin caso que lo pruebe es una suposición con forma de código.
       *
       * Un peligro con su disparador escrito vale más que un arreglo
       * especulativo. Éste es el disparador.
       */
      const tuyoPorLaFrase = /^(?:You|Your)\b/.test(l.texto ?? '') ? self : null;
      mete(s, {
        tipo: 'estado', clase: ev.kind,
        destino: ev.target ?? ev.source ?? tuyoPorLaFrase,
        origen: ev.source ?? null,
        on: ev.on ?? null,
        // Una PRUEBA de estado no abre ni cierra: atestigua que estaba puesto.
        // Con ella se recupera el principio que el juego a veces no escribe.
        // Ver `tramosDePista` en `ui/reproduccion.js`.
        prueba: ev.prueba === true,
        cantidad: ev.amount ?? 0, habilidad: ev.ability ?? null,
      });
    }
  }

  // Actores que salen en el registro y no estaban en la pelea guardada: quien
  // apareció y no llegó a hacer ni recibir daño —un sanador, alguien que sólo
  // falló—. Entran con su bando sin decidir en vez de desaparecer.
  //
  // AHORA SÓLO PUEDEN LLEGAR AQUÍ LOS QUE TOCARON A ALGUIEN DE LA PELEA: el
  // filtro de arriba ya descartó al resto. Antes entraba cualquiera que saliera
  // en la ventana de tiempo, y eso metía peleas ajenas enteras.
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

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CUÁNTAS FIGURAS LLEVA CADA NOMBRE, Y CUÁNDO SE APAGA CADA UNA
   * ═══════════════════════════════════════════════════════════════════════
   *
   * EL FALLO QUE ARREGLA, con sus palabras: «se ve morir a uno y se le sigue
   * pegando al cadáver». Había UNA figura por nombre, así que con dos «a
   * loathling lich» la primera muerte apagaba la figura y el segundo seguía
   * lanzando `Tishan's Clash` sobre un dibujo gris. El dato para hacerlo bien ya
   * estaba en pantalla —el título de la pelea dice «×2»— y la escena no lo usaba.
   *
   * N SALE DEL SUELO MEDIDO, no de una estimación: muertes del nombre más una si
   * hay actividad suya DESPUÉS de la última. Y sale de `src/suelo.js`, que es el
   * mismo módulo que cuenta el «×N» del título — no una copia.
   *
   * `muertes` viaja con los instantes porque es lo que permite apagar UNA por
   * cada muerte en su segundo, en vez de apagarlas todas a la vez.
   *
   * CUÁL SE APAGA ES ARBITRARIO y el reproductor lo dice: el registro afirma que
   * cayó uno de ellos, no cuál. Ver `rp.fig.cualCae`.
   */
  const kills = (f?.kills ?? []).map((k) => (typeof k === 'string' ? k : k?.victim));
  /**
   * ── EL RESTADO DE MÁS, QUE APAGABA TODAS LAS FIGURAS EN EL SEGUNDO 0 ───
   *
   * `killTimes` YA VIENE EN SEGUNDOS DE PELEA: `src/engine.js:1251` lo escribe
   * como `Math.round(k.t - enc.start)`, y `ui/grafica.js` lo usa tal cual para
   * colocar las marcas de muerte. Aquí se le volvía a restar `inicio`:
   *
   *     caidas = killTimes.map((t) => Math.max(0, Math.round(t - inicio)))
   *
   * o sea `107 - 1.786.358.914`, un número enorme y negativo que el `Math.max`
   * convertía en **0**. Resultado: TODAS las figuras se apagaban en el segundo
   * cero de la reproducción, en todas las peleas. Y no se notaba porque cero es
   * un segundo válido: no había excepción, ni hueco, ni cifra absurda — la
   * escena empezaba con los muertos ya grises.
   *
   * La unidad va ahora en el nombre —`muertesSeg`— porque un número desnudo no
   * puede cruzar una frontera sin que alguien se equivoque de escala. Ver la
   * regla del número desnudo en `ui/app.js`.
   */
  const muertesSeg = new Map();
  for (const kt of f?.killTimes ?? []) {
    const n = plegar(kt.name);
    if (!muertesSeg.has(n)) muertesSeg.set(n, []);
    muertesSeg.get(n).push(Math.max(0, Math.round(kt.t ?? 0)));
  }
  for (const lista of muertesSeg.values()) lista.sort((a, b) => a - b);

  /**
   * ── QUÉ CUENTA COMO ACTIVIDAD: SER SUJETO, NO QUE TE NOMBREN ───────────
   *
   * El suelo dice «si un nombre muere y DESPUÉS sigue habiendo actividad suya,
   * había al menos dos», y el razonamiento entero se apoya en que UN MUERTO NO
   * PEGA. Así que la evidencia tiene que ser una acción SUYA.
   *
   * Aquí se miraba `origen` y `destino`, o sea que valía con que lo nombraran.
   * Y a un cadáver lo nombran constantemente: le siguen pegando —el combate
   * contra cadáveres es una familia entera de esta casa—, le entra un tick
   * retardado, lo saquean. Con eso, casi cualquier nombre muerto «tenía
   * actividad después» y el suelo habría subido en casi todas las peleas.
   *
   * SÓLO `origen`, entonces:
   *   pega        `daño` — y el escudo de daño también, que su emisor es quien
   *               lo lleva puesto y un cadáver no lleva escudo
   *   falla       `evitado` — el que intenta el golpe, no el que lo esquiva
   *   cura        `cura`
   *   castea      `lanza`
   *   mata        `muere` — ahí `origen` es el MATADOR; la víctima es `destino`
   *   resiste     `estado`, cuando el registro pone al bicho como origen
   *
   * Es conservador a propósito, igual que el resto del suelo: preferimos decir
   * «al menos uno» de menos que inventarnos un individuo.
   */
  const actividadSeg = new Map();
  for (const [seg, xs] of porSegundo) {
    for (const x of xs) {
      if (!x.origen) continue;
      const k = plegar(x.origen);
      if ((actividadSeg.get(k) ?? -1) < seg) actividadSeg.set(k, seg);
    }
  }
  const suelos = suelosDe(kills,
    (nombre, ultimaMuerteSeg) => (actividadSeg.get(nombre) ?? -1) > ultimaMuerteSeg,
    muertesSeg);
  for (const a of actores.values()) {
    const clave = plegar(a.nombre);
    a.figuras = suelos.get(clave) ?? 1;
    /**
     * DE QUÉ SE APOYA EL SUELO, porque no todas las N valen lo mismo.
     *
     * Medido sobre el histórico, de los 495 nombres con N≥2:
     *
     *   451 (91,1 %)  se apoyan en DOS O MÁS MUERTES — el registro las escribió
     *    18 (3,6 %)   el último individuo se apoya sólo en actividad posterior
     *    26 (5,3 %)   N=2 apoyado SÓLO en actividad posterior, con una muerte
     *
     * Los 44 del segundo y tercer grupo son los que tienen la afirmación más
     * floja: «hubo otro» sale de que siguieron llegando líneas del nombre, no
     * de una segunda muerte escrita. Sigue siendo cierto —un muerto no pega—
     * pero es una inferencia y la interfaz lo dice.
     */
    const nMuertes = (muertesSeg.get(clave) ?? []).length;
    a.suelo = { muertes: nMuertes, porActividad: a.figuras > Math.max(1, nMuertes) };
    // Los segundos en que cae una de las suyas, en orden. Una por muerte; si el
    // suelo es mayor que las muertes, la de más no cae en toda la pelea.
    a.caidas = (muertesSeg.get(clave) ?? []).slice();
  }

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
