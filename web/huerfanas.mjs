import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTAS ESCRITAS PARA UNA VERSIÓN QUE NUNCA SE PUBLICÓ. Aquí se para.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EL CASO REAL: la v1.13.0 no llegó a existir como release. El commit estaba en
 * `main`, sus cinco `.md` estaban escritos, `PUBLICAR.md` se redactó durante esa
 * misma publicación — y no había release, ni etiqueta, ni borrador. Todo el
 * mundo se quedó en la 1.12.0 durante seis días y NADA lo dijo. Se descubrió al
 * publicar la siguiente, de casualidad, mirando la lista de releases por otro
 * motivo.
 *
 * POR QUÉ AQUÍ. El dato ya estaba en la construcción: `web:build` se trae las
 * releases de la API en cada pasada, para pintar la página de cada versión.
 * Tenía delante las veinte que existen y las notas de la que no, y no las
 * cruzaba. Es exactamente la forma de la guarda de los `{{clave}}` sin resolver
 * —el dato está, sólo hay que mirarlo— y del mismo tamaño.
 *
 * Y por qué no basta una prueba: `test/notas.js` corre sin red y no sabe qué hay
 * publicado. Esto sólo se puede comprobar donde se habla con GitHub. Lo que sí
 * se prueba sin red es la REGLA, y por eso vive en su propio fichero en vez de
 * dentro de `build.mjs`: ver `test/notas.js`.
 *
 * ── POR QUÉ NO SALTA EN LA PRIMERA CONSTRUCCIÓN ──────────────────────────
 *
 * Publicar hace `web:build` DOS VECES —ver `PUBLICAR.md`— y en la primera la
 * release de hoy todavía no existe **por diseño**: esa construcción es la que
 * genera `dist/notas/`, que es lo que hace falta para crearla. Saltar ahí
 * convertiría la guarda en un obstáculo del ritual en vez de en su red.
 *
 * Así que no hace falta ninguna bandera ni ningún argumento de más: la propia
 * release de hoy dice en qué pasada estamos. Si no existe, es la primera y esto
 * calla. Si existe, es la segunda y se exige que TODA versión con notas escritas
 * tenga su release — incluidas las de hace seis días.
 *
 * @param {{tag?: string}[]} rels  lo que devuelve la API, ya normalizado
 * @param {string} versionHoy      la de `package.json`
 * @param {string} [dir]           dónde viven las notas fuente
 */
export function notasHuerfanas(rels, versionHoy, dir = path.join(RAIZ, 'notas')) {
  const publicadas = new Set((rels ?? []).map((r) => String(r?.tag ?? '').replace(/^v/, '')));
  // La primera de las dos construcciones: la de hoy aún no existe, y es correcto.
  if (!publicadas.has(versionHoy)) return [];
  const conNotas = new Set(fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => /^(\d+\.\d+\.\d+)\./.exec(f)?.[1]).filter(Boolean)
    : []);
  return [...conNotas].filter((v) => !publicadas.has(v)).sort();
}

/**
 * La misma regla, pero parando la construcción. Ver arriba.
 *
 * Y CON UNA LISTA VACÍA NO CALLA, SE PARA. `notasHuerfanas` devuelve «ninguna»
 * cuando la versión de hoy no está publicada, que es lo correcto en la primera
 * de las dos construcciones — pero una lista vacía porque no se pudo preguntar
 * entra por esa misma puerta y apaga la guarda entera sin decir nada. Dos ceros
 * que se escriben igual, otra vez.
 */
export function exigirNotasPublicadas(rels, versionHoy, dir) {
  if (!Array.isArray(rels) || !rels.length) {
    throw new Error('no hay lista de versiones publicadas, así que esta guarda no'
      + ' ha comprobado nada. Con cero releases no se distingue «la de hoy aún no'
      + ' existe» de «no se pudo preguntar».');
  }
  const huerfanas = notasHuerfanas(rels, versionHoy, dir);
  if (!huerfanas.length) return;
  throw new Error(`versiones con notas escritas y SIN release: ${huerfanas.join(', ')}.`
    + ' Se escribieron para alguien y no las ha leído nadie: o se publica esa release,'
    + ' o se borran sus notas. Ver PUBLICAR.md, «nació saltándose un paso».');
}
