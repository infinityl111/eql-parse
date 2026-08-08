/**
 * Monta una animación a partir de capturas PNG, sin nada instalado.
 *
 * POR QUÉ NO ES UN GIF. Para hacer un GIF hay que comprimir con LZW y, antes,
 * reducir la imagen a 256 colores: la interfaz tiene degradados, sombras y
 * antialiasing, así que el recorte se nota justo donde está el detalle — los
 * números flotantes son texto pequeño de color. Y para hacerlo bien haría falta
 * ffmpeg o ImageMagick, y en esta máquina no hay ninguno de los dos. (`convert`
 * existe en System32, pero es la herramienta que convierte FAT a NTFS.)
 *
 * QUÉ ES UN APNG. Un PNG normal con tres tipos de trozo más: `acTL` dice
 * cuántos fotogramas hay, `fcTL` describe cada uno con su duración, y `fdAT`
 * lleva los datos de los que no son el primero. Lo importante para nosotros:
 * los datos de imagen NO se recomprimen. Se cogen los `IDAT` que Chromium ya
 * escribió al hacer la captura y se copian tal cual.
 *
 * Así que esto no es un compresor: es un montador. Sin pérdida, en color real,
 * sin dependencias y sin nada que instalar. Lo abren Chrome, Firefox, Safari,
 * el visor de fotos de Windows, GitHub y Discord.
 *
 * LO QUE EXIGE, y por eso se comprueba en vez de suponerse: todas las capturas
 * tienen que tener el mismo tamaño y el mismo formato de color. Con la ventana
 * quieta lo cumplen; si algún día no, salta aquí y no en el visor de alguien.
 */
import zlib from 'node:zlib';

const FIRMA = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/** CRC32, que es lo que cierra cada trozo de un PNG. */
const TABLA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLA[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Un trozo con su longitud, su tipo, sus datos y su CRC. */
function trozo(tipo, datos) {
  const t = Buffer.from(tipo, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])), 0);
  return Buffer.concat([len, t, datos, crc]);
}

/** Los trozos de un PNG, en orden. */
function leerTrozos(png) {
  if (!png.subarray(0, 8).equals(FIRMA)) throw new Error('esto no es un PNG');
  const out = [];
  let i = 8;
  while (i < png.length) {
    const len = png.readUInt32BE(i);
    const tipo = png.toString('ascii', i + 4, i + 8);
    out.push({ tipo, datos: png.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
  }
  return out;
}

/**
 * @param {Buffer[]} fotogramas  capturas PNG, todas del mismo tamaño
 * @param {object} opciones
 *   msPorFotograma  cuánto dura cada uno
 *   vueltas         0 = sin fin
 * @returns {Buffer} el APNG
 */
export function montarAPNG(fotogramas, { msPorFotograma = 100, vueltas = 0 } = {}) {
  if (!fotogramas?.length) throw new Error('sin fotogramas');

  const partes = fotogramas.map(leerTrozos);
  const ihdr = partes[0].find((c) => c.tipo === 'IHDR');
  if (!ihdr) throw new Error('el primer fotograma no tiene IHDR');
  const w = ihdr.datos.readUInt32BE(0);
  const h = ihdr.datos.readUInt32BE(4);

  // MISMO TAMAÑO Y MISMO FORMATO, comprobado. Un fotograma distinto no da un
  // error al montar: da una animación que parpadea o que no abre, y el fallo
  // aparece en el visor de otro y no aquí.
  partes.forEach((p, i) => {
    const ih = p.find((c) => c.tipo === 'IHDR');
    if (!ih) throw new Error(`el fotograma ${i} no tiene IHDR`);
    if (!ih.datos.equals(ihdr.datos)) {
      throw new Error(`el fotograma ${i} no cuadra con el primero: ${ih.datos.readUInt32BE(0)}×${ih.datos.readUInt32BE(4)} contra ${w}×${h}`);
    }
  });

  // La duración va como fracción: 100 ms se escribe 100/1000.
  const delayNum = Math.max(1, Math.round(msPorFotograma));
  const fcTL = (seq) => {
    const d = Buffer.alloc(26);
    d.writeUInt32BE(seq, 0);
    d.writeUInt32BE(w, 4); d.writeUInt32BE(h, 8);
    d.writeUInt32BE(0, 12); d.writeUInt32BE(0, 16);   // sin desplazamiento
    d.writeUInt16BE(delayNum, 20); d.writeUInt16BE(1000, 22);
    d.writeUInt8(0, 24);   // dispose: no tocar
    d.writeUInt8(0, 25);   // blend: sustituir. Los fotogramas son completos.
    return trozo('fcTL', d);
  };

  const acTL = Buffer.alloc(8);
  acTL.writeUInt32BE(fotogramas.length, 0);
  acTL.writeUInt32BE(vueltas, 4);

  const salida = [FIRMA, trozo('IHDR', ihdr.datos), trozo('acTL', acTL)];
  let seq = 0;

  partes.forEach((p, i) => {
    // Los IDAT de un PNG pueden venir troceados: se juntan y se vuelven a
    // escribir de una pieza. No se recomprime nada — es el mismo flujo zlib.
    const idat = Buffer.concat(p.filter((c) => c.tipo === 'IDAT').map((c) => c.datos));
    if (!idat.length) throw new Error(`el fotograma ${i} no trae datos de imagen`);
    salida.push(fcTL(seq++));
    if (i === 0) {
      salida.push(trozo('IDAT', idat));
    } else {
      // `fdAT` es un IDAT con un número de secuencia delante.
      const n = Buffer.alloc(4);
      n.writeUInt32BE(seq++, 0);
      salida.push(trozo('fdAT', Buffer.concat([n, idat])));
    }
  });

  salida.push(trozo('IEND', Buffer.alloc(0)));
  return Buffer.concat(salida);
}

/**
 * Y la comprobación de que lo montado se puede volver a leer: se recorren los
 * trozos y se cuentan los fotogramas declarados contra los escritos. Un APNG
 * mal montado suele abrirse igual —enseñando sólo el primer fotograma— así que
 * mirarlo a ojo no dice nada.
 */
export function revisarAPNG(buf) {
  const cs = leerTrozos(buf);
  const ac = cs.find((c) => c.tipo === 'acTL');
  if (!ac) return { ok: false, motivo: 'sin acTL: no es una animación' };
  const declarados = ac.datos.readUInt32BE(0);
  const fctl = cs.filter((c) => c.tipo === 'fcTL').length;
  const datos = cs.filter((c) => c.tipo === 'IDAT' || c.tipo === 'fdAT').length;
  // Los números de secuencia tienen que ir 0,1,2,… sin saltos: un salto y el
  // visor descarta el resto sin decir nada.
  const seqs = [];
  for (const c of cs) {
    if (c.tipo === 'fcTL') seqs.push(c.datos.readUInt32BE(0));
    else if (c.tipo === 'fdAT') seqs.push(c.datos.readUInt32BE(0));
  }
  const seguidos = seqs.every((v, i) => v === i);
  return {
    ok: declarados === fctl && fctl === datos && seguidos,
    declarados, fctl, datos, seguidos,
    bytes: buf.length,
  };
}
