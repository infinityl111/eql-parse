/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL CONTRASTE, QUE EL DETECTOR DE COLORES NO VE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `test/colores.js` caza los colores que **no salen de la paleta**. Pero un
 * color que sí sale de una variable puede quedar igual de ilegible si la
 * variable elegida es la equivocada: `--bone-faint` sobre `--slate-800` es del
 * tema, y en claro se queda en 2,1:1.
 *
 *     QUE UN COLOR VENGA DE LA PALETA NO DICE QUE SE LEA.
 *
 * ── QUÉ SE MIDE Y CONTRA QUÉ ──────────────────────────────────────────────
 *
 * Cada variable de tinta contra cada variable de superficie, **en los dos
 * temas**, con la fórmula de contraste de WCAG. El umbral es 4,5:1 para texto
 * normal y 3:1 para texto grande o elementos de interfaz.
 *
 * No se empareja por reglas del CSS: emparejar tinta y fondo leyendo selectores
 * exige resolver la cascada, y eso es un navegador. Lo que se mide es la
 * PALETA, que es donde se decide: si un par tinta/superficie no llega, cualquier
 * regla que los junte queda ilegible, y ninguna regla puede arreglarlo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(DIR, '..', 'ui', 'styles.css'), 'utf8');

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

/** Los dos bloques de paleta, por su selector. */
function paleta(sel) {
  const i = fuente.indexOf(sel);
  if (i < 0) return {};
  const j = fuente.indexOf('}', i);
  const out = {};
  for (const m of fuente.slice(i, j).matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}
const OSCURO = paleta(':root {');
const CLARO = { ...OSCURO, ...paleta(':root[data-theme="light"] {') };

const rgb = (h) => {
  let s = h.slice(1);
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Superficies sobre las que de verdad se pinta texto. */
const FONDOS = ['--slate-900', '--slate-850', '--slate-800', '--slate-700'];
/** Tintas: todo lo que la paleta declara como color de texto o de dato. */
const TINTAS = ['--bone', '--bone-dim', '--bone-faint',
  '--t-magic', '--t-cold', '--t-fire', '--t-poison', '--t-disease',
  '--t-melee', '--t-ds', '--t-dot', '--t-spell', '--t-other',
  '--pz-tuyo', '--pz-zona', '--pz-visto'];

const UMBRAL = 4.5;      // WCAG AA, texto normal
const GRANDE = 3.0;      // texto grande y elementos de interfaz

/**
 * LA DEUDA DE CONTRASTE, declarada par a par y no como un total.
 *
 * `--t-other` es el peor de todos —hasta 1,95:1 en oscuro— y `--bone-faint`
 * sobre las superficies claras no llega en ninguno de los dos temas. Se
 * congelan aqui con nombre y apellidos: si aparece uno que no este en esta
 * lista, salta, aunque el recuento no suba.
 *
 * Se quitan de aqui segun se arreglen. No se anaden.
 */
const CONOCIDOS = new Set([
  'TEMA OSCURO|--bone-faint|--slate-800', 'TEMA OSCURO|--bone-faint|--slate-700',
  'TEMA OSCURO|--t-ds|--slate-700',
  'TEMA OSCURO|--t-other|--slate-900', 'TEMA OSCURO|--t-other|--slate-850',
  'TEMA OSCURO|--t-other|--slate-800', 'TEMA OSCURO|--t-other|--slate-700',
  'TEMA CLARO|--bone-faint|--slate-800', 'TEMA CLARO|--bone-faint|--slate-700',
  'TEMA CLARO|--t-fire|--slate-700',
  'TEMA CLARO|--t-other|--slate-800', 'TEMA CLARO|--t-other|--slate-700',
]);

function mide(rot, P) {
  const flojos = [];
  for (const t of TINTAS) {
    for (const f of FONDOS) {
      if (!P[t] || !P[f]) continue;
      const c = contraste(P[t], P[f]);
      if (c < UMBRAL) flojos.push({ t, f, c, grave: c < GRANDE });
    }
  }
  console.log(`\n${rot}`);
  /**
   * TRINQUETE, y aqui ademas NOMINAL: no basta con que no crezca el numero,
   * es que no puede aparecer un par que no este en la lista. Un par que sale
   * y otro que entra dejarian el recuento igual y la pantalla peor.
   */
  const graves = flojos.filter((x) => x.grave);
  const nuevos = graves.filter((x) => !CONOCIDOS.has(`${rot}|${x.t}|${x.f}`));
  ok(nuevos.length === 0, `${nuevos.length} pares NUEVOS por debajo de ${GRANDE}:1`,
    nuevos.length ? nuevos.map((x) => `${x.t} sobre ${x.f}`).join(', ')
      : `${graves.length} conocidos y declarados, de ${TINTAS.length * FONDOS.length} pares`);
  for (const x of graves.slice(0, 14)) {
    console.log(`       ${x.t.padEnd(14)} sobre ${x.f.padEnd(13)} ${x.c.toFixed(2)}:1`);
  }
  const medios = flojos.filter((x) => !x.grave);
  console.log(`       y ${medios.length} entre ${GRANDE}:1 y ${UMBRAL}:1 — valen para texto grande, no para el cuerpo`);
  for (const x of medios.slice(0, 8)) {
    console.log(`         ${x.t.padEnd(14)} sobre ${x.f.padEnd(13)} ${x.c.toFixed(2)}:1`);
  }
  return flojos;
}

console.log('\nlas dos paletas existen y se han leído');
ok(Object.keys(OSCURO).length > 15, `paleta oscura: ${Object.keys(OSCURO).length} variables`);
ok(Object.keys(paleta(':root[data-theme="light"] {')).length > 10,
  `paleta clara: ${Object.keys(paleta(':root[data-theme="light"] {')).length} redefinidas`);

mide('TEMA OSCURO', OSCURO);
mide('TEMA CLARO', CLARO);

console.log('\nCONTROL: la fórmula da lo que tiene que dar');
ok(Math.abs(contraste('#000000', '#ffffff') - 21) < 0.01, 'negro sobre blanco = 21:1');
ok(Math.abs(contraste('#777777', '#ffffff') - 4.48) < 0.05, 'gris medio sobre blanco = 4,48:1',
  'el caso de referencia de WCAG, justo por debajo del umbral');
ok(contraste('#ffffff', '#ffffff') === 1, 'y un color contra sí mismo = 1:1');

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
