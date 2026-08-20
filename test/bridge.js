/**
 * El puente entre la interfaz y el proceso principal.
 *
 * La interfaz sólo puede llamar a lo que preload.cjs expone, y lo llama con
 * `?.` casi siempre para no reventar si algo falta. Esa prudencia tiene un
 * precio: cinco funciones estuvieron ausentes durante versiones sin dar un
 * solo error. El aviso de versión nueva llevaba dos versiones muerto —el
 * proceso principal consultaba GitHub, la interfaz tenía el cartel montado, y
 * por el puente no pasaba nada— y `setMergePets`, que se llamaba SIN `?.`,
 * lanzaba TypeError cada vez que alguien tocaba el conmutador de mascotas.
 *
 * Esto compara las tres superficies: lo que la interfaz usa, lo que el preload
 * expone y lo que el proceso principal atiende. Un hueco en cualquiera de las
 * tres es un camino muerto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

// ── Qué usa la interfaz ───────────────────────────────────────────────────
const usadas = new Set();
/**
 * LOS CONSUMIDORES SE LISTAN, y la lista se queda corta sola.
 *
 * Al anadir el panel de temporizadores -otro renderizador con su propio
 * fichero- cuatro funciones del puente salieron «expuestas y sin usar»
 * estandolo. La prueba tenia razon en ponerse roja: no las veia.
 *
 * Es la misma familia que «al migrar codigo, la vigilancia migra con el»:
 * un detector que mira una lista fija de sitios deja de mirar en cuanto
 * aparece uno nuevo.
 */
for (const f of ['ui/app.js', 'ui/overlay.js', 'ui/overlay-cronos.js', 'ui/triggers.js', 'ui/alerts.js']) {
  for (const m of leer(f).matchAll(/window\.eql\.([A-Za-z0-9_]+)/g)) usadas.add(m[1]);
}

// ── Qué expone el preload y a qué canal ───────────────────────────────────
const preload = leer('electron/preload.cjs');
const expuestas = new Map();
for (const m of preload.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\([^)]*\)\s*=>\s*ipcRenderer\.(invoke|on)\(\s*'([^']+)'/gm)) {
  expuestas.set(m[1], { tipo: m[2], canal: m[3] });
}

// ── Qué canales atiende el proceso principal ──────────────────────────────
const main = leer('electron/main.cjs');
const atendidos = new Set([...main.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1]));
const emitidos = new Set([
  ...[...main.matchAll(/webContents\.send\(\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...main.matchAll(/\bsend\(\s*'([^']+)'/g)].map((m) => m[1]),
]);

console.log('\nla interfaz sólo llama a lo que existe');
const huecos = [...usadas].filter((n) => !expuestas.has(n)).sort();
ok(huecos.length === 0, 'toda función usada está expuesta en el preload',
  huecos.length ? huecos.join(', ') : `${usadas.size} funciones`);

console.log('\ntodo lo expuesto llega a alguien');
const sinDestino = [...expuestas].filter(([, v]) => v.tipo === 'invoke' && !atendidos.has(v.canal));
ok(sinDestino.length === 0, 'todo `invoke` tiene su `ipcMain.handle`',
  sinDestino.map(([k, v]) => `${k} → ${v.canal}`).join(', '));

const sinEmisor = [...expuestas].filter(([, v]) => v.tipo === 'on' && !emitidos.has(v.canal));
ok(sinEmisor.length === 0, 'todo escuchador tiene quien le envíe',
  sinEmisor.map(([k, v]) => `${k} → ${v.canal}`).join(', '));

console.log('\nnada expuesto se queda sin usar');
/**
 * Expuestas a propósito y todavía sin botón. No son fallos, pero la lista
 * tiene que ser explícita: si crece sola, es que se está montando trabajo en
 * el proceso principal que no llega nunca al usuario, que es exactamente lo
 * que pasó con el aviso de versión nueva.
 */
const PENDIENTES = new Set([
  'detach',      // desconectar del log sin cerrar; hoy sólo se reconecta
  'clearTimers', // borrar todos los temporizadores de golpe
  // `setPetName` estuvo aquí y ya no: era la segunda puerta para marcar una
  // mascota, la que guardaba pero no llamaba nadie. Se borró al dejar una sola
  // en la 1.6.1, que es lo que esta lista existe para provocar.
]);
const sobra = [...expuestas.keys()].filter((n) => !usadas.has(n) && !PENDIENTES.has(n)).sort();
ok(sobra.length === 0, 'el preload no expone funciones sin usar ni declaradas pendientes',
  sobra.join(', '));
const yaUsadas = [...PENDIENTES].filter((n) => usadas.has(n));
ok(yaUsadas.length === 0, 'y las pendientes que ya se usan salen de la lista', yaUsadas.join(', '));

console.log('\nlas que estuvieron muertas, presentes');
// Regresión explícita: estas cinco faltaban y por eso el aviso de versión
// nueva y el conmutador de mascotas no funcionaban.
for (const n of ['setMergePets', 'getUpdate', 'onUpdate', 'openUpdate', 'skipUpdate']) {
  ok(expuestas.has(n), `${n}`);
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
