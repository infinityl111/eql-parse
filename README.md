# EQL Parse &lt;SPAIN&gt; Guild

Parser de combate en tiempo real para EverQuest Legends: medidor de daño,
overlay sobre el juego, consejo de postura, avisos por voz y análisis
posterior de las peleas grandes.

Interfaz en español, inglés, francés, alemán y portugués.

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
