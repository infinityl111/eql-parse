# Estudio de los dos competidores

Lectura de **everquest-companion** (jmoyers) y **eqltools-companion** (sowoky),
los dos parsers de EverQuest Legends con código publicado, hecha como si fueran
nuestro proyecto.

Esto es **conocimiento, no un plan de trabajo**. No hay tareas aquí. Lo que se
haga con esto lo decide Miguel, con el documento delante.

**Todo lo que se afirma va con su fichero y su línea.** Lo que no se ha podido
citar, no se afirma. Donde una medición es nuestra, se dice sobre qué registro y
con qué método.

**CINCO FICHEROS, Y SE REPARTEN POR LA PREGUNTA QUE CONTESTAN, no por la fecha.**

| fichero | contesta |
|---|---|
| **éste** | qué tienen ellos y qué nos enseña |
| [`HALLAZGOS.md`](HALLAZGOS.md) | **qué hemos medido de lo nuestro** |
| [`ESTUDIO-ARCHIVO.md`](ESTUDIO-ARCHIVO.md) | cómo llegamos aquí, y por qué creímos otra cosa |
| [`HECHOS-DECLARADOS.md`](HECHOS-DECLARADOS.md) | quién lo dijo, cuándo, y qué lo mediría |
| [`CACERIA.md`](CACERIA.md) | **dónde no hemos mirado** |

**Este documento creció sin freno porque todo cabía bajo su título.** Ya no.

**La regla del reparto: LA MARCA SE QUEDA, LA HISTORIA SE MUDA.** Donde hubo un
error queda una línea con su fecha y su enlace —borrarla sería fingir que ese
sitio nunca engañó— y el relato entero vive en el archivo. Lo mismo con lo
mudado: **cada sección de aquí conserva su hallazgo y manda al archivo por el
detalle**. Nada de lo archivado está desmentido; contesta otra pregunta.

| | jmoyers/everquest-companion | sowoky/eqltools-companion | EQL Parse |
|---|---|---|---|
| Licencia | **FSL-1.1-MIT** | **AGPL-3.0** | **FSL-1.1-MIT** |
| Commits leídos | 1.109 (4–14 ago 2026) | 45 (30 jul–15 ago 2026) | — |
| Versión al leerlo | 0.28.0 | 0.19.1 | 1.14.1 |
| Código | 196.103 líneas TypeScript | 13.261 líneas JS | — |
| Dependencias de ejecución | 14 (React, MUI, chokidar, onnxruntime…) | 1 (electron-updater) | 0 |
| Pruebas | 356 ficheros, 105.387 líneas | ninguna en el repo | 44 ficheros, 10.341 líneas |
| Idiomas | inglés | inglés | 5 |

Fecha de lectura: **15 de agosto de 2026**. Ambos repos avanzan a diario; todo lo
de aquí es una foto de ese día.

---

## 0. Lo primero, porque cambia el marco: ninguno de los dos es MIT

Se dio por hecho que los dos eran MIT. **No lo son**, y los dos lo son de una
forma que importa.

**jmoyers — `LICENSE:1`**

```
# Functional Source License, Version 1.1, MIT Future License
```

`package.json` lo confirma: `"license": "FSL-1.1-MIT"`. La FSL concede uso,
copia y obra derivada **sólo para un «Permitted Purpose»**, y el propósito
excluido por definición es competir con el licenciante. Cada versión pasa a MIT
dos años después de publicarse. Es decir: el código de hoy **no** está bajo una
licencia que nos permita usarlo, y lo que sí estará disponible bajo MIT en
agosto de 2028 es la versión 0.28.0 de hoy.

**sowoky — `LICENSE:1`**

```
GNU AFFERO GENERAL PUBLIC LICENSE
Version 3, 19 November 2007
```

`package.json`: `"license": "AGPL-3.0"`. Copyleft fuerte: cualquier trozo suyo
dentro de EQL Parse arrastraría a EQL Parse entero a la AGPL.

**Y desde el 16 de agosto de 2026, la nuestra es la misma que la de jmoyers.**
Miguel ha elegido FSL-1.1-MIT: `LICENSE` en la raíz con el texto canónico
de **fsl.software** —no el suyo, que lleva su nombre dentro— y
`"license": "FSL-1.1-MIT"` en el `package.json`.

**Y sí es un identificador SPDX válido**, contra lo que parecía: está en la
lista oficial de 733 licencias junto a `FSL-1.1-ALv2`, y `npm pack` no emite
ningún aviso, así que no hace falta el `SEE LICENSE IN LICENSE` de reserva.

Compartir licencia **no cambia nada de lo de arriba**: que dos proyectos usen la
misma no autoriza a ninguno a copiar del otro. La FSL protege a cada titular por
separado.

**Consecuencia práctica.** La regla que ya teníamos —*leer no es copiar, lo suyo
es consultado, se mide contra el registro de Miguel y se escribe nuestra regla*—
deja de ser sólo higiene de proyecto y pasa a ser la única forma legal de
hacerlo. No hay «pero es MIT, se puede coger un trozo». No lo es. **Nada de su
código en nuestro árbol, ni una regex.**

Leer sigue siendo perfectamente legítimo: los dos repos son públicos, y una
*idea* —«los ticks de un veneno repetidos en el mismo segundo delatan dos bichos
con el mismo nombre»— no es código.

---

## 1. Las tres fuentes, y qué vale cada una

> **Mudado entero a [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md)**: el
> recorrido por los 1.109 commits de jmoyers día a día, la clasificación por
> familias y las incidencias una a una. Contesta *de dónde salió*, no *qué es
> verdad*.

**Lo que hay que saber de las fuentes, en cuatro líneas:**

- **El historial de commits es la fuente buena**, y es un diario de qué se
  rompió con fecha: 1.109 commits en once días, del 4 al 14 de agosto.
- **LA LECTURA QUE IMPORTA, y sigue siendo el hallazgo mayor del primer pase:**
  **la atribución cuesta más que el parseo.** «De quién es este daño» son 82
  commits; «qué dice esta línea», 51. La frontera de pelea sale a 7 — no porque
  sea fácil, sino porque la resolvieron pronto y no volvieron.
- **La clasificación es un SUELO, no un censo**: sus asuntos son prosa y 469 no
  casan con ninguna familia (repasados en §17).
- **Las incidencias son autoauditorías con fichero y línea**, y ocho de las diez
  de sowoky son de ventana y ninguna de parseo (§16).

## 2. El parser

> **Mudado entero a [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md)**, con
> sus citas y sus tablas: cómo escriben las reglas, los homónimos, la muerte sin
> matador, las mascotas y el encanto, y el cajón de lo no reconocido.

**Los cinco hallazgos que siguen siendo verdad hoy:**

1. **LA TRAMPA DE LA MAYÚSCULA AL ABRIR FRASE.** EQ escribe «A shin ghoul
   knight has been slain» al abrir frase y «a shin ghoul knight» a mitad. Los
   dos competidores lo pliegan; nosotros lo plegamos **en cinco sitios distintos**
   (§19.3) y usamos la clave plegada como texto de pantalla. **Es la ley 2 de
   jmoyers y la contradecimos.** Ya costó 25 abatidos.
2. **HOMÓNIMOS: tres respuestas distintas y todas medidas.** La suya es
   `nombre#generación` con cinco caminos de creación (§15.1); la nuestra es el
   suelo declarado.
3. **MUERTE SIN APERTURA Y MUERTE SIN MATADOR** son formas reales del registro,
   y la que nos falta es la inversa que sí tiene sowoky.
4. **MASCOTAS Y ENCANTO son la mitad cara del parseo**, y su caso más caro no es
   de parseo sino de atribución: el compañero encantado.
5. **EL CAJÓN: 34.207 líneas que no sabemos leer, el 6,07 %** de 951.773 líneas
   físicas no vacías. Está contado y **no lo mira nadie** — es la alarma muerta
   escrita con esas palabras en `patterns.js`.

## 3. La definición de pelea

Nuestra afirmación más grande, y hasta ahora sólo comprobada contra nosotros
mismos. **Hay una coincidencia estructural y una divergencia deliberada.**

### 3.1 jmoyers: coincide con nosotros, y en más de lo esperado

`src/main/combat/lifecycle.ts:1-6`:

> *This is the segmentation half of AGENTS.md world-model law 7/8: what opens a
> fight, what closes one (and on what evidence).*

La ley, `AGENTS.md:794-796`:

> **7. Encounters close on evidence**: *all engaged instances dead (+~5s linger);
> live CC (mez lines) holds fights open indefinitely; ~60s idle fallback for fled
> mobs.*

Las constantes, `src/main/combat/encounter.ts:166-175`:

| constante | valor | qué mide |
|---|---:|---|
| `LINGER_MS` | 5 s | lo que se espera tras el último daño atribuido antes de cerrar |
| `PRESENCE_GONE_MS` | **20 s** | sin ninguna señal de presencia, la instancia se da por ida |
| `FALLBACK_IDLE_MS` | 60 s | silencio total: cierra aunque nadie haya muerto |
| `CC_HOLD_MS` | 120 s | lo que un mez sin refrescar sigue sosteniendo |
| `ACTIVE_MS` | 3 s | la ventana de «activo» del denominador |

Y el mecanismo, `lifecycle.ts:79-99`, `hostilePresence()`:

Recorre las instancias enganchadas, **salta las que son mascota viva** —una
mascota no es algo que estemos matando, y como no muere nunca mantendría
abierta para siempre cualquier pelea de encantar—, y da una por ida si el modelo
del mundo la ha retirado **o** si lleva `PRESENCE_GONE_MS` sin ser vista. Corta
en cuanto encuentra una que sigue: la respuesta es «¿están todas idas?».

**Léase al lado de nuestro `#sigueAbierta`.** Es la misma forma:

| | jmoyers | EQL Parse |
|---|---|---|
| unidad que tiene ventana | la **instancia** (`nameKey#gen`) | el **nombre** |
| la ventana se cierra por | muerte/retiro, **o** ausencia ≥ `PRESENCE_GONE_MS` | muerte, **o** ausencia > `PLAZO_ENEMIGO` |
| ese plazo | **20 s** | **12 s** |
| la pelea se cierra cuando | **todas** las ventanas están cerradas (+ `LINGER_MS` 5 s) | **todas** las ventanas están cerradas |
| respaldo por silencio total | `FALLBACK_IDLE_MS` **60 s** | (no hay: el plazo por enemigo ya lo cubre) |
| el mez sostiene | sí, `CC_HOLD_MS` **120 s**, **sólo veta el cierre por muerte** | sí, `MEZ_MAX` **226 s** |
| qué cuenta como presencia | daño, fallos, resistencias, control, curaciones | actividad de la línea |

**La coincidencia es del modelo, no de las cifras.** Los dos definimos la pelea
como *el conjunto de enemigos cuyas ventanas de participación se solapan*, y en
los dos **el cierre normal es por evidencia**: la ventana de cada enemigo, no un
reloj global. Nuestro `PLAZO_ENEMIGO = 12` y su `PRESENCE_GONE_MS = 20` son el
mismo parámetro con distinto valor.

**Y «con distinto valor» no significa que los dos valores sean la misma clase de
cosa.** Esta frase se aplanó en la primera redacción y hay que deshacerlo, porque
§13 lo mide: sus cinco constantes de encuentro **nacen redondas —5.000, 20.000,
60.000, 120.000, 3.000— y llegan byte a byte idénticas desde el primer commit
público**, once días y 1.109 commits después. Un valor que nace redondo y no se
mueve nunca es, con toda probabilidad, **un valor elegido y no medido**; y su
propia nota de `CC_HOLD_MS` lo confirma en el único caso que la trae, porque
argumenta de forma —*«so a lone mez can't pin a fight open forever»*— y no de
medición. No se puede afirmar que el 20 salga de mirar un registro: **su historia
anterior al 4 de agosto no es pública**, así que lo que se puede decir es que
nunca han enseñado de dónde sale.

Nuestro **12 sale de una banda medida de 10–15 s** y con la medición escrita al
lado. Esto no dice que acertemos más: **dice que sabemos por qué, y ellos no
tienen dónde mirarlo**. Lo que converge entre los dos proyectos es **el modelo
—ventana por enemigo, cierre por evidencia—, no la cifra**; y presentar la cifra
como convergencia sería cambiar un acuerdo estructural, que es el hallazgo de
verdad, por una coincidencia numérica que no existe.

**Y hay que decirlo con precisión, porque la frase se va a citar suelta:**
jmoyers **sí** pregunta «¿ha pasado algo?» — es su `FALLBACK_IDLE_MS` de 60 s, y
su propio comentario lo enuncia justo así. Lo que no hace ninguno de los dos es
preguntarlo **sobre el registro entero**: él lo pregunta **por encuentro**, sobre
los eventos atribuidos a esa pelea, y nosotros no lo preguntamos en absoluto
porque el plazo por enemigo ya cierra. La diferencia con el `idleSec = 20` que
tirábamos no es que ellos no tengan reloj de silencio: es **sobre qué lo miden**.

**Y hay dos cosas suyas que nosotros no tenemos, las dos aprendidas rompiéndose:**

**(a) La ausencia se mide con más evidencia que el daño.** `lifecycle.ts:65-77`:

La regla vieja reutilizaba aquí los 5 s de cortesía y **contaba sólo el daño como
evidencia**: un segundo bicho que sólo estaba fallando —o lanzando, o eclipsado
por su compañero— parecía muerto a los cinco segundos. Y entonces:

> *the moment its friend actually died, the whole pull finalized and **the
> survivor's remaining fight became a bogus second encounter**.*

**(b) El sostén del mez es un veto sobre UN camino, no sobre el cierre.**
`lifecycle.ts:117-131`, y merece la cita entera:

Los 120 s del sostén **superan a propósito** los 60 s del respaldo. El sostén
cortocircuitaba antes la función entera, y ésa es la cicatriz:

> *ONE stale hold defeated EVERY closure path and pinned the fight open for two
> full minutes of silence.*

Lo que enviaron en su lugar reparte las preguntas:

> *a hold vetoes only the death-close, because that is the judgement it actually
> informs ("is this engaged instance still alive?"). The fallback is a different
> question — "has anything at all happened?"*

**Nuestro `MEZ_MAX = 226` es un sostén sin ese matiz** — y aquí quedaba escrita
la pregunta que su cicatriz dejaba abierta: *un mez sin refrescar, ¿mantiene
viva una pelea que ya no existe?*

#### La respuesta, medida el 16 de agosto: no nos afecta, y la razón es estructural

Su fallo era que el sostén **cortocircuitaba la función entera**, así que uno
rancio derrotaba TODOS los caminos de cierre. El nuestro vive **dentro del bucle
por enemigo** (`src/encounter.js:1593`) y hace `continue` al fallar (`:1594`):
sostiene UNA ventana, y las demás se siguen examinando. Y no puede resucitar a
un muerto — la rama del muerto (`:1590`) sale antes de consultarlo.

**La medición que lo cierra**, y es la única que valía: partir el registro dos
veces, con el camino del sostén y sin él.

| | peleas |
|---|---:|
| con el sostén | 1.571 |
| sin el sostén | 1.615 |
| **fronteras que el sostén evita** | **44** |

Y el barrido de un respaldo por silencio, sobre el hueco interno mayor de cada
pelea (mediana 2 s, p90 8 s, p99 14 s):

| respaldo | peleas que se partirían | de ésas, **con sostén** |
|---:|---:|---:|
| 45 s | 8 | **8** |
| 60 s | 7 | **7** |
| 90 s | 3 | **3** |
| 180 s | 1 | **1** |

**No hay ni una sola pelea sostenida por nada**, así que un respaldo como el suyo
dispararía cero veces. Y de las siete con silencio mayor de 60 s, **cuatro las
sostiene un ENCANTO** (161, 74, 67 y 65 s) — legítimas por nuestra propia
doctrina, y un respaldo por silencio a secas las cortaría. **No se añade
respaldo y no se toca `MEZ_MAX`.**

#### Lo que sí queda, y no es un umbral

Las **tres** peleas que un mez sobre una **mascota enemiga** mantiene unidas. El
caso es estructural y no lo arregla ninguna constante: **una mascota enemiga
despawnea con su dueño y nunca escribe su propia despedida**, así que el sostén
espera un final que el registro no va a escribir jamás; sólo lo para el tope.

La mayor, del 11 de agosto a las 11:26:24, dura 475 s y sin el sostén serían
tres peleas, cortadas en +308 s y +421 s:

| tramo | sucesos | daño | nombres | exclusivos suyos |
|---|---:|---:|---:|---|
| A +0–308 s | 1.105 | 9.548 | 6 | `a tsu ghoul wizard`, **`a tsu ghoul wizard pet`**, `Garobab` |
| B +308–421 s | 542 | 5.839 | 6 | `a vis ghoul knight`, `Rolendor` |
| C +421–475 s | 356 | 3.955 | 7 | `a zol ghoul knight`, `a basalt gargoyle`, `a wan ghoul knight` |

Cada tramo tiene enemigos que no salen en los otros, y **la mascota mezada sólo
aparece en el primero**: B y C son tirones distintos encadenados al suyo.

> **CORREGIDO el 15 de agosto.** Aquí decía «1.356 sucesos, 13.149 de daño, corte
> en +68 s». Arnés que contaba combate ajeno, y un campo (`sostenes`) tomado por
> prueba de algo que no prueba. **La historia entera, en
> [`ESTUDIO-ARCHIVO.md` §A1](ESTUDIO-ARCHIVO.md).**

Y un tercero, que es un detalle de cierre que nosotros resolvimos igual
(`lifecycle.ts:104-107`): *«Finalization always stamps the encounter's lastTs (a
damage timestamp), never `now`»* — nuestra separación `feed` / `tick`.

### 3.2 sowoky: diverge a propósito, y la divergencia se entiende

`engine.js:624`:

la cabecera de esa sección declara **una pelea por encuentro con un bicho,
cerrada por su línea de muerte**, y una única constante `FIGHT_IDLE = 45`
segundos sin ningún evento que toque a ese bicho — un mez la refresca.

**Una pelea = un bicho.** No hay agrupación. `open` es un `Map` de nombre a
pelea (`engine.js:633`), y el barrido de cierre es por entrada
(`engine.js:696`):

en cada evento se recorre el mapa entero de peleas abiertas y se cierra toda
entrada cuyo último toque quede a más de `FIGHT_IDLE` del instante actual. El
cierre se sella con **la hora del último toque**, no con la del evento que lo
dispara.

**Por qué diverge: porque pregunta otra cosa.** Su unidad de análisis es el
bicho, no la pelea. Lo que produce con ella (`engine.js:660-671`):

- `offSecs` — **los segundos que el bicho estuvo pegando**, desde su primer
  golpe, no desde que empezó la pelea. Con el motivo escrito: *«a mob that stood
  there for 20s before it noticed us was not dealing damage for those 20s, and
  dividing by them would under-report what it hits for.»*
- `hpMax = dmgAll - healed` y `hpMin = hpMax - lastBlow + 1` — **cotas de vida
  del bicho**, y sólo si murió: *«Only a KILL bounds anything — a fight the mob
  walked away from says only "more than this".»*

Un modelo por grupo no puede dar ninguna de las dos cosas sin volver a separar
por bicho. **La conclusión no es que uno esté bien y otro mal: es que la
frontera de pelea es una elección de UNIDAD DE MEDIDA, no un hecho del
registro.** Y las dos son defendibles a la vez — de hecho jmoyers tiene las dos
capas (instancias dentro de encuentros) y sowoky tiene una sola.

**Lo que esto significa para nuestra afirmación:** la parte de nuestro modelo que
queda **confirmada por una implementación independiente** es la que nos importaba
—ventana por enemigo, cierre por evidencia, la pelea como componente conexo—.
Lo que queda **como elección nuestra y no como verdad** es que la unidad
presentada al usuario sea el grupo. sowoky presenta el bicho, y a cambio puede
dar cotas de HP que nosotros no damos.

### 3.3 El detalle de la curación enemiga, en los dos

Nosotros lo arreglamos hace poco (`src/raid.js`, restar curación antes de
clasificar jefe). sowoky lo tiene con una guarda que nosotros no
(`engine.js:723-731`):

Una curación sólo cuenta contra una pelea **ya abierta**, y no refresca el reloj
de inactividad. Dos motivos escritos: una curación no prueba que haya un
encuentro —un sanador de paso inventaría una pelea— y refrescar con ella movería
fronteras existentes. Y declaran lo que eso deja fuera:

> *Failure mode: **a heal landing in the gap between two fights of the same mob is
> dropped rather than guessed onto one of them.***

Una curación **cuenta** para las cotas pero **no abre ni prolonga** una pelea. Es
un matiz que ni jmoyers ni nosotros tenemos escrito.

---

## 4. Rendimiento

### 4.0 Antes de comparar: cuánto tardamos NOSOTROS de verdad

Este apartado decía «~31 s en releer 70 MB», y ese número se ha citado toda la
semana. **Estaba mal por no decir qué incluía.** Cronometrado el 16 de agosto de
2026 sobre el registro de Miguel (74,6 MB), por etapas acumulativas y con el
mismo reloj:

| etapa | tiempo | por MB |
|---|---:|---:|
| A. leer los bytes y partir en líneas | 0,5 s | 0,007 s/MB |
| B. + parsear cada línea | 7,7 s | 0,104 s/MB |
| C. + segmentar en peleas | 11,9 s | 0,160 s/MB |
| **D. + construir cada pelea y ESCRIBIRLA** | **25,5 s** | **0,342 s/MB** |

**Las dos cifras que circulaban median cosas distintas.** Los «13,8 s» de la
medición del crecimiento son la etapa C: leer, parsear y segmentar, **sin tocar
el disco**. Los «31 s» nombraban la reconstrucción entera, que es la D — y para
eso eran aproximadamente correctos, aunque hoy sale 25,5 s (la diferencia cabe
en un disco distinto, una caché fría o una versión anterior; no se ha
investigado más porque el orden de magnitud es el mismo).

**LA CIFRA COMPARABLE ES ~25 s, 0,32-0,34 s/MB**, porque es la que sufre el
usuario cuando le sale el cartel de migración.

#### Y dentro de la D: 24 % disco, 76 % CPU

«Escribir cuesta 13,6 s» fue una resta —D menos C— y esa resta **no es el coste
de escribir**: incluye también la CPU de construir cada pelea. Instrumentado el
sistema de ficheros llamada a llamada (24,4 s, 1.491 peleas, 16,3 ms/pelea):

| qué | llamadas | ms | MB |
|---|---:|---:|---:|
| `mkdir` de una carpeta que **ya existe** | 3.801 | **2.291** | 0 |
| `fights.ndjson` | 1.491 | 1.062 | 24,1 |
| `resume.json` — un puntero de 200 bytes | 1.492 | **1.011** | 0,3 |
| `fights.idx` | 1.491 | 837 | 0,8 |
| el resto (hechizos, AA, botín, mascotas, enciclopedia) | 933 | 536 | 5,0 |
| **todo el disco** | **9.209** | **5.737** | |

**El disco es 5,7 s de los 24,4 — un 24 %.** Los otros 18,6 s son CPU: leer,
parsear, segmentar y agregar cada pelea.

Dos partidas de esas 5,7 s no llevan información a ningún sitio: **2,3 s creando
una carpeta que ya existe 3.801 veces** y **1,0 s reescribiendo 1.492 veces un
fichero de 200 bytes** que sólo hace falta al final. Son 3,3 s, el 13 % de la
reconstrucción entera. No se ha tocado nada: el reparto va antes que el arreglo.

(Un aviso sobre el instrumento, porque el primer intento salió al doble: envolver
`appendFileSync` **y** `writeFileSync` cuenta cada escritura dos veces, porque en
Node el primero llama al segundo por dentro. Las cifras de arriba llevan guarda
de reentrada. El intento sin ella decía 48 MB en `fights.ndjson` — el doble de
los 24 que ocupa de verdad— y por un momento pareció que escribíamos cada pelea
dos veces. No: eran 1.491 escrituras para 1.491 peleas.)

#### Y crece con los megabytes, no con lo ya guardado

La pregunta que decide si la pared empeora sola. Reconstruyendo sobre el 25 %,
50 %, 75 % y 100 % del registro:

| parte | MB | peleas | total | ms/pelea | s/MB |
|---|---:|---:|---:|---:|---:|
| 25 % | 18,9 | 313 | 5,8 s | 18,7 | 0,310 |
| 50 % | 37,7 | 652 | 11,6 s | 17,7 | 0,306 |
| 75 % | 56,6 | 989 | 17,5 s | 17,7 | 0,310 |
| 100 % | 75,6 | 1.490 | 23,9 s | 16,1 | 0,317 |

**Lineal, y el coste por pelea si acaso BAJA.** No hay término que crezca con lo
que ya hay en el almacén: ni el `seen` de la identidad lógica —es un `Map`— ni el
índice, que se añade al final. Así que la proyección a un año no se queda corta
por ese lado, que era el temor razonable.

Eso ordena la comparación de otra manera. Ellos repliegan en cada arranque y no
escriben nunca: pagan la etapa C —11,9 s en nuestro registro— cada vez que
abres. Nosotros pagamos la D una vez y después casi nada, porque reanudamos por
el byte donde nos quedamos. **Persistir es más barato en régimen; replegar sólo
gana si reconstruyes a menudo** — que es exactamente lo que nos ha pasado dos
veces en tres días.

Lo que hacen ellos, en orden de lo aprovechable:

### 4.1 No releer: marca de byte persistida

`src/main/log/scanHistory.ts:7-13`:

> *Byte offset (into the file) of the end of the last complete line processed.
> **The live tailer resumes here** so no bytes appended during the scan are lost
> and none are double-read.*

Y persistida entre ejecuciones — `src/main/log/coldRead.ts:3-6`:

> *The store persists where the tail had read to when this app last shut down
> cleanly (`storeShape.ts LogTailMark`); the scan reports where the log ends now.*

sowoky hace lo mismo más simple, con un tope: `main.js:46`
`BOOTSTRAP_CAP = 40 * 1024 * 1024` — arranca leyendo **los últimos 40 MB** y
luego sigue por offset (`main.js:331`, `tails = new Map()` de ruta a
`{offset, remainder}`).

### 4.2 Trocear la lectura y **descansar** entre trozos

Esto es lo más interesante y no es obvio. `src/main/log/replaySlicer.ts:1-30`:

> *until this existed the unit of work between two event-loop turns was a 1 MB
> read chunk — MEASURED at 75 ms of main-loop stall on this machine's log
> (`.bench/replay.jsonl`, 2026-08-04), with four stalls past 50 ms in a single
> 8.6 s replay.*

**Presupuesto de tiempo, nunca cuenta de eventos:**

> *Event cost varies by an order of magnitude — a combat-dense second is many
> times the work of a quiet one — so "yield every N events" bounds nothing in
> particular.*

`REPLAY_SLICE_MS = 12` (`replaySlicer.ts:41`). Y encima, un **ciclo de trabajo**,
`REPLAY_DUTY = 0.6` (`replaySlicer.ts:59`), que es la parte que un usuario
reportó:

Ceder el turno devuelve el control casi al instante —**medido en 0,01–0,06 ms**—,
así que una relectura troceada seguía teniendo **un núcleo al máximo durante sus
43 segundos enteros**, con EverQuest y OBS al lado. Por eso cada trozo agotado
descansa ahora sobre un temporizador de verdad.

> ***The owner's rule, in his words: better that it finishes stably than quickly.***

Doce milisegundos de trabajo, ocho de descanso. Cuesta 43 s → ~72 s de reloj y
deja el 40 % de un núcleo al juego. Y el porqué de no ponerlo configurable
(`replaySlicer.ts:60`): *«a knob that turns the throttle off is a knob a support
answer will eventually recommend»*.

**Y la garantía de que trocear no cambia el resultado** (`replaySlicer.ts:22-29`):

> *WHAT IT DELIBERATELY DOES NOT DO: reorder, batch, or parallelize anything […]
> `tests/replayChunking.test.mts` folds the same fixtures with and without
> slicing — and with and without resting — and compares the event streams byte
> for byte. **A rest is a pause, and a pause cannot change an answer.***

### 4.3 Lo que NO hacen: hilos

**Ninguno de los dos usa worker threads ni procesos hijos para el parseo.**
jmoyers pliega en el proceso principal de Electron y resuelve el bloqueo
troceando; sowoky lee sincrónicamente por trozos en `main.js:401-406`
(`fs.readSync` sobre un `Buffer` del tamaño del delta). Es un dato útil: **el
problema de releer el registro entero no se ha resuelto en ninguno de los dos
con paralelismo** — ni el nuestro de 25,5 s ni el suyo de 43 s.

### 4.4 Medir el disco por separado del trabajo

`scanHistory.ts:37-46` — `firstMbMs`, con la definición de por qué es una medida
de disco y no del parser:

El tope del flujo de lectura **es** un megabyte, así que el primer trozo que la
satisface es la primera lectura, y el sello se pone **antes** de plegarlo: nada
de lo que la aplicación hace con los bytes entra en el número. Lo que entra es lo
que tardaron en entregarlos el sistema operativo y todo lo que haya entre él y el
disco —

> *an on-access virus scanner being the hypothesis this exists to test*

Y ausente si el fichero mide menos de 1 MB: *«a partial read is a different
measurement wearing this one's name»*. Etiqueta honesta.

---

## 5. Persistencia y migraciones

**El hallazgo que reordena la pregunta: jmoyers no persiste el fold.**

`src/main/combat/engine.ts:265` lo dice de pasada —*«every launch folded the whole
log the same way»*— y `src/main/data/messageOverlay.ts:41` lo repite: *«The mining
is a FOLD — it runs over the whole log at every launch»*.

Es decir: **releen el registro entero en cada arranque, y por eso no tienen
formato de datos que migrar.** Lo que sí persisten son *ajustes*, y para eso
tienen un aparato serio: `src/main/storeMigrations.ts`.

`storeMigrations.ts:1-11`:

> *"an upgrade must be clean, going back indefinitely". […] Before this module
> the app only had ad-hoc, per-reader fixups […] and at least one shape change
> shipped with NO fixup at all: `progress` → `byCharacter` (commit 41831cc)
> **silently orphaned every pre-character store**.*

Las decisiones, y las razones (`storeMigrations.ts:13-25`):

- **Entero explícito dentro del fichero, no semver.** *«CI stamps versions from
  tags and dev runs unstamped, so semver-keyed migrations fire in surprising
  orders across channels. An ordered integer chain is deterministic.»*
- **Ausencia de versión ⇒ 1.** Suelo único para todo lo escrito antes del
  aparato.
- **Ejecutor puro sobre objetos planos, E/S separada.** Las pruebas no necesitan
  Electron.
- El tipo de entrada es deliberadamente `Record<string, unknown>`
  (`storeMigrations.ts:70`): *«a migration's INPUT is a shape the current code no
  longer describes, so `StoreShape` would be a lie at every step but the last.»*

**El contrato** (`storeMigrations.ts:27-29`), que también vive en su AGENTS.md:

> *any commit that changes a persisted shape ships a migration in the SAME commit.
> **Never mutate what an old key means without a step that rewrites it.***

**La política de fallo** (`storeMigrations.ts:31-38`): el arranque nunca muere por
el almacén. Un paso que lanza conserva lo que produjeron los anteriores, sella la
última versión que sí terminó y reintenta en el siguiente arranque; un almacén
escrito por una versión más nueva **no se reescribe nunca**. Van por
`CURRENT_SCHEMA_VERSION = 11` (`storeMigrations.ts:81`).

Y dos notas que son doctrina, no código:

- `store.ts:266` — *«ADDITIVE + OPTIONAL: no schema bump, no migration. Every
  reader defaults on a missing key»*. **Añadir una clave opcional no es un cambio
  de formato.**
- `store.ts:393-398` — una preferencia que sale **apagada a propósito y sin
  migración**, porque *«Adding a migration is precisely the thing that would turn
  it ON»*.

**Contraste con nosotros.** Llevamos dos reconstrucciones forzadas en tres días
(`FORMATO_VERSION` 10, `RECONSTRUIR_DESDE` 10, `MODELO_MEDICION` 5 en
`src/store.js`). Su respuesta a ese problema no es tener mejores migraciones de
datos derivados: **es no tener datos derivados persistidos**. El fold es la
verdad, y se rehace. Que eso sea posible o no depende enteramente de §4 — se
puede rehacer el fold en cada arranque **si el fold no bloquea la aplicación**.
Las dos cosas son el mismo asunto.

sowoky sí persiste (`vendor/parse.js`, `STATE.kills`), con una marca de agua por
fichero (`state.files[f] = { ts, n }`, `parse.js:224`) — y su incidencia `#9` es
justamente que esa marca se desactiva en el camino en vivo.

> **ESTE APARTADO ESTABA ESCRITO AL REVÉS, Y EL SEGUNDO PASE LO DA LA VUELTA.**
> Lo de arriba se lee como si ellos hubieran ELEGIDO no persistir y nosotros
> fuéramos por detrás. **No es eso lo que pasó** — ver §5.1, escrita con lo que
> §12.1 encontró el 16 de agosto.

### 5.1 Y AL REVÉS: no vamos por detrás aquí, vamos por delante y con recibo

**El hallazgo de §12.1 cambia el signo de todo este apartado.** «jmoyers no
persiste el fold» es verdad hoy, y §5 lo presentaba como una postura de diseño de
la que nosotros nos apartábamos. Lo que de verdad ocurrió es otra cosa:

**LO CONSTRUYERON ENTERO Y LO BORRARON EL 11 DE AGOSTO SIN HABERLO PODIDO MEDIR
NUNCA.** Dieciséis ficheros en `src/main/foldCache/` —formato de contenedor,
bloque de identidad, gramática del esquema, cargador, planificación de escritura,
interruptor, verificador en sombra, censo, ayudantes de ruta— más su preferencia,
sus dos canales de IPC, el puente del preload y la casilla **Preferencias →
Rendimiento → «Faster start»**. Todo fuera, en un commit.

**Y NO LO QUITARON PORQUE MIDIERAN QUE NO SERVÍA. Lo quitaron porque no pudieron
medirlo.** La función estaba detrás de un verificador en sombra que comparaba el
fold restaurado contra el fold recalculado, y la puerta de salida era «cuando las
divergencias lleven mucho tiempo en cero». Su propio commit lo dice:

> *shadowChecks was ZERO on every build. The counters were the rollout gate
> («stays off until divergences hold at zero»), and a gate whose denominator never
> moves cannot open.*

**El verificador no corrió ni una vez.** Cero divergencias sobre cero
comprobaciones. La puerta no podía abrirse, así que la función pasó de su vida
entera apagada y salió sin que nadie supiera si valía.

**LO QUE ESO CAMBIA DE LA COMPARACIÓN, punto por punto:**

| | jmoyers | EQL Parse |
|---|---|---|
| ¿existe persistencia de lo derivado? | la construyó y la borró | **sí, en producción** |
| ¿se ha comprobado que lo persistido es correcto? | **nunca corrió el verificador** | **sí**: 1.474 de 1.474 peleas y 111 de 111 entradas de botín reconstruibles desde el log, 0 huérfanas |
| ¿se sabe lo que cuesta rehacerlo? | no está publicado | **sí**: 25,5 s / 74,6 MB = 0,342 s/MB, medido (§4.0) |
| ¿se sabe lo que costará dentro de un año? | — | **sí**: 12,9 min proyectados, con la salvedad de linealidad escrita |
| ¿qué pasa si el registro se rota? | **se pierde el histórico entero**: su corpus es un fichero que nadie ha rotado | **no se pierde**: para eso está el almacén |

**LA FRASE QUE HAY QUE CORREGIR** es la de §5: *«su respuesta a ese problema no es
tener mejores migraciones de datos derivados: es no tener datos derivados
persistidos»*. La respuesta real es **«intentaron tener las dos cosas, la puerta
no abrió, y se quedaron con la mitad barata»**. Nosotros tenemos la cara cara
—almacén, formato, migración forzada cuando toca— **y además el recibo de que
funciona**, que es exactamente lo único que a ellos les faltó.

#### EL CONTRAPESO, y va aquí y no en otro apartado: la primera factura del recibo

**Persistir lo derivado tiene una factura concreta, y el 16 de agosto llegó.**

El plegado de la mayúscula inicial se arregló **AL LEER y no al escribir**, a
propósito, con este argumento escrito en `src/foes.js`: *«así queda bien también
el histórico que ya está guardado, sin pedirle a nadie que reconstruya»*. Es
correcto **para todo lo que se vuelva a plegar**.

**El bestiario no se vuelve a plegar: se acumula.** Y hoy, en el fichero de
Miguel, **9 nombres de 440 dicen menos muertes de las que sus propias peleas
contienen** —`orc legionnaire` **29 contra 43**, `heart harpie` 3 contra 5,
`dry bones skeleton` **0 contra 1**—. Rehaciéndolo desde el almacén, **7 de los 9
se arreglan solos**: eran datos rancios de antes del arreglo. Las 14 muertes que
aquel parche recuperó **siguen faltando** porque nadie ha ejecutado
`npm run enc:rebuild`.

> **UN ARREGLO «AL LEER» NO ALCANZA A UN ACUMULADOR.** Cura la vía, no el
> depósito. Y el depósito es lo que se enseña.

**Ésta es la contrapartida exacta de lo de arriba, y por eso va al lado y no en
un apartado propio.** Nosotros tenemos el recibo de que lo persistido es
reconstruible —1.474 de 1.474— y ellos no; y a cambio tenemos **un agregado que
se quedó con lo viejo y que nadie iba a mirar**. Su postura —*«el fold es la
verdad y se rehace»*— no tiene esta factura, porque no hay depósito que se quede
atrás. **Las dos caras son de la misma moneda y las dos están medidas.**

**Y LO QUE SÍ SEGUIMOS DEBIÉNDOLES, para no cambiar un aplanamiento por otro:**
su postura *«el fold es la verdad y se rehace»* sigue siendo más limpia **si el
fold no bloquea**, y ése es un asunto de §4 y no de éste. Que su puerta no abriera
no hace buena nuestra arquitectura: hace **medible** la nuestra y **no medida** la
suya.

**Y LA LECCIÓN QUE NOS LLEVAMOS DE SU CICATRIZ NO ES SOBRE EL FOLD**, es sobre la
puerta — y por eso está escrita como regla junto a la undécima familia en
`ui/app.js`:

> **UNA PUERTA QUE SE ABRE CUANDO UN CONTADOR LLEVA TIEMPO A CERO TIENE QUE
> DEMOSTRAR PRIMERO QUE EL CONTADOR SE MUEVE. Un cero de «no ha divergido» y un
> cero de «no se ha medido» se escriben igual.**

### 5.2 El precio de esa salida, que el apartado no nombraba

**Si la verdad es el fold, la historia muere con el fichero de registro.** Eso
no es una pega teórica: Miguel se plantea renombrar el log cuando crezca y
empezar otro, y ése es exactamente el día en que las dos posturas se separan.

**Medido sobre el almacén de hoy** (`%APPDATA%\eql-parse`, 15 de agosto de 2026):

| | |
|---|---:|
| peleas guardadas (índice del 15 de agosto, 20:00) | 1.474 |
| ...reconstruibles leyendo sólo el log de hoy | **1.474 (100 %)** |
| entradas de botín | 111 |
| ...reconstruibles | **111 (100 %)** |
| peleas cuyo fichero de origen ya no existe | **0** |

(El almacén y el registro se mueven: 1.474 es el índice del 15 de agosto a las
20:00, y una relectura del log ese mismo día da 1.537 peleas cerradas porque
incluye las que aún no se habían guardado y las que no tienen daño y por eso no
se guardan nunca. Son dos cuentas de cosas distintas, no una discrepancia.)

Hoy el 100 % es reconstruible **porque el registro no se ha rotado nunca**: la
pelea más antigua del almacén es del 4 de agosto a las 09:13 y el primer suceso
del log es del mismo día a las 09:04. El almacén no está guardando historia que
el log no tenga; está guardando **tiempo**.

**El día que Miguel rote, ese 100 % pasa a 0 % para todo lo anterior al corte.**
Y entonces «no persistir el fold» deja de ser una alternativa disponible: sin
almacén, rotar borra el histórico. jmoyers puede permitirse su postura porque su
registro de referencia es un fichero que nadie ha rotado; no es una propiedad de
su arquitectura, es una propiedad de su corpus.

**Y el otro lado del precio, con la cifra buena.** Una reconstrucción completa
—leer, parsear, segmentar, construir cada pelea y escribirla— tarda **25,5 s
para 74,6 MB**, o sea **0,342 s/MB** (§4.0). Al ritmo medido de Miguel (6,2 MB y
79.349 líneas por día de juego, 12 días de juego en el fichero):

| plazo | tamaño | líneas | pliegue solo (C) | reconstrucción (D) |
|---|---:|---:|---:|---:|
| hoy | 74,6 MB | 955.570 | 11,9 s | **25,5 s** |
| 6 meses | 1,10 GB | 14,5 M | 3,0 min | **6,4 min** |
| 12 meses | 2,21 GB | 29,0 M | 6,0 min | **12,9 min** |

(La proyección supone escala lineal y el mismo disco. Leer escala con los bytes
y escribir con el número de peleas; las dos crecen a la vez, así que la
aproximación aguanta para decidir, no para prometer.)

**Trece minutos es lo que costará cada reconstrucción forzada dentro de un año**
si el registro no se rota. Ése es el precio real de cada cambio de formato que
decidamos, y es el argumento tanto para rotar como para dejar de forzar
reconstrucciones. Las dos cosas tiran en la misma dirección; lo que no se puede
es rotar Y no persistir.

---

## 6. Arquitectura, overlays y datos consultados

> **Mudado a [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md)** (§6, §7 y §8
> del primer pase, enteros).

**ARQUITECTURA.** «Extensible event-stream» significa **un bus síncrono con una
unión discriminada**: el contrato está publicado y el motor es un suscriptor más.
En el nuestro, añadir una sección toca el parser.

**OVERLAYS.** **Cinco de sus trece incidencias son de overlay**, y con §16 son
ocho de diez en sowoky. **Un overlay es caro de tener bien, y el coste no está en
el contenido**: está en la ventana, el escalado de pantalla y el ratón.

**DATOS CONSULTADOS.** Todos sus catálogos llevan **`scrapedAt` + `source` +
`count`**, y los recolectores son scripts que se pueden volver a correr. **Es
nuestra taxonomía medido/deducido/declarado aplicada a la construcción del
catálogo**, y es la práctica que copiamos en §20.6 para la tabla de reapariciones.
Lo mejor del primer estudio sigue siendo **minar la asociación en vez de escribir
la regla**.

---

## 9. Pruebas

> **El detalle, en [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md).**

| | ficheros | líneas |
|---|---:|---:|
| jmoyers | 356 `*.test.mts` + 98 e2e | 105.387 |
| sowoky | **ninguna en el repo** | 0 |
| EQL Parse | 45 en `test/` | ~10.400 |

**La comparación justa, que era lo que se preguntaba:** construir guardas contra
un registro real no es lo mismo que construirlas contra una especificación. Las
nuestras se escriben con líneas copiadas del log de Miguel, y las suyas con
fixtures. **Y ninguna de las dos cosas caza lo que caza una medición sobre el
registro entero** — la lección de §19.

## 10. Lo que no tienen

Para saber qué no perder. Todo comprobado, no supuesto.

**1. Idiomas.** Los dos son sólo inglés: `git ls-files | grep -icE
'locale|i18n|lang/|translations'` da **0 en los dos repos**, y no hay
dependencia de traducción en ninguno de los dos `package.json`. Nosotros vamos
en cinco.

**2. Cero dependencias.** jmoyers arrastra 14 de ejecución (React, MUI,
`@mui/x-data-grid`, chokidar, electron-store, electron-updater, koffi,
native-reg, **onnxruntime-node**, phonemizer) y 25 de desarrollo. sowoky lleva 1.
Nosotros, 0. Con `onnxruntime-node` y `phonemizer` jmoyers hace síntesis de voz
local — es la contrapartida de nuestros 350 paquetes de voz que no perseguimos.

**3. El reproductor.** No hay nada equivalente en ninguno de los dos. jmoyers
tiene un *timeline* de eventos por encuentro (`encounter.ts:182-197`, anillo de
8.000 instantes) y sowoky un desglose por pelea, pero **ninguno reproduce la
pelea**. Las N siluetas por nombre, el suelo dicho en pantalla, la pista de
estados, la barra de aturdimiento — eso es sólo nuestro.

**4. El suelo declarado.** jmoyers documenta que la vida del bicho es
inobservable (`AGENTS.md`, ley 6: *«mob HP»* en la lista de no-distinguibles) y
sowoky da cotas cuando hay muerte (`engine.js:665-671`). Pero **ninguno dice al
usuario cuántos individuos había como mínimo**. sowoky lo *detecta* (el
`dotStack`) y lo usa para desconfiar de una suma; nosotros lo *decimos*: «al
menos 3».

**5. La procedencia en la interfaz.** Ellos marcan lo inferido en el código y en
sus leyes (*«Anything inferred is LABELED inferred»*, ley 1) y sowoky marca
`f.inferred` en una pelea cerrada por ráfaga. Pero no encontré en ninguno de los
dos una etiqueta **visible al usuario** que diga de dónde sale un número, como
nuestros `raid.src.*` / `mate.src.*` / `adv.src.*`.

**6. El «sin identificar» dicho en voz alta.** Nuestra nota de que hay daño que
no se puede atribuir, con el motivo, en la propia pantalla de la pelea. Ellos lo
tienen escrito para el desarrollador (`AGENTS.md` ley 6, *«Say what the log
cannot say»*) pero no lo pintan.

**7. Consejo de postura.** No hay nada parecido en ninguno de los dos.

---

## 11. Lo que este estudio dice de nosotros

Sin convertirlo en tareas — sólo lo que el material sostiene:

**Confirmado desde fuera.** El modelo de pelea —ventana por enemigo, cierre por
evidencia, la pelea como el grupo cuyas ventanas se solapan— lo comparte una
implementación independiente de 196.000 líneas que llegó a él por su cuenta y lo
escribió como ley (`AGENTS.md:794`). Nuestro plazo de 12 s y su
`PRESENCE_GONE_MS` de 20 s son el mismo parámetro. Eso vale más que cualquier
medición nuestra, que era el punto.

**Confirmado también el vocabulario.** *«proof outranks inference»* (sowoky `#13`)
y *«Anything inferred is LABELED inferred — never silently guess»* (jmoyers, ley 1)
son nuestra `identidad-declarada-gana` y nuestro `medido-vs-deducido` escritos por
otros. Y su *«awaiting-sample law»* es nuestra regla de que una regla candidata
que casa cero veces no entra.

**Divergencia que no es error.** sowoky mide por bicho y nosotros por grupo.
Ninguna de las dos es «la» frontera: es una elección de unidad. La suya le compra
cotas de HP y segundos ofensivos que la nuestra no puede dar sin volver a
separar.

**Donde vamos por detrás, y es medible:** el plegado de mayúscula sin prueba (152
de 164 nombres propios), las 9.965 líneas de facción que son la puerta a detectar
muertes que el log no escribe, la reconstrucción de ~25 s —de los que 5,7 son
de disco y 3,3 de ésos no llevan información a ningún sitio— que ellos han
evitado sin
hilos —troceando y descansando—, y la ausencia de oráculos de equivalencia en las
pruebas.

**Donde vamos por delante:** cinco idiomas, cero dependencias, el reproductor, el
suelo dicho, la procedencia visible.

---

## Método y límites

- **Repos leídos:** `github.com/jmoyers/everquest-companion` en `a61efb3`
  (2026-08-14), historial completo desatendido (1.109 commits);
  `github.com/sowoky/eqltools-companion` en `877636a` (2026-08-15), 45 commits.
- **Incidencias:** las 11 de jmoyers y las 13 de sowoky, listadas con `gh issue
  list --state all`; leídos íntegros los cuerpos de 11 de ellas.
- **Mediciones nuestras:** todas sobre
  `D:\EVERQUEST LEGENDS\Logs\eqlog_Campeon_erudin.txt`, 74,3 MB, 951.773 líneas
  no vacías el 15 de agosto de 2026, con nuestro propio `src/parser.js`. **Es un
  fichero vivo**: Miguel sigue jugando y el registro crece, así que una
  remedición dará cifras algo mayores. Todas las de aquí son de esa foto.

  **LAS DEL 16 DE AGOSTO POR LA TARDE SON DE OTRA FOTO Y LO DICEN**: 80,7 MB y
  **985.189 líneas con cabecera**, hasta el 16 a las 00:24. Son las de §15.2
  (detectores de gemelos), §19 (el reproductor) y §20 (reaparición). Donde una
  cifra de esa tanda contradice a una de la anterior, **no es que el registro haya
  crecido**: es una corrección, va marcada como tal y su historia está en
  [`ESTUDIO-ARCHIVO.md`](ESTUDIO-ARCHIVO.md).
- **Dos almacenes, y las mediciones que importan se hacen sobre los dos.** El de
  Miguel (1.493 peleas con combatientes) y uno reconstruido el 16 de agosto desde
  el mismo registro (1.504). Cuando una cifra sale igual sobre los dos, se dice;
  cuando no, tampoco se esconde.
- **NI UNA LÍNEA DE SU CÓDIGO EN ESTE FICHERO, Y ESO ES UNA CORRECCIÓN.**
  **Corregido el 15 de agosto**: había diez bloques ejecutables suyos pegados
  mientras esta misma línea afirmaba que no había ninguno. Sustituidos por
  descripciones nuestras; los valores y los nombres de constante se quedan,
  porque son hechos. **La historia entera, en
  [`ESTUDIO-ARCHIVO.md` §A2](ESTUDIO-ARCHIVO.md).**
- **Las citas de prosa sí se quedan**, acortadas a la frase que sostiene el
  argumento. Son razonamiento de diseño, citado con su fichero y su línea para
  comentarlo, y ninguna supera las 51 palabras.

**Lo que falta, dicho para que no se confunda con cubierto:**

- **`src/shared/combat.ts` (1.125 líneas) y `src/main/combat/` (10.787) sólo se
  han leído en las partes de segmentación e identidad.** Toda la mitad de
  agregación —`aggregate.ts`, `rounds.ts`, `procWindows.ts`, `procDetect.ts`,
  `healing.ts`— está sin leer. Ahí es donde vive su modelo de *rondas* y de
  *procs*, y por lo que se ve en `AGENTS.md` ley 6 es sofisticado.
- ~~**`src/shared/respawn.ts` (1.242) y toda la maquinaria de temporizadores de
  reaparición** — sin leer.~~ **LEÍDO el 16 de agosto — ver §20.5.** Quedan sin
  abrir sus superficies (`RespawnOverlay.tsx`, `RespawnRowBar.tsx`) y sus cinco
  baterías de pruebas de reaparición (unas 92.000 líneas entre todo).
- **Su telemetría** (`shared/telemetry.ts` 1.037 + `telemetryRollup.ts` 837 +
  `TELEMETRY.md`) — sin leer. Es un asunto entero con implicaciones que no son
  técnicas.
- **Los 469 commits de jmoyers que no casan con ninguna familia** de la
  clasificación de §1.1 — sin revisar uno a uno.
- **La clasificación de commits es por palabras clave sobre prosa**: es un suelo
  por familia, nunca un censo.
- **La agrupación del cajón conserva los nombres propios**, así que cada recuento
  por forma es un suelo y las familias reales son mayores de lo que dice la
  tabla.

---

# Segundo pase — 16 de agosto de 2026

El primer estudio preguntaba **qué tienen**. Éste pregunta **qué les costó, y
nuestro registro tiene esa misma forma**.

**Cada hallazgo viaja con la pregunta que le hace a nuestro log.** Si era barata,
va contestada con el número; si era cara, queda escrita como pregunta pendiente.
Un hallazgo sin pregunta asociada no entra. Y se priorizan **cicatrices** sobre
funciones: un «arreglamos X porque Y» vale diez veces más que un «tienen Z».

## 12. Lo que revirtieron, y lo que borraron

> **Mudado a [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md)**: los tres
> casos con sus commits y sus citas.

**EL HALLAZGO MAYOR DEL SEGUNDO PASE ESTÁ ASCENDIDO A §5.1**, que es donde le
toca: el 11 de agosto **borraron la persistencia del fold entera** —16 ficheros—
**sin haberla podido medir nunca**, porque su verificador en sombra no corrió ni
una vez y *«a gate whose denominator never moves cannot open»*. De ahí sale la
**regla de la puerta**, escrita junto a la undécima familia en `ui/app.js`.

**Y dos retiradas más, con la misma lección de producto:** un experimento de
reordenar alarmas retirado la misma noche —*«una sola petición lo pidió»*— y dos
pestañas con estado propio sustituidas por una búsqueda. **El patrón se repite
tres veces en cinco días: lo que se puede buscar no necesita organizarse a mano.**

**La pregunta a nuestro repo, PENDIENTE:** ¿qué tenemos publicado que pidiera una
sola persona y esté complicando lo de al lado?

## 13. Las constantes que NO se movieron

Esperaba encontrar valores bailando. Lo que hay es lo contrario, y es un
resultado:

| constante | valor | ¿cambió desde el primer commit público? |
|---|---:|---|
| `LINGER_MS` | 5.000 ms | **no** |
| `PRESENCE_GONE_MS` | 20.000 ms | **no** |
| `FALLBACK_IDLE_MS` | 60.000 ms | **no** |
| `CC_HOLD_MS` | 120.000 ms | **no** |
| `ACTIVE_MS` | 3.000 ms | **no** |
| `REPLAY_SLICE_MS` | 12 ms | **no** |
| `REPLAY_DUTY` | 0,6 | nace el 6 de agosto (`JOS-50`), no cambia después |
| `FIGHT_IDLE` (sowoky) | 45 s | nace el 7 de agosto (0.10.0), no cambia después |
| `BOOTSTRAP_CAP` (sowoky) | 40 MB | **no**, desde el primer commit |

Comprobado abriendo el fichero en el primer commit público y comparando con el
de hoy: las cinco de encuentro salen **byte a byte idénticas** a través de 1.109
commits.

**LA SALVEDAD, Y ES GRANDE.** Su historia pública empieza el 4 de agosto con un
commit llamado *«initial public source under FSL-1.1-MIT»*. **Lo que pasó antes no
está.** Así que lo que se puede afirmar es «estables durante los once días
públicos», no «nunca se movieron». Un valor que nace ya redondo —20.000, 60.000,
120.000— suele ser un valor elegido, no medido, y su propia nota de
`CC_HOLD_MS` lo dice: existe *«so a lone mez can't pin a fight open forever»*, que
es un argumento de forma, no una medición.

**La pregunta a nuestro log, contestada:** las nuestras sí se movieron y con
medición al lado — `MARGEN_TICK` de 3 a 5 con **dos bases distintas escritas**, y
`PLAZO_ENEMIGO` elegido dentro de una banda 10–15 medida. La comparación no dice
que ellos acierten más: dice que **nosotros sabemos por qué**, y ellos no tienen
dónde mirarlo.

## 14. La mitad de agregación, que es la que viene después

Lo que el primer pase declaró sin leer. Se lee ahora porque el dps individual va
a necesitarlo.

### 14.1 El DPS: media móvil de 5 s, y el rótulo la dice

`renderer/src/features/combat/dashboardData.ts:216-246`:

| constante | valor | qué decide |
|---|---:|---|
| `SMOOTH_MS` | **5.000 ms** | la ventana de la media móvil |
| `MAX_BUCKETS` | 360 | tope de vértices de la polilínea |
| `LIVE_WINDOW_MS` | 120.000 ms | cuánto de una pelea viva se ve antes de desplazarse |

El cubo mínimo es **1 s** y crece para que la línea nunca pase de 360 vértices.
La serie es una **media móvil de cola**, y el divisor no es siempre 5 s: al
principio de la pelea vale `min(i+1, w) × bucketMs`, o sea sólo los cubos que
existen. **Ésa es su respuesta a las peleas cortas** — no hay caso especial, el
divisor encoge solo.

**Dos decisiones que valen más que las constantes:**

**(a) La cifra al pasar el ratón sale de la MISMA serie que la línea.**
`dpsAt.ts:1-6`: *«sampled from the chart's OWN rolling series, never computed a
second way […] so the timeline's hover number and the DPS curve's line can never
disagree»*. Es nuestra regla de una pregunta, un sitio, aplicada a un gráfico.

**(b) No se interpola entre cubos**, y el motivo está escrito
(`dpsAt.ts:22-25`): *«the series is bucketed at >=1s and the readout says so ("Ns
rolling"), so smoothing the steps away would invent a rate the log cannot
support»*. Y el pie lo declara: `rollingNote` imprime literalmente «5s rolling»
y añade «~ estimated» cuando el anillo de eventos se truncó.

**Y su ley 9**, que es la que más nos toca al construir el gráfico:

> **One time base per chart.** *A curve's vertices, markers, axis and hover
> inverse all read ONE `{t0, t1, bucketMs}`; samples anchor at bucket centres.*

Con su cicatriz al lado: mezclar un mapeo por fracción-de-índice para los
vértices con uno por fracción-de-tiempo para las marcas **estiraba las marcas un
cubo entero en el borde derecho**, y una ventana medida en reloj de pared las
hacía *nadar* contra una curva quieta en cada tic. Y la frase que cierra:
*«Canvas is never the answer to arithmetic disagreement.»*

**La pregunta a nuestro log, y es la que decide el diseño del gráfico:** ¿cuántas
de nuestras peleas duran menos que la ventana de suavizado? **Contestada en el
primer estudio y aquí se conecta**: con media de 5 s, una pelea de 6 s es
prácticamente un solo punto. Su solución —divisor que encoge al principio— es
exactamente lo que hace que eso no mienta, y no la habíamos considerado.

### 14.2 Las rondas: un concepto que no tenemos

`main/combat/rounds.ts:1-30`. EQ **anota** el contraataque, el frenesí y el
aplastamiento, y **no dice nada** del ataque doble o triple: un barrido de 1,35
millones de líneas encuentra **cero anotaciones** contra miles de segundos con
varios golpes medidos. Así que una ronda es un sustituto, y el honesto es:

> *one round = the swings ONE attacker made with ONE verb, at ONE target, in ONE
> second.*

**El peligro que les enseñó a meter el objetivo en la clave**, y está medido: el
apuñalamiento por la espalda tiene un tiempo de reutilización de ~10 s, así que
cuatro en un segundo es mecánicamente imposible. Su registro tiene **exactamente
cinco segundos así, y los cinco con la misma forma**: dos objetivos distintos con
la **misma secuencia ordenada de daños** en cada uno — *una* ronda de ataque doble
repartida entre dos defensores e impresa dos veces. Agrupar sólo por objetivo
daría dos rondas de dos golpes; agrupar sin él daría una de cuatro.

**La pregunta a nuestro log: ¿tenemos ese abanico?** **Pendiente** — es barata de
contestar y no la he hecho: buscar segundos con el mismo atacante, el mismo
verbo y la misma secuencia de importes sobre dos objetivos distintos.

### 14.3 Los procs: la tasa se divide por la ventana que la explica

`main/combat/procViews.ts:149-165`. Una tasa por minuto necesita un denominador,
y ellos distinguen **tres estados** en vez de dividir siempre por la pelea:

- **CONOCIDO** — hay un tramo observado que concede el proc (un veneno aplicado,
  un buff con su ventana). La tasa se divide por ese tramo, exacta.
- **DESCONOCIDO** — el tramo existe pero este segmento no lo vio. Se divide por el
  segmento y se marca `sourceAmbiguous`.
- **NO PROCEDE** — un proc innato de clase. No hay ventana que observar ni que
  echar de menos, así que **marcarlo de ambiguo invitaría a buscar algo que no
  existe**. Divide por el segmento, sin más.

Esa tercera rama es la decisión buena: *no toda ausencia de dato es una duda*.

**Y su ley 11** resuelve la pregunta que yo hacía —qué pasa cuando la pelea es
tan corta que la tasa no significa nada— por un camino que no se me había
ocurrido: **las puertas de exclusividad son conscientes de la tasa**. Afirmar
«nunca dispara sin X» exige que la exposición sin X **prediga** evidencia —al
menos 3 disparos esperados al ritmo propio de esa vía— y no un mínimo plano de
golpes. Su ejemplo: *289 golpes le niegan a un objeto lo que 225 le conceden a
otro, y esa asimetría es el punto*.

**La pregunta a nuestro log, contestada a medias:** nosotros ya hacemos lo mismo
en espíritu con `det.shapeFew` —«faltan N golpes para poder dar la forma»— pero con
un **mínimo plano de 8**, no con una expectativa por vía. **Pendiente:** medir si
ese 8 plano niega la forma a habilidades de cadencia lenta que ya tienen muestra
suficiente para su propio ritmo.

### 14.4 La curación: reglas de honestidad, no de agregación

`main/combat/healing.ts:1-26`. Va **al lado** del daño, en el mismo acumulador —así
hereda la selección de pelea y el congelado de zona— y no se resta de nada. Lo
que importa son sus cuatro reglas, que son todas de lo que **no** se puede decir:

- **La sobrecuración es un SUELO, no una tasa.** Se deriva sólo de la forma con
  paréntesis, que EQ escribe exactamente cuando lo crudo supera a lo efectivo.
  Una línea sin paréntesis aporta 0.
- **Los tics de una curación con duración se distinguen, pero no se atribuyen.**
  Corregido el 4 de agosto: la forma existe —752 líneas, 12 hechizos—, y lo que
  siguen sin poder hacer es decir *de qué lanzamiento* es cada tic.
- **Las absorciones no llevan importe: se cuentan, no se valoran.** No entran en
  ninguna suma porque no hay nada que sumar.
- **Una curación que el log anuncia y no cuantifica** (el *Mend* del monje) tiene
  vía propia, clasificada `unstated`, con recuento y total 0 — *«that 0 is the
  absence of a measurement, not a measurement of zero»*.

La última frase es la nuestra, palabra por palabra: es la razón por la que en
nuestro resumen un campo no se escribe en vez de escribir un cero.

### 14.5 PARA CUANDO SE CONSTRUYA EL DPS: las seis reglas, juntas

**Esto no es un plan de trabajo: es la hoja que hay que tener delante el día que
se escriba el gráfico.** Está aquí y **también en la cabecera de
`diseño/ui-dps-individual.html`**, que es donde va a mirar quien lo construya.

**1 · La forma de la serie.** Cubos de **1 s**, media móvil de cola de **5 s**,
tope de **360 vértices**; el cubo crece cuando la pelea no cabe en 360.

**2 · La cifra del ratón sale de LA MISMA SERIE que la línea.** Nunca calculada
por otro camino. Es nuestra regla de *una pregunta, un sitio* aplicada a un
gráfico, y su versión de ella lo dice mejor: *«so the timeline's hover number and
the DPS curve's line can never disagree»*.

**3 · No se interpola entre cubos.** La serie está cubeteada a ≥1 s y el pie lo
declara («5 s móviles»); **suavizar los escalones inventaría un ritmo que el
registro no sostiene**.

**4 · Peleas cortas: sin caso especial.** El divisor es `min(i+1, w) × cubo`, o
sea sólo los cubos que existen: **encoge solo** al principio de la pelea. Es la
respuesta a «una pelea de 6 s con media de 5 s es casi un punto», y es mejor que
cualquier umbral porque no hay umbral.

**5 · UNA SOLA BASE DE TIEMPO POR GRÁFICO (su ley 9).** Vértices, marcas, eje e
inversa del ratón leen **un** `{t0, t1, cubo}`; las muestras se anclan en el
**centro** del cubo. Su cicatriz: mezclar mapeo por fracción-de-índice con mapeo
por fracción-de-tiempo **estiraba las marcas un cubo entero en el borde derecho**.

**6 · Y EL AVISO CONCRETO SOBRE LA MAQUETA, que tiene la forma exacta de esa
cicatriz.** `diseño/ui-dps-individual.html` **dibuja por ÍNDICE**
—`px = ML + i*(W-ML-MR)/(n-1)`— y escribe las horas del eje **a mano**
(`[[0,'0:00'],[n/2,'2:56'],[n-1,'5:52']]`). El ratón invierte ese mismo mapeo por
índice, así que **hoy es coherente consigo mismo**, y por eso se ve bien.

**Vale exactamente mientras los cubos sean contiguos y de un segundo.** Se rompe
**en cuanto haya que diezmar para el tope de 360**: entonces el índice deja de ser
proporcional al tiempo, las horas escritas a mano dejan de caer donde dicen, y el
desacuerdo aparece **en el borde derecho**, que es justo donde ellos lo vieron.

> **Constrúyase mapeando POR TIEMPO desde la primera línea.** No «se arregla
> luego»: el mapeo por índice es correcto hasta que deja de serlo, sin dar
> ningún síntoma antes. La maqueta es la cicatriz de jmoyers dibujada, con datos
> inventados y todo.

**La pregunta a nuestro log:** ¿nuestro dps por combatiente contesta lo mismo que
el suyo? **No, y ahora se puede decir en qué se diferencia:** el suyo es una media
móvil de 5 s por cubo de 1 s, sobre daño saliente separado en cuatro bandas (tú,
mascota, grupo, entrante). El nuestro es un total dividido por una duración —con
`dps`, `dpsOwn` y `dpsActive` como tres respuestas distintas—. **No son el mismo
número con distinto suavizado: son una serie y un escalar.**

## 15. Los tres detectores de gemelos

> **Medidos sobre nuestro registro y DECIDIDOS: ninguno entra en el suelo.**
> La medición, el control de mecanismo y el cero del veneno están en
> [`HALLAZGOS.md` §1](HALLAZGOS.md).

De las tres formas que ellos usan para separar homónimos, sobre 1.504 peleas
del registro de Miguel: la contradicción del encanto aporta **0** pares que el
suelo no tuviera, X→X aporta **1** y el tick de veneno repetido **0**.

**Ninguno está refutado: están medidos en un registro donde no hacen falta**,
porque aquí casi todo lo que se toca acaba muriendo y la muerte —la evidencia
con la que el suelo ya cuenta— llega antes que ellos.

## 16. Las diez incidencias de sowoky que faltaban

> **La tabla entera, una a una, en [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md).**

**La lectura de conjunto, que es la que vale: ocho de las diez son de VENTANA, y
ninguna es de parseo.** Coincide con el primer estudio —diez de las veinticuatro
incidencias de los dos repos son de ventana— y refuerza la conclusión: **un
overlay es caro de tener bien, y el coste no está en el contenido**.

**Las tres formas que son nuestras y no dependen de tener overlay:**

- un **recálculo disparado sólo por movimiento** (nada se mueve, nada se
  recalcula);
- **dos consumidores del mismo suceso y sólo uno actualizado** — de las peores;
- **dos superficies de «lo mismo» con configuraciones separadas**.

**La pregunta a nuestro log: ninguna de las ocho se contesta con el registro.** Se
contestan abriendo la aplicación en un monitor escalado al 175 %, que es una clase
de medición que no hacemos.

## 17. Los 469 commits sin clasificar

> **El repaso, en [`ESTUDIO-ARCHIVO.md`, Parte II](ESTUDIO-ARCHIVO.md).**

**Lo que aparece y no teníamos como familia: la coherencia entre el documento y el
código.** Commits cuyo único trabajo es que lo escrito y lo ejecutado vuelvan a
decir lo mismo. Nosotros lo hacemos y no lo contábamos.

## 18. Sus trece leyes, enteras

El primer estudio citó cinco. Están todas en `AGENTS.md:724-870`, bajo el título
*«World-model laws (hard-won; do not relearn these)»*.

| # | la ley, en corto | ¿nosotros? |
|---|---|---|
| 1 | **Los mensajes antes que la inferencia.** Lo inferido va etiquetado como inferido | **la tenemos** — medido/deducido/declarado |
| 2 | **Los nombres están sucios: se normalizan en los bordes, se muestran crudos** | **la contradecimos sin querer**, y es lo que estamos arreglando: usamos la clave plegada como texto de pantalla |
| 3 | **Los mensajes compartidos son la norma.** 123 familias de «se ha desvanecido»; una frase no nombra un hechizo | **no la habíamos pensado**: nuestra pista de estados asume que el mensaje identifica |
| 4 | **Entidades, no nombres; disposición, no identidad.** «Mascota» no es una clase del modelo | **parcial**: separamos el encantado del salvaje, pero por clave de texto |
| 5 | **Los agregados mienten: derívese de identidades.** Sumar ganancias cuenta dos veces los reembolsos | **no la habíamos pensado** |
| 6 | **Decir lo que el log no puede decir**, con la lista de no-distinguibles | **la tenemos** — el «sin identificar» y el suelo |
| 7 | **Los encuentros cierran por evidencia** | **la tenemos**, y coincidimos en la forma (§3.1) |
| 8 | **Fallo y resistencia son de primera clase y sin importe** | **la tenemos** — los evitados cuentan como suceso |
| 9 | **Una sola base de tiempo por gráfico** | **no la habíamos pensado**, y es la que hace falta ahora |
| 10 | **Los intervalos revisables se unen AL LEER; nada estampa sus identificadores** | **no la habíamos pensado** |
| 11 | **Las puertas de exclusividad son conscientes de la tasa** | **la contradecimos**: nuestro mínimo de 8 golpes es plano |
| 12 | **Los renombrados entre fuentes son conocimiento, nunca aproximación** | **la tenemos** — nuestra tabla de zonas es a mano |
| 13 | **Un hueco muerte→muerte es una COTA SUPERIOR, no una medida** | **la tenemos en espíritu** (el suelo), no para reapariciones |

**El recuento: cinco las tenemos, cuatro no las habíamos pensado, dos las
contradecimos sin querer, una la contradecimos a medias y una la tenemos en otro
sitio.** Las dos que contradecimos —la 2 y la 11— son las dos que ya estaban en
nuestra cola antes de leer esto, lo cual es tranquilizador y no una coincidencia:
son las que dan síntomas.

### 18.1 Las cuatro que no habíamos pensado, enteras

**Y ÉSTAS SON LAS QUE IMPORTAN, precisamente por lo contrario.** Las dos que
contradecimos las vimos solos porque **dan síntomas**: un nombre plegado sale mal
escrito en pantalla y se ve; un mínimo plano de 8 golpes niega una forma y alguien
lo nota. **Éstas cuatro no dan ninguno.** Son la décima familia con otro traje —*no
fallan, no ven*— y por eso llevaban aquí resumidas en una casilla de tabla, que es
el sitio donde un hallazgo se muere.

Cada una va con lo mismo: **qué dice y de qué cicatriz suya sale**, **la pregunta
que le hace a nuestro registro** —contestada si era barata— y, si no se puede
contestar, **qué haría falta para poder**.

---

#### Ley 3 · Los mensajes compartidos son la norma

> **Shared messages are the norm.** *123 families of «has worn off»; a phrase does
> not name a spell.* — `AGENTS.md:724-870`

**QUÉ DICE.** El texto que el juego escribe cuando algo entra o se cae **no
identifica el hechizo**. Muchos hechizos distintos comparten la misma frase, así
que leer la frase y anotar «se cayó X» es inventarse la X. La cicatriz de la que
sale es de censo: contaron las familias de mensajes de desvanecimiento y salieron
**123**, no una por hechizo.

**QUÉ NOS TOCA.** Nuestra pista de estados **asume que el mensaje identifica**. El
comentario de `src/patterns.js:820-837` ya vio la mitad del problema —«el registro
NO dice qué te entró», y por eso la frase va en `flavor` y no en `ability`— pero lo
trató como un caso raro que se aparta, no como **la norma**.

**LA PREGUNTA A NUESTRO LOG: ¿cuántas de nuestras líneas de estado no nombran el
hechizo? CONTESTADA — el 72,9 %.** Medido el 16 de agosto sobre las 985.189 líneas
con cabecera:

| | líneas | frases distintas |
|---|---:|---:|
| caídas que **sí** nombran el hechizo (`Your <X> spell has worn off.`) | 2.485 | 98 hechizos |
| caídas que **no** lo nombran (`Your <X> fades.`) | 1.072 | **24** |
| entradas que **no** lo nombran (`You feel <X>.`) | 5.615 | **60** |
| **total de líneas de estado sin nombre de hechizo** | **6.687 de 9.172** | **84 frases** |

Las más frecuentes son exactamente de la clase que describe la ley: *«an aura of
protection engulf you»* (1.634), *«torn between life and death»* (875), *«your soul
being consumed»* (519), *«very dispelled»* (240) frente a *«a bit dispelled»* (194).
**Casi tres de cada cuatro líneas de estado son prosa que no nombra nada.**

**LO QUE LA MEDICIÓN NO CONTESTA, y hay que decirlo:** sabemos cuántas frases no
nombran el hechizo; **no sabemos cuántos hechizos comparten cada frase**, que es
la afirmación fuerte de la ley. Eso **no se puede sacar del registro**: haría falta
una tabla *frase → hechizos* de fuera, y sería conocimiento **consultado**, con su
fecha de extracción. Lo que sí se puede afirmar hoy sin salir del log: **84 frases
distintas para al menos 98 hechizos conocidos**, así que el reparto uno-a-uno es
imposible por recuento.

---

#### Ley 5 · Los agregados mienten: derívese de identidades

> **Aggregates lie; derive from identities.** *Summing gains double-counts
> refunds.* — `AGENTS.md:724-870`

**QUÉ DICE.** No sumes un total y lo guardes: **guarda las identidades y suma
cuando haga falta**. Un total mantenido aparte deja de cuadrar con lo que resume en
cuanto una de las dos vías cambia, y **el desvío no se ve** porque las dos cifras
son plausibles. Su cicatriz es de contabilidad de ganancias: los reembolsos se
contaban dos veces porque el total se llevaba a mano.

**QUÉ NOS TOCA.** Esta casa tiene agregados guardados en tres sitios: la fila por
combatiente dentro de la pelea, los totales de la pelea, y **el bestiario**, que
acumula por nombre a lo largo de todo el histórico.

**LA PREGUNTA A NUESTRO LOG: ¿alguna suma nuestra ha dejado de cuadrar con las
identidades que resume? CONTESTADA, y con las dos caras.** Medido el 16 de agosto
sobre el almacén de Miguel (1.493 peleas, 440 nombres en el bestiario):

| invariante | resultado |
|---|---|
| `total` = suma del daño de los no-enemigos de la pelea | **cuadra en las 1.493** |
| `enemyTotal` = suma del daño de los enemigos | **cuadra en las 1.493** |
| `foes[n].kills` del bestiario = muertes de ese nombre sumadas sobre las peleas | **9 nombres de 440 NO cuadran** (peor desvío: 14) |
| `foes[n].fights` = peleas donde ese nombre sale como enemigo | **3 de 440 no cuadran** |

**Los dos primeros cuadran porque se derivan; el tercero no cuadra porque se
acumula.** Y falla **siempre por abajo**: `heart harpie` 3 contra 5,
`orc legionnaire` **29 contra 43**, `dry bones skeleton` **0 contra 1**. El
bestiario dice menos de lo que sus propias peleas contienen.

#### Y el porqué, contestado el mismo día con la partición diferencial

Se rehízo el bestiario desde el almacén —sobre una copia, sin tocar el de
Miguel— y se volvió a restar. **De los 9 nombres, 7 se arreglan solos al
rehacerlo**: las 28 muertes que faltaban se quedan en 3.

**Son datos rancios, y la causa está escrita en el propio código que los
produce** (`src/foes.js:245-268`). El plegado de la mayúscula inicial se arregló
**AL LEER y no al escribir**, a propósito: *«así queda bien también el histórico
que ya está guardado, sin pedirle a nadie que reconstruya»*. Y es cierto **para
todo lo que se vuelva a plegar** — pero el bestiario **no se vuelve a plegar: se
acumula**. Las 14 muertes de `orc legionnaire` que aquel arreglo recuperó siguen
faltando en el fichero de Miguel porque nadie ha ejecutado `npm run enc:rebuild`.

> **UN ARREGLO «AL LEER» NO ALCANZA A UN ACUMULADOR.** Cura la vía, no el
> depósito. Y el depósito es lo que se enseña.

**Y las 3 muertes que quedaban no eran del bestiario: eran de mi arnés.** El
almacén tiene **una** pelea repetida —la del 15 de agosto a las 14:34:53, con
`Cleric of Innoruuk ×2` y `a forsaken revenant` dentro— que `FightStore.load`
descarta al cargar. Mi comprobación contaba líneas del fichero; el bestiario
cuenta peleas cargadas. **El bestiario tenía razón y el instrumento no.**

> **CORREGIDO el 16 de agosto por la noche.** Aquí decía **«90 repetidas, el 6 %
> de las líneas del almacén»**. Falso, y por la misma raíz que todo lo demás de
> hoy: agrupé por `(at, total, duration)` leyendo `at` **del registro completo de
> la pelea, donde ese campo no existe** —vive en el índice—, así que todas las
> claves empezaban por `undefined` y peleas distintas con el mismo total y la
> misma duración colisionaban. Contado sobre el índice, que es donde `at` está:
> **1.547 entradas, 1.546 claves únicas, UNA repetida.** El detalle en
> [`HALLAZGOS.md` §2.6](HALLAZGOS.md).

**Lo que queda dicho, y es la ley 5 entera:** un agregado que se acumula aparte
**no se cura solo**, ni siquiera cuando el fallo que lo torció ya está arreglado.
Y **el bestiario es un SUELO, no un censo, y hoy no lo dice en ninguna parte.**

---

#### Ley 9 · Una sola base de tiempo por gráfico

> **One time base per chart.** *A curve's vertices, markers, axis and hover inverse
> all read ONE `{t0, t1, bucketMs}`; samples anchor at bucket centres.*

**QUÉ DICE.** Todo lo que se dibuja sobre un eje de tiempo —vértices, marcas, eje y
la inversa del ratón— tiene que leer **el mismo** `{t0, t1, cubo}`. Su cicatriz está
escrita entera en §14.1: mezclaron un mapeo **por fracción de índice** para los
vértices con uno **por fracción de tiempo** para las marcas, y las marcas se
estiraban **un cubo entero en el borde derecho**; y una ventana medida en reloj de
pared las hacía *nadar* contra una curva quieta en cada tic. La frase que lo cierra
es suya: *«Canvas is never the answer to arithmetic disagreement.»*

**LA PREGUNTA A NUESTRO LOG: no la tiene — es una pregunta a nuestro DIBUJO, y está
CONTESTADA leyendo el código.** Hoy tenemos una sola superficie con eje de tiempo,
la pista de estados del reproductor, y **cumple**: barras (`barrasDePista`), marcas
(`marcasDePista`) y hallazgos pasan los tres por **`posEnTiempo(s, duracion)` de
`ui/tiempo.js`**, una función y un sitio.

**LA SALVEDAD QUE SÍ HAY, y es pequeña:** las barras y las marcas convierten esa
fracción a **píxeles** con el ancho medido (`getBoundingClientRect`), y la fila de
hallazgos la convierte a **por ciento**. Es la misma base de tiempo en dos
unidades, y sólo coinciden mientras los dos contenedores midan lo mismo. **No hay
desacuerdo hoy; hay una segunda unidad que puede crearlo.**

**Y DONDE VA A MORDER ES EN EL GRÁFICO DE DPS QUE NO EXISTE TODAVÍA** — por eso
esta ley tiene apartado propio en §14.5, con el aviso concreto sobre la maqueta.

---

#### Ley 10 · Los intervalos revisables se unen AL LEER; nada estampa sus identificadores

> **Reviewable intervals merge at READ time; nothing stamps their ids.**

**QUÉ DICE.** Cuando algo tiene una duración —un buff, un encanto, un tramo de
postura— **no se le pone un identificador y se guarda**: se guardan los sucesos y
los intervalos se componen **cada vez que se leen**. Un identificador estampado es
una decisión congelada, y lo que decidió puede cambiar debajo.

**QUÉ NOS TOCA, Y AQUÍ HAY UNA CICATRIZ NUESTRA QUE ENCAJA EXACTA.** Es la de los
**tramos** de la lista de las once familias: `tramos.ndjson` casaba con la pelea
**por la HORA**, que es un identificador estampado con otro nombre. El argumento
era «la hora no se mueve» — y es verdad, pero **la pelea de debajo sí**: sobrevivía
a las reconstrucciones y seguía estampando lo suyo sobre otra cosa. Salió una pelea
impecable rotulada como excepción y una entrada huérfana apuntando a un inicio que
ya no existía. Se cerró **casando también por CONTENIDO**, que es unir al leer.

**LA PREGUNTA A NUESTRO LOG: ¿qué otros intervalos nuestros llevan identificador
estampado? CONTESTADA A MEDIAS, leyendo.** Los intervalos que hoy calculamos
—ventanas de encanto (`charmed`), tramos de postura (`stanceSpans`), tramos sin
control (`sinControl`), tramos de la pista (`tramosDePista`)— **se componen todos
al leer, ninguno se persiste con identificador propio**. Cumplimos.

**PENDIENTE, y es la parte que sí puede morder:** las **anotaciones a mano** —los
tríos, las dudas, los tramos— son exactamente lo contrario, y tienen que serlo:
son declaraciones de Miguel y no se pueden recomponer leyendo. La regla que nos
falta escribir no es «no estampar» sino **«lo declarado se estampa y se casa por
contenido; lo derivado no se estampa nunca»**, y hoy eso vive como cicatriz de un
fallo concreto y no como regla.

## 19. Lo que este pase arregló en nuestro código

> **Las mediciones, en [`HALLAZGOS.md` §2](HALLAZGOS.md).**

- **El reproductor tenía su propia definición de pelea**, más floja que la del
  motor. Corregido llamando a la misma guarda: el combate ajeno dibujado pasa
  de 446 peleas a 190, y el combate ENTRE ajenos de 49 a **cero**.
- **Todas las figuras se apagaban en el segundo cero** por una resta de más que
  un `Math.max(0, …)` convertía en un dato creíble: 4.310 caídas de 4.573, en
  el 79,9 % de las peleas.
- **El plegado de la mayúscula vivía en seis sitios** y ahora en uno
  (`src/nombres.js`).

De ahí salen tres de las catorce familias de `ui/app.js`: la regla de la
puerta, el número desnudo y la pinza sobre un imposible.

## 20. Reaparición

> **La medición entera, su código y las tres preguntas, en
> [`HALLAZGOS.md` §3](HALLAZGOS.md).**

**Lo que hay que saber de ellos:** su `respawn.ts` (1.242 líneas) **no es una
tabla**. Es una escalera de tres peldaños —tu número, tus muertes, la wiki—,
con el mínimo y no la media, la wiki como **suelo** contra los puntos de
aparición duplicados, seguimiento **opt-in por bicho**, y «visto» separado de
«ha aparecido». **No modela placeholders, ni repoblación de zona, ni varianza.**

**Y su fuente es `eqlwiki.com`, con `scrapedAt`,** granularidad **por nombre y
sin zona**: cubre **46 de los 441 nombres** que Miguel mata (10,4 %).

## 21. Lo que sigue sin leer

- **Las SUPERFICIES de reaparición** — `RespawnOverlay.tsx` (22.323),
  `RespawnRowBar.tsx` (21.523), `RespawnEditDialog.tsx` (9.779)— y sus cinco
  baterías de pruebas. El modelo sí está leído (§20.5): `shared/respawn.ts`,
  `main/modules/respawn.ts`, `shared/respawnWiki.ts` y `data/respawns.json`.
- **La telemetría** (`shared/telemetry.ts` 1.037 + `telemetryRollup.ts` 837 +
  `TELEMETRY.md`). Es un asunto entero con implicaciones que no son técnicas.
- **Su aparato de ventanas** (`main/windows.ts` 1.049) más allá de las cinco
  decisiones de overlay que ya se citaron en §7.
- **`procWindows.ts` (759) y `procDetect.ts` (523)**: se ha leído cómo se divide una
  tasa, no cómo se detecta un proc.
- **Los 424 commits restantes** de los 469 sin clasificar.

**Y una salvedad de método sobre todo este pase:** los repos siguen avanzando.
jmoyers estaba en `a61efb3` (14 de agosto) y sowoky en `877636a` (15 de agosto)
cuando se leyeron. Nada de aquí se ha vuelto a comprobar contra su HEAD de hoy.

