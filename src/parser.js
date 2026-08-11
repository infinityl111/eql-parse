import { RULES_BY_HINT, HINTS } from './patterns.js';
import { STANCES, mitigationFor, normStance } from './stances.js';
import { classifySpell } from './spells.js';

/** "YOU parry!" / "misses!" / "a gorgon dodges!" -> palabra clave limpia. */
export function normReason(raw) {
  const r = String(raw ?? '').toLowerCase();
  if (r.includes('parr')) return 'parada';
  if (r.includes('ripost')) return 'contraataque';
  if (r.includes('dodge')) return 'esquiva';
  if (r.includes('block') || r.includes('shield')) return 'bloqueo';
  if (r.includes('invulnerable')) return 'invulnerable';
  if (r.includes('absorb') || r.includes('rune')) return 'absorbido';
  if (r.includes('magical skin') || r.includes('skin')) return 'absorbido';
  if (r.includes('miss')) return 'fallo';
  return r.slice(0, 24) || 'fallo';
}

/**
 * «himself», «itself», «yourself»… El log los usa como destino de una acción
 * sobre uno mismo, y ninguno es un combatiente.
 *
 * `yourself` faltaba, y no era inofensivo: el log lo usa para el daño que te
 * haces tú —«You hurt yourself for 40 points.» 133 veces, «You hit yourself …
 * by Cannibalize» 51 veces, más Siphon y Lifedraw— así que aparecía una fila
 * llamada «yourself» en la tabla de combatientes de nueve peleas, con daño real
 * dentro y sin ser nadie.
 */
const REFLEXIVO = /^(?:himself|herself|itself|themselves|yourself|yourselves|myself|oneself)$/i;

/**
 * CUÁNTO PUEDE DURAR UN ENCANTO, COMO MUCHO. 690 s.
 *
 * No sale de ninguna tabla del juego: sale de tu propio registro. De las 43
 * ventanas de encanto, 26 las cierra el registro por su cuenta con «Your Charm
 * spell has worn off of X», y ésas son las únicas cuya duración no depende de
 * ninguna deducción nuestra. Medidas el 10 de agosto de 2026:
 *
 *   mínimo 1 s · p25 19 s · mediana 84 s · p75 142 s · p90 226 s · MÁXIMO 333 s
 *
 * 333 s es una COTA INFERIOR de la duración real del hechizo —el máximo de una
 * muestra de 26 no es el máximo posible— así que se toma con margen ×2: 690 s.
 * Comprobado sobre esas mismas 26: ninguna la supera, o sea que este corte no
 * rompe ni una sola ventana medida. Y de las 17 que no se cierran solas, corta
 * exactamente una: `a thunder spirit`, abierta 18,5 HORAS, que era el caso que
 * hacía falta matar.
 *
 * ES UNA DEDUCCIÓN, y va marcada como tal (`cierre: 'caducado'`), igual que el
 * cierre por encadenado. Lo que la sostiene no es una regla del juego que nadie
 * ha comprobado, sino que una ventana de 18,5 h es imposible para un hechizo con
 * duración: no hace falta saber cuánto dura para saber que no dura eso.
 *
 * CUÁNDO HAY QUE REVISARLO: si alguna vez aparece una ventana cerrada por
 * «worn off» de más de 345 s —la mitad de esta constante— la muestra estará
 * diciendo que 333 s se quedó corto y el margen ya no es de ×2. Lo vigila
 * `test/charm.js`, que recalcula la cota sobre el registro que tenga delante.
 */
export const CHARM_MAX_SEC = 690;

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/**
 * Formato: [Www Mmm DD HH:MM:SS YYYY] mensaje
 * Parseo manual: new Date(string) es ~20x más lento y aquí procesamos
 * decenas de miles de líneas en la calibración.
 * Devuelve segundos epoch (resolución del log = 1 segundo, no hay más).
 */
export function parseHeader(line) {
  if (line.charCodeAt(0) !== 91 /* [ */ || line.charCodeAt(25) !== 93 /* ] */) return null;
  const mon = MONTHS[line.slice(5, 8)];
  if (mon === undefined) return null;
  const day = +line.slice(9, 11);
  const h = +line.slice(12, 14);
  const mi = +line.slice(15, 17);
  const s = +line.slice(18, 20);
  const year = +line.slice(21, 25);
  if (Number.isNaN(day + h + mi + s + year)) return null;
  const t = new Date(year, mon, day, h, mi, s).getTime() / 1000;
  return { t, body: line.slice(27) };
}

/**
 * DÓNDE SE REDONDEA UNA RECONSTRUCCIÓN: AQUÍ, Y EN NINGÚN OTRO SITIO.
 *
 * Hay dos cifras en este módulo que no son medidas sino reconstruidas —el daño
 * recibido antes de mitigar (`rawAmount`) y el melé propio sin el bono de
 * Offensive (`rawOut`)— y las dos salen de una división, así que salen con
 * decimales. La pregunta es dónde se cortan.
 *
 * SE CORTAN AL RECONSTRUIR, GOLPE A GOLPE. Dos razones, y la segunda es la que
 * manda:
 *
 *   1. Lo que se reconstruye es UN GOLPE, y un golpe de 96,5 puntos no existe:
 *      el registro no escribe decimales en ninguna línea. Guardar 96,5 le da a
 *      la reconstrucción una precisión que la medida de la que sale no tiene.
 *
 *   2. Redondear sólo al presentar deja números fraccionarios en el almacén, y
 *      entonces la suma de los cubos y el total dejan de cuadrar según quién
 *      redondee primero. Medido sobre 416 peleas guardadas: 388 de las 1.038
 *      celdas de `rawTakenByType` tenían valor fraccionario, y sumar los cubos
 *      ya redondeados daba 3.143.441 contra los 3.143.439 de redondear la suma.
 *      Dos puntos de descuadre reproducible que no describen nada. Con todo
 *      entero desde el origen, esa clase de descuadre no puede volver.
 *
 * EL SESGO NO ES SIMÉTRICO, Y CONVIENE SABER CUÁNTO ES. Aquí ponía que
 * `Math.round` es simétrico y no lo es: redondea el ,5 siempre hacia arriba, y
 * con divisores que producen ,5 exactos eso es sesgo POSITIVO, no ruido.
 * Medido barriendo importes enteros del 1 al 2.000 contra cada mitigación de la
 * tabla:
 *
 *   mit    factor    importes en ,5 exacto    sesgo por impacto
 *   0,10   1,1111            0,0%                  −0,0002
 *   0,20   1,2500           25,0%                  +0,1250
 *   0,40   1,6667            0,0%                  −0,0000
 *   0,50   2,0000            0,0%                  +0,0000   (sale entero)
 *
 * Sólo el 0,20 sesga, y sesga siempre hacia arriba: hoy son el melé bajo Mage
 * Hunter y el hechizo directo bajo Defensive. Una mitigación de 0,60 —que la
 * guarda de `test/stances.js` todavía permite— daría el ,5 en la MITAD de los
 * importes y +0,25 por impacto, el doble.
 *
 * Es un sesgo acotado POR IMPACTO, no en total: crece linealmente con el número
 * de golpes. Sobre el histórico real —1.041 celdas reconstruidas, 390 de ellas
 * fraccionarias antes del cambio— el redondeo suma +36 puntos sobre 3.115.407,
 * el 0,0012% de lo reconstruido. Se acepta a ese precio y con la cifra escrita,
 * no dando por buena una simetría que no existe.
 *
 * Si algún día molesta, lo que lo quita es redondear el ,5 al par en vez de
 * hacia arriba; no se ha hecho porque cambia una operación que cualquiera
 * reconoce por otra que hay que ir a mirar, y 36 puntos no lo pagan.
 *
 * Si hace falta otra reconstrucción, pasa por aquí. Es lo que hace que la
 * política sea una y no tres.
 */
const reconstruido = (v) => Math.round(v);

export class Parser {
  /**
   * @param {object} opts
   *  - self: nombre de tu personaje (para normalizar "You" <-> nombre real)
   *  - castWindowMs: ventana para atribuir "was hit by non-melee" al último casteo
   */
  constructor(opts = {}) {
    this.self = opts.self ?? null;
    this.castWindow = (opts.castWindowSec ?? 12);
    this.recentCasts = [];      // [{t, source, ability}]
    this.pets = new Map();      // nombre de mascota -> dueño (confirmadas)
    // Los encantados: nombre -> LISTA de ventanas { desde, hasta }. Aparte de
    // `pets` porque un encantado es tuyo DURANTE UN RATO y luego vuelve a ser
    // enemigo, con el mismo nombre; una mascota invocada no hace eso.
    //
    // Y una lista, no una ventana suelta: al mismo bicho lo encantas varias
    // veces. En el registro de referencia hay cuatro encantos sobre tres
    // nombres, y guardando sólo la última el primero de «a hardened skeleton»
    // se perdía —dos peleas distintas, con veinte minutos de por medio—.
    this.charmed = new Map();
    /**
     * TODO NOMBRE QUE HAYA ESTADO ENCANTADO EN ESTA SESIÓN. No se vacía nunca.
     *
     * Existe para una sola cosa: que un encantado no pueda ascender a mascota
     * invocada. Las dos dicen la misma frase —«Attacking X Master.»— y ascender
     * es irreversible, mientras que equivocarse cerrando una ventana se corrige
     * solo al volver a encantar. Medido sobre el registro real: dos ascensos,
     * `a large skeleton` y `a Teir`Dal rogue`, que metieron 10.004 puntos de
     * daño enemigo en tu bando repartidos por siete peleas, y de paso echaron a
     * tu mascota de verdad porque `#ownPet` jubila a la anterior.
     *
     * Es un conjunto de nombres y no de ventanas A PROPÓSITO: la pregunta no es
     * «¿está encantado ahora?» —eso depende de una ventana que puede estar mal
     * cerrada— sino «¿este nombre es de los que encantas?», que es justo lo que
     * hace que la línea de «Master» no pruebe nada.
     */
    this.everCharmed = new Set();
    this.manualPets = new Set(); // las que has dicho tú: mandan sobre lo detectado
    this.petMaybe = new Set();  // sospechosas, sin confirmar
    this.otherPets = new Map(); // mascota ajena -> dueño, sacado de su /pet who leader
    this.currentPet = null;     // la última vista: en EQL el nombre cambia por invocación
    this.pendingCrit = null;    // {t, source, amount}
    this.unrecognized = 0;
    this.parsed = 0;
    this.zone = null;
    this.stance = null;       // sólo existe en EQL
    this.invocation = null;
  }

  /** Devuelve un evento normalizado o null. `seq` desempata dentro del mismo segundo. */
  parse(line, seq = 0) {
    const head = parseHeader(line);
    if (!head) return null;
    return this.parseAt(head.t, head.body, seq);
  }

  /**
   * Lo mismo, con la hora ya separada del texto.
   *
   * Lo usa la reproducción: el lector del registro devuelve la hora y el cuerpo
   * por separado —así la pestaña del registro puede enseñar el texto sin la
   * marca delante— y volver a pegarlos para que `parse` los separe otra vez
   * sería trabajo de ida y vuelta sobre cientos de líneas.
   */
  parseAt(t, body, seq = 0) {
    for (const hint of HINTS) {
      if (body.indexOf(hint) === -1) continue;
      for (const rule of RULES_BY_HINT.get(hint)) {
        const m = rule.re.exec(body);
        if (!m) continue;
        this.parsed++;
        const ev = { t, seq, kind: rule.kind, raw: body, ...rule.map(m) };
        // `what` distingue variantes dentro de un mismo `kind` sin multiplicar
        // los kinds: los avisos de supervivencia son todos 'survival' y se
        // separan por aquí. Va declarado en la regla, junto al kind, porque es
        // parte de qué ES la línea y no de lo que se extrae de ella.
        if (rule.what) ev.what = rule.what;
        return this.#post(ev);
      }
    }
    this.unrecognized++;
    return { t, seq, kind: 'unknown', raw: body };
  }

  /**
   * Tu mascota es la de AHORA, no todas las que has tenido.
   *
   * En EQL el nombre sale de una lista cerrada y se recicla entre jugadores: el
   * mismo nombre que fue tuyo hace cuatro horas puede ser el de la mascota de
   * otro cuando la tuya ya se llama de otra forma. Al no retirar nunca los
   * viejos, cualquier cosa que tocara ese nombre entraba en el filtro de
   * relevancia como tuya.
   *
   * Medido en un log real: `Jobarn` fue tuya a las 20:07 y a las 23:51
   * invocaste `Kabarer`. A las 00:01 apareció otro `Jobarn`, el de `Krumka`, y
   * se guardó una pelea entera en la que tú no estabas — su dueño, su mascota y
   * el enemigo— como si fuera tuya.
   *
   * Sólo se tiene una a la vez, así que confirmar una nueva retira la anterior.
   * Las tres señales que llegan aquí son inequívocas en el instante en que
   * ocurren: «My leader is <tú>», «told you 'Attacking… Master'» y tus propias
   * órdenes. Lo que se corrige no es la señal, es darla por buena para siempre.
   */
  #ownPet(nombre) {
    // Normalizado como cualquier otro nombre. Sin esto, «A hardened skeleton»
    // —que es como EQ lo escribe al empezar la frase de «told you… Master»—
    // se guardaba con la mayúscula y no casaba con sus propias filas de
    // combate, que van en minúscula. Medido: el encantado salía en la lista
    // de mascotas y no se le atribuía ni un golpe.
    const name = this.#norm(nombre);
    if (!name) return;
    /**
     * UN ENCANTADO NO ASCIENDE A MASCOTA. NUNCA. Aquí y no en el `switch`
     * porque éste es el único sitio por el que se entra en `pets`: lo llaman
     * `pet_claim`, `pet_order` y `pet_leader`, y los tres dicen lo mismo sobre
     * un encantado —responde «Master», obedece y declara líder— sin que
     * ninguno lo distinga de una invocada.
     *
     * ANTES SE MIRABA `charmedAt(name, t)`, y ésa era la trampa: bastaba con
     * que la ventana estuviera mal cerrada para que el guardia se apartara.
     * Medido, dos veces con el mismo patrón:
     *
     *   11:33:07  a large skeleton has been charmed.
     *   11:33:32  A large skeleton has been slain by a large skeleton!   ← OTRO igual
     *   11:34:26  A large skeleton told you, 'Attacking an ogre guard Master.'
     *
     * La muerte de un homónimo cerraba la ventana, `charmedAt` decía «no» y el
     * bicho entraba en `pets` para el resto de la sesión. Mirando el conjunto
     * de los que ALGUNA VEZ estuvieron encantados, la ventana puede fallar y
     * esto sigue en pie.
     *
     * Lo que dices tú a mano (`markPet`) NO pasa por aquí, y es correcto: si
     * decides que un encantado cuente como mascota, manda tu decisión.
     */
    if (this.everCharmed.has(name)) return;
    // Retirar la anterior es correcto —sólo se tiene una a la vez— salvo que la
    // hubieras puesto TÚ. Lo que dices a mano no lo deshace una detección: si
    // el registro se contradice contigo, gana lo que has dicho, y para quitarla
    // hay un control en su fila. Sin esta excepción, marcar una mascota y que
    // llegara un «My leader is» de otra la desmarcaba sola y sin avisar.
    if (this.currentPet && this.currentPet !== name && !this.manualPets.has(this.currentPet)) {
      this.pets.delete(this.currentPet);
    }
    this.pets.set(name, this.self ?? 'You');
    this.petMaybe.delete(name);
    this.currentPet = name;
  }

  /**
   * Abre la ventana del encanto: a partir de aquí pelea para ti.
   *
   * El registro lo dice con todas las letras —«X has been charmed.»— así que la
   * APERTURA es MEDIDA. Lo que no dice es CUÁL de los X, si hay dos con el
   * mismo nombre; eso se resuelve por objetivo, no aquí.
   *
   * Y CIERRA CUALQUIER OTRO ENCANTO ABIERTO, se llame como se llame, porque la
   * regla del juego es que sólo se tiene uno a la vez. ESE CIERRE ES DEDUCIDO:
   * el registro no escribe absolutamente nada cuando encadenar un encanto
   * rompe el anterior. Comprobado sobre 514.504 líneas —de los tres encadenados
   * que hay, dos no tienen ni una línea que hable del bicho soltado en ±3 s, y
   * el tercero es una muerte que ya lo explicaba— así que la ventana se marca
   * `cierre: 'encadenado'` y quien la lea sabe que ahí no hay medida.
   */
  #charmOn(nombre, t) {
    const name = this.#norm(nombre);
    if (!name) return;
    this.everCharmed.add(name);
    const ahora = t ?? 0;
    // Uno a la vez: el nuevo se lleva por delante a todos los demás.
    for (const [otro, v] of this.charmed) {
      const u = v.at(-1);
      if (!u || u.hasta !== null) continue;
      u.hasta = ahora;
      // Al mismo bicho se le vuelve a echar el encanto sin que se hubiera roto:
      // eso no es encadenar, es renovar, y no hay nada que deducir.
      u.cierre = otro === name ? 'reencanto' : 'encadenado';
    }
    if (!this.charmed.has(name)) this.charmed.set(name, []);
    this.charmed.get(name).push({ desde: ahora, hasta: null, cierre: null });
  }

  /**
   * Y la cierra: «Your Charm spell has worn off of X.» Éste es el único cierre
   * que el registro escribe, así que es el único MEDIDO.
   *
   * LA MUERTE YA NO CIERRA, y quitarlo fue el arreglo, no una simplificación.
   * Aquí se decía que la muerte era el segundo camino «para no depender de
   * uno», con n=4. Con el registro entero delante, n=43, esa muerte no
   * identifica a nadie: los nombres de EQL se repiten y la línea no trae
   * ningún distintivo, así que «A large skeleton has been slain» puede ser el
   * encantado o cualquiera de los otros tres que hay delante. Cerrar con eso no
   * es un segundo camino, es una moneda al aire — y cuando salía mal, el
   * encantado quedaba libre para ascender a mascota permanente por la puerta
   * de `#ownPet`.
   *
   * Quedan dos cierres, los dos fiables: este aviso y encantar a otro.
   */
  #charmOff(nombre, t) {
    const name = this.#norm(nombre);
    const v = name && this.charmed.get(name);
    const ultima = v && v.at(-1);
    if (!ultima || ultima.hasta !== null) return;
    ultima.hasta = t ?? 0;
    ultima.cierre = 'worn-off';
  }

  /**
   * ¿La última ventana de este nombre acabó en una deducción?
   *
   * Lo pregunta el encuentro para poder decir cuánto de lo que cuenta depende
   * de que hayamos dado por roto un encanto que el registro no da por roto.
   * Sin esto, un cierre deducido y uno escrito se leen igual en la ficha, que
   * es exactamente lo que no puede pasar.
   */
  charmCierre(nombre, t) {
    const v = this.charmed.get(this.#norm(nombre));
    if (!v) return null;
    let ultima = null;
    for (const w of v) if (w.hasta !== null && w.hasta <= t) ultima = w;
    return ultima?.cierre ?? null;
  }

  /**
   * Cierra por caducidad lo que lleve abierto más de lo que un encanto puede
   * durar. Ver `CHARM_MAX_SEC`: el límite sale de tus propias ventanas medidas,
   * no de una tabla, y el cierre se marca para que no se confunda con el que el
   * registro escribe.
   *
   * `hasta` se pone en `desde + máximo`, no en el instante en que nos damos
   * cuenta: lo que sabemos es que no pudo durar más de eso, y poner la hora del
   * evento que lo destapa alargaría la ventana hasta donde por casualidad haya
   * caído la siguiente línea.
   */
  #caducar(t) {
    if (!Number.isFinite(t)) return;
    for (const [, v] of this.charmed) {
      const u = v.at(-1);
      if (!u || u.hasta !== null) continue;
      if (t - u.desde <= CHARM_MAX_SEC) continue;
      u.hasta = u.desde + CHARM_MAX_SEC;
      u.cierre = 'caducado';
    }
  }

  /**
   * ¿Estaba encantado en este instante?
   *
   * El tope se aplica también aquí, y no sólo al caducar, porque esto se
   * consulta con horas de eventos que pueden llegar antes de que nada haya
   * disparado la revisión —y sobre todo porque quien pregunte por un instante
   * suelto debe obtener la misma respuesta que quien reproduzca el registro
   * entero. Una función que responde distinto según lo que se haya leído antes
   * es exactamente el fallo que tenía la ventana del charm.
   */
  charmedAt(nombre, t) {
    const v = this.charmed.get(this.#norm(nombre));
    if (!v) return false;
    return v.some((c) => {
      if (t < c.desde) return false;
      if (t - c.desde > CHARM_MAX_SEC) return false;
      return c.hasta === null || t <= c.hasta;
    });
  }

  /**
   * Marca manual desde la interfaz, cuando el registro no lo aclara.
   *
   * `manualPets` es lo que has dicho tú, y se guarda aparte de lo detectado
   * porque manda sobre ello: ni la detección la retira ni se pierde al invocar
   * otra. Es reversible con `unmarkPet`, que es el mismo camino al revés.
   */
  markPet(name) {
    if (!name) return;
    this.pets.set(name, this.self ?? 'You');
    this.manualPets.add(name);
    this.petMaybe.delete(name);
    this.currentPet = name;
  }

  /** Y el camino de vuelta, que es lo que hace reversible lo de arriba. */
  unmarkPet(name) {
    if (!name) return;
    this.pets.delete(name);
    this.manualPets.delete(name);
    this.petMaybe.delete(name);
    if (this.currentPet === name) this.currentPet = null;
  }

  #norm(name) {
    if (name == null) return null;
    // SIN MIRAR LA CAJA. Aquí se listaban las cuatro formas a mano —«You»,
    // «YOU», «you», «Yourself»— y faltaba justo la que el log escribe más:
    // «yourself» en minúscula, que es como sale a mitad de frase («You hurt
    // yourself for 40 points.»). Es el mismo fallo que partía enemigos en dos
    // según la mayúscula de principio de frase, y con la misma cura: comparar
    // sin caja en vez de enumerar variantes.
    const plano = name.toLowerCase();
    if (plano === 'you' || plano === 'yourself' || plano === 'myself') {
      return this.self ?? 'You';
    }
    // EQ capitaliza al principio de frase: "A fire giant warrior" y
    // "a fire giant warrior" son el mismo enemigo. Sólo tocamos el artículo,
    // para no estropear nombres propios como "King Tranix".
    return name.replace(/^(An?|The) /, (m) => m.toLowerCase());
  }

  #post(ev) {
    // EQL marca el resultado entre paréntesis al final de la línea:
    // (Critical), (Riposte), (Flurry)… Sin esto los críticos no se contaban.
    if (ev.flag) {
      const f = ev.flag.toLowerCase();
      if (f.includes('critical')) ev.crit = true;
      if (f.includes('riposte')) ev.riposte = true;
      if (f.includes('flurry')) ev.flurry = true;
      if (f.includes('strikethrough')) ev.strikethrough = true;
    }

    // Damage shield EQL: "Xasaner is burned by a gorgon's flames for 12 points…"
    // El emisor va en posesivo dentro del efecto. Si no hay posesivo
    // (p.ej. "shards of ice") no hay forma de saber de quién es el DS.
    if (ev.kind === 'ds' || ev.kind === 'ds_nodmg') {
      const own = /^YOUR (.+)$/.exec(ev.effect ?? '');   // "YOUR thorns" -> tuyo
      const m = own ? null : /^(.+?)'s (.+)$/.exec(ev.effect ?? '');
      ev.source = own ? (this.self ?? 'You') : (m ? m[1] : 'Unknown');
      ev.ability = own ? own[1] : (m ? m[2] : ev.effect);
      ev.target = ev.victim;
      ev.confidence = (own || m) ? 'exact' : 'none';
    }

    // EL PRONOMBRE ES LA PRUEBA DE QUE ES EL MISMO, y hay que anotarlo ANTES de
    // normalizar, porque después ya no se distingue de una coincidencia.
    //
    // Que origen y destino compartan nombre NO significa que sean el mismo: un
    // encantado pegando a un salvaje que se llama igual son dos bichos, y esa
    // línea existe y está contada aparte como ambigua. Lo único que prueba que
    // alguien se lo hizo a sí mismo es que el registro escriba el pronombre.
    if (REFLEXIVO.test(String(ev.target ?? ''))) ev.selfInflicted = true;
    // Todos los campos que pueden traer "You" deben normalizarse, no sólo
    // source y target: si no, tu muerte queda a nombre de un "You" fantasma.
    ev.source = this.#norm(ev.source);
    ev.target = this.#norm(ev.target);
    ev.victim = this.#norm(ev.victim);
    ev.killer = this.#norm(ev.killer);
    ev.caster = this.#norm(ev.caster);


    // ¿Estaban encantados en este instante? El analizador sólo dice eso; de
    // decidir el bando se encarga el encuentro, que es quien sabe qué es tuyo.
    if (this.charmed.size) {
      // Antes de opinar sobre este golpe, se jubila lo que ya no puede seguir
      // abierto. Va aquí y no en el `switch` porque toda línea con hora sirve
      // de reloj: si esperáramos a la siguiente línea de charm, una ventana
      // podría quedarse viva durante horas sin que llegue ninguna.
      this.#caducar(ev.t);
      if (ev.source && this.charmedAt(ev.source, ev.t)) ev.charmSrc = true;
      if (ev.target && this.charmedAt(ev.target, ev.t)) ev.charmTgt = true;
      /**
       * Y LA PROCEDENCIA DEL «YA NO ES TUYO», que es lo único deducido de todo
       * esto. Estar encantado se lee de una línea escrita; dejar de estarlo por
       * haber encantado a otro NO se lee de ninguna parte. Si este golpe cae
       * después de un cierre encadenado, quien lo cuente tiene que poder decir
       * que ahí hay una deducción debajo, en vez de enseñarlo igual que un dato.
       */
      // Los dos cierres deducidos cuentan igual: ni el encadenado ni el
      // caducado tienen una línea detrás. El escrito —`worn-off`— no entra.
      const deducido = (n) => {
        const c = this.charmCierre(n, ev.t);
        return c === 'encadenado' || c === 'caducado';
      };
      if (!ev.charmSrc && ev.source && deducido(ev.source)) ev.charmSoltado = true;
      if (!ev.charmTgt && ev.target && deducido(ev.target)) ev.charmSoltado = true;
    }

    switch (ev.kind) {
      case 'zone':
        this.zone = ev.zone;
        break;

      case 'stance':
        if (ev.stance) this.stance = ev.stance;
        break;

      case 'invocation':
        if (ev.invocation) this.invocation = ev.invocation;
        break;

      case 'pet_claim':
        // Lo que te responde con "Master" obedece órdenes tuyas.
        //
        // Salvo si es un encantado: responde «Master» igual que una mascota
        // invocada, pero NO ocupa su sitio. Se tiene una invocada y todos los
        // encantados que te duren. El guardia está dentro de `#ownPet` y mira
        // si el nombre estuvo encantado ALGUNA VEZ, no si lo está ahora: aquí
        // se preguntaba `charmedAt(ev.pet, ev.t)` y una ventana mal cerrada
        // bastaba para colarse.
        this.#ownPet(ev.pet);
        break;

      case 'charm_on':
        this.#charmOn(ev.target, ev.t);
        break;

      case 'charm_off':
        this.#charmOff(ev.target, ev.t);
        break;

      // `death` ya no cierra encantos: ver `#charmOff`. La muerte de un nombre
      // no identifica a un bicho, y cerrar con ella abría la puerta a que el
      // encantado ascendiera a mascota permanente.

      case 'pet_order':
        // Tú le has dado la orden, así que es tuya.
        this.#ownPet(ev.pet);
        break;

      case 'pet_maybe':
        // Podría ser de otro jugador del grupo: se anota como candidata.
        this.petMaybe.add(ev.pet);
        break;

      case 'pet_leader':
        // La única fuente inequívoca de a quién pertenece una mascota.
        if (ev.leader === (this.self ?? 'You') || ev.leader === 'You') {
          this.#ownPet(ev.pet);
          this.otherPets.delete(ev.pet);
        } else {
          // Es de otro jugador: se anota para nombrarla bien y no preguntarla.
          this.otherPets.set(ev.pet, ev.leader);
          this.petMaybe.delete(ev.pet);
          this.pets.delete(ev.pet);
        }
        break;

      case 'cast':
        if (ev.ability) ev.castCat = classifySpell(ev.ability);
        this.recentCasts.push({ t: ev.t, source: ev.source, ability: ev.ability });
        if (this.recentCasts.length > 64) this.recentCasts.shift();
        break;

      // ═══ CURACIÓN: dos nombres que no son de nadie ═══
      //
      // El destino de una curación llega de dos formas que no son combatientes,
      // y las dos acababan en la tabla «a quién has curado» de la ficha, con
      // aspecto de dato medido. Contadas en un log real de 278.299 líneas:
      //
      //   1.126  «You healed Campeon over time for 153 …» — el sufijo es del
      //          tic de una curación con duración, no parte del nombre. Partía
      //          a cada objetivo en dos: «Campeon» y «Campeon over time», éste
      //          con 147.772 pv repartidos por 105 peleas.
      //   1.131  «a worry wraith pet healed himself for 613 …» — el pronombre
      //          es quien cura, no un combatiente nuevo. Al perderse, la
      //          autocuración de un enemigo no llegaba nunca al enemigo.
      //
      // El orden importa: existen las dos juntas —«healed itself over time»,
      // 43 veces— así que primero se quita el sufijo y luego se resuelve el
      // pronombre. Al revés, «itself over time» no casaría con el pronombre.
      case 'heal':
        if (typeof ev.target === 'string' && / over time$/.test(ev.target)) {
          // Se marca en vez de perderse: que la curación fuera un tic es un
          // dato del hechizo, y es lo que distingue un HoT de una cura directa.
          ev.overTime = true;
          ev.target = this.#norm(ev.target.replace(/ over time$/, ''));
        }
        if (REFLEXIVO.test(ev.target ?? '')) ev.target = ev.source;
        break;

      case 'miss':
        ev.reason = normReason(ev.reason);
        break;

      case 'crit':
        // El crítico llega como línea aparte; se adjunta al siguiente golpe
        // del mismo actor con el mismo importe.
        this.pendingCrit = { t: ev.t, source: ev.source, amount: ev.amount };
        break;

      case 'melee':
      case 'dot':
      case 'ds':
        if (this.pendingCrit &&
            this.pendingCrit.source === ev.source &&
            ev.t - this.pendingCrit.t <= 1 &&
            (this.pendingCrit.amount === ev.amount || this.pendingCrit.amount === 0)) {
          ev.crit = true;
          this.pendingCrit = null;
        }
        break;

      case 'nonmelee_orphan': {
        // Atribución por correlación: el casteo más reciente dentro de ventana.
        // Es heurístico por diseño — el cliente no incluye el emisor en esta línea.
        const cand = this.#lastCast(ev.t);
        if (cand) {
          ev.source = cand.source;
          ev.ability = cand.ability;
          ev.confidence = 'inferred';
          ev.kind = 'spell';
        } else {
          ev.source = 'Unknown';
          ev.confidence = 'none';
          ev.kind = 'spell';
        }
        break;
      }
    }

    // La postura sólo se conoce para tu personaje: el log no dice la de los demás.
    const me = this.self ?? 'You';
    // También cuando el lanzador eres tú: en una resistencia, tu nombre viene
    // en `caster`, no en `source`, y sin esto no sabríamos con qué invocación
    // se lanzó el hechizo que te resistieron.
    if (ev.caster === me && !ev.invocation) ev.invocation = this.invocation;
    if (ev.caster === me && !ev.stance) ev.stance = this.stance;

    if (ev.source && ev.source === me) {
      ev.stance = ev.stance ?? this.stance;
      ev.invocation = ev.invocation ?? this.invocation;
      // Offensive duplica el melé: para comparar hay que descontar el bono.
      if (ev.amount && ev.school === 'melee') {
        const st = STANCES[normStance(this.stance)];
        ev.rawOut = st?.meleeBonus ? reconstruido(ev.amount / (1 + st.meleeBonus)) : ev.amount;
      }
    }
    // El log guarda el daño YA mitigado. Se revierte para poder comparar
    // posturas sin sesgarse hacia la que ya llevabas puesta. Qué escuelas se
    // revierten y por qué está medido en `mitigationFor`.
    // La postura del instante viaja con TODO lo que va contra ti, tenga importe
    // o no. Los fallos la necesitan igual: una postura que evade no reduce el
    // golpe, lo quita, y eso se puntúa contando ataques — sin la postura del
    // fallo no se sabe a qué tramo pertenece ese ataque.
    if (ev.target === me) ev.stanceAtHit = this.stance;
    if (ev.target === me && ev.amount) {
      const red = mitigationFor(this.stance, ev.school);
      ev.rawAmount = red > 0 && red < 1 ? reconstruido(ev.amount / (1 - red)) : ev.amount;
    }
    // Aquí había un `ev.pet = dueño de ev.source`, que pisaba el nombre de la
    // mascota que traen los eventos pet_*. No lo leía nadie —quien mira si una
    // fila es mascota usa la marca de la fila, no la del evento— y dejaba una
    // trampa puesta para el siguiente que leyera `ev.pet` fuera del switch.
    return ev;
  }

  #lastCast(t) {
    for (let i = this.recentCasts.length - 1; i >= 0; i--) {
      const c = this.recentCasts[i];
      if (t - c.t > this.castWindow) return null;
      if (t >= c.t) return c;
    }
    return null;
  }
}
