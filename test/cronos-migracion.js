/**
 * NADA DE LO QUE HACÍA LA SECCIÓN VIEJA SE CAE AL MIGRARLA.
 *
 * ── POR QUÉ ESTE CONTROL, Y POR QUÉ AHORA ─────────────────────────────────
 *
 * En esta misma sección hemos perdido tres decisiones sin enterarnos: los dos
 * rótulos de procedencia que se quedaron sin lógica, `cro.retenido` detrás de
 * una condición imposible, y la comparación de discrepancia que se quedó sin
 * entrada al retirar `medido`. **Ninguna se delató.** Una migración es
 * exactamente el momento en que se pierde la cuarta.
 *
 * `test/fixtures/cronos-antes.json` guarda las claves que la sección producía
 * **antes de vaciarla**, medidas con `bin/rotulos.js` sobre la aplicación de
 * verdad. Después ya no se pueden obtener: por eso se capturaron primero.
 *
 * ── QUÉ CUENTA COMO PÉRDIDA Y QUÉ NO ──────────────────────────────────────
 *
 * Un rótulo que desaparece **no siempre es una pérdida**: algunos se sustituyen
 * a propósito por el equivalente del módulo, porque el módulo los comparte con
 * las otras catorce secciones. Eso es un CAMBIO DE NOMBRE y va declarado abajo
 * con su sustituto.
 *
 * Lo que no puede pasar es que desaparezca **sin decir por cuál**. La lista de
 * equivalencias es corta a propósito: si crece, es que la migración está
 * tirando cosas y llamándolo renombrar.
 */
import fs from 'node:fs';
import * as V from '../ui/cronos-vista.js';
import { t, setLang } from '../src/i18n.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};
setLang('es');

const antes = JSON.parse(fs.readFileSync(new URL('./fixtures/cronos-antes.json', import.meta.url), 'utf8'));

/**
 * LO QUE CAMBIA DE NOMBRE AL PASAR AL MÓDULO, uno a uno y con su sustituto.
 *
 * Las tres fuentes y el «sin dato» dejan de ser de esta sección y pasan a ser
 * del módulo, porque las quince pantallas van a enseñar procedencia igual. El
 * texto cambia —«de la wiki» → «zona»— y eso es deliberado: el rótulo largo no
 * cabía en una fila densa, y la leyenda explica las tres una sola vez.
 */
const RENOMBRADAS = {
  'cro.src.manual': 'pz.src.tuyo',
  'cro.src.wiki': 'pz.src.zona',
  'cro.src.nuestro': 'pz.src.visto',
  'cro.sinDato': 'pz.sinDato',
};

console.log('\nel control se capturó ANTES de vaciar nada');
ok(Array.isArray(antes.vivas) && antes.vivas.length > 20,
  'hay un «antes» que comparar', `${antes.vivas.length} claves, capturadas el ${antes.capturado}`);

console.log('\nninguna decisión de la sección vieja se cae en la migración');
{
  const ahora = new Set(V.CLAVES);
  const perdidas = antes.vivas.filter((k) => !ahora.has(k) && !(k in RENOMBRADAS));
  ok(perdidas.length === 0, 'todo lo que producía la vieja lo produce la nueva',
    perdidas.length ? perdidas.join(', ') : `${antes.vivas.length} comprobadas`);
}

console.log('\ny lo renombrado tiene sustituto de verdad, no una excusa');
for (const [viejo, nuevo] of Object.entries(RENOMBRADAS)) {
  const v = t(nuevo);
  ok(!!v && v !== nuevo, `${viejo} → ${nuevo}`, `«${v}»`);
}
ok(Object.keys(RENOMBRADAS).length <= 6, 'la lista de renombradas sigue siendo corta',
  `${Object.keys(RENOMBRADAS).length} — si crece, es que se está tirando y llamándolo renombrar`);

console.log('\nCONTROL: el control detecta una pérdida de verdad');
{
  // Se le quita a la nueva una clave que la vieja sí producía. Tiene que saltar.
  const mutilada = new Set(V.CLAVES.filter((k) => k !== 'cro.aunNo'));
  const perdidas = antes.vivas.filter((k) => !mutilada.has(k) && !(k in RENOMBRADAS));
  ok(perdidas.includes('cro.aunNo'),
    'quitando cro.aunNo de la nueva, el control lo caza',
    'sin esto, el verde de arriba no diría nada');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
