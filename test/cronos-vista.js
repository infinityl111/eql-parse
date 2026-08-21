/**
 * REAPARICIONES DECLARA QUÉ PRODUCE, SIN ABRIR ELECTRON.
 *
 * Ésta es la vara de la reconstrucción, y la puso Campeón: si al terminar hace
 * falta arrancar la aplicación para saber qué rótulos salen, la sección no ha
 * aprovechado el módulo.
 *
 * Lo mismo costó **siete causas y dos tandas** con `bin/rotulos.js` —la carpeta
 * de datos, el asistente, el tamaño del registro, el sello del almacén, las
 * mayúsculas del CSS…— y ninguna era del programa. Aquí cuesta una llamada.
 *
 * ── LAS DOS DIRECCIONES, Y SON FALLOS DISTINTOS ───────────────────────────
 *
 *   · una clave DECLARADA que ninguna llamada produce  → rótulo muerto
 *   · una clave PRODUCIDA que no está declarada        → la declaración miente
 *
 * Las dos salen rojas. La segunda importa igual: si `CLAVES` se queda corta,
 * esta prueba deja de cubrir lo que dice cubrir y volvemos a necesitar Electron
 * sin enterarnos.
 */
import * as V from '../ui/cronos-vista.js';
import { ESTADO, puedeAfirmarDiscrepancia, MIN_OBS_DISCREPA } from '../src/cronos.js';
import * as V2 from '../src/cronos.js';
import { t, setLang, TRANSLATED } from '../src/i18n.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};
setLang('es');

const ficha = (over = {}) => ({
  crono: { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 2, muertes: 3, ...(over.crono ?? {}) },
  estado: {
    estado: ESTADO.CONTANDO, restante: 600, restanteTxt: '10:00', transcurrido: 60,
    valor: { fuente: 'wiki', segundos: 1320, zonaTxt: '22:00', pagina: 'eqlwiki.com/X' },
    ...(over.estado ?? {}),
  },
  obs: { observaciones: 3, muertes: 4, minimo: 900, ...(over.obs ?? {}) },
});

/** Todos los estados que la sección sabe producir, en una sola cadena. */
function todoElHtml() {
  const trozos = [];
  trozos.push(V.construye({ fichas: [] }));                       // vacío
  trozos.push(V.construye({ fichas: [ficha()] }));                // contando, wiki
  trozos.push(V.construye({
    fichas: [ficha({ estado: { estado: ESTADO.SIN_MUERTE, transcurrido: 0, valor: {} } })],
  }));                                                            // esperando
  trozos.push(V.construye({
    fichas: [ficha({ estado: { estado: ESTADO.SIN_MUERTE, transcurrido: 900, valor: {} } })],
  }));                                                            // aunNo
  trozos.push(V.construye({
    fichas: [ficha({ estado: { estado: ESTADO.CERO, valor: {} } })],
  }));                                                            // disponible
  for (const n of [0, 1, 5]) trozos.push(V.construye({ fichas: [ficha({ obs: { observaciones: n } })] }));
  trozos.push(V.construye({ fichas: [ficha({ crono: { base: null, diff: null } })] }));   // sin zona
  trozos.push(V.construye({ fichas: [ficha({ crono: { aviso: 'varios-a-la-vez' } })] }));
  trozos.push(V.construye({ fichas: [ficha({ crono: { aviso: 'probablemente-varios' } })] }));
  trozos.push(V.construye({ fichas: [ficha({ estado: { aviso: 'quizá-no-vemos-su-muerte' } })] }));
  trozos.push(V.construye({
    fichas: [ficha({
      estado: {
        valor: {
          fuente: 'manual', segundos: 300, segundosTxt: '05:00', zonaTxt: '22:00',
          discrepa: 600, discrepaWiki: 420,
        },
      },
    })],
  }));                                                            // discrepa y discrepaWiki
  // LA COTA, con un hueco y con varios: son dos rotulos distintos.
  trozos.push(V.construye({
    fichas: [ficha({ crono: { cota: { txt: '10:19', huecos: 1 } } })],
  }));
  trozos.push(V.construye({
    fichas: [ficha({ crono: { cota: { txt: '10:19', huecos: 10 } } })],
  }));
  // EL VISTO, en sus tres lecturas.
  trozos.push(V.construye({
    fichas: [ficha({ crono: { visto: { txt: '3s', esta: true } } })],
  }));
  trozos.push(V.construye({
    fichas: [ficha({ crono: { visto: { desdeTxt: '12m' } } })],
  }));
  trozos.push(V.construye({
    fichas: [ficha({
      crono: { cota: { txt: '10:19', huecos: 10 }, visto: { desdeTxt: '12m', pasado: true } },
    })],
  }));
  // La pestaña de alta, VACÍA: el histórico sin una sola muerte.
  trozos.push(V.construye({ fichas: [], vista: 'sug', candidatos: [] }));
  /**
   * Y CON CANDIDATOS. Los dos casos del recuento —una muerte y varias— y las
   * dos formas de la última columna: el que se puede seguir y el que ya se
   * sigue. Sin las cuatro, cuatro rótulos quedarían declarados y sin producir.
   */
  trozos.push(V.construye({
    fichas: [],
    vista: 'sug',
    candidatos: [
      { nombre: 'Ancient Croaker', base: 'The Ruins of Old Guk', diff: 2, mode: null,
        diffLabel: 'D2 Adaptive', muertes: 5, peleas: 4, ultimaTxt: '20 ago', ya: false },
      { nombre: 'a kobold king', base: null, diff: null, mode: null,
        muertes: 1, peleas: 1, ultimaTxt: '11 ago', ya: true },
    ],
  }));
  return trozos.join('\n');
}

console.log('\nla sección declara qué produce, y lo produce');
{
  const html = todoElHtml();
  /**
   * LA MARCA SE SACA SIN SUSTITUIR LAS VARIABLES.
   *
   * Antes se llamaba a `t(k, {n: 3})` y luego se partía por llaves — que ya no
   * existían, porque acababan de sustituirse. Así que la marca era el texto
   * ENTERO con un 3 dentro, y el HTML llevaba un 4: no casaba nunca.
   * `cro.aunNo` salía muerto estando delante. Es la misma trampa de comparar
   * por apariencia, ahora dentro de mi propia prueba.
   *
   * Y se coge el trozo MÁS LARGO, no el primero: «{n} observaciones» empieza por
   * la variable, así que el primero es la cadena vacía y `cro.obsN` salía muerto
   * por la misma razón con otra cara.
   */
  const marca = (k) => t(k).split(/\{[^}]*\}/).map((x) => x.trim())
    .sort((a, b) => b.length - a.length)[0] ?? '';
  const sinCaso = V.CLAVES.filter((k) => {
    const m = marca(k).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return !m || !html.includes(m);
  });
  ok(sinCaso.length === 0, 'ninguna clave declarada sin caso que la genere',
    sinCaso.length ? sinCaso.join(', ') : `${V.CLAVES.length} claves, todas alcanzadas`);

  ok(V.CLAVES.length >= 20, 'CONTROL: la declaración no está vacía', V.CLAVES.length);
  ok(html.length > 3000, 'CONTROL: y el HTML se ha construido de verdad', `${html.length} caracteres`);
  ok(!/\{[a-z]+\}/i.test(html), 'no queda ninguna llave sin sustituir');
}

console.log('\ny no produce ninguna clave que no haya declarado');
{
  const html = todoElHtml();
  const usadas = new Set();
  // Se recorre el diccionario entero: si un texto `cro.*` aparece en el HTML y
  // no está declarado, la declaración miente.
  setLang('es');
  const fs = await import('node:fs');
  const dic = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
  const es = dic.slice(dic.indexOf('const ES = {'), dic.indexOf('const EN = {'));
  for (const m of es.matchAll(/'(cro\.[a-zA-Z0-9.]+)': "((?:[^"\\]|\\.)*)"/g)) {
    const texto = m[2].split(/\{[^}]*\}/)[0].trim();
    if (texto.length > 8 && html.includes(texto)) usadas.add(m[1]);
  }
  const noDeclaradas = [...usadas].filter((k) => !V.CLAVES.includes(k));
  ok(noDeclaradas.length === 0, 'todo lo que sale está declarado', noDeclaradas.join(', '));
}

console.log('\nlas decisiones son funciones, no ramas dentro de una plantilla');
{
  ok(V.claveDelCuerpo({ estado: ESTADO.SIN_MUERTE, transcurrido: 0 }) === 'cro.esperando',
    'sin muerte y sin tiempo transcurrido: esperando');
  ok(V.claveDelCuerpo({ estado: ESTADO.SIN_MUERTE, transcurrido: 90 }) === 'cro.aunNo',
    'murió y no sabemos su tiempo: aún no', 'la rama que se dio por muerta de memoria');
  ok(V.claveDelCuerpo({ estado: ESTADO.CONTANDO }) === null,
    'contando no lleva rótulo: lleva número');
  ok(V.clavesDeObservacion(0).cuenta === 'cro.obs0'
    && V.clavesDeObservacion(1).cuenta === 'cro.obs1'
    && V.clavesDeObservacion(9).cuenta === 'cro.obsN', 'el recuento elige su forma');
  ok(V.clavesDeObservacion(1).nota === 'cro.obsPocas' && V.clavesDeObservacion(2).nota === 'cro.retenido',
    'con menos de dos observaciones no se da cifra');
  ok(!V.clavesDeAviso({ aviso: 'quizá-no-vemos-su-muerte' }, {}).length,
    'el aviso de sospecha ya NO sale',
    'era una suposición, y el visto es un hecho que la sustituye');
  ok(!V.CLAVES.includes('cro.sospecha'), 'y no queda declarado',
    'una clave declarada que nadie produce es un rótulo muerto');
}

console.log('\nla lectura del visto es pura, y «ahora» entra por parametro');
{
  /**
   * ESTO VIVIA EN EL PINTOR, y por eso la unica forma de ejercitar «esta ahi»
   * era que la sonda escribiera una linea reciente y la aplicacion la pintara
   * antes de que pasaran 161 segundos — corriendo contra el reloj de arranque,
   * que tarda minutos. Una prueba que depende de lo que tarde en abrirse un
   * programa no es una prueba.
   */
  const c = { segundos: 600 };
  const r = (o) => V2.lecturaDelVisto({ ahora: 1000, cota: c, ...o });
  ok(r({ visto: { t: 997 } })?.esta === true, 'visto hace 3s: esta ahi');
  ok(r({ visto: { t: 800 } })?.esta === false, 'visto hace 200s: ya no se afirma',
    'el corte es el mismo suelo que usa la cota');
  ok(r({ ultimaMuerte: 100 })?.pasado === true,
    'sin mencion y con el techo pasado: deberia estar y no lo has visto',
    'de un bicho que muere en todas sus peleas no hay ninguna mencion posterior');
  ok(r({ ultimaMuerte: 900 })?.pasado === false, 'y dentro del techo, no se afirma eso');
  ok(r({}) === null, 'sin mencion y sin muerte no se dice nada',
    'CONTROL: y no un cero, que se leeria como «no se le ve desde hace 0»');
}

console.log('\nla discrepancia no se afirma sin poder afirmarla');
{
  ok(puedeAfirmarDiscrepancia({ observaciones: MIN_OBS_DISCREPA, multiplicidad: 0 }),
    'con observaciones de sobra y un solo bicho, SÍ');
  ok(!puedeAfirmarDiscrepancia({ observaciones: MIN_OBS_DISCREPA - 1, multiplicidad: 0 }),
    'con dos observaciones, no', 'dos puntos son dos puntos');
  ok(!puedeAfirmarDiscrepancia({ observaciones: 40, multiplicidad: 2 }),
    'con VARIOS individuos demostrados, NO — por muchas que haya',
    'de un nombre del que hay cuarenta no sabemos cuál volvió');
  ok(puedeAfirmarDiscrepancia({ observaciones: 5, multiplicidad: 0 }),
    'CONTROL: y multiplicidad 0 no es «hay uno», es «no se ha demostrado que haya más»');
}

console.log('\nla firma no lleva dentro lo que cambia cada segundo');
{
  /**
   * ESTO ES LA GUARDA DEL CAMPO QUE NO DEJABA ESCRIBIR, ahora comprobable.
   *
   * `pintaEstable` usa `construye(modelo, false)` como firma y reconstruye la
   * sección cuando cambia. Si la cuenta atrás entrara en ella, cambiaría cada
   * segundo y el campo se destruiría mientras se escribe — el fallo que trajo
   * Campeón, de vuelta por la puerta de atrás de la migración.
   *
   * Antes esto sólo se podía ver levantando Electron y tecleando. Ahora es una
   * comparación de cadenas, porque el constructor es puro.
   */
  const enElInstante = (seg) => ({
    fichas: [ficha({ estado: { restante: seg, restanteTxt: `0${Math.floor(seg / 60)}:00` } })],
  });
  ok(V.construye(enElInstante(600), false) === V.construye(enElInstante(120), false),
    'dos instantes distintos dan la MISMA firma', 'la sección no se reconstruye al tic');
  ok(V.construye(enElInstante(600), true) !== V.construye(enElInstante(120), true),
    'CONTROL: y con los números puestos sí se distinguen',
    'si no, el verde de arriba sería el de una plantilla que no imprime nada');
  ok(V.construye(enElInstante(600), false)
    !== V.construye({ fichas: [ficha(), ficha({ crono: { nombre: 'otro' } })] }, false),
    'y un crono más SÍ cambia la firma', 'lo que no es volátil tiene que reconstruir');
}

console.log('\nla procedencia se ve sin desplegar');
{
  const html = V.construye({ fichas: [ficha()] });
  // EL SUMMARY DE LA FILA, no el primero del documento: la leyenda tambien es un
  // <details>, asi que su summary va antes. Lo cazo la propia prueba.
  const fila = html.slice(html.indexOf('<details class="pz-fila"'));
  const summary = fila.slice(fila.indexOf('<summary'), fila.indexOf('</summary>'));
  for (const f of ['tuyo', 'zona', 'visto']) {
    ok(summary.includes(`pz-f-${f}`), `«${t(`pz.src.${f}`)}» va en la fila, no en el cuerpo`);
  }
  ok(summary.includes('cro-dequien'), 'y el número dice de quién es');
}

console.log('\nlos cinco idiomas');
for (const l of TRANSLATED) {
  setLang(l);
  const faltan = V.CLAVES.filter((k) => { const v = t(k); return !v || v === k; });
  ok(faltan.length === 0, `${l}: las ${V.CLAVES.length} claves`, faltan.join(', '));
}
setLang('es');

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
