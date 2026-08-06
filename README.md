# EQL Parse &lt;SPAIN&gt; Guild

**Español** · [English](README.en.md)

[![Descargar](https://img.shields.io/github/v/release/infinityl111/eql-parse-spain?label=Descargar&style=for-the-badge&color=1f7c8c)](https://github.com/infinityl111/eql-parse-spain/releases/latest)
[![Invitar a un café](https://img.shields.io/badge/Invitar%20a%20un%20caf%C3%A9-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/eqcampeon)

Parser de combate en tiempo real para EverQuest Legends. Mide tu daño, te dice
qué postura conviene según lo que te está entrando, lee el chat en voz alta,
guarda todas tus peleas y arma una enciclopedia de zonas, enemigos y botín
con lo que has medido tú y lo que cuenta la wiki.

Interfaz en español, inglés, francés, alemán y portugués.

![Ventana principal](docs/combate.png)

---

## Para quien sólo quiere usarlo

1. Descarga el instalador y ejecútalo.
2. Windows dirá que no reconoce la aplicación. Es normal en programas sin
   certificado de firma: **Más información → Ejecutar de todos modos**.
3. Dentro del juego, escribe `/log on`.
4. Options → Filters: pon **todo lo relacionado con daño al máximo detalle**,
   tanto lo tuyo como lo de los demás. Sin esto el parser no ve el daño del
   grupo y las cifras salen mal. Es el fallo número uno.
5. Abre la aplicación. Busca sola tu `eqlog_*.txt` en todas las unidades y lee
   el registro entero la primera vez.
6. Elige tus tres clases, o escribe `/who` y se leen solas.
7. Si usas mascota, escribe `/pet who leader` una vez: en EQL cambia de nombre
   en cada invocación y así queda identificada para siempre.

### Atajos

| Atajo | Qué hace |
| --- | --- |
| `Ctrl+Alt+M` | Muestra u oculta el overlay |
| `Ctrl+Alt+O` | Alterna entre clics al juego y clics al overlay |
| `Ctrl+Alt+X` | Cierra el overlay |

El overlay necesita EQL en **ventana o borderless**. Y si el juego se
entrecorta al usarlo, mira **Options → Display → Max Background FPS**: con
«Min CPU» el juego baja a unos pocos fotogramas al perder el foco.

---

## Qué hace

### Consejo de postura medido, no supuesto

![Consejo de postura](docs/postura.png)

El log guarda el daño **ya mitigado**: si estabas en Defensive, el melé que ves
está a la mitad. Comparar posturas con esas cifras te empujaría siempre hacia la
que ya llevabas puesta. El programa revierte la mitigación usando la postura
activa en cada golpe y compara sobre daño bruto.

De la aritmética del wiki salen dos umbrales que a ojo no se ven:

- Channeler supera a Defensive cuando el daño mágico pasa de la mitad del melé.
- Y supera a Mage Hunter cuando el melé pasa de la mitad del mágico.

Es decir, Channeler no es un término medio conformista: es la elección correcta
en toda la franja central.

### Expediente del enemigo

![Expediente del enemigo](docs/enemigo.png)

Eliges un enemigo y ves todo lo que se sabe de él:

- **Vida estimada**, deducida del daño que costó tumbarlo. El log no da la vida
  de nadie, así que es una cota medida y se dice claramente.
- **Qué hechizos tuyos resiste**, separado por invocación. El mismo hechizo
  puede entrar el 20% con Inversion y el 80% con Over Channel; el promedio de
  las dos no describe ninguna. Así sabes con tus números si el −150 de
  resistencia compensa contra cada enemigo.
- **Cómo te pega**: sus habilidades ordenadas por daño y el golpe más fuerte.
- **Lo que dice la wiki**, sacado de eqlwiki.com. De Lord Nagafen: «Fire and
  Magic Resists mean everything with this fellow».
- **Qué suelta**, con enlace a cada objeto.

### Enciclopedia

![Enciclopedia](docs/enciclopedia.png)

Todo lo que has ido aprendiendo peleando, ordenado para consultarlo después. Y
una regla que gobierna la sección entera: **no se calcula nada al abrirla**. La
ficha de cada enemigo se pone al día al cerrar cada pelea, que es cuando el dato
ya está en la mano; consultarla es leer, no calcular. Con dos mil peleas
guardadas, abrir cualquiera de sus pantallas cuesta dos centésimas de segundo.

#### Zonas, y por qué está partido por dificultad

![Zonas por dificultad](docs/zonas.png)

Una fila por zona y una columna por dificultad, de la D0 a la D4. Esta pantalla
es la que explica de un vistazo por qué todo lo demás está separado: la misma
zona en D2, D3 y D4 no es la misma zona. En EQL cada instancia sortea una
dificultad y los enemigos cambian de verdad — medido en un registro real, Magus
Rokyl tiene un **59% más de vida en D3 que en D2**, pega 3,6 veces más fuerte y
lanza dos hechizos que en D2 no tiene. Promediarlas describiría un enemigo que
no existe.

La celda vacía va a trazos y no dice que ahí no haya nada: dice que **no has
entrado**. Son dos cosas distintas y conviene que se distingan. La D0 es el
mundo abierto: el registro no la escribe —una zona sin instanciar no dice «-
Solo 0», no dice nada—, pero la pregunta «¿en qué dificultad?» tiene respuesta.

#### El expediente de un enemigo, y todo lo que has peleado contra él

![Expediente en la enciclopedia](docs/expediente.png)

Al entrar en un enemigo sale su ficha completa —vida estimada, una tarjeta por
dificultad, qué resiste, con qué te pega, lo que dice la wiki y qué suelta— y
debajo **todos los combates que has tenido contra él** en esa zona y esa
dificultad. Pulsando uno se abre en la pestaña de Combate.

La vida estimada nunca se promedia entre dificultades: se enseña la de la más
alta en la que llegó a caer, con su etiqueta al lado. Si en la más alta nunca
cayó, se enseña la de abajo — decir la de arriba sería inventarla.

#### Botín

![Botín](docs/botin.png)

Cada objeto, de quién ha caído y cuántas veces: **«2 en 9 caídas»**. Son dos
cifras medidas puestas una al lado de la otra —las veces que lo has tumbado y
las veces que soltó eso—, no una probabilidad de caída: mezcla todas las
dificultades, porque el registro atribuye el objeto a un nombre y no a una
instancia. Y lo que el registro no atribuye a nadie sale igual, diciendo que no
tiene fuente: una lista a la que le faltan objetos sin avisar es peor que una
con huecos declarados.

#### La ficha se aprende, no se calcula

Se guarda junto a tu histórico y lleva tres marcas que detectan tres cosas
distintas: su propia generación, la del almacén con el que se construyó y la
última pelea incorporada. Si sólo le faltan las peleas de mientras la aplicación
estaba cerrada, las incorpora al arrancar; si reconstruiste el histórico, lo
detecta y se rehace entera. Hay un botón al pie de la sección y el comando
`npm run enc:rebuild`, que además compara la rehecha con la que había y avisa si
alguna cifra se ha movido. Rehacerla no relee tu registro: recorre el histórico
que ya tienes guardado.

### Resumen del tramo

![Resumen del tramo](docs/resumen.png)

Todas las peleas de las últimas 2 h, 12 h, 24 h, 3 días, semana o mes en un
único desglose. Cada combatiente se despliega con sus habilidades sumadas, por
tipo de daño, por objetivo y quién le pegó. El dps se mide sobre los segundos
de combate, no sobre el tiempo transcurrido.

Las peleas se guardan en disco, así que al abrir la aplicación están ahí al
instante sin releer el registro.

### Análisis posterior

![Análisis](docs/analisis.png)

Corta la pelea en fases por lo que pasa, no por tiempo: cuando cambia la
composición del daño entrante, cuando dejas de pegar, cuando entra un pico o el
jefe invoca. Después señala once cosas concretas, cada una con su impacto
cuantificado: tiempo sin pegar, postura equivocada por tramos, precisión,
curaciones del enemigo, control recibido, interrupciones, resistencias,
curación desperdiciada, foco, bajas y ráfaga contra sostenido.

### Overlay

![Overlay](docs/overlay.png)

Dos columnas, los tuyos y los enemigos. El daño se acumula durante toda la
sesión y sólo se pone a cero cuando tú quieres. Las filas se despliegan al
pulsarlas, los enemigos caídos van bajando, y al morir uno aparece unos
segundos el reparto de quién le hizo cuánto.

### Botín con ficha de objeto

![Ficha de objeto](docs/objeto.png)

Cada pelea guarda lo que soltó, distinguiendo lo recogido, lo autovendido y las
mejoras. Al pasar el ratón sale la ficha con el aspecto del juego, sacada de la
wiki; al pulsar se abre su página.

### Nivel y clases: tres fuentes, y un orden entre ellas

![Aviso de contradicción de clase](docs/contradiccion.png)

En EQL puedes cambiar tu trío de clases, y el log **no lo dice en ninguna
parte**. Como el nivel efectivo es el de tu clase más baja, un cambio de trío
puede hundirlo de 50 a 24 sin dejar rastro. Sin resolver esto, comparar tu DPS
de hoy con el de ayer no significa nada.

Se resuelve con tres fuentes, y la etiqueta siempre dice cuál mandó:

1. **Lo que declaras a mano** — tú estabas allí y el log no.
2. **El `/who`** — cierto, pero sólo del instante en que lo escribes.
3. **Un hechizo exclusivo** — prueba que esa clase estaba activa. Nunca el nivel.

Si lanzas un hechizo que sólo puede lanzar una clase que no consta en tu trío,
sale el aviso de arriba con el nombre del hechizo y de la clase, y te pide un
`/who`. El trío se corrige solo; el nivel **se borra**, porque ningún hechizo
prueba un nivel. Un hechizo compartido por dos clases no prueba nada y se
calla.

### La tabla de tríos

![Tabla de tríos declarados](docs/trios.png)

Tu palabra manda sobre las otras dos, incluido un `/who` posterior: ese `/who`
describe un momento posterior, no el tuyo. El botón **«Cambié de trío»** está
junto a tus clases, no enterrado en ajustes, porque es el gesto del 90% de las
veces. Para tramos pasados, la tabla completa con fecha, trío y nivel.

El nivel del renglón es opcional a propósito: déjalo vacío mientras estés
subiendo y mandarán las subidas de nivel del log dentro de ese tramo.

Y como lo manual manda, debajo de la tabla se señalan **las veces que tu tabla
y el log no dicen lo mismo**. No se corrige nada: se enseña, porque si te
equivocas al declarar una fecha no hay nada más que te avise.

### Quién es de los tuyos

![Aliados sin identificar](docs/sinidentificar.png)

El log de EQL no dice quién va en tu grupo: ni invitaciones, ni entradas, ni
salidas. Así que alguien que pega a tus enemigos no se distingue de un
compañero por ningún dato.

Lo que sí se puede afirmar, se afirma: **quien cura a un enemigo es enemigo**,
y la regla se propaga al que cura al que cura. El resto —jugadores que
hicieron daño real pero de los que no hay ni un `/who`— va en su propia
sección **«Sin identificar»**, ni borrado ni sumado a tu bando. Con un botón
«No es de los míos» para los que tú sepas, que se recuerda entre sesiones.

En EQL la mascota además cambia de nombre en cada invocación. Cuando aparece
una nueva sin identificar, se te pide un `/pet who leader` una vez por nombre
y sesión, con casilla para apagarlo.

### Voz y avisos

Lee el chat entrante con una casilla por canal y comenta el combate: cambio de
postura recomendado, tu muerte, la de tu mascota, enemigos que se suman,
resumen al acabar. También avisa de los casteos enemigos que cambian la pelea
—curaciones, encantar, mez, miedo, raíz— sólo de enemigos y sin repetirse.

Y un editor de disparadores por expresión regular, estilo GINA, con
temporizadores y prueba en vivo.

---

## Para quien quiera tocarlo

```
npm install
npm start              # desarrollo
npm run dist           # instalador en dist/
npm test               # 381 comprobaciones del motor
npm run calibrate -- "ruta\al\eqlog.txt" --self TuPJ
npm run store:check    # revisa el histórico sin escribir nada
npm run store:rebuild  # lo reconstruye releyendo el log
```

```
src/tailer.js      lectura incremental del log
src/patterns.js    diccionario de patrones, calibrado contra logs reales
src/parser.js      línea -> evento normalizado
src/encounter.js   segmentación de peleas y agregación
src/store.js       almacén de peleas: se añade al final, nunca se reescribe
src/rebuild.js     reconstrucción del histórico releyendo el log
src/aggregate.js   suma de varias peleas y expediente del enemigo
src/stances.js     datos de posturas e invocaciones de las 16 clases
src/classes.js     hechizos exclusivos de cada clase, del wiki
src/trios.js       la tabla de tríos que declaras a mano
src/zones.js       zona, sub-zona y dificultad de instancia
src/advisor.js     qué postura conviene, con el daño revertido a bruto
src/analysis.js    análisis posterior de peleas largas
src/wiki.js        fichas de objeto y notas tácticas desde eqlwiki.com
src/spells.js      clasificación de hechizos por categoría
src/narrator.js    voz: chat y combate
src/triggers.js    disparadores por expresión regular
src/i18n.js        traducciones
src/engine.js      fachada que une todo
electron/          ventanas, IPC, configuración
ui/                interfaz, sin compilación
```

`npm run calibrate` recorre un log y lista las líneas que el parser **no**
reconoce, ordenadas por frecuencia. Es la herramienta para ampliar el
diccionario cuando EQL cambie textos o añada hechizos.

---

## Qué no puede saber

El log de EverQuest no registra vida, vigor, maná ni posiciones de nadie. De
ahí salen los límites del programa, y ninguno se disimula:

- Los costes de cada postura dicen el precio, **no si puedes pagarlo**.
- El análisis nunca dirá si una cura llegó tarde: no hay dato de vida.
- Sólo se conoce **tu** postura; la de los demás no aparece.
- **No dice quién va en tu grupo.** Por eso hay una sección aparte para los
  que pegaron a tus enemigos sin que conste que son tuyos, y un botón para
  resolverlo tú.
- **No dice cuándo cambias de trío de clases, ni a qué nivel te deja.** Se
  deduce de los hechizos exclusivos que lanzas, que prueban la clase pero
  nunca el nivel. Para el nivel hace falta un `/who` tuyo o la tabla manual.
- La vida de un enemigo es una estimación del daño que costó matarlo, no un
  dato oficial.
- La marca de tiempo tiene resolución de un segundo, así que en peleas de
  pocos segundos el DPS tiene un error estructural grande. Se usa la
  convención de GamParse y ACT, `total / (último − primero + 1)`.
- El daño de escudo sin posesivo (`shards of ice`) no se puede atribuir y se
  deja aparte en vez de adjudicarlo a alguien.
- Con una postura de evasión puesta no se puede saber cuánto daño entraría sin
  ella: el log no distingue un esquive de postura de una parada normal, y lo
  que se ve es sólo el 5% de ataques que se colaron. Ahí se enseña el reparto,
  pero no se recomienda nada.

---

## Apoyo

Proyecto personal y gratuito. Si te resulta útil y te apetece invitar a un café,
[aquí está el enlace](https://paypal.me/eqcampeon). No hace falta.
