/**
 * Diccionario de patrones — calibrado contra 6.040 líneas reales de EQL
 * (Campeon / erudin, agosto 2026).
 *
 * Hallazgos que obligaron a reescribirlo:
 *  1. EQL marca el resultado ENTRE PARÉNTESIS al final de la línea:
 *       "You hit X for 1024 points of magic damage by Drain Spirit. (Critical)"
 *       "You slash X for 100 points of damage. (Riposte)"
 *       "Xasaner pierces X for 37 points of damage. (Flurry)"
 *     Sin contemplarlo, esas líneas se descartaban enteras: daño perdido y
 *     cero críticos contabilizados.
 *  2. Curación: "You healed Campeon for 109 (1024) hit points by Drain Spirit."
 *     El número entre paréntesis es lo que habría curado sin tope.
 *  3. Daño de hechizo atribuido y con tipo, al contrario que EQ clásico.
 *  4. Tras "tries to" el verbo va en forma base, no en tercera persona.
 *  5. Los /con incluyen el nivel: "-- it appears to be quite formidable. (Lvl: 49)"
 */

export const MELEE_VERBS = {
  hit: 'hits', slash: 'slashes', pierce: 'pierces', crush: 'crushes',
  bash: 'bashes', kick: 'kicks', backstab: 'backstabs', bite: 'bites',
  claw: 'claws', gore: 'gores', maul: 'mauls', punch: 'punches',
  slam: 'slams', sting: 'stings', strike: 'strikes', smash: 'smashes',
  rend: 'rends', slice: 'slices', cleave: 'cleaves', reave: 'reaves',
  // `smite` y `shoot` faltaban, y eran daño que la aplicación TIRABA: sobre un
  // registro real, 961 líneas y 18.675 puntos.
  //
  // LA CIFRA, MEDIDA Y NO SUPUESTA. Casi todo es de un mismo compañero, y al
  // verlo se dijo que era «la mayor parte de su daño». No lo es: Kalforgelp
  // pasa de 613.528 a 632.203, un 3,0% de lo suyo. Sigue siendo un fallo —una
  // cifra mal dada en cada pelea a alguien que no puede saberlo, y él es el
  // 22,4% del daño de las 74 peleas en las que sale— pero es un 3%, no un 90%.
  //
  // `shoot` es a distancia y entra como melé porque no hay escuela propia para
  // eso: el daño se cuenta y el verbo se ve, que es mejor que perderlo.
  //
  smite: 'smites', shoot: 'shoots',
  'frenzy on': 'frenzies on',
  'round kick': 'round kicks', 'flying kick': 'flying kicks',
  'dragon punch': 'dragon punches', 'eagle strike': 'eagle strikes',
  'tail rake': 'tail rakes', 'tiger claw': 'tiger claws',
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (arr) => arr.slice().sort((a, b) => b.length - a.length).map(esc).join('|');
const V_BASE = alt(Object.keys(MELEE_VERBS));
const V_3P = alt(Object.values(MELEE_VERBS));

const N = '(\\d+)';
const A = '(.+?)';
/** Sufijo opcional: (Critical) (Riposte) (Flurry) (Strikethrough)… */
const SUF = '(?:\\s*\\(([A-Za-z][A-Za-z \'-]{1,28})\\))?';
/**
 * Lo que precede al nombre de un objeto recogido: un artículo o una cantidad.
 * «a Rusty Dagger», «an Iron Ration», «2 Bone Chips». No hay una tercera forma:
 * medido sobre 681 líneas de botín de un log real, los prefijos son exactamente
 * `a ` (513), `an ` (85) y un número (83).
 *
 * El grupo captura SÓLO la cantidad, y queda indefinido cuando vino artículo.
 */
const QTY = '(?:an?|(\\d+))\\s+';

/**
 * «2 platinum, 5 gold, 7 silver and 2 copper» -> 2572 cobres.
 *
 * Una sola cifra y no cuatro, porque cuatro no se pueden sumar entre peleas ni
 * ordenar: 1 platino y 900 cobres es más que 2 platinos... no, es menos, y esa
 * duda es justo la que no debe llegar a la ficha. El cobre es la unidad y la
 * conversión es fija: 1 platino = 10 oro = 100 plata = 1.000 cobre.
 *
 * Se guarda TAMBIÉN la frase original: si algún día aparece una quinta moneda,
 * la suma se quedaría corta en silencio y el texto es lo que permite verlo.
 */
export function enCobre(frase) {
  const P = { platinum: 1000, gold: 100, silver: 10, copper: 1 };
  let cp = 0;
  for (const [, n, m] of String(frase ?? '').matchAll(/(\d+)\s+(platinum|gold|silver|copper)/g)) cp += +n * P[m];
  return cp;
}

const rules = [
  // ═══ DAÑO DE HECHIZO / HABILIDAD (atribuido y tipado) ═══
  {
    kind: 'spell', hint: ' damage by ',
    re: new RegExp(`^${A} hit ${A} for ${N} points? of (\\w+) damage by ${A}\\.${SUF}$`),
    map: (m) => ({ source: m[1], target: m[2], amount: +m[3], damageType: m[4], ability: m[5], flag: m[6], school: 'spell', confidence: 'exact' }),
  },

  /**
   * ═══ LO QUE TE HACES TÚ, SIN HECHIZO QUE LO NOMBRE ═══
   *
   * «You hurt yourself for 40 points.» Aparece 133 veces en el registro de
   * referencia y no casaba con ninguna regla: era daño real que no se contaba
   * en ninguna parte. Es la forma corta —sin escuela ni hechizo— de la
   * autolesión; la larga («You hit yourself … by Cannibalize», 54 veces) ya
   * entraba por la regla de hechizo de arriba.
   *
   * Va como `spell` y no como `melee` porque no es un golpe: no tiene verbo, no
   * tiene precisión y no debe contar como intento de ataque. Y con origen y
   * destino iguales, el encuentro la cuenta como recibida y NO como hecha
   * —pegarte a ti mismo no es pegar—; sin esa regla, sumar esto habría inflado
   * tu propio DPS.
   */
  {
    kind: 'spell', hint: 'yourself',
    re: new RegExp(`^You hurt yourself for ${N} points?\\.${SUF}$`),
    map: (m) => ({ source: 'You', target: 'yourself', amount: +m[1], flag: m[2],
      school: 'spell', damageType: 'self', confidence: 'exact' }),
  },

  // ═══ DAÑO CUERPO A CUERPO ═══
  {
    kind: 'melee', hint: 'of damage',
    re: new RegExp(`^You (${V_BASE}) ${A} for ${N} points? of damage[.!]${SUF}$`),
    map: (m) => ({ source: 'You', verb: m[1], target: m[2], amount: +m[3], flag: m[4], school: 'melee' }),
  },
  {
    kind: 'melee', hint: 'of damage',
    re: new RegExp(`^${A} (${V_3P}) ${A} for ${N} points? of damage[.!]${SUF}$`),
    map: (m) => ({ source: m[1], verb: m[2], target: m[3], amount: +m[4], flag: m[5], school: 'melee' }),
  },

  // ═══ DAÑO PERIÓDICO ═══
  {
    kind: 'dot', hint: 'has taken',
    re: new RegExp(`^${A} has taken ${N} damage from your ${A}\\.$`),
    map: (m) => ({ source: 'You', target: m[1], amount: +m[2], ability: m[3], school: 'dot', confidence: 'exact' }),
  },
  {
    kind: 'dot', hint: 'has taken',
    re: new RegExp(`^${A} has taken ${N} damage from ${A} by ${A}\\.$`),
    map: (m) => ({ source: m[4], target: m[1], amount: +m[2], ability: m[3], school: 'dot', confidence: 'exact' }),
  },
  {   // "Xasaner has taken 3 damage by Strong Disease." — sin emisor
    kind: 'dot', hint: 'has taken',
    re: new RegExp(`^${A} has taken ${N} damage by ${A}\\.$`),
    map: (m) => ({ source: 'Unknown', target: m[1], amount: +m[2], ability: m[3], school: 'dot', confidence: 'none' }),
  },
  {   // "You have taken 3 damage from Strong Disease by a fetid fiend."
    kind: 'dot', hint: 'have taken',
    re: new RegExp(`^You have taken ${N} damage from ${A} by ${A}\\.$`),
    map: (m) => ({ source: m[3], target: 'You', amount: +m[1], ability: m[2], school: 'dot', confidence: 'exact' }),
  },

  // ═══ DAMAGE SHIELD ═══
  {
    kind: 'ds', hint: 'non-melee damage',
    re: new RegExp(`^${A} (?:is|are) (\\w+) by ${A} for ${N} points? of non-melee damage[.!]${SUF}$`),
    map: (m) => ({ victim: m[1], verb: m[2], effect: m[3], amount: +m[4], flag: m[5], school: 'ds' }),
  },
  {
    kind: 'ds_absorbed', hint: 'magical skin absorbs',
    re: new RegExp(`^${A}'s magical skin absorbs the damage of YOUR ${A}\\.$`),
    map: (m) => ({ target: m[1], ability: m[2] }),
  },
  {
    kind: 'ds_nodmg', hint: ' is ',
    re: new RegExp(`^${A} (?:is|are) (\\w+) by ${A}[.!]$`),
    map: (m) => ({ victim: m[1], verb: m[2], effect: m[3] }),
  },
  {
    kind: 'nonmelee_orphan', hint: 'was hit by non-melee',
    re: new RegExp(`^${A} was hit by non-melee for ${N} points? of damage\\.`),
    map: (m) => ({ source: null, target: m[1], amount: +m[2], school: 'spell' }),
  },

  // La runa absorbe un golpe entero. No es daño ni es curación: es daño que
  // NO llegó, y por eso va en su propio sitio en vez de sumarse a nada.
  //
  // Son 29 líneas en el registro de referencia y eso hay que decirlo con la
  // cifra al lado: con veintinueve datos no se saca ninguna proporción.
  { kind: 'absorb', hint: 'gain a rune',
    re: /^You gain a rune for (\d+) points? of absorption\.$/,
    map: (m) => ({ target: 'You', amount: +m[1] }) },

  // ═══ FALLOS Y MITIGACIÓN (verbo en forma base tras "tries to") ═══
  {
    kind: 'miss', hint: 'tries to',
    re: new RegExp(`^${A} tries to (${V_BASE}) ${A}, but ${A}[!.]${SUF}$`),
    map: (m) => ({ source: m[1], verb: m[2], target: m[3], reason: m[4], flag: m[5] }),
  },
  {
    kind: 'miss', hint: 'try to',
    re: new RegExp(`^You try to (${V_BASE}) ${A}, but ${A}[!.]${SUF}$`),
    map: (m) => ({ source: 'You', verb: m[1], target: m[2], reason: m[3], flag: m[4] }),
  },
  { kind: 'avoid', hint: 'avoid the stunning', re: /^You avoid the stunning blow\.$/, map: () => ({ target: 'You' }) },
  // Dos direcciones opuestas que antes se contaban juntas:
  // "X resisted Y's Z"  -> a Y le resistieron su hechizo (malo si Y eres tú)
  // "You resist X's Z"  -> TÚ resististe el hechizo de X (bueno para ti)
  /**
   * «X resisted your Spell!» — TU hechizo, resistido. 955 líneas que se tiraban.
   *
   * VA ANTES QUE LA DE ABAJO Y NO LA SUSTITUYE: la de abajo casa 2.535 líneas
   * legítimas —el hechizo de otro, resistido— y se queda como está.
   *
   * EL APÓSTROFO ERA LA TRAMPA. La regla del posesivo pide `(.+?)'s` y `your`
   * no lo lleva… pero el NOMBRE DEL HECHIZO sí puede llevarlo, y entonces
   * casaba por el sitio equivocado: «resisted your Oathbreaker's Curse!» daba
   * un lanzador llamado «your Oathbreaker» y un hechizo llamado «Curse». 66
   * veces en el registro. No se vio nunca porque ese lanzador inventado no está
   * en `#mine()` y la rama entera se descartaba — un dato falso que se salvó de
   * pintarse por una guarda que lo rechazaba por el motivo equivocado.
   *
   * `Charm` se queda fuera con un `(?!Charm!)`: tiene su propia regla de ruido
   * más abajo y se descarta POR DECISIÓN. Sin esta exclusión pasaría a ser una
   * resistencia normal, porque esta regla se declara antes y su pista gana.
   */
  { kind: 'resist', hint: 'resisted your', re: /^(.+?) resisted your (?!Charm!)(.+?)!$/,
    map: (m) => ({ target: m[1], caster: 'You', ability: m[2] }) },
  { kind: 'resist', hint: 'resisted', re: /^(.+?) resisted (.+?)'s (.+?)!$/, map: (m) => ({ target: m[1], caster: m[2], ability: m[3] }) },
  { kind: 'resist_by_you', hint: 'You resist', re: /^You resist (.+?)'s (.+?)!$/, map: (m) => ({ caster: m[1], ability: m[2], target: 'You' }) },
  /**
   * EL RECHAZO POR PROTECCIÓN: 2.665 líneas que iban al cajón.
   *
   * No es una resistencia y por eso no comparte `kind` con ellas. Una
   * resistencia es tu tirada contra el hechizo; esto es un hechizo que NI
   * SIQUIERA LLEGA A LANZARSE contra ti, porque algo activo lo rechaza antes.
   * Contarlas juntas mezclaría «aguanté» con «ni me tocó», que son dos cosas
   * que se consiguen de maneras distintas.
   *
   * Es la contrapartida observable de un buff puesto: la única forma que tiene
   * el registro de decir que una protección estaba funcionando.
   */
  { kind: 'ward', hint: 'but you are protected', re: /^(.+?) tries to cast a spell on you, but you are protected\.$/,
    map: (m) => ({ caster: m[1], target: 'You' }) },

  // ═══ CRÍTICOS EN LÍNEA APARTE (formato clásico, por si acaso) ═══
  { kind: 'crit', hint: 'critical', re: /^You (?:score|deliver) a critical (?:hit|blast)! \((\d+)\)/, map: (m) => ({ source: 'You', amount: +m[1] }) },
  { kind: 'crit', hint: 'critical', re: /^(.+?) (?:scores|delivers) a critical (?:hit|blast)! \((\d+)\)/, map: (m) => ({ source: m[1], amount: +m[2] }) },

  // ═══ CURACIÓN ═══
  {   // "You healed Campeon for 109 (1024) hit points by Drain Spirit."
    kind: 'heal', hint: 'healed',
    re: new RegExp(`^${A} healed ${A} for ${N}(?: \\(${N}\\))? hit ?points?(?: by ${A})?\\.${SUF}$`),
    map: (m) => ({ source: m[1], target: m[2], amount: +m[3], potential: m[4] ? +m[4] : null, ability: m[5] ?? 'cura', flag: m[6] }),
  },
  {
    kind: 'heal', hint: 'been healed',
    re: new RegExp(`^You have been healed for ${N}`),
    map: (m) => ({ source: null, target: 'You', amount: +m[1] }),
  },
  { kind: 'noise', hint: 'feels much better', re: /^(.+?) feels much better\.$/, map: (m) => ({ who: m[1] }) },

  // ═══ CASTEO ═══
  /**
   * EMPEZAR A LANZAR NO ES ACTUAR. Es una intención, y a veces una denegada.
   *
   * LA REGLA, y generaliza más allá del sitio donde se descubrió: un «begin
   * casting» SIN DESENLACE no es actividad, es un intento que el juego rechazó.
   * Un lanzamiento de verdad acaba en algo —impacto, resistencia, interrupción,
   * «you can't use that command right now»— y el registro lo escribe.
   *
   * DE DÓNDE SALE, medido: dentro de los 31 tramos de miedo del registro de
   * referencia hay 24 líneas de «You begin casting Ensnare.» repartidas por 10
   * de ellos, y NINGUNA tiene desenlace. Ese mismo Ensnare, fuera de los tramos,
   * sale interrumpido 6 veces y resistido 9. O sea que dentro del miedo la línea
   * es la tecla aporreada, no un acto del personaje.
   *
   * DÓNDE IMPORTA, comprobado uno por uno: `cadencia()` y `swingSeconds` sólo se
   * alimentan de golpes y fallos, `activeSeconds` de golpes, fallos, daño
   * recibido y curaciones — ninguna suma casteos, así que ninguna medida de
   * actividad estaba contando intención como trabajo. Lo que sí los cuenta es la
   * LÍNEA DE TIEMPO de lanzamientos y el número de la pestaña, y ahí es
   * correcto: la pregunta es «¿qué intentaste y cuándo?».
   *
   * Si algún día alguien mide actividad con `casts`, esto es lo que hay que
   * leer antes.
   */
  { kind: 'cast', hint: 'begin casting', re: /^You begin casting (.+?)\.$/, map: (m) => ({ source: 'You', ability: m[1] }) },
  { kind: 'cast', hint: 'begins casting', re: /^(.+?) begins casting (.+?)\.$/, map: (m) => ({ source: m[1], ability: m[2] }) },
  /**
   * CANTAR ES LANZAR, y llevaba 355 líneas sin serlo.
   *
   * Un bardo no «castea», canta, y el registro lo escribe con otro verbo. Sin
   * esta regla la línea entera se iba al cajón de las no reconocidas: medido
   * sobre el registro de referencia, 355 cánticos invisibles, y de ellos 253 de
   * un compañero bardo del grupo y 52 del jefe del Plano del Miedo.
   *
   * LO QUE COSTABA NO ERA EL RECUENTO. Entre esas líneas están las 53 de
   * `Solon's Bewitching Bravura`, que es la canción de ENCANTO del jefe: la
   * única señal escrita que existe de por qué un compañero se puso a pegarle al
   * grupo. La línea no dice a quién encantó —eso sigue sin saberse— pero decir
   * «el jefe cantó un encanto ocho veces en esta pelea» es un hecho medido, y
   * hasta ahora ni siquiera eso se podía decir.
   *
   * Va con el mismo `kind` que el casteo y no con uno propio: para todo lo que
   * viene detrás —la línea de tiempo, el consejo, el aviso hablado— es el mismo
   * suceso. Que uno se cante y otro se recite es del sabor, no de la cuenta.
   */
  { kind: 'cast', hint: 'begins singing', re: /^(.+?) begins singing (.+?)\.$/, map: (m) => ({ source: m[1], ability: m[2] }) },
  { kind: 'cast', hint: 'begins to cast', re: /^(.+?) begins to cast a spell\.$/, map: (m) => ({ source: m[1], ability: null }) },
  { kind: 'cast_recover', hint: 'concentration', re: /^You regain your concentration/, map: () => ({}) },
  { kind: 'cast_recover', hint: 'concentration', re: /^(.+?) regains concentration and continues casting\.$/, map: (m) => ({ source: m[1] }) },
  { kind: 'interrupt', hint: 'is interrupted', re: /^(?:Your|(.+?)'s) (.+?) spell is interrupted\.$/, map: (m) => ({ source: m[1] ?? 'You', ability: m[2] }) },

  // ═══ MUERTES ═══
  { kind: 'death', hint: 'slain', re: /^You have slain (.+?)!$/, map: (m) => ({ victim: m[1], killer: 'You' }) },
  // Tu propia muerte usa "have", no "has": sin esta regla no se contaba.
  { kind: 'death', hint: 'slain', re: /^You have been slain by (.+?)!$/, map: (m) => ({ victim: 'You', killer: m[1] }) },
  { kind: 'death', hint: 'slain', re: /^(.+?) has been slain by (.+?)!$/, map: (m) => ({ victim: m[1], killer: m[2] }) },
  { kind: 'death', hint: ' died', re: /^(.+?) died\.$/, map: (m) => ({ victim: m[1], killer: null }) },

  // ═══ SUPERVIVENCIA ═══
  //
  // Sucesos donde un segundo de retraso cuesta el personaje. Todas estas líneas
  // están verificadas contra un log real de 62.080 líneas; al lado de cada una,
  // cuántas veces aparece en él.
  //
  // `You have been knocked unconscious!` estaba aquí como muerte, y NO lo es:
  // es el aviso previo. Siempre lo sigue, en el mismo segundo, «You have been
  // slain by X!» o «You died.», así que contaba cada muerte tuya dos veces —9
  // reales, 18 contadas—. Como aviso llega tarde para salvarte, pero explica lo
  // que acaba de pasar cuando la pantalla se pone gris.
  { kind: 'survival', hint: 'knocked unconscious', what: 'unconscious',   // 10x
    re: /^You have been knocked unconscious!$/, map: () => ({}) },

  // Feign Death roto por un hechizo: estabas tumbado y ya no.
  { kind: 'survival', hint: 'feigning death', what: 'feign',              //  3x
    re: /^You are no longer feigning death, because a spell hit you\.$/, map: () => ({}) },

  // Invisibilidad. Hay DOS sistemas y sólo uno avisa antes de caerse:
  //   skin tingle  → «starting to appear» 6 s antes → «stops tingling»
  //   vanish       → «appear», sin aviso ninguno
  // En 25 ciclos del log, 24 cayeron sin previo aviso. Por eso se avisa también
  // de la caída en sí: para Camouflage es la única señal que existe.
  { kind: 'survival', hint: 'starting to appear', what: 'invisFading',    //  1x
    re: /^You feel yourself starting to appear\.$/, map: () => ({}) },
  { kind: 'survival', hint: 'stops tingling', what: 'invisGone',          //  5x
    re: /^Your skin stops tingling\.$/, map: () => ({}) },
  { kind: 'survival', hint: 'You appear', what: 'invisGone',              // 20x
    re: /^You appear\.$/, map: () => ({}) },

  // Levitación. Avisa dos o tres veces cada 6 s y cierra con «no longer
  // levitate»: entre 6 y 12 segundos de margen. Tres de las nueve rachas del
  // log, en The Plane of Sky, donde el suelo está muy lejos.
  { kind: 'survival', hint: 'about to fall', what: 'levitateFading',      // 27x
    re: /^You feel as if you are about to fall\.$/, map: () => ({}) },
  { kind: 'survival', hint: 'longer levitate', what: 'levitateGone',      // 10x
    re: /^You can no longer levitate\.$/, map: () => ({}) },

  { kind: 'survival', hint: 'been summoned', what: 'summoned',            // 25x
    re: /^You have been summoned!$/, map: () => ({}) },
  { kind: 'survival', hint: 'invulnerability fades', what: 'invuln',      //  1x
    re: /^Your invulnerability fades\.$/, map: () => ({}) },

  // Ésta no es una alarma: es la buena noticia de que ya puedes moverte. Llega
  // uno o dos minutos después del Feign Death, no en el momento.
  { kind: 'survival', hint: 'forgotten you', what: 'forgotten',           // 13x
    re: /^Your enemies have forgotten you!$/, map: () => ({}) },

  // Sale de un /con que escribes tú, no es un peligro sobrevenido, y se repite
  // cuatro veces en dos segundos. Va por su cuenta y con deduplicación.
  { kind: 'seeinvis', hint: 'can see you',                                //  4x
    re: /^You suspect that this being can see you\.$/, map: () => ({}) },

  // ═══ ESTADOS, PROCS, MASCOTA ═══
  { kind: 'stun', hint: 'stunned', re: /^You are stunned!$/, map: () => ({ target: 'You', on: true }) },
  { kind: 'stun', hint: 'stunned', re: /^You are no longer stunned\.$/, map: () => ({ target: 'You', on: false }) },
  /**
   * CUANDO EL PERSONAJE DEJA DE SER TUYO. Los dos extremos, y los dos escritos.
   *
   *   You lose control of yourself!          31 veces en el registro de
   *   You have control of yourself again.    referencia, y 31 cierres. Ni uno
   *                                          suelto.
   *
   * Duración medida: mínimo 2 s, mediana 9 s, máximo 37 s. Treinta y siete
   * segundos de una pelea en los que lo que hace tu personaje no lo decides tú,
   * y hasta ahora la aplicación no los distinguía de estar mirando el inventario.
   *
   * QUÉ NO DICE ESTA LÍNEA, Y HAY QUE NO DECIRLO TAMPOCO: no dice si te
   * encantaron o si te dieron miedo. Es el aviso genérico de que perdiste el
   * mando. Medido sobre los 31 episodios, el último lanzamiento enemigo en los 8
   * segundos anteriores fue `Dragon Fear` 14 veces y `Solon's Bewitching
   * Bravura` 4, así que ni siquiera correlaciona limpio con una sola causa.
   *
   * LO QUE SÍ LOS SEPARA ES LA CONDUCTA, y ésa se mide: encantado le pegas a los
   * tuyos, asustado corres. En estos 31 episodios TÚ no le pegaste a un
   * compañero ni una sola vez, así que los 31 fueron miedo — y llamarlos
   * «encantado» habría sido falso 31 veces de 31. Ver `sinControl` en
   * `src/encounter.js`, que es donde se califica el tramo con lo que pasó dentro.
   */
  { kind: 'control', hint: 'control of yourself', re: /^You lose control of yourself!$/, map: () => ({ target: 'You', on: true }) },
  { kind: 'control', hint: 'control of yourself', re: /^You have control of yourself again\.$/, map: () => ({ target: 'You', on: false }) },
  { kind: 'stagger', hint: 'staggers', re: /^(.+?) staggers\.$/, map: (m) => ({ target: m[1] }) },
  { kind: 'proc', hint: 'feels alive', re: /^Your (.+?)(?: \((.+?)\))? feels alive with power\.$/, map: (m) => ({ item: m[1], effect: m[2] ?? null }) },
  /**
   * ── LAS OTRAS DOS FORMAS DE LA MISMA FAMILIA, Y EL KIND ES PROVISIONAL ───
   *
   * Medido sobre los tres registros (2,4 millones de líneas): la línea de
   * `feels alive with power` no está sola. Hay otras dos, y **ninguna la
   * reconocía nadie** — caían en desconocidas:
   *
   *     117  Your Brell's Girdle (Exaltation) shimmers briefly.
   *      63  Your Moonstone Ring (Exaltation) pulses with light as your vision
   *          sharpens.
   *
   * Con ellas, los objetos con paréntesis `(Exaltation)` son SEIS y no cuatro.
   *
   * NO VAN BAJO `proc`, y eso es deliberado: **un `kind` es una afirmación
   * sobre la mecánica del juego**, y no sabemos si esto es un proc. Lo que
   * sabemos es lo que dice la línea —un objeto tuyo con una etiqueta entre
   * paréntesis hace algo— y eso es todo lo que el nombre promete. `what`
   * separa las dos formas sin inventar una tercera cosa.
   *
   * QUÉ FALTA PARA CERRARLO, y lo contesta Campeón: si `Exaltation` es el
   * mecanismo de exaltación de objetos y no el nombre de un proc; si las tres
   * formas son el mismo suceso; y si hace algo que el registro escriba —medido,
   * ninguna línea de daño lleva esa habilidad, ni en el mismo segundo ni en los
   * treinta siguientes—. Hasta entonces se reconocen y se cuentan, que es lo
   * único afirmable. Ver el apéndice de `BARRIDO-PATRONES.md`.
   */
  { kind: 'objeto_evento', what: 'shimmers', hint: 'shimmers briefly', re: /^Your (.+?)(?: \((.+?)\))? shimmers briefly\.$/, map: (m) => ({ item: m[1], etiqueta: m[2] ?? null }) },
  { kind: 'objeto_evento', what: 'pulses', hint: 'pulses with light', re: /^Your (.+?)(?: \((.+?)\))? pulses with light as your vision sharpens\.$/, map: (m) => ({ item: m[1], etiqueta: m[2] ?? null }) },
  { kind: 'pet_frenzy', hint: 'accelerated frenzy', re: /^(.+?) enters an accelerated frenzy\.$/, map: (m) => ({ pet: m[1] }) },
  { kind: 'buff_fade', hint: 'has worn off', re: /^(?:Your pet's |Your )?(.+?) spell has worn off\.$/, map: (m) => ({ ability: m[1] }) },
  /**
   * LO QUE TE ENTRA CON NOMBRE DE EFECTO, NO DE HECHIZO.
   *
   * Había una sola regla, `been diseased`, y a su lado 1.204 líneas de la MISMA
   * forma que nadie reconocía: 576 `poisoned`, 114 `ensnared`, 83 `mesmerized`,
   * 76 `struck down by wrath`, 73 `struck by the force of Ykesha`, 52
   * `lacerated`. Le pasan a alguien, dicen QUÉ le pasa, y se iban al cajón de
   * las no reconocidas — que tiene 34.207 líneas y no lo mira nadie.
   *
   * ═══ QUÉ HAY EN ESE CAJÓN, MEDIDO Y NO SUPUESTO ═══
   *
   * 34.207 líneas de 708.240, el 4,8%. Y no son un solo montón: son TRES, con
   * tres destinos distintos, y confundirlos es lo que hacía que nadie lo mirara.
   *
   *   1. ADORNO DE UN EFECTO QUE YA ESTÁ CONTADO. Es el montón grande.
   *      «Your feet move faster» (3.049), «Your mind begins to clear» (2.884),
   *      «Your wounds begin to heal» (1.952), «X's body combusts as the lava
   *      hits them» (284). El lanzamiento y la caída de esos hechizos SÍ tienen
   *      línea y sí se guardan; esto es la frase bonita del mismo suceso, y
   *      encima muchas no nombran al sujeto. Reconocerlas no añadiría una cifra.
   *      DESTINO: quedarse fuera, y que esté escrito por qué.
   *
   *   2. NO ES COMBATE. «Your faction standing with X has been adjusted by N»
   *      (2.104 entre sus cuatro formas), «Your target is out of range» (389),
   *      «You already have your target's attention» (288), «Your will is not
   *      sufficient to command this weapon» (424). Son facción, avisos de la
   *      interfaz y comandos. DESTINO: fuera, y no es una deuda.
   *
   *   3. SÍ ES COMBATE Y NO TIENE REGLA. Es el montón que importa y el único
   *      que hay que mirar:
   *
   *        1.251  «X tries to cast a spell on you, but you are protected.»
   *                 Es una inmunidad, o sea un hechizo enemigo que NO entró. Va
   *                 justo al lado de `resist_by_you` y hoy no se cuenta.
   *        1.777  «X rages.»            un estado del enemigo
   *          395  «You overcome the stun!»
   *          246  «X activates X.»      habilidades con nombre
   *          196  «You go berserk.»
   *
   *      Lo de «overcome the stun» se comprobó por si era un TERCER final del
   *      aturdimiento, que habría dejado barras abiertas en el reproductor: no
   *      lo es. Los pares cierran solos.
   *
   *      Y AQUÍ HABÍA UNA EXPLICACIÓN FALSA, corregida al medirla. Decía que los
   *      cierres sobrantes eran «los que empezaron antes de que arrancara el
   *      registro, que es exactamente el extremo abierto que la barra dibuja».
   *      Medido sobre el registro entero: son ONCE —1.629 aperturas contra 1.640
   *      cierres— y DIEZ ocurren a media sesión, con horas de registro por
   *      delante y por detrás. Sólo el primero podría ser lo que decía.
   *
   *      Lo que encaja es otra cosa: un aturdimiento que aterriza sobre uno que
   *      ya estaba puesto no escribe apertura nueva y sí escribe su cierre. La
   *      ráfaga del 10 de agosto —cinco cierres entre las 01:21:59 y las
   *      01:23:06— es exactamente esa forma.
   *
   *      SE DEJA ESCRITO PORQUE UNA NOTA EQUIVOCADA ES PEOR QUE NINGUNA: ésta se
   *      citó al diseñar el extremo abierto de la barra, y de ahí salió un
   *      rótulo que afirmaba 58 segundos que nunca existieron. Ver
   *      `tramosDePista` en `ui/reproduccion.js`.
   *
   * LA REGLA AL AÑADIR ALGO AQUÍ: se enumera, no se generaliza, y se dice a cuál
   * de los tres montones pertenece lo que se deja fuera. Un cajón con tres cosas
   * dentro y un solo nombre es un cajón que nadie abre.
   *
   * SE ENUMERA LO MEDIDO Y NO SE GENERALIZA, y aquí eso no es prudencia
   * abstracta: `^(.+?) (?:have|has) been (.+?)\.$` se traga cosas que NO son
   * estados, y se ha comprobado sobre el registro entero —
   *
   *     1.426  «... has been adjusted by 5»      un ajuste de la interfaz
   *       167  «... been stunned too recently»   un aviso de inmunidad
   *       109  «... been set to on»              una opción
   *        43  «... has been charmed»            que es del encanto, y tiene su
   *                                              propia regla más abajo. Ésta
   *                                              va ANTES en el fichero, así
   *                                              que se la habría llevado y con
   *                                              ella el bando de un bicho.
   *
   * El precio de enumerar es que el día que aparezca un efecto nuevo se pierde.
   * El precio de generalizar era romper el encanto. No es un empate.
   *
   * `ability` lleva el EFECTO, no un hechizo: el registro no dice cuál fue.
   *
   * DOS COSAS QUE ESTUVIERON EN ESTA LISTA Y SE CAYERON AL COMPROBARLA:
   *
   *   `blinded`, `silenced`   los puse de memoria, por sonar a estado. En el
   *                           registro salen CERO veces. Una alternativa que no
   *                           se ha medido no es una regla, es una corazonada
   *                           que va a envejecer sin que nadie la revise.
   *   `struck down by wrath`  49 líneas, y YA tenían dueño: están en el bloque
   *                           de adorno reconocido como `noise`. Rescatar lo
   *                           que nadie reconoce es una cosa; reclasificar lo
   *                           que otro clasificó a propósito es otra, y no se
   *                           hace de pasada. La comprobación de que no se
   *                           roban líneas lo cazó.
   */
  { kind: 'debuff', hint: 'been ', map: (m) => ({ target: m[1], ability: m[2] }),
    re: /^(.+?) (?:have|has) been (poisoned|diseased|ensnared|lacerated|struck by the force of [A-Za-z']+)\.$/ },
  /**
   * EL MEZ, LAS TRES FRASES. Sale de `debuff` y pasa a tener tipo propio.
   *
   * POR QUÉ SE MUEVE. `mesmerized` estaba en la lista de `debuff` de arriba, y
   * `debuff` no lo lee NADIE: cero consumidores en todo el proyecto. Servía para
   * no dejar la línea en el cajón de las no reconocidas y para nada más. A
   * partir de la 1.14.0 el mez decide una frontera —una ventana de enemigo no se
   * cierra mientras un estado medido tape el silencio— así que necesita un tipo
   * que se pueda consultar, no un cajón compartido con el veneno.
   *
   * LAS TRES FRASES, contadas sobre el registro de referencia (850.171 líneas):
   *
   *     217  «X has been mesmerized.»                    se pone
   *     125  «X has been awakened by Y.»                  se rompe  (116 sobre bichos, 9 sobre los tuyos)
   *     228  «Your <mez> spell has worn off of X.»        caduca    (Mesmerization 171 · Enthrall 45 ·
   *                                                                 Walking Sleep 10 · Mesmerize 2)
   *
   * LAS DOS DE CIERRE CAÍAN EN `unknown`, las 353. O sea que la apertura se leía
   * y ninguno de los dos finales, que es la peor de las tres combinaciones
   * posibles: una ventana que se abre y no se cierra nunca. Con las tres, 202 de
   * los 217 mez tienen ventana con principio y final ESCRITOS; 15 se quedan sin
   * cierre y ésos son los únicos que dependen del tope.
   *
   * LA FAMILIA SE ENUMERA Y NO SE GENERALIZA, que es la regla de este fichero.
   * `^Your (.+?) spell has worn off of` se tragaría los 26 de Charm —que tienen
   * su propia regla tres líneas más abajo y deciden un bando— más Spirit of
   * Wolf, Endure Magic y otros veinte hechizos que no son control. Los cuatro
   * nombres de aquí son los que dejan «has been mesmerized» detrás, comprobado
   * emparejándolos uno a uno.
   *
   * EL NOMBRE NO DISTINGUE A NADIE, y hay que saberlo al usarlo: la línea dice
   * «a shin ghoul knight», y de ésos hay tres delante. En 92 de las 130 ventanas
   * largas hay otro homónimo mezado a la vez. Por eso esto tapa el silencio de
   * un NOMBRE, que es justo la unidad con la que trabaja el modelo de peleas, y
   * no el de un bicho.
   */
  { kind: 'mez', hint: 'has been mesmerized', what: 'on',
    re: /^(.+?) has been mesmerized\.$/, map: (m) => ({ target: m[1], on: true }) },
  { kind: 'mez', hint: 'spell has worn off of', what: 'caduca',
    re: /^Your (Mesmerization|Mesmerize|Enthrall|Walking Sleep) spell has worn off of (.+?)\.$/,
    map: (m) => ({ target: m[2], ability: m[1], on: false, cierre: 'caducado' }) },
  /**
   * «X has been awakened by Y» YA TIENE SITIO, y este comentario es el que decía
   * que no lo tenía.
   *
   * Lo que decía antes, y sigue siendo verdad: se añadió como `survival`/`feign`
   * dando por hecho que era romper el fingimiento de muerte, la comprobación de
   * que no se robaban líneas a otras reglas lo cazó —49 se las quitaba a
   * `noise`— y al mirar de quién eran, la lectura no se sostenía: de las 54 del
   * registro de entonces, sólo 6 eran de Campeon y 3 de un compañero. Las otras
   * 45 eran BICHOS. Un bicho que despierta no está fingiendo muerte: le han roto
   * el mez.
   *
   * Y lo que decía a continuación —«es un dato bueno y su sitio no es éste …
   * queda sin regla a propósito»— era correcto entonces y ha dejado de serlo: el
   * sitio existe desde que el mez tiene tipo propio. Es el cierre MEDIDO de la
   * ventana, el que dice que alguien la rompió y quién.
   *
   * Sobre los tuyos también se escribe —9 de las 125— y se lee igual: a ti
   * también te mezan. Quien decida qué hacer con eso es el encuentro, que es el
   * que sabe quién es tuyo; aquí sólo se dice lo que pone la línea.
   */
  { kind: 'mez', hint: 'has been awakened by', what: 'roto',
    re: /^(.+?) has been awakened by (.+?)\.$/,
    map: (m) => ({ target: m[1], by: m[2], on: false, cierre: 'roto' }) },
  { kind: 'stance', hint: 'stance', re: /^You assume an? (.+?) stance\.$/, map: (m) => ({ stance: m[1] }) },
  { kind: 'stance', hint: 'stance', re: /^You begin to change your stance\.$/, map: () => ({ changing: true }) },
  { kind: 'invocation', hint: 'invocation', re: /^You begin reciting the (.+?) invocation\.$/, map: (m) => ({ invocation: m[1] }) },
  { kind: 'invocation', hint: 'invocation', re: /^You begin to change your invocation\.$/, map: () => ({ changing: true }) },
  { kind: 'ability_cd', hint: 'again in', re: /^You can use the ability (.+?) again in (.+?)\.$/, map: (m) => ({ ability: m[1], left: m[2] }) },

  // ═══ CONTEXTO ═══
  //
  // Aquí había una regla `class_change` marcada como no verificada, esperando
  // un mensaje de cambio de clase. No existe: en 63.000 líneas de log real,
  // con un cambio de clase dentro, no casó ni una vez. Marcarla como no
  // verificada no bastaba — una regla que nunca casa da falsa sensación de
  // cobertura, y de paso su expresión regular habría casado con «You are now
  // A.F.K.» de no ser porque el `hint` la salvaba por casualidad.
  //
  // Lo que sí deja huella es esto: al cambiar de clase se compra y se escribe
  // el libro de hechizos entero de la clase nueva, 22 seguidos en 80 segundos.
  // Se guarda como dato. NO se infiere de aquí ningún cambio de clase: una
  // ráfaga de escrituras lo sugiere, no lo declara, y llega tarde de todas
  // formas. Quien declara las clases es el /who.
  { kind: 'scribe', hint: 'finished scribing', re: /^You have finished scribing (.+?)\.$/, map: (m) => ({ ability: m[1] }) },

  // Comprar un hechizo también deja constancia de que lo tienes, y no se
  // reconocía: 23 en un registro real, invisibles. El «Spell:» del principio es
  // lo que lo distingue de comprar una llave o una racion.
  { kind: 'spell_buy', hint: 'You purchased',
    re: /^You purchased \d+ Spell: (.+?) from (.+?) for\s+(.*)$/,
    map: (m) => ({ ability: m[1], from: m[2], price: m[3].replace(/\.$/, '').trim() }) },
  { kind: 'noise', hint: 'You purchased', re: /^You purchased \d+ (.+?) from (.+?) for/, map: (m) => ({ item: m[1] }) },

  // El nivel, dicho en absoluto y gratis. En EQL el nivel efectivo es el de la
  // clase más baja del trío, así que cambiar una clase por otra más baja te
  // baja el nivel entero: es una variable de la pelea, no del personaje.
  { kind: 'levelup', hint: 'Welcome to level', re: /^You have gained a level! Welcome to level (\d+)!$/, map: (m) => ({ level: +m[1] }) },
  // "[50 SHD/DRU/MAG] Campeon (Erudite)" — la fuente fiable de tus clases.
  // El prefijo opcional es para las líneas de quien está ausente, que llegan
  // como " AFK [35 WAR/SHM/NEC] Thalix": anclando en `^\[` se perdían 6 de las
  // 57 del log, y con ellas sus clases.
  {
    kind: 'who', hint: '] ',
    re: /^\s*(?:AFK\s+)?\[(\d+) ([A-Za-z]{2,4})(?:\/([A-Za-z]{2,4}))?(?:\/([A-Za-z]{2,4}))?\] (\S+)(?:\s+\(([^)]+)\))?(?:\s+<([^>]+)>)?/,
    map: (m) => ({
      level: +m[1], classes: [m[2], m[3], m[4]].filter(Boolean).map((x) => x.toUpperCase()),
      who: m[5], race: m[6] ?? null, guild: m[7] ?? null,
    }),
  },
  // Zona y subárea comparten mensaje, y distinguirlas importa: el 23% de las
  // peleas de un log real tenían como zona «an area where levitation effects do
  // not function», que es un aviso de subárea DENTRO del Plano del Cielo y
  // machacaba la zona de verdad, llevándose con ella la dificultad.
  //
  // Se distinguen por la mayúscula: los nombres de zona son nombres propios
  // —«The Plane of Sky», «Nagafen's Lair»— y el aviso de subárea es una frase.
  // En las 15 zonas distintas del log de calibración, la única en minúscula es
  // la subárea. Si algún día aparece una subárea capitalizada, se colará: por
  // eso la zona se conserva y sólo se ignora el cambio, que es el daño menor.
  { kind: 'subarea', hint: 'have entered', re: /^You have entered ([a-z].*?)\.$/, map: (m) => ({ area: m[1] }) },
  { kind: 'zone', hint: 'have entered', re: /^You have entered (.+?)\.$/, map: (m) => ({ zone: m[1] }) },
  { kind: 'xp', hint: 'experience', re: /^You gain (?:party |raid )?experience/, map: () => ({}) },
  { kind: 'skillup', hint: 'become better at', re: /^You have become better at (.+?)! \((\d+)\)$/, map: (m) => ({ skill: m[1], value: +m[2] }) },
  // ═══ BOTÍN ═══
  //
  // Cuatro finales, y son todos los que hay: medido sobre las 681 líneas de
  // botín de un log de 278.000, «and sold it for X» (381), «to create a X»
  // (57), «and stored it in your currency» (15) y la forma entre guiones, que
  // no lleva final (196).
  //
  // Dos cosas que faltaban y costaban 98 líneas, el 14% del botín:
  //
  //  1. La cantidad. Exigir artículo tiraba «You looted 2 Phosphorous Powder»
  //     entera, 83 veces. Y capturarla importa tanto como casar la línea:
  //     contar «2 Bone Chips» como uno sería peor que no parsearla, porque
  //     entonces el fallo desaparece del contador de no reconocidas y ya no lo
  //     ve nadie. Por eso `qty` viaja hasta el almacén y se suma allí.
  //
  //  2. «and stored it in your currency», que no existía como regla. Son los
  //     Motes, que van al monedero en vez de a la bolsa: 15 líneas, 9 de ellas
  //     `Mote of Major Potential`, ninguna en la sección de Botín. Ojo al
  //     final, porque es el único que NO lleva punto: con `\.$` seguiría sin
  //     casar.
  { kind: 'loot', hint: 'have looted',
    re: new RegExp(`^--You have looted ${QTY}(.+?) from (.+?)'s corpse\\.--$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3] }) },
  // La misma red que abajo, para la forma entre guiones — y aquí hace falta
  // MÁS, no menos. La regla que viene después casa cualquier cosa que acabe en
  // `.--`, así que un final nuevo no se perdería: se metería ENTERO dentro del
  // nombre del objeto. Saldría un «Bone Chips from a skeleton's corpse and lo
  // que sea» en la enciclopedia, contado como un objeto distinto cada vez, y
  // nadie lo leería como un fallo del analizador. Es exactamente el caso que
  // este fichero llama peor que no casar la línea.
  { kind: 'loot', hint: 'have looted',
    re: new RegExp(`^--You have looted ${QTY}(.+?) from (.+?)'s corpse ([a-z].*)\\.--$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], cola: m[4] }) },
  { kind: 'loot', hint: 'have looted',
    re: new RegExp(`^--You have looted ${QTY}(.+?)\\.--$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2] }) },
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse and sold it for (.+?)$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], sold: m[4], autosold: true }) },
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse to create an? (.+?)$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], upgraded: m[4] }) },
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse and stored it in your currency\\.?$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], stored: true }) },
  // El quinto final, y el que enseña que no hay «todos los que hay».
  //
  // «and stored it in your tradeskill depot» apareció el 11 de agosto de 2026 a
  // las 18:59, una sola vez en 55 MB, y se llevó un `Essence of Rathe` entero:
  // la contabilidad cerraba al objeto —1.866 líneas de botín en el registro,
  // 1.865 en el almacén— y la que faltaba era ésa. Ojo, como la del monedero,
  // al final SIN PUNTO.
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse and stored it in your tradeskill depot\\.?$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], depot: true }) },
  /**
   * EL SEXTO FINAL, y llegó por donde decía la red: `Dragon Hoard`.
   *
   * Lo cazaba la cola sin interpretar —`cola: 'and stored it in your Dragon
   * Hoard'`—, que es exactamente para lo que se puso, así que el objeto nunca
   * se perdió: lo que faltaba era TIPARLO, como los otros cinco destinos.
   *
   * Medido hoy sobre los tres registros: **16 líneas**. La cola de la 2.0.0
   * decía 7, y ha crecido. Y como la del monedero y la del depósito, ésta
   * también viene SIN PUNTO al final.
   */
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse and stored it in your Dragon Hoard\\.?$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], hoard: true }) },
  // ── Y LA RED, que es lo que de verdad arregla el fallo ────────────────────
  //
  // Cuatro finales bastaron durante meses; el quinto costó un objeto y NADIE LO
  // VIO. La teoría era que una línea que no casa cae en el contador de no
  // reconocidas y allí se nota — pero en un registro real ese contador tiene
  // 39.027 líneas, así que una sola de botín no se distingue de nada.
  //
  // Así que el sexto final, cuando llegue, no se pierde: `'s corpse ` es un
  // anclaje lo bastante firme para sacar el objeto y el cadáver de cualquier
  // línea de recogida, venga como venga. La cola desconocida VIAJA en `cola`,
  // literal y sin interpretar, hasta la ficha: es la diferencia entre no saber
  // qué pasó con un objeto y no saber que existe.
  //
  // Va LA ÚLTIMA de las cinco a propósito. Dentro de una misma pista las reglas
  // se prueban en orden, así que los cuatro finales conocidos casan antes y esta
  // no les quita ninguno: sólo recoge lo que ninguno reconoció.
  { kind: 'loot', hint: 'You looted',
    re: new RegExp(`^You looted ${QTY}(.+?) from (.+?)'s corpse ([a-z].*)$`),
    map: (m) => ({ qty: m[1] ? +m[1] : 1, item: m[2], from: m[3], cola: m[4] }) },
  // ═══ MONEDA ═══
  //
  // Es botín, y hasta la 1.12.0 se reconocía y se tiraba: 1.392 líneas en un
  // registro real que no llegaban a ningún contador. Sin ella, una ficha
  // titulada «lo que recogiste» miente por omisión en la mitad de las peleas.
  //
  // NO DICE DE QUÉ CADÁVER SALE, y eso decide cómo se puede colgar de una pelea:
  // el objeto se resuelve por su cadáver, la moneda sólo por la ventana. Son dos
  // reglas distintas y la ficha las etiqueta distinto.
  { kind: 'coin', hint: 'from the corpse', re: /^You receive (.+?) from the corpse\.$/, map: (m) => ({ coin: m[1], cp: enCobre(m[1]) }) },
  { kind: 'con', hint: ' -- ', re: /^(.+?) (?:scowls at you|glares at you|glowers at you|regards you|looks at you|considers you|judges you|kindly considers you|ponders your|looks upon you|looks your way apprehensively)[^-]*-- (.+?)(?: \(Lvl: (\d+)\))?$/, map: (m) => ({ mob: m[1], con: m[2], level: m[3] ? +m[3] : null }) },
  { kind: 'logging', hint: 'Logging to', re: /^Logging to '(.+?)' is now \*(ON|OFF)\*\.$/, map: (m) => ({ file: m[1], on: m[2] === 'ON' }) },
  // ── El encanto del encantador ────────────────────────────────────────────
  //
  // Encantas a un enemigo y pelea para ti; cuando se rompe, vuelve a atacarte.
  // El mismo nombre cambia de bando a mitad de la pelea, y hasta ahora estas
  // dos líneas eran desconocidas: la aplicación se enteraba de que el bicho
  // era tuyo —porque responde «Master», igual que una mascota de verdad— pero
  // no de cuándo dejaba de serlo. Así que seguía contándolo de los tuyos
  // después de romperse, y lo que te pegaba caía en el cajón equivocado.
  //
  // Medido sobre un registro real: cuatro encantos, los cuatro con final
  // registrado —dos por «worn off» y dos porque el bicho muere—.
  { kind: 'charm_on', hint: 'has been charmed',
    re: /^(.+?) has been charmed\.$/, map: (m) => ({ target: m[1] }) },
  { kind: 'charm_off', hint: 'Charm spell has worn off',
    re: /^Your Charm spell has worn off of (.+?)\.$/, map: (m) => ({ target: m[1] }) },
  // Los intentos fallidos no abren ventana, pero dejan de ser desconocidos.
  { kind: 'noise', hint: 'cannot be charmed', re: /^This NPC cannot be charmed\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'resisted your Charm', re: /^(.+?) resisted your Charm!$/, map: (m) => ({ target: m[1] }) },

  // /pet who leader -> "Vaseker says, 'My leader is Campeon.'"  Fuente fiable:
  // en EQL cada invocación cambia el nombre, así que no vale memorizarlos.
  { kind: 'pet_leader', hint: 'My leader is', re: /^(.+?) says,? 'My leader is (.+?)\.?'$/, map: (m) => ({ pet: m[1], leader: m[2] }) },
  { kind: 'pet_claim', hint: 'told you', re: /^(.+?) told you, '(.*?Master[.!])'$/, map: (m) => ({ pet: m[1] }) },
  // Dicho en voz alta, no en un tell: en grupo puede ser la mascota de otro.
  // Sólo se propone como candidata; confirmarla exige /pet who leader.
  { kind: 'pet_maybe', hint: 'Master', re: /^(.+?) says?,? ['`](.*?Master[.!])/, map: (m) => ({ pet: m[1] }) },

  // ═══ CHAT ═══
  // Se captura el TEXTO, no sólo el emisor: es lo que se lee en voz.
  // El canal se normaliza a una etiqueta corta para poder filtrarlo.
  {
    kind: 'chat', hint: ' tells ',
    re: /^(.+?) tells (?:you|You), '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'tell', text: m[2] }),
  },
  {
    kind: 'chat', hint: ' tells ',
    re: /^(.+?) tells (?:the |your )?(guild|group|raid|fellowship), '([\s\S]*?)'?$/i,
    map: (m) => ({ from: m[1], channel: m[2].toLowerCase(), text: m[3] }),
  },
  {
    kind: 'chat', hint: ' tells ',
    re: /^(.+?) tells ([^,]+), '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'channel', channelName: m[2], text: m[3] }),
  },
  {
    kind: 'chat', hint: ' says out of character',
    re: /^(.+?) says out of character, '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'ooc', text: m[2] }),
  },
  {
    kind: 'chat', hint: ' says',
    re: /^(.+?) says,? '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'say', text: m[2] }),
  },
  {
    kind: 'chat', hint: 'auctions',
    re: /^(.+?) auctions,? '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'auction', text: m[2] }),
  },
  {
    kind: 'chat', hint: 'shouts',
    re: /^(.+?) shouts,? '([\s\S]*?)'?$/,
    map: (m) => ({ from: m[1], channel: 'shout', text: m[2] }),
  },
  { kind: 'chat', hint: 'You tell', re: /^You tell (.+?), '([\s\S]*?)'?$/, map: (m) => ({ from: 'You', channel: 'outgoing', text: m[2] }) },
  // «You say to your guild» iba a no reconocidas: 703 líneas en un registro
  // real, contra las 96 de `You say` a secas — lo que faltaba era la forma
  // NORMAL de hablar, no un caso raro. La regla de abajo no las coge porque
  // exige que la coma vaya pegada al verbo.
  //
  // Va ANTES que `You say` porque su `,?` haría que la otra casara «to your
  // guild» como parte del texto. Dentro de una misma pista mandan por orden.
  //
  // `You tell your party` NO necesita regla propia: la de `You tell X` de arriba
  // ya la coge, y le pone el mismo canal `outgoing` que a cualquier susurro.
  { kind: 'chat', hint: 'You say', re: /^You say to (.+?), '([\s\S]*?)'?$/, map: (m) => ({ from: 'You', channel: m[1], text: m[2] }) },
  { kind: 'chat', hint: 'You say', re: /^You say,? '([\s\S]*?)'?$/, map: (m) => ({ from: 'You', channel: 'outgoing', text: m[1] }) },

  // ═══ RUIDO (reconocido para que no ensucie la calibración) ═══
  { kind: 'memorize', hint: 'memoriz', re: /^Beginning to memorize (.+?)\.\.\.$/, map: (m) => ({ ability: m[1] }) },
  { kind: 'memorize', hint: 'memoriz', re: /^You have finished memorizing (.+?)\.$/, map: (m) => ({ ability: m[1], done: true }) },
  { kind: 'noise', hint: 'You forget', re: /^You forget (.+?)\.$/, map: (m) => ({ ability: m[1] }) },
  { kind: 'noise', hint: 'too far away', re: /^Your target is too far away/, map: () => ({}) },
  { kind: 'noise', hint: 'cannot see your target', re: /^You cannot see your target\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'Insufficient Mana', re: /^Insufficient Mana to cast this spell!$/, map: () => ({}) },
  /**
   * ESTO NO ES RUIDO: ES LA PRUEBA DE QUE ESTABAS ATURDIDO.
   *
   * El juego no siempre escribe «You are stunned!». Medido sobre el registro:
   * 1.629 aperturas contra 1.640 cierres, o sea ONCE cierres cuya apertura no
   * existe. Y en ocho de los once esta línea —7.820 en total— cae dentro del
   * hueco y dice con todas las letras que el aturdimiento estaba puesto.
   *
   * LO QUE COSTABA, con el caso que lo destapó: una barra del Plano del Miedo
   * rotulada «58 s aturdido, ya estaba al empezar la pelea». No duró 58 s —el
   * aturdimiento más largo emparejado de TODO el registro dura 20— sino 1: la
   * prueba está en el segundo 57 y el cierre en el 58. Los 58 eran la distancia
   * del principio de la pelea al cierre, calculada desde un borde recortado y
   * enseñada como un hecho.
   *
   * `on` no viaja: esta línea no ABRE el estado, lo ATESTIGUA. Quien reconstruye
   * el principio es `tramosDePista`, y lo hace anclando en el cierre anterior.
   */
  { kind: 'stun', hint: 'while stunned', what: 'prueba',
    re: /^You can't cast spells while stunned!$/, map: () => ({ target: 'You', prueba: true }) },
  { kind: 'noise', hint: 'Auto attack', re: /^Auto attack is (on|off)\.$/, map: (m) => ({ on: m[1] === 'on' }) },
  { kind: 'noise', hint: 'considerable effort', re: /^This creature would take considerable effort/, map: () => ({}) },
  { kind: 'noise', hint: 'first click', re: /^You must first click on the being/, map: () => ({}) },
  { kind: 'noise', hint: 'no longer have a target', re: /^You no longer have a target\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'use that command', re: /^You can't use that command right now/, map: () => ({}) },
  { kind: 'noise', hint: 'LOADING', re: /^LOADING, PLEASE WAIT/, map: () => ({}) },
  { kind: 'noise', hint: 'legs feel weak', re: /^Your legs feel weak\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'returns to your legs', re: /^Strength returns to your legs\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'mind clouds', re: /^Your mind clouds\.$/, map: () => ({}) },
  /**
   * LA RAÍZ, QUE ESTABA CLASIFICADA COMO ADORNO Y ES UN ESTADO CON DURACIÓN.
   *
   * Estaba en el montón de ruido —y por duplicado, en dos reglas distintas—
   * porque nadie la había medido. Medida:
   *
   *     entran   680   `adhere to the ground` 502 · `sink into the ground` 120
   *                    · `become entwined` 58. TRES formas, no una: mirar sólo
   *                    la primera daba 502 y una pareja falsa.
   *     salen    632   `come free`
   *     cierran  583   el 86% de las entradas · duración mediana 5 s, p90 23 s
   *
   * Es exactamente la forma de un estado con duración medible, y es lo contrario
   * de las cuatro frases que se descartaron el mismo día: aquéllas repetían cada
   * 6 segundos clavados —un latido, no una entrada— y ésta tiene 41 s de
   * mediana entre entradas y una salida que casa.
   *
   * `leave the ground` NO entra: es levitación, otra cosa, y sigue en el ruido.
   */
  { kind: 'root', hint: 'Your feet',
    re: /^Your feet (?:adhere to the ground|sink into the ground|become entwined)\.$/,
    map: () => ({ target: 'You', on: true }) },
  { kind: 'root', hint: 'Your feet', re: /^Your feet come free\.$/, map: () => ({ target: 'You', on: false }) },
  { kind: 'noise', hint: 'life force drain', re: /^You feel your life force drain away\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'enveloped by lava', re: /^You are enveloped by lava\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'Zone Safe Point', re: /^Returning to Zone Safe Point/, map: () => ({}) },
  { kind: 'noise', hint: 'spirit of wolf', re: /^You feel the spirit of wolf enter you\.$/, map: () => ({}) },
  { kind: 'knockdown', hint: 'fallen to the ground', re: /^(.+?) has fallen to the ground\.$/, map: (m) => ({ who: m[1] }) },
  { kind: 'buff_land', hint: 'feel', re: /^You feel (?:much better|resistant to .+|protected from .+|your strength return|a heal efflorescing within you)\.$/, map: () => ({}) },
  /**
   * Y EL RESTO DE «You feel …», que es lo que quedaba fuera por enumerar.
   *
   * La regla de arriba nombraba cinco frases; el registro tiene muchas más y
   * suman miles: 866 `an aura of protection engulf you`, 507 `your soul being
   * consumed`, 199 `your skin freeze`, 151 `a bit dispelled`, 148 `dazed`…
   *
   * AQUÍ SÍ SE GENERALIZA, y la diferencia con `been …` de arriba es medible:
   * «You feel» sólo lo escribe el juego cuando algo te entra. No hay ajustes
   * de interfaz ni opciones con esa forma, y las frases que ya tienen dueño
   * —las cinco de arriba, y las que otras reglas clasifican como ruido— casan
   * ANTES, porque dentro de una misma pista mandan por orden.
   *
   * LO QUE SE GUARDA ES LA FRASE, NO UN HECHIZO, y va en `flavor` a propósito:
   * el registro NO dice qué te entró. Poner ese texto en `ability` lo haría
   * pasar por el nombre de un hechizo y acabaría emparejándose con un
   * lanzamiento en la línea de tiempo. Se sabe que algo entró y se sabe cómo lo
   * describe el juego; nada más.
   */
  { kind: 'buff_land', hint: 'feel', re: /^You feel (.+)\.$/, map: (m) => ({ who: 'You', flavor: m[1] }) },
  /**
   * Y lo que se CAE sin decir de qué era: 723 líneas, de `Your aura fades` (173)
   * a `Your strength fades` (9).
   *
   * NO LLEVA `ability`, Y ESO ES LA REGLA ENTERA. `enc.fades` empareja la caída
   * con el lanzamiento por el NOMBRE para medir cuánto estuvo puesto algo, y
   * `encounter.js` sólo anota las que traen nombre. Una caída anónima con un
   * `ability` inventado —«aura»— se emparejaría con nada o, peor, con algo. Va
   * en `flavor`, se ve que cayó algo, y no se finge saber qué.
   */
  { kind: 'buff_fade', hint: ' fades', re: /^Your (.+?) fades\.$/, map: (m) => ({ who: 'You', flavor: m[1] }) },
  { kind: 'buff_land', hint: 'is resistant', re: /^(.+?) is (?:resistant to|protected from) (.+?)\.$/, map: (m) => ({ who: m[1], what: m[2] }) },
  { kind: 'buff_land', hint: 'skin shimmers', re: /^(?:Your|(.+?)'s) skin shimmers with divine power\.$/, map: (m) => ({ who: m[1] ?? 'You' }) },
  { kind: 'noise', hint: 'Spell set', re: /^Spell set (.+?) loaded\.$/, map: (m) => ({ set: m[1] }) },
  { kind: 'noise', hint: 'greater hold', re: /^Pet greater hold has been set to (on|off)\.$/, map: (m) => ({ on: m[1] === 'on' }) },
  { kind: 'noise', hint: 'You activate', re: /^You activate (.+?)\.$/, map: (m) => ({ what: m[1] }) },
  // Un punto de habilidad. Estaba como ruido y no lo es: es una señal fechada
  // de que el personaje mejora, y explica por qué el techo de daño sube sin que
  // se mueva la mediana. El registro NO tiene línea de gasto, así que el número
  // del mensaje es el saldo SIN gastar, no el total ganado: cuando baja entre
  // dos avisos es que gastaste, y eso se deduce de la caída.
  { kind: 'aa', hint: 'ability point',
    re: /^You have gained an ability point!\s+You now have (\d+) ability point/,
    map: (m) => ({ balance: +m[1] }) },
  { kind: 'noise', hint: 'ability point', re: /^You have gained an ability point!/, map: () => ({}) },
  { kind: 'noise', hint: "can't reach", re: /^You can't reach that, get closer\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'stunned too recently', re: /^Your target has been stunned too recently/, map: () => ({}) },
  { kind: 'noise', hint: 'no longer diseased', re: /^(?:You are|.+? is) no longer (?:diseased|poisoned)\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'winces', re: /^(.+?) (?:winces|goes berserk|writhes in the grip of agony|floats into the air)\.$/, map: (m) => ({ who: m[1] }) },
  // Sólo la levitación: la raíz salió de aquí y tiene su propio tipo, arriba.
  { kind: 'noise', hint: 'feet', re: /^Your feet leave the ground\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'flames die', re: /^The flames die down\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'entombed', re: /^You are entombed in elemental ice\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'effloresces', re: /^The heal within you effloresces\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'struck down by wrath', re: /^You have been struck down by wrath\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'nimbus', re: /^A nimbus of deathly darkness covers your hands\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'illusionary', re: /^You are covered in illusionary (.+?)\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'dull aura', re: /^A dull aura covers your hand\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'Thorns spring', re: /^Thorns spring from your skin\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'combusts', re: /^(.+?)'s skin combusts\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'world goes mad', re: /^Your world goes mad as chaos flows through you\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'living shield', re: /^(.+?) begins to use (.+?) as a living shield!$/, map: (m) => ({ who: m[1] }) },
  { kind: 'noise', hint: 'ceases protecting', re: /^(.+?) ceases protecting (.+?)\.$/, map: (m) => ({ who: m[1] }) },
];

const byHint = new Map();
for (const r of rules) {
  if (!byHint.has(r.hint)) byHint.set(r.hint, []);
  byHint.get(r.hint).push(r);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL ENVOLTORIO MANDA SOBRE EL CONTENIDO. Las citas se prueban LAS PRIMERAS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UNA LÍNEA QUE CITA ALGO SE RECONOCE COMO CITA ANTES DE QUE NADIE LEA LO QUE
 * HAY DENTRO DE LAS COMILLAS. Aunque el envoltorio sea raro y el contenido
 * frecuente.
 *
 * Y detrás está la razón, que es más grande que esta función:
 *
 *     LO QUE TECLEA UN DESCONOCIDO NO ENTRA NUNCA EN UNA MEDICIÓN NUESTRA.
 *
 * Todo lo que dice esta aplicación se sostiene sobre «medido del registro». El
 * registro contiene texto escrito por gente, y ese texto es ENTRADA DE USUARIO:
 * no es evidencia de nada salvo de que alguien la escribió.
 *
 * ── QUÉ PASABA, Y POR QUÉ NO SE VIO ANTES ──────────────────────────────────
 *
 * Las pistas se ordenaban por FRECUENCIA —el orden en que aparecen las reglas
 * en este fichero, que se fue escribiendo de lo común a lo raro—. Medido: la
 * pista `of damage` quedaba en la posición 2 de 123 y ` says` en la 72, así que
 * LA REGLA DEL CONTENIDO CORRÍA ANTES QUE LA DEL ENVOLTORIO.
 *
 * Lo único que impedía la confusión era que las reglas de daño están ancladas al
 * final y la comilla de cierre rompía la coincidencia. Un accidente de la
 * expresión regular, no una decisión — y por eso se caía en cuanto la comilla no
 * estaba:
 *
 *     [hora] You say to your guild, 'Campeon hits a dracoliche for 999999 points of damage.
 *        -> melee  amount=999999  source="You say to your guild, 'Campeon"
 *
 * Esa forma no es rara: es LA PRIMERA LÍNEA DE UN MENSAJE MULTILÍNEA, que no
 * cierra comilla porque el texto sigue abajo. Medido sobre el registro: 32.659
 * líneas abren cita y 8 no la cierran. Ninguna de las 8 llevaba una cifra
 * dentro — suerte, y medida.
 *
 * ── LA OTRA MITAD DEL ARREGLO ──────────────────────────────────────────────
 *
 * Acarrear la pista no basta: la regla de cita exigía comilla de CIERRE, así que
 * se probaba primero y fallaba igual. La comilla final es ahora opcional en las
 * reglas de cita, con el cuantificador perezoso para que, cuando sí está, siga
 * cerrando en la última y no en la primera.
 *
 * ── SE MANTIENE SOLO ───────────────────────────────────────────────────────
 *
 * ── Y LA SEGUNDA MITAD DE LA REGLA, QUE COSTÓ DOS PRUEBAS EN ROJO ──────────
 *
 * LO ESPECÍFICO MANDA SOBRE LO GENÉRICO, dentro del envoltorio.
 *
 * `Jobarn says, 'My leader is Campeon.'` es una CITA antes que una declaración
 * de mascota, así que el primer acarreo —sólo `kind: chat`— se la llevó la regla
 * genérica y `test/combat.js` se puso en rojo: la mascota dejó de reconocerse.
 * Por eso las tres reglas que leen una cita para sacar algo de ella entran
 * también en el acarreo, y como se declaran ANTES que el bloque de chat, quedan
 * delante solas.
 *
 * ── UNA DUDA QUE QUEDA ABIERTA, Y NO SE RESUELVE HOY ───────────────────────
 *
 * `pet_leader` se cree un `says`, y un `says` LO PUEDE ESCRIBIR UN JUGADOR: nada
 * impide teclear «My leader is Campeon» en el canal de decir, y entonces le
 * damos una mascota a quien no la tiene.
 *
 * LA ALTERNATIVA, ESCRITA ENTERA POR SI SE TOMA: creerse sólo el `told you`. Es
 * pasado y sólo lo imprime el cliente cuando un NPC te habla a ti, así que un
 * jugador NO puede fabricarlo tecleando; un `says` sí. La regla quedaría en
 * «`pet_leader` sólo cuenta dentro de un `told you`».
 *
 * POR QUÉ NO SE TOMA HOY, y no es pereza. Primero, es un CAMBIO DE
 * COMPORTAMIENTO y esto era un cambio de orden: hay mascotas que hoy se
 * reconocen por `says` y dejarían de reconocerse, y eso se decide a propósito y
 * en su propio cambio. Y segundo, falta el número que lo decide: cuántos
 * `pet_leader` de nuestro registro entran por `says` y no por `told you`, y
 * cuántos de ésos los teclea una persona. Sin esa cuenta, el cambio intercambia
 * un falso positivo por un falso negativo a ciegas.
 *
 * ── SE MANTIENE SOLO, CASI ────────────────────────────────────────────────
 *
 * El acarreo sale del `kind`, no de una lista de pistas escrita a mano: una
 * regla de chat nueva se acarrea sola. Lo que sí hay que tocar es esta lista si
 * aparece otro `kind` que lea dentro de unas comillas — y esta nota es lo que le
 * dirá a quien lo haga por qué.
 *
 * Lo guarda `test/citas.js`, drilada en rojo con el orden viejo.
 */
// Todo lo que reconoce una línea POR SU ENVOLTORIO de cita. El orden dentro lo
// da la declaración de las reglas, y ahí lo específico ya va antes.
const KINDS_CITA = new Set(['pet_leader', 'pet_claim', 'pet_maybe', 'chat']);
const CITA = new Set(rules.filter((r) => KINDS_CITA.has(r.kind)).map((r) => r.hint));
export const HINTS = [...CITA, ...[...byHint.keys()].filter((h) => !CITA.has(h))];
export const RULES_BY_HINT = byHint;
export const ALL_RULES = rules;
