/**
 * «IDENTIFICADO» NO ES UNA PROPIEDAD DEL COMBATIENTE, ERA UNA DEL MOMENTO.
 *
 * ── EL CASO, DE UNA CAPTURA DE LA APLICACIÓN EN USO ────────────────────────
 *
 * `Loneker` sale a la vez bajo el rótulo «Sin identificar» y sumando en «dps de
 * los tuyos». En el almacén, tres peleas seguidas en la misma zona:
 *
 *     id=2085  15:00:51   pet: true    unidentified: false   8.400
 *     id=2086  15:06:07   pet: true    unidentified: false   8.282
 *     id=2087  15:11:26   pet: false   unidentified: TRUE    3.869
 *
 * Diez minutos, el mismo bicho, la misma zona. Lo que cambió entre medias fue
 * que se invocó otra mascota.
 *
 * ── LA CAUSA, QUE ES LA TERCERA VEZ QUE APARECE ────────────────────────────
 *
 *     SE PERSISTE LO OBSERVADO; SE RECALCULA LO DERIVADO.
 *
 * `unidentified` es DERIVADO y se guardaba como HECHO. Se calculaba con lo que
 * se sabía EN LA SESIÓN en que se cerró la pelea, y sus dos fuentes vivían sólo
 * en memoria: `whoSeen` no se escribía a disco, y `petSet` sólo guarda la
 * mascota ACTUAL —al invocar otra, la anterior deja de ser tuya para el motor—.
 *
 * `whoSeen` ya se persiste, en `who.json` (ver el último bloque). `petSet` no
 * hace falta persistirlo: `pets.json` es su sustituto acumulado y ya estaba.
 *
 * Medido sobre el almacén real: **369 de 1.894 peleas (19,5 %)** tenían a
 * alguien sin identificar sumando en el total. Recalculando al leer: **248
 * (13,1 %)**. Y el trabajo lo hace entero `pets.json`, que ya estaba en disco y
 * ya llegaba al lector: nadie la consultaba para decidir el rótulo.
 *
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO, no un observable: decide qué cuenta como
 * «identificado». Si se pone roja hay que leerla, no acallarla.
 */
import { identificado, ensureIdentidad } from '../src/aggregate.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const CTX = {
  self: 'Campeon',
  companions: new Set(['Kalforgelp', 'Notarino']),
  knownPets: new Set(['Loneker', 'Gonartik', 'Jarektik']),
  notPets: new Set(['Jarektik']),
  whoSeen: new Set(['Armadeath']),
};
const fila = (name, extra = {}) => ({ name, side: 'ally', damage: 100, ...extra });

console.log('\nel caso de la captura: Loneker');
{
  /**
   * La pelea de las 15:11, tal como está guardada: sin `pet`, marcada como
   * desconocida. Con la regla nueva se resuelve, porque `Loneker` está en las
   * mascotas conocidas — que es un dato de DISCO, no de sesión.
   */
  const guardada = fila('Loneker', { pet: false, unidentified: true });
  ok(identificado(guardada, CTX), 'Loneker se identifica por las mascotas conocidas');

  const [r] = ensureIdentidad([guardada], CTX);
  ok(r.unidentified === false, 'y la fila deja de estar sin identificar', r.unidentified);
  ok(r !== guardada, 'sin tocar la original: se devuelve otra fila');

  /**
   * Y la clave de por qué esto es un arreglo y no un parche: la MISMA fila, con
   * el `unidentified` guardado a false, tampoco se toca. La regla no respeta el
   * valor viejo, lo sustituye — mira el mundo, no lo que se creyó ayer.
   */
  const antes = fila('Loneker', { pet: true, unidentified: false });
  ok(ensureIdentidad([antes], CTX)[0].unidentified === false,
    'y las dos peleas de antes siguen igual: el rótulo deja de depender del momento');
}

console.log('\nno se mira `pet` de otra pelea, que sería arreglar un derivado con otro');
{
  /**
   * `pet` sale de `petSet`, o sea del mismo estado de sesión que causó el fallo.
   * Comprobado sobre el almacén: de los 144 nombres con `pet:true` en alguna
   * pelea, los 144 están en `pets.json`. La regla no pierde nada por no mirarlo.
   */
  const desconocido = fila('Zzz', { pet: true });
  ok(!identificado(desconocido, CTX),
    '`pet: true` por sí solo NO identifica: no es una fuente observada');
}

console.log('\nel control negativo: no se inventa a nadie');
{
  /**
   * Sin esto, todo lo de arriba pasaría en verde con una regla que devolviera
   * `true` siempre — que es justo el fallo que este cambio podría introducir.
   * Estos veinte son jugadores ajenos reales del almacén, de una sola aparición
   * cada uno: alguien que pasaba y le pegó a tu bicho. Tienen que seguir
   * saliendo sin identificar, porque es exactamente lo que son.
   */
  const AJENOS = ['Jaxx', 'Dunkeld', 'Mistell', 'Diobolica', 'Scrooge', 'Rednex', 'Motleycrue'];
  const filas = AJENOS.map((n) => fila(n));
  const salida = ensureIdentidad(filas, CTX);
  const sinIdentificar = salida.filter((r) => r.unidentified).length;
  ok(sinIdentificar === AJENOS.length,
    'CONTROL: los siete jugadores ajenos siguen sin identificar',
    `${sinIdentificar} de ${AJENOS.length}`);
}

console.log('\nel posesivo necesita su guarda o convierte un bicho en aliado');
{
  ok(identificado(fila('Notarino`s warder'), CTX),
    'la mascota de un compañero DECLARADO se identifica');
  /**
   * `Innoruuk`s Chosen` está en el almacén y es un BICHO. Sin exigir que el
   * dueño sea tuyo o declarado, la regla del posesivo lo haría aliado tuyo.
   */
  ok(!identificado(fila('Innoruuk`s Chosen'), CTX),
    'CONTROL: pero `Innoruuk`s Chosen` es un bicho y NO se identifica');
  ok(identificado(fila('Campeon`s pet'), CTX), 'y la tuya también, claro');
}

console.log('\nlo que declaras se aplica también a lo de ayer');
{
  /**
   * Esto mueve casos en los DOS sentidos, y es a propósito: es la misma regla
   * que ya rigen los compañeros y las exclusiones. Si dijiste que `Jarektik` no
   * es tuya, las peleas de la semana pasada dejan de decir que sí.
   */
  const j = fila('Jarektik', { unidentified: false });
  ok(!identificado(j, CTX), '`notPets` desidentifica, aunque estuviera en las conocidas');
  ok(ensureIdentidad([j], CTX)[0].unidentified === true,
    'y la fila guardada como identificada pasa a no estarlo');

  const sinDeclarar = { ...CTX, notPets: new Set() };
  ok(identificado(fila('Jarektik'), sinDeclarar),
    'CONTROL: sin esa declaración sí se identificaría — la que manda es la declaración');
}

console.log('\nlos enemigos no entran en esto');
{
  const e = { name: 'a greater skeleton', side: 'enemy', unidentified: true };
  ok(ensureIdentidad([e], CTX)[0] === e,
    'una fila de enemigo se devuelve tal cual, sin tocar');
  ok(identificado(fila('a greater skeleton', { charmed: true }), CTX),
    'pero un bicho ENCANTADO por alguien sí se identifica: consta lo que es');
}

console.log('\nun /who identifica, y por eso se persiste');
{
  /**
   * LA DISTINCIÓN QUE HACE QUE ESTO NO CONTRADIGA LA REGLA, y es toda la
   * cuestión:
   *
   *   el `/who` es LO OBSERVADO       -> se persiste, en `who.json`
   *   «es de los tuyos» es DERIVADO   -> no se guarda, se recalcula al leer
   *
   * Un `/who` no dice que alguien sea tuyo. Dice QUIÉN es. Y «sin identificar»
   * significa exactamente que no se sabe quién es, así que con la línea delante
   * el rótulo es falso.
   *
   * `whoSeen` vivía sólo en memoria (`src/engine.js`), y por eso la misma
   * persona salía identificada en la pelea de las 21:14 y desconocida en la de
   * las 21:19. Medido: costaba 4 filas del residuo, las únicas que se perdían
   * de verdad.
   */
  ok(identificado(fila('Armadeath'), CTX),
    'alguien de quien hay un /who NO está sin identificar');

  /**
   * Y el control, que es lo que impide que esto se convierta en «todo el mundo
   * está identificado»: sin la línea, el mismo nombre sigue siendo desconocido.
   * Lo que identifica es la observación, no la regla.
   */
  const sinWho = { ...CTX, whoSeen: new Set() };
  ok(!identificado(fila('Armadeath'), sinWho),
    'CONTROL: sin la línea del /who, el mismo nombre sigue siendo un desconocido');

  /**
   * Y no invierte el bando: un `/who` sobre alguien no lo hace tuyo, sólo
   * conocido. La fila sigue siendo de quien era.
   */
  const [r] = ensureIdentidad([fila('Armadeath', { unidentified: true })], CTX);
  ok(r.unidentified === false && r.side === 'ally',
    'identificarlo no le cambia el bando: dice quién es, no de quién es');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
