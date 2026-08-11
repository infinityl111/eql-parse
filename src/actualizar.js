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
export async function consultar(repo, versionActual) {
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

  return {
    version: tag.replace(/^v/, ''),
    url: j.html_url,
    /**
     * PENDIENTE PARA LA 1.12.0: ESTO ESTÁ EN ESPAÑOL PARA TODO EL MUNDO.
     * Decidido, no implementado.
     *
     * El cuerpo de una release es UNO SOLO —la API de GitHub no devuelve cinco—
     * y está en español. Desde la 1.11.0 el cartel de actualización SÍ lo enseña
     * (antes se traía y no lo pintaba nadie), así que a un alemán le sale un
     * muro de texto en español justo cuando tiene que decidir si instala. La
     * web ya se arregló: lee `web/notas/<versión>.<idioma>.md` y cae al cuerpo
     * de la release si no hay fichero. Aquí falta lo mismo.
     *
     * CÓMO, sin inventar infraestructura: esos ficheros se suben como ADJUNTOS
     * de la release, junto al `.exe` y al `latest.yml`. Entonces esto los coge
     * igual que ya coge el `latest.yml` —buscando por nombre en `j.assets`— y no
     * hace falta ni otro servidor ni otra petición a un sitio distinto:
     *
     *     const nota = (j.assets ?? []).find((a) => a.name === `${version}.${lang}.md`);
     *
     * Y EL RESPALDO ES LA MITAD DEL TRABAJO, como en la web: las veinte
     * versiones anteriores no tienen fichero de nadie y tienen que seguir
     * saliendo con `j.body`. Que falte el adjunto no puede dejar el cartel sin
     * notas.
     *
     * Va después de la sustitución de rótulos (ver `notasDe()` en
     * `web/build.mjs`): lo que se suba como adjunto tiene que ser el `.md` YA
     * SUSTITUIDO, nunca el fuente con las llaves dentro.
     */
    notas: (j.body ?? '').slice(0, 4000),
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
    await fsp.rm(parcial, { force: true }).catch(() => {});
    return { ok: false, motivo: err.name === 'AbortError' ? 'cancelado' : 'error', error: err.message };
  }

  // SE COMPRUEBA ANTES DE PONERLO EN SU SITIO. Mientras no cuadre, el fichero
  // se llama `.parcial` y no puede confundirse con uno bueno.
  const hash = await sha512De(parcial);
  if (hash !== info.sha512) {
    await fsp.rm(parcial, { force: true }).catch(() => {});
    return { ok: false, motivo: 'no-cuadra' };
  }
  await fsp.rm(ruta, { force: true }).catch(() => {});
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
