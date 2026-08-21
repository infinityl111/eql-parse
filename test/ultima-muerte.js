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

console.log('OBS: cuántas observaciones lleva cada clave — el rótulo que decía «aún no»');
{
  /**
   * QUÉ CUENTA UNA OBSERVACIÓN, dicho antes de comprobar el número: un
   * intervalo entre dos muertes de esa clave EN PELEAS DISTINTAS. Dos muertes
   * del mismo nombre dentro de una pelea son dos individuos, no un intervalo
   * de reaparición — un muerto no vuelve a mitad del combate.
   */
  const d2 = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 2, mode: null };
  const d3 = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 3, mode: null };
  const r = motor(store).observacionesDe([d2, d3]);
  ok(r[claveCrono(d2)].muertes === 2 && r[claveCrono(d2)].observaciones === 1,
    'dos peleas con muerte suya dan 1 observación', JSON.stringify(r[claveCrono(d2)]));
  ok(r[claveCrono(d3)].muertes === 1 && r[claveCrono(d3)].observaciones === 0,
    'una sola pelea da 0 observaciones', 'no es un fallo: aún no ha vuelto a morir');

  // Dos muertes del MISMO nombre en UNA pelea: multiplicidad, no intervalo.
  const T2 = 1787000000000 + 10800e3;
  store.append({
    zone: "Nagafen's Lair 2 (Adaptive)", zoneBase: "Nagafen's Lair", diff: 2, diffTag: null,
    duration: 60, total: 1000, start: Math.round(T2 / 1000),
    kills: ['a kobold king', 'a kobold king'],
    killTimes: [{ name: 'a kobold king', t: 5 }, { name: 'a kobold king', t: 40 }],
    rows: [{ name: 'Campeon', side: 'ally' }, { name: 'a kobold king', side: 'enemy' }],
  }, T2);
  const r2 = motor(store).observacionesDe([d2]);
  ok(r2[claveCrono(d2)].muertes === 4, 'las cuatro muertes se cuentan', JSON.stringify(r2[claveCrono(d2)]));
  ok(r2[claveCrono(d2)].observaciones === 2,
    'pero la pelea nueva suma UNA observación, no dos',
    'dos muertes en la misma pelea no son un intervalo de reaparición');

  const nunca = { nombre: 'a kobold emperor', base: "Nagafen's Lair", diff: 2, mode: null };
  ok(motor(store).observacionesDe([nunca])[claveCrono(nunca)].observaciones === 0,
    'y quien no ha muerto nunca lleva 0');
}

console.log('\nLA ZONA CON EL DÍGITO PEGADO, que es media histórico en disco');
{
  /**
   * ── EL FALLO ──────────────────────────────────────────────────────────
   *
   * Las peleas guardadas antes del 19/08/2026 llevan `zoneBase` CON el dígito
   * de la dificultad dentro —«The Ruins of Old Guk 2»— y las de después, sin
   * él. La clave de un crono lleva la base LIMPIA, porque la escribe
   * `parseZone` al abrirlo desde una pelea; y las cinco consultas del crono
   * filtran el índice con `sm.zoneBase !== c.base`.
   *
   * O sea que un crono de Old Guk D2 no veía NI UNA de sus muertes y salía
   * «esperando su primera muerte» para siempre. Medido sobre el almacén real
   * el 21/08/2026: 1.026 de 1.899 peleas con muerte lo llevan pegado, y con
   * ello 238 de 731 claves no veían ninguna.
   *
   * La cura es `rehacerZona`, AL LEER el índice. Por eso esta prueba relee el
   * almacén del disco en vez de mirar el que quedó en memoria al escribirlo:
   * el camino que se comprueba tiene que ser el que corre de verdad.
   */
  const T3 = 1787000000000 + 14400e3;
  store.append({
    zone: 'The Ruins of Old Guk 2 (Adaptive)', zoneBase: 'The Ruins of Old Guk 2',
    diff: 2, diffTag: 'Adaptive', duration: 60, total: 1000,
    start: Math.round(T3 / 1000),
    kills: ['Ancient Croaker'], killTimes: [{ name: 'Ancient Croaker', t: 12 }],
    rows: [{ name: 'Campeon', side: 'ally' }, { name: 'Ancient Croaker', side: 'enemy' }],
  }, T3);

  const clave = { nombre: 'Ancient Croaker', base: 'The Ruins of Old Guk', diff: 2, mode: null };
  /**
   * CONTROL DE QUE LA TRAMPA ESTÁ PUESTA: el resumen recién escrito —el que
   * hay en disco— lleva el dígito. Sin esto, el verde de abajo podría venir
   * de que la pelea se guardó ya limpia y aquí no se estuviera probando nada.
   */
  const crudo = store.index.find((s) => (s.kills ?? []).includes('Ancient Croaker'));
  ok(crudo?.zoneBase === 'The Ruins of Old Guk 2',
    'CONTROL: la pelea se ha escrito con el dígito pegado', crudo?.zoneBase);
  ok(crudo?.zoneBase !== clave.base,
    'CONTROL: y esa forma NO casa con la clave del crono', 'ésa era la avería');

  const s2 = new FightStore(dir);
  s2.load();
  const v = motor(s2).ultimaMuerte([clave])[claveCrono(clave)];
  ok(v === Math.round(T3 / 1000) + 12,
    'al releer el índice, la base se rehace y la muerte se encuentra',
    v === null ? 'NO LA ENCUENTRA: el crono nacería ciego' : new Date(v * 1000).toISOString());

  // Y no contesta que sí a cualquier cosa: la dificultad sigue separando.
  const otra = { nombre: 'Ancient Croaker', base: 'The Ruins of Old Guk', diff: 3, mode: null };
  ok(motor(s2).ultimaMuerte([otra])[claveCrono(otra)] === null,
    'CONTROL: y la D3 de la misma zona sigue sin tener nada');
}

console.log('\nLOS CANDIDATOS DEL HISTÓRICO ENTERO, desde el motor');
{
  const s2 = new FightStore(dir);
  s2.load();
  const abierto = { nombre: 'a kobold king', base: "Nagafen's Lair", diff: 2, mode: null };
  const lista = motor(s2).candidatosCrono([abierto]);

  ok(lista.length > 0, 'la lista no viene vacía', `${lista.length} candidatos`);
  const croaker = lista.find((c) => c.nombre === 'Ancient Croaker');
  ok(croaker?.base === 'The Ruins of Old Guk' && croaker?.diff === 2,
    'y el candidato trae la clave ENTERA y con la base limpia',
    `${croaker?.base} · D${croaker?.diff}`);

  /**
   * LA MISMA CLAVE QUE CONSULTA `ultimaMuerte`, y esto es lo que hace útil la
   * lista: un candidato cuya clave no case nace ciego, y ciego se ve
   * exactamente igual que «aún no ha muerto nunca».
   */
  const comoCrono = { nombre: croaker.nombre, base: croaker.base, diff: croaker.diff, mode: croaker.mode };
  ok(motor(s2).ultimaMuerte([comoCrono])[claveCrono(comoCrono)] !== null,
    'y abriéndolo tal cual, el motor encuentra su muerte');

  const rey = lista.find((c) => c.nombre === 'a kobold king' && c.diff === 2);
  ok(rey?.ya === true, 'el que ya tiene temporizador viene marcado');
  ok(lista.find((c) => c.nombre === 'a kobold king' && c.diff === 3)?.ya === false,
    'CONTROL: y el de la otra dificultad, que es otra clave, no');
  ok(rey?.muertes === 4 && rey?.peleas === 3,
    'las muertes y las peleas se cuentan aparte',
    `${rey?.muertes} muertes en ${rey?.peleas} peleas — dos en un mismo combate son dos individuos`);
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
