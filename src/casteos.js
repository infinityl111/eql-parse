/**
 * Cuánto tarda cada hechizo en lanzarse, sacado de tus propios lanzamientos.
 *
 * POR QUÉ NO SE PUEDE MIRAR EN NINGÚN SITIO. El registro de EQL no escribe el
 * tiempo de casteo, y cada hechizo tiene el suyo — que además cambia con la
 * postura y al mejorarlo. Así que o se mide o no se sabe.
 *
 * Y SE PUEDE MEDIR: entre «You begin casting X» y la línea en la que X entra
 * hay un tiempo, y ese tiempo es el casteo. Medido sobre el registro de
 * referencia, 103 hechizos con ocho lanzamientos o más, y **84 de ellos con
 * mediana de un segundo o más**: hay de sobra que enseñar. Van de 7 s
 * (`Snails Healing`) a 4 s (`Efflorescing Heal`, con 291 muestras).
 *
 * LA MEDIANA Y NO LA MEDIA, y no es un detalle de estilo. `Reckoning` da
 * mediana 5 s y p90 17 s: los lanzamientos que se interrumpen y se recastean
 * estiran la cola sin parar, y una media saldría de esa cola. La mediana
 * describe el lanzamiento normal, que es lo que la barra tiene que durar.
 *
 * TRES ESTADOS Y NO DOS, que es lo que se pierde si se mira sólo «¿hay barra?»:
 *
 *   medido        ocho muestras o más y mediana de 1 s o más. Hay barra.
 *   instantáneo   ocho muestras o más y mediana 0: el hechizo SALE en el mismo
 *                 segundo. No hay barra porque no hay nada que recorrer, y eso
 *                 es un dato.
 *   sin muestra   menos de ocho. Tampoco hay barra, pero por lo contrario: no
 *                 se sabe. Confundir los dos diría que un hechizo desconocido
 *                 es instantáneo.
 *
 * Sobre el registro de referencia son 84 medidos, 19 instantáneos y el resto
 * sin muestra suficiente.
 */

/** Por debajo de esto no se afirma una duración. */
export const MIN_LANZAMIENTOS = 8;
/** Un casteo más largo que esto es que el emparejamiento se ha ido: no cuenta. */
const TOPE_SEG = 20;

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export class Casteos {
  constructor() {
    /** 'quien|hechizo' -> instante en que empezó, para emparejar. */
    this.abiertos = new Map();
    /** hechizo -> [duraciones en segundos] */
    this.muestras = new Map();
  }

  feed(ev) {
    if (!ev) return;
    if (ev.kind === 'cast' && ev.ability) {
      const k = `${ev.source}|${ev.ability}`;
      // EL PRIMERO MANDA. Recastear antes de que el anterior resuelva es normal
      // —pasa con los interrumpidos— y quedarse con el último mediría el hueco
      // entre los dos intentos en vez del casteo.
      if (!this.abiertos.has(k)) this.abiertos.set(k, ev.t);
      return;
    }
    const cierra = (quien, que) => {
      const k = `${quien}|${que}`;
      const t0 = this.abiertos.get(k);
      if (t0 === undefined) return;
      this.abiertos.delete(k);
      const d = Math.round(ev.t - t0);
      if (d < 0 || d > TOPE_SEG) return;
      if (!this.muestras.has(que)) this.muestras.set(que, []);
      const lista = this.muestras.get(que);
      lista.push(d);
      // Tope por hechizo: con 300 muestras la mediana ya no se mueve, y así
      // esto no crece durante una sesión de doce horas.
      if (lista.length > 300) lista.shift();
    };
    if (ev.ability && ev.amount > 0 && (ev.kind === 'spell' || ev.kind === 'dot')) {
      cierra(ev.source, ev.ability);
    } else if (ev.kind === 'heal' && ev.ability) {
      cierra(ev.source, ev.ability);
    } else if (ev.kind === 'interrupt' && ev.ability) {
      // Un interrumpido también cierra el emparejamiento —si no, el siguiente
      // desenlace de ese hechizo se mediría desde el intento fallido— pero NO
      // aporta muestra: lo que duró no es lo que dura el hechizo.
      this.abiertos.delete(`${ev.source}|${ev.ability}`);
    }
  }

  /** hechizo -> { estado, segundos, n } */
  tabla() {
    const out = {};
    for (const [nombre, v] of this.muestras) {
      if (v.length < MIN_LANZAMIENTOS) {
        out[nombre] = { estado: 'sinMuestra', segundos: null, n: v.length };
        continue;
      }
      const m = mediana(v);
      out[nombre] = m >= 1
        ? { estado: 'medido', segundos: m, n: v.length }
        : { estado: 'instantaneo', segundos: 0, n: v.length };
    }
    return out;
  }
}

/**
 * Qué enseñar para un lanzamiento concreto.
 *
 * @param {object} tabla   la de `Casteos.tabla()`
 * @param {string} hechizo
 * @param {number|null} real  lo que tardó ESTA vez, si el registro lo dice
 */
export function barra(tabla, hechizo, real = null) {
  const t = tabla?.[hechizo];
  if (!t || t.estado === 'sinMuestra') {
    return { estado: 'sinMuestra', n: t?.n ?? 0, esperado: null, real, exceso: 0 };
  }
  if (t.estado === 'instantaneo') {
    return { estado: 'instantaneo', n: t.n, esperado: 0, real, exceso: 0 };
  }
  /**
   * EL REGISTRO MANDA SOBRE LA ESTIMACIÓN. La mediana dice lo que suele durar;
   * la línea dice lo que duró esta vez. Si no coinciden, gana la línea.
   *
   * Y SI SE PASÓ, SE DICE. Que un hechizo de 4 s tardara 9 no es un detalle de
   * dibujo: algo lo retrasó. La barra llega llena a los 4 y sigue en otro color
   * hasta los 9, así que se ve cuánto se pasó y no sólo que acabó tarde.
   */
  const exceso = real !== null && real > t.segundos ? real - t.segundos : 0;
  return { estado: 'medido', n: t.n, esperado: t.segundos, real, exceso };
}
