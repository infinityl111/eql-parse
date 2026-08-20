#!/usr/bin/env node
/**
 * LAS OBRAS: las carpetas de construcción que quedaron puestas.
 *
 * Construir el instalador exige un worktree desasociado sobre el commit exacto
 * —es lo único que demuestra QUÉ se empaquetó—, pero esa carpeta hay que
 * retirarla al terminar. `PUBLICAR.md` lo decía al final de un párrafo y **no se
 * hizo ni una vez**: el 20/08/2026 quedaban tres, de versiones ya publicadas,
 * ocupando 2 GB en `D:` mezcladas con las carpetas de juegos del usuario.
 *
 * No es desorden. Una carpeta de construcción vieja **se parece a la copia de
 * trabajo** y lleva dentro un `package.json` con una versión plausible: quien
 * entre a mirar algo estará mirando código de hace tres versiones sin saberlo.
 *
 * Uso:
 *   npm run obras            lista lo que hay y dice si es seguro retirarlo
 *   npm run obras -- --quita retira las que ya no hacen falta
 *
 * QUÉ CUENTA COMO «YA NO HACE FALTA», y no es una corazonada: que su versión
 * esté **publicada y marcada como la última**. Mientras una versión esté en
 * prelanzamiento, su carpeta guarda el instalador que aún no se ha instalado, y
 * retirarla sería tirar justo lo que falta por comprobar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QUITA = process.argv.includes('--quita');
// `new URL(...).pathname` deja el «%20» de «EQL SPAIN» sin descodificar, y con
// un cwd que no existe `spawnSync` contesta ENOENT culpando a `git`, que no
// tiene nada que ver. Es el mismo caso que la clave por un canal: hay que
// preguntarse qué le hace ESE canal a los caracteres.
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const git = (...a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8' }).trim();

/** `git worktree list --porcelain` → [{dir, commit}] sin la copia de trabajo. */
function obras() {
  const out = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/);
  const todas = out.map((bloque) => {
    const dir = /^worktree (.+)$/m.exec(bloque)?.[1];
    const commit = /^HEAD ([0-9a-f]+)$/m.exec(bloque)?.[1];
    const suelto = /^detached$/m.test(bloque);
    return dir ? { dir, commit, suelto } : null;
  }).filter(Boolean);
  // La copia de trabajo es la primera y nunca es una obra.
  return todas.slice(1).filter((w) => w.suelto);
}

const tam = (d) => {
  let n = 0;
  const anda = (x) => {
    let e; try { e = fs.readdirSync(x, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      const p = path.join(x, f.name);
      if (f.isDirectory()) anda(p);
      else { try { n += fs.statSync(p).size; } catch { /* nada */ } }
    }
  };
  anda(d);
  return n;
};
const mb = (b) => `${Math.round(b / 1048576)} MB`;

/** La versión que hay dentro de esa carpeta, que es de qué es la obra. */
const versionDe = (d) => {
  try { return JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).version; }
  catch { return null; }
};

let ultima = null;
let etiquetas = null;
try {
  const repo = /github\.com[/:]([^/]+\/[^/.]+)/.exec(git('remote', 'get-url', 'origin'))?.[1];
  if (repo) {
    ultima = execFileSync('gh', ['api', `repos/${repo}/releases/latest`, '--jq', '.tag_name'],
      { encoding: 'utf8' }).trim();
    /**
     * TAMBIÉN LAS QUE YA NO TIENEN RELEASE NINGUNA.
     *
     * Faltaba este caso y salió el mismo día: la 1.19.0 se retiró sin publicarse
     * —llegó a instalarse, así que su número quedó gastado— y su obra se quedó
     * ahí, con 791 MB, porque la única regla que había era «¿es la última
     * publicada?» y la respuesta era no. Una obra de una versión que **no
     * existe como release** no la espera nadie: o se retiró, o nunca llegó.
     */
    etiquetas = new Set(JSON.parse(execFileSync('gh',
      ['api', `repos/${repo}/releases`, '--jq', '[.[].tag_name]'], { encoding: 'utf8' })));
  }
} catch { /* sin red o sin gh: se dice y no se decide por él */ }

const lista = obras();
if (!lista.length) {
  console.log('\nNo hay ninguna carpeta de construcción puesta. Nada que retirar.\n');
  process.exit(0);
}

console.log(`\n${lista.length} carpeta(s) de construcción puestas`
  + `${ultima ? `  ·  la última publicada es ${ultima}` : '  ·  (no he podido preguntar cuál es la última)'}\n`);

const quitables = [];
for (const w of lista) {
  const v = versionDe(w.dir);
  const vivo = (() => {
    try { git('merge-base', '--is-ancestor', w.commit, 'main'); return true; } catch { return false; }
  })();
  const publicada = ultima && v && `v${v}` === ultima;
  const sucia = git('-C', w.dir, 'status', '--short').length > 0;

  const sinRelease = etiquetas && v && !etiquetas.has(`v${v}`);

  const porQue = !vivo ? 'su commit NO está en main: al quitarla quedaría colgando'
    : sucia ? 'tiene cambios sin guardar dentro'
      : !ultima ? 'no sé si su versión está publicada'
        : publicada || sinRelease ? null
          : `su versión (${v}) no es la última publicada: puede que aún esté sin instalar`;

  const razonQuitar = publicada ? 'su versión ya es la última publicada'
    : 'su versión NO EXISTE como release: o se retiró, o nunca llegó';

  console.log(`  ${porQue ? '·' : '▸'} ${w.dir}`);
  console.log(`      versión ${v ?? '?'}  ·  ${w.commit.slice(0, 8)}  ·  ${mb(tam(w.dir))}`);
  console.log(`      ${porQue ? `SE QUEDA — ${porQue}` : `se puede retirar: ${razonQuitar}`}\n`);
  if (!porQue) quitables.push(w);
}

if (!QUITA) {
  console.log(quitables.length
    ? `Para retirar ${quitables.length}:  npm run obras -- --quita\n`
    : 'Nada que retirar por ahora.\n');
  process.exit(0);
}

for (const w of quitables) {
  git('worktree', 'remove', '--force', w.dir);
  console.log(`  retirada  ${w.dir}`);
}
console.log(`\n${quitables.length} retirada(s).\n`);
