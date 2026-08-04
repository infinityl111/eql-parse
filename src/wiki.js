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

/** El nivel de mejora no forma parte del nombre en la wiki. */
export const baseName = (s) => String(s ?? '').replace(/\s*\+\d+\s*$/, '').trim();

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

  async #parsePage(title) {
    const u = `${API}?action=parse&page=${encodeURIComponent(title)}`
      + '&prop=text&format=json&formatversion=2&redirects=1';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse-SPAIN' } });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.error || !j.parse?.text) return null;
    return { title: j.parse.title, text: j.parse.text };
  }

  /** Si el título exacto no existe, se busca y se abre el primer resultado. */
  async #searchThenParse(title) {
    const u = `${API}?action=query&list=search&srsearch=${encodeURIComponent(title)}`
      + '&srlimit=1&format=json&formatversion=2';
    const r = await fetch(u, { headers: { 'User-Agent': 'EQL-Parse-SPAIN' } });
    if (!r.ok) return null;
    const j = await r.json();
    const first = j.query?.search?.[0]?.title;
    if (!first) return null;
    return this.#parsePage(first);
  }
}

export { findBlock, stripTags };
