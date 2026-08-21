import { RANGES } from './ranges.js';
import { parseZone } from './zones.js';
import { SIN_MITIGACION } from './stances.js';
// Una clave con un hueco casa con cualquier otra que tenga el mismo hueco.
import { claveSegura } from './claves.js';
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
 * ═══════════════════════════════════════════════════════════════════════════
 * Y POR ESO: `fights.ndjson` NO SE PUEDE REESCRIBIR EN SITIO. NUNCA.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     LA IDENTIDAD DE UNA PELEA CUELGA DE UN DESPLAZAMIENTO DE BYTES.
 *     Cambiar UN byte de una línea RENOMBRA todas las peleas que van detrás.
 *
 * SI HAS VENIDO A ORDENAR ESTE FICHERO, LEE ESTO ANTES DE EMPEZAR. Las tres
 * cosas que parecen inofensivas y no lo son:
 *
 *   COMPACTARLO —quitar las repetidas que `load` ya descarta—.
 *   LIMPIAR UN CAMPO de todas las peleas.
 *   ARREGLAR UNA LÍNEA que se guardó mal.
 *
 * Las tres cambian la longitud de alguna línea, y con ella el `off` de todas
 * las siguientes. Como `uid === off`, **todas las peleas posteriores pasan a
 * llamarse de otra manera**. Lo que apunta a una pelea por su `uid` —la caché,
 * lo que enseñe la interfaz, cualquier anotación futura— apunta entonces a la
 * de al lado. Y no falla: apunta a UNA pelea, sólo que a otra.
 *
 * ES NUESTRA FAMILIA MÁS VIEJA —identidad por algo inestable— con el sujeto
 * cambiado: aquí lo inestable no es un nombre ni una hora, es **la posición**.
 * La misma que ya nos costó los tríos borrados por índice.
 *
 * PASÓ EL 16 DE AGOSTO DE 2026 y por eso está escrito. Se escribió una limpieza
 * que quitaba una marca de las filas al terminar de reconstruir; `false` ocupa
 * un byte más que `true`, así que hacía falta reindexar, y reindexar es
 * renombrar. Se revirtió antes de correrla.
 *
 * LO QUE SÍ SE PUEDE HACER, y son las dos únicas puertas:
 *
 *   AÑADIR AL FINAL. Es lo único que no mueve nada de lo anterior, y es la
 *   razón de que este fichero sea NDJSON y sólo crezca.
 *
 *   RECONSTRUIRLO ENTERO desde el registro, con `src/rebuild.js`. Ahí todos los
 *   `uid` cambian **a la vez y a propósito**, lo viejo se aparta con marca de
 *   tiempo, y lo que casa por `uid` ya sabe que tiene que recomponerse — por eso
 *   `tramos` y `dudas` casan también POR CONTENIDO.
 *
 * Cualquier tercera vía pide antes cambiar la identidad, y eso es otra tarea:
 * un `uid` que no dependa de la posición. No se ha hecho porque hoy la posición
 * es única, gratis y ya estaba escrita; el precio es este párrafo.
 *
 * DUPLICADOS
 *
 * Releer el log entero vuelve a generar las mismas peleas. Como `at` es la hora
 * de la PELEA y no la de importarla, la terna (at, total, duración) es estable
 * entre relecturas y sirve de identidad lógica: `append` la usa para no guardar
 * dos veces lo mismo, y `load` descarta las copias que ya hubiera en disco.
 */

/**
 * Identidad lógica de una pelea: estable aunque se reimporte el log.
 *
 * SE CONSTRUYE PIDIÉNDOLA, no interpolando, y por un motivo con fecha: la
 * misma expresión en un arnés —`${s.at}:${s.total}:${s.duration}`— sobre un
 * objeto en el que `at` NO EXISTE produjo `undefined:46088:126` para peleas
 * distintas, las hizo colisionar y dio «90 repetidas» donde hay una. Aquí `at`
 * siempre está porque el resumen lo pone; el día que deje de estar, esto para
 * en vez de casar cualquier cosa con cualquier cosa. Ver `src/claves.js`.
 */
const logicalKey = (s) => claveSegura('logicalKey', s.at, s.total ?? 0, s.duration ?? 0);

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
 *   7               La postura no mitiga el daño periódico ni el escudo de daño
 *                   y se estaba revirtiendo como si lo hiciera; el daño
 *                   recibido pasa a guardarse partido por la postura de cada
 *                   golpe, y la serie por segundo de dos cubos a tres.
 *
 *   8               EL BOTÍN SE COLGABA DE LA VENTANA Y NO DE SU CADÁVER, y se
 *                   saquea DESPUÉS de matar. Medido sobre 1.839 entradas de un
 *                   histórico real: 34 colgadas de una pelea POSTERIOR a la
 *                   muerte del bicho —siempre posterior, nunca al revés,
 *                   mediana 10 minutos de distancia— y 273 (el 14,8%, en 159
 *                   peleas) con un instante fuera de la ventana de su propia
 *                   pelea. Y 51 objetos caían en sitio distinto según se
 *                   grabaran en directo o releyendo, entre ellos TODO el botín
 *                   de Innoruuk, Emperor Crush, Keeper of Souls y Maestro of
 *                   Rancor, que en directo acababa en el fichero de sobras.
 *                   Ahora cada objeto va a la pelea donde murió su cadáver.
 *
 *                   Con dos cosas más que se perdían enteras: el quinto final
 *                   de línea («and stored it in your tradeskill depot», un
 *                   `Essence of Rathe` que no llegó a ningún contador) y la
 *                   moneda, 1.392 líneas reconocidas y tiradas desde siempre.
 *
 *   9               UN GOLPE CONVERTÍA A UN COMPAÑERO DECLARADO EN ENEMIGO PARA
 *                   TODA LA PELEA. En el Plano del Miedo encantan, y con la
 *                   regla de bandos a secas —enemigo es quien te pega— bastaba
 *                   una línea para que uno de tu grupo cambiara de lado con
 *                   todo su daño detrás. Medido sobre 709 peleas: 3 con un
 *                   compañero en el bando enemigo, y en ellas 11.862 de 24.499
 *                   de «daño enemigo» —el 48%— eran del propio grupo; en la
 *                   peor, el 55%. Cinco peleas en total cambian de cifras.
 *
 *                   Ahora la identidad declarada gana, el daño que os hacéis
 *                   entre vosotros se aparta en `entreTuyos` —fuera de la
 *                   producción y fuera del daño enemigo— y se guardan también
 *                   los tramos `sinControl`, que el registro escribía y nadie
 *                   leía.
 *
 *                   LAS PELEAS VIEJAS NO SE RECONSTRUYEN, y por eso esto no sube
 *                   `RECONSTRUIR_DESDE`: el fallo se DETECTA leyendo lo guardado
 *                   —«hay un compañero declarado en el bando enemigo» está en el
 *                   fichero— y se marca con el mecanismo de dudas. Corregirlas
 *                   exige releer el registro; avisar de que están mal, no.
 *
 *                   Y LAS TRES DE 700 SON UNA FOTO, no una constante: el Plano
 *                   del Miedo encanta, y si se raidea más allí el número sube.
 *                   El día que suba, esta decisión hay que volver a tomarla.
 *
 * ESTE NÚMERO ERAN DOS PREGUNTAS EN UNA, Y HASTA LA 1.11.0 NUNCA SE SEPARARON
 * PORQUE SIEMPRE HABÍAN COINCIDIDO.
 *
 *   ¿Ha cambiado lo que se escribe?     → `FORMATO_VERSION`, aquí abajo.
 *   ¿Hay que releer el registro entero? → `RECONSTRUIR_DESDE`.
 *
 * Trece versiones seguidas las dos respuestas fueron la misma, así que un solo
 * número las servía y nadie notó que eran dos. La 1.11.0 es la primera vez que
 * discrepan: el formato SÍ cambia, y reconstruir NO hace falta —el importe
 * observado está guardado al lado del reconstruido, así que la corrección se
 * hace al leer— y además hoy sería PELIGROSO, porque el cierre de pelea usa el
 * reloj de pared en directo y la marca del registro al reconstruir, y con un
 * hueco de exactamente `idleSec` cada camino parte la pelea de una manera (ver
 * el comentario de `tick()` en `src/encounter.js`).
 *
 * Mientras estuvieron pegadas, la única forma de decir «el formato cambió pero
 * no reconstruyas» era no subir el número —y entonces la guarda de formato no
 * saltaba y el cambio pasaba en silencio, que es justo el fallo que costó trece
 * versiones—. Separadas, no hay que elegir: se sube el formato SIEMPRE y el
 * cartel se decide aparte.
 */

/**
 * Sube SIEMPRE que cambie lo que se escribe a disco. Sin excepciones y sin
 * ramas de escape: `test/formato.js` no deja publicar sin subirlo.
 */
export const FORMATO_VERSION = 12;

/**
 * Por debajo de esta generación, lo guardado NO se puede arreglar leyéndolo
 * mejor y hay que releer el registro. Es lo único que saca el cartel de
 * reconstruir.
 *
 * SUBE A 8 EN LA 1.12.0, y es de las que no se pueden arreglar leyendo mejor:
 * dónde está colgado cada objeto se decidió al escribirlo, y lo escrito no dice
 * de qué cadáver salió más que por el nombre. Un histórico de la generación 7
 * tiene 34 objetos colgados de la pelea equivocada, 273 con el instante fuera
 * de su ventana, la moneda entera sin recoger y un final de línea sin regla.
 * Nada de eso se puede recomponer sin volver al registro.
 *
 * LA ARISTA QUE HAY QUE MIRAR AL RECONSTRUIR sigue ahí y no la arregla esto: el
 * cierre de pelea usa el reloj de pared en directo y la marca del registro al
 * releer, así que con un hueco de exactamente `idleSec` cada camino parte la
 * pelea de una manera. Lo que sí desaparece es su efecto sobre el botín —51
 * objetos cambiaban de sitio entre los dos caminos— porque la regla del cadáver
 * no depende de qué reloj cerró la pelea. El aviso de `rebuild.js` se queda:
 * las cifras de daño siguen pudiendo moverse.
 *
 * Al subirlo, repasa `mig.body` — el cartel explica los motivos de ESA
 * migración, y un texto puesto por un motivo que ya no aplica sobrevive porque
 * nadie lo relee.
 *
 * ═══ DEUDA APUNTADA, PARA QUE LA PAGUE LA PRÓXIMA RECONSTRUCCIÓN ═══
 *
 * ── DEUDA VIVA (1.14.1): `kills` y `hpSamples` GUARDAN EL NOMBRE SIN NORMALIZAR
 *
 * EQ capitaliza el nombre al abrir frase —«A shin ghoul knight has been slain»—
 * y lo deja en minúscula a mitad —«You slash a shin ghoul knight»—.
 * `Encounter.actor` normaliza la fila del combatiente; `kills`, `hpSamples` y
 * `dead` se escriben con el nombre TAL CUAL venía en la línea de muerte. O sea
 * que en el mismo fichero conviven las dos formas para el mismo bicho.
 *
 * LO QUE COSTÓ, medido: 25 abatidos de 4.348 no llegaban al bestiario y con
 * ellos 39 muestras de vida —`orc legionnaire` perdía 14 de sus muertes— y 9
 * filas de la lista de la enciclopedia decían «sobrevivió» de un bicho que
 * había caído.
 *
 * SE ARREGLÓ AL LEER, y fue lo correcto: así queda bien el histórico que ya
 * está en disco y nadie tiene que reconstruir por esto. Pero el disco se queda
 * con las dos formas PARA SIEMPRE, y eso tiene un precio con fecha:
 *
 *     CUALQUIER LECTOR NUEVO DE `kills` TIENE QUE ACORDARSE DE NORMALIZAR,
 *     Y ACORDARSE NO ES UNA GUARDA.
 *
 * Ya pasó dos veces en el mismo día: se arregló en `foes.js` y seguía crudo en
 * `ui/app.js`. Es la forma que esta casa lleva once fallos persiguiendo — la
 * regla puesta en un sitio y no en el otro no es media regla, es otra regla.
 *
 * QUÉ LA PAGA: la próxima vez que algo obligue a subir `RECONSTRUIR_DESDE` por
 * otro motivo, se normaliza AL ESCRIBIR —misma clave que usa `actor()`— y ese
 * día se pueden quitar los dos parches de lectura: `mismoNombre` en
 * `src/foes.js` y `cayoEn` en `ui/app.js`. No antes: no vale forzar una
 * reconstrucción a nadie por 25 abatidos que ya se leen bien.
 *
 * Hoy los lectores de `kills` son tres y los tres están comprobados:
 * `src/foes.js` (normaliza), `ui/app.js` (normaliza) y `src/narrator.js` (sólo
 * usa `.length`, no compara nombres).
 *
 * SUBE A 9 EN LA 1.13.0, Y ESO ES UNA DECISIÓN QUE SE TOMÓ AL REVÉS PRIMERO.
 *
 * La deuda empezó siendo UN punto y detectable, y con eso la respuesta correcta
 * era no forzar: corregir cuesta reconstruir y detectar es gratis, así que se
 * marca y ya. Al terminar el trabajo la deuda eran TRES, y dos de las tres no se
 * pueden detectar leyendo. Eso cambia la respuesta: una pelea que enseña cifras
 * falsas y NI SIQUIERA PUEDE MARCARSE está mintiendo en silencio, que es lo
 * único que este programa no hace.
 *
 * LAS TRES, Y CUÁL SE PODÍA DETECTAR:
 *
 *   1. EL COMPAÑERO EN EL BANDO ENEMIGO. 3 peleas de 714, con 11.862 de sus
 *      24.499 de «daño enemigo» —el 48%, y el 55% en la peor— hecho por el
 *      propio grupo, y el veredicto de postura calculado encima.
 *      DETECTABLE: sí, ver `dudaCompa`. Era la que sostenía el «no fuerces».
 *
 *   2. LOS TRAMOS SIN MANDO, COBRADOS COMO TIEMPO PARADO. 31 tramos en 12
 *      peleas, 464 segundos, el más largo de 38 s. Con miedo no puedes actuar,
 *      así que ese parón no lo eligió nadie — y `huecoReal` se calculó al
 *      escribir con esos segundos dentro. Medido: 485 s cobrados que pasan a
 *      234, y una pelea que iba de 172 s a 91 s.
 *      DETECTABLE: NO. Una pelea guardada no tiene forma de saber que perdiste
 *      el mando: el campo no existía y las líneas están en el registro.
 *
 *   3. LAS PELEAS PARTIDAS POR UN MIEDO. 8 de los 31 tramos pasan de `idleSec`,
 *      y durante ellos no hay ni una línea tuya —no porque dejaras de combatir,
 *      sino porque no podías—. El corte se decidió al escribir. Al arreglarlo,
 *      714 peleas pasan a 710: cinco se funden con su vecina y una mueve su
 *      frontera.
 *      DETECTABLE: NO, y encima es la peor de las tres: no es una cifra torcida
 *      dentro de una pelea, son dos peleas donde había una.
 *
 * LO QUE SE PAGA DE PASO, y por eso conviene reconstruir aunque no fuera
 * obligatorio: `entreTuyos`, `sinControl`, `sinMandoSec`, `duracionMando` y
 * `resistsByFoe` son campos nuevos, así que el histórico viejo no los tiene y
 * las pantallas que los usan salen vacías hasta releer.
 *
 * Y LAS CIFRAS SON UNA FOTO DE UN PASADO CONCRETO, no una constante: las cinco
 * peleas con fuego amigo y los 31 tramos están TODOS en el Plano del Miedo y
 * alrededores, que es donde encantan y dan miedo. Si se raidea más allí, los
 * números suben.
 *
 * ═══ Y `dudaCompa` SE QUEDA DORMIDA A PARTIR DE AQUÍ ═══
 *
 * NO ES CÓDIGO MUERTO Y NO HAY QUE BORRARLA, aunque a partir de esta versión no
 * marque nunca nada. Con la reconstrucción forzada, todo el mundo llega con el
 * histórico rehecho por la regla nueva —donde un compañero declarado no puede
 * acabar en el bando enemigo— así que no queda ni una pelea que casar.
 *
 * Sigue siendo la guarda que avisa si la regla se rompe otra vez: el día que
 * alguien toque `#sides` y un compañero vuelva a cambiarse de bando, esto lo
 * dice en la ficha en vez de dejarlo pasar. Y su prueba lo comprueba con una
 * pelea fabricada, que no depende de que exista ninguna real.
 *
 * Queda escrito porque una función que no se dispara nunca parece inútil, y en
 * dos versiones alguien la borrará por eso. Es la séptima familia de la lista de
 * `ui/app.js` —salida muerta— vista venir en vez de descubierta tarde: la
 * diferencia entre una guarda dormida y una salida muerta es que la primera
 * tiene un caso que la despierta y está escrito cuál.
 *
 * NO SE FUERZA, Y EL MOTIVO NO ES EL PORCENTAJE. Es que corregir y detectar no
 * cuestan lo mismo: «hay un compañero declarado en el bando enemigo» se
 * comprueba leyendo la pelea guardada, sin tocar un byte y sin que nadie pulse
 * nada (ver `dudaCompa`). Así que esas tres salen marcadas como sospechosas y
 * ninguna miente en silencio, que era lo único inaceptable.
 *
 * QUÉ HACER CUANDO ALGO OBLIGUE A SUBIR ESTE NÚMERO POR OTRO MOTIVO: no hay nada
 * que hacer, y por eso conviene saberlo. La reconstrucción arregla estas tres de
 * paso y las dudas se invalidan solas al dejar de casar. Esta nota está aquí
 * para que, cuando llegue ese día, nadie se pregunte si faltaba algo.
 *
 * ── Y ESE DÍA LLEGÓ: 10, POR LA 1.14.0 ────────────────────────────────────
 *
 * Sube porque cambia QUÉ ES UNA PELEA. No es un campo nuevo ni una cifra
 * corregida: es la frontera, así que ninguna pelea guardada describe lo mismo
 * que describiría hoy. Releído el registro de referencia, las 845 peleas pasan a
 * ser 1.163 —un 38 % más y más cortas—, y no hay forma de convertir unas en
 * otras sin volver al registro: la frontera se decide al escribir.
 *
 * Y era el turno de esta nota: las tres peleas con un compañero en el bando
 * enemigo se arreglan solas al reconstruir, como decía, sin que nadie haga nada.
 */
/**
 * ═══ SUBE A 11 EN LA 1.15.0: EL NOMBRE QUE SE ENSEÑA ═══
 *
 * Se paga aquí la deuda apuntada arriba, y por un motivo que no estaba en la
 * lista: no era sólo que `kills` guardara el nombre sin normalizar — era que
 * **la forma que se enseña no siempre es la que el juego escribe**.
 *
 * DOS COSAS CAMBIAN Y LAS DOS PIDEN RELEER:
 *
 *   1. LA MINÚSCULA SÓLO SI ESTÁ ATESTIGUADA. `Parser` anota, por nombre, la
 *      forma escrita A MITAD DE FRASE —la única posición donde la mayúscula
 *      significa algo— y ésa manda sobre bajar el artículo. Sin ella, cinco
 *      nombres del histórico se guardaron mal: `The Spiroc Guardian`,
 *      `The Spiroc Lord`, `The Prophet`, `The Mighty Bear Paw` y
 *      `The Muglwump`. Están **en disco con la forma equivocada** y ninguna
 *      lectura los arregla: la prueba está en el registro, no en la pelea
 *      guardada.
 *
 *   2. `nombreDeducido` EN CADA FILA. De 440 nombres, 25 no aparecen nunca a
 *      mitad de frase, así que su forma es una deducción. Sin releer no se
 *      puede saber cuáles: hace falta el registro entero para contarlo.
 *
 * NINGUNA CIFRA SE MUEVE. No cambia daño, ni fronteras, ni abatidos: cambia
 * qué texto se guarda y qué se afirma sobre él. Y aun así hay que releer,
 * porque lo escrito no se puede corregir leyéndolo mejor — que es exactamente
 * el criterio de esta constante.
 *
 * LO QUE CUESTA, medido y no estimado: 25,5 s para 74,6 MB (§4.0 del estudio).
 * Y hay una arista conocida y medida: al reconstruir puede cambiar el
 * emparejamiento de alguna pelea. Antes de esto había **1 pelea repetida de
 * 1.547** en el almacén; después tiene que seguir habiendo como mucho una.
 *
 * ── 12 · LAS RESISTENCIAS QUE NO SE LEÍAN (1.17.0) ────────────────────────
 *
 * El registro escribe tu hechizo resistido como «X resisted your Spell!», y la
 * regla pedía un posesivo que esa forma no lleva: 955 líneas por el desagüe,
 * medidas sobre los 103,8 MB de referencia.
 *
 * Y NO ES UN NÚMERO BAJO, ES UNA FILA QUE NO EXISTE. `spellVsFoe` guarda
 * `{foe, spell, landed, resisted}` por pelea, así que el denominador —«62 de
 * 62»— ya tenía dónde vivir. Pero un hechizo que se resiste SIEMPRE nunca
 * aterriza, así que no llegaba a crear su fila.
 *
 * LA PRUEBA, y no hace falta ningún almacén viejo para tenerla: el registro NO
 * ESCRIBE NUNCA tu nombre en esas líneas. «resisted Campeon's …» aparece **0
 * veces** en todo el registro; las 955 vienen todas como «resisted your …». Con
 * la regla que se publicó, ninguna casaba, así que ninguna se guardó. Las 62 de
 * «Drain Spirit X contra Coercer T`vala» —62 de 62, cero aciertos— son 62 de
 * esas, y no había ni una fila suya en ninguna pelea.
 *
 * Eso es lo que decide la constante y no el recuento: leyendo lo guardado no
 * sale, porque no hay nada que leer. La prueba está en el registro.
 *
 * LO QUE CUESTA HOY, remedido el 18 de agosto sobre 103,8 MB: **62,2 s**, no
 * los 25,5 de la 1.15.0. El registro ha crecido y el coste con él; la cifra
 * vieja se quedó corta a la mitad. Y la ventana NO se bloquea: 3.763 fotogramas
 * en 63 s, cero por encima de 100 ms.
 */
export const RECONSTRUIR_DESDE = 12;

const META = 'store.json';

/**
 * MODELO DE MEDICIÓN. Es la cuarta pregunta, y las cuatro son distintas.
 *
 *   package.json        qué versión del programa es esto
 *   FORMATO_VERSION     ha cambiado lo que se escribe a disco
 *   RECONSTRUIR_DESDE   hay que releer el registro entero
 *   MODELO_MEDICION     con qué reglas se calcularon las cifras de ESTA pelea
 *
 * Y va POR PELEA, que es lo que ninguna de las otras tres puede hacer: marcan
 * el almacén entero, así que en cuanto una parte del histórico se corrige y
 * otra no, dejan de describir lo que hay dentro. Un número por pelea sí, y por
 * eso no es un booleano: «reparada: true» no dice reparada de qué ni a qué, y
 * el modelo que viene después lo deja mudo otra vez.
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
 * ESTO SUBE `FORMATO_VERSION` Y NO TOCA `RECONSTRUIR_DESDE`, y ésa es la
 * distinción que la 1.11.0 estrenó. Lo escrito cambia —hay campos nuevos y
 * cifras distintas— así que el formato sube y la guarda lo exige. Pero no hace
 * falta releer el registro: el importe observado está guardado al lado del
 * reconstruido, en `takenByType`, así que la corrección es una copia exacta y
 * se hace al leer, como ya se hacía con la dificultad que faltaba.
 *
 * El precio de hacerlo así, dicho: las cifras de las peleas ya guardadas
 * CAMBIAN SOLAS la primera vez que se abren, sin que nadie pulse nada. Por eso
 * hay un aviso puntual colgado de esa misma condición (ver `avisoModelo`): un
 * histórico que cambia sin avisar es exactamente lo que este programa no hace.
 */
/**
 * ── 5, LA 1.14.0: LA FRONTERA ─────────────────────────────────────────────
 *
 * Los cuatro modelos anteriores corregían CIFRAS de una pelea. Éste cambia
 * cuáles son las peleas, y por eso es el primero que NO se puede aplicar al
 * leer: no hay nada guardado de lo que deducir dónde debería haber estado el
 * corte. O se relee el registro o no hay modelo 5, y de ahí que
 * `RECONSTRUIR_DESDE` suba con él por primera vez desde la 1.11.0.
 */
export const MODELO_MEDICION = 5;

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
 * LO QUE SE SABE QUE ESTÁ MAL EN UNA PELEA YA GUARDADA.
 *
 * Existe porque hay un desfase entre enterarse de un fallo y poder arreglarlo.
 * El arreglo de verdad es releer el registro, y eso hoy está bloqueado —las
 * fronteras de pelea se deciden con dos relojes distintos, así que reconstruir
 * NO reproduce el histórico—. Mientras tanto, esas peleas salían con sus cifras
 * como si fueran buenas: mal y calladas, que es lo peor de las dos opciones.
 *
 * QUÉ SE MARCA, medido el 10 de agosto de 2026: 18 peleas en las que un enemigo
 * cuenta en tu bando porque el encanto se cerró mal. En siete de ellas el bicho
 * llegó a ascender a mascota permanente; en la peor, el 40% de «tu» daño es de
 * un enemigo.
 *
 * ═══ LA ENTRADA SE INVALIDA SOLA, Y ESO ES LO IMPORTANTE ═══
 *
 * Se casa por hora Y POR CONTENIDO: la entrada guarda el importe mal atribuido
 * y los nombres de las filas, y sólo se aplica si la pelea sigue teniendo esas
 * cifras. En cuanto se reconstruya y la pelea cambie, la entrada deja de casar
 * y se descarta sola.
 *
 * Ésa es la lección de `tramos.ndjson`, aplicada antes de tropezar en vez de
 * después: aquél casaba sólo por la hora, sobrevivía a las reconstrucciones y
 * seguía estampando lo suyo sobre peleas que ya no eran las mismas —una pelea
 * impecable rotulada como excepción, y una entrada huérfana apuntando a una
 * hora de inicio que ya no existía—. Un fichero lateral que sólo mira la clave
 * no puede saber si sigue hablando de lo que hablaba.
 *
 * Va igualmente en la lista de ficheros que se apartan al reconstruir. Las dos
 * cosas: la de arriba es el cinturón y ésta los tirantes.
 */
function aplicarDudas(f, at, dudas) {
  const e = dudas?.get(at);
  if (!e) return f;
  // La comprobación de contenido. Si la pelea ya no es la que era, la duda no
  // habla de ella y se va sin decir nada.
  const filas = (f.rows ?? []).filter((r) => (e.filas ?? []).includes(r.name)
    && r.side === 'ally' && (r.charmed === true || r.pet === true));
  const daño = filas.reduce((a, r) => a + (r.damage ?? 0), 0);
  const recibido = filas.reduce((a, r) => a + (r.taken ?? 0), 0);
  if (!filas.length || daño !== e.daño || recibido !== e.recibido) return f;
  f.duda = {
    motivo: e.motivo,
    filas: filas.map((r) => r.name),
    daño, recibido,
    // Sobre qué cifra hay que leer `daño`. Aquí es el total de TU bando, del que
    // esa parte no era. Ver `dudaCompa`, que apunta al otro. Sin este campo las
    // dos dudas se leerían con la misma frase y una de las dos mentiría.
    sobre: 'total',
    // La cifra viaja con la duda para que la ficha pueda decirla en vez de
    // soltar un aviso genérico: «de los 5.015 de tu bando, 2.026 son de un
    // enemigo» se entiende; «esta pelea puede estar mal» no dice nada.
    total: f.total ?? null,
    // Qué queda invalidado y qué NO. El daño personal está bien —lo tuyo es
    // tuyo, el fallo es de quién más entra en el bando— así que se tacha el
    // total del bando y su DPS, y nada más.
    invalida: ['total', 'raidDps', 'enemyTotal', 'enemyDps'],
    arregla: 'reconstruir',
  };
  return f;
}

/**
 * UN COMPAÑERO DECLARADO EN EL BANDO ENEMIGO. Se detecta al leer, y es gratis.
 *
 * QUÉ ESTÁ MAL EN ESAS PELEAS. Se guardaron con la regla de bandos a secas
 * —enemigo es quien te pega— así que bastó un golpe de un compañero encantado
 * para que apareciera del otro lado con todo su daño detrás. Medido sobre un
 * histórico real de 709 peleas: 3 afectadas, y en ellas 11.862 de 24.499 de
 * «daño enemigo» —el 48%— era del propio grupo. Sobre esa cifra falsa está
 * calculado además el veredicto de postura y el reparto que enseña el análisis,
 * y el análisis coge de ahí quién es enemigo: las curas de tu propio sanador
 * podían salir como «el enemigo se curó».
 *
 * POR QUÉ ESTO NO NECESITA UN FICHERO NI UNA RECONSTRUCCIÓN. La otra duda
 * —`aplicarDudas`— vive en `dudas.ndjson` porque hay que ir a buscarla: alguien
 * midió el fallo fuera y escribió el resultado. Ésta no hace falta escribirla en
 * ninguna parte, porque la prueba está DENTRO de la pelea guardada: el bando de
 * cada fila está en el fichero y la lista de compañeros la tienes declarada. La
 * pregunta se contesta leyendo, en el momento, sin tocar un byte.
 *
 * Y SE INVALIDA SOLA POR CONSTRUCCIÓN, que era lo importante en la otra y aquí
 * sale de balde: en cuanto se reconstruya, la pelea nueva ya no tendrá a nadie
 * declarado en el bando enemigo —la regla lo impide— y la marca no vuelve a
 * salir. No hay entrada que se quede huérfana apuntando a una pelea que ya no
 * es la que era.
 *
 * SÓLO MARCA LO QUE HOY SABEMOS. Si declaras un compañero mañana, las peleas de
 * ayer donde salga como enemigo se marcarán mañana. Es correcto: la afirmación
 * es «hay alguien que tú das por tuyo contado como enemigo aquí», y eso es
 * verdad desde que lo declaras, no desde que se guardó.
 *
 * La duda de fichero manda sobre ésta si las dos hablan de la misma pelea: la
 * escribió alguien mirando, y esto es una regla.
 */
function dudaCompa(f, mates) {
  if (!f || f.duda || !mates?.size) return f;
  const filas = (f.rows ?? []).filter((r) => r.side === 'enemy' && mates.has(r.name));
  if (!filas.length) return f;
  f.duda = {
    motivo: 'compa-en-bando-enemigo',
    filas: filas.map((r) => r.name),
    daño: filas.reduce((a, r) => a + (r.damage ?? 0), 0),
    recibido: filas.reduce((a, r) => a + (r.taken ?? 0), 0),
    // Aquí `daño` se lee sobre el total ENEMIGO, no sobre el tuyo: lo que está
    // inflado es el otro lado. Ver `sobre` en `aplicarDudas`.
    sobre: 'enemyTotal',
    total: f.enemyTotal ?? null,
    invalida: ['total', 'raidDps', 'enemyTotal', 'enemyDps'],
    arregla: 'reconstruir',
  };
  return f;
}

/**
 * La zona del resumen, releída de lo observado: base, dificultad y etiqueta.
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
 * ── SE LLAMABA `rehacerDif` Y SALÍA POR LA PUERTA ANTES DE REHACER LA BASE ──
 *
 * La primera línea era `if (s.diff != null) return s`: con la dificultad ya
 * puesta —que es el caso de CASI TODAS— la función se iba sin tocar
 * `zoneBase`, así que la línea de abajo, la que dice que lo derivado se
 * recalcula, no corría nunca donde hacía falta.
 *
 * QUÉ DEJABA EN EL ÍNDICE, medido sobre el almacén real el 21/08/2026:
 * **1.026 de 1.899 peleas con muertes (54 %)** guardan `zoneBase` con el
 * dígito pegado —«The Ruins of Old Guk 2»— mientras `parseZone` de hoy
 * devuelve «The Ruins of Old Guk» y saca el 2 a `diff`. Las dos formas
 * conviven en el mismo índice según el día en que se guardó cada pelea.
 *
 * Y NO ERA COSMÉTICO: la clave de un temporizador lleva la base LIMPIA —la
 * escribe `parseZone` al abrirlo desde una pelea— y las cinco consultas del
 * crono filtran el índice con `sm.zoneBase !== c.base`. O sea que un crono de
 * Old Guk D2 **no veía ni una sola de sus muertes**: salía «esperando su
 * primera muerte» para siempre, con cero observaciones y sin cota. Medido:
 * **238 de 731 claves (33 %) no veían NINGUNA** de sus muertes y otras 44
 * veían sólo una parte. Ningún síntoma: es un estado legítimo de la pantalla.
 *
 * Ahora la base se rehace SIEMPRE que haya zona observada. Lo que se sigue
 * respetando es la dificultad ya guardada —puede venir de una etiqueta que hoy
 * no supiéramos leer—, que es lo que decía la nota original.
 */
function rehacerZona(s) {
  if (!s || !s.zone) return s;                 // sin zona no se deduce nada
  const z = parseZone(s.zone);
  // Se persiste lo observado (`zone`) y se RECALCULA lo derivado (`zoneBase`).
  // Una interpretación guardada envejece sin avisar: ésta envejeció el
  // 19/08/2026, cuando el dígito pegado al nombre pasó a ser la dificultad.
  s.zoneBase = z.base;
  if (s.diff !== null && s.diff !== undefined) return s;
  s.diff = z.diff;
  if (s.diffTag === null || s.diffTag === undefined) s.diffTag = z.tag;
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
    this.orphanLoot = [];        // sin cadáver conocido: no pertenece a ninguna pelea
    this.lootTarde = new Map();  // hora de la pelea -> objetos recogidos tras cerrarla
    this.orphanCoins = [];       // moneda recogida sin ninguna pelea abierta
    this.coinsDe = new Map();    // hora de la pelea -> monedas
    /**
     * TODAS las líneas de objeto del fichero, en el orden en que se
     * escribieron, sueltas y tardías juntas.
     *
     * Existe para que la enciclopedia pueda avanzar con un puntero —«desde la
     * que me quedé»— igual que hace con las peleas. Los mapas de arriba sirven
     * para buscar por pelea; para plegar hace falta un orden, y un `Map` de
     * listas no lo tiene.
     */
    this.lootLineas = [];
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
    // Lo que se sabe que está mal en peleas ya guardadas, mientras no se pueda
    // reconstruir. Ver `aplicarDudas`: se casa por hora Y por contenido, así
    // que una reconstrucción la invalida sola.
    this.dudasPath = path.join(dir, 'dudas.ndjson');
    this.dudas = new Map();    // hora de la pelea -> {motivo, filas, daño, recibido}
    /**
     * Los compañeros que has declarado, para poder detectar al leer las peleas
     * donde alguno quedó en el bando enemigo. Ver `dudaCompa`.
     *
     * Vive aquí y no se guarda: la lista es de la configuración, no del
     * almacén. El motor la empuja cuando cambia, y al cambiarla se vacía la
     * caché — si no, las peleas ya leídas se quedarían sin marcar hasta
     * reiniciar, que es la peor versión de las dos.
     */
    this.companions = new Set();
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

  /**
   * Los compañeros declarados. Los empuja el motor, y sólo se usan para leer.
   *
   * Vaciar la caché es la mitad del trabajo: `get` marca la pelea al leerla, así
   * que las que ya estuvieran leídas se quedarían sin marcar —o marcadas de más
   * si acabas de quitar a alguien— hasta el próximo arranque.
   */
  setCompanions(list) {
    const antes = [...this.companions].sort().join(' ');
    this.companions = new Set([...(list ?? [])].filter(Boolean));
    if ([...this.companions].sort().join(' ') !== antes) this.cache.clear();
    return this.companions.size;
  }

  /** Con qué versión se escribió lo que hay guardado. */
  meta() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, META), 'utf8')); }
    catch { return null; }
  }

  stamp(version = FORMATO_VERSION) {
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
  /**
   * ¿Hay que avisar de que las cifras van a cambiar solas?
   *
   * EL DISPARADOR ES TENER PELEAS POR DEBAJO DEL MODELO VIGENTE, no una marca
   * en la configuración. La marca sirve para no repetir el aviso; decidir si
   * toca es otra cosa, y colgarlo de la marca haría que un usuario nuevo —sin
   * histórico y sin nada que corregir— viera un cartel sobre cifras que no
   * tiene.
   *
   * Se responde con lo que ya está en disco y sin abrir ninguna pelea: si el
   * almacén está sellado por debajo del formato de hoy, todo lo que contiene se
   * escribió con reglas anteriores. Leer las 441 peleas para contarlas una a
   * una costaría más que el aviso.
   */
  avisoModelo() {
    const fights = this.index.length;
    const desde = generacion(this.meta());
    return {
      needed: fights > 0 && desde < FORMATO_VERSION,
      fights, desde, formato: FORMATO_VERSION, modelo: MODELO_MEDICION,
    };
  }

  migration() {
    const m = this.meta();
    const fights = this.index.length;
    const from = m?.version ?? null;
    if (!fights) return { needed: false, from, fights, current: RECONSTRUIR_DESDE };
    return {
      needed: generacion(m) < RECONSTRUIR_DESDE,
      from, fights, current: RECONSTRUIR_DESDE,
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
    this.#loadDudas();
    try {
      const raw = fs.readFileSync(this.idxPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const s = JSON.parse(line);
          // Índices escritos antes de que `uid` existiera: el byte de inicio ya
          // estaba ahí, así que la migración no toca ningún fichero.
          if (s.uid === undefined) s.uid = s.off;
          rehacerZona(s);
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
      this.#colocarLoot(fila);
      return fila;
    } catch { return null; }
  }

  /**
   * Una moneda recogida que no cabe dentro de una pelea guardada.
   *
   * Se deduplica por (hora, importe) y no por (hora, objeto, cadáver): no hay
   * objeto ni cadáver que meter en la clave. Dos monedas del mismo importe en
   * el mismo segundo son, para el registro, indistinguibles — y son una.
   */
  appendCoin(e) {
    const t = Math.round(e?.t ?? 0);
    if (!t) return null;
    const clave = `${t}:cp:${e.cp ?? 0}`;
    if (this.lootSeen.has(clave)) return null;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const fila = {
        cp: e.cp ?? 0, raw: e.raw ?? null, de: e.de ?? null, t,
        at: Math.round(t * 1000), zone: e.zone ?? null, k: clave,
      };
      fs.appendFileSync(this.lootPath, `${JSON.stringify(fila)}\n`);
      this.lootSeen.add(clave);
      this.#colocarLoot(fila);
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

  #loadDudas() {
    this.dudas = new Map();
    try {
      for (const line of fs.readFileSync(this.dudasPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e?.at) continue;
          // La última gana: una duda se puede corregir escribiendo otra encima.
          this.dudas.set(e.at, e);
        } catch { /* línea rota: se salta, como en el índice */ }
      }
    } catch { /* sin fichero: no consta que ninguna pelea esté mal */ }
  }

  /**
   * Anota que una pelea guardada está mal, con la cifra dentro.
   *
   * `daño` y `recibido` no son adorno: son la huella que permite comprobar que
   * la pelea sigue siendo la misma antes de creerse la duda. Ver `aplicarDudas`.
   */
  appendDudas(e) {
    if (!e?.at || !e?.motivo) return false;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.dudasPath, `${JSON.stringify(e)}\n`);
      this.dudas.set(e.at, e);
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

  /**
   * `loot.ndjson` lleva DOS cosas desde la 1.12.0, y la que las separa es `de`:
   *
   *   de: null    suelto. No hay cadáver conocido del que colgarlo.
   *   de: <hora>  tardío. Su cadáver murió en esa pelea, que ya estaba cerrada
   *               cuando lo recogiste.
   *
   * Y una tercera, las monedas, que se distinguen por no tener `item`.
   *
   * Un solo fichero para los tres porque son la misma pregunta —«¿qué recogí
   * que no cupo dentro de una pelea guardada?»— y porque partirlo daría dos
   * sitios donde buscar el mismo objeto. `orphanLoot` conserva su nombre y su
   * significado de siempre: SÓLO lo suelto. Lo tardío tiene dueño.
   */
  #loadLoot() {
    this.orphanLoot = [];
    this.lootTarde = new Map();
    this.orphanCoins = [];
    this.coinsDe = new Map();
    this.lootLineas = [];
    this.lootSeen = new Set();
    try {
      for (const line of fs.readFileSync(this.lootPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (!e || this.lootSeen.has(e.k)) continue;
          this.lootSeen.add(e.k);
          this.#colocarLoot(e);
        } catch { /* línea rota: se salta, como en el índice */ }
      }
    } catch { /* sin fichero: no hay botín lateral y no es un problema */ }
  }

  /** Una línea del fichero lateral, en su cajón. Al cargar y al añadir. */
  #colocarLoot(e) {
    if (e.item) {
      this.lootLineas.push(e);
      if (e.de) {
        const lista = this.lootTarde.get(e.de) ?? [];
        lista.push(e);
        this.lootTarde.set(e.de, lista);
      } else this.orphanLoot.push(e);
      return;
    }
    if (e.de) {
      const lista = this.coinsDe.get(e.de) ?? [];
      lista.push(e);
      this.coinsDe.set(e.de, lista);
    } else this.orphanCoins.push(e);
  }

  /**
   * Lo que se recogió DESPUÉS de que esa pelea se cerrara, y le pertenece.
   *
   * Se pide por la hora de la pelea, igual que `tramos`. Devuelve las dos
   * cosas por separado —objetos y monedas— porque se saben de forma distinta:
   * el objeto por su cadáver, la moneda no se sabe en absoluto (aquí nunca hay
   * monedas tardías: sin cadáver en la línea no hay a quién colgarlas, así que
   * salen sueltas; el hueco se deja abierto por si algún día el registro las
   * nombra).
   */
  lootDe(at) {
    return {
      loot: (this.lootTarde?.get(at) ?? []).slice().sort((a, b) => (a.t ?? 0) - (b.t ?? 0)),
      coins: (this.coinsDe?.get(at) ?? []).slice().sort((a, b) => (a.t ?? 0) - (b.t ?? 0)),
    };
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
      const f = dudaCompa(aplicarDudas(aplicarTramos(
        repararModelo(rehacerZona(JSON.parse(buf.toString('utf8')))), s.at, this.tramos),
        s.at, this.dudas), this.companions);
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
      // Contra la base RECALCULADA, no contra la guardada: si no, una consulta
      // por «The Plane of Hate» no encontraría las peleas guardadas cuando esa
      // base se escribía «The Plane of Hate 4».
      out = out.filter((s) => (s.zone ? parseZone(s.zone).base : s.zoneBase ?? null) === q.zoneBase);
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
