import fs from 'node:fs';
import { LogTailer } from '../src/tailer.js';
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

const F = (process.env.TEMP || '/tmp') + '/eqlog_Test_Legends.txt';
fs.writeFileSync(F, '');
const stamp = (s) => {
  const d = new Date(2026, 7, 4, 21, 30, s);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (n) => String(n).padStart(2,'0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};
const L = [
  [0,'You have entered Lower Guk.'],
  [1,'You slash a froglok tad for 42 points of damage.'],
  [1,'You score a critical hit! (98)'],
  [1,'You slash a froglok tad for 98 points of damage.'],
  [2,'Gorgo says, \'Yes, Master.\''],
  [2,'Gorgo hits a froglok tad for 33 points of damage.'],
  [3,'You begin casting Shock of Blades.'],
  [3,'a froglok tad was hit by non-melee for 156 points of damage.'],
  [4,'a froglok tad has taken 65 damage from your Envenomed Bolt.'],
  [4,'You try to slash a froglok tad, but a froglok tad parries!'],
  [5,'a froglok tad hits YOU for 27 points of damage.'],
  [6,'You have slain a froglok tad!'],
];

const parser = new Parser({ self: 'Miguel' });
// Con `self`, como en producción. Sin él, el filtro de relevancia se desactiva
// entero: esta prueba pasaba con las muertes rotas justo por eso.
const tracker = new EncounterTracker({ self: 'Miguel', idleSec: 20 });
const t = new LogTailer(F, { pollMs: 20 });
let seq = 0;
t.on('line', (l) => tracker.feed(parser.parse(l, seq++)));
await t.start();

fs.appendFileSync(F, L.map(([s, m]) => `${stamp(s)} ${m}\n`).join(''));
await new Promise(r => setTimeout(r, 300));
t.stop();

const enc = tracker.current;
const { rows, total, duration, raidDps } = enc.totals();
console.log(`duración ${duration}s · total ${total} · grupo ${raidDps.toFixed(1)} dps`);
for (const r of rows) {
  console.log(` ${r.name.padEnd(10)} ${String(r.damage).padStart(5)}  ${r.dps.toFixed(1).padStart(6)} dps  ${(r.share*100).toFixed(1)}%  crit ${r.crits}  acc ${(r.accuracy*100).toFixed(0)}%  max ${r.max}`);
  for (const [ab, b] of r.byAbility) console.log(`    · ${ab.padEnd(20)} ${String(b.sum).padStart(5)} (${b.n})`);
}
console.log('kills:', enc.kills.map(k=>k.victim).join(','));
console.log('desconocidas:', parser.unrecognized);

// ── La carpeta de datos no se mueve ────────────────────────────────────────
//
// Electron decide dónde vive `%APPDATA%` con `app.getName()`, que devuelve el
// `productName` de la RAÍZ del package.json si existe y, si no, el `name`.
// Comprobado ejecutándolo:
//
//   name: eql-parse, productName sólo dentro de "build"  →  Roaming/eql-parse
//   productName en la RAÍZ                               →  Roaming/EQL Parse
//
// O sea que añadir un `productName` a la raíz, o tocar `name`, deja huérfanos
// el histórico, la enciclopedia y la configuración de todo el que tenga la
// aplicación instalada. Sin aviso y sin vuelta atrás.
//
// El nombre visible se cambia en `build.productName`, que sólo lee
// electron-builder. Si algún día hubiera que mover la carpeta de verdad, hace
// falta migración —detectar la vieja, mover el contenido y decirlo—, no un
// cambio de campo.
{
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log('\ncarpeta de datos');
  let mal = 0;
  const comprueba = (cond, msg, extra) => {
    console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
    if (!cond) mal++;
  };
  comprueba(pkg.name === 'eql-parse',
    '`name` sigue siendo eql-parse, que es lo que fija %APPDATA%', pkg.name);
  comprueba(pkg.productName === undefined,
    'no hay `productName` en la RAÍZ: si lo hubiera, Electron movería la carpeta',
    pkg.productName);
  comprueba(typeof pkg.build?.productName === 'string',
    'el nombre visible vive en build.productName, que no toca la carpeta',
    pkg.build?.productName);
  comprueba(pkg.build?.appId === 'dev.miguelangelfernandez.eqlparse',
    'y el appId no cambia: Windows lo usa para saber que es la misma aplicación',
    pkg.build?.appId);

  // Y el crédito, que es lo único que el renombrado de la 1.7.0 SÍ tenía que
  // añadir. Va aquí y no en la interfaz porque es metadato del instalador:
  // es lo que Windows enseña como editor en «Aplicaciones instaladas», y si
  // desaparece no se nota mirando la aplicación.
  const CREDITO = 'Campeon Delmundo de <SPAIN> Guild';
  comprueba(pkg.build?.win?.publisherName === CREDITO,
    'el crédito viaja en los metadatos del instalador', pkg.build?.win?.publisherName);

  // El nombre visible perdió el <SPAIN> en la 1.7.0; el crédito lo conserva.
  // Son dos cosas distintas: cómo se llama la aplicación y quién la hizo.
  comprueba(!/SPAIN/.test(pkg.build?.productName ?? ''),
    'el nombre visible no lleva el <SPAIN>', pkg.build?.productName);
  comprueba(!/SPAIN/.test(pkg.build?.nsis?.shortcutName ?? ''),
    'ni el acceso directo', pkg.build?.nsis?.shortcutName);
  comprueba(!/SPAIN/.test(pkg.build?.nsis?.artifactName ?? pkg.build?.artifactName ?? ''),
    'ni el nombre del instalador', pkg.build?.nsis?.artifactName ?? pkg.build?.artifactName);

  if (mal) process.exit(1);
}

// ── Ninguna clave de traducción sin traducir ──────────────────────────────
//
// `t()` devuelve la propia clave cuando falta, y eso se ve en pantalla tal
// cual: el pie de la Enciclopedia llevaba tiempo enseñando «enc.rebuild» y
// «enc.stateLine» a quien lo mirase, porque las cinco claves de ese bloque no
// existían en ningún idioma. Se descubrió porque un usuario preguntó qué
// significaba lo que ponía ahí.
//
// Un hueco así no rompe nada y por eso no se cae solo: hay que buscarlo.
{
  const fs = await import('node:fs');
  const { t } = await import('../src/i18n.js');
  const usadas = new Set();
  // EL DIRECTORIO ENTERO, no una lista escrita a mano. La lista tenía cinco
  // ficheros y la interfaz ya tenía ocho: los que se añadieron después nunca
  // pasaron por aquí, así que una clave sin traducir en uno de ellos salía en
  // pantalla y la prueba decía que todo estaba bien. Pasó con la reproducción,
  // que enseñaba «ROW.PET» debajo de la mascota.
  //
  // Leyendo la carpeta, un fichero nuevo entra solo el día que se crea, que es
  // justo el día en que a nadie se le ocurre venir a apuntarlo aquí.
  const dirUI = new URL('../ui/', import.meta.url);
  for (const f of fs.readdirSync(dirUI).filter((x) => x.endsWith('.js'))) {
    const s = fs.readFileSync(new URL(f, dirUI), 'utf8');
    for (const m of s.matchAll(/\bt\(\s*'([^']+)'/g)) usadas.add(m[1]);
  }
  const vars = { n: 1, foes: 1, fights: 1, k: 1, d: '', who: '', levels: '', total: 1, inv: '' };
  const rotas = [...usadas].filter((k) => t(k, vars) === k).sort();
  console.log(`\ntraducciones: ${usadas.size} claves usadas por la interfaz`);
  if (rotas.length) {
    console.log(`  MAL  ${rotas.length} sin traducir, se verían en crudo: ${rotas.join(', ')}`);
    process.exit(1);
  }
  console.log('  ok   todas existen');

  // Y en los CINCO idiomas, no sólo en uno.
  //
  // Mirar sólo `t()` no basta: cae a inglés y luego a español, así que una
  // clave que falte en francés devuelve el texto inglés y la comprobación de
  // arriba la da por buena. El usuario francés vería inglés suelto en medio de
  // su interfaz, que es un fallo más discreto y por eso dura más.
  const src = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
  const veces = (clave) => (src.match(new RegExp(`'${clave.replace(/\./g, '\\.')}':`, 'g')) ?? []).length;
  const cojas = [...usadas].filter((k) => veces(k) < 5).sort();
  if (cojas.length) {
    console.log(`  MAL  ${cojas.length} no están en los cinco idiomas: ${cojas.join(', ')}`);
    process.exit(1);
  }
  console.log('  ok   y en los cinco idiomas');
}
