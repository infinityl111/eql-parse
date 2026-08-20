/**
 * Descargar e instalar la versión nueva desde la propia aplicación.
 *
 * POR QUÉ NO `electron-updater`. Es la vía habitual con electron-builder y
 * funcionaría, pero trae dos cosas que aquí sobran: descarga automática por
 * defecto —justo lo que NO se quiere— y un montón de maquinaria para
 * diferenciales y despliegues por fases que este proyecto no usa. Y sería la
 * primera dependencia de ejecución de una aplicación que no tiene ninguna.
 *
 * Lo que hace falta es pequeño y está todo en la release: la API da el tamaño y
 * la URL del instalador, y el `latest.yml` da el sha512 con el que comprobarlo.
 *
 * LAS TRES REGLAS, que salen de lo que puede salir mal:
 *
 *   NUNCA SOLO. Descargar es una acción del usuario e instalar es OTRA. Entre
 *   las dos no pasa nada por su cuenta, ni siquiera con la descarga terminada.
 *
 *   SE COMPRUEBA ANTES DE OFRECER. El fichero se descarga a temporal y se
 *   verifica su sha512 contra el del `latest.yml`. Si no cuadra, se borra y no
 *   se ofrece instalar nada: media descarga es peor que ninguna.
 *
 *   SI ALGO FALLA, LO DE ANTES SIGUE. Nada toca la instalación existente hasta
 *   que el instalador arranca, y el histórico no está ahí: vive en la carpeta
 *   de datos del usuario, que el instalador NSIS no toca.
 *
 * SOBRE EL AVISO DE WINDOWS. El cartel de «Windows protegió su PC» lo dispara
 * la marca de Internet, un flujo alternativo `Zone.Identifier` que añade el
 * navegador al descargar. Comprobado escribiendo un ejecutable con Node y
 * mirando sus flujos: sólo `:$DATA`, sin marca. Así que bajarlo desde aquí
 * evita ese cartel, al revés que bajarlo con el navegador. Lo que no se puede
 * garantizar desde aquí es qué haga Defender por reputación, y por eso el
 * cartel de la interfaz lo dice igual.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const CABECERAS = { 'User-Agent': 'EQL-Parse', Accept: 'application/vnd.github+json' };

/** Compara 1.2.10 con 1.3.0 sin traerse una librería para tres números. */
export function masNuevaQue(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

/**
 * Qué hay publicado, con lo que hace falta para decidir ANTES de descargar.
 *
 * El tamaño va aquí y no se descubre al empezar: son 75 MB, y quien esté con
 * datos limitados o mala conexión tiene que poder decir que no con el número
 * delante. Sale de la propia release, no de una estimación.
 */
export async function consultar(repo, versionActual, lang = 'es') {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`,
    { headers: CABECERAS });
  if (!r.ok) return null;
  const j = await r.json();
  const tag = j.tag_name ?? '';
  if (!tag || !masNuevaQue(tag, versionActual)) return null;

  const exe = (j.assets ?? []).find((a) => /\.exe$/i.test(a.name));
  const yml = (j.assets ?? []).find((a) => a.name === 'latest.yml');

  // SIN sha512 NO SE OFRECE INSTALAR, sólo el enlace de siempre. Descargar un
  // ejecutable que no se puede comprobar y lanzarlo es justo lo que no se hace.
  let sha512 = null;
  if (yml) {
    try {
      const texto = await (await fetch(yml.browser_download_url, { headers: CABECERAS })).text();
      sha512 = /^sha512:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? null;
    } catch { /* sin yml: se queda en enlace manual */ }
  }

  const version = tag.replace(/^v/, '');

  /**
   * LAS NOTAS, EN EL IDIOMA DE QUIEN LAS VA A LEER.
   *
   * El cuerpo de una release es UNO SOLO —la API de GitHub no devuelve cinco— y
   * está en español. Desde la 1.11.0 el cartel SÍ lo enseña, así que a un alemán
   * le salía un muro en español justo cuando tiene que decidir si instala. Y
   * desde la 1.12.0 eso pasó de incomodidad a deuda: fue la primera versión que
   * pide algo DESTRUCTIVO —reconstruir, que mueve fronteras de pelea— y el
   * texto que lo explicaba era el único sin traducir.
   *
   * SIN INFRAESTRUCTURA NUEVA: los cinco `.md` se suben como adjuntos de la
   * release, junto al `.exe` y al `latest.yml`, y se cogen igual que el yml —por
   * nombre, de `j.assets`—. Ni otro servidor ni otra petición a un sitio
   * distinto. Los escribe `web:build` YA SUSTITUIDOS (ver `sustituirRotulos`):
   * lo que se sube nunca es el fuente con las llaves dentro.
   *
   * EL RESPALDO ES LA MITAD DEL TRABAJO. Las veinte versiones anteriores no
   * tienen adjunto de nadie y tienen que seguir saliendo con `j.body`; una
   * publicación futura en la que se olvide subirlos, también. Que falte el
   * adjunto no puede dejar el cartel sin notas, y por eso hay dos respaldos:
   * el idioma pedido, y si no, el cuerpo de siempre.
   *
   * Y NO SE DESCARGA SI NO HACE FALTA: el `.md` sólo se pide cuando hay una
   * versión nueva que ofrecer, que es este mismo camino.
   */
  let notas = null;
  const adjunto = (j.assets ?? []).find((a) => a.name === `${version}.${lang}.md`);
  if (adjunto) {
    try {
      const texto = await (await fetch(adjunto.browser_download_url, { headers: CABECERAS })).text();
      // Una respuesta vacía o un error de GitHub disfrazado de texto no valen
      // como notas: mejor el cuerpo en español que un cartel en blanco.
      if (texto && texto.trim().length > 40) notas = texto.slice(0, 4000);
    } catch { /* sin adjunto legible: se cae al cuerpo */ }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * QUÉ SE PUEDE OFRECER, DICHO Y NO DEDUCIDO.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * EL CASO REAL: la v1.16.0 estuvo marcada como la última, con sus
   * cinco `.md` subidos y SIN el `.exe`.
   *
   * CUÁNTO DURÓ, ACOTADO Y NO A OJO. Aquí ponía «dos horas» y es más de lo que
   * pasó. La API de releases guarda `published_at` y `updated_at`, pero NO
   * cuándo se marcó prelanzamiento, así que la ventana no se puede medir: se
   * acota. Publicada a las 22:23:38 y última modificación a las 23:44:21 —o
   * sea, el prelanzamiento se puso en o antes de ésa—, y una comprobación
   * externa la vio todavía como la última a las 22:40. La ventana está entre
   * 17 y 81 minutos, y no hay forma de estrecharla más con lo que GitHub
   * expone. Por eso la nota de versión no lleva ninguna cifra: un rango de
   * cuatro a uno no es un número, y una nota que trata de decir la verdad
   * sobre un fallo no lleva su propia duración a ojo.
   *
   * Esto la daba por nueva —lo es—, y el
   * cartel salía entero: «Hay una versión nueva: 1.16.0», notas traducidas, y
   * un botón primario que pone «Descargar» y abre una página donde no hay nada
   * que descargar. `web:build` tiene una guarda para exactamente este hecho
   * desde hace dos versiones; este camino, que es el que ve el usuario, no.
   *
   * Y NO BASTA CON MIRAR `descargable`, que es lo que parece a primera vista:
   * ese booleano es `exe && sha512`, y se pone en falso también cuando SÍ hay
   * instalador y lo que falta es el `latest.yml` con el que comprobarlo. Ése es
   * el caso del enlace manual, que es correcto y deliberado — hay algo que
   * descargar, sólo que no desde aquí. Colapsar los dos dejaría sin aviso a
   * quien sí puede actualizar.
   *
   *     «NO SE PUEDE INSTALAR DESDE AQUÍ» Y «NO HAY INSTALADOR» NO SON LO
   *     MISMO, Y HASTA AHORA SE ESCRIBÍAN IGUAL.
   *
   * Así que el estado va dicho, no deducido por quien mire:
   *
   *   'descargable'     hay .exe y hay sha512 — el cartel completo
   *   'enlace'          hay .exe y no hay sha512 — el cartel con enlace manual
   *   'sin-instalador'  no hay .exe — no se ofrece NADA, y quien llame lo dice
   *                     en el registro; ver `checkUpdate` en electron/main.cjs
   *
   * Quien decide qué se enseña es `checkUpdate`, no esto: aquí se contesta qué
   * hay publicado, que es lo que se puede probar sin una ventana delante.
   */
  const estado = !exe ? 'sin-instalador' : (sha512 ? 'descargable' : 'enlace');

  return {
    version,
    url: j.html_url,
    estado,
    notas: notas ?? (j.body ?? '').slice(0, 4000),
    // De dónde salieron, para que la interfaz pueda decirlo si algún día quiere
    // y para que una prueba pueda distinguir los dos caminos sin adivinar.
    notasIdioma: notas ? lang : null,
    // Lo que decide si se puede instalar desde aquí o sólo enlazar.
    descargable: !!(exe && sha512),
    exeUrl: exe?.browser_download_url ?? null,
    exeNombre: exe?.name ?? null,
    bytes: exe?.size ?? 0,
    sha512,
  };
}

/** Dónde se deja lo descargado. Temporal: si algo falla, se borra y ya está. */
export const carpeta = () => path.join(os.tmpdir(), 'eql-parse-update');

/**
 * Descarga con progreso y comprueba el sha512.
 *
 * @param {Function} onProgreso  recibe {hechos, total, pct}
 * @param {AbortSignal} señal    para poder cancelar a mitad
 * @returns {{ok, ruta}|{ok:false, motivo}}
 */
export async function descargar(info, onProgreso = null, señal = null) {
  if (!info?.descargable) return { ok: false, motivo: 'no-descargable' };
  const dir = carpeta();
  await fsp.mkdir(dir, { recursive: true });
  const ruta = path.join(dir, info.exeNombre);

  // Si ya está descargado y cuadra, no se vuelve a bajar. Pasa al reintentar
  // después de cancelar la instalación.
  if (fs.existsSync(ruta) && (await sha512De(ruta)) === info.sha512) {
    return { ok: true, ruta, yaEstaba: true };
  }

  let escrito = 0;
  const parcial = `${ruta}.parcial`;
  try {
    const r = await fetch(info.exeUrl, { headers: { 'User-Agent': 'EQL-Parse' }, signal: señal });
    if (!r.ok || !r.body) return { ok: false, motivo: 'sin-respuesta' };
    const total = Number(r.headers.get('content-length') ?? info.bytes ?? 0);
    const salida = fs.createWriteStream(parcial);
    for await (const trozo of r.body) {
      salida.write(Buffer.from(trozo));
      escrito += trozo.length;
      onProgreso?.({ hechos: escrito, total, pct: total ? escrito / total : 0 });
    }
    await new Promise((res, rej) => salida.end((e) => (e ? rej(e) : res())));
  } catch (err) {
    await fsp.rm(parcial, { force: true }).catch(() => { /* si no existe, ya esta */ });
    return { ok: false, motivo: err.name === 'AbortError' ? 'cancelado' : 'error', error: err.message };
  }

  // SE COMPRUEBA ANTES DE PONERLO EN SU SITIO. Mientras no cuadre, el fichero
  // se llama `.parcial` y no puede confundirse con uno bueno.
  const hash = await sha512De(parcial);
  if (hash !== info.sha512) {
    await fsp.rm(parcial, { force: true }).catch(() => { /* si no existe, ya esta */ });
    return { ok: false, motivo: 'no-cuadra' };
  }
  await fsp.rm(ruta, { force: true }).catch(() => { /* si no existe, ya esta */ });
  await fsp.rename(parcial, ruta);
  return { ok: true, ruta };
}

/** El sha512 en base64, que es como lo escribe electron-builder. */
export function sha512De(ruta) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('sha512');
    fs.createReadStream(ruta).on('data', (d) => h.update(d))
      .on('end', () => res(h.digest('base64')))
      .on('error', rej);
  });
}

/**
 * Lanza el instalador y se aparta.
 *
 * `detached` + `unref` para que el instalador no muera con la aplicación: tiene
 * que seguir vivo justo cuando ésta se cierra, que es lo que necesita para
 * poder sustituir sus ficheros.
 */
export function instalar(ruta) {
  if (!fs.existsSync(ruta)) return { ok: false, motivo: 'sin-fichero' };
  const hijo = spawn(ruta, [], { detached: true, stdio: 'ignore' });
  hijo.unref();
  return { ok: true };
}
