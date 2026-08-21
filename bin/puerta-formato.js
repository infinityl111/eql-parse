#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA PUERTA DEL FORMATO · lo guardado por la versión anterior sigue diciendo
 * lo mismo
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Se corre ANTES de construir el instalador, y **en toda versión que suba un
 * número de formato** —`FORMATO_VERSION`, `RECONSTRUIR_DESDE` o `ENC_VERSION`—.
 *
 * QUÉ VIGILA, y por qué ninguna puerta de las que había lo veía: el instalador
 * puede estar perfecto, la release entera cuadrar, y el usuario abrir su
 * historial y encontrárselo VACÍO o con otras cifras. Nada de lo que se
 * comprueba hoy —hash del paquete, adjuntos, `/releases/latest`, la web— mira
 * dentro del almacén de alguien que ya tenía datos.
 *
 *     NO ES «QUE SE ABRA». ES QUE DIGA LO MISMO.
 *
 * Así que se compara HUELLA CONTRA HUELLA: se copia un almacén real, se lee con
 * el código de la versión ANTERIOR —de verdad, desde su etiqueta, en un
 * worktree— y se lee otra vez con el de ahora sobre la MISMA carpeta. Las
 * peleas, sus cifras y el recuento de la enciclopedia tienen que coincidir.
 *
 * Y CON CONTROL POSITIVO: después se guarda una pelea NUEVA y se vuelve a leer.
 * Sin eso, una versión que no supiera escribir nada pasaría la puerta con las
 * viejas intactas.
 *
 * Uso:  node bin/puerta-formato.js v1.23.0
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFileSync as run } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANTERIOR = process.argv[2];
if (!ANTERIOR) {
  console.error('\nuso: node bin/puerta-formato.js <etiqueta-anterior>   (p. ej. v1.23.0)\n');
  process.exit(2);
}

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** El almacén real, copiado: no se toca el del usuario ni de lejos. */
const REAL = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
].find((d) => fs.existsSync(path.join(d, 'fights.ndjson')));
if (!REAL) {
  console.error('\nSin almacén real que copiar, esta puerta no mide nada.\n');
  process.exit(3);
}
const DIR = path.join(os.tmpdir(), 'eql-puerta-formato');
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
for (const f of fs.readdirSync(REAL)) {
  if (!/\.(ndjson|idx|json)$/.test(f) || /\.bak$/.test(f)) continue;
  try { fs.copyFileSync(path.join(REAL, f), path.join(DIR, f)); } catch { /* en uso: se salta */ }
}

/**
 * EL MEDIDOR, escrito una vez y ejecutado con los DOS códigos.
 *
 * Va como fichero suelto porque tiene que importarse desde el árbol de cada
 * versión: el de la etiqueta anterior no conoce nada de hoy.
 */
const MEDIDOR = `
import fs from 'node:fs';
import { FightStore } from './src/store.js';
import { Encyclopedia } from './src/encyclopedia.js';
const dir = process.argv[2];
const store = new FightStore(dir);
store.load();
const enc = new Encyclopedia(store);
const r = enc.load();
// Las cifras de las peleas, que es lo que el usuario ve en su historial.
const peleas = store.index.slice(0, 200).map((s) => {
  const f = store.get(s.uid);
  return [s.uid, s.at, Math.round(f?.total ?? 0), Math.round(f?.duration ?? 0),
    (f?.kills ?? []).length, (f?.rows ?? []).length];
});
const botin = (enc.lootList?.() ?? []).slice(0, 60).map((x) => [x.item, x.n]);
console.log(JSON.stringify({
  peleas: store.index.length, huella: peleas, botin,
  fichas: enc.ledger?.porNombre?.size ?? 0, rehecha: r?.reason ?? null,
}));
`;

const worktree = path.join(RAIZ, '..', `eql-puerta-${ANTERIOR}`);
const git = (...a) => run('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });
try { git('worktree', 'remove', '--force', worktree); } catch { /* no había */ }
git('worktree', 'add', '--detach', worktree, ANTERIOR);

const mide = (arbol) => {
  const f = path.join(arbol, 'medidor-puerta.mjs');
  fs.writeFileSync(f, MEDIDOR);
  const salida = execFileSync(process.execPath, [f, DIR], { encoding: 'utf8', maxBuffer: 64e6 });
  fs.rmSync(f, { force: true });
  return JSON.parse(salida.trim().split('\n').pop());
};

console.log(`\nLA PUERTA DEL FORMATO · ${ANTERIOR} escribe, esta versión lee\n`);
console.log(`  almacén copiado de: ${REAL}`);

const antes = mide(worktree);
console.log(`  con ${ANTERIOR}: ${antes.peleas} peleas · ${antes.fichas} fichas de enemigo`);
const despues = mide(RAIZ);
console.log(`  con ésta:     ${despues.peleas} peleas · ${despues.fichas} fichas · enciclopedia ${despues.rehecha ?? 'sin rehacer'}`);

ok(antes.peleas > 100, 'CONTROL: el almacén de prueba tiene histórico de verdad', `${antes.peleas} peleas`);
ok(despues.peleas === antes.peleas, 'las peleas guardadas SIGUEN estando',
  `${antes.peleas} → ${despues.peleas}`);
const iguales = JSON.stringify(antes.huella) === JSON.stringify(despues.huella);
ok(iguales, 'y dicen LO MISMO: daño, duración, abatidos y combatientes',
  iguales ? `${antes.huella.length} peleas comparadas una a una` : 'CIFRAS DISTINTAS: no hay release');
if (!iguales) {
  for (let i = 0; i < antes.huella.length; i++) {
    if (JSON.stringify(antes.huella[i]) !== JSON.stringify(despues.huella[i])) {
      console.log(`       uid ${antes.huella[i][0]}: ${JSON.stringify(antes.huella[i])} → ${JSON.stringify(despues.huella[i])}`);
      break;
    }
  }
}
const botinIgual = JSON.stringify(antes.botin) === JSON.stringify(despues.botin);
ok(botinIgual, 'y el botín contado sigue siendo el mismo',
  botinIgual ? `${antes.botin.length} objetos comparados` : 'el recuento se ha movido');

/**
 * CONTROL POSITIVO: una pelea NUEVA se guarda y se relee.
 *
 * Sin esto, una versión que hubiera dejado de escribir pasaría la puerta con las
 * viejas intactas — y el usuario perdería justo lo de mañana.
 */
const nueva = `
import { FightStore } from './src/store.js';
const dir = process.argv[2];
const s = new FightStore(dir);
s.self = 'Campeon';
s.load();
const T = Date.now();
const antes = s.index.length;
s.append({
  zone: 'Puerta 2 (Adaptive)', zoneBase: 'Puerta', diff: 2, diffTag: 'Adaptive', visita: 7,
  duration: 42, total: 12345, start: Math.round(T / 1000),
  kills: ['un bicho de prueba'], killTimes: [{ name: 'un bicho de prueba', t: 5 }],
  rows: [{ name: 'Campeon', side: 'ally', damage: 12345 }, { name: 'un bicho de prueba', side: 'enemy' }],
}, T);
const otra = new FightStore(dir);
otra.load();
const ult = otra.index.find((x) => x.zoneBase === 'Puerta');
const f = ult ? otra.get(ult.uid) : null;
console.log(JSON.stringify({ antes, despues: otra.index.length, total: Math.round(f?.total ?? 0), visita: ult?.visita ?? null }));
`;
const fNueva = path.join(RAIZ, 'medidor-puerta-nueva.mjs');
fs.writeFileSync(fNueva, nueva);
const r = JSON.parse(execFileSync(process.execPath, [fNueva, DIR], { encoding: 'utf8' }).trim().split('\n').pop());
fs.rmSync(fNueva, { force: true });
ok(r.despues === r.antes + 1, 'CONTROL POSITIVO: una pelea nueva se guarda',
  `${r.antes} → ${r.despues}`);
ok(r.total === 12345, 'y se relee con sus cifras intactas', `${r.total}`);

try { git('worktree', 'remove', '--force', worktree); } catch { /* ya no está */ }
fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n${mal ? `${mal} MAL — NO HAY RELEASE` : 'la puerta pasa'}\n`);
process.exit(mal ? 1 : 0);
