#!/usr/bin/env node
/**
 * Dibuja el icono de la aplicación y escribe `build/icon.ico` y `build/icon.png`.
 *
 * POR QUÉ UN GENERADOR Y NO UN FICHERO SUELTO
 *
 * Un `.ico` es binario y no se puede leer en un diff: si alguien lo cambia, el
 * repositorio no puede contar qué cambió. Aquí el icono es código, se regenera
 * con `npm run icon` y la revisión es la de siempre.
 *
 * Sin dependencias, además. Un PNG es cabecera, un bloque comprimido con zlib
 * —que viene con Node— y poco más; un `.ico` es una tabla de PNGs pegados. No
 * hace falta traerse una librería de imágenes para tres rectángulos.
 *
 * POR QUÉ SE DIBUJA CADA TAMAÑO POR SEPARADO
 *
 * Ésta es la parte que importa. Un `.ico` NO es una imagen escalada: es un
 * contenedor con un mapa de bits por tamaño, y Windows elige el que le viene.
 * Así que cada tamaño se dibuja a propósito y se decide qué cabe en él:
 *
 *   16, 20, 24   sólo las barras. A 16 píxeles cada barra son 4 y el hueco 1;
 *                cualquier adorno se come una barra entera.
 *   32, 40, 48   las barras y el filete del marco.
 *   64 en adelante  además las cuatro escuadras de las láminas de la
 *                enciclopedia, que es lo que hace que el icono y las
 *                ilustraciones de dentro sean la misma familia.
 *
 * Dibujando a mano cada tamaño se decide qué píxel se enciende, que es lo que
 * un rasterizador decide por ti y casi siempre peor.
 *
 * EL FONDO VA DENTRO DEL ICONO, y no es un detalle estético: la barra de tareas
 * de Windows puede ser clara u oscura, y unas barras color hueso desaparecen
 * sobre fondo claro. El icono se trae su propio suelo.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los colores de la aplicación, no una paleta nueva.
const FONDO = [0x16, 0x1b, 0x25, 255];   // --slate-850
const BORDE = [0x33, 0x3d, 0x4e, 255];   // --slate-600
const TINTA = [0xe6, 0xdc, 0xc6, 255];   // --bone
const ACENTO = [0xe0, 0x8a, 0x4b, 255];  // --t-fire

/** Un lienzo de píxeles con lo justo para pintar rectángulos. */
function lienzo(n) {
  const px = Buffer.alloc(n * n * 4);
  const poner = (x, y, c) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = (y * n + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  };
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) poner(i, j, c);
  };
  return { n, px, rect };
}

/**
 * El dibujo, tamaño a tamaño.
 *
 * Todo se calcula en enteros y desde el ancho de barra, no desde fracciones del
 * lienzo: con fracciones, a 16 píxeles una barra sale de 4,3 y el redondeo se
 * come el hueco entre dos.
 */
function dibuja(n) {
  const L = lienzo(n);
  L.rect(0, 0, n, n, FONDO);

  // El filete sólo desde 32: a 16 sería un anillo de un píxel que se come el
  // 12% del ancho para no decir nada.
  if (n >= 32) {
    const g = Math.max(1, Math.round(n / 64));
    L.rect(0, 0, n, g, BORDE); L.rect(0, n - g, n, g, BORDE);
    L.rect(0, 0, g, n, BORDE); L.rect(n - g, 0, g, n, BORDE);
  }

  // Las escuadras de las láminas, sólo cuando hay sitio de sobra.
  //
  // Ocho rectángulos y ni uno más: cada esquina es un brazo horizontal y uno
  // vertical que arrancan del mismo vértice. La primera versión los pintaba dos
  // veces y con los de abajo mal colocados — salían unas escuadras deformes que
  // además chocaban con las barras.
  let dentro;
  if (n >= 64) {
    const g = Math.round(n * 0.055);        // grosor del trazo
    const l = Math.round(n * 0.20);         // largo del brazo
    const m = Math.round(n * 0.09);         // margen al borde
    // Por esquina: dónde empieza cada brazo. Los de la derecha y los de abajo
    // se anclan al lado opuesto, que es lo que estaba mal.
    const esquinas = [
      [m, m, m, m],                          // arriba izquierda
      [n - m - l, m, n - m - g, m],          // arriba derecha
      [m, n - m - g, m, n - m - l],          // abajo izquierda
      [n - m - l, n - m - g, n - m - g, n - m - l], // abajo derecha
    ];
    for (const [hx, hy, vx, vy] of esquinas) {
      L.rect(hx, hy, l, g, TINTA);
      L.rect(vx, vy, g, l, TINTA);
    }
    // Las barras se meten por dentro de las escuadras, con aire: si se tocan,
    // el dibujo deja de leerse como «un marco y una medida» y parece un borrón.
    dentro = m + g + Math.round(n * 0.05);
  } else {
    dentro = n >= 32 ? Math.round(n * 0.16) : 1;
  }

  // ── Las barras y su línea de base ──────────────────────────────────────
  //
  // Tres y no cinco: con cinco, a 16 píxeles los huecos desaparecen y queda una
  // mancha. Tres barras de 4 con hueco de 1 llenan justo los 14 útiles.
  const ancho = n - dentro * 2;
  const hueco = Math.max(1, Math.round(n / 16));
  const barra = Math.floor((ancho - hueco * 2) / 3);
  const usado = barra * 3 + hueco * 2;
  const x0 = dentro + Math.floor((ancho - usado) / 2);

  const baseG = Math.max(1, Math.round(n / 12));
  const baseY = n - dentro - baseG;
  L.rect(x0, baseY, usado, baseG, TINTA);

  // Alturas en proporción, pero desde el suelo y en enteros.
  const alto = baseY - dentro;
  const hs = [Math.round(alto * 0.42), Math.round(alto * 0.68), alto];
  for (let i = 0; i < 3; i++) {
    const h = Math.max(2, hs[i]);
    L.rect(x0 + i * (barra + hueco), baseY - h, barra, h, i === 2 ? ACENTO : TINTA);
  }
  return L;
}

// ── PNG ────────────────────────────────────────────────────────────────────
const TABLA = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(L) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L.n, 0); ihdr.writeUInt32BE(L.n, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Una línea de filtro 0 por fila: sin filtrar. Son iconos de tres colores,
  // comprimen igual de bien y el código se lee.
  const filas = Buffer.alloc((L.n * 4 + 1) * L.n);
  for (let y = 0; y < L.n; y++) {
    filas[y * (L.n * 4 + 1)] = 0;
    L.px.copy(filas, y * (L.n * 4 + 1) + 1, y * L.n * 4, (y + 1) * L.n * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO: cabecera, una entrada por tamaño, y los PNG pegados detrás ────────
function ico(imgs) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(imgs.length, 4);
  const dir = Buffer.alloc(16 * imgs.length);
  let off = 6 + dir.length;
  imgs.forEach(({ n, buf }, i) => {
    const p = i * 16;
    dir[p] = n >= 256 ? 0 : n;       // 0 significa 256
    dir[p + 1] = n >= 256 ? 0 : n;
    dir[p + 2] = 0; dir[p + 3] = 0;
    dir.writeUInt16LE(1, p + 4);
    dir.writeUInt16LE(32, p + 6);
    dir.writeUInt32LE(buf.length, p + 8);
    dir.writeUInt32LE(off, p + 12);
    off += buf.length;
  });
  return Buffer.concat([cab, dir, ...imgs.map((x) => x.buf)]);
}

const TAMANOS = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const imgs = TAMANOS.map((n) => ({ n, buf: png(dibuja(n)) }));

fs.mkdirSync(path.join(RAIZ, 'build'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'build', 'icon.ico'), ico(imgs));
fs.writeFileSync(path.join(RAIZ, 'build', 'icon.png'), imgs.find((x) => x.n === 256).buf);

console.log(`  icon.ico  ${TAMANOS.join(', ')}  (${(ico(imgs).length / 1024).toFixed(1)} KB)`);
console.log(`  icon.png  256×256  (${(imgs.find((x) => x.n === 256).buf.length / 1024).toFixed(1)} KB)`);
