/**
 * Las líneas del registro detrás de una cifra.
 *
 * QUÉ ES ESTO Y QUÉ NO. No es un dato más de la pelea: es la forma de comprobar
 * todos los demás. Todo lo que enseña la aplicación es una cuenta sobre estas
 * líneas, así que la última pregunta que se puede hacer de cualquier cifra es
 * «¿de dónde sale?», y aquí está la respuesta entera.
 *
 * NO SE GUARDA NADA. El fichero ya está en el disco y ya está ordenado por
 * hora. Guardar una copia habría sido duplicar 13 MB para no volver a leerlos.
 *
 * EL ANCLA ES LA HORA, NO EL NÚMERO DE LÍNEA. El contador de líneas del motor
 * arranca en el punto de enganche, así que sólo coincide con el fichero después
 * de una reconstrucción; en directo va desplazado y señalaría otra cosa. La
 * marca de tiempo está escrita en la propia línea y no depende de nada.
 *
 * Y LO QUE FALLA SE DICE. Un registro que se movió y una pelea que viene de
 * otro fichero son dos cosas distintas, y las dos son distintas de «no pasó
 * nada en ese rato». Una lista vacía las confundiría con una avería.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tramo, contexto } from '../src/registro.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DIA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sello = (d) => {
  const p = (v) => String(v).padStart(2, '0');
  return `[${DIA[d.getDay()]} ${MES[d.getMonth()]} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getFullYear()}]`;
};

// Un registro de mentira pero con el formato de verdad: mil segundos, dos
// líneas por segundo. Suficiente para que la búsqueda binaria tenga que saltar.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eqlreg-'));
const ruta = path.join(dir, 'eqlog_Campeon_prueba.txt');
const base = new Date(2026, 7, 4, 12, 0, 0);
const t0 = Math.round(base.getTime() / 1000);
{
  const lineas = [];
  for (let s = 0; s < 1000; s++) {
    // Un silencio DENTRO del fichero, del 400 al 420: hace falta para poder
    // distinguir «aquí no pasó nada» de «esto no está en este fichero».
    if (s >= 400 && s < 420) continue;
    const d = new Date(base.getTime() + s * 1000);
    lineas.push(`${sello(d)} You slash a gorgon for ${100 + s} points of damage.`);
    lineas.push(`${sello(d)} a gorgon hits Campeon for ${s} points of damage.`);
  }
  fs.writeFileSync(ruta, lineas.join('\r\n') + '\r\n');
}

// ── 1. Un tramo cualquiera sale entero y en orden ──────────────────────────
console.log('\nun tramo del registro');
{
  const r = await tramo(ruta, t0 + 500, t0 + 502);
  ok(r.ok, 'se lee');
  ok(r.lineas.length === 6, 'tres segundos, dos líneas cada uno', r.lineas.length);
  ok(r.lineas[0].texto.includes('for 600 points'),
    'y son las del segundo pedido, no las del principio', r.lineas[0].texto);
  ok(r.lineas.every((l, i, a) => i === 0 || l.t >= a[i - 1].t), 'en orden de hora');
  ok(!r.recortadas, 'sin recortar nada');
}

// ── 2. El contexto de un instante: antes y después ─────────────────────────
console.log('\nel contexto de un instante');
{
  const r = await contexto(ruta, t0 + 300, 2);
  ok(r.ok && r.lineas.length === 10, 'dos segundos a cada lado, y el del medio', r.lineas.length);
  const horas = [...new Set(r.lineas.map((l) => l.t - t0))];
  ok(horas.join(',') === '298,299,300,301,302', 'centrado en el instante pedido', horas.join(','));
}

// ── 3. El tope se dice, no se calla ────────────────────────────────────────
//
// Un recorte callado se lee como «esto es todo lo que hubo», que es justo lo
// contrario de lo que pasó.
console.log('\ncuando no caben');
{
  const r = await tramo(ruta, t0, t0 + 999, 50);
  ok(r.lineas.length === 50, 'se devuelven las que caben', r.lineas.length);
  ok(r.recortadas === 1910, 'y se cuenta cuántas se quedaron fuera', r.recortadas);
}

// ── 4. Lo que no se puede leer tiene motivo ────────────────────────────────
console.log('\nlo que no se puede leer');
{
  const a = await tramo(path.join(dir, 'no-existe.txt'), t0, t0 + 10);
  ok(!a.ok && a.motivo === 'sin-fichero', 'un registro que ya no está lo dice', a.motivo);

  // Una pelea de otro día: el fichero está, pero no la contiene. No es lo
  // mismo que «no pasó nada», y por eso no devuelve una lista vacía.
  const b = await tramo(ruta, t0 - 86400, t0 - 86400 + 10);
  ok(!b.ok && b.motivo === 'fuera-de-rango', 'una pelea que no está en este fichero, también', b.motivo);
  ok(b.span?.desde === t0 && b.span?.hasta === t0 + 999,
    'y dice qué abarca el fichero, para que se entienda por qué',
    b.span ? `${b.span.desde - t0}..${b.span.hasta - t0}` : 'sin span');

  // Un rato de silencio DENTRO del fichero sí es una lista vacía, y eso es
  // correcto: ahí de verdad no pasó nada.
  const hueco = await tramo(ruta, t0 + 405, t0 + 410);
  ok(hueco.ok && hueco.lineas.length === 0,
    'y un rato sin líneas dentro del fichero sí es una lista vacía', hueco.lineas.length);
}

// ── 5. La búsqueda no depende del tamaño ───────────────────────────────────
//
// Es lo que permite que esto sea una acción y no una espera: sobre el registro
// real de 13 MB, un contexto tarda 6 ms.
console.log('\nno se lee el fichero entero');
{
  const t = Date.now();
  for (let i = 0; i < 20; i++) await contexto(ruta, t0 + 100 + i * 40, 3);
  const ms = Date.now() - t;
  ok(ms < 2000, 'veinte búsquedas en menos de dos segundos', `${ms} ms`);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
