#!/usr/bin/env node
/**
 * El bloque de estado con el que se cierra un turno, MEDIDO en vez de escrito:
 * rama y sincronía, árbol de trabajo, remotos y ramas — de este repositorio y
 * del segundo, si hay uno configurado.
 *
 *     UN DATO DE ESTADO COPIADO DE UN TURNO ANTERIOR ES UNA CREENCIA, NO UNA
 *     COMPROBACIÓN — y va justo donde el informe dice «esto es lo que hay
 *     ahora».
 *
 * El segundo repositorio se pasa con `--otro <ruta>` o con la variable
 * `EQL_CUADERNO`. Si no hay ninguna, se dice; no tenerlo configurado es un
 * estado, no un fallo.
 *
 * Uso:  npm run estado
 *       npm run estado -- --otro "D:\\ruta\\al\\otro"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

/** Una orden de git en un repositorio, o `null` si revienta. */
const git = (dir, ...orden) => {
  try {
    return execFileSync('git', ['-C', dir, ...orden],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, '');
  } catch { return null; }
};

/**
 * LO QUE NO SE PUDO LEER SE DICE, no se deja en blanco.
 *
 * Un apartado vacío en un informe de estado se lee como «no hay nada», y «no
 * hay nada» y «no pude mirar» son las dos cosas que este fichero existe para
 * separar.
 */
const o = (v, siNada = '(no se pudo leer)') => (v === null ? siNada : (v || '(nada)'));

function informe(nombre, dir) {
  console.log(`\n── ${nombre}`);
  console.log(`   ${dir}`);
  if (!fs.existsSync(dir)) { console.log('   NO EXISTE esa ruta'); return false; }
  if (git(dir, 'rev-parse', '--git-dir') === null) { console.log('   no es un repositorio git'); return false; }

  const rama = o(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'));
  const arriba = git(dir, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  let sincronia = 'sin rama de seguimiento';
  if (arriba) {
    const cuenta = git(dir, 'rev-list', '--left-right', '--count', `${arriba}...HEAD`);
    const [detras, delante] = (cuenta ?? '0\t0').split(/\s+/).map(Number);
    sincronia = delante || detras
      ? `${delante} por delante · ${detras} por detrás de ${arriba}`
      : `en sincronía con ${arriba}`;
  }
  console.log(`   rama       ${rama} — ${sincronia}`);

  const sucio = git(dir, 'status', '--short');
  const cambios = sucio ? sucio.split('\n').filter(Boolean) : [];
  console.log(`   árbol      ${cambios.length ? `${cambios.length} sin comprometer` : 'limpio'}`);
  for (const l of cambios) console.log(`              ${l}`);

  const remotos = git(dir, 'remote', '-v');
  console.log(`   remotos    ${remotos ? '' : '(ninguno)'}`);
  if (remotos) {
    // Sin la URL: puede llevar un token dentro, y esto se pega en un informe.
    const vistos = new Set();
    for (const l of remotos.split('\n')) {
      const [n, url] = l.split(/\s+/);
      if (vistos.has(n)) continue;
      vistos.add(n);
      console.log(`              ${n}  ${url.replace(/\/\/[^@/]+@/, '//···@')}`);
    }
  }

  const locales = (git(dir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads') ?? '').split('\n').filter(Boolean);
  // `refs/remotes/origin/HEAD` se abrevia a «origin» y no es una rama: es el
  // puntero a la que el remoto considera principal. Colado en la lista, hace
  // contar una de más y da un informe con una rama que no existe.
  const remotas = (git(dir, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes') ?? '')
    .split('\n').filter(Boolean).filter((r) => r.includes('/'));
  console.log(`   ramas      locales: ${locales.join(', ') || '(ninguna)'}`);
  console.log(`              remotas: ${remotas.join(', ') || '(ninguna)'}`);
  /**
   * LAS ETIQUETAS, ORDENADAS POR FECHA Y NO POR NOMBRE.
   *
   * `git tag` ordena alfabéticamente, así que la última de la lista salía
   * «v1.9.2» con «v1.15.0» ya creada: v1.9 va después de v1.15 letra a letra.
   * Un informe de estado que dice «la última v1.9.2» tres versiones más tarde
   * no da un dato incompleto: da uno falso.
   */
  const etiquetas = (git(dir, 'for-each-ref', '--sort=creatordate',
    '--format=%(refname:short)', 'refs/tags') ?? '').split('\n').filter(Boolean);
  console.log(`   etiquetas  ${etiquetas.length}${etiquetas.length ? ` · la más reciente ${etiquetas.at(-1)}` : ''}`);
  return true;
}

console.log('\nEL ESTADO, LEÍDO AHORA MISMO');
let bien = informe('este repositorio', RAIZ);

const otro = flag('--otro') ?? process.env.EQL_CUADERNO ?? null;
if (otro) bien = informe('el segundo repositorio', path.resolve(otro)) && bien;
else console.log('\n── el segundo repositorio\n   no hay ninguno configurado'
  + ' (pásalo con --otro <ruta> o pon EQL_CUADERNO)');

console.log('');
process.exitCode = bien ? 0 : 1;
