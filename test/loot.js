/**
 * El botín: que se case la línea Y que se cuente la cantidad.
 *
 * Los dos fallos que hay aquí dentro salieron de medir un log real de 278.299
 * líneas, no de imaginarlos. De sus 681 líneas de botín se perdían 98 —el 14%—
 * por dos motivos distintos:
 *
 *   83  la cantidad. «You looted 2 Phosphorous Powder from …» no llevaba
 *       artículo y la regla exigía uno, así que la línea entera se descartaba.
 *   15  «and stored it in your currency», un final que no existía como regla.
 *       Son los Motes, que van al monedero: 9 de ellos `Mote of Major
 *       Potential`, ninguno visible en la sección de Botín.
 *
 * Y el segundo, el que de verdad justifica este fichero: casar la línea sin
 * leer la cantidad es PEOR que no casarla. Una línea que no casa se ve en el
 * contador de no reconocidas; un «2 Bone Chips» contado como uno no lo ve
 * nadie nunca. Por eso se comprueba que la cantidad llega hasta las tres
 * cuentas —el resumen del tramo, la ficha del enemigo y la enciclopedia—, que
 * son tres caminos distintos hasta el mismo número y tienen que coincidir.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Parser } from '../src/parser.js';
import { enCobre } from '../src/patterns.js';
import { EncounterTracker } from '../src/encounter.js';
import { aggregate } from '../src/aggregate.js';
import { FoeLedger } from '../src/foes.js';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const linea = (cuerpo) => `[Tue Aug 04 12:50:13 2026] ${cuerpo}`;
const parse = (cuerpo) => new Parser({ self: 'Campeon' }).parse(linea(cuerpo));

// ── 1. Las cinco formas de línea, con su cantidad ──────────────────────────
//
// Las cinco están copiadas del log, no inventadas. Las tres últimas son las que
// no casaban. Ojo a la de la moneda: es la única que NO termina en punto.
console.log('\nformas de línea de botín');
{
  const casos = [
    ['--You have looted a Mote of Lesser Potential from a fetid fiend\'s corpse.--',
      { item: 'Mote of Lesser Potential', from: 'a fetid fiend', qty: 1 }],
    ['--You have looted 2 Bone Chips from a greater ice bones\'s corpse.--',
      { item: 'Bone Chips', from: 'a greater ice bones', qty: 2 }],
    ['You looted an Undead Froglok Tongue from a wan ghoul knight\'s corpse and sold it for 5 silver and 8 copper.',
      { item: 'Undead Froglok Tongue', from: 'a wan ghoul knight', qty: 1 }],
    ['You looted 2 Phosphorous Powder from a zol ghoul knight\'s corpse and sold it for 2 platinum, 5 gold, 7 silver and 2 copper.',
      { item: 'Phosphorous Powder', from: 'a zol ghoul knight', qty: 2 }],
    ['You looted a Mote of Major Potential from a scareling\'s corpse and stored it in your currency',
      { item: 'Mote of Major Potential', from: 'a scareling', qty: 1 }],
  ];
  for (const [cuerpo, esperado] of casos) {
    const ev = parse(cuerpo);
    const bien = ev?.kind === 'loot' && ev.item === esperado.item
      && ev.from === esperado.from && ev.qty === esperado.qty;
    ok(bien, cuerpo.slice(0, 62), bien ? `qty ${ev.qty}` : `salió ${JSON.stringify({ kind: ev?.kind, item: ev?.item, from: ev?.from, qty: ev?.qty })}`);
  }
}

// ── 2. El Mote que se perdía, tal cual estaba en el log ────────────────────
//
// Nueve `Mote of Major Potential` recogidos y cero en la sección de Botín. Es
// el caso que destapó todo, así que se queda escrito con su nombre.
console.log('\nel Mote of Major Potential');
{
  const ev = parse('You looted a Mote of Major Potential from Lord Nagafen\'s corpse and stored it in your currency');
  ok(ev?.kind === 'loot', 'la línea del monedero se reconoce como botín', ev?.kind);
  ok(ev?.stored === true, 'queda marcada como guardada en el monedero', ev?.stored);
  ok(ev?.item === 'Mote of Major Potential', 'el objeto sale entero', ev?.item);
}

// ── 3. Un final desconocido NO debe colarse como botín ─────────────────────
//
// La regla del monedero acepta punto final opcional; conviene que eso no la
// vuelva glotona con una cola que no conocemos.
console.log('\nlo que no es botín no se cuela');
{
  ok(parse('You are too far away to loot that corpse.')?.kind !== 'loot', '«too far away» no es botín');
  ok(parse('You received 5 platinum from that item.')?.kind !== 'loot', '«from that item» es moneda, no botín');
  ok(parse('Notarino tells the guild, \'Mote of Potential\'')?.kind === 'chat', 'nombrarlo en el chat no es recogerlo');
}

// ── 4. La cantidad llega igual por los tres caminos ────────────────────────
//
// Tres recorridos distintos sobre las mismas dos peleas. Si alguno cuenta
// recogidas en vez de unidades, la ficha del enemigo y la sección de Botín
// dirían cosas distintas del mismo objeto.
console.log('\nla cantidad llega a las tres cuentas');
{
  const pelea = (id, loot) => ({
    id, duration: 40, total: 5000, zone: 'Lower Guk', zoneBase: 'Lower Guk',
    diff: 2, diffTag: 'Adaptive', level: 50, raidDps: 125, enemyDps: 75,
    enemyTotal: 3000, healing: 0, kills: ['a zol ghoul knight'], losses: [],
    hpSamples: { 'a zol ghoul knight': [5000] }, loot, spellVsFoe: [],
    rows: [
      { name: 'Campeon', side: 'ally', damage: 5000, taken: 3000, healingDone: 0,
        hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: 900, activeSec: 40, types: [], abilities: [],
        targets: [{ name: 'a zol ghoul knight', sum: 5000 }], takenBySource: [] },
      { name: 'a zol ghoul knight', side: 'enemy', damage: 3000, taken: 5000,
        healingDone: 0, hits: 20, meleeHits: 20, misses: 0, crits: 0, flurries: 0,
        ripostes: 0, deaths: 0, max: 400, activeSec: 40, types: [], abilities: [],
        targets: [], takenBySource: [] },
    ],
  });
  // 2 + 2 unidades de Phosphorous Powder en dos peleas, y 1 Bone Chip suelto.
  const peleas = [
    pelea(1, [{ item: 'Phosphorous Powder', qty: 2, from: 'a zol ghoul knight' },
      { item: 'Bone Chips', qty: 1, from: 'a zol ghoul knight' }]),
    pelea(2, [{ item: 'Phosphorous Powder', qty: 2, from: 'a zol ghoul knight' }]),
  ];

  const a = aggregate(peleas, 'Campeon');
  const pp = a.loot.find((l) => l.item === 'Phosphorous Powder');
  ok(pp?.n === 4, 'resumen del tramo: 2 + 2 son 4 unidades', pp?.n);

  const led = new FoeLedger();
  for (const f of peleas) led.fold(f);
  const ficha = led.get('a zol ghoul knight');
  const fp = ficha.lootList.find((l) => l.item === 'Phosphorous Powder');
  ok(fp?.n === 4, 'ficha del enemigo: las mismas 4 unidades', fp?.n);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-loot-'));
  const store = new FightStore(dir);
  store.load();
  // El segundo argumento es la marca de tiempo, y tiene que ser distinta en
  // cada una: el almacén deduplica por «misma hora, mismo total, misma
  // duración», así que dos peleas gemelas a la misma hora son una sola.
  peleas.forEach((f, i) => store.append(f, 1_700_000_000_000 + i * 60_000));
  const enc = new Encyclopedia(store);
  enc.load();
  const ep = enc.lootList().find((l) => l.item === 'Phosphorous Powder');
  ok(ep?.n === 4, 'enciclopedia: las mismas 4 unidades', ep?.n);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 5. Lo guardado sin cantidad sigue valiendo uno ─────────────────────────
//
// El almacén de antes de este arreglo no trae `qty`. Vale uno, que es lo que se
// supo de esas peleas: inventarle otra cosa sería peor. Reconstruir las corrige.
console.log('\nlo guardado antes, sin cantidad');
{
  const vieja = {
    id: 9, duration: 10, total: 100, zone: 'Lower Guk', diff: null, level: 50,
    raidDps: 10, enemyDps: 0, enemyTotal: 0, healing: 0, kills: ['a froglok'],
    losses: [], hpSamples: {}, spellVsFoe: [],
    loot: [{ item: 'Bone Chips', from: 'a froglok' }],   // sin qty, como antes
    rows: [{ name: 'Campeon', side: 'ally', damage: 100, taken: 0, healingDone: 0,
      hits: 1, meleeHits: 1, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
      max: 100, activeSec: 10, types: [], abilities: [],
      targets: [{ name: 'a froglok', sum: 100 }], takenBySource: [] },
    { name: 'a froglok', side: 'enemy', damage: 0, taken: 100, healingDone: 0,
      hits: 0, meleeHits: 0, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0,
      max: 0, activeSec: 10, types: [], abilities: [], targets: [], takenBySource: [] }],
  };
  const a = aggregate([vieja], 'Campeon');
  ok(a.loot.find((l) => l.item === 'Bone Chips')?.n === 1,
    'una entrada sin `qty` cuenta uno, no cero ni NaN');
}

// ── 6. El quinto final, y la red para el sexto ─────────────────────────────
//
// «and stored it in your tradeskill depot» costó un `Essence of Rathe` entero y
// NADIE LO VIO: la teoría era que una línea sin regla se nota en el contador de
// no reconocidas, pero ese contador tiene 39.027 líneas en un registro real.
// Así que además de la regla va la red, y lo que se prueba de la red es que un
// final INVENTADO —uno que no existe hoy— siga sacando el objeto.
console.log('\nel quinto final y la red para el sexto');
{
  const dep = parse('You looted an Essence of Rathe from a ratman warrior\'s corpse and stored it in your tradeskill depot');
  ok(dep?.kind === 'loot', 'el depósito de oficios se reconoce como botín', dep?.kind);
  ok(dep?.item === 'Essence of Rathe', 'el objeto sale entero', dep?.item);
  ok(dep?.depot === true, 'queda marcado como depósito de oficios', dep?.depot);
  ok(!dep?.cola, 'y no cae en la red: tiene regla propia', dep?.cola);

  const raro = parse('You looted a Widget +3 from a gnome\'s corpse and mailed it to your mum.');
  ok(raro?.kind === 'loot', 'un final que no existe hoy SIGUE siendo botín', raro?.kind);
  ok(raro?.item === 'Widget +3', 'con su objeto', raro?.item);
  ok(raro?.from === 'a gnome', 'y su cadáver', raro?.from);
  ok(raro?.cola === 'and mailed it to your mum.', 'y la cola desconocida viaja literal', raro?.cola);
  const qty = parse('You looted 4 Bone Chips from a skeleton\'s corpse and did something new.');
  ok(qty?.qty === 4, 'la red no se come la cantidad', qty?.qty);
  // Y la forma entre guiones, donde el riesgo es el contrario: su regla general
  // casa cualquier cosa acabada en `.--`, así que sin red el final desconocido
  // se metería DENTRO del nombre del objeto y saldría como un objeto nuevo.
  const gui = parse('--You have looted 2 Bone Chips from a skeleton\'s corpse and did something new.--');
  ok(gui?.item === 'Bone Chips', 'entre guiones, el objeto no se traga la cola', gui?.item);
  ok(gui?.from === 'a skeleton', 'y el cadáver sale aparte', gui?.from);
  ok(gui?.cola === 'and did something new', 'con su cola marcada', gui?.cola);
}

// ── 7. La moneda, que se reconocía y se tiraba ─────────────────────────────
console.log('\nla moneda');
{
  ok(enCobre('2 platinum, 5 gold, 7 silver and 2 copper') === 2572, '2p 5o 7pl 2c son 2.572 cobres', enCobre('2 platinum, 5 gold, 7 silver and 2 copper'));
  ok(enCobre('5 silver and 8 copper') === 58, 'las que faltan valen cero, no NaN', enCobre('5 silver and 8 copper'));
  ok(enCobre('') === 0 && enCobre(null) === 0, 'sin frase, cero');
  const ev = parse('You receive 3 platinum and 2 copper from the corpse.');
  ok(ev?.kind === 'coin', 'la línea de moneda se reconoce', ev?.kind);
  ok(ev?.cp === 3002, 'y llega convertida a cobres', ev?.cp);
}

// ── 8. EL BOTÍN SE CUELGA DE SU CADÁVER, NO DE LA VENTANA ──────────────────
//
// Es el fallo que justifica la generación 8, y se prueba con el caso medido: un
// bicho muere en la pelea A, saqueas su cadáver cuando ya está abierta la pelea
// B, y el objeto TIENE que irse con A. Antes se lo quedaba B — 34 objetos de un
// histórico real, siempre hacia adelante, mediana 10 minutos.
console.log('\nel botín va a la pelea donde murió su cadáver');
{
  const escena = (segundos) => {
    const p = new Parser({ self: 'Campeon' });
    const tr = new EncounterTracker({ self: 'Campeon', idleSec: 20 });
    const tardios = [], sueltos = [], cerradas = [];
    tr.on('lateLoot', (e) => tardios.push(e));
    tr.on('orphanLoot', (e) => sueltos.push(e));
    tr.on('close', (e) => cerradas.push(e));
    for (const [s, cuerpo] of segundos) {
      const hh = String(12 + Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      const ev = p.parse(`[Tue Aug 11 ${hh}:${mm}:${ss} 2026] ${cuerpo}`);
      if (ev) tr.feed(ev);
    }
    tr.tick(Number.MAX_SAFE_INTEGER);
    return { tardios, sueltos, cerradas };
  };

  const r = escena([
    [0, 'You slash orc legionnaire for 100 points of damage.'],
    [5, 'You have slain orc legionnaire!'],
    [90, 'You slash a zol ghoul knight for 100 points of damage.'],
    [95, 'You have slain a zol ghoul knight!'],
    // Saqueado con la pelea de su cadáver cerrada hace rato y otra ya abierta.
    [100, 'You looted a Legionnaire\'s Bracer +4 from orc legionnaire\'s corpse and sold it for 2 gold.'],
  ]);
  ok(r.cerradas.length === 2, 'son dos peleas', r.cerradas.length);
  ok(r.cerradas[1].loot.length === 0, 'la SEGUNDA pelea no se queda el objeto de la primera', r.cerradas[1].loot.length);
  ok(r.tardios.length === 1, 'sale como botín tardío', r.tardios.length);
  ok(r.tardios[0]?.de === Math.round(r.cerradas[0].start * 1000),
    'y apunta a la pelea donde murió su cadáver', r.tardios[0]?.de);
  ok(r.tardios[0]?.via === 'cadaver', 'marcado como resuelto por cadáver', r.tardios[0]?.via);
  ok(r.tardios[0]?.dt === 95, 'con el hueco MEDIDO desde la muerte', r.tardios[0]?.dt);

  // Sin muerte registrada de ese nombre no se inventa una pelea: sale suelto y
  // con el motivo puesto. Es el cadáver que remató entero un compañero.
  const s2 = escena([
    [0, 'You slash a zol ghoul knight for 100 points of damage.'],
    [5, 'You have slain a zol ghoul knight!'],
    [8, '--You have looted a Rusty Dagger from a fetid fiend\'s corpse.--'],
  ]);
  ok(s2.sueltos.length === 1, 'un cadáver que nunca murió en tus peleas sale suelto', s2.sueltos.length);
  ok(s2.sueltos[0]?.porQue === 'sin-muerte-registrada', 'y con el motivo dicho', s2.sueltos[0]?.porQue);

  // Y el tope: más allá de la ventana medida, el cadáver ya no cuenta. Lo que
  // se prueba aquí es que el motivo distingue «no lo vi morir» de «hace
  // demasiado», porque son dos problemas distintos.
  const s3 = escena([
    [0, 'You slash orc legionnaire for 100 points of damage.'],
    [5, 'You have slain orc legionnaire!'],
    [700, 'You slash a rat for 100 points of damage.'],
    [720, '--You have looted a Bone Chips from orc legionnaire\'s corpse.--'],
  ]);
  ok(s3.sueltos[0]?.porQue === 'cadaver-fuera-de-ventana',
    'fuera de la ventana se dice que el cadáver existió, no que no se vio', s3.sueltos[0]?.porQue);

  // La moneda NO se resuelve por cadáver porque la línea no lo nombra: se queda
  // con la ventana, y eso hay que poder verlo en los datos.
  const s4 = escena([
    [0, 'You slash a rat for 100 points of damage.'],
    [3, 'You have slain a rat!'],
    [6, 'You receive 2 gold and 3 silver from the corpse.'],
  ]);
  ok(s4.cerradas[0]?.coins?.length === 1, 'la moneda entra en la pelea abierta', s4.cerradas[0]?.coins?.length);
  ok(s4.cerradas[0]?.coins?.[0]?.cp === 230, 'con su importe en cobres', s4.cerradas[0]?.coins?.[0]?.cp);
}

// ── 9. Un objeto vale UNA VEZ, esté donde esté ─────────────────────────────
//
// El botín tardío vive fuera de la pelea, en el fichero lateral, y la
// enciclopedia lo pliega por su cuenta. Si además viajara dentro de la pelea
// —o si `store.get` lo metiera al leer— se contaría dos veces y nadie lo
// notaría: los dos caminos son correctos por separado.
console.log('\nel botín tardío se cuenta una sola vez');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-tarde-'));
  const store = new FightStore(dir);
  store.load();
  const at = 1_700_000_000_000;
  store.append({
    id: 1, duration: 20, total: 500, zone: 'Lower Guk', zoneBase: 'Lower Guk',
    diff: 2, diffTag: 'Adaptive', level: 50, raidDps: 25, enemyDps: 10,
    enemyTotal: 200, healing: 0, kills: ['a froglok'], killTimes: [{ name: 'a froglok', t: 10 }],
    losses: [], hpSamples: { 'a froglok': [500] }, spellVsFoe: [], coins: [],
    loot: [{ item: 'Bone Chips', qty: 1, from: 'a froglok', t: 12, via: 'cadaver' }],
    rows: [
      { name: 'Campeon', side: 'ally', damage: 500, taken: 200, healingDone: 0, hits: 5,
        meleeHits: 5, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 120,
        activeSec: 20, types: [], abilities: [], targets: [{ name: 'a froglok', sum: 500 }], takenBySource: [] },
      { name: 'a froglok', side: 'enemy', damage: 200, taken: 500, healingDone: 0, hits: 8,
        meleeHits: 8, misses: 0, crits: 0, flurries: 0, ripostes: 0, deaths: 0, max: 40,
        activeSec: 20, types: [], abilities: [], targets: [], takenBySource: [] },
    ],
  }, at);
  // Recogido 40 s después de empezar la pelea: con ella ya cerrada.
  store.appendLoot({
    item: 'Fine Steel Dagger', qty: 1, from: 'a froglok', via: 'cadaver', amb: false,
    de: at, t: at / 1000 + 40, at: at + 40_000, zone: 'Lower Guk', diff: 2,
  });

  const enc = new Encyclopedia(store);
  enc.load();
  const lista = enc.lootList();
  const tardio = lista.find((l) => l.item === 'Fine Steel Dagger');
  ok(tardio?.n === 1, 'el objeto tardío se cuenta una vez', tardio?.n);
  ok(lista.find((l) => l.item === 'Bone Chips')?.n === 1, 'y el de dentro sigue contando una');

  // Y llega a la ficha de SU enemigo, que es lo que se perdía al sacarlo de la
  // pelea. El denominador no se toca: sigue habiendo una sola caída.
  const ficha = enc.foe?.('a froglok') ?? enc.ledger.get('a froglok');
  ok(ficha?.lootList?.some((l) => l.item === 'Fine Steel Dagger'),
    'y entra en la tabla de caídas de su enemigo', JSON.stringify(ficha?.lootList));
  ok(ficha?.kills === 1, 'sin tocar el denominador: sigue siendo una caída', ficha?.kills);

  // Y se puede pedir por su pelea, que es lo que lee la ficha del reproductor.
  ok(store.lootDe(at).loot.length === 1, '`lootDe` lo devuelve por la hora de su pelea');
  ok(store.orphanLoot.length === 0, 'y NO se cuenta como suelto: tiene dueño', store.orphanLoot.length);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 10. LA FICHA DEL FINAL: los tres vacíos y lo que cae fuera de la ventana ──
//
// Los tres vacíos son TRES HECHOS DISTINTOS y decirlos igual sería mentir en
// dos: 103 peleas de un histórico real tienen enemigos abatidos y ninguna
// recogida —no consta que cogieras nada—, 138 no tienen ni un cadáver —no
// había nada que saquear— y 26 objetos no pertenecen a ninguna pelea. Un panel
// vacío las diría las tres a la vez.
//
// Y lo que se recogió con la pelea ya cerrada TIENE que salir: el reproductor
// recorre de 0 a `duration`, así que 273 objetos de ese mismo histórico —el
// 14,8%, repartidos por un tercio de las peleas con botín— no se pintaban en
// ninguna parte. Si la ficha vuelve a acotarse por la duración, vuelven a
// desaparecer y nadie lo nota.
console.log('\nla ficha del final del reproductor');
{
  // La interfaz se carga en el navegador; aquí sólo hace falta que los módulos
  // que toca al importarse encuentren un `document`. No se dibuja nada: lo que
  // se comprueba es el texto que produce.
  globalThis.document ??= {
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, setAttribute() {} }),
    body: { appendChild() {}, contains: () => false },
    addEventListener() {}, querySelector: () => null, getElementById: () => null,
  };
  globalThis.window ??= { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const { fichaBotin } = await import('../ui/reproduccion.js');

  const base = { at: 1_700_000_000_000, duration: 30, loot: [], coins: [], kills: [] };

  const sinNada = fichaBotin({ ...base, kills: ['a froglok', 'a froglok'] }, null);
  ok(sinNada.includes('No consta que recogieras nada'),
    'con enemigos abatidos y sin recoger: «no consta botín»');
  ok(sinNada.includes('2'), 'y dice cuántos cayeron');
  ok(!sinNada.includes('no había nada que saquear'), 'y NO dice que no cayera nadie');

  const sinMuertos = fichaBotin({ ...base }, null);
  ok(sinMuertos.includes('No cayó nadie'),
    'sin ningún abatido: «no cayó nadie», que es otro hecho');
  ok(!sinMuertos.includes('No consta que recogieras nada'),
    'y no se confunde con el anterior');

  // El caso del arreglo: un objeto recogido en el segundo 95 de una pelea que
  // duró 30. Antes no se pintaba en ninguna parte.
  const conCola = fichaBotin({
    ...base,
    loot: [{ item: 'Bone Chips', qty: 2, from: 'a froglok', t: 5, via: 'cadaver', dt: 1 }],
  }, {
    loot: [{ item: 'Skinner\'s Belt +4', qty: 1, from: 'Innoruuk', t: base.at / 1000 + 95, via: 'cadaver', dt: 62, de: base.at }],
    coins: [],
  });
  ok(conCola.includes('Skinner&#039;s Belt +4') || conCola.includes('Skinner\'s Belt +4'),
    'el objeto recogido tras cerrarse la pelea SALE en la ficha');
  ok(conCola.includes('1:35'), 'con su instante real, más allá de la duración', '1:35');
  ok(conCola.includes('tras cerrarse la pelea'), 'y dicho: la pelea ya había terminado');
  ok(conCola.indexOf('Bone Chips') < conCola.indexOf('Skinner'),
    'y el orden es el instante de recogida, no el fichero del que vienen');
  ok(conCola.includes('×2'), 'la cantidad se enseña cuando es más de una');

  // El precio de venta: formateado cuando son monedas, literal cuando no. En un
  // histórico real 108 de 1.101 ventas son `free.`, y «vendido por 0c» pondría
  // una cifra donde el registro puso una palabra.
  const vendido = fichaBotin({
    ...base,
    loot: [{ item: 'A', from: 'x', t: 1, sold: '71 platinum, 4 gold, 2 silver and 9 copper.' },
      { item: 'B', from: 'x', t: 2, sold: 'free.' }],
  }, null);
  ok(vendido.includes('71p 4o 2pl 9c'), 'el precio en monedas se formatea como el total');
  ok(vendido.includes('free') && !vendido.includes('0c'),
    'y lo que no son monedas se enseña tal cual, no como cero');

  // La moneda, con su regla distinta dicha al lado.
  const conMoneda = fichaBotin({ ...base, coins: [{ t: 10, cp: 2572 }] }, null);
  ok(conMoneda.includes('2p 5o 7pl 2c'), 'la moneda sale desglosada, sin redondear a platino');
  ok(conMoneda.includes('no de un cadáver') || conMoneda.includes('no de un cad'),
    'y con su regla dicha: la moneda va por ventana');

  // Y la duda del 0,2%, marcada donde se ve.
  const dudoso = fichaBotin({
    ...base, loot: [{ item: 'Bone Chips', qty: 1, from: 'orc legionnaire', t: 5, via: 'cadaver', amb: true, dt: 3 }],
  }, null);
  ok(dudoso.includes('rpb-tag duda'), 'la recogida con dos cadáveres posibles se marca');
}

/**
 * LA PISTA DE ESTADOS: qué entra, qué no, y con qué peso.
 *
 * No se comprueba que dibuje, sino las tres decisiones que se midieron: que el
 * fondo se queda fuera, que el eje incluye lo que TÚ provocas —sin eso la pista
 * enmudece justo en las sesiones de encantador— y que el peso ordena por rareza
 * y no por frecuencia.
 */
console.log('\nla pista de cambios de estado');
{
  const { sucesosDePista, PISTA } = await import('../ui/reproduccion.js');
  const g = {
    duracion: 100,
    segundos: [
      [{ tipo: 'estado', clase: 'stun', destino: 'Campeon' }],
      [{ tipo: 'estado', clase: 'stagger', destino: 'a gorgon' }],
      [{ tipo: 'estado', clase: 'proc', destino: 'Campeon' }],
      [{ tipo: 'estado', clase: 'charm_on', destino: 'a hardened skeleton', origen: 'Campeon' }],
      [{ tipo: 'estado', clase: 'resist_by_you', destino: 'Campeon' }],
      [{ tipo: 'estado', clase: 'stun', destino: 'Notarino' }],
      [{ tipo: 'dano', clase: 'melee', destino: 'Campeon' }],
    ],
  };
  const out = sucesosDePista(g, 'Campeon');
  const clases = out.map((x) => x.clase);
  ok(clases.includes('stun'), 'el aturdimiento entra');
  ok(clases.includes('charm_on'), 'EL ENCANTO TUYO ENTRA aunque su destino sea el bicho');
  ok(!clases.includes('resist_by_you'),
    'lo que resististe YA NO entra: 1.972 marcas para explicar lo que no pasó. Su'
    + ' sitio es la estadística por enemigo, ver resistsByFoe');
  ok(!clases.includes('stagger'), 'el stagger NO entra: 19 por pelea y le pasa al enemigo');
  ok(!clases.includes('proc'), 'el proc tampoco: 10 por pelea, es el fondo');
  ok(!out.some((x) => x.quien === 'Notarino'), 'ni lo que le pasa a un compañero');
  // Tres de siete: entran el aturdimiento tuyo, el encanto y el resistido. Se
  // quedan fuera el stagger y el proc —el fondo—, el aturdimiento del compañero
  // y lo que no es un estado.
  // Dos de siete: entran el aturdimiento tuyo y el encanto. Se quedan fuera el
  // stagger y el proc —el fondo—, el aturdimiento del compañero, lo que no es un
  // estado y, desde la 1.13.0, el resistido.
  ok(out.length === 2, 'dos sucesos de siete', out.length);

  // El peso ordena por RAREZA y no por frecuencia. Si alguien los iguala «para
  // que se vea todo igual», esto se pone rojo y explica por qué no.
  ok(!PISTA.has('resist_by_you') && !PISTA.has('root'),
    'el resistido y la raíz están fuera de la pista, y sus reglas siguen enteras');
  ok(PISTA.get('absorb').peso > PISTA.get('stun').peso
    && PISTA.get('knockdown').peso > PISTA.get('stun').peso,
  'lo raro —absorb 91, knockdown 36— pesa más que lo común —stun 1.439—');
  ok(PISTA.get('charm_on').deducido === true,
    'el encanto va marcado como deducido: la línea no dice quién encantó');

  // LOS SIETE PESOS, no cuatro. `survival` estuvo en 2 por descuido y el
  // criterio lo pone en 3: el salto de la distribución está entre 1.817 y 370.
  const esperados = {
    stun: 2, survival: 2,
    absorb: 3, charm_on: 3, charm_off: 3, knockdown: 3,
    // `control` entra en la 1.13.0 y es la más rara de las nueve: 31 tramos en
    // el registro entero, contados como el aturdimiento —por pares, no por
    // líneas— porque el registro escribe los dos extremos y son un estado.
    control: 3,
  };
  ok(PISTA.size === 7, 'la pista tiene siete clases y no más', PISTA.size);
  for (const [clase, peso] of Object.entries(esperados)) {
    ok(PISTA.get(clase)?.peso === peso, `${clase} pesa ${peso}`, PISTA.get(clase)?.peso);
  }
  /**
   * LA REGLA, Y POR QUÉ YA NO NECESITA EXCEPCIÓN.
   *
   * La regla es «lo más raro no pesa menos que lo más común». Con la primera
   * medición había que eximir a `resist_by_you`: parecía más raro que `stun`
   * —1.817 contra 2.853— y pesaba menos, así que la incumplía, y lo eximía la
   * ASIMETRÍA: un resistido es algo que NO te pasó, la explicación de un hueco
   * en la curva y no un suceso que la llene.
   *
   * PERO LOS 2.853 ERAN 1.439. Cada aturdimiento son dos líneas y se contaban
   * dos veces. Con la cuenta buena `resist_by_you` (1.972) es LA MÁS FRECUENTE
   * de las ocho, así que darle el peso más tenue no incumple nada: lo cumple.
   *
   * La asimetría sigue siendo el MOTIVO de que pese 1 —no está ahí por ser
   * frecuente— pero ha dejado de ser una excepción a la regla. Se quita, que es
   * lo que decía la propia prueba que había que hacer si algún día pasaba esto.
   * Y lo detectó ella: al corregir los números se puso roja porque la exención
   * ya no eximía nada.
   *
   * Y LA FRECUENCIA TIENE QUE ESTAR MEDIDA PARA TODAS. Si alguien añade una
   * clase mañana sin contarla, esto cae — que es justo lo que se quiere, porque
   * el peso no se puede decidir sin saber cuántas veces pasa.
   */
  const FREC = {
    stun: 1439, survival: 603,
    absorb: 91, charm_on: 43, charm_off: 43, knockdown: 36,
    // 31 pares en el registro de referencia —«You lose control of yourself!» y
    // su cierre—, sin ninguno suelto. Es la clase más rara de la pista, y la
    // única que explica por qué durante hasta 37 segundos seguidos no hiciste
    // nada: hasta ahora ese hueco se cobraba como tiempo parado.
    control: 31,
  };

  ok([...PISTA.keys()].every((k) => FREC[k] !== undefined)
    && Object.keys(FREC).length === PISTA.size,
  'toda clase de la pista tiene su frecuencia medida: sin eso no se puede pesar',
  `${Object.keys(FREC).length} de ${PISTA.size}`);

  const rompen = [];
  for (const a of PISTA.keys()) {
    for (const b of PISTA.keys()) {
      if (a === b) continue;
      // `a` es más raro que `b`, así que no puede pesar menos.
      if (FREC[a] < FREC[b] && PISTA.get(a).peso < PISTA.get(b).peso) rompen.push(`${a} < ${b}`);
    }
  }
  ok(rompen.length === 0,
    'lo más raro nunca pesa menos que lo más común, SIN excepciones',
    rompen.length ? rompen.join(' · ') : 'ninguna pareja');

  /**
   * Y LA EXCEPCIÓN HA DEJADO DE EXISTIR PORQUE LA CLASE HA DEJADO DE ESTAR.
   *
   * Aquí se comprobaba que `resist_by_you` seguía siendo la más frecuente, que
   * era lo que hacía que su peso 1 cumpliera la regla en vez de romperla. En la
   * 1.13.0 sale de la pista entera —1.972 marcas para explicar lo que NO pasó—
   * así que no hay nada que eximir: lo que queda cumple la regla a secas, y eso
   * ya lo comprueba `rompen` de arriba sin ninguna salvedad.
   *
   * Lo que sí sigue haciendo falta es que nadie vuelva a meterla sin volver a
   * pensarlo, y de eso se encarga el recuento de clases.
   */
  ok(!Object.keys(FREC).includes('resist_by_you'),
    'la excepción se fue con su clase: ya no hay ninguna que eximir');
}

/**
 * SEIS MARCAS DONDE HAY TRES ESTADOS. La barra, y la regla del cubo.
 *
 * ESTA PRUEBA SE ESTRENA EN ROJO, y contra qué es lo que importa: con tres
 * aturdimientos el registro escribe SEIS líneas —«You are stunned!» y «You are
 * no longer stunned.»— y la pista dibujaba las seis. Seis puntos donde hay tres
 * estados, y ninguno dice cuánto duró, con la duración medida y tirada. Medido:
 * 2.853 sucesos `stun` en el registro de referencia son 1.429 aturdimientos.
 *
 * `par: true` llevaba versiones declarado y sin leer —bandera muerta— y es lo
 * que esto pone a trabajar.
 *
 * Y LAS TRES DECISIONES QUE SE FIJAN AQUÍ:
 *
 *   emparejar        dos líneas son UN estado, con su duración
 *   extremos abiertos un estado puede empezar antes de la pelea o no cerrarse
 *                    dentro: se dibuja hasta el borde y se marca abierto, que
 *                    es distinto de afirmar que duró hasta el final
 *   la regla del cubo si la barra no mide un cubo de dibujo, punto y no barra.
 *                    Una barra de dos píxeles no informa de una duración y
 *                    encima pierde el número cuando hay varias apiladas
 */
console.log('\nla barra de los estados con dos extremos');
{
  const { tramosDePista, barrasDePista, pintaBarras } = await import('../ui/reproduccion.js');
  // Tres aturdimientos, seis líneas. Y uno de ellos, largo.
  const sucesos = [
    { s: 10, clase: 'stun', on: true, quien: 'Campeon' },
    { s: 12, clase: 'stun', on: false, quien: 'Campeon' },
    { s: 30, clase: 'stun', on: true, quien: 'Campeon' },
    { s: 70, clase: 'stun', on: false, quien: 'Campeon' },
    { s: 80, clase: 'stun', on: true, quien: 'Campeon' },
    { s: 82, clase: 'stun', on: false, quien: 'Campeon' },
    { s: 50, clase: 'absorb', on: null, quien: 'Campeon' },
  ];
  const { tramos, sueltos } = tramosDePista(sucesos, 100);
  ok(tramos.length === 3, 'seis líneas son TRES estados, no seis marcas', tramos.length);
  ok(sueltos.length === 1 && sueltos[0].clase === 'absorb',
    'y lo que no viene emparejado sigue su camino de siempre');
  ok(tramos[1].hasta - tramos[1].desde === 40, 'con la duración que el registro sí da',
    tramos[1].hasta - tramos[1].desde);

  // La regla del cubo, con un ancho donde 2 s no llegan al cubo y 40 s sí: a
  // 150 px de ancho, 2 s son 3 px y el cubo mide 4.
  const { barras, aPunto } = barrasDePista(tramos, 100, 150);
  ok(barras.length === 1 && barras[0].ancho === 60,
    'sólo el largo da para barra', `${barras.length} barra(s) de ${barras[0]?.ancho} px`);
  ok(aPunto.length === 2, 'los cortos vuelven a ser puntos: una barra de 8 px no dice nada',
    aPunto.length);
  ok(aPunto[0].s === 10, 'y el punto se coloca donde EMPEZÓ el estado', aPunto[0].s);

  // Extremos abiertos. Un cierre sin apertura viene de antes de la pelea; una
  // apertura sin cierre seguía puesta al acabar.
  const abre = tramosDePista([{ s: 5, clase: 'stun', on: false, quien: 'Campeon' }], 100).tramos[0];
  ok(abre.abre === true && abre.desde === 0,
    'sin apertura, el estado venía de antes y se dibuja abierto por la izquierda');
  const cierra = tramosDePista([{ s: 90, clase: 'stun', on: true, quien: 'Campeon' }], 100).tramos[0];
  ok(cierra.cierra === true && cierra.hasta === 100,
    'sin cierre, llega al final de la pelea y se dibuja abierto por la derecha');

  const html = pintaBarras(barrasDePista(tramosDePista(sucesos, 100).tramos, 100, 150).barras,
    (s2) => `${s2}s`);
  ok(html.includes('rp-tramo'), 'y el dibujo sale: compilar no es funcionar');
  ok(html.includes('40 s'), 'con la duración en el título, que es para lo que se emparejan');
  const htmlAbierto = pintaBarras(
    barrasDePista(tramosDePista([{ s: 90, clase: 'stun', on: true }], 100).tramos, 100, 150).barras,
    (s2) => `${s2}s`);
  ok(htmlAbierto.includes('cierra'), 'y el extremo abierto va marcado en el dibujo');
}

/**
 * QUE LA PISTA PINTE, Y QUE SI PINTA CERO LA PRUEBA CAIGA.
 *
 * ESTA ES LA PRUEBA QUE FALTABA. `sucesosDePista` tenía la suya y el dibujo no,
 * y el fallo estaba en el dibujo: un `cuboDe` sin importar dejaba la pista vacía
 * con la batería entera en verde. No era un error de sintaxis —compilar no es
 * funcionar— así que la guarda de «todo ui/*.js compila» no podía verlo. Se
 * descubrió abriendo la aplicación y contando cero marcas, y la próxima vez
 * nadie la va a abrir.
 *
 * Se pinta sin navegador porque el dibujo devuelve una cadena.
 */
console.log('\nla pista pinta, y se cuenta lo que pinta');
{
  const { sucesosDePista, marcasDePista, pintaMarcas } = await import('../ui/reproduccion.js');
  const reloj = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Una pelea de verdad, con la forma de la de Innoruuk: 131 s, un absorbido y
  // seis aturdimientos, en los segundos en que ocurrieron.
  const g = { duracion: 131, segundos: [] };
  const mete = (s, clase, destino = 'Campeon') => {
    g.segundos[s] = g.segundos[s] ?? [];
    g.segundos[s].push({ tipo: 'estado', clase, destino, origen: null });
  };
  mete(10, 'absorb');
  for (const s of [21, 23, 90, 91, 118, 119]) mete(s, 'stun');
  for (let s = 0; s <= 131; s++) g.segundos[s] = g.segundos[s] ?? [];

  const sucesos = sucesosDePista(g, 'Campeon');
  ok(sucesos.length === 7, 'siete sucesos entran en la pista', sucesos.length);

  const marcas = marcasDePista(sucesos, g.duracion, 838);
  ok(marcas.length > 0, 'LA PISTA PINTA ALGO: si esto es cero, está rota', marcas.length);
  ok(marcas.length === 7, 'a 838 px no se solapa ninguna', marcas.length);

  const html = pintaMarcas(marcas, reloj);
  const dibujadas = (html.match(/class="rp-marca/g) ?? []).length;
  ok(dibujadas === marcas.length, 'y el HTML lleva una por marca', dibujadas);
  ok(/e-absorb p3/.test(html) && /e-stun p2/.test(html),
    'con su clase y su peso puestos en el HTML');
  ok(/left:64px/.test(html), 'el absorbido del segundo 10 cae en su píxel', html.match(/left:\d+px/)?.[0]);

  // EL COLAPSO, comprobado por sus dos lados. Estrecho: los del 90 y 91 caen en
  // el mismo cubo. Ancho: se separan. Si alguien fija el cubo en segundos, esto
  // deja de moverse y cae.
  const estrecha = marcasDePista(sucesos, g.duracion, 120);
  const ancha = marcasDePista(sucesos, g.duracion, 2003);
  ok(estrecha.length < marcas.length, 'en una ventana estrecha se funden', estrecha.length);
  ok(ancha.length === 7, 'y maximizada vuelven a separarse', ancha.length);
  const fundida = estrecha.find((m) => m.n > 1);
  ok(!!fundida && /×|<b>/.test(pintaMarcas([fundida], reloj)),
    'la fundida lleva su cuenta', fundida?.n);

  // Sin sucesos no se inventa nada, y sin ancho tampoco: es el estado en que
  // está el elemento antes de entrar en la página.
  ok(marcasDePista([], 131, 838).length === 0, 'sin sucesos, ninguna marca');
  ok(marcasDePista(sucesos, 131, 0).length === 0, 'sin ancho medido, ninguna marca');
  ok(pintaMarcas([], reloj) === '', 'y el HTML vacío es vacío');
}

/**
 * SIN NOMBRE, SÓLO PASA EL ENCANTO. Y esto se clava porque el arreglo es
 * deliberado y su síntoma al deshacerse es «salen marcas de más», que no mira
 * nadie.
 *
 * `x.origen === self` casaba `null` con `null` cuando el nombre aún no se había
 * deducido del registro, y colaba TODO lo que no tuviera origen. Es la familia
 * de siempre —¿lo que uso como identidad sigue valiendo?— con una variante: el
 * problema no es que la identidad cambie, es que NO EXISTA.
 */
console.log('\ncon el nombre sin deducir, sólo pasa el encanto');
{
  const { sucesosDePista } = await import('../ui/reproduccion.js');
  const g = {
    duracion: 60,
    segundos: [
      [{ tipo: 'estado', clase: 'stun', destino: 'Campeon', origen: null }],
      [{ tipo: 'estado', clase: 'absorb', destino: 'Campeon', origen: null }],
      [{ tipo: 'estado', clase: 'resist_by_you', destino: 'Campeon', origen: null }],
      [{ tipo: 'estado', clase: 'charm_on', destino: 'a hardened skeleton', origen: null }],
      [{ tipo: 'estado', clase: 'stun', destino: 'Notarino', origen: null }],
    ],
  };
  for (const sinNombre of [null, undefined, '']) {
    const out = sucesosDePista(g, sinNombre);
    ok(out.length === 1 && out[0].clase === 'charm_on',
      `con self = ${JSON.stringify(sinNombre)} sólo pasa el encanto`,
      `${out.length}: ${out.map((x) => x.clase).join(', ')}`);
  }
  // Y con nombre, lo normal: no se ha roto el camino bueno para arreglar el malo.
  const conNombre = sucesosDePista(g, 'Campeon');
  // Tres desde la 1.13.0: el resistido salió de la pista y se cuenta por enemigo.
  ok(conNombre.length === 3, 'con nombre pasan los tres tuyos', conNombre.length);
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
