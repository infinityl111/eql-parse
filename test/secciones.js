/**
 * LOS RÓTULOS DE LA BARRA LATERAL, EN LOS CINCO IDIOMAS.
 *
 *     UN GRUPO Y UNA SECCIÓN SUYA NO PUEDEN SER SINÓNIMOS.
 *
 * EL CASO QUE LA ESCRIBE. En alemán el grupo «Ajustes» y la sección
 * «Preferencias» eran los dos `Einstellungen`, así que la barra decía
 * **Einstellungen › Einstellungen**. En español no se veía, en inglés casi, y en
 * alemán era literal: un camino que no lleva a ninguna parte porque el destino
 * se llama igual que el sitio donde estás.
 *
 * Y LA SALIDA NO ES BUSCAR OTRA PALABRA ALEMANA. Si hace falta un sinónimo para
 * distinguirlas es que el rótulo no dice lo que hay dentro: se llama a la
 * sección POR SU CONTENIDO y se arregla en los cinco a la vez. Ésa fue —voz,
 * quién es de los tuyos, y cómo se copia una línea— «Voz y los tuyos».
 *
 * La segunda comprobación es la gemela: dos secciones DEL MISMO GRUPO tampoco
 * pueden llamarse igual. Entre grupos distintos sí —«Botín» de esta pelea y
 * «Botín» de todo el histórico son el mismo nombre a propósito, y es el motivo
 * de que los grupos existan.
 *
 * LA LISTA SE DERIVA de `SECCIONES` en `ui/app.js`, leyendo el fuente: una
 * sección nueva queda cubierta sin que nadie se acuerde de apuntarla aquí.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t, LANGS } from '../src/i18n.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(RAIZ, 'ui', 'app.js'), 'utf8');

console.log('\nla barra lateral: ningún grupo se llama como una sección suya');

const desde = APP.indexOf('const SECCIONES = [');
const hasta = APP.indexOf('\n];', desde);
const bloque = desde >= 0 && hasta > desde ? APP.slice(desde, hasta) : '';
const secciones = [...bloque.matchAll(/id: '([^']+)', grupo: '([^']+)'[\s\S]*?rotulo: \(\) => t\('([^']+)'\)/g)]
  .map(([, id, grupo, clave]) => ({ id, grupo, clave }));

ok(secciones.length >= 10, 'se ha derivado la lista desde ui/app.js', `${secciones.length} secciones`);

// El rótulo de cada grupo, que en el código sale de `sec.g.<grupo>`.
const grupos = [...new Set(secciones.map((s) => s.grupo))];
ok(grupos.length >= 2, 'y sus grupos', grupos.join(', '));

const sinRotulo = [...secciones.map((s) => s.clave), ...grupos.map((g) => `sec.g.${g}`)]
  .filter((k) => { setLang('es'); return t(k) === k; });
ok(sinRotulo.length === 0, 'toda clave de la barra existe en el diccionario',
  sinRotulo.length ? sinRotulo.join(', ') : 'las de las secciones y las de los grupos');

/**
 * LOS CÓDIGOS, NO LOS OBJETOS. `LANGS` es una lista de fichas —código, nombre,
 * voz, bandera—, así que `for (const lang of LANGS) setLang(lang)` le pasa un
 * objeto, no cambia de idioma, y esto comprueba cinco veces el español. Escrito
 * así la primera vez: la prueba salió verde con el choque alemán delante.
 */
const CODIGOS = LANGS.map((l) => l.code ?? l);

const sinonimos = [];
const repetidas = [];
for (const lang of CODIGOS) {
  setLang(lang);
  for (const g of grupos) {
    const rotuloG = t(`sec.g.${g}`).trim().toLowerCase();
    const suyas = secciones.filter((s) => s.grupo === g).map((s) => t(s.clave).trim().toLowerCase());
    for (const r of suyas) {
      if (r === rotuloG) sinonimos.push(`${lang}: «${t(`sec.g.${g}`)}» = «${r}»`);
    }
    const dobles = suyas.filter((x, i) => suyas.indexOf(x) !== i);
    for (const d of dobles) repetidas.push(`${lang}/${g}: «${d}»`);
  }
}

ok(sinonimos.length === 0, `ningún grupo es sinónimo de una sección suya (${CODIGOS.length} idiomas)`,
  sinonimos.length ? sinonimos.join(' · ') : 'ninguno');
ok(repetidas.length === 0, 'ni dos secciones del mismo grupo se llaman igual',
  repetidas.length ? repetidas.join(' · ') : 'ninguna');

/**
 * Y LA GUARDA DE LA GUARDA, POR EL MISMO CAMINO QUE LA COMPROBACIÓN.
 *
 * La primera versión usaba `setLang('es')` y `setLang('de')` escritos a mano, y
 * por eso NO vio que el bucle de arriba iba con objetos y se pasaba los cinco
 * idiomas en español. Una guarda que no recorre lo mismo que lo que guarda no
 * guarda nada: aquí se recorren `CODIGOS` y se exige que salgan rótulos
 * distintos de verdad.
 */
const vistos = new Map();
for (const lang of CODIGOS) {
  setLang(lang);
  vistos.set(lang, secciones.map((s) => t(s.clave)).join('|'));
}
setLang('es');
ok(new Set(vistos.values()).size === CODIGOS.length,
  'y recorre de verdad los cinco idiomas, no uno cinco veces',
  `${new Set(vistos.values()).size} juegos de rótulos distintos de ${CODIGOS.length}`);

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
