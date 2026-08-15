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

Y la cuarta se destapó escribiendo esto: el comando de despliegue a Cloudflare no
estaba en ninguna parte del árbol y hubo que recuperarlo ejecutándolo. Ya es
`npm run web:deploy`. Si al leer esto encuentras otro paso que no puedas copiar
de algún sitio, ése es el siguiente.

## Y la quinta es este documento: nació saltándose un paso

Se descubrió seis días después, al publicar la 1.14.0. **La release v1.13.0 nunca
llegó a existir**: el commit estaba en `main`, los cinco `.md` estaban escritos,
`PUBLICAR.md` se había redactado durante esa misma publicación — y no había ni
release, ni etiqueta, ni borrador. Todo el mundo siguió en la 1.12.0 seis días, y
nada lo dijo.

**REDACTAR EL RITUAL Y EJECUTARLO SE PARECEN LO BASTANTE COMO PARA CONFUNDIRLOS.**
Escribiendo «paso 5: crea la release» con el detalle de qué fichero copiar y por
qué, la sensación de haberlo hecho es casi la de hacerlo: se toca el mismo
material, se comprueba lo mismo, se sale con la misma impresión de tarea cerrada.
Es la forma exacta de la salida muerta que persigue `ui/app.js` —trabajo que se
ejecuta bien y no llega a nadie— sólo que aplicada al propio documento que existe
para evitarla.

No se arregla teniendo más cuidado. Se arregla con una guarda que mire el dato,
y el dato ya estaba: `web:build` se trae las releases de la API en cada
construcción. **Ver el paso 9**, que es donde vive ahora esa comprobación.

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

**Y es la que comprueba que no te dejaste ninguna atrás.** Como la release de hoy
ya está creada, esta construcción exige que **toda versión con notas escritas en
`web/notas/` tenga su release** — y se para si no. Es la red que faltaba el día
que la v1.13.0 no llegó a existir: ver `web/huerfanas.mjs`, y arriba, «nació
saltándose un paso».

En la primera construcción no salta, y no es un descuido: allí la release de hoy
todavía no existe **por diseño**, porque esa construcción es justamente la que
genera lo que hace falta para crearla. La propia release de hoy dice en qué
pasada estamos, así que la guarda no necesita que nadie le pase nada.

Si se pone roja, hay dos salidas y ninguna es seguir: **publicar esa release**, o
**borrar sus notas**. Unas notas escritas y sin publicar no son un borrador — son
algo redactado para alguien que no lo ha leído.

### 10. Despliega la web

```
npm run web:deploy
```

que es `npx wrangler pages deploy web/dist --project-name=eqlparse`.

**Por qué es un script y no una línea en este documento.** Fue la última pieza
del ritual que sólo vivía en la memoria de una sesión — y la sesión se acabó.
Al escribir este fichero se buscó por todo el árbol y no había nada: ni script,
ni `wrangler.toml`, ni una mención en el código. Hubo que recuperarlo
ejecutándolo. Nos pasó **mientras escribíamos el documento que cierra
exactamente ese fallo**, que es la mejor prueba de que hacía falta.

Como script se copia; en un documento se relee, y releer es lo que no se hace
con prisa.

**Lo único que había en el árbol era el rastro, no el comando:** una carpeta
`.wrangler/tmp/pages-*` —que sólo crea `wrangler pages deploy`— y el
`_redirects` que `web/build.mjs` escribe en `web/dist`, que es un fichero de
Cloudflare Pages. Suficiente para saber **qué** se hacía y no **cómo**.

#### Vista previa y producción no son lo mismo

Cloudflare Pages decide entre las dos **por la rama**, y ahí hay un fallo
silencioso esperando: un despliegue que sólo llega a la vista previa **parece un
éxito completo en la consola** mientras el sitio real no cambia.

Wrangler saca la rama del propio git, sin que se la digas. Del registro de un
despliegue real:

```
pages deploy: Detected branch: "main"
pages deploy: Git information summary - branch: main, commitHash: 9dd243ae…, commitDirty: false
```

Así que **el despliegue va a producción si lo lanzas desde el repositorio y
estás en la rama de producción del proyecto**. Si estás en otra rama, o si lo
lanzas desde una carpeta que no es un git, la rama detectada cambia y el
despliegue se va a una vista previa. `--branch` es la manera de forzarla.

Wrangler imprime la rama que ha detectado: **mírala**. Es el aviso temprano, y
llega antes que cualquier comprobación.

#### Cómo se comprueba, que es lo que de verdad cierra el paso

No vale la consola. La consola dice que subió algo, no que lo subido sea lo que
la gente ve — es la misma distinción que el paso 7 hace con los adjuntos:
comprobar el artefacto donde lo ve el usuario, no donde lo produjiste.

Comprueba contra **el dominio de producción**, y busca algo que sólo tenga la
versión nueva:

```
curl -s https://eqlparse.com/es/ | findstr /C:"1.13.0"
```

Si no aparece, el despliegue se quedó en la vista previa aunque la consola
dijera que todo fue bien. Y con el número de versión no basta si el navegador o
el borde te sirven algo cacheado: recarga forzada, o pide la página con un
parámetro cualquiera.

**Confirmado, y el comando no necesita `--branch`.** El registro de wrangler
prueba que detecta `main`, pero no guarda la respuesta de la API con
`production_branch`, así que eso hubo que mirarlo donde sí se ve:

> **Panel de Cloudflare → Workers & Pages → `eqlparse` → Deployments.** El de
> arriba tiene que decir **Production**, con la rama `main`, y colgando de él
> `eqlparse.com` y `eqlparse.pages.dev`.

Ésa es la comprobación de la próxima vez, y la que responde a la única pregunta
que ni la consola ni los registros contestan: si esto ha llegado al sitio real o
se ha quedado en una vista previa.

#### Lánzalo desde un commit que nombre la versión

Cloudflare **etiqueta cada despliegue con el asunto del commit desde el que se
lanzó**, y ésa es la única etiqueta que tiene: en la lista de Deployments se leen
«1.12.0 — …» y «1.11.0 — …» sin abrir nada, porque esos despliegues salieron del
commit de su versión.

Y se ve lo que pasa cuando no: el despliegue de la 1.13.0 salió de un commit
llamado «la alarma muerta, junto a la salida muerta». Cierto, útil, y **no dice
qué versión hay ahí arriba**. Un renglón menos legible en una lista que se
consulta justo cuando algo va mal.

Así que antes del despliegue final, mira en qué commit estás. Si el último de la
tanda es un arreglo o un documento, el asunto que va a quedar en Cloudflare es
ése. Lo barato es que **el commit que nombra la versión sea el último antes de
desplegar** — y si la tanda ya se cerró con otra cosa, un commit de cierre corto
que la nombre.

No cambia nada de lo que se publica. Cambia que dentro de tres meses la lista de
Cloudflare se pueda leer sin abrir cada entrada, que es exactamente el mismo
criterio con el que se eligen los rótulos de la aplicación.

**Dónde mirar cuando algo salga mal:** wrangler deja un registro por invocación
en `%APPDATA%\xdg.config\.wrangler\logs\`, con la rama detectada, el commit y
todas las llamadas a la API. Es de donde salieron las dos líneas de arriba.

### 11. Mira los cinco idiomas en la web desplegada

Buscando `{{`. En **esta** construcción, la segunda — en la primera la página de
la versión nueva ni siquiera existe, así que mirarla ahí no comprueba nada.

El paso 4 ya garantiza que los `.md` de `dist` no llevan llaves, y el 7 que lo
subido tampoco. Esto comprueba el tercer camino, que es distinto de los dos: el
de la web construida.

### 12. Avisa a los demás

Y si la versión reconstruye, **dilo**: la primera apertura tarda porque relee el
registro entero. Quien no lo sepa piensa que se ha colgado.

### 13. Después de publicar: la comprobación que sólo se puede hacer jugando

Sólo para las versiones que tocan cómo se decide dónde empieza y acaba una
pelea. **No cierra el paso de publicar** —va después, a propósito— pero es la
única parte de esas versiones que no se puede verificar releyendo, y por eso
tiene que estar escrita aquí y no en la cabeza de nadie.

**Por qué no la puedo hacer yo releyendo el registro.** Una pelea se cierra por
dos caminos que no usan el mismo reloj: `feed` decide con la marca del registro
y `tick` con el reloj de pared —ver `MARGEN_TICK` en `src/encounter.js`—. Releer
es *uno de los dos lados*, así que comparar dos relecturas no compara nada. Y
hay una tercera fuente de divergencia que tampoco se ve releyendo: en directo el
analizador descarta líneas que en frío sí entran, porque su estado —las
mascotas detectadas, el filtro de relevancia— no es el mismo recién arrancado
que tras leer el registro entero. Medido sobre el histórico de la 1.13.0: de las
13 peleas donde la partición en vivo y la de frío no coinciden, **4 son de esa
causa**, y esa causa se agrava al bajar el plazo. No se puede acotar sin jugar.

**Cómo se hace:**

1. Juega una sesión normal con la aplicación enganchada. Una hora larga, y que
   incluya lo que estresa el modelo: tirones encadenados sin pausa, algún bicho
   del que te escapes, y algo que calle a un enemigo sin matarlo —un mez, un
   miedo—.
2. Al terminar, **sin tocar nada**, copia la carpeta del almacén a un lado.
3. Reconstruye desde el mismo registro.
4. Compara las dos particiones **alineando por solape, no por hora de inicio**:
   una pelea que sólo movió el borde no es una pelea distinta, y contarla como
   tal infla la cifra y esconde las que sí importan.

**Qué tiene que salir:** cero peleas exclusivas de un lado o del otro. Lo que
hay que mirar una por una es cualquier bloque donde el vivo tenga más trozos que
el frío.

**Y si sale mal, el hueco del corte dice de qué es** —míralo antes de tocar
ninguna constante:

| hueco del corte | qué es | qué se hace |
| --- | --- | --- |
| 0–5 s | un reinicio de la aplicación, o un cierre por cambio de zona | nada: es correcto |
| cerca del plazo | el reloj de pared se comió el margen | subir `MARGEN_TICK`, que no puede cambiar la partición en frío |
| bastante mayor que el plazo | líneas que en vivo se descartan y en frío entran | es el filtro de relevancia, otro problema y más viejo: anótalo, no toques el plazo |

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
