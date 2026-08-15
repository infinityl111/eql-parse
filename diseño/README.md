# Prototipos de diseño

**Ninguno de estos ficheros es fuente de datos.** Las cifras que contienen son
inventadas —salen de un generador determinista para que la maqueta se vea
bien— y no tienen nada que ver con el registro de nadie. En un proyecto donde
cada número viaja con su procedencia, un número plausible y falso es el peor
que puede haber: dentro de un mes alguien lo cita creyendo que se midió.

| fichero | qué es | fecha |
|---|---|---|
| `ui-secciones.html` | la interfaz nueva por secciones: qué apartados hay y cómo se navegan | 16 de agosto de 2026 |
| `ui-dps-individual.html` | el dps por combatiente: «todos juntos» y «uno por cada uno» | 16 de agosto de 2026 |

Tampoco son código de producción: no se empaquetan —`build.files` lista
`ui/**`, que no casa un fichero suelto de esta carpeta— y no los carga nadie.

## Por qué llevan fecha

Porque el diseño se mueve. Cuando el armazón esté construido, el prototipo
deja de ser la verdad y pasa a ser un histórico, y hay que poder saber cuál es
de cuándo sin abrirlo. La fecha va también en la cabecera de cada fichero.

Si alguna de sus cifras acaba en la aplicación como valor por defecto o como
ejemplo, es un fallo.
