/**
 * Las líneas del registro que hay detrás de una cifra.
 *
 * PARA QUÉ ES. Todo lo que enseña esta aplicación es una cuenta sobre líneas de
 * texto. La última pregunta que puede hacerse de cualquier cifra es «¿de dónde
 * sale?», y la única respuesta completa son las líneas. Esto no añade un dato
 * más: es la forma de comprobar todos los demás.
 *
 * NO SE GUARDA NADA. El fichero de registro ya está en el disco y ya está
 * ordenado por hora, así que las líneas se buscan cuando se piden. Guardar una
 * copia de lo que ya existe habría sido duplicar 13 MB para no volver a leerlos.
 *
 * NO SE USA `seq` PARA ENCONTRARLAS. El contador de líneas del motor arranca en
 * el punto de enganche, así que sólo coincide con el número de línea del fichero
 * después de una reconstrucción; en directo va desplazado. El ancla buena es la
 * MARCA DE TIEMPO, que está escrita en la propia línea.
 *
 * BÚSQUEDA BINARIA, no lectura entera. El registro de referencia tiene 13 MB y
 * 375.000 líneas; leerlo entero para enseñar veinte líneas sería absurdo. Como
 * está ordenado por hora, se puede ir a la mitad, mirar qué hora hay ahí y
 * decidir hacia dónde seguir: una veintena de saltos para cualquier tamaño.
 *
 * LO QUE PUEDE FALLAR, Y SE DICE EN VEZ DE CALLARSE:
 *   sin-fichero    el registro ya no está donde estaba
 *   fuera-de-rango la pelea es anterior o posterior a lo que contiene este
 *                  fichero — log rotado, recortado, o simplemente otro
 * Un hueco explicado informa; una lista vacía parece un fallo del programa.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { parseHeader } from './parser.js';

/** Cuántas líneas se devuelven como mucho. Ver `recortadas` en la respuesta. */
const TOPE = 1200;
const CHUNK = 64 * 1024;

/**
 * La hora de la primera línea con cabecera a partir de `desde`.
 * Devuelve `{t, inicio}` — el instante y el byte donde empieza esa línea.
 */
async function horaEn(fh, desde, tam) {
  let pos = desde;
  // Como mucho un par de saltos: si en 128 KB no hay ni una línea con
  // cabecera, este fichero no es un registro de EQ.
  for (let i = 0; i < 2 && pos < tam; i++) {
    const buf = Buffer.allocUnsafe(Math.min(CHUNK, tam - pos));
    const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
    if (bytesRead <= 0) return null;
    const texto = buf.subarray(0, bytesRead).toString('utf8');
    // Si no empezamos justo en una línea, se descarta la primera a medias.
    let ini = desde === 0 && i === 0 ? 0 : texto.indexOf('\n') + 1;
    while (ini > 0 || (desde === 0 && i === 0)) {
      const fin = texto.indexOf('\n', ini);
      const linea = fin < 0 ? texto.slice(ini) : texto.slice(ini, fin);
      const h = parseHeader(linea.replace(/\r$/, ''));
      if (h) return { t: h.t, inicio: pos + Buffer.byteLength(texto.slice(0, ini), 'utf8') };
      if (fin < 0) break;
      ini = fin + 1;
    }
    pos += bytesRead;
  }
  return null;
}

/** El byte donde empieza la primera línea con hora >= `t`. */
async function buscar(fh, t, tam) {
  let lo = 0, hi = tam, mejor = tam;
  while (lo < hi) {
    const medio = Math.floor((lo + hi) / 2);
    const h = await horaEn(fh, medio, tam);
    if (!h) { hi = medio; continue; }
    if (h.t >= t) { mejor = Math.min(mejor, h.inicio); hi = medio; }
    else lo = h.inicio + 1;
  }
  return mejor;
}

/**
 * Las líneas entre dos instantes, en segundos epoch.
 *
 * @param {string} ruta   el fichero de registro
 * @param {number} desde  segundo epoch, inclusive
 * @param {number} hasta  segundo epoch, inclusive
 * @param {number} tope   cuántas líneas como mucho
 * @returns {Promise<{ok, lineas?, recortadas?, motivo?, span?}>}
 */
export async function tramo(ruta, desde, hasta, tope = TOPE) {
  if (!ruta || !fs.existsSync(ruta)) return { ok: false, motivo: 'sin-fichero' };
  let fh = null;
  try {
    const st = await fsp.stat(ruta);
    if (!st.size) return { ok: false, motivo: 'sin-fichero' };
    fh = await fsp.open(ruta, 'r');

    // Qué abarca este fichero. Hace falta para poder decir «esta pelea no está
    // aquí» en vez de devolver una lista vacía que parece un fallo.
    const primera = await horaEn(fh, 0, st.size);
    const ultima = await (async () => {
      // La última línea con cabecera: se busca hacia atrás desde el final.
      for (let atras = CHUNK; atras <= CHUNK * 8; atras *= 2) {
        const pos = Math.max(0, st.size - atras);
        const buf = Buffer.allocUnsafe(st.size - pos);
        await fh.read(buf, 0, buf.length, pos);
        const lineas = buf.toString('utf8').split('\n');
        for (let i = lineas.length - 1; i >= 0; i--) {
          const h = parseHeader(lineas[i].replace(/\r$/, ''));
          if (h) return h.t;
        }
        if (pos === 0) break;
      }
      return null;
    })();
    const span = primera && ultima ? { desde: primera.t, hasta: ultima } : null;
    if (span && (hasta < span.desde || desde > span.hasta)) {
      return { ok: false, motivo: 'fuera-de-rango', span };
    }

    const inicio = await buscar(fh, desde, st.size);
    const lineas = [];
    let pos = inicio, resto = '', recortadas = 0;
    lector: while (pos < st.size) {
      const buf = Buffer.allocUnsafe(Math.min(CHUNK, st.size - pos));
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
      if (bytesRead <= 0) break;
      pos += bytesRead;
      const texto = resto + buf.subarray(0, bytesRead).toString('utf8');
      const partes = texto.split('\n');
      resto = partes.pop() ?? '';
      for (const cruda of partes) {
        const linea = cruda.replace(/\r$/, '');
        const h = parseHeader(linea);
        // Una línea sin cabecera dentro del tramo es la continuación de la
        // anterior: se conserva, porque quitarla partiría el texto.
        if (!h) { if (lineas.length) lineas.push({ t: null, texto: linea }); continue; }
        if (h.t > hasta) break lector;
        if (h.t < desde) continue;
        if (lineas.length >= tope) { recortadas++; continue; }
        lineas.push({ t: h.t, texto: h.body });
      }
    }
    return { ok: true, lineas, recortadas, span };
  } catch (err) {
    return { ok: false, motivo: 'error', error: err.message };
  } finally {
    await fh?.close().catch(() => {});
  }
}

/**
 * El contexto de un instante: unos segundos antes y después.
 *
 * Es la forma en que se pide desde una cifra concreta —esta muerte, este
 * lanzamiento— y por eso el tramo es corto: lo que se quiere ver es qué pasaba
 * alrededor, no la pelea entera.
 */
export function contexto(ruta, t, margen = 6, tope = 200) {
  return tramo(ruta, Math.round(t) - margen, Math.round(t) + margen, tope);
}
