/**
 * La reproducción de una pelea.
 *
 * QUÉ ES: los sucesos del registro, en su orden, sobre las figuras de quienes
 * pelearon. No es una animación inventada sobre unas cifras: cada número que
 * sale flotando es una línea del registro releída para esto.
 *
 * LAS DOS REGLAS QUE LA GOBIERNAN, y las dos salen de medir el registro:
 *
 *   EL ORDEN ES DATO. Dentro de un segundo, las líneas están en el orden en que
 *   pasaron —comprobado con una predicción falsable, 952 de 952—. Se respeta.
 *
 *   EL ESPACIADO ES PRESENTACIÓN. El registro sella al segundo y no hay nada por
 *   debajo. Los sucesos de un mismo segundo salen A LA VEZ, escalonados en
 *   altura y no en tiempo. Separarlos en el tiempo dibujaría un dato que no
 *   existe, y encima el más creíble de los inventados, que es el peor.
 *
 * Y por eso el reloj avanza de segundo en segundo, a saltos: la forma de moverse
 * ya dice cuál es la resolución, sin tener que leerlo en ninguna nota.
 */
import { t } from '../src/i18n.js';
import { guion, agrupar } from '../src/guion.js';
import { Parser } from '../src/parser.js';
import { enCobre } from '../src/patterns.js';
import { grafica, W, H, BAND } from './grafica.js';
import { posEnTiempo, cuboDe } from './tiempo.js';
import { barra as barraCasteo } from '../src/casteos.js';
import { mostrarRotulo, ocultarRotulo, visible as rotuloVisible } from './rotulo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Math.round(v || 0).toLocaleString('es-ES');
const n1 = (v) => (v || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });

const TIPOS = ['magic', 'cold', 'fire', 'poison', 'disease', 'melee', 'ds', 'dot', 'spell'];
const claseTipo = (x) => (TIPOS.includes(x) ? x : 'other');

/**
 * Las velocidades. Tres y no más: con la resolución de un segundo, entre ×2 y
 * ×5 no hay nada que ver que no se vea en una de las dos, y cada botón de más
 * es una decisión de más que tomar antes de mirar.
 *
 * Medido sobre 410 peleas: la mediana dura 1m13 y el p90 3m35. A ×5 son 15
 * segundos y 43. La más larga del histórico, 15m45, se queda en 3m09.
 */
const VELOCIDADES = [1, 2, 5];

const relojDe = (seg) => `${Math.floor(seg / 60)}:${String(Math.max(0, Math.round(seg % 60))).padStart(2, '0')}`;

/**
 * «2.572 cobres» no se lee. «2p 5o 7pl 2c» sí, y es la misma cifra.
 *
 * El precio de venta pasa por aquí igual que el total, y no se deja en crudo:
 * el registro lo escribe en inglés y con todas las letras —«71 platinum, 4 gold,
 * 2 silver and 9 copper»—, así que dejarlo tal cual pondría dos formatos de la
 * misma cosa en la misma ficha. La frase original se conserva en el `title`: lo
 * que se cambia es cómo se lee, no lo que dijo el registro.
 *
 * Se enseñan sólo las denominaciones que tienen algo: un «0 oro» en medio hace
 * leer un cero que no aporta. Y nunca se redondea a platino — 3 platinos y
 * medio no es una moneda que exista, y la mitad perdida es dinero.
 */
function monedaCorta(cp) {
  const P = [['p', 1000], ['o', 100], ['pl', 10], ['c', 1]];
  const partes = [];
  let resto = Math.round(cp || 0);
  for (const [sufijo, valor] of P) {
    const n = Math.floor(resto / valor);
    if (n > 0) { partes.push(`${n.toLocaleString('es-ES')}${sufijo}`); resto -= n * valor; }
  }
  return partes.length ? partes.join(' ') : '0c';
}

/**
 * LA PISTA DE CAMBIOS DE ESTADO: qué entra, y con qué peso se dibuja.
 *
 * QUÉ ENTRA, MEDIDO Y NO ELEGIDO. Los números son UNA FOTO —700 peleas de un
 * histórico real, 12 de agosto de 2026— y se recalculan, no se heredan.
 *
 * CADA PAR CUENTA COMO UN ESTADO, y esto costó una re-derivación entera: un
 * aturdimiento son DOS líneas, «You are stunned!» y «You are no longer
 * stunned.», así que los 2.853 sucesos `stun` de la primera medición eran 1.439
 * aturdimientos contados dos veces. Sobre esos 2.853 se había sacado el salto
 * que decide dónde empieza «lo raro», o sea que el corte estaba puesto sobre
 * una cuenta inflada.
 *
 *     resist_by_you   1.972
 *     stun            1.439   ×1,37
 *     root              703   ×2,05
 *     survival          603   ×1,17
 *     absorb             91   ×6,63   <- EL SALTO
 *     charm              43   ×2,12
 *     knockdown          36   ×1,19
 *
 * El mayor salto está entre `survival` y `absorb`, así que lo raro empieza ahí.
 * `survival` estuvo en peso 3 con la cuenta vieja y vuelve a 2 con la buena: la
 * corrección era correcta para los números que había, y los números estaban mal.
 *
 * Y QUÉ NO ENTRA: `stagger` (19 por pelea de mediana, y le pasa al ENEMIGO) y
 * `proc` (10 por pelea). No es que no signifiquen nada: son el fondo, y una
 * pista donde todo está marcado no marca nada.
 *
 * EL PESO SALE DE LA RAREZA. Dibujadas con el mismo peso, las tres de abajo
 * —absorb, charm, knockdown, que juntas son el 3%— desaparecerían entre las dos
 * de arriba, que son el 70%. La rareza mide la información.
 *
 * Y HAY UNA ASIMETRÍA DE FONDO EN `resist_by_you`: un aturdimiento es algo que
 * te PASÓ; un resistido es algo que NO te pasó. Es la explicación de un hueco en
 * la curva, no un suceso que la llene. Por eso es la marca más tenue de todas,
 * por debajo incluso de lo que le tocaría por frecuencia — y es la única
 * exención a la regla, enumerada con su motivo en `test/loot.js`.
 *
 *   peso 1  tenue     lo que NO pasó (sólo `resist_by_you`)
 *   peso 2  normal    lo común que sí pasó
 *   peso 3  marcado   lo raro: lo que cae después del salto
 */
/**
 * QUÉ SE CAYÓ DE LA PISTA EN LA 1.13.0, Y NO ES UN RECORTE DE ESPACIO.
 *
 *   `root`            703 apariciones. Una raíz no explica la curva: te deja
 *                     donde estás y sigues pegando si tienes objetivo delante.
 *                     Estaba aquí por frecuencia, no por poder explicativo, y en
 *                     una pista donde todo está marcado no se marca nada. LA
 *                     REGLA DE `patterns.js` NO SE TOCA: se sigue reconociendo,
 *                     se sigue guardando y el consejo la sigue usando; lo único
 *                     que cambia es que no se dibuja.
 *   `resist_by_you`   1.972, la más frecuente de todas. Y es la que peor encaja:
 *                     un resistido es algo que NO te pasó, así que llenaba de
 *                     marcas la pista para explicar huecos. Su sitio es una
 *                     estadística POR ENEMIGO —«a este bicho le resistes 4 de
 *                     cada 5»— que es lo que se ha hecho con ella: ver
 *                     `resistsByFoe`. El coste está dicho donde toca: es un
 *                     campo nuevo por pelea, así que sólo lo tienen las peleas
 *                     escritas desde la 1.13.0 y las viejas lo tendrán al
 *                     reconstruir.
 */
export const PISTA = new Map([
  ['stun', { peso: 2, clave: 'rp.est.stun', par: true }],
  ['survival', { peso: 2, clave: 'rp.est.survival' }],
  ['absorb', { peso: 3, clave: 'rp.est.absorb' }],
  ['charm_on', { peso: 3, clave: 'rp.est.charmOn', deducido: true }],
  ['charm_off', { peso: 3, clave: 'rp.est.charmOff', deducido: true }],
  ['knockdown', { peso: 3, clave: 'rp.est.knockdown' }],
  // Perder el mando del personaje. Peso 3 y no 2: son 31 tramos en un registro
  // de 55 MB frente a 1.429 aturdimientos, y sobre todo son la única marca que
  // explica por qué durante nueve segundos no hiciste nada — que es justo el
  // hueco que el análisis te estaba cobrando como tiempo parado.
  ['control', { peso: 3, clave: 'rp.est.control', par: true }],
]);

/**
 * LO QUE DURA UN ESTADO SE DIBUJA COMO UNA BARRA, NO COMO DOS PUNTOS.
 *
 * `par: true` llevaba versiones declarado y SIN LEER —una bandera muerta, la
 * misma familia que `f.duda`—. El registro escribe los dos extremos de un
 * aturdimiento y de una pérdida de mando, así que la duración está medida y se
 * estaba tirando: seis marcas donde hay tres estados, y ninguna dice cuánto
 * duró. Medido: 2.853 sucesos `stun` son 1.429 aturdimientos, con 2 s de
 * mediana.
 *
 * LOS EXTREMOS ABIERTOS SON LA MITAD DEL TRABAJO. Un estado puede empezar antes
 * de la pelea o no cerrarse dentro de ella —te aturden en el último segundo, o
 * la reproducción arranca contigo ya aturdido—, y ahí sólo se conoce un lado. Se
 * dibuja hasta el borde y se marca abierto, que es distinto de decir que duró
 * hasta el final.
 *
 * Y LA REGLA DEL CUBO: si la barra no llega a medir un cubo de dibujo, se pinta
 * el punto de siempre. Una barra de dos píxeles no informa de una duración —no
 * se distingue de un punto— y encima pierde el número cuando hay varios
 * apilados. Con la mediana de 2 s sobre una pelea de dos minutos, la mayoría de
 * los aturdimientos caen de ese lado, y está bien: lo que la barra tiene que
 * enseñar es el estado LARGO, que es el que explica un hueco de la curva.
 */
export function tramosDePista(sucesos, duracion) {
  const fuera = [];
  const tramos = [];
  const abiertos = new Map();          // clase -> suceso de apertura
  for (const x of sucesos ?? []) {
    if (!PISTA.get(x.clase)?.par) { fuera.push(x); continue; }
    if (x.on === true) {
      // Dos aperturas seguidas sin cierre: la segunda manda y la primera se
      // cierra donde empieza la segunda, que es lo único que se sabe.
      const previo = abiertos.get(x.clase);
      if (previo) tramos.push({ clase: x.clase, desde: previo.s, hasta: x.s, abre: false, cierra: true, quien: previo.quien });
      abiertos.set(x.clase, x);
    } else {
      const ini = abiertos.get(x.clase);
      abiertos.delete(x.clase);
      tramos.push({
        clase: x.clase,
        desde: ini ? ini.s : 0,
        hasta: x.s,
        // Sin apertura, el estado venía de antes de la pelea.
        abre: !ini,
        cierra: false,
        quien: (ini ?? x).quien,
      });
    }
  }
  // Lo que se quedó abierto llega al final de la pelea, y se dice.
  for (const [clase, ini] of abiertos) {
    tramos.push({ clase, desde: ini.s, hasta: duracion, abre: false, cierra: true, quien: ini.quien });
  }
  return { tramos: tramos.sort((a, b) => a.desde - b.desde), sueltos: fuera };
}

/** Píxeles de un cubo de dibujo, y cuántos se perdonan al pinchar. */
const PX_CUBO = 4;
const PX_CLIC = 10;

/**
 * Los sucesos de la pista, del guion.
 *
 * EL EJE NO ES «lo que me pasó a mí» SINO «lo que explica esta curva desde tu
 * sitio», y la diferencia la destapó el encanto: `charm_on` lleva de destino al
 * BICHO y de origen a ti, así que un filtro por destino se quedaba mudo justo
 * en las sesiones de encantador — y `charm_off` aparecería o no según quién lo
 * causara, o sea incoherente consigo mismo. Medido: incluir el origen añade 61
 * marcas en 15 peleas y no mueve ninguna mediana.
 *
 * ESOS 61 SE MIDIERON SOBRE UN CORPUS ANTERIOR a las sesiones de encantador, así
 * que el número VA A SUBIR. No cambia la decisión: lo que protege la pista de
 * saturarse es el colapso por cubo y por clase, no que las marcas sean pocas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DIVERGENCIA CONOCIDA, ANOTADA PARA QUE NO SORPRENDA: en las 18 peleas
 * afectadas por el fallo del encanto, ESTA PISTA DIRÁ LO CORRECTO Y LA PELEA
 * GUARDADA SEGUIRÁ DICIENDO LO VIEJO.
 *
 * No es un fallo nuevo ni de la pista: pasa desde la 1.11.0, porque la
 * reproducción RELEE el registro con el código de hoy mientras la pelea se
 * escribió con el de entonces. Lo que cambia es que hasta ahora no se veía y
 * ahora se va a ver — un encanto marcado en la pista de una pelea cuyo reparto
 * de daño se calculó sin saber que ese bicho era tuyo.
 *
 * Se deja así a propósito: preferimos que se vea. Arreglarlo es reconstruir, y
 * reconstruir cuesta fronteras movidas (ver `AVISO_RECONSTRUIR`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function sucesosDePista(g, self) {
  const out = [];
  (g.segundos ?? []).forEach((lista, s) => {
    for (const x of lista ?? []) {
      if (x?.tipo !== 'estado' || !PISTA.has(x.clase)) continue;
      // `self` PUEDE SER NULO —pasa mientras el nombre no se ha deducido del
      // registro— y sin esta guarda `x.origen === self` casaba null con null y
      // se colaba TODO lo que no tuviera origen. Sin nombre no se puede decir
      // qué es tuyo, así que sólo pasa el encanto, que se sabe por otra vía.
      const mio = !!self && (x.destino === self || x.origen === self);
      const esEncanto = x.clase === 'charm_on' || x.clase === 'charm_off';
      if (!mio && !esEncanto) continue;
      // `on` viaja porque es lo que permite emparejar los dos extremos de un
      // estado y dibujar una barra en vez de dos puntos. Sin él, la duración
      // que el registro sí da se perdía aquí. Ver `tramosDePista`.
      out.push({ s, clase: x.clase, on: x.on ?? null,
        quien: x.destino ?? x.origen ?? null, habilidad: x.habilidad ?? null });
    }
  });
  return out;
}

/**
 * LAS MARCAS YA COLAPSADAS, A PARTIR DE LOS SUCESOS Y DEL ANCHO REAL.
 *
 * VIVE FUERA DEL MONTAJE Y DEVUELVE DATOS, y ésa es la razón de que exista como
 * función suelta: LO QUE FALLÓ FUE EL DIBUJO, NO EL CÁLCULO. `sucesosDePista`
 * tenía prueba y esto no, así que un `cuboDe` sin importar —un `ReferenceError`
 * en tiempo de ejecución, no un error de sintaxis— dejaba la pista vacía con la
 * batería entera en verde y la guarda de «todo ui/*.js compila» sin poder verlo:
 * compilar no es funcionar. Se descubrió abriendo la aplicación y contando cero
 * marcas, y la próxima vez nadie la va a abrir.
 *
 * Partido así, una prueba puede pintar una pelea y contar lo que sale.
 */
export function marcasDePista(sucesos, duracion, anchoPx, pxCubo = PX_CUBO) {
  if (!sucesos?.length || !(anchoPx > 0)) return [];
  // Un cubo por cada `pxCubo` píxeles, Y UNA MARCA POR CLASE DENTRO DE ÉL.
  // Fundir clases distintas en un «×3» daría un número que no dice nada: un
  // aturdimiento, un absorbido y un resistido en el mismo hueco no son tres
  // veces lo mismo, son tres cosas.
  const cubos = new Map();
  for (const x of sucesos) {
    const c = cuboDe(x.s, duracion, anchoPx, pxCubo);
    const k = `${c}|${x.clase}`;
    const e = cubos.get(k) ?? { cubo: c, clase: x.clase, n: 0, s: x.s, quienes: new Set() };
    e.n++;
    if (x.quien) e.quienes.add(x.quien);
    cubos.set(k, e);
  }
  return [...cubos.values()].map((e) => {
    const info = PISTA.get(e.clase);
    return {
      ...e,
      peso: info?.peso ?? 2,
      deducido: !!info?.deducido,
      px: Math.round(posEnTiempo(e.s, duracion) * anchoPx),
    };
  }).sort((a, b) => a.px - b.px);
}

/**
 * Los tramos, en píxeles, con la regla del cubo aplicada.
 *
 * Devuelve dos cosas: los que dan para barra y los que no, y estos últimos
 * vuelven a la cola de puntos con la forma que espera `marcasDePista`. Así la
 * decisión se toma UNA vez y en un sitio que se puede probar sin navegador.
 */
export function barrasDePista(tramos, duracion, anchoPx, pxCubo = PX_CUBO) {
  const barras = [];
  const aPunto = [];
  for (const tr of tramos ?? []) {
    const x1 = Math.round(posEnTiempo(tr.desde, duracion) * anchoPx);
    const x2 = Math.round(posEnTiempo(tr.hasta, duracion) * anchoPx);
    if (x2 - x1 < pxCubo) {
      // No llega al cubo: punto, y con el instante en que empezó.
      aPunto.push({ s: tr.desde, clase: tr.clase, quien: tr.quien, habilidad: null });
      continue;
    }
    barras.push({ ...tr, px: x1, ancho: x2 - x1, peso: PISTA.get(tr.clase)?.peso ?? 2 });
  }
  return { barras, aPunto };
}

/** Las barras, en HTML. Los extremos abiertos llevan su marca y su explicación. */
export function pintaBarras(barras, reloj) {
  return (barras ?? []).map((b) => {
    const info = PISTA.get(b.clase);
    const nombre = info ? t(info.clave) : b.clase;
    const dur = Math.max(0, b.hasta - b.desde);
    const abierto = b.abre || b.cierra;
    const titulo = `${reloj(b.desde)} → ${reloj(b.hasta)} · ${nombre} · ${dur} s`
      + (b.quien ? ` — ${b.quien}` : '')
      + (abierto ? ` · ${t(b.abre ? 'rp.pista.abreAntes' : 'rp.pista.cierraDespues')}` : '');
    return `<i class="rp-tramo e-${esc(b.clase)} p${b.peso}${b.abre ? ' abre' : ''}${b.cierra ? ' cierra' : ''}"
      style="left:${b.px}px;width:${b.ancho}px" data-s="${b.desde}" title="${esc(titulo)}"></i>`;
  }).join('');
}

/** Las marcas, en HTML. Separado del cálculo para poder mirarlo sin navegador. */
export function pintaMarcas(marcas, reloj) {
  return (marcas ?? []).map((m) => {
    const info = PISTA.get(m.clase);
    const nombre = info ? t(info.clave) : m.clase;
    const quien = m.quienes?.size === 1 ? [...m.quienes][0] : null;
    const titulo = `${reloj(m.s)} · ${nombre}${m.n > 1 ? ` ×${m.n}` : ''}`
      + (quien ? ` — ${quien}` : '')
      + (m.deducido ? ` · ${t('rp.pista.deducido')}` : '');
    return `<i class="rp-marca e-${esc(m.clase)} p${m.peso}${m.deducido ? ' dedu' : ''}"
      style="left:${m.px}px" data-s="${m.s}" title="${esc(titulo)}"
      >${m.n > 1 ? `<b>${m.n}</b>` : ''}</i>`;
  }).join('');
}

/**
 * Lo que la venta dio, dicho como lo dijo el registro cuando no son monedas.
 *
 * MEDIDO: de 1.101 ventas automáticas de un histórico real, 108 son `free.` —
 * objetos que el autovendedor se lleva sin pagar—. Pasarlas por el conversor da
 * cero, que es CIERTO, pero enseñar «vendido por 0c» es una cifra donde el
 * registro puso una palabra. Con monedas se formatea; sin ellas se enseña lo
 * que decía, y así una forma que no sepamos leer se ve en vez de convertirse en
 * un cero silencioso.
 */
const precio = (sold) => {
  const cp = enCobre(sold);
  return cp > 0 ? monedaCorta(cp) : String(sold).replace(/\.$/, '');
};

/**
 * LA FICHA DEL FINAL: lo que recogiste en esta pelea.
 *
 * TRES DECISIONES QUE NO SON DE ESTILO.
 *
 * 1. EL TÍTULO. No es «lo que cayó» ni «lo que soltó el bicho», porque el
 *    registro no ve ninguna de las dos cosas: no anota el botín de tus
 *    compañeros —cero líneas en 677.675—, ni lo que saquea otro de un cadáver
 *    lejano, ni lo que se quedó en el suelo. Ve lo que cogiste tú. Por eso
 *    tampoco hay columna de QUIÉN: sólo hay un recolector posible y sería una
 *    columna con el mismo valor en todas las filas.
 *
 * 2. EL ORDEN ES EL INSTANTE DE RECOGIDA, EN CRUDO. Es el único dato medido que
 *    tiene cada objeto por separado. Agrupar por cadáver se lee mejor pero es
 *    una deducción —el cadáver se empareja por nombre— y además se rompe en
 *    cuanto saqueas dos cuerpos intercalados, que es lo normal. El cadáver sale
 *    en cada fila; el que manda es el reloj.
 *
 * 3. NO ESTÁ ACOTADA POR `duration`, Y ÉSTE ES EL ARREGLO. El reproductor
 *    recorre de 0 a la duración de la pelea, así que un objeto recogido después
 *    del último golpe NO SE PINTA NUNCA: 273 entradas en 159 peleas de un
 *    histórico real —el 14,8% del botín, un tercio de las peleas con botín—
 *    eran invisibles. Aquí salen todas, con su hora y dichas como lo que son:
 *    recogidas con la pelea ya cerrada. Se saquea después de matar.
 */
export function fichaBotin(f, tardio) {
  const inicio = f?.at ? Math.round(f.at / 1000) : Math.round(f?.start ?? 0);
  const dur = Math.max(0, Math.round(f?.duration ?? 0));
  // Dentro de la pelea el instante es relativo; el tardío vive en el fichero
  // lateral y lo trae absoluto. Se llevan los dos al mismo eje —segundos desde
  // el inicio de la pelea— o no se pueden ordenar juntos.
  const dentro = (f?.loot ?? []).filter((l) => l?.item).map((l) => ({ ...l, s: Math.round(l.t ?? 0) }));
  const fuera = (tardio?.loot ?? []).filter((l) => l?.item)
    .map((l) => ({ ...l, s: Math.round((l.t ?? 0) - inicio) }));
  const objetos = [...dentro, ...fuera].sort((a, b) => a.s - b.s);

  const monedas = [...(f?.coins ?? []).map((c) => ({ ...c, s: Math.round(c.t ?? 0) })),
    ...(tardio?.coins ?? []).map((c) => ({ ...c, s: Math.round((c.t ?? 0) - inicio) }))]
    .sort((a, b) => a.s - b.s);
  const cp = monedas.reduce((a, c) => a + (c.cp ?? 0), 0);

  const cabecera = `<div class="rpb-head">
      <div class="sec-title eyebrow">${esc(t('rp.botin.title'))}</div>
      <div class="hint">${esc(t('rp.botin.sub'))}</div>
    </div>`;

  // ── Los tres vacíos ────────────────────────────────────────────────────
  //
  // «No consta botín» y «no cayó nada» son cosas distintas, y una pelea donde
  // no cayó nadie es una tercera. El registro las escribe igual —no escribe
  // nada— así que la diferencia hay que sacarla de lo que SÍ consta: cuántos
  // enemigos cayeron. Un panel vacío las diría las tres a la vez, que es
  // mentir en dos.
  if (!objetos.length && !monedas.length) {
    const caidos = (f?.kills ?? []).length;
    const [titulo, sub] = caidos
      ? [t('rp.botin.nadaConMuertos'), t('rp.botin.nadaConMuertosSub', { n: caidos })]
      : [t('rp.botin.nadaSinMuertos'), t('rp.botin.nadaSinMuertosSub')];
    return `<div class="rp-fichabotin vacia">${cabecera}
      <div class="rpb-nada">${esc(titulo)}</div>
      <div class="hint">${esc(sub)}</div>
    </div>`;
  }

  const fila = (l) => {
    const tarde = l.s > dur;
    // Lo MEDIDO de cada objeto: cuándo lo cogiste y cuánto después de caer su
    // cadáver. El emparejamiento con el cadáver es deducido y se dice arriba;
    // esta cifra no lo es.
    const desfase = Number.isFinite(l.dt)
      ? (l.dt > 0 ? t('rp.botin.dt', { s: l.dt }) : t('rp.botin.dt_0'))
      : null;
    return `<div class="rpb-fila${tarde ? ' tarde' : ''}${l.amb ? ' amb' : ''}">
      <span class="rpb-reloj num">${esc(relojDe(l.s))}</span>
      <button class="rp-obj rpb-item" data-obj="${esc(l.item)}">${esc(l.item)}${(l.qty ?? 1) > 1 ? ` ×${l.qty}` : ''}</button>
      <span class="rpb-de dim">${esc(t('rp.botin.deQuien'))} ${esc(l.from ?? '—')}</span>
      ${desfase ? `<span class="rpb-dt dim">${esc(desfase)}</span>` : ''}
      ${l.sold ? `<span class="rpb-tag" title="${esc(String(l.sold).replace(/\.$/, ''))}">${esc(t('loot.sold'))} ${esc(precio(l.sold))}</span>` : ''}
      ${l.upgraded ? `<span class="rpb-tag up">${esc(t('loot.upgraded'))} ${esc(l.upgraded)}</span>` : ''}
      ${l.stored ? `<span class="rpb-tag">${esc(t('rp.botin.monedero'))}</span>` : ''}
      ${l.depot ? `<span class="rpb-tag">${esc(t('rp.botin.depot'))}</span>` : ''}
      ${l.cola ? `<span class="rpb-tag ojo" title="${esc(t('rp.botin.cola', { cola: l.cola }))}">${esc(t('rp.botin.cola', { cola: l.cola }))}</span>` : ''}
      ${tarde ? `<span class="rpb-tag tarde">${esc(t('rp.botin.tras'))}</span>` : ''}
      ${l.amb ? `<span class="rpb-tag duda" title="${esc(t('rp.botin.amb'))}">?</span>` : ''}
    </div>`;
  };

  // El contador de las monedas es «cuántas veces», no «cuántos objetos»: pasarlo
  // por `loot.count` diría «3 objetos» de tres recogidas de monedas, que no son
  // objetos ni son tres cosas.
  return `<div class="rp-fichabotin">${cabecera}
    ${objetos.length ? `<div class="rpb-lista">${objetos.map(fila).join('')}</div>
      <div class="hint rpb-nota">${esc(t('rp.botin.cadaverNota'))}</div>` : ''}
    ${monedas.length ? `<div class="rpb-moneda">
      <span class="eyebrow">${esc(t('rp.botin.moneda'))}</span>
      <b class="num">${esc(monedaCorta(cp))}</b>
      <span class="dim">${monedas.length > 1 ? `×${monedas.length}` : ''}</span>
    </div>
    <div class="hint">${esc(t('rp.botin.monedaNota'))}</div>` : ''}
  </div>`;
}

/**
 * Cuánto vive un flotante, y por qué depende de la velocidad.
 *
 * Sobre la misma figura y el mismo segundo caen 3 sucesos de mediana y 7 en el
 * p90. A ×1 un segundo dura 1.000 ms y sólo hay una tanda viva: se lee. A ×5
 * dura 200 ms, así que con una vida fija de un segundo habría cinco tandas
 * encima —quince flotantes de mediana sobre una figura— y no se lee nada.
 *
 * Se ata la vida al paso para que SIEMPRE haya como mucho dos tandas vivas, a
 * la velocidad que sea.
 */
const vidaFlotante = (paso) => Math.min(1000, paso * 2);

/** Las siluetas. Dibujadas aquí, como las láminas: ni una imagen por la red. */
const FIGURAS = {
  // Humanoide de pie. La misma para todos los jugadores: la raza y la clase se
  // dicen con letras, que es como se saben, y no dibujando doce siluetas que
  // nadie ha medido.
  jugador: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="24" cy="12" r="7"/>
      <path d="M24 19v20M24 24l-10 8M24 24l10 8M24 39l-7 15M24 39l7 15"/>
    </g>`,
  // Cuadrúpedo: la mascota no es un jugador y no debe parecerlo.
  mascota: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M12 34h20l6-6M38 28l4-4"/>
      <circle cx="42" cy="24" r="5"/>
      <path d="M14 34v12M20 34v12M28 34v12M32 34v12M12 34l-4-6"/>
    </g>`,
  // El enemigo sin retrato: masa con hombros, distinta de un jugador de un
  // vistazo y sin fingir que sabemos qué bicho es.
  enemigo: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M24 8c8 0 12 5 12 11s-4 9-12 9-12-3-12-9S16 8 24 8Z"/>
      <path d="M12 30l-4 16h32l-4-16M18 46v8M30 46v8"/>
      <path d="M16 17h4M28 17h4"/>
    </g>`,
};

/**
 * El panel de texto: qué merece salir.
 *
 * CON LOS UMBRALES A LA VISTA, que es la condición. Un filtro que dice «lo que
 * destaca» no se puede discutir; uno que dice «por encima del p90 de esa
 * habilidad» sí. Cada regla lleva su número y el pie los enseña.
 *
 * `pico` sale de la propia pelea y no de un valor fijo: lo que rompe el ritmo
 * en una pelea de 15 dps no es lo mismo que en una de 300.
 */
function reglas(f) {
  const p90PorHabilidad = new Map();
  for (const r of f?.rows ?? []) {
    for (const a of r.abilities ?? []) {
      if (a.p90 !== undefined) p90PorHabilidad.set(`${r.name}|${a.name}`, a.p90);
    }
  }
  const serie = (f?.series ?? []).map((x) => x.dmg ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  const medianaSeg = serie.length ? serie[Math.floor(serie.length / 2)] : 0;
  return {
    p90PorHabilidad,
    // Tres veces el segundo mediano. En el corpus, el segundo pico de una pelea
    // trae 4,2 veces lo del segundo corriente, así que tres deja pasar los
    // picos de verdad sin llenarse de ruido.
    picoSegundo: medianaSeg * 3,
    medianaSeg,
    // Si la pelea es anterior a que se contara la forma del golpe, esa regla no
    // se puede aplicar y el pie lo dice en vez de callarlo.
    conForma: p90PorHabilidad.size > 0,
  };
}

function destacable(x, s, reg, totalSegundo) {
  if (x.tipo === 'muere') return { por: 'muerte', peso: 3 };
  if (x.tipo === 'lanza') return { por: 'lanzamiento', peso: 1 };
  if (x.tipo === 'daño') {
    if (x.crit) return { por: 'critico', peso: 2 };
    const p90 = reg.p90PorHabilidad.get(`${x.origen}|${x.habilidad}`);
    if (p90 !== undefined && x.cantidad > p90) return { por: 'sobreP90', peso: 2, p90 };
  }
  if (x.tipo === 'estado' && (x.clase === 'stun' || x.clase === 'interrupt')) {
    return { por: 'corte', peso: 2 };
  }
  if (reg.picoSegundo > 0 && totalSegundo > reg.picoSegundo) return { por: 'pico', peso: 1 };
  return null;
}

/**
 * Monta la reproducción entera dentro de `host`.
 *
 * @returns {{destruir: Function}}
 */
export function montarReproduccion(host, { f, self, lineas, retratos = new Map(), casteos = {},
  tardio = null, onObjeto = null, onObjetoFuera = null }) {
  const g = guion(f, lineas, Parser, self);
  const reg = reglas(f);

  // Tres bandos, como en la tabla: los tuyos, los enemigos, y los que hicieron
  // daño pero de los que no consta que sean tuyos. Ver `guion`.
  const porDano = (a, b) => b.danoTotal - a.danoTotal;
  const aliados = g.actores.filter((a) => a.lado === 'aliado')
    .sort((a, b) => (b.esTu ? 1 : 0) - (a.esTu ? 1 : 0) || porDano(a, b));
  const enemigos = g.actores.filter((a) => a.lado === 'enemigo').sort(porDano);
  const sinBando = g.actores.filter((a) => a.lado === 'sinBando').sort(porDano);

  // ── Estado de la reproducción ──────────────────────────
  let s = 0;                 // segundo actual
  let corriendo = false;
  let velocidad = 1;
  let acumulado = 0;
  let ultimo = 0;
  let raf = null;
  const medidores = new Map();   // nombre -> daño acumulado hasta `s`
  let sobre = null;                // la figura que tiene el ratón encima

  /**
   * ARRASTRAR TIENE QUE SER INMEDIATO, y por eso esto se calcula una vez.
   *
   * Mientras mueves el punto, la escena cambia en cada movimiento del ratón —
   * sesenta veces por segundo—. Dos cosas podrían no aguantar ese ritmo:
   *
   *   Releer el registro. No pasa: el guion se parsea UNA vez al abrir y queda
   *   en memoria como un array indexado por segundo. Saltar es indexar.
   *
   *   Rehacer los medidores. Ésta sí: son acumulados, así que al saltar al
   *   segundo 300 hay que saber cuánto llevaba cada uno EN el 300, y sumarlo
   *   sobre la marcha era recorrer trescientos segundos en cada movimiento.
   *   Se precalcula la suma corrida: una tabla de actores × segundos que para
   *   una pelea de quince minutos son quince mil números. Saltar pasa a ser
   *   una lectura.
   */
  const orden = new Map(g.actores.map((a, i) => [a.nombre, i]));
  const sumaCorrida = g.actores.map(() => new Float64Array(g.duracion + 1));
  for (let seg = 0; seg <= g.duracion; seg++) {
    if (seg > 0) for (const col of sumaCorrida) col[seg] = col[seg - 1];
    for (const x of g.segundos[seg] ?? []) {
      if (x.tipo !== 'daño' || !x.origen || x.propio) continue;
      const i = orden.get(x.origen);
      if (i !== undefined) sumaCorrida[i][seg] += x.cantidad;
    }
  }
  // Y las muertes, ordenadas: quién había caído en un segundo dado es una
  // búsqueda sobre una lista corta, no otro recorrido.
  const muertes = [];
  for (let seg = 0; seg <= g.duracion; seg++) {
    for (const x of g.segundos[seg] ?? []) if (x.tipo === 'muere') muertes.push({ s: seg, quien: x.destino });
  }

  const idDe = (n) => `fig-${String(n).replace(/[^a-zA-Z0-9]/g, '_')}`;

  // ── El escenario ───────────────────────────────────────
  const columna = (lista, lado) => `<div class="rp-col rp-${lado}">
    ${lista.map((a) => {
    const retrato = lado === 'enemigo' ? retratos.get(a.nombre) : null;
    const fig = a.mascota ? FIGURAS.mascota : (lado === 'enemigo' ? FIGURAS.enemigo : FIGURAS.jugador);
    return `<div class="rp-act ${a.esTu ? 'yo' : ''} fuera" data-act="${esc(a.nombre)}"
        data-desde="${a.desde ?? ''}" id="${idDe(a.nombre)}">
        <div class="rp-fig">
          ${retrato
    ? `<img class="rp-retrato" src="${esc(retrato)}" alt="">`
    : `<svg viewBox="0 0 48 60" class="rp-svg">${fig}</svg>`}
          <div class="rp-flot"></div>
        </div>
        <div class="rp-nom">${esc(a.nombre)}${a.mascota ? ` <i>${esc(t('rp.pet'))}</i>` : ''}</div>
        <div class="rp-dps"><b class="num">0</b> <span class="u">dps</span></div>
        <!--
          LA BARRA VA DEBAJO, no encima de la figura.
          Estaba arriba, que es por donde suben los flotantes: el nombre del
          hechizo y la barra quedaban tapados por un «stunned» y un «misses»
          justo encima. Se vio en una captura, no razonándolo — los dos
          elementos eran correctos por separado y compartían el mismo hueco.
        -->
        <div class="rp-cast"></div>
        <div class="rp-botin"></div>
      </div>`;
  }).join('')}
  </div>`;

  /**
   * LA LÍNEA DE TIEMPO ES LA GRÁFICA, no una barra lisa.
   *
   * Es la misma de la pantalla de combate, del mismo módulo, así que trae ya la
   * forma del daño segundo a segundo, las franjas de postura y las muertes. Y
   * aquí se le añaden los lanzamientos, que también tienen instante propio.
   *
   * Así la línea deja de ser tiempo y pasa a ser un mapa: arrastras hasta el
   * pico, o hasta donde cayó alguien, en vez de buscar a ciegas.
   *
   * SÓLO SE MARCA LO QUE TIENE INSTANTE MEDIDO. Una marca colocada por
   * proporción sería peor que ninguna, precisamente porque se arrastra hasta
   * ella: prometería que allí pasó algo.
   */
  const gr = grafica(f, { marcas: true });

  host.innerHTML = `<div class="rp">
    <div class="rp-barra">
      <button class="rp-play" id="rpPlay" title="${esc(t('rp.playHint'))}">▶</button>
      <div class="rp-vel">${VELOCIDADES.map((v) => `<button class="rp-v ${v === 1 ? 'on' : ''}" data-vel="${v}">×${v}</button>`).join('')}</div>
      <div class="rp-reloj"><b class="num" id="rpReloj">0:00</b> <span class="dim">/ ${esc(reloj(g.duracion))}</span></div>
      <div class="rp-nota eyebrow" id="rpNota"></div>
    </div>
    <div class="rp-tiempo" id="rpTiempo" title="${esc(t('rp.seekHint'))}">
      ${gr ? `${gr.band ? `<svg class="rp-band" viewBox="0 0 ${W} ${BAND}" preserveAspectRatio="none">${gr.band}</svg>` : ''}
        <svg class="rp-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${gr.svg}</svg>
        <div class="rp-hitos">${gr.hitos.map((h) => `<i class="rp-hito ${h.clase}"
          style="left:${(posEnTiempo(h.s, g.duracion) * 100).toFixed(3)}%" title="${esc(h.texto)}"></i>`).join('')}</div>`
    : `<div class="rp-lisa"></div>`}
      <div class="rp-cursor" id="rpCursor"></div>
      <button class="rp-punto" id="rpPunto" aria-label="${esc(t('rp.seekHint'))}"></button>
    </div>
    <div class="rp-pista" id="rpPista" role="group" aria-label="${esc(t('rp.pista.title'))}"></div>
    <div class="rp-escena">
      ${columna(aliados, 'aliado')}
      <div class="rp-medio"><div class="rp-vs eyebrow">${esc(t('rp.vs'))}</div></div>
      ${columna(enemigos, 'enemigo')}
    </div>
    ${sinBando.length ? `<div class="rp-sinbando">
      <div class="eyebrow">${esc(t('side.unknownAllies'))}</div>
      <div class="hint">${esc(t('side.unknownNote'))}</div>
      ${columna(sinBando, 'sinbando')}
    </div>` : ''}
    <div class="rp-texto" id="rpTexto"></div>
    ${fichaBotin(f, tardio)}
    <div class="hint" id="rpReglas"></div>
  </div>`;

  const $ = (id) => host.querySelector(`#${id}`);
  const elReloj = $('rpReloj'), elCursor = $('rpCursor'), elTexto = $('rpTexto');

  // ── La pista de cambios de estado ──────────────────────────────────────
  //
  // Se dibuja aparte de la plantilla porque NECESITA EL ANCHO REAL: el colapso
  // no se puede definir en segundos —una pelea de 1.434 s y otra de 84 caben en
  // el mismo ancho, así que en la larga dos segundos comparten píxel y en la
  // corta un segundo son diez— y ese ancho no existe hasta que el elemento está
  // en la página. Y se repinta al cambiar de tamaño, que es cuando el cubo deja
  // de valer.
  const elPista = $('rpPista');
  const sucesosPista = sucesosDePista(g, self);
  let marcasPista = [];             // {px, s, clase, n} ya colapsadas

  function pintarPista() {
    if (!elPista) return;
    const ancho = Math.round(elPista.getBoundingClientRect().width);
    if (!ancho) return;
    // Primero los estados con dos extremos, que son barras; lo que no dé para
    // barra vuelve a la cola de puntos. Ver `tramosDePista` y `barrasDePista`.
    const { tramos, sueltos } = tramosDePista(sucesosPista, g.duracion);
    const { barras, aPunto } = barrasDePista(tramos, g.duracion, ancho);
    marcasPista = marcasDePista([...sueltos, ...aPunto], g.duracion, ancho);
    elPista.innerHTML = pintaBarras(barras, reloj) + pintaMarcas(marcasPista, reloj);
  }

  /**
   * EL CUBO ES LA UNIDAD DE DIBUJO, NO LA DE PINCHAR.
   *
   * Cuatro píxeles se ven; acertarlos con el ratón, no. El objetivo es la marca
   * MÁS CERCANA dentro de `PX_CLIC`, no el cubo en el que caes. Una marca
   * visible que no se deja abrir es peor que no haberla dibujado.
   */
  function marcaCercana(clientX) {
    if (!marcasPista.length) return null;
    const caja = elPista.getBoundingClientRect();
    const x = clientX - caja.left;
    let mejor = null;
    for (const m of marcasPista) {
      const d = Math.abs(m.px - x);
      if (d <= PX_CLIC && (!mejor || d < mejor.d)) mejor = { m, d };
    }
    return mejor?.m ?? null;
  }
  const elPlay = $('rpPlay'), elNota = $('rpNota'), elPunto = $('rpPunto');

  const elReglas = $('rpReglas');
  elReglas.innerHTML = esc(t('rp.reglas', {
    pico: n0(reg.picoSegundo), mediana: n0(reg.medianaSeg),
  })) + (reg.conForma ? ` ${esc(t('rp.reglasForma'))}` : ` ${esc(t('rp.reglasSinForma'))}`);
  /**
   * Los umbrales también en crudo, sin formatear ni traducir.
   *
   * La muestra de la web se captura de aquí, y esta frase iba DENTRO del PNG:
   * en la página española salía en inglés, porque el idioma quedaba congelado
   * en la imagen. Ahora la muestra se recorta sin ella y la web la reescribe
   * con el diccionario del idioma que toque — pero las cifras tienen que ser
   * las medidas de esta pelea, no otras. Salen por aquí.
   */
  elReglas.dataset.pico = String(reg.picoSegundo);
  elReglas.dataset.mediana = String(reg.medianaSeg);
  elReglas.dataset.forma = reg.conForma ? '1' : '0';

  function reloj(seg) {
    return `${Math.floor(seg / 60)}:${String(Math.max(0, Math.round(seg % 60))).padStart(2, '0')}`;
  }

  // ── Flotantes ──────────────────────────────────────────
  function flotar(nombre, html, clase, i) {
    const act = host.querySelector(`#${idDe(nombre)} .rp-flot`);
    if (!act) return;
    const el = document.createElement('span');
    el.className = `rp-num ${clase}`;
    el.innerHTML = html;
    // Escalonado en ALTURA, no en tiempo: el orden se ve, el espaciado no se
    // inventa. Ver la cabecera del módulo.
    el.style.setProperty('--i', String(i));
    el.style.setProperty('--vida', `${vidaFlotante(1000 / velocidad)}ms`);
    act.appendChild(el);
    setTimeout(() => el.remove(), vidaFlotante(1000 / velocidad) + 60);
  }

  function pintarSegundo(seg) {
    const crudos = g.segundos[seg] ?? [];
    if (!crudos.length) return;
    const total = crudos.reduce((a, x) => a + (x.tipo === 'daño' ? x.cantidad : 0), 0);
    // Se agrupa a partir de ×2: a tiempo real la densidad es la del juego y se
    // lee; acelerado, no. Ver `agrupar`.
    const lista = agrupar(crudos, velocidad > 1);

    let i = 0;
    for (const x of lista) {
      const veces = x.veces > 1 ? ` <i class="rp-x">×${x.veces}</i>` : '';
      if (x.tipo === 'daño') {
        const marcas = [x.crit ? t('rp.crit') : '', x.contra ? t('rp.riposte') : '',
          x.frenesi ? t('rp.flurry') : ''].filter(Boolean).join(' ');
        flotar(x.destino, `${n0(x.cantidad)}${veces}${marcas ? `<i class="rp-marca">${esc(marcas)}</i>` : ''}`,
          `d-${claseTipo(x.escuela)}${x.crit ? ' crit' : ''}`, i++);
        if (x.origen && !x.propio) {
          medidores.set(x.origen, (medidores.get(x.origen) ?? 0) + x.cantidad);
        }
      } else if (x.tipo === 'evitado') {
        flotar(x.destino, `${esc(t(`rp.miss.${x.motivo}`) || x.motivo)}${veces}`, 'evit', i++);
      } else if (x.tipo === 'cura') {
        flotar(x.destino, `+${n0(x.cantidad)}${veces}`, 'cura', i++);
      } else if (x.tipo === 'muere') {
        flotar(x.destino, esc(t('rp.dies')), 'muere', i++);
        host.querySelector(`#${idDe(x.destino)}`)?.classList.add('caido');
      } else if (x.tipo === 'estado') {
        flotar(x.destino, esc(t(`rp.estado.${x.clase}`) || x.clase), 'estado', i++);
      } else if (x.tipo === 'lanza') {
        lanzarBarra(x);
      }
      // El que pega se mueve: es lo que hace que se vea quién actúa.
      if (x.origen && x.tipo === 'daño') {
        const el = host.querySelector(`#${idDe(x.origen)}`);
        if (el) { el.classList.add('golpea'); setTimeout(() => el.classList.remove('golpea'), 220); }
      }
    }

    // El panel de texto: lo que pasa el filtro, con el porqué al lado.
    for (const x of crudos) {
      const d = destacable(x, seg, reg, total);
      if (!d) continue;
      const linea = document.createElement('div');
      linea.className = `rp-l ${d.por}`;
      linea.innerHTML = `<span class="lt">${esc(reloj(seg))}</span>
        <span class="lx">${esc(frase(x))}</span>
        <span class="lp eyebrow">${esc(t(`rp.por.${d.por}`))}${
  d.p90 !== undefined ? ` ${esc(t('rp.porP90', { n: n0(d.p90) }))}` : ''}</span>`;
      elTexto.appendChild(linea);
      while (elTexto.children.length > 120) elTexto.firstChild.remove();
      elTexto.scrollTop = elTexto.scrollHeight;
    }
  }

  /**
   * LA BARRA DE CASTEO, con sus cuatro estados.
   *
   *   medido        se sabe cuánto suele tardar: barra que avanza.
   *   se pasó       tardó más de lo suyo. La barra llega llena a lo esperado y
   *                 SIGUE en otro color hasta donde acabó de verdad. Que un
   *                 hechizo de 4 s tardara 9 no es un detalle: algo lo retrasó,
   *                 y acabar tarde sin más lo escondería.
   *   instantáneo   sale en el mismo segundo, medido sobre ocho lanzamientos o
   *                 más. No hay barra porque no hay nada que recorrer.
   *   sin muestra   menos de ocho lanzamientos: NO SE SABE. También sin barra,
   *                 pero por lo contrario, y se rotula distinto — decir
   *                 «instantáneo» de un hechizo desconocido sería inventarlo.
   *
   * El interrumpido corta la barra donde lo cortaron a él, que es un instante
   * medido.
   */
  function lanzarBarra(x) {
    const el = host.querySelector(`#${idDe(x.origen)}`);
    if (!el) return;
    el.classList.add('lanzando');
    setTimeout(() => el.classList.remove('lanzando'), 300);

    const b = barraCasteo(casteos, x.habilidad, x.duro ?? null);
    const caja = el.querySelector('.rp-cast');
    if (!caja) return;
    const paso = 1000 / velocidad;
    const roto = x.desenlace === 'interrumpido';
    // Lo que se ve avanzar: lo que duró de verdad si consta, y si no, lo que
    // suele durar. Nunca una duración inventada.
    const segs = x.duro ?? b.esperado ?? 0;

    if (b.estado === 'medido' && segs > 0) {
      const pct = b.exceso > 0 ? (b.esperado / segs) * 100 : 100;
      caja.className = `rp-cast ${roto ? 'roto' : ''} ${b.exceso > 0 ? 'pasado' : ''}`;
      caja.innerHTML = `<span class="rp-cast-n">${esc(x.habilidad)}</span>
        <span class="rp-cast-t"><i style="--pct:${pct.toFixed(1)}%;--dur:${segs * paso}ms"></i></span>`;
      caja.title = b.exceso > 0
        ? t('rp.cast.pasado', { que: x.habilidad, esp: b.esperado, real: segs, n: b.n })
        : t('rp.cast.medido', { que: x.habilidad, esp: b.esperado, n: b.n });
    } else {
      caja.className = `rp-cast sinbarra ${b.estado === 'instantaneo' ? 'ya' : 'nose'}`;
      caja.innerHTML = `<span class="rp-cast-n">${esc(x.habilidad)}</span>
        <span class="rp-cast-m">${esc(t(b.estado === 'instantaneo' ? 'rp.cast.ya' : 'rp.cast.nose'))}</span>`;
      caja.title = b.estado === 'instantaneo'
        ? t('rp.cast.yaNota', { n: b.n }) : t('rp.cast.noseNota', { n: b.n });
    }
    clearTimeout(caja._t);
    caja._t = setTimeout(() => { caja.className = 'rp-cast'; caja.innerHTML = ''; },
      Math.max(600, segs * paso + 400));
  }

  /**
   * EL RESUMEN DE UN COMBATIENTE, HASTA EL SEGUNDO EN EL QUE ESTÁS.
   *
   * Es la misma caja que el rótulo de la tabla de combate, y a propósito NO el
   * mismo contenido: allí describe una pelea cerrada y son sus totales; aquí
   * describe lo que se lleva. Enseñar el total final mientras el reloj va por
   * el segundo diez contaría el desenlace antes de tiempo, y encima
   * contradiría al medidor de debajo de la figura, que sí es acumulado.
   *
   * Se recorre el guion hasta `s` en el momento de pedirlo. Son unos miles de
   * sucesos en la pelea más larga del histórico: se nota menos que el retardo
   * de aparecer.
   */
  function resumenHasta(nombre, hasta) {
    const r = {
      dano: 0, recibido: 0, curado: 0, curaRecibida: 0,
      golpes: 0, fallos: 0, crits: 0, max: 0,
      porTipo: new Map(), porHabilidad: new Map(), caido: false,
    };
    for (let i = 0; i <= hasta; i++) {
      for (const x of g.segundos[i] ?? []) {
        if (x.tipo === 'daño') {
          if (x.origen === nombre && !x.propio) {
            r.dano += x.cantidad; r.golpes++;
            if (x.crit) r.crits++;
            if (x.cantidad > r.max) r.max = x.cantidad;
            const ty = claseTipo(x.escuela);
            r.porTipo.set(ty, (r.porTipo.get(ty) ?? 0) + x.cantidad);
            const h = x.habilidad ?? x.escuela;
            r.porHabilidad.set(h, (r.porHabilidad.get(h) ?? 0) + x.cantidad);
          }
          if (x.destino === nombre) r.recibido += x.cantidad;
        } else if (x.tipo === 'evitado') {
          if (x.origen === nombre) r.fallos++;
        } else if (x.tipo === 'cura') {
          if (x.origen === nombre) r.curado += x.cantidad;
          if (x.destino === nombre) r.curaRecibida += x.cantidad;
        } else if (x.tipo === 'muere' && x.destino === nombre) r.caido = true;
      }
    }
    return r;
  }

  function pintarRotulo(nombre) {
    const a = g.actores.find((x) => x.nombre === nombre);
    if (!a) return;
    const r = resumenHasta(nombre, s);
    const seg = Math.max(1, s);
    const intentos = r.golpes + r.fallos;
    const fila = (k, v) => `<span class="eyebrow">${esc(k)}</span><b class="num">${v}</b>`;
    const total = r.dano || 1;
    mostrarRotulo(`<div class="tip-head">${esc(nombre)}${
      r.caido ? ` <i class="dim">${esc(t('rp.dies'))}</i>` : ''}</div>
      <div class="tip-grid">
        ${fila('dps', n1(r.dano / seg))}
        ${fila(t('det.dmg'), n0(r.dano))}
        ${intentos ? fila(t('row.accuracy'), `${Math.round((r.golpes / intentos) * 100)}% · ${r.golpes}/${intentos}`) : ''}
        ${r.crits ? fila(t('row.crits'), r.crits) : ''}
        ${r.max ? fila(t('row.max'), n0(r.max)) : ''}
        ${r.recibido ? fila(t('row.taken'), n0(r.recibido)) : ''}
        ${r.curado ? fila(t('det.healDone'), n0(r.curado)) : ''}
        ${r.curaRecibida ? fila(t('det.healTaken'), n0(r.curaRecibida)) : ''}
      </div>
      ${r.porTipo.size ? `<div class="tip-types">${[...r.porTipo].sort((x, y) => y[1] - x[1])
        .map(([ty, v]) => `<div class="tip-type"><i class="seg ${ty}"></i><span>${esc(ty)}</span>
          <b class="num">${n0(v)}</b><span class="num dim">${Math.round((v / total) * 100)}%</span></div>`).join('')}</div>` : ''}
      ${r.porHabilidad.size ? `<div class="tip-abils">${[...r.porHabilidad].sort((x, y) => y[1] - x[1]).slice(0, 4)
        .map(([h, v]) => `<div class="tip-type"><span>${esc(h)}</span><b class="num">${n0(v)}</b></div>`).join('')}</div>` : ''}
      <div class="tip-foot eyebrow">${esc(t('rp.tipFoot', { t: reloj(s) }))}</div>`);
  }

  function frase(x) {
    if (x.tipo === 'muere') return t('rp.f.muere', { quien: x.destino, por: x.origen ?? '—' });
    if (x.tipo === 'lanza') return t('rp.f.lanza', { quien: x.origen, que: x.habilidad });
    if (x.tipo === 'daño') {
      return t('rp.f.dano', { quien: x.origen ?? '—', a: x.destino ?? '—',
        n: n0(x.cantidad), que: x.habilidad ?? x.escuela });
    }
    if (x.tipo === 'estado') return t('rp.f.estado', { quien: x.destino, que: t(`rp.estado.${x.clase}`) });
    return '';
  }

  function pintarMedidores() {
    const transcurrido = Math.max(1, s);
    for (const a of g.actores) {
      const el = host.querySelector(`#${idDe(a.nombre)} .rp-dps b`);
      if (el) el.textContent = n0((medidores.get(a.nombre) ?? 0) / transcurrido);
    }
  }

  /**
   * Quién está en el escenario ahora mismo.
   *
   * Se recalcula en cada segundo y en cada salto, no sólo al entrar: al
   * arrastrar hacia atrás el que llegó tarde tiene que volver a irse, o la
   * reproducción enseñaría el reparto del final sobre el principio.
   */
  /**
   * EL BOTÍN, DEBAJO DE QUIEN LO SOLTÓ.
   *
   * Y CADA OBJETO EN SU SEGUNDO, no todos de golpe al morir. El registro sella
   * cada línea de botín por su cuenta: en la pelea de referencia el bicho cae
   * en el 67 y sus dos objetos se recogen en el 67 y el 69, y el del segundo
   * enemigo en el 78 cuando cayó en el 77. Sacarlos todos en el instante de la
   * muerte sería juntar tres instantes medidos en uno inventado.
   *
   * Se quedan puestos a partir de ahí: un objeto recogido no se descoge.
   */
  const botin = (f?.loot ?? []).filter((l) => l && l.from && l.item);
  function pintarBotin() {
    const porQuien = new Map();
    for (const l of botin) {
      if ((l.t ?? 0) > s) continue;
      if (!porQuien.has(l.from)) porQuien.set(l.from, []);
      porQuien.get(l.from).push(l);
    }
    for (const el of host.querySelectorAll('.rp-act')) {
      const caja = el.querySelector('.rp-botin');
      if (!caja) continue;
      const lista = porQuien.get(el.dataset.act) ?? [];
      const firma = lista.map((l) => `${l.item}×${l.qty ?? 1}`).join('|');
      if (caja.dataset.sig === firma) continue;
      caja.dataset.sig = firma;
      caja.innerHTML = lista.map((l) => `<i class="rp-obj" data-obj="${esc(l.item)}"
        >${esc(l.item)}${(l.qty ?? 1) > 1 ? ` ×${l.qty}` : ''}</i>`).join('');
    }
  }

  function pintarPresentes() {
    for (const el of host.querySelectorAll('.rp-act')) {
      const d = el.dataset.desde;
      // Sin instante de entrada no llegó a aparecer en el registro: nunca sale.
      const dentro = d !== '' && d !== undefined && Number(d) <= s;
      // El que entra justo ahora se anuncia con su llegada; el que ya estaba,
      // no. Sin esto, saltar hacia adelante haría «entrar» a todos otra vez.
      if (dentro && el.classList.contains('fuera') && Number(d) === s) {
        el.classList.add('entra');
        setTimeout(() => el.classList.remove('entra'), 400);
      }
      el.classList.toggle('fuera', !dentro);
    }
  }

  function pintarReloj() {
    elReloj.textContent = reloj(s);
    const pct = `${(posEnTiempo(s, g.duracion) * 100).toFixed(3)}%`;
    elCursor.style.left = pct;
    elPunto.style.left = pct;    // el punto se mueve solo mientras reproduce
    pintarPresentes();
    pintarBotin();
    pintarMedidores();
    if (sobre && rotuloVisible()) pintarRotulo(sobre);
  }

  // ── El bucle ───────────────────────────────────────────
  function tic(ahora) {
    if (!corriendo) return;
    const paso = 1000 / velocidad;
    acumulado += ahora - ultimo;
    ultimo = ahora;
    // Con la pestaña en segundo plano el navegador para el rAF y al volver
    // llegaría un salto enorme: se limita a tres pasos por cuadro.
    let n = 0;
    while (acumulado >= paso && n < 3) {
      acumulado -= paso; n++;
      if (s >= g.duracion) { parar(); pintarReloj(); return; }
      s++;
      pintarSegundo(s);
    }
    if (n) pintarReloj();
    raf = requestAnimationFrame(tic);
  }

  function arrancar() {
    if (corriendo) return;
    if (s >= g.duracion) irA(0);
    corriendo = true;
    ultimo = performance.now();
    acumulado = 0;
    elPlay.textContent = '⏸';
    raf = requestAnimationFrame(tic);
  }
  function parar() {
    corriendo = false;
    elPlay.textContent = '▶';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  /**
   * Saltar a un segundo.
   *
   * Los medidores se recalculan desde el principio hasta ahí: son acumulados, y
   * saltar sin rehacerlos enseñaría el dps de otro momento. Es una suma sobre
   * unos cientos de sucesos, así que se hace y no se aproxima.
   */
  function irA(seg) {
    const antes = s;
    s = Math.max(0, Math.min(g.duracion, Math.round(seg)));
    if (s === antes) return;
    // Lectura de la suma corrida, no un recorrido: ver `sumaCorrida`.
    medidores.clear();
    for (const [nombre, i] of orden) medidores.set(nombre, sumaCorrida[i][s]);
    // Quién había caído ya, para no enseñar de pie a un muerto.
    host.querySelectorAll('.rp-act.caido').forEach((el) => el.classList.remove('caido'));
    for (const m of muertes) {
      if (m.s > s) break;
      host.querySelector(`#${idDe(m.quien)}`)?.classList.add('caido');
    }
    // Los flotantes de donde estabas no valen para donde vas.
    host.querySelectorAll('.rp-num').forEach((el) => el.remove());
    elTexto.innerHTML = '';
    pintarReloj();
  }

  // ── Controles ──────────────────────────────────────────
  // El resumen al pasar por encima, y se actualiza solo mientras corre: es lo
  // que se lleva HASTA AHORA, así que quedarse quieto sería mentir a los dos
  // segundos.
  host.querySelectorAll('.rp-act').forEach((el) => {
    el.addEventListener('mouseenter', () => { sobre = el.dataset.act; pintarRotulo(sobre); });
    el.addEventListener('mouseleave', () => { sobre = null; ocultarRotulo(); });
  });

  // La ficha del objeto es la misma que en la lista de botín de la pelea: se
  // pide hacia fuera en vez de traerse aquí el cliente de la wiki, que ya vive
  // en la pantalla principal. Delegado porque la caja del escenario se repinta.
  host.addEventListener('mouseover', (e) => {
    const o = e.target.closest?.('.rp-obj');
    if (o) onObjeto?.(o.dataset.obj);
  });
  host.addEventListener('mouseout', (e) => {
    if (e.target.closest?.('.rp-obj')) onObjetoFuera?.();
  });

  elPlay.addEventListener('click', () => (corriendo ? parar() : arrancar()));
  host.querySelectorAll('.rp-v').forEach((b) => b.addEventListener('click', () => {
    velocidad = +b.dataset.vel;
    host.querySelectorAll('.rp-v').forEach((x) => x.classList.toggle('on', x === b));
    elNota.textContent = velocidad > 1 ? t('rp.agrupado') : '';
  }));

  /**
   * EL PUNTO: se arrastra y la escena va cambiando mientras se mueve.
   *
   * Tres cosas que lo hacen comportarse como un reproductor y no como un
   * formulario:
   *
   *   Mientras arrastras, cada movimiento coloca la escena en ESE segundo. No
   *   se espera a soltar. Es una lectura, así que aguanta el ritmo del ratón —
   *   ver `sumaCorrida`.
   *
   *   Al empezar a arrastrar se PAUSA, y al soltar sigue desde donde lo dejaste
   *   si estaba corriendo. Reanudar desde el principio sería castigar el gesto
   *   de mirar.
   *
   *   Y el punto se mueve solo mientras reproduce: es dónde estás.
   */
  const barra = $('rpTiempo');
  let veniaCorriendo = false;
  const desdeRaton = (e) => {
    const r = barra.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    irA(frac * g.duracion);
  };
  const empezar = (e) => {
    e.preventDefault();
    barra.setPointerCapture?.(e.pointerId);
    barra.dataset.arrastrando = '1';
    veniaCorriendo = corriendo;
    if (corriendo) parar();
    desdeRaton(e);
  };
  barra.addEventListener('pointerdown', empezar);
  barra.addEventListener('pointermove', (e) => { if (barra.dataset.arrastrando) desdeRaton(e); });
  const soltar = (e) => {
    if (!barra.dataset.arrastrando) return;
    delete barra.dataset.arrastrando;
    barra.releasePointerCapture?.(e.pointerId);
    // Desde donde lo dejaste, no desde el principio.
    if (veniaCorriendo) arrancar();
    veniaCorriendo = false;
  };
  barra.addEventListener('pointerup', soltar);
  barra.addEventListener('pointercancel', soltar);

  // Espacio para pausar: es lo que espera cualquiera que haya visto un vídeo.
  const teclas = (e) => {
    if (e.code === 'Space') { e.preventDefault(); corriendo ? parar() : arrancar(); }
    else if (e.code === 'ArrowRight') irA(s + 1);
    else if (e.code === 'ArrowLeft') irA(s - 1);
  };
  document.addEventListener('keydown', teclas);

  /**
   * PINCHAR UNA MARCA LLEVA A SU SEGUNDO, que es lo que se quiere hacer al
   * verla. Y el objetivo se busca por cercanía, no por el cubo: ver `marcaCercana`.
   */
  elPista?.addEventListener('click', (e) => {
    const m = marcaCercana(e.clientX);
    if (m) irA(m.s);
  });

  pintarPista();
  /**
   * Y SE REPINTA AL CAMBIAR DE TAMAÑO, porque el cubo de colapso sale del ancho
   * REAL: la misma pelea pasa de 838 px a 2.003 al maximizar, y marcas que
   * compartían cubo dejan de compartirlo. Sin esto, la pista se quedaría con el
   * colapso del tamaño que tuviera al abrirse.
   */
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => pintarPista()) : null;
  if (observador && elPista) observador.observe(elPista);

  pintarReloj();
  return {
    destruir() {
      parar();
      ocultarRotulo();
      document.removeEventListener('keydown', teclas);
      observador?.disconnect();
    },
    guion: g,
  };
}
