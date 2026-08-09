#!/usr/bin/env node
/**
 * MIGRACIÓN PUNTUAL, NO UNA HERRAMIENTA. Se escribió para UN almacén concreto
 * —el del autor, el 9 de agosto de 2026— y por eso lleva dos marcas de tiempo
 * codificadas en `EXCEPCIONES`. No se parametriza a propósito: `bin/` no entra
 * en `build.files`, así que no se empaqueta y nadie más va a ejecutarla.
 * Queda en el repositorio como registro de qué se recalculó y qué no.
 *
 * Reparte el daño recibido de las peleas ya guardadas por la postura de cada
 * golpe, releyendo el registro.
 *
 * POR QUÉ HACE FALTA RELEER. El almacén guarda el daño recibido en un solo
 * cubo por escuela, sin la postura de cada golpe. Con eso el consejo no tiene
 * más remedio que colapsar la pelea a una sola postura —la que más duró— y
 * acreditarle el daño entero, que en una pelea donde bailas es falso por
 * construcción. Lo que falta no está en el disco: está en el registro.
 *
 * LA COMPROBACIÓN VA DENTRO Y NO ANTES, y es la regla que gobierna este fichero.
 * No hay lista de precondiciones ni informe previo que valga: una comprobación
 * hecha antes describe el almacén de hace un rato, y entre medias el juego
 * escribe. Así que CADA pelea se reconstruye, se compara campo por campo contra
 * la guardada en todo lo que no debe cambiar, y sólo si coincide se le anota su
 * reparto. Si discrepa alguna que no esté en la lista de excepciones conocidas,
 * esto PARA sin escribir nada más.
 *
 * NO TOCA `fights.ndjson`. El reparto va a `tramos.ndjson`, indexado por la
 * hora de la pelea: `uid` es el byte donde empieza cada pelea en el fichero de
 * datos, así que alargar una línea ya escrita correría todas las siguientes y
 * dejaría el índice —y el `lastUid` de la enciclopedia— apuntando a otro sitio.
 *
 *   node bin/tramos-migrar.js            comprueba y NO escribe
 *   node bin/tramos-migrar.js --escribir comprueba y escribe
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Engine } from '../src/engine.js';
import { FightStore, MODELO_MEDICION } from '../src/store.js';

const ESCRIBIR = process.argv.includes('--escribir');

/**
 * Peleas que se quedan en el modelo viejo A PROPÓSITO, con el motivo que viaja
 * con ellas.
 *
 * Las dos son la misma pelea con la frontera puesta en dos sitios: el registro
 * tiene un hueco de exactamente 20 segundos y `idleSec` vale exactamente 20, así
 * que el cierre en directo (reloj de pared) la partió y el cierre al reconstruir
 * (marca del registro) no la parte. Reconstruirlas cambiaría sus fronteras, y
 * eso es cambiar el histórico, no corregirlo. Se quedan como están hasta que se
 * arregle la causa — ver el comentario de `tick()` en `src/encounter.js`.
 */
const EXCEPCIONES = new Map([
  [1786268580000, 'frontera-idle-20s'],
  [1786268933000, 'frontera-idle-20s'],
]);

/**
 * Lo que ni el reparto por postura ni el tercer cubo de la serie pueden mover.
 *
 * `serieDmg`, `serieTaken` y `serieHeal` entran porque ahora también se toca la
 * serie: rehacer los cubos reconstruidos no puede mover ni un punto de lo
 * observado que va a su lado, y comprobarlo cuesta una suma.
 *
 * Lo que NO entra es la suma de los cubos reconstruidos. Cambia a propósito: la
 * serie guardada los tiene fundidos, inflados y con decimales, y rehacerlos es
 * el objeto de esta migración. Se reporta al final en vez de comprobarse.
 */
const CAMPOS = ['start', 'fin', 'duration', 'total', 'enemyTotal', 'healing',
  'kills', 'dmg', 'taken', 'hits', 'misses', 'swings', 'filas', 'mioTaken', 'mioObs',
  'serieN', 'serieDmg', 'serieTaken', 'serieHeal'];

const huella = (f, self) => {
  const mio = (f.rows ?? []).find((x) => x.name === self);
  const suma = (k) => (f.rows ?? []).reduce((a, x) => a + (x[k] ?? 0), 0);
  return {
    start: f.start, fin: (f.start ?? 0) + (f.duration ?? 0), duration: f.duration,
    total: f.total, enemyTotal: f.enemyTotal, healing: f.healing,
    kills: (f.kills ?? []).length,
    dmg: suma('damage'), taken: suma('taken'), hits: suma('hits'),
    misses: suma('misses'), swings: suma('swingsAgainst'),
    filas: (f.rows ?? []).length,
    mioTaken: mio?.taken ?? 0,
    mioObs: JSON.stringify((mio?.takenByType ?? []).map((x) => [x.name, x.sum, x.n]).sort()),
    serieN: (f.series ?? []).length,
    serieDmg: (f.series ?? []).reduce((a, p) => a + (p.dmg ?? 0), 0),
    serieTaken: (f.series ?? []).reduce((a, p) => a + (p.taken ?? 0), 0),
    serieHeal: (f.series ?? []).reduce((a, p) => a + (p.heal ?? 0), 0),
  };
};

const dir = process.env.EQL_STORE
  ?? path.join(process.env.APPDATA ?? os.homedir(), 'eql-parse');
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
const n0 = (v) => Math.round(v ?? 0).toLocaleString('es-ES');

console.log(`almacén  : ${dir}`);
console.log(`registro : ${cfg.logPath}`);
console.log(ESCRIBIR ? 'modo     : ESCRIBIR\n' : 'modo     : sólo comprobar (usa --escribir para anotar)\n');

// ── Testigo de la cola, antes ──
const bytesAntes = fs.statSync(cfg.logPath).size;
console.log(`registro antes : ${bytesAntes.toLocaleString('es-ES')} bytes   ${new Date().toLocaleTimeString('es-ES')}`);

// ── Reconstrucción en frío, en una carpeta que se tira ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eqltramos-'));
const engine = new Engine();
engine.setStorePath(tmp);
engine.setTrios(cfg.trios ?? []);
engine.setCompanions(cfg.companions ?? []);
await engine.attach(cfg.logPath, { self: cfg.self ?? null, fromStart: true, idleSec: cfg.idleSec ?? 20 });
engine.tracker.tick(Number.MAX_SAFE_INTEGER);
engine.saveStore();
const self = engine.self;
engine.detach();

const viejo = new FightStore(dir, self); viejo.load();
const frio = new FightStore(tmp, self); frio.load();
const porHora = new Map(frio.index.map((s) => [s.at, s]));

console.log(`guardadas: ${viejo.index.length}   en frío: ${frio.index.length}   yo: ${self}\n`);

// ── Pelea a pelea: comprobar y anotar ──
let ok = 0, exceptuadas = 0, sinPareja = 0, sinTramos = 0;
let serieAntes = 0, serieDespues = 0, serieUnmitTotal = 0;
const anotar = [];
for (const sm of viejo.index) {
  const guardada = viejo.get(sm.uid);
  if (!guardada) continue;
  viejo.cache.clear();

  const motivo = EXCEPCIONES.get(sm.at);
  const smf = porHora.get(sm.at);
  const fria = smf ? frio.get(smf.uid) : null;
  if (smf) frio.cache.clear();

  if (motivo) {
    exceptuadas++;
    anotar.push({ at: sm.at, self, modelo: 2, motivo });
    continue;
  }
  if (!fria) {
    console.log(`\nPARA: la pelea de ${new Date(sm.at).toLocaleString('es-ES')} no aparece al reconstruir.`);
    process.exit(1);
  }

  const a = huella(guardada, self), b = huella(fria, self);
  const rotos = CAMPOS.filter((c) => a[c] !== b[c]);
  if (rotos.length) {
    console.log(`\nPARA: ${new Date(sm.at).toLocaleString('es-ES')} discrepa en ${rotos.join(', ')}`);
    for (const c of rotos) console.log(`   ${c}: guardado=${String(a[c]).slice(0, 60)}  frío=${String(b[c]).slice(0, 60)}`);
    console.log('\nNo está en la lista de excepciones conocidas. No se ha escrito nada más.');
    process.exit(1);
  }

  const mio = (fria.rows ?? []).find((x) => x.name === self);
  const tramos = mio?.takenByStance ?? [];
  // El daño no mitigable segundo a segundo, DISPERSO: sólo los segundos en que
  // lo hubo. En un histórico real la mayoría de los segundos no tienen ninguno,
  // y escribir sus ceros multiplicaría el fichero por nada.
  const serie = (fria.series ?? [])
    .filter((p) => (p.tMelee ?? 0) + (p.tSpell ?? 0) + (p.tUnmit ?? 0) > 0)
    .map((p) => [p.s, p.tMelee ?? 0, p.tSpell ?? 0, p.tUnmit ?? 0]);
  if (!tramos.length && !serie.length) { sinTramos++; continue; }
  ok++;
  // Lo que la serie guardada decía y lo que dice la releída: se reporta porque
  // ES lo que se está corrigiendo, y por eso mismo no puede estar en la lista de
  // lo que no debe cambiar.
  serieAntes += (guardada.series ?? []).reduce((a, p) => a + (p.tMelee ?? 0) + (p.tSpell ?? 0), 0);
  serieDespues += serie.reduce((a, x) => a + x[1] + x[2] + x[3], 0);
  serieUnmitTotal += serie.reduce((a, x) => a + x[3], 0);
  const e = { at: sm.at, self, modelo: MODELO_MEDICION };
  if (tramos.length) e.takenByStance = tramos;
  if (serie.length) e.serie = serie;
  anotar.push(e);
}

console.log('COMPROBACIÓN');
console.log('-'.repeat(56));
console.log(`  idénticas en todo lo que no debe cambiar : ${ok + sinTramos}`);
console.log(`  con reparto por postura que anotar       : ${ok}`);
console.log(`  sin postura observada (nada que anotar)  : ${sinTramos}`);
console.log(`  exceptuadas a propósito                  : ${exceptuadas}`);
console.log(`  sin pareja                               : ${sinPareja}`);
console.log('\nLA SERIE, QUE ES LO QUE SE CORRIGE');
console.log('-'.repeat(56));
console.log(`  cubos reconstruidos, antes  : ${n0(serieAntes)}`);
console.log(`  cubos reconstruidos, después: ${n0(serieDespues)}`);
console.log(`  de los cuales NO mitigables : ${n0(serieUnmitTotal)}`);
console.log(`  diferencia                  : ${n0(serieDespues - serieAntes)}`);

if (ESCRIBIR) {
  let escritas = 0;
  for (const e of anotar) if (viejo.appendTramos(e)) escritas++;
  console.log(`\nanotadas en tramos.ndjson: ${escritas} de ${anotar.length}`);
} else {
  console.log(`\nnada escrito. ${anotar.length} peleas listas para anotar.`);
}

const bytesDespues = fs.statSync(cfg.logPath).size;
console.log(`\nregistro después: ${bytesDespues.toLocaleString('es-ES')} bytes   ${new Date().toLocaleTimeString('es-ES')}`);
console.log(`crecimiento     : ${n0(bytesDespues - bytesAntes)} bytes`);
console.log(`carpeta en frío : ${tmp}`);
