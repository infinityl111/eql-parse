import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FightStore, STORE_VERSION } from '../src/store.js';
import { Encyclopedia, ENC_VERSION } from '../src/encyclopedia.js';

/**
 * La ficha aprendida: que aprender pelea a pelea dé lo mismo que rehacerla.
 *
 * Es la misma invariante que en `foes.js` pero con el disco de por medio, que
 * es donde puede romperse de verdad: guardar, cerrar, volver a abrir y seguir
 * plegando tiene que dar exactamente la ficha que sale de rehacerla entera. Si
 * no, la enciclopedia va derivando en silencio y nadie lo nota.
 */

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-enc-'));
const nuevaCarpeta = () => fs.mkdtempSync(path.join(tmp, 'c-'));

/** Una pelea contra un enemigo en una zona y dificultad. */
function pelea(id, { foe, zone, zoneBase, diff, tag, vida, cayo = true, hab = [], loot = [] }) {
  return {
    id, duration: 40, total: vida, zone, zoneBase, diff, diffTag: tag, level: 50,
    raidDps: vida / 40, enemyDps: 75, enemyTotal: 3000, healing: 0,
    kills: cayo ? [foe] : [], losses: [],
    hpSamples: cayo ? { [foe]: [vida] } : {},
    loot: loot.map((item) => ({ item, from: foe })),
    spellVsFoe: [{ spell: 'Shock of Swords', foe, landed: 3, resisted: 5, inv: null }],
    rows: [
      { name: 'Campeon', side: 'ally', damage: vida, taken: 3000, healingDone: 0,
        hits: 10, meleeHits: 10, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: 900, activeSec: 40, types: [], abilities: [],
        targets: [{ name: foe, sum: vida }], takenBySource: [{ name: foe, sum: 3000 }] },
      { name: foe, side: 'enemy', damage: 3000, taken: vida, healingDone: 0,
        hits: 20, meleeHits: 20, misses: 0, crits: 0, flurries: 0, ripostes: 0,
        deaths: 0, max: 4000, activeSec: 40, types: [],
        abilities: hab.map((h) => ({ name: h, type: 'magic', sum: 500, n: 2, max: 400 })),
        targets: [{ name: 'Campeon', sum: 3000 }], takenBySource: [] },
    ],
  };
}

const FEAR4 = { zone: 'Plane of Fear - Group 4 (Refined)', zoneBase: 'Plane of Fear', diff: 4, tag: 'Refined' };
const FEAR3 = { zone: 'Plane of Fear - Group 3 (Fused)', zoneBase: 'Plane of Fear', diff: 3, tag: 'Fused' };
const GUK2 = { zone: 'The Ruins of Old Guk 2 - Solo 2 (Adaptive)', zoneBase: 'The Ruins of Old Guk 2', diff: 2, tag: 'Adaptive' };
const ABIERTO = { zone: 'Befallen', zoneBase: 'Befallen', diff: null, tag: null };

const GUION = [
  { ...FEAR4, foe: 'Dread', vida: 412900, hab: ['Ice Comet'], loot: ['Cloak of Flames'] },
  { ...FEAR4, foe: 'Dread', vida: 408100, hab: ['hits'] },
  { ...FEAR4, foe: 'a fear guardian', vida: 61400, hab: ['hits'] },
  { ...FEAR3, foe: 'Dread', vida: 251000, hab: ['hits'] },
  { ...GUK2, foe: 'a froglok ghoul', vida: 18000, hab: ['hits'], loot: ['Shiny Brass Idol'] },
  { ...ABIERTO, foe: 'a skeleton', vida: 4200, cayo: false, hab: ['hits'] },
];

/** Un almacén con el guion dentro, en orden cronológico. */
function almacenLleno() {
  const store = new FightStore(nuevaCarpeta());
  store.load();
  GUION.forEach((g, i) => store.append(pelea(i + 1, g), 1_700_000_000_000 + i * 60_000));
  return store;
}

console.log('\naprender pelea a pelea es lo mismo que rehacerla');
{
  // Aprendida: se pliega cada pelea según se cierra, como en el juego.
  const store = almacenLleno();
  const aprendida = new Encyclopedia(store);
  aprendida.load();                       // ficha nueva: se construye de golpe
  const rehecha = new Encyclopedia(store);
  rehecha.rebuild();
  ok(JSON.stringify(aprendida.ledger.list()) === JSON.stringify(rehecha.ledger.list()),
    'la ficha cargada y la rehecha dicen lo mismo');

  // Y ahora de verdad: una a una, guardando y volviendo a abrir en medio.
  const s2 = new FightStore(nuevaCarpeta());
  s2.load();
  let enc = new Encyclopedia(s2);
  enc.load();
  GUION.forEach((g, i) => {
    const f = pelea(i + 1, g);
    const sum = s2.append(f, 1_700_000_000_000 + i * 60_000);
    enc.fold(f, sum);
    enc.flush();
    // Cerrar y volver a abrir: el estado tiene que sobrevivir al disco.
    enc = new Encyclopedia(s2);
    enc.load();
  });
  ok(JSON.stringify(enc.ledger.list()) === JSON.stringify(rehecha.ledger.list()),
    'y plegando de una en una, guardando y reabriendo en cada pelea, también');
  ok(enc.lastUid === s2.index[0].uid,
    'la ficha sabe cuál fue la última pelea que incorporó');
}

console.log('\nla misma pelea no se cuenta dos veces');
{
  const store = almacenLleno();
  const enc = new Encyclopedia(store);
  enc.load();
  const antes = enc.foe('Dread').fights;
  // Releer el log vuelve a generar las mismas peleas: el almacén devuelve la
  // que ya tenía, con su uid viejo, y la ficha tiene que rechazarla.
  const repetida = pelea(1, GUION[0]);
  const sum = store.append(repetida, 1_700_000_000_000);
  ok(enc.fold(repetida, sum) === false, 'una pelea ya incorporada se rechaza');
  ok(enc.foe('Dread').fights === antes, 'y el contador no se mueve', enc.foe('Dread').fights);
}

console.log('\ncuándo se sabe que va desfasada');
{
  const store = almacenLleno();
  const enc = new Encyclopedia(store);
  enc.load();
  enc.flush();
  const p = path.join(store.dir, 'encyclopedia.json');
  const leer = () => JSON.parse(fs.readFileSync(p, 'utf8'));
  const escribir = (o) => fs.writeFileSync(p, JSON.stringify(o));

  ok(leer().version === ENC_VERSION && leer().storeVersion === STORE_VERSION,
    'se guarda con su generación y con la del almacén');

  // 1. Otra generación de la ficha.
  escribir({ ...leer(), version: ENC_VERSION - 1 });
  let r = new Encyclopedia(store).load();
  ok(r.rebuilt && r.reason === 'otra-generacion', 'una ficha de otra generación se rehace', r.reason);

  // 2. El almacén se corrigió y se releyó el log.
  enc.flush();
  escribir({ ...leer(), storeVersion: STORE_VERSION - 1 });
  r = new Encyclopedia(store).load();
  ok(r.rebuilt && r.reason === 'almacen-corregido',
    'si el histórico se corrigió, lo contado antes ya no describe nada', r.reason);

  // 3. El histórico se reconstruyó: los uid se movieron de sitio.
  new Encyclopedia(store).load();
  escribir({ ...leer(), lastUid: 999_999 });
  r = new Encyclopedia(store).load();
  ok(r.rebuilt && r.reason === 'histórico-reconstruido',
    'un uid que ya no existe delata que el almacén se rehízo debajo', r.reason);

  // 4. Lo normal: faltan las peleas de mientras estaba cerrada.
  new Encyclopedia(store).load();
  const g = leer();
  const dosAntes = [...store.index].sort((a, b) => a.uid - b.uid).at(-3).uid;
  escribir({ ...g, lastUid: dosAntes, foes: FoesHasta(store, dosAntes) });
  r = new Encyclopedia(store).load();
  ok(!r.rebuilt && r.folded === 2, 'lo que falta se pliega al arrancar, sin rehacer nada',
    `rehecha=${r.rebuilt} plegadas=${r.folded}`);
  // Y ponerse al día tiene que dejarla igual que rehacerla entera: si no, «lo
  // que faltaba» estaría contándose distinto que todo lo demás.
  const alDia = new Encyclopedia(store); alDia.load();
  const entera = new Encyclopedia(store); entera.rebuild();
  ok(JSON.stringify(alDia.ledger.list()) === JSON.stringify(entera.ledger.list()),
    'y la puesta al día deja la misma ficha que rehacerla entera');
}

/** La ficha tal y como estaría habiendo plegado sólo hasta cierto uid. */
function FoesHasta(store, uid) {
  const e = new Encyclopedia(store);
  const orden = [...store.index].sort((a, b) => a.uid - b.uid);
  for (const s of orden) {
    if (s.uid > uid) break;
    e.fold(store.get(s.uid), s);
  }
  return e.ledger.toJSON();
}

console.log('\nlas zonas, tal y como se consultan');
{
  const store = almacenLleno();
  const enc = new Encyclopedia(store);
  enc.load();

  const zonas = enc.zones();
  const fear = zonas.find((z) => z.base === 'Plane of Fear');
  ok(!!fear, 'la zona se agrupa por su nombre base, sin modo ni dificultad');
  ok(fear.celdas.length === 5, 'hay cinco dificultades: de la 0 a la 4', fear.celdas.length);
  ok(fear.celdas[4].foes === 2 && fear.celdas[3].foes === 1,
    'cada dificultad cuenta sus propios enemigos',
    `D4=${fear.celdas[4]?.foes} D3=${fear.celdas[3]?.foes}`);
  ok(fear.celdas[0] === null && fear.celdas[1] === null && fear.celdas[2] === null,
    'donde no has entrado no hay celda, que no es lo mismo que un cero');

  const guk = zonas.find((z) => z.base === 'The Ruins of Old Guk 2');
  ok(!!guk && guk.celdas[2]?.foes === 1,
    'el 2 de «Old Guk 2» es parte del nombre y no una dificultad');

  // El mundo abierto ES la dificultad 0. La línea de entrada no la escribe
  // —una zona sin instanciar no dice «- Solo 0», no dice nada— y el analizador
  // devuelve `null`, pero la pregunta «¿en qué dificultad?» tiene respuesta.
  const abierto = zonas.find((z) => z.base === 'Befallen');
  ok(abierto.celdas[0]?.foes === 1, 'el mundo abierto cae en la columna D0',
    JSON.stringify(abierto.celdas[0]));
  ok(abierto.celdas[0]?.sinDeclarar === 1,
    'y consta que el registro no llegó a declararla', abierto.celdas[0]?.sinDeclarar);
  ok(abierto.celdas.slice(1).every((c) => c === null),
    'sin ocupar ninguna de las otras cuatro');

  const enD4 = enc.zoneFoes('Plane of Fear', 4);
  ok(enD4.length === 2 && enD4[0].name === 'Dread',
    'los de una zona y dificultad, el que más cuesta primero',
    enD4.map((x) => x.name).join(', '));
  ok(enD4[0].hp.n === 2 && enD4[0].fights === 2,
    'con la vida sostenida por sus dos caídas en ESA dificultad');
  ok(enc.zoneFoes('Plane of Fear', 3).length === 1,
    'y la misma zona en otra dificultad es otra lista');
  ok(enc.zoneFoes('Befallen', null)[0].hp === null,
    'un enemigo que nunca ha caído no tiene vida estimada, y no es un cero');
}

console.log('\nla lista de enemigos no promedia entre dificultades');
{
  const store = almacenLleno();
  // Dread cae en D4 y en D3: manda la vida de D4, la más alta donde cayó.
  const enc = new Encyclopedia(store);
  enc.load();
  const dread = enc.foes().find((f) => f.name === 'Dread');
  ok(dread.difs.length === 2, 'sale una entrada por dificultad', dread.difs.length);
  ok(dread.hp.avg === 410500 && dread.hp.diff === 4,
    'la vida que se enseña es la de la dificultad más alta, con su etiqueta',
    `${dread.hp.avg} en D${dread.hp.diff}`);

  // Y si en la más alta nunca cayó, se enseña la de abajo, que sí se midió:
  // decir la de arriba sería inventarla.
  const s2 = new FightStore(nuevaCarpeta());
  s2.load();
  s2.append(pelea(1, { ...FEAR3, foe: 'Terror', vida: 90000 }), 1_700_000_000_000);
  s2.append(pelea(2, { ...FEAR4, foe: 'Terror', vida: 200000, cayo: false }), 1_700_000_060_000);
  const e2 = new Encyclopedia(s2); e2.load();
  const terror = e2.foes()[0];
  ok(terror.difs.length === 2 && terror.hp.diff === 3,
    'si en la más alta nunca cayó, se enseña la de abajo y se dice cuál es',
    `D${terror.hp.diff}`);
}

console.log('\nel botín, incluido el que el registro no atribuye a nadie');
{
  const store = new FightStore(nuevaCarpeta());
  store.load();
  const f1 = pelea(1, { ...FEAR4, foe: 'Dread', vida: 400000, loot: ['Cloak of Flames'] });
  const f2 = pelea(2, { ...FEAR4, foe: 'Dread', vida: 410000, loot: ['Cloak of Flames'] });
  // Una tercera con botín que el log no atribuye: `from` a null.
  const f3 = pelea(3, { ...FEAR4, foe: 'Dread', vida: 405000 });
  f3.loot = [{ item: 'Shiny Brass Idol', from: null }, { item: 'Cloak of Flames', from: null }];
  store.append(f1, 1_700_000_000_000);
  store.append(f2, 1_700_000_060_000);
  store.append(f3, 1_700_000_120_000);
  const enc = new Encyclopedia(store);
  enc.load();

  const capa = enc.lootList().find((o) => o.item === 'Cloak of Flames');
  ok(capa.n === 3, 'se cuentan las tres veces que ha caído', capa.n);
  ok(capa.from.length === 1 && capa.from[0].n === 2 && capa.from[0].kills === 3,
    'dos constan de Dread, de las 3 veces que ha caído él',
    `${capa.from[0]?.n} de ${capa.from[0]?.kills}`);
  ok(capa.sinFuente === 1, 'y la tercera se dice que no tiene fuente', capa.sinFuente);

  const idolo = enc.lootList().find((o) => o.item === 'Shiny Brass Idol');
  ok(idolo && idolo.from.length === 0 && idolo.sinFuente === 1,
    'un objeto que nunca se atribuyó a nadie sigue estando en la lista');
  ok(!enc.foe('Dread').lootList.some((l) => l.item === 'Shiny Brass Idol'),
    'pero no se le cuelga a un enemigo del que no consta que sea suyo');
  ok(enc.counts().botin.objetos === 2,
    'el recuento de la portada cuenta los dos objetos', enc.counts().botin.objetos);
}

console.log('\nla progresión sólo compara lo comparable');
{
  const store = new FightStore(nuevaCarpeta(), 'Campeon');
  store.load();
  const mia = (i, foes, mio, dur, lvl, diff) => {
    const f = pelea(i, { ...FEAR4, foe: foes[0], vida: mio, diff });
    f.duration = dur; f.level = lvl;
    f.rows[0].damage = mio;
    f.rows[0].targets = foes.map((x) => ({ name: x, sum: Math.round(mio / foes.length) }));
    // Varios enemigos en la misma pelea: se añaden como filas enemigas.
    for (const extra of foes.slice(1)) {
      f.rows.push({ ...f.rows[1], name: extra, abilities: [] });
    }
    return f;
  };
  // Seis contra Dread al nivel 50 en D4, una corta, y una contra dos a la vez.
  for (let i = 0; i < 6; i++) store.append(mia(i, ['Dread'], 30000 + i * 2000, 60, 50, 4), 1_700_000_000_000 + i * 60_000);
  store.append(mia(90, ['Dread'], 9000, 12, 50, 4), 1_700_000_900_000);
  store.append(mia(91, ['Dread', 'Terror'], 50000, 90, 50, 4), 1_700_000_960_000);
  const enc = new Encyclopedia(store); enc.load();
  const p = enc.progress();

  ok(p.fights === 7, 'la pelea de 12 segundos no cuenta: no mide tu ritmo, mide un pico', p.fights);
  const dread = p.marcas.find((m) => m.name === 'Dread');
  ok(dread.n === 6,
    'la pelea contra dos enemigos queda fuera del reparto por enemigo', dread.n);
  ok(!p.marcas.some((m) => m.name === 'Terror'),
    'y no se le atribuye a ninguno de los dos');
  ok(dread.serie && dread.serie.length === 6,
    'con seis peleas de la misma terna sí se dibuja la línea', dread.serie?.length);
  ok(dread.serie[0].at < dread.serie.at(-1).at, 'y va en orden de cuándo pasaron');

  // Con pocas, no se dibuja: tres puntos no son una tendencia.
  const s2 = new FightStore(nuevaCarpeta(), 'Campeon'); s2.load();
  for (let i = 0; i < 3; i++) s2.append(mia(i, ['Terror'], 30000, 60, 50, 4), 1_700_000_000_000 + i * 60_000);
  const p2 = new Encyclopedia(s2); p2.load();
  ok(p2.progress().marcas[0].serie === null,
    'con tres peleas no se dibuja línea ninguna', String(p2.progress().marcas[0].serie));

  // Sin saber quién eres, tu daño no consta y se dice en vez de suponer un cero.
  const s3 = new FightStore(nuevaCarpeta());   // sin `self`
  s3.load();
  s3.append(mia(1, ['Dread'], 30000, 60, 50, 4), 1_700_000_000_000);
  const p3 = new Encyclopedia(s3); p3.load();
  ok(p3.progress().fights === 0 && p3.progress().sinDato === 1,
    'una pelea sin tu daño anotado no entra, y se cuenta aparte');
}

console.log('\nlas muertes dicen quién te pegó más, no quién te mató');
{
  const store = new FightStore(nuevaCarpeta(), 'Campeon');
  store.load();
  const conMuerte = (i, veces) => {
    const f = pelea(i, { ...FEAR4, foe: 'Dread', vida: 40000 });
    f.losses = Array(veces).fill('Campeon');
    f.rows[0].taken = 12000;
    f.rows[0].takenBySource = [{ name: 'Dread', sum: 9000 }, { name: 'a fear guardian', sum: 3000 }];
    return f;
  };
  store.append(conMuerte(1, 1), 1_700_000_000_000);
  store.append(conMuerte(2, 2), 1_700_000_060_000);
  store.append(pelea(3, { ...FEAR4, foe: 'Dread', vida: 40000 }), 1_700_000_120_000);
  const enc = new Encyclopedia(store); enc.load();
  const d = enc.deaths('Campeon');

  ok(d.total === 3, 'morir dos veces en una pelea son dos', d.total);
  ok(d.muertes.length === 2, 'pero son dos peleas', d.muertes.length);
  ok(d.muertes[0].masDaño.name === 'Dread' && Math.round(d.muertes[0].masDaño.share * 100) === 75,
    'y se dice quién te hizo más daño, con cuánto del total',
    `${d.muertes[0].masDaño.name} ${Math.round(d.muertes[0].masDaño.share * 100)}%`);
  ok(d.porZona[0].k === 'Plane of Fear · D4', 'agrupadas por zona y dificultad', d.porZona[0].k);
  ok(enc.deaths(null).muertes.length === 0,
    'sin saber quién eres no se inventa ninguna muerte');
}

console.log('\nlos combates contra un enemigo se separan por dificultad');
{
  const store = almacenLleno();
  ok(store.filter({ foeExact: 'Dread' }).length === 3, 'los tres contra Dread');
  ok(store.filter({ foeExact: 'Dread', zoneBase: 'Plane of Fear', diff: 4 }).length === 2,
    'los dos de Plane of Fear en D4');
  ok(store.filter({ foeExact: 'a skeleton', diff: null }).length === 1,
    '«sin marca» es una dificultad y se puede pedir');
  ok(store.filter({ foeExact: 'a fear' }).length === 0,
    'el nombre exacto no es «contiene»: «a fear» no trae a «a fear guardian»');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} comprobaciones MAL\n` : '\ntodo correcto\n');
process.exit(failed ? 1 : 0);
