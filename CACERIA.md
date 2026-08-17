# La cacería — dónde no hemos mirado

**Los fallos de esta semana los encontramos de refilón.** El del combate ajeno
salió midiendo otra cosa; el del segundo cero salió midiendo el primero; el de la
autolesión ajena salió poniéndole un control a un detector que íbamos a adoptar.
Los tres son buenos hallazgos y ninguno se buscó.

**Este fichero es la búsqueda deliberada.** No es una fase con final: es **un
cepillo por turno, siempre**, junto a lo que toque construir.

> **EL ENTREGABLE NO SON ARREGLOS: ES COBERTURA.** Un turno que cepilla una
> familia y no encuentra nada ha entregado lo mismo que uno que encuentra tres.
> Lo que no puede pasar es que la lista no avance.

## La regla de las imposibilidades

> **UNA IMPOSIBILIDAD ES SOBRE LO QUE ESCRIBIMOS NOSOTROS, NUNCA SOBRE EL JUEGO.**

De nuestros ficheros sabemos la verdad. Del juego sólo sabemos lo que Miguel
declara — y eso va a [`HECHOS-DECLARADOS.md`](HECHOS-DECLARADOS.md), no a un
`assert`.

**Las dos cicatrices que la escribieron, las dos del primer día:**

- «un nombre propio es UN individuo» → ``Sir Lucan D`Lere``, named único, **cae
  dos veces en la misma pelea**, dos días distintos, con dos matadores distintos.
- «el mismo nombre no cae dos veces en el mismo segundo» → **tres**
  `A decaying skeleton` a las 11:03:14, por un área.

Las dos saltaron. **La segunda era falsa. La primera no: estaba MAL ESCRITA**, y
volvió con filo en cuanto Campeón dio la afirmación buena — más abajo. Y una
heurística que salta 39 veces no enseña nada: **entrena a ignorarla**.

**Y la del nombre propio ni siquiera acusaba al mundo:** Sir Lucan D`Lere
muere dos veces porque **aparece en esqueleto y hay que matarlo otra vez**
([D8](HECHOS-DECLARADOS.md)). El mundo era como Campeón decía; lo que estaba mal
era mi lectura de él.

### La regla de los tres sospechosos

> **UNA IMPOSIBILIDAD QUE SALTA TIENE TRES SOSPECHOSOS: EL MUNDO, LA AFIRMACIÓN,
> O LA POBLACIÓN QUE ELEGISTE MIRAR.**
> **Por defecto acusamos a la afirmación, que es el único de los tres que se
> borra de un plumazo.**

**La cicatriz, y es de las que se ven enteras.** «Un nombre propio es UN
individuo» saltó cinco veces. La leí como **la afirmación es falsa** y la retiré.

**Cuatro de los cinco saltos acusaban a la POBLACIÓN** —`Cleric of Innoruuk` es
un título, `Amygdalan warrior` una raza, ``Noclin`s Pet`` la mascota de un
jugador: la regla «sin artículo» los metía dentro— y **el quinto acusaba a mi
lectura del MUNDO**: ``Sir Lucan D`Lere`` no son dos, es uno que muere dos veces
porque **aparece en esqueleto** ([D8](HECHOS-DECLARADOS.md)).

**Ninguno de los cinco acusaba a la afirmación**, que era la única a la que
acusé.

**Por qué se acusa siempre a la afirmación:** es la barata. Borrar una línea de
`imposibles.js` cuesta un segundo; revisar la población pide otra medición y
revisar el mundo pide preguntar a alguien y esperar. **La cuenta sale mal: lo que
se borra es justo lo que había costado escribir.**

**El orden bueno, y va antes de tocar nada:**

1. **¿La población es la que creo?** — ¿a quién se está aplicando la
   comprobación, y entra alguien que no debería?
2. **¿El mundo es como creo?** — a [`HECHOS-DECLARADOS.md`](HECHOS-DECLARADOS.md),
   y si no consta, se pregunta.
3. **Y sólo entonces, ¿la afirmación es falsa?**

## Cómo se clasifica lo que aparece

Cada hallazgo cae en una de tres, **y sólo la primera adelanta cola**:

| | |
|---|---|
| **A** | **cambia un número que alguien lee.** Va a la cola, delante. |
| **B** | **hoy no cambia nada, pero puede.** Se anota con su disparador escrito —«esto se romperá cuando…»— y se queda aquí. |
| **C** | **muerto.** Se borra, y se dice qué se borró. |

**Y la regla que las sostiene:** clasificar es obligatorio **antes** de tocar
nada. Un arreglo sin clasificar es un arreglo cuyo valor nadie midió.

---

## EL CONTADOR

| cepillo | estado | encontrado | A | B | C |
|---|---|---:|---:|---:|---:|
| **1 · Ramas nunca pisadas** | primera corrida hecha | **1.333 bloques** | 0 | 4 | 1 |
| **2 · Imposibilidades** | **17 corriendo, en silencio · 1 recuperada, esperando al rótulo del filtro** | 1 mal escrita · **1 recuperada, y sus 5 saltos acusaban al filtro y al mundo, no a ella** | 0 | **1** | 1 |
| **3.1 · Pertenencia** (familia 1) | **cepillado** | 2 primas | 0 | 2 | 0 |
| **3.2 · Pronombre** (familia 13) | **cepillado** | 46 candidatas, 2 reales | 1 | 1 | 0 |
| **3.3 · Número desnudo** (familia 12) | **cepillado** | 469 pinzas, 52 de la forma | 1 | **13 cubiertas** | 0 |
| **3.4 · La medición no era independiente** | *siguiente* | — | — | — | — |
| **3.5…3.12 · las otras nueve familias** | pendientes | — | — | — | — |
| **4 · ¿Esta guarda hace algo?** | pendiente | — | — | — | — |
| **5 · Romper las guardas** | pendiente | — | — | — | — |
| **6 · El cajón, con otra pregunta** | pendiente | — | — | — | — |
| **7 · El oráculo tonto** | **3 propiedades corriendo** | **15 peleas cortadas en mitad del combate** | **15** | 0 | 0 |
| **8 · El punto ciego del reproductor** | **cerrado**: ejecutable y vigilado | 1 comprobación mal escrita | 0 | 0 | 1 |
| **9 · Tramos sin ninguna muerte** | **población medida** | **134 de 1.578** (8,5 %) | 0 | **1** | 0 |
| **10 · La cadena de invocación** (Sky) | **comprobado, negativo bueno** | 18 casos · **17 de 18 en una sola pelea** | 0 | 0 | 0 |

**Lo cepillado hasta hoy: 3 de las 14 familias.** Once dianas dibujadas y sin
disparar.

---

## 1 · Qué ramas no se han pisado nunca

**Medido el 16 de agosto de 2026.** Cobertura de V8 sobre **dos corridas unidas**:

- la **reconstrucción completa** del registro — 941.299 líneas leídas, 1.533
  peleas, 39,4 s;
- la **batería entera** (45 ficheros de `test/`).

Un bloque cuenta como no pisado sólo si sigue a cero **en las dos**.

| | |
|---|---:|
| ficheros nuestros cargados | 46 |
| **BLOQUES NO EJECUTADOS NI UNA VEZ** | **1.333** |
| ...funciones enteras que no se llamaron | **224** |
| ...ramas dentro de funciones que sí corrieron | **1.109** |

| grupo | bloques | funciones |
|---|---:|---:|
| `src/` | 1.186 | 152 |
| `ui/` | 111 | 54 |
| `bin/` | 36 | 18 |

| fichero | bloques | fn |
|---|---:|---:|
| `src/engine.js` | 210 | 38 |
| `src/store.js` | 112 | 8 |
| `src/encyclopedia.js` | 91 | 11 |
| `src/foes.js` | 90 | 3 |
| `src/encounter.js` | 85 | 0 |
| `src/analysis.js` | 84 | 20 |
| `src/aggregate.js` | 82 | 6 |
| `src/advisor.js` | 80 | 3 |
| `src/catalog.js` | 58 | 6 |
| `ui/reproduccion.js` | 49 | 10 |

### La salvedad, y hay que leerla con el número

**1.333 no es «código muerto».** Es «no ejecutado por estos dos caminos». La
interfaz viva, el overlay, los disparadores, el lector en directo y el compartir
**no se ejercitan en ninguna de las dos corridas**, así que buena parte de esos
bloques simplemente no estaban en el camino.

**Lo que sí es exacto, y es lo que vale:** el camino de la reconstrucción es
**por donde sale cada número que enseñamos**, y ahora sabemos qué no toca.

### La primera pesca, ya clasificada

| dónde | qué | clase |
|---|---|:--:|
| `src/relevancia.js` | **cubierto entero**. La rama del compañero declarado no la ejercita el registro —Miguel no ha declarado a nadie— pero sí `test/companeros.js`. La guarda está probada. | — |
| `src/suelo.js:108` | el **valor por defecto** `hayActividadDespues = () => false` no lo usa nadie. Un defecto que **contesta «no» en silencio** a la pregunta que decide el «+1»: quien llame sin predicado no verá fallar nada. | **B** |
| `src/suelo.js:55` | una de las dos ramas de `typeof k === 'string' ? k : k?.victim` nunca corre: hoy `kills` guarda cadenas. La otra es para el encuentro en vivo. | **B** |
| `src/guion.js` | **32 bloques, y ni uno lo pisa la reconstrucción**: `guion.js` no se carga al reconstruir. Todo lo que sabe el reproductor se ejercita sólo en `test/`. | **B** |
| `src/nombres.js:1` | el atajo `a === b` de `mismoNombre` no se estrena. | **C** al mirarlo |

**Pendiente:** clasificar las 1.333. Se hará **por cepillo**, no de una sentada —
una lista de mil trescientas cosas leída de golpe es otra alarma muerta.

---

## 2 · Las imposibilidades

**`npm run imposibles`.** Se corre **después de cada reconstrucción**. No es una
batería de pruebas: `test/` comprueba que el código hace lo decidido sobre líneas
escritas a mano; esto comprueba que **lo que hay en el disco pudo ocurrir**.

**Hoy son diecisiete —once sobre el almacén y seis sobre lo que dibuja el reproductor— y las diecisiete callan.** Las once del almacén, sobre 1.578 peleas:

1. Una pelea no dura menos que nada.
2. Nadie cae antes de que empiece la pelea ni después de que acabe.
3. En una pelea larga con varios abatidos no caen todos en el segundo cero.
4. Un hueco no es mayor que la pelea que lo contiene.
5. Todo instante de muerte corresponde a una muerte de la lista.
6. Nadie hace más daño que todo su bando junto.
7. El total de la pelea es la suma de lo que hizo cada uno.
8. Nadie está activo más segundos de los que dura la pelea.
9. No hay más instantes de muerte que muertes.
10. Nada tiene vida negativa.
11. Una proporción va entre 0 y 1.

### Lo que dio la primera corrida, que fue tumbar dos afirmaciones mías

**Escribí dos que no eran imposibilidades, eran suposiciones sobre el juego**, y
las dos saltaron:

| lo que escribí | saltó en | qué era |
|---|---:|---|
| «Un nombre propio es UN individuo: no cae dos veces en la misma pelea» | 20 peleas | **falsa.** ``Sir Lucan D`Lere`` —named único— cae **dos veces en la misma pelea**, dos días distintos, con dos matadores distintos. Las cuatro líneas están en el registro. |
| «El mismo nombre no cae dos veces en el mismo segundo» | 39 peleas | **falsa.** El registro sella al segundo y un área mata varios a la vez: tres `A decaying skeleton` a las 11:03:14. |

**La segunda, retirada (C). La primera, RECUPERADA**: Campeón dio la afirmación
buena —nunca hay dos nameds a la vez, [D7](HECHOS-DECLARADOS.md)— y con ella la
imposibilidad se reescribe con filo y encuentra el fallo de la población. Ver más
abajo.

> **LA REGLA QUE SALIÓ DE AHÍ:** una imposibilidad tiene que serlo sobre el
> **mundo** o sobre **nuestra propia escritura**. Las de en medio —«esto no suele
> pasar»— son heurísticas disfrazadas, y una heurística que salta 39 veces no
> enseña nada: entrena a ignorarla.

### Y la primera vuelve, bien escrita — porque no era falsa, estaba mal escrita

**Campeón lo corrigió** ([D7](HECHOS-DECLARADOS.md)): *en EverQuest nunca hay dos
nameds iguales a la vez*. Eso no dice que no pueda morir dos veces — una pelea
nuestra dura hasta 475 s— **dice que no hay dos**. La forma con filo:

> **DOS MUERTES DEL MISMO NAMED SEPARADAS POR MENOS QUE SU REAPARICIÓN MÍNIMA
> MEDIDA SON IMPOSIBLES.**

**Necesita la cifra de reaparición, así que las dos cosas se cerraron juntas**
([`HALLAZGOS.md` §3.9](HALLAZGOS.md)). Corrida con la cota de **60 s** sobre los
108 nombres que la regla marca como named: **13 parejas de muertes en 5 nombres**.

| salta | veces | la más corta | qué era |
|---|---:|---:|---|
| `Cleric of Innoruuk` | 6 | **8 s** | un **título**: hay muchos |
| `Amygdalan warrior` | 2 | **14 s** | una **raza** |
| ``Innoruuk`s Chosen`` | 1 | 48 s | un **título** |
| ``Noclin`s Pet`` | 2 | 37 s | **la mascota de otro jugador** |
| ``Sir Lucan D`Lere`` | 2 | **11 s** | **un named de verdad, sin explicar** |

**Cuatro de los cinco no contradicen D7: contradicen la REGLA con la que
detectamos nameds.** La imposibilidad, bien escrita, **encontró el fallo de la
población y no el del mundo** — que es exactamente lo que tiene que hacer una
imposibilidad cuando la afirmación de partida es buena.

**Y el quinto ya está contestado: [D8](HECHOS-DECLARADOS.md).** Sir Lucan
D`Lere muere y **aparece en esqueleto con el mismo nombre**; hay que matarlo otra
vez. No son dos: es uno que muere dos veces, y D7 queda entera.

> **CUÁNDO SE PUEDE INSTALAR:** cuando el filtro **diga por qué descarta cada
> uno** —«varios individuos» frente a «muertes demasiado juntas, causa sin
> determinar»—. Entonces saltará **cero veces con datos buenos**, que es la
> condición. Hoy saltaría cinco, y una que salta con datos correctos entrena a
> ignorarla.

> **La lección de método, y va con la de arriba:** una imposibilidad que salta no
> siempre acusa al dato. Aquí acusa **al filtro que eligió a quién mirar**. Antes
> de retirarla —como hice— hay que preguntarse si lo que está mal es la
> afirmación o la población.

**Y una salvedad de la cota**, porque el instrumento vuelve a ser del material
que juzga: la reaparición mínima medida es **una cota superior**, así que usarla
como suelo genera falsos positivos. Con la cota por zona salta uno más,
`lord Darish` a 7:48 contra el 8:04 de Clan Crushbone — **16 segundos de margen
sobre un número que ya es un techo**. Por eso la corrida buena es la de 60 s.

**El hueco conocido:** las once miran **el almacén**. Ninguna mira lo que el
reproductor calcula a partir de él — y el fallo del segundo cero vivía justo ahí.
La número 3 lo habría cazado corriendo sobre la salida de `guion()`. **Es la
próxima que hay que añadir**, y pide el registro además del almacén.

---

## 3 · Las familias sin cepillar

Veinticinco escritas en `ui/app.js`. **Tres cepilladas**, veintidós no.

**El orden: las que más veces han disparado.**

| | familia | veces | estado |
|--:|---|--:|---|
| 11 | la medición no era independiente de lo medido | **5** | **siguiente** |
| 15 | una herramienta de verificación que miente | 4 | pendiente |
| 16 | una advertencia no es un pie de página | **3** | pendiente · *lo primero tras el armazón* |
| 17 | una clase que significa algo no se usa por cómo se ve | 1 | pendiente · va con la 16 |
| 18 | en una misma vista, sólo una pregunta usa el color | 1 | pendiente · va con la 16 |
| 19 | entre una regla de contenido y una de forma, gana la forma | **5** | *ordena a las demás* |
| 20 | se deduce una vez, se anota, y no se vuelve a deducir | 2 | pendiente · una viva en `triggers.js` |
| 21 | que el fallo no se parezca al acierto | 3 | *método* |
| 22 | la ausencia tiene que distinguirse del fallo | 2 | en la lista de cada mudanza |
| 23 | si un lado se deduce del otro, la igualdad no prueba nada | 1 | *método* · test mecánico |
| 24 | se guarda una conclusión, nunca un asidero | **4** | pendiente · agrupa a las de identidad |
| 25 | la cobertura no contesta «¿es esto lo que pedí?» | 1 | *método* · cuarta del capturador |
| 12 | un número desnudo no cruza una frontera | 3 | cepillada |
| 1–6 | dejar que un dato inestable mande sobre una identidad | 6 | pendiente |
| 7 | salida muerta · alarma muerta | 2 | pendiente |
| 8 | la regla aplicada en un sitio y no en el otro | 2 | pendiente |
| 9 | el filtro busca el nombre y no la cosa | 1 | pendiente |
| 10 | una taxonomía inventada no falla, no ve | 1 | pendiente |
| 13 | toda forma en primera persona tiene una gemela en tercera | 1 | cepillada |
| 14 | una pinza que corrige un imposible lo vuelve creíble | 1 | cepillada |

### Lo cepillado, con sus números

**Pertenencia (familia 1, `esRelevante`).** Ningún otro sitio decide pertenencia
desde una ventana de tiempo. Dos primas: `analysis.js:143-149` **vuelve a
deducir** quién es enemigo cuando la fila no trae `side` (**B**, sólo peleas
antiguas), y el plegado de la mayúscula estaba en **seis** sitios (**B**,
unificado en `src/nombres.js`).

**Pronombre (familia 13).** De 149 reglas de `patterns.js`, **85 ancladas en
`You`/`Your`** y **46 sin gemela en su familia** — la mayoría legítimamente
tuyas. Lo que muerde no está ahí: **dos** reglas escritas **encima** de una forma
de primera persona. `REFLEXIVO` en `parser.js` (**A**, dejaba entrar 100 líneas
de autolesión ajena) y `tuyoPorLaFrase` en `guion.js` (**B**, con su disparador ya
escrito al lado).

**Número desnudo (familia 12).** **469 pinzas** en el árbol —280 `?? 0`, 50
`Math.max(0,`, 39 `Math.min(`, 36 `Math.max(1,`, 64 más— de las que **52 pinzan
un instante o una duración**. Una era **A** (la de las caídas, ya arreglada) y
**14 están en `encounter.js` con el patrón literal `Math.max(0, Math.round(t -
this.start))`**: correctas hoy porque `t` es absoluto, y **B** para siempre,
porque el día que alguien pase un `t` relativo no habrá error, habrá un cero.

---

## 4 · ¿Esta guarda hace algo? *(pendiente)*

La partición diferencial aplicada a **todas**: correr con y sin cada guarda y
contar la diferencia sobre el registro.

- **diferencia CERO** → la guarda está muerta y **engaña al que la lea**.
- **diferencia GRANDE que nadie conocía** → mirar qué es.

**Lo que ya se sabe de las tres medidas así:** el sostén del mez cambia **44
fronteras de 1.571**; la guarda de pertenencia del reproductor cambia **446
peleas a 190** y el combate entre ajenos **de 49 a 0**; la regla del sujeto en el
suelo quita **8 figuras de 72**. Ninguna es cero.

---

## 5 · Romper las guardas a propósito *(pendiente)*

Romper cada guarda y comprobar que **algo se cae**. La que se puede romper sin
que nada proteste no está protegida.

**Ya hecho en una:** `test/figuras.js`, drilada en rojo contra los tres fallos que
cubre —la escala, las caídas y la regla del sujeto—. **Las tres se pusieron
rojas.** Antes de reescribirla, sustituía el predicado por `() => true` y
`() => false`: se podía romper el código sin que la prueba se enterara.

---

## 6 · El cajón, con la otra pregunta *(pendiente)*

**57.814 líneas y 6.612 formas.** Está medido **por familias grandes** —cuánto es
adorno, cuánto es interfaz, cuánto es combate sin regla— y esa medición contestaba
*«¿cuánto nos falta por leer?»*.

**La pregunta nueva es otra:** ¿hay ahí dentro una forma que **deberíamos**
reconocer, o alguna que revele que **una regla nuestra se está quedando corta**?
No es lo mismo: la primera busca huecos, la segunda busca **desmentidos**.

---

## 7 · Un segundo cálculo tonto — el presupuesto

Una versión **lenta, ingenua y obviamente correcta**, comparada con la buena
sobre el registro real. Es lo que hace sowoky con su parser escrito dos veces.

| cálculo | coste | por qué |
|---|---|---|
| **El suelo** | **bajo** | Recorrer las líneas de cada pelea y contar muertes y actividad posterior por nombre, sin compartir un solo módulo. Unas 80 líneas, minutos de ejecución. **Ya está medio escrito**: los arneses de esta semana lo hacen. |
| **El DPS** | **bajo** | Sumar el daño por segundo desde las líneas crudas y dividir. Unas 40 líneas. **Salvedad**: hoy sólo validaría `total`, `duration` y el daño por fila — la serie del gráfico **no existe todavía**, así que la mitad del valor llega cuando se construya. |
| **La frontera de pelea** | **alto, y el coste no es el código** | El grafo de interacciones con componentes conexos y una ventana simple son 150 líneas. **Lo caro es decidir qué significa «obviamente correcto»**: si la versión tonta reimplementa el sostén del mez, las mascotas y el encanto, deja de ser independiente —es la undécima familia otra vez—; y si no los implementa, **va a diferir por motivos legítimos** y habrá que separar a mano las diferencias buenas de las malas sobre ~1.500 peleas. Ese triaje es el trabajo. |

**Recomendación:** el suelo primero —barato y con el cálculo recién tocado—, el
dps cuando exista la serie, y la frontera **sólo con un criterio de divergencia
escrito ANTES** de correrla. Si no, la comparación producirá una lista de
diferencias que nadie sabrá leer.

---

## 8 · El punto ciego: el reproductor — **cerrado**

**Dos caminos independientes lo dijeron el mismo día:** las once imposibilidades
miraban el almacén y ninguna miraba lo que el reproductor calcula; y la
cobertura de la reconstrucción **no pisa ni un bloque de `src/guion.js`**. Los
dos peores fallos de la semana vivían justo ahí, y es la función que ningún
competidor tiene, así que tampoco hay de quién copiar la vigilancia.

**(a) Ejecutable sin ventana: `npm run reproductor`.** `bin/reproductor.js`
recorre el registro una vez repartiendo líneas por ventana y llama a `guion()`
con **exactamente lo que recibe en la aplicación**. Sobre el almacén de Miguel:

| | |
|---|---:|
| escenas reproducidas | **1.578 de 1.578** |
| sucesos | **741.864** |
| actores · figuras | 6.590 · 9.042 |
| con alguna figura ajena | 182 (11,5 %) |
| ha tardado | **10,0 s** |

**(b) Seis imposibilidades sobre esa salida**, dentro de la misma lista
(`npm run imposibles -- --log <registro>`):

1. Ninguna figura cae fuera del intervalo de su pelea.
2. Ninguna figura se apaga antes de su primera acción.
3. El número de figuras es las muertes del nombre, o una más.
4. Toda figura ajena que no sea tuya ha tocado a alguien de la pelea.
5. Ningún suceso cae fuera de los segundos de la pelea.
6. Quien no entró en la escena no tiene sucesos.

**(c) Saltó una, y era mía.** La cuarta, en **2 peleas**, las dos por
**`Campeon`**: peleas en las que Miguel lanzó un hechizo sin llegar a pegar a
nadie, así que el motor no le abre fila y el reproductor lo dibuja igual —y hace
bien, estaba allí—. Además **un `lanza` no lleva destino**, así que por
construcción nunca podía «tocar» a nadie. Corregida para exceptuar al personaje y
sus mascotas: **son de la escena por definición, no por haber tocado a alguien**.
**Clase C.**

**Con eso, las 17 en silencio.** No es un aprobado: es la primera vez que hay algo
que pueda suspender.

## 7 bis · El oráculo tonto: tres propiedades para la frontera

**No se implementa una segunda frontera** — no puede ser independiente. Se
afirman **propiedades**: más débiles que la respuesta completa y por eso
comprobables.

| propiedad | salta |
|---|---:|
| Una pelea no contiene dos grupos de enemigos disjuntos separados por más de 30 s | **0** de 1.578 |
| Dos peleas seguidas con menos de 12 s de hueco no comparten un enemigo **vivo** | **15** (1,0 %) |
| Dentro de una pelea no hay un silencio mayor que el mayor sostén posible (226 s) | **0** de 1.578 |

**La segunda encontró algo en su primera corrida, y es clase A.** Quince pares de
peleas consecutivas separadas por segundos que **comparten un enemigo que no
murió en la primera**:

```
6/8  21:16:32 y 21:16:48 ·  1s de hueco · comparten King Tranix
8/8   1:20:41 y  1:22:13 ·  6s de hueco · comparten a shin ghoul knight pet
11/8 11:17:12 y 11:19:45 · 10s de hueco · comparten a ghoulish ancille
```

**`King Tranix` es un named único partido en dos peleas por un hueco de un
segundo.** Si son la misma pelea, el dps y los totales de las dos están mal.

### La regla que salió de escribirlas

> **UNA PROPIEDAD DEMASIADO FUERTE NO ENCUENTRA MÁS: ENCUENTRA RUIDO.**

**La cicatriz, del mismo día.** La primera versión de la segunda propiedad decía
«dos peleas seguidas no comparten enemigo», sin más. **Saltó 125 veces.**

Y 125 saltos no son 125 hallazgos: son **una lista que nadie va a mirar**. El
fallo estaba en la propiedad, no en el código — el mismo NOMBRE no es el mismo
individuo, y si murió en la primera pelea, el de la segunda es otro. Añadiendo
«**vivo**», quedaron **15**, y las 15 son casos de verdad.

**Ocho veces menos ruido y el mismo poder de detección.** Una propiedad que salta
demasiado no es más exigente: **entrena a ignorarla**, que es exactamente lo que
le pasó a la alarma muerta por el otro extremo. Es la misma lección que dieron
las dos imposibilidades falsas del primer día, y por eso van juntas:

|  | de más | de menos |
|---|---|---|
| **imposibilidad falsa** | salta con datos correctos | te acostumbras a verla roja |
| **propiedad demasiado fuerte** | 125 saltos donde hay 15 | nadie los abre |
| **guarda demasiado floja** | no salta nunca | parece que protege |

**Antes de añadir una comprobación hay que preguntarse cuántas veces va a saltar
si todo está bien.** Si la respuesta no es «ninguna», no está terminada.

### Dos de las quince no son un fallo de frontera

**Son una categoría de tramo que no teníamos.** Corregido por Campeón el 16 de
agosto y anotado como [D6](HECHOS-DECLARADOS.md):

*Feign Death* **no** deja a los enemigos «callados pero presentes» —eso lo
escribí yo y era falso—: **pierden el agro y se van**. Y si se van, **cerrar sus
ventanas es correcto**: la frontera está bien puesta.

**El sostén que llegué a proponer habría sido peor que el fallo.** Habría pegado
el tirón abortado con la muerte posterior y habría fabricado una pelea de cinco
enemigos donde cuatro no hicieron nada — que es exactamente el fallo del sostén
del *mez* que le estudiamos al competidor, cometido por nosotros y con el
estudio delante.

**Lo que sí hay es un tramo que no es una pelea**: la preparación de una
maniobra —enraizar a uno, fingir muerte, que se marchen los demás— que hoy
cuenta como pelea, tiene dps y entra en las medias. **134 de 1.578 peleas no
tienen una sola muerte dentro** (8,5 %), y pesan **2,80 % de lo recibido** contra
**0,74 % de lo hecho**. La tabla entera, en
[`HALLAZGOS.md` §2.7](HALLAZGOS.md).

> **Y no se puede construir la regla obvia:** de 351 intentos de *Feign Death*,
> sólo **40 (11,4 %)** escriben la línea de éxito, y **no hay línea de
> levantarse** —cero en 990.051 líneas—. **El registro no dice si funcionó.**

**`King Tranix` sigue sin causa**, y no es esto: sus enemigos **vuelven** catorce
segundos después, los mismos. No se fueron.

### Y las quince no son lo que suponíamos: cuatro cosas medidas

**Buscando qué tienen en común, las cuatro hipótesis se caen:**

| hipótesis | medido |
|---|---|
| «son jefes o nombrados» | **4 de 15**. No. |
| «el hueco ronda los 12-15 s, o sea la ventana recién expirada» | **13 de 15 tienen ≤ 6 s**, y uno tiene **0 s**. Los huecos son 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 10, 12. No. |
| «son arranques de la aplicación» —el caso conocido, con rastreador nuevo— | **0 de 15**. Los `id` son consecutivos dentro de la misma sesión: 323→324, 551→552, 1507→1508… No. |
| «son la categoría del tramo sin muertes» | **11 de 15 SÍ matan algo en la primera pelea.** No. |

**Lo que sí aparece: 8 de 15 comparten una MASCOTA** (`… pet`).

**Y el caso de 0 segundos, abierto:** 16 de agosto, dos peleas de 67 s seguidas
—`a fire giant warrior` y su mascota— con 0 abatidos en la primera y 5 en la
segunda. Ocho segundos antes del corte el registro tiene un intercambio completo:

```
13:07:50  A fire giant warrior hits YOU for 101 points of damage.
13:07:50  Konarn slashes a fire giant warrior for 72 points of damage.
13:07:50  A fire giant warrior is pierced by YOUR thorns for 40 points…
   ...
13:07:58  ← aquí se corta la pelea
```

**No hay silencio en la frontera. La pelea se parte en mitad del combate.**

> **Eso las saca de esta categoría y las sube de clase.** No es un tramo de
> preparación, no es un umbral, no es un arranque: es **una pelea cortada
> mientras se peleaba**. **Clase A**, y sin causa.

**La siguiente prueba, escrita para no volver a pensarla:** instrumentar
`#sigueAbierta` sobre uno de los quince y ver **qué ventana da por cerrada y por
qué** — es la única pregunta que queda, y sólo se contesta desde dentro. La pista
que hay: `esFoe` sólo mira `current.foesSeen` y prueba **dos** grafías; una
ventana cuyo nombre no case ahí se salta entera, y con ella la pelea se cierra
aunque el bicho siga pegando.

**Pendiente:** las quince siguen abiertas, y ahora son más graves de lo que
parecían. No se toca nada hasta clasificarlas.

## LO QUE NO ENTRA EN LA 1.15.0, con su clase

**En un sitio y no repartido por los informes.** Cada uno con lo que se sabe, lo
que costaría y por qué se queda fuera.

| # | qué | clase | por qué no entra |
|--:|---|:--:|---|
| 1 | **Los 15 pares de peleas partidas** que comparten un enemigo vivo | **A** | **Sin causa, y peor de lo que parecían**: no son jefes (4/15), ni el plazo (13/15 con hueco ≤6 s), ni arranques (0/15), ni tramos sin muertes (11/15 matan algo). En el que se abrió, **el combate es continuo en la frontera**. |
| 2 | **Los 134 tramos sin ninguna muerte** (8,5 % de las peleas) | **B** | Categoría de tramo que no teníamos, no un fallo. No se fusionan, no se borran, y la regla no se inventa: **32,1 % no tiene causa detectable** y el registro no dice si un *feign* funcionó. [`HALLAZGOS.md` §2.7](HALLAZGOS.md). |
| 3 | **La marca de «nombre deducido» sale en 50 nombres y sólo 25 son permanentes** | **B** | Se pone al cerrar cada pelea y la prueba llega después. Limpiarlo al final de la reconstrucción **exige reescribir `fights.ndjson`, y eso renombra todas las peleas** (ver `src/store.js`). Pide persistir el conjunto de formas atestiguadas. |
| 4 | **La separación clave / presentación en dos campos** | **B** | Cambio de formato del almacén. Va con la interfaz, en la **1.16.0**. |
| 5 | **`npm run ui:check` falla en `Page.captureScreenshot` a los 30 s** | **B** | **Preexistente**: falla igual con los cambios guardados en el `stash`. La parte de medición del DOM pasa antes de romperse. |
| 6 | **El valor por defecto `() => false` de `suelosDe`** | **B** | Ningún llamador de producción lo alcanza. Sigue siendo una trampa para el siguiente. |
| 7 | **`catalog.js` hace `f.uid ?? f.id`** | **B** | No se alcanza: `engine.spellCatalog` pone el `uid` antes. Pero `id` reinicia en cada arranque —1.430 distintos para 1.578 peleas— así que el día que alguien llame sin pasar por ahí, el número de peleas por hechizo sale corto. |
| 8 | **Las 1.333 ramas nunca pisadas, sin clasificar** | — | Se clasifican **por cepillo**, no de una sentada. |
| 9 | **Cepillos 4, 5 y 6 de la cacería** | — | ¿Esta guarda hace algo? · Romper las guardas · El cajón con la otra pregunta. |

### `King Tranix`, media hora de reloj: por qué se cerró la primera pelea

**No es un umbral mal puesto. Es un mecanismo del juego que no conocíamos.**

Trazado el momento exacto, línea a línea:

```
21:16:32  King Tranix hits YOU for 73 points of damage.
21:16:32  You begin casting Feign Death.
21:16:33 … 21:16:45   NADA. Ni un golpe, ni un fallo, ni un lanzamiento.
21:16:46  King Tranix begins casting Shadow Vortex.
```

El jefe estuvo **catorce segundos sin escribir una sola línea**. `PLAZO_ENEMIGO`
son **12**: a los 12 s de silencio su ventana se cierra, y con la única ventana
cerrada la pelea se cierra. Un segundo después vuelve a pegar y empieza otra.

**No es que los lanzamientos no cuenten como presencia** —sí cuentan, se
comprobó—: es que **no hubo ninguna línea que contar**.

> **CORREGIDO el 16 de agosto, y la corrección es de Campeón.** Aquí ponía
> «**Miguel fingió muerte** y el jefe perdió el objetivo», y de ahí saqué que
> hacía falta **un sostén** que mantuviera la ventana abierta mientras finges.
> **Las dos cosas estaban mal**, y la segunda era peligrosa:
>
> - con *Feign Death* los enemigos **se van de verdad**, no se quedan callados,
>   así que **cerrar sus ventanas es CORRECTO** ([D6](HECHOS-DECLARADOS.md));
> - y el sostén habría pegado el tirón abortado con la muerte posterior,
>   **fabricando una pelea de cinco enemigos donde cuatro no hicieron nada** —
>   el fallo del sostén del *mez* que le estudiamos al competidor, cometido por
>   nosotros y con el estudio delante.
>
> **Y este caso ni siquiera es feign:** el registro **no escribe** ni el éxito ni
> el fallo del fingimiento, y **los enemigos VUELVEN** catorce segundos después,
> los mismos. No se fueron. Sigue sin causa escrita.

**Lo que sí salió de tirar del hilo** es una categoría de tramo que no teníamos
—los 134 sin ninguna muerte, 8,5 %— medida en
[`HALLAZGOS.md` §2.7](HALLAZGOS.md). **No es un fallo de frontera y no se arregla
tocando el cierre.**

**Y quedan trece de las quince sin causa.** Ésas siguen abiertas.

## Lo que este fichero no es

**No es una lista de tareas.** Es el registro de **dónde hemos mirado y dónde
no**. Un cepillo que no encuentra nada se apunta igual: la próxima vez que
alguien se pregunte si esa familia está barrida, la respuesta tiene que estar
escrita y con fecha.
