# EQL Parse &lt;SPAIN&gt; Guild

Parser de combate en tiempo real para EverQuest Legends: medidor de daÃ±o,
overlay sobre el juego, consejo de postura, avisos por voz y anÃ¡lisis
posterior de las peleas grandes.

Interfaz en espaÃ±ol, inglÃ©s, francÃ©s, alemÃ¡n y portuguÃ©s.

---

## Para quien sÃ³lo quiere usarlo

1. Descarga `EQL-Parse-SPAIN-1.0.0-setup.exe` y ejecÃºtalo.
2. Windows dirÃ¡ que no reconoce la aplicaciÃ³n. Es normal en programas sin
   certificado de firma: **MÃ¡s informaciÃ³n â†’ Ejecutar de todos modos**.
3. Dentro del juego, escribe `/log on`.
4. Options â†’ Filters: pon **todo lo relacionado con daÃ±o al mÃ¡ximo detalle**,
   tanto lo tuyo como lo de los demÃ¡s. Sin esto el parser no ve el daÃ±o del
   grupo y las cifras salen mal. Es el fallo nÃºmero uno.
5. Abre la aplicaciÃ³n. Busca sola tu `eqlog_*.txt` en todas las unidades.
6. En el panel de consejo, elige tus tres clases. TambiÃ©n se leen escribiendo
   `/who` en el juego.
7. Si usas mascota, escribe `/pet who leader` una vez: en EQL cambia de nombre
   en cada invocaciÃ³n y asÃ­ se identifica sola.

### Atajos

| Atajo | QuÃ© hace |
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
src/parser.js      lÃ­nea -> evento normalizado
src/encounter.js   segmentaciÃ³n de peleas y agregaciÃ³n
src/stances.js     datos de posturas e invocaciones de las 16 clases
src/advisor.js     quÃ© postura conviene, con el daÃ±o revertido a bruto
src/analysis.js    anÃ¡lisis posterior de peleas largas
src/spells.js      clasificaciÃ³n de hechizos por categorÃ­a
src/narrator.js    voz: chat y combate
src/triggers.js    disparadores por expresiÃ³n regular, estilo GINA
src/i18n.js        traducciones
src/engine.js      fachada que une todo
electron/          ventanas, IPC, configuraciÃ³n
ui/                interfaz, sin compilaciÃ³n
```

`npm run calibrate` recorre un log y lista las lÃ­neas que el parser **no**
reconoce, ordenadas por frecuencia. Es la herramienta para ampliar el
diccionario cuando EQL cambie textos o aÃ±ada hechizos.

---

## QuÃ© no puede saber

El log de EverQuest no registra vida, vigor, manÃ¡ ni posiciones de nadie. De
ahÃ­ salen los lÃ­mites del programa, y ninguno se disimula:

- Los costes de cada postura dicen el precio, **no si puedes pagarlo**.
- El anÃ¡lisis nunca dirÃ¡ si una cura llegÃ³ tarde: no hay dato de vida.
- SÃ³lo se conoce **tu** postura; la de los demÃ¡s no aparece.
- La marca de tiempo tiene resoluciÃ³n de un segundo, asÃ­ que en peleas de
  pocos segundos el DPS tiene un error estructural grande. Se usa la
  convenciÃ³n de GamParse y ACT, `total / (Ãºltimo âˆ’ primero + 1)`, que es la
  comparable con lo que postea la gente.
- El daÃ±o de escudo sin posesivo (`shards of ice`) no se puede atribuir y se
  deja aparte en vez de adjudicarlo a alguien.

## Apoyo

Proyecto personal y gratuito. Si te resulta util y te apetece invitar a un cafe,
el enlace esta en el boton Sponsor de arriba. No hace falta.

