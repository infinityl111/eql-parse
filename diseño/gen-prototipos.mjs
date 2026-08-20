/**
 * Genera los dos prototipos de diseño DESDE EL ALMACÉN REAL.
 *
 * Se generan y no se escriben a mano a propósito: así las cifras que se ven son
 * las que hay, y se puede volver a generar cuando cambien. Ninguna es inventada.
 */
import fs from 'node:fs';

const real = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SALIDA = process.argv[3];
const HOY = '20 de agosto de 2026';

/** ══ EL KIT COMPARTIDO ══════════════════════════════════════════════════
 * Idéntico en los dos prototipos A PROPÓSITO: si las dos secciones lo
 * necesitan, no es de ninguna de las dos — es una pieza común. Lo que aquí
 * está duplicado, en la aplicación sería un módulo.
 */
const KIT_CSS = `
:root{
  --fondo:#14110d; --alto:#1c1813; --linea:#2f2921; --linea2:#3d3529;
  --tinta:#efe7d8; --tinta2:#b3a793; --tenue:#7d7263;
  --acento:#d9a441; --gema:#63b083; --alarma:#c9603a; --frio:#5b8fb9;
  --r:7px; --f:13px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--tinta);
  font:var(--f)/1.45 "Segoe UI",system-ui,sans-serif}
h1,h2,h3{margin:0;font-weight:650;letter-spacing:.2px}
.marco{max-width:1180px;margin:0 auto;padding:18px 22px 60px}

/* ── PIEZA 1 · pestañas DENTRO de la sección ─────────────────────────── */
.pest{display:flex;gap:2px;border-bottom:1px solid var(--linea);margin:14px 0 0}
.pest button{background:none;border:0;border-bottom:2px solid transparent;color:var(--tenue);
  font:600 12px/1 inherit;padding:9px 14px;cursor:pointer;letter-spacing:.3px}
.pest button:hover{color:var(--tinta2)}
.pest button[aria-selected=true]{color:var(--tinta);border-bottom-color:var(--acento)}
.pest .cuenta{color:var(--tenue);font-weight:400;margin-left:5px}

/* ── PIEZA 2 · barra de control: buscador + agrupar + densidad ───────── */
.barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;
  padding:10px 0;border-bottom:1px solid var(--linea)}
.buscar{flex:1 1 220px;min-width:170px;position:relative}
.buscar input{width:100%;background:var(--alto);border:1px solid var(--linea2);
  border-radius:var(--r);color:var(--tinta);font:inherit;padding:7px 10px 7px 28px}
.buscar input:focus{outline:0;border-color:var(--acento)}
.buscar::before{content:"⌕";position:absolute;left:9px;top:6px;color:var(--tenue);font-size:15px}
select{background:var(--alto);border:1px solid var(--linea2);border-radius:var(--r);
  color:var(--tinta);font:inherit;padding:7px 8px}
.dens{display:flex;gap:0;border:1px solid var(--linea2);border-radius:var(--r);overflow:hidden}
.dens button{background:none;border:0;color:var(--tenue);font:600 11px/1 inherit;
  padding:8px 10px;cursor:pointer}
.dens button[aria-pressed=true]{background:var(--linea);color:var(--tinta)}

/* ── PIEZA 3 · pastillas de filtro, encendidas/apagadas y a la vista ─── */
.pastillas{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}
.pastilla{background:none;border:1px solid var(--linea2);border-radius:99px;
  color:var(--tenue);font:600 11px/1 inherit;padding:5px 11px;cursor:pointer;
  display:inline-flex;gap:5px;align-items:center}
.pastilla:hover{border-color:var(--tenue)}
.pastilla[aria-pressed=true]{background:var(--acento);border-color:var(--acento);color:#1a1408}
.pastilla .n{opacity:.7;font-weight:400}

/* ── PIEZA 4 · filas plegables ───────────────────────────────────────── */
.filas{border:1px solid var(--linea);border-radius:var(--r);overflow:hidden;margin-top:10px}
.fila{border-bottom:1px solid var(--linea)}
.fila:last-child{border-bottom:0}
.fila>summary{display:grid;align-items:center;gap:10px;padding:7px 11px;cursor:pointer;
  list-style:none;grid-template-columns:14px 1fr auto auto auto}
.fila>summary::-webkit-details-marker{display:none}
.fila>summary:hover{background:var(--alto)}
.fila[open]>summary{background:var(--alto);border-bottom:1px solid var(--linea)}
.giro{color:var(--tenue);transition:transform .12s;font-size:10px}
.fila[open] .giro{transform:rotate(90deg)}
.cuerpo{padding:9px 11px 12px 35px;background:#181410;font-size:12px;color:var(--tinta2)}
.compacta .fila>summary{padding:3px 11px;font-size:12px}
.compacta .barrita{height:3px}

/* ── PIEZA 5 · etiquetas compactas en vez de texto largo ─────────────── */
.et{display:inline-block;border-radius:4px;padding:1px 6px;font:600 10px/1.6 inherit;
  letter-spacing:.3px;white-space:nowrap}
.et.tuyo{background:#3a2f14;color:var(--acento)}
.et.zona{background:#16303a;color:var(--frio)}
.et.enem{background:#3a1f16;color:var(--alarma)}
.et.masc{background:#241f2f;color:#9b8ec7}
.et.ok{background:#16301f;color:var(--gema)}
.et.gris{background:var(--linea);color:var(--tinta2)}
.num{font-variant-numeric:tabular-nums}
.barrita{height:5px;border-radius:3px;background:var(--linea);overflow:hidden;min-width:52px}
.barrita i{display:block;height:100%;background:var(--acento)}
.fila.ene .barrita i{background:var(--alarma)}

/* ── El armazón del antes/después ─────────────────────────────────────── */
.conmutador{display:flex;gap:6px;margin:0 0 6px}
.conmutador button{background:var(--alto);border:1px solid var(--linea2);border-radius:var(--r);
  color:var(--tinta2);font:700 12px/1 inherit;padding:9px 16px;cursor:pointer}
.conmutador button[aria-pressed=true]{background:var(--acento);border-color:var(--acento);color:#1a1408}
.nota{background:#1a1610;border:1px solid var(--linea);border-left:3px solid var(--acento);
  border-radius:var(--r);padding:11px 14px;margin:14px 0;color:var(--tinta2);font-size:12.5px}
.nota b{color:var(--tinta)}
.antes{border:1px dashed var(--linea2);border-radius:var(--r);padding:20px;background:#171310}
.vacio{color:var(--tenue);text-align:center;padding:70px 0;font-style:italic}
.pie{color:var(--tenue);font-size:11.5px;margin-top:34px;border-top:1px solid var(--linea);padding-top:12px}
.mini{color:var(--tenue);font-size:11px}
`;

const KIT_JS = `
// Las piezas del kit, en crudo: pestañas, pastillas, densidad y buscador.
// Aquí funcionan para poder TOCARLAS; en la aplicación serían un módulo.
document.addEventListener('click', (e) => {
  const p = e.target.closest('.pest button');
  if (p) {
    for (const b of p.parentElement.children) b.setAttribute('aria-selected', b === p);
    const caja = p.closest('[data-panel-host]');
    for (const s of caja.querySelectorAll('[data-panel]')) {
      s.hidden = s.dataset.panel !== p.dataset.ir;
    }
  }
  const t = e.target.closest('.pastilla, .dens button, .conmutador button');
  if (t) {
    const grupo = t.closest('.dens, .conmutador');
    if (grupo) for (const b of grupo.children) b.setAttribute('aria-pressed', b === t);
    else t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true');
    aplica(t.closest('[data-panel-host]') || document);
  }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('.buscar input, select')) aplica(e.target.closest('[data-panel-host]') || document);
});
function aplica(raiz) {
  const q = (raiz.querySelector('.buscar input')?.value || '').toLowerCase().trim();
  const apagadas = [...raiz.querySelectorAll('.pastilla[aria-pressed=false]')].map((b) => b.dataset.et);
  const compacta = raiz.querySelector('.dens button[aria-pressed=true]')?.dataset.d === 'alta';
  for (const lista of raiz.querySelectorAll('.filas')) lista.classList.toggle('compacta', !!compacta);
  for (const f of raiz.querySelectorAll('.fila')) {
    const texto = f.dataset.busca || '';
    const ets = (f.dataset.et || '').split(' ').filter(Boolean);
    const fuera = ets.some((x) => apagadas.includes(x));
    f.hidden = fuera || (q && !texto.includes(q));
  }
  for (const c of raiz.querySelectorAll('[data-cuenta]')) {
    const lista = raiz.querySelector(c.dataset.cuenta);
    if (lista) c.textContent = [...lista.querySelectorAll('.fila')].filter((f) => !f.hidden).length;
  }
}
document.addEventListener('DOMContentLoaded', () => aplica(document));
`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const marco = (titulo, cuerpo) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>${KIT_CSS}</style>
</head><body><div class="marco">
${cuerpo}
<p class="pie">Prototipo de diseño · ${HOY} · <b>las cifras son REALES</b>, sacadas de
<code>${esc(real.origen)}</code> el ${esc(real.generado)}. No es fuente de datos y no se empaqueta.
Generado por <code>gen-prototipos.mjs</code>: se vuelve a generar, no se edita a mano.</p>
</div><script>${KIT_JS}</script></body></html>`;

// ══════════════════════════════════════════════════════════════════════════
// PROTOTIPO A · REAPARICIONES — la sección vacía
// ══════════════════════════════════════════════════════════════════════════
const c = real.cronos[0] ?? { nombre: '—', base: '—', diff: null };
const candidatos = real.pelea.filas.filter((r) => r.lado === 'enemy' && !/ pet$/i.test(r.n))
  .slice(0, 14);

const filaCrono = (nombre, zona, diff, restante, pct, obs, estado) => `
<details class="fila" data-busca="${esc((nombre + ' ' + zona).toLowerCase())}" data-et="${estado}">
  <summary>
    <span class="giro">▶</span>
    <span><b>${esc(nombre)}</b> <span class="et zona">${esc(zona)}${diff != null ? ` D${diff}` : ''}</span></span>
    <span class="num" style="color:${estado === 'vencido' ? 'var(--gema)' : 'var(--acento)'};font-weight:700">${esc(restante)}</span>
    <span class="barrita" style="width:90px"><i style="width:${pct}%"></i></span>
    <span class="mini num">${obs}</span>
  </summary>
  <div class="cuerpo">
    <div><span class="et tuyo">tuyo</span> aún no ·
      <span class="et zona">la zona repuebla en</span> <b class="num">22:00</b>
      <span class="mini">según eqlwiki.com/Nagafen's_Lair</span></div>
    <div style="margin-top:6px"><span class="et gris">lo que vamos viendo</span>
      <b class="num">${obs}</b> — un intervalo suelto no es una medida.</div>
  </div>
</details>`;

const A = marco('Reapariciones — prototipo', `
<h1>Reapariciones</h1>
<p class="mini">Prototipo A · la sección <b>vacía</b>. Contenido real: ${real.cronos.length} temporizador abierto.</p>

<div class="conmutador">
  <button aria-pressed="true" onclick="document.getElementById('pa').hidden=false;document.getElementById('pd').hidden=true">ANTES</button>
  <button aria-pressed="false" onclick="document.getElementById('pa').hidden=true;document.getElementById('pd').hidden=false">DESPUÉS</button>
</div>

<div id="pa">
  <div class="antes">
    <h2 style="font-size:19px">Temporizadores de reaparición</h2>
    <p class="mini">Se abren y se cierran a mano. Ninguna muerte los enciende sola.</p>
    <div style="display:flex;gap:6px;margin:14px 0">
      <input placeholder="Nombre del enemigo, tal como sale en el registro"
        style="flex:1;max-width:420px;background:#1c1813;border:1px solid #3d3529;border-radius:6px;color:#efe7d8;padding:7px 9px">
      <button style="background:#1c1813;border:1px solid #3d3529;border-radius:6px;color:#efe7d8;padding:7px 12px">Vigilar un enemigo</button>
    </div>
    <div style="border:1px solid #2f2921;border-radius:7px;padding:13px;max-width:310px">
      <div style="display:flex;justify-content:space-between"><b>${esc(c.nombre)}</b>
        <span class="mini">Cerrar</span></div>
      <div class="mini">${esc(c.base)} · D${c.diff}</div>
      <div style="font-size:30px;margin:6px 0">10:35</div>
      <div class="mini">tuyo — aún no</div>
      <div class="mini">la zona repuebla en — 22:00</div>
      <div class="mini">lo que vamos viendo — 2 observaciones</div>
    </div>
    <div class="vacio">— y aquí acaba la pantalla —<br><br>
      el 90 % del alto, vacío, con un temporizador abierto</div>
  </div>
</div>

<div id="pd" hidden data-panel-host>
  <div class="pest">
    <button data-ir="activos" aria-selected="true">Contando <span class="cuenta" data-cuenta="#lista-activos">1</span></button>
    <button data-ir="listos" aria-selected="false">Ya deberían estar <span class="cuenta">0</span></button>
    <button data-ir="poner" aria-selected="false">Añadir</button>
  </div>

  <div data-panel="activos">
    <div class="barra">
      <label class="buscar"><input placeholder="Buscar enemigo o zona…"></label>
      <select><option>Agrupar por: zona</option><option>Agrupar por: dificultad</option>
        <option>Agrupar por: estado</option><option>Sin agrupar</option></select>
      <div class="dens"><button data-d="baja" aria-pressed="true">CÓMODA</button>
        <button data-d="alta" aria-pressed="false">DENSA</button></div>
    </div>
    <div class="pastillas">
      <button class="pastilla" data-et="contando" aria-pressed="true">contando <span class="n">1</span></button>
      <button class="pastilla" data-et="vencido" aria-pressed="true">vencidos <span class="n">0</span></button>
      <button class="pastilla" data-et="sinmuerte" aria-pressed="true">sin muerte aún <span class="n">0</span></button>
    </div>
    <div class="filas" id="lista-activos">
      ${filaCrono(c.nombre, c.base, c.diff, '10:35', 48, '2 obs', 'contando')}
    </div>
    <div class="nota"><b>El hueco se llena con lo que ya sabemos.</b> Debajo, los enemigos
      de tu última pelea que <b>todavía no tienen temporizador</b>, con sus observaciones.
      Un clic los vigila. Es una propuesta: hoy hay que teclear el nombre a mano.</div>
    <div class="pastillas">
      <button class="pastilla" data-et="cand" aria-pressed="true">de tu última pelea <span class="n">${candidatos.length}</span></button>
      <button class="pastilla" data-et="nunca" aria-pressed="false">nunca vigilados</button>
    </div>
    <div class="filas">
      ${candidatos.map((r) => `<details class="fila ene" data-busca="${esc(r.n.toLowerCase())}" data-et="cand">
        <summary><span class="giro">▶</span>
          <span>${esc(r.n)} <span class="et enem">${esc(real.pelea.zone)}</span></span>
          <span class="mini">sin temporizador</span>
          <span class="barrita" style="width:60px"><i style="width:0"></i></span>
          <span class="mini">vigilar</span>
        </summary>
        <div class="cuerpo">Murió en <b>${esc(real.pelea.label.slice(0, 40))}…</b> ·
          daño recibido <span class="num">${r.dano}</span></div></details>`).join('')}
    </div>
  </div>
  <div data-panel="listos" hidden><div class="vacio">Ninguno ha vencido todavía.</div></div>
  <div data-panel="poner" hidden>
    <div class="barra"><label class="buscar"><input placeholder="Nombre del enemigo…"></label></div>
    <p class="mini">Y desde una pelea, en Escena, con el botón «Poner temporizador».</p>
  </div>
</div>

<div class="nota"><b>Qué cambia, en corto.</b> Pestañas dentro de la sección
(contando / vencidos / añadir) · buscador siempre visible · agrupar por zona,
dificultad o estado · pastillas de filtro encendidas y apagadas · fichas
convertidas en filas plegables —una línea cada una, se abre la que interesa— ·
etiquetas compactas en vez de tres renglones de texto · densidad a elegir ·
y el hueco relleno con candidatos reales en vez de aire.</div>
`);

// ══════════════════════════════════════════════════════════════════════════
// PROTOTIPO B · ESCENA — la sección densa
// ══════════════════════════════════════════════════════════════════════════
const filas = real.pelea.filas;
const maxD = Math.max(...filas.map((r) => r.dano), 1);
const esMasc = (n) => / pet$/i.test(n);
const filaComb = (r) => {
  const et = [r.lado === 'enemy' ? 'enemigo' : 'aliado', esMasc(r.n) ? 'mascota' : 'entero'].join(' ');
  return `<details class="fila ${r.lado === 'enemy' ? 'ene' : ''}"
    data-busca="${esc(r.n.toLowerCase())}" data-et="${et}">
    <summary>
      <span class="giro">▶</span>
      <span>${esc(r.n)}
        ${esMasc(r.n) ? '<span class="et masc">mascota</span>' : ''}
        ${r.lado === 'enemy' ? '<span class="et enem">enemigo</span>' : '<span class="et tuyo">tuyo</span>'}
        ${r.muertes ? `<span class="et gris">murió ${r.muertes}×</span>` : ''}</span>
      <span class="num" style="font-weight:700">${r.dps}<span class="mini"> dps</span></span>
      <span class="barrita" style="width:110px"><i style="width:${Math.round(100 * r.dano / maxD)}%"></i></span>
      <span class="num mini">${r.dano.toLocaleString('es-ES')}</span>
    </summary>
    <div class="cuerpo">
      recibido <b class="num">${(r.recibido ?? 0).toLocaleString('es-ES')}</b> ·
      curado <b class="num">${(r.curado ?? 0).toLocaleString('es-ES')}</b> ·
      precisión <b class="num">${r.precision ?? '—'}%</b> ·
      críticos <b class="num">${r.criticos ?? 0}</b> ·
      mayor golpe <b class="num">${r.max ?? 0}</b>
      ${r.hab.length ? `<div style="margin-top:6px">${r.hab.map(([n, v]) =>
    `<span class="et gris">${esc(n)} <span class="num">${typeof v === 'number' ? v : (v?.sum ?? '')}</span></span>`).join(' ')}</div>` : ''}
    </div>
  </details>`;
};

const B = marco('Escena — prototipo', `
<h1>Escena</h1>
<p class="mini">Prototipo B · la sección <b>densa</b>. Contenido real:
<b>${esc(real.pelea.zone)}</b> · ${filas.length} combatientes · ${real.pelea.duration} s ·
${real.pelea.total.toLocaleString('es-ES')} de daño.</p>

<div class="conmutador">
  <button aria-pressed="true" onclick="document.getElementById('ea').hidden=false;document.getElementById('ed').hidden=true">ANTES</button>
  <button aria-pressed="false" onclick="document.getElementById('ea').hidden=true;document.getElementById('ed').hidden=false">DESPUÉS</button>
</div>

<div id="ea"><div class="antes">
  <h2 style="font-size:19px">${esc(real.pelea.label.slice(0, 80))}…</h2>
  <p class="mini">${esc(real.pelea.zone)} · ${real.pelea.duration}s</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px">
    <tr style="color:#7d7263;text-align:left"><th>Combatiente</th><th>Daño</th><th>DPS</th><th>Recibido</th><th>Curado</th></tr>
    ${filas.map((r) => `<tr style="border-top:1px solid #2f2921">
      <td style="padding:4px 0">${esc(r.n)}</td><td class="num">${r.dano.toLocaleString('es-ES')}</td>
      <td class="num">${r.dps}</td><td class="num">${(r.recibido ?? 0).toLocaleString('es-ES')}</td>
      <td class="num">${(r.curado ?? 0).toLocaleString('es-ES')}</td></tr>`).join('')}
  </table>
  <p class="mini" style="margin-top:14px">${filas.length} filas seguidas, todas del mismo tamaño,
  sin ordenar, sin filtrar, sin agrupar y sin poder plegar ninguna. Las mascotas
  ocupan lo mismo que Campeón.</p>
</div></div>

<div id="ed" hidden data-panel-host>
  <div class="pest">
    <button data-ir="comb" aria-selected="true">Combatientes <span class="cuenta" data-cuenta="#lista-comb">${filas.length}</span></button>
    <button data-ir="botin" aria-selected="false">Botín <span class="cuenta">${real.pelea.botin.length}</span></button>
    <button data-ir="linea" aria-selected="false">Línea de tiempo</button>
  </div>
  <div data-panel="comb">
    <div class="barra">
      <label class="buscar"><input placeholder="Buscar combatiente…"></label>
      <select><option>Agrupar por: bando</option><option>Agrupar por: tipo</option>
        <option>Ordenar por: daño</option><option>Ordenar por: dps</option>
        <option>Ordenar por: recibido</option></select>
      <div class="dens"><button data-d="baja" aria-pressed="false">CÓMODA</button>
        <button data-d="alta" aria-pressed="true">DENSA</button></div>
    </div>
    <div class="pastillas">
      <button class="pastilla" data-et="aliado" aria-pressed="true">tuyos <span class="n">${filas.filter((r) => r.lado !== 'enemy').length}</span></button>
      <button class="pastilla" data-et="enemigo" aria-pressed="true">enemigos <span class="n">${filas.filter((r) => r.lado === 'enemy').length}</span></button>
      <button class="pastilla" data-et="mascota" aria-pressed="false">mascotas <span class="n">${filas.filter((r) => esMasc(r.n)).length}</span></button>
    </div>
    <div class="filas" id="lista-comb">${filas.map(filaComb).join('')}</div>
  </div>
  <div data-panel="botin" hidden>
    <div class="barra"><label class="buscar"><input placeholder="Buscar objeto…"></label>
      <select><option>Agrupar por: de quién cayó</option><option>Sin agrupar</option></select></div>
    <div class="filas">${real.pelea.botin.map((b) => `<details class="fila" data-busca="${esc(String(b.item).toLowerCase())}">
      <summary><span class="giro">▶</span><span>${esc(b.item)}
        ${b.sold ? '<span class="et ok">vendido</span>' : ''}</span>
        <span class="mini">${esc(b.from ?? '')}</span><span></span><span class="num mini">×${b.qty ?? 1}</span></summary>
      <div class="cuerpo">${b.sold ? `Vendido por ${esc(b.sold)}` : 'Recogido'} · segundo ${b.t ?? '—'} de la pelea</div>
    </details>`).join('')}</div>
  </div>
  <div data-panel="linea" hidden><div class="vacio">La línea de tiempo va aquí, en su pestaña,
    en vez de empujar la tabla hacia abajo.</div></div>
</div>

<div class="nota"><b>Qué cambia, en corto.</b> Las tres vistas de la pelea pasan a
<b>pestañas dentro de la sección</b> en vez de tres entradas de la barra lateral ·
buscador siempre visible · ordenar y agrupar por lo que quieras · las mascotas
<b>apagadas por defecto</b> con una pastilla para encenderlas ·
${filas.length} filas de una línea, y se abre la que interesa ·
etiquetas compactas —<span class="et masc">mascota</span>
<span class="et enem">enemigo</span>— en vez de renglones de texto · densidad a elegir.</div>
`);

fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(`${SALIDA}/2026-08-20-reapariciones.html`, A);
fs.writeFileSync(`${SALIDA}/2026-08-20-escena.html`, B);
console.log('escritos los dos prototipos en', SALIDA);
console.log('  reapariciones:', A.length, 'bytes ·', real.cronos.length, 'crono real');
console.log('  escena:', B.length, 'bytes ·', filas.length, 'combatientes reales');
