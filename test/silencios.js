/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NINGÚN FALLO SE TRAGA EN SILENCIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── LA CICATRIZ ───────────────────────────────────────────────────────────
 *
 * El panel de temporizadores tenía `refresca(snap).catch(() => {})`. Con eso, un
 * fallo cualquiera dejaba el panel **abierto y vacío** — y un panel vacío es un
 * estado legítimo: significa «no tienes temporizadores». Así que el fallo no se
 * distinguía del funcionamiento normal.
 *
 *     UN `catch` VACÍO CONVIERTE UN FALLO EN UN ESTADO LEGÍTIMO.
 *
 * Es la misma familia que la clave que nadie lee y que el `var()` con respaldo:
 * el error existe, alguien lo absorbe, y lo que queda es un valor plausible.
 *
 * ── QUÉ SE PERMITE Y QUÉ NO ──────────────────────────────────────────────
 *
 * No se prohíbe tragarse un fallo: hay sitios donde es correcto —cerrar un
 * fichero que quizá ya está cerrado, borrar un temporal que quizá no existe—.
 * Lo que se prohíbe es tragárselo **sin decir por qué**.
 *
 * Un `catch` con un comentario dentro está declarado: alguien decidió que ese
 * fallo no importa y dejó escrito el motivo. Uno vacío del todo es un olvido
 * indistinguible de una decisión.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(DIR, '..');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

const CARPETAS = ['src', 'ui', 'electron', 'bin', 'web'];
const ficheros = [];
for (const c of CARPETAS) {
  const d = path.join(RAIZ, c);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (/\.(js|cjs|mjs)$/.test(f)) ficheros.push(path.join(c, f));
  }
}

/**
 * UN SILENCIO ES UN `catch` SIN NADA DENTRO — ni código, ni comentario.
 *
 * `catch { /* motivo *\/ }` está declarado y no cuenta. `catch {}` y
 * `.catch(() => {})` son el olvido.
 */
const VACIO = /\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)|catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/g;

const silencios = [];
for (const f of ficheros) {
  const src = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const lineas = src.split(/\r?\n/);
  lineas.forEach((l, i) => {
    VACIO.lastIndex = 0;
    if (VACIO.test(l)) silencios.push({ f, n: i + 1, l: l.trim().slice(0, 76) });
  });
}

console.log(`\nninguno de los ${ficheros.length} ficheros se traga un fallo sin decir por qué`);
ok(silencios.length === 0, `${silencios.length} silencios`,
  silencios.length ? 'cada uno convierte un fallo en un estado legítimo' : '');
for (const s of silencios.slice(0, 25)) {
  console.log(`       ${s.f}:${String(s.n).padStart(4)}  ${s.l}`);
}

console.log('\nCONTROL POSITIVO sobre un fichero real');
{
  const src = fs.readFileSync(path.join(RAIZ, 'ui', 'overlay-cronos.js'), 'utf8');
  /**
   * Se le devuelve al panel el `catch` que tenía el día del fallo. Es la forma
   * exacta, no una inventada: se abría vacío y no se distinguía de no tener
   * ningún temporizador.
   */
  const enfermo = src.replace('refresca(null).catch(cae);', 'refresca(null).catch(() => {});');
  ok(enfermo !== src, 'se ha podido devolver el panel a su forma enferma',
    enfermo === src ? 'ha cambiado de forma: ACTUALIZA ESTE CONTROL' : '');
  VACIO.lastIndex = 0;
  ok(VACIO.test(enfermo), 'y el barrido lo caza', 'sin esto, el verde de arriba no diría nada');

  VACIO.lastIndex = 0;
  ok(!VACIO.test('try { x(); } catch { /* ya estaba cerrado */ }'),
    'y un catch CON motivo escrito no salta',
    'tragarse un fallo a propósito es legítimo; hacerlo sin decirlo, no');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
