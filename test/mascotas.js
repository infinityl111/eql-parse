/**
 * Mascotas y compañeros: que nada se asigne solo sin poder deshacerlo.
 *
 * Los dos fallos de fondo que hay aquí son de la misma familia — una decisión
 * que el programa toma o guarda y que el usuario no puede revertir:
 *
 *   1. Marcar una mascota como tuya hacía desaparecer los controles de su fila,
 *      así que la decisión sólo se deshacía editando `config.json` a mano. Y no
 *      persistía: había DOS puertas para lo mismo, una que avisaba al analizador
 *      sin guardar y otra que guardaba sin avisar y que no llamaba nadie.
 *
 *   2. La detección pisaba lo declarado: invocar otra mascota retiraba en
 *      silencio la que tú habías marcado.
 *
 * Y la señal de grupo, que se dio por inexistente durante meses estando en el
 * chat: quien habla por el canal `group` está en tu grupo. Medido sobre un
 * registro real, los emisores de ese canal son exactamente los compañeros
 * declarados a mano, sin un solo falso positivo.
 */
import { Parser } from '../src/parser.js';
import { EncounterTracker } from '../src/encounter.js';
import { FightStore } from '../src/store.js';
import { Encyclopedia } from '../src/encyclopedia.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const linea = (i, cuerpo) => `[Tue Aug 04 12:37:${String(10 + i).padStart(2, '0')} 2026] ${cuerpo}`;

// ── 1. Marcar es reversible, y lo dicho a mano manda ───────────────────────
console.log('\nmarcar una mascota se puede deshacer');
{
  const p = new Parser({ self: 'Campeon' });
  p.markPet('Veker');
  ok(p.pets.has('Veker'), 'marcada');
  ok(p.manualPets.has('Veker'), 'y consta que la marcaste tú');
  p.unmarkPet('Veker');
  ok(!p.pets.has('Veker'), 'desmarcada');
  ok(!p.manualPets.has('Veker'), 'y deja de constar como tuya');
  ok(p.currentPet === null, 'y no queda como «la de ahora»');
}

console.log('\nlo que dices a mano no lo deshace una detección');
{
  const p = new Parser({ self: 'Campeon' });
  p.markPet('Veker');
  // Llega el /pet who leader de otra invocación tuya.
  p.parse(linea(1, "Jobarn says, 'My leader is Campeon.'"));
  ok(p.pets.has('Jobarn'), 'la detectada entra');
  ok(p.pets.has('Veker'), 'y la que marcaste TÚ sigue estando');

  // Sin marca manual, la anterior sí se retira: sólo se tiene una a la vez.
  const q = new Parser({ self: 'Campeon' });
  q.parse(linea(1, "Kabarer says, 'My leader is Campeon.'"));
  q.parse(linea(2, "Jobarn says, 'My leader is Campeon.'"));
  ok(!q.pets.has('Kabarer') && q.pets.has('Jobarn'),
    'dos detectadas seguidas: la nueva retira a la vieja, como antes');
}

// ── 2. La señal de grupo, que estaba en el chat ────────────────────────────
console.log('\nquien habla por el canal de grupo está en tu grupo');
{
  const p = new Parser({ self: 'Campeon' });
  const ev = p.parse(linea(1, "Notarino tells the group, 'voy a por el de la izquierda'"));
  ok(ev?.kind === 'chat', 'la línea se lee como chat', ev?.kind);
  ok(ev?.channel === 'group', 'y el canal es «group»', ev?.channel);
  ok(ev?.from === 'Notarino', 'con su emisor', ev?.from);

  // El de gremio NO vale: un compañero de gremio no está en tu grupo.
  const g = p.parse(linea(2, "Notarino tells the guild, 'hola'"));
  ok(g?.channel === 'guild', 'el de gremio se distingue y no sirve', g?.channel);
}

// ── 3. Un compañero declarado NO convierte su pelea en la tuya ────────────
//
// Esta invariante está defendida en `test/combat.js` con estas palabras: «lo
// que no puede pasar bajo ningún concepto». Se comprueba también aquí, con el
// caso del botín delante, porque es justo donde da la tentación de romperla:
// cuando un compañero remata un cadáver que TÚ looteas, el objeto se queda sin
// pelea a la que ir. Se cuenta y se dice; no se inventa una pelea tuya.
const correr = (cuerpos, compas = [], store = null) => {
  const p = new Parser({ self: 'Campeon' });
  const tr = new EncounterTracker({ self: 'Campeon' });
  tr.setCompanions(compas);
  // El motor engancha esto igual: el botín sin pelea va derecho al almacén.
  if (store) {
    tr.on('orphanLoot', (e) => store.appendLoot({
      ...e, at: Math.round((e.t ?? 0) * 1000),
    }));
  }
  const cerradas = [];
  tr.on('close', (e) => cerradas.push(e));
  cuerpos.forEach((c, i) => { const ev = p.parse(linea(i, c), i); if (ev) tr.feed(ev); });
  return { tr, cerradas, abierta: tr.current };
};

console.log('\nla pelea de un compañero no se abre como tuya');
{
  const r = correr([
    'Notarino slashes an ice goblin runt for 45 points of damage.',
    'An ice goblin runt has been slain by Notarino!',
    "You looted a Raw-Hide Boots from an ice goblin runt's corpse and sold it for 6 gold.",
  ], ['Notarino']);
  ok(!r.abierta && !r.cerradas.length, 'aunque esté declarado, su pelea no es tuya');
  ok(r.tr.lootSinPelea === 1, 'y el botín de ese cadáver se cuenta como huérfano',
    r.tr.lootSinPelea);
}

// ── 4. Un compañero sigue sin ser tuyo dentro de TU pelea ─────────────────
console.log('\ndentro de tu pelea, su daño es suyo y el tuyo tuyo');
{
  const r = correr([
    'You hit a froglok for 50 points of magic damage by Lifedraw.',
    'Notarino slashes a froglok for 100 points of damage.',
  ], ['Notarino']);
  const filas = r.abierta.totals().rows;
  const yo = filas.find((x) => x.name === 'Campeon');
  const no = filas.find((x) => x.name === 'Notarino');
  ok(yo?.damage === 50, 'tu daño es el tuyo', yo?.damage);
  ok(no?.damage === 100, 'el suyo es el suyo, en su fila', no?.damage);
  ok(!r.tr.petNames.has('Notarino'), 'y no cuenta como mascota tuya');
}
// ── 5. El botín sin pelea existe, se guarda y sobrevive al disco ──────────
//
// La opción que NO se tomó fue dejar que un compañero abriera pelea: medida
// sobre un registro real, recupera 3 de 5 y abre la puerta a que su combate en
// la otra punta de la zona entre en tu histórico. Se tomó la que entiende el
// problema: recoger un objeto es un suceso TUYO y no de una pelea. La prueba de
// que estabas allí es que lo cogiste, no que él pegara.
console.log('\nel botín sin pelea se guarda por su cuenta');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eql-huerfano-'));
  const store = new FightStore(dir);
  store.load();

  const guion = [
    'Notarino slashes an ice goblin runt for 45 points of damage.',
    'An ice goblin runt has been slain by Notarino!',
    "You looted 2 Raw-Hide Boots from an ice goblin runt's corpse and sold it for 6 gold.",
  ];
  const r = correr(guion, ['Notarino'], store);
  ok(!r.abierta && !r.cerradas.length, 'la pelea sigue sin ser tuya');
  ok(store.orphanLoot.length === 1, 'y el objeto se guarda igual', store.orphanLoot.length);
  ok(store.orphanLoot[0].qty === 2, 'con su cantidad', store.orphanLoot[0].qty);
  ok(store.orphanLoot[0].from === 'an ice goblin runt', 'y de quién salió',
    store.orphanLoot[0].from);

  // Releer el registro no lo cuenta dos veces, igual que con las peleas.
  correr(guion, ['Notarino'], store);
  ok(store.orphanLoot.length === 1, 'releer el registro no lo duplica', store.orphanLoot.length);

  // Y vuelve del disco.
  const otro = new FightStore(dir);
  otro.load();
  ok(otro.orphanLoot.length === 1, 'vuelve del disco', otro.orphanLoot.length);

  // Llega a la sección de Botín, contado y dicho como lo que es.
  const enc = new Encyclopedia(otro);
  enc.load();
  const o = enc.lootList().find((x) => x.item === 'Raw-Hide Boots');
  ok(o?.n === 2, 'sus 2 unidades entran en el recuento de Botín', o?.n);
  ok(o?.sinPelea === 2, 'y constan como recogidas sin pelea', o?.sinPelea);
  ok(!enc.ledger.porNombre.has('an ice goblin runt'),
    'pero NO inventan una ficha del enemigo: no hay peleas con las que dividir');
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
