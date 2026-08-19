/**
 * LOS CUERPOS BILINGÜES, Y A QUIÉN SE LE SIRVE CADA MITAD.
 *
 * ── EL FALLO, MEDIDO ANTES DE ARREGLARLO ──────────────────────────────────
 *
 * Cuando no hay nota propia en `web/notas/`, la página cae al `cuerpo` de la
 * release. Y 18 DE LAS 40 RELEASES traen el cuerpo bilingüe: «## Español» con
 * la nota entera y detrás «## English» con la nota entera otra vez. El
 * respaldo volcaba LAS DOS MITADES en LAS CINCO páginas. En caracteres:
 *
 *     página   en su idioma   español ajeno   inglés ajeno   % propio
 *     es           125.526              0          58.149      68,3 %
 *     en           102.027         82.220               0      55,4 %
 *     de            48.323         82.220          58.149      25,6 %
 *     fr            47.818         82.220          58.149      25,4 %
 *     pt            43.091         82.220          58.149      23,5 %
 *
 * La página española era un 31,7 % INGLÉS. Nadie busca inglés en la página
 * española, y por eso llevaba ahí desde siempre.
 *
 * ── LAS TRES REGLAS QUE ESTA BATERÍA GUARDA ───────────────────────────────
 *
 *   1. es → mitad española. en → mitad inglesa. NUNCA las dos.
 *   2. de, fr, pt → mitad inglesa Y MARCADA. Es una decisión, no una
 *      obviedad: a esas tres ninguna mitad es su idioma, y se elige servir
 *      texto ajeno DICIÉNDOLO en vez de callando, que es lo que se hacía.
 *   3. Sin encabezado → el cuerpo entero, que es español, marcado para los
 *      cuatro que no son el español. Ése es el problema VIEJO; esto no lo
 *      arregla, sólo deja de disimularlo.
 *
 * ── Y LA GUARDA, QUE ES LA RAZÓN DE QUE ESTO SEA UNA FUNCIÓN Y NO UN CORTE ─
 *
 *     UN CUERPO CON ENCABEZADO PERO SIN UNA DE LAS MITADES **PARA**.
 *
 * Media nota servida como si fuera entera es peor que no desplegar: no se ve
 * desde la consola de quien construye, y el lector no tiene forma de saber que
 * le falta la mitad. Misma doctrina que la valla ``` sin cerrar.
 *
 * ── EL CONTROL POSITIVO ───────────────────────────────────────────────────
 *
 * Sin el punto 6, todo lo de arriba pasa en verde con un `mitad()` que
 * devuelva siempre cadena vacía: «no hay inglés en la española» lo cumple la
 * nada. Por eso se exige que la mitad servida CONSERVE su texto, que las dos
 * mitades sean DISTINTAS entre sí, y que juntas den el cuerpo original.
 */
import { mitad, ENCABEZADOS } from '../web/build.mjs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

/** Un cuerpo bilingüe como los de verdad, con marcas reconocibles en cada mitad. */
const BILINGUE = [
  '## Español',
  '',
  '> **No pide reconstruir nada.** MARCA_ESPANOLA',
  '',
  '# Copiar la pelea al chat',
  '',
  'Un botón que deja la pelea en el portapapeles.',
  '',
  '## English',
  '',
  '> **It asks for no rebuild.** MARCA_INGLESA',
  '',
  '# Copy the fight to chat',
  '',
  'A button that puts the fight on the clipboard.',
].join('\n');

// ── 1. Cada idioma recibe UNA mitad, nunca las dos ─────────────────────────
console.log('\ncada página recibe una sola mitad');
{
  const es = mitad(BILINGUE, 'es', 'v1.6.2 (es)');
  ok(es.texto.includes('MARCA_ESPANOLA'), 'es: recibe la mitad española');
  ok(!es.texto.includes('MARCA_INGLESA'), 'es: y NO recibe la inglesa — era el 31,7 % de la página');
  ok(es.marcada === false, 'es: sin marca, porque es su idioma');

  const en = mitad(BILINGUE, 'en', 'v1.6.2 (en)');
  ok(en.texto.includes('MARCA_INGLESA'), 'en: recibe la mitad inglesa');
  ok(!en.texto.includes('MARCA_ESPANOLA'), 'en: y NO recibe la española');
  ok(en.marcada === false, 'en: sin marca, porque es su idioma');
}

// ── 2. Alemán, francés y portugués: la inglesa, Y MARCADA ──────────────────
console.log('\nde, fr y pt reciben la inglesa y se dice que no está traducida');
{
  for (const lang of ['de', 'fr', 'pt']) {
    const m = mitad(BILINGUE, lang, `v1.6.2 (${lang})`);
    ok(m.texto.includes('MARCA_INGLESA'), `${lang}: recibe la mitad inglesa`);
    ok(!m.texto.includes('MARCA_ESPANOLA'), `${lang}: y no la española`);
    ok(m.marcada === true, `${lang}: MARCADA — se sirve texto ajeno, pero diciéndolo`);
    ok(m.idioma === 'en', `${lang}: y la marca sabe decir en qué idioma está`, m.idioma);
  }
}

// ── 3. Sin encabezado: el cuerpo entero, español, marcado para los demás ───
console.log('\nun cuerpo sin encabezado es español para todos, y se dice');
{
  const SUELTO = '# Arreglos\n\nUn párrafo en español y nada más.';
  const es = mitad(SUELTO, 'es', 'v1.7.0 (es)');
  ok(es.texto === SUELTO, 'es: recibe el cuerpo entero, sin cortar');
  ok(es.marcada === false, 'es: y sin marca, porque está en su idioma');
  for (const lang of ['en', 'de', 'fr', 'pt']) {
    const m = mitad(SUELTO, lang, `v1.7.0 (${lang})`);
    ok(m.texto === SUELTO, `${lang}: recibe el mismo cuerpo entero`);
    ok(m.marcada === true && m.idioma === 'es',
      `${lang}: MARCADA como español — el problema viejo queda DICHO, no arreglado`);
  }
}

/**
 * ── 4. LA GUARDA ──────────────────────────────────────────────────────────
 * Con encabezado pero sin una mitad, para. Y nombra la versión y qué falta.
 */
console.log('\nun cuerpo con encabezado y sin una mitad PARA');
{
  const SOLO_ES = '## Español\n\nLa mitad española y nada más.';
  const SOLO_EN = '## English\n\nThe English half and nothing else.';
  for (const [cuerpo, falta, hay] of [[SOLO_ES, 'English', 'Español'], [SOLO_EN, 'Español', 'English']]) {
    let msg = null;
    try { mitad(cuerpo, 'es', 'v9.9.9 (es)'); } catch (e) { msg = e.message; }
    ok(msg !== null, `falta «## ${falta}»: lanza en vez de servir media nota`);
    ok(!!msg && msg.includes('v9.9.9 (es)'), '  y nombra la versión y el idioma');
    ok(!!msg && msg.includes(falta), `  y dice cuál falta: «${falta}»`, msg?.match(/NO trae «## (\w+)»/)?.[1]);
    ok(!!msg && msg.includes(hay), `  y cuál sí está: «${hay}»`);
  }
  // Para en TODOS los idiomas, no sólo en el que se pidió.
  for (const lang of ['es', 'en', 'de', 'fr', 'pt']) {
    let lanzo = false;
    try { mitad(SOLO_ES, lang, 'x'); } catch { lanzo = true; }
    ok(lanzo, `  y para también para «${lang}»: la guarda no depende del idioma pedido`);
  }
}

// ── 5. El orden de los encabezados no manda ────────────────────────────────
console.log('\nda igual en qué orden vengan los encabezados');
{
  const ALREVES = [
    '## English', '', 'MARCA_INGLESA aquí.', '',
    '## Español', '', 'MARCA_ESPANOLA aquí.',
  ].join('\n');
  const es = mitad(ALREVES, 'es', 'x'), en = mitad(ALREVES, 'en', 'x');
  ok(es.texto.includes('MARCA_ESPANOLA') && !es.texto.includes('MARCA_INGLESA'),
    'con el inglés primero, el español sigue recibiendo lo suyo');
  ok(en.texto.includes('MARCA_INGLESA') && !en.texto.includes('MARCA_ESPANOLA'),
    'y el inglés lo suyo');
  // Y con ### en vez de ##, que también aparece.
  const CON3 = BILINGUE.replace(/^## /gm, '### ');
  ok(mitad(CON3, 'es', 'x').texto.includes('MARCA_ESPANOLA'), 'y con ### en vez de ## también');
}

/**
 * ── 6. EL CONTROL POSITIVO ────────────────────────────────────────────────
 * Sin esto, un `mitad()` que devolviera '' pasaría todo lo de arriba: «no hay
 * inglés en la española» lo cumple la nada.
 */
console.log('\nCONTROL: la mitad servida conserva su texto de verdad');
{
  const es = mitad(BILINGUE, 'es', 'x'), en = mitad(BILINGUE, 'en', 'x');
  ok(es.texto.length > 60, 'CONTROL: la mitad española tiene texto, no está vacía', es.texto.length);
  ok(en.texto.length > 60, 'CONTROL: la mitad inglesa tampoco', en.texto.length);
  ok(es.texto !== en.texto, 'CONTROL: y son DISTINTAS entre sí');
  ok(es.texto.includes('Copiar la pelea al chat'), 'CONTROL: la española conserva su titular');
  ok(en.texto.includes('Copy the fight to chat'), 'CONTROL: y la inglesa el suyo');
  ok(es.texto.includes('portapapeles') && en.texto.includes('clipboard'),
    'CONTROL: y su párrafo, cada una en su idioma');

  // Juntas dan el cuerpo entero menos la cabecera: no se pierde nada por el camino.
  const juntas = es.texto.length + en.texto.length;
  const original = BILINGUE.length - BILINGUE.indexOf('## Español');
  ok(juntas === original, 'CONTROL: las dos mitades suman el cuerpo entero, no se pierde texto',
    `${juntas} de ${original}`);

  // Y los encabezados que reconoce son los dos que hay, ni uno más.
  ok(Object.keys(ENCABEZADOS).join(',') === 'es,en',
    'CONTROL: se reconocen dos formas de encabezado y sólo dos',
    Object.keys(ENCABEZADOS).join(','));
  ok(ENCABEZADOS.es.test('## Español') && ENCABEZADOS.en.test('## English'),
    'CONTROL: y las dos casan lo que dicen casar');
  ok(!ENCABEZADOS.es.test('## Espanol sin tilde') && !ENCABEZADOS.en.test('## English notes'),
    'CONTROL: y no casan un titular que EMPIECE por esa palabra');
}

// ── 7. Sobre las releases de verdad ────────────────────────────────────────
console.log('\nsobre releases.json de verdad');
{
  const rel = JSON.parse(await (await import('node:fs')).promises.readFile(
    new URL('../web/releases.json', import.meta.url), 'utf8'));
  let bilingues = 0, sueltas = 0, marcadas = 0, paradas = 0;
  for (const r of rel) {
    const tieneEs = ENCABEZADOS.es.test(r.cuerpo ?? ''), tieneEn = ENCABEZADOS.en.test(r.cuerpo ?? '');
    if (tieneEs && tieneEn) bilingues++; else if (!tieneEs && !tieneEn) sueltas++;
    for (const lang of ['es', 'en', 'de', 'fr', 'pt']) {
      try { if (mitad(r.cuerpo, lang, r.tag).marcada) marcadas++; } catch { paradas++; }
    }
  }
  ok(bilingues === 18, 'las 18 releases bilingües medidas siguen siendo 18', bilingues);
  ok(sueltas === rel.length - 18, 'y las demás no llevan encabezado', sueltas);
  ok(paradas === 0, 'ninguna release real dispara la guarda: ninguna está a medias', paradas);
  ok(marcadas > 0, 'y hay notas que se marcan como no traducidas', marcadas);
  console.log(`       (${rel.length} releases · ${bilingues} bilingües · ${marcadas} notas marcadas en total)`);

  // Ninguna página recibe ya las dos mitades.
  let dobles = 0;
  for (const r of rel) for (const lang of ['es', 'en', 'de', 'fr', 'pt']) {
    const m = mitad(r.cuerpo, lang, r.tag);
    if (ENCABEZADOS.es.test(m.texto) && ENCABEZADOS.en.test(m.texto)) dobles++;
  }
  ok(dobles === 0, 'CERO páginas reciben las dos mitades a la vez (antes: las 90)', dobles);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
