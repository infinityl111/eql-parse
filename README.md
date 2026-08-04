# EQL Parse &lt;SPAIN&gt; Guild

**Español** · [English](README.en.md)

[![Descargar](https://img.shields.io/github/v/release/infinityl111/eql-parse-spain?label=Descargar&style=for-the-badge&color=1f7c8c)](https://github.com/infinityl111/eql-parse-spain/releases/latest)
[![Invitar a un café](https://img.shields.io/badge/Invitar%20a%20un%20caf%C3%A9-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/eqcampeon)

Parser de combate en tiempo real para EverQuest Legends: medidor de daño,
overlay sobre el juego, consejo de postura, avisos por voz y análisis
posterior de las peleas grandes.

Interfaz en español, inglés, francés, alemán y portugués.

![Ventana principal](docs/combate.png)

---

## Para quien sólo quiere usarlo

1. Descarga `EQL-Parse-SPAIN-1.0.0-setup.exe` y ejecútalo.
2. Windows dirá que no reconoce la aplicación. Es normal en programas sin
   certificado de firma: **Más información → Ejecutar de todos modos**.
3. Dentro del juego, escribe `/log on`.
4. Options → Filters: pon **todo lo relacionado con daño al máximo detalle**,
   tanto lo tuyo como lo de los demás. Sin esto el parser no ve el daño del
   grupo y las cifras salen mal. Es el fallo número uno.
5. Abre la aplicación. Busca sola tu `eqlog_*.txt` en todas las unidades.
6. En el panel de consejo, elige tus tres clases. También se leen escribiendo
   `/who` en el juego.
7. Si usas mascota, escribe `/pet who leader` una vez: en EQL cambia de nombre
   en cada invocación y así se identifica sola.

### Atajos

| Atajo | Qué hace |
| --- | --- |
| `Ctrl+Alt+M` | Muestra u oculta el overlay |
| `Ctrl+Alt+O` | Alterna entre clics al juego y clics al overlay |
| `Ctrl+Alt+X` | Cierra el overlay |

El overlay necesita EQL en **ventana o borderless**. En pantalla completa
exclusiva Windows no deja dibujar nada por encima.

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

### Análisis posterior de las peleas grandes

![Análisis](docs/analisis.png)

Corta la pelea en fases por lo que pasa, no por tiempo: cuando cambia la
composición del daño entrante, cuando dejas de pegar, cuando entra un pico o el
jefe invoca. Después señala once cosas concretas, cada una con su impacto
cuantificado: tiempo sin pegar, postura equivocada por tramos, precisión,
curaciones del enemigo, control recibido, interrupciones, resistencias,
curación desperdiciada, foco, bajas y ráfaga contra sostenido.

### Overlay

Se atenúa fuera de combate y se ilumina al empezar. Al cerrarse la pelea
destaca el resultado unos segundos. Avisa si tu postura no es la mejor, y sólo
si el cambio merece la pena.

### Voz

Lee el chat entrante con una casilla por canal —susurros, grupo, hermandad,
raid— y comenta el combate: cambio de postura recomendado, tu muerte, la de tu
mascota, enemigos que se suman, resumen al acabar.

También avisa de los casteos enemigos que cambian la pelea, filtrados por
categoría: curaciones, encantar, mez, miedo, raíz. Sólo de enemigos, nunca de
tus compañeros, y sin repetir la misma categoría del mismo bicho en 8 segundos.

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
src/stances.js     datos de posturas e invocaciones de las 16 clases
src/advisor.js     qué postura conviene, con el daño revertido a bruto
src/analysis.js    análisis posterior de peleas largas
src/spells.js      clasificación de hechizos por categoría
src/narrator.js    voz: chat y combate
src/triggers.js    disparadores por expresión regular, estilo GINA
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
- La marca de tiempo tiene resolución de un segundo, así que en peleas de
  pocos segundos el DPS tiene un error estructural grande. Se usa la
  convención de GamParse y ACT, `total / (último − primero + 1)`, que es la
  comparable con lo que postea la gente.
- El daño de escudo sin posesivo (`shards of ice`) no se puede atribuir y se
  deja aparte en vez de adjudicarlo a alguien.

---

## Apoyo

Proyecto personal y gratuito. Si te resulta útil y te apetece invitar a un café,
[aquí está el enlace](https://paypal.me/eqcampeon). No hace falta.
