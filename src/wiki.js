import fs from 'node:fs';
import path from 'node:path';

/**
 * Cliente de la wiki de EQL.
 *
 * Las fichas de objeto usan el bloque clásico de EverQuest, separado por <br>:
 *
 *     MAGIC ITEM LORE ITEM NO DROP
 *     Slot: WAIST
 *     AC: 12
 *     STR: +15 WIS: +15 HP: +20 MANA: +20
 *     WT: 1.0 Size: SMALL
 *     Class: WAR SHD SHM
 *     Race: TRL
 *
 * Se busca ese bloque en el HTML ya renderizado en vez de analizar plantillas:
 * la forma del bloque es muy reconocible y no depende de cómo esté montada la
 * página, que puede cambiar.
 */

const API = 'https://eqlwiki.com/api.php';
const BASE = 'https://eqlwiki.com';
const TTL = 30 * 24 * 3600e3;      // un mes: los objetos no cambian a menudo
const NEG_TTL = 3 * 24 * 3600e3;   // los fallos se reintentan antes
// El índice de retratos: una semana. Es lo que tarda en aparecer una foto
// nueva subida a la wiki, y a cambio son dos peticiones cada siete días.
const IDX_TTL = 7 * 24 * 3600e3;

/** El nivel de mejora no forma parte del nombre en la wiki. */
export const baseName = (s) => String(s ?? '').replace(/\s*\+\d+\s*$/, '').trim();

/**
 * La clave con la que se cruza un nombre con un fichero de la wiki.
 *
 * Se quita «Npc», la extensión, los guiones bajos y el artículo, y se baja
 * todo a minúsculas. Con eso casan «a zol ghoul knight» con
 * «Npc_a_zol_ghoul_knight.png» y «a kobold priest» con «Npc_kobold_priest.png»,
 * que llevan el artículo uno sí y otro no.
 */
export const clavePortrait = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/\.(png|jpe?g|gif)$/, '')
  .replace(/[_\s]+/g, ' ')
  .replace(/^npc ?/, '')
  .replace(/^(an?|the) /, '')
  .replace(/[^a-z0-9 ']/g, '')
  .trim();


const stripTags = (html) => html
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");

/** Extrae el bloque de estadísticas: de la primera línea de cabecera a Race:. */
function findBlock(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) =>
    /^(MAGIC|LORE|TEMPORARY|NO DROP|ARTIFACT|Slot:|Skill:|AC:|Charges:)/.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i >= start && /^Race:/.test(l));
  if (end < 0) return null;
  const block = lines.slice(start, end + 1).filter(Boolean);
  // Un bloque real tiene al menos clase y raza; si no, hemos pillado otra cosa.
  if (!block.some((l) => /^Class:/.test(l))) return null;
  return block;
}

/**
 * Frases tácticas de la ficha de un enemigo.
 *
 * Las páginas de NPC no usan plantilla: la información útil está en prosa
 * («High resists, not normally slowable, does not DT»). Se buscan las frases
 * que contienen las palabras que importan en vez de intentar analizar una
 * estructura que no existe.
 */
const TACTIC = new RegExp(
  '\\b(slow|slowab|resist|immun|mez|mezzab|charm|snare|root|fear|stun|death touch'
  + '|\\bDT\\b|enrage|summon|rampage|flurry|quad|\\bAE\\b|proc|magic weapon'
  + '|unmezz|uncharm|unstun|unsnar|unfear|regen|heals?|dispel|silence)', 'i');

export function tacticLines(text, max = 6) {
  const out = [];
  for (const raw of text.split(/(?<=[.!?])\s+|\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (line.length < 12 || line.length > 260) continue;
    if (!TACTIC.test(line)) continue;
    if (out.includes(line)) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export class WikiClient {
  constructor(dir) {
    this.path = dir ? path.join(dir, 'wiki-cache.json') : null;
    this.cache = {};
    this.pending = new Map();
    try { this.cache = JSON.parse(fs.readFileSync(this.path, 'utf8')); } catch { this.cache = {}; }
  }

  #save() {
    if (!this.path) return;
    try { fs.writeFileSync(this.path, JSON.stringify(this.cache)); } catch { /* sin permisos */ }
  }

  /** Lo que haya en caché, sin tocar la red. */
  cached(name) {
    const e = this.cache[baseName(name).toLowerCase()];
    if (!e) return null;
    const ttl = e.found ? TTL : NEG_TTL;
    if (Date.now() - e.at > ttl) return null;
    return e.found ? e : { found: false };
  }

  async item(name) {
    const key = baseName(name).toLowerCase();
    if (!key) return null;
    const hit = this.cached(name);
    if (hit) return hit.found ? hit : null;
    if (this.pending.has(key)) return this.pending.get(key);

    const job = this.#fetchItem(baseName(name))
      .then((res) => {
        this.cache[key] = res ?? { found: false, at: Date.now() };
        this.cache[key].at = Date.now();
        this.#save();
        this.pending.delete(key);
        return res;
      })
      .catch(() => { this.pending.delete(key); return null; });
    this.pending.set(key, job);
    return job;
  }

  /** Ficha táctica de un enemigo: lo que la wiki cuenta sobre cómo se pelea. */
  async mob(name) {
    const key = 'mob:' + String(name ?? '').toLowerCase();
    if (!key) return null;
    const e = this.cache[key];
    if (e && Date.now() - e.at < (e.found ? TTL : NEG_TTL)) return e.found ? e : null;
    if (this.pending.has(key)) return this.pending.get(key);

    const job = (async () => {
      const html = await this.#parsePage(name) ?? await this.#searchThenParse(name);
      if (!html) return null;
      const lines = tacticLines(stripTags(html.text));
      if (!lines.length) return null;
      return {
        found: true, title: html.title, lines,
        url: `${BASE}/${encodeURIComponent(html.title.replace(/ /g, '_'))}`,
        at: Date.now(),
      };
    })().then((res) => {
      this.cache[key] = res ?? { found: false, at: Date.now() };
      this.#save(); this.pending.delete(key);
      return res;
    }).catch(() => { this.pending.delete(key); return null; });
    this.pending.set(key, job);
    return job;
  }

  async #fetchItem(title) {
    const html = await this.#parsePage(title) ?? await this.#searchThenParse(title);
    if (!html) return null;
    const block = findBlock(stripTags(html.text));
    if (!block) return null;
    const img = html.text.match(/src="((?:https?:\/\/[^"]+)?\/images\/[^"]*Item_\d+\.[a-z]+)"/i);
    return {
      found: true,
      title: html.title,
      url: `${BASE}/${encodeURIComponent(html.title.replace(/ /g, '_'))}`,
      image: img ? (img[1].startsWith('http') ? img[1] : BASE + img[1]) : null,
      lines: block,
      at: Date.now(),
    };
  }

  /**
   * El icono de cada hechizo, en lotes.
   *
   * La wiki tiene una imagen por hechizo —medido sobre las 1.970 páginas de
   * `Category:Spells`, el 99,7% de las que son un hechizo de verdad la lleva—,
   * y son sólo 150 distintas: el arte clásico de las gemas se repite entre
   * hechizos de la misma escuela. Así que se piden de cincuenta en cincuenta y
   * se guardan una vez.
   *
   * Lo que NO tiene icono es lo que no es un hechizo: `hits`, `kicks`, `bashes`.
   * Eso no es un fallo y la interfaz no debe pintarlo como tal.
   *
   * OJO con el título del fichero: MediaWiki normaliza el guion bajo a espacio,
   * así que la imagen sale como «File:Spellicon 105.png» y no «Spellicon_105».
   * Buscando el guion bajo la cobertura da 0% y parece que no hay iconos.
   *
   * @param {string[]} names  nombres tal cual salen del registro
   * @returns {Promise<Map<string,string>>} nombre -> `data:` del icono
   */
  async spellIcons(names) {
    const pedir = [...new Set(names.filter(Boolean))]
      .filter((n) => this.#icono(n) === undefined);
    for (let i = 0; i < pedir.length; i += 50) {
      try { await this.#loteIconos(pedir.slice(i, i + 50)); }
      catch { /* sin red: se reintenta en otra visita */ }
    }
    const out = new Map();
    for (const n of new Set(names.filter(Boolean))) {
      const fichero = this.#icono(n);
      const datos = fichero ? this.cache[`icondata:${fichero}`]?.data : null;
      if (datos) out.set(n, datos);
    }
    return out;
  }

  /** Lo que se sabe del icono de un hechizo: el fichero, `null` o `undefined`. */
  #icono(name) {
    const e = this.cache[`icon:${String(name).toLowerCase()}`];
    if (!e) return undefined;
    // Los negativos también caducan: una página puede crearse después.
    if (!e.file && Date.now() - e.at > NEG_TTL) return undefined;
    return e.file;
  }

  async #loteIconos(nombres) {
    const u = `${API}?action=query&titles=${encodeURIComponent(nombres.join('|'))}`
      + '&prop=images&imlimit=max&redirects=1&format=json&formatversion=2';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
    if (!r.ok) return;
    const j = await r.json();

    // La respuesta viene por título normalizado y con las redirecciones ya
    // resueltas: hay que deshacer las dos para volver al nombre que preguntamos.
    const alias = new Map();
    for (const n of j.query?.normalized ?? []) alias.set(n.to, n.from);
    for (const n of j.query?.redirects ?? []) alias.set(n.to, alias.get(n.from) ?? n.from);
    const original = (t) => alias.get(t) ?? t;

    const ficheros = new Set();
    for (const p of j.query?.pages ?? []) {
      const ic = (p.images ?? []).map((x) => x.title)
        .find((x) => /^File:Spellicon[ _]/i.test(x));
      const file = ic ? ic.replace(/^File:/, '') : null;
      this.cache[`icon:${original(p.title).toLowerCase()}`] = { file, at: Date.now() };
      if (file) ficheros.add(file);
    }
    await this.#bajarIconos([...ficheros]);
    this.#save();
  }

  /**
   * Baja los PNG que falten y los guarda en base64.
   *
   * Se guardan aquí y no se enlazan a la wiki para que la enciclopedia funcione
   * sin red una vez vistos, y para no pedir la misma imagen cuarenta veces. Son
   * 40×40 y unos 2,6 KB: el juego completo cabe en medio mega.
   */
  async #bajarIconos(ficheros) {
    const faltan = ficheros.filter((f) => !this.cache[`icondata:${f}`]);
    if (!faltan.length) return;
    const u = `${API}?action=query&titles=${
      encodeURIComponent(faltan.map((f) => `File:${f}`).join('|'))}`
      + '&prop=imageinfo&iiprop=url&format=json&formatversion=2';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
    if (!r.ok) return;
    const j = await r.json();
    for (const p of j.query?.pages ?? []) {
      const url = p.imageinfo?.[0]?.url;
      if (!url) continue;
      try {
        const img = await fetch(url, { headers: { 'User-Agent': 'EQL-Parse' } });
        if (!img.ok) continue;
        const buf = Buffer.from(await img.arrayBuffer());
        // Un icono de 40×40 no llega a 6 KB. Algo mucho mayor no es un icono.
        if (buf.length > 64 * 1024) continue;
        this.cache[`icondata:${p.title.replace(/^File:/, '')}`] = {
          data: `data:image/png;base64,${buf.toString('base64')}`, at: Date.now(),
        };
      } catch { /* esa se queda sin bajar y se reintenta otro día */ }
    }
  }

  /**
   * El retrato de un enemigo, cuando la wiki lo tiene.
   *
   * SÓLO LOS FICHEROS «Npc». Las páginas de bicho llevan también
   * «File:Item NNN.png», que son iconos del BOTÍN que suelta: poner uno al
   * lado de un nombre sería una imagen que miente sobre lo que es. Se
   * descartan aunque eso deje al bicho sin foto.
   *
   * NO HAY LISTA DE NOMBRES NI FALTA. Se baja el índice de ficheros «Npc» de
   * la wiki —863 el día que se midió— y el cruce se hace aquí con el nombre
   * normalizado. El que hoy no tenga retrato lo tendrá en cuanto alguien lo
   * suba, sin tocar una línea: el índice caduca y se vuelve a pedir.
   *
   * POR QUÉ EL ÍNDICE Y NO PREGUNTAR POR CADA UNO. Se intentó preguntando por
   * las imágenes de la página del bicho, y sale mal: de 200 enemigos de un
   * registro real, sólo 8 tenían su retrato ENLAZADO desde su página, mientras
   * que 51 lo tienen SUBIDO. El fichero existe aunque la página no lo use, y
   * 61 de esos bichos ni siquiera tienen página.
   *
   * Y el nombre del fichero no se puede adivinar: hay «Npc_a_zol_ghoul_knight»
   * con artículo y «Npc_kobold_priest» sin él, y algún «NpcNezzkaTolax.PNG»
   * sin guiones. Cruzar contra el índice se los queda todos; adivinar se
   * dejaría la mitad.
   */
  async foePortraits(names) {
    const idx = await this.#npcIndex();
    if (!idx) return new Map();

    const quiero = new Map();          // nombre -> fichero
    for (const n of new Set((names ?? []).filter(Boolean))) {
      const fichero = idx.get(clavePortrait(n));
      if (fichero) quiero.set(n, fichero);
    }
    const ficheros = [...new Set(quiero.values())];
    for (let i = 0; i < ficheros.length; i += 25) {
      try { await this.#bajarRetratos(ficheros.slice(i, i + 25)); }
      catch { /* sin red: otra visita */ }
    }

    const out = new Map();
    for (const [n, f] of quiero) {
      const d = this.cache[`portrait:${clavePortrait(f)}`]?.data;
      if (d) out.set(n, d);
    }
    return out;
  }

  /** El índice de ficheros «Npc» de la wiki, cacheado y con caducidad. */
  async #npcIndex() {
    const e = this.cache['npcindex'];
    if (e && Date.now() - e.at < IDX_TTL && Array.isArray(e.files)) {
      return new Map(e.files.map((f) => [clavePortrait(f), f]));
    }
    const files = [];
    let cont = null;
    try {
      for (let i = 0; i < 40; i++) {
        const u = `${API}?action=query&list=allimages&aiprefix=Npc&ailimit=500`
          + `&format=json&formatversion=2${cont ? `&aicontinue=${encodeURIComponent(cont)}` : ''}`;
        const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
        if (!r.ok) break;
        const j = await r.json();
        for (const x of j.query?.allimages ?? []) files.push(x.name);
        cont = j.continue?.aicontinue;
        if (!cont) break;
      }
    } catch { /* sin red */ }
    // Si no vino nada, se conserva el índice viejo antes que quedarse a ciegas.
    if (!files.length) {
      return e?.files ? new Map(e.files.map((f) => [clavePortrait(f), f])) : null;
    }
    this.cache.npcindex = { files, at: Date.now() };
    this.#save();
    return new Map(files.map((f) => [clavePortrait(f), f]));
  }

  /**
   * Los retratos, guardados como los iconos: para que la enciclopedia
   * funcione sin red y para no pedir la misma imagen cuarenta veces.
   *
   * Se piden en miniatura de 160 de ancho, que es más de lo que se enseña en
   * una ficha y muchísimo menos que el original.
   */
  async #bajarRetratos(ficheros) {
    // La clave es la normalizada, no el nombre del fichero: se pide con
    // guiones bajos —`Npc_a_zol_ghoul_knight.png`— y la API devuelve el título
    // con espacios, así que guardando por el título y leyendo por el fichero
    // no se encontraba ni una. Se bajaron las 51 y se devolvieron cero.
    const faltan = ficheros.filter((f) => !this.cache[`portrait:${clavePortrait(f)}`]);
    if (!faltan.length) return;
    const u = `${API}?action=query&titles=${
      encodeURIComponent(faltan.map((f) => `File:${f}`).join('|'))}`
      + '&prop=imageinfo&iiprop=url&iiurlwidth=160&format=json&formatversion=2';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
    if (!r.ok) return;
    const j = await r.json();
    for (const p of j.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!url) continue;
      try {
        const img = await fetch(url, { headers: { 'User-Agent': 'EQL-Parse' } });
        if (!img.ok) continue;
        const buf = Buffer.from(await img.arrayBuffer());
        // Una miniatura de 160 no llega a 60 KB. Algo mucho mayor no es lo
        // que se pidió, y no se guarda medio mega por bicho.
        if (buf.length > 256 * 1024) continue;
        const tipo = /\.jpe?g$/i.test(url) ? 'jpeg' : 'png';
        this.cache[`portrait:${clavePortrait(p.title.replace(/^File:/, ''))}`] = {
          data: `data:image/${tipo};base64,${buf.toString('base64')}`, at: Date.now(),
        };
      } catch { /* se reintenta otro día */ }
    }
    this.#save();
  }

  /**
   * ¿Es este enemigo un jefe de raid? Lo dice la wiki por sus categorías.
   *
   * SÓLO CUENTA «Raid_Encounters», Y NO ES UNA ELECCIÓN DE ESTILO.
   *
   * La intuición era usar «Named_Mobs», que suena a lo que se busca. Medido
   * sobre los 119 enemigos de un registro real: 96 la llevan —el 81%—,
   * incluidos `a desert tarantula` con 175 de vida y `a vampire bat` con 1.723.
   * En esta wiki esa categoría significa «tiene página», no «es importante», y
   * partir por ella dejaría casi todo en el lado de los jefes.
   *
   * «Raid_Encounters» sí discrimina, y con holgura: 14 enemigos, vida mediana
   * 32.005 frente a 7.769 de los otros, y la lista es la que uno esperaría —
   * Nagafen, Vox, Master Yael, the Spiroc Lord, Eye of Veeshan…
   *
   * SIN BÚSQUEDA DIFUSA. `mob()` cae a buscar cuando el título exacto no
   * existe, y para leer tácticas está bien. Aquí NO: preguntando por «a fire
   * giant warrior» —que no tiene página— la búsqueda devolvería la primera
   * página que se le parezca, que bien puede ser la de un jefe, y marcaríamos
   * como raid a un bicho corriente. Que no haya página es una respuesta:
   * significa que no es nadie.
   *
   * @returns {{found:boolean, raid:boolean, named:boolean, title:string|null}}
   */
  async classify(name) {
    const limpio = baseName(name);
    if (!limpio) return null;
    const key = `cls:${limpio.toLowerCase()}`;
    const e = this.cache[key];
    if (e && Date.now() - e.at < (e.found ? TTL : NEG_TTL)) return e;
    if (this.pending.has(key)) return this.pending.get(key);

    const job = (async () => {
      const u = `${API}?action=parse&page=${encodeURIComponent(limpio)}`
        + '&prop=categories&format=json&formatversion=2&redirects=1';
      const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
      if (!r.ok) return null;
      const j = await r.json();
      // `missingtitle` no es un fallo: es la wiki diciendo que ese enemigo no
      // tiene página, y eso ya responde a la pregunta.
      /**
       * UNA CONSULTA QUE FALLA NO PUEDE PRODUCIR UNA RESPUESTA NEGATIVA.
       *
       * Aquí ponía `found: true, raid: false, title: null`, con el argumento de
       * que «missingtitle no es un fallo: es la wiki diciendo que ese enemigo
       * no tiene página, y eso ya responde a la pregunta». No responde:
       *
       *   · `j.error` cubre CUALQUIER error de la API, no sólo `missingtitle`;
       *   · y aunque fuera `missingtitle`, «no hay página CON ESE NOMBRE» no es
       *     «no es un jefe»: es que el nombre no casa. `Innoruuk, the Prince of
       *     Hate` no tiene página con ese título —la suya es «Innoruuk»— y se
       *     quedó guardado como un «no» rotundo, con 43.265 de vida.
       *
       * SON TRES ESTADOS, NO DOS: sí, no, y no lo sé. El tercero no se degrada
       * nunca al segundo. `found: true` con `title: null` era un estado
       * imposible que este código fabricaba.
       */
      if (j.error) return { found: false, motivo: j.error.code ?? 'error', at: Date.now() };
      const cats = (j.parse?.categories ?? []).map((c) => c.category);
      return {
        found: true,
        raid: cats.includes('Raid_Encounters'),
        named: cats.includes('Named_Mobs'),
        title: j.parse?.title ?? null,
        at: Date.now(),
      };
    })().then((res) => {
      this.cache[key] = res ?? { found: false, at: Date.now() };
      this.#save(); this.pending.delete(key);
      return this.cache[key];
    }).catch(() => { this.pending.delete(key); return null; });
    this.pending.set(key, job);
    return job;
  }

  async #parsePage(title) {
    const u = `${API}?action=parse&page=${encodeURIComponent(title)}`
      + '&prop=text&format=json&formatversion=2&redirects=1';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.error || !j.parse?.text) return null;
    return { title: j.parse.title, text: j.parse.text };
  }

  /** Si el título exacto no existe, se busca y se abre el primer resultado. */
  async #searchThenParse(title) {
    const u = `${API}?action=query&list=search&srsearch=${encodeURIComponent(title)}`
      + '&srlimit=1&format=json&formatversion=2';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse' } });
    if (!r.ok) return null;
    const j = await r.json();
    const first = j.query?.search?.[0]?.title;
    if (!first) return null;
    return this.#parsePage(first);
  }
}

export { findBlock, stripTags };
