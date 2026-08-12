# Publicar una versión

Este fichero existe porque el ritual de publicar vivía en la cabeza de alguien y
en un chat, y **falló por eso**. Al publicar la 1.13.0 se dictó de memoria
`gh release upload web/notas/*.md` teniendo el aviso escrito en `web/build.mjs`,
y ese comando habría subido las notas **sin sustituir**: `{{an.downtime}}` con
las llaves a la vista en el cartel de actualización de todo el mundo.

Es la tercera vez que algo importante de este proyecto sólo existía en la memoria
de una sesión. Por eso cada paso lleva **su motivo al lado**: un orden sin motivo
se reordena solo en cuanto alguien tenga prisa, y aquí el orden es justamente lo
que evita el fallo.

---

## La regla que resume todo lo demás

> **Los comandos no se escriben de memoria: se copian del que los imprime.**

`npm run web:build` imprime al terminar el comando exacto de subida, con la
versión ya puesta. Se copia de ahí. Este documento dice **por qué** y en **qué
orden**, no sustituye al comando.

## La distinción que lo hace fallar

```
web/notas/1.13.0.es.md        LA FUENTE.    Lleva {{clave}} sin sustituir.
web/dist/notas/1.13.0.es.md   LO PUBLICABLE. Lleva los rótulos ya puestos.
```

Se llaman igual y **durante doce versiones tuvieron el mismo contenido**, porque
hasta la 1.12.0 ninguna nota citaba rótulos de la interfaz. La primera vez que
divergen es la 1.13.0, y la primera vez que divergen es la primera vez que
importa cuál de los dos subes.

Es el mismo patrón que `FORMATO_VERSION` y `RECONSTRUIR_DESDE`: dos cosas
distintas que nadie separa hasta que se separan solas. Y el mismo que llevamos
media docena de veces en el código — identificar algo por su nombre cuando el
nombre no es lo que lo distingue.

**De `web/dist/notas/` salen las dos cosas que lee un usuario**: los adjuntos de
la release y el cuerpo en español que se pega en GitHub. Nunca de la fuente.

---

## El orden

### 1. Deja el árbol limpio

Nada que no sea de esta versión. Un documento de otro proyecto dentro del árbol
no molesta hoy y confunde dentro de seis meses a quien lo encuentre y suponga
que pertenece.

### 2. `npm test`

Toda en verde. Incluye `test/formato.js` —que no deja publicar si cambió lo que
se escribe a disco sin subir `FORMATO_VERSION`—, `test/notas.js` —que comprueba
que toda `{{clave}}` citada existe en el diccionario— y `test/muertos.js`.

### 3. `git push`

Antes de la release, no después: la etiqueta apunta a un commit, y una etiqueta
que apunta a algo que sólo existe en tu disco no la puede reconstruir nadie.

### 4. `npm run web:build` — **la primera de dos**

**Por qué dos veces.** La web lee las releases de la API de GitHub para pintar la
página de cada versión. En este punto la release **todavía no existe**, así que
esta construcción *no* trae la página de la versión nueva. Se hace igualmente
porque es la que **genera `web/dist/notas/`**, que es lo que hace falta para los
dos pasos siguientes.

Si intentas invertirlo —release primero, construcción después— te encuentras sin
los ficheros que tienes que adjuntar, y es justo el momento en que la prisa te
hace subir la fuente.

Al terminar imprime el comando de subida. **Guárdalo.**

Y falla si alguna `{{clave}}` no resolvió, en vez de escribir un fichero con las
llaves dentro.

### 5. Crea la release en GitHub

- Etiqueta `v<versión>`, sobre el commit que acabas de empujar.
- Título **en español**, un solo campo, como en todas las anteriores.
- **El cuerpo se copia de `web/dist/notas/<versión>.es.md`**, no de
  `web/notas/`. Si te equivocas de fichero, las llaves se ven en la página de la
  release — y además ese cuerpo es el respaldo del cartel de actualización para
  quien no tenga adjunto en su idioma (ver `consultar()` en
  `src/actualizar.js`).

**La release es la fuente de la verdad**: de ahí lee el actualizador de la
aplicación y de ahí lee la web al construirse. No hay otro sitio.

### 6. Sube los adjuntos

Con el comando que imprimió el paso 4, que es de esta forma:

```
gh release upload v<versión> web/dist/notas/*.md
```

**`dist`, no `notas`.** Éstos son literalmente lo que va a leer el cartel de
actualización: `src/actualizar.js` busca en los adjuntos el nombre exacto
`<versión>.<idioma>.md` y, si lo encuentra, lo enseña en el idioma de cada uno.

Si faltan, no se rompe nada visible: el cartel cae al cuerpo en español y
funciona. Sólo que un alemán lee en español justo cuando decide si instala algo
que le va a mover el histórico. **Es un fallo silencioso, que es la clase que
este proyecto persigue.**

### 7. Comprueba lo que subiste

Diez segundos, y cierra el caso del todo:

```
gh release download v<versión> -p "<versión>.es.md" -D tmp
findstr /C:"{{" tmp\<versión>.es.md
```

No tiene que encontrar nada. Comprueba lo que hay **en la release**, que es lo
único que ven los demás — no lo que hay en tu disco.

### 8. `npm run dist` — el instalador, y pruébalo a mano

Sale en `dist/`. **Instálalo y ábrelo antes de anunciar nada.**

Y sube a la release el `.exe` y el `latest.yml` que produce: el actualizador
busca los dos en los adjuntos (`src/actualizar.js`), y sin `latest.yml` no
detecta la versión nueva.

**Si la versión fuerza una reconstrucción** —`RECONSTRUIR_DESDE` ha subido—
compruébalo con los ojos:

- que sale el cartel de reconstruir y que la barra avanza
- que la primera apertura tarda, porque relee el registro entero
- **y el criterio de aceptación es una DIFERENCIA, no un total.** Apunta cuántas
  peleas tienes antes de reconstruir y compara. El total absoluto no vale como
  criterio porque el registro crece mientras tanto: entre dos mediciones de la
  misma tarde, el mismo cambio dio 714 → 710 y 719 → 715. Lo que se repite es la
  diferencia.
- si sale otra diferencia, **para** y averigua por qué antes de anunciar.

### 9. `npm run web:build` — **la segunda**

Ahora la release existe, así que ésta sí trae la página de la versión nueva.

### 10. Despliega la web

> **PENDIENTE: el comando de despliegue a Cloudflare (proyecto `eqlparse`) no
> está escrito en ninguna parte del repositorio.** Se buscó al escribir este
> documento y no hay ni script en `package.json`, ni `wrangler.toml`, ni una
> mención en el código. Vive en la memoria de quien despliega, que es
> exactamente el fallo que este fichero existe para cerrar.
>
> Quien lo sepa: escríbelo aquí, y mejor aún como script en `package.json` para
> que se copie en vez de recordarse.

### 11. Mira los cinco idiomas en la web desplegada

Buscando `{{`. En **esta** construcción, la segunda — en la primera la página de
la versión nueva ni siquiera existe, así que mirarla ahí no comprueba nada.

El paso 4 ya garantiza que los `.md` de `dist` no llevan llaves, y el 7 que lo
subido tampoco. Esto comprueba el tercer camino, que es distinto de los dos: el
de la web construida.

### 12. Avisa a los demás

Y si la versión reconstruye, **dilo**: la primera apertura tarda porque relee el
registro entero. Quien no lo sepa piensa que se ha colgado.

---

## Por qué el orden es el que es

Las dependencias, para que nadie las reordene sin verlas:

```
push ──> web:build (1ª) ──> dist/notas/ ──┬─> cuerpo de la release
                                          └─> adjuntos de la release
                                                      │
                       release publicada <────────────┘
                                │
                                └──> web:build (2ª) ──> página de la versión
```

- **La construcción va antes que la release** porque la release necesita lo que
  la construcción produce.
- **La construcción va también después** porque la página necesita la release.
- **Los adjuntos van después del cuerpo** sólo por comodidad; lo que no puede
  cambiar es que los dos salgan de `dist`.
- **La comprobación va antes del instalador** porque es la barata: si algo está
  mal, mejor descubrirlo antes de dedicar diez minutos a compilar.
