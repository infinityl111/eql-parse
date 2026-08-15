# Estudio de los dos competidores

Lectura de **everquest-companion** (jmoyers) y **eqltools-companion** (sowoky),
los dos parsers de EverQuest Legends con código publicado, hecha como si fueran
nuestro proyecto.

Esto es **conocimiento, no un plan de trabajo**. No hay tareas aquí. Lo que se
haga con esto lo decide Miguel, con el documento delante.

**Todo lo que se afirma va con su fichero y su línea.** Lo que no se ha podido
citar, no se afirma. Donde una medición es nuestra, se dice sobre qué registro y
con qué método.

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

> **CORRECCIÓN.** Una versión anterior de este apartado daba «1.356 sucesos,
> 13.149 de daño y un corte del plazo en +68 s» para esta misma pelea. **Esas
> cifras eran incorrectas** y se dejan escritas aquí porque el motivo importa: el
> arnés que las produjo apuntaba la hora de CADA evento tras alimentarlo al
> rastreador, incluidos los que éste rechaza por irrelevantes, así que metía
> combate ajeno dentro de la pelea. Y el «+68 s» salía de suponer que el campo
> `sostenes` prueba que la pelea se habría cerrado sin el sostén — no lo prueba:
> `#sigueAbierta` devuelve en cuanto encuentra UNA ventana abierta, así que otro
> enemigo pudo mantenerla igual. Ver la undécima familia en `ui/app.js`.

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

### 5.1 El precio de esa salida, que el apartado no nombraba

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
- **NI UNA LÍNEA DE SU CÓDIGO EN ESTE FICHERO, Y ESO ES UNA CORRECCIÓN.** La
  primera versión de este documento traía **diez bloques ejecutables suyos
  pegados literalmente** —el normalizador de clave de jmoyers, el plegado de
  mayúscula de sowoky, su guarda barata de líneas de combate, el bloque de ticks
  de veneno, el bucle de presencia hostil, las cinco constantes de encuentro, la
  lista de overlays, la constante de inactividad y su barrido de cierre— y a la
  vez esta misma línea afirmaba que no había ninguno. Los diez están sustituidos
  por descripciones nuestras; **los valores y los nombres de constante se quedan,
  porque son hechos**.

  El caso urgente era el plegado de mayúscula de sowoky, que es AGPL y es
  exactamente la pieza que vamos a escribir: mientras su fuente estuviera aquí,
  no podríamos decir que la nuestra sale de la medición.
- **Las citas de prosa sí se quedan**, acortadas a la frase que sostiene el
  argumento. Son razonamiento de diseño, citado con su fichero y su línea para
  comentarlo, y ninguna supera las 51 palabras.

**Lo que falta, dicho para que no se confunda con cubierto:**

- **`src/shared/combat.ts` (1.125 líneas) y `src/main/combat/` (10.787) sólo se
  han leído en las partes de segmentación e identidad.** Toda la mitad de
  agregación —`aggregate.ts`, `rounds.ts`, `procWindows.ts`, `procDetect.ts`,
  `healing.ts`— está sin leer. Ahí es donde vive su modelo de *rondas* y de
  *procs*, y por lo que se ve en `AGENTS.md` ley 6 es sofisticado.
- **`src/shared/respawn.ts` (1.242) y toda la maquinaria de temporizadores de
  reaparición** — sin leer.
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
