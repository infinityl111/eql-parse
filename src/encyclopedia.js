import fs from 'node:fs';
import path from 'node:path';
import { FoeLedger, vida } from './foes.js';
import { FORMATO_VERSION } from './store.js';
import { parseZone, diffKey, labelDiff, DIFFS, SIN_MARCA, SIN_ZONA } from './zones.js';

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
 *   3  el botín recogido SIN pelea entra en el recuento y se dice aparte. Pasa
 *      cuando el cadáver lo remató entero un compañero: ese combate nunca fue
 *      tuyo, pero recoger el objeto sí. Antes se descartaba en silencio.
 */
export const ENC_VERSION = 3;
const FICHERO = 'encyclopedia.json';

export class Encyclopedia {
  constructor(store) {
    this.store = store;
    this.ledger = new FoeLedger();
    /** Todo el botín visto, con o sin fuente. objeto -> {n, sinFuente} */
    this.loot = new Map();
    this.lastUid = -1;
    /** Cuántas entradas de botín huérfano se han plegado ya. */
    this.lastLoot = -1;
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
    this.lastLoot = guardado.lastLoot ?? -1;
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
    if (g.storeVersion !== FORMATO_VERSION) return 'almacen-corregido';
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
    n += this.#plegarHuerfanos();
    return n;
  }

  /**
   * El botín que no viaja dentro de una pelea guardada. Son DOS cosas.
   *
   *   SUELTO   no hay cadáver conocido del que colgarlo: al enemigo lo remató
   *            entero un compañero y ese combate nunca fue tuyo. Recoger un
   *            objeto es un suceso TUYO y pasa igual, así que se cuenta — pero
   *            NO entra en la ficha del enemigo ni en el reparto por
   *            dificultad, y no por descuido: «2 de 11 caídas» necesita un
   *            denominador de peleas tuyas y aquí no hay ninguna. Meterlo
   *            inflaría el numerador con un denominador que no lo acompaña.
   *
   *   TARDÍO   su cadáver SÍ murió en una pelea tuya; lo recogiste después de
   *            que se cerrara. Aquí el denominador existe y ya está contado —la
   *            pelea se plegó con sus muertes—, así que el objeto sí entra en la
   *            ficha del enemigo. Sin esto, sacar el saqueo tardío de dentro de
   *            la pelea vaciaría la tabla de caídas de los jefes en silencio.
   *
   * LOS DOS SE CUENTAN AQUÍ Y NO EN `#plegar`, y esa es la garantía de que
   * ninguno se cuenta dos veces: no están dentro de ninguna pelea guardada, así
   * que el camino de la pelea no puede verlos ni en directo ni al reconstruir.
   */
  #plegarHuerfanos() {
    const lista = this.store.lootLineas ?? [];
    let n = 0;
    for (let i = this.lastLoot + 1; i < lista.length; i++) {
      const l = lista[i];
      if (!l?.item) { this.lastLoot = i; continue; }
      const e = this.loot.get(l.item) ?? { n: 0, sinFuente: 0, sinPelea: 0, tarde: 0 };
      const q = l.qty ?? 1;
      e.n += q;
      if (l.de) {
        e.tarde = (e.tarde ?? 0) + q;
        const kd = (!l.zone && (l.diff ?? null) === null) ? SIN_ZONA : diffKey(l.diff ?? null);
        this.ledger.foldLootTardio(l, kd);
      } else e.sinPelea = (e.sinPelea ?? 0) + q;
      if (!l.from) e.sinFuente += q;
      this.loot.set(l.item, e);
      this.lastLoot = i;
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
      // Unidades, no recogidas: la misma cuenta que el resumen y la ficha.
      const q = typeof l === 'object' ? (l.qty ?? 1) : 1;
      e.n += q;
      if (!(typeof l === 'object' && l.from)) e.sinFuente += q;
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
    // El botín sin pelea llega por su cuenta y en cualquier momento: se mira
    // aquí porque es cuando la ficha se va a guardar de todas formas.
    this.#plegarHuerfanos();
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
    this.lastLoot = -1;
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
        version: ENC_VERSION, storeVersion: FORMATO_VERSION,
        lastUid: this.lastUid, lastLoot: this.lastLoot, at: this.at,
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
   * La rejilla de zonas: una fila por zona base, cinco celdas de dificultad y
   * una sexta, aparte, para lo que no la declara.
   *
   * Una celda vacía dice que ahí no has entrado, que no es lo mismo que decir
   * que no hay nada.
   *
   * LO QUE CAMBIÓ Y POR QUÉ: la columna D0 contenía East Freeport. Había un
   * `nivel = (d) => d ?? 0` que metía «no consta» en el cajón del cero, así que
   * una columna rotulada como una dificultad medida contenía la ausencia de
   * medida. Un dato ausente con aspecto de dato medido es peor que no tener la
   * columna. Ahora D0 son sólo instancias con D0 de verdad —modo declarado sin
   * número, medido un peldaño entero por debajo de D1— y el mundo abierto va en
   * `sinMarca`, que la interfaz enseña rotulado como lo que es.
   */
  zones() {
    const porBase = new Map();
    for (const e of this.ledger.porNombre.values()) {
      for (const d of e.porDif.values()) {
        for (const base of d.zones) {
          let z = porBase.get(base);
          if (!z) { z = { base, porDif: new Map() }; porBase.set(base, z); }
          const k = diffKey(d.diff);
          let c = z.porDif.get(k);
          if (!c) { c = { diff: d.diff, tag: d.tag, foes: 0, fights: 0, kills: 0, modes: new Map() }; z.porDif.set(k, c); }
          if (d.tag && !c.tag) c.tag = d.tag;
          c.foes += 1;
          c.fights += d.fights;
          c.kills += d.kills;
          for (const [m, n] of d.modes ?? []) c.modes.set(m, (c.modes.get(m) ?? 0) + n);
        }
      }
    }
    const salida = (c) => (c ? { ...c, modes: [...c.modes].sort((a, b) => b[1] - a[1]).map(([mode, n]) => ({ mode, n })) } : null);
    return [...porBase.values()]
      .map((z) => ({
        base: z.base,
        celdas: DIFFS.map((n) => salida(z.porDif.get(diffKey(n)))),
        // Ni es una sexta dificultad ni se mezcla con la primera: va por su
        // cuenta y se rotula como ausencia.
        sinMarca: salida(z.porDif.get(SIN_MARCA)),
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
    // Antes se agrupaba por nombre porque en la celda 0 caían dos fichas del
    // mismo enemigo, la marcada como 0 y la que no marcaba nada, y había que
    // juntarlas. Ya no: son cajones distintos y no se tocan. Se sigue
    // agrupando por nombre porque un mismo enemigo puede tener varias fichas de
    // la misma dificultad si aparece en más de una zona base.
    const buscada = diffKey(diff);
    const porNombre = new Map();
    for (const e of this.ledger.porNombre.values()) {
      for (const d of e.porDif.values()) {
        if (diffKey(d.diff) !== buscada || !d.zones.has(base)) continue;
        let r = porNombre.get(e.name);
        if (!r) {
          r = { name: e.name, diff: d.diff, tag: d.tag, fights: 0, kills: 0, deaths: 0,
            maxHit: 0, taken: 0, damageTo: 0, muestras: [], items: 0 };
          porNombre.set(e.name, r);
        }
        if (d.tag && !r.tag) r.tag = d.tag;
        r.fights += d.fights; r.kills += d.kills; r.deaths += d.deaths ?? 0;
        r.maxHit = Math.max(r.maxHit, d.maxHit);
        r.taken += d.taken; r.damageTo += d.damageTo;
        r.muestras.push(...d.hpSamples);
        r.items += (d.loot?.size ?? 0);
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
   * Un enemigo EN UNA DIFICULTAD, y sólo esa.
   *
   * Cinco columnas no caben en una ficha cuando cada una trae resistencias,
   * vida, golpe máximo, habilidades y botín propios. Así que desde el enemigo
   * se entra a una dificultad y se ve entera, sin nada promediado con las
   * demás: esto devuelve exactamente lo que se midió en ese cajón.
   *
   * `diff` puede ser `null`, que es «las peleas de las que no consta la
   * dificultad». Es un cajón como los otros y se enseña rotulado como ausencia,
   * no como una sexta dificultad.
   */
  foeAt(name, key) {
    const e = this.ledger.porNombre.get(name);
    if (!e) return null;
    const ficha = this.ledger.get(name);
    // Por clave de cajón y no por número: «mundo abierto» y «sin zona
    // conocida» son los dos `diff: null` y con un número se confundirían.
    const d = (ficha?.dificultades ?? []).find((x) => x.key === key);
    if (!d) return null;
    return {
      name,
      // El contexto de la ficha común que sigue valiendo aquí: con qué niveles
      // peleaste y en qué zonas. No son cifras de combate, así que no mienten
      // al no estar partidas — pero se dice que son de todas las dificultades.
      levels: ficha.levels, someWithoutLevel: ficha.someWithoutLevel,
      ...d,
      label: labelDiff(d.diff, d.tag),
      // Para poder saltar de una dificultad a otra sin volver atrás.
      hermanas: (ficha.dificultades ?? []).map((x) => ({
        diff: x.diff, tag: x.tag, key: x.key, fights: x.fights,
        label: labelDiff(x.diff, x.tag),
      })),
    };
  }

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
    const celda = (d) => (d ? {
      diff: d.diff, tag: d.tag, fights: d.fights, kills: d.kills,
      deaths: d.deaths ?? 0, maxHit: d.maxHit, items: d.loot?.size ?? 0,
      hp: vida(d.hpSamples)?.avg ?? null,
    } : null);

    for (const e of this.ledger.porNombre.values()) {
      const difs = [...e.porDif.values()].map(celda)
        .sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99));
      // Las cinco columnas, en su sitio y con hueco donde no has peleado. Es la
      // misma rejilla que la de Zonas, y por lo mismo: «no lo he matado en D0»
      // y «no he entrado en D0» son cosas distintas, y una celda vacía sólo
      // puede decir la segunda.
      const rejilla = DIFFS.map((n) => celda(e.porDif.get(diffKey(n))));
      const sinMarca = celda(e.porDif.get(SIN_MARCA));
      const zonas = new Set();
      for (const d of e.porDif.values()) for (const z of d.zones) zonas.add(z);
      // La de arriba con vida conocida: si en la más alta nunca cayó, decir su
      // vida sería inventarla, y la de abajo sí se midió.
      const conVida = [...difs].reverse().find((d) => d && d.hp !== null) ?? null;
      out.push({
        name: e.name, fights: e.fights, kills: e.kills, deaths: e.deaths,
        damageTo: e.damageTo, taken: e.taken, maxHit: e.maxHit,
        difs, rejilla, sinMarca, zonas: [...zonas].sort(),
        hp: conVida ? { avg: conVida.hp, diff: conVida.diff, tag: conVida.tag } : null,
        items: e.loot.size,
      });
    }
    return out.sort((a, b) => b.fights - a.fights || a.name.localeCompare(b.name));
  }

  /**
   * El botín: cada objeto, de quién ha caído y EN QUÉ DIFICULTAD.
   *
   * «3 de 11» sale de dos cifras medidas —las veces que lo has tumbado y las
   * veces que soltó eso— y no es una probabilidad de caída. Antes, además,
   * mezclaba las cinco dificultades, y eso es justo lo que no se puede hacer:
   * lo que suelta un bicho en D0 no tiene por qué ser lo que suelta en D4.
   * Ahora cada fuente trae su reparto por dificultad, con las veces que lo
   * mataste EN ESA dificultad al lado, que es el único denominador honesto.
   *
   * Lo que el log no atribuye a nadie se cuenta igual y se dice: una lista de
   * botín a la que le faltan objetos sin avisar es peor que una con huecos.
   */
  lootList() {
    const porObjeto = new Map();
    for (const [item, g] of this.loot) {
      porObjeto.set(item, { item, n: g.n, sinFuente: g.sinFuente,
        sinPelea: g.sinPelea ?? 0, from: [], porDif: new Map() });
    }
    for (const e of this.ledger.porNombre.values()) {
      for (const [item, n] of e.loot) {
        // Un objeto atribuido a un enemigo que no está en el recuento global no
        // debería existir, pero si pasara se enseña igual antes que perderlo.
        let o = porObjeto.get(item);
        if (!o) { o = { item, n, sinFuente: 0, sinPelea: 0, from: [], porDif: new Map() }; porObjeto.set(item, o); }
        // El desglose del enemigo, dificultad a dificultad. `kills` es el de esa
        // dificultad y no el total: decir «2 de 11» con los 11 de otra celda
        // sería un porcentaje inventado.
        const desglose = [];
        for (const d of e.porDif.values()) {
          const cuantos = d.loot?.get(item) ?? 0;
          if (!cuantos) continue;
          desglose.push({ diff: d.diff, tag: d.tag, n: cuantos, kills: d.kills });
          const g = o.porDif.get(diffKey(d.diff))
            ?? { diff: d.diff, tag: d.tag, n: 0, kills: 0 };
          g.n += cuantos; g.kills += d.kills;
          o.porDif.set(diffKey(d.diff), g);
        }
        o.from.push({
          name: e.name, n, kills: e.kills,
          porDif: desglose.sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99)),
        });
      }
    }
    return [...porObjeto.values()]
      .map((o) => ({
        ...o,
        from: o.from.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
        porDif: [...o.porDif.values()].sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99)),
      }))
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

  /**
   * Tus muertes.
   *
   * Sale del índice —quién cayó, dónde y en qué dificultad— más una lectura por
   * muerte para saber quién te hizo más daño en esa pelea. No va en la ficha
   * aprendida porque no es una propiedad de ningún enemigo: es tuya.
   *
   * Lo que NO se puede decir, y por eso no se dice: quién dio el golpe final. El
   * registro no lo enlaza. «El que más daño te hizo» es otra cosa, y puede
   * perfectamente no ser el que te remató.
   */
  deaths(self, limite = 400) {
    if (!self) return { self: null, muertes: [], porZona: [], porEnemigo: [] };
    const caidas = this.store.index
      .filter((s) => (s.losses ?? []).includes(self))
      .slice(0, limite);

    const muertes = [];
    for (const s of caidas) {
      const veces = (s.losses ?? []).filter((x) => x === self).length;
      const f = this.store.get(s.uid);
      const mio = (f?.rows ?? []).find((r) => r.name === self);
      const top = (mio?.takenBySource ?? [])[0] ?? null;
      muertes.push({
        uid: s.uid, at: s.at, zoneBase: s.zoneBase ?? null, diff: s.diff ?? null,
        level: s.level ?? null, label: s.label, veces,
        // Rotulado como lo que es: el que más te pegó, no el que te mató.
        masDaño: top ? { name: top.name, sum: top.sum,
          share: mio?.taken ? top.sum / mio.taken : null } : null,
        taken: mio?.taken ?? null,
      });
    }

    const agrupar = (clave) => {
      const m = new Map();
      for (const d of muertes) {
        const k = clave(d);
        if (k === null) continue;
        m.set(k, (m.get(k) ?? 0) + d.veces);
      }
      return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
    };

    return {
      self,
      total: muertes.reduce((a, d) => a + d.veces, 0),
      fights: this.store.index.length,
      muertes,
      // «Nagafen's Lair · D2» o «Nagafen's Lair · sin marca», nunca «· D0»
      // cuando lo que pasa es que no consta.
      porZona: agrupar((d) => (d.zoneBase
        ? `${d.zoneBase} · ${labelDiff(d.diff, d.diffTag) ?? SIN_MARCA}` : null)),
      porEnemigo: agrupar((d) => d.masDaño?.name ?? null),
    };
  }

  /**
   * Tu progresión.
   *
   * Sale del índice entero, que ya está en memoria: no abre ni un registro.
   *
   * Y NO hay curva de dps en el tiempo, a propósito. Sube al subir de nivel y
   * baja al pelear con algo más duro, así que mide las dos cosas a la vez y
   * ninguna de las dos. Lo comparable es la terna (enemigo, dificultad, nivel):
   * ahí sí, la misma pelea contra el mismo enemigo en las mismas condiciones.
   *
   * Las peleas con varios enemigos quedan fuera del reparto por enemigo. Tu dps
   * en una pelea contra tres no es tu dps contra ninguno de los tres, y
   * atribuírselo a los tres sería contarlo tres veces.
   */
  progress({ minDuracion = 30, minSerie = 5 } = {}) {
    const utiles = this.store.index.filter((s) => typeof s.mine === 'number'
      && (s.duration ?? 0) >= minDuracion);
    const sinDato = this.store.index.filter((s) => typeof s.mine !== 'number').length;
    const dps = (s) => s.mine / s.duration;

  /**
   * El resumen de un grupo de peleas, CON la identidad de la mejor.
   *
   * Antes esto mapeaba a números y ordenaba: la cifra sobrevivía y la pelea se
   * perdía. Y una marca sin su pelea deja la pregunta obvia sin respuesta —«mi
   * récord contra Overseer of Air fueron 210 dps, ¿y qué hice?»—. Se ordenan
   * las peleas enteras y se guarda el `uid` de la primera, que es lo que
   * permite abrirla.
   *
   * La mediana no lleva pelea a propósito: es una posición en una lista, no un
   * combate concreto, y darle un enlace haría creer que aquella pelea tiene
   * algo de particular cuando lo único que tiene es estar en medio.
   */
    const resumir = (lista) => {
      const orden = [...lista].sort((a, b) => dps(a) - dps(b));
      const mejor = orden.at(-1);
      return {
        n: orden.length,
        best: mejor ? dps(mejor) : 0,
        median: orden.length ? dps(orden[Math.floor(orden.length / 2)]) : 0,
        bestUid: mejor?.uid ?? null,
        bestAt: mejor?.at ?? null,
        bestDuration: mejor?.duration ?? null,
        bestZone: mejor?.zoneBase ?? mejor?.zone ?? null,
      };
    };

    // ── Por nivel ────────────────────────────────────────────────────────
    const porNivel = new Map();
    for (const s of utiles) {
      const k = s.level ?? 'sin nivel';
      if (!porNivel.has(k)) porNivel.set(k, []);
      porNivel.get(k).push(s);
    }

    // ── Por enemigo, dificultad y nivel ──────────────────────────────────
    const porEnemigo = new Map();
    for (const s of utiles) {
      if ((s.foes ?? []).length !== 1) continue;     // ver el comentario de arriba
      const k = `${s.foes[0]}\u0000${diffKey(s.diff)}\u0000${s.level ?? ''}`;
      if (!porEnemigo.has(k)) porEnemigo.set(k, []);
      porEnemigo.get(k).push(s);
    }

    const marcas = [...porEnemigo].map(([k, lista]) => {
      const [name, d, lvl] = k.split('\u0000');
      return {
        // `d` viene como «D2» o como «sin marca». Lo segundo NO es cero: es una
        // pelea de la que no consta la dificultad, y comparar tus marcas de una
        // zona sin declarar con las de D0 sería juntar dos cosas distintas.
        name, diff: d === SIN_MARCA ? null : +d.slice(1),
        level: lvl === '' ? null : +lvl,
        ...resumir(lista),
        // La serie sólo se dibuja con muestra suficiente. Con tres puntos no hay
        // tendencia, hay tres puntos.
        serie: lista.length >= minSerie
          ? [...lista].sort((a, b) => a.at - b.at).map((s) => ({ at: s.at, dps: dps(s) }))
          : null,
      };
    }).sort((a, b) => b.n - a.n || b.best - a.best || a.name.localeCompare(b.name));

    return {
      fights: utiles.length, sinDato, minSerie,
      niveles: [...porNivel].map(([level, lista]) => ({
        level: level === 'sin nivel' ? null : level, ...resumir(lista),
      })).sort((a, b) => (b.level ?? -1) - (a.level ?? -1)),
      marcas,
      ...this.#periodos(minDuracion, minSerie),
    };
  }

  /**
   * Tu nivel a lo largo del tiempo, y lo que pasó en cada tramo.
   *
   * NO ES UNA PROGRESIÓN, SON PERIODOS. En EQL cambiar una clase por otra más
   * baja te BAJA el nivel, así que la línea no sube: va y viene. Medido en un
   * histórico real, de diez cambios de nivel tres son bajadas, y el patrón es
   * subir a 50, bajar a los veintitantos a subir secundarias y volver. Once
   * tramos, no una cuesta.
   *
   * Y NADA DE ESTO SE GUARDA APARTE: cada pelea ya lleva su nivel y su hora, así
   * que un cambio es simplemente donde el nivel es distinto entre dos peleas
   * consecutivas. El momento exacto no se sabe —el registro no lo dice cuando
   * baja— pero queda acotado entre la última pelea de un nivel y la primera del
   * siguiente: mediana de diez minutos en ese histórico.
   *
   * LA ÚNICA COMPARACIÓN QUE DICE ALGO es entre periodos del MISMO nivel. En el
   * histórico de referencia hay tres a nivel 50: medianas 129, 122 y 130 —o sea
   * la misma— y récords 210, 190 y 300. La mediana no se mueve y el techo sube,
   * que es una lectura de verdad y no se ve de ninguna otra forma.
   *
   * LOS HITOS son hechos fechados que se ponen al lado, no explicaciones. Los
   * puntos de habilidad ganados y el equipo que te quedaste en ese tramo. NO se
   * afirma que una cosa cause la otra: se ponen juntas y quien mira decide.
   */
  #periodos(minDuracion, minSerie) {
    const orden = [...this.store.index].filter((s) => s.level).sort((a, b) => a.at - b.at);
    const tramos = [];
    for (const s of orden) {
      const u = tramos.at(-1);
      if (u && u.level === s.level) u.peleas.push(s);
      else tramos.push({ level: s.level, peleas: [s] });
    }

    const dps = (s) => s.mine / s.duration;
    const aas = this.store.aa ?? [];
    // Lo que te QUEDASTE, que no es lo mismo que lo que recogiste: lo vendido al
    // instante es basura de vendedor y lo consumido eran materiales. Medido, de
    // 794 unidades recogidas sólo 216 se quedaron.
    const guardado = [];
    for (const s of this.store.index) {
      const f = this.store.get(s.uid);
      for (const l of f?.loot ?? []) {
        if (l.sold || l.upgraded || l.stored || !l.item) continue;
        guardado.push({ item: l.item, at: s.at + (l.t ?? 0) * 1000, tier: nivelMejora(l.item) });
      }
    }

    const periodos = tramos.map((g, i) => {
      const utiles = g.peleas.filter((s) => typeof s.mine === 'number' && (s.duration ?? 0) >= minDuracion);
      const desde = g.peleas[0].at;
      const hasta = g.peleas.at(-1).at;
      const piezas = guardado.filter((q) => q.at >= desde && q.at <= hasta && q.tier !== null)
        .sort((a, b) => b.tier - a.tier);
      return {
        i: i + 1, level: g.level, desde, hasta,
        fights: g.peleas.length,
        ...resumirCon(utiles, dps),
        // Suficiente para comparar, o no. Con dos peleas hay dos peleas.
        bastante: utiles.length >= minSerie,
        aa: aas.filter((a) => a.at >= desde && a.at <= hasta).length,
        piezas: piezas.slice(0, 6),
        piezasN: piezas.length,
        mejorTier: piezas[0]?.tier ?? null,
      };
    });

    // El cambio entre dos periodos, con lo que NO se sabe: el instante exacto.
    const cambios = [];
    for (let i = 1; i < periodos.length; i++) {
      const a = periodos[i - 1], b = periodos[i];
      cambios.push({
        de: a.level, a: b.level, sube: b.level > a.level,
        desde: a.hasta, hasta: b.desde, margen: b.desde - a.hasta,
      });
    }

    // Mismo nivel en momentos distintos: la comparación que sí vale.
    const porMismoNivel = new Map();
    for (const p of periodos) {
      if (!p.bastante) continue;
      if (!porMismoNivel.has(p.level)) porMismoNivel.set(p.level, []);
      porMismoNivel.get(p.level).push(p);
    }
    const comparables = [...porMismoNivel]
      .filter(([, l]) => l.length >= 2)
      .map(([level, l]) => ({ level, periodos: l.map((p) => p.i) }))
      .sort((a, b) => b.level - a.level);

    return { periodos, cambios, comparables };
  }

  /** Salud de la ficha, para el comando de comprobación. */
  audit() {
    const pendientes = this.store.index.filter((s) => s.uid > this.lastUid).length;
    let bytes = 0;
    try { bytes = fs.statSync(this.path).size; } catch { /* aún no hay */ }
    return {
      version: ENC_VERSION, storeVersion: FORMATO_VERSION,
      foes: this.ledger.porNombre.size, lastUid: this.lastUid,
      fights: this.store.index.length, pending: pendientes, bytes, at: this.at,
    };
  }
}

/**
 * La zona base de una pelea. SE RECALCULA SIEMPRE que haya nombre de zona.
 *
 *     SE PERSISTE LO OBSERVADO; SE RECALCULA LO DERIVADO.
 *
 * `f.zone` es lo que dijo el registro: un hecho, y se guarda. `zoneBase` es
 * INTERPRETACIÓN NUESTRA de ese hecho, y una interpretación guardada envejece
 * sin avisar. Ésta envejeció el 19/08/2026: hasta ese día «The Plane of Hate 4
 * (Refined)» daba base «The Plane of Hate 4», porque se creía que el dígito era
 * parte del nombre. Todas las peleas guardadas antes llevan dentro esa lectura.
 *
 * Antes esto decía `f.zoneBase ?? …`, o sea que prefería lo guardado. Con la
 * regla nueva, las peleas viejas seguirían agrupando por la base con dígito y
 * las nuevas por la limpia: el histórico partido en dos sin una sola señal.
 * Recalculando, el cambio alcanza a todo lo guardado sin pedirle al usuario que
 * reconstruya nada, y por eso esto NO sube `FORMATO_VERSION`.
 *
 * El valor guardado se conserva como respaldo para las peleas sin `zone` —las
 * anteriores a la primera línea de zona del registro—, que son las únicas donde
 * no hay nada que recalcular.
 */
export const zoneBaseOf = (f) => (f.zone ? parseZone(f.zone).base : f.zoneBase ?? null);

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
/**
 * El nivel de mejora que EQL escribe en el propio nombre: «Carmine Trinket +4».
 * Es un dato MEDIDO, no una deducción: está en la línea del registro. Lo que sí
 * se deduce es que una pieza con nombre de ranura sea equipo, y por eso lo que
 * no lleva `+N` ni nombre de pieza no cuenta como hito.
 */
/**
 * CALIBRADO CONTRA UN INVENTARIO REAL, y no se construyó nada con él.
 *
 * El juego exporta el inventario con «/output inventory»: una tabla con la
 * ranura, el nombre y el identificador de cada objeto. Sirve para responder
 * a la única pregunta que esta función no puede: ¿de verdad es equipo lo que
 * yo llamo equipo?
 *
 * Medido sobre el inventario de la partida de referencia, 25 piezas
 * equipadas: la regla de aquí acierta las 25. Ninguna se escapa y ninguna
 * sobra. Con lo cual la deducción está calibrada y el fichero no hace falta.
 *
 * NO SE IMPORTA, Y ES A PROPÓSITO. El fichero es una foto sin fecha: dice lo
 * que llevas puesto hoy, no cuándo lo conseguiste, y aquí todo lo que se
 * enseña va fechado. Pedirlo además rompería la regla de la casa —quien no
 * exporte nada tiene la aplicación entera—. Queda como calibración: si algún
 * día la regla falla, se vuelve a medir contra otro inventario.
 */
const RANURA = /(sword|blade|dagger|axe|hammer|mace|staff|bow|shield|helm|coif|cap|mask|tunic|robe|breastplate|vest|bracer|gauntlet|glove|greaves|leggings|boots|sandals|cloak|ring|earring|necklace|amulet|belt|girdle|sash|turban|cape|trinket)/i;
function nivelMejora(nombre) {
  const m = /\+(\d+)\s*$/.exec(String(nombre ?? ''));
  if (m) return +m[1];
  return RANURA.test(String(nombre ?? '')) ? 0 : null;
}

/** El resumen de una lista con la identidad de la mejor, como `resumir`. */
function resumirCon(lista, dps) {
  const orden = [...lista].sort((a, b) => dps(a) - dps(b));
  const mejor = orden.at(-1);
  return {
    n: orden.length,
    best: mejor ? dps(mejor) : 0,
    median: orden.length ? dps(orden[Math.floor(orden.length / 2)]) : 0,
    bestUid: mejor?.uid ?? null,
    bestAt: mejor?.at ?? null,
  };
}

// Aquí vivía `const nivel = (d) => d ?? 0`, que convertía «no consta» en D0 y
// era la razón de que East Freeport saliera en la columna de una dificultad.
// No se sustituye por nada: `null` viaja como `null` y quien lo enseña lo
// rotula como ausencia. Si vuelve a hacer falta una clave, es `diffKey`.
