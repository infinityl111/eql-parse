import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';

const NL = 0x0a;
const CR = 0x0d;
const EMPTY = Buffer.alloc(0);

/**
 * Tail incremental de un fichero de texto.
 *
 * Decisiones de diseño (importantes en Windows + EQ):
 *  - NO usamos fs.watch: en Windows los appends no disparan eventos de forma
 *    fiable y con volumen alto se pierden. Hacemos polling de fs.stat().
 *  - Llevamos un offset en BYTES y leemos sólo el delta. Nunca releemos el fichero.
 *  - El remainder se guarda como Buffer (no string) para no partir caracteres
 *    multibyte a mitad de chunk.
 *  - Detectamos rotación por size < offset o por cambio de inode/ctime.
 */
export class LogTailer extends EventEmitter {
  constructor(path, opts = {}) {
    super();
    this.path = path;
    this.pollMs = opts.pollMs ?? 100;
    this.fromStart = opts.fromStart ?? false;
    // Byte por el que se quedó la última sesión: así sólo se relee lo nuevo.
    this.startOffset = Number.isFinite(opts.startOffset) ? opts.startOffset : null;
    this.chunkSize = opts.chunkSize ?? 1 << 20; // 1 MiB
    this.encoding = opts.encoding ?? 'latin1';  // EQ escribe cp1252, no UTF-8
    this.offset = 0;
    this.remainder = EMPTY;
    this.busy = false;
    this.timer = null;
    this.sig = null;
  }

  async start() {
    let st;
    try {
      st = await fsp.stat(this.path);
    } catch {
      this.offset = 0;
      this.emit('waiting', this.path);
      st = null;
    }
    if (st) {
      /**
       * ═══════════════════════════════════════════════════════════════════
       * TRES SITUACIONES, TRES RESPUESTAS. Antes eran dos ramas para tres.
       * ═══════════════════════════════════════════════════════════════════
       *
       * Aquí ponía:
       *
       *     this.offset = this.fromStart ? 0
       *       : (this.startOffset !== null && this.startOffset <= st.size
       *          ? this.startOffset : st.size);
       *
       * o sea: `st.size` respondía a DOS preguntas distintas —«no hay marca» y
       * «la marca se pasa del final»— y sólo es la respuesta buena a la
       * primera. No había ni una línea de comentario que las distinguiera,
       * porque nadie las había distinguido.
       *
       * ── LO QUE COSTABA, Y TIENE FECHA DE ESTRENO ─────────────────────────
       *
       * Miguel se plantea rotar el registro cuando crezca. Al ritmo medido
       * —6,2 MB y 79.349 líneas por día de juego— eso son 1,1 GB a seis meses,
       * así que va a pasar. Y el día que pase:
       *
       *   1. renombra el log con el juego cerrado y empieza otro;
       *   2. juega tres horas;
       *   3. abre EQL Parse.
       *
       * La marca guardada decía «byte 77.841.561». El fichero nuevo mide 15 MB.
       * `startOffset <= st.size` es falso, así que se caía en `st.size` y el
       * lector se plantaba AL FINAL del fichero nuevo. Esas tres horas no se
       * leían nunca. Sin error, sin hueco, sin aviso: no habían existido.
       *
       * ── Y LO CONTRARIO DE LO QUE HACE EL MISMO FICHERO EN MARCHA ─────────
       *
       * `#poll` ya resuelve el mismo caso —tamaño menor que desplazamiento— de
       * la única forma correcta: desplazamiento a cero y volver a plegar. Dos
       * caminos del mismo módulo contestaban lo contrario a la misma pregunta.
       *
       * Y REPLEGAR ES SEGURO, que es lo que autoriza el cambio: la identidad
       * del almacén no es posicional sino lógica —`at:total:duration`,
       * `src/store.js:45`, comprobada en `append` y repoblada desde el índice
       * al cargar— así que volver a plegar lo mismo no duplica nada. El botín,
       * las AA y los hechizos llevan su propio conjunto de vistos. Lo fija
       * `test/rotacion.js`, drilada en rojo haciendo la identidad posicional.
       *
       * El peligro contrario —duplicar— está parado. El peligro de este lado
       * —perder en silencio— no lo paraba nada. Entre un riesgo cubierto y uno
       * descubierto, se elige el cubierto.
       */
      if (this.fromStart) {
        this.offset = 0;
      } else if (this.startOffset === null) {
        // Sin marca: es un enganche nuevo y no hay historia que recuperar. Se
        // escucha desde el final, que es lo que siempre quiso decir `st.size`.
        this.offset = st.size;
      } else if (this.startOffset <= st.size) {
        this.offset = this.startOffset;                       // reanudar
      } else {
        // LA MARCA SE PASA DEL FINAL: el fichero encogió o lo cambiaron por
        // otro mientras estábamos cerrados. Se repliega entero, igual que en
        // marcha, y se avisa — porque una relectura completa no es lo normal y
        // quien mire la aplicación tiene derecho a saber por qué tarda.
        this.offset = 0;
        this.rotatedAtStart = true;
      }
      this.sig = this.#sig(st);
    }
    this.timer = setInterval(() => this.#poll(), this.pollMs);
    this.timer.unref?.();
    // El aviso va DESPUÉS de que haya oyentes posibles y ANTES de la primera
    // lectura, para que quien lo escuche pueda contarlo mientras se relee.
    if (this.rotatedAtStart) this.emit('rotate', this.path);
    this.emit('start', { path: this.path, offset: this.offset });
    if (this.fromStart || this.offset < (await fsp.stat(this.path).then((x) => x.size, () => 0))) await this.#poll();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit('stop');
  }

  #sig(st) {
    return `${st.ino}:${st.birthtimeMs || 0}`;
  }

  async #poll() {
    if (this.busy) return;
    this.busy = true;
    let fh = null;
    try {
      const st = await fsp.stat(this.path);
      const sig = this.#sig(st);
      if (st.size < this.offset || (this.sig && sig !== this.sig)) {
        // Rotación / fichero nuevo (cambio de personaje o servidor)
        this.offset = 0;
        this.remainder = EMPTY;
        this.emit('rotate', this.path);
      }
      this.sig = sig;
      if (st.size === this.offset) return;

      fh = await fsp.open(this.path, 'r');
      const buf = Buffer.allocUnsafe(this.chunkSize);
      while (this.offset < st.size) {
        const want = Math.min(this.chunkSize, st.size - this.offset);
        const { bytesRead } = await fh.read(buf, 0, want, this.offset);
        if (bytesRead <= 0) break;
        this.offset += bytesRead;
        this.#consume(buf.subarray(0, bytesRead));
      }
      this.emit('flush');
    } catch (err) {
      if (err.code === 'ENOENT') this.emit('waiting', this.path);
      else this.emit('error', err);
    } finally {
      if (fh) await fh.close().catch(() => {});
      this.busy = false;
    }
  }

  #consume(chunk) {
    let data = this.remainder.length ? Buffer.concat([this.remainder, chunk]) : chunk;
    let start = 0;
    let idx;
    while ((idx = data.indexOf(NL, start)) !== -1) {
      let end = idx;
      if (end > start && data[end - 1] === CR) end--;
      if (end > start) {
        this.emit('line', data.toString(this.encoding, start, end));
      }
      start = idx + 1;
    }
    this.remainder = start < data.length ? Buffer.from(data.subarray(start)) : EMPTY;
  }
}
