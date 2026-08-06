#!/usr/bin/env node
/**
 * Rehace la enciclopedia desde el histórico ya guardado.
 *
 * Uso:  npm run enc:rebuild
 *       npm run enc:rebuild -- "C:\\ruta\\a\\la\\carpeta"
 *
 * NO relee el log ni toca el histórico: sólo vuelve a plegar las peleas que ya
 * están guardadas. La aplicación hace esto sola cuando detecta que la ficha va
 * desfasada; esto es para cuando quieres forzarlo o ver los números.
 *
 * Y comprueba lo único que de verdad importa de una ficha aprendida: que decir
 * lo mismo dos veces por caminos distintos dé lo mismo. Se rehace, se compara
 * con lo que había y se dice si alguna cifra se ha movido.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';

const CANDIDATES = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
];

const dir = process.argv[2] ?? CANDIDATES.find((d) => fs.existsSync(path.join(d, 'fights.idx')));
if (!dir) {
  console.error('No encuentro el almacén. Pásame la carpeta:');
  for (const c of CANDIDATES) console.error(`  ${c}`);
  process.exit(1);
}

const n = (v) => Math.round(v ?? 0).toLocaleString('es-ES');
const store = new FightStore(dir);
store.load();

console.log(`\n  ${dir}\n`);
console.log(`  peleas en el histórico     ${n(store.index.length)}`);

// Lo que había, tal cual, para poder compararlo después.
const antes = new Encyclopedia(store);
const cargada = antes.load();
const huellaAntes = JSON.stringify(antes.ledger.list());
console.log(`  ficha anterior             ${cargada.rebuilt
  ? `rehecha al cargar (${cargada.reason})` : `${n(cargada.foes)} enemigos`}`);
if (cargada.folded) console.log(`  peleas que le faltaban     ${n(cargada.folded)}`);

const enc = new Encyclopedia(store);
const r = enc.rebuild();
if (!r.ok) {
  console.error('\n  NO SE HA PODIDO ESCRIBIR. ¿Permisos en esa carpeta?\n');
  process.exit(1);
}

const a = enc.audit();
console.log(`\n  enemigos con ficha         ${n(a.foes)}`);
console.log(`  fichas por dificultad      ${n(enc.counts().zonas.fichas)}`);
console.log(`  zonas                      ${n(enc.zones().length)}`);
console.log(`  peleas plegadas            ${n(r.folded)}`);
console.log(`  tamaño de la ficha         ${(a.bytes / 1024).toFixed(0)} KB`);
console.log(`  ha tardado                 ${(r.ms / 1000).toFixed(2)} s\n`);

// La comprobación que justifica el comando: rehacerla no puede cambiar nada.
// Si cambia, o lo guardado estaba mal o el contador no es determinista, y en
// los dos casos hay que enterarse aquí y no en una cifra rara dentro de un mes.
if (huellaAntes === '[]') {
  console.log('  Ficha nueva: no había nada anterior con lo que comparar.\n');
} else if (huellaAntes === JSON.stringify(enc.ledger.list())) {
  console.log('  IDÉNTICA a la que había — la ficha aprendida y la rehecha coinciden.\n');
} else {
  console.log('  DISTINTA de la que había. Se ha guardado la rehecha, que sale del\n'
    + '  histórico y es la que manda. Si esto pasa sin haber reconstruido el\n'
    + '  almacén ni cambiado de versión, es un fallo del contador.\n');
  process.exit(2);
}
