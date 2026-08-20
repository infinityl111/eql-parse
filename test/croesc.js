/**
 * PONER UN TEMPORIZADOR DESDE LA PELEA: los cuatro casos que no se inventan.
 *
 * La lógica es pura —de una pelea salen los enemigos seguibles— así que se
 * prueba sin interfaz, como el resto de `src/cronos.js`. Lo que la interfaz
 * hace con ella se mira con `tmp/ver-croesc2.mjs`, que abre la aplicación.
 *
 * ⚠ Y SE PRUEBA CON PELEAS DEL ALMACÉN DE VERDAD cuando lo hay. Una pelea
 * escrita a mano pasa por construcción: la escribo yo con la forma que espero,
 * que es justo la teoría que quiero comprobar. Las de disco tienen la forma que
 * de verdad se guardó, con sus campos viejos y sus rarezas.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enemigosDeLaPelea } from '../src/cronos.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

console.log('\nlos cuatro casos, sobre una pelea armada para tenerlos todos');
{
  const f = {
    start: 1000,
    rows: [
      { name: 'Campeon', side: 'ally' },
      { name: 'a fetid fiend', side: 'enemy' },
      { name: 'a worry wraith', side: 'enemy' },
      { name: 'Amygdalan knight', side: 'enemy' },
      { name: 'a worry wraith pet', side: 'enemy' },
      { name: 'Jobarn', side: 'enemy', petOf: 'Krumka' },
    ],
    killTimes: [
      { name: 'a fetid fiend', t: 12 },
      { name: 'Amygdalan knight', t: 30 },
      { name: 'a fetid fiend', t: 47 },
    ],
  };
  const e = enemigosDeLaPelea(f);
  const por = (n) => e.find((x) => x.nombre === n);

  ok(!e.some((x) => x.nombre === 'Campeon'), 'los aliados no salen');
  ok(!e.some((x) => / pet$/i.test(x.nombre)), 'la mascota por el sufijo « pet» se queda fuera',
    'un pet no reaparece por temporizador');
  ok(!e.some((x) => x.nombre === 'Jobarn'), 'y la mascota por `petOf` también');

  ok(por('a worry wraith') !== undefined, 'el que NO murió sale en la lista',
    'esconderlo se leería como que no estuvo');
  ok(por('a worry wraith')?.veces === 0 && por('a worry wraith')?.cuando === null,
    'y sale sin instante, así que no se puede seguir');

  ok(por('a fetid fiend')?.veces === 2, 'dos muertes del mismo nombre se cuentan las dos',
    'son dos individuos');
  ok(por('a fetid fiend')?.cuando === 1047, 'y se usa LA ÚLTIMA', '1000 + 47');
  ok(por('Amygdalan knight')?.cuando === 1030, 'el instante es absoluto: start + t');

  ok(e[e.length - 1].nombre === 'a worry wraith',
    'los que no se pueden seguir van al final de la lista');
}

console.log('\nsobre las peleas del almacén de verdad, si lo hay');
const CANDIDATOS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse', 'fights.ndjson'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse', 'fights.ndjson'),
];
const almacen = CANDIDATOS.find((d) => fs.existsSync(d));
if (!almacen) {
  console.log('  --   sin almacén en esta máquina: no se puede comprobar');
} else {
  const lineas = fs.readFileSync(almacen, 'utf8').split('\n').filter((l) => l.trim());
  const peleas = lineas.map((l) => JSON.parse(l));
  let conPet = 0, conDoble = 0, conSinMorir = 0, revisadas = 0;
  for (const f of peleas) {
    const e = enemigosDeLaPelea(f);
    revisadas++;
    if ((f.rows ?? []).some((r) => r.side === 'enemy' && / pet$/i.test(r.name))) conPet++;
    if (e.some((x) => x.veces > 1)) conDoble++;
    if (e.some((x) => x.veces === 0)) conSinMorir++;
    // Invariantes que tienen que valer para TODAS:
    if (e.some((x) => / pet$/i.test(x.nombre))) { ok(false, 'una mascota se ha colado', f.id); break; }
    if (e.some((x) => x.veces > 0 && x.cuando == null)) { ok(false, 'muerte sin instante', f.id); break; }
    if (e.some((x) => x.veces === 0 && x.cuando != null)) { ok(false, 'instante sin muerte', f.id); break; }
  }
  ok(revisadas > 0, `se han revisado ${revisadas} peleas del almacén`);
  ok(conPet > 0, 'el almacén TIENE peleas con mascota enemiga', `${conPet} — si fuera 0, el filtro no estaría probado`);
  ok(conDoble > 0, 'y peleas donde un nombre muere dos veces', `${conDoble}`);
  ok(conSinMorir > 0, 'y peleas con enemigos que no murieron', `${conSinMorir}`);
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
