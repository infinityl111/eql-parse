# Archivo del estudio

**Dos partes, y contestan cosas distintas:**

- **Parte I — por qué creímos otra cosa.** Las correcciones, enteras: la cifra
  mala escrita, el motivo por el que la creímos y lo que la tumbó.
- **Parte II — el primer pase, entero.** El recorrido por sus commits, sus
  incidencias una a una y las secciones que contaban *qué tienen* con todo el
  detalle.

---

# Parte I — por qué creímos otra cosa

**Este fichero guarda las correcciones del estudio, enteras.**
[`ESTUDIO-COMPETIDORES.md`](ESTUDIO-COMPETIDORES.md) dice **lo que es verdad hoy**;
aquí está **por qué creímos otra cosa**, con la cifra mala escrita, el motivo por
el que la creímos y lo que la tumbó.

**No es un cementerio de erratas.** Todas las correcciones de este proyecto tienen
la misma forma —un número plausible, en su sitio, con su formato correcto,
describiendo algo que no había pasado— y esa forma es más útil que cualquiera de
los números. Por eso el documento vivo conserva **la marca** de que allí hubo un
error, con la fecha y el enlace, y no la borra: quien lea el apartado tiene que
saber que ese sitio ya engañó una vez.

**La regla de esta pareja de ficheros:**

> **LA MARCA SE QUEDA, LA HISTORIA SE MUDA.**
> En el documento vivo, una línea: «corregido el *día*, ver archivo». Aquí, el
> relato entero. Mover la marca también sería borrarla, sólo que con otro nombre.

**Cómo se añade una entrada.** Cuando una cifra del estudio se corrige: (1) en el
documento vivo se sustituye la cifra por la buena y se deja una cita en bloque de
tres o cuatro líneas con la fecha y el enlace a la sección de aquí; (2) aquí se
abre una sección `§An` con **lo que decía**, **por qué lo creímos**, **qué lo
tumbó** y **qué es verdad hoy**. La cifra mala se escribe **literal**: una
corrección que no repite el número malo no se puede comprobar.

---

## A1 · La pelea del 11 de agosto: 1.356 sucesos, 13.149 de daño, corte en +68 s

**Corregido el 15 de agosto de 2026.** Vive en
[`ESTUDIO-COMPETIDORES.md` §3.1](ESTUDIO-COMPETIDORES.md), *«Lo que sí queda, y no
es un umbral»*.

### Lo que decía

> La mayor de las tres peleas que un mez sobre una mascota enemiga mantiene
> unidas, la del 11 de agosto a las 11:26:24, tiene **1.356 sucesos y 13.149 de
> daño**, y **sin el sostén el plazo la habría cortado en +68 s**.

### Por qué lo creímos

Dos motivos, y los dos son la undécima familia —*la medición no era independiente
de lo medido*—:

1. **El arnés apuntaba la hora de CADA evento tras alimentarlo al rastreador**,
   incluidos los que el propio rastreador RECHAZA por irrelevantes. Así que la
   cuenta de sucesos y el total de daño incluían **combate ajeno** que ocurría en
   los mismos segundos y que la pelea nunca contuvo.
2. **El «+68 s» salía de leer el campo `sostenes`** y suponer que anotar un sostén
   prueba que la pelea se habría cerrado sin él. **No lo prueba:** `#sigueAbierta`
   devuelve en cuanto encuentra UNA ventana abierta, así que un sostén anotado no
   dice nada sobre las demás ventanas — otro enemigo pudo mantenerla abierta
   igual. Se le estaba preguntando al mecanismo por su propia obra.

### Qué lo tumbó

La **partición diferencial**: partir el registro dos veces, **con** el camino del
sostén y **sin** él, y restar. No se le pregunta al sostén: se corre el mundo con
él y sin él.

### Qué es verdad hoy

Sin el sostén serían **tres peleas**, cortadas en **+308 s** y **+421 s**:

| tramo | sucesos | daño | nombres | exclusivos suyos |
|---|---:|---:|---:|---|
| A +0–308 s | 1.105 | 9.548 | 6 | `a tsu ghoul wizard`, **su mascota**, `Garobab` |
| B +308–421 s | 542 | 5.839 | 6 | `a vis ghoul knight`, `Rolendor` |
| C +421–475 s | 356 | 3.955 | 7 | `a zol ghoul knight`, `a basalt gargoyle`, `a wan ghoul knight` |

Y el sostén, medido igual, cambia **44 fronteras de 1.571**.

### Lo que se aprendió, que vale más que las cifras

> **PARA SABER QUÉ HACE UNA REGLA, CORRE EL MUNDO CON ELLA Y SIN ELLA.
> NUNCA LE PREGUNTES A LA REGLA.**

Escrita como antídoto en positivo junto a la undécima familia en `ui/app.js`.

---

## A2 · Diez bloques de código ajeno pegados, bajo una línea que decía que no había ninguno

**Corregido el 15 de agosto de 2026.** Vive en
[`ESTUDIO-COMPETIDORES.md`](ESTUDIO-COMPETIDORES.md), *Método y límites*.

### Lo que decía

La línea del método afirmaba, literalmente, **«ni una línea de su código en este
fichero»** — y al mismo tiempo el documento contenía **diez bloques ejecutables
suyos pegados literalmente**:

el normalizador de clave de jmoyers · el plegado de mayúscula de sowoky · su
guarda barata de líneas de combate · el bloque de ticks de veneno · el bucle de
presencia hostil · las cinco constantes de encuentro · la lista de overlays · la
constante de inactividad · su barrido de cierre.

### Por qué lo creímos

Porque la afirmación se escribió como **intención** y nunca se comprobó como
**hecho**. Es la forma exacta de la salida muerta: algo escrito con toda la buena
fe, correcto el día que se escribió, que deja de serlo debajo sin que nada avise.
Nadie contó los bloques porque la línea ya decía cuántos había.

### Qué lo tumbó

Contarlos. No hay más método: **una afirmación sobre un fichero se comprueba
abriendo el fichero.**

### Por qué era urgente y no cosmético

**§0 del estudio:** ninguno de los dos competidores es MIT. jmoyers es FSL-1.1-MIT
—uso restringido a un «Permitted Purpose» que excluye competir con el
licenciante— y sowoky es **AGPL-3.0**, copyleft fuerte: cualquier trozo suyo dentro
de EQL Parse arrastraría a EQL Parse entero a la AGPL.

El caso urgente era **el plegado de mayúscula de sowoky**, que es AGPL y es
exactamente la pieza que íbamos a escribir nosotros: mientras su fuente estuviera
en nuestro documento, **no podríamos afirmar que la nuestra sale de la medición**.

### Qué es verdad hoy

Los diez están sustituidos por descripciones nuestras. **Los valores y los nombres
de constante se quedan, porque son hechos** y un hecho no tiene licencia. Las
citas de prosa se quedan, acortadas a la frase que sostiene el argumento, con su
fichero y su línea: son razonamiento de diseño citado para comentarlo, y ninguna
supera las 51 palabras.

---

## A3 · X→X delataba 69 gemelos que nuestro suelo no tenía

**Corregido el 16 de agosto de 2026 por la tarde.** Vive en
[`HALLAZGOS.md` §1.2](HALLAZGOS.md).

### Lo que decía

| detector | disparos | ya lo sabía el suelo | **ganancia** |
|---|---:|---:|---:|
| contradicción del encanto | 6 | 5 | **1** |
| contradicción del propio nombre (X→X) | **109** | **40** | **69** |
| tick de veneno repetido (sowoky) | 12 | 12 | **0** |

> *«El de X→X, que era una nota al pie, delata **69 nombres** que el suelo no
> tenía: 52 nombres distintos, encabezados por `a shin ghoul knight` (10 peleas),
> `an ire ghast` (6) y `a dar ghoul knight` (5). […] el detector que vale aquí es
> el que no venía del competidor grande sino del pequeño y por otro camino.»*

Y de ahí salió la propuesta —mía— de **meter X→X en el suelo**, con el argumento
de que era «la única de las tres formas que aporta algo».

### Por qué lo creímos

**El arnés daba por miembro de una pelea a cualquier nombre que cayera dentro de
su ventana de tiempo.** El registro de EQ trae el combate de TODO EL MUNDO: si
otro jugador está matando `a shin ghoul knight` a diez metros mientras tú peleas,
sus líneas caen dentro de tus segundos.

Y entonces la cuenta se hace sola y sale preciosa: ese nombre **dispara X→X** —dos
de ellos se están pegando de verdad— y **nuestro suelo no lo tiene**, porque
nuestro suelo sólo cuenta muertes de nuestras peleas y ese bicho no es nuestro.
Cada pelea ajena que pasaba cerca aportaba «ganancia».

**Es exactamente el mismo fallo que `src/guion.js` tenía a la vez y que se
arregló el mismo día: una ventana de tiempo usada como si fuera una lista de
pertenencia.** Que apareciera dos veces en dos sitios distintos el mismo día es
lo que hace que merezca estar escrito.

### Qué lo tumbó

Poner el control que faltaba: **un disparo sólo cuenta si el bicho está en la
tabla de una pelea NUESTRA**. De los 411 disparos del registro, **237 caen en
bichos que no están en ninguna pelea nuestra**. Son hechos del mundo perfectamente
ciertos y **no pueden subir un suelo que no los cuenta**.

Y un segundo control, sobre el mecanismo: **la misma forma la escribe la
autolesión**. `You hit yourself for 6 points of magic damage by Lifedraw.` y
`Kibarer hit Kibarer for 6 points of magic damage by Lifespike.` son la misma
línea; **el pronombre sólo se escribe cuando el sujeto eres tú**. El reflejo del
jugador se había cazado en la primera medición porque el jugador era yo — el de
cualquier otro entraba intacto.

### Qué es verdad hoy

**La ganancia de X→X sobre este registro es 1**, no 69: `a dread skeleton`, el 10
de agosto a las 13:48. De los 4 pares que quedaban tras el control de pertenencia,
tres eran nombres sin una sola línea de melé que los respaldara.

**X→X no entra en el suelo.** Y con ello se cae también la frase de que «el
detector que vale es el del competidor pequeño»: **ninguno de los tres aporta
nada** sobre este registro.

### Lo que se aprendió

Que la undécima familia no tiene una sola forma: aquí el instrumento no estaba
hecho de la pieza juzgada, **estaba midiendo sobre una población que incluía lo
que no era nuestro**. La invariante que lo habría cazado en el sitio: *un gemelo
que sube nuestro suelo tiene que ser un bicho que aparece en nuestra tabla.*

---

## A4 · El reproductor: 1.257 peleas con ajenos y 184 con combate ajeno dentro

**Corregido el 16 de agosto de 2026 por la tarde.** Vive en `src/relevancia.js`,
`src/guion.js` y `test/ajenos.js`, y en el mensaje del commit `0264c09`.

### Lo que decía

> Sobre las **1.561** peleas con combatientes del registro de referencia:
> con actores AJENOS dentro de la ventana **1.257 (80,5 %)**; y en las que esos
> ajenos SE PEGAN, **184 (11,8 %)**.
> La peor —**11 de agosto, 17:34:32**— es una pelea de **98 s** con tres
> combatientes de verdad, **once** actores ajenos y **495** golpes entre ellos
> dentro. El reproductor dibujaba **catorce** figuras donde hubo tres.

Y en el commit del arreglo, una columna «después» de **201 (12,8 %)** y **0**.

### Por qué lo creímos

**Porque el «antes» y el «después» se midieron con arneses distintos, y eso no se
ve al leer una tabla de dos columnas.** El «después» sí ejecutaba el código: por
eso el 201 (12,8 %) reproduce hoy sin tocar nada. El «antes» **no ejecutaba el
`guion.js` viejo**: contaba nombres que aparecían en la ventana de tiempo, que es
una población mucho mayor que la de las figuras que el reproductor llegaba a
dibujar.

Y la etiqueta de la segunda fila estaba puesta sobre otra cosa: **«...y esos
ajenos SE PEGAN» describe combate entre dos ajenos, pero el 184 contaba peleas con
algún golpe que TOCA a un ajeno** —lo cual incluye a un sanador legítimo o a
alguien que ayuda con tu bicho—.

**Dos columnas de una tabla comparativa tienen que salir del mismo instrumento.
Si no, no es una diferencia: son dos números.**

### Qué lo tumbó

Ejecutar el `guion.js` anterior al arreglo —sacado literalmente de `git show
8936716:src/guion.js`— y el de hoy, **sobre el mismo almacén y el mismo
registro**, contando en los dos casos **las figuras que el reproductor devuelve**.

### Qué es verdad hoy

Medido el 16 de agosto sobre el almacén de Miguel —**1.493** peleas con
combatientes— y `eqlog_Campeon_erudin.txt` (985.189 líneas con cabecera):

| | SIN la guarda | CON la guarda |
|---|---:|---:|
| peleas con alguna figura AJENA dibujada | **446 (29,9 %)** | **190 (12,7 %)** |
| ...con algún golpe que TOCA a un ajeno | 156 (10,4 %) | — |
| ...con combate ENTRE dos ajenos | **49 (3,3 %)** | **0 (0,0 %)** |

Repetido sobre un almacén reconstruido ese mismo día desde ese mismo registro
(1.504 peleas): **463 (30,8 %) → 203 (13,5 %)**, y **49 → 0**. Las dos cuentas
coinciden, que es lo que se le pide a una medición.

**Y la pelea peor es la misma, con otra hora y otras cifras:** **11 de agosto,
19:34:32 HORA LOCAL** —el «17:34:32» era esa hora en UTC—, **99 s**, tres
combatientes (`Campeon`, `Vobn`, `a rock golem`). El reproductor dibujaba **TRECE**
figuras: **diez** ajenas, de dos combates distintos, con **468** golpes entre
ellas. Hoy dibuja **tres**.

### Lo que se aprendió

Que **el arreglo era bueno y la medición que lo justificaba, no**. El fallo
existía, la regla que lo cierra es correcta y el «después» de cero se sostiene;
lo que no se sostenía era el tamaño del agujero. **Un arreglo correcto defendido
con una cifra inflada es un arreglo que no se puede volver a revisar**, porque el
día que alguien remida va a encontrar que el 80,5 % no estaba y va a dudar de todo
lo demás.

Y una segunda, pequeña y cara: **una hora citada sin zona no sirve para encontrar
nada.** El registro va en hora local, la lista de peleas también, y una hora en
UTC en la prosa manda a buscar una pelea que a esa hora no existe.

---

## A5 · «El suelo del reproductor compara epoch contra segundos de pelea»

**Corregido el 16 de agosto de 2026 por la noche, el mismo día que se escribió.**
Vive en [`HALLAZGOS.md` §2.2](HALLAZGOS.md).

### Lo que decía

> `src/guion.js` le pasa a `suelosDe` los instantes de muerte en **segundos
> epoch** y la actividad en **segundos de pelea**. La comparación que decide el
> «+1» es **47 > 1.785.835.073**: siempre falsa. La rama **no se ha ejecutado
> nunca**. Medido: **cambian 2.121 figuras en 1.303 peleas de 1.493** — el 87 %.

### Por qué lo creí

**Por la línea de al lado.** `a.caidas` hacía `Math.round(t - inicio)` sobre esos
mismos instantes, y restarle el inicio a algo **sólo tiene sentido si ese algo es
absoluto**. De ahí deduje que `killTimes.t` venía en epoch, y todo lo demás salió
solo y encajaba perfectamente: la comparación imposible, la rama muerta, el
síntoma invisible.

**Y no lo comprobé abriendo el dato.** `killTimes.t` se escribe en
`src/engine.js:1251` como `Math.round(k.t - enc.start)` — **ya es relativo**— y
`ui/grafica.js` lo consume tal cual. Dos sitios lo decían. Bastaba con imprimir un
`killTimes` y mirarlo: `[{"name":"Slizik the Mighty","t":107}]`.

### Qué lo tumbó

**Una figura que no podía tener dos.** El arnés dijo que
`Slizik the Mighty` —un jefe único, con nombre propio— pasaba de 1 figura a 2. Un
segundo Slizik no existe. Fui a las líneas del registro y su última acción es del
segundo 106, un segundo antes de morir: no había ninguna actividad posterior que
justificara el «+1». **La imposibilidad delató al instrumento, igual que el hueco
de 35.399 s dentro de una pelea de 50.**

### Y el arnés tenía mi propio error dentro

Esto es lo que hace que la entrada valga. **El arnés que escribí para medir el
fallo hacía la misma resta de más que el código que juzgaba**: convertía
`killTimes` restándole el inicio, obtenía negativos enormes, los aplanaba a cero
con `Math.max(0, …)` y entonces **toda actividad posterior al segundo 0 contaba**.
De ahí el 87 %.

**Es la undécima familia otra vez, en su forma más difícil de ver:** el
instrumento no estaba hecho de la pieza juzgada —eso ya lo vigilábamos— sino de
**la misma suposición** que el código juzgado. Escribí el arnés después de leer
`guion.js`, y arrastré su premisa.

> **UNA MEDICIÓN QUE CONFIRMA EL DIAGNÓSTICO QUE LA ENCARGÓ NO ES UNA
> CONFIRMACIÓN.** Si el diagnóstico salió de leer el código y el arnés se escribe
> a continuación, los dos comparten lo único que había que poner a prueba.

### Qué es verdad hoy

**El fallo existía, era otro y era peor.** La resta de más no estaba en la
comparación del suelo: estaba en `caidas`, y el `Math.max(0, …)` la convertía en
**cero**. **Todas las figuras se apagaban en el segundo cero de la reproducción.**

| | |
|---|---:|
| caídas dibujadas | 4.573 |
| ...que salían en el segundo 0 sin serlo | **4.310 (94,2 %)** |
| peleas afectadas | **1.193 de 1.493 (79,9 %)** |

Y el «+1 por actividad» **sí funcionaba**; lo que estaba mal era su definición de
actividad —valía con que a uno lo nombraran—, y eso se ha cerrado aparte con la
regla del sujeto: de 72 figuras extra a **64**.

### Lo que se aprendió, y ya está escrito como regla

`Math.max(0, …)` sobre una magnitud que no debería poder ser negativa **no
protege: borra la prueba**. Un número de once cifras negativo es un grito; un cero
es un dato plausible. Va con la duodécima familia —*un número desnudo no cruza una
frontera*— en `ui/app.js`.

---

# Parte II — el primer pase, entero

**Esto es «cómo llegamos aquí».** El recorrido por los 1.109 commits de
jmoyers, sus incidencias una a una, y las secciones del primer estudio que
contaban *qué tienen* con todo el detalle. Lo que de ahí sigue siendo verdad
hoy vive en [`ESTUDIO-COMPETIDORES.md`](ESTUDIO-COMPETIDORES.md), resumido a
su hallazgo; aquí está entero, con las citas y las tablas.

**Nada de esto está desmentido.** Se mudó porque responde a una pregunta
distinta: el documento vivo contesta *qué es verdad y qué está abierto*, y
esto contesta *de dónde salió*.

---

## 1. Las tres fuentes, y qué vale cada una


### 1.1 El historial de commits: el diario de qué se rompió, con fecha

jmoyers lleva **1.109 commits en once días**, del 4 al 14 de agosto:

```
24  2026-08-04     192  2026-08-09     128  2026-08-12
111 2026-08-05     113  2026-08-10     150  2026-08-13
109 2026-08-06     100  2026-08-11      61  2026-08-14
31  2026-08-07      90  2026-08-08
```

sowoky lleva 45, casi todos de publicación de versión.

Clasifiqué los 815 commits de trabajo de jmoyers (fuera los 294 `Merge JOS-nnn`,
que repiten el asunto de la rama) por palabras clave en el asunto. **Es un suelo,
no un censo**: sus asuntos son prosa, y 469 no casan con ninguna familia.

```
  86  ventanas y overlays
  82  atribución: de quién es el daño (mascota, encanto, ajenos)
  72  datos consultados (wiki, catálogos, imágenes)
  51  reglas de línea / parser
  47  buffs, mez, temporizadores
  40  rendimiento y arranque
  22  actualizador, instalación, plataformas
   7  frontera de pelea / segmentación
   7  persistencia / migración
   4  muerte y su evidencia
   1  identidad de nombres / gemelos
```

**La lectura que importa: la atribución cuesta más que el parseo.** «De quién es
este daño» (82) supera a «qué dice esta línea» (51). La frontera de pelea sale a
7 — no porque sea fácil, sino porque la resolvieron pronto y no volvieron.

Ejemplos, con su fecha y su asunto literal:

| fecha | asunto | de qué habla |
|---|---|---|
| 2026-08-04 | `Charm ownership: a broadcast is not a deed — the stranger's pet leaves your meter` | un anuncio de encanto no prueba que la mascota sea tuya |
| 2026-08-06 | `JOS-54: one pet at a time — re-summoning retires the animation you had` | invocar retira la anterior |
| 2026-08-07 | `JOS-88: a death with no killer is still a death` | `You died.` sin matador |
| 2026-08-08 | `JOS-101: the killerless mob death, and Phinigel joins the roster` | `<Nombre> died.` |
| 2026-08-09 | `JOS-156: the 0.16.0 notes say death and absence both end a bar` | **la muerte y la ausencia cierran las dos** |
| 2026-08-09 | `JOS-176: a mez hold dies with the mob that held it, and never lands on your pet` | el mez retirado deja de sostener |
| 2026-08-12 | `JOS-270: an ally's pet ends the way the evidence says it should, not the way it was bound` | la evidencia manda sobre el vínculo |
| 2026-08-14 | `JOS-349: the pet stays parsed - a lost subject token cost a shaman his whole pet` | un token perdido borró una mascota entera |
| 2026-08-14 | `JOS-350: the mob page joins its own kills, through the ONE mob key` | una sola clave de nombre |

`JOS-350` es literalmente nuestro `src/suelo.js`: dos sitios contando lo mismo,
unificados en una clave.

### 1.2 Las incidencias

**No son la misma cosa en los dos repos, y conviene saberlo antes de leerlas.**

**jmoyers: 11 incidencias, escritas por usuarios reales.** Reparto: 3 abiertas,
8 cerradas. Lo que reportan:

- `#11` (2026-08-05) — «*just installed this while I was on my level 50 loadout
  and it is incorrectly identifying my level/class even after combat. I'm
  assuming it is just looking for most recent level gain text*». El usuario
  enumera las salidas del juego que darían el dato bien: `/who`,
  `/alternateadv list`, `/output inventory`, `/output faction`,
  `/output achievements`. Respuesta del autor: *«anything that can reinforce what
  is there and then be kept up real-time, i will build in as first class.
  anything that requires user to do repeated intervention […] i will prob
  deprioritize»*. **Es exactamente nuestra medición del `/outputfile`: 60 de 81
  no aparecen en el registro.** Un usuario llegó a la misma conclusión desde el
  otro lado.
- `#13` — falta un hechizo concreto en la lista de alarmas (*Spirit of the Puma*),
  y añadirlo a mano no funciona.
- `#15` — los *lull* se quedan a 0 s en el overlay de buffs y no se van.
- `#25`, `#26`, `#28` — Linux, Umu launcher, Crossover en Mac: la ventana sale
  recortada por arriba, o sale sólo la barra de título.
- `#29` — el actualizador falla. El usuario, sueco, sospecha del separador
  decimal de su *locale*. **No lo era**: era una respuesta vacía o parcial de
  GitHub que el updater trataba como error de JSON.
- `#27`, `#30` — cosas de Plane of Sky.

**Reparto por materia: 5 de 11 son de ventana o plataforma** (`#25`, `#26`, `#28`
de plataforma; `#14` y `#22`, controles que se solapan en resoluciones
estrechas), **1 de actualizador** (`#29`), **2 de que a un dato le falta una
fuente** (`#11`, `#27`), **1 de un temporizador que no se limpia** (`#15`) **y 2
de contenido** (`#13`, `#30`).

Ni una sola incidencia de usuario sobre atribución de daño, sobre
homónimos o sobre dónde empieza una pelea. Los usuarios reportan lo que **ven**;
lo que se calcula mal en silencio no lo reporta nadie. Es la frase de este
proyecto entera: *un número más bajo no se distingue de un número correcto.*

**sowoky: 13 incidencias, todas abiertas, todas del 14 de agosto, todas
autoauditorías.** No son reportes de usuario: son hallazgos escritos con
fichero, línea, entrelazado paso a paso y esbozo de arreglo. Como corpus de
fallos de este dominio valen muchísimo, y tres tocan cosas nuestras:

- **`#13` — atribución de mascota con gemela homónima.** *«a same-named twin
  pet's death cuts YOUR pet's claim (held-span protection only covers charms)»*.
  El motor ya sabe que existen gemelos y **ya se protege contra ellos para los
  encantos**: una línea de primera persona («*your charm has worn off*») crea un
  `held` span, y dentro de él se suprimen las fronteras ambiguas —«murió», «me
  pegó»—. La incidencia dice que esa protección **no cubre las mascotas
  invocadas**, que se reclaman por la vía de los *tells*. Y lo enuncia así:

  > *the documented Innoruuk`s Chosen case, where **proof outranks inference***

  Eso es, palabra por palabra, nuestra `identidad-declarada-gana`. Dos
  implementaciones independientes han llegado al mismo principio y le han puesto
  casi el mismo nombre.

- **`#9` — doble conteo de muertes.** Cuando el fichero encoge, `main.js:294-299`
  reinicia el offset a 0 *alegando* que la marca de agua evita recontar; pero los
  bytes releídos entran por el camino en vivo, y ese camino desactiva la marca a
  propósito (`renderer/app.js:279-284`, `{ hwm: false }`). *«The invariant is not
  honored on exactly the path that cites it.»* **Es nuestra familia: la regla
  puesta en un sitio y no en el otro.**

- **`#5` — el volcado de inventario destruye lo saqueado entre que se escribe y
  que llega.** El manejador hace `LIVE_HAVE = new Map()` sin comparar contra
  `mtime`, y el sondeo tarda hasta 3 s. Lo notable: *«the inverse skew IS handled
  elsewhere — `deliveredAfter(INV.mtime)` at `app.js:1995`»*. **El peligro se
  conocía en una dirección y se pasó por alto en la otra.** Misma familia otra
  vez.

### 1.3 El código

Lo que sigue.

---

## 2. El parser


### 2.1 Cómo escriben las reglas

**jmoyers — cascada de clasificadores tipados.**

`src/main/log/parseCommon.ts:1-8`:

> *The single parse pass is a CASCADE of per-family classifiers whose ORDER IS
> SEMANTIC (e.g. the resist family must test the possessive-YOUR form before the
> named-caster form because 712 spell names contain `'s`).*

Cada clasificador es `(ClassifyCtx) => LogEvent | null` puro
(`parseCommon.ts:26`), y `parser.ts` tiene la única lista ordenada. Son **41
clasificadores** repartidos en 10 ficheros (`parseCombat.ts`, `parseCasts.ts`,
`parseWorld.ts`, `parseWho.ts`, `parseGroup.ts`, `parseAcquire.ts`,
`parseSession.ts`…) y **88 constantes `*_RE`**, con 78 regex ancladas en `^`.

La salida es una unión discriminada declarada en `src/shared/logEvents.ts` (1.480
líneas). La cabecera del fichero (`logEvents.ts:1-6`):

> *ONE parse pass over the EQ Legends log produces this discriminated union […]
> every consumer subscribes to the stream instead of running its own regexes.
> Keep this pure and serializable — no behavior, just data.*

**sowoky — un objeto `RX` con 55 expresiones**, probadas en un orden explícito
(`engine.js:190`), y una guarda barata delante:

una sola expresión (`COMBATISH`, `engine.js:193`) que exige que la línea
contenga una de seis marcas —«points of … damage», «has taken N damage»,
«healed … for N», «has been slain», «You have slain», o un «, but …» seguido de
un verbo de evasión a menos de 60 caracteres— antes de probar ninguna de las 55.

`engine.js:184` documenta el orden: *«most frequent first; you_slain before
slain_by, youdied before died»*.

**Nosotros — 149 reglas indexadas por 123 pistas de subcadena**
(`src/patterns.js`, `src/parser.js:202`). El reparto por `kind`:

```
noise:42  survival:10  chat:10  loot:8  dot:4  cast:4  death:4  buff_land:4
stun:3  mez:3  spell:2  melee:2  miss:2  crit:2  heal:2  cast_recover:2
control:2  buff_fade:2  stance:2  invocation:2  memorize:2  root:2
+ 32 kinds con una regla cada uno
```

Los tres somos comparables en tamaño de gramática (149 / 88 / 55) y los tres
usamos el mismo truco de coste: una prueba barata de subcadena antes de la
regex. Nadie ha encontrado un atajo que los otros no tengan.

### 2.2 La trampa de la mayúscula al abrir frase

Los tres la vimos. **Los tres la resolvemos distinto, y el tercero es el mejor.**

**jmoyers — minúsculas totales, y sólo para la clave.** `parseCommon.ts:37-45`:

`idKey(name)` recorta el nombre y lo pasa **entero a minúsculas**; las tres
formas de la primera persona —`you`, `yourself`, `your`— colapsan en una sola
clave. El comentario da el motivo con la misma observación que nosotros: las
líneas de encanto escriben el artículo en minúscula y las de daño lo
capitalizan, así que una clave insensible a la caja es lo que hace estables las
búsquedas.

Y en `AGENTS.md:730` lo elevan a ley: **«Names are dirty; canonicalize at
boundaries, display raw.»** *Clave en minúsculas; se muestra el nombre crudo.*

**sowoky — plegado con prueba.** `engine.js:352-365`:

`foldCap(n)` baja la inicial **sólo si la variante en minúscula ya se ha visto**
en algún otro sitio del registro; si no, devuelve el nombre tal cual. El conjunto
`seenNames` se llena antes con todos los nombres que aparecen en cualquiera de
los seis campos de nombre de los eventos.

El razonamiento que dejan escrito al lado: «orc legionnaire» se imprime
capitalizado al abrir frase y en minúscula a mitad, que son dos filas para un
bicho; y **haber visto la minúscula es la prueba de que la mayúscula era de
frase**, porque un nombre propio nunca se imprime en minúscula.

**Nosotros — plegamos siempre, sin prueba, y el resultado se enseña.**
`src/suelo.js:56`:

```js
const n = String(bruto).charAt(0).toLowerCase() + String(bruto).slice(1);
```

y `src/engine.js:1291` usa esas claves **como rótulo visible** de la pelea.

**Medido sobre el registro de Miguel** (951.773 líneas; método: se recorre el log
con nuestro propio parser y se agrupan las víctimas de los eventos `death`):

```
víctimas distintas                                        472
con inicial mayúscula y sin artículo                      164
  ...con prueba de que la minúscula existe                 12   ← plegado correcto
  ...SIN esa prueba                                       152   ← plegado sin fundamento
```

Los 152 son nombres propios: `Lord Nagafen`, `Warlord Skarlon`, `King Tranix`,
`Master Yael`, `Magus Rokyl`, `Amygdalan warrior`, `Gorgalosk`. El rótulo que se
construya para ellos por esa vía dice *«lord Nagafen»*. La regla de sowoky —
plegar sólo si la minúscula se ha visto de verdad — habría acertado en los 164:
pliega los 12 y deja los 152 en paz. La de jmoyers también, por otra vía: separan
CLAVE de PRESENTACIÓN, y nosotros usamos la clave para las dos cosas.

**El fallo de fondo no es la mayúscula: es que la normalización de identidad se
está usando como texto de pantalla.** Es la familia de siempre vista desde otro
ángulo — un valor calculado para una pregunta, respondiendo otra.

### 2.3 Homónimos: tres respuestas distintas, todas medidas

**jmoyers — instancias con generación.** `src/main/combat/world.ts:1-14`:

> *The engine historically keyed everything by bare name. That collapses
> same-named twins […] the pet and the mob it tanks are indistinguishable.*

La salida: **cada aparición recibe una identidad de instancia propia**, formada
por la clave del nombre y un número de generación, de modo que los gemelos son
entidades separadas en la agregación y en el ciclo de vida del encanto.

Y una **tabla de decisiones de ciclo de vida** entera en el comentario
(`world.ts:16-98`), con esta declaración de sesgo:

> *all rules deterministic; ambiguity is flagged, never silently guessed toward
> the worse failure mode — a false pet-death drops all subsequent pet damage, so
> we bias AWAY from retiring the pet on ambiguity.*

Lo que **prueba** que hay una gemela (`world.ts:47-50`): daño tuyo hacia el
nombre mientras una instancia de ese nombre está encantada, **o** daño de ese
nombre hacia ese mismo nombre. Y en la muerte, cinco casos según quién mate
(`world.ts:60-79`), tres de ellos marcados como ambiguos, con la regla explícita:
*«When ambiguous and a twin exists we always keep the pet.»*

**sowoky — detección por ticks de veneno.** Esto no lo tenemos y es la idea más
bonita de todo el estudio. `engine.js:746-758`:

Cada tick de veneno se resume en una clave de tres partes —**segundo entero,
hechizo y lanzador**— y se guarda en un conjunto por pelea. Si la misma clave
llega dos veces, la pelea se marca (`dotStack`). El lanzador sale del propio
evento; la forma anónima, que no lo trae, agrupa todas juntas bajo una etiqueta
única.

El razonamiento: el veneno de un lanzador tiquea **una vez por tick y por
entidad**, así que dos ticks idénticos en el mismo segundo sobre un nombre
significan que hay dos bichos llevándolo, y que las sumas de esa pelea son una
mezcla de los dos.

Es un **detector de homónimos que no necesita ningún modelo de identidad**: sale
de una propiedad física del juego (un veneno tiquea una vez por tick por
entidad). Marca la pelea como `tainted` y el resumen por bicho decide qué se
cree. Y el sesgo está declarado: la forma anónima agrupa todas juntas, *«the
pessimistic side — it can over-flag, never silently trust a blended fight»*.

**Nosotros** — no distinguimos gemelos. Ponemos un **suelo** (`src/suelo.js`) y lo
decimos en pantalla: «al menos 3». Los tres enfoques responden a preguntas
distintas: jmoyers *quién es cada uno*, sowoky *¿me puedo fiar de esta suma?*,
nosotros *¿cuántos había como mínimo?*.

### 2.4 Muerte sin apertura, y muerte sin matador

`src/main/log/parseWorld.ts:132-156` es el trozo con más medición del repo:

una constante con el texto exacto `You died.`, comparada por **igualdad**, no
por expresión regular, y probada antes que ninguna otra forma que acabe en
«died.».

> *When the killing blow is a DoT tick (or anything else with no attacker to name),
> the client prints this instead of the slain sentence — same death, no killer.*

Medido sobre 1,11 millones de líneas: **23 muertes del jugador, 22 con frase de
«slain» y esta única línea**, así que entre las dos formas está el conjunto
entero.

Y el gemelo del bicho, `MOB_DIED_RE = /^(.+?) died\.$/` (`parseWorld.ts:156`):

Barrido de sólo lectura sobre 1,44 millones de líneas, el 8 de agosto: **21
líneas acaban en «died.»**, dos del jugador y **19 de nombres de bicho**.
**Ninguna de las 21** tiene una línea de «slain» a menos de tres líneas, así que
la forma nunca duplica una muerte ni la cuenta dos veces; **15 de las 19** llevan
la línea de experiencia justo delante. Y el dato que explica por qué esto costó
dos versiones:

> *The sibling log eqlog_Primitive_halas.txt has 0.*

Ese último dato —*el log hermano tiene cero*— es la razón de que a ellos les
costara dos versiones (`JOS-88` el 7 de agosto, `JOS-101` el 8). La forma no
aparece en todos los registros.

**Nosotros ya cubrimos las dos.** Medido sobre el registro de Miguel: **2 líneas
`<Nombre> died.` y 6 `You died.`, las 8 reconocidas, 0 en el cajón.** No es una
laguna nuestra, y conviene dejarlo escrito para que nadie «arregle» algo que ya
está.

**La forma que sí nos falta la tiene sowoky, y es la inversa:** una muerte que no
imprime ninguna línea de muerte. `engine.js:625-627`:

> *A kill prints a same-second burst of xp/coin/faction lines, often BEFORE its
> death line; the burst carries the kill's XP and coin. **A burst with no death
> line anywhere near it, right where a fight was active, is a silent kill.***

El código está en `engine.js:637-648` (agrupa xp/coin/faction en clusters con
ventana de 2 s, y marca `nearDeath`) y `engine.js:704-713` (un cluster sin muerte
cerca cierra la pelea abierta más reciente con `f.inferred = true`). **Marcado
como inferido, no mezclado con lo medido.**

Nosotros no leemos ninguna de las tres líneas de la ráfaga. **Medido: 9.965
líneas `Your faction standing with …` en el registro de Miguel caen enteras en
nuestro cajón.**

### 2.5 Mascotas y encanto

**jmoyers — tres señales, un solo sitio.** `AGENTS.md:749`, ley 4:

> *AND THE CLAIM IS WHAT TRIGGERS IT, NOT THE SUMMON (JOS-188): an upgraded pet
> is a new NAME; three lines produce the claim (tell / leader say / your own
> pet-only buff landing), all through one `bindPetClaim`, on purpose.*

Tres señales; **un solo punto de entrada, a propósito**. Nosotros tenemos las
mismas tres (`src/parser.js:237`: `My leader is <tú>`, `told you 'Attacking…
Master'`, tus propias órdenes) y también las metemos por un `#ownPet` único.
Convergencia limpia.

Y el invariante de una mascota a la vez está en los DOS modelos suyos, con
alcances distintos y a sabiendas (`AGENTS.md:744-753`):

> *enforced in TWO models with different reach, measured, not an oversight
> (JOS-54) […] the crossover is an unobserved shape and gets no invented rule —
> **awaiting-sample law**.*

Esa «*awaiting-sample law*» es nuestra regla —*una regla candidata que casa cero
veces en el registro no entra*— con otro nombre.

**sowoky — la señal de reclamo, y por qué es un `told you` y no un `says`.**
`engine.js:41-58`, uno de los comentarios mejor razonados que he leído en
cualquiera de los dos repos:

> *Past-tense "told you" is how the client prints an NPC-to-you tell; live players
> print present-tense ("tells you"), so a player can't produce this line.*

Y sólo se te enseñan los susurros de **tu propia** mascota. Los «says» no
reclaman nunca, con contraejemplo medido en su registro de referencia: un jugador
saludando a un NPC con la palabra «Master» dentro de la frase.

Y la corrección de un fallo suyo, dentro del mismo comentario: *«The name is
free-form ((.+?)) so a charmed mob's tells claim it too — the old `[A-Z][a-z]+`
capture silently missed every mob-named actor.»* Su captura de nombre asumía
nombre de jugador y perdía cualquier mascota con nombre de bicho.

**El encanto ajeno, y la negativa a adivinar.** `engine.js:413-422`:

> *the tell alone loses whole fights: a charmed mob only tells you [when
> ordered] […] more than one broadcast falls in the window, neither is
> [claimed]* — **el caso se RECHAZA en vez de adivinarse.**

`engine.js:492`: *«the window means a second charmer is in earshot and the log
cannot say [which]»*. Y jmoyers, desde su primer día (commit del 4 de agosto):
**«a broadcast is not a deed»**. Los dos llegaron a lo mismo: un anuncio público
de encanto no prueba de quién es la mascota.

**El compañero encantado.** El caso más caro que documenta jmoyers no es de
encanto sino de su primo — el sanador controlado mentalmente. `src/main/combat/state.ts:460-500`:

```
You hit Lord of Loathing for 941 points of unresistable damage by Harm Touch X.
Lord of Loathing has taken 509 damage from your Harm Touch X. (Critical)
Your life force drains away.
Lord of Loathing healed you for 509 hit points by Leech Touch I.
```

Su propio *lifetap* imprime «*<bicho> te curó*», y fichar a ese bicho como
jugador borraba todos los golpes de la mascota contra él a partir de ese
instante — **medido: 18 golpes, 398 puntos, en una sola mascota en un solo
pull.** La regla ancha y obvia («cualquier cosa que haya sido hostil») la miden
mal en el mismo corpus:

Un jefe controla mentalmente al sanador del propio jugador, así que **una línea de
ese sanador pegándote llega 27 segundos antes de otra curándote**: con la regla
ancha, un jugador de verdad habría vuelto al conjunto de hostiles. La frase con
la que lo zanjan:

> ***Being hit is something that HAPPENS to you; hitting is something you DO, and
> only the second one names a mob.***

La regla que sobrevive es *«un nombre al que TÚ has hecho daño es un bicho»*, en
una sola dirección, y **conductual a propósito**: *«it works identically for a mob
no catalog has ever heard of»*. El catálogo no se consulta ni cuando el bicho
está en él.

### 2.6 El cajón: qué no reconocemos, y quién de ellos sí

**Medición nuestra**, con nuestro parser sobre el registro entero de Miguel
(script: agrupa cada línea no reconocida por *forma*, sustituyendo dígitos por
`N` y el contenido entrecomillado por `'…'`; los nombres propios no se pueden
borrar sin conocerlos, así que **cada recuento por forma es un suelo**):

```
líneas                    951.773
reconocidas               893.941
sin reconocer              57.814   (6,07 % — ver el denominador abajo)
sin cabecera de hora           18   (ni una cosa ni la otra — abajo)
formas distintas            6.612
las 90 formas mayores      33.188   (57,4 % del cajón)
```

**Las 18 que no están en ninguno de los dos montones son continuaciones de
mensajes de chat multilínea.** 893.941 + 57.814 + 18 = 951.773, exacto. El
parser exige una cabecera `[hora]` para clasificar, y cuando un mensaje del
juego lleva un salto de línea dentro, la segunda mitad se escribe **sin
cabecera** y no es ni reconocida ni desconocida: es que no hay línea que
clasificar. Son 18 en todo el registro, en cinco episodios:

- seis líneas de un pegote de Discord que alguien copió al chat (líneas
  15.755–15.760);
- dos veces el pie «Please visit https://everquestlegends.com…» de un aviso del
  servidor (17.681 y 74.646);
- cinco de dos avisos de mantenimiento con su hora, su duración estimada y su
  motivo (30.330–30.332, 31.121–31.122);
- tres de alguien pegando en el chat su propio desglose de daño (312.541,
  314.362, 537.834);
- dos de un aviso de bloqueo de raid (554.426–554.427).

No es un residuo sin nombre: es **una tercera categoría real**, y ahora tiene su
fila en la cuenta.

**Y son la mitad de un fenómeno con dos caras.** Un mensaje de chat partido en
varias líneas nos ataca por arriba y por abajo a la vez:

- **Las líneas de abajo** —las continuaciones— no traen cabecera `[hora]`, así
  que el parser no llega a clasificarlas. Son estas 18.
- **La línea de arriba** —la primera— sí trae cabecera y abre comilla, pero no
  la cierra, porque el texto sigue debajo. Son **8 en todo el registro**, de
  32.659 que abren cita. Ésas caían en la regla de daño.

La misma forma partida, dos fallos distintos, uno por cada extremo.

**El denominador del 6,07 %.** El fichero tiene **951.773 líneas físicas no
vacías** y **951.755 registros lógicos** (las 18 de arriba son líneas pero no
son registros). El porcentaje está calculado sobre **los registros lógicos** —
57.814 / 951.755 = 6,075 %— porque el cajón mide qué parte de lo CLASIFICABLE no
sabemos clasificar, y una continuación sin cabecera no es clasificable. Sobre
las líneas físicas sale 6,074 %: a dos decimales las dos dan 6,07, pero son dos
preguntas distintas y conviene que la etiqueta diga cuál contesta.

**¿Es una regla o una casualidad?** La cabecera **es una regla, y estricta**:
`parseHeader` (`src/parser.js:69-77`) exige un `[` en la posición 0, un `]` en la
25, un nombre de mes conocido en la 5-8 y que día, hora, minuto, segundo y año
sean números; si algo falla devuelve `null` y `parse` (`src/parser.js:188-190`)
no llega a clasificar. Una línea sin cabecera **no puede** producir un evento.

**PERO ESO NO NOS PROTEGE DEL CHAT, Y CONVIENE SABERLO.** Una línea de chat sí
trae cabecera, así que la pregunta de verdad es otra: ¿puede alguien escribir
una cifra en el chat y que la contemos? **Sí, y la exclusión que hoy lo impide es
accidental.** Medido:

- Las reglas de daño están ancladas (`^…$`) pero capturan el emisor con `(.+?)`,
  así que se tragan el prefijo del canal sin protestar.
- El orden no nos salva: la pista `of damage` se prueba **en la posición 2** de
  las 123, y ` says` en la 72. **La regla de daño se prueba ANTES que la de chat.**
- Lo único que hoy impide la confusión es que la regla de daño está anclada al
  final y **la comilla de cierre del chat rompe la coincidencia**.

De donde: una línea de chat que **no cierre comilla** —la primera línea de un
mensaje multilínea, que es justo la forma de tres de las 18— cae en la regla de
daño. Probado sobre nuestro propio parser:

```
  [hora] You say to your guild, 'Campeon hits a dracoliche for 999999 points of damage.
     -> melee  amount=999999  source="You say to your guild, 'Campeon"

  [hora] Fulano tells the guild, 'a dracoliche has been slain by Campeon!
     -> death
```

**Y ahora la parte tranquilizadora, que también está medida:** en el registro de
Miguel hay **21.867 líneas con forma de chat**, de las que **9 no cierran
comilla**, y **ninguna de las 21.867 se clasifica como daño, muerte o curación**.
El agujero existe y nadie lo ha pisado — los tres desgloses que Miguel pegó en el
chat de hermandad son resúmenes de dps, que no tienen forma de línea de daño.

Es un vector latente, no una corrupción viva. Queda escrito aquí para que la
próxima persona que toque el orden de las pistas sepa qué está sosteniendo.

Las familias grandes, y quién las tiene. **Los totales por familia se suman sobre
las 600 formas mayores**, así que son suelos: la cola de 6.000 formas restantes
sólo puede sumar. La única cifra contada directamente sobre el registro entero es
la de facción (9.965 líneas; la agrupación por formas recoge 9.914 de ellas).

| líneas | familia | jmoyers | sowoky |
|---:|---|---|---|
| 13.331 | emotes de buff que aterriza en ti (`Your feet move faster.` 4.023, `Your mind begins to clear.` 3.567, `Your wounds begin to heal.` 1.953, `A burst of strength surges through your body.` 721, `Your life force drains away.` 1.011) | **minado, no escrito** (§8.2) | no |
| 9.965 | `Your faction standing with … has been adjusted by N.` y sus variantes | no como evento de log (sólo lee el volcado `/output faction`, `outputs/kinds.ts:138`) | **sí** — `engine.js:124`, y es una de las tres patas de la ráfaga que detecta muertes silenciosas |
| 1.901 | `<Alguien> tries to cast a spell on you, but you are protected.` | no | **sí** — `engine.js:179` |
| 3.803 | comercio y oficios: `You have fashioned the items together…`, `You receive N platinum … from <mercader> for <objeto>`, `Merchant X told you, '…'` | **sí** — `parseAcquire.ts:84`, y `You receive` en el mismo fichero | parcial (`You receive` en `engine.js`) |
| 7.351 | `<Nombre> rages.`, `<Nombre>'s voice booms.`, `You overcome the stun!`, `You go berserk.`, `You already have your target's attention.`, `Your target is out of range`, `You must first select a target for this spell!`, `Your will is not sufficient to command this weapon.`, `You lacked the skills to fashion X`, `You can no longer advance your skill…` | **ninguno de los dos tiene ninguna de éstas** | ídem |

Dos conclusiones, y las dos son negativas útiles:

1. **De las diez formas sueltas más frecuentes de nuestro cajón, ninguno de los
   dos tiene ocho.** El cajón no es una lista de deberes atrasados: es en su
   mayoría ruido que nadie parsea, y eso vale como confirmación externa.
2. **Las dos familias que sí tienen y nosotros no —facción (9.965) y protegido
   (1.901)— no son «una línea más»: son la entrada a una capacidad.** La
   facción es la ráfaga que delata una muerte que el log no escribe; el
   «protected» es la contrapartida de un buff activo.

---

## 6. Arquitectura: qué significa «extensible event-stream»


En concreto significa **un bus síncrono con una unión discriminada**.

`src/main/log/bus.ts:1-14`:

> *Both feeders (the historical scan and the live tailer) call emit(); every
> consumer […] subscribes. **Subscribers fire in registration order,
> synchronously, in the emitting call stack — no async, no queue** — so the
> scan's strict file order is preserved end-to-end.*

Las piezas:

1. **Una pasada de parseo**, cascada de 41 clasificadores puros
   (`parser.ts`), que produce `LogEvent` (`shared/logEvents.ts`).
2. **Un bus** (`bus.ts`), con una bandera `live` que distingue el replay
   histórico del vivo: *«Consumers use it to gate side effects that should only
   happen live (IPC pushes) while still folding historical events into their
   snapshot state.»*
3. **Consumidores independientes** que se suscriben: reducers de botín/muertes/
   niveles/AA, el motor de combate, el modelo del mundo.
4. **Eventos derivados** (`bus.ts:31-46`): un consumidor puede sintetizar un
   evento (`buffExpired`, `epoch`, `offlineGap`) mientras pliega uno primario y
   devolverlo al bus; se **encolan** y se entregan después del primario, para no
   reentrar en el bucle de escucha a mitad.

Y un detalle que es puro oficio (`bus.ts:31-40`): el bus **enmarca** el drenaje
de derivados con un `probe` para que el banco de pruebas pueda atribuir su coste
a una fila propia — *«the modules' totals would quietly include work done on
somebody else's behalf, and "the derived drain costs X" could only ever be a
guess»*.

**Qué costaría en el nuestro añadir una sección.** Hoy `src/parser.js:202`
devuelve un evento y quien lo consume lo hace por llamada directa desde
`src/engine.js`. No hay bus: hay un motor que sabe de todos los consumidores. La
diferencia concreta con lo suyo no es el bus en sí —es que su `logEvents.ts` es
**el contrato publicado** y el motor es un suscriptor más, mientras que en el
nuestro el motor **es** el contrato. Un consumidor nuevo nuestro tiene que
entrar por `engine.js`; uno suyo se registra y no toca nada.

sowoky no tiene bus: `engine.js` produce un array `P.events` y todo lo demás son
funciones que recorren ese array (`buildClaims`, `buildFights`, `buildMobStats`,
`buildSegments`, `analyze`). Es la forma más simple que funciona, y para 13k
líneas es probablemente la correcta.

---

## 7. Overlays


Ellos tienen **diez** clases de overlay (no ocho), `src/shared/types.ts:75`:

una lista con diez identificadores: pelea, global, sucesos, curación de la
pelea, curación global, avisos emergentes, buffs, debuffs, experiencia y
reapariciones.

El oficio de Electron que hay debajo, que es lo copiable sin copiar código:

- **Click-through con reenvío de ratón.** `windows.ts:498`:
  `w.setIgnoreMouseEvents(true, { forward: overlayMouseForward(kind) })`. El
  `forward: true` mantiene los `mousemove` llegando, así que la ventana sigue
  «sabiendo» que el ratón está encima aunque los clics la atraviesen — es lo que
  permite que un overlay se revele al pasar por encima sin dejar de ser
  transparente al clic. sowoky usa el mismo truco (`main.js:278-282`) y lo
  documenta igual: *«forward:true keeps mouse-move events flowing so the overlay
  can still [react]»*, más una **zona activa para despinchar**
  (`main.js:805-812`).
- **Transparencia por elemento, no de ventana.** `windows.ts:714`:
  *«translucency (per-element alpha beats window-level setOpacity)»*. Es una
  decisión, no un detalle: `setOpacity` atenúa también el texto.
- **Un píxel de holgura al comparar límites.** `windows.ts:607-611`:
  *«`setBounds` is not always an identity: on a scaled display the value [comes
  back different]»*. Es la causa de la incidencia `#1` de sowoky —*«Overlay window
  grows while dragging it (fractional display scale)»*— que sigue abierta.
- **No mover la ventana por muestra de cursor.** `windows.ts:1004`: *«a setBounds
  per cursor sample would be a window-manager round trip at 125 Hz»*.
- **Restaurar límites guardados con cordura.** sowoky `main.js:80`:
  `OVERLAY_KEEP_ON_SCREEN`, y su incidencia `#3` dice que aun así se puede
  arrastrar fuera de pantalla y restaurar tamaños imposibles.

**Sus incidencias de overlay abiertas son 5 de 13** (`#1`, `#3`, `#11`, `#12`,
`#16`), y las de jmoyers de plataforma otras 3 (`#26`, `#28`, `#25`). **Diez de
las veinticuatro incidencias de los dos repos son de ventana.** Un overlay es
caro de tener bien, y el coste no está en el contenido.

---

## 8. Datos consultados


### 8.1 La foto con su fecha

Cada catálogo suyo lleva su procedencia dentro del propio JSON:

| fichero | tamaño | claves de cabecera |
|---|---:|---|
| `data/items.json` | 8.443 kB | `scrapedAt, source, count, items` |
| `data/spells.json` | 956 kB | `scrapedAt, schema, count, withEffects, spells` |
| `data/messageOverlay.baseline.json` | 401 kB | `version, updatedAt, messages, stats` |
| `data/pageEra.json` | 178 kB | `scrapedAt, source, count, eraRevision, pages, refs, mobs` |
| `data/classes.json` | 62 kB | `scrapedAt, names, stances, …` |
| `data/respawns.json` | 55 kB | `source, scrapedAt, rows` |

**`scrapedAt` + `source` + `count` en todos.** Y los recolectores son scripts
nombrados y versionados en `package.json`: `scrape:items`, `scrape:spells`,
`scrape:mobs`, `scrape:quests`, `scrape:respawns`, `scrape:bosses`,
`scrape:classes`, `scrape:posky`, `scrape:page-era`, `fetch:images`.

Es la regla de la **«foto con una fecha»** ya implementada: el dato consultado no
se mezcla con el medido y lleva encima cuándo se sacó y de dónde.

Y una nota que separa dato consultado de dato medido explícitamente
(`data/spellCorrectionsList.ts:3`): *«`spells.json` is a SCRAPE»*.

### 8.2 Lo mejor del estudio: minar la asociación en vez de escribir la regla

Nuestro cajón tiene **13.331 líneas** de emotes de buff que aterrizan en ti
(`Your feet move faster.` ×4.023, `Your mind begins to clear.` ×3.567…; los cinco
que enumera §2.6 suman 11.275 y el resto de la familia pone el otro par de
miles). **Ninguno de los dos las tiene escritas a mano.** jmoyers hace otra cosa (`src/main/data/messageOverlay.ts:1-30`):

> *The user's directive: "augment the spell database with our own method of
> verifying variations of the cast messages for everything we encounter." This is
> that method.*

El mecanismo: mientras el modelo de buffs pliega el registro —en la relectura y
en vivo— le entrega cada lanzamiento del jugador y cada línea candidata a ser un
mensaje. La capa **mina la asociación** entre un mensaje y el hechizo que se
estaba lanzando cuando apareció, con la pareja (texto, hechizo) como índice, y
cuenta cuántas veces se repite.

Y de esas cuentas sale un **veredicto por mensaje**:

- `VERIFIED` — el mensaje sigue siempre al mismo hechizo (n≥2). Verlo prueba que
  ese hechizo aterrizó.
- `SHARED / GENERIC` — sigue a varios (*«You feel different.» para toda ilusión,
  «You feel much faster.» para cuatro hastes*). **No puede nombrar un hechizo por
  sí solo.**
- `CONTRADICTS-WIKI` — la asociación observada contradice a `spells.json`. *«the
  wiki is known-wrong in places»*.
- `UNKNOWN` — pocas observaciones para juzgar.

**Es nuestra taxonomía medido/deducido/declarado aplicada a la construcción misma
de las reglas**, y con la wiki en el sitio de «declarado» y perdiendo contra lo
medido. La medición no la escribe un humano: la escribe el registro.

Y trae con ella su propio fallo, que es de los nuestros
(`messageOverlay.ts:41-52`):

El minado es un pliegue, y lo sembraban con un montón plano: la instantánea
publicada más el fichero que el pliegue idéntico de la sesión anterior ya había
escrito. Cada arranque en frío sumaba las observaciones del registro a una foto
que ya las contenía — **medido: 22 → 44 → 88 en tres arranques**. Su propia
conclusión:

> *every derived verdict (n>=2 is VERIFIED) resting on counts that **describe the
> number of times the app has STARTED rather than what the log says**.*

La corrección es de forma, no un filtro: un cubo por origen, y volver a plegar un
origen **reemplaza** su aportación en vez de sumarla — *«which makes mining
idempotent by construction»*, con una prueba que pliega tres arranques en frío
simulados y exige salida idéntica byte a byte
(`tests/messageOverlayIdempotence.test.mts`).

---

## 9. Pruebas


**jmoyers: 356 ficheros `*.test.mts`, 105.387 líneas, más 98 ficheros de e2e.**
Más líneas de prueba que de `src/shared` entero (36.909).

Lo que prueban, y cómo:

- **Contra el registro real, congelado.** Hay 16 scripts `fixtures:*` en
  `package.json` (`fixtures:combat`, `fixtures:pet-claim`, `fixtures:cc-duration`,
  `fixtures:poison-slow`…) que **extraen** trozos del log de verdad a
  `tests/fixtures/` (137 ficheros). El commit del 12 de agosto lo dice bien:
  *«JOS-287: the swap boundary is frozen in a fixture, so the guard stops needing
  the owner's log»*.
- **Oráculos de equivalencia.** `tests/replayChunking.test.mts` pliega los
  mismos fixtures con y sin troceado y compara los flujos byte a byte
  (`replaySlicer.ts:26`). `tests/bench/engineOracle.mts` es un banco con oráculo.
- **Idempotencia.** `tests/messageOverlayIdempotence.test.mts`, arriba.
- **Módulos puros a propósito, para poder probarlos sin Electron**:
  `coldRead.ts:10-12` (*«tests/startupDiscriminators.test.mts drives it
  directly»*), `storeMigrations.ts:22-25`.
- **Rachet de lint**: `lint:measure` y `lint:ratchet` (`scripts/lint-report.mts`)
  — el número de avisos sólo puede bajar.

**sowoky: cero pruebas en el repo.** A cambio tiene dos cosas: un
`scripts/simulate-log.mjs` (195 líneas) que fabrica registros, y —según
`engine.js:7-10`— un **contrato de doble transcripción** contra una
implementación de referencia en Python que vive en otro repo:

> *the algorithm and **both-transcriptions contract** (logparse_ref.py, diffed by
> check_log_parser.py) are unchanged*

Es decir: el mismo parser escrito dos veces, en dos lenguajes, y una herramienta
que compara sus salidas. No es una batería de pruebas, es un oráculo — y para un
parser puede que sea más fuerte.

**Nosotros: 44 ficheros en `test/`, 10.341 líneas**, los 44 encadenados en el
`npm test` del `package.json`.

**La comparación justa, que era lo que se preguntaba:** construir guardas contra
fallos concretos y medidos **no es raro**, es exactamente lo que hace el
competidor grande, y lo hace con diez veces nuestro volumen (105.387 líneas
frente a 10.341). Lo que
sí es distinto es el **método**: nosotros escribimos una prueba por fallo
encontrado, con el caso real dentro (los cuatro *shin ghoul knight* del 5 de
agosto en `test/figuras.js`). Ellos hacen eso **y además** oráculos de
equivalencia, que es una clase de prueba que no tenemos: no comprueban un
resultado esperado, comprueban que **dos caminos dan lo mismo**. Es la única
forma de probar una optimización.

---

## 12. Lo que revirtieron, y lo que borraron


### 12.1 El hallazgo mayor de este pase: construyeron la persistencia del fold y la quitaron

**11 de agosto, `JOS-230`.** Se borra `src/main/foldCache/` entero —16 ficheros: el
formato del contenedor, el bloque de identidad, la gramática del esquema, el
cargador, la planificación de escritura, el interruptor, el verificador en
sombra, el censo, los ayudantes de ruta— y con él su preferencia, sus dos
canales de IPC, el puente del preload y la casilla **Preferencias → Rendimiento
→ «Faster start»**. El asunto: *«`JOS-230`: the fold checkpoint itself, and every
wire it hung from»*.

**§5 de este documento decía que jmoyers «no persiste el fold».** Es verdad hoy,
y ahora sabemos que **es una decisión, no una omisión**: lo construyeron entero y
lo sacaron.

**Y el porqué está en el commit hermano** —*«the fleet stops being asked a
question nobody answered»*— y es la clase de cicatriz que este pase busca:

> *shadowChecks was ZERO on every build. The counters were the rollout gate
> ("stays off until divergences hold at zero"), and a gate whose denominator
> never moves cannot open.*

Habían puesto la función detrás de un verificador en sombra que comparaba el
fold restaurado contra el fold recalculado, y la puerta de salida era «cuando
las divergencias lleven mucho en cero». **El verificador no llegó a correr ni una
vez en ninguna compilación**, así que el contador de divergencias era 0 sobre 0 —
y una puerta cuyo denominador no se mueve no se abre nunca. Ni siquiera pudieron
medir si la función servía.

**Es nuestra familia de la alarma muerta**, en su versión más cara: no una salida
que nadie lee, sino **una salida que nadie lee y de la que depende que una
función se encienda**.

**La pregunta a nuestro log:** ¿tenemos alguna puerta con esa forma — una función
o un aviso condicionado a un contador que podría no moverse nunca? **Contestada, y
es que sí la tuvimos**: el evento `rotate` del lector se emitía desde el primer día
y no lo escuchaba nadie (arreglado el 16 de agosto). No condicionaba ninguna
función, así que era la versión barata de lo mismo. **Pendiente**, y es más cara de
contestar: revisar si alguna guarda nuestra se apoya en un contador que sólo
podría crecer si alguien ya estuviera usando lo que la guarda protege.

### 12.2 Un experimento publicado y retirado la misma noche

**9 de agosto, `JOS-179`** — *«the reorder experiment comes back out, search stays»*.
Arrastrar para reordenar las alarmas (`JOS-175` + `JOS-177`, fusionado esa misma
noche, **sin publicar**) se retira entero: el gesto, la aritmética del punto de
suelta, las reglas de orden, el asa y la línea de inserción, el canal de IPC, su
puerta en el preload, su manejador y su accesor de almacén.

La razón, textual: *«With search shipped, reordering is silly, and the complexity
is not worth the single request that asked for it.»* **Una sola petición lo pidió.**

Y lo que hace que valga la pena anotarlo: **al quitarlo, lo que quedó se
simplificó**, no sólo encogió. Ya no hay un gesto que suspender, así que
desaparecen `canReorder`, el contenedor vacío de «no se puede soltar aquí», la clase
que agrisaba el asa y el aviso de «borra la búsqueda para poder reordenar». La
bandera de filtrado sobrevive con un solo trabajo.

**La pregunta a nuestro log:** no la tiene — es una pregunta a nuestro repo, y
**pendiente**: ¿qué tenemos publicado que pidiera una sola persona y que esté
complicando lo de al lado?

### 12.3 Y dos retiradas de superficie el mismo día

**13 de agosto**: `JOS-325` *«gear sets retire — the Gear tab becomes pure search»* (4
ficheros de interfaz + `shared/planner/gearSetTotals.ts`) y `JOS-326` *«Exaltations
becomes search-only, and the flat wish list is the surface it feeds»* (6 ficheros
del planificador). **Dos pestañas con estado propio sustituidas por una búsqueda.**
El patrón se repite tres veces en cinco días: *lo que se puede buscar no
necesita organizarse a mano*.

## 16. Las diez incidencias de sowoky que faltaban


Son autoauditorías con fichero, línea y entrelazado. Para cada una, si tenemos
esa forma:

| # | qué es | ¿la tenemos? |
|---|---|---|
| `#1` | el overlay **crece al arrastrarlo** con escalado de pantalla fraccionario (175 %): de 340×240 a 632×524 en un arrastre, y el tamaño se persiste | **pendiente**, y barata: sólo hace falta un monitor al 175 % |
| `#3` | se puede arrastrar **fuera de la pantalla** (`y: -144` observado), y unos límites guardados mayores que la pantalla se restauran tal cual | **pendiente** — tenemos guardado de posición del overlay |
| `#6` | al cerrar la aplicación se persiste `overlay.shown=false`, así que **la restauración automática no puede funcionar nunca** | forma conocida: un estado de salida que contradice la intención de arranque |
| `#8` | **cero `isDestroyed()` en todo el repo**: entre `close()` y el evento `closed` la guarda `if (win)` pasa sobre una ventana muerta | **pendiente y barata de mirar**: tenemos envíos al overlay por evento |
| `#11` | el overlay **se suelda al cursor**: sin `releasePointerCapture`, el modo atravesable se activa a mitad de arrastre y el `pointerup` no llega nunca | no aplica igual —no tenemos arrastre propio— pero la forma sí: un estado que sólo se limpia con un evento que puede no llegar |
| `#12` | bloquear con el cursor **quieto** deja la salida de emergencia atravesable: nada se mueve, así que el recálculo no corre | **la forma es nuestra**: cualquier recálculo disparado sólo por movimiento |
| `#15` | el botín en vivo refresca las misiones y **no** refresca el tablero del cielo: falta una línea | **la forma es nuestra y de las peores**: dos consumidores del mismo suceso, uno actualizado |
| `#16` | la vista reducida **oculta por defecto lo empezado** y estructuralmente nunca puede enseñar la pista del jefe | forma conocida: dos superficies de «lo mismo» con configuraciones separadas |

**La lectura de conjunto, y es la que vale:** ocho de las diez son de **ventana**,
y ninguna es de parseo. Coincide con lo que ya decía el primer estudio —diez de
las veinticuatro incidencias de los dos repos son de ventana— y refuerza la
conclusión: **un overlay es caro de tener bien, y el coste no está en el
contenido**.

**La pregunta a nuestro log:** ninguna de las ocho se contesta con el registro. Se
contestan **abriendo la aplicación en un monitor escalado**, que es una clase de
medición que no hacemos.

## 17. Los 469 commits sin clasificar: qué familias aparecen


Muestra de los 45 de asunto más largo. Familias que **no** estaban en nuestra
lista de once:

- **La superficie que estorba a lo que explica.** *«the class filter loses its
  tooltip — a hover box over an input you type into blocks the very dropdown it
  explains»*. Un elemento de ayuda que tapa aquello que ayuda a usar.
- **La instrumentación que nadie puede leer.** *«and the digest reads them back —
  instrumentation nobody can read is not instrumentation»*. Es la alarma muerta
  girada hacia la telemetría: medir y no tener dónde mirarlo.
- **La prueba puesta donde el fallo ocurrió, no donde adula.** *«the drag-cost
  gate is placed where it has been watched fail, not where it flattered»*, y
  *«the hook is pinned where it broke, by running the real hook across a
  container swap»*. Nosotros lo hacemos por instinto; ellos lo tienen escrito.
- **La negación de más.** *«north is north again — one wrong word in the plan,
  one spurious negation at render»*: una palabra mal en el plan que se convierte
  en una negación de más al pintar. Es un fallo de **traducción entre el
  documento y el código**, y no lo teníamos como familia.
- **Lo que el juego enuncia frente a lo que no.** *«the level graph draws the
  percentages the game states, and shades the stretches it does not»*: sombrear
  lo no dicho en vez de interpolarlo. Es nuestra doctrina de procedencia
  aplicada a un gráfico, que es justo lo que viene ahora.
- **El colapso periódico de la documentación.** *«The daily collapse, 2026-08-13:
  AGENTS.md 20,020 → 17,969 words, the histories move to the archive»*. Tienen un
  **ritual de poda** del documento de leyes, con las historias mudándose a un
  archivo. Nosotros crecemos y no podamos.

**La pregunta a nuestro repo, contestada:** la última nos toca hoy. Este documento
va por `~1.400 líneas` y las once familias de `ui/app.js` por unas 300. Ninguno
tiene ritual de poda ni archivo al que mudar lo viejo.

