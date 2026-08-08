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

const rules = [
  // ═══ DAÑO DE HECHIZO / HABILIDAD (atribuido y tipado) ═══
  {
    kind: 'spell', hint: ' damage by ',
    re: new RegExp(`^${A} hit ${A} for ${N} points? of (\\w+) damage by ${A}\\.${SUF}$`),
    map: (m) => ({ source: m[1], target: m[2], amount: +m[3], damageType: m[4], ability: m[5], flag: m[6], school: 'spell', confidence: 'exact' }),
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
  { kind: 'resist', hint: 'resisted', re: /^(.+?) resisted (.+?)'s (.+?)!$/, map: (m) => ({ target: m[1], caster: m[2], ability: m[3] }) },
  { kind: 'resist_by_you', hint: 'You resist', re: /^You resist (.+?)'s (.+?)!$/, map: (m) => ({ caster: m[1], ability: m[2], target: 'You' }) },

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
  { kind: 'cast', hint: 'begin casting', re: /^You begin casting (.+?)\.$/, map: (m) => ({ source: 'You', ability: m[1] }) },
  { kind: 'cast', hint: 'begins casting', re: /^(.+?) begins casting (.+?)\.$/, map: (m) => ({ source: m[1], ability: m[2] }) },
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
  { kind: 'stagger', hint: 'staggers', re: /^(.+?) staggers\.$/, map: (m) => ({ target: m[1] }) },
  { kind: 'proc', hint: 'feels alive', re: /^Your (.+?)(?: \((.+?)\))? feels alive with power\.$/, map: (m) => ({ item: m[1], effect: m[2] ?? null }) },
  { kind: 'pet_frenzy', hint: 'accelerated frenzy', re: /^(.+?) enters an accelerated frenzy\.$/, map: (m) => ({ pet: m[1] }) },
  { kind: 'buff_fade', hint: 'has worn off', re: /^(?:Your pet's |Your )?(.+?) spell has worn off\.$/, map: (m) => ({ ability: m[1] }) },
  { kind: 'debuff', hint: 'been diseased', re: /^(.+?) (?:have|has) been diseased\.$/, map: (m) => ({ target: m[1], ability: 'diseased' }) },
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
  { kind: 'coin', hint: 'from the corpse', re: /^You receive (.+?) from the corpse\.$/, map: (m) => ({ coin: m[1] }) },
  { kind: 'con', hint: ' -- ', re: /^(.+?) (?:scowls at you|glares at you|glowers at you|regards you|looks at you|considers you|judges you|kindly considers you|ponders your|looks upon you)[^-]*-- (.+?)(?: \(Lvl: (\d+)\))?$/, map: (m) => ({ mob: m[1], con: m[2], level: m[3] ? +m[3] : null }) },
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
    re: /^(.+?) tells (?:you|You), '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'tell', text: m[2] }),
  },
  {
    kind: 'chat', hint: ' tells ',
    re: /^(.+?) tells (?:the |your )?(guild|group|raid|fellowship), '([\s\S]*)'$/i,
    map: (m) => ({ from: m[1], channel: m[2].toLowerCase(), text: m[3] }),
  },
  {
    kind: 'chat', hint: ' tells ',
    re: /^(.+?) tells ([^,]+), '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'channel', channelName: m[2], text: m[3] }),
  },
  {
    kind: 'chat', hint: ' says out of character',
    re: /^(.+?) says out of character, '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'ooc', text: m[2] }),
  },
  {
    kind: 'chat', hint: ' says',
    re: /^(.+?) says,? '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'say', text: m[2] }),
  },
  {
    kind: 'chat', hint: 'auctions',
    re: /^(.+?) auctions,? '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'auction', text: m[2] }),
  },
  {
    kind: 'chat', hint: 'shouts',
    re: /^(.+?) shouts,? '([\s\S]*)'$/,
    map: (m) => ({ from: m[1], channel: 'shout', text: m[2] }),
  },
  { kind: 'chat', hint: 'You tell', re: /^You tell (.+?), '([\s\S]*)'$/, map: (m) => ({ from: 'You', channel: 'outgoing', text: m[2] }) },
  { kind: 'chat', hint: 'You say', re: /^You say,? '([\s\S]*)'$/, map: (m) => ({ from: 'You', channel: 'outgoing', text: m[1] }) },

  // ═══ RUIDO (reconocido para que no ensucie la calibración) ═══
  { kind: 'memorize', hint: 'memoriz', re: /^Beginning to memorize (.+?)\.\.\.$/, map: (m) => ({ ability: m[1] }) },
  { kind: 'memorize', hint: 'memoriz', re: /^You have finished memorizing (.+?)\.$/, map: (m) => ({ ability: m[1], done: true }) },
  { kind: 'noise', hint: 'You forget', re: /^You forget (.+?)\.$/, map: (m) => ({ ability: m[1] }) },
  { kind: 'noise', hint: 'too far away', re: /^Your target is too far away/, map: () => ({}) },
  { kind: 'noise', hint: 'cannot see your target', re: /^You cannot see your target\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'Insufficient Mana', re: /^Insufficient Mana to cast this spell!$/, map: () => ({}) },
  { kind: 'noise', hint: 'while stunned', re: /^You can't cast spells while stunned!$/, map: () => ({}) },
  { kind: 'noise', hint: 'Auto attack', re: /^Auto attack is (on|off)\.$/, map: (m) => ({ on: m[1] === 'on' }) },
  { kind: 'noise', hint: 'considerable effort', re: /^This creature would take considerable effort/, map: () => ({}) },
  { kind: 'noise', hint: 'first click', re: /^You must first click on the being/, map: () => ({}) },
  { kind: 'noise', hint: 'no longer have a target', re: /^You no longer have a target\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'use that command', re: /^You can't use that command right now/, map: () => ({}) },
  { kind: 'noise', hint: 'LOADING', re: /^LOADING, PLEASE WAIT/, map: () => ({}) },
  { kind: 'noise', hint: 'legs feel weak', re: /^Your legs feel weak\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'returns to your legs', re: /^Strength returns to your legs\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'mind clouds', re: /^Your mind clouds\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'feet come free', re: /^Your feet come free\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'life force drain', re: /^You feel your life force drain away\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'enveloped by lava', re: /^You are enveloped by lava\.$/, map: () => ({}) },
  { kind: 'noise', hint: 'Zone Safe Point', re: /^Returning to Zone Safe Point/, map: () => ({}) },
  { kind: 'noise', hint: 'spirit of wolf', re: /^You feel the spirit of wolf enter you\.$/, map: () => ({}) },
  { kind: 'knockdown', hint: 'fallen to the ground', re: /^(.+?) has fallen to the ground\.$/, map: (m) => ({ who: m[1] }) },
  { kind: 'buff_land', hint: 'feel', re: /^You feel (?:much better|resistant to .+|protected from .+|your strength return|a heal efflorescing within you)\.$/, map: () => ({}) },
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
  { kind: 'noise', hint: 'feet', re: /^Your feet (?:adhere to the ground|leave the ground|come free)\.$/, map: () => ({}) },
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
export const HINTS = [...byHint.keys()];
export const RULES_BY_HINT = byHint;
export const ALL_RULES = rules;
