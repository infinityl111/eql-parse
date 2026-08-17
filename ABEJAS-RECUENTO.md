# Las abejas, vueltas a contar sobre el log de hoy

Recuento del **17 de agosto de 2026**, sobre `eqlog_Campeon_erudin.txt` — 93 MB,
del 4 de agosto 11:04 al 17 de agosto 14:28. No se ha construido nada: sólo
contar, que es lo que se pedía.

## La respuesta corta: siguen siendo SIETE

**No hay ningún episodio nuevo.** Las siete muertes de madre del registro son las
siete de [HALLAZGOS.md §4.3](HALLAZGOS.md), con las mismas fechas.

| | |
|---|---|
| episodios (muertes de `Bzzazzt`) | **7**, los mismos |
| nuevos desde la medición anterior | **0** |
| nuevos que acaben con hijas muertas | **0** |
| nuevos que rompan la predicción | **0** — no hay ninguno que pueda romperla |
| la p del acierto del jefe | **sigue en 0,029**, no baja |
| el «3» | **sigue apoyado en un solo episodio sin muertes** |

## Por qué no hay nuevos, medido y no supuesto

Campeón dice que ha limpiado Sky varias veces, y es cierto que ha entrado. Lo que
no ha habido son episodios de la cadena:

| | |
|---|---|
| última línea de la cadena en el registro | **13 ago 13:53** (el séptimo episodio) |
| entradas a The Plane of Sky posteriores | 14 ago 12:32 y 12:33 · **17 ago 14:27** |
| líneas de abeja tras esas entradas | **ninguna** |

**La de hoy es de las 14:27 y el registro acaba a las 14:28**: la visita está
empezando ahora mismo. Lo demás son visitas a Sky sin tocar la isla de las
abejas, o sin matar a ninguna madre.

**Conclusión práctica: el recuento hay que repetirlo cuando termine la sesión de
hoy.** Con lo que hay a las 14:28 no hay nada nuevo que contar.

*(Y de paso: `Sky.txt`, que aparece en la carpeta de logs con fecha de hoy, no es
un registro de chat — es el fichero de errores del cliente. No contiene ni una
línea de la cadena.)*

---

## Lo que sí ha salido del recuento: la medición no está escrita

Para volver a contar hubo que **reconstruir el método**, y el método no está
escrito con suficiente detalle en §4.3. Lo que dice es «media de golpes por
segundo, desde la muerte de la `bzzazzt` hasta la primera muerte de una
`bazzzazzt`». Con eso a la mano caben varias cuentas, y dan resultados
distintos:

| lectura de «golpes por segundo» | 4 ago 23:19 | 11 ago 20:16 | 11 ago 20:30 |
|---|---:|---:|---:|
| publicado en §4.3 | 1,93 | 3,70 | 5,89 |
| ataques ÷ segundos de reloj | 1,25 | 2,42 | 5,61 |
| **ataques ÷ segundos ACTIVOS** | **1,93** | **3,65** | **5,61** |

**La tercera reproduce lo publicado**: la tasa es por segundo **con actividad**,
no por segundo de reloj — que además es la convención que ya usa toda la
aplicación (`activeSec`, `dpsActive`). Seis de los siete episodios caen a menos
de un 5 % de su cifra publicada.

**El séptimo no.** El del 5 de agosto da **2,47** en vez de 3,71, y no es un
detalle: §4.3 dice «tres montones, y **nada en medio**», y 2,47 cae justo en
medio. La diferencia está en dónde se cierra la ventana cuando **no muere
ninguna hija** —ese episodio tiene una pausa larga— y esa regla no está escrita.

### Lo que hay que arreglar no es la cuenta: es la nota

No se toca ninguna cifra publicada. Lo que falta es escribir, al lado de la
medición, las tres decisiones que la definen:

1. **qué línea cuenta como golpe** — ¿sólo las que entran, o también «tries to
   sting YOU, but misses»? (aquí se han contado las dos, y con `stings`,
   `bashes` y `cleaves`, que son los tres verbos que usa la hija);
2. **cómo se cierra la ventana** cuando no muere ninguna hija;
3. **qué se hace con las pausas** dentro de la ventana.

Es la misma lección que «los comandos no se escriben de memoria: se copian del
que los imprime», aplicada a una medición. **Una medición que no se puede
repetir no es una medición: es un recuerdo.** Y esta sostiene la prueba más
fuerte del apartado —la proporción entera 1 : 1,90 : 3,02—, que con otra lectura
del mismo registro sale 1 : 1,89 : 2,91… o 1 : 1,28 : 2,91, según lo que cuentes.

---

## Y el orden de muerte, que era el rastro indirecto de D10

> **D10 se retiró el mismo día**: Campeón miró y la abeja del centro no es
> distinta. Así que esto ya no arbitra ninguna creencia — y la consecuencia es
> que **la cadencia vuelve a ser la única forma de saber en qué rama estás**, que
> es más de lo que era esta mañana.

Está en la ficha de D10 con su tabla: **el jefe salió de la segunda madre, de la
tercera y de la primera** — no hay posición fija en el orden de muerte.

Con las dos salvedades escritas allí: no consta que el orden de muerte sea el
orden espacial, y **los siete episodios son anteriores a la creencia** (4–13 de
agosto contra el 17), así que son los únicos independientes que vamos a tener
gratis.
