/**
 * N FIGURAS POR NOMBRE, con el caso de Miguel dentro.
 *
 * LO QUE VE HOY, con sus palabras: «se ve morir a uno y se le sigue pegando al
 * cadáver». Había UNA figura por nombre, así que la primera muerte la apagaba y
 * el segundo bicho igual seguía pegando desde un dibujo gris. Medido sobre el
 * histórico: pasa en 394 peleas de 1.474 —una de cada cuatro— y son 2.306
 * figuras que faltan por dibujar.
 *
 * EL CASO QUE ESTRENA ESTA BATERÍA es suyo y real: 5 de agosto, 00:56:15, The
 * Ruins of Old Guk, «a shin ghoul knight» ×4 en 88 segundos. Hoy es una figura
 * que se apaga en la primera muerte y a la que se le sigue pegando durante las
 * otras tres.
 */
import { muertesPorNombre, sueloDeNombre, suelosDe } from '../src/suelo.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── El caso real ──────────────────────────────────────────────────────────
console.log('\nlos cuatro «a shin ghoul knight» del 5 de agosto');
{
  const kills = ['a shin ghoul knight', 'a shin ghoul knight',
    'a shin ghoul knight', 'a shin ghoul knight'];
  const m = muertesPorNombre(kills);
  ok(m.get('a shin ghoul knight') === 4, 'se cuentan las cuatro muertes', String(m.get('a shin ghoul knight')));

  // Sin actividad después de la cuarta: cuatro bichos, cuatro figuras.
  const sinDespues = suelosDe(kills, () => false);
  ok(sinDespues.get('a shin ghoul knight') === 4,
    'cuatro figuras, no una', String(sinDespues.get('a shin ghoul knight')));

  // Con líneas suyas después de la última muerte, el suelo sube: había un
  // quinto. Es el razonamiento de Miguel — un muerto no pega.
  const conDespues = suelosDe(kills, () => true);
  ok(conDespues.get('a shin ghoul knight') === 5,
    'y cinco si el nombre sigue dando señales después de la última',
    String(conDespues.get('a shin ghoul knight')));
}

// ── La regla que faltaba ──────────────────────────────────────────────────
console.log('\nuna figura no se apaga mientras haya líneas suyas después');
{
  // El caso mínimo: una muerte y actividad posterior. Con una sola figura, esa
  // actividad sale de un cadáver. Con dos, sale del que sigue vivo.
  ok(sueloDeNombre(1, true) === 2, 'una muerte y líneas después: eran dos');
  ok(sueloDeNombre(1, false) === 1, 'una muerte y silencio: era uno');
  ok(sueloDeNombre(0, false) === 1, 'sin muertes, el que está delante');
  ok(sueloDeNombre(3, true) === 4, 'tres muertes y líneas después: cuatro');
}

// ── La mayúscula, que ya nos costó 25 abatidos ────────────────────────────
console.log('\ny se cuenta igual con la mayúscula de abrir frase');
{
  // EQ escribe «A shin ghoul knight has been slain» al abrir frase y
  // «a shin ghoul knight» a mitad. Si el recuento no las junta, un nombre sale
  // con menos muertes de las que tuvo — que es exactamente lo que le pasó al
  // bestiario con `orc legionnaire`. Ver la deuda en `src/store.js`.
  const m = muertesPorNombre(['Orc legionnaire', 'orc legionnaire', 'Orc legionnaire']);
  ok(m.size === 1, 'las dos formas son el mismo nombre', `${m.size} entradas`);
  ok(m.get('orc legionnaire') === 3, 'y suman tres muertes', String(m.get('orc legionnaire')));
}

// ── El recuento es UNO, compartido con el título ──────────────────────────
console.log('\nel título y las figuras cuentan con la misma función');
{
  // No se comprueba que los dos números coincidan —eso lo garantiza compartir
  // el módulo— sino que el módulo existe y lo usan los dos. Si alguien vuelve
  // a contar a mano en `engine.js`, esto no lo caza; lo caza la revisión. Lo
  // que sí se fija aquí es la FORMA del rótulo, que es lo que se lee.
  const m = muertesPorNombre(['a gorgon', 'a gorgon', 'a spectre']);
  const rotulo = [...m].map(([n, x]) => (x > 1 ? `${n} ×${x}` : n)).join(', ');
  ok(rotulo === 'a gorgon ×2, a spectre', 'el rótulo dice «×2» donde hay dos', rotulo);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
