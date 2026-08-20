/**
 * LAS CINCO PIEZAS, VERIFICADAS UNA VEZ.
 *
 * Verificar un módulo compartido una vez cubre las quince pantallas; verificar
 * quince implementaciones cuesta quince veces. Por eso esta batería existe
 * antes que ninguna sección construida encima.
 *
 * ── Y LA COMPROBACIÓN DE RÓTULOS VA AQUÍ, NO AL FINAL ─────────────────────
 *
 * En Reapariciones, mirar qué rótulos podía producir la sección hizo falta
 * levantar la aplicación, y costó CINCO causas —todas del instrumento— llegar a
 * medir. Aquí no hace falta ninguna: las piezas son funciones puras que
 * devuelven una cadena, así que **cada clave se alcanza llamando**.
 *
 * La regla que se fija: `piezas.js` declara en `CLAVES` todo lo que puede
 * producir, y esta prueba exige que **cada una salga de una llamada de
 * verdad**. Una clave que ninguna llamada produce es un rótulo muerto — el
 * fósil de algo que se acordó hablando y no llegó al código.
 */
import * as P from '../ui/piezas.js';
import { t, setLang, TRANSLATED } from '../src/i18n.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};
setLang('es');

/** Todo el HTML que las piezas saben producir, en todos sus estados. */
function todoElHtml() {
  const trozos = [];
  trozos.push(P.pestañas({ items: [{ id: 'a', rotulo: 'Vigilando', n: 3 }, { id: 'b', rotulo: 'Añadir' }], activa: 'a' }));
  trozos.push(P.barraControl({ agrupar: [{ id: 'zona', rotulo: 'Agrupar por: zona' }] }));
  trozos.push(P.barraControl({ densidad: 'alta' }));
  trozos.push(P.pastillas({ items: [{ et: 'enemigo', rotulo: 'enemigos', n: 4 }, { et: 'mascota', rotulo: 'mascotas', on: false }] }));
  trozos.push(P.filas({ grupos: [] }));                        // el estado vacío
  trozos.push(P.filas({
    grupos: [{ rotulo: 'Najena', filas: [{ busca: 'x', et: ['enemigo'], celdas: ['<span>x</span>'], cuerpo: 'c' }] }],
  }));
  for (const b of P.BANDOS) trozos.push(P.etiqueta(b));
  trozos.push(P.procedencia({ tuyo: null, zona: '22:00', visto: '2', manda: 'zona' }));
  trozos.push(P.leyendaProcedencia({ abierta: true }));
  return trozos.join('\n');
}

console.log('\ncada clave declarada la produce una llamada de verdad');
{
  const html = todoElHtml();
  const sinCaso = P.CLAVES.filter((k) => {
    const texto = t(k);
    return !texto || !html.includes(texto.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  });
  ok(sinCaso.length === 0, 'ninguna clave del módulo sin caso que la genere',
    sinCaso.length ? sinCaso.join(', ') : `${P.CLAVES.length} claves, todas alcanzadas`);

  // CONTROL: si la lista estuviera vacía, lo de arriba pasaría solo.
  ok(P.CLAVES.length >= 15, 'CONTROL: la lista de claves no está vacía', P.CLAVES.length);
  ok(html.length > 800, 'CONTROL: y el HTML se ha construido de verdad', `${html.length} caracteres`);
}

console.log('\nlas cinco piezas construyen lo que dicen');
{
  const p = P.pestañas({ items: [{ id: 'a', rotulo: 'A' }, { id: 'b', rotulo: 'B' }], activa: 'b' });
  ok(/aria-selected="true"[^>]*>B|data-ir="b" aria-selected="true"/.test(p), 'las pestañas marcan la activa');
  ok(P.pestañas({ items: [] }) === '', 'y sin elementos no pintan nada');

  const b = P.barraControl({
    agrupar: [{ id: 'z', rotulo: 'Z' }, { id: 'n', rotulo: 'N' }], agruparPor: 'n',
  });
  ok(b.includes('type="search"') && b.includes('<select'), 'la barra trae buscador y agrupaci'+String.fromCharCode(243)+'n');
  ok(/value="n" selected/.test(b), 'y el desplegable marca la agrupacion elegida',
    'sin selected, cada reconstruccion lo devuelve a la primera opcion');
  ok(!P.barraControl({ agrupar: [{ id: 'z', rotulo: 'Z' }] }).includes('<select'),
    'con UNA sola opcion no se pinta desplegable',
    'un control que no puede cambiar nada es peor que no tenerlo: promete que si');

  const pa = P.pastillas({ items: [{ et: 'x', rotulo: 'X', n: 7 }] });
  ok(pa.includes('data-cuenta-et="x"') && pa.includes('>7<'),
    'la pastilla lleva su recuento DENTRO', 'sin número no se sabe si merece la pena pulsarla');

  const f = P.filas({ grupos: [{ rotulo: 'G', filas: [{ celdas: ['<i>1</i>'] }, { celdas: ['<i>2</i>'] }] }] });
  ok((f.match(/<details/g) ?? []).length === 2, 'las filas son plegables');
  ok(f.includes('pz-grupo') && f.includes('>2<'), 'y la cabecera de grupo lleva su cuenta');
}

console.log('\nla procedencia se ve SIN desplegar — lo que no se negocia');
{
  const pr = P.procedencia({ tuyo: null, zona: '22:00', visto: '2', manda: 'zona' });
  for (const f of P.FUENTES) ok(pr.includes(`pz-f-${f}`), `«${t(`pz.src.${f}`)}» va en la fila`);
  ok(pr.includes('pz-manda'), 'y la que manda el número va marcada');
  ok(!pr.includes('<details'), 'nada de esto está detrás de un desplegable',
    'una cosa escondida tras un clic, en la práctica, no existe');
  ok(pr.includes(t('pz.sinDato')), 'la fuente que no tiene dato lo dice, no se calla');
}

console.log('\ntoda fila lleva etiqueta, y «encantado» no es un bando');
{
  ok(P.BANDOS.includes('encantado') && P.BANDOS.includes('soltado'),
    'se distingue el que sigue encantado del que SE SOLTÓ',
    'un encantado que se suelta acaba pegándote: llamarlo «encantado» miente');
  ok(t('pz.et.encantado') !== t('pz.et.soltado'), 'y sus rótulos son distintos');
  ok(P.etiqueta('inventado') === '', 'un bando que no existe no pinta una etiqueta vacía',
    'una etiqueta vacía se leería como «sin bando», que es justo lo que se quitó');
}

console.log('\nla leyenda es plegable y recuerda');
{
  const l = P.leyendaProcedencia({});
  ok(l.startsWith('<details') && !l.includes(' open'), 'nace plegada',
    'con un temporizador debajo ocupaba más que el contenido');
  ok(P.leyendaProcedencia({ abierta: true }).includes(' open'), 'y se abre si así se dejó');
  ok(l.includes('data-memo='), 'y lleva de qué acordarse', 'sin memoria, plegarla no sirve de nada');
}

console.log('\nlos cinco idiomas, sin clave suelta');
for (const l of TRANSLATED) {
  setLang(l);
  const faltan = P.CLAVES.filter((k) => { const v = t(k); return !v || v === k; });
  ok(faltan.length === 0, `${l}: las ${P.CLAVES.length} claves traducidas`, faltan.join(', '));
}
setLang('es');

console.log('\nlo que entra en el HTML va escapado');
{
  const f = P.filas({ grupos: [{ rotulo: '<script>x</script>', filas: [{ busca: '"><b>' }] }] });
  ok(!f.includes('<script>'), 'un rótulo con etiquetas no se cuela en el documento');
  ok(!/data-busca="[^"]*"[^>]*><b>/.test(f), 'ni una comilla rompe un atributo');
}

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
