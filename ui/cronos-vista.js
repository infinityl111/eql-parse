/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REAPARICIONES · el CONSTRUCTOR, separado del pintor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí no se toca el DOM. Entra un modelo, sale una cadena. El pintor —en
 * `ui/app.js`— reúne los datos, llama aquí y se encarga de `pintaEstable` y de
 * los escuchadores.
 *
 * ── POR QUÉ ESTA SEPARACIÓN, Y NO ES ORDEN ────────────────────────────────
 *
 * Saber qué rótulos produce esta sección costó **siete causas y dos tandas**, y
 * había que levantar Electron: la carpeta de datos, el asistente de bienvenida,
 * el tamaño del registro, el sello del almacén, las mayúsculas del CSS…
 * ninguna era del programa. Saber qué produce `ui/piezas.js` cuesta cero.
 *
 * La diferencia no era la herramienta: era que el módulo **separa construir de
 * pintar** y la sección no. De ahí la regla:
 *
 *     SI VERIFICAR ALGO ES CARO, SOSPECHA DEL DISEÑO DE LO VERIFICADO
 *     ANTES QUE DEL INSTRUMENTO.
 *
 * Y la vara: **una sección tiene que poder DECLARAR qué produce sin arrancar la
 * aplicación**. Lo hace `CLAVES`, y lo exige `test/cronos-vista.js`.
 *
 * ── LO QUE NO SE NEGOCIA, HEREDADO DEL MÓDULO ─────────────────────────────
 *
 * La procedencia se ve SIN desplegar: las tres fuentes en la fila, la que manda
 * rellena, y el número grande rotulado con de quién es.
 */
import { pestañas, barraControl, pastillas, filas, procedencia, leyendaProcedencia }
  from './piezas.js';
import { t } from '../src/i18n.js';
import { ESTADO, PERIODOS_SOSPECHA } from '../src/cronos.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** El rótulo del cuerpo de una ficha. Puro: entra estado, sale CLAVE. */
export function claveDelCuerpo(st, crono = {}) {
  if (st?.estado === ESTADO.SIN_MUERTE) {
    return st.transcurrido ? 'cro.aunNo' : 'cro.esperando';
  }
  if (st?.estado === ESTADO.CONTANDO) return null;          // el número, no un rótulo
  return 'cro.disponible';
}

/** El recuento de observaciones, y la nota que lo acompaña. */
export function clavesDeObservacion(n = 0) {
  const cuenta = n === 0 ? 'cro.obs0' : n === 1 ? 'cro.obs1' : 'cro.obsN';
  // Con menos de dos no se da cifra: un intervalo suelto no es una medida.
  return { cuenta, nota: n < 2 ? 'cro.obsPocas' : 'cro.retenido' };
}

/** Los avisos de una ficha. Devuelve CLAVES, no texto. */
export function clavesDeAviso(st, crono = {}) {
  const out = [];
  if (st?.aviso === 'quizá-no-vemos-su-muerte') out.push('cro.sospecha');
  if (crono.aviso === 'varios-a-la-vez') out.push('cro.varios');
  else if (crono.aviso === 'probablemente-varios') out.push('cro.quizaVarios');
  return out;
}

/** Una ficha, como fila plegable del módulo. */
function fichaDe({ crono, estado, obs = {}, i }) {
  const v = estado?.valor ?? {};
  const n = obs.observaciones ?? 0;
  const { cuenta, nota } = clavesDeObservacion(n);
  const cuerpoClave = claveDelCuerpo(estado, crono);
  const avisos = clavesDeAviso(estado, crono);
  const manda = v.fuente === 'manual' ? 'tuyo' : v.fuente === 'wiki' ? 'zona' : null;

  /**
   * `cro.aunNo` LLEVA VARIABLE DENTRO —«van {n} muertes suyas observadas»— y sin
   * pasarla salía la llave a la vista. Lo cazó la prueba, que exige que no quede
   * ninguna sin sustituir: es la misma familia que las notas de versión con
   * `{{clave}}` dentro.
   */
  const textoCuerpo = cuerpoClave === 'cro.aunNo'
    ? t(cuerpoClave, { n: obs.muertes ?? crono.muertes ?? 0 })
    : t(cuerpoClave ?? 'cro.disponible');
  const numero = estado?.estado === ESTADO.CONTANDO
    ? `<span class="cro-num" data-num="${i}">${esc(estado.restanteTxt ?? '')}</span>`
    : `<span class="cro-num cro-cero">${esc(textoCuerpo)}</span>`;

  const deQuien = manda
    ? `<span class="cro-dequien">${esc(t(`pz.src.${manda}`))}</span>` : '';

  const dis = [];
  if (v.discrepa != null && v.fuente === 'manual') {
    dis.push(t('cro.discrepa', { tuyo: esc(v.segundosTxt ?? ''), n }));
  }
  if (v.discrepaWiki != null) dis.push(t('cro.discrepaWiki', { n }));

  return {
    busca: `${crono.nombre} ${crono.base ?? ''}`,
    et: [estado?.estado === ESTADO.CONTANDO ? 'contando' : 'vencido'],
    columnas: '14px 1fr auto auto',
    celdas: [
      `<span><b>${esc(crono.nombre)}</b></span>`,
      procedencia({
        tuyo: v.fuente === 'manual' ? (v.segundosTxt ?? null) : null,
        zona: v.zonaTxt ?? null,
        visto: n ? String(n) : null,
        manda,
      }),
      `<span class="cro-caja">${numero}${deQuien}</span>`,
    ],
    cuerpo: [
      `<div class="cro-obs"><b>${esc(t(cuenta, { n }))}</b> — ${esc(t(nota))}</div>`,
      v.pagina ? `<div class="cro-pag">${esc(t('cro.segun', { pagina: v.pagina }))}</div>` : '',
      crono.base ? '' : `<div class="cro-avi">${esc(t('cro.sinZona'))}</div>`,
      ...dis.map((x) => `<div class="cro-dif">${esc(x)}</div>`),
      ...avisos.map((k) => `<div class="cro-avi">${esc(
        k === 'cro.sospecha' ? t(k, { n: PERIODOS_SOSPECHA })
          : k === 'cro.quizaVarios' ? t(k, { n: crono.muertes ?? 0 }) : t(k))}</div>`),
      `<button class="cro-x" data-quita="${i}">${esc(t('cro.close'))}</button>`,
    ].filter(Boolean).join(''),
  };
}

/**
 * EL CONSTRUCTOR. `conNumero` en false devuelve el mismo HTML sin las cuentas
 * atrás: es la firma que usa `pintaEstable` para no reconstruir en cada tic.
 */
export function construye(modelo = {}, conNumero = true) {
  const { fichas = [], vista = 'vig', leyendaAbierta = false, sugerencias = [] } = modelo;
  const porZona = new Map();
  fichas.forEach((f, i) => {
    const k = f.crono.base
      ? `${f.crono.base}${f.crono.diff != null ? ` · D${f.crono.diff}` : ''}`
      : t('cro.sinZona');
    if (!porZona.has(k)) porZona.set(k, []);
    porZona.get(k).push(fichaDe({ ...f, i, conNumero }));
  });

  const cab = pestañas({
    activa: vista,
    items: [
      { id: 'vig', rotulo: t('cro.title'), n: fichas.length },
      { id: 'sug', rotulo: t('cro.add'), n: sugerencias.length },
    ],
  });

  const lista = `<div data-vista="vig"${vista === 'vig' ? '' : ' hidden'}>
    ${barraControl({ agrupar: [{ id: 'zona', rotulo: t('cro.title') }] })}
    ${pastillas({
    items: [
      { et: 'contando', rotulo: t('cro.esperando') },
      { et: 'vencido', rotulo: t('cro.disponible') },
    ],
  })}
    ${leyendaProcedencia({ abierta: leyendaAbierta })}
    ${filas({
    vacio: t('cro.vacio'),
    grupos: [...porZona].map(([rotulo, fs]) => ({ rotulo, filas: fs })),
  })}</div>`;

  const alta = `<div data-vista="sug"${vista === 'sug' ? '' : ' hidden'}>
    <div class="cro-add"><input id="croNuevo" placeholder="${esc(t('cro.addPh'))}">
      <button id="croAdd">${esc(t('cro.add'))}</button></div>
    ${filas({
    vacio: t('cro.escVacio'),
    grupos: sugerencias.length ? [{ rotulo: modelo.zonaActual ?? '', filas: sugerencias }] : [],
  })}</div>`;

  return `<h2>${esc(t('cro.title'))}</h2><p class="sub">${esc(t('cro.sub'))}</p>
    ${cab}${lista}${alta}`;
}

/**
 * TODO LO QUE ESTA SECCIÓN PUEDE PRODUCIR, declarado.
 *
 * `test/cronos-vista.js` exige que cada una salga de una llamada de verdad. Lo
 * que no esté aquí y se use, o esté aquí y no se produzca, sale rojo — y las dos
 * cosas son un fallo distinto y las dos importan.
 */
export const CLAVES = [
  'cro.title', 'cro.sub', 'cro.add', 'cro.addPh', 'cro.close', 'cro.vacio',
  'cro.esperando', 'cro.disponible', 'cro.aunNo',
  'cro.obs0', 'cro.obs1', 'cro.obsN', 'cro.obsPocas', 'cro.retenido',
  'cro.segun', 'cro.sinZona', 'cro.varios', 'cro.quizaVarios', 'cro.sospecha',
  'cro.discrepa', 'cro.discrepaWiki', 'cro.escVacio',
];
