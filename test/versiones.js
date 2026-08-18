/**
 * LAS DOS POBLACIONES DE RELEASES, Y EL ORDEN EN QUE SE SEPARAN.
 *
 * ── POR QUÉ DOS Y NO UNA CON UN FILTRO ────────────────────────────────────
 *
 * `web/build.mjs` hacía UNA lista, `limpio`, y la usaban dos guardas que NO
 * preguntan lo mismo:
 *
 *   · la portada, el botón, el número de versión, el tamaño y las novedades
 *     preguntan «¿qué debe ver el usuario?» — un prelanzamiento NO cuenta;
 *   · `exigirNotasPublicadas` pregunta «¿hay una release que respalde estas
 *     notas?» — un prelanzamiento SÍ las respalda. Una nota huérfana es una
 *     nota sin NINGUNA release detrás, no una sin release definitiva.
 *
 * Una lista sola tenía que estar equivocada para una de las dos. Ahora son
 * `todas` y `publicadas`, con su nombre, y lo que se prueba aquí es que cada
 * una dice lo suyo.
 *
 * ── Y LA RESTRICCIÓN DE ORDEN, que es la mitad cara ───────────────────────
 *
 * El filtro va DESPUÉS DEL BUCLE y DESPUÉS DE LAS GUARDAS DE SATURACIÓN, nunca
 * por página. La saturación compara `pagina.length === POR_PAGINA` contra el
 * TAMAÑO CRUDO: una página de cien con tres prelanzamientos, filtrada antes,
 * trae noventa y siete, deja de parecer llena y la guarda deja de saltar. Sin
 * ruido, sin salida distinta de cero, y con dieciocho versiones perdidas otra
 * vez — que es exactamente el fallo que trajo la paginación.
 *
 * UNA RESTRICCIÓN DE ORDEN QUE NO ESTÁ EN UN TEST ES UN COMENTARIO CON LOS DÍAS
 * CONTADOS. Aquí se monta esa página y se exige que la guarda salte Y que diga
 * CIEN, porque saltar diciendo noventa y siete ya sería el filtro adelantado.
 *
 * ── SIN RED Y SIN TOCAR EL DISCO ──────────────────────────────────────────
 *
 * `releases()` se conduce con un `fetch` de mentira. Los cuatro casos paran en
 * una guarda, así que ninguno llega a escribir `web/releases.json` — y eso no
 * se da por supuesto: al final se comprueba que el fichero está como estaba.
 * Importar `build.mjs` ya destrozó una vez esa copia; aquí se le entra a
 * propósito, y por eso la comprobación va.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esPublicada, releases } from '../web/build.mjs';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPIA = path.join(RAIZ, 'web', 'releases.json');
const antes = fs.existsSync(COPIA) ? fs.readFileSync(COPIA, 'utf8') : null;

// ── 1. La regla, a solas ───────────────────────────────────────────────────
console.log('\nqué cuenta como publicada');
{
  ok(esPublicada({ draft: false, prerelease: false }) === true, 'una definitiva, sí');
  ok(esPublicada({ draft: false, prerelease: true }) === false, 'un prelanzamiento, NO');
  ok(esPublicada({ draft: true, prerelease: false }) === false, 'un borrador, NO');
  ok(esPublicada({ draft: true, prerelease: true }) === false, 'y los dos a la vez, tampoco');
}

// ── 2 a 5. `releases()` conducida con un fetch de mentira ──────────────────
const rel = (tag, extra = {}) => ({
  tag_name: tag,
  name: tag,
  published_at: '2026-08-18T00:00:00Z',
  body: 'unas notas cualesquiera',
  html_url: `https://ejemplo/${tag}`,
  assets: [{ name: `EQL-Parse-${tag}-setup.exe`, size: 78, browser_download_url: `https://ejemplo/${tag}.exe` }],
  draft: false,
  prerelease: false,
  ...extra,
});

const original = globalThis.fetch;
const tokenAntes = process.env.GITHUB_TOKEN;
const hablar = console.log;

/**
 * Devuelve el MENSAJE de la guarda que saltó, o `null` si no saltó ninguna.
 *
 * `null` es un resultado del que hay que desconfiar en todos los casos de aquí
 * abajo: los cuatro tienen que parar, y el que no pare es el que ha perdido la
 * guarda. La línea de «API de GitHub: autenticada» se calla mientras tanto para
 * que no se cuele entre los `ok`.
 */
const guarda = async (items, link) => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => items,
    headers: { get: (k) => (String(k).toLowerCase() === 'link' ? link ?? null : null) },
  });
  console.log = () => {};
  try { await releases(); return null; } catch (e) { return e.message; } finally { console.log = hablar; }
};

try {
  process.env.GITHUB_TOKEN = 'de-mentira';

  /**
   * ── LA RESTRICCIÓN DE ORDEN ────────────────────────────────────────────
   *
   * Cien justas —el techo que se pide— y tres prelanzamientos dentro, sin
   * cabecera `link`. La guarda de saturación tiene que verla llena.
   *
   * HACEN FALTA LOS DOS `ok`, y no por simetría: las inversiones plausibles se
   * repartieron entre ellos al probarlas de verdad, una en cada uno.
   *
   *   · `j.push(...pagina.filter(esPublicada))` — `pagina` sigue siendo la
   *     cruda, así que `mudo` SÍ se enciende y la guarda SÍ salta. Lo único que
   *     delata el cambio es que cuenta 97: lo caza el segundo `ok`, y el
   *     primero pasa tan contento.
   *   · `const pagina = (await r.json()).filter(esPublicada)` — ahora son 97
   *     desde el principio, `mudo` no se enciende, no hay `link` que seguir y
   *     NO SALTA NADA: lo caza el primero.
   */
  console.log('\nel filtro va después de la guarda de saturación');
  {
    const cien = Array.from({ length: 100 }, (_, i) => rel(`v9.${i}.0`,
      { prerelease: i === 3 || i === 40 || i === 99 }));
    const m = await guarda(cien, null);
    ok(m !== null, 'una página llena de 100 con tres prelanzamientos SÍ para la construcción',
      m === null ? 'no saltó ninguna guarda: el filtro se ha adelantado al bucle' : 'salta');
    ok(!!m && m.includes('100 versiones'), 'y la guarda cuenta CIEN, el tamaño crudo, no 97',
      m?.match(/se han recibido (\d+) versiones/)?.[1] ?? '(no lo dice)');
  }

  /**
   * ── LOS DOS CEROS, Y QUE NO COMPARTAN FRASE ────────────────────────────
   *
   * Se arreglan de dos maneras distintas —mirar el repositorio y el token, o
   * marcar definitiva la que toque—, así que una frase para los dos sería
   * mentira la mitad de las veces.
   */
  console.log('\nlos dos ceros dicen cosas distintas');
  {
    const vacia = await guarda([], null);
    const ninguna = await guarda([
      rel('v1.16.0', { prerelease: true }),
      rel('v1.15.0', { draft: true }),
      rel('v1.14.0', { prerelease: true }),
    ], null);

    ok(!!vacia && vacia.includes('CERO versiones'),
      'sin ninguna release, «la API contestó con CERO versiones»', vacia?.slice(0, 48));
    ok(!!ninguna && ninguna.includes('NINGUNA publicada'),
      'con releases y todas sin sello, «ninguna publicada»', ninguna?.slice(0, 60));
    ok(!!ninguna && ninguna.includes('3 versiones'),
      'y dice CUÁNTAS hay, contadas sobre `todas`: las tres que la web no enseña');
    ok(!!vacia && !!ninguna && !ninguna.includes('CERO versiones'),
      'el segundo cero NO se disfraza del primero');
  }

  /**
   * ── QUIÉN ES «LA MÁS NUEVA» PARA EL USUARIO ────────────────────────────
   *
   * El caso de hoy, tal cual: la 1.16.0 en prelanzamiento y la 1.15.0 detrás.
   * La guarda del instalador mira `publicadas[0]`, así que decir qué versión
   * nombra es decir cuál de las dos listas está leyendo la portada. Se le quita
   * el .exe a la 1.15.0 justo para que hable.
   */
  console.log('\nla portada mira las publicadas, no todas');
  {
    const m = await guarda([
      rel('v1.16.0', { prerelease: true }),
      rel('v1.15.0', { assets: [] }),
      rel('v1.14.0'),
    ], null);
    ok(!!m && m.includes('v1.15.0'), 'la guarda del instalador nombra la 1.15.0', m?.slice(0, 60));
    ok(!!m && !m.includes('v1.16.0'),
      'y NO la 1.16.0, que está en `todas` pero no en `publicadas`');
  }
} finally {
  globalThis.fetch = original;
  if (tokenAntes === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = tokenAntes;
}

/**
 * ── 6. Y QUE NADA DE LO ANTERIOR HAYA TOCADO LA COPIA ─────────────────────
 *
 * No es celo: PASÓ MIENTRAS SE ESCRIBÍA ESTO. Probando la contraprueba —el
 * filtro adelantado al bucle— la página de cien dejó de parar en ninguna
 * guarda, `releases()` siguió hasta el final y escribió noventa y siete
 * versiones de mentira en `web/releases.json`. Justo el fallo que ya se pagó
 * una vez importando `build.mjs` desde una consola.
 *
 * Así que esto DETECTA Y REPARA. Quien rompa el orden un martes cualquiera se
 * va a encontrar el test en rojo, y ése es el trabajo del test; lo que no puede
 * encontrarse además es la copia buena machacada por haberlo ejecutado.
 */
console.log('\nprobar esto no reescribe la copia guardada');
{
  const despues = fs.existsSync(COPIA) ? fs.readFileSync(COPIA, 'utf8') : null;
  const igual = despues === antes;
  if (!igual && antes !== null) fs.writeFileSync(COPIA, antes);
  ok(igual, 'web/releases.json está exactamente como estaba',
    igual ? `${antes === null ? 'no existe' : `${antes.length} caracteres`}`
      : 'LA ESCRIBIÓ alguna guarda que ya no para — restaurada, pero mira el orden del filtro');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
