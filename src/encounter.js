import { EventEmitter } from 'node:events';
import { SIN_MITIGACION } from './stances.js';
// El tope del encanto se mide en el analizador —de sus 43 ventanas— y se usa
// aquí como tope de la pista de estado. Una segunda copia sería un segundo sitio
// donde discrepar, que es la regla de este fichero.
import { CHARM_MAX_SEC } from './parser.js';

/**
 * En cuál de los tres cubos cae un golpe que recibes, EN UN SOLO SITIO.
 *
 * Melé, mágico, y lo que ninguna postura para. La tercera categoría no es un
 * matiz: si el daño periódico y el escudo caen en el cubo mágico, cualquiera
 * que mire la serie para preguntar «¿qué me está entrando?» concluye que es
 * mágico y decide con eso —cortar una fase, recomendar una postura— sobre un
 * daño que ninguna postura toca.
 *
 * Y sale de `SIN_MITIGACION`, la misma lista que usan el analizador al revertir,
 * el almacén al corregir lo guardado y el consejero al puntuar. Un cuarto
 * criterio propio aquí sería el cuarto sitio donde discrepar.
 */
export const cuboRecibido = (school) => (school === 'melee' ? 'tMelee'
  : (SIN_MITIGACION.has(school) ? 'tUnmit' : 'tSpell'));

import { esRelevante } from './relevancia.js';
import { claveDeNombre } from './nombres.js';
// La invariante de escala, en un solo sitio. Ver `src/reloj.js`.
import { segundosDePelea } from './reloj.js';

/** Compartido: la guarda pide conjuntos y una pelea sin abrir no los tiene. Uno
 *  solo, porque esto corre una vez por cada línea del registro. */
const VACIO = new Set();

export const DAMAGE_KINDS = new Set(['melee', 'spell', 'dot', 'ds']);

/**
 * CUÁNTO TIEMPO SIGUE SIENDO SAQUEABLE UN CADÁVER. 10 minutos.
 *
 * No es un número redondo elegido a ojo: sale de medir el hueco entre cada
 * recogida y la muerte más reciente de ese mismo nombre, sobre las 1.870 líneas
 * de botín de un registro real de 55 MB.
 *
 *   mediana 0 s · p90 8 s · p95 14 s · p99 42 s · p99,5 96 s
 *   dentro de 600 s: 1.865 de 1.870 (99,73%)
 *
 * Y LO QUE DECIDE EL NÚMERO ES EL HUECO QUE VIENE DESPUÉS: entre 600 s y 44.062
 * s no hay ni una sola recogida. Ninguna. Las cinco que quedan fuera están
 * TODAS a más de doce horas, que es un bicho con el mismo nombre muerto al día
 * siguiente — un emparejamiento falso, no un saqueo tardío. Cualquier tope
 * entre 10 minutos y 12 horas da exactamente la misma respuesta; se elige el
 * borde de abajo porque es el que menos falsos deja pasar el día que el
 * histórico crezca.
 */
export const VENTANA_CADAVER = 600;

/**
 * CUÁNDO DOS CADÁVERES DEL MISMO NOMBRE SON DE VERDAD INDISTINGUIBLES. 30 s.
 *
 * «Hay otro bicho con ese nombre muerto hace un rato» NO es una ambigüedad: es
 * lo normal, pasa en el 32% de las recogidas, y marcarlo todo dejaría la ficha
 * llena de dudas que no lo son. Lo que hace dudosa una elección es que el otro
 * candidato esté TAN CERCA como el elegido.
 *
 * Medido sobre las 1.875 recogidas del registro de referencia, las dos
 * poblaciones no se tocan:
 *
 *   de la recogida al cadáver elegido        mediana 0 s · p90 7 s · p99 29 s
 *   del elegido al competidor de otra pelea  MÍNIMO 30 s · mediana 267 s
 *
 * Ni un solo competidor a menos de 30 segundos. Entre «el cadáver que acabas de
 * saquear» y «el de la pelea de antes» hay medio minuto de margen limpio, así
 * que quedarse con el más reciente no es echarlo a suertes.
 *
 * Con este tope se marcan 3 recogidas de 1.875 —el 0,2%— y son las únicas donde
 * la regla podría estar eligiendo mal. Ése es el número que la ficha puede
 * enseñar sin mentir, y el que se pierde si se marca todo.
 */
export const AMBIGUO_SEG = 30;

/**
 * CUÁNTO MARGEN NECESITA EL RELOJ DE PARED PARA NO PARTIR LO QUE EL REGISTRO NO
 * PARTIRÍA. 3 segundos, y salen de medir el desfase, no de elegir un número
 * cómodo.
 *
 * EL PROBLEMA. `feed` decide con la marca del registro —`ev.t - end`— y `tick`
 * con `Date.now()`. El reloj de pared va POR DELANTE del registro, así que
 * `tick` parte peleas que al releer no se parten. Medido sobre un histórico
 * real: de 10 peleas que existían en directo y no en frío, SIETE tenían un
 * hueco de 19–20 segundos con `idleSec` = 20. El reloj adelantaba menos de un
 * segundo y bastaba.
 *
 * DE QUÉ SE COMPONE EL DESFASE, medido con el lector de verdad sobre un fichero
 * que se está escribiendo (1.456 sucesos en 40 s):
 *
 *     mediana 0,574 s · p90 0,948 s · p99 1,067 s · MÁXIMO 1,077 s
 *
 *   truncado al segundo   la cabecera del log no tiene decimales, así que una
 *                         línea escrita en el .9 se lee como .0. Es el sumando
 *                         grande y es irreducible: reparte uniforme en [0, 1).
 *   sondeo del lector     `pollMs: 100`
 *   ritmo de `tick`       cada 250 ms desde `main.cjs`, que se suma al decidir
 *
 * Peor caso medido de punta a punta: 1,077 + 0,25 = 1,33 s.
 *
 * ── EL 5 TIENE DOS BASES Y NO UNA. No las mezcles. ────────────────────────
 *
 * Aquí ponía «se toma el doble» y con 5 eso ES FALSO: 5 / 1,33 = 3,76×. Quien
 * recalcule la regla de doblado obtendrá 3 y creerá que corrige un error.
 *
 *   3 = 2 × el peor caso medido (1,33 s). La regla de doblado —la misma de
 *       `CHARM_MAX_SEC`, `SIN_MANDO_MAX` y `MEZ_MAX`— llega hasta aquí y NO
 *       MÁS ALLÁ. Con `idleSec = 20` bastaba, y se comprobó: en once días de
 *       registro, ninguna de las 13 divergencias entre la partición en vivo y
 *       la de frío tiene un hueco en la banda del reloj.
 *
 *   5 = ELEGIDO, y por otro motivo: `PLAZO_ENEMIGO` bajó a 12. La banda de
 *       riesgo es `(P + M − desfase, P]`, o sea que P se cancela y su ANCHURA
 *       no depende del plazo — pero la POBLACIÓN dentro de ella, sí, porque los
 *       huecos se amontonan en los valores bajos. Medido sobre el histórico,
 *       huecos de silencio del bando entero por segundo de desborde:
 *
 *           plazo 20 s → 17    plazo 15 s → 28    plazo 12 s → 45    plazo 10 s → 60
 *
 *       El mismo fallo cuesta 2,6× más caro a 12 que a 20. La holgura sube de
 *       1,67 s (3 − 1,33) a 3,67 s por 2 segundos de retraso en el aviso.
 *
 * SUBIRLO ES SEGURO Y BAJARLO NO, y conviene saber por qué: `tick` sólo puede
 * cerrar ANTES de tiempo. Si no cierra, cierra `feed` en cuanto llega el
 * siguiente suceso, y `feed` decide con la marca del registro. Así que el margen
 * NO PUEDE cambiar la partición en frío: lo único que compra o gasta es cuánto
 * tarda el overlay en dar una pelea por terminada.
 *
 * LO QUE NO SE PUEDE MEDIR AQUÍ es cuánto tarda EQ en volcar su buffer al
 * fichero: eso necesita el juego delante. Pero la observación lo acota, y por
 * eso conviene tenerla escrita: si el juego retuviera segundos, las peleas mal
 * partidas habrían salido con huecos de 15 o 16 s, no de 19 y 20.
 *
 * Y LO QUE CUESTA: una pelea tarda 5 segundos más en darse por terminada en
 * directo. Con 10 costaba el doble para no comprar nada más.
 */
export const MARGEN_TICK = 5;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ ES UNA PELEA. La definición, y las tres constantes que la sostienen.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta la 1.13.0 esto se contestaba con `idleSec = 20`: «es la misma pelea
 * mientras el registro no lleve 20 s callado». Esa no es la pregunta. Es OTRA
 * pregunta —«¿cuánto lleva callado el registro?»— y por eso fallaba en las dos
 * direcciones a la vez: partía una pelea porque estuviste 25 s limpiando agro, y
 * juntaba dos porque la siguiente empezó 3 s después de acabar la primera.
 *
 * LA DEFINICIÓN, desde la 1.14.0:
 *
 *     Una pelea es un grupo de enemigos cuyas ventanas de participación se
 *     solapan. Un componente conexo, no un hueco de tiempo.
 *
 * Cada enemigo tiene UNA ventana: de su primera línea a la última. Mientras
 * quede una ventana abierta, la pelea sigue; cuando se cierran todas, la
 * siguiente línea abre una pelea nueva.
 *
 * ── POR QUÉ ESTO ES UN REFINAMIENTO Y NO UN SALTO ─────────────────────────
 *
 * Es lo que autoriza el cambio, y es un teorema, no una observación:
 *
 *     La frontera del modelo viejo se traza cuando `ev.t − end > 20`. Una
 *     ventana del modelo nuevo se estira como mucho `APERTURA` hacia atrás y
 *     `PLAZO_ENEMIGO` hacia delante. Luego dos ventanas separadas por una
 *     frontera vieja sólo pueden tocarse si `APERTURA + PLAZO_ENEMIGO > 20`.
 *
 *     Con `APERTURA + PLAZO_ENEMIGO ≤ 20`, la partición nueva es un REFINAMIENTO
 *     de la vieja: toda pelea nueva está contenida en una de las de antes. El
 *     modelo sólo puede CORTAR, nunca UNIR.
 *
 * Comprobado además sobre el histórico de referencia (845 peleas, 11 días), con
 * la regla de zona puesta: fusiones 0 con plazo 3, 5, 8, 10, 12, 15, 17 y 18 s;
 * 2 con 20; 10 con 25; 23 con 30; 65 con 60. La desigualdad no se cumple por
 * suerte: se cumple SI Y SÓLO SI se respeta. Lo guarda `test/peleas.js`.
 *
 * ── EL TEOREMA CUBRE EL PLAZO Y NO CUBRE LA PISTA DE ESTADO ───────────────
 *
 * Y ESTO SALIÓ AL ESCRIBIRLO, NO AL DISEÑARLO, así que va con su cuenta.
 *
 * La desigualdad acota UN camino para estirar una ventana: el plazo. Hay un
 * segundo camino —`#tapado`— y ése no está acotado por 20, sino por `MEZ_MAX`
 * (226 s) y `CHARM_MAX_SEC` (690 s). Un mez o un encanto puede sostener una
 * ventana por encima del hueco de 20 s con el que se trazó la frontera vieja, y
 * entonces el modelo nuevo UNE dos peleas de antes.
 *
 * MEDIDO SOBRE EL HISTÓRICO ENTERO: pasa 10 veces en 845 peleas (1,2 %). Ni una
 * sola es del plazo —ése cumple el teorema exactamente— y las diez tienen dentro
 * un encanto o un mez escrito por el registro. Seis son de Najena y Befallen con
 * encantos encadenados; el resto, tandas de Old Guk mezadas en bloque.
 *
 * POR QUÉ SE DEJA ASÍ. Lo que el teorema protege es que el usuario no encuentre
 * su histórico revuelto sin motivo. Estas diez tienen motivo, y está escrito en
 * su registro: durante ese silencio el bicho estaba encantado o dormido, o sea
 * que seguía en la pelea. Renunciar a ellas para salvar el enunciado sería
 * tirar la medición para conservar la frase — y la pista de estado es justo la
 * mitad del modelo que convierte una deducción en una medida.
 *
 * LO QUE HAY QUE DECIR, ENTONCES, y no «el modelo sólo corta»:
 *
 *     El modelo sólo corta, salvo donde el registro dice con todas las letras
 *     que el enemigo seguía ahí. Eso son 10 peleas de 845, y cada una se puede
 *     señalar con la línea que la une.
 *
 * ── Y ES UNA PROPIEDAD DE LA MIGRACIÓN, NO UNA LEY ETERNA ─────────────────
 *
 * Esto hay que leerlo entero antes de tocar el tope, porque tiene fecha de
 * caducidad y no se nota mirando el código.
 *
 * El tope protege UNA cosa: que el histórico que el usuario ya tiene se pueda
 * releer y salga partido, no revuelto. En cuanto se reconstruye —y la 1.14.0
 * fuerza la reconstrucción— la partición vieja DEJA DE EXISTIR, y a partir de
 * ese momento el tope no protege nada: no hay ninguna frontera anterior con la
 * que ser coherente.
 *
 * Así que se podrá levantar algún día, a propósito y sabiendo qué se pierde: se
 * pierde la posibilidad de decirle a alguien que sigue con el almacén de la
 * 1.13.0 que lo suyo sólo se parte. Lo que NO se puede hacer es ninguna de las
 * dos cosas que pasan cuando esto no está escrito: venerarlo como si fuera una
 * verdad del dominio, o borrarlo por parecer arbitrario. Es exactamente el par
 * de errores que ya costaron `FORMATO_VERSION` y `RECONSTRUIR_DESDE`.
 */

/**
 * CUÁNTO ANTES SE EMPIEZA A RECOGER. 2 segundos.
 *
 * ES RECOLECCIÓN, NO MEDICIÓN, y la distinción es el motivo de que exista.
 * Abrir la ventana dos segundos antes recoge lo que lanzaste justo al empezar
 * —el casteo que sale antes del primer golpe— y sirve para unir ventanas.
 *
 * EL DPS NO SE CUENTA DESDE AQUÍ. Se cuenta desde la primera línea real, que es
 * `Encounter.start`; esto es `Encounter.desde`, y son dos campos porque son dos
 * cosas. Si el dps saliera de `desde`, cada pelea llevaría dos segundos de
 * denominador que nadie peleó, y las cortas —mediana 59 s— lo notarían.
 *
 * Lo que cuesta, medido: 2 fusiones en todo el histórico con el plazo a 20, y
 * ninguna con el plazo a 12, porque 2 + 12 = 14 ≤ 20. Ver el teorema de arriba.
 */
export const APERTURA = 2;

/**
 * CUÁNTO SILENCIO DE UN ENEMIGO SIGUE SIENDO EL MISMO ENEMIGO. 12 segundos.
 * Banda medida: 10–15. Tope duro: `APERTURA + PLAZO_ENEMIGO ≤ 20`.
 *
 * QUÉ TAPA, y por qué no es un número de comodidad. Censo de los 19.970 huecos
 * internos de ≥2 s del registro de referencia, repartidos por lo que los explica:
 *
 *     estado medido (mez, encanto, tramo sin mando)    489   2,4 %
 *     homónimo (muere uno y llega otro igual)        2.387  12,0 %
 *     SIN EXPLICACIÓN                               17.094  85,6 %   ← esto
 *
 * Y el montón grande es diminuto: mediana 2 s, p90 4 s, p95 6 s, **p99 12 s**.
 * No es misterio, es la cadencia de ataque del bicho. El plazo residual compra
 * cadencia, y por eso cae donde cae:
 *
 *      8 s → tapa el 98,6 %      12 s → tapa el 99,1 %      20 s → 99,5 %
 *
 * LA CURVA, en peleas resultantes sobre las 845 de hoy (apertura 2, regla de
 * zona puesta), con la pendiente en % por segundo:
 *
 *      3 s  2207        8 s  1283  −4,06     15 s  1125  −1,36     30 s  1019
 *      5 s  1461 −16,90 10 s  1212  −2,77     18 s  1085  −1,27     60 s   931
 *
 * Hay codo y hay techo. El codo está en 8 s: por debajo la pendiente se dispara
 * y el modelo se deshace en 2.207 peleas. El techo está en 18 s y lo pone el
 * teorema, no la curva. Entre 10 y 18 la cuenta se mueve un 10,5 % con pendiente
 * ≤1,6 %/s y monótona, sin escalón, y NINGUNA propiedad cambia: fusiones 0,
 * duración máxima clavada en 1.609 s —la pelea más larga de hoy—, componentes de
 * ≥5 min entre 28 y 34.
 *
 * Se toma 12: el p99 de la cadencia cabe justo, y deja 6 s de holgura contra el
 * tope. Cualquier valor entre 10 y 15 da lo mismo salvo la cuenta.
 */
export const PLAZO_ENEMIGO = 12;

/**
 * CUÁNTO PUEDE DURAR UN MEZ DEL QUE NO SE LEE EL FINAL. 226 s.
 *
 * De los 217 mez del registro, 202 tienen cierre ESCRITO —«has been awakened
 * by» o «Your <mez> spell has worn off of»— y no dependen de esto. Los 15 que no
 * lo tienen necesitan un tope, o una ventana abierta por un mez sin cierre
 * mantendría viva la pelea para siempre.
 *
 * 226 = 2 × 113, y 113 es la más larga de las 198 ventanas medidas que caben en
 * diez minutos. Las otras 4 de las 202 duran entre 1.693 y 121.842 s: son
 * emparejamientos falsos —un mez cuyo cierre no llegó, casado con el cierre de
 * otro bicho del mismo nombre horas después— y por eso no entran en el máximo.
 * Es la misma regla de doblado que `CHARM_MAX_SEC` y `SIN_MANDO_MAX`.
 */
export const MEZ_MAX = 226;

/**
 * CUÁNTO SE ESPERA A QUE ALGUIEN RECUPERE EL MANDO ANTES DE DARLO POR PERDIDO.
 *
 * 76 s = 2 × los 38 s del tramo más largo medido en el registro de referencia
 * —31 tramos, mediana 9 s—, con la misma regla que `CHARM_MAX_SEC` y
 * `MARGEN_TICK`: cuando pasarse de largo cuesta una decisión equivocada, se
 * dobla el peor caso observado en vez de ajustar al percentil.
 *
 * QUÉ DECIDE. Sólo si el reloj de pared puede cerrar la pelea mientras el
 * personaje está secuestrado. No recorta ningún tramo ni toca ninguna cifra: si
 * un miedo durase más que esto, el tramo seguiría entero y lo único que pasaría
 * es que la pelea podría partirse, como se partía antes de la 1.13.0.
 */
export const SIN_MANDO_MAX = 76;

/**
 * El nombre de un cadáver, para poder emparejarlo con su muerte.
 *
 * Dos cosas y ninguna más, porque cada normalización de más es un
 * emparejamiento falso esperando su turno:
 *
 *   minúsculas   la muerte abre frase —«A zol ghoul knight has been slain»— y
 *                la recogida va a mitad —«from a zol ghoul knight's corpse»—.
 *                El juego capitaliza la primera, así que sin esto no casan.
 *   el artículo  por lo mismo: «orc legionnaire» y «an orc legionnaire»
 *                aparecen los dos, y son el mismo bicho.
 */
export const nombreCadaver = (s) => String(s ?? '').toLowerCase().trim()
  .replace(/^(?:an?|the)\s+/, '');

function bucket(map, key) {
  let b = map.get(key);
  if (!b) { b = { n: 0, sum: 0, max: 0, min: Infinity, crits: 0 }; map.set(key, b); }
  return b;
}
function push(map, key, amt, crit) {
  const b = bucket(map, key);
  b.n++; b.sum += amt;
  if (amt > b.max) b.max = amt;
  if (amt < b.min) b.min = amt;
  if (crit) b.crits++;
  return b;
}

/**
 * LA FORMA DEL GOLPE, y por qué no basta con el mínimo y el máximo.
 *
 * El mínimo y el máximo de un ataque son los dos únicos números de su fila que
 * UN SOLO golpe raro puede mover: son muestras de n=1. Medido sobre el registro
 * de referencia, `a zol ghoul knight · hits` con n=557 da 3 / 25 / 60 — el
 * mínimo es 0,12× la mediana. Decir «entre 3 y 60» de un ataque que hace 25
 * casi siempre no es informar de menos: es informar de otra cosa.
 *
 * Así que se cuenta la distribución y se enseñan tres cifras que sí aguantan
 * un golpe raro: p10, mediana y p90.
 *
 * QUÉ SE GUARDA Y QUÉ NO. El recuento vive AQUÍ, en memoria, mientras dura la
 * pelea. A disco van tres números por habilidad. Guardar los cubos habría sido
 * multiplicar el almacén por un dibujo que casi nadie abre: 60 habilidades por
 * 10 filas por pelea.
 *
 * El precio de eso, dicho: los percentiles NO se pueden fundir. Al sumar varias
 * peleas se caen a propósito en vez de arrastrar el de una de ellas, que sería
 * inventarse la muestra.
 *
 * Cada valor guarda [cuántas veces, de ellas críticas]. Las críticas hacen
 * falta aparte por lo de la doble joroba: un ataque con críticos tiene dos
 * montones por definición, y eso ya se cuenta en su columna. La joroba que
 * merece decirse es la que queda DESPUÉS de quitarlos.
 */
const DIST_TOPE = 2000;     // guarda contra un ataque con miles de valores distintos

function pushDist(b, amt, crit) {
  if (!b.dist) b.dist = new Map();
  const v = b.dist.get(amt);
  if (v) { v[0]++; if (crit) v[1]++; return; }
  // Al llegar al tope se deja de anotar valores NUEVOS y se marca: con la
  // cuenta incompleta los percentiles ya no son exactos, y prefiero no darlos
  // a darlos mal.
  if (b.dist.size >= DIST_TOPE) { b.distTrunc = true; return; }
  b.dist.set(amt, [1, crit ? 1 : 0]);
}

/** El valor que deja por debajo la fracción `q` de las muestras. */
function percentil(pares, total, q) {
  const meta = q * total;
  let acc = 0;
  for (const [valor, n] of pares) {
    acc += n;
    if (acc >= meta) return valor;
  }
  return pares.length ? pares[pares.length - 1][0] : 0;
}

/**
 * ¿Hay dos montones bajo este nombre?
 *
 * No es un adorno del dibujo: es un hallazgo de atribución. Si los golpes de un
 * mismo nombre se agrupan en dos sitios y el valle entre ellos está vacío, lo
 * más probable es que bajo ese nombre haya DOS cosas —dos armas, dos ataques
 * que el registro llama igual— y entonces la media de la fila no describe a
 * ninguna de las dos.
 *
 * Se mira sobre los golpes NO críticos, porque el crítico ya tiene su columna y
 * un ataque con críticos es bimodal por construcción: decirlo sería anunciar
 * como hallazgo algo que ya está contado al lado.
 *
 * Las condiciones son deliberadamente duras, porque esto se dice CON PALABRAS y
 * una frase que se equivoca cuesta más que un dibujo que no se entiende:
 *   · 40 muestras o más — con menos, cualquier hueco es azar
 *   · dos cimas separadas, cada una con el 15% de las muestras como poco
 *   · un valle que baje al 40% de la cima más baja
 *   · y las dos cimas separadas por un cuarto del golpe mayor: dos montones
 *     pegados son el mismo montón visto con demasiado aumento
 *
 * LA ÚLTIMA CONDICIÓN SE MIDE EN DAÑO, no en anchura del dibujo, y ahí estaba
 * el fallo que cazó la prueba. Medida en anchura, un ataque que sólo hace 20 o
 * 21 salía bimodal: los cubos se reparten sobre el rango observado, así que dos
 * valores pegados acaban en los extremos opuestos del dibujo y parecen dos
 * montones. Veinte y veintiuno son el mismo golpe; veinte y cien no.
 */
function dosJorobas(dist) {
  const base = [...dist].map(([v, [n, c]]) => [v, n - c]).filter(([, n]) => n > 0)
    .sort((a, b) => a[0] - b[0]);
  const total = base.reduce((a, [, n]) => a + n, 0);
  if (total < 40 || base.length < 2) return false;

  const lo = base[0][0], hi = base[base.length - 1][0];
  if (hi <= lo) return false;
  const BINS = 12;
  const bins = new Array(BINS).fill(0);
  for (const [v, n] of base) {
    bins[Math.min(BINS - 1, Math.floor((v - lo) / (hi - lo) * BINS))] += n;
  }
  // Suavizado de tres: sin él, un valor repetido mucho abre valles de mentira.
  const s = bins.map((_, i) => (bins[i - 1] ?? 0) + bins[i] + (bins[i + 1] ?? 0));

  const cimas = [];
  for (let i = 0; i < BINS; i++) {
    if (s[i] >= (s[i - 1] ?? -1) && s[i] > (s[i + 1] ?? -1) && s[i] >= total * 0.15) cimas.push(i);
  }
  if (cimas.length < 2) return false;

  const centro = (i) => lo + (i + 0.5) * (hi - lo) / BINS;
  for (let a = 0; a < cimas.length; a++) {
    for (let b = a + 1; b < cimas.length; b++) {
      const i = cimas[a], j = cimas[b];
      if (j - i < 2) continue;                       // cimas pegadas: un montón
      const alto = centro(j), bajo = centro(i);
      if (alto - bajo < alto * 0.25) continue;       // y separadas en DAÑO
      const valle = Math.min(...s.slice(i + 1, j));
      if (valle <= Math.min(s[i], s[j]) * 0.4) return true;
    }
  }
  return false;
}

/**
 * De la cuenta a lo que viaja: tres cifras y, si acaso, el aviso.
 *
 * Por debajo de ocho muestras no se dan percentiles. Es el mismo mínimo que ya
 * usa el catálogo de hechizos para decir «medido»: un hueco explicado informa,
 * y tres cifras sacadas de cuatro golpes desinforman.
 */
export const MIN_MUESTRAS = 8;

export function forma(b) {
  if (!b?.dist || b.distTrunc || b.n < MIN_MUESTRAS) return null;
  // En una pelea viva esto se pide cuatro veces por segundo para cada
  // habilidad de cada fila. La cuenta sólo cambia cuando entra un golpe nuevo,
  // así que se guarda con el número de muestras del que salió.
  if (b.formaN === b.n) return b.formaCache;
  const pares = [...b.dist].map(([v, [n]]) => [v, n]).sort((a, b2) => a[0] - b2[0]);
  const total = pares.reduce((a, [, n]) => a + n, 0);
  if (!total) return null;
  const out = {
    p10: percentil(pares, total, 0.10),
    p50: percentil(pares, total, 0.50),
    p90: percentil(pares, total, 0.90),
    bimodal: dosJorobas(b.dist),
  };
  b.formaN = b.n; b.formaCache = out;
  return out;
}
const sorted = (map) => [...map].sort((a, b) => b[1].sum - a[1].sum || b[1].n - a[1].n);

class Combatant {
  constructor(name) {
    this.name = name;

    // ofensiva
    this.damage = 0;
    this.hits = 0;
    this.meleeHits = 0;      // accuracy sólo cuenta swings, no hechizos
    this.misses = 0;
    this.crits = 0;
    this.critDamage = 0;
    this.flurries = 0;      // EQL: golpe extra
    this.ripostes = 0;      // golpe de contraataque
    this.healPotential = 0; // curación antes del tope (lo desperdiciado)
    this.max = 0;
    this.min = Infinity;
    this.byAbility = new Map();
    this.byTarget = new Map();
    this.bySchool = new Map();
    this.byType = new Map();     // EQL da el tipo: magic, cold, fire…
    this.byStance = new Map();   // sólo EQL
    this.byInvocation = new Map();
    this.missReasons = new Map();

    // defensiva
    this.taken = 0;
    this.swingsAgainst = 0;
    // Daño que NO llegó porque una runa se lo comió. Aparte de `taken`, que
    // es lo que sí llegó, y aparte de la curación, que repara lo que llegó.
    this.absorbed = 0;
    this.absorbHits = 0;
    this.defense = new Map();    // parry / dodge / riposte / block que ha hecho
    this.takenByType = new Map();
    this.rawTakenByType = new Map();   // sin mitigar, para el consejo de postura
    this.rawMeleeOut = 0;              // melé propio sin el bono de Offensive
    /**
     * EL DAÑO RECIBIDO, PARTIDO POR LA POSTURA QUE LLEVABAS EN CADA GOLPE.
     *
     * Sin esto, `rawTakenByType` funde en un solo cubo los golpes de todas las
     * posturas de la pelea, y el consejo no tiene más remedio que colapsar la
     * pelea a UNA postura —la que más duró— para decir cuánto evitaste. En una
     * pelea donde bailas eso es falso por construcción: te acredita la postura
     * equivocada durante todos los tramos que no eran suyos.
     *
     * Se agrupa POR POSTURA y no por franja, y no se pierde nada: lo que evita
     * una postura es lineal en el daño, así que sumar dos tramos de Defensive
     * en un cubo da exactamente lo mismo que llevarlos por separado. Cuándo fue
     * cada tramo ya está en `stanceSpans`.
     *
     * Los fallos también entran: una postura que evade no reduce el golpe, lo
     * quita, y eso se puntúa contando ataques. Sin los fallos del tramo no se
     * sabe cuántos ataques hubo en él.
     */
    this.takenByStance = new Map();
    this.takenBySource = new Map();
    this.deaths = 0;

    // curación
    this.healingDone = 0;
    this.healingTaken = 0;
    this.healBySpell = new Map();
    this.healByTarget = new Map();

    // actividad
    this.first = null;
    this.last = null;
    this.activeSeconds = new Set();
    this.hitSeconds = new Set();     // sólo cuando pegas: recibir no cuenta como actividad
    /**
     * TU MEJOR RATO, que no es tu mejor segundo.
     *
     * La pregunta que contesta: ¿esto fue un momento o fue un rato? El número
     * grande de la fila reparte el daño entre la pelea entera y el ritmo entre
     * los segundos en que hiciste algo; ninguno de los dos distingue a quien dio
     * un pico de quien sostuvo.
     *
     * Y NO SE MIDE POR SEGUNDOS SUELTOS, aunque fuera lo apuntado. El registro
     * de EQL sella la hora al segundo y no hay nada por debajo: dos golpes
     * separados 1,9 s pueden caer en la misma marca y un frenesí mete tres en
     * una. Un «mejor segundo» es una muestra de n=1 y encima medio artefacto de
     * la cuadrícula. El pico de n=1 ya está puesto en la fila: es el máximo.
     *
     * Diez segundos es la misma ventana que ya usa el análisis para la ráfaga
     * del grupo, así que las dos cifras se pueden comparar entre sí.
     *
     * Se guarda el daño por segundo —no la serie del jugador— y la ventana se
     * calcula al pedir los totales. A disco va UN número por fila.
     */
    this.porSegundo = new Map();     // segundo -> daño hecho
    /**
     * SEGUNDOS EN LOS QUE ATACASTE, y fallar es atacar.
     *
     * `hitSeconds` sólo cuenta los segundos en que hiciste daño, y con eso se
     * medía el «tiempo sin pegar». Medido sobre el registro: de los 15.156
     * segundos en que atacaste, 4.798 —el 31,7%— fueron sólo fallos, y todos
     * ellos contaban como tiempo parado. Estabas pegando; no entró.
     */
    this.swingSeconds = new Set();
  }

  /**
   * TU CADENCIA, deducida de tus propios huecos entre ataques.
   *
   * Por qué hace falta: el registro sella al segundo y tu arma no golpea cada
   * segundo, así que una pelea con uptime perfecto tiene la mitad de los
   * segundos sin daño. Medido sobre el registro entero, los huecos entre
   * segundos con ataque tuyo son 1s (34,7%), 2s (30,5%) y 3s (27,0%): el 92,2%
   * está entre uno y tres, y a partir de cuatro se desploma al 3,9%. Hay una
   * cadencia natural y hay un codo.
   *
   * Se toma el p90 de tus huecos en esta pelea: el hueco más largo que aún es
   * tu arma. Lo que pase de ahí ya no lo explica el arma.
   *
   * Es una propiedad de tu equipo, no de cómo jugaste, y por eso sirve de vara:
   * medir contra cero acusaba al arma; medir contra esto acusa a los parones.
   */
  cadencia(sinMando = []) {
    const segs = [...this.swingSeconds].sort((a, b) => a - b);
    if (segs.length < 5) return null;          // sin muestra no se afirma un ritmo
    const huecos = [];
    for (let i = 1; i < segs.length; i++) {
      const d = segs[i] - segs[i - 1];
      if (d > 12) continue;                    // un hueco de dos minutos no es el arma
      /**
       * Y UN HUECO QUE CAE DENTRO DE UN TRAMO SIN MANDO TAMPOCO ES EL ARMA.
       *
       * Éste iba A FAVOR y por eso costaba verlo: un miedo corto mete un hueco
       * de diez segundos en la muestra, sube tu p90, y con una cadencia más
       * lenta el «tiempo muerto» te perdona más de lo que debería. Sigue siendo
       * un dato que no dice nada de tu equipo, que es lo que esto mide, y la
       * regla es que esos segundos no cuenten NI a favor ni en contra.
       */
      const a = segs[i - 1], b = segs[i];
      if (sinMando.some((s) => (s.hasta ?? Infinity) >= a && s.desde <= b)) continue;
      huecos.push(d);
    }
    if (huecos.length < 4) return null;
    huecos.sort((a, b) => a - b);
    const p90 = huecos[Math.min(huecos.length - 1, Math.floor(huecos.length * 0.9))];
    // Tope: si una pelea rara da un p90 enorme, dejaría de acusar cualquier
    // parón. Seis segundos es más del doble del p90 medido en el registro.
    return Math.max(1, Math.min(6, p90));
  }

  /**
   * Lo que de verdad estuviste parado: la suma de lo que cada hueco pasa de tu
   * cadencia. Un hueco de tu tamaño no es un parón, es el arma.
   */
  /**
   * @param {Array<{desde:number,hasta:number}>} sinMando  tramos, en segundos
   *   absolutos, en los que NO manejabas el personaje. No se te cobran.
   */
  huecoReal(desde, hasta, sinMando = []) {
    const cad = this.cadencia(sinMando);
    if (cad === null) return null;
    const segs = [...this.swingSeconds].sort((a, b) => a - b);
    let muerto = 0;
    // La entrada y la salida cuentan igual: si llegaste tarde a la pelea o la
    // dejaste antes de acabar, eso también fue tiempo sin atacar.
    const puntos = [desde - cad, ...segs, hasta + 1];
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1] + cad;
      const b = puntos[i];
      if (b <= a) continue;
      let trozo = b - a;
      /**
       * LO QUE PASÓ SIN MANDO NO ES UN PARÓN TUYO, Y NO ES UN MATIZ.
       *
       * Con miedo no puedes actuar en absoluto, y con encanto tampoco decides
       * —pegas a los tuyos, pero no lo eliges—. Los dos son involuntarios por
       * igual, así que ni la inactividad ni su duración dicen nada de cómo
       * jugaste. Cobrárselo a alguien es acusarle de algo que el juego le hizo.
       *
       * Medido en el registro de referencia: 464 segundos repartidos en 31
       * tramos de 12 peleas, con el más largo en 38 s. Todo eso entraba entero
       * en el «tiempo muerto» y salía como daño perdido en el hallazgo que más
       * se lee de la ficha.
       */
      for (const s of sinMando) {
        const ini = Math.max(a, s.desde);
        const fin = Math.min(b, (s.hasta ?? hasta) + 1);
        if (fin > ini) trozo -= fin - ini;
      }
      muerto += Math.max(0, trozo);
    }
    return Math.round(muerto);
  }

  /** El mejor tramo de `ventana` segundos seguidos, en daño por segundo. */
  mejorRafaga(ventana = 10) {
    if (!this.porSegundo.size) return 0;
    if (this.rafagaN === this.hits) return this.rafagaCache;
    const segs = [...this.porSegundo.keys()];
    const desde = Math.min(...segs);
    const hasta = Math.max(...segs);
    // Una pelea más corta que la ventana no tiene ráfaga que comparar: sería
    // el total repartido entre diez, que es otra cifra y más pequeña.
    if (hasta - desde + 1 < ventana) { this.rafagaN = this.hits; this.rafagaCache = 0; return 0; }
    let suma = 0;
    for (let s = desde; s < desde + ventana; s++) suma += this.porSegundo.get(s) ?? 0;
    let mejor = suma;
    for (let s = desde + ventana; s <= hasta; s++) {
      suma += (this.porSegundo.get(s) ?? 0) - (this.porSegundo.get(s - ventana) ?? 0);
      if (suma > mejor) mejor = suma;
    }
    this.rafagaN = this.hits;
    this.rafagaCache = mejor / ventana;
    return this.rafagaCache;
  }

  #touch(t) {
    if (this.first === null) this.first = t;
    this.last = t;
    this.activeSeconds.add(t);
  }

  addDamage(ev) {
    const amt = ev.amount;
    const seg = Math.round(ev.t);
    this.hitSeconds.add(seg);
    this.porSegundo.set(seg, (this.porSegundo.get(seg) ?? 0) + amt);
    this.swingSeconds.add(seg);
    const type = ev.damageType ?? ev.school ?? 'other';
    this.damage += amt;
    this.hits++;
    if (ev.school === 'melee') this.meleeHits++;
    if (ev.crit) { this.crits++; this.critDamage += amt; }
    if (ev.rawOut) this.rawMeleeOut += ev.rawOut;
    if (ev.flurry) this.flurries++;
    if (ev.riposte) this.ripostes++;
    if (amt > this.max) this.max = amt;
    if (amt < this.min) this.min = amt;
    this.#touch(ev.t);

    const b = push(this.byAbility, ev.ability || ev.verb || ev.school || '?', amt, ev.crit);
    b.school = ev.school ?? '?';
    b.type = type;
    // La forma sólo se cuenta por habilidad. Es donde se pregunta «¿cuánto pega
    // esto?»; el reparto por objetivo o por escuela contesta otra cosa y no
    // merece el recuento.
    pushDist(b, amt, ev.crit);
    push(this.byTarget, ev.target ?? '?', amt, ev.crit);
    push(this.bySchool, ev.school ?? '?', amt, ev.crit);
    push(this.byType, type, amt, ev.crit);
    if (ev.stance) push(this.byStance, ev.stance, amt, ev.crit);
    if (ev.invocation) push(this.byInvocation, ev.invocation, amt, ev.crit);
  }

  addMissDealt(ev) {
    this.misses++;
    // Fallar es atacar: este segundo NO es tiempo parado.
    this.swingSeconds.add(Math.round(ev.t));
    push(this.missReasons, ev.reason ?? 'fallo', 0, false);
    this.#touch(ev.t);
  }

  /** El cubo de una postura, creándolo si es el primer golpe bajo ella. */
  #tramo(stance) {
    const k = stance ?? '';
    let t = this.takenByStance.get(k);
    if (!t) {
      t = { stance: stance ?? null, melee: 0, spell: 0, unmit: 0, n: 0, landed: 0, avoided: 0 };
      this.takenByStance.set(k, t);
    }
    return t;
  }

  addTaken(ev) {
    this.taken += ev.amount;
    this.swingsAgainst++;
    push(this.takenByType, ev.damageType ?? ev.school ?? 'other', ev.amount, false);
    push(this.rawTakenByType, ev.school === 'melee' ? 'melee' : (ev.damageType ?? ev.school ?? 'other'), ev.rawAmount ?? ev.amount, false);
    push(this.takenBySource, ev.source ?? 'desconocido', ev.amount, false);
    // Y el mismo golpe otra vez, bajo la postura que llevabas puesta. Los tres
    // cubos son los del consejero: melé, mágico y lo que ninguna postura para.
    const t = this.#tramo(ev.stanceAtHit);
    const raw = ev.rawAmount ?? ev.amount;
    t.n++;
    if (ev.school === 'melee') { t.melee += raw; t.landed++; }
    else if (SIN_MITIGACION.has(ev.school)) t.unmit += raw;
    else t.spell += raw;
    this.#touch(ev.t);
  }

  addAvoided(ev) {
    this.swingsAgainst++;
    push(this.defense, ev.reason ?? 'fallo', 0, false);
    this.#tramo(ev.stanceAtHit).avoided++;
  }

  addHealDone(ev) {
    this.healingDone += ev.amount;
    if (ev.potential) this.healPotential += ev.potential;
    push(this.healBySpell, ev.ability ?? 'cura', ev.amount, false);
    push(this.healByTarget, ev.target ?? '?', ev.amount, false);
    this.#touch(ev.t);
  }

  addHealTaken(ev) { this.healingTaken += ev.amount; }

  addAbsorbed(ev) {
    this.absorbed += ev.amount || 0;
    this.absorbHits++;
    this.#touch(ev.t);
  }

  get accuracy() {
    const swings = this.meleeHits + this.misses;
    return swings ? this.meleeHits / swings : 0;
  }
  get avoidance() {
    return this.swingsAgainst ? [...this.defense.values()].reduce((a, b) => a + b.n, 0) / this.swingsAgainst : 0;
  }
  get critRate() { return this.hits ? this.crits / this.hits : 0; }
}

export class Encounter {
  constructor(id, startT, zone, ctx = {}) {
    this.id = id;
    this.zone = zone;
    // Nivel y clases EN ESTA PELEA, no los de ahora. En EQL el nivel efectivo
    // es el de la clase más baja del trío, así que meter una clase baja te
    // baja el nivel entero: medido en un log real, la mediana de dps cayó de
    // 127 a 44 al pasar de nivel 50 a 25. Comparar peleas de los dos periodos
    // sin distinguirlos no informa de nada.
    //
    // Si no se sabe, se queda en null y se dice. No se hereda hacia atrás: las
    // peleas anteriores al primer /who no tienen nivel conocido, y fingir que
    // sí sería justo lo que este programa no hace.
    // Quién eres, y sólo para una cosa: los tramos sin mando son TUYOS, así que
    // el descuento de tiempo muerto sólo se le aplica a tu fila. Descontárselo a
    // todo el mundo regalaría segundos a compañeros que sí estaban jugando.
    this.self = ctx.self ?? null;
    this.level = ctx.level ?? null;
    this.classes = ctx.classes ?? null;
    /**
     * DOS PRINCIPIOS, Y NO ES UNA REDUNDANCIA.
     *
     *   start   la PRIMERA LÍNEA REAL. Es de donde sale la duración y, con
     *           ella, todo dps. Lo que se mide empieza aquí.
     *   desde   `start - APERTURA`. Es de donde se RECOGE: une ventanas y
     *           admite lo que lanzaste justo antes del primer golpe.
     *
     * Separarlos es la única forma de tener las dos cosas sin mentir en
     * ninguna. Si el dps saliera de `desde`, cada pelea arrastraría dos segundos
     * que nadie peleó; si la recolección saliera de `start`, se perdería el
     * casteo que abre la pelea. Ver `APERTURA`.
     */
    this.start = startT;
    this.desde = startT - APERTURA;
    this.end = startT;
    this.combatants = new Map();
    // Lo que no se puede atribuir: golpes entre dos bichos del mismo nombre
    // cuando uno está encantado. Se cuenta para poder decir cuánto no se sabe.
    this.charmAmbiguo = { golpes: 0, daño: 0 };
    // Lo que se cuenta como enemigo PORQUE HEMOS DEDUCIDO que su encanto se
    // rompió al encadenar otro. El registro no escribe nada cuando eso pasa, así
    // que este montón no tiene una sola línea que lo respalde y no puede
    // enseñarse junto a lo medido sin decirlo.
    this.charmSoltado = { golpes: 0, daño: 0 };
    /**
     * DOS DE LOS TUYOS PEGÁNDOSE ENTRE ELLOS. Medido, apartado y con su nombre.
     *
     * LO QUE PASÓ. Un compañero declarado apareció pegando al grupo en el Plano
     * del Miedo. La explicación casi segura es que lo encantaron a él, pero eso
     * NO ESTÁ ESCRITO en ninguna parte: el registro no dice quién encantó a
     * quién, y «a Kalforgelp lo encantaron» sería una deducción disfrazada de
     * medida. Lo que sí está escrito, línea a línea, es que dos miembros
     * declarados del grupo se pegaron durante N segundos. Eso es lo que se
     * cuenta aquí y lo único que la ficha afirma. La causa se calla.
     *
     * Y NO ES PRODUCCIÓN. Pegar a uno de los tuyos no le quita vida a ningún
     * enemigo, así que no suma en el daño del bando — exactamente por la misma
     * razón por la que `selfInflicted` no suma: «recibido sí, hecho no». Lo
     * recibido sigue contando en quien lo recibe, que es vida que perdió de
     * verdad.
     *
     * Tampoco es daño enemigo, y ahí estaba el fallo que esto cierra: bastaba UN
     * golpe para que la regla de bandos —enemigo es quien te pega— ascendiera a
     * un compañero declarado a enemigo PARA TODA LA PELEA, y su daño entero
     * aterrizaba en `enemyTotal`.
     *
     * MEDIDO SOBRE EL REGISTRO ENTERO, 709 peleas reconstruidas con cinco
     * compañeros declarados:
     *
     *   5 peleas con fuego amigo   5.977 de daño y 205 golpes, TODAS en el Plano
     *                              del Miedo, que es donde encantan.
     *   3 de esas 5                además tenían al compañero en el bando
     *                              enemigo: 11.862 de sus 24.499 de «daño
     *                              enemigo» —el 48%— eran del propio grupo, y en
     *                              la peor de las tres, el 55%.
     *
     * La más clara es la de las 23:01: `Kalforgelp` peleando contra el grupo 23
     * segundos, 865 puntos, y 480 más de vuelta tuya en 9 segundos.
     */
    this.entreTuyos = new Map();   // nombre -> {golpes, daño, desde, hasta, contra}
    /**
     * LOS SEGUNDOS EN QUE TU PERSONAJE NO ERA TUYO.
     *
     * El registro escribe los dos extremos y los escribe siempre:
     *
     *   You lose control of yourself!          31 veces en el registro de
     *   You have control of yourself again.    referencia, 31 cierres, ninguno
     *                                          suelto. Duración medida: mínimo
     *                                          2 s, mediana 9 s, máximo 37 s.
     *
     * Hasta ahora esos 37 segundos eran indistinguibles de estar mirando el
     * inventario: el hueco entraba en el «tiempo muerto» y se te acusaba de él.
     *
     * NO SE LLAMA «ENCANTADO» PORQUE LA LÍNEA NO LO DICE. Es el aviso genérico
     * de perder el mando, y lo mismo lo produce el miedo. Lo que sí distingue
     * los dos casos es lo que HACES dentro del tramo —encantado le pegas a los
     * tuyos, asustado corres— y eso está medido: por eso cada tramo lleva
     * cuántos golpes le diste a los tuyos mientras duraba. En los 31 episodios
     * del registro de referencia esa cuenta es cero en los 31, así que los 31
     * fueron miedo y ninguno se rotula como encanto.
     */
    this.sinControl = [];          // [{desde, hasta, golpes, daño, cierre}]
    /**
     * QUÉ LÍNEA SOSTIENE ESTA PELEA POR ENCIMA DE LO QUE EL PLAZO AGUANTA.
     *
     * `{nombre, tipo, desde, hasta, cubre, silencio, en}`, una por silencio
     * sostenido. Vacío en el 99 % de las peleas: sólo se llena cuando un mez, un
     * encanto o un tramo sin mando mantiene abierta una ventana por encima de
     * `PLAZO_ENEMIGO + APERTURA`, que es justo el caso en el que el modelo puede
     * UNIR dos peleas de las de antes en vez de cortarlas.
     *
     * Es la prueba que acompaña a la excepción del teorema: la pelea puede
     * señalar la línea que la une. Ver `PLAZO_ENEMIGO`.
     */
    this.sostenes = [];
    /**
     * MUERTES QUE LLEGARON SIN VENTANA. `{name, t, dt}`, y no cuentan como
     * abatidos. Ver `#vista`: una muerte no abre ventana, la cierra.
     *
     * Se anota en vez de tirarse porque es un hecho del registro —ese bicho ha
     * muerto— y porque el día que esta lista crezca querrá decir que algo del
     * modelo se ha movido. Hoy tiene un elemento en todo el histórico.
     */
    this.muertesHuerfanas = [];
    this.kills = [];
    this.closed = false;
    this.series = new Map();        // segundo -> {dmg, taken, heal} para la gráfica
    this.stanceSpans = [];          // [{from, to, stance}] franja de postura
    this.targetTotals = new Map();  // para nombrar la pelea
    this.deadAt = new Map();       // nombre -> segundo en que cayó
    // Lo que costó tumbar a cada enemigo, una muestra por muerte. Se anota al
    // caer y no al acabar la pelea: si el mismo enemigo cae tres veces, sumar el
    // daño de las tres y llamarlo «su vida» la triplica.
    // Y se le descuenta lo que le curaron: la muestra es daño MENOS curación,
    // no daño a secas. Un enemigo al que sanan 5.000 por el camino no tiene
    // 5.000 puntos de vida más, y contarlos así se los inventa. Medido sobre un
    // log real, le cambia la cifra a 59 de 147 enemigos —un 3,9% menos en
    // total— y a los que más, los que van con sanador: `the Spiroc Guardian`
    // un 17% y `a scareling` un 17%.
    this.hpSamples = new Map();    // nombre -> [(daño - curación) hasta cada muerte]
    this.deathBase = new Map();    // nombre -> daño acumulado en su muerte anterior
    this.healTotals = new Map();   // nombre -> curación recibida en la pelea
    this.healBase = new Map();     // nombre -> curación recibida en su muerte anterior
    // Daño real que no se puede atribuir a nadie: escudos sin posesivo
    // («shards of ice»). No entra en el total de nadie ni en el del grupo.
    this.unattributed = 0;
    this.loot = [];                // {item, from, sold, upgraded, t, via, amb}
    // La moneda de los cadáveres, con su instante. Aparte del botín porque se
    // cuelga con otra regla —ventana, no cadáver— y mezclarlas haría creer que
    // las dos se saben igual de bien. `cp` es el total en cobres.
    this.coins = [];               // {t, cp, raw}
    this.spellVsFoe = new Map();   // 'enemigo|hechizo' -> {landed, resisted}
    this.foesSeen = new Set();     // a quién estáis pegando en esta pelea
    // A quién habéis hecho daño, y sólo eso. `foesSeen` no sirve para esto:
    // se llena también con los destinos de vuestras curaciones, así que curar
    // a un compañero lo metería aquí y su curación de vuelta se confundiría
    // con una sanguijuela. Separados a propósito.
    this.golpeados = new Set();
    /** Curaciones tuyas que el log atribuyó al enemigo que las provocó. */
    this.lifetaps = 0;
    this.targetFirst = new Map();  // nombre -> primer segundo en que le pegaron
    this.resistsSuffered = 0;
    this.casts = [];           // {t, source, ability, cat} — el análisis filtra por bando
    // Cuándo se cayó cada buff, con su nombre. Es la MITAD que se puede
    // emparejar: la caída lleva nombre en las 1.020 líneas del registro de
    // referencia, y la entrada NO lo lleva en ninguna de las 2.839 —«notas una
    // curación floreciendo en ti» no dice de qué hechizo—. Así que el tiempo
    // que algo estuvo puesto se mide de LANZAMIENTO a caída, nunca de entrada
    // a caída.
    this.fades = [];           // {t, ability}
    this.resistsCaused = 0;    // hechizos enemigos que TÚ resististe
    // Y de quién y de qué, que es lo único que se puede usar para algo. Ver
    // dónde se llena, en `feed`.
    this.resistedByYou = new Map();   // 'enemigo hechizo' -> {foe, spell, n}
    this.interrupts = 0;
    this.stancesSeen = new Set();
    this.invocationsSeen = new Set();
  }

  /** Acumula por segundo relativo al inicio. */
  tick(t, field, amount) {
    const k = segundosDePelea(t, this.start, 'encounter');
    let b = this.series.get(k);
    // `tUnmit` es el tercer cubo del daño que recibes: lo que ninguna postura
    // para. Estaba dentro de `tSpell`, así que todo consumidor de la serie que
    // preguntara «¿cuánto mágico me está entrando?» contaba también el daño
    // periódico y el escudo, y decidía con ello. Ver `SIN_MITIGACION`.
    if (!b) b = { s: k, dmg: 0, taken: 0, heal: 0, tMelee: 0, tSpell: 0, tUnmit: 0, mine: 0 };
    this.series.set(k, b);
    b[field] += amount;
  }

  /**
   * Un golpe de uno de los tuyos a otro de los tuyos.
   *
   * Se guarda POR QUIEN PEGA, con sus dos extremos en el tiempo: la pregunta que
   * contesta la ficha es «¿quién estuvo peleando contra el grupo, y cuánto
   * rato?», y un total sin instantes no la contesta. Los segundos son la
   * distancia entre su primer golpe y el último, que es lo medido; no se
   * redondea a la pelea entera ni se estira hasta el final.
   */
  golpeEntreTuyos(ev) {
    const seg = Math.round(ev.t);
    let e = this.entreTuyos.get(ev.source);
    if (!e) {
      e = { name: ev.source, golpes: 0, daño: 0, desde: seg, hasta: seg, contra: new Set() };
      this.entreTuyos.set(ev.source, e);
    }
    e.golpes++;
    e.daño += ev.amount || 0;
    if (seg < e.desde) e.desde = seg;
    if (seg > e.hasta) e.hasta = seg;
    if (ev.target) e.contra.add(ev.target);
  }

  /** Pierdes el mando. Si ya lo habías perdido, no se abre otro tramo. */
  abrirSinControl(t) {
    const ult = this.sinControl[this.sinControl.length - 1];
    if (ult && ult.hasta === null) return;
    this.sinControl.push({ desde: t, hasta: null, acciones: 0,
      aTuyos: 0, aEnemigo: 0, aOtros: 0, daño: 0, cierre: null });
  }

  /**
   * Lo recuperas. `cierre` dice de dónde sale el final, que es la misma
   * distinción de siempre: aquí está escrito en el registro, y el otro cierre
   * posible —que la pelea acabe con el tramo abierto— es un recorte nuestro.
   */
  cerrarSinControl(t) {
    const ult = this.sinControl[this.sinControl.length - 1];
    if (!ult || ult.hasta !== null) return;
    ult.hasta = t;
    ult.cierre = 'medido';
  }

  /**
   * UNA ACCIÓN TUYA DENTRO DEL TRAMO, Y CONTRA QUIÉN. Es el falsador.
   *
   * NO ES UNA TENDENCIA, ES UN «NO». Con miedo no puedes actuar —no es que
   * normalmente no actúes— así que UNA sola acción tuya dentro del tramo
   * descarta el miedo, sin porcentajes. Y con encanto tampoco decides, pero
   * pegas a los tuyos. De ahí salen las tres respuestas, y las tres son
   * categóricas:
   *
   *   cero acciones            miedo
   *   acciones contra los tuyos encanto
   *   acciones contra el enemigo ninguna de las dos, y se dice que no se sabe
   *
   * QUÉ CUENTA COMO ACCIÓN, Y ESTO HAY QUE MEDIRLO O LA REGLA SE CAE. Sólo lo
   * que tuvo EFECTO: un golpe, un fallo —fallar es atacar—, una curación que
   * entró. Empezar a lanzar NO cuenta.
   *
   * Y no es una sutileza: en los 31 tramos del registro de referencia hay 24
   * líneas de «You begin casting Ensnare.» repartidas por 10 de ellos, y NINGUNA
   * tiene desenlace — ni impacto, ni resistencia, ni interrupción, ni «you can't
   * use that command». En el mismo registro, fuera de los tramos, Ensnare sí
   * aparece interrumpido 6 veces y resistido 9. O sea que dentro del miedo esa
   * línea es una tecla que el juego rechaza, no un acto del personaje.
   *
   * Contándola como acción, 10 de los 31 tramos habrían dejado de ser miedo por
   * culpa de un hotkey aporreado. Sin contarla, los 31 tienen cero acciones y el
   * rótulo se puede escribir con la misma seguridad que una cifra de daño.
   */
  accionSinControl(t, contra, amount = 0) {
    const ult = this.sinControl[this.sinControl.length - 1];
    if (!ult || ult.hasta !== null || t < ult.desde) return;
    ult.acciones++;
    if (contra === 'tuyos') { ult.aTuyos++; ult.daño += amount || 0; }
    else if (contra === 'enemigo') ult.aEnemigo++;
    else ult.aOtros++;
  }

  markStance(t, stance) {
    const k = segundosDePelea(t, this.start, 'encounter');
    const last = this.stanceSpans[this.stanceSpans.length - 1];
    if (last && last.stance === stance) return;
    if (last) last.to = k;
    this.stanceSpans.push({ from: k, to: k, stance });
  }

  /**
   * El combatiente con ese nombre, creándolo si es la primera vez.
   *
   * LA MAYÚSCULA DE PRINCIPIO DE FRASE NO CREA COMBATIENTES. EQ capitaliza la
   * primera letra de la línea, así que el mismo bicho llega como «Ice boned
   * skeleton» cuando pega y «ice boned skeleton» cuando le pegan, y se
   * partía en dos filas: una con todo el daño y cero recibido, otra al revés.
   * Medido sobre 415 peleas guardadas: 10 afectadas, 4 nombres partidos y unos
   * 14.800 de daño repartido entre filas que no existen. La mayor, «Heart
   * harpie» contra «heart harpie», con 11.260.
   *
   * Y SI CHOCAN, GANA LA MINÚSCULA, que no es una preferencia sino lo único
   * que puede ser: un nombre propio como «Lord Nagafen» se escribe igual en
   * medio de la frase que al principio, así que NUNCA produce un par. Si hay
   * dos formas, la de verdad es la minúscula y la otra es la frase.
   *
   * Se hace aquí y no al analizar porque aquí no depende del orden: al
   * analizar, lo emitido antes de aprender la forma buena se quedaba mal, y
   * probándolo salían tres nombres partidos en vez de cuatro — mejor, pero
   * todavía mal.
   */
  /**
   * El encantado y el salvaje del mismo nombre son dos combatientes.
   *
   * Se separan con una clave interna; el nombre que se enseña es el mismo, con
   * la marca `charmed` al lado. Sin separarlos, la única alternativa era
   * elegir un bando para todo el nombre y equivocarse en la mitad.
   */
  actorCharmed(name) {
    const clave = `${name}\u0000charm`;
    let c = this.combatants.get(clave);
    if (!c) {
      c = new Combatant(name);
      c.charmed = true;
      this.combatants.set(clave, c);
    }
    return c;
  }

  /**
   * ── Y LA FORMA BUENA GANA EN CUANTO APARECE ──────────────────────────────
   *
   * Aquí sólo se corregía en UNA dirección: de capitalizado a minúscula. Con
   * eso, un nombre cuya forma de verdad LLEVA mayúscula —`The Spiroc Guardian`,
   * donde el «The» es parte del nombre— se quedaba con la minúscula para
   * siempre, porque la primera línea que lo nombra suele abrir frase y ahí el
   * parser no tiene con qué saberlo todavía.
   *
   * Así que la corrección va en las DOS direcciones y la decide la prueba: la
   * forma escrita A MITAD DE FRASE, que es la única posición donde la mayúscula
   * significa algo. `formaDe` la trae del parser, que la va aprendiendo según
   * lee. Cuando llega, la fila ya abierta se renombra y se vuelve a indexar —el
   * mismo mecanismo que ya había, con mejor criterio.
   */
  #buena(name) {
    return (name && this.formaDe?.(name)) || name;
  }

  actor(name) {
    const buena = this.#buena(name);
    let c = this.combatants.get(buena);
    if (c) {
      if (c.name !== buena) c.name = buena;
      return c;
    }
    // Lo mismo con la forma cruda, por si la fila se abrió antes de que el
    // registro escribiera el nombre fuera del principio de frase.
    c = this.combatants.get(name);
    if (c) {
      if (buena !== name) {
        c.name = buena;
        this.combatants.delete(name);
        this.combatants.set(buena, c);
      }
      return c;
    }

    const baja = buena && claveDeNombre(buena);
    if (baja !== buena) {
      // Llega capitalizado: si ya está el mismo en minúscula, es ése.
      const yaEsta = this.combatants.get(baja);
      if (yaEsta) {
        if (yaEsta.name !== buena) {
          yaEsta.name = buena;
          this.combatants.delete(baja);
          this.combatants.set(buena, yaEsta);
        }
        return yaEsta;
      }
    } else {
      // Llega en minúscula: si estaba guardado capitalizado, se corrige.
      const alta = buena.charAt(0).toUpperCase() + buena.slice(1);
      const viejo = this.combatants.get(alta);
      if (viejo) {
        viejo.name = buena;
        this.combatants.delete(alta);
        this.combatants.set(buena, viejo);
        return viejo;
      }
    }

    c = new Combatant(buena);
    this.combatants.set(buena, c);
    return c;
  }

  /**
   * Convenciones de duración. Importa en peleas cortas:
   *  span      = último - primero        (en pelea de 1s da 0 -> DPS infinito)
   *  inclusive = span + 1                (la convención de siempre)
   */
  durations() {
    const span = Math.max(0, this.end - this.start);
    return { span, inclusive: span + 1 };
  }

  #row(c, inclusive) {
    const own = (c.last ?? 0) - (c.first ?? 0) + 1;
    return {
      name: c.name,
      // El encantado se enseña con su nombre y esta marca al lado: es el
      // mismo bicho, pero durante ese rato peleaba para ti.
      charmed: c.charmed === true,
      damage: c.damage,
      dps: c.damage / inclusive,
      dpsOwn: c.damage / own,
      /**
       * Y AQUÍ TAMBIÉN SE CAÍAN LOS SEGUNDOS SIN MANDO, por una puerta lateral.
       *
       * `activeSeconds` no cuenta sólo lo que HACES: `addTaken` también lo
       * toca, así que un segundo en el que sólo te pegaron cuenta como activo.
       * Durante un miedo te siguen pegando, de modo que el denominador crecía
       * mientras el numerador no podía crecer — te bajaba el dps activo por un
       * rato en el que no manejabas nada. Es la misma regla que el resto: ese
       * tiempo no cuenta ni a favor ni en contra.
       */
      dpsActive: c.damage / Math.max(1, c.activeSeconds.size - (c.name === this.self ? this.#activosSinMando(c) : 0)),
      // Tu mejor tramo de diez segundos seguidos. Cero cuando la pelea no llega
      // a diez, que no es «no tuviste ráfaga» sino que no cabe la pregunta.
      rafaga10: c.mejorRafaga(10),
      // Tu cadencia de ataque y lo que de verdad estuviste parado, medido
      // contra ella y no contra cero. Ver `cadencia()`.
      cadencia: c.cadencia(c.name === this.self ? this.sinControl : []),
      swingSec: c.swingSeconds.size,
      huecoReal: c.huecoReal(this.start, this.end,
        c.name === this.self ? this.sinControl : []),
      // Segundos de esta fila en los que no manejaba su personaje. Va en la fila
      // y no sólo en la pelea porque es lo que permite a cualquier consumidor
      // sacarlos de su denominador sin volver a cruzar nada.
      sinMandoSec: c.name === this.self ? this.segundosSinMando() : 0,
      hits: c.hits, meleeHits: c.meleeHits, misses: c.misses,
      crits: c.crits, critDamage: c.critDamage, critRate: c.critRate,
      flurries: c.flurries, ripostes: c.ripostes, healPotential: c.healPotential,
      max: c.max, min: c.min === Infinity ? 0 : c.min,
      accuracy: c.accuracy, avoidance: c.avoidance,
      taken: c.taken, swingsAgainst: c.swingsAgainst, deaths: c.deaths,
      absorbed: c.absorbed, absorbHits: c.absorbHits,
      healingDone: c.healingDone, healingTaken: c.healingTaken,
      activeSec: c.activeSeconds.size, hitSec: c.hitSeconds.size, ownSec: own,
      byAbility: sorted(c.byAbility), byTarget: sorted(c.byTarget),
      bySchool: sorted(c.bySchool), byType: sorted(c.byType),
      byStance: sorted(c.byStance), byInvocation: sorted(c.byInvocation),
      missReasons: [...c.missReasons].sort((a, b) => b[1].n - a[1].n),
      defense: [...c.defense].sort((a, b) => b[1].n - a[1].n),
      takenByType: sorted(c.takenByType), takenBySource: sorted(c.takenBySource),
      rawTakenByType: sorted(c.rawTakenByType), rawMeleeOut: c.rawMeleeOut,
      // Sólo si hubo golpes bajo alguna postura conocida: en una pelea sin
      // postura observada, una lista con un cubo `null` no dice nada y encima
      // se confundiría con haber medido algo.
      takenByStance: [...c.takenByStance.values()].filter((t) => t.stance && (t.n || t.avoided)),
      healBySpell: sorted(c.healBySpell), healByTarget: sorted(c.healByTarget),
    };
  }

  totals() {
    const { inclusive } = this.durations();
    const rows = [];
    let total = 0, healing = 0;
    for (const c of this.combatants.values()) {
      if (c.damage <= 0 && c.healingDone <= 0 && c.taken <= 0) continue;
      total += c.damage;
      healing += c.healingDone;
      rows.push(this.#row(c, inclusive));
    }
    rows.sort((a, b) => b.damage - a.damage || b.healingDone - a.healingDone);
    for (const r of rows) r.share = total ? r.damage / total : 0;
    return {
      rows, total, healing, duration: inclusive, raidDps: total / inclusive,
      charm: this.#charm(rows),
      entreTuyos: this.#entre(),
      sinControl: this.#sinMando(),
      // Los segundos que hay que sacar de cualquier denominador de actividad.
      // Miedo y encanto suman igual: los dos son involuntarios.
      sinMandoSec: this.segundosSinMando(),
    };
  }

  /**
   * Los tramos sin mando, relativos al inicio de la pelea y ya calificados.
   *
   * `encantado` no es una etiqueta que venga del registro: es la respuesta a
   * «¿le pegaste a los tuyos mientras durabas?», que sí está medida. Cuando la
   * respuesta es que no, el tramo se queda sin causa y la ficha lo dice así.
   */
  #sinMando() {
    if (!this.sinControl.length) return null;
    return this.sinControl.map((x) => {
      const fin = x.hasta ?? this.end;
      return {
        desde: segundosDePelea(x.desde, this.start, 'tramo.desde'),
        hasta: segundosDePelea(fin, this.start, 'tramo.hasta'),
        segundos: segundosDePelea(fin, x.desde, 'tramo.duración') + 1,
        acciones: x.acciones,
        aTuyos: x.aTuyos,
        aEnemigo: x.aEnemigo,
        daño: x.daño,
        // 'medido' cuando el registro escribió el final; 'pelea' cuando la
        // pelea se acabó con el tramo abierto y el final lo hemos puesto
        // nosotros. Son dos certezas distintas y no se enseñan igual.
        cierre: x.cierre ?? 'pelea',
        // El falsador, aplicado. Ver `accionSinControl`: no es un reparto de
        // probabilidad, son tres respuestas excluyentes. `null` es «ninguna de
        // las dos», y sale cuando actuaste CONTRA EL ENEMIGO sin tener el
        // mando — que no pasa ni una vez en el registro de referencia y que, si
        // pasa, hay que mirar en vez de rotular.
        causa: x.acciones === 0 ? 'miedo' : (x.aTuyos > 0 ? 'encanto' : null),
      };
    });
  }

  /**
   * SEGUNDOS EN LOS QUE NO MANEJABAS TU PERSONAJE. Miedo y encanto suman igual.
   *
   * La corrección que ordena esto: los dos son involuntarios, y ninguno de los
   * dos puede contar ni a favor ni en contra. Lo que los diferencia es sólo el
   * rastro que dejan en el registro —el miedo ninguno, el encanto golpes contra
   * los tuyos— y eso vale para etiquetarlos, no para tratarlos distinto en
   * ningún cálculo. Ni la duración es un dato sobre ti: no la decides tú.
   *
   * Los tramos no se solapan por construcción —`abrirSinControl` no abre uno
   * nuevo si hay otro abierto— así que basta sumar.
   */
  /** Cuántos de sus segundos «activos» caen dentro de un tramo sin mando. */
  #activosSinMando(c) {
    if (!this.sinControl.length) return 0;
    let n = 0;
    for (const s of c.activeSeconds) {
      if (this.sinControl.some((x) => s >= x.desde && s <= (x.hasta ?? this.end))) n++;
    }
    return n;
  }

  segundosSinMando() {
    let n = 0;
    for (const x of this.sinControl) {
      const fin = x.hasta ?? this.end;
      n += segundosDePelea(fin, x.desde, 'tramo.duración') + 1;
    }
    return n;
  }

  /**
   * Lo que se pegaron entre ellos los tuyos, listo para rotular.
   *
   * Uno por atacante y no un total: «hubo 1.400 de fuego amigo» no se puede
   * comprobar ni entender, y «Kalforgelp peleó contra el grupo · 23 s» sí. Si
   * los dos se pegaron —él encantado y tú devolviéndole— salen los dos, con lo
   * suyo cada uno. Que uno de ellos seas tú no lo esconde: le pegaste a un
   * compañero declarado, y eso pasó.
   *
   * Nulo cuando no hubo ninguno, que es prácticamente siempre.
   */
  #entre() {
    if (!this.entreTuyos.size) return null;
    const quien = [...this.entreTuyos.values()].map((e) => ({
      name: e.name,
      golpes: e.golpes,
      daño: e.daño,
      desde: segundosDePelea(e.desde, this.start, 'entreTuyos.desde'),
      hasta: segundosDePelea(e.hasta, this.start, 'entreTuyos.hasta'),
      // Del primer golpe al último, inclusive: la misma convención que la
      // duración de la pelea, para que las dos cifras se puedan comparar.
      segundos: segundosDePelea(e.hasta, e.desde, 'entreTuyos.duración') + 1,
      contra: [...e.contra],
    })).sort((a, b) => b.daño - a.daño);
    return {
      golpes: quien.reduce((a, x) => a + x.golpes, 0),
      daño: quien.reduce((a, x) => a + x.daño, 0),
      quien,
    };
  }

  /**
   * Lo que no se pudo atribuir del encanto, y una estimación de cuánto era
   * tuyo — APARTE, nunca sumada a las filas.
   *
   * El reparto por objetivo resuelve casi todo: en el registro de referencia,
   * 2.389 de daño atribuidos con certeza y 158 ambiguos, un 6,2%. Lo ambiguo
   * son golpes entre dos bichos del MISMO nombre, uno encantado y otro no, y
   * ahí el registro no da ninguna pista.
   *
   * `estimadoTuyo` reparte ese resto según el ritmo que cada uno demostró en
   * lo que SÍ se pudo medir. Es una deducción y va rotulada como tal: no entra
   * en el daño de nadie, viaja en su propio campo para que la interfaz pueda
   * decir «de esto, tanto probablemente era tuyo» sin ensuciar una cifra
   * medida. Medido y deducido nunca en la misma casilla.
   *
   * Si no hubo nada ambiguo —dos de las tres peleas— esto es cero y no hay
   * nada que rotular.
   */
  #charm(rows) {
    const amb = this.charmAmbiguo ?? { golpes: 0, daño: 0 };
    const sol = this.charmSoltado ?? { golpes: 0, daño: 0 };
    // Puede no haber nada ambiguo y sí haber algo deducido: son dos cosas
    // distintas —quién pegó, y si seguía siendo tuyo— y la ficha necesita las
    // dos por separado.
    if (!amb.daño && !sol.daño) return null;
    if (!amb.daño) {
      return { golpes: 0, daño: 0, estimadoTuyo: null, medidoTuyo: 0, medidoSuyo: 0, soltado: sol };
    }
    const tuyo = rows.filter((r) => r.charmed).reduce((a, r) => a + r.damage, 0);
    const suyo = rows.filter((r) => !r.charmed
      && rows.some((x) => x.charmed && x.name === r.name)).reduce((a, r) => a + r.damage, 0);
    const base = tuyo + suyo;
    return {
      golpes: amb.golpes,
      daño: amb.daño,
      // Sin nada medido con lo que comparar, no se estima: se dice que no.
      estimadoTuyo: base ? Math.round(amb.daño * (tuyo / base)) : null,
      medidoTuyo: tuyo,
      medidoSuyo: suyo,
      // Daño contado como enemigo apoyándose en una deducción, no en una línea.
      soltado: sol,
    };
  }
}

export class EncounterTracker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.self = opts.self ?? null;
    this.petNames = new Set();
    /** La forma atestiguada de un nombre. La pone `engine.js` desde el parser. */
    this.formaDe = opts.formaDe ?? null;
    /**
     * YA NO ES UN PLAZO: ES EL INTERRUPTOR DE SI ESTE RASTREADOR CIERRA.
     *
     * Desde la 1.14.0 la frontera la deciden las ventanas de cada enemigo
     * (`PLAZO_ENEMIGO`), no un hueco global, así que el VALOR de `idleSec` ya no
     * se usa para nada. Lo que sigue mandando es si es finito:
     *
     *   finito     este rastreador cierra peleas. Es el normal.
     *   Infinity   NO cierra nunca. Es el acumulador de sesión de `engine.js`,
     *              que existe justo para no cerrarse.
     *
     * SE CONSERVA EL NOMBRE Y NO SE RENOMBRA A `cierra: true`, a propósito: lo
     * pasan `main.cjs`, `rebuild.js`, `bin/live.js` y treinta pruebas, y un
     * renombrado callado convertiría cada una de esas llamadas en un
     * `undefined ?? 20` que volvería a cerrar por hueco global sin que nadie lo
     * note. Lo que sí se hace es no leer su valor en ninguna parte — buscar
     * `this.idleSec` en este fichero: sólo aparece dentro de `Number.isFinite`.
     */
    this.idleSec = opts.idleSec ?? PLAZO_ENEMIGO;
    this.closeOnDeath = opts.closeOnDeath ?? false;
    /**
     * LAS VENTANAS DE PARTICIPACIÓN, que son la pelea. `nombre -> {ultima, muerta}`.
     *
     *   ultima   la última línea suya. La ventana sigue abierta mientras
     *            `ahora - ultima <= PLAZO_ENEMIGO`, o mientras un estado medido
     *            tape ese silencio.
     *   muerta   su última línea fue su muerte y no ha vuelto a haber ninguna.
     *            Entonces la ventana se cierra EN EL INSTANTE, sin plazo: una
     *            muerte es una medición, no una espera.
     *
     * Se vacía al cerrar la pelea. Vive en el rastreador y no en el encuentro
     * porque la pregunta que contesta —«¿sigue habiendo pelea?»— es anterior a
     * que exista el encuentro siguiente.
     */
    this.ventanas = new Map();
    /**
     * La última línea de cada nombre, ATRAVESANDO peleas. Sólo sirve para poder
     * decir a qué distancia quedó la ventana anterior de una muerte huérfana —
     * la cifra que acompaña a la anotación, para que quien la lea pueda juzgar
     * si es «lo remataron ahí al lado» o «esto es otro bicho con el mismo
     * nombre». No decide nada. Ver `#vista`.
     */
    this.ultimaLinea = new Map();
    /**
     * LA PISTA DE ESTADO: lo que puede explicar un silencio sin cerrar la
     * ventana. `nombre -> [{desde, hasta, tipo}]`.
     *
     * TRES ENTRADAS, NO CUATRO, y el techo está medido: mez, encanto y tramo sin
     * mando. LA RAÍZ NO ESTÁ Y NO PUEDE ESTAR — en 850.171 líneas no hay ni una
     * de aterrizaje de root; lo único con nombre es «X has been ensnared» (120),
     * que es un ralentizador y no calla a nadie en cuerpo a cuerpo. Añadir la
     * raíz «por simetría» sería inventarse una entrada que el registro no
     * escribe. Si algún día aparece la línea, aquí es donde entra.
     *
     * El tramo sin mando no vive aquí: es del encuentro (`sinControl`), porque
     * es tuyo y no de un enemigo. Se consulta aparte, en `#tapado`.
     */
    this.estados = new Map();
    this.current = null;
    this.history = [];
    this.nextId = 1;
    this.zone = null;
    /**
     * Compañeros de grupo declarados o detectados por el canal.
     *
     * Sólo deciden si una pelea SE ABRE. No entran en `#mine()` —de quién es
     * el daño— ni cuentan como tuyos en ningún reparto: un compañero pegando
     * no eres tú pegando.
     */
    this.companions = new Set();
    // Objetos recogidos sin ningún cadáver conocido al que atribuirlos.
    this.lootSinPelea = 0;
    // Objetos cuyo cadáver murió en una pelea que ya estaba cerrada.
    this.lootTarde = 0;
    /**
     * AQUÍ VIVÍA `lootAmbiguo`, Y SE HA BORRADO. Queda la nota, no el contador.
     *
     * Contaba las recogidas donde dos cadáveres eran candidatos igual de
     * buenos, con este comentario al lado: «se cuentan para poder decir cuánto
     * no se sabe, no para taparlo». No lo leía nadie, así que se estaba
     * tapando: era una promesa escrita que el código incumplía.
     *
     * NO SE ARREGLÓ ENSEÑÁNDOLO, porque hay una fuente mejor y ya estaba: cada
     * objeto viaja con su `amb`, así que la cuenta se saca de la propia pelea y
     * además se puede señalar CUÁL es el dudoso, que un total no puede. Ver
     * `incertidumbreHTML` en `ui/app.js`.
     *
     * Y SE BORRA EN VEZ DE DEJARLO «POR SI ACASO», por la regla que salió de
     * esta misma sesión: una guarda dormida tiene un caso que la despierta y
     * está escrito cuál; una salida muerta no lo tiene. Ésta no tenía ninguno.
     * Dejarla es exactamente cómo se propaga esa familia.
     */
    /**
     * LOS CADÁVERES RECIENTES, que es lo que permite colgar el botín de su
     * pelea y no de la que esté abierta. `{clave, t, enc}`, en orden.
     *
     * Vive en el rastreador y no en la pelea A PROPÓSITO: su razón de ser es
     * justamente sobrevivir al cierre, porque el saqueo tardío es el caso que
     * hay que arreglar. Se poda por `VENTANA_CADAVER`, así que no crece.
     */
    this.cadaveres = [];
    // Los pone el motor según van llegando los hitos: /who y subidas de nivel.
    // Cada pelea se queda con los que hubiera al abrirse.
    this.level = null;
    this.classes = null;
  }

  /**
   * Los compañeros declarados. Los fija el motor cuando cambia la lista.
   *
   * Acepta lista o conjunto porque le llegan las dos cosas: la configuración
   * guarda una lista y el motor lleva un `Set`. Exigir sólo lista rompía la
   * reconstrucción entera con un «filter is not a function» que salía como
   * «error-de-lectura», sin decir dónde.
   */
  setCompanions(list) { this.companions = new Set([...(list ?? [])].filter(Boolean)); }

  /**
   * Abre o cierra un estado de esta pista. Ver `this.estados`.
   *
   * Un estado que se abre dos veces sobre el mismo nombre no apila ventanas: se
   * queda con la abierta. El registro nombra al bicho por su nombre y de ésos
   * hay tres delante, así que dos «has been mesmerized» seguidos pueden ser dos
   * bichos o el mismo remezado, y no hay forma de saberlo. Una sola ventana por
   * nombre es lo único que se puede sostener — y es justo lo que el modelo
   * necesita, porque su unidad también es el nombre.
   */
  #estado(nombre, tipo, t, on, tope) {
    if (!nombre) return;
    if (!this.estados.has(nombre)) this.estados.set(nombre, []);
    const v = this.estados.get(nombre);
    const ultima = v[v.length - 1];
    if (on) {
      if (ultima && ultima.hasta === null) return;         // ya abierto: no apila
      v.push({ desde: t, hasta: null, tipo, tope });
      if (v.length > 8) v.shift();
      return;
    }
    if (ultima && ultima.hasta === null && ultima.tipo === tipo) ultima.hasta = t;
  }

  /**
   * ¿HAY UN ESTADO MEDIDO QUE EXPLIQUE ESTE SILENCIO? De `desde` a `hasta`.
   *
   * El criterio es CUBRIR LA MITAD del silencio, no rozarlo. Es el que se midió
   * —de los 509 huecos de más de 20 s del registro, 77 quedan explicados así— y
   * el motivo de que no valga «que se toquen» es que un mez de 3 segundos no
   * explica un silencio de 40: diría que sí y estaría tapando el hueco entero
   * con la mitad de una prueba.
   *
   * Una ventana sin cerrar cuenta sólo hasta su tope, y el tope está medido por
   * tipo: `MEZ_MAX`, `CHARM_MAX_SEC`. Sin eso, un mez del que no se lee el final
   * —15 de 217— mantendría la pelea viva para siempre.
   */
  #tapado(nombre, desde, hasta) {
    const largo = hasta - desde;
    if (largo <= 0) return null;
    let cubierto = 0;
    let quien = null;
    for (const w of this.estados.get(nombre) ?? []) {
      const fin = Math.min(w.hasta ?? Infinity, w.desde + w.tope);
      const trozo = Math.max(0, Math.min(hasta, fin) - Math.max(desde, w.desde));
      if (trozo > 0 && (!quien || trozo > quien.cubre)) {
        quien = { nombre, tipo: w.tipo, desde: w.desde, hasta: w.hasta, cubre: trozo };
      }
      cubierto += trozo;
    }
    if (cubierto * 2 >= largo) return quien;
    // Y el tramo sin mando, que es del encuentro porque es tuyo y no de nadie
    // más: mientras no manejas tu personaje, que un enemigo calle no dice nada.
    let mando = 0, tramo = null;
    for (const s of this.current?.sinControl ?? []) {
      const fin = s.hasta ?? (s.desde + SIN_MANDO_MAX);
      const trozo = Math.max(0, Math.min(hasta, fin) - Math.max(desde, s.desde));
      if (trozo > 0 && (!tramo || trozo > tramo.cubre)) {
        tramo = { nombre, tipo: 'sin-mando', desde: s.desde, hasta: s.hasta, cubre: trozo };
      }
      mando += trozo;
    }
    return mando * 2 >= largo ? tramo : null;
  }

  /**
   * ¿SIGUE ABIERTA LA PELEA EN ESTE INSTANTE? La respuesta ES la definición.
   *
   * Queda abierta mientras quede UNA ventana de enemigo abierta. Cuando se
   * cierran todas, el componente conexo ha terminado y la línea siguiente abre
   * una pelea nueva.
   *
   * EL RESPALDO —`this.current.end`— no es un resto del modelo viejo: es lo que
   * pasa cuando todavía no hay ningún enemigo conocido. `foesSeen` sólo se
   * llena con daño, así que una pelea que arranca fallando no tiene ventanas que
   * mirar durante unos segundos. Sin el respaldo, esa pelea se cerraría a sí
   * misma en el primer fallo.
   */
  #sigueAbierta(ahora, ev = null) {
    /**
     * SE PREGUNTA POR EL PRINCIPIO DE LA VENTANA QUE VIENE, no por su primera
     * línea. Ver `APERTURA`: la ventana de este suceso empieza dos segundos
     * antes de él, y lo que decide si hay una pelea o dos es si esa ventana
     * TOCA alguna de las que ya están abiertas.
     *
     * Sin este `- APERTURA` la apertura no unía nada: era un campo que sólo
     * servía para mover `desde` dos segundos, o sea recolección sin la parte de
     * unir. Medido sobre el registro, olvidarlo costaba 553 peleas de más —1.716
     * en vez de 1.163— casi todas en las tandas de bichos que caen de un golpe:
     * cada bicho suelto que matabas entre dos del montón partía la tanda en tres.
     */
    const borde = ahora - APERTURA;
    let alguna = false;
    const vistos = this.current?.foesSeen;
    // Las dos formas, por lo mismo que `#clave`: `foesSeen` guarda el nombre tal
    // como venía en la línea que lo metió, y la ventana va normalizada.
    const esFoe = (n) => !!vistos && (vistos.has(n) || vistos.has(n.charAt(0).toUpperCase() + n.slice(1)));
    for (const [nombre, v] of this.ventanas) {
      if (!esFoe(nombre)) continue;
      alguna = true;
      /**
       * LA MUERTE CIERRA EN EL INSTANTE, y aquí es donde eso significa algo: la
       * ventana de un muerto acaba en su muerte, no en su muerte más el plazo.
       * Lo único que puede tocarla es algo que empiece antes de que se cierre.
       */
      if (v.muerta) { if (borde <= v.ultima) return true; continue; }
      if (borde - v.ultima <= PLAZO_ENEMIGO) return true;
      const sosten = this.#tapado(nombre, v.ultima, ahora);
      if (!sosten) continue;
      /**
       * SE ANOTA QUÉ LÍNEA SOSTIENE LA PELEA, y sólo cuando el plazo NO habría
       * bastado. Ver el teorema y su excepción, arriba.
       *
       * Es lo que convierte la excepción en propiedad comprobable: una pelea que
       * abarca un silencio mayor que la frontera vieja tiene que poder señalar la
       * línea del registro que la une. Sin esto, «diez casos justificados» y
       * «diez casos tolerados» se escriben igual — y el segundo es una grieta
       * que se ensancha sola. Lo guarda `test/peleas.js`.
       */
      if (ahora - v.ultima > PLAZO_ENEMIGO + APERTURA) {
        this.current.sostenes.push({
          ...sosten,
          silencio: Math.round(ahora - v.ultima),
          en: Math.round(ahora - this.current.start),
        });
        if (this.current.sostenes.length > 64) this.current.sostenes.shift();
      }
      return true;
    }
    /**
     * Y EL RELEVO DEL HOMÓNIMO, que es lo único que no se puede decidir mirando
     * sólo el pasado.
     *
     * «La muerte cierra la ventana» y «una línea posterior la reabre» se
     * contradicen durante un instante: cuando llega esa línea, la ventana consta
     * cerrada y la pelea se cerraría antes de poder reabrirla. Al releer en frío
     * no se nota —la ventana del nombre va de su primera línea a su última, y la
     * muerte sólo decide dónde acaba SI es lo último que hace— pero en vivo hay
     * que preguntarlo explícitamente: ¿este suceso resucita una ventana muerta?
     *
     * Dentro del plazo, sí: es el otro bicho con el mismo nombre. Fuera del
     * plazo, no, y es correcto que no — la ventana acabó en la muerte y esto es
     * una pelea nueva, que es justo el corte que el modelo viene a hacer.
     */
    for (const bruto of [ev?.source, ev?.target, ev?.victim, ev?.killer]) {
      const v = bruto && this.ventanas.get(this.#clave(bruto));
      if (v?.muerta && ahora - v.ultima <= PLAZO_ENEMIGO) return true;
    }
    if (alguna) return false;
    return ahora - this.current.end <= PLAZO_ENEMIGO;
  }

  /**
   * LA CLAVE DE UNA VENTANA VA EN MINÚSCULA INICIAL, y no es cosmético.
   *
   * EQ capitaliza el nombre cuando abre frase —«A shin ghoul knight has been
   * slain»— y lo deja en minúscula a mitad —«You slash a shin ghoul knight»—.
   * `Encounter.actor` ya reconcilia las dos formas para los combatientes; las
   * ventanas necesitan lo mismo o el nombre tiene dos ventanas según qué línea
   * lo nombre.
   *
   * LO CAZÓ LA GUARDA DE LAS MUERTES HUÉRFANAS, y por poco: de las 39 que
   * anotaba sobre el histórico, buena parte eran `Orc centurion`, `Dark-boned
   * skeleton` o `Amygdalan knight pet` — bichos que SÍ habían peleado, como
   * `orc centurion`, y cuya muerte no encontraba su propia ventana. La guarda
   * les habría quitado el abatido a peleas correctas. Es la misma familia de
   * `actor()`, atacando por la puerta nueva.
   */
  #clave(nombre) { return claveDeNombre(nombre); }

  /** Anota que este nombre ha dado señales de vida. Ver `this.ventanas`. */
  #vista(bruto, t, muerta = false) {
    if (!bruto) return;
    const nombre = this.#clave(bruto);
    this.ultimaLinea.set(nombre, t);
    const v = this.ventanas.get(nombre);
    /**
     * UNA MUERTE NO ABRE VENTANA: LA CIERRA.
     *
     * Una muerte no es un comienzo, es la prueba de algo que ya estaba pasando.
     * Si llega la muerte de un nombre que no ha dado ni una línea en esta pelea,
     * lo que hay debajo no es un enemigo entrando: es uno que ya había salido —
     * un veneno que acaba solo, o alguien que lo remató. Fundar una ventana con
     * eso mete en la pelea a un bicho que no estuvo en ella, y el reproductor lo
     * enseña como lo que parece: un enemigo que se muere en el segundo 1.
     *
     * Es el mismo razonamiento del botín: la recogida no dice DÓNDE pasó nada,
     * dice que hubo un cadáver — y el cadáver es de la pelea en la que ese bicho
     * estuvo peleando. Ver `VENTANA_CADAVER` y `#deQuePelea`.
     *
     * QUÉ CUESTA, MEDIDO, y por eso esto es una guarda y no un arreglo: sobre el
     * histórico entero, de las 387 muertes que caen en los dos primeros segundos
     * de una pelea, 386 son de un nombre que SÍ tiene línea propia en ese mismo
     * segundo o antes — o sea, lo mataste tú de un golpe y la pelea empieza con
     * eso, que es correcto. Queda UNA en 1.404 peleas. No se escribe porque
     * duela: se escribe porque la regla es cierta y sin ella el día que duela no
     * habrá nada que lo pare.
     *
     * Y NO SE LE BUSCA PELEA ANTERIOR, aunque la regla candidata lo pedía. Se
     * midió: la distancia de esas muertes a la última línea de una ventana
     * anterior del mismo nombre no tiene horizonte —mediana 34 s, p75 105 s, p90
     * 284 s, máximo 1.076 s, sin ningún corte limpio— al revés que el botín, que
     * tenía un hueco de 600 s a 12 h sin una sola recogida dentro. Sin cliff no
     * hay ventana que elegir, y con el homónimo delante «la anterior de ese
     * nombre» no dice de cuál era. Así que la muerte huérfana se ANOTA y no se
     * adjudica.
     */
    if (!v) {
      if (muerta) return;
      this.ventanas.set(nombre, { ultima: t, muerta });
      return;
    }
    v.ultima = t;
    // Una línea suya DESPUÉS de su muerte reabre la ventana, y eso no es un
    // apaño: es la prueba de que había al menos dos con ese nombre. Un muerto no
    // pega. Ver `test/peleas.js` y el suelo de individuos del reproductor.
    v.muerta = muerta;
  }

  feed(ev) {
    if (!ev) return;
    /**
     * EL CAMBIO DE ZONA CIERRA TODO. Regla propia, y es un hecho, no una
     * heurística: no se puede pelear con algo que está en otra zona.
     *
     * Va escrita aparte y no como efecto colateral de ningún plazo, porque no
     * depende de ninguno. Y conviene saber que HOY NO CORTA NADA: medido sobre
     * el histórico de referencia, ninguna de las 844 fronteras tiene un hueco de
     * ≤20 s, o sea que ningún cierre por zona llegó a quedar pegado al siguiente.
     * Si algún día corta, será por un caso nuevo y no por un ajuste de otra cosa.
     */
    if (ev.kind === 'zone') { this.zone = ev.zone; this.#close(); return; }
    /**
     * LA PISTA DE ESTADO SE ALIMENTA ANTES QUE NADA, y antes del filtro de
     * relevancia: la línea del mez no nombra a nadie más que al bicho, así que
     * no pasaría el filtro —que pide que toque a los tuyos— y se perdería justo
     * cuando hace falta, que es cuando el bicho ha dejado de dar señales.
     */
    if (ev.kind === 'mez') { this.#estado(ev.target, 'mez', ev.t, ev.on === true, MEZ_MAX); return; }
    if (ev.kind === 'charm_on') { this.#estado(ev.target, 'encanto', ev.t, true, CHARM_MAX_SEC); return; }
    if (ev.kind === 'charm_off') { this.#estado(ev.target, 'encanto', ev.t, false, CHARM_MAX_SEC); return; }
    // Una subárea NO es un cambio de zona: «You have entered an area where
    // levitation effects do not function» pasa dentro del Plano del Cielo y,
    // tratándola como zona, se llevaba por delante la zona real y su
    // dificultad. Se anota por si sirve, pero no cierra la pelea ni sustituye
    // nada.
    if (ev.kind === 'subarea') { this.subarea = ev.area; return; }

    // Señales que alimentan el consejo de invocación. No abren pelea por sí solas.
    if (this.current) {
      // Sólo cuenta como resistencia sufrida si el lanzador eras tú o tu mascota.
      if (ev.kind === 'resist') {
        if (this.#mine().has(ev.caster)) {
          this.current.resistsSuffered++;
          // Contra QUIÉN y con QUÉ hechizo: es lo que permite saber después a
          // qué es resistente cada enemigo, medido en tus propias peleas.
          this.#tally(this.current, ev.target, ev.ability, 'resisted', ev.invocation);
        }
      } else if (ev.kind === 'resist_by_you') {
        this.current.resistsCaused++;
        /**
         * Y CONTRA QUIÉN, QUE ES LA MITAD QUE FALTABA.
         *
         * `resistsCaused` es un número por pelea: «resististe 7». Eso no se
         * puede usar para nada, porque la pregunta útil es de quién y de qué:
         * «a este bicho le resistes su miedo casi siempre» sí cambia lo que
         * haces. Es la misma forma que `spellVsFoe`, que ya guarda el sentido
         * contrario —tus hechizos contra él—, y por eso comparte estructura.
         *
         * De aquí sale además el sitio al que se muda `resist_by_you` cuando
         * deja la pista del reproductor: allí eran 1.972 marcas para explicar
         * lo que NO pasó; aquí son una proporción por enemigo.
         *
         * SU COSTE, DICHO: es un campo nuevo por pelea. Las peleas guardadas
         * antes de la 1.13.0 no lo tienen y no se puede deducir de lo guardado
         * —el lanzador y el hechizo sólo están en el registro—, así que sólo
         * aparece al reconstruir. Entra en la deuda que la 1.13.0 paga.
         */
        if (ev.caster && ev.ability) {
          const k = `${ev.caster} ${ev.ability}`;
          const e = this.current.resistedByYou.get(k)
            ?? { foe: ev.caster, spell: ev.ability, n: 0 };
          e.n++;
          this.current.resistedByYou.set(k, e);
        }
      }
      else if (ev.kind === 'interrupt') this.current.interrupts++;
      else if (ev.kind === 'buff_fade' && ev.ability) {
        this.current.fades.push({ t: Math.round(ev.t - this.current.start), ability: ev.ability });
      }
      // TODOS los lanzamientos, no sólo los categorizados.
      //
      // Antes hacía falta `castCat` para guardarlo, y la categoría sólo la
      // tienen las utilidades —curas, raíces, mez, miedo—. Medido: de 18.921
      // lanzamientos con nombre se guardaban 2.333, un 12%. Y de los TUYOS,
      // 702 de 6.457.
      //
      // Lo que se caía era justo lo que hace falta para leer una línea de
      // tiempo: los nukes. «Water Elemental Attack» 4.408 veces, «Drain
      // Spirit» 1.851, «Cinder Bolt» 371 — nada de eso se guardaba, así que la
      // pregunta «¿estaba usando sus hechizos?» no se podía contestar.
      //
      // Cuesta 1,3 MB sobre un almacén de 7. La categoría se sigue guardando
      // cuando se conoce, que es lo que usa el consejero.
      else if (ev.kind === 'cast' && ev.ability && ev.source) {
        this.current.casts.push({
          t: Math.round(ev.t - this.current.start),
          source: ev.source, ability: ev.ability, cat: ev.castCat ?? null,
        });
      }
      // Perder y recuperar el mando del personaje. Va aquí, con las señales que
      // no abren pelea: si no hay combate abierto no hay dónde apuntarlo, y una
      // pérdida de control no es motivo para inventarse un encuentro — el miedo
      // te pilla corriendo por la zona tanto como peleando.
      else if (ev.kind === 'control') {
        if (ev.on) this.current.abrirSinControl(ev.t);
        else this.current.cerrarSinControl(ev.t);
        /**
         * Y EL TRAMO NO PUEDE PARTIR LA PELEA EN DOS.
         *
         * El silencio de un miedo no es que dejaras de combatir: es que NO
         * PODÍAS, y por eso no hay líneas. Cortar ahí por inactividad es
         * exactamente el error que el resto de este cambio corrige, sólo que
         * cometido con las fronteras en vez de con las cifras — y sale más
         * caro, porque parte una pelea en dos trozos con cifras propias.
         *
         * Medido: 8 de los 31 tramos pasan de `idleSec`, y los ocho están en el
         * Plano del Miedo, que es donde están las peleas que importan. El más
         * largo, 38 s.
         *
         * `end` se mueve porque es lo que mira la guarda de inactividad, tanto
         * en `feed` como en `tick`. No toca ninguna otra cifra: la duración de
         * la pelea ya sale de `end - start` y el tramo estaba dentro de la pelea
         * de todos modos. Lo que cambia es que ahora sigue siendo UNA pelea.
         */
        this.current.end = Math.max(this.current.end, ev.t);
      }
      else if (ev.kind === 'stance' && ev.stance) this.current.stancesSeen.add(ev.stance);
      else if (ev.kind === 'invocation' && ev.invocation) this.current.invocationsSeen.add(ev.invocation);
    }

    // ── EL BOTÍN SE CUELGA DE SU CADÁVER, NO DE LA VENTANA ───────────────────
    //
    // Ver `#deQuePelea`. Aquí sólo se decide dónde va lo que salga de allí.
    //
    // `qty` viaja con el objeto en vez de expandirse en dos entradas iguales:
    // «2 Bone Chips» es una recogida de dos unidades, no dos recogidas, y la
    // diferencia importa al contar de cuántos cadáveres ha salido algo.
    if (ev.kind === 'loot' && ev.item) {
      const comun = {
        item: ev.item, qty: ev.qty ?? 1, from: ev.from ?? null,
        sold: ev.sold ?? null, upgraded: ev.upgraded ?? null,
        stored: ev.stored ?? false, depot: ev.depot ?? false,
        // El sexto destino, tipado en la 1.24.0. Se contaba como recogido y su
        // destino viajaba en `cola`, sin interpretar.
        hoard: ev.hoard ?? false,
        // La cola desconocida de un final que aún no tiene regla. Viaja hasta la
        // ficha en vez de perderse: ver la red del final del botín en
        // `patterns.js`.
        cola: ev.cola ?? null,
      };
      const d = this.#deQuePelea(ev);
      if (d.enc && d.enc === this.current) {
        // El caso normal: el cadáver murió en la pelea que sigue abierta.
        this.current.loot.push({
          ...comun, via: 'cadaver', amb: d.amb, dt: d.dt,
          t: segundosDePelea(ev.t, this.current.start, 'tracker'),
        });
      } else if (d.enc) {
        // ── Botín que llega TARDE ──────────────────────────────────────────
        //
        // El cadáver murió en una pelea que ya está cerrada —y guardada, y
        // `fights.ndjson` sólo se añade por el final: meterlo dentro correría
        // todos los bytes siguientes y dejaría el índice entero apuntando a
        // sitios equivocados—. Así que va al fichero lateral CON la pelea a la
        // que pertenece, igual que `tramos.ndjson`. No se pierde y no se le
        // cuelga a la pelea siguiente, que es lo que pasaba: 34 objetos de un
        // histórico real colgados de una pelea posterior, mediana 10 minutos.
        this.lootTarde++;
        this.emit('lateLoot', {
          ...comun, via: 'cadaver', amb: d.amb, dt: d.dt,
          t: ev.t, de: Math.round(d.enc.start * 1000),
          zone: d.enc.zone ?? this.zone ?? null,
        });
      } else {
        // ── Botín sin cadáver que case ─────────────────────────────────────
        //
        // Pasa cuando al enemigo lo remata entero un compañero: el filtro de
        // relevancia sólo abre pelea contigo o con tus mascotas, así que esa
        // muerte nunca se registró y no hay cadáver al que mirar.
        //
        // Y NO se arregla dejando que un compañero abra pelea. Se probó y se
        // midió: recupera 3 de 5 y abre la puerta a que su pelea en la otra
        // punta de la zona entre en tu histórico, que es lo que `test/combat.js`
        // prohíbe «bajo ningún concepto».
        //
        // Se arregla entendiendo qué es esto: recoger un objeto es un suceso
        // TUYO, no de una pelea. La prueba de que estabas allí es que lo
        // cogiste, no que él pegara. Sale por su cuenta y se guarda por su
        // cuenta, sin inventar un encuentro que no existió — y la ficha lo
        // dice, que es distinto de no enseñarlo.
        this.lootSinPelea++;
        this.emit('orphanLoot', {
          ...comun, via: 'suelto', porQue: d.porQue,
          t: ev.t, zone: this.zone ?? null,
        });
      }
      return;
    }

    // ── LA MONEDA ────────────────────────────────────────────────────────────
    //
    // Sólo por ventana, y no por descuido: `You receive 2 gold from the corpse`
    // NO DICE DE QUÉ CADÁVER. Sin nombre no hay nada que emparejar, así que la
    // regla del cadáver no se le puede aplicar y se queda con la única que hay.
    // La ficha lo etiqueta distinto porque es una certeza distinta.
    if (ev.kind === 'coin') {
      if (this.current) this.current.coins.push({ t: segundosDePelea(ev.t, this.current.start, 'tracker'), cp: ev.cp ?? 0, raw: ev.coin ?? null });
      else this.emit('orphanCoin', { cp: ev.cp ?? 0, raw: ev.coin ?? null, t: ev.t, zone: this.zone ?? null });
      return;
    }

    const isCombat = DAMAGE_KINDS.has(ev.kind) || ev.kind === 'miss'
      || ev.kind === 'heal' || ev.kind === 'death' || ev.kind === 'absorb';
    if (!isCombat) return;

    // ── Filtro de relevancia ──────────────────────────────────────────────
    //
    // El log ve TODO lo que pasa a tu alrededor, incluido un desconocido
    // matando enemigos a diez metros. Sin este filtro su pelea entra en la tuya
    // y falsea el reparto entero.
    //
    // Cuenta un suceso si toca a los tuyos (tú o tus mascotas) o a alguien a
    // quien los tuyos ya estáis pegando. Con eso los compañeros de grupo
    // entran solos al golpear vuestro objetivo, y el de al lado no.
    const mine = this.#mine();
    /**
     * LA GUARDA VIVE EN `src/relevancia.js`, Y AQUÍ SE LLAMA.
     *
     * Estaba escrita aquí dentro, y el reproductor contestaba la misma pregunta
     * por su cuenta con una regla mucho más débil —cualquiera que apareciera en
     * la ventana de tiempo de la pelea—. Medido antes de arreglarlo: 184 peleas
     * de 1.561 con combate ajeno DIBUJADO dentro, y la peor con catorce figuras
     * donde hubo tres.
     *
     * El arreglo no fue endurecer aquella regla: fue borrarla y llamar a ésta.
     * Una pregunta, un sitio.
     *
     * Sin saber quién eres no hay nada que filtrar: se acepta todo antes que
     * descartar la pelea entera. Pasa en pruebas, y si el personaje aún no se ha
     * deducido del nombre del fichero. Eso es el `mine.size &&` de abajo, y por
     * eso se queda aquí y no dentro de la guarda: es una condición de ESTE
     * llamador —el que aún está aprendiendo quién eres—, no de la pregunta.
     */
    const relevante = esRelevante(ev, {
      mios: mine,
      objetivos: this.current?.foesSeen ?? VACIO,
      enPelea: this.current?.combatants ?? VACIO,
      companions: this.companions,
    });
    if (mine.size && !relevante) return;

    // AQUÍ SE DECIDE LA FRONTERA, y ya no la decide un hueco: la deciden las
    // ventanas. Ver `#sigueAbierta` y la definición al lado de `PLAZO_ENEMIGO`.
    if (Number.isFinite(this.idleSec) && this.current && !this.#sigueAbierta(ev.t, ev)) this.#close();
    if (!this.current) {
      // Una muerte suelta no abre pelea: sin golpes previos no hay nada que
      // contar, y la de un desconocido a diez metros no es asunto tuyo.
      if (ev.kind === 'death') return;
      // Y una runa tampoco: dice que algo te iba a dar y no dice qué ni quién.
      // Sin un golpe delante no hay pelea que abrir.
      if (ev.kind === 'absorb') return;
      // ── Un compañero declarado también abre pelea, pero sólo PEGANDO ──
      //
      // Aquí ponía que los compañeros no debían entrar nunca en esta regla,
      // porque «una pelea suya al otro lado de la sala se guardaría como
      // tuya». El aviso era razonable y resultó no cumplirse: medido sobre un
      // registro real, dejarles abrir pelea añade 4 encuentros y los 4 tienen
      // cero daño tuyo Y cero daño total, así que el almacén no guarda ninguno
      // —sólo se guarda lo que tuvo daño— y las peleas almacenadas siguen
      // siendo 306 exactamente. Lo que sí recupera son 3 objetos de botín que
      // antes no tenían dónde ir.
      //
      // La condición de que sea DAÑO y no cualquier suceso es lo que evita el
      // problema de verdad: sin ella, un fallo o una curación suya abrían un
      // encuentro vacío que no se guarda pero sí llega al narrador, y te
      // anunciaba el final de una pelea que no había existido.
      //
      // Sigue sin entrar en `#mine()`, y eso no ha cambiado: `#mine()` decide
      // de quién es el daño, no sólo si la pelea se abre. Un compañero pegando
      // no eres tú pegando.
      // AQUÍ NO. Se probó a meter `compaPega` también en esta guarda y lo cazó
      // una prueba que ya existía, con su invariante escrita: «lo que no puede
      // pasar bajo ningún concepto es que su pelea sea la tuya». Un compañero
      // peleando solo, sin ti en ninguna parte, NO abre una pelea tuya.
      //
      // El comentario del escape decía «permite que la pelea de tu grupo
      // exista cuando tú no llegaste a tocar al enemigo», y esa frase se puede
      // leer de dos maneras: estás en la pelea pero no has tocado a ESE bicho
      // —cierto, y lo resuelve la guarda de relevancia— o no estás en absoluto
      // —falso, y es lo que la prueba prohíbe—. Vale la primera.
      if (mine.size && !mine.has(ev.source) && !mine.has(ev.target)) return;
      this.current = new Encounter(this.nextId++, ev.t, this.zone,
        { level: this.level ?? null, classes: this.classes ?? null, self: this.self });
      this.emit('open', this.current);
    }

    /**
     * DAÑO ENTRE DOS DE LOS TUYOS, y la identidad declarada gana.
     *
     * Un compañero que has declarado tuyo NO se convierte en enemigo porque te
     * pegue. Puede que lo hayan encantado, puede que sea un escudo de daño mal
     * dirigido, puede que sea otra cosa: no lo sabemos. Lo que sí sabemos es
     * quién es, porque lo dijiste tú, y eso no lo revoca un golpe.
     *
     * Ver `Encounter.entreTuyos`. Lo que sigue mira esta marca en cada sitio
     * donde un golpe cambia de bando a alguien:
     *
     *   `foesSeen`      si entrara, el compañero pasaría a ser «a quien estáis
     *                   pegando» y con eso arrastraría al filtro de relevancia.
     *   `targetTotals`  la pelea se llama como el que más daño recibió: sin esta
     *                   guarda, un encuentro contra un golem se titula con el
     *                   nombre de tu compañero.
     *   `golpeados`     alimenta el discriminador de la sanguijuela. Un
     *                   compañero al que has pegado y que luego te cura pasaría
     *                   por un drenaje tuyo.
     *   la producción   pegar a uno de los tuyos no es hacer daño: se aparta.
     */
    const tuyos = this.#tuyos();
    const entreTuyos = ev.amount > 0 && ev.source && ev.target
      && ev.source !== ev.target && ev.selfInflicted !== true
      && tuyos.has(ev.source) && tuyos.has(ev.target);

    /**
     * EL FALSADOR, ALIMENTADO. Cualquier acción TUYA con efecto, y contra quién.
     *
     * Sólo lo que tuvo efecto: pegar, fallar —fallar es atacar— y curar. Empezar
     * a lanzar no entra, y el motivo está medido en `accionSinControl`.
     *
     * Va aquí y no dentro del reparto de daño porque la pregunta es otra: no es
     * «de quién es este golpe» sino «¿tu personaje hizo algo?». Un fallo tuyo no
     * mueve ninguna cifra de daño y sin embargo descarta el miedo él solo.
     */
    if (ev.source === this.self && this.current?.sinControl?.length) {
      const conEfecto = (DAMAGE_KINDS.has(ev.kind) && ev.amount > 0)
        || ev.kind === 'miss' || (ev.kind === 'heal' && ev.amount > 0);
      if (conEfecto && ev.selfInflicted !== true) {
        const obj = ev.target;
        const contra = !obj || obj === this.self ? 'otro'
          : tuyos.has(obj) ? 'tuyos' : 'enemigo';
        this.current.accionSinControl(ev.t, contra, contra === 'tuyos' ? ev.amount : 0);
      }
    }

    // A quién estáis pegando: define qué es «vuestra» pelea a partir de ahora.
    if (!entreTuyos) {
      if (ev.amount > 0 && ev.target && mine.has(ev.source)) this.current.foesSeen.add(ev.target);
      if (ev.amount > 0 && ev.source && mine.has(ev.target)) this.current.foesSeen.add(ev.source);
    }
    const enc = this.current;
    enc.end = Math.max(enc.end, ev.t);
    /**
     * Y AQUÍ SE ANOTAN LAS VENTANAS, con todo lo que toque a un enemigo.
     *
     * Cuenta CUALQUIER línea suya, no sólo las que hacen daño: un fallo suyo
     * dice que sigue ahí igual que un golpe, y una curación que recibe también.
     * La ventana mide participación, no daño.
     *
     * Y se anotan los dos extremos sin preguntar de qué bando son: `#sigueAbierta`
     * ya filtra por `foesSeen`, que es la aproximación en vivo de `#sides`.
     * Guardar de más aquí no cuesta nada; filtrar de más costaría perder al
     * enemigo que entra en la pelea justo cuando otro deja de dar señales.
     */
    if (ev.kind !== 'death') {
      if (ev.source && !mine.has(ev.source)) this.#vista(ev.source, ev.t);
      if (ev.target && !mine.has(ev.target)) this.#vista(ev.target, ev.t);
    }

    if (DAMAGE_KINDS.has(ev.kind) && ev.amount > 0) {
      // Un escudo de daño sin posesivo no dice de quién es. Adjudicárselo a un
      // combatiente llamado «Unknown» lo metía en el total del grupo y diluía
      // el porcentaje de todos los demás: se aparta, que es lo que promete el
      // README, y el que lo recibe sí lo contabiliza.
      const huerfano = ev.confidence === 'none' && ev.source === 'Unknown';

      // PEGARTE A TI MISMO NO ES PEGAR, y se estaba contando como tal.
      //
      // «You hit yourself for 62 points of unresistable damage by Cannibalize»
      // entraba como daño HECHO por ti además de recibido: 62 puntos de tu
      // propia vida sumando a tu DPS y al total del grupo, con Cannibalize
      // apareciendo en tu tabla de habilidades y tú mismo en la de objetivos.
      // Lo mismo hace «You hurt yourself for N points».
      //
      // Recibido sí: es vida que pierdes. Hecho no: no se lo has quitado a
      // nadie. Y fuera del total del grupo, que es la suma de lo que le habéis
      // hecho al enemigo.
      //
      // LA MARCA VIENE DEL PRONOMBRE, no de comparar nombres. Que origen y
      // destino se llamen igual no prueba que sean el mismo: un encantado
      // pegando a un salvaje del mismo nombre son dos bichos, y esa línea ya
      // está contada aparte como ambigua. Comparando nombres, aquello caía aquí
      // dentro y se descontaba un golpe que sí ocurrió.
      const aTiMismo = ev.selfInflicted === true;

      if (huerfano) enc.unattributed += ev.amount;
      // Entre los tuyos: se aparta con su nombre y no entra en la producción de
      // nadie. Lo recibido sí se anota, dos líneas más abajo, porque es vida que
      // se perdió de verdad.
      else if (entreTuyos) enc.golpeEntreTuyos(ev);
      else if (ev.source && !aTiMismo) this.#deQuien(enc, ev, true).addDamage(ev);
      if (ev.target) this.#deQuien(enc, ev, false).addTaken(ev);
      if (!huerfano && !aTiMismo && !entreTuyos) enc.tick(ev.t, 'dmg', ev.amount);
      // `mine` es la línea de TU daño en la gráfica: la autolesión tampoco
      // pinta ahí, por lo mismo. Y pegarle a un compañero, tampoco.
      if (ev.source === this.self && !aTiMismo && !entreTuyos) enc.tick(ev.t, 'mine', ev.amount);
      if (ev.target === this.self) {
        // Bruto y separado por escuela: sin esto no se puede juzgar la
        // postura tramo a tramo, sólo la media de toda la pelea.
        const raw = ev.rawAmount ?? ev.amount;
        enc.tick(ev.t, 'taken', ev.amount);
        // Los tres cubos salen de la MISMA lista que usan el analizador, el
        // almacén y el consejero. Aquí ponía «lo que no es melé es mágico», y
        // ésa es la decisión que ningún consumidor debe volver a tomar por su
        // cuenta: en cuanto hay dos criterios, discrepan.
        enc.tick(ev.t, cuboRecibido(ev.school), raw);
      }
      if (ev.target && !entreTuyos) {
        const b = enc.targetTotals.get(ev.target) ?? 0;
        enc.targetTotals.set(ev.target, b + ev.amount);
        if (!enc.targetFirst.has(ev.target)) enc.targetFirst.set(ev.target, ev.t);
      }
      if (ev.target && mine.has(ev.source) && !entreTuyos) enc.golpeados.add(ev.target);
      // Un hechizo vuestro que sí entró, para saber la proporción contra ese
      // enemigo. Va AQUÍ y no en el bloque de señales de arriba porque aquél
      // exige que la pelea ya esté abierta, y el primer hechizo de la pelea es
      // justo el que la abre: se perdía siempre, y como las resistencias no
      // abren pelea, el porcentaje de resistencia salía inflado.
      //
      // Cuenta tú y tus mascotas, igual que el lado de las resistencias. Antes
      // sólo contaba lo tuyo, así que todo lo que lanzara la mascota salía con
      // 0 aciertos y N resistencias: un 100% de resistencia que no existía.
      if (ev.kind === 'spell' && ev.ability && ev.target && mine.has(ev.source)) {
        this.#tally(enc, ev.target, ev.ability, 'landed', ev.invocation);
      }
      if (ev.stance) enc.markStance(ev.t, ev.stance);
    } else if (ev.kind === 'miss') {
      if (ev.source) enc.actor(ev.source).addMissDealt(ev);
      if (ev.target) enc.actor(ev.target).addAvoided(ev);
    } else if (ev.kind === 'absorb' && ev.amount > 0) {
      // La runa se come el golpe entero. No abre pelea por sí sola —no dice
      // contra quién fue— pero si ya hay una, cuenta.
      if (ev.target) enc.actor(ev.target).addAbsorbed(ev);
    } else if (ev.kind === 'heal' && ev.amount > 0) {
      // ── Sanguijuela: el log pone al ENEMIGO de sanador ──────────────────
      //
      // «Lord Nagafen has taken 451 damage from your Harm Touch X.» y, en el
      // mismo segundo, «Lord Nagafen healed you for 451 hit points by Leech
      // Touch I.» — el drenaje te devuelve lo que hizo tu golpe, y el cliente
      // nombra sanador al que lo recibió. Son 321 líneas en un log real, y
      // engordaban la curación hecha por cada jefe con la tuya propia.
      //
      // El discriminador es el daño y no la habilidad: si el que «te cura» es
      // alguien a quien acabáis de pegar, la curación es tuya. Medido, separa
      // las dos poblaciones sin solaparse — las 321 sanguijuelas vienen todas
      // de un enemigo, y las 25 curaciones de verdad, todas de un compañero al
      // que nadie estaba pegando.
      const sanguijuela = ev.target === this.self
        && ev.source && ev.source !== this.self && enc.golpeados.has(ev.source);
      const quienCura = sanguijuela ? this.self : ev.source;
      if (sanguijuela) enc.lifetaps++;
      enc.tick(ev.t, 'heal', ev.amount);
      if (quienCura) enc.actor(quienCura).addHealDone({ ...ev, source: quienCura });
      if (ev.target) {
        enc.actor(ev.target).addHealTaken(ev);
        enc.healTotals.set(ev.target, (enc.healTotals.get(ev.target) ?? 0) + ev.amount);
      }
    } else if (ev.kind === 'death') {
      /**
       * LA MUERTE HUÉRFANA NO ENTRA EN LOS ABATIDOS, Y SE ANOTA. Ver `#vista`.
       *
       * Sin ventana de ese nombre en esta pelea, esta muerte no es de aquí: se
       * contaría como una presa tuya, saldría en el rótulo de la pelea y dejaría
       * una muestra de vida con el daño de otra. Medido: 1 caso en 1.404 peleas.
       */
      if (ev.victim && !mine.has(ev.victim) && !this.ventanas.has(this.#clave(ev.victim))) {
        const antes = this.ultimaLinea.get(this.#clave(ev.victim));
        enc.muertesHuerfanas.push({
          name: ev.victim,
          t: segundosDePelea(ev.t, enc.start, 'enc'),
          // A qué distancia quedó la última línea suya, o `null` si no consta
          // ninguna. Es lo único medido de todo esto y viaja con la anotación.
          dt: antes === undefined ? null : Math.round(ev.t - antes),
        });
        this.ultimaLinea.set(ev.victim, ev.t);
        return;
      }
      enc.kills.push({ t: ev.t, victim: ev.victim, killer: ev.killer });
      /**
       * LA MUERTE CIERRA LA VENTANA EN EL INSTANTE, medida y sin gracia.
       *
       * Sólo los enemigos de los que te escapas necesitan plazo; a uno que se
       * cae lo ha cerrado el registro con todas las letras, y esperar 12
       * segundos por él sería inventarse una participación que no hubo.
       *
       * Y NO CIERRA SI LUEGO SIGUE HABIENDO LÍNEAS SUYAS, que es el caso del
       * homónimo: `#vista` reabre la ventana en cuanto llega una. Medido, no
       * supuesto: el 32,3 % de las peleas tiene un nombre con dos o más muertes
       * y el 6,0 % tiene líneas de un nombre posteriores a su última muerte. En
       * ese 33,8 % —el 37,8 % de tu daño— «el nombre ha muerto» no significa
       * que ya no quede nadie con ese nombre.
       */
      if (ev.victim && !mine.has(ev.victim)) this.#vista(ev.victim, ev.t, true);
      // Cae un bicho: queda un cadáver, y el cadáver sobrevive a la pelea. Se
      // anota aquí —donde ya se sabe de qué encuentro es— y se poda por la
      // ventana medida, así que la lista se queda en las decenas.
      if (ev.victim) {
        this.cadaveres.push({ clave: nombreCadaver(ev.victim), t: ev.t, enc });
        const corte = ev.t - VENTANA_CADAVER;
        if (this.cadaveres.length > 64 && this.cadaveres[0].t < corte) {
          this.cadaveres = this.cadaveres.filter((c) => c.t >= corte);
        }
      }
      if (ev.victim) {
        enc.deadAt.set(ev.victim, segundosDePelea(ev.t, enc.start, 'enc'));
        enc.actor(ev.victim).deaths++;
        // Lo que costó ESTA muerte: el daño acumulado contra él menos el que ya
        // llevaba cuando cayó la vez anterior. Sin restar, matar tres veces al
        // mismo enemigo daba una «vida» del triple.
        //
        // Y menos lo que le curaron en ese mismo tramo, por la misma razón que
        // se resta la muerte anterior: no es vida suya, es daño deshecho. La
        // resta va tramo a tramo y no repartida entre las muertes, que sería
        // una aproximación pudiendo tenerlo exacto.
        const acumulado = enc.targetTotals.get(ev.victim) ?? 0;
        const curado = enc.healTotals.get(ev.victim) ?? 0;
        const coste = (acumulado - (enc.deathBase.get(ev.victim) ?? 0))
          - (curado - (enc.healBase.get(ev.victim) ?? 0));
        if (coste > 0) {
          const muestras = enc.hpSamples.get(ev.victim) ?? [];
          muestras.push(Math.round(coste));
          enc.hpSamples.set(ev.victim, muestras);
        }
        enc.deathBase.set(ev.victim, acumulado);
        enc.healBase.set(ev.victim, curado);
      }
      if (this.closeOnDeath) this.#close();
      return;
    }
    this.emit('update', enc, ev);
  }

  /**
   * EL CIERRE POR RELOJ DE PARED, CON EL MARGEN MEDIDO. Ver `MARGEN_TICK`.
   *
   * Una pelea se cierra por dos caminos y no usan el mismo reloj:
   *
   *   `feed`   `ev.t - end > idleSec`            la marca del REGISTRO. Es la
   *            que corre al reconstruir, y la única que decide fronteras.
   *   `tick`   `nowSec - end > idleSec + MARGEN` el reloj de PARED, y sólo
   *            corre en directo.
   *
   * LO QUE NO CAMBIA, Y CONVIENE SABERLO ANTES DE TOCAR NADA: la frontera que
   * se guarda YA sale del registro. `#close()` no mira «ahora» en ningún sitio
   * y `end` es la marca de la última línea de combate. El reloj de pared nunca
   * ha fijado un límite: sólo decidía SI se partía.
   *
   * Por eso basta el margen. Cualquier hueco lo bastante grande para que salte
   * `tick` es un hueco que `feed` también partirá cuando llegue la línea
   * siguiente, así que los dos caminos dan lo mismo. Y si el registro se acaba
   * —cierras el juego— `tick` cierra y sella con `end`, que es exactamente lo
   * que hace una relectura en frío al llegar al final del fichero.
   *
   * ESTO NO ELIMINA LA DIVERGENCIA, LA REDUCE. Y hay que decirlo porque durante
   * una semana esta tarea se vendió como «lo que desbloquea reconstruir con
   * garantías», y no es eso. Medido sobre un histórico real, de las 10 peleas
   * que existían en directo y no al releer:
   *
   *   7   huecos de 19–20 s con `idleSec` = 20. Éstas las arregla el margen.
   *   3   huecos de 12, 9 y 2 segundos. NINGUNA regla de reloj las parte: son
   *       arranques de la aplicación a mitad del registro, donde un rastreador
   *       nuevo empieza pelea nueva. El margen no las toca.
   *
   * Así que `AVISO_RECONSTRUIR` se queda donde está: reconstruir sigue sin
   * reproducir el histórico exactamente. Avisa de menos, no de nada.
   */
  tick(nowSec) {
    if (!Number.isFinite(this.idleSec)) return;   // acumulador de sesión: no se cierra
    if (!this.current) return;
    /**
     * EN DIRECTO NO BASTA CON MOVER `end` AL RECUPERAR EL MANDO, porque el
     * aviso de que lo recuperas llega al FINAL del tramo y el reloj de pared no
     * espera: con 38 segundos de miedo, `tick` cierra en el 23 y la línea de
     * vuelta se encuentra la pelea ya partida. Al releer no pasa —`feed` sólo
     * mira la marca del registro— y ésa es justo la clase de divergencia entre
     * los dos relojes que este fichero lleva documentando desde `MARGEN_TICK`.
     *
     * Así que mientras el tramo esté abierto, el reloj de pared no cierra.
     *
     * CON UN TOPE, y sale de la medida: el tramo más largo del registro de
     * referencia dura 38 s y se toma el doble, que es la misma regla que
     * `CHARM_MAX_SEC` y el propio `MARGEN_TICK`. Sin tope, cerrar el juego a
     * mitad de un miedo dejaría la pelea abierta para siempre y la última no se
     * guardaría — y `rebuild.js` cierra llamando a `tick(MAX_SAFE_INTEGER)`,
     * que con la espera sin límite no cerraría nada.
     */
    const ult = this.current.sinControl[this.current.sinControl.length - 1];
    if (ult && ult.hasta === null && nowSec - ult.desde <= SIN_MANDO_MAX) return;
    /**
     * Y LAS OTRAS DOS ENTRADAS DE LA PISTA, por el mismo motivo exacto.
     *
     * El tramo sin mando llevaba haciendo esto desde la 1.13.0 y era el único.
     * Desde la 1.14.0 una ventana también se mantiene abierta porque un mez o un
     * encanto tapen el silencio, así que si `tick` no mirase la pista, el reloj
     * de pared partiría en vivo lo que el registro no parte en frío — la misma
     * divergencia, con otro disfraz. Medido sobre el histórico: pasaría en 21
     * huecos con el plazo a 12 (14 a 15 s, 33 a 10 s).
     *
     * No hace falta un tope propio: `#tapado` ya no cuenta una ventana abierta
     * más allá del suyo (`MEZ_MAX`, `CHARM_MAX_SEC`), así que esto no puede
     * dejar una pelea viva para siempre.
     */
    if (this.#sigueAbierta(nowSec - MARGEN_TICK)) return;
    this.#close();
  }

  /** Anota si un hechizo tuyo entró o fue resistido contra ese enemigo. */
  #tally(enc, foe, spell, field, inv = null) {
    if (!enc || !foe || !spell) return;
    // La invocación forma parte de la clave: Over Channel resta 150 a la
    // resistencia del objetivo, así que mezclar intentos con y sin ella daría
    // una media que no describe ninguna de las dos situaciones.
    const k = `${foe}\u0000${spell}\u0000${inv ?? ''}`;
    const e = enc.spellVsFoe.get(k) ?? { foe, spell, inv: inv ?? null, landed: 0, resisted: 0 };
    e[field] += 1;
    enc.spellVsFoe.set(k, e);
  }

  /**
   * De quién es este golpe cuando hay un encantado con ese nombre.
   *
   * EL OBJETIVO DELATA AL ATACANTE, que es lo que resuelve el caso difícil:
   * dos bichos con el mismo nombre, uno encantado y otro no, y el registro sin
   * forma de distinguirlos. No hace falta distinguirlos:
   *
   *   - un salvaje NO pega a otros bichos  -> si pega a un bicho, es el tuyo
   *   - un encantado NO te pega a ti       -> si te pega, es el salvaje
   *   - y a ti no te da por pegar al tuyo  -> si le pegas, es el salvaje
   *
   * Medido en el peor caso del registro de referencia —los dos «a hardened
   * skeleton» a la vez durante 1m42s—: 727 de daño a otros bichos, 60 a mí y
   * 158 de un «X pega a X». O sea 83,3% resuelto sin estimar nada.
   *
   * Ese resto, el X contra X, es el único de verdad ambiguo. No se reparte a
   * ojo: se aparta en `charmAmbiguo` y se cuenta, para que la interfaz pueda
   * decir cuánto no sabe en vez de inventarlo.
   */
  #deQuien(enc, ev, esFuente) {
    const nombre = esFuente ? ev.source : ev.target;
    const otro = esFuente ? ev.target : ev.source;
    const marcado = esFuente ? ev.charmSrc : ev.charmTgt;
    if (!marcado) {
      // Vuelve a ser enemigo, sí — pero si eso lo sabemos porque encadenaste
      // otro encanto, no lo sabemos: lo hemos deducido. Se cuenta aparte.
      if (ev.charmSoltado && esFuente) {
        enc.charmSoltado.golpes++;
        enc.charmSoltado.daño += ev.amount || 0;
      }
      return enc.actor(nombre);
    }

    // X contra X: los dos extremos son el mismo nombre y los dos podrían ser
    // cualquiera de los dos bichos.
    if (otro && otro === nombre) {
      // Se cuenta una sola vez por golpe: esto se llama dos veces, una por el
      // que pega y otra por el que recibe, y sin la condición el ambiguo salía
      // exactamente al doble — 316 donde el registro tiene 158.
      if (esFuente) {
        enc.charmAmbiguo.golpes++;
        enc.charmAmbiguo.daño += ev.amount || 0;
      }
      return enc.actor(nombre);
    }

    const mio = this.#mine();
    if (esFuente) {
      // Pega a los tuyos -> es el salvaje. Pega a otra cosa -> es el tuyo.
      return mio.has(otro) ? enc.actor(nombre) : enc.actorCharmed(nombre);
    }
    // Lo golpea alguien: si eres tú, le estás pegando al salvaje.
    return mio.has(otro) ? enc.actor(nombre) : enc.actorCharmed(nombre);
  }

  /**
   * DE QUÉ PELEA ES ESTE OBJETO. Del cadáver del que salió, no de la ventana.
   *
   * ES UNA DEDUCCIÓN Y VIAJA MARCADA COMO TAL. El registro no numera los
   * cadáveres: dice «from a zol ghoul knight's corpse» y de ésos han muerto
   * nueve esta tarde. Lo único que se puede afirmar es «el más reciente de ese
   * nombre anterior a la recogida», que es una regla, no una medición.
   *
   * LA GUARDA ES LA MISMA QUE LA DEL ENCANTO, y por el mismo motivo: cuando dos
   * candidatos son indistinguibles no se reparte a ojo ni se calla. Pero hay que
   * afinar QUÉ es indistinguible, o la guarda deja de avisar de nada:
   *
   *   que haya otro del mismo nombre         no es ambiguo. Es lo normal.
   *   que esté en otra pelea                 tampoco: 32% de las recogidas.
   *   que esté a menos de `AMBIGUO_SEG`      SÍ. Ahí los dos pueden serlo, y
   *                                          son 3 de 1.875 en un log real.
   *
   * Sin cadáver que case no se inventa uno: sale como suelto y se dice por qué.
   */
  #deQuePelea(ev) {
    if (!ev.from) return { enc: null, amb: false, porQue: 'sin-cadaver-en-la-linea' };
    const clave = nombreCadaver(ev.from);
    const desde = ev.t - VENTANA_CADAVER;
    const cand = this.cadaveres.filter((c) => c.clave === clave && c.t <= ev.t + 1 && c.t >= desde);
    if (!cand.length) {
      // Distinguir «nunca vi morir a ése» de «lo vi, pero hace demasiado» no es
      // un lujo: el primero es un cadáver que remató un compañero y el segundo
      // es un tope que a lo mejor está mal puesto. Con un solo motivo, el día
      // que la ventana se quede corta nadie podría notarlo.
      const viejo = this.cadaveres.some((c) => c.clave === clave);
      return { enc: null, amb: false, porQue: viejo ? 'cadaver-fuera-de-ventana' : 'sin-muerte-registrada' };
    }
    const ultimo = cand[cand.length - 1];
    // `amb` viaja CON EL OBJETO y no a un contador del rastreador: así la ficha
    // puede señalar cuál es el dudoso, que es lo que un total nunca pudo.
    const amb = cand.some((c) => c.enc !== ultimo.enc && ultimo.t - c.t <= AMBIGUO_SEG);
    // `dt` es lo único MEDIDO de todo esto: cuánto pasó entre esa muerte y esta
    // recogida. Viaja con el objeto para que la ficha pueda enseñar la distancia
    // en vez de pedir que se confíe en la regla.
    return { enc: ultimo.enc, amb, dt: Math.round(ev.t - ultimo.t), porQue: null };
  }

  /** Tú y tus mascotas. */
  #mine() {
    const m = new Set(this.petNames ?? []);
    if (this.self) m.add(this.self);
    return m;
  }

  /**
   * LOS TUYOS CON NOMBRE Y APELLIDO: tú y los compañeros que has DECLARADO.
   *
   * No es `#mine()` y la diferencia es doble y deliberada.
   *
   * POR ARRIBA, entra el compañero. `#mine()` contesta «¿es esto tuyo para abrir
   * una pelea?», y ahí un compañero no cuenta: su pelea al otro lado de la sala
   * no es la tuya, y eso lo prohíbe una prueba con su invariante escrita. Esto
   * contesta otra cosa —«¿son los dos extremos de este golpe gente de tu
   * bando?»— y para ésa el compañero sí cuenta, porque el bando es exactamente
   * lo que declaraste.
   *
   * POR ABAJO, Y ESTO ES LO QUE COSTÓ VERLO: SE CAE LA MASCOTA. Las mascotas de
   * EQL se llaman como los bichos —«Ice boned skeleton» es a la vez tu esqueleto
   * invocado y un bicho de Befallen— así que una mascota es una identidad
   * DETECTADA por un nombre reciclado, no una declarada. Medido: al incluirlas,
   * una pelea de Befallen sacaba 110 puntos del daño enemigo y los rotulaba como
   * fuego amigo porque un `Ice boned skeleton` salvaje —el que grita
   * «Areeeeewwwww» y te pega— compartía nombre con una mascota tuya de otra
   * sesión.
   *
   * Habría sido el mismo fallo que este cambio arregla, cometido dentro del
   * arreglo: dejar que un dato inestable mande sobre una identidad. Lo que se
   * afirma aquí sólo puede apoyarse en nombres que no se reciclan, y los de
   * jugador no se reciclan.
   *
   * EL PRECIO, DICHO: si a tu mascota la encantan y te pega, su daño cuenta como
   * enemigo en vez de apartarse. Es lo honesto mientras no se pueda distinguir tu
   * esqueleto del esqueleto de la esquina, que es otro problema y más viejo.
   */
  #tuyos() {
    const m = new Set();
    if (this.self) m.add(this.self);
    for (const n of this.companions ?? []) m.add(n);
    return m;
  }

  #close() {
    if (!this.current) return;
    // Si la pelea empezó antes de saber la zona, se pone la conocida al cerrar.
    if (!this.current.zone && this.zone) this.current.zone = this.zone;
    const enc = this.current;
    enc.closed = true;
    this.current = null;
    // Las ventanas mueren con la pelea: son la pelea. La pista de estado NO —un
    // mez puesto antes del corte sigue puesto después, y el bicho dormido puede
    // reaparecer en la siguiente. Se poda sola por sus topes en `#tapado`.
    this.ventanas.clear();
    this.history.push(enc);
    if (this.history.length > 200) this.history.shift();
    this.emit('close', enc);
  }
}
