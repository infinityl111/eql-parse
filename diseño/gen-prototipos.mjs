/**
 * Prototipos v2 — con las tres correcciones de Campeón.
 *
 * 1 · LA PROCEDENCIA SE VE SIN DESPLEGAR. Es lo irrenunciable: si al mirar la
 *     pantalla no se sabe qué cifra es medida, cuál es de la wiki y cuál la
 *     escribió él, el rediseño ha fallado por mucho que quepa más.
 * 2 · Un solo control por filtro: pestañas para cambiar de VISTA, pastillas
 *     para filtrar DENTRO de la vista.
 * 3 · Nada repetido en todas las filas: si la zona es la misma, va en la
 *     cabecera del grupo. Una columna con el mismo valor en todas las filas no
 *     es información.
 */
import fs from 'node:fs';

const real = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SALIDA = process.argv[3];
const HOY = '20 de agosto de 2026';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mil = (n) => Number(n || 0).toLocaleString('es-ES');

/** ══ KIT COMPARTIDO ═══════════════════════════════════════════════════════ */
const KIT_CSS = `
:root{
  --fondo:#14110d; --alto:#1c1813; --linea:#2f2921; --linea2:#3d3529;
  --tinta:#efe7d8; --tinta2:#b3a793; --tenue:#7d7263;
  --tuyo:#d9a441; --zona:#5b8fb9; --visto:#63b083; --alarma:#c9603a;
  --r:7px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--tinta);
  font:13px/1.45 "Segoe UI",system-ui,sans-serif}
h1{margin:0;font-size:21px;font-weight:650}
.marco{max-width:1180px;margin:0 auto;padding:18px 22px 60px}
.mini{color:var(--tenue);font-size:11px}
.num{font-variant-numeric:tabular-nums}

/* PIEZA 1 · pestañas: cambian de VISTA, nunca filtran */
.pest{display:flex;gap:2px;border-bottom:1px solid var(--linea);margin:14px 0 0}
.pest button{background:none;border:0;border-bottom:2px solid transparent;color:var(--tenue);
  font:600 12px/1 inherit;padding:9px 14px;cursor:pointer}
.pest button[aria-selected=true]{color:var(--tinta);border-bottom-color:var(--tuyo)}

/* PIEZA 2 · barra de control */
.barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 0;
  border-bottom:1px solid var(--linea)}
.buscar{flex:1 1 200px;min-width:160px;position:relative}
.buscar input{width:100%;background:var(--alto);border:1px solid var(--linea2);
  border-radius:var(--r);color:var(--tinta);font:inherit;padding:7px 10px 7px 28px}
.buscar input:focus{outline:0;border-color:var(--tuyo)}
.buscar::before{content:"⌕";position:absolute;left:9px;top:5px;color:var(--tenue);font-size:15px}
select{background:var(--alto);border:1px solid var(--linea2);border-radius:var(--r);
  color:var(--tinta);font:inherit;padding:7px 8px}
.dens{display:flex;border:1px solid var(--linea2);border-radius:var(--r);overflow:hidden}
.dens button{background:none;border:0;color:var(--tenue);font:600 11px/1 inherit;padding:8px 10px;cursor:pointer}
.dens button[aria-pressed=true]{background:var(--linea);color:var(--tinta)}

/* PIEZA 3 · pastillas: filtran DENTRO de la vista */
.pastillas{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}
.pastilla{background:none;border:1px solid var(--linea2);border-radius:99px;color:var(--tenue);
  font:600 11px/1 inherit;padding:5px 11px;cursor:pointer}
.pastilla[aria-pressed=true]{background:var(--tuyo);border-color:var(--tuyo);color:#1a1408}

/* PIEZA 4 · filas plegables */
.filas{border:1px solid var(--linea);border-radius:var(--r);overflow:hidden;margin-top:8px}
.grupo{background:#191510;border-bottom:1px solid var(--linea);padding:5px 11px;
  font:600 11px/1 inherit;color:var(--tinta2);letter-spacing:.4px}
.grupo .n{color:var(--tenue);font-weight:400}
.fila{border-bottom:1px solid var(--linea)}
.fila:last-child{border-bottom:0}
.fila>summary{display:grid;align-items:center;gap:10px;padding:6px 11px;cursor:pointer;list-style:none}
.fila>summary::-webkit-details-marker{display:none}
.fila>summary:hover{background:var(--alto)}
.fila[open]>summary{background:var(--alto)}
.giro{color:var(--tenue);font-size:10px}
.fila[open] .giro{transform:rotate(90deg);display:inline-block}
.cuerpo{padding:8px 11px 11px 33px;background:#181410;font-size:12px;color:var(--tinta2)}
.compacta .fila>summary{padding:2px 11px}

/* PIEZA 5 · etiquetas compactas */
.et{display:inline-block;border-radius:4px;padding:1px 6px;font:600 10px/1.6 inherit;white-space:nowrap}
.et.gris{background:var(--linea);color:var(--tinta2)}
.et.enem{background:#3a1f16;color:var(--alarma)}
.et.masc{background:#241f2f;color:#9b8ec7}

/* ══ PROCEDENCIA · la pieza que Campeón no deja negociar ══════════════════
   Las tres fuentes SIEMPRE a la vista, en la misma fila y sin desplegar.
   La que manda va rellena; las otras, perfiladas. El color es el mismo en
   toda la aplicación y se explica UNA vez, en la leyenda de arriba. */
.proc{display:inline-flex;gap:4px;align-items:center}
.f{display:inline-flex;gap:4px;align-items:baseline;border:1px solid;border-radius:4px;
  padding:1px 6px;font:600 10px/1.7 inherit;white-space:nowrap;background:transparent}
.f .v{font-variant-numeric:tabular-nums;font-weight:700}
.f.tuyo{border-color:#5c4a1e;color:var(--tuyo)}
.f.zona{border-color:#2b4a5e;color:var(--zona)}
.f.visto{border-color:#264c37;color:var(--visto)}
.f.manda.tuyo{background:var(--tuyo);color:#1a1408;border-color:var(--tuyo)}
.f.manda.zona{background:var(--zona);color:#0d1a22;border-color:var(--zona)}
.f.manda.visto{background:var(--visto);color:#0c1a12;border-color:var(--visto)}
.f.no{opacity:.45}
.leyenda{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:8px 11px;
  background:#191510;border:1px solid var(--linea);border-radius:var(--r);margin-top:10px;
  font-size:11px;color:var(--tinta2)}
.cuenta-g{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
.deQuien{font-size:10px;font-weight:700;letter-spacing:.4px;display:block;margin-top:1px}

/* Barra segmentada por TIPO de daño */
.seg{display:flex;height:7px;border-radius:3px;overflow:hidden;background:var(--linea);min-width:90px}
.seg i{display:block;height:100%}
.t-melee{background:#c9a227}.t-magic{background:#7f6bd6}.t-fire{background:#c9603a}
.t-cold{background:#5b8fb9}.t-poison{background:#63b083}.t-disease{background:#8a7a4a}
.t-ds{background:#a4553f}.t-dot{background:#b06fa0}.t-unresistable{background:#9aa0a6}
.t-otro{background:#5a5248}

/* «Lo que esta pelea no sabe» — SIEMPRE a la vista, nunca tras un clic */
.noSabe{border:1px solid var(--linea);border-left:3px solid var(--alarma);border-radius:var(--r);
  background:#1a1410;padding:9px 12px;margin-top:10px;font-size:12px;color:var(--tinta2)}
.noSabe b{color:var(--tinta)}
.noSabe .h{font:700 10px/1 inherit;letter-spacing:.5px;color:var(--alarma);display:block;margin-bottom:5px}

.conmutador{display:flex;gap:6px;margin:0 0 6px}
.conmutador button{background:var(--alto);border:1px solid var(--linea2);border-radius:var(--r);
  color:var(--tinta2);font:700 12px/1 inherit;padding:9px 16px;cursor:pointer}
.conmutador button[aria-pressed=true]{background:var(--tuyo);border-color:var(--tuyo);color:#1a1408}
.nota{background:#1a1610;border:1px solid var(--linea);border-left:3px solid var(--tuyo);
  border-radius:var(--r);padding:11px 14px;margin:14px 0;color:var(--tinta2);font-size:12.5px}
.nota b{color:var(--tinta)}
.antes{border:1px dashed var(--linea2);border-radius:var(--r);padding:20px;background:#171310}
.vacio{color:var(--tenue);text-align:center;padding:60px 0;font-style:italic}
.pie{color:var(--tenue);font-size:11.5px;margin-top:34px;border-top:1px solid var(--linea);padding-top:12px}
`;

const KIT_JS = `
document.addEventListener('click', (e) => {
  const p = e.target.closest('.pest button');
  if (p) {
    for (const b of p.parentElement.children) b.setAttribute('aria-selected', b === p);
    const caja = p.closest('[data-host]');
    for (const s of caja.querySelectorAll('[data-panel]')) s.hidden = s.dataset.panel !== p.dataset.ir;
  }
  const t = e.target.closest('.pastilla, .dens button, .conmutador button');
  if (t) {
    const g = t.closest('.dens, .conmutador');
    if (g) for (const b of g.children) b.setAttribute('aria-pressed', b === t);
    else t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true');
    aplica(t.closest('[data-host]') || document);
  }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('.buscar input, select')) aplica(e.target.closest('[data-host]') || document);
});
function aplica(raiz) {
  const vista = raiz.querySelector('[data-panel]:not([hidden])') || raiz;
  const q = (vista.querySelector('.buscar input')?.value || '').toLowerCase().trim();
  const off = [...vista.querySelectorAll('.pastilla[aria-pressed=false]')].map((b) => b.dataset.et);
  const compacta = vista.querySelector('.dens button[aria-pressed=true]')?.dataset.d === 'alta';
  for (const l of vista.querySelectorAll('.filas')) l.classList.toggle('compacta', !!compacta);
  for (const f of vista.querySelectorAll('.fila')) {
    const ets = (f.dataset.et || '').split(' ').filter(Boolean);
    f.hidden = ets.some((x) => off.includes(x)) || (q && !(f.dataset.busca || '').includes(q));
  }
  // Un grupo sin filas visibles se esconde entero: una cabecera sola es ruido.
  for (const g of vista.querySelectorAll('.grupo')) {
    let n = 0;
    for (let s = g.nextElementSibling; s && s.classList.contains('fila'); s = s.nextElementSibling) {
      if (!s.hidden) n++;
    }
    g.hidden = n === 0;
    const c = g.querySelector('.n'); if (c) c.textContent = n;
  }
  for (const c of vista.querySelectorAll('[data-cuenta]')) {
    const l = vista.querySelector(c.dataset.cuenta);
    if (l) c.textContent = [...l.querySelectorAll('.fila')].filter((f) => !f.hidden).length;
  }
}
addEventListener('DOMContentLoaded', () => aplica(document));
`;

const marco = (titulo, cuerpo) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>${KIT_CSS}</style></head><body><div class="marco">
${cuerpo}
<p class="pie">Prototipo de diseño · ${HOY} · <b>cifras REALES</b>, de
<code>${esc(real.origen)}</code> el ${esc(real.generado)}.
Se GENERAN con <code>gen-prototipos.mjs</code>; no se editan a mano. No es fuente de datos.</p>
</div><script>${KIT_JS}</script></body></html>`;

/** La tira de procedencia: las tres fuentes, siempre, sin desplegar. */
const proc = (manual, zona, visto, manda) => `<span class="proc">
  <span class="f tuyo${manda === 'tuyo' ? ' manda' : ''}${manual ? '' : ' no'}">tuyo <span class="v">${manual || '—'}</span></span>
  <span class="f zona${manda === 'zona' ? ' manda' : ''}${zona ? '' : ' no'}">zona <span class="v">${zona || '—'}</span></span>
  <span class="f visto${manda === 'visto' ? ' manda' : ''}${visto ? '' : ' no'}">visto <span class="v">${visto || '—'}</span></span>
</span>`;

const LEYENDA = `<div class="leyenda">
  <b style="color:var(--tinta)">De dónde sale cada cifra:</b>
  <span><span class="f tuyo manda">tuyo</span> lo escribiste tú</span>
  <span><span class="f zona manda">zona</span> lo declara eqlwiki, y es de la ZONA entera</span>
  <span><span class="f visto manda">visto</span> lo que llevamos observado</span>
  <span class="mini">la rellena es la que manda el número grande</span>
</div>`;

// ══ A · REAPARICIONES ═════════════════════════════════════════════════════
const c = real.cronos[0] ?? { nombre: '—', base: '—', diff: null };
const cand = real.pelea.filas.filter((r) => r.lado === 'enemy' && !/ pet$/i.test(r.n));

const A = marco('Reapariciones — prototipo v2', `
<h1>Reapariciones</h1>
<p class="mini">Prototipo v2 · la sección <b>vacía</b> · ${real.cronos.length} temporizador real.</p>

<div class="conmutador">
  <button aria-pressed="true" onclick="pa.hidden=false;pd.hidden=true">ANTES</button>
  <button aria-pressed="false" onclick="pa.hidden=true;pd.hidden=false">DESPUÉS</button>
</div>

<div id="pa"><div class="antes">
  <div style="border:1px solid #2f2921;border-radius:7px;padding:13px;max-width:310px">
    <div style="display:flex;justify-content:space-between"><b>${esc(c.nombre)}</b><span class="mini">Cerrar</span></div>
    <div class="mini">${esc(c.base)} · D${c.diff}</div>
    <div style="font-size:30px;margin:6px 0">10:35</div>
    <div class="mini">tuyo — aún no</div>
    <div class="mini">la zona repuebla en — 22:00</div>
    <div class="mini">lo que vamos viendo — 2 observaciones</div>
  </div>
  <div class="vacio">— y aquí acaba la pantalla —<br><br>el 90 % del alto, vacío</div>
</div></div>

<div id="pd" hidden data-host>
  <div class="pest">
    <button data-ir="vig" aria-selected="true">Vigilando <span class="mini" data-cuenta="#l-vig">1</span></button>
    <button data-ir="sug" aria-selected="false">Sugerencias <span class="mini">${cand.length}</span></button>
    <button data-ir="man" aria-selected="false">Añadir a mano</button>
  </div>

  <div data-panel="vig">
    <div class="barra">
      <label class="buscar"><input placeholder="Buscar enemigo o zona…"></label>
      <select><option>Agrupar por: zona</option><option>Agrupar por: estado</option><option>Sin agrupar</option></select>
      <div class="dens"><button data-d="baja" aria-pressed="true">CÓMODA</button><button data-d="alta" aria-pressed="false">DENSA</button></div>
    </div>
    <div class="pastillas">
      <button class="pastilla" data-et="contando" aria-pressed="true">contando</button>
      <button class="pastilla" data-et="vencido" aria-pressed="true">vencidos</button>
      <button class="pastilla" data-et="sinmuerte" aria-pressed="true">sin muerte aún</button>
    </div>
    ${LEYENDA}
    <div class="filas" id="l-vig">
      <div class="grupo">${esc(c.base)} · D${c.diff} <span class="n">1</span></div>
      <details class="fila" data-busca="${esc(c.nombre.toLowerCase())}" data-et="contando">
        <summary style="grid-template-columns:14px 1fr auto auto">
          <span class="giro">▶</span>
          <span><b>${esc(c.nombre)}</b></span>
          ${proc(null, '22:00', '2', 'zona')}
          <span style="text-align:right;min-width:76px">
            <span class="cuenta-g" style="color:var(--zona)">10:35</span>
            <span class="deQuien" style="color:var(--zona)">DE LA ZONA</span>
          </span>
        </summary>
        <div class="cuerpo">
          La cifra de la zona es de <b>${esc(c.base)} entero</b>, no de este bicho
          —<span class="mini">según eqlwiki.com/${esc(String(c.base).replace(/ /g, '_'))}</span>—.
          Llevamos <b>2 observaciones</b> suyas: un intervalo suelto no es una medida.
        </div>
      </details>
    </div>
  </div>

  <div data-panel="sug" hidden>
    <div class="barra">
      <label class="buscar"><input placeholder="Buscar enemigo…"></label>
      <select><option>Agrupar por: zona</option><option>Sin agrupar</option></select>
      <div class="dens"><button data-d="baja" aria-pressed="false">CÓMODA</button><button data-d="alta" aria-pressed="true">DENSA</button></div>
    </div>
    <p class="mini">De tu última pelea, y ninguno tiene temporizador todavía. Un clic lo abre.</p>
    <div class="filas">
      <div class="grupo">${esc(real.pelea.zone)} <span class="n">${cand.length}</span></div>
      ${cand.map((r) => `<details class="fila" data-busca="${esc(r.n.toLowerCase())}" data-et="cand">
        <summary style="grid-template-columns:14px 1fr auto auto">
          <span class="giro">▶</span><span>${esc(r.n)}</span>
          ${proc(null, null, null, null)}
          <span class="mini">vigilar</span>
        </summary>
        <div class="cuerpo">Sin muertes observadas todavía en esta clave.</div></details>`).join('')}
    </div>
  </div>
  <div data-panel="man" hidden>
    <div class="barra"><label class="buscar"><input placeholder="Nombre del enemigo, tal como sale en el registro…"></label></div>
    <p class="mini">Escrito a mano no se puede poner ni la zona ni la dificultad, y las dos son
    parte de la clave. Por eso las otras dos pestañas son mejor camino.</p>
  </div>
</div>

<div class="nota"><b>Lo que se corrigió.</b> La procedencia <b>se ve sin desplegar</b>:
las tres fuentes van en la fila, la que manda el número grande va rellena y el número
lleva debajo de quién es. Las <b>pestañas cambian de vista</b> (vigilando / sugerencias /
a mano) y las <b>pastillas filtran dentro</b>, sin repetir el mismo control dos veces.
Y en las sugerencias la zona va <b>en la cabecera del grupo</b>: no se repite catorce
veces, y las columnas que valían lo mismo en todas las filas se han ido.</div>
`);

// ══ B · ESCENA ════════════════════════════════════════════════════════════
const filas = real.pelea.filas;
const maxD = Math.max(...filas.map((r) => r.dano), 1);
const esMasc = (n) => / pet$/i.test(n);
const TIPOS = ['melee', 'magic', 'fire', 'cold', 'poison', 'disease', 'ds', 'dot', 'unresistable'];
const clase = (t) => (TIPOS.includes(t) ? `t-${t}` : 't-otro');
const tiposVistos = [...new Set(filas.flatMap((r) => r.tipos.map(([t]) => t)))];

const barraSeg = (r) => {
  const tot = r.tipos.reduce((a, [, v]) => a + v, 0) || 1;
  const ancho = Math.max(4, Math.round(100 * r.dano / maxD));
  return `<span class="seg" style="width:${ancho}%;min-width:60px">${r.tipos
    .map(([t, v]) => `<i class="${clase(t)}" style="width:${(100 * v / tot).toFixed(1)}%" title="${esc(t)} ${mil(v)}"></i>`)
    .join('')}</span>`;
};

const ns = real.pelea.noSabe;
const noSabeHTML = `<div class="noSabe"><span class="h">LO QUE ESTA PELEA NO SABE</span>
  ${ns.unattributed > 0 ? `<div><b class="num">${mil(ns.unattributed)}</b> de daño <b>sin atribuir</b>: entró y no consta de quién.</div>` : ''}
  ${ns.soltado?.daño > 0 ? `<div><b class="num">${mil(ns.soltado.daño)}</b> en <b class="num">${ns.soltado.golpes}</b> golpes de un <b>encantado soltado</b> — deducido, no medido.</div>` : ''}
  ${ns.resistidos > 0 ? `<div><b class="num">${ns.resistidos}</b> hechizos tuyos <b>resistidos</b>.</div>` : ''}
  <div class="mini" style="margin-top:4px">Las cifras de arriba no cuentan esto. Se dice aquí en vez de repartirlo.</div>
</div>`;

const B = marco('Escena — prototipo v2', `
<h1>Escena</h1>
<p class="mini">Prototipo v2 · la sección <b>densa</b> · contenido real:
<b>${esc(real.pelea.zone)}</b> · ${filas.length} combatientes · ${real.pelea.duration} s.</p>

<div class="conmutador">
  <button aria-pressed="true" onclick="ea.hidden=false;ed.hidden=true">ANTES</button>
  <button aria-pressed="false" onclick="ea.hidden=true;ed.hidden=false">DESPUÉS</button>
</div>

<div id="ea"><div class="antes">
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="color:#7d7263;text-align:left"><th>Combatiente</th><th>Daño</th><th>DPS</th><th>Recibido</th></tr>
    ${filas.map((r) => `<tr style="border-top:1px solid #2f2921"><td style="padding:4px 0">${esc(r.n)}</td>
      <td class="num">${mil(r.dano)}</td><td class="num">${r.dps}</td><td class="num">${mil(r.recibido)}</td></tr>`).join('')}
  </table>
  <p class="mini" style="margin-top:12px">${filas.length} filas iguales, sin ordenar ni filtrar,
  la barra sin tipos, y «lo que esta pelea no sabe» en un bloque aparte más abajo.</p>
</div></div>

<div id="ed" hidden data-host>
  <div class="pest">
    <button data-ir="comb" aria-selected="true">Combatientes <span class="mini" data-cuenta="#l-comb">${filas.length}</span></button>
    <button data-ir="botin" aria-selected="false">Botín <span class="mini">${real.pelea.botin.length}</span></button>
    <button data-ir="linea" aria-selected="false">Línea de tiempo</button>
  </div>
  <div data-panel="comb">
    ${noSabeHTML}
    <div class="barra">
      <label class="buscar"><input placeholder="Buscar combatiente…"></label>
      <select><option>Ordenar por: daño</option><option>Ordenar por: dps</option><option>Ordenar por: recibido</option></select>
      <div class="dens"><button data-d="baja" aria-pressed="false">CÓMODA</button><button data-d="alta" aria-pressed="true">DENSA</button></div>
    </div>
    <div class="pastillas">
      <button class="pastilla" data-et="aliado" aria-pressed="true">tuyos</button>
      <button class="pastilla" data-et="enemigo" aria-pressed="true">enemigos</button>
      <button class="pastilla" data-et="mascota" aria-pressed="false">mascotas</button>
    </div>
    <div class="leyenda">
      <b style="color:var(--tinta)">Tipo de daño:</b>
      ${tiposVistos.map((t) => `<span><i class="${clase(t)}" style="display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px"></i> ${esc(t)}</span>`).join('')}
      <span class="mini">la barra de cada fila va partida por tipo</span>
    </div>
    <div class="filas" id="l-comb">
      <div class="grupo">${esc(real.pelea.zone)} · ${real.pelea.duration}s <span class="n">${filas.length}</span></div>
      ${filas.map((r) => `<details class="fila" data-busca="${esc(r.n.toLowerCase())}"
        data-et="${r.lado === 'enemy' ? 'enemigo' : 'aliado'} ${esMasc(r.n) ? 'mascota' : 'entero'}">
        <summary style="grid-template-columns:14px 1fr auto 130px auto">
          <span class="giro">▶</span>
          <span>${esc(r.n)} ${esMasc(r.n) ? '<span class="et masc">mascota</span>' : ''}${r.lado === 'enemy' ? '<span class="et enem">enemigo</span>' : ''}</span>
          <span class="num" style="font-weight:700">${r.dps}<span class="mini"> dps</span></span>
          ${barraSeg(r)}
          <span class="num mini">${mil(r.dano)}</span>
        </summary>
        <div class="cuerpo">
          recibido <b class="num">${mil(r.recibido)}</b> · curado <b class="num">${mil(r.curado)}</b> ·
          precisión <b class="num">${r.precision ?? '—'}%</b> · críticos <b class="num">${r.criticos ?? 0}</b>
          ${r.tipos.length ? `<div style="margin-top:5px">${r.tipos.map(([t, v]) =>
    `<span class="et gris"><i class="${clase(t)}" style="display:inline-block;width:7px;height:7px;border-radius:2px"></i> ${esc(t)} <span class="num">${mil(v)}</span></span>`).join(' ')}</div>` : ''}
        </div></details>`).join('')}
    </div>
  </div>
  <div data-panel="botin" hidden>
    <div class="barra"><label class="buscar"><input placeholder="Buscar objeto…"></label></div>
    <div class="filas">${real.pelea.botin.map((b) => `<details class="fila" data-busca="${esc(String(b.item).toLowerCase())}">
      <summary style="grid-template-columns:14px 1fr auto auto"><span class="giro">▶</span>
        <span>${esc(b.item)}</span><span class="mini">${esc(b.from ?? '')}</span>
        <span class="num mini">×${b.qty ?? 1}</span></summary>
      <div class="cuerpo">${b.sold ? `Vendido por ${esc(b.sold)}` : 'Recogido'} · segundo ${b.t ?? '—'}</div></details>`).join('')}</div>
  </div>
  <div data-panel="linea" hidden><div class="vacio">La línea de tiempo, en su pestaña.</div></div>
</div>

<div class="nota"><b>Lo que se corrigió.</b> «Lo que esta pelea no sabe» va
<b>arriba y siempre a la vista</b> —58 sin atribuir, 1.703 de un encantado soltado—,
no en un bloque que se pierde al fondo. Y la barra de cada fila va
<b>partida por tipo de daño</b>, con su leyenda una sola vez. Lo demás se mantiene:
mascotas apagadas por defecto, filas de una línea, buscador y densidad.</div>
`);

fs.writeFileSync(`${SALIDA}/2026-08-20-reapariciones.html`, A);
fs.writeFileSync(`${SALIDA}/2026-08-20-escena.html`, B);
console.log('v2 escritos ·', filas.length, 'combatientes ·', tiposVistos.length, 'tipos de daño ·',
  `noSabe: ${ns.unattributed} sin atribuir, ${ns.soltado?.daño ?? 0} soltado`);
