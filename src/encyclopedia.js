import fs from 'node:fs';
import path from 'node:path';
import { FoeLedger, vida } from './foes.js';
import { STORE_VERSION } from './store.js';
import { parseZone } from './zones.js';

/**
 * La enciclopedia: lo que se aprende jugando.
 *
 * NO se calcula al consultarla. El resumen del tramo puede permitirse leer
 * trescientas peleas del disco cada vez que lo abres; «todos los enemigos de
 * Plane of Fear en D4» sobre dos mil peleas no. Así que la ficha se pone al día
 * al cerrar cada pelea, que es cuando el dato ya está en la mano, y consultarla
 * es leer un fichero que ya está en memoria.
 *
 * Se guarda el estado CRUDO del contador —`FoeLedger.toJSON()`—, nunca lo
 * terminado: un porcentaje ya no se puede seguir sumando.
 *
 * CÓMO SE SABE QUE VA DESFASADA
 *
 * Tres marcas, y cada una detecta una cosa distinta:
 *
 *   version       la generación de este fichero. Sube cuando cambia lo que se
 *                 guarda o cómo se cuenta, y obliga a rehacerlo aunque el
 *                 histórico esté intacto.
 *   storeVersion  la generación del ALMACÉN con la que se construyó. Si el
 *                 histórico se corrigió y se releyó el log, lo que se contó
 *                 antes describe unos datos que ya no existen.
 *   lastUid       la última pelea incorporada. Como `uid` es el byte donde
 *                 empieza el registro y el fichero sólo crece, «lo que falta»
 *                 son exactamente las de uid mayor: al arrancar se pliegan y ya.
 *                 Y si ese uid ya no está en el índice, el almacén se
 *                 reconstruyó y las posiciones se movieron: no hay forma de
 *                 saber qué se contó, así que se rehace entera.
 *
 * Rehacerla no es releer el log: es recorrer el histórico que ya está guardado.
 * Por eso puede hacerse sola y en silencio, como el índice cuando le faltan los
 * aliados. Lo que no puede es hacerse a medias.
 */

/**
 * Generación de la enciclopedia. NO es la del almacén ni la de la aplicación.
 *
 *   1  la primera.
 *   2  el botín se cuenta también cuando el log no dice de quién cayó. La ficha
 *      del enemigo sólo puede quedarse con lo atribuido —es lo que la hace suya—
 *      y con eso la sección de Botín se dejaba fuera todo lo demás sin decirlo.
 */
export const ENC_VERSION = 2;
const FICHERO = 'encyclopedia.json';

export class Encyclopedia {
  constructor(store) {
    this.store = store;
    this.ledger = new FoeLedger();
    /** Todo el botín visto, con o sin fuente. objeto -> {n, sinFuente} */
    this.loot = new Map();
    this.lastUid = -1;
    this.at = null;
    this.dirty = false;
    this.saveTimer = null;
    /** Por qué se rehizo la última vez, o null si se cargó tal cual. */
    this.rebuiltBecause = null;
  }

  get path() { return path.join(this.store.dir, FICHERO); }

  /**
   * Carga lo guardado y lo pone al día. Devuelve qué ha hecho falta hacer.
   *
   * @returns {{ok, foes, folded, rebuilt, reason, ms}}
   */
  load() {
    const t0 = Date.now();
    let guardado = null;
    try { guardado = JSON.parse(fs.readFileSync(this.path, 'utf8')); } catch { /* aún no hay */ }

    const motivo = this.#porQueRehacer(guardado);
    if (motivo) {
      const r = this.rebuild();
      return { ...r, rebuilt: true, reason: motivo, ms: Date.now() - t0 };
    }

    this.ledger = FoeLedger.fromJSON(guardado.foes);
    this.loot = new Map((guardado.loot ?? []).map(([k, v]) => [k, { ...v }]));
    this.lastUid = guardado.lastUid ?? -1;
    this.at = guardado.at ?? null;
    // Lo que pasó con la aplicación cerrada. Casi siempre son unas pocas.
    const folded = this.#alDia();
    if (folded) this.#save();
    return {
      ok: true, foes: this.ledger.porNombre.size, folded,
      rebuilt: false, reason: null, ms: Date.now() - t0,
    };
  }

  /** `null` si lo guardado sirve; si no, la razón por la que no sirve. */
  #porQueRehacer(g) {
    if (!g) return 'sin-fichero';
    if (g.version !== ENC_VERSION) return 'otra-generacion';
    if (g.storeVersion !== STORE_VERSION) return 'almacen-corregido';
    if (!Array.isArray(g.foes)) return 'ilegible';
    // Un uid que ya no existe significa que el .ndjson se rehízo debajo y las
    // posiciones se movieron. -1 es «aún no se ha plegado nada», que sí vale.
    if (g.lastUid >= 0 && !this.store.byUid.has(g.lastUid)) return 'histórico-reconstruido';
    return null;
  }

  /** Pliega las peleas guardadas que aún no estaban. Devuelve cuántas. */
  #alDia() {
    // De la más vieja a la más nueva: el índice está al revés porque la lista lo
    // enseña así, pero aquí el orden natural es el de los hechos.
    const pendientes = this.store.index
      .filter((s) => s.uid > this.lastUid)
      .sort((a, b) => a.uid - b.uid);
    let n = 0;
    for (const s of pendientes) {
      const f = this.store.get(s.uid);
      if (!f) continue;                       // registro ilegible: se salta y se dice en la auditoría
      this.#plegar({ ...f, at: s.at });
      this.lastUid = s.uid;
      n++;
    }
    return n;
  }

  /**
   * Una pelea, en todo lo que la enciclopedia lleva.
   *
   * El botín se cuenta aquí y no dentro del contador de enemigos porque hay
   * objetos que el log no atribuye a nadie: en la ficha de un enemigo no
   * caben —no consta que sean suyos— pero en la sección de Botín sí, y
   * dejarlos fuera sería enseñar una lista incompleta sin decirlo.
   */
  #plegar(f) {
    this.ledger.fold(f);
    for (const l of f.loot ?? []) {
      const item = typeof l === 'string' ? l : l.item;
      if (!item) continue;
      const e = this.loot.get(item) ?? { n: 0, sinFuente: 0 };
      e.n += 1;
      if (!(typeof l === 'object' && l.from)) e.sinFuente += 1;
      this.loot.set(item, e);
    }
  }

  /**
   * Una pelea recién cerrada.
   *
   * Se pliega por su resumen y no por la pelea suelta: `uid` es lo que evita
   * contarla dos veces. Si el almacén devolvió una que ya estaba —releer el log
   * genera las mismas peleas—, su uid es menor que el último y no entra.
   */
  fold(fight, summary) {
    if (!fight || !summary || summary.uid === undefined) return false;
    if (summary.uid <= this.lastUid) return false;
    this.#plegar({ ...fight, at: summary.at });
    this.lastUid = summary.uid;
    this.dirty = true;
    this.#saveLater();
    return true;
  }

  /** Rehace la ficha entera desde el histórico. No relee el log. */
  rebuild() {
    const t0 = Date.now();
    this.ledger = new FoeLedger();
    this.loot = new Map();
    this.lastUid = -1;
    const folded = this.#alDia();
    this.rebuiltBecause = 'rebuild';
    const ok = this.#save();
    return { ok, foes: this.ledger.porNombre.size, folded, ms: Date.now() - t0 };
  }

  #saveLater() {
    if (this.saveTimer) return;
    // Igual que el almacén: escribir en cada pelea con dos mil fichas dentro
    // sería mover megas por una pelea de cuarenta segundos.
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.#save(); }, 4000);
    this.saveTimer.unref?.();
  }

  /** Escribe a un temporal y renombra: un corte no deja media enciclopedia. */
  #save() {
    try {
      fs.mkdirSync(this.store.dir, { recursive: true });
      this.at = Date.now();
      const cuerpo = JSON.stringify({
        version: ENC_VERSION, storeVersion: STORE_VERSION,
        lastUid: this.lastUid, at: this.at,
        foes: this.ledger.toJSON(),
        loot: [...this.loot],
      });
      const tmp = `${this.path}.tmp`;
      fs.writeFileSync(tmp, cuerpo);
      fs.renameSync(tmp, this.path);
      this.dirty = false;
      return true;
    } catch { return false; }
  }

  /** Se llama al cerrar: lo pendiente no se pierde por el temporizador. */
  flush() { if (this.dirty) this.#save(); }

  // ── Consultas ──────────────────────────────────────────────────────────

  /**
   * La rejilla de zonas: una fila por zona base, una celda por dificultad.
   *
   * Una celda vacía dice que ahí no has entrado, que no es lo mismo que decir
   * que no hay nada. Las zonas sin dificultad —mundo abierto— van aparte y no
   * en una quinta columna: inventarles una sería afirmar algo que no hay.
   */
  zones() {
    const porBase = new Map();
    for (const e of this.ledger.porNombre.values()) {
      for (const d of e.porDif.values()) {
        for (const base of d.zones) {
          let z = porBase.get(base);
          if (!z) { z = { base, porDif: new Map() }; porBase.set(base, z); }
          const n = nivel(d.diff);
          let c = z.porDif.get(n);
          if (!c) { c = { diff: n, tag: d.tag, foes: 0, fights: 0, kills: 0, sinDeclarar: 0 }; z.porDif.set(n, c); }
          if (d.tag && !c.tag) c.tag = d.tag;
          c.foes += 1;
          c.fights += d.fights;
          c.kills += d.kills;
          if (d.diff === null) c.sinDeclarar += d.fights;
        }
      }
    }
    return [...porBase.values()]
      .map((z) => ({
        base: z.base,
        celdas: [0, 1, 2, 3, 4].map((n) => z.porDif.get(n) ?? null),
        // Para ordenar: la zona donde más has peleado, arriba.
        fights: [...z.porDif.values()].reduce((a, c) => a + c.fights, 0),
      }))
      .sort((a, b) => b.fights - a.fights || a.base.localeCompare(b.base));
  }

  /**
   * Los enemigos de una zona y dificultad, con lo justo para la lista.
   * @param {string} base   zona sin modo ni dificultad
   * @param {number|null} diff
   */
  zoneFoes(base, diff) {
    // Por nombre y no por ficha de dificultad: en el nivel 0 caben dos fichas
    // del mismo enemigo —la que el registro marcó como 0 y la que no marcó—, y
    // son el mismo enemigo en la misma dificultad. Se juntan las muestras y la
    // vida se calcula una vez, con la misma cuenta que en todas partes.
    const porNombre = new Map();
    for (const e of this.ledger.porNombre.values()) {
      for (const d of e.porDif.values()) {
        if (nivel(d.diff) !== nivel(diff) || !d.zones.has(base)) continue;
        let r = porNombre.get(e.name);
        if (!r) {
          r = { name: e.name, diff: nivel(diff), tag: d.tag, fights: 0, kills: 0,
            maxHit: 0, taken: 0, damageTo: 0, muestras: [] };
          porNombre.set(e.name, r);
        }
        if (d.tag && !r.tag) r.tag = d.tag;
        r.fights += d.fights; r.kills += d.kills;
        r.maxHit = Math.max(r.maxHit, d.maxHit);
        r.taken += d.taken; r.damageTo += d.damageTo;
        r.muestras.push(...d.hpSamples);
      }
    }
    const out = [...porNombre.values()].map(({ muestras, ...r }) => ({ ...r, hp: vida(muestras) }));
    // Por lo que cuesta tumbarlo, y los que no han caído nunca al final: es el
    // orden en que se mira una zona, del jefe hacia abajo.
    return out.sort((a, b) => (b.hp?.avg ?? -1) - (a.hp?.avg ?? -1)
      || b.fights - a.fights || a.name.localeCompare(b.name));
  }

  /** El expediente completo de un enemigo, con la misma forma que en el resumen. */
  foe(name) { return this.ledger.get(name); }

  /**
   * Todos los enemigos con ficha, con lo justo para la lista.
   *
   * La vida NO se promedia entre dificultades: se manda una por dificultad y la
   * lista enseña la de la más alta con su etiqueta. Un solo número para un
   * enemigo que en D3 tiene 251.000 y en D4 412.900 describiría a uno que no
   * existe, que es la razón de que la ficha esté partida desde el principio.
   */
  foes() {
    const out = [];
    for (const e of this.ledger.porNombre.values()) {
      const difs = [...e.porDif.values()]
        .map((d) => ({
          diff: d.diff, tag: d.tag, fights: d.fights, kills: d.kills,
          hp: vida(d.hpSamples)?.avg ?? null,
        }))
        .sort((a, b) => (a.diff ?? -1) - (b.diff ?? -1));
      const zonas = new Set();
      for (const d of e.porDif.values()) for (const z of d.zones) zonas.add(z);
      // La de arriba con vida conocida: si en la más alta nunca cayó, decir su
      // vida sería inventarla, y la de abajo sí se midió.
      const conVida = [...difs].reverse().find((d) => d.hp !== null) ?? null;
      out.push({
        name: e.name, fights: e.fights, kills: e.kills,
        damageTo: e.damageTo, taken: e.taken, maxHit: e.maxHit,
        difs, zonas: [...zonas].sort(),
        hp: conVida ? { avg: conVida.hp, diff: conVida.diff, tag: conVida.tag } : null,
        items: e.loot.size,
      });
    }
    return out.sort((a, b) => b.fights - a.fights || a.name.localeCompare(b.name));
  }

  /**
   * El botín: cada objeto y de quién ha caído.
   *
   * «3 de 11» sale de dos cifras medidas —las veces que lo has tumbado y las
   * veces que soltó eso— y no es una probabilidad de caída: mezcla todas las
   * dificultades, porque el log atribuye el objeto a un nombre y no a una
   * instancia. Se enseña como lo que es y con esa salvedad escrita al lado.
   *
   * Lo que el log no atribuye a nadie se cuenta igual y se dice: una lista de
   * botín a la que le faltan objetos sin avisar es peor que una con huecos.
   */
  lootList() {
    const porObjeto = new Map();
    for (const [item, g] of this.loot) {
      porObjeto.set(item, { item, n: g.n, sinFuente: g.sinFuente, from: [] });
    }
    for (const e of this.ledger.porNombre.values()) {
      for (const [item, n] of e.loot) {
        // Un objeto atribuido a un enemigo que no está en el recuento global no
        // debería existir, pero si pasara se enseña igual antes que perderlo.
        let o = porObjeto.get(item);
        if (!o) { o = { item, n, sinFuente: 0, from: [] }; porObjeto.set(item, o); }
        o.from.push({ name: e.name, n, kills: e.kills });
      }
    }
    return [...porObjeto.values()]
      .map((o) => ({ ...o, from: o.from.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.n - a.n || a.item.localeCompare(b.item));
  }

  /** Lo que enseñan las tarjetas de la portada. Cifras, no adjetivos. */
  counts() {
    const zonas = this.zones();
    const fichas = [...this.ledger.porNombre.values()];
    const porDif = fichas.reduce((n, e) => n + e.porDif.size, 0);
    const conBotin = new Set();
    const vistas = new Set();
    for (const e of fichas) {
      if (e.loot.size) conBotin.add(e.name);
      for (const a of e.abil.keys()) vistas.add(a);
    }
    return {
      zonas: { zonas: zonas.length, fichas: porDif },
      enemigos: { fichas: fichas.length, peleas: this.store.index.length },
      // Los objetos son todos los vistos, atribuidos o no; «de N enemigos» sólo
      // cuenta los que sí constan, que es lo que esa cifra puede afirmar.
      botin: { objetos: this.loot.size, de: conBotin.size },
      habilidades: { habilidades: vistas.size, enemigos: fichas.length },
    };
  }

  /** Salud de la ficha, para el comando de comprobación. */
  audit() {
    const pendientes = this.store.index.filter((s) => s.uid > this.lastUid).length;
    let bytes = 0;
    try { bytes = fs.statSync(this.path).size; } catch { /* aún no hay */ }
    return {
      version: ENC_VERSION, storeVersion: STORE_VERSION,
      foes: this.ledger.porNombre.size, lastUid: this.lastUid,
      fights: this.store.index.length, pending: pendientes, bytes, at: this.at,
    };
  }
}

/** La zona base de una pelea, venga guardada o haya que sacarla del nombre. */
export const zoneBaseOf = (f) => f.zoneBase ?? (f.zone ? parseZone(f.zone).base : null);

/**
 * El nivel de una dificultad, para agrupar y comparar.
 *
 * EQL tiene cinco: 0, 1, 2, 3 y 4. El mundo abierto es el 0, y la línea de
 * entrada no lo escribe —una zona sin instanciar no dice «- Solo 0», no dice
 * nada—, así que el analizador devuelve `null` donde el juego quiere decir 0.
 *
 * Lo guardado NO se toca: en disco sigue constando lo que el registro dijo, que
 * es nada, y el día que eso importe seguirá estando. La equivalencia se aplica
 * al agrupar y al consultar, que es donde la pregunta es «¿en qué dificultad?»
 * y la respuesta correcta es cero y no «se desconoce».
 */
const nivel = (d) => (d === null || d === undefined ? 0 : d);
