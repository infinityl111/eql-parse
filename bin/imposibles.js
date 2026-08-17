#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS IMPOSIBILIDADES: cosas que NO PUEDEN SER, sobre el dato real.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     TODA ETIQUETA QUE SIRVA PARA JUZGAR UN MECANISMO TIENE QUE PODER
 *     CONSTRUIRSE SIN ESE MECANISMO.
 *
 * Es la regla que ordena este fichero. Un instrumento hecho de la misma pieza
 * que lo juzgado no puede contradecirlo: contesta lo que el acusado cree. Por
 * eso lo de aquí son INVARIANTES sobre el dato en disco —un hueco no puede ser
 * mayor que la pelea que lo contiene—, que se pueden comprobar sin preguntarle
 * nada al código que las produjo.
 *
 * NO ES UNA BATERÍA DE PRUEBAS, y la diferencia es el motivo de que exista.
 * `test/` comprueba que el código hace lo que se decidió que hiciera, sobre
 * líneas escritas a mano. Esto comprueba que **lo que hay en el disco puede
 * haber ocurrido**, sobre el histórico entero.
 *
 * ── DE DÓNDE SALE, y es lo que la justifica ────────────────────────────────
 *
 * Los tres hallazgos grandes de la semana del 16 de agosto de 2026 los cazó una
 * IMPOSIBILIDAD, no una prueba:
 *
 *   un hueco de 35.399 s DENTRO de una pelea de 50 s      -> el arnés metía
 *                                                            combate ajeno
 *   `Slizik the Mighty`, un jefe único, con suelo 2       -> el arnés restaba
 *                                                            el inicio dos veces
 *   una caída en el segundo 0 en el 79,9 % de las peleas  -> `guion.js` restaba
 *                                                            el inicio dos veces
 *
 * Las tres veces, el número era PLAUSIBLE mirado de cerca y sólo delataba al
 * ponerlo contra algo que no puede pasar. Ninguna prueba unitaria las habría
 * encontrado: las tres eran coherentes consigo mismas.
 *
 * ── CÓMO SE USA ────────────────────────────────────────────────────────────
 *
 *     npm run imposibles
 *     npm run imposibles -- --dir "C:\\ruta\\al\\almacen"
 *
 * SE CORRE DESPUÉS DE CADA RECONSTRUCCIÓN. Y crece: cada vez que aparezca una
 * imposibilidad nueva, se añade aquí. Una lista que no crece es una lista que
 * dejó de mirarse.
 *
 * ── LO QUE UNA IMPOSIBILIDAD TIENE QUE SER ─────────────────────────────────
 *
 * Una afirmación sobre el MUNDO, no sobre el código: «un muerto no vuelve a
 * morir en la misma pelea», «una caída ocurre dentro de su pelea». Si para
 * escribirla hay que mirar cómo está implementado algo, no es una
 * imposibilidad: es una prueba, y va en `test/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { claveDeNombre } from '../src/nombres.js';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CANDIDATOS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'eql-parse'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse SPAIN Guild'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'EQL Parse'),
];
const dir = flag('--dir') ?? CANDIDATOS.find((d) => fs.existsSync(path.join(d, 'fights.ndjson')));
if (!dir) { console.error('No encuentro el almacén. Pásalo con --dir'); process.exit(1); }

/**
 * Cada imposibilidad: su frase, y una función que devuelve el motivo cuando la
 * pelea la rompe. La FRASE es la mitad del valor — si no se puede escribir en
 * una línea que entienda alguien que no ha visto el código, no es una
 * imposibilidad.
 */
const IMPOSIBLES = [
  {
    id: 'duracion-negativa',
    frase: 'Una pelea no dura menos que nada.',
    mira: (f) => ((f.duration ?? 0) < 0 ? `duration = ${f.duration}` : null),
  },
  {
    id: 'caida-fuera-de-pelea',
    frase: 'Nadie cae antes de que empiece la pelea ni después de que acabe.',
    mira: (f) => {
      const dur = Math.max(1, Math.round(f.duration ?? 0));
      const malas = (f.killTimes ?? []).filter((k) => !(k.t >= 0 && k.t <= dur));
      return malas.length ? `${malas.length} de ${(f.killTimes ?? []).length}: ${malas.slice(0, 3).map((k) => `${k.name}@${k.t}s de ${dur}s`).join(', ')}` : null;
    },
  },
  {
    id: 'todas-las-caidas-en-cero',
    frase: 'En una pelea larga con varios abatidos no caen todos en el segundo cero.',
    mira: (f) => {
      const kt = f.killTimes ?? [];
      if (kt.length < 2 || (f.duration ?? 0) < 30) return null;
      return kt.every((k) => k.t === 0) ? `${kt.length} caídas, todas en el segundo 0, en ${f.duration}s` : null;
    },
  },
  {
    id: 'hueco-mayor-que-la-pelea',
    frase: 'Un hueco no es mayor que la pelea que lo contiene.',
    mira: (f) => {
      const dur = Math.max(1, Math.round(f.duration ?? 0));
      const malos = [];
      for (const s of f.sinControl ?? []) {
        const d = (s.hasta ?? dur) - (s.desde ?? 0);
        if (d > dur) malos.push(`sinControl ${d}s`);
      }
      for (const s of f.stanceSpans ?? []) {
        const d = (s.segundos ?? 0);
        if (d > dur + 1) malos.push(`postura ${d}s`);
      }
      if ((f.sinMandoSec ?? 0) > dur) malos.push(`sinMandoSec ${f.sinMandoSec}s`);
      return malos.length ? `${malos.slice(0, 3).join(', ')} en una pelea de ${dur}s` : null;
    },
  },
  /**
   * AQUÍ HABÍA OTRA, Y LA PRIMERA CORRIDA LA TUMBÓ. Decía «un nombre propio es
   * UN individuo: no cae dos veces en la misma pelea», y saltó en 20 peleas.
   * De los siete nombres que la disparaban:
   *
   *   cinco  eran tipos de bicho con parte de nombre propio —`Cleric of
   *          Innoruuk`, `Amygdalan warrior`, `Innoruuk\`s Chosen`— o la forma
   *          capitalizada de un nombre común —`Orc legionnaire`—: falsos
   *          positivos de la heurística.
   *   uno    era REAL y enseña algo del juego: `Sir Lucan D\`Lere`, un named
   *          único, cae DOS VECES en la misma pelea, dos días distintos, con
   *          dos matadores distintos y once y treinta segundos de separación.
   *          Las cuatro líneas están en el registro.
   *
   * O sea que **en EQ Legends un nombre propio no garantiza un individuo**, y
   * la afirmación que había aquí no era una imposibilidad: era una suposición
   * sobre el juego, y una suposición sobre el juego no se comprueba con un
   * `assert`: se pregunta a quien juega. Se retira, y lo que la sustituye sí
   * es imposible.
   */
  /**
   * Y LA SEGUNDA QUE TUMBÓ LA PRIMERA CORRIDA: «el mismo nombre no cae dos
   * veces en el mismo segundo». Saltó en 39 peleas, y también es real: el
   * registro sella al segundo y una zona de área mata varios a la vez.
   *
   *     [Tue Aug 11 11:03:14 2026] A decaying skeleton has been slain by Karer!
   *     [Tue Aug 11 11:03:14 2026] A decaying skeleton has been slain by Karer!
   *     [Tue Aug 11 11:03:14 2026] A decaying skeleton has been slain by Karer!
   *
   * LAS DOS QUE ESCRIBÍ SOBRE MUERTES ERAN SUPOSICIONES SOBRE EL JUEGO, no
   * imposibilidades. Y ésa es la lección de la primera corrida, que valió más
   * que las ocho que callaron: **una imposibilidad tiene que serlo sobre el
   * MUNDO o sobre NUESTRA PROPIA ESCRITURA, y las de en medio —«esto no suele
   * pasar»— son heurísticas disfrazadas**. Las dos que las sustituyen son sobre
   * lo que escribimos nosotros, así que si saltan, el fallo es nuestro.
   */
  {
    id: 'instante-de-una-muerte-que-no-existe',
    frase: 'Todo instante de muerte corresponde a una muerte de la lista.',
    mira: (f) => {
      const quedan = new Map();
      for (const k of f.kills ?? []) {
        const n = claveDeNombre(typeof k === 'string' ? k : k?.victim);
        quedan.set(n, (quedan.get(n) ?? 0) + 1);
      }
      const huerfanos = [];
      for (const kt of f.killTimes ?? []) {
        const n = claveDeNombre(kt.name);
        const q = quedan.get(n) ?? 0;
        if (q <= 0) huerfanos.push(`${kt.name}@${kt.t}s`);
        else quedan.set(n, q - 1);
      }
      return huerfanos.length ? huerfanos.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'una-fila-pasa-del-total-de-su-bando',
    frase: 'Nadie hace más daño que todo su bando junto.',
    mira: (f) => {
      const malos = [];
      for (const r of f.rows ?? []) {
        const techo = r.side === 'enemy' ? (f.enemyTotal ?? 0) : (f.total ?? 0);
        if ((r.damage ?? 0) > techo + 0.5) malos.push(`${r.name} ${r.damage} > ${techo}`);
      }
      return malos.length ? malos.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'el-total-no-cuadra',
    frase: 'El total de la pelea es la suma de lo que hizo cada uno.',
    mira: (f) => {
      if (!Array.isArray(f.rows)) return null;
      const s = f.rows.filter((r) => r.side !== 'enemy').reduce((a, r) => a + (r.damage ?? 0), 0);
      const d = Math.abs((f.total ?? 0) - s);
      return d > 0 ? `total ${f.total} contra ${s} sumando filas (desvío ${d})` : null;
    },
  },
  {
    id: 'segundos-activos-mayores-que-la-pelea',
    frase: 'Nadie está activo más segundos de los que dura la pelea.',
    mira: (f) => {
      const dur = Math.max(1, Math.round(f.duration ?? 0));
      const malos = (f.rows ?? []).filter((r) => (r.activeSec ?? 0) > dur + 1 || (r.hitSec ?? 0) > dur + 1);
      return malos.length ? malos.slice(0, 3).map((r) => `${r.name} activo ${r.activeSec}s de ${dur}s`).join(', ') : null;
    },
  },
  {
    id: 'mas-instantes-que-muertes',
    frase: 'No hay más instantes de muerte que muertes.',
    mira: (f) => {
      const n = (f.killTimes ?? []).length, m = (f.kills ?? []).length;
      return n > m ? `${n} instantes contra ${m} muertes` : null;
    },
  },
  {
    id: 'vida-estimada-negativa',
    frase: 'Nada tiene vida negativa.',
    mira: (f) => {
      const malos = [];
      for (const [n, v] of Object.entries(f.hpSamples ?? {})) {
        for (const x of v ?? []) if (x < 0) malos.push(`${n}: ${x}`);
      }
      return malos.length ? malos.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'porcentaje-fuera-de-rango',
    frase: 'Una proporción va entre 0 y 1.',
    mira: (f) => {
      const malos = [];
      for (const r of f.rows ?? []) {
        for (const c of ['share', 'accuracy', 'avoidance', 'critRate']) {
          const v = r[c];
          if (typeof v === 'number' && (v < 0 || v > 1.0001)) malos.push(`${r.name}.${c} = ${v}`);
        }
      }
      return malos.length ? malos.slice(0, 3).join(', ') : null;
    },
  },
];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Y LAS DEL REPRODUCTOR, QUE ERAN EL PUNTO CIEGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las de arriba miran EL ALMACÉN. Ninguna miraba lo que el reproductor calcula
 * a partir de él — y ahí vivían los dos peores fallos de la semana: el combate
 * ajeno dibujado dentro de tu pelea y todas las figuras apagándose en el
 * segundo cero.
 *
 * La cobertura lo dijo por el otro lado el mismo día: la reconstrucción del
 * registro entero **no pisa ni un bloque de `src/guion.js`**.
 *
 * Piden el registro además del almacén, así que sólo corren con `--log`.
 */
const IMPOSIBLES_RP = [
  {
    id: 'rp-caida-fuera-de-escena',
    frase: 'Ninguna figura cae fuera del intervalo de su pelea.',
    mira: ({ escena }) => {
      const malas = [];
      for (const a of escena.actores) {
        for (const c of a.caidas ?? []) {
          if (!(c >= 0 && c <= escena.duracion)) malas.push(`${a.nombre}@${c}s de ${escena.duracion}s`);
        }
      }
      return malas.length ? malas.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'rp-cae-antes-de-entrar',
    frase: 'Ninguna figura se apaga antes de su primera acción.',
    mira: ({ escena }) => {
      const malas = [];
      for (const a of escena.actores) {
        if (a.desde === null || a.desde === undefined) continue;
        for (const c of a.caidas ?? []) if (c < a.desde) malas.push(`${a.nombre} entra en ${a.desde}s y cae en ${c}s`);
      }
      return malas.length ? malas.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'rp-figuras-contra-suelo',
    frase: 'El número de figuras es las muertes del nombre, o una más.',
    mira: ({ escena }) => {
      const malas = [];
      for (const a of escena.actores) {
        const m = a.suelo?.muertes ?? 0;
        const n = a.figuras ?? 1;
        if (n < Math.max(1, m) || n > m + 1) malas.push(`${a.nombre}: ${n} figuras con ${m} muertes`);
      }
      return malas.length ? malas.slice(0, 3).join(', ') : null;
    },
  },
  {
    id: 'rp-figura-que-la-guarda-rechaza',
    frase: 'Toda figura ajena que no sea tuya ha tocado a alguien de la pelea.',
    /**
     * LA PRIMERA VERSIÓN DECÍA «toda figura ajena», sin más, y saltó en dos
     * peleas — las dos por **`Campeon`**. Miradas: son peleas en las que Miguel
     * lanzó un hechizo y no llegó a pegar a nadie, así que el motor no le abre
     * fila de combatiente y el reproductor lo dibuja igual. Y hace bien: estaba
     * allí. Además un `lanza` NO LLEVA DESTINO, así que por construcción nunca
     * puede «tocar» a nadie y esta comprobación no podía darle el visto bueno.
     *
     * Tú y tus mascotas quedáis fuera: sois de la escena por definición, no por
     * haber tocado a alguien.
     */
    mira: ({ pelea, escena, self }) => {
      const reparto = new Set(pelea.rows.map((r) => r.name));
      // `esTu` sale de las filas, así que quien no tiene fila no lo lleva: el
      // nombre del personaje se pasa aparte.
      const tuyos = new Set([...escena.actores.filter((a) => a.esTu || a.mascota).map((a) => a.nombre), self].filter(Boolean));
      // Se recomprueba por fuera de la guarda, a mano y sobre lo dibujado: si
      // sólo se preguntara a `esRelevante` estaríamos preguntándole al acusado.
      const toco = new Set();
      for (const segs of escena.segundos) {
        for (const x of segs) {
          const a = x.origen, b = x.destino;
          if (a && b && reparto.has(a) && !reparto.has(b)) toco.add(b);
          if (a && b && reparto.has(b) && !reparto.has(a)) toco.add(a);
        }
      }
      const malas = escena.actores
        .map((a) => a.nombre)
        .filter((n) => !reparto.has(n) && !toco.has(n) && !tuyos.has(n));
      return malas.length ? malas.slice(0, 5).join(', ') : null;
    },
  },
  {
    id: 'rp-suceso-fuera-de-la-pelea',
    frase: 'Ningún suceso cae fuera de los segundos de la pelea.',
    mira: ({ escena }) => {
      const n = escena.segundos.length;
      return n > escena.duracion + 1 ? `${n} segundos para una pelea de ${escena.duracion}s` : null;
    },
  },
  {
    id: 'rp-actor-sin-entrada-con-sucesos',
    frase: 'Quien no entró en la escena no tiene sucesos.',
    mira: ({ escena }) => {
      const conSucesos = new Set();
      for (const segs of escena.segundos) for (const x of segs) { if (x.origen) conSucesos.add(x.origen); if (x.destino) conSucesos.add(x.destino); }
      const malas = escena.actores.filter((a) => (a.desde === null || a.desde === undefined) && conSucesos.has(a.nombre));
      return malas.length ? malas.slice(0, 3).map((a) => a.nombre).join(', ') : null;
    },
  },
];

const hora = (f) => new Date((f.at ? f.at / 1000 : f.start ?? 0) * 1000).toLocaleString('es-ES');

const cuenta = new Map(IMPOSIBLES.map((i) => [i.id, { n: 0, ejemplos: [] }]));
let peleas = 0;
const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'fights.ndjson')), crlfDelay: Infinity });
for await (const l of rl) {
  if (!l.trim()) continue;
  let f; try { f = JSON.parse(l); } catch { continue; }
  peleas++;
  for (const imp of IMPOSIBLES) {
    let motivo = null;
    try { motivo = imp.mira(f); } catch (e) { motivo = `la comprobación reventó: ${e.message}`; }
    if (!motivo) continue;
    const c = cuenta.get(imp.id);
    c.n++;
    if (c.ejemplos.length < 3) c.ejemplos.push(`${hora(f)} · ${motivo}`);
  }
}

// ── Y las del reproductor, si se ha pasado el registro ────────────────────
const logPath = flag('--log');
const quienSoy = flag('--self') ?? 'Campeon';
const cuentaRp = new Map(IMPOSIBLES_RP.map((i) => [i.id, { n: 0, ejemplos: [] }]));
let peleasRp = 0;
if (logPath) {
  if (!fs.existsSync(logPath)) { console.error(`No existe el registro: ${logPath}`); process.exit(1); }
  const { reproducirTodo } = await import('./reproductor.js');
  await reproducirTodo({
    dir,
    logPath,
    self: quienSoy,
    cada: ({ pelea, escena }) => {
      peleasRp++;
      for (const imp of IMPOSIBLES_RP) {
        let motivo = null;
        try { motivo = imp.mira({ pelea, escena, self: quienSoy }); } catch (e) { motivo = `la comprobación reventó: ${e.message}`; }
        if (!motivo) continue;
        const c = cuentaRp.get(imp.id);
        c.n++;
        if (c.ejemplos.length < 3) c.ejemplos.push(`${hora(pelea)} · ${motivo}`);
      }
    },
  });
}

console.log(`\n  almacén   ${dir}`);
console.log(`  peleas    ${peleas.toLocaleString('es-ES')}\n`);
let saltaron = 0;
const pinta = (lista, cuentaDe) => {
  for (const imp of lista) {
    const c = cuentaDe.get(imp.id);
    console.log(`  ${c.n ? 'SALTA' : ' ok  '}  ${imp.frase}`);
    if (!c.n) continue;
    saltaron++;
    console.log(`         ${c.n} peleas`);
    for (const e of c.ejemplos) console.log(`           ${e}`);
  }
};
pinta(IMPOSIBLES, cuenta);
let total = IMPOSIBLES.length;
if (logPath) {
  console.log(`\n  ── sobre lo que dibuja el reproductor (${peleasRp.toLocaleString('es-ES')} escenas) ──\n`);
  pinta(IMPOSIBLES_RP, cuentaRp);
  total += IMPOSIBLES_RP.length;
} else {
  console.log(`\n  (las ${IMPOSIBLES_RP.length} del reproductor no se han corrido: hace falta --log)`);
}
console.log(saltaron
  ? `\n  ${saltaron} imposibilidades de ${total} han saltado. Cada una es un fallo o una imposibilidad mal escrita.\n`
  : `\n  las ${total} en silencio.\n`);
process.exit(saltaron ? 1 : 0);
