import { EventEmitter } from 'node:events';

/**
 * Motor de disparadores al estilo GINA.
 *
 * Un disparador observa CADA línea del log (la reconozca el parser o no) y,
 * al casar, lanza acciones: voz, sonido, texto en pantalla y temporizadores.
 *
 * Sustitución en los textos:
 *   ${0}    la coincidencia completa
 *   ${1}…${9}  grupos de captura
 *   ${line} la línea entera
 * En EQL esto es potente porque el log nombra el hechizo:
 *   patrón  ^(.+?) begins casting (.+?)\.$
 *   voz     "${1} lanza ${2}"
 */

const MAX_TIMERS = 40;

function substitute(text, m, line) {
  if (!text) return text;
  return text.replace(/\$\{(\d|line)\}/g, (_, k) => {
    if (k === 'line') return line;
    return m[+k] ?? '';
  });
}

function compile(def) {
  try {
    const flags = def.ignoreCase === false ? '' : 'i';
    const src = def.regex ? def.pattern : def.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { ...def, re: new RegExp(src, flags), error: null };
  } catch (err) {
    return { ...def, re: null, error: err.message };
  }
}

export class TriggerEngine extends EventEmitter {
  constructor() {
    super();
    this.defs = [];
    this.compiled = [];
    this.timers = new Map();   // id -> {id, label, endsAt, warnAt, warned, color, endSpeak, endText}
    this.nextTimerId = 1;
  }

  /**
   * Disparadores heredados que hay que neutralizar al cargar.
   *
   * Los disparadores se guardan en la configuración del usuario, así que
   * cambiar la plantilla en el código no arregla las instalaciones que ya
   * la tenían activada. Este de aquí saltaba con CUALQUIER muerte y decía
   * "mascota caída"; la muerte de la mascota la avisa ahora el narrador,
   * que sí sabe cuál es tu mascota.
   */
  static #LEGACY = [
    { id: 'pet-dead', badPattern: 'has been slain by' },
  ];

  load(defs = []) {
    for (const d of defs) {
      const bad = TriggerEngine.#LEGACY.find((L) => L.id === d.id && String(d.pattern ?? '').includes(L.badPattern));
      if (bad && d.enabled !== false) { d.enabled = false; d.retired = true; }
      /**
       * LA PROCEDENCIA SE DEDUCE AL CARGAR, y sin esto la etiqueta MIENTE.
       *
       * Se vio al abrir la aplicación y mirar: la plantilla del jefe salía
       * rotulada «escrito por ti». Los disparadores se guardaron en
       * `triggers.json` antes de que existiera el campo `origen`, así que
       * ninguno lo trae — y sin campo, la interfaz asumía lo tuyo.
       *
       * Es el mismo problema que `#LEGACY` de arriba: cambiar la plantilla en el
       * código no arregla las instalaciones que ya la tenían guardada. Y la
       * consecuencia era peor que no tener etiqueta: una etiqueta que dice lo
       * contrario de la verdad, justo en el sitio que se acababa de poner para
       * evitar una confusión.
       *
       * SE MIRA EL PATRÓN Y NO EL `id`: si le has cambiado el patrón a una
       * plantilla, ya es tuya — eso es exactamente lo que la plantilla te pide
       * que hagas, y quien lo ha hecho no merece que se le siga llamando copia.
       */
      if (d.origen === undefined) {
        const plantilla = STARTER_TRIGGERS.find((s) => s.id === d.id);
        d.origen = plantilla && plantilla.pattern === d.pattern ? 'plantilla' : 'tuyo';
      }
      /**
       * Y EL TEMPORIZADOR INVENTADO, retirado de lo ya guardado.
       *
       * Quitar `timerSeconds: 12` del valor de fábrica no toca la copia que ya
       * tiene el usuario: seguía contando atrás y diciendo «Vox lista» a los
       * doce segundos que nadie cronometró. Se retira sólo si el patrón sigue
       * siendo el de la plantilla — si lo has cambiado por tu jefe, tus segundos
       * son tuyos y no se tocan.
       */
      const plant = STARTER_TRIGGERS.find((s) => s.id === d.id);
      if (plant && plant.pattern === d.pattern && plant.timerSeconds === 0 && d.timerSeconds > 0) {
        d.timerSeconds = 0;
        d.timerRetirado = true;
      }
    }
    this.defs = defs;
    this.compiled = defs.filter((d) => d.enabled !== false).map(compile);
    return this.compiled.filter((c) => c.error).map((c) => ({ id: c.id, error: c.error }));
  }

  /**
   * DE QUÉ REGISTRO HABLA EL CONTADOR. `{ registro, lineas, n }`.
   *
   * «Visto 33 veces» sin decir DÓNDE es identidad colgada de algo que se cambia
   * debajo: hay un botón de «cambiar log», y al pulsarlo la etiqueta seguiría
   * contando lo del personaje anterior. Es la misma familia que el botín colgado
   * de la ventana y los tríos borrados por índice, y van once.
   *
   * NO SE ARREGLA ACORDÁNDOSE DE REINICIARLO. Se arregla como `aplicarDudas`:
   * casando por CONTENIDO además de por clave. El contador viaja con el fichero
   * del que salió, así que al cambiar de registro la clave no casa y la cuenta
   * empieza de cero **sola** — sin una guarda nueva que alguien tenga que
   * acordarse de llamar. Y mientras no case, la etiqueta puede decir de qué
   * registro habla en vez de callarse.
   *
   * `lineas` es hasta dónde se contó. Sirve para lo de siempre: un registro que
   * ha crecido desde la última cuenta no invalida lo contado, sólo dice que hay
   * más por contar.
   */
  registro(ruta, lineas = 0) {
    this.log = { ruta: ruta ?? null, lineas };
  }

  #anota(def) {
    const ruta = this.log?.ruta ?? null;
    // Otro registro: la cuenta anterior no habla de éste y se empieza de cero.
    if (!def.vistas || def.vistas.registro !== ruta) def.vistas = { registro: ruta, lineas: 0, n: 0 };
    def.vistas.n++;
    def.vistas.lineas = this.log?.lineas ?? def.vistas.lineas;
  }

  /** Comprueba un patrón contra una línea sin tocar el estado. Para el botón de probar. */
  static tryOne(def, line) {
    const c = compile(def);
    if (c.error) return { ok: false, error: c.error };
    const m = c.re.exec(line);
    if (!m) return { ok: true, matched: false };
    return {
      ok: true,
      matched: true,
      groups: m.slice(0, 10),
      speak: substitute(def.speak, m, line),
      text: substitute(def.text, m, line),
      timerLabel: substitute(def.timerLabel, m, line),
    };
  }

  /**
   * @param {object} [opts]
   *   - mudo  cuenta la coincidencia y NO hace nada más: ni voz, ni texto, ni
   *           sonido, ni temporizadores. Es lo que usa la relectura del
   *           registro al arrancar — ver la nota en `engine.js`.
   */
  match(line, _t, opts = {}) {
    for (const c of this.compiled) {
      if (!c.re) continue;
      const m = c.re.exec(line);
      if (!m) continue;
      /**
       * CUÁNTAS VECES HA CASADO ESTE DISPARADOR CONTRA TU REGISTRO.
       *
       * Es lo que separa una promesa de un hecho. Una plantilla de fábrica dice
       * lo que DEBERÍA cazar; este número dice lo que ha cazado, y sin él una
       * plantilla que no case nunca —una frase transcrita de una wiki con una
       * palabra distinta— tiene exactamente la misma pinta que una que salta a
       * diario. Es la alarma muerta otra vez, importada en vez de escrita.
       *
       * Se cuenta en el compilado Y en la definición: el compilado se rehace en
       * cada `load()` y el número tiene que sobrevivir a eso para poder
       * guardarse y enseñarse en la ficha del disparador.
       */
      c.vistas = (c.vistas ?? 0) + 1;
      const def = this.defs.find((d) => d.id === c.id);
      if (def) this.#anota(def);

      // Contado ya está; lo demás es hablar, y en la relectura no se habla.
      if (opts.mudo) continue;

      const speak = substitute(c.speak, m, line);
      const text = substitute(c.text, m, line);

      if (speak || text || c.sound) {
        this.emit('alert', {
          id: c.id, name: c.name, speak, text, sound: c.sound ?? null,
          color: c.color ?? null, holdMs: c.holdMs ?? 4000, at: Date.now(),
        });
      }

      if (c.cancelTimer) {
        const want = substitute(c.cancelTimer, m, line).toLowerCase();
        for (const [id, tm] of this.timers) {
          if (tm.label.toLowerCase().includes(want)) this.timers.delete(id);
        }
      }

      if (c.timerSeconds > 0) {
        const label = substitute(c.timerLabel, m, line) || c.name;
        this.#startTimer({
          label,
          seconds: c.timerSeconds,
          warnAt: c.timerWarnAt ?? 0,
          restart: c.timerRestart ?? 'restart',   // restart | ignore | multiple
          color: c.color ?? null,
          endSpeak: substitute(c.timerEndSpeak, m, line),
          endText: substitute(c.timerEndText, m, line),
        });
      }
    }
  }

  #startTimer(t) {
    if (t.restart !== 'multiple') {
      const existing = [...this.timers.values()].find((x) => x.label === t.label);
      if (existing) {
        if (t.restart === 'ignore') return;
        this.timers.delete(existing.id);
      }
    }
    if (this.timers.size >= MAX_TIMERS) {
      const oldest = [...this.timers.values()].sort((a, b) => a.endsAt - b.endsAt)[0];
      this.timers.delete(oldest.id);
    }
    const id = this.nextTimerId++;
    this.timers.set(id, {
      id, label: t.label, color: t.color,
      startedAt: Date.now(), endsAt: Date.now() + t.seconds * 1000,
      total: t.seconds, warnAt: t.warnAt, warned: false,
      endSpeak: t.endSpeak, endText: t.endText,
    });
  }

  /** Llamar periódicamente. Devuelve los temporizadores vivos para pintarlos. */
  tick() {
    const now = Date.now();
    for (const [id, tm] of this.timers) {
      const left = (tm.endsAt - now) / 1000;
      if (!tm.warned && tm.warnAt > 0 && left <= tm.warnAt && left > 0) {
        tm.warned = true;
        this.emit('alert', {
          id: `timer-warn-${id}`, name: tm.label,
          speak: null, text: `${tm.label} · ${Math.ceil(left)}s`,
          sound: 'warn', color: tm.color, holdMs: 2500, at: now,
        });
      }
      if (left <= 0) {
        this.timers.delete(id);
        if (tm.endSpeak || tm.endText) {
          this.emit('alert', {
            id: `timer-end-${id}`, name: tm.label,
            speak: tm.endSpeak || null, text: tm.endText || null,
            sound: 'end', color: tm.color, holdMs: 4000, at: now,
          });
        }
      }
    }
    return this.snapshot();
  }

  snapshot() {
    const now = Date.now();
    return [...this.timers.values()]
      .map((t) => ({
        id: t.id, label: t.label, color: t.color, total: t.total,
        left: Math.max(0, (t.endsAt - now) / 1000),
      }))
      .sort((a, b) => a.left - b.left);
  }

  clearTimers() { this.timers.clear(); }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLANTILLAS DE ARRANQUE, Y SU PROCEDENCIA — que hasta la 1.14.1 no se veía.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las específicas de un jefe hay que verificarlas contra tu propio log: los
 * emotes exactos de EQL no están documentados en ninguna parte.
 *
 * ESA FRASE LLEVABA AQUÍ DESDE QUE SE ESCRIBIÓ LA LISTA, Y NO LA HA LEÍDO NADIE:
 * `ui/triggers.js` no pintaba ni esta advertencia ni el campo `note` de cada
 * plantilla. Salida muerta, y lo muerto era justo el aviso que evitaba la
 * sospecha — un usuario abrió el editor, vio «Lady Vox» en cinco sitios que él
 * no había escrito, y concluyó lo razonable: que venía de una wiki.
 *
 * NO VENÍA. `^Lady Vox begins casting` casa **33 veces** en su registro, con
 * seis hechizos de ella, y tiene seis peleas suyas en The Permafrost Caverns.
 * Lo que estaba mal no era la regla: era que nada decía de dónde salía.
 *
 * ── CADA PLANTILLA DECLARA DE QUÉ ESTÁ HECHA ────────────────────────────────
 *
 *   `origen: 'plantilla'`   viene de fábrica y NO se ha verificado contra tu
 *                           registro. Lo que escribas tú no lleva esta marca.
 *   `note`                  qué comprobar antes de fiarse, en la ficha.
 *   `vistas`                cuántas veces ha casado de verdad. Lo pone el motor.
 *
 * Es el mismo vocabulario que ya usan `raid.src.*`, `mate.src.*` y `adv.src.*`:
 * lo que has dicho tú, lo que consta y lo que se ha supuesto no pueden verse
 * iguales. Los disparadores eran lo único del proyecto sin esa distinción.
 *
 * ── UNA PLANTILLA ES UN OBJETO DE TRES IDIOMAS ──────────────────────────────
 *
 * ESCRITO ANTES DE TOCARLO, porque al arreglarlo la tentación va a ser traducir
 * el objeto entero y eso lo rompe:
 *
 *   EL PATRÓN VA EN INGLÉS, SIEMPRE Y EN LOS CINCO IDIOMAS. Lo que compara es
 *   la línea que escribe el juego, y el juego escribe en inglés — es la misma
 *   regla de la jerga que ya rige `src/jerga.js`. Un patrón traducido no casa
 *   nunca, y falla en silencio: el disparador simplemente no salta.
 *
 *   EL NOMBRE Y LA VOZ VAN EN EL IDIOMA DE QUIEN LO USA. Son lo único de aquí
 *   que un alemán lee y oye, y hoy los quince están escritos en español.
 *
 * ── Y LO QUE HAY GUARDADO ES EL TEXTO, NO LA PLANTILLA ──────────────────────
 *
 * Medido sobre el `triggers.json` de Campeón: cada disparador guarda
 * `"name": "Te han aturdido"`, `"speak": "aturdido"`, `"text": "ATURDIDO"`.
 * El texto español, congelado en disco desde el día que se guardó. Es LA
 * MAYÚSCULA OTRA VEZ —identidad y presentación en el mismo campo— con el
 * agravante de que la presentación es la que se lee.
 *
 * La identidad SÍ está: `id: 'stunned'`. Y el mecanismo para preferirla ya
 * existe y está probado dos veces en `load()` —así se deduce `origen` y así se
 * retiró el temporizador inventado—: si el patrón sigue siendo el de fábrica,
 * la plantilla manda sobre lo guardado.
 *
 * POR ESO NO HACE FALTA NI FORMATO NUEVO NI RECONSTRUCCIÓN. `triggers.json` es
 * configuración, no el almacén: `FORMATO_VERSION` y la relectura del registro
 * son de las peleas y aquí no pintan nada. El arreglo se hace al cargar y el
 * fichero no se toca.
 *
 * LA ÚNICA DECISIÓN QUE QUEDA, y hay que tomarla antes de escribir el código:
 * qué pasa si alguien RENOMBRÓ una plantilla sin tocarle el patrón. Preferir la
 * traducción le pisaría su nombre. Se distingue midiendo: si el nombre guardado
 * coincide con el de fábrica en CUALQUIERA de los cinco idiomas, es el de
 * fábrica y se traduce; si no coincide con ninguno, lo escribió él y se
 * respeta. Eso no necesita ningún campo nuevo.
 */
export const STARTER_TRIGGERS = [
  {
    id: 'stunned', name: 'Te han aturdido', enabled: true, origen: 'plantilla',
    pattern: '^You are stunned!$', regex: true,
    speak: 'aturdido', text: 'ATURDIDO', sound: 'warn', color: '#E08A4B', holdMs: 2000,
  },
  {
    id: 'cast-any', name: 'Alguien empieza a castear', enabled: false, origen: 'plantilla',
    pattern: '^(.+?) begins casting (.+?)\\.$', regex: true,
    speak: '${1} lanza ${2}', text: '${1} → ${2}', holdMs: 3000,
    note: 'tg.note.castAny',
  },
  {
    id: 'boss-cast', name: 'Plantilla: casteo de un jefe', enabled: false, origen: 'plantilla',
    pattern: '^Lady Vox begins casting (.+?)\\.$', regex: true,
    speak: 'Vox lanza ${1}', text: 'VOX · ${1}', sound: 'alert', color: '#6FC7D8',
    /**
     * SIN TEMPORIZADOR DE FÁBRICA, y esto es un cambio de la 1.14.1.
     *
     * Aquí ponía `timerSeconds: 12`. Ese 12 era el ÚNICO número inventado de
     * toda la plantilla —el patrón se mide contra tu registro, el número no— y
     * viajaba con la misma cara que el resto: una cuenta atrás en pantalla y una
     * voz diciendo «Vox lista» a los doce segundos, sin que nadie hubiera
     * cronometrado nada. El registro no escribe el tiempo de reutilización de un
     * hechizo enemigo en ninguna línea, así que no se puede medir leyéndolo: hay
     * que cronometrarlo jugando.
     *
     * Se va del valor de fábrica en vez de marcarse, porque marcarlo no arregla
     * lo que hacía: seguiría hablando. Lo pone quien lo use, que es quien puede
     * medirlo. El resto de la plantilla —patrón, voz, texto— se queda: eso sí
     * casa, 33 veces en el registro de referencia.
     */
    timerLabel: 'Vox · ${1}', timerSeconds: 0, timerWarnAt: 3, timerRestart: 'restart',
    timerEndSpeak: 'Vox lista', holdMs: 5000,
    note: 'tg.note.bossCast',
  },
  {
    id: 'pet-dead', name: 'Plantilla: muerte concreta', enabled: false, origen: 'plantilla',
    pattern: '^Nombre exacto has been slain by', regex: true,
    speak: 'ha caído', text: 'CAÍDO', sound: 'warn',
    note: 'tg.note.petDead',
  },
  {
    id: 'my-death', name: 'Has muerto', enabled: true, origen: 'plantilla',
    pattern: '^You have been slain by (.+?)!$', regex: true,
    speak: 'has muerto', text: 'MUERTO · ${1}', sound: 'end', color: '#B0555F', holdMs: 6000,
  },
  {
    id: 'zone', name: 'Cambio de zona', enabled: false, origen: 'plantilla',
    pattern: '^You have entered (.+?)\\.$', regex: true,
    text: '${1}', holdMs: 2500,
  },
];
