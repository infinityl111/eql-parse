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
Escribiendo «crea la release» con el detalle de qué fichero copiar y por
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

> **QUE NO EXISTA LA RELEASE HASTA QUE EXISTA EL ARTEFACTO.**

Ésa es la regla que ordena todo lo de abajo, y **el orden anterior era el
contrario**: creaba la release en el paso 5 y construía el instalador en el 8.
Entre esos dos pasos había una release publicada, visible y sin instalador, y
`/releases/latest` ya la devolvía: cualquiera que abriera la aplicación en esa
ventana veía el cartel de una versión que no se podía descargar. Es el mismo
fallo que la guarda «sin-instalador» vino a tapar por el otro lado.

Y una segunda razón, medida el 19/08/2026: construir el instalador es **la
operación más pesada de todo el ritual** —`npm run dist` reescribe
`dist/win-unpacked` entero, cientos de MB— y hacerla con la release ya creada
deja el peor momento posible para que algo se tuerza. La noche del incidente se
construyó dos veces en ocho minutos.

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

**Y que el último commit nombre la versión.** Cloudflare etiqueta cada
despliegue con el asunto del commit desde el que se lanzó, y ésa es la única
etiqueta que tiene. Ver el paso 11.

### 4. `npm run web:build` — **la primera de dos**

**Por qué dos veces.** La web lee las releases de la API de GitHub para pintar la
página de cada versión. En este punto la release **todavía no existe**, así que
esta construcción *no* trae la página de la versión nueva. Se hace igualmente
porque es la que **genera `web/dist/notas/`**, que es lo que hace falta para la
release.

Al terminar imprime el comando de subida. **Guárdalo.** Y falla si alguna
`{{clave}}` no resolvió, en vez de escribir un fichero con las llaves dentro.

### 5. `npm run dist` — EL INSTALADOR, ANTES QUE LA RELEASE

Sale en `dist/`. **Instálalo y ábrelo antes de seguir.**

#### Desde el commit exacto, y en worktree desasociado

Que el árbol estuviera limpio **no demuestra qué se empaquetó**. Lo que lo
demuestra es construir desde el commit etiquetado, aislado de tu copia de
trabajo.

> **LA CARPETA SE CREA Y SE RETIRA EN ESTE MISMO PASO. No son dos.**
>
> Estaba escrito como «al terminar, `git worktree remove`» al final del
> párrafo, y **no se hizo ni una sola vez**: el 20/08/2026 quedaban en `D:`
> tres carpetas de construcción de versiones ya publicadas —`eql-build-1.16.0`,
> `eql-build-1161`, `eql-build-2547b99`— ocupando **2 GB** y mezcladas con las
> carpetas de juegos del usuario.
>
> No es desorden: una carpeta de construcción vieja **se parece a la copia de
> trabajo**, tiene el mismo aspecto y un `package.json` con una versión
> plausible dentro. La siguiente persona que entre ahí a mirar algo estará
> mirando código de hace tres versiones sin saberlo.

Un paso, con su retirada dentro:

```sh
# 1. crear, siempre con la VERSIÓN en el nombre para que se sepa de qué es
git worktree add --detach ../eql-build-<versión> <commit>

# 2. construir
cd ../eql-build-<versión> && npm ci && npm run dist

# 3. comprobar el contenido (el apartado de abajo) e instalar

# 4. RETIRAR — en cuanto el instalador esté subido y comprobado
cd -
git worktree remove --force ../eql-build-<versión>
git worktree list        # tiene que quedar sólo tu copia de trabajo
```

**Antes de retirar, la comprobación que hace que retirar sea seguro:** que el
commit siga vivo sin la carpeta. Una carpeta de trabajo mantiene vivo su commit;
si ese commit no está en `main` ni etiquetado, al quitarla queda colgando y un
`git gc` se lo lleva — y entonces lo «regenerable» deja de serlo.

```sh
git merge-base --is-ancestor <commit> main && echo vivo
```

**Y no se retira antes de tiempo:** el instalador vive dentro de esa carpeta
hasta que está subido a la release. El orden es construir → comprobar → subir →
retirar. Mientras la release esté en prelanzamiento y sin instalar, la carpeta
se queda.

#### COMPRUEBA QUE LO EMPAQUETADO ES LO QUE CREES, por hash y por contenido

La versión del `.exe` y el `sha512` dicen que el fichero es coherente consigo
mismo. No dicen **qué código lleva dentro**. Con `asar` desactivado eso se
comprueba en un minuto, y hay que comprobarlo en los dos sentidos:

```
R=dist/win-unpacked/resources/app
git hash-object $R/src/actualizar.js     # ¿es el del commit etiquetado?
git rev-parse   <commit>:src/actualizar.js
```

**Y EL SENTIDO QUE SE OLVIDA ES EL POSITIVO.** Al construir la 1.16.0 se
comprobó que `sin-instalador` daba **CERO** dentro del paquete, porque esa
guarda iba a la 1.16.1 y no debía colarse. Eso está bien y es la mitad.

> **La otra mitad: a partir de la 1.16.1, `sin-instalador` tiene que dar
> DISTINTO DE CERO en todo instalador posterior.**
>
> ```
> grep -c 'sin-instalador' dist/win-unpacked/resources/app/src/actualizar.js
> ```
>
> Si da cero, la guarda **se ha perdido por el camino** —una rama mal fusionada,
> un fichero que no entró— y estás publicando una versión que vuelve a poder
> ofrecer una descarga que no existe.

La regla general, que vale para cualquier guarda: **comprobar que lo que NO debe
estar no está es sólo la mitad; la otra es que lo que SÍ debe estar, está.** Un
`grep` a cero no distingue «lo quitamos a propósito» de «se perdió».

### 5 bis. UN NÚMERO DE VERSIÓN NO SE REUTILIZA NUNCA

> **En cuanto ese número ha existido como ejecutable INSTALADO, está gastado.**
> Aunque no se haya publicado. Aunque el prelanzamiento se retire y nadie lo
> haya visto.

El instalador se prueba antes de publicar —paso 5— y probarlo significa que hay
un `.exe` con ese número **en un disco de verdad**. Si luego se corrige algo y
se reconstruye con el mismo número, quedan **dos binarios distintos llamándose
igual**, y uno de ellos está instalado en la máquina de quien lo probó.

A partir de ahí nada de lo que diga esa máquina es fiable: «me pasa X en la
1.19.0» deja de identificar un código. Y el actualizador tampoco lo arregla —
compara números, así que no ve ninguna diferencia entre los dos.

**Los números son gratis.** Se retira el prelanzamiento sin publicarlo, se borra
su etiqueta, y sale el siguiente.

```sh
gh release delete v<versión> --yes --cleanup-tag
git push origin :refs/tags/v<versión>    # por si la etiqueta sobrevive
git tag -d v<versión>
```

**Y sus notas se van con ella.** El paso 11 exige que toda versión con notas en
`web/notas/` tenga su release, y hace bien: unas notas escritas y sin publicar
son algo redactado para alguien que no lo ha leído. Lo que decían **se dobla
dentro de las notas del número nuevo**, que es quien va a llegar al usuario.

*Cicatriz, 20/08/2026:* la 1.19.0 llegó a instalarse para probarla y luego
apareció que el temporizador no se había reiniciado nunca. Reconstruir la 1.19.0
con el arreglo dentro habría dejado dos «1.19.0» distintas, una de ellas en el
disco de Campeón. Salió la 1.19.1.

### 6. Crea la release COMO PRELANZAMIENTO

```
gh release create v<versión> --target <commit> --prerelease --title "<título>" --notes-file web/dist/notas/<versión>.es.md
```

**`--prerelease` no es opcional.** Mientras lo sea, `/releases/latest` sigue
devolviendo la versión anterior, así que **nadie ve nada** hasta que todos los
artefactos estén subidos y comprobados. Es lo que convierte los pasos 7 y 8 en
reversibles: si algo está mal, se corrige sin que nadie se haya enterado.

- Etiqueta `v<versión>`, sobre el commit que acabas de empujar.
- Título **en español**, un solo campo, como en todas las anteriores.
- **El cuerpo se copia de `web/dist/notas/<versión>.es.md`**, no de
  `web/notas/`. Si te equivocas de fichero, las llaves se ven en la página de la
  release — y además ese cuerpo es el respaldo del cartel de actualización para
  quien no tenga adjunto en su idioma (ver `consultar()` en
  `src/actualizar.js`).

**La release es la fuente de la verdad**: de ahí lee el actualizador de la
aplicación y de ahí lee la web al construirse. No hay otro sitio.

### 7. Súbele TODOS los artefactos

Las notas, con el comando que imprimió el paso 4:

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

Y el instalador **POR SU NOMBRE, nunca con comodín**:

```
gh release upload v<versión> "dist/EQL-Parse-<versión>-setup.exe" dist/latest.yml
```

**`dist/` no se vacía entre versiones**: guarda todos los instaladores que has
construido. Así que `dist/*.exe` no significa «el de ahora», significa «todos los
que quedan ahí». En la 1.15.0 el comodín subió **cuatro** —1.12.0, 1.14.0, 1.14.1
y 1.15.0— y **no falló nada**: `latest.yml` apuntaba al bueno, así que el
actualizador siguió correcto y nadie se enteró por ahí.

Lo que sí se rompió fue la web. `web/build.mjs` se queda con **el primer adjunto
que acaba en `.exe`** y el primero era el de la 1.12.0. El botón de descarga de
la versión nueva ofrecía el instalador viejo, con su tamaño correcto al lado y
sin nada raro a la vista.

La otra salida era limpiar `dist/` antes de construir. **El nombre exacto es
mejor**: no puede recoger nada que no sea de esta versión y no depende de que
nadie se acuerde de nada. Lo único que escribes a mano es el número de versión, y
si te equivocas, `gh` no encuentra el fichero y **para**. Un comodín no para
nunca: siempre encuentra algo.

Es la forma de la pinza: no falla, entrega algo plausible. Un `.exe` de 78 MB con
nombre de instalador es un resultado creíble hasta que miras cuál.

`latest.yml` también es obligatorio: sin él el actualizador no detecta la versión
nueva.

### 8. Comprueba lo subido — TRES COMPROBACIONES FIJAS

Sobre la release, que es lo único que ven los demás; no sobre tu disco.

**Una · ningún `{{` en las notas publicadas.**

```
gh release download v<versión> -p "<versión>.es.md" -D tmp
findstr /C:"{{" tmp\<versión>.es.md
```

**Dos · exactamente UN `.exe`, y es el de esta versión.**

```
gh release view v<versión> --json assets --jq '[.assets[].name | select(endswith(".exe"))]'
```

Tiene que salir una lista de **un** elemento. El sobrante se quita con
`gh release delete-asset v<versión> <nombre>`.

**Tres · «sin-instalador» distinto de cero**, que es la del paso 5 y se repite
aquí sobre lo que de verdad está colgado, no sobre lo que construiste.

### 9. PUERTA: `/releases/latest` sigue devolviendo la ANTERIOR

```
gh api repos/<repo>/releases/latest --jq .tag_name
```

Tiene que decir la versión **vieja**. Si dice la nueva, el `--prerelease` no se
aplicó y llevas un rato publicando en directo sin saberlo. Para y arréglalo
antes de seguir.

### 10. Sólo entonces, márcala definitiva

```
gh release edit v<versión> --prerelease=false --latest
```

#### PUERTA FINAL: las dos cosas, no una

```
gh release view v<versión> --json tagName,isLatest,assets
```

- `/releases/latest` devuelve **la nueva**, y
- su `.exe` está **entre los adjuntos**.

Las dos. Ninguna se deduce de la otra: una release marcada `latest` sin su
instalador es exactamente el estado que rompe el cartel de actualización.

### 11. `npm run web:build` — **la segunda** — y despliega

Ahora la release existe, así que ésta sí trae la página de la versión nueva.

**Y es la que comprueba que no te dejaste ninguna atrás.** Como la release de hoy
ya está creada, esta construcción exige que **toda versión con notas escritas en
`web/notas/` tenga su release** — y se para si no. Es la red que faltaba el día
que la v1.13.0 no llegó a existir: ver `web/huerfanas.mjs`, y arriba, «nació
saltándose un paso».

Si se pone roja, hay dos salidas y ninguna es seguir: **publicar esa release**, o
**borrar sus notas**. Unas notas escritas y sin publicar no son un borrador — son
algo redactado para alguien que no lo ha leído.

```
npm run web:deploy
```

#### Vista previa y producción no son lo mismo

Cloudflare decide entre las dos **por la rama**, y ahí hay un fallo silencioso
esperando: un despliegue que sólo llega a la vista previa **parece un éxito
completo en la consola** mientras el sitio real no cambia. Wrangler saca la rama
del propio git y **no imprime cuál detectó**.

> **Si git está en mal estado, wrangler no puede leer la rama y el despliegue se
> va a una vista previa.** Pasó el 19/08/2026 con el índice corrupto. En ese
> caso, `--branch main` fuerza producción.

Lo que sí lo dice, después y siempre:

```
npx wrangler pages deployment list --project-name=eqlparse
```

La primera fila tiene que decir **Production**, rama **main**.

**Dónde mirar cuando algo salga mal:** wrangler deja un registro por invocación
en `%APPDATA%\xdg.config\.wrangler\logs\`.

### 12. Comprueba contra el dominio de producción

No vale la consola: dice que subió algo, no que lo subido sea lo que la gente ve.
Y no vale un grep del número de versión, que es lo que ponía aquí:

```
curl -s https://eqlparse.com/es/ | findstr /C:"1.13.0"      ← NO BASTA
```

**Ese grep da verde con el sitio roto.** El número sale también en el pie de las
veinte páginas, así que casa aunque el botón apunte a una release que no existe.

Lo que hay que comprobar son **las cosas que se rompen, en los cinco idiomas**:

| qué | cómo se sabe |
|---|---|
| la portada declara la versión nueva | `1.16.0` en `/<idioma>/` |
| el botón lleva al instalador | la página trae `releases/download/v1.16.0/EQL-Parse-1.16.0-setup.exe` |
| y ese instalador EXISTE | esa URL responde `200` y devuelve los bytes que dice `latest.yml` |
| el tamaño es el de verdad | `75 MB` en la portada, y cuadra con los bytes del `.exe` |
| las novedades están enteras | tantos `<article>` como versiones publicadas |
| los volcados salen como volcados | los `<pre>` que toquen, y **cero** acentos graves sueltos |
| las notas están en su idioma | la nota de la versión nueva, en la página alemana, en alemán |
| y ninguna lleva `{{` | en las cinco, sobre ESTA construcción |

Ninguna se deduce de otra. Las corre todas `npm run web:vivo`
(`bin/web-vivo.mjs`), que reintenta mientras Cloudflare propaga, porque **la
primera respuesta no vale como respuesta**.

Y si sospechas de la caché del borde, pide la página con `Cache-Control:
no-cache`.

### 13. La comprobación que no es de GitHub: desde una instalación anterior

**Que el cartel ofrezca la nueva y que el botón lleve a un `.exe` que existe.**
Es el único camino por el que lo ve un usuario, y no lo cubre ninguno de los
pasos anteriores: los 8 y 10 miran la release, el 12 mira la web, y el cartel no
sale ni de una ni de la otra sino de `consultar()` en `src/actualizar.js`.

**Si la versión fuerza una reconstrucción** —`RECONSTRUIR_DESDE` ha subido—
compruébalo con los ojos:

- que sale el cartel de reconstruir y que la barra avanza
- que la primera apertura tarda, porque relee el registro entero
- **y el criterio de aceptación es una DIFERENCIA, no un total.** Apunta cuántas
  peleas tienes antes de reconstruir y compara. El total absoluto no vale porque
  el registro crece mientras tanto: entre dos mediciones de la misma tarde, el
  mismo cambio dio 714 → 710 y 719 → 715. Lo que se repite es la diferencia.
- si sale otra diferencia, **para** y averigua por qué antes de anunciar.

### 14. Avisa a los demás

Y si la versión reconstruye, **dilo**: la primera apertura tarda porque relee el
registro entero. Quien no lo sepa piensa que se ha colgado.

### 15. Después de publicar: la comprobación que sólo se puede hacer jugando

Sólo para las versiones que tocan cómo se decide dónde empieza y acaba una
pelea. **No cierra el paso de publicar** —va después, a propósito— pero es la
única parte de esas versiones que no se puede verificar releyendo.

**Por qué no se puede hacer releyendo el registro.** Una pelea se cierra por dos
caminos que no usan el mismo reloj: `feed` decide con la marca del registro y
`tick` con el reloj de pared —ver `MARGEN_TICK` en `src/encounter.js`—. Releer es
*uno de los dos lados*, así que comparar dos relecturas no compara nada. Y hay
una tercera fuente de divergencia que tampoco se ve releyendo: en directo el
analizador descarta líneas que en frío sí entran, porque su estado —las mascotas
detectadas, el filtro de relevancia— no es el mismo recién arrancado que tras
leer el registro entero. Medido sobre el histórico de la 1.13.0: de las 13 peleas
donde la partición en vivo y la de frío no coinciden, **4 son de esa causa**, y
esa causa se agrava al bajar el plazo. No se puede acotar sin jugar.

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

**Qué tiene que salir:** cero peleas exclusivas de un lado o del otro. Lo que hay
que mirar una por una es cualquier bloque donde el vivo tenga más trozos que el
frío.

**Y si sale mal, el hueco del corte dice de qué es** —míralo antes de tocar
ninguna constante:

| hueco del corte | qué es | qué se hace |
| --- | --- | --- |
| 0–5 s | un reinicio de la aplicación, o un cierre por cambio de zona | nada: es correcto |
| cerca del plazo | el reloj de pared se comió el margen | subir `MARGEN_TICK`, que no puede cambiar la partición en frío |
| bastante mayor que el plazo | líneas que en vivo se descartan y en frío entran | es el filtro de relevancia, otro problema y más viejo: anótalo, no toques el plazo |

---

## Dos trampas que no van en ningún paso porque son de fuera del ritual

**Al corregir una nota ya publicada:** primero el **CUERPO**, después los
**ADJUNTOS**, para que el respaldo nunca sea peor que lo que sustituye. Y primero
GitHub, después `web:build`, o `releases.json` vuelve a guardar lo viejo.

**Con la release borrada, `web:build` NO SE PARA:** publicaría un sitio sin la
versión nueva y sin decir nada. No lo corras mientras una release esté borrada a
medias.

**Y `published_at` NO se mueve al editar.** Las fechas no sirven para auditar si
una edición ocurrió: el único testigo es el contenido.
---

## Por qué el orden es el que es

Las dependencias, para que nadie las reordene sin verlas:

```
push ──> web:build (1ª) ──> dist/notas/ ──┬─> cuerpo de la release
         │                                └─> adjuntos de notas
         └──> npm run dist ──> .exe + latest.yml ──┐
                                                   │
                    release como PRELANZAMIENTO <──┴── todos los artefactos
                                │
                                ├──> PUERTA: /latest sigue en la anterior
                                │
                    marcar definitiva
                                │
                                ├──> PUERTA FINAL: /latest nueva Y su .exe
                                │
                                └──> web:build (2ª) ──> página ──> deploy
                                                                     │
                                             desde una instalación anterior ←┘
```

- **El instalador va ANTES que la release** porque una release sin su artefacto
  ya la ve todo el mundo. Era al revés, y ése era el fallo.
- **La construcción va antes que las dos** porque la release necesita
  `dist/notas/`, que es lo que produce.
- **La construcción va también después** porque la página necesita la release.
- **El prelanzamiento es lo que hace reversibles los pasos 7 y 8.** Mientras la
  release no sea `latest`, corregir un adjunto no lo ve nadie.
- **Las dos puertas son puertas y no comprobaciones**: la primera confirma que
  todavía no se ha publicado nada, la segunda que se ha publicado entero. Entre
  ellas está el único momento en que el estado es visible y a medias, y dura lo
  que tarda un `gh release edit`.
- **La última comprobación no es de GitHub ni de la web**, sino del camino por
  el que lo ve un usuario: el cartel de una instalación anterior.

## Qué es este documento, y qué no

**El procedimiento**: qué se ejecuta, en qué orden, y por qué ese orden y no
otro. Cada paso lleva su motivo, y los motivos son incidentes propios: una
comprobación sin la avería que la trajo parece redundante, y la primera persona
con prisa la quita.

Lo que NO va aquí es **qué se escribe** —el estilo de las notas, qué cifras se
publican y con qué población—. Eso es otra decisión, se toma antes, y mezclarla
con el procedimiento haría este fichero más largo justo donde tiene que poder
leerse de un tirón mientras se publica.
