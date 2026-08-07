/**
 * Tu nivel a lo largo del tiempo, y los hitos fechados que hay al lado.
 *
 * NO ES UNA PROGRESIÓN, SON PERIODOS, y eso no es una decisión de diseño: en
 * EQL cambiar una clase por otra más baja te BAJA el nivel. Medido sobre un
 * histórico real, de diez cambios tres son bajadas, y el patrón es subir a 50,
 * bajar a los veintitantos a subir secundarias y volver. Once tramos.
 *
 * NADA DE ESTO SE AÑADIÓ AL ALMACÉN salvo los puntos de habilidad. Cada pelea
 * ya llevaba su nivel y su hora, así que un cambio es donde el nivel difiere
 * entre dos peleas consecutivas. El instante exacto no se sabe —el registro no
 * lo dice cuando baja— y por eso se guarda el margen entre las dos peleas.
 *
 * LA ÚNICA COMPARACIÓN QUE VALE es entre periodos del MISMO nivel. En el
 * histórico de referencia hay tres a nivel 50: medianas 129, 122 y 130, y
 * récords 210, 190 y 293. La mediana no se mueve y el techo sube — y al lado,
 * los hitos: 4, 5 y 10 puntos de habilidad, y equipo +2, +3 y +4.
 *
 * Los hitos se ponen JUNTO a las cifras, nunca como causa. Que subieras diez
 * puntos y que tu récord subiera son dos hechos; decir que uno explica el otro
 * sería afirmar algo que no se ha medido.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';
import { Parser } from '../src/parser.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

// ── 1. La línea del punto de habilidad deja de ser ruido ───────────────────
console.log('\nel punto de habilidad es una señal, no ruido');
{
  const p = new Parser({ self: 'Campeon' });
  const ev = p.parse('[Tue Aug 04 11:19:38 2026] You have gained an ability point!  You now have 3 ability points.');
  ok(ev?.kind === 'aa', 'se reconoce como suceso propio', ev?.kind);
  ok(ev?.balance === 3, 'con el saldo que dijo el juego', ev?.balance);
}

// ── 2. Los periodos salen de lo que ya había ───────────────────────────────
const pelea = (id, at, level, mine) => ({
  id, uid: id, at, level, diff: null, duration: 60, total: mine, raidDps: mine / 60,
  enemyTotal: 0, enemyDps: 0, healing: 0, kills: [], losses: [], hpSamples: {},
  loot: [], spellVsFoe: [],
  rows: [{ name: 'Campeon', side: 'ally', damage: mine, taken: 0, healingDone: 0,
    hits: 1, meleeHits: 1, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
    max: mine, activeSec: 60, types: [], abilities: [], targets: [], takenBySource: [] }],
});

console.log('\nun cambio de nivel es donde cambia el nivel');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-per-'));
  const st = new FightStore(dir, 'Campeon');
  st.load();
  const T = 1_700_000_000_000;
  // 50 (×5) → baja a 29 (×5) → vuelve a 50 (×5). Tres periodos, dos cambios.
  [50, 50, 50, 50, 50, 29, 29, 29, 29, 29, 50, 50, 50, 50, 50].forEach((lv, i) => {
    st.append(pelea(i + 1, T + i * 600_000, lv, lv === 50 ? 6000 + i * 100 : 2400), T + i * 600_000);
  });
  const enc = new Encyclopedia(st);
  enc.load();
  const p = enc.progress();

  ok(p.periodos.length === 3, 'tres periodos, no dos niveles', p.periodos.length);
  ok(p.periodos.map((x) => x.level).join() === '50,29,50', 'y en el orden en que pasaron',
    p.periodos.map((x) => x.level).join());
  ok(p.cambios.length === 2, 'dos cambios entre ellos', p.cambios.length);
  ok(p.cambios[0].sube === false, 'el primero es una BAJADA: 50 → 29');
  ok(p.cambios[1].sube === true, 'y el segundo una subida');
  // El instante no se sabe: lo que se guarda es el margen entre las dos peleas.
  ok(p.cambios[0].margen === 600_000, 'con el margen entre las dos peleas, no una hora inventada',
    `${p.cambios[0].margen / 60000} min`);

  // La comparación sólo entre periodos del MISMO nivel.
  ok(p.comparables.length === 1 && p.comparables[0].level === 50,
    'sólo el nivel 50 tiene dos periodos comparables');
  ok(p.comparables[0].periodos.join() === '1,3', 'y son el primero y el tercero',
    p.comparables[0].periodos.join());

  // Cada periodo abre su mejor pelea.
  ok(p.periodos.every((x) => x.bestUid !== null), 'cada periodo lleva la pelea de su récord');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 3. Con poca muestra no se compara ──────────────────────────────────────
console.log('\nun periodo de dos peleas no entra en la comparación');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-per2-'));
  const st = new FightStore(dir, 'Campeon');
  st.load();
  const T = 1_700_000_000_000;
  const plan = [50, 50, 50, 50, 50, 29, 50, 50];   // el último tramo son 2 peleas
  plan.forEach((lv, i) => st.append(pelea(i + 1, T + i * 600_000, lv, 5000), T + i * 600_000));
  const enc = new Encyclopedia(st);
  enc.load();
  const p = enc.progress();
  const ultimo = p.periodos.at(-1);
  ok(ultimo.bastante === false, 'el tramo corto se marca como poca muestra', ultimo.fights);
  ok(p.comparables.length === 0,
    'y no hay comparación: un periodo de dos peleas son dos peleas, no un momento');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 4. Los hitos: sólo lo que te quedaste, y con su nivel de mejora ────────
//
// De 794 unidades recogidas en un histórico real sólo 216 se quedaron: lo
// vendido al instante es basura de vendedor y lo consumido eran materiales.
console.log('\nlos hitos: lo que te quedaste, no lo que recogiste');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-per3-'));
  const st = new FightStore(dir, 'Campeon');
  st.load();
  const T = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) {
    const f = pelea(i + 1, T + i * 600_000, 50, 5000);
    if (i === 2) {
      f.loot = [
        { item: 'Carmine Trinket +4', qty: 1, from: 'X' },              // te la quedas
        { item: 'Rusty Dagger', qty: 1, from: 'X', sold: '2 gold' },    // vendida al instante
        { item: 'Bone Chips', qty: 3, from: 'X', upgraded: 'Algo +1' }, // material
        { item: 'Mote of Potential', qty: 1, from: 'X', stored: true }, // al monedero
      ];
    }
    st.append(f, T + i * 600_000);
  }
  st.appendAA({ t: (T + 600_000) / 1000, at: T + 600_000, balance: 2 });
  const enc = new Encyclopedia(st);
  enc.load();
  const g = enc.progress().periodos[0];
  ok(g.piezasN === 1, 'sólo cuenta la pieza que te quedaste', g.piezasN);
  ok(g.piezas[0].item === 'Carmine Trinket +4', 'y es la que es', g.piezas[0]?.item);
  ok(g.mejorTier === 4, 'el nivel de mejora sale del propio nombre: es medido, no deducido',
    g.mejorTier);
  ok(g.aa === 1, 'y el punto de habilidad del tramo va con él', g.aa);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
