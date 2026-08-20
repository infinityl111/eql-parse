/**
 * NADIE PUEDE VOLVER A REPINTAR ENCIMA DE UN CAMPO EDITABLE.
 *
 * ── EL FALLO, CUATRO VECES ────────────────────────────────────────────────
 *
 * El motor empuja un snapshot **cada 250 ms**. Una función de pintado que
 * reescribe su `innerHTML` en cada pasada destruye y recrea sus `<input>`
 * cuatro veces por segundo, y entonces NO SE PUEDE ESCRIBIR en ellos: la letra
 * recién tecleada se va con el nodo viejo.
 *
 * Pasó en el asistente, en la pantalla de configuración, en la lista de peleas
 * —donde el buscador «se cansaba» a la cuarta letra— y en Reapariciones, que es
 * donde lo encontró Campeón y no nosotros. Las tres primeras se arreglaron
 * **escribiendo la guarda entera otra vez en cada sitio**, y la cuarta no copió
 * ninguna, porque copiar un patrón exige acordarse de que existe.
 *
 *     UN PATRÓN HAY QUE RECORDARLO. UNA PRUEBA, NO.
 *
 * ── QUÉ SE EXIGE ──────────────────────────────────────────────────────────
 *
 * Toda función de `ui/app.js` que reescriba DOM con `innerHTML` metiendo dentro
 * un campo editable tiene que pasar por `pintaEstable(...)` —que compara, no
 * toca el DOM si nada cambió, y conserva foco, valor y cursor cuando sí hay que
 * reconstruir— o estar declarada abajo con el motivo de por qué no.
 *
 * ── LA CICATRIZ DE ESTA PRUEBA, QUE ES LA MITAD DE LO QUE ENSEÑA ──────────
 *
 * La primera versión del detector daba por guardada cualquier función donde
 * apareciera una firma escrita (`host.dataset.algoSig = ...`), sin comprobar
 * que además se LEYERA. Al darle el fichero real con la comparación quitada
 * —dejando la escritura— **seguía diciendo verde**. Un control sintético habría
 * pasado; el del artefacto real lo cazó.
 *
 * Por eso el CONTROL POSITIVO de abajo trabaja sobre `ui/app.js` de verdad: le
 * quita la llamada y exige que el detector la eche de menos. Si ese control
 * deja de fallar, esta prueba está en verde vigilando nada.
 *
 * ⚠ Mira el fuente y no ejecuta nada: no hay DOM en las pruebas de este
 * proyecto, y el fallo no está en lo que se pinta sino en CUÁNTAS VECES.
 * La comprobación viva —teclear de verdad y mirar si el nodo sobrevive— es
 * `bin/ui-teclear.js`, que necesita abrir la aplicación.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(DIR, '..', 'ui', 'app.js');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** Corta el fuente en funciones de primer nivel y devuelve sus cuerpos. */
function funciones(txt) {
  const lineas = txt.split(/\r?\n/);
  const RE = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
  const out = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = RE.exec(lineas[i]);
    if (m) out.push({ nombre: m[1], desde: i + 1 });
  }
  for (let k = 0; k < out.length; k++) {
    out[k].hasta = (out[k + 1]?.desde ?? lineas.length + 1) - 1;
    out[k].cuerpo = lineas.slice(out[k].desde - 1, out[k].hasta).join('\n');
  }
  return out;
}

const REESCRIBE = /\b\w[\w.$?]*\.innerHTML\s*=/;
const EDITABLE = /<input\b|<textarea\b|contenteditable/i;
const LLAMA_AL_HELPER = /\bpintaEstable\s*\(/;

/**
 * LAS QUE ESTÁN GUARDADAS EN OTRO SITIO, cada una con su motivo escrito.
 *
 * Esto FIJA EL CASO, no la guarda. Si aparece una función nueva que reescribe
 * DOM con un campo dentro, esta prueba se pone roja y hay que MIRARLA: o llama
 * a `pintaEstable`, o entra aquí con su razón. Lo que no puede pasar es que
 * entre sola y sin que nadie la vea, que es exactamente como entró la de
 * Reapariciones.
 */
const GUARDADAS_FUERA = {
  renderWizard: 'el llamador monta una sola vez (if (!$(wzCard) && !state.wzMounting))',
  renderSummary: 'el llamador monta una sola vez (if (!$(sumRoot)) renderSummary())',
  renderChrome: 'el campo fMerge va en un bloque con su propia firma dataset.sig',
  renderNarrate: 'el llamador monta una sola vez (if ($(narrateBox)) return) y luego sólo repinta a mano',
};

/** Corta comentarios: un `<input>` citado en una explicación no es un campo. */
const sinComentarios = (txt) => txt
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/** Las que reescriben DOM con un campo editable dentro. */
function conCampoEditable(txt) {
  return funciones(txt)
    .map((f) => ({ ...f, limpio: sinComentarios(f.cuerpo) }))
    .filter((f) => REESCRIBE.test(f.limpio) && EDITABLE.test(f.limpio))
    // El propio ayudante reescribe y es quien guarda: no se vigila a sí mismo.
    .filter((f) => f.nombre !== 'pintaEstable');
}

/** Y de ésas, las que no pasan por el ayudante ni están declaradas arriba. */
const desprotegidas = (txt) => conCampoEditable(txt)
  .filter((f) => !LLAMA_AL_HELPER.test(f.limpio) && !(f.nombre in GUARDADAS_FUERA));

const fuente = fs.readFileSync(APP, 'utf8');

console.log('\nla guarda es una FUNCIÓN, no un patrón que haya que recordar');
ok(/function pintaEstable\s*\(/.test(fuente), 'ui/app.js define pintaEstable()');
ok(/function focoDentroDe\s*\(/.test(fuente) && /function devuelveFoco\s*\(/.test(fuente),
  'y conserva el foco: focoDentroDe() y devuelveFoco()');
ok(/setSelectionRange/.test(fuente),
  'y la POSICIÓN DEL CURSOR, no sólo el valor',
  'conservar sólo el valor deja el cursor saltando al final');

console.log('\nninguna función repinta sobre un campo editable sin guarda');
const candidatas = conCampoEditable(fuente);
const sueltas = desprotegidas(fuente);
ok(sueltas.length === 0, 'ninguna función desprotegida',
  sueltas.length ? sueltas.map((f) => `${f.nombre}:${f.desde}`).join(', ')
    : `${candidatas.length} candidatas, todas guardadas`);

console.log('\nlas declaradas siguen existiendo (si una se borra, sobra de la lista)');
for (const [n, motivo] of Object.entries(GUARDADAS_FUERA)) {
  ok(candidatas.some((f) => f.nombre === n), `${n} sigue en el fichero`, motivo);
}

console.log('\nCONTROL POSITIVO sobre el artefacto real, no sobre uno de juguete');
/**
 * NO BASTA CON RENOMBRAR LA LLAMADA. Al convertir una función, el `innerHTML`
 * se va dentro del ayudante, así que la función deja de ser candidata: quitarle
 * sólo el nombre la vuelve invisible al detector en vez de dejarla enferma, y
 * el control salía verde sin cazar nada. Lo comprobado a la primera.
 *
 * Así que el enfermo es EL CÓDIGO QUE DE VERDAD SE PUBLICÓ: se le devuelve el
 * `innerHTML` en crudo, que es tal cual estaba el día que Campeón no pudo
 * escribir.
 */
const enfermo = fuente.replace(
  /const modo = pintaEstable\(host, paginaDe,[\s\S]*?\}, 'croSig'\);/,
  'host.innerHTML = paginaDe(true);');
ok(enfermo !== fuente, 'se ha podido devolver renderCronos a su forma enferma',
  enfermo === fuente ? 'la llamada ha cambiado de forma: ACTUALIZA ESTE CONTROL' : '');
const cazadas = desprotegidas(enfermo);
ok(cazadas.some((f) => f.nombre === 'renderCronos'),
  'y así el detector la caza',
  cazadas.map((f) => f.nombre).join(', ') || 'NO CAZÓ NADA — la prueba estaría vigilando nada');

// Y lo mismo con la lista de peleas, que era la cuarta copia a mano.
const enfermo2 = fuente.replace(
  /if \(pintaEstable\(list, \(\) => html, null, 'sig'\) === 'refrescado'\) return;/,
  'list.innerHTML = html;');
ok(enfermo2 !== fuente, 'y se ha podido con renderFightList');
ok(desprotegidas(enfermo2).some((f) => f.nombre === 'renderFightList'),
  'y también la caza');

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
