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

/**
 * ── UNA VERSIÓN NUEVA SIN INSTALADOR NO SE OFRECE ─────────────────────────
 *
 * El caso real: la v1.16.0, marcada como la última con sus cinco
 * `.md` subidos y sin el `.exe`. El cartel salía entero, con un botón que ponía
 * «Descargar» y llevaba a una página sin nada que descargar.
 *
 * SE PRUEBAN LOS CUATRO ESTADOS, no sólo el que bloquea. Una guarda probada
 * sólo por su lado malo pasa verde aunque se haya tragado los otros tres, y
 * aquí los otros tres son justo lo que no se puede romper: quien sí puede
 * actualizar tiene que seguir enterándose. Sobre todo el del enlace manual, que
 * también tiene `descargable` en falso y NO es este caso.
 */
{
  console.log('\nel cartel no ofrece lo que no existe');
  const { consultar } = await import('../src/actualizar.js');
  const original = globalThis.fetch;
  const respuesta = (obj) => ({ ok: true, json: async () => obj, text: async () => obj });
  const exe = { name: 'EQL-Parse-9.9.9-setup.exe', browser_download_url: 'https://ejemplo/e.exe', size: 78 };
  const yml = { name: 'latest.yml', browser_download_url: 'https://ejemplo/latest.yml' };

  const con = (assets, tag = 'v9.9.9') => async (url) => (String(url).includes('/releases/latest')
    ? respuesta({ tag_name: tag, html_url: 'https://ejemplo/r', body: 'notas de sobra para el cartel', assets })
    : respuesta('sha512: loquesea'));

  try {
    globalThis.fetch = con([exe, yml]);
    const bien = await consultar('x/y', '1.0.0', 'es');
    ok(bien?.estado === 'descargable', 'con .exe y sha512 se ofrece entera', bien?.estado);
    ok(bien?.descargable === true, 'y `descargable` sigue diciendo lo suyo');

    // El enlace manual: `descargable` en falso y SÍ hay algo que descargar.
    globalThis.fetch = con([exe]);
    const enlace = await consultar('x/y', '1.0.0', 'es');
    ok(enlace?.estado === 'enlace', 'sin latest.yml queda el enlace manual, que es correcto', enlace?.estado);
    ok(enlace?.descargable === false && enlace?.exeUrl,
      'y ese caso tiene exe aunque no sea instalable desde dentro');

    // El de la v1.16.0: hay versión, hay notas, y no hay nada que bajar.
    globalThis.fetch = con([{ name: '9.9.9.es.md', browser_download_url: 'https://ejemplo/n.md' }]);
    const roto = await consultar('x/y', '1.0.0', 'es');
    ok(roto?.estado === 'sin-instalador', 'sin .exe se dice, y no se confunde con el enlace', roto?.estado);
    ok(roto?.exeUrl === null && roto?.bytes === 0, 'y no hay nada que ofrecer');

    // Y el cero de siempre, que tiene que seguir siendo un cero.
    globalThis.fetch = con([exe, yml], 'v1.0.0');
    ok((await consultar('x/y', '1.0.0', 'es')) === null, 'sin versión nueva no se devuelve nada');
  } finally { globalThis.fetch = original; }
}

/**
 * ── NOTAS ESCRITAS PARA UNA VERSIÓN QUE NUNCA SE PUBLICÓ ──────────────────
 *
 * Lo que se comprueba aquí es LA REGLA, sin red: la comprobación de verdad sólo
 * puede hacerla `web:build`, que es quien habla con GitHub. Pero la regla tiene
 * dos mitades que se pueden equivocar solas —cuándo calla y cuándo no— y ésas
 * sí se prueban en frío.
 *
 * El caso real: la v1.13.0 no llegó a existir como release, con sus cinco `.md`
 * escritos y todo el mundo seis días en la 1.12.0. Ver `web/huerfanas.mjs`.
 */
{
  console.log('\nnotas sin release');
  const os = await import('node:os');
  const { notasHuerfanas } = await import('../web/huerfanas.mjs');
  const dir = fs.mkdtempSync(path.join(os.default.tmpdir(), 'notas-'));
  for (const f of ['1.12.0.es.md', '1.13.0.es.md', '1.13.0.de.md', '1.14.0.es.md']) {
    fs.writeFileSync(path.join(dir, f), 'x');
  }
  const publicadas = [{ tag: 'v1.12.0' }];

  // Primera construcción: la de hoy todavía no existe, y es correcto que así sea.
  ok(notasHuerfanas(publicadas, '1.14.0', dir).length === 0,
    'en la primera construcción calla: la release de hoy aún no existe por diseño');

  // Segunda: ya existe la de hoy, así que se exige que estén TODAS.
  const h = notasHuerfanas([{ tag: 'v1.14.0' }, ...publicadas], '1.14.0', dir);
  ok(h.length === 1 && h[0] === '1.13.0',
    'en la segunda, señala la versión con notas y sin release', h.join(', '));

  ok(notasHuerfanas([{ tag: 'v1.14.0' }, { tag: 'v1.13.0' }, ...publicadas], '1.14.0', dir).length === 0,
    'y calla en cuanto esa versión tiene la suya');

  // Un solo idioma escrito cuenta igual: alguien redactó para alguien.
  fs.rmSync(path.join(dir, '1.13.0.es.md'));
  ok(notasHuerfanas([{ tag: 'v1.14.0' }, ...publicadas], '1.14.0', dir)[0] === '1.13.0',
    'con un solo idioma escrito también salta');
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
