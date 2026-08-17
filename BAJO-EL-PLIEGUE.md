# Las notas de matiz que viven por debajo del pliegue

**Esto no cambia nada.** Es la entrada de una decisión posterior: qué notas hay
que subir, cuáles pueden quedarse donde están y cuáles ya las arregla el
armazón por su cuenta.

**El caso que lo motiva** es `enc.lootNote`, la que dice que «2 en 9 caídas» son
dos cifras medidas juntas y no una probabilidad de caída. Vive **27.422 px por
debajo** del principio de la sección de botín, y se salvó de milagro: la tanda
de capturas del ANTES la dejaba fuera de la foto y no lo decía.

**Cómo está medido.** `npm run pliegue` recorre las quince secciones en la
aplicación de verdad, mira dónde cae cada `.hint` y cada `.hallazgo` respecto
del alto visible del panel (815 px con la ventana de 1400×900) y lista las que
quedan fuera de la primera pantalla. Detalle completo en `tmp/pliegue.json`.

Medido el 17 de agosto de 2026, en español y tema oscuro, sobre 88 peleas.
**Total: 61 notas bajo el pliegue** —72 en la primera pasada, antes de que el
medidor descontara los datos disfrazados de nota—. Pero no son 61 problemas, y
separarlas es justamente el trabajo:

---

## 1 · Las tres graves: la nota explica una REJILLA y vive al final de la lista

Son el mismo caso tres veces. La rejilla se ve entera sin bajar; la frase que
dice **qué significa una celda vacía o una cifra** está detrás de toda la lista.
Quien mira la rejilla —que es todo el mundo— no la lee nunca.

| sección | la nota | a qué distancia | qué matiza |
|---|---|--:|---|
| **Botín** | «"2 en 9 caídas" son dos cifras medidas juntas —las veces que lo has tumbado y las veces que soltó eso—, no una probabilidad de caída» | **27.422 px** | cada «N en K» de la sección entera |
| **Enemigos** | «Una columna por dificultad, y el número es las veces que ha caído ahí. La celda vacía dice que en esa dificultad no te lo has encontrado» | **19.895 px** | la rejilla D0–D4 de cada fila |
| **Zonas** | «Cinco dificultades, de la 0 a la 4; la 0 es el mundo abierto. Cada celda cuenta los enemigos de los que tienes datos por haber peleado» | **1.781 px** | la tabla entera |

Las tres dicen lo mismo en el fondo: **esta cifra no es lo que parece**. Es la
clase de nota que no puede estar a un scroll de distancia — y las tres van a
seguir estándolo después del armazón, porque las tres secciones siguen siendo
listas largas.

## 2 · Las que el armazón arregla solo

Notas que están **pegadas a su bloque**, y bajo el pliegue sólo porque hoy su
bloque vive al final de una pantalla larguísima. Al partir la pantalla en
secciones suben solas. No hay que hacer nada con ellas — pero sí hay que
**comprobarlas después**, porque si el bloque acaba otra vez al final de una
sección larga, el problema vuelve.

| sección de hoy | notas | dónde acaban |
|---|--:|---|
| Combate · consejo de postura y sus tres notas de invocación | 4 | Análisis, arriba |
| Combate · «no dice si estuviste cerca de morir» (Aguantar) | 1 | Análisis |
| Documentos · «las líneas del fichero, tal cual» (Registro) | 1 | Registro |
| Resumen · «pegaron a tus enemigos pero no son tuyos que se sepa» | 1 | Resumen, con su grupo |
| Reproducción · las tres del botín y **el panel de umbrales** | 4 | Escena / Botín |
| Enemigo · las cinco del expediente (clases por instancia, resistencias juntas, niveles mezclados, «lo que le has visto lanzar», zonas) | 5 | Enemigos |
| Hechizo · «2 tramos fuera por poca muestra» y «cada enemigo con su dificultad» | 2 | Hechizos |
| Hechizos · marcas por nivel, «sin /who», el libro | 4 | Hechizos |
| Progreso · «sólo peleas contra un único enemigo» y la de las series | 3 | Progreso |

## 3 · Las que no son un problema, y por qué se cuentan aparte

- **Botín · 16 notas «N recogidos sin pelea».** Una por tarjeta de objeto, cada
  una pegada a la suya. Están bajo el pliegue porque la tarjeta 340 lo está. No
  hay nada que subir: viajan con su objeto.
- **Ajustes/Avisos · 12 notas.** Explican **controles**, no cifras: «se aplican
  a todo el histórico», «vacío por defecto», «quitados: no se volverán a
  proponer». Su sitio es al lado de su interruptor y ahí siguen.
- **Progreso · 11 líneas de comparables.** «Nivel 50, 10 periodos: mediana
  129 → 122 → …» no son notas: son **datos** pintados con la clase `.hint`.
  Desde esta pasada el medidor los excluye y los cuenta aparte —«11 datos con
  clase de nota, fuera de la cuenta»—, por un rasgo del texto y con fecha de
  caducidad: el arreglo de verdad es darles su propia clase. Y deja una pregunta
  de paso: un dato vestido de nota se lee como un comentario y no como una
  medida.

## 4 · Lo que se decide después, no aquí

1. **Las tres graves: DECIDIDO.** Suben a la **cabecera de su rejilla**, debajo
   del título y antes de la primera fila. Es la familia 16 de `ui/app.js`:
   *una nota que dice cómo se lee una tabla va en su cabecera, no en su pie; un
   pie es para ampliar, y una advertencia no es un pie de página.* Es CONTENIDO,
   así que va después del armazón — y es **lo primero** que va después.
2. **Los datos vestidos de `.hint`: DECIDIDO**, y van en ese mismo cambio. Les
   toca su propia clase; hoy el medidor los aparta por un rasgo del texto, que
   es un parche con fecha. Familia 17.
3. **La regla general**, que queda por decidir: *una nota que matiza una cifra no
   puede estar más abajo que la última cifra que matiza*. Sería comprobable con
   `npm run pliegue` en cada tanda, igual que las capturas.
