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
      this.offset = this.fromStart ? 0 : st.size;
      this.sig = this.#sig(st);
    }
    this.timer = setInterval(() => this.#poll(), this.pollMs);
    this.timer.unref?.();
    this.emit('start', { path: this.path, offset: this.offset });
    if (this.fromStart) await this.#poll();
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
