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
| A7 | Consejo en vivo | Escena | es de la pelea en curso |
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
| 2 | **Escena** (sin figuras todavía) | C1–C16, C19–C20, A1, A2, A7, A8, A12 | `renderHead`, `renderClassPrompt`, `renderPetHint`, `incertidumbreHTML` |
| 3 | **Por habilidad** | R1–R17 | `renderRows` |
| 4 | **Análisis** | N1–N8 + A3–A6, A9–A11 | `renderAnalysis`, `renderAdvice`, `entreTuyosHTML`, `sinControlHTML`, `dpsMandoHTML` |
| 5 | **Resumen** | U1–U13 | `renderSummary` |
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

### La paleta: puesta, y sin enchufar todavía

Los seis colores del prototipo ya están en `ui/styles.css` como `--c1…--c6`
—medidos para cada tema, no los mismos oscurecidos— con `--resto` y con
`--s1/--s2/--s3` apuntando a tres de ellos, como en el prototipo. **Todavía no
los usa nadie**: la gráfica sigue pintando con `--t-cold` y `--t-ds`.

Enchufarlos cambia el color de todas las gráficas, así que va **con la mudanza
2 (Escena)**, que es donde vive la gráfica, y no antes: hacerlo hoy metería un
cambio visible en todas las capturas del resto de mudanzas y no sabríamos cuál
de los dos cambios estamos mirando.

### Después de cada sección, las tres cosas de siempre

1. la misma pelea abierta antes y después enseña **las mismas cifras**;
2. `npm run capturas -- --salida=despues-<sección>` y comparación contra
   `tmp/capturas-antes/`;
3. el inventario tachado por donde va.

Y la navegación vieja **sigue funcionando hasta el final**: se quita en el paso
16, cuando no quede nada en ella.
