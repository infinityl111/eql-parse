#!/usr/bin/env node
/**
 * ¿QUÉ RÓTULOS PUEDE PRODUCIR DE VERDAD LA SECCIÓN DE TEMPORIZADORES?
 *
 * ── POR QUÉ NO BASTA CON QUE ESTÉN REFERENCIADOS ──────────────────────────
 *
 * `cro.retenido` estaba referenciado en `ui/app.js` y llevaba meses siendo
 * **inalcanzable**: su rama iba detrás de un `if (!valor)` que siempre se
 * cumplía. Un barrido de referencias lo daba por vivo. Las 39 claves `cro.*`
 * están referenciadas; eso no distingue nada.
 *
 *     UN RÓTULO QUE NINGUNA PRUEBA PUEDE HACER APARECER ES UN RÓTULO MUERTO.
 *
 * ── CÓMO SE COMPRUEBA ─────────────────────────────────────────────────────
 *
 * Levantando la aplicación DE VERDAD sobre un almacén y una configuración
 * preparados —nunca los de Campeón—, poniendo temporizadores en todos los
 * estados que se sepan producir, y mirando qué texto sale a pantalla.
 *
 * Lo que aparece, está vivo. Lo que no, **o falta por implementar o sobra por
 * retirar**, y hoy las dos cosas se veían igual que las vivas.
 *
 * Uso:  node bin/rotulos.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUERTO, espera, puertoLibre, lanzar, conecta, cdp, evaluador } from './cdp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { FightStore } = await import(`file://${RAIZ.replace(/\\/g, '/')}/src/store.js`);

// ── 1. Un rincón propio: ni el almacén ni la configuración de nadie ────────
/**
 * LA CARPETA QUE SE LE PASA A `--user-data-dir` **ES** `userData`.
 *
 * Lo di por hecho al revés —que Electron colgaría de ella `app.getName()`— y
 * escribí la configuración en `<carpeta>/eql-parse/config.json`. La aplicación
 * la buscaba en `<carpeta>/config.json`, no la encontraba, y arrancaba en el
 * asistente de bienvenida: **ninguna sección se pintaba y los 39 rótulos salían
 * muertos**.
 *
 * No se resolvió razonando: se resolvió **listando qué había de verdad bajo esa
 * carpeta después de arrancar**. Ahí estaban `store.json`, `Network/` y
 * `Local Storage/` en la RAÍZ, y mi `eql-parse/config.json` intacto a un nivel
 * de profundidad, sin que nadie lo hubiera leído.
 */
const DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-rotulos-'));
const AHORA = Math.floor(Date.now() / 1000);
const BASE = "Nagafen's Lair";

const store = new FightStore(DATOS);
store.self = 'Campeon';
const pelea = (hace, kills, killTimes, diff = 2) => {
  const atMs = (AHORA - hace) * 1000;
  store.append({
    zone: `${BASE} ${diff} (Adaptive)`, zoneBase: BASE, diff, diffTag: 'Adaptive',
    duration: 60, total: 1000, start: AHORA - hace, kills, killTimes,
    rows: [{ name: 'Campeon', side: 'ally' }, ...[...new Set(kills)].map((k) => ({ name: k, side: 'enemy' }))],
  }, atMs);
};
// `contando`: muerto hace poco, con tiempo de zona por delante → cuenta atrás.
pelea(60 * 60, ['contando'], [{ name: 'contando', t: 5 }]);
pelea(30 * 60, ['contando'], [{ name: 'contando', t: 5 }]);   // 2ª → 1 observación
// `vencido`: muerto hace mucho → ya debería estar.
pelea(48 * 3600, ['vencido'], [{ name: 'vencido', t: 5 }]);
// `variosDemostrado`: dos muertes en la MISMA pelea → multiplicidad demostrada.
pelea(2 * 3600, ['variosDemostrado', 'variosDemostrado'],
  [{ name: 'variosDemostrado', t: 5 }, { name: 'variosDemostrado', t: 40 }]);
// `conObs`: cuatro peleas → 3 observaciones, para la rama de «retenido».
for (const h of [20 * 3600, 16 * 3600, 12 * 3600, 8 * 3600]) pelea(h, ['conObs'], [{ name: 'conObs', t: 5 }]);

/** Los estados que se saben producir, uno por temporizador. */
const CRONOS = [
  { nombre: 'contando', base: BASE, diff: 2, mode: null },
  { nombre: 'vencido', base: BASE, diff: 2, mode: null },
  { nombre: 'nuncaMuerto', base: BASE, diff: 2, mode: null },
  { nombre: 'variosDemostrado', base: BASE, diff: 2, mode: null, aviso: 'varios-a-la-vez' },
  { nombre: 'quizaVarios', base: BASE, diff: 2, mode: null, aviso: 'probablemente-varios', muertes: 14 },
  { nombre: 'conObs', base: BASE, diff: 2, mode: null },
  { nombre: 'conManual', base: BASE, diff: 2, mode: null, manual: 900 },
  { nombre: 'sinZona', base: null, diff: null, mode: null },
];
/**
 * LA CONFIGURACIÓN SE COPIA DE LA REAL, y sólo se le cambian los cronos.
 *
 * Escrita de cero, la aplicación arranca en el ASISTENTE DE BIENVENIDA y no
 * pinta ninguna sección: el barrido daba 0 de 39 y todos «muertos», incluidos
 * los que se veían en pantalla cinco minutos antes. Adivinar qué banderas
 * marcan la configuración por hecha es justo el trabajo que copiarla evita.
 *
 * Se copia, NO se toca: el original se abre en lectura y se escribe en el
 * rincón temporal.
 */
const REAL = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'config.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'config.json'),
].find((f) => fs.existsSync(f));
if (!REAL) {
  console.error('No hay configuración real de la que partir: sin ella la aplicación');
  console.error('arranca en el asistente y esta comprobación no mide nada.');
  process.exit(3);
}
/**
 * Y EL REGISTRO TIENE QUE SER PEQUEÑO. Apuntando al de Campeón —114 MB— el
 * motor se pasa el arranque leyéndolo y `snap.path` sigue vacío, así que la
 * pantalla se queda en el asistente de bienvenida y no pinta ninguna sección.
 * Otra vez el mismo síntoma —«todo muerto»— por otra causa del instrumento.
 */
const LOG = path.join(DATOS, 'eqlog_Prueba_erudin.txt');
fs.writeFileSync(LOG, [
  "[Tue Aug 04 11:04:10 2026] Logging to 'eqlog.txt' is now *ON*.",
  `[Tue Aug 04 11:04:15 2026] You have entered ${BASE} 2 (Adaptive).`,
  '[Tue Aug 04 11:04:20 2026] You have slain contando!',
  '',
].join('\r\n'));
/**
 * Y EL ALMACÉN VA SELLADO CON SU VERSIÓN — la cuarta causa, y la última.
 *
 * Sin el sello, la aplicación cree que el histórico es de un formato viejo y
 * saca el cartel de «tu histórico se guardó con cifras incorrectas», que se
 * come la vista entera. `ui-volcar` no lo sufre porque usa el `userData` REAL,
 * ya sellado — y comparar los dos arranques es lo que lo señaló, igual que
 * antes lo señaló listar la carpeta. Deducir no lo habría dado.
 */
store.stamp();
const cfg = { ...JSON.parse(fs.readFileSync(REAL, 'utf8')), lang: 'es', cronos: CRONOS, path: LOG };
fs.writeFileSync(path.join(DATOS, 'config.json'), JSON.stringify(cfg, null, 1));

// ── 2. Las claves a vigilar ────────────────────────────────────────────────
const i18n = fs.readFileSync(path.join(RAIZ, 'src', 'i18n.js'), 'utf8');
const es = i18n.slice(i18n.indexOf('const ES = {'), i18n.indexOf('const EN = {'));
const CLAVES = [...new Set([...es.matchAll(/'(cro\.[a-zA-Z0-9.]+)'/g)].map((m) => m[1]))];
const TEXTO = new Map();
for (const k of CLAVES) {
  const m = new RegExp(`'${k.replace(/\./g, '\\.')}': "((?:[^"\\\\]|\\\\.)*)"`).exec(es);
  if (m) TEXTO.set(k, m[1].replace(/\\"/g, '"'));
}

// ── 3. Levantar la aplicación de verdad y mirar qué sale ───────────────────
if (!(await puertoLibre())) { console.error(`\nPuerto ${PUERTO} ocupado.\n`); process.exit(2); }
const hijo = lanzar([`--user-data-dir=${DATOS}`]);
const pagina = await conecta();
const { ws, manda, listo } = cdp(pagina.webSocketDebuggerUrl);
await listo;
const evalua = evaluador(manda);
const fin = (c) => {
  try { ws.close(); } catch { /* ya */ }
  hijo.kill();
  try { fs.rmSync(DATOS, { recursive: true, force: true }); } catch { /* da igual */ }
  process.exit(c);
};

let visto = '';
try {
  await manda('Runtime.enable');
  await espera(3000);

  for (const sec of ['cronos', 'escena']) {
    await evalua(`document.querySelector('[data-sec=${sec}]')?.click()`);
    await espera(5000);
    if (sec === 'escena') {
      await evalua("document.querySelector('#croEscBtn')?.click()");
      await espera(1200);
    }
    /**
     * NO BASTA CON `innerText`: varios rótulos viven en ATRIBUTOS —el
     * `placeholder` de un campo, el `title` de un icono— y no son texto del
     * documento. Buscándolos sólo en `innerText` salían muertos estando a la
     * vista, que es exactamente el falso positivo que esta herramienta existe
     * para no producir.
     */
    visto += await evalua(`(() => {
      const t = [document.body.innerText];
      for (const e of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
        t.push(e.getAttribute('placeholder') || '');
        t.push(e.getAttribute('title') || '');
        t.push(e.getAttribute('aria-label') || '');
      }
      return t.join(String.fromCharCode(10));
    })()`) + '\n';
  }
} catch (e) { console.error('\n', e?.message ?? e, '\n'); }

// ── 4. El veredicto ────────────────────────────────────────────────────────
const norm = (s) => String(s).replace(/\{[^}]*\}/g, '\u0001').replace(/\s+/g, ' ').trim().toLowerCase();
const cuerpo = norm(visto);
const vivas = [], muertas = [];
for (const k of CLAVES) {
  const t = norm(TEXTO.get(k) ?? '');
  if (!t) { muertas.push([k, '(sin texto)']); continue; }
  // Con marcador de interpolación se compara el trozo más largo y estable.
  const trozo = t.split('\u0001').map((x) => x.trim()).filter((x) => x.length > 6)
    .sort((a, b) => b.length - a.length)[0] ?? t;
  (cuerpo.includes(trozo) ? vivas : muertas).push([k, trozo.slice(0, 46)]);
}

/**
 * EL CONTROL DE LA PROPIA HERRAMIENTA, y hace falta porque ya ha mentido tres
 * veces seguidas.
 *
 * `cro.title` es el encabezado de la sección: si la sección se pinta, SALE. Que
 * salga muerto no dice nada de los rótulos — dice que esto no ha llegado a
 * pintar la sección, y entonces el recuento entero es basura.
 *
 * Ha pasado por tres causas distintas, todas del instrumento y ninguna del
 * programa: `--user-data-dir` es la carpeta padre y no la de la aplicación; sin
 * configuración previa la aplicación arranca en el asistente de bienvenida; y
 * con el registro de 114 MB el motor no llega a enganchar antes de mirar. Las
 * tres daban el MISMO síntoma —«39 de 39 muertos»— que es justo el que no hay
 * que creerse.
 */
/**
 * DOS CANARIOS Y NO UNO, y el segundo es el que importa.
 *
 * `cro.title` sólo demuestra que la sección puso su encabezado. `cro.close` va
 * en el botón «Cerrar» de CADA ficha, así que demuestra que las fichas se han
 * pintado — que es donde vive casi todo lo que se está midiendo.
 *
 * Con un solo canario la herramienta daba «17 de 39» y se quedaba tan ancha,
 * con `cro.add`, `cro.close` y `cro.setManual` en la lista de muertos estando
 * los tres a la vista. Un encabezado sin fichas es media sección, y media
 * sección da un recuento que parece bueno.
 */
const CANARIO = 'cro.close';
if (!vivas.some(([k]) => k === CANARIO)) {
  console.error('\nESTA COMPROBACIÓN NO ESTÁ MIDIENDO NADA.\n');
  console.error(`«${CANARIO}» va en el botón «Cerrar» de CADA ficha: si la sección pinta, sale.`);
  console.error('Si sale muerto, las fichas no se han pintado y el recuento de abajo');
  console.error('no vale. NO se publica ese número.\n');
  console.error('Lo que se vio en pantalla, en crudo:');
  console.error(JSON.stringify(cuerpo.slice(0, 700)));
  console.error('');
  fin(1);
}

/**
 * TRES CUBOS Y NO DOS. «No alcanzado» y «muerto» no son lo mismo, y mezclarlos
 * es la misma familia que todo lo de hoy: un rotulo que esta sonda no ejercita
 * —porque no abre el panel de Escena, o porque nunca se queda sin cronos— no
 * esta muerto, esta SIN PROBAR. Llamarlo muerto invitaria a retirarlo.
 *
 * Lo que la sonda no ejercita va declarado aqui, con su motivo, para que la
 * lista de muertos sea de verdad la lista de muertos.
 */
const NO_EJERCITADOS = {
  'cro.escBoton': 'el panel de Escena necesita una pelea abierta; el registro de prueba no la tiene',
  'cro.escTitulo': 'idem', 'cro.escSub': 'idem', 'cro.escNoMurio': 'idem',
  'cro.escYaEsta': 'idem', 'cro.escDosVeces': 'idem', 'cro.escMurio': 'idem',
  'cro.escEncantado': 'idem', 'cro.escPoner': 'idem', 'cro.escVacio': 'idem',
  'cro.vacio': 'hace falta CERO temporizadores; la sonda abre ocho a proposito',
};
const sinProbar = muertas.filter(([k]) => k in NO_EJERCITADOS);
const sinCaso = muertas.filter(([k]) => !(k in NO_EJERCITADOS));

console.log(`
${vivas.length} de ${CLAVES.length} rotulos SALEN a pantalla
`);
console.log(`${sinProbar.length} que esta sonda NO EJERCITA (no es lo mismo que muertos):`);
for (const [k] of sinProbar) console.log(`   ${k.padEnd(22)} ${NO_EJERCITADOS[k]}`);
console.log(`
${sinCaso.length} SIN NINGUN CASO QUE LOS GENERE — estos son los sospechosos:`);
for (const [k, t] of sinCaso) console.log(`   ${k.padEnd(22)} «${t}»`);
console.log(`
Cada uno de esos o falta por implementar, o sobra por retirar.`);
console.log(`Lo que NO puede es seguir sin distinguirse de los vivos.
`);
fin(0);
