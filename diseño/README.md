# Prototipos de diseño

**Ninguno de estos ficheros es fuente de datos.** No se empaquetan y no los
carga nadie.

## De dónde salen sus cifras — y esto cambió el 20 de agosto de 2026

Los dos primeros prototipos llevan cifras **inventadas**, de un generador
determinista. La regla era: en un proyecto donde cada número viaja con su
procedencia, un número plausible y falso es el peor que puede haber, porque
dentro de un mes alguien lo cita creyendo que se midió.

**Los del 20 de agosto llevan cifras REALES**, y es decisión de Campeón: un
antes y un después sólo se pueden comparar con el mismo contenido, y con datos
inventados no se ve si la pantalla aguanta lo que de verdad hay —23 combatientes
con sus mascotas, o un solo temporizador y el resto vacío.

La regla vieja no se relaja, se cumple por el otro lado: **esas cifras se
GENERAN, no se escriben a mano**. `contenido-real.mjs` las saca del almacén y
`gen-prototipos.mjs` construye el HTML, así que llevan su origen y su fecha en
el pie y se pueden volver a generar. No se editan a mano jamás: un número
tocado en el HTML deja de tener procedencia y vuelve a ser el peor número
posible.

Y sigue en pie lo que de verdad importaba: **si alguna de estas cifras acaba en
la aplicación como valor por defecto o como ejemplo, es un fallo.**

| fichero | qué es | fecha |
|---|---|---|
| `ui-secciones.html` | la interfaz nueva por secciones: qué apartados hay y cómo se navegan | 16 de agosto de 2026 |
| `ui-dps-individual.html` | el dps por combatiente: «todos juntos» y «uno por cada uno» | 16 de agosto de 2026 |
| `2026-08-20-reapariciones.html` | la sección **vacía**: pestañas, buscador, agrupación, pastillas, filas plegables · **datos reales** | 20 de agosto de 2026 |
| `2026-08-20-escena.html` | la sección **densa**: 23 combatientes reales, mascotas apagadas por defecto, filas de una línea · **datos reales** | 20 de agosto de 2026 |
| `contenido-real.mjs` | saca del almacén el contenido real que usan los dos | 20 de agosto de 2026 |
| `gen-prototipos.mjs` | genera los dos ficheros. **Se regenera, no se edita** | 20 de agosto de 2026 |

Tampoco son código de producción: no se empaquetan —`build.files` lista
`ui/**`, que no casa un fichero suelto de esta carpeta— y no los carga nadie.

## Por qué llevan fecha

Porque el diseño se mueve. Cuando el armazón esté construido, el prototipo
deja de ser la verdad y pasa a ser un histórico, y hay que poder saber cuál es
de cuándo sin abrirlo. La fecha va también en la cabecera de cada fichero.

Si alguna de sus cifras acaba en la aplicación como valor por defecto o como
ejemplo, es un fallo.

## Las cinco piezas comunes

Los dos prototipos del 20 de agosto llevan **el mismo bloque de CSS y de
JavaScript, idéntico y duplicado a propósito**. Si las dos secciones lo
necesitan, no es de ninguna de las dos:

1. **Pestañas dentro de la sección** — para no volver a la barra lateral por
   cada variante.
2. **Barra de control** — buscador siempre visible, «agrupar por…» y densidad.
3. **Pastillas de filtro** — encendidas y apagadas, a la vista, con su recuento.
4. **Filas plegables** — cincuenta resumidas en una línea, se abre la que
   interesa.
5. **Etiquetas compactas** — `mascota`, `enemigo`, `la zona repuebla en`, en vez
   de renglones de texto.

En la aplicación serían **un módulo**, no dos copias. Lo que aquí está duplicado
es la prueba de que hace falta.
