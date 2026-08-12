/**
 * Las notas de versión: los rótulos citados y el idioma de quien lee.
 *
 * DOS COSAS, Y LAS DOS SALEN DE FALLOS QUE YA PASARON.
 *
 * 1 · LOS RÓTULOS CITADOS SE SUSTITUYEN, NO SE ESCRIBEN A MANO. Las notas citan
 *     a propósito rótulos que la aplicación enseña, para que el lector RECONOZCA
 *     lo que tiene delante. Escritos a mano se desvían: en la 1.11.0 el rótulo
 *     del consejo se tradujo mal en tres idiomas a la vez —`découpés`,
 *     `aufgeteilt`, `dividido`, cuando i18n dice `répartis`, `getrennt`,
 *     `separado`— y el del análisis se citó en los cinco con un nombre que la
 *     aplicación NUNCA ha enseñado. Se cazó a mano antes de publicar; la segunda
 *     vez no habría quien lo cazara.
 *
 *     Lo que esto comprueba es lo único que hace falta: que toda `{{clave}}`
 *     escrita en las notas exista en el diccionario. Sin falsos positivos,
 *     porque sólo mira lo marcado — las comillas retóricas se escriben como
 *     siempre y nadie las toca. Ver `notasDe()` en `web/build.mjs`.
 *
 * 2 · Y QUE EL CARTEL DE LA APLICACIÓN PUEDA LEERLAS EN SU IDIOMA. La 1.12.0 fue
 *     la primera versión que pide algo destructivo, y el texto que lo explicaba
 *     era el único sin traducir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t, LANGS } from '../src/i18n.js';
import { sustituirRotulos } from '../web/rotulos.mjs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTAS = path.join(RAIZ, 'web', 'notas');

// ── 1. Toda {{clave}} de las notas existe en el diccionario ────────────────
console.log('\nlos rótulos citados en las notas existen');
{
  const ficheros = fs.existsSync(NOTAS) ? fs.readdirSync(NOTAS).filter((f) => f.endsWith('.md')) : [];
  ok(ficheros.length > 0, 'hay notas que comprobar', ficheros.length);

  const malas = [];
  let citas = 0;
  for (const f of ficheros) {
    const lang = f.split('.').at(-2);
    const texto = fs.readFileSync(path.join(NOTAS, f), 'utf8');
    for (const [, clave] of texto.matchAll(/\{\{([a-zA-Z0-9._-]+)\}\}/g)) {
      citas++;
      setLang(LANGS.includes(lang) ? lang : 'es');
      // `t()` devuelve la clave cuando no la encuentra: eso es «no existe».
      if (t(clave) === clave) malas.push(`${f}: {{${clave}}}`);
    }
  }
  ok(malas.length === 0, `toda {{clave}} citada existe en i18n (${citas} citas)`,
    malas.length ? malas.join(' · ') : 'ninguna rota');
}

// ── 2. La sustitución pone el rótulo del idioma que toca ───────────────────
//
// Se prueba con una clave de verdad y en dos idiomas: si sustituyera siempre en
// el mismo, la comprobación de arriba pasaría igual y las notas alemanas
// saldrían en español sin que nadie se enterara.
console.log('\nla sustitución usa el idioma de cada nota');
{
  const muestra = 'Y {{cb.loot}} al final.';
  setLang('es');
  const es = sustituirRotulos(muestra, 'es');
  const de = sustituirRotulos(muestra, 'de');
  ok(es.includes(t('cb.loot')), 'en español pone el rótulo español', es);
  setLang('de');
  ok(de.includes(t('cb.loot')), 'en alemán pone el alemán', de);
  ok(es !== de, 'y no son el mismo texto');
  setLang('es');
  ok(sustituirRotulos('sin llaves', 'es') === 'sin llaves', 'lo que no lleva llaves no se toca');
  // El idioma activo no se queda cambiado: `sustituirRotulos` lo devuelve como
  // estaba. Sin esto, construir la web dejaba la aplicación en portugués.
  setLang('es');
  sustituirRotulos('{{cb.loot}}', 'pt');
  ok(t('cb.loot') === 'Botín', 'y el idioma activo queda como estaba', t('cb.loot'));

  // UNA CLAVE QUE NO EXISTE SE DEJA VER, con las llaves puestas: el respaldo
  // ruidoso. Un rótulo inventado no se distingue de uno bueno; `{{esto}}` sí.
  ok(sustituirRotulos('{{no.existe.esta}}', 'es') === '{{no.existe.esta}}',
    'una clave que no existe se queda a la vista');
}

// ── 3. El cartel de la aplicación coge la nota de su idioma ────────────────
//
// Sin red: se le da a `consultar` una respuesta de la API igual que la de
// GitHub. Lo que se comprueba son los dos caminos —adjunto en tu idioma, y el
// respaldo al cuerpo en español cuando no lo hay—, porque el segundo es el que
// tiene que seguir funcionando para las veinte versiones anteriores.
console.log('\nel cartel de actualización pide su idioma');
{
  const { consultar } = await import('../src/actualizar.js');
  const original = globalThis.fetch;
  const respuesta = (obj) => ({ ok: true, json: async () => obj, text: async () => obj });

  const conAdjuntos = (assets) => async (url) => {
    if (String(url).includes('/releases/latest')) {
      return respuesta({
        tag_name: 'v9.9.9', html_url: 'https://ejemplo/9.9.9',
        body: 'CUERPO EN ESPAÑOL, el de siempre, que tiene que servir de respaldo.',
        assets,
      });
    }
    if (String(url).endsWith('.md')) {
      const lang = String(url).match(/9\.9\.9\.([a-z]{2})\.md$/)?.[1];
      return respuesta(`NOTAS EN ${lang.toUpperCase()}, con texto de sobra para pasar el mínimo.`);
    }
    return respuesta('sha512: loquesea');
  };

  const adjuntos = ['es', 'en', 'de', 'fr', 'pt'].map((l) => ({
    name: `9.9.9.${l}.md`, browser_download_url: `https://ejemplo/9.9.9.${l}.md`,
  }));

  try {
    globalThis.fetch = conAdjuntos(adjuntos);
    const de = await consultar('x/y', '1.0.0', 'de');
    ok(de?.notas?.includes('NOTAS EN DE'), 'con adjunto alemán, salen las notas alemanas', de?.notas?.slice(0, 20));
    ok(de?.notasIdioma === 'de', 'y se sabe de dónde salieron', de?.notasIdioma);

    const pt = await consultar('x/y', '1.0.0', 'pt');
    ok(pt?.notas?.includes('NOTAS EN PT'), 'y en portugués, las portuguesas');

    // El respaldo: una versión antigua sin adjuntos de nadie.
    globalThis.fetch = conAdjuntos([]);
    const viejo = await consultar('x/y', '1.0.0', 'de');
    ok(viejo?.notas?.includes('CUERPO EN ESPAÑOL'),
      'SIN adjunto, el cartel cae al cuerpo de la release y NO se queda vacío');
    ok(viejo?.notasIdioma === null, 'y lo dice', String(viejo?.notasIdioma));

    // Un adjunto que existe pero llega vacío tampoco puede dejar el cartel mudo.
    globalThis.fetch = async (url) => (String(url).endsWith('.md')
      ? respuesta('   ')
      : conAdjuntos(adjuntos)(url));
    const vacio = await consultar('x/y', '1.0.0', 'de');
    ok(vacio?.notas?.includes('CUERPO EN ESPAÑOL'), 'un adjunto vacío también cae al cuerpo');
  } finally { globalThis.fetch = original; }
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
