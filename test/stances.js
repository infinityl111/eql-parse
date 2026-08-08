/**
 * Invariantes del modelo de posturas.
 *
 * Esto no comprueba que Evasive valga 0,95. Comprueba la CLASE de fallo que
 * hizo que Evasive estuviera mal durante siete versiones: meter una evasión en
 * el campo de mitigación.
 *
 * Son dos efectos que se parecen en la tabla y no se parecen en nada al
 * medirlos. Mitigar reduce cada golpe que entra, así que del daño del log se
 * puede reconstruir el original dividiendo. Evadir quita el golpe entero, así
 * que el golpe que aparece en el log llegó completo y no hay nada que revertir:
 * dividirlo le inventa daño que nunca tuvo, y cuanto mayor es el porcentaje,
 * más grande es la mentira. Con 0,95 en el campo equivocado, cada golpe se
 * multiplicaba por veinte.
 *
 * Por eso las comprobaciones van sobre la forma de la tabla y no sobre sus
 * números: cualquier postura futura que repita la confusión falla aquí, aunque
 * nadie se acuerde de por qué existe este fichero.
 */
import { STANCES, INVOCATIONS, mitigationFor, CLASSES, availableFor } from '../src/stances.js';
import { liveAdvice } from '../src/advisor.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

/**
 * Mitigación máxima creíble para una reducción POR GOLPE.
 *
 * La mayor de EQL es el 50% de Defensive. El margen deja sitio a que el juego
 * suba alguna, pero no a que quepa una evasión disfrazada: un 0,95 aquí
 * significa casi siempre que alguien ha confundido los dos efectos.
 */
const MAX_MIT = 0.60;
/** Y por tanto, cuánto puede llegar a multiplicar la reversión un golpe. */
const MAX_FACTOR = 1 / (1 - MAX_MIT);   // 2,5×

/** Modelos de coste conocidos y qué efecto implica cada uno. */
const COSTES = {
  free: 'ninguno',
  mitigated: 'mitiga',    // 1 de vigor por punto reducido
  split: 'mitiga',        // mitad a vigor, mitad a maná
  evaded2: 'evade',       // 2 de vigor por punto EVITADO
  dealt: 'ofensiva',      // vigor por daño infligido
};

const SCHOOLS = ['melee', 'spell', 'dot', 'ds'];
const entradas = Object.entries(STANCES);

console.log('\nforma de la tabla de posturas');
for (const [key, s] of entradas) {
  ok(!!s.label && !!s.noteKey, `${key}: tiene etiqueta y nota`);
  ok(Array.isArray(s.classes) && s.classes.length > 0, `${key}: declara clases`);
  ok(s.classes.every((c) => CLASSES.includes(c)), `${key}: todas sus clases existen`);
  ok(COSTES[s.costModel] !== undefined, `${key}: modelo de coste conocido`, s.costModel);
}

console.log('\nmitigar y evadir no se confunden');
for (const [key, s] of entradas) {
  const mits = Object.values(s.mit ?? {});
  const evades = Object.values(s.evade ?? {});
  const efecto = COSTES[s.costModel];

  // 1. Nadie declara una mitigación por golpe fuera de lo creíble. Es la
  //    comprobación que habría cazado el 0,95 de Evasive el primer día.
  for (const v of mits) {
    ok(v >= 0 && v <= MAX_MIT, `${key}: mitigación dentro de lo creíble (<= ${MAX_MIT})`, String(v));
  }

  // 2. Quien paga por punto EVITADO no puede expresar su efecto como
  //    mitigación: son cosas distintas y se miden distinto.
  if (efecto === 'evade') {
    ok(mits.every((v) => v === 0),
      `${key}: paga por punto evitado, así que no declara mitigación`, JSON.stringify(s.mit));
    ok(evades.some((v) => v > 0),
      `${key}: y sí declara evasión`, JSON.stringify(s.evade ?? null));
  }

  // 3. Y al revés: quien paga por punto mitigado tiene que mitigar algo y no
  //    puede colar una evasión por la puerta de atrás.
  if (efecto === 'mitiga') {
    ok(mits.some((v) => v > 0), `${key}: paga por punto mitigado, así que mitiga algo`);
    ok(evades.length === 0 || evades.every((v) => v === 0),
      `${key}: y no declara evasión`, JSON.stringify(s.evade ?? null));
  }

  // 4. Una postura ofensiva o gratuita no cobra por defender.
  if (efecto === 'ofensiva') {
    ok(mits.every((v) => v === 0) && evades.every((v) => v === 0),
      `${key}: es ofensiva, no declara defensa`);
  }
}

console.log('\nla reversión del daño recibido está acotada');
// Es la consecuencia directa del fallo: el log guarda el daño ya mitigado y el
// parser lo revierte. Ese factor es lo que se le multiplica a cada golpe, así
// que es lo que hay que vigilar.
for (const [key] of entradas) {
  for (const escuela of SCHOOLS) {
    const red = mitigationFor(key, escuela);
    const factor = red > 0 && red < 1 ? 1 / (1 - red) : 1;
    ok(factor <= MAX_FACTOR + 1e-9,
      `${key}/${escuela}: un golpe recibido se multiplica como mucho por ${MAX_FACTOR}`,
      `×${factor.toFixed(2)}`);
  }
}
// Y ninguna reversión puede ser infinita ni negativa, pase lo que pase.
for (const [key] of entradas) {
  for (const escuela of SCHOOLS) {
    const red = mitigationFor(key, escuela);
    ok(Number.isFinite(red) && red >= 0 && red < 1, `${key}/${escuela}: reducción en [0,1)`, String(red));
  }
}

console.log('\ntoda postura declarada se puede puntuar');
// Una postura que no declara ni defensa ni ofensiva existiría en la tabla y no
// aparecería en ningún consejo: estaría ahí sin que nadie la viera.
for (const [key, s] of entradas) {
  const defiende = Object.values(s.mit ?? {}).some((v) => v > 0)
    || Object.values(s.evade ?? {}).some((v) => v > 0);
  const ataca = !!(s.meleeBonus || s.skillWeapon || s.hit || s.selfDamage);
  ok(defiende || ataca, `${key}: aporta algo medible, defensivo u ofensivo`);
}

console.log('\ninvocaciones');
for (const [key, iv] of Object.entries(INVOCATIONS)) {
  ok(!!iv.label && !!iv.noteKey, `${key}: tiene etiqueta y nota`);
  ok(Array.isArray(iv.classes) && iv.classes.every((c) => CLASSES.includes(c)),
    `${key}: todas sus clases existen`);
  ok(Array.isArray(iv.good) && iv.good.length > 0, `${key}: declara para qué sirve`);
}

/**
 * LA POSTURA QUE LLEVAS PUESTA ESTÁ DISPONIBLE, POR DEFINICIÓN.
 *
 * El consejo de postura salía de `availableFor(clases)`, y las clases muchas
 * veces se deducen. Cuando se deducían mal o no se deducían, pasaba lo peor que
 * puede pasar con un aviso: no salía ninguno, y sin decir por qué.
 *
 * Caso real, seis peleas contra Eye of Veeshan. En esa sesión el registro había
 * visto Channeler, Defensive, Mage Hunter, Offensive y Berserker. Con Berserker
 * de por medio, `inferClasses` no encuentra un trío único y se queda con lo
 * común a todos los candidatos: BER a secas. Y BER no tiene ni Defensive ni
 * Channeler, así que la lista de posturas a comparar traía Balanced y Mage
 * Hunter, la postura que llevabas puesta ni siquiera estaba en ella —y
 * `suggest` exige encontrarla para poder comparar—, y el aviso no salió nunca.
 *
 * Con el reparto de esas peleas —dos tercios del daño no era melé— Channeler
 * evitaba un 9,5% más del daño total que Defensive: por encima del umbral del
 * 8%, o sea justo el aviso que tenía que haber salido.
 */
console.log('\nlo que se te ha visto usar, lo tienes');
{
  // Ni una sola clase: es el caso de «no se ha podido deducir nada».
  const vacio = availableFor([]);
  ok(vacio.stances.length === 0, 'sin clases y sin nada visto, no hay nada que comparar');

  const visto = availableFor([], ['a channeler stance', 'defensive']);
  const claves = visto.stances.map((s) => s.key).sort();
  ok(claves.join(',') === 'channeler,defensive',
    'pero lo visto en el registro entra aunque no haya clases', claves.join(','));

  // El caso exacto del fallo: la deducción se queda en BER y la postura que
  // llevabas puesta no está en su lista.
  const ber = availableFor(['BER']);
  ok(!ber.stances.some((s) => s.key === 'channeler'),
    'BER por sí sola no trae Channeler: así se quedaba fuera la que usabas');
  const berVisto = availableFor(['BER'], ['channeler', 'defensive']);
  ok(berVisto.stances.some((s) => s.key === 'channeler')
    && berVisto.stances.some((s) => s.key === 'defensive'),
    'con lo visto, las dos vuelven a la comparación');
  ok(berVisto.stances.some((s) => s.key === 'berserker'),
    'y lo que aportan las clases no se pierde: se suma');

  // Y no se cuela cualquier cosa: sólo lo que existe.
  ok(!availableFor([], ['una postura inventada']).stances.length,
    'un nombre que no es una postura no crea ninguna');
}

/**
 * Y la consecuencia medible: con la postura en la lista, el consejo compara y
 * avisa. Con el reparto real de aquellas peleas —12.300 no melé y 6.662 melé—
 * Channeler evita más que Defensive, que es lo contrario de lo que pasa cuando
 * casi todo el daño es físico.
 */
console.log('\nel aviso que no salía');
{
  const win = { melee: 6662, spell: 12300, total: 18962, observed: 18962,
    seconds: 20, hits: 60, landedMelee: 40, meleeSwings: 60 };

  const sinVer = liveAdvice(win, { classes: ['BER'], stance: 'defensive' });
  ok(!sinVer || !sinVer.suggest,
    'antes: con las clases mal deducidas no se sugería nada');

  const conVer = liveAdvice(win, { classes: ['BER'], stance: 'defensive',
    seenStances: ['defensive', 'channeler'] });
  ok(!!conVer, 'ahora hay consejo');
  ok(conVer.bestKey === 'channeler',
    'y la mejor con este reparto es Channeler, no Defensive', conVer.bestKey);
  ok(conVer.suggest === true, 'y se sugiere: la mejora pasa del umbral',
    `${Math.round(conVer.worth * 100)}%`);

  // La otra mitad: con el daño casi todo melé, Defensive gana y no se sugiere
  // cambiar. Si esto se cayera, el consejo estaría empujando a Channeler
  // siempre, que es un fallo tan malo como no avisar.
  const fisico = { melee: 17000, spell: 1900, total: 18900, observed: 18900,
    seconds: 20, hits: 60, landedMelee: 40, meleeSwings: 60 };
  const conFisico = liveAdvice(fisico, { classes: ['BER'], stance: 'defensive',
    seenStances: ['defensive', 'channeler'] });
  ok(conFisico.bestKey === 'defensive',
    'con casi todo melé, Defensive sigue siendo la mejor', conFisico.bestKey);
  ok(conFisico.suggest === false, 'y no se sugiere cambiar de la que ya llevas');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
