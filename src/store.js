import { RANGES } from './ranges.js';
import { parseZone } from './zones.js';
import { SIN_MITIGACION } from './stances.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Almacén de peleas.
 *
 * Dos ficheros, y la razón importa:
 *
 *   fights.ndjson   una pelea completa por línea, sólo se AÑADE al final.
 *                   Nada se recorta ni se borra: el histórico queda íntegro.
 *   fights.idx      un resumen por línea, con el byte donde empieza la pelea
 *                   completa. Es lo único que se carga en memoria al arrancar.
 *
 * Un único JSON con todo dentro obligaría a releerlo y reescribirlo entero en
 * cada pelea. Con mil peleas eso son decenas de megas moviéndose sin parar.
 * Añadir al final cuesta lo mismo con una pelea que con diez mil, y el índice
 * de mil peleas ocupa unos 200 KB.
 *
 * IDENTIDAD DE UNA PELEA
 *
 * `id` NO identifica nada fuera de la sesión que la generó: el contador vive en
 * el EncounterTracker y vuelve a 1 en cada arranque, así que la pelea 1 de hoy
 * y la 1 de ayer comparten número. Cuando el mapa de búsqueda se indexaba por
 * `id`, la de hoy tapaba a la de ayer: pinchar una pelea vieja abría otra, y el
 * resumen del tramo leía la misma pelea varias veces y se dejaba fuera las
 * antiguas.
 *
 * La identidad es `uid` = el byte donde empieza el registro. Es único por
 * construcción (el fichero sólo crece), ya estaba guardado en cada línea del
 * índice como `off`, y por eso los índices antiguos se migran solos sin
 * reescribir nada.
 *
 * DUPLICADOS
 *
 * Releer el log entero vuelve a generar las mismas peleas. Como `at` es la hora
 * de la PELEA y no la de importarla, la terna (at, total, duración) es estable
 * entre relecturas y sirve de identidad lógica: `append` la usa para no guardar
 * dos veces lo mismo, y `load` descarta las copias que ya hubiera en disco.
 */

/** Identidad lógica de una pelea: estable aunque se reimporte el log. */
const logicalKey = (s) => `${s.at}:${s.total ?? 0}:${s.duration ?? 0}`;

/**
 * Generación de los datos guardados. NO es la versión de la aplicación.
 *
 * Son dos preguntas distintas y conviene no mezclarlas: «qué versión es esto»
 * la contesta package.json, y «lo que hay en disco describe lo que pasó» la
 * contesta este número. Un arreglo de interfaz sube la primera y no debería
 * obligar a nadie a releer su log; un arreglo del parser sube ésta aunque la
 * versión no cambie.
 *
 * Se sube cuando lo guardado por la generación anterior es incorrecto y no se
 * puede arreglar leyéndolo mejor:
 *
 *   1  (implícita)  todo lo anterior a que esta marca existiera. Muertes sin
 *                   contar, peleas duplicadas, identidades que se tapaban,
 *                   vida estimada multiplicada, Evasive mal calculada.
 *   2               `You have been knocked unconscious!` se contaba como una
 *                   muerte además de la línea de muerte real que siempre la
 *                   sigue: cada muerte tuya valía por dos.
 *   3               Los avisos de subárea («has entrado en un sitio donde no
 *                   funciona la levitación») se guardaban como zona y
 *                   machacaban la real, y con ella la dificultad de la
 *                   instancia. El 23% de las peleas de un log real tenía la
 *                   zona destruida. Además la dificultad pasa a ser un campo
 *                   propio, que es lo que permite separar el expediente.
 *   4               Botín perdido y botín mal contado. De las 681 líneas de
 *                   botín de un log real se descartaban 98 —el 14%—: 83 porque
 *                   traían cantidad en vez de artículo («2 Phosphorous
 *                   Powder») y 15 porque acababan en «and stored it in your
 *                   currency», un final que no existía como regla; entre estas
 *                   últimas, los 9 `Mote of Major Potential` recogidos, de los
 *                   que no aparecía ninguno. Y la cantidad no se guardaba: lo
 *                   recogido se contaba por veces y no por unidades, así que
 *                   «2 Bone Chips» valía uno. Releyendo el log salen 764
 *                   unidades donde antes se veían 583.
 *   5               El botin recogido de un cadaver que remato entero un
 *                   companero no tenia pelea a la que colgarse y se perdia. Se
 *                   guarda aparte, en `loot.ndjson`, porque recoger un objeto
 *                   es un suceso TUYO y no de un combate: la prueba de que
 *                   estabas alli es que lo cogiste. Eran 5 objetos en un
 *                   registro real.
 *
 *   6               El dano que te hacias tu mismo se contaba como dano hecho:
 *                   inflaba tu total y llego a crear una pelea entera contra
 *                   «yourself». Y ninguna pelea guardada lleva la forma del
 *                   golpe —p10, mediana, p90—, que se empezo a contar despues,
 *                   asi que el reproductor y las tablas la dan por ausente en
 *                   todo el historico.
 *
 * SUBIR ESTE NUMERO ES LO QUE HACE QUE EL ARREGLO LLEGUE. El aviso de
 * reconstruir se dispara con `generacion(meta) < STORE_VERSION` y con nada mas:
 * corregir el calculo y no tocar esto deja el arreglo escrito en el codigo y
 * fuera del historico de todo el mundo. Al cambiarlo, repasa `mig.body` — el
 * cartel explica los motivos de ESTA migracion, y un texto puesto por un motivo
 * que ya no aplica sobrevive porque nadie lo relee.
 */
export const STORE_VERSION = 6;
const META = 'store.json';

/**
 * MODELO DE MEDICIÓN. Es otra pregunta distinta de las dos anteriores.
 *
 *   package.json      qué versión del programa es esto
 *   STORE_VERSION     lo guardado está roto y hay que releer el registro
 *   MODELO_MEDICION   con qué reglas se calcularon las cifras de ESTA pelea
 *
 * Y va POR PELEA, que es lo que STORE_VERSION no puede hacer: aquélla marca el
 * almacén entero, así que en cuanto una parte del histórico se corrige y otra
 * no, deja de describir lo que hay dentro. Un número por pelea sí, y por eso no
 * es un booleano: «reparada: true» no dice reparada de qué ni a qué, y el
 * modelo que viene después lo deja mudo otra vez.
 *
 *   1  La postura revertía TAMBIÉN el daño periódico y el escudo de daño, que
 *      medidos no los mitiga (ver `mitigationFor`). Y las cifras reconstruidas
 *      se guardaban con decimales, así que la suma de los cubos y el total no
 *      cuadraban. Sobre 416 peleas: 44.924 puntos de daño recibido inventados.
 *   2  `dot` y `ds` no se revierten, y toda reconstrucción se redondea en el
 *      momento de reconstruirla (ver `reconstruido` en parser.js).
 *   3  El daño recibido se guarda partido por la postura de cada golpe, así que
 *      el veredicto del consejo compara contra lo que evitaste TRAMO A TRAMO.
 *      Hasta aquí la pelea se colapsaba a la postura que más duró y se le
 *      acreditaba el daño entero, que en una pelea donde bailas es falso por
 *      construcción.
 *   4  La serie por segundo tenía DOS cubos de daño recibido —melé y «lo
 *      demás»— y el daño periódico y el escudo caían en el segundo. Todo el que
 *      leyera la serie para saber qué le estaba entrando contaba como mágico un
 *      daño que ninguna postura para. Ahora son tres, con la misma lista que el
 *      resto del programa.
 *
 * NO SE SUBE `STORE_VERSION` POR ESTO, y es la propia regla de arriba la que lo
 * dice: se sube cuando lo guardado no se puede arreglar leyéndolo mejor. Esto
 * sí se puede — el importe observado está guardado al lado del reconstruido, en
 * `takenByType`, así que la corrección es una copia exacta y se hace al leer,
 * como ya se hacía con la dificultad que faltaba. Ningún fichero se toca, no
 * hay que pedirle a nadie que reconstruya su histórico, y una reconstrucción
 * posterior escribe exactamente lo mismo.
 */
export const MODELO_MEDICION = 4;

/**
 * Modelo desde el que el arreglo de `dot`/`ds` ya está aplicado.
 *
 * La guarda de `repararModelo` va contra ESTE número y no contra el modelo
 * vigente, y la diferencia importa: son dos arreglos independientes. El de
 * `dot`/`ds` se puede hacer al leer porque el importe observado está guardado
 * al lado; el del reparto por postura NO —el daño por tramo no está en ninguna
 * parte— y hay que sacarlo releyendo el registro. Con una sola guarda, subir el
 * modelo por el segundo arreglo habría vuelto a disparar el primero sobre
 * peleas que ya estaban bien, restándoles daño de verdad.
 */
export const MODELO_CON_DOT_DS = 2;

/**
 * Cubos de `rawTakenByType` que el modelo 1 revertía sin deber.
 *
 * Es la lista de `stances.js` y no una copia: el cubo se llama como su escuela
 * cuando el evento no trae tipo de daño, que es justo el caso del periódico y
 * del escudo. Si algún día uno de los dos empezara a traer tipo, el cubo dejaría
 * de llamarse igual — y por eso la copia se comprueba antes de aplicarla,
 * cotejando el número de impactos.
 */
const CUBOS_SIN_REVERTIR = SIN_MITIGACION;

/**
 * Sube una pelea del modelo 1 al 2, al leerla. No toca el disco.
 *
 * DOS ARREGLOS, Y NINGUNO INVENTA NADA:
 *
 *   `dot` y `ds` vuelven a su importe OBSERVADO, que está guardado al lado en
 *   `takenByType`. Los dos mapas usan la misma clave por construcción —ni el
 *   daño periódico ni el escudo traen `damageType`, así que su cubo se llama
 *   como su escuela— y eso se comprueba aquí en vez de darse por hecho: si el
 *   número de impactos de los dos cubos no coincide, no son la misma población
 *   y NO se copia nada.
 *
 *   Lo reconstruido se redondea. Ver `reconstruido` en parser.js: la política
 *   es una y ésta es su aplicación a lo que ya estaba escrito con la anterior.
 *
 * SI ALGO NO CUADRA, LA PELEA SE QUEDA EN EL MODELO 1 y lo dice. Es la razón de
 * que el campo sea un número: una pelea a medio corregir tiene que poder
 * distinguirse de una corregida, y de una nacida ya bien.
 */
function repararModelo(f) {
  if (!f || Number(f.modelo) >= MODELO_CON_DOT_DS) return f;
  let completa = true;
  for (const r of f.rows ?? []) {
    const obs = new Map((r.takenByType ?? []).map((x) => [x.name, x]));
    for (const x of r.rawTakenByType ?? []) {
      if (CUBOS_SIN_REVERTIR.has(x.name)) {
        const o = obs.get(x.name);
        // Mismo cubo y misma cuenta de impactos, o no se toca. Un cubo
        // revertido sin su observado al lado no se puede corregir: se deja como
        // está y la pelea entera se queda marcada como modelo 1.
        if (!o || o.n !== x.n) { completa = false; continue; }
        x.sum = o.sum;
      } else {
        x.sum = Math.round(x.sum);
      }
    }
    if (typeof r.rawMeleeOut === 'number') r.rawMeleeOut = Math.round(r.rawMeleeOut);
  }
  if (completa) {
    f.modeloOrigen = Number(f.modelo) || 1;
    f.modelo = MODELO_CON_DOT_DS;
  }
  return f;
}

/**
 * El daño partido por postura, para peleas guardadas antes de que se midiera.
 *
 * VIVE EN UN FICHERO APARTE Y NO DENTRO DE LA PELEA, y no es por comodidad.
 * `uid` ES EL BYTE donde empieza la pelea en `fights.ndjson`, y `fights.idx`
 * guarda ese desplazamiento. Meter un campo nuevo en una línea ya escrita la
 * alarga, corre todos los bytes siguientes y deja el índice entero apuntando a
 * sitios equivocados — y de paso el `lastUid` de la enciclopedia. Un fichero
 * lateral indexado por la HORA DE LA PELEA no toca ni un byte de lo que ya
 * está, que es la misma regla que ya siguen `loot.ndjson` y `aa.ndjson`.
 *
 * Las peleas nuevas no pasan por aquí: nacen con `takenByStance` dentro, porque
 * añadir al final no corre nada.
 *
 * DOS COSAS VIAJAN EN ESTE FICHERO, no una:
 *   `takenByStance`  el reparto medido, releído del registro.
 *   `serie`          los tres cubos de daño recibido por segundo, dispersos:
 *                    sólo los segundos en que entró algo. SUSTITUYEN a los
 *                    guardados, no se restan de ellos.
 *   `motivo`         por qué una pelea NO lo tiene. Que se quedara fuera es un
 *                    hecho con causa, y la causa tiene que viajar con ella: sin
 *                    el motivo, dentro de tres meses una pelea en el modelo
 *                    viejo es indistinguible de un fallo de la migración.
 *
 * LA SERIE NO SE PODÍA ARREGLAR AL LEER, y por eso viaja aquí. `tSpell` guarda
 * la suma ya fundida de mágico + periódico + escudo por segundo, sin ninguna
 * pareja al lado de la que restar. Los totales de `dot` y `ds` de la pelea sí
 * están en `rawTakenByType`, pero repartir un total entre las fases sería
 * inventarse la distribución. Hay que releer el registro, y eso es lo que hace
 * la migración.
 *
 * Y SE SUSTITUYE ENTERA EN VEZ DE RESTARLE UN TROZO, que fue el primer diseño y
 * era falso. La serie guardada no sólo tiene el daño periódico FUNDIDO en el
 * cubo mágico: lo tiene además INFLADO, porque se escribió cuando la postura
 * todavía revertía `dot` y `ds`, y con decimales, porque el redondeo por golpe
 * llegó después y nunca alcanzó a la serie. Restar lo no mitigable de un cubo
 * que arrastra los dos errores deja un resto que no describe nada. Medido: 5.321
 * puntos de serie fraccionarios en 278 de las 441 peleas.
 */
function aplicarTramos(f, at, tramos) {
  const e = tramos?.get(at);
  if (!e) return f;
  if (e.motivo) f.motivo = e.motivo;
  // La guarda va contra el DATO y no contra el número de modelo: si la serie ya
  // trae su tercer cubo, ya está reconstruida y no hay nada que sustituir.
  if (Array.isArray(e.serie) && Array.isArray(f.series)
      && !f.series.some((p) => typeof p.tUnmit === 'number')) {
    const por = new Map(f.series.map((p) => [p.s, p]));
    // Se ponen a cero los tres antes de repoblar: los segundos que la relectura
    // deja vacíos tienen que quedar vacíos, no conservar lo que hubiera antes.
    for (const p of f.series) { p.tMelee = 0; p.tSpell = 0; p.tUnmit = 0; }
    for (const [s, mele, mag, sin] of e.serie) {
      const p = por.get(s);
      if (!p) continue;
      p.tMelee = mele; p.tSpell = mag; p.tUnmit = sin;
    }
  }
  if (Array.isArray(e.takenByStance) && e.takenByStance.length && f.rows) {
    const mio = f.rows.find((r) => r.name === e.self);
    if (mio && !mio.takenByStance) mio.takenByStance = e.takenByStance;
  }
  if (Number(e.modelo)) f.modelo = Math.max(Number(f.modelo) || 0, Number(e.modelo));
  return f;
}

/**
 * La dificultad que falta, sacada de la zona que sí está guardada.
 *
 * Hasta ahora, una zona sin modo ni etiqueta —«The Plane of Sky»— se guardaba
 * con `diff: null`, «no consta». Es que vale 0: en EQL el silencio sobre la
 * dificultad ES la dificultad base. Con la regla corregida, las peleas que ya
 * estaban guardadas seguirían sin asignar hasta reconstruir el histórico.
 *
 * No hace falta: la dificultad sale ENTERA del nombre de zona, y el nombre de
 * zona sí está guardado. Así que se recalcula al leer, en memoria, como ya se
 * hacía con el `uid` que faltaba en los índices viejos. Ningún fichero se toca,
 * y una reconstrucción posterior escribe exactamente lo mismo.
 *
 * Se recalcula SÓLO si falta. Lo que ya trae dificultad se respeta: puede venir
 * de una etiqueta que hoy no supiéramos leer.
 */
function rehacerDif(s) {
  if (!s || s.diff !== null && s.diff !== undefined) return s;
  if (!s.zone) return s;                       // sin zona no se deduce nada
  const z = parseZone(s.zone);
  s.diff = z.diff;
  if (s.diffTag === null || s.diffTag === undefined) s.diffTag = z.tag;
  if (s.zoneBase === null || s.zoneBase === undefined) s.zoneBase = z.base;
  return s;
}

/** Generación de un almacén ya marcado. Lo que no sea un número es anterior. */
export function generacion(meta) {
  const v = Number(meta?.version);
  return Number.isFinite(v) ? v : 0;
}

export class FightStore {
  constructor(dir, self = null) {
    this.dir = dir;
    /** Tu nombre. Hace falta para anotar tu daño en cada resumen. */
    this.self = self;
    this.dataPath = path.join(dir, 'fights.ndjson');
    this.idxPath = path.join(dir, 'fights.idx');
    // Botín recogido sin ninguna pelea a la que colgarlo. Fichero propio y no
    // un campo de las peleas, porque no pertenece a ninguna: recoger algo es un
    // suceso tuyo y existe aunque no hubiera combate. Ver `orphanLoot`.
    this.lootPath = path.join(dir, 'loot.ndjson');
    this.orphanLoot = [];
    this.lootSeen = new Set();
    // Puntos de habilidad, con su hora. Fichero aparte por lo mismo que el
    // botín sin pelea: no pertenecen a ningún combate, pasan entre unos y
    // otros. Si el fichero no está, no hay hitos y ya está — no es un error.
    this.aaPath = path.join(dir, 'aa.ndjson');
    this.aa = [];
    this.aaSeen = new Set();
    // El daño por postura de las peleas viejas, y el motivo de las que no lo
    // tienen. Fichero aparte para no correr los bytes de `fights.ndjson`, que
    // es donde vive la identidad de cada pelea. Ver `aplicarTramos`.
    this.tramosPath = path.join(dir, 'tramos.ndjson');
    this.tramos = new Map();   // hora de la pelea -> {self, takenByStance, modelo, motivo}
    // El libro de hechizos: los que CONSTA que tienes, y de qué línea consta.
    // Fichero aparte por lo mismo que los puntos: escribir o comprar un hechizo
    // pasa fuera de cualquier pelea.
    this.spellsPath = path.join(dir, 'spells.ndjson');
    this.spellbook = [];
    this.spellSeen = new Set();
    this.index = [];        // resúmenes, del más reciente al más antiguo
    this.cache = new Map(); // uid -> pelea completa, para no releer el disco
    this.byUid = new Map();
    this.seen = new Map();  // identidad lógica -> resumen, para no duplicar
    this.dropped = 0;       // duplicados descartados al cargar
  }

  /** Con qué versión se escribió lo que hay guardado. */
  meta() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, META), 'utf8')); }
    catch { return null; }
  }

  stamp(version = STORE_VERSION) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, META),
        JSON.stringify({ version, at: Date.now() }, null, 2));
      return true;
    } catch { return false; }
  }

  /**
   * ¿Hay que releer el log?
   *
   * Sólo si ya hay peleas guardadas: un almacén vacío no tiene nada que
   * corregir, se marca y en paz. Sin marca y con peleas dentro significa que lo
   * escribió una versión anterior a que la marca existiera, o sea la 1.0.x.
   */
  migration() {
    const m = this.meta();
    const fights = this.index.length;
    const from = m?.version ?? null;
    if (!fights) return { needed: false, from, fights, current: STORE_VERSION };
    return {
      needed: generacion(m) < STORE_VERSION,
      from, fights, current: STORE_VERSION,
    };
  }

  /**
   * Resumen: lo justo para la lista y los filtros.
   *
   * @param {string|null} self  tu nombre, para anotar tu daño en la pelea. Si no
   *   se sabe, el campo NO se escribe: un cero afirmaría que no pegaste nada.
   */
  static summary(f, at, off, len, self = null) {
    const mio = self ? (f.rows ?? []).find((r) => r.name === self) : null;
    return {
      // `uid` identifica; `id` sólo se conserva para mostrarlo y exportarlo.
      uid: off, id: f.id, at, off, len,
      label: f.label, zone: f.zone,
      // La dificultad va también en el índice: el filtro y el expediente la
      // necesitan sin abrir cada pelea del disco.
      zoneBase: f.zoneBase ?? null, diff: f.diff ?? null, diffTag: f.diffTag ?? null,
      // El nivel también: emparejar las mejores marcas sin él no significa nada.
      level: f.level ?? null,
      duration: f.duration, total: f.total, raidDps: f.raidDps,
      enemyTotal: f.enemyTotal, enemyDps: f.enemyDps,
      healing: f.healing, kills: f.kills, losses: f.losses,
      // Nombres de los enemigos, para poder filtrar sin abrir la pelea.
      foes: (f.rows ?? []).filter((r) => r.side === 'enemy').map((r) => r.name),
      // Y los de tu bando, por lo mismo: es lo que permite filtrar por
      // compañero sin abrir 160 registros del disco en cada tecleo.
      allies: (f.rows ?? []).filter((r) => r.side !== 'enemy').map((r) => r.name),
      // Los nombres del botín van en el índice: así el aviso al pasar el ratón
      // por una pelea no obliga a leerla entera del disco.
      loot: (f.loot ?? []).map((l) => l.item),
      // TU daño en esa pelea. `raidDps` es el del grupo entero, y con él no se
      // puede hablar de tu progresión: sube porque entró un compañero que pega
      // más. Va aquí y no se deduce al consultar porque si no habría que abrir
      // dos mil registros del disco para dibujar una lista.
      ...(mio ? { mine: mio.damage ?? 0 } : {}),
    };
  }

  load() {
    this.index = [];
    this.byUid.clear();
    this.seen.clear();
    this.dropped = 0;
    this.#loadLoot();
    this.#loadAA();
    this.#loadSpells();
    this.#loadTramos();
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const s = JSON.parse(line);
          // Índices escritos antes de que `uid` existiera: el byte de inicio ya
          // estaba ahí, así que la migración no toca ningún fichero.
          if (s.uid === undefined) s.uid = s.off;
          rehacerDif(s);
          const k = logicalKey(s);
          // La misma pelea guardada dos veces por una relectura del log. Se
          // queda la primera copia; el .ndjson no se toca.
          if (this.seen.has(k)) { this.dropped++; continue; }
          this.seen.set(k, s);
          this.index.push(s);
          this.byUid.set(s.uid, s);
        } catch { /* línea a medias por un cierre brusco: se ignora */ }
      }
    } catch { /* aún no hay nada guardado */ }
    this.index.sort((a, b) => b.at - a.at);
    // Con lo que se sepa ahora. Si aún no se sabe quién eres, `mine` se
    // rellenará cuando el motor lo sepa y vuelva a llamar.
    this.lastBackfill = this.backfill(this.self);
    return this.index.length;
  }

  /**
   * Rellena los campos del resumen que un índice viejo no traía.
   *
   * El índice es dato DERIVADO —el .ndjson es la fuente y no se toca nunca—,
   * así que esto no es una migración de datos: es recalcular un resumen. Por
   * eso no hace falta releer el log. Medido sobre un almacén real de 160 peleas
   * y 2,5 MB: 34 ms, y el índice pasa de 76 a 81 KB.
   *
   * Se escribe en un fichero aparte y se renombra encima. Si el proceso muere a
   * medias, el índice de antes sigue entero: lo peor que pasa es que se vuelva
   * a intentar en el siguiente arranque.
   *
   * @param {string|null} self  hace falta para `mine`, que es TU daño. Sin él
   *   ese campo no se rellena: se reintentará cuando se sepa quién eres.
   * @returns {number} cuántos resúmenes se han completado
   */
  backfill(self = null) {
    const faltan = this.index.filter((s) => s.allies === undefined
      || (self && s.mine === undefined));
    if (!faltan.length) return 0;
    let fd = null;
    try { fd = fs.openSync(this.dataPath, 'r'); } catch { return 0; }
    let hechos = 0;
    for (const s of faltan) {
      try {
        const buf = Buffer.allocUnsafe(s.len);
        fs.readSync(fd, buf, 0, s.len, s.off);
        const f = JSON.parse(buf.toString('utf8'));
        if (s.allies === undefined) {
          s.allies = (f.rows ?? []).filter((r) => r.side !== 'enemy').map((r) => r.name);
        }
        if (self && s.mine === undefined) {
          const mio = (f.rows ?? []).find((r) => r.name === self);
          // Si no sales en la pelea, tu daño en ella es cero de verdad: estuvo
          // guardada porque pasó algo, no porque tú estuvieras.
          if (mio) s.mine = mio.damage ?? 0;
          else s.mine = 0;
        }
        hechos++;
      } catch {
        // Registro ilegible: se deja sin rellenar en vez de poner una lista
        // vacía o un cero, que afirmarían que no había nadie o que no pegaste.
        // El filtro por compañero descarta lo que no consta, que es lo honesto.
      }
    }
    fs.closeSync(fd);
    try {
      const tmp = `${this.idxPath}.tmp`;
      // El índice se guarda del más reciente al más antiguo en memoria, pero en
      // disco va en orden de escritura: se reescribe por `off`, que es el orden
      // real del fichero de datos.
      const lineas = [...this.index].sort((a, b) => a.off - b.off)
        .map((s) => JSON.stringify(s)).join('\n');
      fs.writeFileSync(tmp, `${lineas}\n`);
      fs.renameSync(tmp, this.idxPath);
    } catch { /* sin permisos: se reintenta en el próximo arranque */ }
    return hechos;
  }

  /**
   * Añade una pelea. Devuelve su resumen.
   *
   * Si esa pelea ya está guardada devuelve la que había sin escribir nada: así
   * releer el log entero es idempotente y deja de multiplicar el histórico.
   */
  /**
   * Botín recogido sin ninguna pelea a la que colgarlo.
   *
   * Fichero aparte y no un campo dentro de una pelea, porque no pertenece a
   * ninguna: el cadáver lo remató entero un compañero y ese combate nunca fue
   * tuyo. Lo que sí es tuyo es haberlo recogido, y eso pasó.
   *
   * Se deduplica por (hora, objeto, de quién) para que releer el registro no lo
   * cuente dos veces, igual que las peleas se deduplican por su identidad
   * lógica. Sin esto, cada reconstrucción sumaría otra copia de cada objeto.
   */
  appendLoot(e) {
    if (!e?.item) return null;
    const clave = `${Math.round(e.t ?? 0)}:${e.item}:${e.from ?? ''}`;
    if (this.lootSeen.has(clave)) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const fila = { ...e, k: clave };
      fs.appendFileSync(this.lootPath, `${JSON.stringify(fila)}\n`);
      this.lootSeen.add(clave);
      this.orphanLoot.push(fila);
      return fila;
    } catch { return null; }
  }

  /**
   * Un punto de habilidad ganado, con su hora.
   *
   * Se deduplica por hora porque releer el registro vuelve a generarlos, igual
   * que las peleas. El saldo se guarda tal cual lo dijo el juego: es el que le
   * quedaba SIN gastar, no el total, y de sus caídas se deduce lo gastado.
   */
  appendAA(e) {
    const t = Math.round(e?.t ?? 0);
    if (!t || this.aaSeen.has(t)) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const fila = { t, at: e.at ?? t * 1000, balance: e.balance ?? null };
      fs.appendFileSync(this.aaPath, `${JSON.stringify(fila)}\n`);
      this.aaSeen.add(t);
      this.aa.push(fila);
      return fila;
    } catch { return null; }
  }

  /**
   * «Este hechizo lo tienes», con la línea que lo dice.
   *
   * Tres procedencias y las tres cuentan, pero no dicen lo mismo:
   *
   *   escrito      «You have finished scribing X» — lo pusiste en el libro.
   *   comprado     «You purchased 1 Spell: X from Y» — lo pagaste.
   *   memorizado   «Beginning to memorize X» — lo llevabas puesto. Es la más
   *                floja de las tres como prueba de posesión, y a la vez la más
   *                abundante: 2.328 líneas en un registro real contra 22 de
   *                escritura. Se guarda cuál fue.
   *
   * Se deduplica por (hechizo, procedencia): memorizar el mismo cien veces es
   * un hecho una vez.
   */
  appendSpell(e) {
    if (!e?.name || !e?.via) return null;
    const clave = `${e.name}\u0000${e.via}`;
    if (this.spellSeen.has(clave)) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const fila = { name: e.name, via: e.via, t: Math.round(e.t ?? 0), at: e.at ?? null };
      fs.appendFileSync(this.spellsPath, `${JSON.stringify(fila)}\n`);
      this.spellSeen.add(clave);
      this.spellbook.push(fila);
      return fila;
    } catch { return null; }
  }

  #loadSpells() {
    this.spellbook = [];
    this.spellSeen = new Set();
    try {
      for (const line of fs.readFileSync(this.spellsPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.name || !e?.via) continue;
          const k = `${e.name}\u0000${e.via}`;
          if (this.spellSeen.has(k)) continue;
          this.spellSeen.add(k);
          this.spellbook.push(e);
        } catch { /* línea rota: se salta */ }
      }
    } catch { /* sin fichero: el libro sale de lo que se haya lanzado */ }
  }

  /**
   * El daño por postura de las peleas viejas. Ver `aplicarTramos`.
   *
   * Sólo se AÑADE al final, como los demás ficheros laterales, así que una
   * migración que se repita deja líneas repetidas para la misma pelea. Gana la
   * ÚLTIMA: es la que escribió la migración más reciente, y así volver a pasarla
   * corrige en vez de duplicar.
   */
  #loadTramos() {
    this.tramos = new Map();
    try {
      for (const line of fs.readFileSync(this.tramosPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.at) continue;
          this.tramos.set(e.at, e);
        } catch { /* línea rota: se salta, como en el índice */ }
      }
    } catch { /* sin fichero: ninguna pelea vieja tiene su reparto */ }
  }

  /**
   * Anota el reparto por postura de una pelea ya guardada, o el motivo de que
   * no lo tenga. Lo escribe la migración; en directo no hace falta, porque las
   * peleas nuevas nacen con el reparto dentro.
   */
  appendTramos(e) {
    if (!e?.at) return false;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.tramosPath, `${JSON.stringify(e)}\n`);
      this.tramos.set(e.at, e);
      // La pelea puede estar en la caché con la forma vieja: se retira para que
      // la próxima lectura la traiga ya con su reparto.
      const sm = this.index.find((x) => x.at === e.at);
      if (sm) this.cache.delete(sm.uid);
      return true;
    } catch { return false; }
  }

  #loadAA() {
    this.aa = [];
    this.aaSeen = new Set();
    try {
      for (const line of fs.readFileSync(this.aaPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.t || this.aaSeen.has(e.t)) continue;
          this.aaSeen.add(e.t);
          this.aa.push(e);
        } catch { /* línea rota: se salta */ }
      }
      this.aa.sort((a, b) => a.t - b.t);
    } catch { /* sin fichero: no hay puntos anotados */ }
  }

  #loadLoot() {
    this.orphanLoot = [];
    this.lootSeen = new Set();
    try {
      for (const line of fs.readFileSync(this.lootPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.item || this.lootSeen.has(e.k)) continue;
          this.lootSeen.add(e.k);
          this.orphanLoot.push(e);
        } catch { /* línea rota: se salta, como en el índice */ }
      }
    } catch { /* sin fichero: no hay botín huérfano y no es un problema */ }
  }

  append(fight, at = Date.now()) {
    if (!fight) return null;
    const dup = this.seen.get(logicalKey({ at, total: fight.total, duration: fight.duration }));
    if (dup) return dup;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const body = JSON.stringify(fight) + '\n';
      let off = 0;
      try { off = fs.statSync(this.dataPath).size; } catch { off = 0; }
      fs.appendFileSync(this.dataPath, body);
      const s = FightStore.summary(fight, at, off, Buffer.byteLength(body), this.self);
      fs.appendFileSync(this.idxPath, JSON.stringify(s) + '\n');
      this.index.unshift(s);
      this.byUid.set(s.uid, s);
      this.seen.set(logicalKey(s), s);
      this.cache.set(s.uid, fight);
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
      return s;
    } catch { return null; }
  }

  /** Pelea completa. Se lee del disco por su posición, sin cargar el resto. */
  get(uid) {
    if (this.cache.has(uid)) return this.cache.get(uid);
    const s = this.byUid.get(uid);
    if (!s) return null;
    try {
      const fd = fs.openSync(this.dataPath, 'r');
      const buf = Buffer.allocUnsafe(s.len);
      fs.readSync(fd, buf, 0, s.len, s.off);
      fs.closeSync(fd);
      // La misma cura que en el índice: la pelea entera también lleva su
      // dificultad, y el expediente del enemigo la lee de aquí. Y el modelo de
      // medición, por lo mismo: se arregla al leer porque se puede.
      const f = aplicarTramos(
        repararModelo(rehacerDif(JSON.parse(buf.toString('utf8')))), s.at, this.tramos);
      this.cache.set(uid, f);
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
      return f;
    } catch { return null; }
  }

  /**
   * Filtra el índice.
   * @param {object} q  { sinceMs, foe, zone, mates, limit }
   */
  filter(q = {}) {
    // Una selección a mano manda sobre todo lo demás. Si has pinchado seis
    // peleas concretas, el tramo y el enemigo ya no pintan nada: dijiste
    // exactamente cuáles, y filtrarlas otra vez sólo podría quitarte alguna de
    // las que elegiste.
    if (q.uids?.length) {
      const pedidas = new Set(q.uids);
      return this.index.filter((s) => pedidas.has(s.uid));
    }
    const cut = q.sinceMs ? Date.now() - q.sinceMs : null;
    const foe = q.foe ? String(q.foe).toLowerCase() : null;
    const zone = q.zone ? String(q.zone).toLowerCase() : null;
    const mates = (q.mates ?? []).filter(Boolean);
    let out = this.index;
    if (cut !== null) out = out.filter((s) => s.at >= cut);

    // Los tres exactos son para la enciclopedia, y son otra pregunta que los de
    // arriba. `foe` busca lo que escribes y por eso hace «contiene»: tecleas
    // «naga» y salen los Nagafen. La enciclopedia no busca, señala una ficha
    // concreta, y con «contiene» «a fear guardian» arrastraría a cualquier otro
    // guardián. Lo mismo con la zona: «Plane of Fear» contiene a las cinco
    // dificultades a la vez, que es justo lo que hay que separar.
    if (q.foeExact) out = out.filter((s) => (s.foes ?? []).includes(q.foeExact));
    if (q.zoneBase) {
      out = out.filter((s) => (s.zoneBase ?? null) === q.zoneBase);
    }
    // `diff: null` es un valor que se filtra —«no se sabe ni la zona»— y no «no
    // filtres». Se distingue por que la clave venga o no, no por su valor.
    if (Object.hasOwn(q, 'diff') && q.diff !== undefined) {
      out = out.filter((s) => (s.diff ?? null) === q.diff);
    }
    if (mates.length) {
      // TODOS los marcados, no cualquiera de ellos. Comparar lo que ha hecho
      // cada uno sólo significa algo si en todas las peleas estaba la misma
      // gente: con «alguno», tu porcentaje sale de un conjunto donde a veces
      // faltaba uno, y entonces no compara nada.
      //
      // «Estuvieron todos» no es «sólo ellos»: una pelea donde además ayudó un
      // cuarto cuenta, y debe contar — estuvisteis.
      out = out.filter((s) => Array.isArray(s.allies)
        && mates.every((m) => s.allies.includes(m)));
    }
    if (foe) {
      out = out.filter((s) => (s.label ?? '').toLowerCase().includes(foe)
        || (s.foes ?? []).some((n) => n.toLowerCase().includes(foe)));
    }
    if (zone) out = out.filter((s) => (s.zone ?? '').toLowerCase().includes(zone));
    return q.limit ? out.slice(0, q.limit) : out;
  }

  /** Enemigos vistos, por frecuencia: alimenta el desplegable del filtro. */
  foeList(sinceMs = null) {
    const cut = sinceMs ? Date.now() - sinceMs : null;
    const count = new Map();
    for (const s of this.index) {
      if (cut !== null && s.at < cut) continue;
      for (const n of s.foes ?? []) count.set(n, (count.get(n) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([name, n]) => ({ name, n }));
  }

  stats() {
    let bytes = 0;
    try { bytes = fs.statSync(this.dataPath).size; } catch { /* aún vacío */ }
    return {
      fights: this.index.length, bytes, oldest: this.index.at(-1)?.at ?? null,
      // Copias descartadas al cargar: el pie de la lista puede decirlo en vez de
      // que el resumen sume menos peleas de las que anuncia sin explicar por qué.
      dropped: this.dropped,
    };
  }

  /**
   * Revisión completa del almacén: lee todos los registros de verdad.
   *
   * Cuesta un segundo con miles de peleas, así que no se hace al arrancar. Es lo
   * que usa `npm run store:check` para responder a «¿está sano el histórico?»
   * con números y no con fe.
   */
  audit() {
    const out = { lines: 0, corruptIdx: 0, fights: this.index.length, duplicates: this.dropped,
      unreadable: 0, idCollisions: 0, uidCollisions: 0, bytes: 0 };
    try { out.bytes = fs.statSync(this.dataPath).size; } catch { /* vacío */ }
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        out.lines++;
        try { JSON.parse(line); } catch { out.corruptIdx++; }
      }
    } catch { /* aún no hay nada */ }

    const ids = new Map(); const uids = new Set();
    let fd = null;
    try { fd = fs.openSync(this.dataPath, 'r'); } catch { /* aún no hay nada */ }
    for (const s of this.index) {
      ids.set(s.id, (ids.get(s.id) ?? 0) + 1);
      if (uids.has(s.uid)) out.uidCollisions++;
      uids.add(s.uid);
      if (fd === null) { out.unreadable++; continue; }
      try {
        const buf = Buffer.allocUnsafe(s.len);
        fs.readSync(fd, buf, 0, s.len, s.off);
        JSON.parse(buf.toString('utf8'));
      } catch { out.unreadable++; }
    }
    if (fd !== null) fs.closeSync(fd);
    out.idCollisions = [...ids.values()].filter((n) => n > 1).length;
    return out;
  }
}


export { RANGES };
