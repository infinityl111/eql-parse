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
import { md, mitad } from '../web/build.mjs';

const DOM = 'https://eqlparse.com';
/** La valla de markdown, construida y no escrita: suelta abriria un bloque. */
const VALLA = new RegExp(String.fromCharCode(96).repeat(3), 'g');
const RAIZ_NOTAS = new URL('../web/notas', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
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

/**
 * ── LAS VALLAS: UN INVARIANTE, NO UN RECUENTO ─────────────────────────────
 *
 * Aqui habia un total: «13 <pre>, esperaba 13». Y llevaba **dias en rojo sin
 * bloquear nada**, diciendo 7 donde esperaba 13.
 *
 * La causa no era la web: era esta comprobacion. Sumaba los bloques del
 * **cuerpo entero** de cada release, y los cuerpos son **bilingues** -espanol
 * e ingles en el mismo texto, separados por su encabezado-. La pagina pinta
 * **una mitad**. Trece contra siete es exactamente eso, y no hay nada roto
 * al otro lado.
 *
 * Un total ademas no dice nada util cuando falla: «faltan seis» no senala
 * ninguna nota. Lo que importa es esto, y no envejece:
 *
 *     TODA NOTA CUYO MARKDOWN LLEVE UNA VALLA TIENE QUE PRODUCIR SU BLOQUE.
 *     NINGUNA LO PIERDE.
 *
 * Se mira **nota a nota y en su idioma**, contra la fuente exacta que la
 * pagina usa para esa nota: su fichero propio si lo tiene, y si no, la mitad
 * del cuerpo que le toca. El total se sigue imprimiendo -para ver la deriva-
 * pero **no pone nada rojo por si solo**.
 *
 * Y de ahi la regla: una comprobacion que lleva dias roja sin bloquear nada
 * ha dejado de ser una comprobacion. Entrena a ignorar el rojo.
 */
const NOTAS = new Map();
for (const l of IDIOMAS) {
  NOTAS.set(l, REG.map((r) => {
    const version = r.tag.replace(/^v/, '');
    const propia = `${RAIZ_NOTAS}/${version}.${l}.md`;
    const texto = fs.existsSync(propia)
      ? fs.readFileSync(propia, 'utf8')
      : mitad(r.cuerpo ?? '', l, r.tag).texto;
    return { tag: r.tag, vallas: ((texto.match(VALLA) ?? []).length / 2) | 0 };
  }));
}
const ESPERADO = {
  pres: Object.fromEntries(IDIOMAS.map((l) => [
    l, NOTAS.get(l).reduce((a, n) => a + n.vallas, 0)])),
  graves: REG.reduce((a, r) => a
    + (sinPre(md(mitad(r.cuerpo ?? '', 'es', r.tag).texto, r.tag)).match(/`/g) ?? []).length, 0),
};

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

/**
 * Las notas que llevan valla y no pintan bloque, en esta pagina y este idioma.
 *
 * Los articulos salen en el mismo orden que `REG`, asi que se parten por su
 * etiqueta de apertura y se mira cada uno contra las vallas de SU fuente.
 */
function vallasPerdidas(lang, html) {
  const trozos = html.split('<article class="version">').slice(1);
  const out = [];
  for (const [k, n] of NOTAS.get(lang).entries()) {
    if (!n.vallas) continue;
    const dentro = ((trozos[k] ?? '').match(/<pre>/g) ?? []).length;
    if (dentro < n.vallas) {
      out.push(`${lang}: ${n.tag} lleva ${n.vallas} valla(s) y la pagina pinta ${dentro} bloque(s)`);
    }
  }
  return out;
}

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

    filas.push({
      l, ver, boton, peso, arts, pres, graves, enSuIdioma,
      presEsperados: ESPERADO.pres[l], idxCode: idx.code, novCode: nov.code,
      html: nov.texto,
    });
    if (!ver) fallos.push(`${l}: la portada no declara ${VERSION}`);
    if (!boton) fallos.push(`${l}: el botón no apunta al .exe de la ${VERSION}`);
    if (!peso) fallos.push(`${l}: el tamaño no dice ${MB} MB`);
    if (arts !== REG.length) fallos.push(`${l}: ${arts} artículos, esperaba ${REG.length}`);
    /**
     * NOTA A NOTA. Los articulos salen en el mismo orden que `REG`, asi que
     * se parten por su etiqueta de apertura y se mira cada uno contra las
     * vallas de SU fuente. Una nota con valla y sin bloque es el fallo; el
     * total sobrante o faltante, no.
     */
    fallos.push(...vallasPerdidas(l, nov.texto));
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
console.log(`idioma  portada  botón  ${MB}MB  artículos  <pre>/vallas  graves  nota en su idioma`);
for (const f of r.filas) {
  // Tres estados y no dos: «sí», «NO», y «—» cuando esta versión no trae notas
  // propias y por tanto no hay nada que comprobar. Un «NO» ahí sería mentira.
  const idioma = f.enSuIdioma === null ? '— ' : (f.enSuIdioma ? 'sí' : 'NO');
  console.log(`  ${f.l}       ${f.ver ? 'sí ' : 'NO '}     ${f.boton ? 'sí ' : 'NO '}   ${f.peso ? 'sí ' : 'NO '}  ${String(f.arts).padStart(6)}     ${String(f.pres).padStart(4)}/${String(f.presEsperados).padEnd(2)}  ${String(f.graves).padStart(5)}   ${idioma}`);
}

/**
 * ── CONTROL POSITIVO, sobre la pagina de verdad ───────────────────────────
 *
 * A la que acaba de bajarse se le quitan los bloques y se exige que la
 * comprobacion los eche de menos. Sin esto, el «7/7» de arriba podria estar
 * saliendo de una comprobacion que no mira nada -que es exactamente lo que
 * pasaba con el recuento que habia antes, trece contra siete durante dias-.
 */
{
  const con = r.filas.find((f) => f.html && NOTAS.get(f.l).some((n) => n.vallas));
  if (!con) {
    console.log('\nCONTROL: ninguna nota lleva valla; no hay nada que controlar');
  } else {
    const mutilada = con.html.replace(/<pre>[\s\S]*?<\/pre>/g, '');
    const cazadas = vallasPerdidas(con.l, mutilada);
    console.log(cazadas.length
      ? `\nCONTROL: quitandole los bloques a /${con.l}/, se echan de menos ${cazadas.length}`
      : '\nCONTROL FALLIDO: sin bloques tampoco se queja — esta comprobacion no mira nada');
    if (!cazadas.length) process.exitCode = 1;
  }
}

// Y que la URL del botón responda de verdad, no que sólo esté escrita.
const cab = await fetch(URL_EXE, { method: 'GET', headers: { Range: 'bytes=0-1' } });
console.log('');
console.log(`la URL del botón responde: HTTP ${cab.status}  ${cab.status === 200 || cab.status === 206 ? 'OK' : '← MAL'}`);
if (cab.status !== 200 && cab.status !== 206) r.fallos.push('la URL del .exe no responde 200');

console.log('');
console.log(r.fallos.length ? `NO CUADRA:\n  - ${r.fallos.join('\n  - ')}` : 'TODO CUADRA en los cinco idiomas, contra eqlparse.com');
process.exit(r.fallos.length ? 1 : 0);
