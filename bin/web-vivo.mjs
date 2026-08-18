#!/usr/bin/env node
/**
 * LA COMPROBACIÓN DE CIERRE DEL DESPLIEGUE, contra eqlparse.com y no contra lo
 * que acabamos de construir. Ver PUBLICAR.md, «cómo se comprueba».
 *
 * Sustituye a un `grep` del número de versión, que daba VERDE CON EL SITIO
 * ROTO: la versión sale también en el pie de las veinte páginas, así que casaba
 * aunque el botón apuntara a un instalador inexistente —lo que pasó con la
 * 1.16.0— o aunque las notas salieran en español en los cinco idiomas.
 *
 * NINGUNA COMPROBACIÓN SE DEDUCE DE OTRA, y por eso son siete y no una: que la
 * portada diga la versión no prueba que el botón lleve a ningún sitio, y que
 * las novedades tengan sus artículos no prueba que estén en tu idioma.
 *
 * Uso:  npm run web:vivo
 *
 * La comprobación CONTRA PRODUCCIÓN, no contra lo que produjimos.
 * Reintenta mientras Cloudflare propaga; no da por bueno el primer intento.
 */
import fs from 'node:fs';
import { md } from '../web/build.mjs';

const DOM = 'https://eqlparse.com';
const IDIOMAS = ['es', 'en', 'de', 'fr', 'pt'];

/**
 * TODO LO ESPERADO SE DERIVA; NO SE ESCRIBE AQUÍ.
 *
 * Esto llevaba la 1.16.0 escrita a mano —la versión, la ruta del `.exe`, los
 * 75 MB y una frase de cada nota— y eso caduca en la publicación siguiente.
 * Una comprobación con la versión vieja dentro no falla porque el sitio esté
 * mal: falla porque ella se quedó atrás, y entonces o se retoca a mano cada vez
 * —y el retoque se olvida— o se empieza a leer su rojo como ruido.
 *
 * `web/releases.json` es la copia que deja la construcción que se acaba de
 * subir, así que dice exactamente qué debería estar sirviéndose. Y la huella de
 * cada idioma sale del primer titular de `web/notas/<versión>.<idioma>.md`, que
 * es literalmente lo que la página tiene que pintar: si la alemana sale en
 * español, no casa.
 */
const REG = JSON.parse(fs.readFileSync(new URL('../web/releases.json', import.meta.url), 'utf8'));
const NUEVA = REG[0];
const VERSION = NUEVA.tag.replace(/^v/, '');
/**
 * DOS FORMAS DE LA MISMA URL, y confundirlas costó un 404.
 *
 * `EXE` es lo que la PÁGINA tiene escrito —con el repositorio dentro— y sirve
 * para buscarlo en el HTML. `URL_EXE` es la dirección entera, y es la que se
 * pide. Al derivar esto quitando sólo el dominio quedó la primera puesta en el
 * sitio de la segunda, y el `fetch` volvía a anteponer el repositorio: la
 * dirección salía duplicada y GitHub contestaba 404.
 *
 * Lo cazó esta misma comprobación en su primera pasada derivada, que es
 * exactamente para lo que está.
 */
const URL_EXE = NUEVA.descarga;
const EXE = NUEVA.descarga.replace(/^https:\/\/github\.com\//, '');
const MB = Math.round(NUEVA.bytes / 1024 / 1024);
/**
 * LOS DOS ÚLTIMOS NÚMEROS ESCRITOS A MANO, y caducaron a la primera.
 *
 * Aquí ponía `!== 12` y `!== 0`. La 1.17.0 añade un bloque cercado a sus notas
 * —el ejemplo de las resistencias— y dentro va «Coercer T`vala», que lleva tres
 * acentos graves en el nombre. Las dos comprobaciones se pusieron rojas **con
 * el sitio correcto**, que es el peor color posible: el rojo que no significa
 * nada se aprende a ignorar, y entonces deja de avisar del que sí.
 *
 * Se derivan de lo mismo que sirve la página: `md()` sobre los cuerpos de
 * `web/releases.json`. Y el acento grave sólo es un fallo FUERA de un `<pre>`;
 * dentro es el nombre de un bicho, escrito como lo escribe el juego.
 */
const sinPre = (h) => h.replace(/<pre>[\s\S]*?<\/pre>/g, '');
const ESPERADO = REG.reduce((a, r) => {
  const h = md(r.cuerpo ?? '', r.tag);
  a.pres += (h.match(/<pre>/g) ?? []).length;
  a.graves += (sinPre(h).match(/`/g) ?? []).length;
  return a;
}, { pres: 0, graves: 0 });

const HUELLA = Object.fromEntries(IDIOMAS.map((l) => {
  const p = new URL(`../web/notas/${VERSION}.${l}.md`, import.meta.url);
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  // El primer titular, sin el `##`, y sin el trozo final por si lleva comillas
  // tipográficas que el HTML escape de otra manera.
  const h = /^##\s+(.+)$/m.exec(txt)?.[1] ?? null;
  return [l, h ? h.slice(0, 34) : null];
}));

const baja = async (u) => {
  const r = await fetch(u, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  return { ok: r.ok, code: r.status, texto: await r.text() };
};

async function ronda() {
  const fallos = [];
  const filas = [];
  for (const l of IDIOMAS) {
    const idx = await baja(`${DOM}/${l}/`);
    const nov = await baja(`${DOM}/${l}/novedades.html`);
    const ver = idx.texto.includes(VERSION);
    const boton = idx.texto.includes(EXE);
    const peso = new RegExp(`${MB}\\s*(MB|Mo)`).test(idx.texto);
    const arts = (nov.texto.match(/<article class="version">/g) ?? []).length;
    const pres = (nov.texto.match(/<pre>/g) ?? []).length;
    const graves = (sinPre(nov.texto).match(/`/g) ?? []).length;
    // La nota de la versión nueva es el PRIMER artículo de la página.
    const i = nov.texto.indexOf('<article class="version">');
    const primero = nov.texto.slice(i, nov.texto.indexOf('</article>', i));
    // Sin huella —una versión sin notas propias— esto no se puede comprobar y
    // se dice, en vez de darlo por bueno: el respaldo al cuerpo español es
    // legítimo y no es lo mismo que haberlo verificado.
    const enSuIdioma = HUELLA[l] === null ? null : primero.includes(HUELLA[l]);

    filas.push({ l, ver, boton, peso, arts, pres, graves, enSuIdioma, idxCode: idx.code, novCode: nov.code });
    if (!ver) fallos.push(`${l}: la portada no declara ${VERSION}`);
    if (!boton) fallos.push(`${l}: el botón no apunta al .exe de la ${VERSION}`);
    if (!peso) fallos.push(`${l}: el tamaño no dice ${MB} MB`);
    if (arts !== REG.length) fallos.push(`${l}: ${arts} artículos, esperaba ${REG.length}`);
    if (pres !== ESPERADO.pres) fallos.push(`${l}: ${pres} <pre>, esperaba ${ESPERADO.pres}`);
    if (graves !== ESPERADO.graves) fallos.push(`${l}: ${graves} acentos graves fuera de un <pre>, esperaba ${ESPERADO.graves}`);
    if (enSuIdioma === false) fallos.push(`${l}: la nota de la ${VERSION} NO sale en su idioma`);
  }
  return { fallos, filas };
}

let r;
for (let intento = 1; intento <= 6; intento++) {
  r = await ronda();
  if (!r.fallos.length) { console.log(`(cuadró en el intento ${intento})`); break; }
  if (intento === 6) break;
  console.log(`intento ${intento}: ${r.fallos.length} sin cuadrar todavía; espero 20 s y repito`);
  await new Promise((res) => setTimeout(res, 20000));
}

console.log('');
console.log(`comprobando la ${VERSION}: ${MB} MB, ${REG.length} versiones publicadas`);
console.log(`idioma  portada  botón  ${MB}MB  artículos  <pre>  graves  nota en su idioma`);
for (const f of r.filas) {
  // Tres estados y no dos: «sí», «NO», y «—» cuando esta versión no trae notas
  // propias y por tanto no hay nada que comprobar. Un «NO» ahí sería mentira.
  const idioma = f.enSuIdioma === null ? '— ' : (f.enSuIdioma ? 'sí' : 'NO');
  console.log(`  ${f.l}       ${f.ver ? 'sí ' : 'NO '}     ${f.boton ? 'sí ' : 'NO '}   ${f.peso ? 'sí ' : 'NO '}  ${String(f.arts).padStart(6)}     ${String(f.pres).padStart(4)}  ${String(f.graves).padStart(5)}   ${idioma}`);
}

// Y que la URL del botón responda de verdad, no que sólo esté escrita.
const cab = await fetch(URL_EXE, { method: 'GET', headers: { Range: 'bytes=0-1' } });
console.log('');
console.log(`la URL del botón responde: HTTP ${cab.status}  ${cab.status === 200 || cab.status === 206 ? 'OK' : '← MAL'}`);
if (cab.status !== 200 && cab.status !== 206) r.fallos.push('la URL del .exe no responde 200');

console.log('');
console.log(r.fallos.length ? `NO CUADRA:\n  - ${r.fallos.join('\n  - ')}` : 'TODO CUADRA en los cinco idiomas, contra eqlparse.com');
process.exit(r.fallos.length ? 1 : 0);
