/**
 * Construye la web estática de eqlparse.com.
 *
 * SIN DEPENDENCIAS, como el resto del proyecto: lee, arma cadenas y escribe.
 *
 * DE DÓNDE SALE CADA COSA, que es lo que evita que la web y la aplicación
 * cuenten cosas distintas:
 *
 *   Los nombres de las funciones      `src/i18n.js`, el diccionario de la app
 *   Las novedades                     la API de GitHub, al construir
 *   Las capturas                      `docs/`, las mismas de los README
 *   La muestra del reproductor        la que genera `npm run ui:gif`
 *   La versión y el tamaño            la última release
 *
 * LAS NOVEDADES NO SE COPIAN A MANO. Las notas de versión ya están escritas en
 * las releases —es lo que ve quien descarga— y `notas/` está en el .gitignore
 * porque son borradores. Dos copias de lo mismo divergen, así que se piden a la
 * API al construir y quedan horneadas en el HTML: sin llamadas desde el
 * navegador de nadie y sin límites de peticiones.
 *
 * Y SI GITHUB NO RESPONDE AL DESPLEGAR, no se cae el despliegue: se usa la
 * copia guardada de la última vez. Una web sin la página de novedades por un
 * fallo de red de treinta segundos sería absurda.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { IDIOMAS, CON_PROSA, NOMBRE_IDIOMA, T, FUNCIONES } from './textos.js';
import { setLang, t } from '../src/i18n.js';
import { sustituirRotulos } from './rotulos.mjs';
// La red que faltaba: notas escritas para una versión que nunca se publicó.
import { exigirNotasPublicadas } from './huerfanas.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PROY = path.join(RAIZ, '..');
const DIST = path.join(RAIZ, 'dist');
const CACHE = path.join(RAIZ, 'releases.json');
const REPO = 'infinityl111/eql-parse';
const DOMINIO = 'https://eqlparse.com';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Qué imagen va en cada página, en este orden de preferencia:
 *
 *   1. `docs/i18n/<lang>/x.png`  la aplicación EN EL IDIOMA DE LA PÁGINA
 *   2. `docs/x.webp`             la versión ligera, si `web:webp` la hizo
 *   3. `docs/x.png`              lo que haya
 *
 * LO PRIMERO ES LO QUE IMPORTA. La portada española enseñaba la aplicación en
 * inglés en las cinco páginas: el mismo defecto que el párrafo incrustado en
 * la muestra. Y enseñar la aplicación en el idioma de quien lee demuestra que
 * está traducida, que convence bastante más que escribir que lo está.
 *
 * Lo segundo es sólo para la foto del juego: `docs/overlay.png` son 2,9 MB de
 * PNG para un contenido fotográfico, y en WebP baja a 312 KB. No tiene versión
 * por idioma porque es una captura del juego, no de la interfaz. El PNG sigue
 * ahí porque es el que enlazan los README de GitHub.
 *
 * Y si nadie ha ejecutado `ui:docs` ni `web:webp`, la web se construye igual
 * con lo que haya: en inglés y pesada, pero construye.
 *
 * @returns {string} ruta relativa dentro de `docs/`, que se conserva en `img/`
 */
function paraWeb(fichero, lang) {
  const porIdioma = path.posix.join('i18n', lang, fichero);
  if (fs.existsSync(path.join(PROY, 'docs', porIdioma))) return porIdioma;
  const webp = fichero.replace(/\.png$/, '.webp');
  return fs.existsSync(path.join(PROY, 'docs', webp)) ? webp : fichero;
}

/**
 * LA IMAGEN DE LA CABECERA, y por qué es ésta y no la tabla de daño.
 *
 * Quien llega buscando «EQ log parser» ya da por supuesto que esto cuenta
 * daño: la portada de cualquier medidor es una tabla de DPS, así que enseñar
 * otra contesta la mitad que nadie preguntaba. Lo que hay que contestar es por
 * qué no le vale el que ya tiene.
 *
 * El bloque de postura lo contesta sin leerlo entero: dice cuánto habría
 * evitado cada una y —esto es lo que lo hace creíble— lo que cuesta en aguante
 * y en maná. Un consejo que sólo tiene ventajas no se lo cree nadie.
 *
 * Va recortado al bloque y no a la pantalla entera: a ancho de página, una
 * captura de 1500 píxeles con hallazgos, fases y barras no se lee en diez
 * segundos, y diez segundos es lo que hay.
 */
const PRUEBA = 'postura.png';

/**
 * Y LA OTRA CARA, más abajo: el mismo bloque en una pelea donde el consejo dice
 * que NO cambies.
 *
 * Debajo del subtítulo «te dice qué cambiar», una tabla que dice que no cambies
 * desconcierta. Junto a las capturas es otra cosa: la prueba más fuerte de que
 * el consejo no está vendiendo nada, porque calcula la diferencia y te dice que
 * te quedes como estás. Una mejora la enseña cualquiera; decir «aquí no hace
 * falta» sólo lo dice quien ha medido.
 */
const CONTRAPRUEBA = 'postura-nocambiar.png';

/** Las capturas que se enseñan, con la clave de su pie en el diccionario. */
const CAPTURAS = [
  { fichero: 'combate.png', clave: 'tab.combat' },
  { fichero: 'analisis.png', clave: 'an.button' },
  { fichero: 'enciclopedia.png', clave: 'tab.encyclopedia' },
  { fichero: 'overlay.png', clave: 'ov.session' },
];

// ── Las novedades ───────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SI NO SE PUEDE PREGUNTAR POR LAS VERSIONES, NO SE CONSTRUYE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     UN CERO DE «NO HAY NOVEDADES» Y UN CERO DE «NO HE PODIDO PREGUNTAR» SE
 *     ESCRIBEN IGUAL. Aquí el que se lo come es quien entra a descargar.
 *
 * Esto devolvía la copia guardada cuando la API fallaba, y una lista VACÍA
 * cuando no había copia — y la construcción seguía y escribía las veinte
 * páginas. Con la API en 503 eso es un sitio publicado sin lista de versiones y
 * sin enlaces de descarga, en silencio y con salida 0 detrás.
 *
 * Ahora se para. La copia de `releases.json` se sigue escribiendo porque es un
 * registro útil, pero NO sirve de respaldo para construir: unos datos viejos y
 * unos buenos se ven igual en la página, que es la razón de todo esto. Y se
 * escribe SÓLO después de las comprobaciones, para que una respuesta mala no se
 * lleve por delante la copia buena.
 *
 * SE COMPRUEBAN CUATRO CEROS, no uno:
 *
 *   · no se pudo preguntar — red caída, 503, lo que sea;
 *   · cero versiones — la API contestó, pero con la lista vacía;
 *   · cero PUBLICADAS con la lista NO vacía — hay releases y todas son borrador
 *     o prelanzamiento. Es otro cero y lleva otra frase, porque lo que hay que
 *     arreglar es otro: ver «dos poblaciones», más abajo;
 *   · la más nueva publicada sin instalador — el botón de descarga cae a la
 *     página de la release y `bytes` sale 0. Pasa de verdad entre crear la
 *     release y subir el .exe, y desde fuera se ve como una descarga que no
 *     descarga.
 */
/**
 * EL TOKEN DE GITHUB, Y SIN ÉL NO SE CONSTRUYE.
 *
 * Sin autenticar, la API da 60 peticiones por hora POR IP. Publicar hace dos
 * construcciones, cada una pregunta, y esa misma IP la comparten el navegador,
 * el actualizador y cualquier otra cosa que mire GitHub: 44 de 60 restantes un
 * martes cualquiera. Autenticado son 5.000.
 *
 * Y NO SE CAE AL MODO ANÓNIMO SI FALTA. Sería el mismo cero de dos significados
 * de siempre: la construcción funcionaría hoy, se agotaría el cupo un día de
 * publicación, la API contestaría con su objeto de «rate limit exceeded», y el
 * motivo real —«nadie puso el token»— estaría a dos capas de distancia. Mejor
 * parar aquí, donde la frase cabe en una línea.
 *
 * De dónde sale, en este orden: `GITHUB_TOKEN`, `GH_TOKEN`, y lo que dé
 * `gh auth token` — que es lo que ya hay en la máquina de quien publica.
 *
 * @returns {{ token: string, de: string }}
 */
function tokenGitHub() {
  for (const nombre of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const v = process.env[nombre];
    if (v && v.trim()) return { token: v.trim(), de: nombre };
  }
  try {
    // stdio sin heredar: si `gh` pide iniciar sesión, que falle en vez de
    // quedarse esperando a alguien que no está mirando.
    const t = execFileSync('gh', ['auth', 'token'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (t) return { token: t, de: 'gh auth token' };
  } catch { /* gh no está instalado, o no ha iniciado sesión */ }
  throw new Error('no hay token de GitHub y sin él la API da 60 peticiones por hora'
    + ' para toda la máquina, que se agotan justo el día que se publica.'
    + ' Pon GITHUB_TOKEN, o inicia sesión con `gh auth login`.'
    + ' No se construye en modo anónimo a propósito: el día que fallara, el motivo'
    + ' no se distinguiría de «GitHub no contesta».');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SE PIDEN TODAS, NO LAS PRIMERAS QUE QUEPAN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esto pedía `per_page=20` y se quedaba con lo que viniera. El 20 nunca fue una
 * cuenta: era EL TECHO QUE PEDÍAMOS, y salía impreso —«20 versiones desde la
 * API»— con la misma cara que si lo fuera. Había 38. Las dieciocho más viejas
 * no tenían página en la web, y nadie lo notó porque el número cuadraba consigo
 * mismo: pides veinte, recibes veinte, escribes veinte.
 *
 *     UN TECHO QUE SE CUMPLE Y UNA CUENTA QUE COINCIDE SE ESCRIBEN IGUAL.
 *
 * Es el mismo cero de dos significados de todo este fichero, con otro número.
 *
 * Ahora se pide de cien en cien y se sigue la cabecera `link` mientras anuncie
 * un `rel="next"`. NO HAY NINGUNA CANTIDAD DE VERSIONES ESCRITA AQUÍ: si mañana
 * hay una más, sale una más, sin tocar nada.
 *
 * ── LA GUARDA DE SATURACIÓN, que es la que faltaba ────────────────────────
 *
 * Paginar solo no basta, porque el fallo no era paginar poco: era no poder
 * distinguir «hay justo estos» de «hay más y no me lo dicen». Eso sigue vivo
 * con cualquier tamaño de página, así que se comprueba, en dos formas:
 *
 *   · una página llena Y SIN cabecera `link` ninguna — nadie nos dice si hay
 *     más, y justo esa es la respuesta que no sabemos leer;
 *   · el bucle termina con la última página llena y un `rel="next"` todavía
 *     anunciado — nos hemos parado antes que la API.
 *
 * En los dos casos se para. Una lista que a lo mejor está recortada, publicada
 * como si fuera entera, es la avería de arriba otra vez.
 *
 * `MAX_PAGINAS` NO ES UN TECHO DE VERSIONES: son 5.000, y es el detector de
 * bucle que necesita cualquier `while` que siga una URL que llega de fuera. Si
 * se alcanzara, no se recorta en silencio — salta la guarda de saturación, que
 * es exactamente para lo que está.
 */
const POR_PAGINA = 100;
const MAX_PAGINAS = 50;

/**
 * QUÉ CUENTA COMO PUBLICADA, sobre el objeto CRUDO de la API.
 *
 * Un borrador no lo ve nadie de fuera. Un prelanzamiento sí se ve, pero se
 * publica a propósito sin anunciarlo: es lo que se sube para probar el
 * instalador antes de marcarlo definitivo. Ninguno de los dos va a la web.
 *
 * Se pregunta por `draft` y `prerelease` —los nombres de la API— porque el
 * filtro se hace ANTES de normalizar, sobre lo que llegó tal cual.
 */
export const esPublicada = (x) => !x?.draft && !x?.prerelease;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TECHO DEL CUERPO DE UNA NOTA. NO RECORTA: PARA.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AQUÍ HABÍA UN 6.000 A PELO, escrito dos veces —el `slice` y el aviso—, sin
 * constante y sin una línea que dijera de dónde salía. No salía de ningún
 * sitio: no es un límite de GitHub ni del HTML ni del navegador, es un número
 * que alguien escribió una tarde. Y cortaba de verdad: DOCE versiones pasadas
 * de raya, NUEVE de ellas saliendo recortadas en la página, 42.431 caracteres
 * perdidos, y la peor dejándose el 64 % de su nota.
 *
 * El corte era mudo donde importa. Avisaba en la consola de quien construye
 * —que ya sabe lo que ha escrito— y en la página no se veía nada: la nota se
 * acaba a mitad de frase y parece que acababa ahí. Quien lo paga es quien lee.
 *
 *     UN NÚMERO QUE NADIE SABE DE DÓNDE SALIÓ NO SE NEGOCIA, SE RETIRA.
 *
 * Así que no se sube a doce mil: se quita el recorte y en su lugar queda esto,
 * que es lo contrario de un límite editorial. Es una guarda de seguridad, alta
 * a propósito: doscientos mil caracteres son treinta y tres veces la nota más
 * larga que hemos escrito nunca. Nadie la va a rozar escribiendo; sólo la puede
 * tocar una respuesta de la API que se haya vuelto loca, y ése es justo el caso
 * en el que hornear el cuerpo entero en veinte páginas sale caro.
 *
 * Y MANDA SOBRE TODO LO QUE HAYA QUE DECIDIR CON ESTE NÚMERO. El fallo de fondo
 * no fue el 6.000: fue que estaba escrito dos veces. Dos copias del mismo
 * número son dos números que un día dirán cosas distintas —cambias el `slice`
 * y el aviso sigue midiendo por el viejo, y entonces recorta EN SILENCIO, que
 * es exactamente lo que este fichero lleva todo el rato intentando que no pase.
 */
export const TOPE_CUERPO = 200_000;

/** La URL de `rel="next"` de una cabecera `link`, si la trae. */
function siguientePagina(link) {
  for (const parte of String(link ?? '').split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="next"/.exec(parte);
    if (m) return m[1];
  }
  return null;
}

export async function releases() {
  const { token, de } = tokenGitHub();
  console.log(`  API de GitHub: autenticada (${de})`);
  let j = [];
  let paginas = 0;
  let ultima = 0;        // cuántas trajo la última página
  let pendiente = null;  // el `rel="next"` que quedó sin seguir, si quedó alguno
  let mudo = false;      // una página llena y sin `link`: nadie dice si hay más
  try {
    let url = `https://api.github.com/repos/${REPO}/releases?per_page=${POR_PAGINA}`;
    while (url && paginas < MAX_PAGINAS) {
      const r = await fetch(url, { headers: {
        'User-Agent': 'eqlparse-web',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      } });
      if (!r.ok) throw new Error(`GitHub devolvió ${r.status}`);
      const pagina = await r.json();
      // Que lo cuente la guarda de abajo, con su mensaje, como cuando no
      // paginábamos: aquí sólo se deja de acumular.
      if (!Array.isArray(pagina)) { j = pagina; break; }
      paginas++;
      ultima = pagina.length;
      const link = r.headers.get('link');
      pendiente = siguientePagina(link);
      if (pagina.length === POR_PAGINA && !link) mudo = true;
      j.push(...pagina);
      // El `Authorization` va en cada salto, así que la siguiente URL la manda
      // una cabecera y no nosotros: si no es de la API de GitHub, no se sigue.
      if (pendiente && new URL(pendiente).origin !== 'https://api.github.com') {
        throw new Error(`la cabecera «link» manda a ${new URL(pendiente).origin}, que no es la API`);
      }
      url = mudo ? null : pendiente;
    }
  } catch (err) {
    throw new Error(`no se pudo preguntar por las versiones: ${err.message}.`
      + ' La construcción se para aquí: un sitio sin lista de versiones y sin'
      + ' enlaces de descarga es peor que no desplegar. Inténtalo más tarde.');
  }
  if (!Array.isArray(j)) {
    // Cuando GitHub limita por peticiones contesta 200 con un objeto y su
    // motivo dentro. Sin enseñarlo, esto se lee como «no hay releases».
    throw new Error(`la API no devolvió una lista de versiones: ${j?.message ?? JSON.stringify(j).slice(0, 200)}`);
  }
  if (!j.length) {
    throw new Error('la API contestó con CERO versiones. O el repositorio no tiene'
      + ' releases, o la respuesta no es la que esperamos; en los dos casos la'
      + ' portada saldría sin descargas.');
  }
  // Y LA QUINTA: la lista puede estar recortada y no saberlo. Ver arriba.
  if (mudo) {
    throw new Error(`se han recibido ${j.length} versiones y una de las páginas trajo`
      + ` exactamente ${POR_PAGINA}, que es el techo que pedimos, SIN cabecera «link»`
      + ' que diga si hay más. Con esa respuesta no se distingue «hay justo ese'
      + ' número» de «hay más y no nos lo están diciendo». La construcción se para'
      + ' aquí: publicar una lista de versiones posiblemente recortada, con cara de'
      + ' entera, es peor que no desplegar.');
  }
  if (ultima === POR_PAGINA && pendiente) {
    throw new Error(`se han recibido ${j.length} versiones en ${paginas} páginas, que es`
      + ` el techo que pedimos (${MAX_PAGINAS} × ${POR_PAGINA}), y la API TODAVÍA anuncia`
      + ' otra página. Nos hemos parado antes que ella, así que faltan versiones y no'
      + ' sabemos cuántas. La construcción se para aquí: publicar una lista de versiones'
      + ' recortada, con cara de entera, es peor que no desplegar.');
  }
  /**
   * ═════════════════════════════════════════════════════════════════════════
   * DOS POBLACIONES, Y NO ES UN FILTRO: LAS DOS GUARDAS NO PREGUNTAN LO MISMO.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * Esto era UNA lista, `limpio`, haciendo dos trabajos. El nombre se muere
   * aquí a propósito: mientras hubiera una sola lista con un nombre que no dice
   * a cuál de las dos preguntas contesta, volvería a pasar.
   *
   *   · La portada, el botón de descarga, el número de versión, el tamaño y la
   *     lista de novedades preguntan «¿QUÉ DEBE VER EL USUARIO?». Un
   *     prelanzamiento NO cuenta: no se anuncia, no se ofrece y no se numera.
   *   · `exigirNotasPublicadas` pregunta «¿HAY UNA RELEASE QUE RESPALDE ESTAS
   *     NOTAS?». Un prelanzamiento SÍ las respalda. Una nota huérfana es una
   *     nota sin NINGUNA release detrás, no una sin release definitiva.
   *
   * Por eso salen las dos con su nombre y cada guarda lee la suya. `todas` es
   * la población entera y `publicadas` la que se enseña; «cruda» quiere decir
   * SIN FILTRAR, no sin normalizar — las dos llevan la misma forma, que es lo
   * que deja que `huerfanas.mjs` siga leyendo `tag` sin saber de dónde viene.
   *
   * ── DÓNDE VA EL FILTRO, que es una RESTRICCIÓN DE ORDEN ──────────────────
   *
   * DESPUÉS DEL BUCLE Y DESPUÉS DE LAS GUARDAS DE SATURACIÓN. Nunca por página:
   * la saturación compara `pagina.length === POR_PAGINA` contra el TAMAÑO
   * CRUDO. Una página de cien con tres prelanzamientos, filtrada antes, trae
   * noventa y siete: deja de parecer llena, y la guarda que existe justo para
   * distinguir «hay justo estos» de «hay más y no me lo dicen» deja de saltar
   * sin decir nada. Volveríamos a perder versiones, y otra vez en silencio.
   *
   * Y no se queda en comentario: `test/versiones.js` monta esa página de cien
   * con tres prelanzamientos y exige que la guarda salte Y que diga CIEN. Una
   * restricción de orden que no está en un test es un comentario con los días
   * contados.
   */
  const normalizar = (x) => ({
    tag: x.tag_name, nombre: x.name ?? x.tag_name, fecha: x.published_at,
    cuerpo: x.body ?? '', url: x.html_url,
    exe: (x.assets ?? []).find((a) => /\.exe$/i.test(a.name)) ?? null,
  });
  const conDescarga = (x) => ({ ...x, bytes: x.exe?.size ?? 0, descarga: x.exe?.browser_download_url ?? x.url });
  const todas = j.map(normalizar).map(conDescarga);
  const publicadas = j.filter(esPublicada).map(normalizar).map(conDescarga);

  /**
   * EL SEGUNDO CERO, y la razón de que no comparta frase con el de arriba.
   *
   * «La API contestó con cero versiones» y «hay versiones y ninguna publicada»
   * se arreglan de dos maneras distintas: la primera mirando si el repositorio
   * o el token están bien, la segunda marcando definitiva la que toque. Con una
   * sola frase para las dos, la mitad de las veces sería mentira.
   */
  if (!publicadas.length) {
    throw new Error(`la API contestó con ${todas.length} versiones y NINGUNA publicada:`
      + ' todas son borrador o prelanzamiento. La lista llegó bien —esto no es el'
      + ' cero de «no hay releases»—, pero no hay ninguna que enseñar: la portada'
      + ' saldría sin versión, sin tamaño y sin descarga. Marca definitiva la que'
      + ' toque y vuelve.');
  }

  /**
   * Y LA GUARDA QUE SUSTITUYE AL RECORTE. Ver `TOPE_CUERPO`.
   *
   * Mira `todas` y no `publicadas` — sí, es la otra pregunta de la casa, y
   * aquí la respuesta es la ancha a propósito: un prelanzamiento con el cuerpo
   * desbocado se marca definitivo unas horas después, y entonces el problema
   * aparecería A MITAD DE UNA PUBLICACIÓN en vez de hoy. Una parada de más un
   * martes cuesta un minuto; la misma parada el día que se publica, no.
   */
  const desbocadas = todas.filter((x) => x.cuerpo.length > TOPE_CUERPO)
    .map((x) => `${x.tag}: ${x.cuerpo.length.toLocaleString('es')} caracteres`);
  if (desbocadas.length) {
    throw new Error(`hay notas que pasan del techo de ${TOPE_CUERPO.toLocaleString('es')}`
      + ` caracteres: ${desbocadas.join('; ')}. Ese techo NO es un límite editorial —es`
      + ' treinta veces la nota más larga que hemos escrito— así que esto no es «te has'
      + ' pasado escribiendo»: o la API está devolviendo algo que no es una nota, o hay'
      + ' un volcado ahí dentro. Antes esto se recortaba en silencio y la nota acababa a'
      + ' mitad de frase en la página. Ahora se para: mira ese cuerpo y decide tú.');
  }

  if (!publicadas[0].exe) {
    throw new Error(`la versión publicada más nueva (${publicadas[0].tag}) no trae instalador.`
      + ' El botón de descarga llevaría a la página de la release y el tamaño'
      + ' saldría en 0 bytes. Si estás publicando, sube el .exe y vuelve.');
  }
  // LA COPIA GUARDA LO PUBLICADO, que es lo que la web enseña. Un registro que
  // llevara los prelanzamientos diría otra cosa que la página que acompaña.
  await fsp.writeFile(CACHE, JSON.stringify(publicadas, null, 1));
  // El número de páginas va en la línea a propósito: es lo que deja ver que la
  // cuenta se ha agotado y no se ha topado con nada. Y las dos poblaciones van
  // juntas: la resta entre ellas es la cifra que si no habría que ir a buscar.
  console.log(`  novedades: ${todas.length} versiones desde la API`
    + ` (${paginas} ${paginas === 1 ? 'página' : 'páginas'} de ${POR_PAGINA}),`
    + ` ${publicadas.length} publicadas, la más nueva ${publicadas[0].tag}`);
  // Y CUÁLES se quedaron fuera, con su motivo. Sin esto, «38, 37 publicadas»
  // obliga a abrir GitHub para saber a cuál le falta el sello.
  const apartadas = j.filter((x) => !esPublicada(x))
    .map((x) => `${x.tag_name} (${x.draft ? 'borrador' : 'prelanzamiento'})`);
  if (apartadas.length) console.log(`  fuera de la web: ${apartadas.join(', ')}`);
  return { todas, publicadas };
}

/**
 * Markdown de una nota de versión a HTML.
 *
 * Deliberadamente pequeño: las notas usan párrafos, listas, `código`, negrita
 * y poco más. Un conversor completo sería una dependencia o trescientas líneas
 * para un texto que escribimos nosotros y cuya forma conocemos.
 *
 * LAS NOTAS VIENEN CORTADAS A LO ANCHO, que es como se escriben para leerlas en
 * un editor. Una línea NO es un párrafo: hay que juntar las seguidas antes de
 * nada. Si no, cada corte de línea sale como un párrafo aparte —con su hueco— y
 * lo que peor queda es que la negrita y los enlaces que cruzan el corte no se
 * convierten y salen los asteriscos crudos en la página.
 *
 * ── Y LOS BLOQUES ```, QUE SE SACAN ANTES QUE NADA ─────────────────────────
 *
 * Cuatro versiones publicadas traen volcados del medidor entre vallas —1.6.2 y
 * 1.1.0 con cuatro bloques cada una, 1.6.0 y 1.3.0 con dos—, y esto no sabía
 * que existían. Salían por el camino del párrafo normal, con dos destrozos a la
 * vez: el volcado entero pegado en un renglón —`junta.join(' ')` se come los
 * saltos, y con ellos las columnas— y las vallas MEDIO COMIDAS, porque la regex
 * del código en línea emparejaba el segundo acento con el tercero y dejaba los
 * otros dos a la vista: ``<code>…</code>``.
 *
 *     ES EL MISMO FALLO DE ORDEN QUE EL FILTRO Y LA GUARDA DE SATURACIÓN.
 *
 * Por eso los bloques se EXTRAEN ENTEROS antes de cualquier transformación, se
 * dejan en su sitio unas marcas que ninguna regex de aquí puede tocar, y sólo
 * al reconstruir la salida se reinserta el contenido —pasado por `esc()` y por
 * nada más—. Dentro de un bloque no hay negrita, ni enlaces, ni código en
 * línea, ni párrafos: hay lo que escribió quien lo escribió, con sus saltos.
 * Va en `test/vallas.js`, con el orden como aserción, porque una restricción de
 * orden que no está en un test es un comentario con los días contados.
 *
 * Y UNA VALLA SIN CERRAR PARA LA CONSTRUCCIÓN, nombrando la versión. Misma
 * doctrina que el resto: las notas las escribimos nosotros, así que es un error
 * nuestro y arreglable, y una nota destrozada en el sitio publicado es peor que
 * no desplegar. Sin esto, el resto del documento se tragaría dentro del bloque
 * y saldría en un `<pre>` gigante sin que nadie lo viera al construir.
 *
 * @param {string} s      el markdown de la nota
 * @param {string} quien  de quién es, para poder nombrarla si algo se rompe
 */
export function md(s, quien = 'unas notas sin identificar') {
  const lineas = String(s ?? '').replace(/\r/g, '').split('\n');

  /**
   * LA MARCA lleva \u0000 a los dos lados a propósito: `esc()` no lo toca —sólo
   * mira `&<>"`— y no hay ninguna regex de las de abajo que pueda casarlo. Una
   * marca hecha de caracteres normales («__BLOQUE0__») sí es alcanzable, y
   * entonces el arreglo tendría el mismo agujero que el fallo.
   */
  const MARCA = (i) => `\u0000BLOQUE${i}\u0000`;
  const bloques = [];
  const sinBloques = [];
  let dentro = null;      // las líneas del bloque abierto, si hay uno abierto
  let abiertaEn = 0;      // dónde se abrió, para poder decirlo
  for (let i = 0; i < lineas.length; i++) {
    const esValla = /^\s*```/.test(lineas[i]);
    if (esValla && dentro === null) {
      // La etiqueta de lenguaje —```js— se va con la línea de la valla: se
      // ignora y no se imprime.
      dentro = [];
      abiertaEn = i + 1;
      continue;
    }
    if (esValla) {
      bloques.push(dentro);
      sinBloques.push(MARCA(bloques.length - 1));
      dentro = null;
      continue;
    }
    (dentro ?? sinBloques).push(lineas[i]);
  }
  if (dentro !== null) {
    throw new Error(`${quien}: hay un bloque \`\`\` abierto en la línea ${abiertaEn} y SIN CERRAR.`
      + ` Lo que queda de la nota —${dentro.length} líneas— se iría dentro del bloque y saldría`
      + ' en un <pre> gigante. Las notas las escribimos nosotros, así que esto se arregla'
      + ' cerrando la valla; publicar la nota destrozada es peor que no desplegar.');
  }

  const out = [];
  /**
   * Las imágenes ANTES que los enlaces: la insignia de PayPal de las notas es
   * `[![texto](imagen)](destino)`, y al revés el enlace se come el `![` y
   * apunta a la imagen en vez de al destino.
   */
  const linea = (x) => esc(x)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

  let enLista = false;
  let junta = [];
  const cierra = () => {
    if (!junta.length) return;
    const texto = linea(junta.join(' '));
    out.push(enLista ? `<li>${texto}</li>` : `<p>${texto}</p>`);
    junta = [];
  };
  const cierraLista = () => { if (enLista) { out.push('</ul>'); enLista = false; } };

  for (const l of sinBloques) {
    /**
     * LA REINSERCIÓN, y por qué aquí y no con un `replace` al final de todo.
     *
     * Un `replace` sobre la salida ya montada metería el `<pre>` dentro del
     * `<p>` que lo envolvió por el camino, y `<p><pre>…</pre></p>` no es HTML
     * válido. Tomándolo como su propio bloque —cerrando antes párrafo y lista—
     * sale donde tiene que salir. Y el contenido pasa por `esc()` y por nada
     * más: ni negrita, ni enlaces, ni código en línea. Los saltos, tal cual.
     */
    const marca = /^\u0000BLOQUE(\d+)\u0000$/.exec(l);
    if (marca) {
      cierra();
      cierraLista();
      out.push(`<pre><code>${esc(bloques[Number(marca[1])].join('\n'))}</code></pre>`);
      continue;
    }
    if (!l.trim()) { cierra(); cierraLista(); continue; }
    const li = /^\s*[-*]\s+(.*)$/.exec(l);
    if (li) {
      cierra();
      if (!enLista) { out.push('<ul>'); enLista = true; }
      junta.push(li[1].trim());
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { cierra(); cierraLista(); out.push(`<h3>${linea(h[2])}</h3>`); continue; }
    junta.push(l.trim());   // continuación del párrafo o del punto anterior
  }
  cierra();
  cierraLista();
  return out.join('\n');
}

// ── La plantilla ────────────────────────────────────────────────────────────
function pagina({ lang, pag, titulo, descripcion, cuerpo, version }) {
  const tt = T[lang];
  const nav = [['inicio', ''], ['instalar', 'instalacion.html'],
    ['novedades', 'novedades.html'], ['mide', 'que-mide.html']];
  /**
   * `hreflang` para los cinco: es lo que le dice al buscador que son la misma
   * página en otro idioma en vez de cinco páginas que se hacen la competencia.
   * Sin esto, publicar en cinco idiomas puede posicionar peor que en uno.
   */
  const alternos = IDIOMAS.map((l) =>
    `<link rel="alternate" hreflang="${l}" href="${DOMINIO}/${l}/${pag}">`).join('\n  ')
    + `\n  <link rel="alternate" hreflang="x-default" href="${DOMINIO}/es/${pag}">`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${DOMINIO}/${lang}/${pag}">
${alternos}
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${DOMINIO}/${lang}/${pag}">
<link rel="stylesheet" href="../estilo.css">
<link rel="icon" href="../icon.png">
</head>
<body>
<header class="top">
  <a class="marca" href="./">EQL<span>·</span>Parse</a>
  <nav>${nav.map(([k, destino]) =>
    `<a href="./${destino}" class="${pag === (destino || 'index.html') ? 'on' : ''}">${esc(tt.nav[k])}</a>`).join('')}</nav>
  <div class="idiomas" title="${esc(tt.idioma)}">${IDIOMAS.map((l) =>
    `<a href="../${l}/${pag}" class="${l === lang ? 'on' : ''}" hreflang="${l}">${l}</a>`).join('')}</div>
</header>
<main>${cuerpo}</main>
<footer>
  <span>${esc(tt.pie)}</span>
  <a href="https://github.com/${REPO}">${esc(tt.verGithub)}</a>
  ${version ? `<span class="ver">v${esc(version)}</span>` : ''}
</footer>
</body>
</html>`;
}

const PAYPAL = 'https://paypal.me/eqcampeon';
const OTRO = 'https://mmorpgexperience.com';

/**
 * El aviso del otro proyecto, al final de la portada.
 *
 * Va DESPUÉS del cierre del café, que es el último sitio donde tiene sentido
 * hablar de otra cosa: quien ha llegado hasta ahí ya ha decidido sobre ésta.
 * Discreto y pequeño — es un aviso de al lado, no una segunda portada.
 *
 * El vídeo va MUDO y con póster: sin `muted` ningún navegador lo reproduce
 * solo, y sin póster hay un hueco hasta que llega el primer fotograma.
 *
 * LAS IMÁGENES SE RECOGEN SOLAS. Todo lo que haya en `web/promo/` que no sea el
 * vídeo ni su póster entra en la tira de abajo, por orden de nombre. Así se
 * añaden dejando ficheros en la carpeta, sin tocar esto.
 */
function avisoOtro(tt) {
  const dir = path.join(RAIZ, 'promo');
  if (!fs.existsSync(dir)) return '';
  /**
   * Las miniaturas, y NO sus versiones grandes: `-grande` no se lista, se
   * enlaza. Si entrara en la lista saldría ocho veces la misma tira.
   */
  const sueltas = fs.readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)
      && f !== 'apenao_poster.webp' && !/-grande\./i.test(f))
    .sort();
  /**
   * MITAD A CADA LADO DEL OGRO, y el reparto se calcula en vez de escribirse.
   *
   * Con cuatro son dos y dos. Con tres serían dos y una, y con cinco tres y
   * dos: el día que se añada o se quite una imagen no hay que tocar nada, que
   * es justo lo que se olvida.
   */
  const mitad = Math.ceil(sueltas.length / 2);
  /**
   * CADA CAPTURA ENLAZA A SU VERSIÓN GRANDE, no al sitio del juego.
   *
   * Estaban dentro del enlace a mmorpgexperience.com, así que pinchar una
   * captura te sacaba de la página en vez de enseñártela. Quien pincha una
   * imagen pequeña quiere verla; el que quiera ir al juego tiene el nombre y
   * la dirección justo debajo.
   *
   * Y enlaza a la GRANDE de verdad —1500 px— y no a la miniatura: la miniatura
   * está guardada a 232 de alto y se enseña a 112, así que abrirla sería verla
   * el doble, o sea nada.
   */
  const grandeDe = (f) => {
    const g = f.replace(/\.(webp|png|jpe?g|gif)$/i, '-grande.webp');
    return fs.existsSync(path.join(dir, g)) ? g : f;
  };
  const lado = (fs2) => (fs2.length ? `<span class="otro-lado">${fs2.map((f) =>
    `<a href="../promo/${esc(grandeDe(f))}" target="_blank" rel="noopener"
      ><img src="../promo/${esc(f)}" alt="" loading="lazy"></a>`).join('')}</span>` : '');

  return `<section class="otro">
    <div class="otro-fila">
      ${lado(sueltas.slice(0, mitad))}
      <a href="${OTRO}" rel="noopener" aria-label="Aetheria — ${esc(tt.otroLema)}"
        ><video class="otro-v" src="../promo/apenao_idle.webm" poster="../promo/apenao_poster.webp"
        width="84" height="112" autoplay muted playsinline preload="none" aria-hidden="true"></video></a>
      ${lado(sueltas.slice(mitad))}
    </div>
    <a class="otro-in" href="${OTRO}" rel="noopener">
      <span class="otro-t">
        <b class="eyebrow">${esc(tt.otroT)}</b>
        <b class="otro-n">Aetheria <i class="otro-a">${esc(tt.otroAlfa)}</i></b>
        <span class="otro-l">${esc(tt.otroLema)}</span>
        <span>${esc(tt.otroP)}</span>
        <span class="otro-u">mmorpgexperience.com</span>
      </span>
    </a>
  </section>
${GUION_ANIMACION}`;
}

/**
 * LA ÚNICA LÍNEA DE JAVASCRIPT DE TODA LA WEB, y por qué existe.
 *
 * El resto de la página no lleva ni una: los idiomas son enlaces, el aviso se
 * quitó de la esquina para no necesitar un botón de cerrar, y las novedades van
 * horneadas en el HTML. Pero un vídeo en bucle no se puede pausar desde CSS, y
 * un ogro moviéndose sin parar en la esquina de la vista se convierte en lo
 * único que se mira. Así que se mueve, se para, y vuelve a moverse cada diez o
 * veinte segundos — al azar, para que no se le vea el compás.
 *
 * Va aquí dentro y no en un fichero aparte: son ocho líneas, y un `<script src>`
 * sería una petición más para eso.
 *
 * SI NO HAY JAVASCRIPT, se reproduce una vez y se queda quieto. Sin `loop` en
 * la etiqueta, esa es la degradación natural y es la correcta: mejor quieto que
 * en bucle eterno.
 *
 * Y SI SE HA PEDIDO NO VER MOVIMIENTO, no se mueve nada: se queda en su póster.
 * `prefers-reduced-motion` no es una preferencia estética.
 */
const GUION_ANIMACION = `<script>
(function () {
  var v = document.querySelector('.otro-v');
  if (!v) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    v.removeAttribute('autoplay'); v.pause(); v.currentTime = 0; return;
  }
  var luego = function () { setTimeout(mueve, 10000 + Math.random() * 10000); };
  var mueve = function () {
    v.currentTime = 0;
    var p = v.play();
    if (p && p.catch) p.catch(luego);   // si el navegador lo rechaza, se reintenta
  };
  v.loop = false;
  v.addEventListener('ended', luego);
  mueve();
})();
</script>`;

/**
 * La taza, dibujada aquí y no traída de fuera.
 *
 * Un icono de una fuente o de un CDN es una petición a otro servidor por un
 * dibujo de quince píxeles, y de paso le cuenta a ese servidor quién visita la
 * página. Son cuatro trazos: se dibujan. Hereda el color con `currentColor`,
 * así que cambia con el tema y con el estado del botón sin una regla más.
 */
const TAZA = `<svg class="taza" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"
  fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3.5 8h11v4.2a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V8Z"/>
  <path d="M14.5 9.2h1.1a1.9 1.9 0 0 1 0 3.8h-1.1"/>
  <path d="M6.6 5.4V3.7M9.6 5.4V3.2M12.6 5.4V3.7"/>
</svg>`;

/**
 * La descarga, sola.
 *
 * El café estuvo aquí al lado y se quitó: en la cabecera, el único trabajo es
 * que se descargue. Dos botones juntos son dos decisiones donde debería haber
 * una, y la segunda ni siquiera es la que interesa. Sigue estando al final de
 * la página, después de haber leído lo que hay — que es cuando preguntar tiene
 * sentido.
 */
const botonDescarga = (tt, rel) => {
  const mb = rel?.bytes ? ` <span class="mb">${(rel.bytes / 1024 / 1024).toFixed(0)} MB</span>` : '';
  return `<div class="botones">
    <a class="boton" href="${esc(rel?.descarga ?? `https://github.com/${REPO}/releases/latest`)}">
      ${esc(tt.descargar)}${mb}</a>
  </div>`;
};

/**
 * Los umbrales de la muestra, escritos en el idioma de la página.
 *
 * Esta frase estaba DENTRO del PNG, y por tanto en el idioma en el que se
 * hubiera capturado: la portada española enseñaba un párrafo en inglés. Ahora
 * `bin/ui-gif.js` recorta la muestra sin ella y deja sus cifras medidas en un
 * fichero al lado; aquí se reescribe con `rp.reglas`, que es la MISMA clave
 * que usa la aplicación y ya existe en los cinco idiomas.
 *
 * Las cifras siguen siendo las medidas de esa pelea: lo que cambia de idioma
 * es la frase, no el dato.
 */
const DATOS_MUESTRA = (() => {
  const dir = path.join(process.env.TEMP ?? '/tmp', 'eql-ui-check');
  const f = path.join(dir, 'reproduccion.datos.json');
  const apng = path.join(dir, 'reproduccion.apng.png');
  try {
    /**
     * Las cifras y la imagen tienen que ser de la MISMA captura.
     *
     * `ui-gif` escribe primero las cifras y al final la imagen, así que las
     * cifras siempre son más viejas. Si salen más nuevas es que una captura
     * reventó a mitad y dejó cifras de una pelea con la imagen de otra: un pie
     * que describe una escena que no se está viendo, y nada que lo delate.
     * Antes que eso, sin pie.
     */
    if (fs.statSync(f).mtimeMs > fs.statSync(apng).mtimeMs) {
      console.log('  (las cifras de la muestra son de otra captura: la portada irá sin pie)');
      return null;
    }
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return null; }
})();

function reglasMuestra(lang) {
  if (!DATOS_MUESTRA) return '';
  setLang(lang);
  const num = (x) => Number(x).toLocaleString(lang);
  const frase = t('rp.reglas', { pico: num(DATOS_MUESTRA.pico), mediana: num(DATOS_MUESTRA.mediana) })
    + ' ' + t(DATOS_MUESTRA.conForma ? 'rp.reglasForma' : 'rp.reglasSinForma');
  return `<p class="pieMuestra">${esc(frase)}</p>`;
}

// ── Las cuatro páginas ──────────────────────────────────────────────────────
function portada(lang, publicadas) {
  const tt = T[lang];
  const rel = publicadas[0];
  /**
   * EL NOMBRE SALE DEL DICCIONARIO, LA DESCRIPCIÓN SE ESCRIBE AQUÍ.
   *
   * La segunda línea era también una clave de `src/i18n.js`, para no traducir
   * nada dos veces. Pero esas claves son rótulos de la interfaz —«ritmo»,
   * «Mediana», «sesión»—, y de rótulo suelto no sale una frase: la portada
   * decía «El registro · Mediana», que no explica nada a quien no conoce ya la
   * aplicación. El nombre sigue viniendo del diccionario; lo que se añade es
   * una línea escrita para leerse sola.
   */
  const funciones = FUNCIONES.map((f) => `<div class="tarjeta">
      <h3>${esc(t(f.clave))}</h3>
      <p>${esc(tt.desc[f.icono])}</p>
    </div>`).join('');
  /**
   * LAS CAPTURAS SE RECORTAN A LA MISMA FORMA, y se pueden abrir enteras.
   *
   * Sin esto, la rejilla la manda la más alta: `combate.png` mide 1500×1749 y
   * su celda estiraba la fila entera, dejando medio metro de hueco al lado del
   * análisis. Y a trescientos píxeles de ancho no se lee ni un rótulo de
   * ninguna de las cuatro, así que recortarlas no quita información: la que
   * hay se ve pinchando, que es donde de verdad se puede leer.
   */
  const capturas = CAPTURAS.filter((c) => fs.existsSync(path.join(PROY, 'docs', c.fichero)))
    .map((c) => {
      const f = paraWeb(c.fichero, lang);
      const pie = esc(tt.pies[c.fichero]);
      return `<figure><a href="../img/${f}" title="${pie}">
        <img src="../img/${f}" alt="${pie}" loading="lazy"></a>
      <figcaption>${pie}</figcaption></figure>`;
    }).join('');
  const hayMuestra = fs.existsSync(path.join(DIST, 'img', 'reproduccion.png'));
  const hayPrueba = fs.existsSync(path.join(PROY, 'docs', paraWeb(PRUEBA, lang)));
  const hayContra = fs.existsSync(path.join(PROY, 'docs', paraWeb(CONTRAPRUEBA, lang)));

  /**
   * LA REPRODUCCIÓN, LA ÚLTIMA — y estuvo la primera, que fue un error mío.
   *
   * La subí porque medí que cargaba rápido, y eso justificaba que se PUDIERA
   * poner arriba, no que DEBIERA. Puesta de primera después del titular le da
   * rango de tesis a una función: se lee como que la aplicación sirve para
   * repetir combates. Es una más, como la enciclopedia o el overlay, y va
   * entre las demás.
   *
   * Abajo recupera además `loading="lazy"`, así que sus 5,6 MB salen del
   * camino crítico: la primera pantalla baja de 6,5 MB a unos 200 KB.
   */
  const muestra = hayMuestra ? `<section>
    <h2>${esc(tt.reproductor)}</h2>
    <p class="ancho">${esc(tt.reproductorP)}</p>
    <img class="muestra" src="../img/reproduccion.png" alt="${esc(tt.reproductor)}" loading="lazy">
    ${reglasMuestra(lang)}
  </section>` : '';

  /**
   * EL ORDEN DICE QUÉ IMPORTA: afirmación, prueba, definición, lo demás.
   *
   * Antes empezaba definiéndose —«Qué es», con un párrafo— y acababa
   * demostrando. Y «Qué es» era un `<h2>` justo debajo de un `<h1>` que ya lo
   * había dicho: un escalón de más. Su párrafo se queda, sin encabezado,
   * después de la prueba, para quien quiera la descripción sobria.
   */
  return `<section class="hero">
    <h1>${esc(tt.tagline)}</h1>
    <p class="sub">${esc(tt.sub)}</p>
    <p class="alcance">${esc(tt.subMas)}</p>
    ${botonDescarga(tt, rel)}
    <p class="gratis">${esc(tt.gratis)}${rel ? ` · v${esc(rel.tag.replace(/^v/, ''))}` : ''}</p>
  </section>
  ${hayPrueba ? `<section class="prueba">
    <img src="../img/${paraWeb(PRUEBA, lang)}" alt="${esc(tt.pies[PRUEBA])}">
    <p class="pieMuestra">${esc(tt.pies[PRUEBA])}</p>
  </section>` : ''}
  <section>
    <p class="ancho">${esc(tt.queEsP)}</p>
  </section>
  <section>
    <h2>${esc(tt.funciones)}</h2>
    <div class="rejilla">${funciones}</div>
  </section>
  <section>
    <h2>${esc(tt.masT)}</h2>
    <div class="dos">
      <div><h3>${esc(tt.masVozT)}</h3><p class="ancho">${esc(tt.masVoz)}</p></div>
      <div><h3>${esc(tt.masEncT)}</h3><p class="ancho">${esc(tt.masEnc)}</p></div>
    </div>
  </section>
  <section class="dos">
    <div><h2>${esc(tt.privacidad)}</h2><p class="ancho">${esc(tt.privacidadP)}</p></div>
    <div><h2>${esc(tt.requisitos)}</h2><p class="ancho">${esc(tt.requisitosP)}</p></div>
  </section>
  <section>
    <h2>${esc(tt.capturas)}</h2>
    <div class="capturas">${capturas}</div>
    ${hayContra ? `<figure class="contra">
      <img src="../img/${paraWeb(CONTRAPRUEBA, lang)}" alt="${esc(tt.pies[CONTRAPRUEBA])}" loading="lazy">
      <figcaption>${esc(tt.pies[CONTRAPRUEBA])}</figcaption>
    </figure>` : ''}
  </section>
  ${muestra}
  <section class="cierre">
    <h2>${esc(tt.cierreT)}</h2>
    <p class="ancho">${esc(tt.cierreP)}</p>
    <div class="botones"><a class="boton cafe" href="${PAYPAL}" rel="noopener">${TAZA}
      ${esc(tt.cafe)} <span class="mb">PayPal</span></a></div>
  </section>
  ${avisoOtro(tt)}`;
}

function instalacion(lang, publicadas) {
  const tt = T[lang];
  return `<section><h1>${esc(tt.instalarT)}</h1>
    <p class="ancho">${esc(tt.instalarP)}</p>
    ${botonDescarga(tt, publicadas[0])}
    <ol class="pasos">
      <li>${esc(tt.paso1)}</li><li>${esc(tt.paso2)}</li>
      <li>${esc(tt.paso3)}</li><li>${esc(tt.paso4)}</li>
    </ol></section>
  <section><h2>${esc(tt.requisitos)}</h2><p class="ancho">${esc(tt.requisitosP)}</p></section>
  <section><h2>${esc(tt.privacidad)}</h2><p class="ancho">${esc(tt.privacidadP)}</p></section>`;
}

/**
 * Las notas de una versión en el idioma de la página, si las hay.
 *
 * EL CUERPO DE LA RELEASE ES UNO SOLO Y ESTÁ EN ESPAÑOL. Hasta ahora la página
 * alemana enseñaba las novedades en español, porque es lo único que devuelve la
 * API de GitHub: una release tiene un cuerpo, no cinco.
 *
 * Así que se buscan aquí, en `web/notas/<versión>.<idioma>.md`, y viven
 * versionadas en el repositorio a propósito. `notas/` está en el `.gitignore`
 * —por eso las de las veinte versiones anteriores sólo existen en un disco— y
 * repetir esa decisión habría sido perder también éstas en cuanto cambiara la
 * máquina.
 *
 * EL RESPALDO NO ES UN DETALLE: las veinte versiones anteriores no tienen
 * fichero de nadie, y tienen que seguir saliendo exactamente como salían. Si no
 * hay fichero para ese idioma, se usa el cuerpo de la release. No es una
 * regresión: hoy ya se ven en español en los cinco idiomas.
 */
/**
 * PENDIENTE PARA LA 1.12.0: LOS RÓTULOS CITADOS SE SUSTITUYEN, NO SE ESCRIBEN.
 * Decidido, no implementado.
 *
 * Estas notas citan a propósito rótulos que la aplicación enseña —«Postura
 * equivocada por tramos», «Pelea guardada antes de que el daño se partiera por
 * postura»— para que el lector RECONOZCA lo que tiene delante en su programa.
 * Escritos a mano, se desvían: en la 1.11.0 el rótulo del consejo se tradujo
 * mal en tres idiomas a la vez —`découpés`, `aufgeteilt`, `dividido`, cuando
 * i18n dice `répartis`, `getrennt`, `separado`— y el del análisis se citó en
 * los cinco con un nombre que la aplicación NUNCA ha enseñado. Se cazó a mano
 * antes de publicar; la segunda vez no habrá quien lo cace.
 *
 * LA FORMA: en el `.md` va la clave y aquí se pone el texto.
 *
 *     El aviso de {{an.stance}} del análisis se mueve
 *     verás {{adv.notSegmented}} en tus peleas antiguas
 *
 * Las comillas retóricas —«¿ha cambiado lo que se guarda?»— se escriben como
 * siempre y nadie las mira. Eso resuelve el problema que hundiría a una prueba
 * que cotejara TODO lo entrecomillado: en francés y en portugués las comillas
 * angulares son la puntuación normal, así que no sirven de señal.
 *
 * POR QUÉ SUSTITUIR Y NO COTEJAR, que es la alternativa que se consideró y se
 * descartó (declarar al pie las claves citadas y comprobarlas):
 *
 *   · La sustitución QUITA el modo de fallo; la declaración lo DETECTA sólo si
 *     el autor se acuerda de declarar. Una enumeración que depende de que quien
 *     escribe la mantenga ya ha fallado dos veces en este proyecto — el escáner
 *     que sólo veía `function` y no `async function`, y el bucle sobre
 *     `SIN_MITIGACION` que probaba menos al encoger la lista.
 *   · Y su fallo es RUIDOSO. Si alguien pega el `.md` en crudo, el cuerpo de la
 *     release enseña `{{adv.notSegmented}}` con las llaves a la vista y se ve al
 *     instante. Citar sin declarar no rompe nada y nadie se entera. Entre dos
 *     soluciones imperfectas, la que grita.
 *
 * DECISIÓN QUE ALGUIEN VA A QUERER «ARREGLAR» DENTRO DE UN AÑO, y no hay que
 * arreglarla: cuando un rótulo se reescriba en una versión futura, las notas
 * ANTIGUAS pasarán a renderizar el texto NUEVO — un rótulo que el usuario de la
 * 1.11.0 nunca vio. Es deliberado. Estas citas están para que el lector
 * reconozca lo que tiene delante en SU programa, no para dejar constancia de lo
 * que decía la versión de entonces. Si algún día se quiere lo segundo, es otra
 * cosa y necesita otro mecanismo.
 *
 * LO QUE FALTA POR HACER:
 *   · sustituir aquí, con el `t()` del idioma de la página
 *   · que `web:build` escriba además los `.md` YA SUSTITUIDOS, y que
 *     `gh release edit --notes-file` tome el español de ahí y NUNCA del fuente
 *   · una prueba de una línea: toda `{{clave}}` de `web/notas/*.md` existe en
 *     `i18n.js`. Sin falsos positivos, porque sólo mira lo marcado.
 */
function notasDe(tag, lang) {
  const version = String(tag ?? '').replace(/^v/, '');
  if (!version) return null;
  const p = path.join(RAIZ, 'notas', `${version}.${lang}.md`);
  try { return sustituirRotulos(fs.readFileSync(p, 'utf8'), lang); } catch { return null; }
}

function novedades(lang, publicadas) {
  const tt = T[lang];
  const fecha = (s) => (s ? new Date(s).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  return `<section><h1>${esc(tt.novedadesT)}</h1><p class="ancho">${esc(tt.novedadesP)}</p></section>
  ${publicadas.map((r) => `<article class="version">
      <h2>${esc(r.nombre)}</h2>
      <div class="fecha">${esc(fecha(r.fecha))}</div>
      <div class="notas">${md(notasDe(r.tag, lang) ?? r.cuerpo, `${r.tag} (${lang})`)}</div>
    </article>`).join('')}
  <p><a href="https://github.com/${REPO}/releases">${esc(tt.verTodas)}</a></p>`;
}

/**
 * «Qué mide» es la página que nos distingue, y la única con prosa larga.
 *
 * En los idiomas sin prosa propia NO se deja una página a medias ni se traduce
 * a máquina: se dice que sólo está en dos idiomas y se enlaza la inglesa. Un
 * hueco explicado informa; una traducción inventada desinforma.
 */
function queMide(lang) {
  const tt = T[lang];
  if (!CON_PROSA.includes(lang)) {
    return `<section><h1>${esc(tt.mideT)}</h1>
      <p class="ancho">${esc(tt.mideP)}</p>
      <p class="aviso">${esc(tt.soloIngles)}</p>
      <a class="boton" href="../en/que-mide.html">${esc(tt.verEnIngles)}</a></section>`;
  }
  const bloques = lang === 'es' ? [
    ['Medido, deducido o declarado — nunca mezclados',
      'Cada cifra lleva de dónde sale. «Medido» es lo que cuenta el registro; «deducido» lo que se infiere de ello con una regla escrita; «declarado» lo que has dicho tú. Un dato ausente con aspecto de dato medido es peor que no tener la columna.'],
    ['La forma del golpe, no su mínimo y su máximo',
      'El mínimo y el máximo de un ataque son las dos únicas cifras de su fila que un solo golpe raro puede mover. Medido sobre un registro real, un ataque con 557 muestras da 3 / 25 / 60: el mínimo es 0,12× la mediana. Se enseña la mediana con el p10 y el p90, que contestan la misma pregunta y no se las lleva un golpe raro.'],
    ['El tiempo sin pegar se mide contra tu arma, no contra cero',
      'Contar como parado todo segundo sin daño acusa al equipo de algo que el jugador no hizo: con un arma de tres segundos, dos de cada tres segundos no traen daño por construcción. Y fallar es atacar — el 31,7% de los segundos con ataque son sólo fallos. Se mide contra tu propia cadencia, deducida de tus huecos.'],
    ['Lo que el registro no dice, no se dice',
      'El registro de EQL no escribe la vida de nadie. Así que no hay barras de presión, ni «casi mueres», ni porcentajes que se parezcan a una barra de vida: 3.000 recibidos son una tragedia con 3.100 de vida y un paseo con 12.000, y la aplicación no sabe cuál de las dos.'],
    ['Y el orden es dato, el espaciado no',
      'Dentro de un segundo, las líneas están en el orden en que ocurrieron: se comprobó con una predicción que podía fallar —el golpe que mata tiene que aparecer antes que la línea de muerte— y salió 952 de 952. El espaciado dentro de ese segundo no existe en el registro, así que la reproducción no lo dibuja.'],
    /**
     * La cifra que desactiva la sospecha de que el consejo existe para darse la
     * razón. Y va con el decimal: lo que la hace creíble es que no es redonda.
     */
    ['El consejo de postura acierta poco, y eso es lo que hay que decir',
      'Pasado por el histórico de referencia: en 359 peleas medidas, en el 68,5% ya llevabas la mejor postura. La mediana de lo que habrías ganado cambiando es exactamente cero. En el 14,5% —52 peleas— la mejor habría evitado al menos un 15% más, y en una de ellas un 150%. Un consejo que se diera la razón saldría con otro reparto; éste dice «no toques nada» dos de cada tres veces.'],
  ] : [
    ['Measured, inferred or declared — never mixed',
      'Every figure carries where it came from. "Measured" is what the log counts; "inferred" is what follows from it by a written rule; "declared" is what you told it. A missing datum dressed as a measured one is worse than not having the column.'],
    ['The shape of a hit, not its min and max',
      'A move’s minimum and maximum are the only two figures in its row that a single freak hit can move. Measured on a real log, an attack with 557 samples gives 3 / 25 / 60: the minimum is 0.12× the median. What is shown is the median with p10 and p90, which answer the same question and survive a freak hit.'],
    ['Idle time is measured against your weapon, not against zero',
      'Counting every second without damage as idle blames your gear for something you did not do: with a three-second weapon, two seconds in three carry no damage by construction. And missing is attacking — 31.7% of the seconds with an attack are misses only. It is measured against your own cadence, inferred from your own gaps.'],
    ['What the log does not say is not said',
      'The EQL log never writes anyone’s health. So there are no pressure bars, no "you nearly died", no percentages that look like a health bar: 3,000 taken is a tragedy with 3,100 health and a stroll with 12,000, and the app does not know which.'],
    ['And order is data, spacing is not',
      'Within a second, lines are in the order they happened: checked with a prediction that could have failed — the killing blow must appear before the death line — and it came out 952 of 952. The spacing inside that second does not exist in the log, so the replay does not draw it.'],
    ['The stance advice is right about you more often than it corrects you',
      'Run over the reference history: across 359 measured fights, in 68.5% you were already in the best stance. The median gain from switching is exactly zero. In 14.5% — 52 fights — the best would have prevented at least 15% more, and in one of them 150% more. Advice built to prove itself right would come out with a different spread; this one says "change nothing" two times in three.'],
  ];
  return `<section><h1>${esc(tt.mideT)}</h1><p class="ancho">${esc(tt.mideP)}</p></section>
    ${bloques.map(([h, p]) => `<section class="bloque"><h2>${esc(h)}</h2><p class="ancho">${esc(p)}</p></section>`).join('')}`;
}

// ── Construir ───────────────────────────────────────────────────────────────
async function copiar(origen, destino) {
  await fsp.mkdir(path.dirname(destino), { recursive: true });
  await fsp.copyFile(origen, destino);
}

async function main() {
  console.log('\nConstruyendo eqlparse.com…');

  /**
   * TODO LO QUE PUEDE PARAR LA CONSTRUCCIÓN VA ANTES DE BORRAR NADA.
   *
   * `dist/` es lo último que se desplegó, así que borrarlo lo primero y fallar
   * después deja al proyecto sin la construcción anterior y sin la nueva: si el
   * despliegue tenía que salir hoy, ya no hay de dónde. Las claves, los textos
   * y las versiones se comprueban con el disco intacto.
   */

  // LAS CLAVES SE COMPRUEBAN ANTES DE NADA. Si una función se renombra en la
  // aplicación, aquí saldría su clave en crudo —«tank.title»— en cinco
  // idiomas. Mejor que no construya.
  setLang('es');
  const faltan = FUNCIONES.map((f) => f.clave).filter((k) => t(k) === k);
  if (faltan.length) throw new Error(`claves que no existen en el diccionario: ${faltan.join(', ')}`);

  // Y LOS TEXTOS PROPIOS, EN LOS CINCO. Una descripción que falte saldría como
  // «undefined» en una tarjeta de la portada, que es peor que no construir.
  const huecos = IDIOMAS.flatMap((l) => [
    ...FUNCIONES.filter((f) => !T[l].desc?.[f.icono]).map((f) => `${l}.desc.${f.icono}`),
    ...CAPTURAS.filter((c) => !T[l].pies?.[c.fichero]).map((c) => `${l}.pies.${c.fichero}`),
    ...(T[l].pies?.[PRUEBA] ? [] : [`${l}.pies.${PRUEBA}`]),
    ...(T[l].pies?.[CONTRAPRUEBA] ? [] : [`${l}.pies.${CONTRAPRUEBA}`]),
  ]);
  if (huecos.length) throw new Error(`textos sin escribir: ${huecos.join(', ')}`);

  /**
   * CADA GUARDA CON SU POBLACIÓN. Ver `releases()`.
   *
   * `todas` para las notas huérfanas: un prelanzamiento respalda unas notas
   * igual de bien que una release definitiva, y exigirlas contra `publicadas`
   * pararía la construcción por unas notas que SÍ tienen release detrás.
   * `publicadas` para todo lo que mira el usuario.
   */
  const { todas, publicadas } = await releases();
  exigirNotasPublicadas(todas, JSON.parse(fs.readFileSync(path.join(PROY, 'package.json'), 'utf8')).version);

  // Y AHORA sí: lo anterior se va porque ya hay con qué sustituirlo.
  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(DIST, { recursive: true });

  // Imágenes: las capturas de los README y la muestra del reproductor.
  // Una copia por cada ruta distinta que pidan las cinco páginas. Si sólo hay
  // el juego en inglés, las cinco piden la misma y se copia una vez.
  const rutas = new Set(IDIOMAS.flatMap((l) =>
    [...CAPTURAS.map((c) => c.fichero), PRUEBA, CONTRAPRUEBA].map((f) => paraWeb(f, l))));
  let porIdioma = 0;
  for (const rel of rutas) {
    const o = path.join(PROY, 'docs', rel);
    if (!fs.existsSync(o)) continue;
    await copiar(o, path.join(DIST, 'img', rel));
    if (rel.startsWith('i18n/')) porIdioma++;
  }
  console.log(porIdioma
    ? `  capturas: ${rutas.size} ficheros, ${porIdioma} con la aplicación en su idioma`
    : '  capturas: sin versión por idioma (lanza `npm run ui:docs` para tenerlas)');
  const muestra = path.join(process.env.TEMP ?? '/tmp', 'eql-ui-check', 'reproduccion.apng.png');
  if (fs.existsSync(muestra)) {
    await copiar(muestra, path.join(DIST, 'img', 'reproduccion.png'));
    console.log('  muestra del reproductor incluida');
  } else {
    console.log('  (sin muestra del reproductor: lanza `npm run ui:gif` antes)');
  }
  /**
   * LA CARPETA DEL AVISO ENTERA, no una lista de nombres.
   *
   * Estaban escritos a mano los dos ficheros del ogro, y el HTML se construye
   * leyendo la carpeta: al añadir las cuatro capturas, el HTML las enlazó y el
   * copiado no las copió. Cuatro imágenes rotas en el sitio publicado, y la
   * comprobación de tamaños las midió a 112 px sin pestañear — porque el alto
   * lo pone el CSS y una imagen rota también lo cumple.
   *
   * Dos sitios que tienen que decir lo mismo y sólo uno se actualiza. Aquí se
   * copia lo que haya, que es lo mismo que lee el HTML.
   */
  const promo = path.join(RAIZ, 'promo');
  if (fs.existsSync(promo)) {
    const fich = fs.readdirSync(promo).filter((f) => !f.startsWith('.'));
    for (const f of fich) await copiar(path.join(promo, f), path.join(DIST, 'promo', f));
    console.log(`  aviso del otro proyecto: ${fich.length} ficheros`);
  }

  if (fs.existsSync(path.join(PROY, 'build', 'icon.png'))) {
    await copiar(path.join(PROY, 'build', 'icon.png'), path.join(DIST, 'icon.png'));
  }
  await copiar(path.join(RAIZ, 'estilo.css'), path.join(DIST, 'estilo.css'));

  const paginas = [
    ['index.html', portada, (tt) => tt.tagline, (tt) => tt.sub],
    ['instalacion.html', instalacion, (tt) => tt.instalarT, (tt) => tt.instalarP],
    ['novedades.html', novedades, (tt) => tt.novedadesT, (tt) => tt.novedadesP],
    ['que-mide.html', queMide, (tt) => tt.mideT, (tt) => tt.mideP],
  ];

  let n = 0;
  for (const lang of IDIOMAS) {
    setLang(lang);            // los nombres de las funciones, en su idioma
    const tt = T[lang];
    for (const [fichero, hacer, tit, desc] of paginas) {
      const cuerpo = hacer(lang, publicadas);
      const html = pagina({
        lang, pag: fichero, titulo: `${tit(tt)} · EQL Parse`,
        descripcion: desc(tt), cuerpo, version: publicadas[0]?.tag?.replace(/^v/, ''),
      });
      await fsp.mkdir(path.join(DIST, lang), { recursive: true });
      await fsp.writeFile(path.join(DIST, lang, fichero), html);
      n++;
    }
  }

  /**
   * LA RAÍZ MANDA AL INGLÉS, y no al español pese a ser el idioma del autor.
   *
   * Quien llega a este dominio llega buscando «EQ log parser», y eso se busca
   * en inglés. El español está a un clic en el selector, y quien escribe la
   * dirección de memoria es justo quien sabe llegar. No se negocia por
   * `Accept-Language` porque eso pide una Function de Pages: aquí es una regla
   * estática, sin JavaScript y sin código que mantener.
   *
   * A los buscadores esto no les confunde: las cinco versiones se declaran con
   * `hreflang` y cada una tiene su canónica.
   */
  /**
   * LAS NOTAS YA SUSTITUIDAS, para subirlas como adjuntos de la release.
   *
   * El cartel de actualización de la aplicación las lee de ahí —igual que ya lee
   * el `latest.yml`— y así un alemán ve en alemán lo que va a instalar. Ver
   * `consultar()` en `src/actualizar.js`.
   *
   * SE ESCRIBEN AQUÍ Y NO SE SUBE EL FUENTE, y ésa es la razón de que esto viva
   * en el mismo sitio que la sustitución: lo que se publica tiene que ser el
   * `.md` CON los rótulos puestos. Subir `web/notas/*.md` a pelo pondría
   * `{{adv.notSegmented}}` con las llaves a la vista en el cartel de todo el
   * mundo. Y el cuerpo en español de la release sale del mismo sitio, nunca del
   * fuente.
   *
   * Sólo la versión que se está publicando: las veinte anteriores ya tienen su
   * cuerpo en la API y no se reescriben.
   */
  const versionHoy = JSON.parse(fs.readFileSync(path.join(PROY, 'package.json'), 'utf8')).version;
  let notasListas = 0;
  await fsp.mkdir(path.join(DIST, 'notas'), { recursive: true });
  for (const lang of IDIOMAS) {
    const fuente = path.join(RAIZ, 'notas', `${versionHoy}.${lang}.md`);
    if (!fs.existsSync(fuente)) continue;
    const texto = sustituirRotulos(fs.readFileSync(fuente, 'utf8'), lang);
    /**
     * Y SI UNA CLAVE NO RESUELVE, SE PARA AQUÍ.
     *
     * `sustituirRotulos` deja intacta la clave que no existe —a propósito, para
     * que el fallo sea ruidoso— pero «ruidoso» sólo funciona si alguien mira. El
     * sitio donde se mira es éste: quien construye la web está delante, y lo que
     * sale de aquí es literalmente lo que va a leer el cartel de actualización
     * de todo el mundo.
     *
     * `test/notas.js` ya comprueba que toda clave citada existe en el
     * diccionario. Esto comprueba la otra mitad, que no es la misma: que la
     * sustitución de VERDAD ocurrió sobre el fichero que se va a publicar. Entre
     * las dos hay un camino —el de la construcción— y es donde se coló el fallo
     * que motivó esta guarda.
     */
    const sinResolver = [...texto.matchAll(/\{\{([\w.]+)\}\}/g)].map((m) => m[1]);
    if (sinResolver.length) {
      throw new Error(`notas ${versionHoy}.${lang}: claves sin resolver -> ${sinResolver.join(', ')}`
        + '. No se publica así: saldrían las llaves a la vista en el cartel.');
    }
    await fsp.writeFile(path.join(DIST, 'notas', `${versionHoy}.${lang}.md`), texto);
    notasListas++;
  }
  /**
   * EL PASO SE IMPRIME AQUÍ, con el comando hecho.
   *
   * Subir estos `.md` como adjuntos es un paso NUEVO del ritual de publicar, y
   * es de los que se olvidan sin consecuencia visible: si faltan, el cartel de
   * actualización cae al cuerpo en español y funciona — sólo que un alemán lee
   * en español justo cuando decide si instala algo que le va a mover el
   * histórico. Un fallo silencioso, que es la clase que este proyecto persigue.
   *
   * Por eso no va en un documento aparte sino en la salida de la herramienta
   * que los produce: quien acaba de construir la web tiene el comando delante.
   */
  if (notasListas) {
    console.log(`  notas de la ${versionHoy}: ${notasListas} idiomas listos en dist/notas/`);
    console.log('\n  AL PUBLICAR, súbelos como adjuntos de la release o el cartel');
    console.log('  de actualización saldrá en español para todo el mundo:');
    console.log(`    gh release upload v${versionHoy} web/dist/notas/*.md\n`);
    // Y el ritual entero, porque este paso tiene dependencias con los de antes
    // y con los de después: ver `PUBLICAR.md`. El comando de arriba SE COPIA de
    // aquí y no se escribe de memoria — es exactamente así como se subieron una
    // vez las fuentes en vez de estos ficheros.
    console.log('  El orden completo, con sus porqués, está en PUBLICAR.md\n');
  } else {
    console.log(`  notas de la ${versionHoy}: NO HAY FICHERO en web/notas/ — el cartel caerá al cuerpo de la release`);
  }

  await fsp.writeFile(path.join(DIST, '_redirects'), '/  /en/  302\n');
  // Un mapa para los buscadores, con las cinco versiones de cada página.
  const urls = IDIOMAS.flatMap((l) => paginas.map(([f]) => `${DOMINIO}/${l}/${f}`));
  await fsp.writeFile(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  await fsp.writeFile(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${DOMINIO}/sitemap.xml\n`);

  console.log(`  ${n} páginas en ${IDIOMAS.length} idiomas`);
  console.log(`  salida: ${DIST}\n`);
}

/**
 * SE MARCA EL CÓDIGO DE SALIDA, NO SE MATA EL PROCESO.
 *
 * Con `process.exit(1)` a mitad de un fallo de red, libuv aborta con su propia
 * aserción y el proceso sale con 127 en vez de con 1 — un código que en un guion
 * se lee como «orden no encontrada», no como «falló la construcción». Marcando
 * `exitCode` el bucle termina de cerrar lo suyo y sale con el 1 que dijimos.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ESTO SÓLO CONSTRUYE SI SE EJECUTA. IMPORTARLO NO HACE NADA.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes `main()` se llamaba al cargar el módulo, así que un `import` para mirar
 * una función —comprobar la sintaxis, probar algo desde otro guion— arrancaba
 * una construcción entera: borró `dist/` y sobrescribió `releases.json` con una
 * lista vacía, en una máquina donde nadie había pedido construir nada.
 *
 *     UN MÓDULO QUE HACE ALGO AL IMPORTARSE NO SE PUEDE MIRAR SIN DISPARARLO.
 *
 * Y no es sólo el susto: mientras esto fuera así, `main()` no se podía probar
 * desde `test/` ni llamar dos veces, porque cargar el fichero YA era correrlo.
 */
const ejecutadoDirecto = !!process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (ejecutadoDirecto) {
  main().catch((err) => { console.error('\nMAL ', err.message, '\n'); process.exitCode = 1; });
}
