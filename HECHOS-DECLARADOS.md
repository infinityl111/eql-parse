# Hechos declarados

**La cuarta categoría, que hasta hoy no tenía dónde vivir.**

Este proyecto etiqueta cada cifra con su procedencia: **medido**, **deducido**,
**declarado** o **consultado**. Las tres primeras viven en el código, al lado de
lo que sostienen. **Lo declarado no**: es una frase dicha por una persona un
martes, no tiene fichero ni línea, y hasta ahora se quedaba en la conversación y
desaparecía.

**El problema concreto que resuelve este fichero:** dentro de seis meses nadie va
a recordar si *«en la mayoría de zonas no hay placeholders»* salió de una
medición, de una wiki o de una frase. Y una afirmación cuya procedencia se ha
perdido **se comporta exactamente igual que una medida**: se cita, se apoya código
en ella y nadie la vuelve a comprobar.

## Qué entra aquí, y qué no

**Entra** una afirmación sobre el mundo que **no sale del registro** y que alguien
sostiene: mecánicas del juego, intenciones de producto, restricciones que Miguel
impone. **No entra** nada que se pueda medir: si se puede medir, se mide y se
escribe donde se usa.

## Qué lleva cada entrada

- **quién** lo dijo y **cuándo** — sin eso no es un hecho declarado, es un rumor;
- **con qué seguridad** lo dijo, con sus palabras si las hubo;
- **qué lo mediría o lo contradiría**, aunque todavía no se haya hecho;
- **el estado**: sin comprobar · apoyado por medición · **contradicho**.

**Una entrada contradicha NO se borra.** Se marca y se deja, con lo que la
contradijo al lado. Es la misma regla que
[`ESTUDIO-ARCHIVO.md`](ESTUDIO-ARCHIVO.md): la marca se queda.

**Y quién lo dice importa.** Miguel es **el único que juega**, así que para las
mecánicas del juego es la mejor fuente que tenemos — mejor que una wiki, que
describe otro EverQuest, y mucho mejor que lo que un modelo de lenguaje crea
recordar de EverQuest. Eso no lo convierte en medido: lo convierte en **declarado
por la mejor fuente disponible**, que es una categoría distinta y sigue siendo
falsable.

---

## D1 · En la mayoría de zonas de EQ Legends no hay placeholders

| | |
|---|---|
| **quién** | Miguel |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | afirmado sin reservas |
| **estado** | **apoyado por indicios, NO medido — y con excepciones documentadas** |

**Qué dice.** Un *placeholder* es un bicho corriente que ocupa el sitio de uno
nombrado y que, al morir, tiene alguna probabilidad de ser sustituido por el
nombrado en vez de por otro corriente. Miguel declara que **en la mayoría de
zonas de EQ Legends ese mecanismo no existe**: lo que muere vuelve como lo mismo.

**Por qué importa aquí y no es un detalle de lore.** Si hubiera placeholders, el
tiempo entre la muerte de un bicho corriente y la aparición de un nombrado **no
sería un tiempo de reaparición**: sería un tiempo de reaparición más una tirada de
dados. Toda la medición de reaparición (§20.3 del estudio) se apoya en que **el
mismo nombre vuelve como el mismo nombre**.

**Qué lo mediría.** Desde el registro, indirectamente: si hubiera placeholders,
un punto de aparición daría **series alternadas de nombres distintos** con el
mismo intervalo entre muertes consecutivas. Es medible y no está medido.

**Qué lo contradiría.** Encontrar el código de reaparición del competidor
modelando placeholders para las zonas que Miguel juega.

### Lo que se sabe el 16 de agosto, y no es limpio

**1 · SU CÓDIGO NO LOS MODELA.** Leído `src/shared/respawn.ts` (1.242 líneas) y
`src/main/modules/respawn.ts`: **no hay modelo de placeholder**. Aparecen sólo
como **modo de fallo declarado en prosa** —*«a placeholder cycle can put the trash
mob there instead, and none of that is in the log»*— y como **texto verbatim de la
wiki en 9 de las 507 filas** de su tabla: `gynok moltor → «16.0 min (PH)»`,
`ambassador dvinn → «9 mins; orc pawn as PH.»`, `equestrielle the corrupted →
«60 min (Placeholder: a mist wolf)»`. **No hay contradicción con D1: su código
tampoco los modela.** Lo que sí dice su wiki es que **existen en algunos sitios**.

**2 · Y HAY UNA QUINTA PROCEDENCIA QUE NO TENÍAMOS: LO OÍDO.** El propio registro
de Miguel trae conversación del canal General, y en ella hay evidencia directa
sobre esto — **de jugadores, citando notas de parche**:

```
[4 ago 13:35] Naamarulla: 'thats what it says. removed placeholders from named
                           spawns in the city of guk'
[4 ago 13:35] Thalix:     '* Removed placeholders from named spawns in The City of Guk'
[4 ago 14:37] Chuggy:     'seems upper guk get PH changed too'
[11 ago 18:45] Suave:     'woo ghoulbane was quite hard to farm, glad there are
                           no placeholders...'
[13 ago 10:11] Shaoladin: 'if u have to kill PH's, charm the ph and make it die
                           fighting 20 mobs is a way to avoid faction hit'
[15 ago 11:59] Xorlosch:  'you need Keys from placeholders - i think there where 3'
```

**Lectura honesta: D1 va en la dirección correcta y no es universal.** El servidor
**los ha ido quitando** —hay notas de parche citadas para Guk— y a la vez **siguen
existiendo en otros sitios**, porque hay jugadores hablando de matarlos. Miguel
dijo «en la MAYORÍA de zonas», y eso es compatible con todo lo anterior.

**ESTO NO ES UNA MEDICIÓN Y NO PUEDE SERLO.** Es chat de terceros dentro de
nuestro registro: no es medido, no es declarado por Miguel, no es consultado en una
fuente que podamos citar con fecha. **Es OÍDO**, y es la categoría más débil de
todas. Se anota porque existe y porque el día que alguien la cite hay que saber de
dónde salió.

**Lo que seguiría faltando para medirlo:** series alternadas de nombres distintos
en el mismo punto de aparición. No está medido y es caro: haría falta separar
puntos de aparición, y **el registro no los distingue**.

---

## D2 · El reloj de reaparición arranca cuando el bicho muere

| | |
|---|---|
| **quién** | Miguel |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | **con reserva, puesta por él**: *«si no me equivoco»* |
| **estado** | **APOYADA POR MEDICIÓN** — 16 de agosto de 2026 |

**Qué dice.** El temporizador de reaparición de un bicho empieza a contar **en el
instante de su muerte**, no en un ciclo fijo de la zona.

**Por qué es la declaración más valiosa de las dos: es falsable, y con un dibujo
distinto para cada respuesta.** El registro **nunca escribe «ha aparecido»**, así
que lo único observable es la muerte y la primera línea posterior que nombra al
bicho. Que eso sirva de algo depende enteramente de dónde ancle el reloj del
juego:

- **si arranca con la muerte** → los intervalos tienen **suelo duro**: ninguno por
  debajo de *T*, y se desparraman hacia arriba según lo que tardaras en volver a
  verlo;
- **si es un ciclo fijo de zona** → los intervalos salen **agrupados en múltiplos**
  —*T*, *2T*, *3T*— porque a veces pillas la siguiente aparición y a veces se te
  escapa una entera.

Son dos histogramas distintos y **se distinguen sin saber nada del juego**.

**LA COMPROBACIÓN, hecha el 16 de agosto** — el detalle en
[`HALLAZGOS.md` §3.1](HALLAZGOS.md).

El histograma solo no bastaba: las dos hipótesis dan lo mismo cuando varios bichos
mueren a la vez. **Lo que las separa es la pendiente de *vuelve* contra *muere***
cuando mueren en instantes distintos — 1 si el reloj es del bicho, 0 si es de la
zona:

| | |
|---|---:|
| visitas a una zona con ≥3 nombres distintos | 13 |
| observaciones | 172 |
| **pendiente** | **0,976** |

**Sale la primera forma.** Y las series lo confirman: `a ghoul sentinel` en Old Guk
da 9:29 · 9:30 · 10:45 · 12:15 · 15:20 · 19:49 — **suelo duro y desparrame hacia
arriba**, sin racimos en 2T ni 3T.

**Miguel tenía razón, y su reserva era prudente y ya no hace falta.** Se deja
escrita porque la puso él: una declaración con reserva que resulta cierta sigue
siendo una declaración con reserva el día que se hizo.

**Y la validación cruzada, que es lo más fuerte que hay aquí:** para
``kahaptra Z`Taj``, la wiki de EQ Legends dice **4:27** y nuestro mínimo medido sale
**4:27**. Dos caminos independientes —una wiki raspada y 985.189 líneas del
registro— sobre el mismo número.

**La salvedad que se queda:** el mínimo observado **nunca es «el respawn»**. Entre
que el bicho vuelve y la primera línea que lo nombra pasa el rato que tardasteis en
veros, y ese rato no se puede acotar desde el registro. **Es una cota superior.**

---

## D3 · El *consider* es prosa, no un número: el nivel del bicho no está en el registro

| | |
|---|---|
| **quién** | medido por **Fable** |
| **cuándo** | antes del 16 de agosto de 2026 |
| **seguridad** | **medido sobre el registro** |
| **estado** | **contradice una afirmación anterior de Claude** |

**Qué dice.** La línea de *consider* del juego describe la dificultad relativa
**con una frase** —del estilo «parece que te va a costar»— y **no contiene el
nivel del enemigo**. No hay número que extraer.

**Qué contradice.** Claude afirmó lo contrario: que el nivel del bicho se podía
sacar del registro. **No se puede.** Todo lo que hoy sabemos de niveles es
derivado o consultado, nunca leído de una línea de *consider*.

**Por qué está aquí y no sólo en el código.** Porque es del tipo de afirmación que
vuelve: es plausible, suena a que debería ser cierta, y el día que alguien
necesite el nivel del enemigo va a proponerla otra vez. **La entrada existe para
que la próxima vez se lea la medición y no la intuición.**

---

## D4 · Una mascota enemiga despawnea con su dueño y no escribe línea de fin

| | |
|---|---|
| **quién** | **deducido** por Claude de la pelea del 11 de agosto |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | **deducido, NO confirmado por Miguel** |
| **estado** | **sin confirmar** |

**Qué dice.** Cuando muere el dueño de una mascota enemiga, la mascota
desaparece **sin que el registro escriba nada**: ni muerte, ni desvanecimiento,
ni despedida de ninguna clase.

**De dónde sale.** De las tres peleas que un mez sobre una mascota enemiga
mantiene unidas ([`ESTUDIO-COMPETIDORES.md` §3.1](ESTUDIO-COMPETIDORES.md)). El
sostén del mez espera un final que **nunca llega**, y sólo lo para el tope. La
mayor —11 de agosto, 11:26:24— dura 475 s y sin el sostén serían tres peleas.

**Por qué se anota como declarado y no como medido.** Porque lo que está medido es
**la ausencia**: no hay línea. De ahí a «la mascota despawnea con su dueño» hay un
paso de mecánica del juego que **el registro no puede dar**. Podría ser que la
mascota siga viva y se aleje, o que muera en silencio, o que el juego escriba algo
que no sabemos leer.

**Qué lo confirmaría.** Que Miguel lo diga —es exactamente el tipo de cosa que él
sabe y el registro no—, o encontrar la línea en el cajón de las no reconocidas.

**Pendiente:** preguntárselo. Está anotado aquí en vez de dado por bueno porque
hoy hay **código apoyado en ello** —el tope del sostén— y la nota de ese código
debería citar esta entrada.

---

## D5 · ¿Un nombre propio único puede tener dos individuos a la vez?

| | |
|---|---|
| **quién** | pregunta abierta, sin declarar |
| **cuándo** | surgió el 16 de agosto de 2026 |
| **seguridad** | **medido que SÍ ocurre; sin explicación** |
| **estado** | **pendiente de Miguel** |

**De dónde sale.** La primera corrida de `npm run imposibles` llevaba una
afirmación mía: *«un nombre propio es UN individuo: no cae dos veces en la misma
pelea»*. Saltó, y uno de los casos es real y no admite lectura suave:

```
[Fri Aug 14 00:31:12 2026] You have slain Sir Lucan D`Lere!
[Fri Aug 14 00:31:23 2026] Sir Lucan D`Lere has been slain by Jobn!

[Fri Aug 14 19:30:25 2026] You have slain Sir Lucan D`Lere!
[Fri Aug 14 19:30:55 2026] Sir Lucan D`Lere has been slain by Gann!
```

**Dos días distintos, dos matadores distintos, once y treinta segundos de
separación**, en West Freeport. `Sir Lucan D`Lere` es un named único de la
ciudad.

**Por qué importa más allá de la anécdota.** Tres cosas nuestras dan por hecho
que un nombre propio es un individuo:

- **la imposibilidad que se retiró** (ya corregida);
- **el suelo**, que se apoya en «un muerto no pega» — sigue siendo cierto, pero
  con dos ejemplares el razonamiento cuenta individuos que no son el mismo;
- **el detector X→X**, cuyo control descansaba en que un `Cannibalize` de un
  nombre propio sobre sí mismo es autolesión y no gemelos. **Si un named puede
  estar duplicado, esa distinción se afloja.**

**Lo que hace falta y no tenemos:** que Miguel diga qué es. Las candidatas son
instancias del mismo sitio que se solapan en zona abierta, un evento que
reaparece rápido, o dos versiones del NPC. **El registro no lo puede decidir**:
escribe el nombre y nada más.

**Hasta que se conteste**, ni el suelo ni ningún detector deben apoyarse en «este
nombre es único». Ninguno lo hace hoy.

**Y una consecuencia para la reaparición, que hay que dejar escrita donde se
lea.** Toda la medición de §3 de [`HALLAZGOS.md`](HALLAZGOS.md) se apoya en
separar **nombres campeables** —los de un solo punto de aparición— de los que
tienen varios. Si un «único» no es único:

- **el punto de aparición tampoco lo es**, y el intervalo entre una muerte y la
  siguiente aparición deja de medir una reaparición;
- **el filtro se resiente por donde menos se ve**: descarta los nombres con dos
  individuos *probados*, y `Sir Lucan D`Lere` no lo estaba — nunca tuvo dos
  muertes en una misma pelea hasta que las tuvo;
- **y los candidatos con racimo apretado son justo los nombres propios**
  (``kahaptra Z`Taj``, `emperor Crush`, `the ghoul arch magus`), que es la
  población que esta duda toca de lleno.

**No invalida lo medido** —la pendiente de 0,976 sale de 172 observaciones sobre
13 visitas— pero sí **acota lo que se puede prometer**: mientras esto no se
conteste, un temporizador de reaparición no puede decir «éste es el bicho»,
sólo «un bicho con este nombre».

---

## D6 · Feign Death hace que los enemigos pierdan el agro y SE VAYAN; puede fallar

| | |
|---|---|
| **quién** | Campeón |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | afirmado sin reservas, **corrigiendo a Claude** |
| **estado** | **apoyado por medición**, con un límite grande — ver abajo |

**Qué dice.** *Feign Death* hace que los enemigos **pierdan el objetivo y se
marchen de verdad**. No se quedan quietos: se van. Y **puede fallar**.

**La maniobra completa**, que es lo que da sentido al resto: se enraíza a uno de
cinco, vienen los cinco, se finge muerte, **se van cuatro**, el enraizado no
puede andar, te levantas y lo matas solo. **Son dos tramos y una sola maniobra**,
y el primero **no es una pelea: es una preparación.**

**Qué corrige.** Claude había escrito que con FD los enemigos quedaban «callados
pero presentes», como bajo un *mez*, y propuso un **sostén** que mantuviera sus
ventanas abiertas. **Es falso, y el arreglo habría sido peor que el fallo**: un
sostén habría pegado el tirón abortado con la muerte posterior y habría
fabricado una pelea de cinco enemigos donde cuatro no hicieron nada — que es
exactamente el fallo del sostén del *mez* que estudiamos en el competidor.

**Si se van, cerrar sus ventanas es CORRECTO.** La frontera no está mal puesta.

**Lo que sí falta**, y no es una regla de cierre: **el tramo previo no debería
contar como pelea**. No hubo muertes de ninguna parte, y hoy le calculamos dps y
entra en las medias.

### El límite que la medición le pone a esta declaración

**No se puede saber desde el registro si un Feign Death funcionó.** De 351
intentos, sólo **40 (11,4 %)** escriben la línea de éxito. El resto —el 89 %— no
escribe ni éxito ni fallo. Y no lo explica estar en combate o no: 11,0 % dentro
de una pelea, 11,9 % fuera.

**Consecuencia directa:** cualquier regla que dependa de «el FD funcionó» es
inconstruible. Lo más que puede decir una etiqueta es **«hubo un intento de FD al
final del tramo»**.

**Y no hay línea de levantarse.** `stands up` no aparece ni una vez en 990.000
líneas. El final del fingimiento sólo se sabe porque vuelves a actuar — salvo
cuando lo rompe un hechizo, que sí tiene línea propia («*You are no longer
feigning death, because a spell hit you.*», 42 veces).

**Pendiente para Miguel:** ¿la línea «*Campeon has fallen to the ground*» sale
sólo en algunas circunstancias, o el FD falla de verdad nueve de cada diez veces?
Es la pregunta que decide si el 11,4 % es una tasa de éxito o una laguna del
registro.

---

## D7 · Si el enemigo es un named, es siempre el mismo: nunca hay dos a la vez

| | |
|---|---|
| **quién** | Campeón |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | afirmado sin reservas |
| **estado** | **apoyado por medición, con UNA excepción sin explicar** |

**Qué dice.** En EverQuest no existen dos ejemplares del mismo *named* al mismo
tiempo. Puede morir y volver —una pelea nuestra dura hasta 475 s, tiempo de
sobra— pero **no hay dos a la vez**.

**Qué cierra, y son tres cosas de golpe:**

1. **La imposibilidad que se había retirado vuelve, bien escrita.** Decía «un
   nombre propio es UN individuo» y se retiró porque ``Sir Lucan D`Lere`` cae dos
   veces en la misma pelea. **No era falsa: estaba mal escrita.** La forma con
   filo es *«dos muertes del mismo named separadas por menos que su reaparición
   mínima medida son imposibles»*.
2. **La reaparición se estrecha y se limpia.** Todo el problema del filtro era
   «un nombre no es un punto de aparición»; con un named eso no pasa.
3. **X→X deja de probar gemelo en un named.** Si no hay dos, un named
   haciéndose daño es escudo, espinas o autolesión.

### Lo medido, y dónde falla

**Corrida la imposibilidad con la cota de 60 s** —el suelo de lo que el juego
documenta, medido por los dos lados— sobre los 108 nombres sin artículo vistos en
mayúscula a mitad de frase: **saltan 13 parejas de muertes en 5 nombres**.

| nombre | veces | la más corta | qué es |
|---|---:|---:|---|
| `Cleric of Innoruuk` | 6 | **8 s** | un **título**, no un named: hay muchos |
| `Amygdalan warrior` | 2 | **14 s** | una **raza**, no un named |
| ``Innoruuk`s Chosen`` | 1 | 48 s | un **título** |
| ``Noclin`s Pet`` | 2 | 37 s | **la mascota de otro jugador** |
| ``Sir Lucan D`Lere`` | 2 | **11 s** | **un named de verdad — explicado por [D8](HECHOS-DECLARADOS.md)** |

**NINGUNO DE LOS CINCO CONTRADICE D7.** Cuatro contradicen **la regla con la que
detectamos nameds** —son títulos, razas y la mascota de un jugador, y «sin
artículo» los mete dentro— y el quinto lo explica D8: es un named que muere dos
veces, no dos nameds.

**El quinto YA NO ES UNA EXCEPCIÓN: lo explica [D8](HECHOS-DECLARADOS.md).** Sir
Lucan muere, aparece en esqueleto con el mismo nombre y hay que matarlo otra vez.
No hay dos a la vez: hay uno que muere dos veces. Las líneas:

```
[Fri Aug 14 00:31:12 2026] You have slain Sir Lucan D`Lere!
[Fri Aug 14 00:31:23 2026] Sir Lucan D`Lere has been slain by Jobn!

[Fri Aug 14 19:30:25 2026] You have slain Sir Lucan D`Lere!
[Fri Aug 14 19:30:55 2026] Sir Lucan D`Lere has been slain by Gann!
```

**Dos días distintos, once y treinta segundos, matadores distintos** — y las dos
veces es la misma maniobra: matarlo, que salga el esqueleto, y matarlo otra vez.

**PREGUNTA PARA CAMPEÓN, con la lista delante y sin inventar nada:**

- ¿Es correcto tratar `Cleric of Innoruuk`, `Amygdalan warrior`,
  ``Innoruuk`s Chosen`` como **no** nameds, aunque se escriban con mayúscula?
- ¿Hay alguna otra forma de reconocer un named desde el registro que no sea la
  mayúscula? Porque de los 108 que la regla marca, **6 no lo son** (5,6 %).

**Hasta que se conteste, la regla «sin artículo y en mayúscula a mitad de frase»
es un SUELO con un 5,6 % de falsos positivos conocidos**, y ninguna función debe
apoyarse en ella sin decirlo.

---

## D8 · Sir Lucan tiene una versión viva y una muerta: al matarlo aparece en esqueleto

| | |
|---|---|
| **quién** | Campeón |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | afirmado sin reservas |
| **estado** | **apoyado por medición** — y **NO contradice [D7](HECHOS-DECLARADOS.md)** |

**Qué dice.** Al matar a ``Sir Lucan D`Lere`` **aparece automáticamente su versión
esqueleto**, y hay que matarlo otra vez para que suelte el objeto de misión.

**No hay dos a la vez: hay uno que muere dos veces.** D7 se mantiene entera, y la
excepción que parecía tener deja de serlo.

### Lo medido: aparece CON EL MISMO NOMBRE, y por eso no se distingue

```
[00:31:12] You have slain Sir Lucan D`Lere!
[00:31:13] Sir Lucan D`Lere is pierced by YOUR thorns for 30 points…
[00:31:13] Sir Lucan D`Lere punches YOU for 8 points of damage.
```

**Un segundo.** El mismo nombre, sin variante, sin sufijo, sin una sola línea que
diga que ha cambiado de forma. **Desde el registro esto es indistinguible de un
segundo individuo del mismo nombre.**

(El golpe de 8 puntos contra el jefe que pegaba cientos sugiere que la versión
esqueleto es mucho más débil — pero eso es una inferencia sobre un dato, no una
línea, y otros candidatos no la cumplen.)

### Una tercera categoría, y las tres se escriben igual

Hasta hoy un nombre que muere y sigue actuando sólo podía ser **varios
individuos** o **una reaparición**. Ahora son tres, con la **transformación**, y
el registro escribe las tres exactamente igual.

**Medido sobre las 990.051 líneas** —muerte de un nombre y ese mismo nombre
actuando **como sujeto** en 10 segundos o menos:

| | |
|---|---:|
| casos | **819** |
| nombres distintos | **143** |
| ...con artículo (candidatos a varios individuos) | 118 |
| ...**sin artículo** | **25** |

**La forma NO aísla la transformación.** Los 25 sin artículo están dominados por
títulos y razas que ya sabíamos que se repiten —`orc legionnaire` 19 veces,
`orc centurion` 13, `Cleric of Innoruuk` 10— y ``Sir Lucan D`Lere`` aparece con
**2**, indistinguible de ellos por la forma.

### Los doce candidatos, para preguntar

**De los nombres que parecen únicos, doce muestran la forma.** Si la
transformación es un patrón del juego y no un caso, están aquí:

| | veces |
|---|---:|
| `bazzzazzt` · `Slizik the Mighty` | 2 |
| `Eye of Veeshan` · `Dread` · `bizzzzt` · `bzzzt` | 1 |
| `Sister of the Spire` · `Master of Spite` · `Warlord Skarlon` | 1 |
| `Terror pet` · `Dread pet` · `Fright pet` | 1 |

**PREGUNTA PARA CAMPEÓN:** ¿alguno de estos tiene también una segunda versión al
morir? `Dread`, `Terror` y `Fright` son los tres del Plano del Miedo, y
`Master of Spite` y `Sister of the Spire` del Plano del Odio — si el mecanismo es
suyo, se ve aquí. **Si son varios, la transformación merece nombre propio; si es
sólo Sir Lucan, es un caso y se queda como tal.**

---

## D9 · En Plano del Cielo la muerte de un enemigo hace aparecer OTROS, con otro nombre

| | |
|---|---|
| **quién** | Campeón |
| **cuándo** | 16 de agosto de 2026 |
| **seguridad** | afirmado, con «hay algunos casos más ligados a misiones, pero pocos» |
| **estado** | **apoyado por medición** |

**Qué dice.** Al matar cierto caballo aparecen dos más —depende del nombre del
caballo— y al matar una abeja `bzzzt` aparece una `bazaatt` o similar.

**Es DISTINTO de [D8](HECHOS-DECLARADOS.md):** allí vuelve **el mismo** con su
nombre; aquí aparecen **otros** con otro nombre.

### Lo medido, y las cadenas salen solas

Sobre las 141 muertes del Plano del Cielo, buscando «muere X y en ≤10 s estrena
nombre Y»: **18 casos**, y se repiten:

| veces | cadena | huecos |
|---:|---|---|
| 4 | `bzzazzt` → `bazzzazzt` | 0, 0, 1, 1 |
| 3 | `bazzzazzt` → `bzzzt` | 0, 1, 1 |
| 3 | `bzzzt` → ``bazzt Zzzt`` | 0, 0, 0 |
| 2 | `bazzzazzt` → `bizazzzt` | 0, 1 |
| 2 | `an essence carrier` → `an essence tamer` | 0, 0 |
| 1 | `an essence harvester` → `a soul harvester` | 0 |
| 1 | **`a gust of wind` → `a windrider drake`** | 8 |

**La cadena de las abejas está entera y con sus nombres.** Y `a gust of wind` →
`a windrider drake` es, con toda probabilidad, el caballo — aunque el hueco de 8 s
lo hace menos limpio que las abejas.

**Los huecos de las cadenas de verdad son 0 o 1 segundo.** Ésa es la firma.

**PREGUNTA PARA CAMPEÓN:** ¿`a gust of wind` es el caballo? ¿Y `an essence
carrier` / `an essence harvester` son también cadena, o es que iban en grupo?
