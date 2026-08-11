import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';
import { rebuildStore } from '../src/rebuild.js';

/**
 * Reconstruir el histórico y la ficha que sale de él, juntos.
 *
 * El almacén y la enciclopedia se describen el uno al otro: la ficha apunta a
 * la última pelea incorporada por su POSICIÓN en el fichero de peleas. Si se
 * reconstruye uno y no el otro, quedan dos cosas que ya no se corresponden, y
 * con posiciones que pueden coincidir por casualidad —los dos ficheros empiezan
 * en cero y crecen igual—, así que la comprobación de divergencia podría darlas
 * por buenas. Se apartan a la vez y se restauran a la vez.
 */

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-reb-'));
const stamp = (s) => {
  const d = new Date(2026, 7, 4, 21, 30, s);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const p = (n) => String(n).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

/** Dos peleas contra dos enemigos, separadas por el silencio que las cierra. */
const LINEAS = [
  [0, 'You have entered Lower Guk - Group 3 (Fused).'],
  [1, 'You slash a froglok tad for 42 points of damage.'],
  [2, 'a froglok tad hits YOU for 27 points of damage.'],
  [3, 'You slash a froglok tad for 98 points of damage.'],
  [4, 'You have slain a froglok tad!'],
  [5, '--You have looted a Shiny Brass Idol.--'],
  [90, 'You slash a froglok ghoul for 60 points of damage.'],
  [91, 'a froglok ghoul hits YOU for 40 points of damage.'],
  [92, 'You slash a froglok ghoul for 75 points of damage.'],
  [93, 'You have slain a froglok ghoul!'],
];

const logPath = path.join(tmp, 'eqlog_Campeon_Legends.txt');
fs.writeFileSync(logPath, LINEAS.map(([s, m]) => `${stamp(s)} ${m}\n`).join(''));

const dir = path.join(tmp, 'datos');
fs.mkdirSync(dir);

console.log('\nreconstruir deja el histórico y la ficha describiéndose el uno al otro');
{
  const r = await rebuildStore({ dir, logPath, self: 'Campeon', idleSec: 20 });
  ok(r.ok, 'la reconstrucción termina bien', r.ok ? `${r.peleasDespues} peleas` : r.reason);
  ok(r.peleasDespues >= 2, 'y encuentra las peleas del log', r.peleasDespues);

  const store = new FightStore(dir);
  store.load();
  const enc = new Encyclopedia(store);
  const carga = enc.load();
  ok(!carga.rebuilt,
    'al abrir después, la ficha vale tal cual: no hay divergencia que corregir',
    carga.reason ?? 'sin motivo');
  ok(carga.folded === 0, 'ni peleas sueltas que plegar', carga.folded);
  ok(enc.foe('a froglok tad')?.kills === 1,
    'y la ficha conoce a los enemigos del log', enc.foe('a froglok tad')?.kills);
}

console.log('\nla ficha se aparta con el histórico, no se queda descolgada');
{
  const copias = fs.readdirSync(dir).filter((f) => f.endsWith('.bak'));
  // La primera reconstrucción no tenía nada que apartar; la segunda sí.
  const r = await rebuildStore({ dir, logPath, self: 'Campeon', idleSec: 20 });
  ok(r.ok, 'la segunda reconstrucción también termina bien', r.reason ?? '');
  const nuevas = fs.readdirSync(dir).filter((f) => f.endsWith('.bak') && !copias.includes(f));
  ok(nuevas.some((f) => f.startsWith('encyclopedia.json')),
    'la ficha anterior queda apartada con marca de tiempo, como las peleas',
    nuevas.join(', '));
  ok(nuevas.some((f) => f.startsWith('fights.ndjson'))
    && nuevas.some((f) => f.startsWith('fights.idx')),
    'y las peleas también, en la misma tanda');

  const store = new FightStore(dir);
  store.load();
  const enc = new Encyclopedia(store);
  const carga = enc.load();
  ok(!carga.rebuilt && carga.folded === 0,
    'y lo que queda sigue sin necesitar corrección', carga.reason ?? 'sin motivo');
}

console.log('\nsin log no se toca nada');
{
  const antes = fs.readdirSync(dir).sort().join(',');
  const r = await rebuildStore({ dir, logPath: path.join(tmp, 'no-existe.txt'), self: 'Campeon' });
  ok(!r.ok && r.reason === 'sin-log', 'se niega y dice por qué', r.reason);
  ok(fs.readdirSync(dir).sort().join(',') === antes,
    'y la carpeta queda exactamente como estaba');
}

fs.rmSync(tmp, { recursive: true, force: true });
/**
 * LA PODA DE LAS COPIAS. Esto BORRA FICHEROS DEL USUARIO, así que lo que se
 * prueba no es que funcione: es que no se lleve por delante lo que no debe.
 *
 * En una carpeta real había 113 copias en 56 tandas después de cuatro días, y
 * conviviendo con ellas dos puntos de control con nombre —`antes-de-trios`,
 * `antes-del-who`— que una persona puso a mano antes de una operación concreta
 * y cuyo valor es justamente que siguen ahí.
 */
console.log('\nla poda de las copias de reconstrucción');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-poda-'));
  const toca = (n) => fs.writeFileSync(path.join(dir, n), 'x');
  // Cinco tandas completas, de la más vieja a la más nueva, y desordenadas al
  // escribirlas para que ordenar por fecha del fichero no cuele por casualidad.
  const marcas = ['2026-08-05T09-55-26', '2026-08-06T10-06-06', '2026-08-07T11-41-43',
    '2026-08-08T12-14-06', '2026-08-09T13-38-00'];
  for (const m of [marcas[2], marcas[0], marcas[4], marcas[1], marcas[3]]) {
    toca(`fights.ndjson.${m}.bak`);
    toca(`fights.idx.${m}.bak`);
    toca(`encyclopedia.json.${m}.bak`);
  }
  // Y lo que NO pertenece a ninguna tanda.
  toca('config.json.antes-de-trios.bak');
  toca('config.json.antes-del-who.bak');
  toca('fights.ndjson');

  const { tandas, podar } = await import('../src/rebuild.js');
  const antes = tandas(dir);
  ok(antes.length === 5, 'se ven las cinco tandas', antes.length);
  ok(antes[0].marca === marcas[4], 'y la primera es la más NUEVA, por la marca y no por la fecha del fichero', antes[0].marca);

  const r = podar(dir, 3);
  const queda = fs.readdirSync(dir);
  ok(r.borrados.length === 6, 'borra las dos tandas sobrantes enteras: 6 ficheros', r.borrados.length);
  ok(tandas(dir).length === 3, 'quedan tres tandas', tandas(dir).length);
  for (const m of marcas.slice(2)) {
    ok(queda.includes(`fights.ndjson.${m}.bak`), `se conserva la tanda ${m}`);
  }
  // MEDIA TANDA ES PEOR QUE NINGUNA: de las que quedan tienen que quedar los
  // tres ficheros, no uno. Restaurar un `fights.ndjson` con el índice de otro
  // momento deja el índice apuntando a bytes que no son.
  for (const m of marcas.slice(2)) {
    const trozos = queda.filter((f) => f.includes(m)).length;
    ok(trozos === 3, `y entera, no a medias (${m})`, trozos);
  }
  for (const m of marcas.slice(0, 2)) {
    ok(!queda.some((f) => f.includes(m)), `se va la tanda ${m} COMPLETA`);
  }

  ok(queda.includes('config.json.antes-de-trios.bak')
    && queda.includes('config.json.antes-del-who.bak'),
  'los puntos de control con nombre NO se tocan: no llevan marca y no son una tanda');
  ok(queda.includes('fights.ndjson'), 'y el almacén de verdad tampoco, evidentemente');

  // Idempotente: volver a podar con tres tandas no borra nada más.
  const otra = podar(dir, 3);
  ok(otra.borrados.length === 0, 'podar otra vez no borra nada', otra.borrados.length);
  ok(r.conservadas.length === 3 && r.conservadas[0] === marcas[4],
    'y dice cuáles conserva, para poder enseñarlo', r.conservadas.join(' '));

  // Una carpeta sin copias no es un error.
  const vacia = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-poda2-'));
  ok(podar(vacia, 3).borrados.length === 0, 'una carpeta sin copias no rompe nada');
  fs.rmSync(vacia, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
