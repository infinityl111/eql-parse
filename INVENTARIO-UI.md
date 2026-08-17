# El inventario de la interfaz, antes de mover nada

Esto es la **red de seguridad** del cambio de armazón: la lista completa de lo
que la interfaz enseña **hoy**, con dónde vive cada cosa. Después del cambio se
compara elemento por elemento. Lo que no aparezca en el inventario de después y
no esté marcado como eliminado **es un fallo, no un olvido**.

**De dónde sale cada columna, que en este proyecto no se mezcla:**

- **Leído** — de `ui/app.js`, `ui/triggers.js`, `ui/reproduccion.js`,
  `ui/index.html` y `ui/dialogo.js`, línea a línea. Es la fuente de esta lista:
  incluye lo que sólo aparece en situaciones que hoy no se dan (una pelea con
  encanto, un histórico vacío, la wiki sin responder).
- **Visto** — comprobado en la aplicación de verdad con `npm run capturas`
  (93 peleas, registro real). Sirve para confirmar, no para enumerar: una tanda
  de capturas sólo enseña los estados que había esa tarde.

Cada fila lleva **dónde vive**: la función que lo pinta y el identificador o la
clase con que se puede encontrar en el DOM. Eso es lo que hace la comparación
mecánica posible.

Fecha del inventario: **17 de agosto de 2026**, sobre la 1.15.0.

**La foto del antes** está en `tmp/capturas-antes/`, sacada con
`npm run capturas -- --salida=antes` con la interfaz de hoy: quince secciones ×
cinco idiomas × dos temas. La del después irá a `--salida=despues-<sección>`,
en otra carpeta y a propósito: escribiéndose las dos en la misma, la segunda
pisa a la primera y al terminar no hay con qué comparar.

**Y NO sirve para comparar cifras**, que es la salvedad que faltaba cuando se
presentó como red de seguridad: Campeón juega entre tandas, así que el registro
crece y la pelea que abre el recorrido no es la misma de una tanda a otra. Dos
capturas del mismo sitio con números distintos probablemente sean dos peleas.
Para las cifras, el método es abrir **a mano la misma pelea** antes y después,
que es lo que se hace en cada mudanza. Está escrito también en
`tmp/capturas-antes/LEEME.md`, junto a las propias capturas.

**Lo que la foto cubre, y lo que no.** Cada sección son cuatro trozos de 815 px
desde arriba (`seccion.png`, `-2`, `-3`, `-4`) **más el final** (`-fin.png`)
cuando no cabe. En las seis secciones largas —botín, enemigos, hechizos,
progreso, muertes y el resumen— **falta el medio de la lista**: hasta 24.000 px
en el botín agregado. Eso es aceptable porque la fila 900 de una tabla no es un
elemento distinto de la 12; el pie **no** lo era, y por eso se dispara aparte:
allí viven las notas que cierran cada sección, y ésas sí son elementos de este
inventario.

---

## 0 · El marco, que no es de ninguna vista

`ui/index.html`, y lo pinta `renderChrome()` con cada snapshot (4 veces por
segundo).

| # | elemento | qué enseña | dónde vive |
|---|---|---|---|
| M1 | Selector de idioma | bandera + nombre del idioma actual, menú de 5 | `renderLangPicker` · `#langPick`, `.lang-item[data-code]` |
| M2 | Marca | «EQL·Parse» y el lema | `#brand`, `#brandTag` |
| M3 | Punto de estado + texto | conectado / sin log / error, con el mensaje de error si lo hay | `renderChrome` · `#dot`, `#statusText` |
| M4 | Pestaña Combate | — | `#tabCombat` |
| M5 | Pestaña Avisos | — | `#tabTriggers` |
| M6 | Pestaña Enciclopedia | — | `#tabEnc` |
| M7 | **Personaje** | nombre propio detectado | `#lblChar` / `#mChar` |
| M8 | **Zona** | zona actual, con el nombre entero en el rótulo emergente porque se recorta | `#lblZone` / `#mZone` |
| M9 | **Postura** | postura · invocación actuales | `#lblStance` / `#mStance` |
| M10 | Botón de ayuda | reabre la introducción | `#btnHelp` → `openWizard` |
| M11 | Botón de tema | claro / oscuro, con el rótulo del que vas a poner | `#btnTheme` → `applyTheme` |
| M12 | **Botón de overlay** | abre la segunda ventana | `#btnOverlay` |
| M13 | **Botón «cambiar log»** | entra en la configuración; con el botón derecho, la introducción | `#btnSetup` |
| M14 | Pie · **líneas** | líneas leídas | `#lblLines` / `#fParsed` |
| M15 | Pie · **sin reconocer** | líneas que el parser no supo leer | `#lblUnknown` / `#fUnknown` |
| M16 | Pie · mascotas | nombres detectados + **casilla «juntar mascotas»** con el total | `renderChrome` · `#fPets`, `#fMerge` |
| M17 | Pie · **ruta del log** | ruta completa; al pulsarla abre la carpeta | `#fPath` |
| M18 | Pie · crédito y versión | abre «Acerca de» | `#fCredit`, `#fVer` → `acercaDe` |
| M19 | Barra de actualización | versión nueva, tamaño en MB, descargar / instalar / omitir, barra de progreso, **notas de la versión plegadas** | `showUpdate` · `#updBar` |
| M20 | Barra de migración | reconstruir el almacén, «cambié de trío», aviso del modelo de medición, **aviso de fronteras**, resultado y fallo con motivo | `showMigration`, `showTrioRebuild`, `showAvisoModelo` · `#migBar` |
| M21 | Aviso de fps del overlay | una sola vez, al abrir el overlay | `#updBar` (reutilizado) |
| M22 | Caja de fallo | si algo revienta al pintar, con botón de copiar y la versión | `ui/fallo.js` · `#crashBox` |
| M23 | Banner de disparadores | el aviso grande en pantalla, con su color y sus segundos | `ui/alerts.js` · `mountBanner` |
| M24 | **Temporizadores en pantalla** | los relojes de los disparadores, con su barra, su rótulo y los segundos que quedan | `renderTimers` · `#timers`, `.timer` |

> **M24 faltaba en la primera versión de este inventario**, y lo destapó la
> mudanza 2 al tocar el esqueleto donde vive. Es exactamente lo que este
> documento existe para evitar, así que queda anotado en vez de arreglado en
> silencio: hoy `#timers` sólo existe dentro de la vista de Combate, así que al
> entrar en una sección desaparece. Su destino es el MARCO —un temporizador que
> se apaga al cambiar de sección no sirve para nada—, y eso es un cambio de
> sitio más, pendiente.

---

## 1 · Introducción de primera vez (asistente)

`renderWizard()` · `#wzCard`. Seis pasos. Sólo sale con `onboarded: false`, y se
puede reabrir con M10.

| # | elemento | dónde vive |
|---|---|---|
| W1 | Paso 1 · idioma, con las cinco banderas | `.wz-lang[data-code]` |
| W2 | Paso 2 · `/log on`, aviso de filtros, casilla «ya está» | `#wzOk` |
| W3 | Paso 3 · logs detectados con su fecha, campo de ruta, examinar, casilla «leer el histórico» | `.cand`, `#wzPath`, `#wzBrowse`, `#wzHist` |
| W4 | Paso 4 · tres desplegables de clase + **lo leído del `/who`** | `.wzcls`, `#wzWho` (`wizardWhoUpdate`) |
| W5 | Paso 5 · `/pet who leader` | — |
| W6 | Paso 6 · los tres atajos, aviso de pantalla completa, aviso de fps, abrir overlay | `#wzOverlay` |
| W7 | Navegación · paso N de 6, puntos, atrás / saltar / siguiente | `.wz-nav`, `#wzBack`, `#wzSkip`, `#wzNext` |

## 2 · Configuración del log

`renderSetup()` · `.setup`. Sale con «cambiar log» y cuando no hay log.

| # | elemento | dónde vive |
|---|---|---|
| S1 | Logs encontrados, con fecha de modificación | `.cand[data-path]` |
| S2 | Ruta del log | `#inPath` |
| S3 | Personaje | `#inSelf` |
| S4 | Segundos de inactividad que cierran una pelea | `#inIdle` |
| S5 | Casilla «leer desde el principio» | `#inFromStart` |
| S6 | Empezar / examinar / cancelar | `#btnAttach`, `#btnBrowse`, `#btnCancel` |
| S7 | Estado vacío: «no se ha encontrado ningún log» | `t('setup.notFound')` |

---

## 3 · Vista **Combate** — la lista de peleas (columna izquierda)

`renderFightList()` · `#fightList`. Se repinta con guarda de firma.

| # | elemento | qué enseña | dónde vive |
|---|---|---|---|
| L1 | Filtro de tramo | Hoy / 24 h / 7 d / 30 d / todo | `#fltRange` (`RANGES`) |
| L2 | Filtro de enemigo | campo con autocompletado de los enemigos del tramo y su número de peleas | `#fltFoe`, `#foeList` |
| L3 | **Filtro de compañeros** | desplegable con los declarados; sólo aparece si hay alguno | `matesFilter` · `#fltMates`, `#matesPop`, `#matesClear` |
| L4 | Botón «ver resumen» | agrega el tramo entero | `#btnSummary` |
| L5 | Barra de selección | «N elegidas», abrir, limpiar | `#pickOpen`, `#pickClear` |
| L6 | Pista de selección | «Mayúsculas+clic…» cuando no hay ninguna elegida | `.pick-hint` |
| L7 | Separador de zona | el nombre de la zona al cambiar | `.zone-sep` |
| L8 | Tarjeta de pelea | **título por abatidos** (`rotuloPelea`), dps enemigo, dps de los tuyos, duración; marcada si es la abierta o la elegida; la viva va aparte | `fightCard` · `.fight[data-uid][data-live]` |
| L9 | Botón «ver las menores» | cuántas se ocultan por triviales (<3 s o <500 de daño) | `#btnShowAll` |
| L10 | Pie del índice | peleas guardadas y KB en disco | `.flt-foot` |
| L11 | Estado vacío | «no hay peleas en este tramo» | `t('flt.none')` |
| L12 | Emergente de botín | al pasar el ratón por una pelea con botín, hasta 12 objetos y «y N más» | `showLootTip` |

## Lo ya mudado

| mudanza | elementos | sección nueva | comprobado |
|--:|---|---|---|
| 1 | C17, C18 | Esta pelea › **Botín** | mismas cifras en la misma pelea · 10 capturas (5 idiomas × 2 temas) en `tmp/capturas-despues-botin/` · `npm test` en verde |
| 8 | E19–E21 | Histórico › **Progreso** | misma forma que la 6 y la 7 · 10 capturas |
| 7 | E12 | Histórico › **Botín** | U12 se queda en Resumen, ver la desviación 3 · 10 capturas |
| 6 | E6–E11 | Histórico › **Enemigos** | primera EXTRACCIÓN: tres páginas sacadas del enrutador `state.enc.page` sin partir `renderEncyclopedia` · migas comprobadas de ida y vuelta con `npm run marco` |
| 5 | U1–U13 | Histórico › **Resumen** | primera sección SIN lista · `npm run marco` en verde: la lista se va y vuelve con la misma pelea marcada y abierta, y la sección ocupa 1.224 px con hueco 0 · 10 capturas en `tmp/capturas-despues-resumen/` |
| 4 | N1–N8, A3–A7, A9–A11, D1 | Esta pelea › **Análisis** | «Aguantar» deja de ser pestaña y pasa a bloque **conservando su titular** · con esta mudanza la vista vieja de Combate queda en **0 hijos y 0 caracteres**, medido · 10 capturas en `tmp/capturas-despues-analisis/` · `npm test` en verde |
| 3 | R1–R17, D1–D4, A9, A10 | Esta pelea › **Por habilidad** | `renderRows` y `renderDocs` sin tocar; A9, A10, D1 y D4 van **de paso** hasta Análisis (4) y Registro (11) · 30 capturas en `tmp/capturas-despues-habilidad/` · `npm test` en verde |
| 2 | C1–C16, C19, C20, A1, A2, A8, A12 | Esta pelea › **Escena** | la misma pelea —«a zol ghoul knight · 3 abatidos»— da 281 / 18.555 / 1m 6s / 39 / 1355 / 5 y pico 879/s, idéntico al antes · 10 capturas en `tmp/capturas-despues-escena/` · `npm test` en verde |

## 4 · Vista **Combate** — la cabecera de la pelea

`renderHead()` · `#fightHead`. **MUDADA ENTERA** a Esta pelea › Escena en la
mudanza 2, salvo C17 y C18, que se fueron a Botín en la 1.

| # | elemento | qué enseña | dónde vive |
|---|---|---|---|
| C1 | Título de la pelea | los abatidos por nombre, **«×N abatidos»** cuando cayó más de uno | `rotuloPelea` · `.head-title` |
| C2 | Subtítulo | viva/cerrada · zona · **D0–D4 con su nombre oficial** · nivel, y **«nivel desconocido» explicado** cuando no consta | `.eyebrow` |
| C3 | Botón **Analizar** | sólo en peleas cerradas | `#btnAnalyse` |
| C4 | Botón **Reproducir** | ídem | `#btnReplay` |
| C5 | Botón **Guardar pelea** | exporta el encuentro | `#btnExport` |
| C6 | Botón **Copiar** | texto para el chat, con acuse en el propio botón (ok / fallo) | `#btnChat` (`fightToChat`) |
| C7 | **Aviso de pelea dudosa** | qué la invalida y qué campos, con el motivo y cómo se arregla | `dudaHTML` · `.duda` |
| C8 | Tarjeta · dps de los tuyos | | `.metric.lead` |
| C9 | Tarjeta · daño total | | `.metric` |
| C10 | Tarjeta · duración | | `.metric` |
| C11 | Tarjeta · dps enemigo | sólo si hay | `.metric.foe` |
| C12 | Tarjeta · curación | sólo si hay | `.metric` |
| C13 | Tarjeta · abatidos | | `.metric` |
| C14 | Tarjeta · caídas tuyas | sólo si hay | `.metric.bad` |
| C15 | **Gráfica** de daño por segundo | dos líneas a la misma escala, franja de postura, marcas de muerte, pico, leyenda, duración y la nota de «cada punto es un segundo» | `chartHTML` · `.chart` (`ui/grafica.js`) |
| C16 | Rótulo de la gráfica | al pasar el ratón: segundo, infligido, recibido, curado | `cablearGrafica` · `#chartTip`, `.chart-guide` |
| ~~C17~~ | **Botín de la pelea** | objeto (abre la wiki), de quién cayó, mejora, vendido por | **MUDADO** a la sección Botín · `renderBotinPelea` |
| ~~C18~~ | Ficha del objeto | al pasar el ratón, con imagen y líneas de la wiki; «la wiki no lo tiene» si no | **MUDADO** con C17 · `cablearBotin` |
| C19 | Estado vacío · sin peleas | «pega a algo y aparecerán» | `t('fight.none')` |
| C20 | Estado vacío · ninguna abierta | distinto del anterior a propósito | `t('fight.pick')` |

## 5 · Vista **Combate** — avisos, consejo y notas

| # | elemento | qué enseña | dónde vive |
|---|---|---|---|
| ~~A1~~ | **Aviso de clases que no cuadran** · MUDADO a Escena | el hechizo que lo delata, el trío deducido, `/who`, y hasta tres formas: el log corrige, tu tabla manda (con candidatos y cuándo se vio cada uno), o el `/who` gana | `renderClassPrompt` · `#clsPrompt` |
| ~~A2~~ | **Aviso de mascota sin identificar** · MUDADO a Escena | candidatos, `/pet who leader`, «es mía» / «no es mía» | `renderPetHint` · `#petHint` |
| A3 | **Consejo de postura** | veredicto, daño recibido/entrante, reparto melé-mágico, **lo que ninguna postura para**, postura actual, tabla de candidatas (evitaría, del total, vigor, maná), tramos si bailaste, «si prefieres pegar», invocaciones, y las notas de cota | `renderAdvice` · `#advice` |
| A4 | Procedencia del trío | **`adv.src.*`**: de tu tabla, del `/who`, deducido, o **el de la pelea** cuando no es el de hoy | `.adv-head .src` |
| A5 | Tres desplegables de clase + «cambié de trío» | | `.cls`, `#trioNow` |
| A6 | Conflicto de clases | lo que dice el log contra lo que llevas, y descartar | `.conflict`, `#cfDismiss` |
| A7 | Consejo en vivo | «cambia a X» / «X es la correcta», con segundos y reparto | `.live` |
| ~~A8~~ | Nota de encanto ambiguo · MUDADO a Escena (`charmHTML`) | golpes y daño que no se pueden repartir, y lo estimado tuyo aparte | `renderRows` · `#charmNote` |
| A9 | **Fuego amigo entre los tuyos** | quién, cuántos segundos, golpes, daño, contra quién, y **el hecho vecino** (lo último que lanzó el enemigo) | `entreTuyosHTML` |
| A10 | **Tramos sin mando** | miedo / encanto / ninguna de las dos, con su ventana, si sigue abierto al acabar, el vecino, y que ese tiempo no cuenta | `sinControlHTML` |
| A11 | **dps sobre el tiempo que manejabas** | al lado del de siempre | `dpsMandoHTML` |
| ~~A12~~ | **«Lo que esta pelea no sabe»** · MUDADO a Escena | daño sin dueño, daño soltado por encanto (**marcado como deducido**), botín de asignación ambigua | `incertidumbreHTML` |

## 6 · Vista **Combate** — el reparto (filas)

`renderRows()` · `#rows`, con `buildRow`/`updateRow`.

| # | elemento | qué enseña | dónde vive |
|---|---|---|---|
| R1 | Cabecera de bando | «los tuyos» / «los enemigos» / **«sin identificar»** con su nota | `.side-head` |
| R2 | Fila | puesto, nombre, dps, porcentaje | `.row` |
| R3 | Marcas del nombre | tú, mascota, mascota de otro (**«de X»**), **encantado** con su nota | `updateRow` |
| R4 | Barra segmentada | por tipo de daño (9 tipos) | `barHTML` |
| R5 | Línea de cifras | daño, **ritmo** (si difiere), **ráfaga de 10 s con su múltiplo** (si hay pico), máximo, precisión, críticos, recibido, curado | `updateRow` |
| R6 | Leyenda de tipos | los nueve colores con su nombre | `.legend` |
| R7 | Rótulo emergente de fila | dps, daño y reparto, precisión, críticos, mín–máx, recibido, curado, tipos y hasta 4 habilidades | `updateTip` |
| R8 | Desglose · composición | por tipo, con barra | `detailHTML` |
| R9 | Desglose · por habilidad | tipo, daño, %, usos, media, **mediana y p10–p90**, máximo, críticos; **«dos modas»**; hueco explicado cuando falta muestra o la pelea es vieja | `detailHTML` |
| R10 | Desglose · por objetivo | | ídem |
| R11 | Desglose · por postura e invocación | | ídem |
| R12 | Desglose · ataque | golpes, intentos, precisión, críticos, ráfagas, contraataques, mayor y menor golpe, por qué fallaste | ídem |
| R13 | Desglose · defensa | recibido, por segundo, ataques recibidos, evitación, muertes, con qué evitaste, de quién te llegó, por tipo | ídem |
| R14 | Desglose · curación | hecha, recibida, HPS, sobrecuración, por hechizo, a quién | ídem |
| R15 | Desglose · ritmo | dps de pelea, propio y activo, segundos activos de los suyos | ídem |
| R16 | **Controles de fila** | excluir, declarar compañero, **desplegable «es la mascota de…»**, y las notas de estado | `controlesDeFila` |
| R17 | **Marca de nombre deducido** | cuando el registro nunca lo escribe a mitad de frase | `t('name.deducido')` |

## 7 · Vista **Combate** — los documentos de la pelea

`renderDocs()` · `#docBar` + `#docPane`. Cada pestaña lleva **su titular**, y la
que no tiene dato no se pinta.

| # | elemento | titular | dónde vive |
|---|---|---|---|
| D1 | **Aguantar** | quién aguantó y su % | `tanqueoHTML` · quién, recibido, %, por segundo, curación recibida, ataques, con qué paró, cuántos, absorbido en runas |
| D2 | **Lanzamientos** | cuántos | `lanzamientosHTML` · una fila por lanzador, marcas por categoría en su segundo, escala 0–duración, y lo recortado |
| D3 | **Tiempo puesto (uptime)** | el primero y su % | `uptimeHTML` · barra por hechizo, **«venía de antes»** y **«sin caer»**, y la nota de lo invisible |
| D4 | **Registro** | la hora de inicio–fin | `registroHTML` · las líneas con su hora, «cargando», recortadas, y **el error con su motivo** (fuera de rango, con el intervalo que sí hay) |

---

## 8 · Vista **Resumen**

`renderSummary()` · `#sumRoot`. Se llega con L4 (tramo) o L5 (selección).

| # | elemento | dónde vive |
|---|---|---|
| U1 | Título, según venga del tramo o de una selección | `.sum-head h2` |
| U2 | Etiqueta del filtro de compañeros | `.mates-tag` |
| U3 | Casilla «juntar mascotas» con su cuenta | `#sumMerge` |
| U4 | Volver | `#sumBack` |
| U5 | Tarjetas: dps, daño, dps enemigo, tiempo de combate, peleas, abatidos, caídas, curación | `.metrics` |
| U6 | Nota del resumen | `t('sum.note')` |
| U7 | Aviso de aliados sin identificar, con `/pet who leader` | `.sum-pethint` |
| U8 | **Expediente del enemigo** cuando hay filtro | `foeDossier` |
| U9 | Filas de los tuyos / **sin identificar** (con su nota) | `sumRow` |
| U10 | Desglose de fila: cifras, por habilidad, por tipo, a quién, de quién, **«y N más»**, y los controles de fila | `sumRowDetail` |
| U11 | Reparto por enemigo, desplegable: quién le pegó, sus resistencias medidas y lo que dice la wiki | `foeDetail` |
| U12 | Botín agregado del tramo | `.loot` |
| U13 | Estado vacío: «no hay nada en este tramo» | `t('sum.empty')` |

## 9 · Vista **Análisis**

`renderAnalysis()` · `#anView`.

| # | elemento | dónde vive |
|---|---|---|
| N1 | Título, duración, daño, zona | `.an-head` |
| N2 | **Nota** de la pelea | `.an-score` |
| N3 | Roles: más daño, más curación, quién aguantó | `.an-roles` |
| N4 | **Hallazgos** con nivel (malo/aviso/info/bien), **etiqueta de qué clase de cosa es** con su explicación, detalle e impacto | `.an-find` |
| N5 | Fases: tramo, % melé, barras de dps y dtps | `.an-phase` |
| N6 | Nota de límites | `t('an.limits')` |
| N7 | Estado: «demasiado corta» (<30 s) | `t('an.tooShort')` |
| N8 | Volver | `#anBack` |

## 10 · Vista **Reproducción**

`renderReplay()` · `#rpView` → `montarReproduccion` (`ui/reproduccion.js`).

| # | elemento | dónde vive |
|---|---|---|
| P1 | Cabecera con el título de la pelea y volver | `.an-head`, `#rpBack` |
| P2 | Botón de play, velocidades ×1…×N, reloj | `#rpPlay`, `.rp-v`, `#rpReloj` |
| P3 | Línea de tiempo con la gráfica, la franja de postura, los hitos y el cursor arrastrable | `#rpTiempo`, `#rpCursor`, `#rpPunto` |
| P4 | **La pista** de sucesos (barras y marcas) | `#rpPista` |
| P5 | Escena: figuras por combatiente, **suelo «×N abatidos · al menos M presentes»**, mascota, dps en vivo, **«entre todos»** cuando son varios, barra de casteo, botín flotante | `.rp-fig`, `.rp-suelo`, `.rp-dps`, `.rp-cast`, `.rp-botin` |
| P6 | Los que no tienen bando | `.rp-sinbando` |
| P7 | Texto de la reproducción | `#rpTexto` |
| P8 | **Ficha de botín** de la pelea, con lo recogido después de cerrarse | `fichaBotin` · `.rp-fichabotin` |
| P9 | Estados: «cargando», «sólo peleas cerradas», «no quedan líneas en el registro» | `t('rp.soloCerradas')`, `t('rp.noLineas')` |
| P10 | **El panel de umbrales**: qué sube al panel de texto y con qué número —críticos, muertes, lanzamientos, aturdimientos, interrupciones y el pico de tres veces el segundo mediano, con la mediana al lado—, y que la regla de la forma no se puede aplicar en peleas viejas | `reglas` + `t('rp.reglas')` |

## 11 · Vista **Avisos** (`#tabTriggers`)

Dos paneles en la misma pantalla: `renderNarrate()` (`#narrateBox`) y
`renderTriggers()` (`#trigBox`, `ui/triggers.js`).

### 11a · Voz y lectura — `renderNarrate`

| # | elemento | dónde vive |
|---|---|---|
| V1 | **Supervivencia**: fingir muerte, invisibilidad cayendo/perdida, levitación, invocado, invulnerable, inconsciente, olvidado | `NARRATE_SURVIVAL` |
| V2 | **Leer el chat**: 9 canales | `NARRATE_CHAT` |
| V3 | **Combate**: 12 sucesos | `NARRATE_COMBAT` |
| V4 | **Lanzamientos del enemigo**: 10 categorías + campo de hechizos extra | `NARRATE_CAST`, `#nNukes` |
| V5 | Voz, velocidad y volumen, con las voces agrupadas por idioma | `#nVoice`, `#nRate`, `#nVol` |
| V6 | Corte de caracteres y **probar** | `#nMax`, `#nTest` |
| V7 | **Tabla de tríos**: desde cuándo, clases, nivel o «del log», borrar (por `at`), añadir | `#trioTbl`, `#trioAdd`, `[data-trio-at]` |
| V8 | **Conflictos de tríos**: lo que dice el log contra lo que declaras | `#trioConf` |
| V9 | **Excluidos**: lista y restaurar | `#exclList`, `[data-restore]` |
| V10 | **Compañeros**: lista con **`mate.src.*` (dicho por ti / detectado)**, quitar; y los rechazados, con volver a añadir | `#mateList`, `#notMateList` |
| V11 | Prefijo para el chat | `#sharePrefix` |
| V12 | Mascotas al compartir: juntar o aparte | `#sharePets` |
| V13 | Formato del porcentaje | `#sharePct` |
| V14 | **Mis mascotas** y **las que no lo son**, con sus botones | `#petList`, `#notPetList` |
| V15 | Estados vacíos de cada lista | `t('trio.empty')`, `t('excl.empty')`, `t('mate.empty')`, `t('pet.mineEmpty')` |

### 11b · Disparadores — `ui/triggers.js`

| # | elemento | dónde vive |
|---|---|---|
| G1 | Lista de disparadores con casilla de activo, nombre, patrón y badge de temporizador | `.trig-item` |
| G2 | Nuevo / importar / exportar / plantillas | `#tAdd`, `#tImport`, `#tExport`, `#tReset` |
| G3 | Panel de voz y sonido: leer en alto, voz, velocidad, sonidos, probar voz, probar sonido | `.tts-panel` |
| G4 | **Procedencia del disparador y sus coincidencias**: escrito por ti / plantilla de fábrica, y **cuántas veces se ha visto en tu registro** (o nunca, o en otro log) | `.trig-proc`, `t('tg.vistas*')` |
| G5 | Editor: nombre, patrón, regex, ignorar mayúsculas, decir, mostrar, sonido, color, segundos en pantalla | `#fName`, `#fPattern`, `#fRegex`, `#fCase`, `#fSpeak`, `#fText`, `#fSound`, `#fColor`, `#fHold` |
| G6 | Temporizador: duración, avisar al quedar, qué hacer si ya existe, nombre, cancelar | `#fSecs`, `#fWarn`, `#fRestart`, `#fTLabel`, `#fCancel` |
| G7 | Estados: sin disparadores, ninguno seleccionado | `t('tg.empty')`, `t('tg.noneSel')` |

## 12 · Vista **Enciclopedia** (`#tabEnc`)

`renderEncyclopedia()` · `#encRoot`. Índice + 6 secciones + 3 fichas.

| # | elemento | dónde vive |
|---|---|---|
| E1 | Nota de la enciclopedia y **rejilla de 6 tarjetas** con su lámina, su color y su recuento | `encIndex` · `.enccard[data-enc]` |
| E2 | **Pie de estado**: enemigos y peleas incorporados, si hubo que rehacer la ficha y por qué, backfill, y **botón de rehacerla** | `encEstado` · `#encRebuild` |
| E3 | Migas de pan | `encCrumb` · `[data-crumb]` |
| **Zonas** | | |
| E4 | Tabla zona × D0–D4 + **columna aparte de «no consta»**, con enemigos, peleas y abatidos por celda; la celda vacía dice «aquí no has entrado» | `encZonas` · `.enccell` |
| E5 | Ficha de zona: enemigos con vida, veces y abatidos o «nunca cayó» | `encZona` · `.encrow[data-foe]` |
| **Enemigos** | | |
| E6 | Buscador con **sugerencias de enemigo y de zona**, navegables con el teclado | `#encQ`, `.sugg` |
| E7 | Rejilla de enemigos: abatidos por dificultad, vida, y la celda vacía como hueco | `encEnemigos` · `.fcell` |
| E8 | **Expediente del enemigo**: retrato, **insignia de jefe con su procedencia (`raid.src.*`)**, marcarlo/desmarcarlo/devolverlo a la wiki, enlace a la wiki, tarjetas, vida con su muestra, **rejilla de las cinco dificultades**, resistencias con `n=`, lo que le resistes, cómo pega, lo que suelta, zonas y niveles | `foeDossier`, `diffBlocks`, `resistCell` |
| E9 | **Ficha de una dificultad**: todo lo anterior sin promediar, con pestañas hermanas | `encFoeDif` |
| E10 | Sus habilidades, con **en cuántos encuentros de cuántos** y lo que dice la wiki | `encHabilidades` |
| E11 | Peleas contra él, con si cayó o sobrevivió | `encFoe` |
| **Botín** | | |
| E12 | Buscador, **pestañas de dificultad (todas / D0–D4 / no consta)**, tarjetas de objeto con fuentes, «N de K», sin fuente y sin pelea | `encBotin` · `.lootTab`, `.lootcard`, `.lootfrom` |
| **Hechizos** | | |
| E13 | Tarjetas: hechizos, usos, daño, % que entra, peleas; el mejor | `encHechizos` |
| E14 | Tabla: hechizo, tipo, usos, media (**estimada si hay poca muestra**), rango, críticos, % que entra, daño efectivo, enfriamiento; **huecos explicados** | `.cat-row.abre` |
| E15 | **Marcas por nivel**: mejor y mediana, con sus peleas | `.marks` |
| E16 | **Enfriamientos medidos**, con intentos y si es contable | `cat.cdTitle` |
| E17 | **El libro**: conocidos, sin usar, con **de qué consta cada uno** (escrito, comprado, memorizado) y los lanzados sin constancia | `libroHTML` |
| E18 | Ficha de un hechizo: tarjetas, notas de escudo de daño / curación sin identificar / irresistible, **series por nivel y dificultad**, descartadas, contra qué enemigos entra, enfriamiento | `encHechizo` |
| **Progreso** | | |
| E19 | **Periodos de nivel** con subidas y bajadas (**cambio de clase, no retroceso**), el margen del cambio, hitos de AA y equipo | `periodosHTML` |
| E20 | Marcas por nivel y **por terna enemigo/dificultad/nivel**, con «una sola pelea» dicho | `encProgreso` |
| E21 | Series dibujadas sólo con muestra suficiente, y lo que no llega, dicho | `.serie-row` |
| **Muertes** | | |
| E22 | Tarjetas: caídas, tasa, peleas; por zona; por enemigo; y **cada muerte** con el que más daño te hizo | `encMuertes` |
| E23 | Estados vacíos propios de cada sección | `enc.emptyZones`, `enc.emptySpells`, `enc.noDeaths`, `enc.noProgress`, `enc.noMatch` |

## 13 · Emergentes y diálogos

| # | elemento | dónde vive |
|---|---|---|
| X1 | Caja de rótulo compartida (fila, objeto, botín) | `ui/rotulo.js` |
| X2 | Diálogo de datos (añadir trío, trío de ahora) con validación por campo | `ui/dialogo.js` · `pedirDatos` |
| X3 | **Acerca de**, con versión y licencia | `ui/dialogo.js` · `acercaDe` |
| X4 | Overlay (ventana aparte) | `ui/overlay.html`, `ui/overlay.js` |

---

## Lo pequeño y raro, que es lo primero que se cae

La lista que hay que comprobar una por una después de mover. Cada una con su
fila de este inventario:

| lo que pediste | fila |
|---|---|
| «lo que esta pelea no sabe» y sus contadores | **A12** |
| etiquetas de procedencia `raid.src.*` | **E8** |
| etiquetas de procedencia `mate.src.*` | **V10** |
| etiquetas de procedencia `adv.src.*` | **A4** |
| el suelo «×N abatidos · al menos M presentes» | **C1** (abatidos) y **P5** (presentes) |
| la marca de nombre deducido | **R17** |
| el contador de líneas sin reconocer | **M15** |
| la pista de cambios de estado | **P4** |
| el botón de juntar mascotas | **M16**, y su gemelo **U3** |
| la ruta del log y el personaje | **M17**, **M7** |
| los disparadores con procedencia y coincidencias | **G4** |
| el consejo de postura | **A3** |
| el panel de umbrales | **P10** (el pie de reglas del panel de texto de la reproducción, `rp.reglas`) |
| el botón de overlay y el de cambiar log | **M12**, **M13** |
