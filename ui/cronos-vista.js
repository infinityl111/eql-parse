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

/**
 * Los avisos de una ficha. Devuelve CLAVES, no texto.
 *
 * AQUI VIVIA `cro.sospecha` — «lleva N periodos a cero, puede que ya este ahi y
 * no lo hayas visto». Se retira, y no por sitio: **era una suposicion, y ahora
 * hay un hecho que la sustituye**. El registro nombra a cada bicho 145 veces
 * por cada vez que dice que ha muerto, y el 97% de las reapariciones vienen
 * anunciadas por una de esas lineas. Asi que no hay que suponer si esta: se
 * mira si lo hemos nombrado.
 */
export function clavesDeAviso(st, crono = {}) {
  const out = [];
  if (crono.aviso === 'varios-a-la-vez') out.push('cro.varios');
  else if (crono.aviso === 'probablemente-varios') out.push('cro.quizaVarios');
  return out;
}

/** Una ficha, como fila plegable del módulo. */
function fichaDe({ crono, estado, obs = {}, i, conNumero = true, abierta = false }) {
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
  /**
   * `conNumero` EN FALSE VACÍA LA CUENTA ATRÁS, y no es un detalle de estilo.
   *
   * `pintaEstable` usa esta misma llamada como FIRMA de la sección. Si la
   * cuenta atrás entrara en ella, la firma cambiaría cada segundo, la sección
   * se reconstruiría entera cada segundo y el campo de poner tiempo volvería a
   * destruirse mientras se escribe — que es el fallo que trajo Campeón.
   *
   * Lo volátil se vacía aquí y lo repone el pintor tocando `textContent`.
   */
  const numero = estado?.estado === ESTADO.CONTANDO
    ? `<span class="cro-num" data-num="${i}">${conNumero ? esc(estado.restanteTxt ?? '') : ''}</span>`
    : `<span class="cro-num cro-cero">${esc(textoCuerpo)}</span>`;

  const deQuien = manda
    ? `<span class="cro-dequien">${esc(t(`pz.src.${manda}`))}</span>` : '';

  /**
   * LA COTA Y EL VISTO, que es lo que hace util el temporizador.
   *
   * La cota es un TECHO medido, no un periodo: «no mas de 10m19s». Su numero
   * de huecos va SIEMPRE al lado, porque una cota de un hueco es cierta y
   * floja — y son mas de la mitad: 56 de 108, remedido el 21/08/2026 sobre
   * las 2.118 peleas de hoy con las claves ya curadas.
   *
   * Y el visto contesta lo que la cota no puede: si esta ahi AHORA. Las dos
   * juntas son las que dicen algo que ninguna dice sola:
   *
   *     techo 10m19s + visto hace 3s        → esta ahi
   *     techo 10m19s + sin verlo hace 12m   → deberia estar, y no lo has visto
   */
  const cota = crono.cota ?? null;
  const visto = crono.visto ?? null;
  const cotaHtml = cota
    ? `<span class="cro-cota">${esc(t('cro.cota', { t: cota.txt }))}
       <span class="cro-huecos">${esc(cota.huecos === 1
    ? t('cro.cotaH1') : t('cro.cotaHn', { n: cota.huecos }))}</span></span>`
    : '';

  const dis = [];
  if (v.discrepa != null && v.fuente === 'manual') {
    dis.push(t('cro.discrepa', { tuyo: esc(v.segundosTxt ?? ''), n }));
  }
  if (v.discrepaWiki != null) dis.push(t('cro.discrepaWiki', { n }));

  return {
    /**
     * LA IDENTIDAD DE LA FILA ES SU CLAVE, no su sitio en la cola.
     *
     * La cola se ordena por «el que antes vuelve», así que las posiciones
     * bailan solas cada vez que uno muere. Guardando el despliegue por posición
     * se reabriría la fila de otro bicho.
     */
    id: `${crono.nombre}|${crono.base ?? ''}|${crono.diff ?? ''}|${crono.mode ?? ''}`,
    abierta,
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
      `<span class="cro-caja">${numero}${deQuien}${cotaHtml}</span>`,
    ],
    cuerpo: [
      `<div class="cro-obs"><b>${esc(t(cuenta, { n }))}</b> — ${esc(t(nota))}</div>`,
      cota ? `<div class="cro-cotapor">${esc(t('cro.cotaPor'))}</div>` : '',
      visto?.txt
        ? `<div class="cro-visto"><b>${esc(t('cro.visto', { t: visto.txt }))}</b> — ${
          esc(t(visto.kind === 'pelea' ? 'cro.vistoPelea' : 'cro.vistoTipo'))}${
          visto.esta ? ` · <b>${esc(t('cro.vistoEsta'))}</b>` : ''}</div>`
        : (visto?.desdeTxt
          ? `<div class="cro-visto">${esc(t('cro.sinVer', { t: visto.desdeTxt }))}${
            cota && visto.pasado ? ` — ${esc(t('cro.sinVerCota', { t: cota.txt }))}` : ''}</div>`
          : ''),
      v.pagina ? `<div class="cro-pag">${esc(t('cro.segun', { pagina: v.pagina }))}</div>` : '',
      crono.base ? '' : `<div class="cro-avi">${esc(t('cro.sinZona'))}</div>`,
      ...dis.map((x) => `<div class="cro-dif">${esc(x)}</div>`),
      ...avisos.map((k) => `<div class="cro-avi">${esc(
        k === 'cro.sospecha' ? t(k, { n: PERIODOS_SOSPECHA })
          : k === 'cro.quizaVarios' ? t(k, { n: crono.muertes ?? 0 }) : t(k))}</div>`),
      /**
       * PONER TIEMPO A MANO. Se cayó al migrar y lo cazó el control de
       * regresión: estaba en la sección vieja y no en la nueva, y sin él el
       * jugador no puede escribir el tiempo que sabe — que es justo la fuente
       * que MANDA sobre las otras dos.
       */
      `<div class="cro-man"><input class="cro-in" data-man="${i}"
        placeholder="${esc(t('cro.manualPh'))}" value="${esc(crono.manualTxt ?? '')}">
        <button data-set="${i}">${esc(t('cro.setManual'))}</button></div>`,
      `<button class="cro-x" data-quita="${i}">${esc(t('cro.close'))}</button>`,
    ].filter(Boolean).join(''),
  };
}

/**
 * UNA FILA DE LA LISTA DE CANDIDATOS.
 *
 * Lleva las dos cifras que hacen falta para elegir —cuántas veces ha caído ahí
 * y cuándo fue la última— y el botón que lo abre con la clave entera: nombre,
 * zona y dificultad salen del histórico, no de dónde estés ahora.
 *
 * ── LAS DOS CIFRAS CUENTAN COSAS DISTINTAS, Y SE DICE EN EL CUERPO ────────
 *
 * «Muertes» son las veces que ha caído; «peleas», en cuántos combates. Dos
 * muertes en un mismo combate son DOS INDIVIDUOS y no dos reapariciones, así
 * que sumarlas como si midieran lo mismo sería prometer una muestra que no
 * existe. Es la misma distinción que separa `observacionesDe` de
 * `multiplicidadDe`, dicha donde se lee.
 *
 * Y la fecha es la de LA PELEA, no la del instante de la muerte: el índice
 * guarda cuándo empezó el combate, y la hora exacta sólo se va a buscar al
 * abrir el temporizador. Por eso se enseña el día y no la hora.
 */
function candidatoDe(c, i) {
  const cuenta = c.muertes === 1
    ? t('cro.candCuenta1', { p: c.peleas })
    : t('cro.candCuenta', { n: c.muertes, p: c.peleas });
  return {
    id: `cand|${c.nombre}|${c.base ?? ''}|${c.diff ?? ''}|${c.mode ?? ''}`,
    // Se busca por nombre Y por zona: quien escribe «Guk» no está pensando en
    // la diferencia, y la cabecera de grupo no entra en el buscador.
    busca: `${c.nombre} ${c.base ?? ''}`,
    columnas: '14px 1fr auto auto auto',
    celdas: [
      `<span><b>${esc(c.nombre)}</b></span>`,
      `<span class="cro-candn">${esc(cuenta)}</span>`,
      `<span class="cro-candu">${esc(c.ultimaTxt ? t('cro.candUltima', { t: c.ultimaTxt }) : '')}</span>`,
      c.ya
        ? `<span class="croesc-ya">${esc(t('cro.candYa'))}</span>`
        : `<button class="cro-candpon" data-alta="${i}">${esc(t('cro.candPoner'))}</button>`,
    ],
    cuerpo: `<div class="cro-candnota">${esc(t('cro.candNota'))}</div>`,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA FICHA DE UN CANDIDATO · lo que se ve al pasar el ratón por su fila
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contesta «¿éste cuál era?» sin salir de la lista: qué es, dónde, cuánto lo
 * has matado, si tiene techo y qué te ha soltado.
 *
 * ── EL NIVEL VA COMO RANGO Y CON SU RECUENTO, NUNCA COMO CIFRA ────────────
 *
 * **No es propiedad del nombre.** Medido: `a zol ghoul knight` da 36, 37, 39 y
 * 40 en la MISMA zona y la MISMA dificultad. Un número sería elegir uno de los
 * cuatro y presentarlo como el dato; el rango con su `n` dice lo que se sabe y
 * lo poco que se ha mirado. Y si sus consideraciones no traían nivel, se dice
 * —que no es lo mismo que no haberlo considerado nunca.
 *
 * ── Y EL BOTÍN EN DOS BLOQUES ETIQUETADOS ────────────────────────────────
 *
 * Lo TUYO está medido: sale de lo que has recogido de ese bicho. Lo de la wiki
 * **no lo tenemos raspado**, y ese bloque se queda diciendo que está pendiente
 * en vez de desaparecer. Un hueco vacío se lee como «no suelta nada»; un
 * «pendiente de raspar» se lee como lo que es — nuestra tarea, no su botín.
 *
 * Aquí no se toca el DOM ni se lee ningún reloj: entra un modelo con los textos
 * ya formateados y sale una cadena.
 */
export function fichaCandidato(f = {}) {
  const nivel = (() => {
    if (!f.consider?.obs) return `<div class="cf-nivel cf-no">${esc(t('cro.fSinCon'))}</div>`;
    const c = f.consider;
    const rango = c.conNivel
      ? (c.min === c.max ? t('cro.fNivelUno', { a: c.min }) : t('cro.fNivel', { a: c.min, b: c.max }))
      : t('cro.fSinNivel');
    const cuenta = c.obs === 1 ? t('cro.fNivelObs1') : t('cro.fNivelObs', { n: c.obs });
    const peldano = c.cons?.[0]?.palabra
      ? `<span class="cf-peldano">${esc(t('cro.fPeldano', { p: c.cons[0].palabra }))}</span>` : '';
    return `<div class="cf-nivel"><b>${esc(rango)}</b>
      <span class="cf-obs">${esc(cuenta)}</span>${peldano}</div>`;
  })();

  const cota = f.cota
    ? `<div class="cf-cota">${esc(t('cro.cota', { t: f.cota.txt }))}
       <span class="cf-huecos">${esc(f.cota.huecos === 1
    ? t('cro.cotaH1') : t('cro.cotaHn', { n: f.cota.huecos }))}</span></div>`
    : `<div class="cf-cota cf-no">${esc(t('cro.fSinCota'))}</div>`;

  const items = f.botin ?? [];
  const mio = items.length
    ? `<ul class="cf-items">${items.map((x) => `<li><span>${esc(x.item)}</span>
        <span class="cf-n">×${x.n}</span></li>`).join('')}
      </ul>${f.botinMas ? `<div class="cf-mas">${esc(t('cro.fMas', { n: f.botinMas }))}</div>` : ''}`
    : `<div class="cf-no">${esc(t('cro.fBotinNada'))}</div>`;

  return `<div class="cf">
    <div class="cf-h"><b>${esc(f.nombre)}</b><span class="cf-zona">${esc(f.zonaTxt ?? '')}</span></div>
    ${nivel}
    <div class="cf-muertes">${esc(f.muertesTxt ?? '')}</div>
    ${cota}
    <div class="cf-bloque">
      <div class="cf-tit">${esc(t('cro.fBotinMio'))}</div>
      <div class="cf-sub">${esc(t('cro.fBotinMioSub', { n: f.bajas ?? 0 }))}${
  f.masZonas ? ` · ${esc(t('cro.fBotinVarias', { n: f.masZonas }))}` : ''}</div>
      ${mio}
    </div>
    <div class="cf-bloque cf-pendiente">
      <div class="cf-tit">${esc(t('cro.fBotinWiki'))}</div>
      <div class="cf-sub">${esc(t('cro.fBotinWikiNo'))}</div>
    </div>
  </div>`;
}

/**
 * EL CONSTRUCTOR. `conNumero` en false devuelve el mismo HTML sin las cuentas
 * atrás: es la firma que usa `pintaEstable` para no reconstruir en cada tic.
 */
export function construye(modelo = {}, conNumero = true) {
  const {
    fichas = [], vista = 'vig', leyendaAbierta = false, candidatos = [],
    abiertas = new Set(), agruparPor = 'zona',
  } = modelo;
  /**
   * EL PERIODO ES DE LA ZONA, asi que agrupar por zona es lo que contesta «que
   * me queda por aqui». Pero con temporizadores de cuatro sitios distintos, un
   * grupo por ficha es una cabecera por linea: por eso se puede quitar.
   *
   * Las cabeceras llevan lo que seria igual en todas sus filas, que es la
   * regla de la pieza: una columna con el mismo valor en todas no es
   * informacion, es ruido con forma de dato.
   */
  const grupos = new Map();
  fichas.forEach((f, i) => {
    const k = agruparPor === 'nada' ? '' : (f.crono.base
      ? `${f.crono.base}${f.crono.diff != null ? ` · D${f.crono.diff}` : ''}`
      : t('cro.sinZona'));
    if (!grupos.has(k)) grupos.set(k, []);
    const ficha = fichaDe({ ...f, i, conNumero });
    grupos.get(k).push({ ...ficha, abierta: abiertas.has(ficha.id) });
  });

  const cab = pestañas({
    activa: vista,
    items: [
      { id: 'vig', rotulo: t('cro.title'), n: fichas.length },
      { id: 'sug', rotulo: t('cro.add'), n: candidatos.length },
    ],
  });

  const lista = `<div data-vista="vig"${vista === 'vig' ? '' : ' hidden'}>
    ${barraControl({
    agruparPor,
    agrupar: [
      { id: 'zona', rotulo: t('cro.agrZona') },
      { id: 'nada', rotulo: t('cro.agrNada') },
    ],
  })}
    ${pastillas({
    /**
     * LOS ROTULOS DE LAS PASTILLAS SON CORTOS Y CIERTOS, y no valian los del
     * cuerpo de la ficha. «Esperando su primera muerte» ocupaba 242 px y
     * ademas MENTIA: un temporizador que esta contando no espera su primera
     * muerte, ya la vio. Lo enseno el volcado, midiendo la caja.
     */
    items: [
      { et: 'contando', rotulo: t('cro.filContando') },
      { et: 'vencido', rotulo: t('cro.filDisponible') },
    ],
  })}
    ${leyendaProcedencia({ abierta: leyendaAbierta })}
    ${filas({
    vacio: t('cro.vacio'),
    grupos: [...grupos].map(([rotulo, fs]) => ({ rotulo, filas: fs })),
  })}</div>`;

  /**
   * ── LA LISTA DE CANDIDATOS, agrupada por donde murieron ────────────────
   *
   * El orden lo trae ya hecha —`candidatosDe`, por la última vez que lo
   * mataste—, así que aquí sólo se parte en grupos SIN reordenar: el `Map`
   * conserva el orden de llegada, y con él la zona de anoche queda arriba.
   *
   * Y la cabecera lleva la zona y la dificultad, que es lo que sería igual en
   * todas sus filas. La fila no las repite.
   */
  const gCand = new Map();
  candidatos.forEach((c, i) => {
    const k = c.base
      ? `${c.base}${c.diff != null ? ` · ${c.diffLabel ?? `D${c.diff}`}` : ''}`
      : t('cro.sinZona');
    if (!gCand.has(k)) gCand.set(k, []);
    gCand.get(k).push(candidatoDe(c, i));
  });

  /**
   * EL CAMPO LIBRE SE QUEDA, Y DEBAJO DE LA LISTA. Es la única vía para un
   * bicho que no está en el histórico —uno que nunca has matado—, y da la
   * clave COJA: la zona sale de donde estés AHORA y la dificultad no se puede
   * poner. Con la lista delante deja de ser lo primero que se ve, que es lo
   * que era.
   */
  const alta = `<div data-vista="sug"${vista === 'sug' ? '' : ' hidden'}>
    <p class="sub">${esc(t('cro.candSub'))}</p>
    ${barraControl({ buscarPh: t('cro.candBuscarPh') })}
    ${filas({
    vacio: t('cro.candVacio'),
    grupos: [...gCand].map(([rotulo, fs]) => ({ rotulo, filas: fs })),
  })}
    <div class="cro-mano"><label>${esc(t('cro.candMano'))}</label>
      <div class="cro-add"><input id="croNuevo" placeholder="${esc(t('cro.addPh'))}">
        <button id="croAdd">${esc(t('cro.add'))}</button></div></div></div>`;

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
  'cro.segun', 'cro.sinZona', 'cro.varios', 'cro.quizaVarios',
  'cro.cota', 'cro.cotaH1', 'cro.cotaHn', 'cro.cotaPor',
  'cro.visto', 'cro.vistoTipo', 'cro.vistoPelea', 'cro.vistoEsta', 'cro.sinVer', 'cro.sinVerCota',
  'cro.manualPh', 'cro.setManual',
  'cro.agrZona', 'cro.agrNada', 'cro.filContando', 'cro.filDisponible',
  'cro.discrepa', 'cro.discrepaWiki',
  'cro.candSub', 'cro.candBuscarPh', 'cro.candVacio', 'cro.candMano',
  'cro.candCuenta', 'cro.candCuenta1', 'cro.candUltima', 'cro.candPoner',
  'cro.candYa', 'cro.candNota',
  'cro.fNivel', 'cro.fNivelUno', 'cro.fNivelObs', 'cro.fNivelObs1',
  'cro.fSinNivel', 'cro.fSinCon', 'cro.fPeldano', 'cro.fSinCota',
  'cro.fBotinMio', 'cro.fBotinMioSub', 'cro.fBotinVarias', 'cro.fBotinNada',
  'cro.fBotinWiki', 'cro.fBotinWikiNo', 'cro.fMas',
];
