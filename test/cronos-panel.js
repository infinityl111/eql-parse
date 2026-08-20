/**
 * EL PANEL DECLARA QUÉ PRODUCE, SIN ABRIR UNA VENTANA.
 *
 * Misma vara que la sección: si al terminar hace falta levantar un overlay para
 * saber qué rótulos salen, el panel no ha aprovechado nada de lo aprendido.
 */
import * as P from '../ui/cronos-panel.js';
import { t, setLang, TRANSLATED } from '../src/i18n.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};
setLang('es');

const f = (i, over = {}) => ({
  i, nombre: `bicho ${i}`, restante: 600, restanteTxt: '10:00', transcurrido: 0, ...over,
});

console.log('\nlos que ya deberían estar van ARRIBA');
{
  const o = P.ordena([f(1), f(2, { restante: 0, transcurrido: 30 }), f(3, { restante: 120 })]);
  ok(o[0].i === 2, 'el vencido, el primero', 'el panel se mira de reojo: lo accionable va antes');
  ok(o[1].i === 3 && o[2].i === 1, 'y entre los que cuentan, el que antes vuelve');
}
{
  const o = P.ordena([
    f(1, { restante: 0, transcurrido: 30 }),
    f(2, { restante: null, transcurrido: 900 }),
    f(3, { restante: 0, transcurrido: 120 }),
  ]);
  ok(o.map((x) => x.i).join() === '2,3,1', 'entre vencidos manda el que lleva MÁS esperando');
  ok(P.ordena([f(1, { restante: null })])[0].i === 1,
    'CONTROL: restante en null cuenta como vencido, no como cero segundos');
}

console.log('\ntres estados y no dos: esperando no es vencido');
{
  ok(P.estadoDe({ esperando: true, restante: 0 }) === 'esperando',
    'sin muerte es ESPERANDO, aunque no le quede tiempo',
    'decir «ya debería estar» de un bicho del que no sabemos ni cuándo murió es inventarlo');
  ok(P.estadoDe({ restante: 0 }) === 'vencido', 'con muerte y a cero, vencido');
  ok(P.estadoDe({ restante: 90 }) === 'contando', 'y con tiempo, contando');

  const o = P.ordena([
    f(1, { esperando: true }),
    f(2, { restante: 300 }),
    f(3, { restante: 0, transcurrido: 60 }),
  ]);
  ok(o.map((x) => x.i).join() === '3,2,1',
    'el orden es vencido, contando, esperando',
    'lo accionable primero; lo que ni ha empezado, al final');
}

console.log('\nun filtro que vacía dice qué dejó fuera');
{
  ok(P.claveDelVacio({ total: 4, visibles: 2 }) === null, 'con filas visibles no dice nada');
  ok(P.claveDelVacio({ total: 0, visibles: 0 })?.clave === 'cro.vacio',
    'sin ningún crono: «no hay ninguno»');
  const x = P.claveDelVacio({ total: 4, visibles: 0 });
  ok(x?.clave === 'pan.fueraDeZona' && x.vars.n === 4,
    'con cronos pero todos filtrados: dice CUÁNTOS hay fuera',
    'una lista vacía y una filtrada a cero se ven igual y son cosas distintas');
}

console.log('\nla sección declara qué produce, y lo produce');
{
  const html = [
    P.construye({ fichas: [] }),
    P.construye({ fichas: [], total: 4 }),
    P.construye({ fichas: [f(0), f(1, { restante: 0 })], total: 2, zona: 'Old Guk' }),
    P.construye({ fichas: [f(0, { esperando: true })] }),
    P.construye({ fichas: [f(0, { cota: { huecos: 1 } })] }),
    P.construye({ fichas: [f(0, { cota: { huecos: 9 } })] }),
  ].join('\n');

  const marca = (k) => t(k).split(/\{[^}]*\}/).map((x) => x.trim())
    .sort((a, b) => b.length - a.length)[0] ?? '';
  const sinCaso = P.CLAVES.filter((k) => {
    const m = marca(k).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return !m || !html.includes(m);
  });
  ok(sinCaso.length === 0, 'ninguna clave declarada sin caso que la genere',
    sinCaso.length ? sinCaso.join(', ') : `${P.CLAVES.length} claves`);
  ok(!/\{[a-z]+\}/i.test(html), 'no queda ninguna llave sin sustituir');
  ok(html.length > 800, 'CONTROL: y el HTML se ha construido de verdad', `${html.length} caracteres`);
}

console.log('\nel número de huecos va SIEMPRE con la cota');
{
  const uno = P.construye({ fichas: [f(0, { cota: { huecos: 1 } })] });
  ok(uno.includes(t('cro.cotaH1')), 'con un hueco lo dice en singular',
    'una cota de un hueco es cierta y floja: sin el número se lee igual que una de nueve');
  ok(P.construye({ fichas: [f(0)] }).includes('pan-h') === false,
    'y sin cota no se inventa ningún recuento');
}

console.log('\nla firma no lleva dentro lo que cambia cada segundo');
{
  const m = (s) => ({ fichas: [f(0, { restante: s, restanteTxt: `0${s / 60}:00` })] });
  ok(P.construye(m(600), false) === P.construye(m(120), false),
    'dos instantes distintos dan la MISMA firma');
  ok(P.construye(m(600), true) !== P.construye(m(120), true),
    'CONTROL: y con los números puestos sí se distinguen');
}

console.log('\ny el marco viene dentro, no copiado');
{
  const h = P.construye({ fichas: [f(0)], opacidad: 0.6 });
  ok(h.includes('data-esq="se"') && h.includes('type="range"'),
    'las esquinas y el deslizador salen del módulo común',
    'si se copiaran, el tercer overlay volvería a copiarlos');
}

console.log('\nlos cinco idiomas');
for (const l of TRANSLATED) {
  setLang(l);
  const faltan = P.CLAVES.filter((k) => { const v = t(k); return !v || v === k; });
  ok(faltan.length === 0, `${l}: las ${P.CLAVES.length} claves`, faltan.join(', '));
}
setLang('es');

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
