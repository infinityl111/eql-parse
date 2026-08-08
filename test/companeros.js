/**
 * El escape para compañeros declarados, que estaba escrito y sin conectar.
 *
 * EL FILTRO Y SU MOTIVO. El registro ve TODO lo que pasa alrededor, incluido
 * un desconocido matando bichos a diez metros, y sin filtro su pelea entra en
 * la tuya y falsea el reparto. Por eso se descarta lo que no te toca ni a ti
 * ni a lo tuyo. El motivo es bueno y el filtro hace falta.
 *
 * DONDE DEJABA DE VALER es con un compañero DECLARADO. No es un desconocido:
 * es alguien que has marcado a mano como que juega contigo. Había un escape
 * escrito para eso, `compaPega`, calculado y NO USADO — una sola aparición en
 * todo el fichero, la declaración.
 *
 * MEDIDO sobre un registro real con dos compañeros declarados:
 *
 *   sin conectar   463 peleas · 10.083.967 de daño · tuyo 4.165.021
 *   conectado      459 peleas · 10.126.995 de daño · tuyo 4.165.021
 *
 * 43.028 de daño suyo recuperado, y tus cifras EXACTAMENTE iguales — que es
 * la prueba de que el escape hace lo suyo sin tocar lo tuyo.
 *
 * Y LAS 4 PELEAS MENOS NO SON UN COSTE, son otra corrección: eran una sola
 * pelea que se partía porque durante unos segundos sólo pegaba el compañero,
 * sus eventos se tiraban, y el hueco parecía inactividad. El mismo fallo que
 * cortaba peleas en dos con las curaciones reflexivas, con otro disfraz.
 *
 * LO QUE NO PUEDE ROMPERSE, y por eso está abajo: el escape pide
 * `companions.has(...)`, o sea declarado a mano. En ese mismo registro,
 * `Hartemis` tiene 76.626 de daño descartado y cero peleas tuyas, y sigue
 * fuera. Es para los tuyos, no para quien pase.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const HORA = (s) => `[Fri Aug 07 20:${String(Math.floor(s / 60)).padStart(2, '0')}:${
  String(s % 60).padStart(2, '0')} 2026] `;

function corre(companeros) {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  tr.companions = new Set(companeros);
  const cerradas = [];
  tr.on('close', (e) => cerradas.push(e));
  return {
    tr,
    cerradas,
    mete: (l) => { const ev = p.parse(l); if (ev) tr.feed(ev); },
  };
}

const daño = (tr, quien) => {
  const r = tr.current?.totals().rows.find((x) => x.name === quien);
  return r?.damage ?? 0;
};

// ── 1. Lo suyo entra, PERO él solo no abre pelea ───────────────────────────
//
// La invariante es de otra prueba y es anterior: «lo que no puede pasar bajo
// ningún concepto es que su pelea sea la tuya». Al conectar el escape se probó
// a meterlo TAMBIÉN en la guarda de apertura, y esa prueba lo cazó.
//
// El comentario del escape decía «permite que la pelea de tu grupo exista
// cuando tú no llegaste a tocar al enemigo», y esa frase se lee de dos
// maneras: estás en la pelea pero no has tocado a ESE bicho —cierto, y es lo
// que arregla la guarda de relevancia— o no estás en absoluto —prohibido—.
// Vale la primera, y sólo la primera.
console.log('\nel compañero declarado');
{
  const solo = corre(['Kalforgelp']);
  solo.mete(`${HORA(1)}Kalforgelp smites a ghoul for 100 points of damage.`);
  ok(!solo.tr.current, 'él solo NO abre una pelea: sin ti no es tu pelea');

  // Contigo dentro, lo suyo cuenta aunque pegue a un bicho que tú no tocas.
  const { tr, mete } = corre(['Kalforgelp']);
  mete(`${HORA(1)}Campeon hits a zombie for 10 points of damage.`);
  mete(`${HORA(2)}Kalforgelp smites a ghoul for 100 points of damage.`);
  ok(daño(tr, 'Kalforgelp') === 100,
    'estando tú, su daño cuenta aunque sea contra otro bicho', daño(tr, 'Kalforgelp'));
  ok(daño(tr, 'Campeon') === 10, 'y lo tuyo no se mueve', daño(tr, 'Campeon'));
}

// ── 2. El desconocido sigue fuera, que es el motivo del filtro ─────────────
console.log('\nel desconocido de al lado');
{
  const { tr, mete } = corre(['Kalforgelp']);
  mete(`${HORA(1)}Hartemis smites a ghoul for 100 points of damage.`);
  ok(!tr.current, 'no abre pelea: no está declarado y su bronca no es la tuya');

  // Y si TU pelea ya existe, tampoco se cuela.
  const b = corre(['Kalforgelp']);
  b.mete(`${HORA(1)}Campeon hits a zombie for 10 points of damage.`);
  b.mete(`${HORA(2)}Hartemis smites a ghoul for 500 points of damage.`);
  ok(daño(b.tr, 'Hartemis') === 0,
    'ni entra en la tuya pegando a otra cosa', daño(b.tr, 'Hartemis'));
}

// ── 3. Sin declarar a nadie, todo sigue como antes ─────────────────────────
console.log('\nsin compañeros declarados');
{
  const { tr, mete } = corre([]);
  mete(`${HORA(1)}Kalforgelp smites a ghoul for 100 points of damage.`);
  ok(!tr.current, 'el escape no se aplica solo: hay que declarar a alguien');
}

// ── 4. Y no parte la pelea cuando sólo pega él ─────────────────────────────
//
// Aquí estaban las 4 peleas de más: durante un hueco largo sólo pegaba el
// compañero, sus eventos se tiraban, y al no llegar nada la pelea se cerraba
// por inactividad. Con 25 segundos de sólo-compañero y un corte de 20, sin el
// escape salen DOS peleas donde hay una.
console.log('\nun hueco en el que sólo pega él');
{
  const { cerradas, tr, mete } = corre(['Kalforgelp']);
  mete(`${HORA(1)}Campeon hits a ghoul for 10 points of damage.`);
  for (let s = 5; s <= 30; s += 5) {
    mete(`${HORA(s)}Kalforgelp smites a ghoul for 20 points of damage.`);
  }
  mete(`${HORA(35)}Campeon hits a ghoul for 10 points of damage.`);
  ok(cerradas.length === 0, 'no se ha cerrado ninguna por el camino', cerradas.length);
  ok(daño(tr, 'Campeon') === 20, 'y los dos golpes tuyos están en la MISMA pelea',
    daño(tr, 'Campeon'));
  ok(daño(tr, 'Kalforgelp') === 120, 'con lo suyo del hueco dentro', daño(tr, 'Kalforgelp'));
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
