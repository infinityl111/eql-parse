# Hallazgos — lo que hemos medido de EQL Parse

**Esto no es el estudio de los competidores.** Aquí no se lee código ajeno: se
mide **el nuestro** contra el registro de Miguel. Vivía dentro de
[`ESTUDIO-COMPETIDORES.md`](ESTUDIO-COMPETIDORES.md) porque cada hallazgo salió
de una pregunta que ese estudio le hacía a nuestro log — y el estudio creció sin
freno **porque todo cabía bajo aquel título**.

**La regla del reparto, la misma de siempre:** un documento contesta una
pregunta. El estudio contesta *qué tienen ellos y qué nos enseña*; esto contesta
*qué hemos medido de lo nuestro*; [`ESTUDIO-ARCHIVO.md`](ESTUDIO-ARCHIVO.md)
contesta *cómo llegamos aquí*; [`HECHOS-DECLARADOS.md`](HECHOS-DECLARADOS.md),
*quién lo dijo y cuándo*; y [`CACERIA.md`](CACERIA.md), *dónde no hemos mirado*.

**Todas las cifras de aquí son del 16 de agosto de 2026**, sobre
`eqlog_Campeon_erudin.txt` —985.189 líneas con cabecera— y el almacén de Miguel
(1.493 peleas con combatientes) o uno reconstruido ese día desde ese mismo
registro (1.504). Donde una cifra sale igual sobre los dos, se dice.

---
## 1. Los tres detectores de gemelos, medidos sobre nuestro registro

### 1.1 La deducción sobre `nombre#generación`: se sostiene a medias

La deducción era: *el ciclo de vida incrementa la generación — muere una
instancia, se retira, la siguiente línea abre generación nueva*.

**Comprobado en `world.ts:224-236`**: `spawn()` lleva un contador por nombre y lo
incrementa al crear. Pero tiene **cinco puntos de llamada**, y sólo uno es el que
la deducción describe:

| línea | cuándo nace una generación |
|---|---|
| `world.ts:329` | no hay instancia activa de ese nombre — **el camino de la deducción** |
| `world.ts:415` | un encanto que no puede vincularse a una instancia viva |
| `world.ts:451` | una mascota invocada que se reclama |
| `world.ts:526` | **evidencia de gemela, sin ninguna muerte de por medio** |
| `world.ts:625` | un «fantasma»: se crea y se retira en el acto para no matar a la mascota |

**La deducción se sostiene como uno de cinco caminos, y el que se deja fuera es
justo el interesante**: la línea 526 abre una generación **porque el log ha
demostrado que hay dos**, no porque una haya muerto. Eso es el detector, y no
depende del ciclo de vida en absoluto.

**Y su precondición es mucho más estrecha de lo que parecía** (`world.ts:523-527`):

> *only meaningful while a pet is live*

El detector **sólo actúa mientras hay una mascota encantada viva de ese nombre**.
Fuera de un encanto no dispara nunca. Lo que buscan no es «hay gemelos» en
general: es «tu mascota y un hostil comparten nombre», que es el caso que les
borra el daño de la mascota.

### 1.2 Cuánto dan sobre nuestro registro

**Medido el 16 de agosto de 2026 por la tarde**, sobre `eqlog_Campeon_erudin.txt`
(80,7 MB, 985.189 líneas con cabecera, hasta el 16 de agosto a las 00:24) y sobre
las **1.504 peleas con combatientes** de un almacén reconstruido ese mismo día
desde ese mismo fichero. La columna que importa es la última: **cuántas veces
dicen algo que nuestro suelo no supiera ya** —el suelo sabe que hubo dos en
cuanto ve dos muertes—.

**Y lleva dos controles que la medición de la mañana no tenía**, que son los que
cambian el resultado:

1. **UN DISPARO SÓLO CUENTA SI EL BICHO ESTÁ EN LA TABLA DE UNA PELEA NUESTRA.**
   El registro trae el combate de todo el mundo. Un nombre que se pega consigo
   mismo a diez metros es un hecho del mundo, pero **no puede subir nuestro
   suelo**, porque ese bicho no está en ninguna cuenta nuestra. Es exactamente la
   misma falta que se acaba de arreglar en `src/guion.js`: **una ventana de tiempo
   usada como si fuera una lista de pertenencia**.
2. **CADA DISPARO SE CLASIFICA POR EL MECANISMO QUE LO ESCRIBIÓ**, no por su
   forma. Ver el control completo más abajo.

| detector | disparos | en bicho de pelea nuestra | pares (pelea, nombre) | ya lo sabía el suelo | **ganancia** |
|---|---:|---:|---:|---:|---:|
| contradicción del encanto | 288 | 288 | 11 | 11 | **0** |
| contradicción del propio nombre (X→X) | 411 | 174 | 19 | 15 | **4** → **1** con el control |
| tick de veneno repetido (sowoky) | 91 | 65 | 11 | 11 | **0** |

> **CORREGIDO el 16 de agosto por la tarde.** Aquí decía «109 disparos de X→X, 40
> ya sabidos, **ganancia 69**, 52 nombres distintos encabezados por `a shin ghoul
> knight`», y que X→X era «la única de las tres formas que aporta algo». **La
> ganancia real sobre este registro es 1.** El arnés de la mañana daba por
> miembro de la pelea a cualquier nombre que cayera dentro de su ventana de
> tiempo, así que contaba como «gemelo nuevo» a bichos de peleas ajenas que
> nuestro suelo no tenía porque **no eran nuestros**. La historia entera, en
> [`ESTUDIO-ARCHIVO.md` §A3](ESTUDIO-ARCHIVO.md).

#### El control de X→X: qué más puede escribir «X hace daño a X»

Antes de meter una forma en el suelo hay que preguntar **qué otros mecanismos la
escriben**, porque si hay uno de un solo bicho que produce esa línea, el detector
no detecta gemelos: detecta ese mecanismo.

En crudo, el registro tiene **712 líneas** de daño con origen y destino del mismo
nombre. Repartidas:

| mecanismo | n | ¿prueba que hubo dos? |
|---|---:|---|
| **daño propio con pronombre** — `You hit yourself for 6 points of magic damage by Lifedraw.` | 301 | **no.** El registro lo dice con todas las letras |
| **melé** — `A thunder spirit slashes a thunder spirit for 70 points of damage.` | 293 | **sí.** Nadie se pega a sí mismo con la espada |
| **escudo de daño / espinas** — `A magician is burned by a magician's flames for 6 points of non-melee damage.` | 15 | **sí.** El escudo es del DEFENSOR y quema al ATACANTE: son los dos extremos de un golpe |
| **contraataque** — `A thunder spirit hits a thunder spirit for 34 points of damage. (Riposte)` | 3 | **sí.** Un contraataque necesita a quien atacó |
| **con «by \<habilidad\>»** — `Kibarer hit Kibarer for 6 points of magic damage by Lifespike.` | 100 | **no se puede decidir** |

**LA FILA QUE HACE FALTA VER ES LA ÚLTIMA, Y ES EL AGUJERO DEL CONTROL ANTERIOR.**
Compárense estas dos líneas del mismo registro:

```
You hit yourself for 6 points of magic damage by Lifedraw.
Kibarer hit Kibarer for 6 points of magic damage by Lifespike.
```

**Son el mismo mecanismo** —una habilidad que cuesta vida: `Cannibalize`,
`Lifedraw`, `Lifespike`, `Life Leech`, `Specter Lifetap`— y **la única diferencia
es que el pronombre sólo se escribe cuando el sujeto eres tú**. El reflejo del
jugador se cazó en la primera medición porque el jugador era yo; **el de
cualquier otro jugador entra intacto**, escrito con su nombre dos veces. En este
registro son `Trisfhal`, `Clough`, `Shugz`, `Kibarer`, `Heimerdinger` y `Tarran`,
más `Cazic-Thule` y `a loathling lich`, todos con `Cannibalize`, `Burst of Flame`
o un lifetap y **ninguna línea de melé que los respalde**.

**El desempate, y es el que hay que aplicar: por NOMBRE, no por línea.** Un nombre
tiene prueba dura si alguna vez aparece en melé, escudo o contraataque consigo
mismo. De los **19 nombres** con X→X:

- **9 con prueba dura** — `a thunder spirit` (175 disparos, 117 de melé),
  `a large skeleton` (73, todos), ``a Teir`Dal rogue`` (60), `an ogre guard` (29),
  ``a Teir`Dal priest`` (14 de 14, 13 duros), `a hardened skeleton` (9),
  `a magician` (6, 4 por escudo), `a dread skeleton` (3), `a deathly herald` (3).
- **10 sólo con la forma blanda**, que es la misma que escribe la autolesión.

**Y el resultado de aplicar el control a la ganancia:** de los 4 pares nuevos que
X→X aportaba, **tres son nombres blandos** —`Trisfhal`, `Kibarer` y `Cazic-Thule`,
los tres con habilidad y sin melé— y **queda uno**: `a dread skeleton`, el 10 de
agosto a las 13:48.

#### La decisión que sale de aquí, y va contra lo que yo mismo propuse

**X→X NO entra en el suelo.** No porque la forma sea falsa —los 311 disparos de
melé, escudo y contraataque son prueba dura y buena— sino porque **sobre este
registro no aporta nada que el suelo no tenga ya**: 1 par de 19. Yo lo vendí como
«la única de las tres formas que aporta algo» apoyándome en el 69, y el 69 era
del arnés.

**Lo que sí vale la pena guardar es el control, no el detector.** «Una habilidad
que cuesta vida escribe X→X sin pronombre cuando el sujeto no eres tú» es un
hecho del registro que va a hacer falta la próxima vez que alguien mire estas
líneas.

#### El del veneno: el cero, escrito como cero

**Tick de veneno repetido en el mismo segundo — la idea de sowoky, y la que yo
vendí dos veces como la mejor del estudio.**

| | |
|---|---:|
| **fecha de la medición** | **16 de agosto de 2026** |
| registro | `eqlog_Campeon_erudin.txt`, 985.189 líneas con cabecera |
| muestra | **1.504 peleas con combatientes** |
| disparos | **91** |
| ...en un bicho de una pelea nuestra | 65 |
| pares (pelea, nombre) distintos | 11 |
| ...que el suelo ya sabía | **11** |
| **ganancia** | **0** |

**Cero. No «poco»: cero.** Los once pares que delata son once que el suelo ya
tenía por dos muertes escritas. La medición de la mañana daba 12 disparos y la
misma ganancia de 0; con la muestra mayor y el control puesto, **el número no se
mueve del cero**.

**Y su matiz, que es la mitad de la afirmación:** es cero **sobre ESTE registro**,
donde casi todo lo que se pega acaba muriendo, y un muerto deja escrita su
muerte — que es justo la evidencia con la que el suelo ya cuenta. **Un registro
distinto podría dar otra cosa**: uno donde se huya, se mece o se deje vivo a la
mitad de lo que se toca tendría muchos más nombres sin muerte escrita, y ahí el
tick repetido sí podría ser la única prueba. La idea no está refutada; **está
medida en un sitio donde no hace falta**.

**Se para el trabajo sobre este detector.** El número queda escrito con su fecha y
su muestra al lado, para que la próxima vez que alguien lo proponga —y lo va a
proponer, porque es bonito— lo que se lea sea la cifra y no la opinión.

### 1.3 La decisión, para los tres, con su cifra al lado

**NINGUNO DE LOS TRES DETECTORES ENTRA EN EL SUELO.** Decidido el 16 de agosto de
2026, sobre `eqlog_Campeon_erudin.txt` (985.189 líneas con cabecera) y 1.504
peleas con combatientes:

| detector | ganancia sobre nuestro suelo | decisión |
|---|---:|---|
| contradicción del encanto | **0** de 11 pares | no entra |
| contradicción del propio nombre (X→X) | **1** de 19 pares | **no entra** |
| tick de veneno repetido (sowoky) | **0** de 11 pares | **no entra** |

**Y LA FRASE QUE HAY QUE LEER CON LA CIFRA:** ninguno está **refutado**. Los tres
detectan lo que dicen detectar; los 311 disparos duros de X→X son prueba buena y
los once pares del veneno son ciertos. **Están medidos en un registro donde no
hacen falta**, porque aquí casi todo lo que se toca acaba muriendo y la muerte
—que es la evidencia con la que el suelo ya cuenta— llega antes que ellos.

**Un registro distinto podría dar otra cosa**: uno donde se huya, se mece o se
deje vivo a la mitad de lo que se pega tendría muchos más nombres sin muerte
escrita, y ahí el tercer detector podría ser la única prueba. Por eso lo que se
guarda no es «no sirve», es **el número, la fecha y la muestra**.

**Lo que sí se queda, y vale más que los tres:** el control de X→X — *una
habilidad que cuesta vida escribe «X hace daño a X» sin pronombre cuando el
sujeto no eres tú*—, que es un hecho del registro y ahora es una regla
(la decimotercera, en `ui/app.js`).

## 2. Lo que este pase arregló en nuestro código, con la medición hecha

**Va aquí porque faltaba: el arreglo se hizo el 16 de agosto de madrugada y este
documento no llevaba el resultado.** Un arreglo sin su medición escrita en el
sitio donde se lee es un arreglo que nadie puede revisar.

### 2.1 El reproductor tenía su propia definición de pelea, y era peor

`src/guion.js` construía el guion **releyendo el registro entre el inicio y el fin
de la pelea**, y metía como actor a **cualquiera que apareciera en esa ventana**.
El registro de EQ ve el combate de todo el mundo, así que la pelea de otro jugador
en los mismos segundos entraba entera y se dibujaba.

**Y no era un filtro flojo: era una segunda respuesta a una pregunta que
`src/encounter.js` ya contestaba bien.** El propio fichero lo decía ciento treinta
líneas más arriba —*«el reparto sale de la pelea, no del registro»*, *«dos
respuestas distintas para la misma pregunta es peor que una imperfecta»*— y luego
daba la segunda. El arreglo no endurece aquella regla: **la borra y llama a ésta**,
extraída a `src/relevancia.js` y compartida por los dos.

> **QUIEN SÓLO INTERACTÚA CON QUIEN NO ESTÁ EN LA PELEA, NO ESTÁ EN LA PELEA.**

Es la definición de pelea de la 1.14.0 —**un componente conexo**— aplicada donde
nunca se había aplicado: al decidir qué se dibuja. Y se conserva la categoría
«apareció y no hizo ni recibió daño» —un sanador, alguien que sólo falló—: lo que
se le exige no es haber hecho daño, es **haber tocado a algún miembro de la
pelea**.

**MEDIDO CORRIENDO LOS DOS**, el `guion.js` de antes del arreglo y el de hoy,
sobre el mismo almacén (1.493 peleas con combatientes) y el mismo registro
(985.189 líneas con cabecera), el 16 de agosto:

| | SIN la guarda | CON la guarda |
|---|---:|---:|
| peleas con alguna figura AJENA dibujada | **446 (29,9 %)** | **190 (12,7 %)** |
| ...con algún golpe que TOCA a un ajeno | 156 (10,4 %) | — |
| ...con combate ENTRE dos ajenos | **49 (3,3 %)** | **0 (0,0 %)** |

Repetido sobre un almacén reconstruido ese mismo día desde ese mismo registro
(1.504 peleas): **463 (30,8 %) → 203 (13,5 %)**, y **49 → 0**.

**Las 190 que conservan un ajeno son las legítimas:** 266 figuras en total,
ninguna peleando con otro ajeno, todas habiendo tocado a alguien de la pelea.

**Y la peor, la que dio nombre al fallo:** 11 de agosto, **19:34:32 hora local**,
99 s, tres combatientes —`Campeon`, `Vobn`, `a rock golem`—. El reproductor
dibujaba **trece** figuras: diez ajenas, de dos combates distintos, con **468**
golpes entre ellas dentro. **Hoy dibuja tres.**

> **CORREGIDO el 16 de agosto por la tarde.** El commit del arreglo daba
> «1.561 peleas, 1.257 (80,5 %) con ajenos, 184 (11,8 %) con combate ajeno, la
> peor a las 17:34:32 con catorce figuras». El arreglo era bueno; **la medición
> que lo justificaba, no**: el «antes» y el «después» salieron de arneses
> distintos. La historia entera, en
> [`ESTUDIO-ARCHIVO.md` §A4](ESTUDIO-ARCHIVO.md).

### 2.2 El segundo cero: todas las figuras se apagaban al empezar

> **CORREGIDO el 16 de agosto por la noche.** Este apartado decía que el fallo
> era una comparación epoch contra segundos de pelea que impedía el «+1 por
> actividad», y lo cifraba en **2.121 figuras en 1.303 peleas**. **Era falso**, y
> la forma de equivocarme es la de esta casa: diagnostiqué por LECTURA y el arnés
> que escribí para medirlo heredó mi suposición. El fallo real es otro, está aquí
> abajo, y es peor. La historia entera, en
> [`ESTUDIO-ARCHIVO.md` §A5](ESTUDIO-ARCHIVO.md).

**`killTimes` YA VIENE EN SEGUNDOS DE PELEA.** `src/engine.js:1251` lo escribe
como `Math.round(k.t - enc.start)`, y `ui/grafica.js` lo consume tal cual para
colocar las marcas de muerte del gráfico. **Ahí no hay dos relojes.**

**El fallo está en la línea de al lado**, que se lo restaba OTRA VEZ:

```
caidas = killTimes.map((t) => Math.max(0, Math.round(t - inicio)))
```

`107 − 1.786.358.914` da un número enorme y negativo, y el `Math.max(0, …)` lo
convierte en **0**. **Todas las figuras se apagaban en el segundo cero de la
reproducción, en todas las peleas.** La escena empezaba con los muertos ya
grises y se quedaba así.

**Y NO FALLÓ NADA, porque cero es un segundo válido.** Ni excepción, ni hueco, ni
cifra absurda: la familia entera de esta casa. Un `Math.max(0, …)` puesto para
proteger de un negativo convirtió un disparate en un dato plausible — **una
guarda que tapa el síntoma de la que se supone que protege**.

**LO QUE COSTABA, medido sobre las 1.493 peleas:**

| | |
|---|---:|
| caídas dibujadas en total | 4.573 |
| ...que salían en el segundo 0 y no era su segundo | **4.310 (94,2 %)** |
| peleas afectadas | **1.193 (79,9 %)** |

(Las 263 restantes son muertes que de verdad ocurrieron en el primer segundo.)

#### Y de paso, la decisión que sí faltaba: qué cuenta como «actividad»

El «+1 por actividad» **sí se ejecutaba** —las unidades estaban bien— pero
miraba `origen` **y** `destino`, o sea que bastaba con **que a uno lo nombraran**.
A un cadáver lo nombran todo el rato: le siguen pegando, le entra un tick
retardado, lo saquean.

**Ahora la evidencia tiene que ser una acción SUYA: sólo `origen`.** Pegar,
fallar, curar, castear, matar. Es lo conservador, igual que el resto del suelo.

| regla | peleas | nombres | figuras de más |
|---|---:|---:|---:|
| laxa — «que te nombren» (la de antes) | 50 | 72 | +72 |
| **del sujeto — la que entra** | **44** | **64** | **+64** |

**Ocho figuras que la regla laxa se creía y ésta no**, y son justo las de la forma
sospechosa: `orc centurion` (2), `Orc centurion` (2), `a zol ghoul knight` (2),
`an urd ghoul wizard`, `a greater kobold`.

#### Y sí, el título y el reproductor dicen cosas distintas — y está bien

Con el arreglo, en **64 casos** el reproductor dibuja **una figura más** de las
que el título nombra. **No son dos cálculos: es un módulo con dos entradas
contestando dos preguntas distintas.**

- El título (`engine.js:1318`) usa `muertesPorNombre` y contesta **«qué cayó»** —
  su propio comentario lo dice: *«el enemigo abatido»*.
- El reproductor usa `suelosDe` y contesta **«cuántos hubo»**, que incluye al que
  no llegó a caer.

`a shin ghoul warrior` con un abatido y otro de pie es literalmente eso: **uno
cayó, había dos**. **Lo que hay que arreglar no es el número, es que la pantalla
no explica que son dos preguntas** — y ése es un asunto de interfaz, no de
suelo.

#### Y la guarda no podía cazarlo

`test/figuras.js` probaba `suelosDe` con el predicado sustituido por `() => true`
y `() => false`. **Con el predicado puesto a una constante, ni la unidad de sus
argumentos ni la definición de «actividad» se ejercitan nunca.** Reescrito el 16
de agosto para que ejerza el predicado de verdad, con las dos escalas y con la
regla del sujeto, y **drilado en rojo contra el código de antes**.

### 2.3 El barrido de la pertenencia: ¿quién más contesta por su cuenta?

**La pregunta, después de que fallara dos veces el mismo día:** ¿qué otro código
decide «¿este bicho es de esta pelea?» en vez de llamar a la guarda?

**Buscado el 16 de agosto sobre `src/`, `ui/`, `bin/` y `test/`. Resultado: dos, y
ninguno es de pertenencia.** Los llamadores de `esRelevante` siguen siendo dos
—`encounter.js` y `guion.js`— y **ningún otro sitio reconstruye una pelea desde
una ventana de tiempo**. Los arneses del repo no cuentan: `calibrate.js` mide
líneas no reconocidas, `live.js` alimenta el rastreador de verdad, y
`store-check.js` y `enc-rebuild.js` leen peleas ya cerradas.

**Lo que sí apareció, y es de la misma familia con otro sujeto:**

**1 · Una segunda respuesta a «¿quién es enemigo?»** — `src/analysis.js:143-149`.
Si la pelea guardada no trae `side` en sus filas, `analysis.js` **lo vuelve a
deducir**: es enemigo quien tenga a ti o a una mascota tuya entre sus objetivos.
Sólo dispara sobre peleas anteriores a que el campo existiera, y el comentario lo
dice — pero es una regla reimplementada, no llamada.

**2 · CINCO COPIAS DEL PLEGADO DE LA MAYÚSCULA**, que es la pregunta «¿son el
mismo nombre?» contestada cinco veces:

| fichero | forma |
|---|---|
| `src/suelo.js:55` | dentro de `muertesPorNombre` |
| `src/guion.js:39` | `plegar` |
| `src/foes.js:267` | `mismoNombre`, local a una función |
| `src/encounter.js:1117` | `baja` |
| `ui/app.js:43` | `baja` |

**Las cinco hacen hoy lo mismo**, y por eso no falla nada. Pero es exactamente la
forma que ya costó 25 abatidos —*«la mayúscula inicial casaba en un sitio y en el
otro no»*— y **el trabajo de la clave contra la presentación, que está medido y
diseñado y en cola, va a tocar las cinco**. Se apunta aquí para que ese trabajo
empiece por unificarlas y no por añadir la sexta.

### 2.4 El cepillo del pronombre, pasado sobre las reglas que ya existen

**La regla nueva** —*toda forma en primera persona tiene una gemela en tercera*—
se escribió el 16 de agosto junto a la undécima familia en `ui/app.js`. Pasada
sobre `src/patterns.js`:

| | |
|---|---:|
| reglas totales | 149 |
| **ancladas en `You` / `Your`** | **85** |
| ...con gemela de tercera persona en su misma familia | 39 |
| ...**sin gemela en su familia** | **46** |

**Y las 46 no son 46 fallos, y decirlo así sería el mismo error que la regla
intenta evitar.** Repasadas una a una:

- **La mayoría son legítimamente tuyas.** El juego no te cuenta que otro jugador
  ha saqueado un cadáver (5 reglas de `loot`), ni que se ha quedado
  inconsciente, ni que ha ganado una runa de absorción. No hay gemela porque no
  hay línea.
- **Unas cuantas tienen la gemela EN OTRA FAMILIA**, y ahí el cepillo por familia
  da falso positivo: el aturdimiento de un bicho no es `You are stunned!`, es
  `staggers`; a `resist_by_you` le corresponde `resist`; y la de `interrupt` ya
  lleva las dos formas dentro de la misma expresión.
- **Lo que no había es la lista.** Nadie la había recorrido nunca, y ése es todo
  el valor de haber pasado el cepillo.

**Y LO QUE DE VERDAD IMPORTA NO ESTÁ EN `patterns.js`.** La cicatriz no fue una
regla de parseo que faltara: las reglas de daño tienen sus dos formas. Fue una
regla escrita ENCIMA de una forma de primera persona. En toda la casa hay **dos**:

| dónde | qué hace | estado |
|---|---|---|
| `REFLEXIVO` en `src/parser.js:473` | el pronombre como prueba de daño propio | **es la cicatriz**: 100 líneas de autolesión ajena entraban intactas |
| `tuyoPorLaFrase` en `src/guion.js` | deduce el sujeto de un estado de que la línea empiece por `You` | **no expone nada hoy** —las líneas de estado ajenas no llegan a parsearse— pero es la misma forma esperando |

### 2.5 La mayúscula: seis copias en una, y qué se enseña de verdad

**PRIMERO LA FUNCIÓN, DESPUÉS LA PRESENTACIÓN**, que es el orden que evita
añadir la séptima copia mientras se arregla la sexta.

**Eran SEIS, no cinco.** Al ir a por las cinco conocidas apareció otra dentro de
`encounter.js`:

| dónde | cómo se llamaba |
|---|---|
| `src/suelo.js` | dentro de `muertesPorNombre` |
| `src/guion.js` | `plegar` |
| `src/foes.js` | `mismoNombre`, local a una función |
| `src/encounter.js` | `baja`, dentro de `actor()` |
| `src/encounter.js` | **`#clave`**, la que no estaba en la lista |
| `ui/app.js` | `baja`, dentro de `cayoEn` |

Ahora hay **una**: `claveDeNombre` en **`src/nombres.js`**, con `mismoNombre`
encima, y los seis sitios la llaman. **La suite entera sigue en verde y ninguna
cifra se mueve** —las seis hacían ya lo mismo—, que es exactamente lo que se le
pide a esta clase de cambio: si moviera una cifra, es que las copias habían
divergido y el problema era mayor.

Y el módulo dice lo que no es, porque es la ley 2 de jmoyers:
**`claveDeNombre` devuelve una CLAVE, nunca un texto de pantalla.**

#### La nota de Miguel: ¿estaba la mayúscula contaminando el suelo?

En la tabla de las ocho figuras que la regla del sujeto no se cree aparecían
`orc centurion` **y** `Orc centurion` como dos entradas. **Comprobado: no
contaminaba el suelo — contaminaba mi tabla.**

| | |
|---|---:|
| peleas cuyas FILAS traen dos formas del mismo nombre | **1 de 1.493** |
| ...y es ``Skeleton L`rodd`` / ``skeleton L`rodd``, el 10 de agosto | |

Dentro de una pelea hay **una** forma, así que su suelo sale bien. Las dos
entradas de mi tabla eran de peleas DISTINTAS, agrupadas por el nombre crudo en
vez de por la clave. **Con la clave, son un nombre con 6 y con 4, no dos con 3 y
2.** Y las cifras del suelo —44 peleas, 64 nombres, +64 figuras— **no se mueven**.

#### Los tres montones, medidos

**La población son los 440 nombres de enemigo del almacén**, que son los que
llegan a la pantalla. El veredicto sale de **la posición en la frase**, que es la
única evidencia que hay: a principio de frase todo va en mayúscula y no dice
nada; a mitad, la mayúscula significa algo.

| | con artículo | **sin artículo** |
|---|---:|---:|
| **común** — visto en minúscula a mitad de frase | 277 | **26** |
| **propio** — visto en mayúscula a mitad de frase | 5 | **108** |
| **sin veredicto** — sólo visto abriendo frase | 3 | **21** |
| contradictorio | 0 | 0 |
| | 285 | **155** |

> **EL 16 / 147 / 1 SE RETIRA.** Era la cifra que veníamos manejando y **no
> aparece escrita en ninguna parte del repo**: no tiene población ni criterio ni
> fecha, así que no es una medición rival — es un recuerdo. La de aquí lleva las
> tres cosas y se puede volver a correr.
>
> **Y de ahí sale una regla, que vale más que los dos repartos:**
>
> > **UNA CIFRA SIN SU POBLACIÓN ANOTADA NO ES UN DATO.**
> > Ninguna entra en un documento sin decir **sobre qué se contó** y **cuándo**.
>
> Es la misma familia que todo lo demás de esta semana: `26` y `16` son los dos
> plausibles, los dos se citan igual de bien, y sin la población **no hay forma
> de saber cuál está mal** — ni siquiera de saber que se contradicen, porque
> podrían estar contando cosas distintas y tener razón las dos.

**Y los cinco «con artículo pero vistos en mayúscula a mitad» son un hallazgo
suelto:** ``the Spiroc Guardian``, ``the Spiroc Lord``, ``the Prophet``,
``the Mighty Bear Paw`` y ``the Muglwump``. El juego los escribe con **`The`
mayúscula a mitad de frase** —el artículo forma parte del nombre— y nuestro
normalizador se lo baja. **Son cinco nombres que enseñamos mal hoy.**

#### El recorrido: ¿llega una clave a la pantalla?

Se comparó, para los 440, **la forma que se guarda y por tanto se enseña** contra
**las formas que el registro escribe a mitad de frase**:

| | |
|---:|---|
| **410** | la forma mostrada **está** escrita a mitad de frase — correcta |
| **5** | **no casa**: son los cinco `the …` de arriba |
| **25** | **sin prueba**: el registro no los escribe nunca a mitad de frase |

**Los 25 sin prueba se enseñan con una mayúscula que nadie ha visto**:
`Guard Philbin`, `Sergeant Slate`, `Sarawyn Amorfin`, `Lord Grimrot pet`,
`a soul harvester`, `a bok ghoul knight`… Miguel se los cruzó una o dos veces y
siempre abriendo frase. **Hoy los presentamos como si supiéramos su forma, y no
la sabemos**: son *deducidos* presentados como *medidos*.

#### El plegado con prueba: los cinco, arreglados

**La regla pasa de «pliega siempre» a «pliega salvo que la mayúscula esté
atestiguada»**, y la prueba es la posición en la frase.

`Parser` anota, por nombre, **la forma que el juego escribe cuando NO abre
línea** —`#atestiguaFormas`, llamada antes de normalizar, que es el único
momento en que la forma cruda sigue existiendo— y `#norm` la devuelve tal cual
en vez de bajar el artículo.

**Y la corrección tuvo que ir en las dos direcciones.** `Encounter.actor()` sólo
corregía de capitalizado a minúscula, así que un nombre cuya forma buena LLEVA
mayúscula se quedaba con la minúscula para siempre: la primera línea que lo
nombra casi siempre abre frase, y ahí todavía no hay prueba. Ahora la fila ya
abierta **se renombra cuando la prueba llega**.

**Comprobado reconstruyendo desde el registro:**

```
["The Spiroc Guardian","The Spiroc Lord","The Prophet",
 "The Mighty Bear Paw","The Muglwump"]
```

**Los cinco, con su mayúscula.**

> **LO QUE NO SE PUEDE HACER AQUÍ, y conviene decirlo:** el plegado de la
> **CLAVE** sigue siendo incondicional, y tiene que serlo. Si la clave dejara de
> plegar mientras no hay prueba, `A gorgon` y `a gorgon` **dejarían de
> encontrarse** durante las primeras líneas de cada sesión — que es exactamente
> el fallo que costó 25 abatidos. La prueba manda sobre **la forma que se
> enseña**, no sobre la identidad.

#### Y los 25 sin prueba, marcados

Cada fila lleva `nombreDeducido`. La interfaz lo dice donde ya dice la
procedencia de todo lo demás de esa fila, **en los cinco idiomas**.

**No cambia ninguna cifra: cambia lo que se afirma sobre una.** Era lo único de
los tres montones que era un fallo de verdad — *deducido presentado como medido*.

> **UNA SALVEDAD MEDIDA, y hay que leerla.** La marca se pone **cuando la pelea
> se cierra**, y la prueba llega con el tiempo: en la primera pelea de
> `heart harpie` todavía no había, y cuarenta peleas después sí. Sobre la
> reconstrucción salen **53 filas marcadas de 6.299, con 50 nombres distintos**,
> y de ésos sólo **25 siguen sin prueba al acabar de leer**. Los otros 25 son
> marcas caducadas: dicen «deducido» de algo que acabamos de medir.
>
> **Se deja así y el texto lo dice literalmente** —«cuando se guardó esta pelea,
> el registro aún no lo había escrito a mitad de frase»—, que es verdad. Cerrarlo
> del todo pide persistir el conjunto de formas atestiguadas junto al almacén y
> preguntarlo al leer; se intentó limpiarlo reescribiendo el fichero al final de
> la reconstrucción y **se revirtió**: cambia los desplazamientos del índice y
> con ellos el `uid`, que es la identidad de una pelea. **No el día antes de
> publicar.**

#### La reconstrucción, y por qué se fuerza

`FORMATO_VERSION` y `RECONSTRUIR_DESDE` suben a **11**. Las dos cosas que cambian
—la forma guardada y la marca de deducido— **no se pueden arreglar leyendo
mejor**: la prueba está en el registro, no en la pelea guardada. Cuesta **25,5 s
para 74,6 MB**, medido.

**Y el riesgo conocido, medido antes y después.** Reconstruir puede cambiar el
emparejamiento de alguna pelea: antes había **1 repetida de 1.547** en el almacén
de Miguel. Tras reconstruir sobre una copia: **1.578 peleas y 1 repetición**.
Sigue siendo una.

#### La separación en dos campos: 1.16.0

**No entra ahora**, y va con la interfaz, donde el cambio de formato viene igual.
Lo que hoy se enseña es `r.name`; separarlas de verdad pide **dos campos por
combatiente** y que todo lo que compara pase a la clave y todo lo que pinta al
rótulo.

### 2.6 La pelea repetida: una, no noventa

**Perseguido porque era un residuo, y un residuo es una pista.** El resultado
tiene dos mitades y la primera es mía.

> **CORREGIDO el mismo día.** Dije **«90 líneas repetidas de 1.493, el 6 %»**.
> Agrupé por `(at, total, duration)` leyendo `at` **del registro completo de la
> pelea**, donde ese campo **no existe** —`at` vive en el índice, y la pelea
> completa guarda `start`—. Con `at` siempre `undefined`, la clave quedaba en
> `undefined:46088:126` y **peleas distintas que coincidían en total y duración
> colisionaban**. Es la tercera vez en dos días que un arnés mío da por bueno un
> campo sin abrirlo.

**Contado sobre el índice, que es donde `at` está:**

| | |
|---|---:|
| entradas del índice | **1.547** |
| claves lógicas distintas | **1.546** |
| **repetidas** | **1** |

**Y la que hay dice de dónde viene.** Las dos entradas son la pelea del 15 de
agosto a las 14:34:53 —126 s, 46.088 de daño, `Cleric of Innoruuk ×2, a forsaken
revenant`— con `id 8` la primera y **`id 1`** la segunda. El `id` es el contador
del rastreador y **vuelve a 1 en cada arranque**: las dos copias son de **dos
sesiones distintas**, y la segunda volvió a cerrar y a guardar una pelea que ya
estaba. Los cuerpos no son idénticos byte a byte —difieren en dos— así que no es
una escritura doble: es **la misma pelea contada dos veces por dos arranques**.

**Lo que no explica todavía:** por qué la guarda de `append` no la paró. Compara
`logicalKey({at, total, duration})` contra lo cargado, y las dos entradas tienen
**el mismo `at`**, así que la clave casaba. Para que se colara, `this.seen` tenía
que estar vacío o incompleto en ese arranque — un `load()` que no llegó a leer el
índice entero. **Clasificado B**: hoy no cambia nada porque `load` la descarta al
leer, pero es la única de 1.547 y la puerta por la que entró sigue abierta.

**Y la lección de método, que es la que se queda:** un residuo del 6 % y un
residuo del 0,06 % piden la misma comprobación, y el primero era mío. **Antes de
explicar un residuo hay que comprobar que el residuo existe.**

### 2.7 Los tramos que acaban sin que muera nadie

**Medido el 16 de agosto de 2026** sobre las 1.578 peleas del almacén de Miguel y
`eqlog_Campeon_erudin.txt`. **No se ha tocado nada**: esto es la población, y la
regla se decide con los números delante.

**De dónde sale.** De una corrección de Campeón, anotada como
[D6](HECHOS-DECLARADOS.md): *Feign Death* no deja a los enemigos «callados pero
presentes» —eso era mío y era falso—: **se van**. La maniobra es enraizar a uno,
fingir muerte, que se marchen los demás, levantarse y matar al que no puede
andar. **Son dos tramos y una sola maniobra**, y el primero no es una pelea.

#### 1a · Cuántos son y cuánto pesan

| | |
|---|---:|
| peleas del almacén | 1.578 |
| **sin muerte de NINGUNA parte** —ni enemigo ni Campeón— | **134 (8,5 %)** |
| su daño **hecho**, sobre el total | 182.551 de 24.528.689 — **0,74 %** |
| su daño **recibido**, sobre el total | 174.298 de 6.219.960 — **2,80 %** |
| duración | mediana **9 s** · p90 67 s · máx 443 s |

**Una de cada doce peleas guardadas no tiene una sola muerte dentro**, y pesan
mucho más en lo que recibes que en lo que haces —2,80 % contra 0,74 %—, que es
exactamente la forma de un tirón abortado: te pegan y no matas.

#### 1b/1c · Por qué acabaron

| | |
|---|---:|
| con un **Feign Death** cerca del final | **81 (60,4 %)** |
| con **cambio de zona** | 8 |
| con **invisibilidad** | 2 |
| con Gate / Origin / Evacuate | 0 |
| **SIN MANIOBRA DETECTABLE** | **43 (32,1 %)** |

**Un tercio no tiene causa escrita.** Ésa es la cifra que decide, y dice que una
regla que sólo mire el *feign* dejaría fuera a uno de cada tres.

#### 2 · Lo que el registro dice del propio Feign Death, y es poco

| forma | veces |
|---|---:|
| `You begin casting Feign Death.` | **391** (en **351** racimos) |
| `Campeon has fallen to the ground.` — **el éxito** | **40** |
| `Your Feign Death spell is interrupted.` — **el fallo al lanzar** | **51** |
| **ninguna de las dos** | **300 (76,7 %)** |
| `stands up` o equivalente — **el levantarse** | **0 en 990.051 líneas** |
| `You are no longer feigning death, because a spell hit you.` | 42 |

> **NO SE PUEDE SABER DESDE EL REGISTRO SI UN FEIGN DEATH FUNCIONÓ.** Sólo el
> **11,4 %** de los racimos escribe la línea de éxito, y no lo explica estar en
> combate o no: **11,0 % dentro de una pelea, 11,9 % fuera**.
>
> **Cualquier regla que dependa de «el FD funcionó» es inconstruible.** Lo más
> que puede decir una etiqueta es «hubo un **intento** de FD al final».

**Y no hay línea de levantarse.** El final del fingimiento sólo se sabe porque
vuelves a actuar — salvo cuando lo rompe un hechizo, que sí tiene línea propia.
**Es el mismo problema que la mascota enemiga**: un estado cuyo final el registro
no escribe. La diferencia es que aquí **no hace falta sostener nada**, así que no
lo hereda.

#### 2 · ¿Se van casi todos y queda uno?

**No como patrón dominante.** De los 81 tramos con FD, **42 tienen dos o más
enemigos**:

| | |
|---|---:|
| queda **exactamente uno** — la maniobra que describe Campeón | **12** |
| no queda **ninguno** | 11 |
| quedan **varios** | 19 |

Y de los 39 restantes, **23 son de un solo enemigo que sigue apareciendo
después**: ni se fue ni murió.

**La maniobra existe y es 12 de 42.** No es el patrón que explica el conjunto, y
por eso no puede ser la regla.

#### Y `King Tranix` no era esto

Es uno de los 15 pares de fronteras sospechosas, y con las líneas delante **no
encaja en la categoría**:

```
21:16:32  You begin casting Feign Death.
21:16:32  You regain your concentration and continue your casting.
          (ni «has fallen to the ground» ni «spell is interrupted»)
21:16:33 … 21:16:45   catorce segundos sin una sola línea suya
21:16:46  King Tranix begins casting Shadow Vortex.   <- VUELVE
```

**Los enemigos vuelven, los mismos, catorce segundos después.** No se fueron. Y
el registro **no dice si el fingimiento funcionó**. Así que el caso sigue sin
causa escrita: lo único medido es el silencio.

#### Lo que NO se hace con estos tramos

- **No se fusionan.** Los que se fueron no participaron en la muerte de después,
  y unirlos fabricaría una pelea de cinco donde cuatro no hicieron nada — el
  fallo del sostén del *mez*, cometido por nosotros.
- **No se borran.** El daño recibido es real: 174.298 puntos.
- **Y no se inventa la regla**: con un 32,1 % sin causa detectable y la maniobra
  explicando 12 de 42, los números no sostienen todavía ninguna de las tres.

**La forma que probablemente tendrá es una ETIQUETA y no un filtro** —«este tramo
acabó sin muertes», visible, abrible y fuera de las medias— pero eso se decide
con esta tabla delante y no antes.

## 3. Reaparición: la medición, su código, y por qué esto sí puede existir

**Nada de esto es una función. Es medición y lectura.** Miguel quiere que al matar
un enemigo empiece una cuenta de cuánto queda para que vuelva; lo que sigue es lo
que el registro permite decir y lo que su código ya aprendió.

**Todas las cifras nuestras son del 16 de agosto de 2026**, sobre
`eqlog_Campeon_erudin.txt` (985.189 líneas con cabecera, hasta el 16 a las 00:24)
y un almacén reconstruido ese día desde ese mismo fichero (1.504 peleas con
combatientes).

### 3.1 Lo primero, porque si falla no hay nada que construir: ¿dónde ancla el reloj?

**El registro NUNCA escribe «ha aparecido».** Lo comprobado, no supuesto: un
barrido buscando *«begins to emerge»*, *«has spawned»*, *«materializes»*,
*«emerges»*, *«wanders in»* y seis formas más **no encuentra ni una sola línea del
juego**. Los únicos aciertos son **conversación de jugadores** por el canal
General. **Cero anuncios de aparición**, y eso no es una laguna del parser: es una
propiedad del registro. Lo dice también su código, y mejor: *«EQ logs
interactions, not presence»*.

Así que lo único observable es **la muerte** y **la primera línea posterior que
nombra al bicho**. Que eso valga algo depende de dónde ancle el reloj del juego, y
[`HECHOS-DECLARADOS.md` D2](HECHOS-DECLARADOS.md) lo convirtió en una predicción
falsable con dos dibujos distintos: **suelo duro** (reloj desde la muerte) frente a
**racimos en múltiplos** (ciclo fijo de zona).

**LA PRUEBA QUE LOS SEPARA DE VERDAD, y no es el histograma.** Las dos hipótesis
predicen lo mismo cuando varios bichos mueren a la vez. Se separan cuando mueren
en instantes distintos: si el reloj es **por bicho**, la vuelta es *muerte + T* y
crece con la muerte; si es **de zona**, la vuelta es el siguiente tic y **quien
muere más tarde espera menos**. O sea: la pendiente de *vuelve* contra *muere*.
**1 = por bicho. 0 = de zona.**

| | |
|---|---:|
| visitas a una zona con ≥3 nombres distintos | 13 |
| observaciones | 172 |
| **pendiente de `vuelve` contra `muere`, centrada por visita** | **0,976** |

**Sale la primera forma: el reloj arranca en la muerte.** D2 queda **apoyada por
medición**. Y con ella, las series: `a ghoul sentinel` en Old Guk da 9:29 · 9:30 ·
10:45 · 12:15 · 15:20 · 19:49 — **suelo duro y desparrame hacia arriba**, que es
exactamente el dibujo predicho. No hay racimos en 2T ni 3T.

**LA SALVEDAD, y hay que ponerla porque es la única alternativa viva:** un
**circuito** de Miguel a ritmo fijo daría pendiente 1 igual. Lo que la descarta es
que dentro de una misma visita los intervalos van de **1:03 a 41:56**: no hay
vuelta fija. Y el suelo por zona es demasiado apretado —±2 s entre nombres
distintos— para ser un recorrido humano.

### 3.2 El filtro: un nombre no es un punto de aparición

Si `a kobold shaman` sale en cinco sitios de la zona, el rato entre dos muertes
suyas no es una reaparición: es lo que tardaste en encontrar al siguiente.

**Con el discriminador que ya teníamos** —descartar todo nombre que alguna vez
tuvo dos individuos vivos a la vez: dos muertes en una misma pelea, o el detector
X→X con prueba dura sobre él (§1.2)—:

| | |
|---|---:|
| nombres con muertes en el registro | 461 |
| ...con **más de un individuo probado** | **124** |
| **caen** | **123** |
| **sobreviven** | **338** |

**Y NO BASTA, y el propio dato lo dice.** Ese filtro sólo ve simultaneidad
**dentro de nuestras peleas**, y el registro trae las muertes de todo el mundo:
`an orc centurion` en West Freeport pasa el filtro y da intervalos de **3, 9, 10,
12, 15, 18 y 21 segundos** — los guardias de la ciudad matando orcos sin parar.

**El segundo filtro sale del propio dato y no de un umbral elegido:** *un intervalo
de segundos no es una reaparición bajo NINGUNA de las dos hipótesis*. Así que un
mínimo por debajo del minuto **prueba** que ese nombre tiene más de un individuo.

**Y ELLOS MIDIERON EXACTAMENTE ESE UMBRAL, lo cual es la mejor confirmación que
podíamos tener** (`src/main/modules/respawn.ts:64-74`): su `MIN_GAP_MS` son
**60.000 ms**, y su nota dice *«MEASURED, not chosen»* — de las 394 reapariciones
que su tabla de wiki cuantifica, **la más corta es de 78 s** (`Groi Gutblade`), el
percentil 1 es 165 s y la mediana 22 minutos. **Nada de lo documentado del juego
se acerca a un minuto.** Dos números independientes, el mismo sitio.

### 3.3 La medición, con tres reglas de higiene que cambian el resultado

1. **La aparición tiene que ser DE COMBATE.** Una línea de botín nombra al
   cadáver, no al bicho vuelto.
2. **Un cambio de zona invalida lo pendiente.** Si te fuiste y volviste, el
   intervalo mide el viaje. **993 intervalos descartados por esto**, y son los que
   daban los 65 h. *(Ellos tienen la misma regla y con el mismo argumento:
   `sameStay`, «a gap spanning "I killed it Tuesday and came back Friday" is a true
   bound of three days that tells nobody anything».)*
3. **Su propia muerte también es una aparición.** Sin esto, una aparición se
   empareja con varias muertes pendientes y salen intervalos correlacionados **que
   parecen racimos y no lo son** — casi cuelo un hallazgo por ahí.

**Y LA MEDIDA ES DE MUERTE A PRIMERA APARICIÓN, no de muerte a muerte**, que es
más ajustada: quita el rato que tardaste en volver a matarlo. Ellos usan
muerte→muerte. **Ninguna de las dos es «el respawn»:** entre que el bicho vuelve y
la primera línea pasa el rato que tardasteis en veros, y ese rato **no se puede ver
ni acotar desde el registro**. El mínimo es la mejor **cota superior**, nunca una
medida.

| | |
|---|---:|
| pares (zona, nombre) con al menos un intervalo | 156 |
| con **n ≥ 2** | **70** |
| con **n ≥ 5** | **19** |
| de los 70: con mínimo < 1 min → dos individuos, probado | 32 |
| **CANDIDATOS** (mínimo ≥ 1 min) | **38** |
| ...de ellos con n ≥ 5 | **3** |

**Los suelos observados se agrupan en RACIMOS dentro de cada zona** — varios
nombres distintos cayendo en el mismo valor a un par de segundos:

| zona | racimos observados | en qué nombres |
|---|---|---|
| Clan Crushbone 4 | **8:04 – 8:06** y **10:25 – 10:33** | `marrowbane`, ``ambassador D`Vinn``, `bloodgurgler`, `emperor Crush` · `lord Darish`, `royal guard pet`, `bonefire`, `orc warlord` |
| Befallen 2 (Adaptive) | **4:27 – 4:31** | ``kahaptra Z`Taj``, `an elf skeleton`, `the thaumaturgist`, `gynok Moltor` |
| The Ruins of Old Guk 2 y 3 | **9:29 – 9:31** | `a ghoul sentinel`, `the ghoul arch magus` (en dos instancias distintas) |
| The Ruins of Old Paineel 2 | **1:50 – 1:52** | `an elemental capturer`, `an elemental wizard` |

Y **no salen en las mismas horas absolutas**: `the thaumaturgist` da 4:29 a las
20:29 y 4:29 a las 14:06 de otro día. **No es un pulso de zona; es la cuenta de
cada bicho**, con un valor que varios bichos de la zona comparten. Que Miguel lo
vea a los pocos segundos es plausible: en Befallen está campando una sala pequeña
y el bicho reaparece encima. El análisis del racimo, con su control, en §3.7.

### 3.4 Las tres preguntas que deciden si esto existe

**(a) ¿Hay datos, o son cuatro gatos?** **Contando por pares, son cuatro gatos.**
70 pares con n≥2 suenan a bastante; los que sobreviven al segundo filtro son
**38**, y **sólo 3 tienen n≥5**. **Contando por RACIMOS, no**: el de 8:04 de
Crushbone junta cuatro nombres con doce observaciones entre todos, y el de 4:27
de Befallen otros cuatro. **La unidad de estimación decide si hay datos o no**, y
la que hay que usar es el racimo — medido en §3.7. **Y crece sola con el juego**:
cada muerte campada añade una muestra.

**(b) ¿Se agrupan los mínimos en valores redondos?** **No en valores redondos, y
tampoco «uno por zona» — pero sí en RACIMOS, y eso está medido con su control**
(§3.7): **16 parejas de nombres distintos de la misma zona comparten mínimo
dentro de 5 s, contra 4,5 que da el azar; p < 0,0001**. Lo que **no** se sostiene
es que la zona tenga un valor único: descomponiendo la varianza, F = 2,16 con
p = 0,15. **Hay estructura y no es la que yo dije primero.**

**(c) ¿Hay alguna línea que anuncie una aparición?** **No. Cero.** Contestado
arriba: el barrido sólo devuelve conversación de jugadores. **La medición se queda
en cota superior y no puede pasar a valor.** Es la respuesta que esperábamos y
había que buscarla, porque hoy esas líneas irían al cajón sin que nadie las mirara.

### 3.5 Su `respawn.ts`: 1.242 líneas, y no son una tabla

**El negativo útil no se da: NO es una búsqueda en tabla con formato bonito.** De
las 1.242 líneas, la tabla es lo de menos. Lo que modela:

**LA ESCALERA DE TRES PELDAÑOS** (`resolveRespawn`), y el orden es el hallazgo:

1. **tu número** — lo escribiste tú. *«Nothing outranks a user who camped the spot.»*
2. **tus muertes** — el hueco más corto entre dos muertes **que tú presenciaste**,
   con el suelo de la wiki por debajo.
3. **la wiki** — el defecto antes de que el peldaño 2 tenga nada, y el suelo bajo él.

Y la razón de que el peldaño 2 sea **el mínimo y no la media**, que es nuestra
doctrina escrita por otro: *«the minimum converges downward onto the truth as you
camp, where an average would sit permanently above it and drift with how distracted
you were»*. Toda superficie que lo imprime lo imprime **con «≤» y con el n al
lado**.

**LA WIKI ES UN SUELO, NO UN DESEMPATE**, y el motivo es nuestro problema del §3.2:
dos puntos de aparición con el mismo nombre hunden tu mínimo por debajo del ciclo
real, y el número de la wiki es la guarda barata contra eso. Y **el número del
usuario no se acota nunca**: *«they are looking at the spawn; the wiki is describing
a different server»*.

**EL SEGUIMIENTO ES OPT-IN, POR BICHO**, y esto es una cicatriz de producto que nos
ahorra el prototipo: la primera versión clocaba todo aquello para lo que la wiki
diera una duración, **y el dueño la tiró después de usarla**. El argumento es del
juego: los nombres de EQ están **masivamente duplicados**, así que un reloj que el
jugador no ha pedido es un reloj sobre un bicho que la aplicación no puede
identificar.

**«VISTO» NO ES «HA APARECIDO», y la cicatriz es la más afilada de la función:** el
dueño estaba matando un bicho vigilado que había aparecido a su hora, llegó tarde,
**el bicho le estaba pegando** — y la fila decía «venció hace 4 min». La cuenta no
se equivocaba en la estimación: se equivocaba de **pregunta**. Desde entonces una
fila con una línea que nombra al bicho lee **UP** en vez de vencida. Y la otra
mitad, que es la que importa: **una vista NUNCA reajusta sola el horario** —ver
algo prueba que está, no dice cuándo apareció—; mover la base a la vista es una
acción explícita del usuario y la fila queda marcada `basis: 'sighting'`.

**LO QUE NUNCA HACE:** no afirma que el bicho esté; dice que **la cuenta venció**.
*«A spawn this app did not see cannot be reported, a placeholder cycle can put the
trash mob there instead, and none of that is in the log.»*

**Y AHORA, LOS CUATRO CONCEPTOS QUE SE PREGUNTABAN, con la pregunta a nuestro log:**

| concepto | ¿lo modela? | ¿se ve desde nuestro registro? |
|---|---|---|
| **(a) placeholders** | **NO.** Aparecen sólo como *modo de fallo* declarado en prosa, y como **texto verbatim de la wiki en 9 de sus 507 filas** (`gynok moltor → «16.0 min (PH)»`, `ambassador dvinn → «9 mins; orc pawn as PH.»`) | **no directamente.** Se vería como series alternadas de nombres distintos en el mismo punto, y no está medido |
| **(b) repoblación de zona** | **NO.** El reloj es por `(zona, bicho)`; la zona sólo **filtra lo que se enseña**, nunca es el reloj | **sí, y medido: no la hay.** Pendiente 0,976 (§3.1) |
| **(c) varianza / margen aleatorio** | **NO.** Ni un margen, ni una ventana, ni un rango. Cuando la wiki da un rango (*«6-8 hours»*, *«2-7 days (random)»*) **lo RECHAZAN**: *«the wiki is stating that it does not know the number, and picking an end of the range would be inventing one»* | **no con n=3.** Haría falta mucha más muestra por par |
| **(d) diferencias por servidor** | **como salvedad, no como dato**: es la razón de que el número del usuario no se acote con la wiki | **sí, y ya se ve** — ver §3.6 |

### 3.6 El valor consultado: la fuente, la cobertura, y el primer desacuerdo

**La fuente es `eqlwiki.com`**, y lo dice su propio fichero: `source:
"eqlwiki.com — |respawn_time on every page in the committed mob catalog"`,
`scrapedAt: "2026-08-11"`. **Ahí es donde hay que ir**, no a su fichero: mismo
dato, sin su licencia de por medio, y con **nuestra** fecha de extracción.

**LA GRANULARIDAD, que era la pregunta:** su tabla es **por NOMBRE DE BICHO**.
`{ key, page, text, seconds }` — **no lleva zona ni punto de aparición**. Así que
`a froglok guk shaman` tiene un número para las cuatro zonas en las que ese nombre
significa cosas distintas, y su propio comentario lo admite. **Nuestra medición sí
es por (zona, nombre)**, que es más fino que la fuente.

**LO QUE VALE ESA FUENTE, medido por ellos** (`respawnWiki.ts`, barrido del 10 de
agosto sobre las 7.872 páginas de su catálogo): **522 páginas (6,6 %)** traen el
campo, **411** en formato legible, **111** dicen cosas como *«Triggered»*, *«?»*,
*«Night»*, *«84 - 86 hours»* o *«2-7 days (random)»*. En las cuatro mazmorras que
les pidieron: **28 de 184 (15 %)**.

**Y LO QUE VALE PARA MIGUEL, medido por nosotros contra su tabla:**

| | |
|---|---:|
| filas en la tabla | 507 |
| nombres que Miguel ha matado | 441 |
| **cubiertos** | **46 (10,4 %)** |

| zona de Miguel | cubiertos / nombres |
|---|---:|
| Befallen 2 (Adaptive) | 13 / 48 |
| The Plane of Sky | 10 / 36 |
| The Plane of Fear (todas las variantes) | 5 / 15–30 |
| The Ruins of Old Guk 2 (Adaptive) | 4 / 48 |
| Clan Crushbone 4 (Refined) | **1 / 32** |
| The Warrens | **0 / 44** |

**Para nueve de cada diez cosas que Miguel mata, no hay valor consultado que
traer.** Eso hay que saberlo hoy y no después: **la columna consultada de esta
función estaría vacía casi siempre**, y la que sostiene la pantalla es la medida.

**Y EL PRIMER DESACUERDO YA ESTÁ AQUÍ, que es la mitad interesante.** Cruzando su
tabla con nuestros mínimos:

| bicho | wiki | nuestro mínimo | lectura |
|---|---:|---:|---|
| ``kahaptra Z`Taj`` | **4:27** (267 s) | **4:27** | **coinciden al segundo** |
| ``asaka L`Rei`` | 4:27 (267 s) | 4:57 | coherente: nuestra cota está por encima |
| `emperor Crush` | 9:00 (540 s) | **8:06** | **por DEBAJO del suelo de la wiki** |
| `an elf skeleton` | 6:40 (400 s) | **4:27** | **por DEBAJO**, y justo en el suelo de la zona |
| `gynok Moltor` | 16:00 «(PH)» | 4:31 | su propio texto avisa: hay placeholder de por medio |
| `the thaumaturgist` | *no está* | 4:28 | sólo medido — y cuadra con la zona |
| `a ghoul sentinel` | *no está* | 9:29 | sólo medido |

**Que ``kahaptra Z`Taj`` salga 4:27 por los dos caminos —una wiki raspada el 11 de
agosto y 985.189 líneas del registro de Miguel— es la mejor validación cruzada que
ha tenido ninguna cifra de este proyecto.**

**Y los dos que salen por debajo del suelo son un hallazgo, no un error nuestro.**
Un mínimo por debajo del suelo de la wiki significa una de dos cosas, y las dos
valen la pena: **este servidor no es el de la wiki**, o **ese nombre tiene dos
puntos de aparición**. `an elf skeleton` cae exactamente en el suelo de Befallen
(4:27), lo cual apunta a lo segundo; `emperor Crush` a 8:06 en el suelo de
Crushbone (8:04), igual. **Con n=3 no se decide, y no se va a decidir aquí.**

### 3.7 ¿Es el parámetro de la ZONA? Medido, con su control

> **CORREGIDO el 16 de agosto por la noche.** Una versión anterior de §3.3 decía
> que los mínimos caen **«±2 s entre nombres distintos de la misma zona»** y lo
> presentaba como el resultado. **Eso era escoger la mitad que apoyaba la idea**:
> sí hay racimos apretados, y también hay, en la misma Befallen, mínimos de 1:29,
> 2:03, 4:57, 6:41, 7:12, 7:36 y 9:01. La cifra buena está aquí abajo.

**La hipótesis que había que probar:** si el parámetro fuera **de la zona**, la
unidad de estimación dejaría de ser el par (zona, nombre) —de los que hay 38 y
sólo 3 con n≥5— y pasaría a ser la zona, con muchas más observaciones cada una.
Merecía la pena comprobarlo con números.

**PRIMERA VERSIÓN DE LA HIPÓTESIS — «un valor por zona»: NO SE SOSTIENE.**
Descomponiendo la varianza de los 32 mínimos de las 5 zonas que tienen al menos
dos nombres candidatos:

| | |
|---|---:|
| desviación típica **dentro** de zona | 271 s |
| desviación típica **entre** zonas | 398 s |
| cociente F (entre / dentro) | **2,16** |
| **control**: repartiendo los mismos mínimos al azar entre las zonas, 2.000 veces | F medio **1,17**, y el azar iguala o supera al F real **292 veces de 2.000** |
| | **p = 0,15 — no es significativo** |

**La zona sola no explica el reparto.** Y se ve mirando: Clan Crushbone tiene
mínimos de 1:02, 1:13, 3:48, 5:20, 5:34, 8:04, 8:04, 8:05, 8:06, 10:25, 10:27,
10:33 y 10:33.

**SEGUNDA VERSIÓN — «unos pocos valores CUANTIZADOS por zona, compartidos por
varios nombres»: SÍ, Y CON FUERZA.** Contando parejas de nombres distintos de la
misma zona cuyos mínimos difieren en menos de N segundos, contra el mismo reparto
al azar 5.000 veces:

| tolerancia | parejas reales | esperadas por azar | p |
|---:|---:|---:|---:|
| 3 s | **14** | 3,9 | **< 0,0001** |
| 5 s | **16** | 4,5 | **< 0,0001** |
| 10 s | **20** | 6,2 | **< 0,0001** |

**Tres veces y media más coincidencias de las que da el azar.** Los racimos son
reales; lo que no es real es que la zona tenga **un** valor.

**QUÉ SIGNIFICA PARA LA UNIDAD DE ESTIMACIÓN, que era la pregunta.** No es la
zona, y no es sólo el par: es **el racimo**. El de 8:04 de Clan Crushbone junta
cuatro nombres con tres observaciones cada uno; el de 4:27 de Befallen, cuatro
nombres más. **Un racimo con doce observaciones es una estimación mucho mejor que
cuatro pares con tres.** Sigue siendo una cota superior, y sigue sin construirse
nada — pero la idea de agrupar era buena y ahora tiene su número.

**Lo que NO se puede decir todavía:** por qué unos nombres de la zona caen en un
racimo y otros en otro (Crushbone tiene dos claros, 8:04 y 10:30), ni si los
mínimos sueltos y bajos —1:02, 1:13, 1:29— son valores de verdad o nombres con
dos individuos que el filtro no ha cazado. Lo segundo es lo más probable y no
está medido.

### 3.8 Y los dos «desacuerdos con la wiki» encajan con su zona: la wiki no describe este servidor

**Juntando las dos tablas de arriba**, los dos casos en que nuestro mínimo salía
por debajo del valor de la wiki caen **clavados en el racimo de su zona**:

| bicho | wiki | nuestro mínimo | racimo de su zona |
|---|---:|---:|---:|
| `emperor Crush` | 9:00 | **8:06** | **8:04 – 8:06** |
| `an elf skeleton` | 6:40 | **4:27** | **4:27 – 4:31** |

**Y ESO CAMBIA LA LECTURA, porque un mínimo observado es una COTA SUPERIOR.**
«Doble punto de aparición» era la explicación alternativa: con dos individuos, el
hueco observado puede bajar por debajo del ciclo real. Pero un doble punto de
aparición produce valores **dispersos y bajos**, no un valor que **coincide con el
de otros tres bichos de la misma zona**.

**El caso fuerte es `emperor Crush`, y tiene corroboración independiente.**
``ambassador D`Vinn`` —otro nombre único de la misma zona, y la wiki también le da
**9 min**— mide **8:04**. Dos nombres propios distintos, la misma afirmación de la
wiki, y los dos por debajo y en el mismo racimo. **Dos emperadores y dos
embajadores a la vez es mucho suponer.** Y una cota superior por debajo de un
valor afirmado **falsifica ese valor**: si de verdad tardaran 9:00, no podríamos
haberlos vuelto a ver a los 8:04.

**El caso de `an elf skeleton` es más débil y por otra razón, que es la más útil
de las dos:** **la tabla de jmoyers no lleva zona**. Es `{ key, page, text,
seconds }`, y `an elf skeleton` es un nombre de bicho corriente que existe en
varias zonas. Su 6:40 puede ser perfectamente de otro sitio. **No hace falta que
la wiki se equivoque: basta con que su clave sea el nombre y el nombre no
identifique nada.**

**Y HAY UN TERCER DATO QUE APOYA EL RACIMO DESDE FUERA:** la wiki le da **el mismo
4:27** a **tres** bichos de Befallen —``kahaptra Z`Taj``, ``asaka L`Rei`` y
``footman of V`Zher``—. **La wiki también está cuantizada por zona**, sólo que sin
decirlo, y su 4:27 coincide con nuestro racimo medido. Es la validación cruzada
otra vez, ahora del racimo entero y no de un nombre.

**Conclusión, con su matiz:** para Clan Crushbone, **con los datos de hoy la
afirmación se sostiene** — la wiki dice 9:00 y este servidor no tarda tanto. Para
Befallen, **la wiki acierta el racimo** y el único desacuerdo se explica mejor por
su clave sin zona que por un error suyo. **No es «la wiki está mal»: es que la
wiki no dice de qué servidor ni de qué zona habla, y las dos cosas importan.**

### 3.9 La forma que tendría, si se construye

**Las dos columnas: el consultado predice, la medición audita.**

> «Vuelve a partir de 9:00 — wiki, consultado el 12 de agosto.
>  Tus 7 observaciones dan un mínimo de 9:12.»

Cuando coinciden, una línea. **Cuando se separan, es un hallazgo y se enseña** — es
el mismo diff que les admiramos en el botín, *«también recogido por ti, no listado
en la wiki»*, aplicado a otra cosa. **Ninguno de los dos competidores puede
hacerlo**: los dos tienen sólo la wiki, y jmoyers usa la suya como **suelo** —que
es una forma de taparlo, no de enseñarlo—.

**Tres condiciones que van con esa forma, y salen de lo medido aquí:**

- **La fecha de extracción, visible en pantalla.** Un catálogo consultado
  envejece; la suya es del 11 de agosto y no se ve por ninguna parte.
- **Nunca una cuenta atrás a un instante: una ventana con su `n`.** Prometer un
  momento es una afirmación sobre el futuro que el registro no sostiene, y con
  38 pares candidatos y 3 con n≥5, el `n` es la mitad del mensaje.
- **Cero observaciones y sin valor consultado = no hay temporizador.** No se
  inventa un valor por defecto. Con el 10,4 % de cobertura, ése va a ser el caso
  corriente y tiene que estar bien resuelto: **la superficie de descubrimiento es
  «lo que ha muerto», que no cuesta nada y no afirma nada** — su
  «Recently-killed», y la ruta por la que su dueño llegó ahí está medida arriba.

