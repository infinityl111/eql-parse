/**
 * EL CRONO SE REINICIA CUANDO EL BICHO VUELVE A MORIR. Y no lo hacía.
 *
 * ── EL FALLO, DICHO POR CAMPEÓN ───────────────────────────────────────────
 *
 * Puso dos temporizadores, mató a los dos enemigos, y las cuentas siguieron
 * como estaban. `engine.ultimaMuerte()` devolvía `null` para todo.
 *
 * ── LA CAUSA, Y NO ERA NINGUNO DE LOS TRES SOSPECHOSOS ────────────────────
 *
 * Se sospechó de las mayúsculas de principio de línea, de la forma de la zona y
 * de que la muerte no hubiera llegado al almacén. **Los tres quedaron
 * descartados por el dato**: la grafía guardada era idéntica, `zoneBase` y
 * `diff` casaban, y las peleas estaban en el índice.
 *
 * Era una línea:
 *
 *     if (!pide.size || !this.store) return out;    // `pide` es un ARRAY
 *
 * Un array no tiene `.size`, así que la expresión valía `!undefined` = **true
 * siempre** y la función salía sin mirar el índice ni una vez. Entró con el
 * primer commit del temporizador: **nunca se ha reiniciado un crono**.
 *
 * ── POR QUÉ NO LO VIO NADIE, que es lo que esta prueba viene a arreglar ────
 *
 * `null` es un valor LEGÍTIMO aquí —«no ha muerto nunca»— y la pantalla lo
 * pinta como «esperando su primera muerte», que es una frase que existe. Y las
 * pruebas de `src/cronos.js` le pasan la marca de muerte YA RESUELTA, así que
 * ninguna llegaba hasta la búsqueda. **Toda la lógica estaba probada y el dato
 * nunca llegaba a ella.**
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Engine } from '../src/engine.js';
import { FightStore } from '../src/store.js';
import { claveCrono } from '../src/cronos.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** Un almacén de mentira pero escrito por el escritor DE VERDAD. */
function almacenDePrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-um-'));
  const s = new FightStore(dir);
  s.self = 'Campeon';
  const pelea = (at, zone, zoneBase, diff, kills, killTimes) => ({
    zone, zoneBase, diff, diffTag: null, duration: 60, total: 1000,
    start: Math.round(at / 1000), kills, killTimes,
    rows: [{ name: 'Campeon', side: 'ally' }, ...kills.map((k) => ({ name: k, side: 'enemy' }))],
  });
  // Tres peleas: la vieja, otra en OTRA dificultad, y la reciente.
  const T = 1787000000000;
  s.append(pelea(T, "Nagafen's Lair 2 (Adaptive)", "Nagafen's Lair", 2,
    ['a kobold king'], [{ name: 'a kobold king', t: 10 }]), T);
  s.append(pelea(T + 3600e3, "Nagafen's Lair 3 (Fused)", "Nagafen's Lair", 3,
    ['a kobold king'], [{ name: 'a kobold king', t: 20 }]), T + 3600e3);
  s.append(pelea(T + 7200e3, "Nagafen's Lair 2 (Adaptive)", "Nagafen's Lair", 2,
    ['a kobold king'], [{ name: 'a kobold king', t: 30 }]), T + 7200e3);
  return { dir, store: s, T };
}

const motor = (store) => { const e = Object.create(Engine.prototype); e.store = store; return e; };

console.log('\nla búsqueda encuentra la muerte, que es lo que no hacía');
const { store, T, dir } = almacenDePrueba();
{
  const clave = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 2, mode: null };
  const r = motor(store).ultimaMuerte([clave]);
  const v = r[claveCrono(clave)];

  ok(store.index.length === 3, 'CONTROL: el almacén de prueba tiene las tres peleas',
    `${store.index.length} — si fuera 0, el null de abajo no diría nada`);
  ok(v !== null, 'devuelve una marca de muerte, no null',
    v === null ? 'ES EL FALLO DE CAMPEÓN' : new Date(v * 1000).toISOString());
  // La más reciente de su dificultad: T+7200s, y 30 s dentro de la pelea.
  ok(v === Math.round((T + 7200e3) / 1000) + 30, 'y es la MÁS RECIENTE de su clave, con el desplazamiento dentro de la pelea',
    `esperaba ${Math.round((T + 7200e3) / 1000) + 30}, hay ${v}`);
}

console.log('\ny DISCRIMINA: no contesta que sí a cualquier cosa');
{
  const m = motor(store);
  const otraDiff = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 4, mode: null };
  ok(m.ultimaMuerte([otraDiff])[claveCrono(otraDiff)] === null,
    'otra dificultad de la misma zona: null');
  const otraZona = { nombre: 'a kobold king', base: 'Befallen', diff: 2, mode: null };
  ok(m.ultimaMuerte([otraZona])[claveCrono(otraZona)] === null, 'otra zona: null');
  const otroNombre = { nombre: 'a kobold prince', base: "Nagafen's Lair", diff: 2, mode: null };
  ok(m.ultimaMuerte([otroNombre])[claveCrono(otroNombre)] === null, 'otro nombre: null');
  // Y la dificultad 3 SÍ tiene la suya, que es distinta de la de la 2.
  const d3 = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 3, mode: null };
  ok(m.ultimaMuerte([d3])[claveCrono(d3)] === Math.round((T + 3600e3) / 1000) + 20,
    'y cada dificultad tiene la SUYA, no la de al lado');
}

console.log('\nvarias claves de golpe, que es como la llama la pantalla');
{
  const a = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 2, mode: null };
  const b = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 3, mode: null };
  const r = motor(store).ultimaMuerte([a, b]);
  ok(Object.keys(r).length === 2 && r[claveCrono(a)] && r[claveCrono(b)]
    && r[claveCrono(a)] !== r[claveCrono(b)], 'las dos resuelven, y a marcas distintas');
}

console.log('\nCONTROL POSITIVO: con la forma REAL del fallo, la prueba se pone roja');
{
  /**
   * La mutación es la línea tal y como estaba —`.size` sobre un array—, no una
   * cualquiera. Una mutación distinta probaría otra cosa, y ya nos ha pasado:
   * renombrar una llamada hacía el caso invisible al detector en vez de dejarlo
   * enfermo, y el control entraba en verde sin cazar nada.
   */
  const comoEstaba = (pide) => !pide.size;      // `pide` es un Array
  ok(comoEstaba([{ nombre: 'x' }]) === true,
    'la línea de entonces salía por la puerta con la lista LLENA', 'true = se iba sin mirar');
  ok(!(!([{ nombre: 'x' }].length)) === true, 'y la de ahora no', '.length sí existe en un array');
}

console.log('\nsobre el almacén REAL, si lo hay');
{
  const CAND = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
  ];
  const real = CAND.find((d) => fs.existsSync(path.join(d, 'fights.ndjson')));
  if (!real) console.log('  --   sin almacén en esta máquina');
  else {
    const s = new FightStore(real); s.load();
    // Se coge una clave que EXISTE en el índice, para que el null no pueda
    // achacarse a haber preguntado por algo que no está.
    const sm = s.index.find((x) => (x.kills ?? []).length && x.zoneBase && x.diff != null);
    if (!sm) console.log('  --   el almacén no tiene ninguna pelea con muerte y zona');
    else {
      const clave = { nombre: sm.kills[0], base: sm.zoneBase, diff: sm.diff, mode: null };
      const v = motor(s).ultimaMuerte([clave])[claveCrono(clave)];
      ok(v !== null, `una clave que SÍ está en el índice se encuentra (${sm.kills[0]} · ${sm.zoneBase} · D${sm.diff})`,
        v === null ? 'ES EL FALLO' : new Date(v * 1000).toISOString().slice(0, 16));
    }
  }
}

try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* da igual */ }
console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
