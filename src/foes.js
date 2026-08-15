/**
 * El expediente de un enemigo: cómo se construye, en un solo sitio.
 *
 * Esto vivía dentro de `aggregate()`, que suma un tramo de peleas de una
 * sentada. La enciclopedia necesita lo mismo pero al revés: plegar UNA pelea
 * según se cierra, sobre lo que ya había guardado. Son dos formas de recorrer
 * los datos, no dos formas de contarlos, y por eso el contador es uno.
 *
 * La razón de separarlo no es la elegancia: la vida estimada, el reparto por
 * dificultad y las resistencias son cifras delicadas, y dos implementaciones
 * acabarían discrepando en algún caso raro —una muerte múltiple, una pelea
 * vieja sin muestras— sin ninguna forma de saber cuál de las dos miente.
 *
 * DOS ESTADOS, Y LA DIFERENCIA IMPORTA
 *
 *   crudo      lo que se acumula y se guarda: sumas, cuentas y muestras.
 *   terminado  lo que se enseña: medias, porcentajes y listas ordenadas.
 *
 * Sólo se guarda lo crudo. Un porcentaje ya no se puede seguir sumando: si la
 * ficha guardase «el 38% de tus Shock of Swords entran», la pelea siguiente no
 * tendría con qué combinarlo. Guardando 9 y 15 sí.
 *
 * ENTRADA
 *
 * Peleas completas con `side` ya puesto en cada fila —`ensureSides` se encarga
 * de las guardadas antes de que ese campo existiera—, porque de ahí sale quién
 * es enemigo. Plegar una pelea dos veces la cuenta dos veces: la identidad de
 * una pelea es cosa del almacén, no de aquí.
 */

import { parseZone, diffKey, SIN_ZONA } from './zones.js';

/** Ficha en crudo, recién abierta. */
function nuevaFicha(name) {
  return {
    name, fights: 0, kills: 0, damageTo: 0, seconds: 0, taken: 0, deaths: 0,
    maxHit: 0, hpSamples: [], zones: new Set(), abil: new Map(), loot: new Map(),
    porDif: new Map(), niveles: new Set(), sinNivel: false, spells: new Map(),
    // Hechizos SUYOS que TÚ resististe, por hechizo. Es el sentido contrario de
    // `spells`, y la razón de que exista: `resistsCaused` era un número por
    // pelea y con eso no se puede decidir nada. Ver `resistsByFoe`.
    resistidos: new Map(),
  };
}

/**
 * Ficha de una dificultad concreta de ese enemigo.
 *
 * Aquí dentro está TODO lo que cambia de una dificultad a otra, que es casi
 * todo: cada dificultad es prácticamente un enemigo distinto. Lo que antes
 * vivía sólo en la ficha común y ahora también aquí:
 *
 *   loot     lo que suelta en D0 no tiene por qué ser lo que suelta en D4.
 *   spells   qué hechizos tuyos le entran. Se partió con una advertencia: la
 *            muestra se fragmenta, así que cada celda enseña su `n` y una
 *            celda con dos intentos tiene que verse que no dice nada.
 *   deaths   las veces que te mató. Existía como campo y no lo incrementaba
 *            nadie: estaba muerto en la ficha común y en el disco.
 *   modes    en qué modo peleaste, y cuántas veces en cada uno. NO es un eje.
 *            Va como dato de la celda porque el 54% de las peleas de un log
 *            real no declara el modo, y partir por él dejaría a la mayoría en
 *            un tercer cajón de «no consta». Guardarlo es lo que permite que
 *            la pregunta se conteste sola cuando haya muestra.
 */
function nuevaDif(diff, tag) {
  return {
    diff, tag, fights: 0, kills: 0, deaths: 0, maxHit: 0, damageTo: 0, taken: 0,
    hpSamples: [], abil: new Map(), abilFights: new Map(), zones: new Set(),
    loot: new Map(), spells: new Map(), modes: new Map(),
  };
}

const suma = (m, k, n) => m.set(k, (m.get(k) ?? 0) + n);

/**
 * Una habilidad suya, sumada.
 *
 * El tipo de daño se guarda por separado y con su reparto en vez de quedarse
 * con el de la primera vez que se vio. Parece un detalle y es la condición que
 * hace que este contador sirva para las dos cosas: el resumen pliega las peleas
 * de la más nueva a la más vieja —que es como las devuelve el índice— y la
 * enciclopedia las plegará de la más vieja a la más nueva, según van pasando.
 * Con «gana el primero», una habilidad que apareciera con dos tipos daría un
 * resultado distinto en cada camino, y ninguno de los dos sería más cierto.
 * Gana el que más daño ha hecho, y a igualdad, el primero por orden alfabético.
 */
function acumulaHabilidad(m, a) {
  const c = m.get(a.name) ?? { name: a.name, sum: 0, n: 0, max: 0, tipos: new Map() };
  c.sum += a.sum ?? 0;
  c.n += a.n ?? 0;
  c.max = Math.max(c.max, a.max ?? 0);
  if (a.type) suma(c.tipos, a.type, a.sum ?? 0);
  m.set(a.name, c);
}

/** De habilidad cruda a la que se enseña, con su tipo ya resuelto. */
function finHabilidad(c) {
  const tipo = [...c.tipos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { name: c.name, type: tipo?.[0], sum: c.sum, n: c.n, max: c.max };
}

export class FoeLedger {
  constructor() {
    this.porNombre = new Map();
  }

  /** La ficha en crudo de un enemigo, creándola si es la primera vez. */
  ficha(name) {
    let e = this.porNombre.get(name);
    if (!e) { e = nuevaFicha(name); this.porNombre.set(name, e); }
    return e;
  }

  /**
   * Pliega una pelea entera dentro de las fichas de los enemigos que salían.
   *
   * @param {object} f  pelea completa, con `side` en cada fila
   */
  /**
   * UN OBJETO QUE LLEGÓ TARDE a la ficha de su enemigo.
   *
   * Su cadáver murió en una pelea tuya, pero lo recogiste después de que esa
   * pelea se cerrara, así que no viaja dentro de ella —`fights.ndjson` sólo
   * crece por el final— sino en `loot.ndjson` con la hora de su pelea. Sin esta
   * puerta, mover el saqueo tardío fuera de la pelea vaciaría en silencio la
   * tabla de caídas justo de lo que más importa: en un histórico real, el botín
   * tardío es el de los jefes, porque un jefe tiene diez objetos y vaciarle el
   * cadáver lleva más que los 20 segundos que tarda la pelea en cerrarse.
   *
   * SÓLO SUMA EL NUMERADOR, y esto es lo que no se puede tocar: cuántas veces lo
   * has tumbado ya se contó al plegar su pelea. Volver a subir `kills` aquí
   * diría que cayó dos veces y estropearía el «2 en 9 caídas» de la ficha, que
   * es dos cifras medidas por caminos distintos.
   *
   * Al enemigo que no exista todavía no se le inventa una ficha: sin su pelea
   * plegada no hay denominador, y un numerador solo es peor que nada.
   */
  foldLootTardio(l, kd) {
    const e = l?.from ? this.porNombre.get(l.from) : null;
    if (!e || !l.item) return false;
    const q = l.qty ?? 1;
    suma(e.loot, l.item, q);
    const pd = e.porDif.get(kd);
    if (pd) suma(pd.loot, l.item, q);
    return true;
  }

  fold(f) {
    if (!f?.rows?.length) return;
    // La zona se vuelve a leer del nombre completo cuando lo hay, en vez de
    // creerse los campos guardados. No es desconfianza: el analizador mejora y
    // los campos no. Las peleas guardadas antes de que «- Group» a secas fuera
    // D0 traen `diff: null`, y releyendo el nombre salen bien sin reconstruir.
    const z = f.zone ? parseZone(f.zone) : null;
    const d = z ? z.diff : (f.diff ?? null);
    // Sin zona no se sabe ni siquiera si había dificultad que declarar, así que
    // va a su propio cajón y no al de «mundo abierto».
    const kd = (!f.zone && d === null) ? SIN_ZONA : diffKey(d);
    const tag = z?.tag ?? f.diffTag ?? null;
    const modo = z?.mode ?? f.zoneMode ?? null;
    // La zona base, sin modo ni dificultad: «Plane of Fear», no «Plane of Fear
    // - Group 4 (Refined)». Las peleas guardadas antes de que el campo existiera
    // no la traen, y se saca del nombre completo con el mismo analizador.
    const zonaBase = z?.base ?? f.zoneBase ?? null;

    for (const r of f.rows) {
      if (r.side !== 'enemy') continue;
      const e = this.ficha(r.name);
      e.fights += 1;
      e.seconds += f.duration ?? 0;
      e.taken += r.damage ?? 0;                 // lo que ESE enemigo repartió
      e.maxHit = Math.max(e.maxHit, r.max ?? 0);
      if (f.zone) e.zones.add(f.zone);

      // El nivel no separa las cifras, y es una decisión medida: sólo dos
      // enemigos coinciden en los dos periodos de nivel de un log real y la
      // única celda que difiere sale de dos intentos. Pero se anota con qué
      // niveles has peleado, para poder avisar de que van mezcladas — que es lo
      // único que se puede afirmar hoy.
      if (f.level) e.niveles.add(f.level);
      else e.sinNivel = true;

      // ── Lo que SÍ se separa por dificultad ────────────────────────────
      //
      // Medido en un log real: Magus Rokyl en D3 tiene un 59% más de vida que
      // en D2, pega 3,6 veces más fuerte y lanza dos hechizos que en D2 no
      // tiene. La media de los dos no describe a ninguno.
      //
      // Las resistencias SÍ se separan ahora, y el motivo de que antes no lo
      // hicieran sigue siendo cierto: la muestra se fragmenta. En el log de
      // calibración todo entraba al 100% en las dos dificultades y la única
      // diferencia (95% contra 86%) salía de 14 intentos. Por eso cada celda
      // lleva su `n` y quien mira ve cuándo no dice nada — que es distinto de
      // no partirlas, porque no partirlas afirma que da igual la dificultad, y
      // eso tampoco está medido.
      let pd = e.porDif.get(kd);
      if (!pd) {
        pd = nuevaDif(d, tag);
        // Marca el tercer cajón. Sin ella habría dos celdas con `diff: null` y
        // no habría forma de decir cuál es «mundo abierto» y cuál «no sé dónde».
        if (kd === SIN_ZONA) pd.sinZona = true;
        e.porDif.set(kd, pd);
      }
      // La etiqueta la traen unas peleas y otras no. Vale cualquiera que la
      // traiga, y por la misma razón que el tipo de daño: si dependiera de cuál
      // se plegó primero, los dos caminos darían fichas distintas.
      if (!pd.tag && tag) pd.tag = tag;
      pd.fights += 1;
      pd.taken += r.damage ?? 0;
      pd.maxHit = Math.max(pd.maxHit, r.max ?? 0);
      if (zonaBase) { pd.zones.add(zonaBase); }
      // El modo, como dato de la celda. Ver `nuevaDif`: no es un eje.
      suma(pd.modes, modo ?? 'sin modo', 1);
      // Las veces que te mató ESTE enemigo, en ESTA dificultad. El campo
      // existía en la ficha común desde el principio y no lo incrementaba
      // nadie: se guardaba un cero, se restauraba un cero y se leía un cero.
      //
      // Sale de `lossesBy`, que dice quién remató, y NO de a quién apuntaba el
      // enemigo. En una pelea con tres enemigos apuntarte no es haberte matado,
      // y el log no obliga a adivinarlo: lo dice.
      const remato = (f.lossesBy ?? []).filter((x) => x?.killer === r.name).length;
      if (remato > 0) { e.deaths += remato; pd.deaths += remato; }

      // En cuántos ENCUENTROS apareció cada habilidad, no sólo cuánto sumó.
      //
      // Es la evidencia en crudo y no se interpreta. En EQL las clases
      // secundarias de un enemigo se sortean por instancia, así que dos
      // encuentros con el mismo nombre pueden ser enemigos distintos: medido en
      // este log, Lord Nagafen lanzó los tres hechizos de Druida en D2 y
      // ninguno en D3 pese a durar la pelea 182 segundos. Si fuera cosa de la
      // dificultad las habilidades se añadirían, nunca se perderían.
      //
      // Y que una habilidad NO aparezca tampoco prueba que no la tenga: las
      // notas de parche de EQL dicen que los NPC respetan tiempos de
      // reutilización. Por eso se guarda «en cuántos de cuántos» y se deja que
      // el que mira saque sus conclusiones.
      for (const nombre of new Set((r.abilities ?? []).map((a) => a.name))) {
        suma(pd.abilFights, nombre, 1);
      }
      for (const a of r.abilities ?? []) {
        acumulaHabilidad(e.abil, a);
        acumulaHabilidad(pd.abil, a);
      }

      /**
       * Cuántas veces cayó: `kills` trae un nombre por muerte, así que matarlo
       * tres veces en una pelea son tres. Antes se contaba una.
       *
       * Y SE COMPARA SIN LA MAYÚSCULA INICIAL, que no es un remilgo: EQ escribe
       * «A shin ghoul knight has been slain» al abrir frase y «You slash a shin
       * ghoul knight» a mitad. La fila del combatiente queda normalizada por
       * `Encounter.actor`, pero `kills` y `hpSamples` se guardan con el nombre
       * TAL CUAL venía en la línea de muerte, así que las dos formas conviven en
       * la misma pelea y esta comparación no casaba.
       *
       * LO QUE COSTABA, medido sobre el almacén: de 4.348 abatidos guardados,
       * 25 no llegaban al bestiario —14 de ellos de `orc legionnaire`— y con
       * ellos se perdían 39 muestras de vida. No fallaba nada visible: el
       * enemigo salía con menos muertes de las que tuvo y con la vida estimada
       * sobre menos muestras, y no había forma de notarlo mirando la ficha.
       *
       * SE ARREGLA AL LEER Y NO AL ESCRIBIR a propósito: así queda bien también
       * el histórico que ya está guardado, sin pedirle a nadie que reconstruya.
       * Es la misma decisión que la 1.11.0 y por el mismo motivo.
       */
      const mismoNombre = (a, b) => a === b
        || a.charAt(0).toLowerCase() + a.slice(1) === b.charAt(0).toLowerCase() + b.slice(1);
      const caidas = (f.kills ?? []).filter((x) => mismoNombre(x, r.name)).length;
      if (caidas > 0) {
        e.kills += caidas;
        pd.kills += caidas;
        // Vida estimada: lo que costó tumbarlo. El log no da la vida de nadie,
        // pero el daño hasta su muerte es una cota muy buena. Cada muerte deja
        // su propia muestra, medida en el instante en que cayó.
        // Por lo mismo que `caidas`: la clave puede venir capitalizada.
        const clave = Object.keys(f.hpSamples ?? {}).find((k) => mismoNombre(k, r.name));
        const muestras = clave ? f.hpSamples[clave] : undefined;
        for (const m of muestras ?? []) if (m > 0) pd.hpSamples.push(Math.round(m));
        if (muestras?.length) {
          for (const m of muestras) if (m > 0) e.hpSamples.push(Math.round(m));
        } else {
          // Peleas guardadas antes de que se midiera al caer: sólo se puede
          // usar el daño total, y sólo vale si cayó una vez. Con más muertes la
          // suma describiría a los tres juntos, así que no se usa.
          const dealt = f.rows.filter((x) => x.side !== 'enemy')
            .reduce((n, x) => n + ((x.targets ?? []).find((tg) => tg.name === r.name)?.sum ?? 0), 0);
          if (dealt > 0 && caidas === 1) e.hpSamples.push(Math.round(dealt));
        }
      }

      for (const l of f.loot ?? []) {
        const item = typeof l === 'string' ? l : l.item;
        const from = typeof l === 'object' ? l.from : null;
        // Unidades y no recogidas, igual que en el resumen del tramo: si los
        // dos contaran distinto, la ficha del enemigo y la sección de Botín
        // discreparían sobre el mismo objeto.
        if (!item || from !== r.name) continue;
        const q = typeof l === 'object' ? (l.qty ?? 1) : 1;
        suma(e.loot, item, q);
        // Y en la celda de su dificultad: lo que suelta en D0 no tiene por qué
        // ser lo que suelta en D4, y hasta ahora las dos listas eran la misma.
        suma(pd.loot, item, q);
      }
    }

    // Lo que le hiciste tú. Va en su propia pasada porque sale de las filas de
    // TU bando, y necesita que los enemigos de esta pelea ya estén dados de alta.
    for (const r of f.rows) {
      if (r.side === 'enemy') continue;
      for (const tg of r.targets ?? []) {
        const e = this.porNombre.get(tg.name);
        if (!e) continue;
        e.damageTo += tg.sum;
        const pd = e.porDif.get(kd);
        if (pd) pd.damageTo += tg.sum;
      }
    }

    // Qué hechizos tuyos entran contra cada enemigo y cuáles resiste. Va a los
    // dos sitios: la ficha común, que es la muestra grande, y la celda de su
    // dificultad, que es la que puede decir algo distinto y casi nunca tiene
    // muestra para decirlo. Las dos se enseñan con su `n`.
    for (const x of f.spellVsFoe ?? []) {
      const e = this.porNombre.get(x.foe);
      if (!e) continue;
      for (const destino of [e.spells, e.porDif.get(kd)?.spells]) {
        if (!destino) continue;
        const c = destino.get(x.spell)
          ?? { spell: x.spell, landed: 0, resisted: 0, byInv: new Map() };
        c.landed += x.landed; c.resisted += x.resisted;
        const clave = x.inv ?? '';
        const b = c.byInv.get(clave) ?? { inv: x.inv ?? null, landed: 0, resisted: 0 };
        b.landed += x.landed; b.resisted += x.resisted;
        c.byInv.set(clave, b);
        destino.set(x.spell, c);
      }
    }

    // Y al revés: lo que él te lanzó y tú resististe. Va sólo a la ficha común
    // y no a la celda por dificultad: son 1.972 sucesos en todo un registro, así
    // que partirlos por dificultad deja casi todas las celdas con n = 1, y una
    // proporción de una muestra no es una proporción.
    for (const x of f.resistsByFoe ?? []) {
      const e = this.porNombre.get(x.foe);
      if (!e) continue;
      const c = e.resistidos.get(x.spell) ?? { spell: x.spell, n: 0 };
      c.n += x.n;
      e.resistidos.set(x.spell, c);
    }
  }

  /** Todas las fichas terminadas, de la que más daño te ha hecho a la que menos. */
  list() {
    return [...this.porNombre.values()].map(terminar)
      .sort((a, b) => b.damageTo - a.damageTo || a.name.localeCompare(b.name));
  }

  /** Una sola, terminada. `null` si nunca te la has cruzado. */
  get(name) {
    const e = this.porNombre.get(name);
    return e ? terminar(e) : null;
  }

  /**
   * Lo crudo, en JSON. Es lo que la enciclopedia guarda en disco.
   *
   * Se serializa el estado CRUDO y nunca el terminado: guardar «el 38% entra»
   * dejaría la ficha sin nada con lo que sumar la pelea siguiente. Ir y volver
   * por aquí tiene que devolver un contador que sigue plegando igual, y eso es
   * lo que comprueba el test.
   */
  toJSON() {
    return [...this.porNombre.values()].map((e) => ({
      name: e.name, fights: e.fights, kills: e.kills, damageTo: e.damageTo,
      seconds: e.seconds, taken: e.taken, deaths: e.deaths, maxHit: e.maxHit,
      hpSamples: e.hpSamples, zones: [...e.zones],
      niveles: [...e.niveles], sinNivel: e.sinNivel,
      abil: [...e.abil.values()].map(habJSON),
      loot: [...e.loot],
      spells: [...e.spells.values()].map((c) => ({
        spell: c.spell, landed: c.landed, resisted: c.resisted,
        byInv: [...c.byInv.values()],
      })),
      porDif: [...e.porDif].map(([k, d]) => [k, {
        diff: d.diff, tag: d.tag, sinZona: !!d.sinZona,
        fights: d.fights, kills: d.kills,
        deaths: d.deaths,
        maxHit: d.maxHit, damageTo: d.damageTo, taken: d.taken,
        hpSamples: d.hpSamples, zones: [...d.zones],
        abil: [...d.abil.values()].map(habJSON),
        abilFights: [...d.abilFights],
        loot: [...d.loot],
        modes: [...d.modes],
        spells: [...d.spells.values()].map((c) => ({
          spell: c.spell, landed: c.landed, resisted: c.resisted,
          byInv: [...c.byInv.values()],
        })),
      }]),
    }));
  }

  /** El camino de vuelta. Lo que no venga se da por vacío, no por cero raro. */
  static fromJSON(datos) {
    const l = new FoeLedger();
    for (const j of datos ?? []) {
      if (!j?.name) continue;
      const e = nuevaFicha(j.name);
      e.fights = j.fights ?? 0; e.kills = j.kills ?? 0;
      e.damageTo = j.damageTo ?? 0; e.seconds = j.seconds ?? 0;
      e.taken = j.taken ?? 0; e.deaths = j.deaths ?? 0; e.maxHit = j.maxHit ?? 0;
      e.hpSamples = j.hpSamples ?? [];
      e.zones = new Set(j.zones ?? []);
      e.niveles = new Set(j.niveles ?? []);
      e.sinNivel = !!j.sinNivel;
      e.abil = habMapa(j.abil);
      e.loot = new Map(j.loot ?? []);
      for (const c of j.spells ?? []) {
        e.spells.set(c.spell, {
          spell: c.spell, landed: c.landed ?? 0, resisted: c.resisted ?? 0,
          byInv: new Map((c.byInv ?? []).map((b) => [b.inv ?? '', { ...b }])),
        });
      }
      for (const [k, d] of j.porDif ?? []) {
        e.porDif.set(k, {
          diff: d.diff ?? null, tag: d.tag ?? null, sinZona: !!d.sinZona,
          fights: d.fights ?? 0, kills: d.kills ?? 0, deaths: d.deaths ?? 0,
          maxHit: d.maxHit ?? 0,
          damageTo: d.damageTo ?? 0, taken: d.taken ?? 0,
          hpSamples: d.hpSamples ?? [], zones: new Set(d.zones ?? []),
          abil: habMapa(d.abil), abilFights: new Map(d.abilFights ?? []),
          loot: new Map(d.loot ?? []),
          modes: new Map(d.modes ?? []),
          spells: new Map((d.spells ?? []).map((c) => [c.spell, {
            spell: c.spell, landed: c.landed ?? 0, resisted: c.resisted ?? 0,
            byInv: new Map((c.byInv ?? []).map((b) => [b.inv ?? '', { ...b }])),
          }])),
        });
      }
      l.porNombre.set(e.name, e);
    }
    return l;
  }
}

const habJSON = (c) => ({ name: c.name, sum: c.sum, n: c.n, max: c.max, tipos: [...c.tipos] });

const habMapa = (lista) => new Map((lista ?? []).map((c) => [c.name, {
  name: c.name, sum: c.sum ?? 0, n: c.n ?? 0, max: c.max ?? 0,
  tipos: new Map(c.tipos ?? []),
}]));

/** Media, mínimo y máximo de las muestras de vida, o `null` si no hay ninguna. */
export function vida(muestras) {
  if (!muestras.length) return null;
  return {
    n: muestras.length,
    avg: Math.round(muestras.reduce((a, b) => a + b, 0) / muestras.length),
    min: Math.min(...muestras), max: Math.max(...muestras),
  };
}

/** De crudo a lo que se enseña. No toca la ficha: devuelve otra cosa. */
function terminar(e) {
  return {
    ...e,
    dps: e.seconds ? e.damageTo / e.seconds : 0,
    zones: [...e.zones],
    levels: [...e.niveles].sort((a, b) => a - b),
    someWithoutLevel: !!e.sinNivel,
    abilities: [...e.abil.values()].map(finHabilidad)
      .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name)).slice(0, 15),
    lootList: [...e.loot].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item, n]) => ({ item, n })),
    hp: vida(e.hpSamples),
    // Lo que le resististe, de más a menos. Si no le has resistido nada, lista
    // vacía y la interfaz no enseña el bloque: cero no es un dato que decir.
    resisted: [...e.resistidos.values()].sort((a, b) => b.n - a.n || a.spell.localeCompare(b.spell)),
    // Una ficha por dificultad, ordenadas. Cuando hay más de una, la de arriba
    // deja de tener sentido y la interfaz enseña éstas.
    dificultades: [...e.porDif.values()]
      .map((d) => ({
        diff: d.diff, tag: d.tag, sinZona: !!d.sinZona,
        // La clave del cajón, explícita. Hace falta porque «mundo abierto» y
        // «sin zona conocida» tienen los dos `diff: null` y por el número no se
        // distinguen: enlazar a una dificultad con un número las confundiría.
        key: d.sinZona ? SIN_ZONA : diffKey(d.diff),
        fights: d.fights, kills: d.kills,
        deaths: d.deaths,
        maxHit: d.maxHit, damageTo: d.damageTo, taken: d.taken,
        zones: [...d.zones],
        hp: vida(d.hpSamples),
        dps: d.fights && e.seconds ? d.damageTo / (e.seconds * d.fights / e.fights) : 0,
        // En qué modo peleaste esta dificultad. Dato de la celda, no un eje.
        modes: [...d.modes].sort((a, b) => b[1] - a[1]).map(([mode, n]) => ({ mode, n })),
        // Cada habilidad con en cuántos encuentros salió: es lo que se puede
        // afirmar. «Sus habilidades en D2» no; «lo que lanzó en los 2 encuentros
        // de D2» sí.
        abilities: [...d.abil.values()].map(finHabilidad)
          .map((a) => ({ ...a, inFights: d.abilFights.get(a.name) ?? 0 }))
          .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name)).slice(0, 12),
        // Lo que soltó EN ESTA dificultad.
        lootList: [...d.loot].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([item, n]) => ({ item, n })),
        // Y qué te resistió aquí. `n` va SIEMPRE, incluso con dos intentos:
        // partir la muestra es lo que obliga a enseñar su tamaño, porque una
        // celda de «86% entra» sacada de 14 intentos y otra sacada de 400 se
        // ven igual y no dicen lo mismo.
        spells: finHechizos(d.spells),
      }))
      // «No consta» al final y nunca antes que D0: no es una dificultad menor,
      // es la ausencia de dato.
      .sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99)),
    spells: finHechizos(e.spells),
  };
}

/**
 * Hechizos tuyos contra ese enemigo, listos para enseñar.
 *
 * Se sacó a su propia función porque ahora hay dos juegos —el de la ficha
 * común y el de cada dificultad— y son la misma cuenta. Si fueran dos
 * implementaciones acabarían discrepando en algún caso raro y no habría forma
 * de saber cuál miente, que es el mismo motivo por el que el contador es uno.
 *
 * `n` sale siempre y no como adorno: partido por dificultad, un «86% entra»
 * puede venir de 14 intentos o de 400, y sin el tamaño se leen igual.
 */
function finHechizos(mapa) {
  return [...mapa.values()]
    .map((c) => ({
      ...c,
      n: c.landed + c.resisted,
      rate: c.landed + c.resisted ? c.resisted / (c.landed + c.resisted) : 0,
      // Sólo se desglosa si hubo intentos con más de una invocación: con una
      // sola, repetir la misma cifra no aporta nada.
      byInv: [...c.byInv.values()]
        .filter((b) => b.landed + b.resisted >= 2)
        .map((b) => ({ ...b, rate: b.resisted / (b.landed + b.resisted) }))
        .sort((a, b) => (b.landed + b.resisted) - (a.landed + a.resisted)
          || String(a.inv).localeCompare(String(b.inv))),
    }))
    .map((c) => ({ ...c, byInv: c.byInv.length > 1 ? c.byInv : [] }))
    .sort((a, b) => (b.landed + b.resisted) - (a.landed + a.resisted)
      || a.spell.localeCompare(b.spell)).slice(0, 12);
}
