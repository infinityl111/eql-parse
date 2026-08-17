# El mapa: cada elemento de la interfaz, a qué sección va

Acompaña a `INVENTARIO-UI.md`, que es de donde salen los identificadores. Aquí
**ninguna fila puede quedarse sin destino**: o va a una sección, o dice
`SE ELIMINA` con el motivo escrito al lado.

## El criterio, que es lo que decide las dudas

> **ESCENA = QUÉ PASÓ · ANÁLISIS = QUÉ DICE DE CÓMO LO HICISTE.**

Escena es el relato del combate: quién estaba, qué cayó, cuándo pegó cada uno.
Análisis es el juicio sobre tu actuación: qué postura tocaba, cuánto tiempo no
mandabas tú, quién aguantó, qué habrías evitado. Cuando un panel se pueda
defender en las dos, gana esta frase.

## Las secciones

```
MARCO            cabecera y pie, que no son de ninguna sección
LISTA            la columna de peleas, que tampoco lo es

Esta pelea       Escena · Por habilidad · Botín · Análisis · Registro
Todo el histór.  Resumen · Enemigos · Botín · Progreso · Zonas · Hechizos · Muertes
Ajustes          Avisos · Preferencias
```

**Cuatro secciones más que el prototipo no dibuja** —`Registro`, `Zonas`,
`Hechizos` y `Muertes`— van marcadas **`+NUEVA`**: hoy tienen contenido y no
caben en ninguna de las once del prototipo.

**Y una que se cae de la lista: `Reproducción`.** Ver la decisión (a).

---

## Marco y lista

| # | elemento | destino |
|---|---|---|
| M1 | Selector de idioma | MARCO |
| M2 | Marca y lema | MARCO |
| M3 | Punto de estado y texto | MARCO |
| M4–M6 | Las tres pestañas de hoy | **SE ELIMINAN** · las sustituye la barra lateral, que es el cambio |
| M7 | Personaje | MARCO |
| M8 | Zona | MARCO |
| M9 | Postura | MARCO |
| M10 | Botón de ayuda | MARCO |
| M11 | Botón de tema | MARCO |
| M12 | Botón de overlay | MARCO |
| M13 | Botón «cambiar log» | MARCO |
| M14 | Pie · líneas | MARCO (pie) |
| M15 | Pie · sin reconocer | MARCO (pie) |
| M16 | Pie · mascotas y «juntar mascotas» | MARCO (pie) |
| M17 | Pie · ruta del log | MARCO (pie) |
| M18 | Pie · crédito, versión, «acerca de» | MARCO (pie) |
| M19 | Barra de actualización | MARCO (barra) |
| M20 | Barra de migración / reconstruir | MARCO (barra) |
| M21 | Aviso de fps del overlay | MARCO (barra) |
| M22 | Caja de fallo | MARCO |
| M23 | Banner de disparadores | MARCO |
| M24 | Temporizadores en pantalla | MARCO · **pendiente**: hoy viven dentro de la vista de Combate y se apagan al entrar en una sección |
| L1–L12 | Toda la columna de peleas | LISTA · no se toca en este cambio |

## Esta pelea

| # | elemento | destino | por qué |
|---|---|---|---|
| C1 | Título con los abatidos | Escena | qué pasó |
| C2 | Subtítulo: zona, dificultad, nivel | Escena | |
| C3 | Botón Analizar | Escena → abre **Análisis** | |
| C4 | Botón Reproducir | Escena · **se queda dentro de Escena**, no cambia de pantalla | (a) |
| C5 | Botón Guardar pelea | Escena | |
| C6 | Botón Copiar | Escena | |
| C7 | Aviso de pelea dudosa | Escena · arriba, pegado a las cifras que invalida | |
| C8–C14 | Las siete tarjetas de cabecera | Escena | |
| C15 | Gráfica de daño por segundo | Escena | |
| C16 | Rótulo de la gráfica | Escena | |
| C17 | Botín de la pelea | **Botín (esta pelea)** | |
| C18 | Ficha del objeto al pasar el ratón | Botín · y donde haya objetos | |
| C19–C20 | Los dos vacíos | Escena | |
| A1 | Aviso de clases que no cuadran | Escena | interrumpe lo que estás viendo |
| A2 | Aviso de mascota sin identificar | Escena | ídem |
| A3 | Consejo de postura | **Análisis** | cómo lo hiciste |
| A4 | Procedencia del trío (`adv.src.*`) | Análisis · con A3 | |
| A5 | Desplegables de clase y «cambié de trío» | Análisis · con A3 | |
| A6 | Conflicto de clases | Análisis | |
| A7 | Consejo en vivo | **Análisis** (cambiado) | va dentro de `renderAdvice`; ver la desviación 1 |
| A8 | Nota de encanto ambiguo | Escena · dentro de A12 | qué pasó y no se sabe |
| A9 | Fuego amigo entre los tuyos | **Análisis** | cómo fue la pelea |
| A10 | Tramos sin mando | **Análisis** | |
| A11 | dps sobre el tiempo con mando | **Análisis** | |
| A12 | «Lo que esta pelea no sabe» | Escena | el bloque del prototipo |
| R1–R6 | Cabeceras de bando, filas, barras, leyenda | **Por habilidad** | |
| R7 | Rótulo emergente de fila | Por habilidad | |
| R8–R15 | El desglose de una fila | Por habilidad | |
| R16 | Controles de fila | Por habilidad · gemelo en Resumen | |
| R17 | Marca de nombre deducido | Por habilidad · dentro de R16 | |
| D1 | Documento «Aguantar» | **Análisis** | cómo lo hiciste — decisión (c) |
| D2 | Documento «Lanzamientos» | Por habilidad | de dónde sale el daño |
| D3 | Documento «Tiempo puesto» | Por habilidad | |
| D4 | Documento «Registro» | **Registro** `+NUEVA` | |
| N1–N8 | La vista de Análisis de hoy | Análisis · se funde con A3, A9, A10, A11 y D1 | |
| P1–P10 | La reproducción entera | **Escena** | decisión (a) |

## Todo el histórico

| # | elemento | destino |
|---|---|---|
| U1–U7 | Cabecera del resumen, tarjetas, filtros y avisos | Resumen |
| U8 | Expediente del enemigo del filtro | Resumen · mismo bloque que E8 |
| U9–U10 | Filas del resumen y su desglose | Resumen |
| U11 | Reparto por enemigo | Resumen |
| U12 | Botín del tramo | **Botín (histórico)** |
| U13 | Vacío del resumen | Resumen |
| E1 | Rejilla de tarjetas de la enciclopedia | **SE ELIMINA** · era el índice de una pestaña que deja de existir; sus seis destinos pasan a ser secciones de la barra |
| E2 | Pie de estado de la ficha y «rehacerla» | Ajustes › Preferencias |
| E3 | Migas de pan | se conservan **dentro** de Enemigos, Zonas y Hechizos, que siguen teniendo niveles |
| E4–E5 | Zonas y ficha de zona | **Zonas** `+NUEVA` |
| E6–E7 | Buscador y rejilla de enemigos | Enemigos |
| E8–E11 | Expediente, dificultad, habilidades, peleas | Enemigos |
| E12 | Botín agregado con sus pestañas | Botín (histórico) |
| E13–E18 | Hechizos, marcas, enfriamientos, libro, ficha | **Hechizos** `+NUEVA` |
| E19–E21 | Periodos, marcas y series | Progreso |
| E22 | Muertes | **Muertes** `+NUEVA` |
| E23 | Vacíos de cada sección | con su sección |
| — | **Lo que no se sabe (histórico)** | **NO SE CREA EN ESTE CAMBIO** · decisión (e) |

## Ajustes

| # | elemento | destino |
|---|---|---|
| V1–V6 | Voz, lectura y prueba | Preferencias |
| V7–V8 | Tabla de tríos y sus conflictos | Preferencias |
| V9 | Excluidos | Preferencias |
| V10 | Compañeros y rechazados (`mate.src.*`) | Preferencias |
| V11–V13 | Prefijo, mascotas y porcentaje al compartir | Preferencias |
| V14 | Mis mascotas y las que no lo son | Preferencias |
| V15 | Vacíos de esas listas | con su lista |
| G1–G7 | Los disparadores enteros | **Avisos** |
| W1–W7 | El asistente | FUERA DEL ARMAZÓN · flujo a pantalla completa desde M10 |
| S1–S7 | Configuración del log | FUERA DEL ARMAZÓN · desde M13 |
| X1–X4 | Rótulos, diálogos, «acerca de» y overlay | FUERA DEL ARMAZÓN |

---

## Lo decidido

**(a) Escena y Reproducción se fusionan.** Medido en la aplicación real, sobre
una pelea de ocho combatientes: el panel entero de Combate son **2.123 px**, y
lo que le quedaría a Escena con Por habilidad, Botín, Análisis y Registro fuera
son **255 px** — 38 de título, 57 de tarjetas y 160 de gráfica. Un 12 %. Es
literalmente una cabecera y seis cifras, así que se fusionan.

Y encaja con el prototipo, que ya lo decía sin decirlo: su «Escena» dibuja las
**figuras** y los **cambios de estado**, y esas dos cosas hoy sólo existen
dentro del reproductor (`ui/reproduccion.js`). El prototipo no tiene sección de
Reproducción porque su Escena **es** el reproductor parado.

Con dos consecuencias que hay que ver antes de tocar nada:

- **La gráfica saldría dos veces.** La de la cabecera (`chartHTML`) y la línea
  de tiempo del reproductor son la misma de `ui/grafica.js`; la del reproductor
  es esa más el cursor. En la fusión se queda **la del reproductor**.
- **El reproductor lee el registro del disco al montarse**, y puede fallar
  («no quedan líneas»). Montarlo siempre al abrir una pelea cambiaría el coste
  y el modo de fallo de abrir una pelea, que es la acción más frecuente de la
  aplicación. Propongo: Escena pinta cabecera, tarjetas y gráfica al abrir, y
  las figuras, la pista y el reloj se montan **al pulsar C4**, en el mismo
  sitio y sin cambiar de pantalla. Eso es mover, no añadir.

**(b) Botín agregado y Progreso entran.** No están vacíos: medido con
`npm run capturas`, `enc-botin` pinta 24.234 px de contenido y `enc-progreso`
7.486, los dos con datos reales. Lo que **no** existe hoy es la curva de nivel
en el tiempo con la experiencia sombreada del prototipo — ésa no entra.

**(c) Los cuatro se quedan en Análisis**, «Aguantar» incluido, por el criterio
de arriba.

**(d) Las tres pestañas se eliminan.** Es la única eliminación real del cambio,
junto con la rejilla índice de la enciclopedia, que era el índice de una de
ellas.

**(e) «Lo que no se sabe» (histórico) no se crea aquí.** Hoy la interfaz sólo
enseña el número total de líneas sin reconocer (M15); agregar el cajón por
forma, las muertes sin dueño, el botín ambiguo y las uniones sostenidas por un
estado es **contenido nuevo**. Queda anotada como **LA PRIMERA cosa después del
armazón**: no es una sección más, es la que dice lo que este programa es.

---

## El orden: primero las mudanzas, después las extracciones

**MUDANZA** = el panel ya existe entero, lo pinta una función suya, y sólo
cambia de sitio. **EXTRACCIÓN** = hoy vive dentro de otra cosa —una pestaña de
documento, una página de la enciclopedia, otra vista— y sacarlo toca código.

Todas las mudanzas primero. Si algo se rompe en la segunda mitad, ya sabremos
que el armazón estaba bien.

### Primera mitad · MUDANZAS

| orden | sección | qué se mueve | de dónde |
|--:|---|---|---|
| **1 ✔** | **Botín (esta pelea)** | C17, C18 | `lootHTML`, que estaba dentro de `renderHead` |
| **2 ✔** | **Escena** (sin figuras todavía) | C1–C16, C19, C20, A1, A2, A8, A12 | `renderHead`, `renderClassPrompt`, `renderPetHint`, `charmHTML`, `incertidumbreHTML` |
| **3 ✔** | **Por habilidad** | R1–R17, y de paso D1–D4, A9 y A10 | `renderRows` y `renderDocs` |
| **4 ✔** | **Análisis** | N1–N8, A3–A7, A9–A11 y D1 | `renderAnalysis`, `renderAdvice`, `entreTuyosHTML`, `sinControlHTML`, `dpsMandoHTML`, `DOC_AGUANTAR` |
| **5 ✔** | **Resumen** | U1–U13 | `renderSummary` |
| 6 | **Enemigos** | E6–E11 | páginas `enemigos`, `foe`, `foeDif` |
| 7 | **Botín (histórico)** | U12, E12 | página `botin` |
| 8 | **Progreso** | E19–E21 | página `progreso` |
| 9 | **Avisos** | G1–G7 | `renderTriggers` |
| 10 | **Preferencias** | V1–V15, E2 | `renderNarrate`, `encEstado` |

Empieza por la 1, que es la más barata: dos elementos y una función que ya
existe. Si el armazón está mal pensado, se ve ahí y no en la cuarta.

### Segunda mitad · EXTRACCIONES

| orden | sección | qué hay que sacar |
|--:|---|---|
| 11 | **Registro** | D4, hoy una pestaña de `DOCS` en `renderDocs` |
| 12 | **Zonas** | E4, E5, hoy páginas del enrutador de la enciclopedia |
| 13 | **Hechizos** | E13–E18, ídem |
| 14 | **Muertes** | E22, ídem |
| 15 | **Escena + reproductor** | P1–P10, hoy una vista propia (`#rpView`) con su montaje asíncrono |

Las 12, 13 y 14 son la misma obra hecha tres veces: disolver el enrutador
`state.enc.page` en secciones de la barra, conservando las migas **dentro** de
cada una. La 15 es la más delicada y por eso va la última.

### La paleta: enchufada en la mudanza 2, y lo que ha destapado

Los seis colores del prototipo están en `ui/styles.css` como `--c1…--c6`
—medidos para cada tema, no los mismos oscurecidos—, con `--resto` y con
`--s1/--s2/--s3` apuntando a tres de ellos. **Ya los usa la gráfica**: tu daño
es `--s1` y lo que recibes `--s2`, en el trazo, en la leyenda y en el rótulo.

Estaban pintados con `--t-cold` y `--t-ds`, que son el frío y el escudo de daño:
leída al pie de la letra, la gráfica decía que tu daño es de frío.

Se enchufó **después** de la mudanza y con su propia tanda de capturas
(`tmp/capturas-despues-paleta/`), para tener dos comparaciones en vez de una: si
algo se ve raro, se sabe si fue el movimiento o el color.

**Y queda una tercera paleta en la misma leyenda, que hay que decidir.** La
franja de posturas sigue usando los tipos de daño (`STANCE_COLOR` en
`ui/grafica.js`): `defensive` es `--t-cold`. En tema claro, ese azul y el
`--s2` de «recibido» quedan **casi idénticos y en la misma fila de leyenda**.
No lo he tocado porque cambiar los colores de las posturas es una decisión de
diseño, no una mudanza. Las salidas: darles tres de los seis, o elegir tipos que
no choquen con `--s1/--s2/--s3`.

### Desviaciones del mapa, y por qué

1. **A7, el consejo en vivo, se va a Análisis y no a Escena.** El mapa lo mandaba
   a Escena por ser de la pelea en curso, y al ir a moverlo se vio que está
   construido DENTRO de `renderAdvice`, en la misma plantilla que el resto del
   consejo. Sacarlo de ahí no es mover un panel: es partir una función en dos, y
   este cambio no toca funciones. Viaja con su panel a Análisis (mudanza 4).
2. **M24, los temporizadores, aparecen en el inventario después de empezar.** No
   estaban en la primera versión; los destapó tocar el esqueleto de Combate. Van
   al MARCO —un reloj que se apaga al cambiar de sección no sirve— y es una
   mudanza más, pendiente de meter en el orden.

### La vista vieja, medida

Después de la mudanza 4, el `<main>` de Combate tiene **0 hijos, 0 caracteres y
el HTML vacío**; lo único que queda al lado es la lista de peleas, que no es de
la vista. Medido en la aplicación, no deducido.

Eso cierra la pregunta de la pestaña de Combate: se puede quitar sin que se caiga
nada. Las otras dos **no**: Avisos y Enciclopedia siguen teniéndolo todo hasta
las mudanzas 6–10, así que la 10 sigue siendo la última y no se adelanta.

### Lo que la mudanza 4 deja escrito de los 21 textos en español

Antes de arreglarlos —que es contenido y va después— quedan contestadas las tres
preguntas que decidían si hacía falta formato nuevo:

- **Un disparador de fábrica guarda el TEXTO, no la plantilla.** Medido sobre el
  `triggers.json` real: `"name": "Te han aturdido"`, `"speak": "aturdido"`. Es
  identidad y presentación en el mismo objeto — la mayúscula otra vez.
- **NO hace falta `FORMATO_VERSION` ni reconstrucción.** `triggers.json` es
  configuración, no el almacén. La identidad ya está guardada (`id: 'stunned'`)
  y `load()` ya la usa dos veces para preferir la plantilla sobre lo guardado.
  El arreglo se hace al cargar y el fichero no se toca.
- **Queda una decisión**: qué pasa con una plantilla que el usuario renombró sin
  tocarle el patrón. Se distingue midiendo —si el nombre guardado coincide con
  el de fábrica en cualquiera de los cinco idiomas, es el de fábrica— y tampoco
  necesita campo nuevo.

Las dos notas largas están escritas donde se van a leer: en `src/triggers.js`
(una plantilla es un objeto de tres idiomas, y el patrón no se traduce nunca) y
en `electron/main.cjs` (**el proceso principal no sabe el idioma: el idioma vive
en la ventana**, así que el arreglo es hacer llegar el idioma, no sustituir
literales).

### Rótulos ya traducidos esperando en el diccionario

`npm run vacios -- --rotulos` busca claves sin camino con forma de rótulo —tres
palabras como mucho, sin variables ni puntuación—, que es como se encontró
`an.tab`. Hay **16**, y de ellas sirven para lo que viene:

| clave | dice | para |
|---|---|---|
| `foe.file` | «Ficha del enemigo» | la sección Enemigos (mudanza 6) |
| `rp.title` | «Reproducir» | el control de reproducción dentro de Escena |
| `an.roles` | «Reparto» | el encabezado que a los roles de Análisis les falta |
| `an.impact` | «Impacto» | ídem, en los hallazgos |

Las otras doce son del overlay y de los disparadores. Ninguna es un nombre de
GRUPO: «Esta pelea», «Todo el histórico» y «Ajustes» hubo que escribirlos.

Y las dos últimas son contenido —hoy esos bloques no llevan encabezado—, así que
van con las familias 16 a 18, no en una mudanza.

### Lo encontrado por el camino, que se hace APARTE

Se anota aquí y no se toca dentro de este cambio, que sólo mueve cosas de sitio.

1. **`adv.liveOk` y `adv.liveSwitch` están traducidos a los cinco idiomas y no
   los pinta nadie.** El consejo en vivo (A7) lleva el texto **escrito a mano en
   español** dentro de `ui/app.js` —«Cambia a X» / «X es la correcta ahora
   mismo»—, así que un alemán lo lee en español. Las dos frases existen,
   traducidas, desde hace versiones. Es un arreglo de dos líneas, y es un fallo,
   no una mudanza: va en su propio cambio. Lo destapó `npm run vacios`.
2. **`foe.noDiff` («sin dificultad») no lo pinta nadie**: es un duplicado
   olvidado de `enc.noDiff`, que es la que sí se usa. Se borra, en el mismo
   cambio que lo anterior.
3. **Los doce datos con clase `.hint` de Progreso** (familia 17) y **las tres
   advertencias al pie** (familia 16): van juntos y son lo primero después del
   armazón.

### Después de cada sección, las tres cosas de siempre

1. la misma pelea abierta antes y después enseña **las mismas cifras**;
2. `npm run capturas -- --salida=despues-<sección>` y comparación contra
   `tmp/capturas-antes/`;
3. el inventario tachado por donde va.

Y la navegación vieja **sigue funcionando hasta el final**: se quita en el paso
16, cuando no quede nada en ella.
