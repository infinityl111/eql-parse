/**
 * Ningún verbo de golpe se queda fuera y tira daño en silencio.
 *
 * EL FALLO. `smites` y `shoots` no estaban en la tabla de verbos, así que las
 * líneas que los usan no casaban con ningún molde y la aplicación las tiraba
 * enteras. Sobre un registro real: 961 líneas y 18.675 puntos de daño que
 * nunca llegaron a ninguna cifra.
 *
 * NO ES UNA MEJORA, ES UN FALLO DE DATOS. Casi todas son de un mismo
 * compañero, y a él le veníamos dando un número mal en cada pelea en grupo sin
 * que pudiera saberlo. Kalforgelp pasa de 613.528 a 632.203 — un 3,0% de lo
 * suyo, y es el 22,4% del daño de las 74 peleas en las que sale.
 *
 * LA MAGNITUD, MEDIDA. Al descubrirlo se dijo que era «la mayor parte de su
 * daño». No lo era: es un 3%. Queda escrito porque la diferencia entre un 3% y
 * un 90% cambia lo urgente que es, y una cifra dicha de memoria no vale.
 *
 * CÓMO SE ENCONTRÓ, que es lo reutilizable: contando las líneas que el
 * analizador da por desconocidas y que aun así tienen la forma «alguien VERBO
 * a alguien for N points». Si la forma está y el verbo no, es daño perdido.
 * Quedan 22.000 líneas sin reconocer por mirar con la misma lupa.
 */
import { Parser } from '../src/parser.js';
import { MELEE_VERBS } from '../src/patterns.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const parse = (cuerpo) => new Parser({ self: 'Campeon' })
  .parse(`[Fri Aug 07 20:00:00 2026] ${cuerpo}`);

console.log('\nlos verbos que faltaban');
{
  const a = parse('Kalforgelp smites a wan ghoul knight for 40 points of damage.');
  ok(a?.kind === 'melee', '«smites» es un golpe, no una línea desconocida', a?.kind);
  ok(a?.source === 'Kalforgelp' && a?.target === 'a wan ghoul knight',
    'con su autor y su objetivo', `${a?.source} -> ${a?.target}`);
  ok(a?.amount === 40, 'y su cifra, que es lo que se perdía', a?.amount);

  const b = parse('Kalforgelp shoots a dar ghoul knight for 52 points of damage.');
  ok(b?.kind === 'melee' && b?.amount === 52, '«shoots» también', `${b?.kind} ${b?.amount}`);
}

// En primera persona y con marca al final, que es otro molde.
console.log('\nen primera persona');
{
  const a = parse('You smite a ghoul for 12 points of damage. (Critical)');
  ok(a?.kind === 'melee' && a?.amount === 12, 'la forma «You smite» entra', `${a?.kind} ${a?.amount}`);
  ok(a?.crit === true, 'y el crítico se lee igual que en los demás verbos');
  const b = parse('You try to smite a ghoul, but miss!');
  ok(b?.kind === 'miss', 'y el fallo cuenta como intento', b?.kind);
}

// ── La guarda de verdad: la tabla y los moldes no se separan ───────────────
//
// Los moldes se construyen a partir de esta tabla, así que basta con que el
// verbo esté en ella. Lo que esta prueba impide es que alguien quite uno.
console.log('\nla tabla');
{
  for (const v of ['smite', 'shoot', 'hit', 'slash', 'pierce', 'backstab', 'frenzy on']) {
    ok(MELEE_VERBS[v] !== undefined, `«${v}» sigue en la tabla`, MELEE_VERBS[v]);
  }
  // La tercera persona se deriva de la tabla: si alguien añade un verbo y se
  // olvida de la forma en -s, la mitad de las líneas se seguirían perdiendo.
  const sinTercera = Object.entries(MELEE_VERBS).filter(([, x]) => !x);
  ok(sinTercera.length === 0, 'todos tienen su forma en tercera persona',
    sinTercera.map(([k]) => k).join(', '));
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
