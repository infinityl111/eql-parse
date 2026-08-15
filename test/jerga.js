/**
 * EL VOCABULARIO DEL JUEGO, IGUAL EN LOS CINCO IDIOMAS.
 *
 * La política está en `src/jerga.js`: los términos que EverQuest escribe en su
 * registro no se traducen; el resto de la interfaz sí. Lo que esta batería
 * guarda no es la política —eso es una decisión— sino que se cumple SOLA:
 *
 *   1. que los cinco diccionarios devuelven exactamente la misma cadena, que es
 *      lo que impide que dentro de tres meses alguien traduzca «feared» en
 *      francés porque le chirría y nadie se entere;
 *   2. que los rótulos de jerga salen de `JERGA` y no escritos a mano, porque
 *      escritos a mano se puede tocar uno solo;
 *   3. y que no entra en la lista ningún término que la aplicación no pueda
 *      producir — la familia muerta de siempre, aplicada al vocabulario.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t, TRANSLATED } from '../src/i18n.js';
import { JERGA, FUERA } from '../src/jerga.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las claves que llevan jerga, con el término que les toca.
const CON_JERGA = {
  'rp.est.stun': JERGA.stunned,
  'rp.estado.stun': JERGA.stunned,
  'rp.est.charmOn': JERGA.charmed,
  'rp.est.charmOff': JERGA.charmBroken,
  'row.charmed': JERGA.charmed,
  'cat.fear': JERGA.fear,
  'rp.est.resist': JERGA.resisted,
  'rp.estado.resist': JERGA.resisted,
  'rp.estado.resist_by_you': JERGA.resist,
  'rp.estado.proc': JERGA.proc,
};

console.log('\nlos cinco idiomas dicen exactamente lo mismo');
{
  const rotas = [];
  for (const [clave, esperado] of Object.entries(CON_JERGA)) {
    const vistos = TRANSLATED.map((l) => { setLang(l); return t(clave); });
    setLang('es');
    if (new Set(vistos).size !== 1) rotas.push(`${clave}: ${vistos.join(' / ')}`);
    else if (vistos[0] !== esperado) rotas.push(`${clave}: dice «${vistos[0]}» y la jerga dice «${esperado}»`);
  }
  ok(rotas.length === 0, `los ${Object.keys(CON_JERGA).length} rótulos de jerga coinciden en es/en/fr/de/pt`,
    rotas.length ? rotas.join(' · ') : 'ninguno se ha desviado');
}

console.log('\nsalen de la fuente única, no escritos a mano');
{
  // Si alguien sustituye `${JERGA.stunned}` por «stunned» a pelo, los cinco
  // siguen coincidiendo y la comprobación de arriba pasa — pero ya se puede
  // tocar uno solo. Esto mira el fuente, que es donde se ve la diferencia.
  const src = fs.readFileSync(path.join(RAIZ, 'src', 'i18n.js'), 'utf8');
  ok(src.includes("import { JERGA }"), 'i18n.js referencia la fuente única');
  const sueltos = Object.entries(CON_JERGA)
    .filter(([clave]) => {
      const re = new RegExp(`'${clave.replace(/\./g, '\\.')}':\\s*'`, 'g');
      return re.test(src);
    })
    .map(([k]) => k);
  ok(sueltos.length === 0, 'ningún rótulo de jerga está escrito a mano en un diccionario',
    sueltos.length ? sueltos.join(', ') : 'los diez salen de JERGA');
}

console.log('\nnada entra si la aplicación no puede producirlo');
{
  // `rooted` es el caso: el estado se mide —612 aperturas y 765 cierres sobre
  // ti— pero la pista no lo pinta por decisión escrita, así que el rótulo no
  // puede aparecer nunca. Entra el día que lo pinte, no antes.
  ok(!Object.values(JERGA).includes('rooted'), '`rooted` NO está en la jerga');
  ok(FUERA.includes('rooted'), 'y está en la lista de exclusiones, con su motivo');

  const rep = fs.readFileSync(path.join(RAIZ, 'ui', 'reproduccion.js'), 'utf8');
  const pinta = /\[\s*'root'\s*,/.test(rep.slice(rep.indexOf('export const PISTA'), rep.indexOf('export const PISTA') + 900));
  ok(!pinta, 'la pista sigue sin pintar la raíz: la exclusión sigue siendo cierta');
  // El día que alguien añada 'root' a PISTA, esta línea se pone roja y le
  // recuerda que entonces SÍ toca meter `rooted` en la jerga.
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
