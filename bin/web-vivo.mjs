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
const DOM = 'https://eqlparse.com';
const IDIOMAS = ['es', 'en', 'de', 'fr', 'pt'];
const EXE = 'releases/download/v1.16.0/EQL-Parse-1.16.0-setup.exe';
// Un trozo de la nota de la 1.16.0 en cada idioma: si sale el español en la
// página alemana, esto lo caza. Salen del propio web/notas.
const HUELLA = { es: 'Toda la aplicación', en: 'The whole app', de: 'Die ganze', fr: "Toute l'application", pt: 'Toda a aplicação' };

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
    const ver = /1\.16\.0/.test(idx.texto);
    const boton = idx.texto.includes(EXE);
    const peso = /75\s*(MB|Mo)/.test(idx.texto);
    const arts = (nov.texto.match(/<article class="version">/g) ?? []).length;
    const pres = (nov.texto.match(/<pre>/g) ?? []).length;
    const graves = (nov.texto.match(/`/g) ?? []).length;
    // La nota de la 1.16.0 es el PRIMER artículo de la página.
    const i = nov.texto.indexOf('<article class="version">');
    const primero = nov.texto.slice(i, nov.texto.indexOf('</article>', i));
    const enSuIdioma = primero.includes(HUELLA[l]);

    filas.push({ l, ver, boton, peso, arts, pres, graves, enSuIdioma, idxCode: idx.code, novCode: nov.code });
    if (!ver) fallos.push(`${l}: la portada no declara 1.16.0`);
    if (!boton) fallos.push(`${l}: el botón no apunta al .exe de la 1.16.0`);
    if (!peso) fallos.push(`${l}: el tamaño no dice 75 MB`);
    if (arts !== 38) fallos.push(`${l}: ${arts} artículos, esperaba 38`);
    if (pres !== 12) fallos.push(`${l}: ${pres} <pre>, esperaba 12`);
    if (graves !== 0) fallos.push(`${l}: ${graves} acentos graves sueltos`);
    if (!enSuIdioma) fallos.push(`${l}: la nota de la 1.16.0 NO sale en su idioma`);
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
console.log('idioma  portada  botón  75MB  artículos  <pre>  graves  nota en su idioma');
for (const f of r.filas) {
  console.log(`  ${f.l}       ${f.ver ? 'sí ' : 'NO '}     ${f.boton ? 'sí ' : 'NO '}   ${f.peso ? 'sí ' : 'NO '}  ${String(f.arts).padStart(6)}     ${String(f.pres).padStart(4)}  ${String(f.graves).padStart(5)}   ${f.enSuIdioma ? 'sí' : 'NO'}`);
}

// Y que la URL del botón responda de verdad, no que sólo esté escrita.
const cab = await fetch(`https://github.com/infinityl111/eql-parse/${EXE}`, { method: 'GET', headers: { Range: 'bytes=0-1' } });
console.log('');
console.log(`la URL del botón responde: HTTP ${cab.status}  ${cab.status === 200 || cab.status === 206 ? 'OK' : '← MAL'}`);
if (cab.status !== 200 && cab.status !== 206) r.fallos.push('la URL del .exe no responde 200');

console.log('');
console.log(r.fallos.length ? `NO CUADRA:\n  - ${r.fallos.join('\n  - ')}` : 'TODO CUADRA en los cinco idiomas, contra eqlparse.com');
process.exit(r.fallos.length ? 1 : 0);
