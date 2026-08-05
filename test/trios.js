/**
 * La tabla de tríos declarada a mano.
 *
 * Tres fuentes de verdad y un orden entre ellas: lo que tú declaras, el /who,
 * y la inferencia por hechizos. Lo que se prueba aquí es el ORDEN, no un caso
 * concreto, porque es donde está el fallo caro: un dato inventado con aspecto
 * de medido contamina todas las medianas del histórico.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { Engine } from '../src/engine.js';
import { normalizeTrios, trioAt, conflicts } from '../src/trios.js';
import { proofOf, ownersOf } from '../src/classes.js';

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'MAL '}${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

const BASE = new Date(2026, 7, 4, 12, 0, 0);
const stamp = (s) => {
  const d = new Date(BASE.getTime() + s * 1000);
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const p = (v) => String(v).padStart(2, '0');
  return `[${wd} ${mo} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};
const ms = (s) => BASE.getTime() + s * 1000;

/** Corre un guion de líneas con una tabla puesta, y devuelve el motor. */
function correr(tabla, guion) {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
  const e = new Engine();
  e.self = 'Campeon'; e.parser = p; e.tracker = tr;
  e.setTrios(tabla);
  const peleas = [];
  tr.on('close', (enc) => peleas.push(e.snapshot ? { level: enc.level, classes: enc.classes } : null));
  for (const [s, l] of guion) {
    const ev = p.parse(`${stamp(s)} ${l}`);
    if (!ev) continue;
    e.feedEvent(ev);
  }
  tr.tick(Number.MAX_SAFE_INTEGER);
  return { e, tr, peleas };
}

// ── 1. Normalizar la tabla ───────────────────────────────────────────────
console.log('\nla tabla se limpia antes de usarse');
{
  const t = normalizeTrios([
    { at: 300, classes: ['SHD', 'SHM', 'MAG'] },
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 100, classes: ['SHD', 'X!!', 'MAG'] },        // clase inválida
    { at: 200, classes: ['SHD', 'DRU'] },               // sólo dos
    { at: 'ayer', classes: ['SHD', 'DRU', 'MAG'] },     // fecha basura
    { at: 400, classes: ['WAR', 'CLR', 'ROG'], level: -3 },
  ]);
  ok(t.length === 3, 'se descarta lo que no vale', `${t.length} renglones`);
  ok(t[0].at === null, 'el «desde siempre» va el primero');
  ok(t[1].at === 300 && t[2].at === 400, 'y el resto por fecha');
  ok(t[2].level === null, 'un nivel imposible se convierte en «no declarado»');
}

console.log('\ndos renglones en el mismo instante: gana el último');
{
  const t = normalizeTrios([
    { at: 100, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 100, classes: ['SHD', 'SHM', 'MAG'], level: 25 },
  ]);
  ok(t.length === 1, 'queda uno solo', `${t.length}`);
  ok(t[0].classes.join('/') === 'SHD/SHM/MAG', 'el último escrito', t[0].classes.join('/'));
}

console.log('\nqué tramo estaba en vigor');
{
  const t = normalizeTrios([
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 1000, classes: ['SHD', 'SHM', 'MAG'] },
    { at: 2000, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
  ]);
  ok(trioAt(t, 0)?.classes[1] === 'DRU', 'antes de todo manda el «desde siempre»');
  ok(trioAt(t, 999)?.classes[1] === 'DRU', 'justo antes del corte, el anterior');
  ok(trioAt(t, 1000)?.classes[1] === 'SHM', 'en el corte exacto, el nuevo');
  ok(trioAt(t, 5000)?.classes[1] === 'DRU', 'después del último, el último');
  ok(trioAt([], 5000) === null, 'sin tabla no se afirma nada');
}

// ── 2. El orden entre las tres fuentes ───────────────────────────────────
//
// Esto CAMBIÓ, y a propósito. Antes lo declarado ganaba también a un /who
// posterior que dijera otro trío. Visto en el log real: la tabla decía
// SHD/DRU/MAG nivel 50 y el /who de las 23:51:47 decía SHD/SHM/MAG nivel 27.
// Las peleas siguientes se guardaban a nivel 50, y el nivel es justo lo que
// separa las marcas — se comparaban peleas de 27 contra récords de 50.
//
// La regla que ya estaba escrita en trios.js es la que decide: un renglón dice
// «desde tal hora, esto», y eso NO puede mandar hacia el futuro. Una subida de
// nivel dentro del tramo ya contaba, porque es un suceso. Un /who que desmiente
// el trío es lo mismo: no contradice lo que declaraste del pasado, termina el
// tramo.
console.log('\nun /who posterior que desmiente el trío termina el tramo');
{
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [20, '[25 SHD/SHM/MAG] Campeon (Iksar) <Spain> ZONE: The Ruins of Old Guk 2 (gukbottom)  '],
  ]);
  ok(e.whoClasses?.join('/') === 'SHD/SHM/MAG',
    'manda el /who, que es una medida y es posterior', e.whoClasses?.join('/'));
  ok(e.level === 25, 'con su nivel, no el declarado', String(e.level));
  ok(e.classSourceAt === '/who', 'y la fuente lo dice', String(e.classSourceAt));
  ok(e.classPrompt?.fuente === 'who', 'se te avisa de que la tabla se quedó vieja',
    String(e.classPrompt?.fuente));
  ok(e.classPrompt?.declarado?.join('/') === 'SHD/DRU/MAG'
    && e.classPrompt?.trio.join('/') === 'SHD/SHM/MAG',
    'diciendo las dos versiones');
  ok(e.classPrompt?.atLog === ms(20), 'y con la hora del /who para el renglón nuevo',
    String(e.classPrompt?.atLog));
}

console.log('\npero un /who que CONFIRMA el trío no toca nada');
{
  // La otra mitad. Si sólo se comprobara el caso que desmiente, un motor que
  // tirase siempre la tabla pasaría la prueba igual.
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    // Mismo trío, nivel distinto: el nivel declarado sigue mandando. Si te
    // equivocaste al declararlo, eso lo enseña conflicts() en Ajustes.
    [20, '[25 SHD/DRU/MAG] Campeon (Iksar) <Spain> ZONE: The Ruins of Old Guk 2 (gukbottom)  '],
  ]);
  ok(e.whoClasses?.join('/') === 'SHD/DRU/MAG', 'el trío no se mueve', e.whoClasses?.join('/'));
  ok(e.level === 50, 'y el nivel declarado tampoco', String(e.level));
  ok(e.classSourceAt === 'manual', 'la fuente sigue siendo tu tabla', String(e.classSourceAt));
  ok(e.classPrompt === null, 'y no se avisa de nada: no hay contradicción');
}

console.log('\nsi el tramo no declara nivel, el log lo pone');
{
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'SHM', 'MAG'], level: null }]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [20, 'You have gained a level! Welcome to level 25!'],
  ]);
  ok(e.level === 25, 'la subida de nivel dentro del tramo sí cuenta', String(e.level));
  ok(e.whoClasses?.join('/') === 'SHD/SHM/MAG', 'pero el trío no se toca', e.whoClasses?.join('/'));
}

console.log('\ncambiar de trío borra el nivel heredado');
{
  // Lo contraintuitivo y lo importante: en EQL el nivel efectivo es el de tu
  // clase más baja, así que meter una clase nueva puede hundirlo. Arrastrar
  // el 50 del tramo anterior sería inventarse un dato.
  const tabla = normalizeTrios([
    { at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: ms(100), classes: ['SHD', 'SHM', 'MAG'], level: null },
  ]);
  const { e } = correr(tabla, [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [110, 'You slash a gorgon for 100 points of damage.'],
  ]);
  ok(e.level === null, 'sin nivel hasta el primer hito del tramo nuevo', String(e.level));
  ok(e.whoClasses?.join('/') === 'SHD/SHM/MAG', 'con el trío nuevo puesto', e.whoClasses?.join('/'));
}

console.log('\ndentro de un tramo: lo declarado manda, pero la contradicción avisa');
{
  // Dos cosas que estaban soldadas y ahora van por separado:
  //   reasignar el trío  — no, dentro de un tramo declarado tú estabas allí,
  //   avisar             — sí, y aquí más que nunca: que lo declarado deje de
  //                        corresponderse con la realidad es el único caso que
  //                        no va a corregir nadie más.
  //
  // El hechizo tiene que ser de una clase que NO esté en el trío declarado.
  // La primera versión de este test usaba Burnout, que es de mago, con un
  // trío que llevaba mago: se salía por «esa clase ya está» y pasaba sin
  // ejercitar la regla. Pasar por el motivo equivocado es no pasar.
  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const fuera = ownersOf.byClass('SHM').find((s) => proofOf(s) === 'SHM');
  ok(!!fuera && !['SHD', 'DRU', 'MAG'].includes(proofOf(fuera)),
    'el hechizo de prueba es de una clase ausente del trío', `${fuera} -> ${proofOf(fuera)}`);
  const { e } = correr(tabla, [[10, 'You slash a gorgon for 100 points of damage.']]);
  const avisos = [];
  e.on('alert', (a) => avisos.push(a));
  e.classProof({ t: ms(20) / 1000, ability: fuera });

  // Lo que NO cambia.
  ok(e.whoClasses.join('/') === 'SHD/DRU/MAG',
    'un hechizo no cambia lo que declaraste', e.whoClasses.join('/'));
  ok(e.level === 50, 'ni te borra el nivel declarado', String(e.level));

  // Lo que sí pasa: antes se salía antes de llegar aquí y con la tabla puesta
  // el aviso no podía saltar NUNCA.
  ok(avisos.length === 1, 'la contradicción avisa igualmente', `${avisos.length}`);
  ok(e.classPrompt?.declarado?.join('/') === 'SHD/DRU/MAG',
    'y el aviso dice qué declaraste, que es la mitad de la pregunta',
    e.classPrompt?.declarado?.join('/'));
  ok(e.classPrompt?.atLog === ms(20),
    'fechado en el hechizo que lo demuestra, no en el instante de avisar',
    String(e.classPrompt?.atLog));

  // Cuál de las tres salió NO se sabe, y escribir en la tabla es escribir en la
  // fuente de arriba: se ofrecen las tres salidas posibles y eliges tú. Antes
  // de esto el heurístico «la que lleva más sin dar señales» elegía sola, y con
  // tres clases sin señales elegía la primera del trío — es decir, al azar.
  const cand = e.classPrompt?.candidatos ?? [];
  ok(cand.length === 3, 'se ofrecen las tres salidas posibles', String(cand.length));
  ok(cand.map((c) => c.clase).sort().join('/') === 'DRU/MAG/SHD',
    'una por cada clase declarada', cand.map((c) => c.clase).join('/'));
  ok(cand.every((c) => c.trio.includes('SHM') && c.trio.length === 3
    && !c.trio.includes(c.clase)),
    'y cada una propone el trío que resulta de quitar ESA clase');
  ok(cand.every((c) => c.visto === null), 'sin señales de ninguna, y se dice');

  // Una vez por contradicción: el mismo cambio no se pregunta dos veces.
  e.classProof({ t: ms(30) / 1000, ability: fuera });
  ok(avisos.length === 1, 'y no se repite por cada hechizo', `${avisos.length}`);
}

console.log('\nun hechizo compartido no contradice nada');
{
  // Regeneration la tienen druida y chamán. Lanzarla con un trío que lleva
  // druida no demuestra que hayas cambiado: no prueba nada, y callar es la
  // respuesta correcta. Este es el caso que hay que distinguir del de arriba,
  // porque desde fuera se parecen —lanzas algo «de chamán» y no salta nada— y
  // el motivo es completamente distinto.
  ok(ownersOf('Regeneration').sort().join('+') === 'DRU+SHM',
    'Regeneration consta de druida y chamán', ownersOf('Regeneration').join('+'));
  ok(proofOf('Regeneration') === null, 'así que no prueba ninguna clase');

  const tabla = normalizeTrios([{ at: ms(0), classes: ['SHD', 'DRU', 'MAG'], level: 50 }]);
  const { e } = correr(tabla, [[10, 'You slash a gorgon for 100 points of damage.']]);
  const avisos = [];
  e.on('alert', (a) => avisos.push(a));
  e.classProof({ t: ms(20) / 1000, ability: 'Regeneration' });
  ok(avisos.length === 0, 'y no se avisa de nada', `${avisos.length}`);
  ok(e.classPrompt === null, 'ni queda pregunta pendiente');

  // Y sin tabla tampoco, que es la otra mitad: no es la tabla quien lo calla.
  const { e: e2 } = correr([], [[10, 'You slash a gorgon for 100 points of damage.']]);
  e2.whoClasses = ['SHD', 'DRU', 'MAG'];
  const avisos2 = [];
  e2.on('alert', (a) => avisos2.push(a));
  e2.classProof({ t: ms(20) / 1000, ability: 'Regeneration' });
  ok(avisos2.length === 0, 'sin tabla tampoco: lo compartido nunca prueba', `${avisos2.length}`);
}

console.log('\nsin tabla, todo sigue como estaba');
{
  const { e } = correr([], [
    [10, 'You slash a gorgon for 100 points of damage.'],
    [20, '[25 SHD/SHM/MAG] Campeon (Iksar) <Spain> ZONE: The Ruins of Old Guk 2 (gukbottom)  '],
  ]);
  ok(e.level === 25, 'el /who manda cuando no hay nada declarado', String(e.level));
}

// ── 3. Contradicciones: se enseñan, no se corrigen ───────────────────────
console.log('\ncontradicciones entre tu tabla y el log');
{
  const tabla = normalizeTrios([
    { at: null, classes: ['SHD', 'DRU', 'MAG'], level: 50 },
    { at: 1000, classes: ['SHD', 'SHM', 'MAG'] },
  ]);
  const hitos = [
    { at: 500, level: 50, classes: ['SHD', 'DRU', 'MAG'] },   // cuadra
    { at: 1500, level: 25, classes: ['SHD', 'DRU', 'MAG'] },  // no cuadra
  ];
  const c = conflicts(tabla, hitos);
  ok(c.length === 1, 'se detecta la que no cuadra, y sólo esa', `${c.length}`);
  ok(c[0].at === 1500, 'con su hora', String(c[0]?.at));
  ok(c[0].dice.join('/') === 'SHD/DRU/MAG' && c[0].declaras.join('/') === 'SHD/SHM/MAG',
    'diciendo las dos versiones, sin elegir por ti');
}

console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
