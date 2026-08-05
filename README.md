# EQL Parse &lt;SPAIN&gt; Guild

**Español** · [English](README.en.md)

[![Descargar](https://img.shields.io/github/v/release/infinityl111/eql-parse-spain?label=Descargar&style=for-the-badge&color=1f7c8c)](https://github.com/infinityl111/eql-parse-spain/releases/latest)
[![Invitar a un café](https://img.shields.io/badge/Invitar%20a%20un%20caf%C3%A9-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/eqcampeon)

Parser de combate en tiempo real para EverQuest Legends. Mide tu daño, te dice
qué postura conviene según lo que te está entrando, lee el chat en voz alta,
guarda todas tus peleas y arma un expediente de cada enemigo con lo que has
medido tú y lo que cuenta la wiki.

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
  resistencia compensa contra cada bicho.
- **Cómo te pega**: sus habilidades ordenadas por daño y el golpe más fuerte.
- **Lo que dice la wiki**, sacado de eqlwiki.com. De Lord Nagafen: «Fire and
  Magic Resists mean everything with this fellow».
- **Qué suelta**, con enlace a cada objeto.

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
npm start          # desarrollo
npm run dist       # instalador en dist/
npm test           # prueba del motor
npm run calibrate -- "ruta\al\eqlog.txt" --self TuPJ
```

```
src/tailer.js      lectura incremental del log
src/patterns.js    diccionario de patrones, calibrado contra logs reales
src/parser.js      línea -> evento normalizado
src/encounter.js   segmentación de peleas y agregación
src/store.js       almacén de peleas: se añade al final, nunca se reescribe
src/aggregate.js   suma de varias peleas y expediente del enemigo
src/stances.js     datos de posturas e invocaciones de las 16 clases
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
- La vida de un enemigo es una estimación del daño que costó matarlo, no un
  dato oficial.
- La marca de tiempo tiene resolución de un segundo, así que en peleas de
  pocos segundos el DPS tiene un error estructural grande. Se usa la
  convención de GamParse y ACT, `total / (último − primero + 1)`.
- El daño de escudo sin posesivo (`shards of ice`) no se puede atribuir y se
  deja aparte en vez de adjudicarlo a alguien.

---

## Apoyo

Proyecto personal y gratuito. Si te resulta útil y te apetece invitar a un café,
[aquí está el enlace](https://paypal.me/eqcampeon). No hace falta.
