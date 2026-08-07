/**
 * El libro de hechizos: lo que consta que tienes, contra lo que usas.
 *
 * La tabla de hechizos mide lo lanzado. Esto mide lo contrario, y es un dato
 * que ninguna tabla de uso puede dar: un hechizo ausente puede ser que no lo
 * tengas o que lo tengas parado, y son cosas muy distintas. El registro sabe
 * separarlas porque escribir, memorizar y comprar dejan línea.
 *
 * SALE DEL REGISTRO Y DE NINGÚN FICHERO. El juego exporta el libro con
 * «/output spellbook», pero antes de construir un importador había que mirar
 * si el registro ya lo daba: lo da. Sobre el histórico de referencia son 84
 * hechizos —22 escritos, 62 memorizados, 23 comprados— y 40 que nunca se
 * lanzan. Quien no exporte nada tiene la sección completa.
 *
 * TRES COSAS SE ROMPIERON CONSTRUYÉNDOLO y las tres tienen su prueba abajo:
 *
 *   1. «You purchased 1 Spell: X from Y for Z» no lo cogía ningún patrón.
 *      Veintitrés compras que el registro daba y la aplicación tiraba.
 *
 *   2. Lo lanzado se leía de las peleas guardadas. Un hechizo usado fuera de
 *      combate —un buff antes de entrar— o en una pelea que no llegó a
 *      guardarse salía como «nunca lanzado», que es decirle a alguien que
 *      tiene algo parado cuando lo usa. Medido: 59 sin usar leyendo peleas
 *      contra 40 leyendo el registro. Diecinueve acusaciones falsas.
 *
 *   3. El respaldo por daño metía «bash», «punch», «slash», «flames»,
 *      «thorns» y «reave» en la lista. Las habilidades de una fila son tipos
 *      de golpe, no conjuros.
 *
 * Y LO QUE NO CONSTA SE ENSEÑA. Diecinueve hechizos se lanzan sin que el
 * registro diga de dónde salieron: son de antes de que empezara, y en esta
 * partida también de clases anteriores —hay portales de druida y formas de
 * mago en el historial de un caballero de la muerte, todos con su «You begin
 * casting» delante—. Darlos por 84 como si fuera el libro entero sería mentir
 * por omisión.
 */
import { Parser } from '../src/parser.js';
import { spellbook } from '../src/catalog.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const parseLine = (cuerpo) => new Parser({ self: 'Campeon' }).parse(`[Tue Aug 04 12:50:13 2026] ${cuerpo}`);

// ── 1. La compra de un hechizo deja de ser una línea perdida ───────────────
console.log('\ncomprar un hechizo');
{
  const ev = parseLine('You purchased 1 Spell: Shadow Vortex from Aleri Onaria for 3 gold 2 silver.');
  ok(ev?.kind === 'spell_buy', 'la línea se reconoce', ev?.kind);
  ok(ev?.ability === 'Shadow Vortex', 'y saca el nombre sin el «Spell:» delante', ev?.ability);
  ok(ev?.from === 'Aleri Onaria', 'y de quién', ev?.from);

  // Comprar vendas no llena el libro de hechizos.
  const otro = parseLine('You purchased 4 Bandages from Aleri Onaria for 1 silver.');
  ok(otro?.kind !== 'spell_buy', 'comprar otra cosa no entra en el libro', otro?.kind);
}

// El almacén de mentira: sólo lo que spellbook() mira.
const almacen = (libro) => ({ spellbook: libro });

// ── 2. Contar lo que consta, y separar lo parado ───────────────────────────
console.log('\nlo que consta y lo que se usa');
{
  const b = spellbook(almacen([
    { name: 'Shadow Vortex', via: 'comprado', at: 100 },
    { name: 'Shadow Vortex', via: 'escrito', at: 200 },
    { name: 'Clinging Darkness', via: 'memorizado', at: 300 },
  ]), [{ at: 1000, casts: [{ source: 'Campeon', ability: 'Shadow Vortex', t: 1 }] }], 'Campeon');

  ok(b.known === 2, 'dos hechizos, no tres: comprarlo y escribirlo es el mismo', b.known);
  ok(b.unused === 1, 'y uno de los dos no se lanza nunca', b.unused);

  const sv = b.spells.find((x) => x.name === 'Shadow Vortex');
  ok([...sv.vias].sort().join(',') === 'comprado,escrito',
    'las dos procedencias se enseñan: valen cosas distintas', sv.vias.join(','));
  ok(sv.at === 100, 'y la fecha es la de la primera constancia', sv.at);
  ok(sv.used === true, 'lanzado en una pelea guardada cuenta como usado');
  ok(b.spells.find((x) => x.name === 'Clinging Darkness').used === false,
    'y el que no aparece en ninguna, no');
}

// ── 3. Lanzado fuera de combate SIGUE siendo lanzado ───────────────────────
console.log('\nlanzado fuera de una pelea guardada');
{
  const b = spellbook(almacen([
    { name: 'Chloroplast', via: 'memorizado', at: 100 },
    { name: 'Chloroplast', via: 'lanzado', at: 900 },
  ]), [], 'Campeon');
  ok(b.known === 1, 'consta que lo tienes', b.known);
  ok(b.unused === 0,
    'y NO sale como parado: el registro lo vio aunque ninguna pelea lo guardara', b.unused);
  ok(b.spells[0].vias.join(',') === 'memorizado',
    '«lanzado» no es una procedencia del libro y no se cuela entre ellas', b.spells[0].vias.join(','));
}

// ── 4. Un golpe cuerpo a cuerpo no es un hechizo ───────────────────────────
console.log('\nlo que no es un hechizo');
{
  const b = spellbook(almacen([{ name: 'Shadow Vortex', via: 'escrito', at: 100 }]), [{
    at: 1000,
    casts: [],
    rows: [{ name: 'Campeon', abilities: [{ name: 'bash', n: 12 }, { name: 'slash', n: 40 }] }],
  }], 'Campeon');
  ok(b.sinConstancia.length === 0,
    '«bash» y «slash» no son hechizos lanzados sin constancia', b.sinConstancia.join(' '));
  ok(b.known === 1, 'ni entran en el libro', b.known);
}

// ── 5. Lo que no consta se enseña, no se esconde ───────────────────────────
console.log('\nlo lanzado sin constancia');
{
  const b = spellbook(almacen([
    { name: 'Shadow Vortex', via: 'escrito', at: 100 },
    { name: 'Harm Touch V', via: 'lanzado', at: 500 },
  ]), [{ at: 1000, casts: [{ source: 'Campeon', ability: 'Earthquake', t: 1 }] }], 'Campeon');

  ok(b.sinConstancia.join(',') === 'Earthquake,Harm Touch V',
    'los dos caminos cuentan: el registro entero y las peleas', b.sinConstancia.join(','));
  ok(b.known === 1, 'y ninguno se cuela en el libro como si constara', b.known);
}

// ── 6. Lo de otro no es tuyo ───────────────────────────────────────────────
console.log('\nde quién es cada casteo');
{
  const b = spellbook(almacen([{ name: 'Superior Healing', via: 'memorizado', at: 100 }]),
    [{ at: 1000, casts: [{ source: 'Gorak', ability: 'Superior Healing', t: 1 }] }], 'Campeon');
  ok(b.unused === 1, 'que lo lance otro no cuenta como que lo usas tú', b.unused);

  const vacio = spellbook(null, [], 'Campeon');
  ok(vacio.known === 0 && vacio.sinConstancia.length === 0, 'y sin almacén no revienta');
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
