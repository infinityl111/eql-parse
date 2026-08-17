#!/usr/bin/env node
/**
 * El reproductor sin ventana: recorre el registro repartiendo las líneas por la
 * ventana de cada pelea, llama a `guion()` con exactamente lo que le llega en
 * la aplicación y devuelve la escena. `guion()` es puro, así que no hace falta
 * navegador.
 *
 * NO HAY CONVENCIÓN A LA QUE MIRAR: una reproducción no tiene salida esperada
 * como la tiene un dps, así que aquí la vigilancia hay que fabricarla entera.
 *
 *     npm run reproductor                    -- el resumen
 *     npm run reproductor -- --detalle 20    -- las 20 primeras escenas
 *     npm run reproductor -- --json salida.json
 *
 * Las comprobaciones sobre esta salida están en `bin/imposibles.js --log`.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { Parser, parseHeader } from '../src/parser.js';
import { guion } from '../src/guion.js';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CANDIDATOS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
];

/**
 * Recorre las peleas del almacén y devuelve la escena de cada una.
 *
 * @param {object} opts
 * @param {string} opts.dir      carpeta del almacén
 * @param {string} opts.logPath  registro
 * @param {string} opts.self
 * @param {(escena) => void} opts.cada  se llama con cada escena, según sale
 */
export async function reproducirTodo({ dir, logPath, self = null, cada } = {}) {
  const peleas = [];
  {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'fights.ndjson')), crlfDelay: Infinity });
    for await (const l of rl) {
      if (!l.trim()) continue;
      let f; try { f = JSON.parse(l); } catch { continue; }
      if (!Array.isArray(f.rows) || !f.rows.length) continue;
      f._ini = f.at ? Math.round(f.at / 1000) : Math.round(f.start ?? 0);
      f._fin = f._ini + Math.max(1, Math.round(f.duration ?? 0));
      f._lineas = null;
      peleas.push(f);
    }
  }
  peleas.sort((a, b) => a._ini - b._ini);

  let hechas = 0;
  const suelta = (f) => {
    // EXACTAMENTE LO QUE RECIBE LA APLICACIÓN: `ui/app.js` pide
    // `logContext(desde, desde + duration)` y se lo pasa a `guion` con el
    // `Parser` inyectado. Si esto se desvía, deja de vigilar lo que se usa.
    const g = guion(f, f._lineas ?? [], Parser, self);
    f._lineas = null;
    hechas++;
    cada?.({ pelea: f, escena: g });
  };

  const rl = readline.createInterface({ input: fs.createReadStream(logPath), crlfDelay: Infinity });
  let i = 0;
  const activas = [];
  for await (const raw of rl) {
    const h = parseHeader(raw.replace(/\r$/, ''));
    if (!h) continue;
    const t = h.t;
    while (i < peleas.length && peleas[i]._ini <= t) { peleas[i]._lineas = []; activas.push(peleas[i]); i++; }
    for (let k = activas.length - 1; k >= 0; k--) {
      const f = activas[k];
      if (t > f._fin) { suelta(f); activas.splice(k, 1); continue; }
      if (t >= f._ini) f._lineas.push({ t, texto: h.body });
    }
  }
  for (const f of activas) suelta(f);
  return { peleas: peleas.length, reproducidas: hechas };
}

// ── Cuando se ejecuta directamente ────────────────────────────────────────
//
// Y NO CUANDO ALGUIEN LO IMPORTA. `bin/imposibles.js` importa `reproducirTodo`,
// y la guarda de «los módulos no hacen nada al importarse» lo importa también
// sin argumentos: mirar `process.argv[1]` sin comprobarlo reventaba ahí.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('bin/reproductor.js')) {
  const dir = flag('--dir') ?? CANDIDATOS.find((d) => fs.existsSync(path.join(d, 'fights.ndjson')));
  if (!dir) { console.error('No encuentro el almacén. Pásalo con --dir'); process.exit(1); }
  let logPath = flag('--log');
  if (!logPath) {
    try { logPath = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'resume.json'), 'utf8')))[0] ?? null; }
    catch { /* sin reanudación */ }
  }
  if (!logPath || !fs.existsSync(logPath)) { console.error('No encuentro el registro. Pásalo con --log'); process.exit(1); }
  const self = flag('--self') ?? 'Campeon';
  const detalle = +(flag('--detalle') ?? 0);
  const json = flag('--json');

  const t0 = Date.now();
  let sucesos = 0, figuras = 0, actores = 0, conAjenos = 0, vistas = 0;
  const salida = [];
  const res = await reproducirTodo({
    dir,
    logPath,
    self,
    cada: ({ pelea, escena }) => {
      sucesos += escena.sucesos;
      actores += escena.actores.length;
      figuras += escena.actores.reduce((a, x) => a + (x.figuras ?? 1), 0);
      const reparto = new Set(pelea.rows.map((r) => r.name));
      if (escena.actores.some((a) => !reparto.has(a.nombre))) conAjenos++;
      if (json) {
        salida.push({
          at: pelea._ini, duracion: escena.duracion, sucesos: escena.sucesos,
          actores: escena.actores.map((a) => ({ nombre: a.nombre, figuras: a.figuras, desde: a.desde, caidas: a.caidas, lado: a.lado })),
        });
      }
      if (vistas < detalle) {
        vistas++;
        console.log(`\n  ${new Date(pelea._ini * 1000).toLocaleString('es-ES')} · ${escena.duracion} s · ${escena.sucesos} sucesos`);
        for (const a of escena.actores) {
          console.log(`     ${a.nombre.padEnd(26)} ×${a.figuras}  entra ${a.desde ?? '—'}  cae ${(a.caidas ?? []).join(', ') || '—'}`);
        }
      }
    },
  });

  console.log(`\n  almacén        ${dir}`);
  console.log(`  registro       ${logPath}`);
  console.log(`  peleas         ${res.reproducidas.toLocaleString('es-ES')} de ${res.peleas.toLocaleString('es-ES')}`);
  console.log(`  sucesos        ${sucesos.toLocaleString('es-ES')}`);
  console.log(`  actores        ${actores.toLocaleString('es-ES')}  ·  figuras ${figuras.toLocaleString('es-ES')}`);
  console.log(`  con ajenos     ${conAjenos} (${(100 * conAjenos / Math.max(1, res.reproducidas)).toFixed(1)} %)`);
  console.log(`  ha tardado     ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  if (json) { fs.writeFileSync(json, JSON.stringify(salida)); console.log(`  escenas escritas en ${json}\n`); }
}
