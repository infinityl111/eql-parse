/**
 * LAS RESISTENCIAS DE UNA PELEA, SUMADAS POR HECHIZO Y CON DENOMINADOR.
 *
 * ── POR QUÉ HACE FALTA UNA PRUEBA PARA UNA SUMA ───────────────────────────
 *
 * `spellVsFoe` guarda una fila POR INVOCACIÓN: `{foe, spell, inv, landed,
 * resisted}`. El mismo hechizo contra el mismo enemigo viene partido en dos o
 * tres filas según con qué se lanzara.
 *
 *     ENSEÑARLAS SIN SUMAR DA «2 DE 2» Y «16 DE 16» DONDE LA VERDAD ES
 *     «18 DE 18».
 *
 * Y ése es exactamente el fallo que no se ve: los dos números son más
 * pequeños, los dos son plausibles, y los dos traen un denominador coherente
 * consigo mismo. Nada en la pantalla dice que falta la mitad. Es la misma forma
 * que el `limpio` que hacía dos trabajos y que el filtro adelantado a la guarda
 * de saturación — una respuesta correcta a una pregunta que nadie hizo.
 *
 * El caso real está en el registro: la pelea de las 22:24 del 17 de agosto trae
 * `Drain Spirit X` en DOS filas, 2 y 16, contra el mismo enemigo.
 *
 * ── Y EL DENOMINADOR NO ES OPCIONAL ───────────────────────────────────────
 *
 * «62 resistidas» no es una cifra: 62 de 62 y 62 de 300 son dos peleas
 * distintas y dos consejos distintos. Lo único que cambia lo que haces en la
 * siguiente pelea es saber si ese hechizo entra alguna vez.
 */
import { resistenciasPorHechizo, poblacionDeResistencias } from '../src/analysis.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── 1. La suma por invocación, que es la que puede romperse en silencio ────
console.log('\nlas filas del mismo hechizo se suman aunque cambie la invocación');
{
  const f = {
    spellVsFoe: [
      { foe: 'Coercer T`vala', spell: 'Drain Spirit X', inv: null, landed: 0, resisted: 2 },
      { foe: 'Coercer T`vala', spell: 'Drain Spirit X', inv: 'over channel', landed: 0, resisted: 16 },
    ],
  };
  const r = resistenciasPorHechizo(f);
  ok(r.length === 1, 'dos filas del mismo hechizo salen como UNA', `${r.length} fila(s)`);
  ok(r[0]?.resisted === 18, 'las resistidas se suman: 2 + 16 = 18', r[0]?.resisted);
  ok(r[0]?.intentos === 18, 'y los intentos también, así que sale «18 de 18»', r[0]?.intentos);
  /**
   * EL CONTROL, sin el cual lo de arriba no prueba nada: si alguien quitara la
   * suma, saldrían DOS filas de 2 y de 16. Se comprueba que NO es eso.
   */
  ok(!r.some((x) => x.resisted === 2 || x.resisted === 16),
    'CONTROL: no quedan las dos filas sueltas de 2 y 16');
}

// ── 2. El denominador es lanzadas, no resistidas ───────────────────────────
console.log('\nel denominador cuenta lo que aterrizó y lo que no');
{
  const f = {
    spellVsFoe: [
      { foe: 'a spite golem', spell: 'Water Elemental Attack', inv: null, landed: 26, resisted: 5 },
    ],
  };
  const r = resistenciasPorHechizo(f);
  ok(r[0]?.resisted === 5 && r[0]?.intentos === 31, '5 de 31, no 5 de 5', `${r[0]?.resisted} de ${r[0]?.intentos}`);
}

// ── 3. Mismo hechizo contra enemigos distintos NO se funde ─────────────────
//
// Se suma por invocación, que es ruido; NO por enemigo, que es la pregunta.
console.log('\ndos enemigos distintos no se funden');
{
  const f = {
    spellVsFoe: [
      { foe: 'Terror', spell: 'Earthquake', inv: null, landed: 1, resisted: 3 },
      { foe: 'Dread', spell: 'Earthquake', inv: null, landed: 0, resisted: 4 },
    ],
  };
  const r = resistenciasPorHechizo(f);
  ok(r.length === 2, 'el mismo hechizo contra dos bichos son dos filas', r.length);
  ok(r[0].foe === 'Dread' && r[0].resisted === 4, 'y manda el más resistido', `${r[0].foe} ${r[0].resisted}`);
}

// ── 4. Lo que nunca se resistió no ocupa sitio ─────────────────────────────
console.log('\nlo que siempre entra no sale en la lista');
{
  const f = {
    spellVsFoe: [
      { foe: 'a gorgon', spell: 'Reaving Strike', inv: null, landed: 17, resisted: 0 },
      { foe: 'a gorgon', spell: 'Siphon', inv: null, landed: 3, resisted: 1 },
    ],
  };
  const r = resistenciasPorHechizo(f);
  ok(r.length === 1 && r[0].spell === 'Siphon',
    'cero resistencias no es un hallazgo: no se enseña', r.map((x) => x.spell).join(', '));
}

// ── 5. Una pelea sin nada no revienta ──────────────────────────────────────
console.log('\nlos vacíos');
{
  ok(resistenciasPorHechizo({}).length === 0, 'una pelea sin spellVsFoe da lista vacía');
  ok(resistenciasPorHechizo(null).length === 0, 'y una pelea que no existe, también');
  ok(resistenciasPorHechizo({ spellVsFoe: [] }).length === 0, 'y una lista vacía');
}

/**
 * ── 6. LA POBLACIÓN, que es lo que evita leer la tabla al revés ───────────
 *
 * La tabla sólo enseña lo que se resistió alguna vez, así que sin decir de
 * cuántos hechizos salen esas filas, cinco filas se leen como «lancé cinco».
 * Se comprueba con la pelea de verdad: cinco hechizos resistidos de los seis
 * lanzados contra ese enemigo, 103 resistencias de 129 lanzamientos.
 */
console.log('\nla tabla dice de cuántos hechizos sale');
{
  const f = {
    spellVsFoe: [
      { foe: 'Coercer T`vala', spell: 'Drain Spirit X', inv: null, landed: 0, resisted: 44 },
      { foe: 'Coercer T`vala', spell: 'Blade Dance', inv: null, landed: 0, resisted: 26 },
      { foe: 'Coercer T`vala', spell: "Oathbreaker's Curse", inv: null, landed: 0, resisted: 14 },
      { foe: 'Coercer T`vala', spell: 'Scream of Death Strike', inv: null, landed: 0, resisted: 14 },
      { foe: 'Coercer T`vala', spell: 'Water Elemental Attack', inv: null, landed: 26, resisted: 5 },
      // Éste entró siempre: NO sale en la tabla, pero SÍ cuenta en la población.
      { foe: 'Coercer T`vala', spell: 'Reaving Strike', inv: null, landed: 9, resisted: 0 },
    ],
  };
  const p = poblacionDeResistencias(f);
  ok(p.hechizos === 6, 'cuenta los hechizos lanzados, incluido el que entró siempre', p.hechizos);
  ok(p.conResistencia === 5, 'y cuántos de ellos se resistieron alguna vez', p.conResistencia);
  ok(p.resistidas === 103, 'las resistencias suman 103, no 5', p.resistidas);
  ok(p.lanzadas === 129, 'sobre 129 lanzamientos de esos cinco', p.lanzadas);
  /**
   * EL CONTROL DEL ERROR QUE LA TRAJO: leyendo la última fila «5 de 31» se
   * puede entender «entraron 5». Entraron 26. Se deja fijado en una aserción
   * para que la aritmética de la vista no se pueda invertir sin que salte.
   */
  ok(p.lanzadas - p.resistidas === 26, 'CONTROL: entraron 26, que no es el 5 de la última fila',
    p.lanzadas - p.resistidas);
  ok(resistenciasPorHechizo(f).length === 5, 'y la tabla enseña cinco filas, no seis',
    resistenciasPorHechizo(f).length);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
