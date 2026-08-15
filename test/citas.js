/**
 * EL ENVOLTORIO MANDA SOBRE EL CONTENIDO.
 *
 * ── LA REGLA QUE ESTA BATERÍA GUARDA ──────────────────────────────────────
 *
 * Una línea que cita algo se reconoce como CITA antes de que nadie lea lo que
 * hay dentro de las comillas. Aunque el envoltorio sea raro y el contenido
 * frecuente.
 *
 * Y detrás, la razón, que es más grande que el parser:
 *
 *     LO QUE TECLEA UN DESCONOCIDO NO ENTRA NUNCA EN UNA MEDICIÓN NUESTRA.
 *
 * Todo lo que dice esta aplicación se sostiene sobre «medido del registro». El
 * registro contiene texto escrito por gente, y ese texto es entrada de usuario:
 * no es evidencia de nada salvo de que alguien la escribió.
 *
 * ── EL AGUJERO QUE LA MOTIVA, MEDIDO ──────────────────────────────────────
 *
 * Las pistas del parser se ordenaban por FRECUENCIA, que es una optimización.
 * Medido antes del arreglo: la pista `of damage` quedaba en la posición 2 de
 * 123 y ` says` en la 72, así que la regla del CONTENIDO se probaba antes que
 * la del ENVOLTORIO. Lo único que impedía la confusión era que las reglas de
 * daño están ancladas al final y la comilla de cierre rompía la coincidencia:
 * un accidente de la expresión regular, no una decisión.
 *
 * Y se caía en cuanto la comilla no estaba, que es LA PRIMERA LÍNEA DE UN
 * MENSAJE MULTILÍNEA — el texto sigue abajo, así que arriba no cierra:
 *
 *     You say to your guild, 'Campeon hits a dracoliche for 999999 points of damage.
 *        -> melee  amount=999999
 *
 * Sobre el registro de Miguel: 32.659 líneas abren cita y 8 no la cierran.
 * Ninguna de las 8 llevaba una cifra dentro. Suerte, y medida.
 *
 * ── EL MISMO FENÓMENO, POR LOS DOS LADOS ──────────────────────────────────
 *
 * Un mensaje de chat partido en varias líneas nos ataca por arriba y por abajo
 * a la vez: la PRIMERA línea es ésta —abre comilla y no cierra— y las SIGUIENTES
 * son las 18 que no traen cabecera `[hora]` y que el parser descarta antes de
 * clasificar. Las dos caras del mismo mensaje.
 */
import { Parser } from '../src/parser.js';
import { HINTS } from '../src/patterns.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};
const H = '[Sat Aug 15 12:00:00 2026] ';
const lee = (txt) => new Parser({ self: 'Campeon' }).parse(H + txt, 0);

// ═══ 1. El caso construido, que es el que costaba ════════════════════════
console.log('\nuna cita sin comilla de cierre no es daño');
{
  const ev = lee("You say to your guild, 'Campeon hits a dracoliche for 999999 points of damage.");
  ok(ev?.kind === 'chat', 'la línea de gremio con 999999 dentro se clasifica como CHAT', ev?.kind);
  ok(ev?.amount === undefined, 'y no trae importe ninguno', ev?.amount);

  const muerte = lee("Fulano tells the guild, 'a dracoliche has been slain by Campeon!");
  ok(muerte?.kind === 'chat', 'y una muerte inventada en el chat tampoco es una muerte', muerte?.kind);
}

// ═══ 2. Y lo de siempre sigue funcionando ════════════════════════════════
//
// La mitad que impide «arreglarlo» mandando todo a chat: si esto se pone rojo,
// el parser ha dejado de medir.
console.log('\ny el daño de verdad se sigue leyendo');
{
  const ev = lee('Campeon slashes a dracoliche for 500 points of damage.');
  ok(ev?.kind === 'melee' && ev.amount === 500, 'un golpe real es un golpe real', `${ev?.kind} ${ev?.amount}`);

  const cerrada = lee("Fulano says, 'Campeon slashes a dracoliche for 500 points of damage.'");
  ok(cerrada?.kind === 'chat', 'la cita cerrada sigue siendo cita', cerrada?.kind);

  const tell = lee("Fulano tells you, 'hola que tal'");
  ok(tell?.kind === 'chat' && tell.text === 'hola que tal',
    'y el texto de un susurro normal se extrae entero', JSON.stringify(tell?.text));
}

// ═══ 3. La mascota, que es una cita ESPECÍFICA ═══════════════════════════
//
// Aquí se rompió el primer intento. `Jobarn says, 'My leader is Campeon.'` es
// una cita antes que una declaración de mascota, así que acarrear sólo las
// reglas de chat se la llevaba la genérica y la mascota dejaba de reconocerse.
// Lo específico manda sobre lo genérico DENTRO del envoltorio.
console.log('\nlo específico manda sobre lo genérico');
{
  const lider = lee("Jobarn says, 'My leader is Campeon.'");
  ok(lider?.kind === 'pet_leader' && lider.pet === 'Jobarn',
    'la declaración de líder se sigue leyendo, no la reclama el chat', lider?.kind);

  const claim = lee("Jobarn told you, 'Attacking a dracoliche Master.'");
  ok(claim?.kind === 'pet_claim' && claim.pet === 'Jobarn',
    'y el susurro de tu mascota tampoco', claim?.kind);
}

// ═══ 4. EL ORDEN, como propiedad ════════════════════════════════════════
//
// Las tres de arriba comprueban el efecto; ésta comprueba la CAUSA. Sin ella,
// alguien puede volver a ordenar por frecuencia y arreglar los síntomas uno a
// uno sin enterarse de que ha reabierto el agujero.
console.log('\nlas pistas de cita se prueban antes que las de contenido');
{
  const iDam = HINTS.indexOf('of damage');
  const iSays = HINTS.indexOf(' says');
  const iTells = HINTS.indexOf(' tells ');
  const iLider = HINTS.indexOf('My leader is');
  ok(iSays >= 0 && iSays < iDam, `« says» (${iSays}) va antes que «of damage» (${iDam})`);
  ok(iTells >= 0 && iTells < iDam, `« tells » (${iTells}) va antes que «of damage» (${iDam})`);
  ok(iLider >= 0 && iLider < iSays, `«My leader is» (${iLider}) va antes que « says» (${iSays})`);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
