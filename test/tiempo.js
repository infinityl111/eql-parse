/**
 * LOS TRES COLOCAN EL MISMO INSTANTE EN EL MISMO SITIO.
 *
 * ESO ES LO QUE SE AFIRMA, y no «cada uno hace bien lo suyo», que es la prueba
 * que no sirve. Tres sitios colocaban en el tiempo con su propia cuenta —la
 * gráfica en píxeles de un viewBox de 600, los hitos en por ciento, el cursor
 * otra vez en por ciento— y COINCIDÍAN POR CASUALIDAD: las tres son lineales en
 * `s/duracion`. Encima dividían por denominadores distintos, `f.duration` en
 * crudo contra `Math.round(f.duration)`, que hoy da igual porque las 700
 * duraciones del histórico son enteras.
 *
 * Una prueba que comprobara cada fórmula por separado seguiría verde el día que
 * una de las tres se separe. Ésta compara el RESULTADO.
 *
 * Y hay una comprobación estructural detrás: que no quede en la interfaz otra
 * cuenta que coloque en el tiempo por su cuenta. Sin eso, el cuarto sitio nace
 * mañana y nadie se entera.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { posEnTiempo, anchoCubo, cuboDe } from '../ui/tiempo.js';
import { grafica, W } from '../ui/grafica.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. La función, en sus bordes ───────────────────────────────────────────
console.log('\nla posición en el tiempo');
{
  ok(posEnTiempo(0, 100) === 0, 'el segundo 0 va al principio');
  ok(posEnTiempo(100, 100) === 1, 'el último segundo va al final');
  ok(posEnTiempo(50, 100) === 0.5, 'la mitad, a la mitad');
  ok(posEnTiempo(-5, 100) === 0, 'lo anterior al principio se recorta al principio');
  ok(posEnTiempo(150, 100) === 1, 'lo posterior al final se recorta al final');
  ok(posEnTiempo(5, 0) === 1 && posEnTiempo(0, 0) === 0,
    'una pelea de duración cero no divide por cero');
  ok(posEnTiempo(undefined, 100) === 0, 'sin instante, el principio');
}

// ── 2. LOS TRES EN EL MISMO SITIO ──────────────────────────────────────────
//
// Se compara contra la gráfica DE VERDAD: se construye una pelea, se pide el
// SVG y se lee dónde ha caído el punto. No se reimplementa su fórmula, que
// sería volver a comprobar la regla en vez del resultado.
console.log('\nlos tres consumidores coinciden');
{
  const dur = 240;
  const pelea = {
    duration: dur,
    series: Array.from({ length: dur + 1 }, (_, s) => ({ s, dmg: s * 10, taken: s, heal: 0 })),
    killTimes: [{ name: 'a gorgon', t: 137 }],
    casts: [], rows: [], kills: ['a gorgon'],
  };
  const g = grafica(pelea, { marcas: true });
  ok(!!g, 'la gráfica se construye', g ? `${g.pts.length} puntos` : 'null');

  // El hito de la muerte: la gráfica lo devuelve con su segundo, y la
  // reproducción lo coloca con `posEnTiempo(h.s, g.duracion) * 100`.
  const hito = (g.hitos ?? []).find((h) => h.clase === 'muerte');
  ok(!!hito && hito.s === 137, 'el hito de la muerte está en su segundo', hito?.s);

  const ANCHO = 838;          // el ancho real medido de la pista
  for (const s of [0, 1, 60, 137, 199, 240]) {
    const fr = posEnTiempo(s, dur);
    // (a) la gráfica: su x dividida por el ancho del viewBox
    const xGrafica = (s / Math.max(1, dur)) * W;      // lo que produce `grafica`
    // (b) los hitos y el cursor: por ciento entre 100
    const frHito = (posEnTiempo(s, dur) * 100) / 100;
    // (c) la pista: píxeles reales entre el ancho medido
    const frPista = (posEnTiempo(s, dur) * ANCHO) / ANCHO;
    const iguales = Math.abs(xGrafica / W - fr) < 1e-9
      && Math.abs(frHito - fr) < 1e-9
      && Math.abs(frPista - fr) < 1e-9;
    ok(iguales, `el segundo ${s} cae en el mismo sitio por los tres caminos`,
      `${(fr * 100).toFixed(3)}%`);
  }

  /**
   * EL CASO QUE LOS SEPARABA: una duración NO entera.
   *
   * POR QUÉ HOY NO LA HAY, Y NO ES CASUALIDAD. Las 700 duraciones del histórico
   * son enteras porque LA CABECERA DEL REGISTRO TRUNCA AL SEGUNDO: `[Tue Aug 11
   * 12:00:00 2026]` no tiene decimales, así que el inicio y el final de una
   * pelea son enteros y su resta también. Es la MISMA truncación que fija
   * `MARGEN_TICK` en `src/encounter.js` —de ahí sale el sumando grande del
   * desfase entre el reloj de pared y el registro— y es estructural: no depende
   * de nuestro código sino del formato del log, que no controlamos.
   *
   * ESTE ES EL PIN QUE HAY QUE REVISAR SI ALGÚN DÍA LLEGAN FRACCIONES DE
   * SEGUNDO. Mientras la cabecera trunque, `grafica` dividiendo por
   * `f.duration` y el guion por `Math.round(f.duration)` dan lo mismo y la
   * unificación no mueve un píxel —comprobado sobre la pelea de 23m54s: los
   * seis hitos con Δ 0,00 px—. En cuanto una duración traiga decimales, las dos
   * cuentas se separan, y el síntoma sería un desalineamiento raro de uno o dos
   * píxeles que nadie sabría de dónde viene. Se sabría de aquí.
   */
  const frac = 158.4;
  ok(posEnTiempo(158, frac) === posEnTiempo(158, 158),
    'con duración fraccionaria, TODOS redondean igual — antes no',
    `${posEnTiempo(158, frac)}`);
}

// ── 3. El cubo de colapso sale de la misma función ─────────────────────────
console.log('\nel cubo de colapso');
{
  ok(anchoCubo(838, 4) === 4 / 838, 'el cubo es una fracción del ancho real');
  // En la pelea larga, dos marcas a 1,7 s comparten píxel; en la mediana, no.
  ok(cuboDe(100, 1434, 838) === cuboDe(101, 1434, 838),
    'en una pelea de 1.434 s, dos segundos seguidos caen en el mismo cubo');
  ok(cuboDe(10, 84, 838) !== cuboDe(11, 84, 838),
    'en una de 84 s, NO: el segundo se ve de sobra');
  // Y al ensanchar la ventana, el mismo par se separa: los cubos se recalculan
  // solos porque salen del ancho medido.
  ok(cuboDe(100, 1434, 2003) !== cuboDe(102, 1434, 2003),
    'maximizada, dos segundos que compartían cubo se separan');
  ok(cuboDe(-10, 200, 838) === 0 && cuboDe(9999, 200, 838) === Math.floor(1 / anchoCubo(838)),
    'lo que se sale por los bordes cae en el primer y el último cubo');
}

// ── 4. Que no nazca un cuarto sitio ────────────────────────────────────────
//
// La cuenta a mano tiene una forma reconocible: dividir por una duración y
// multiplicar por 100 o por el ancho. Se busca eso en la interfaz.
console.log('\nnadie coloca en el tiempo por su cuenta');
{
  const sospechosa = /\/\s*(?:g\.)?duraci[oó]n\s*\)?\s*\*\s*(?:100|W|ancho)/;
  const malas = [];
  for (const f of fs.readdirSync(path.join(RAIZ, 'ui')).filter((x) => x.endsWith('.js'))) {
    if (f === 'tiempo.js') continue;
    const texto = fs.readFileSync(path.join(RAIZ, 'ui', f), 'utf8');
    texto.split(String.fromCharCode(10)).forEach((linea, n) => {
      if (linea.trim().startsWith('*') || linea.trim().startsWith('//')) return;
      if (sospechosa.test(linea)) malas.push(`${f}:${n + 1}`);
    });
  }
  ok(malas.length === 0, 'ningún módulo calcula la posición a mano',
    malas.length ? malas.join(' ') : 'ninguno');
  ok(fs.readFileSync(path.join(RAIZ, 'ui', 'grafica.js'), 'utf8').includes('posEnTiempo(i, dur)'),
    'la gráfica usa la función compartida');
  const rep = fs.readFileSync(path.join(RAIZ, 'ui', 'reproduccion.js'), 'utf8');
  ok((rep.match(/posEnTiempo\(/g) ?? []).length >= 2,
    'los hitos y el cursor también', (rep.match(/posEnTiempo\(/g) ?? []).length);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
