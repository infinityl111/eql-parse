/**
 * EL MARCO SE PRUEBA SIN VENTANA.
 *
 * Redimensionar por una esquina es aritmética con signos, y los signos son
 * justo donde se cuela el fallo que sólo ves arrastrando **esa** esquina. Las
 * cuatro se comprueban aquí en microsegundos, en vez de abriendo un overlay y
 * tirando de cada una.
 *
 * Es la misma vara que `test/cronos-vista.js`: si verificar algo exige levantar
 * la aplicación, sospecha del diseño de lo verificado antes que del instrumento.
 */
import * as M from '../ui/marco-overlay.js';
import { t, setLang, TRANSLATED } from '../src/i18n.js';

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};
setLang('es');

const B = { x: 100, y: 100, width: 400, height: 300 };

console.log('\nlas cuatro esquinas mueven lo que les toca');
{
  // Sureste: crece hacia abajo y a la derecha, el origen NO se mueve.
  const se = M.encaja(B, 'se', 50, 40);
  ok(se.width === 450 && se.height === 340, 'SE crece con el arrastre');
  ok(se.x === 100 && se.y === 100, 'y SE no mueve el origen');

  // Noroeste: crece hacia arriba y a la izquierda, el origen SÍ se mueve.
  const no = M.encaja(B, 'no', -50, -40);
  ok(no.width === 450 && no.height === 340, 'NO crece al arrastrar hacia fuera');
  ok(no.x === 50 && no.y === 60, 'y NO mueve el origen para compensar',
    'sin esto, la esquina de arriba estira desde abajo');

  // Nordeste y suroeste: uno de cada.
  const ne = M.encaja(B, 'ne', 50, -40);
  ok(ne.width === 450 && ne.height === 340 && ne.x === 100 && ne.y === 60,
    'NE mueve sólo la Y');
  const so = M.encaja(B, 'so', -50, 40);
  ok(so.width === 450 && so.height === 340 && so.x === 50 && so.y === 100,
    'SO mueve sólo la X');
}

console.log('\nel mínimo se aplica antes de mover el origen');
{
  /**
   * ÉSTE ES EL FALLO QUE SÓLO SE VE ARRASTRANDO. Encogiendo desde la esquina de
   * arriba más allá del mínimo, si el tope se aplicara después, la ventana
   * dejaría de encoger y SEGUIRÍA desplazándose: se te escapa por la pantalla.
   */
  const r = M.encaja(B, 'no', 9999, 9999);
  ok(r.width === M.MINIMO.ancho && r.height === M.MINIMO.alto, 'no baja del mínimo');
  ok(r.x === 100 + (400 - M.MINIMO.ancho) && r.y === 100 + (300 - M.MINIMO.alto),
    'y el origen se queda donde el mínimo lo deja',
    'si el tope se aplicara después, la ventana se iría andando');

  const s = M.encaja(B, 'se', -9999, -9999);
  ok(s.width === M.MINIMO.ancho && s.height === M.MINIMO.alto
    && s.x === 100 && s.y === 100, 'y por SE encoge sin mover el origen');
}

console.log('\nuna esquina que no existe no mueve nada');
ok(JSON.stringify(M.encaja(B, 'centro', 50, 50)) === JSON.stringify(B),
  'devuelve las medidas tal cual',
  'CONTROL: y no un objeto a medias, que se guardaría como posición');

console.log('\nla opacidad no se puede dejar en invisible');
{
  ok(M.opacidadValida(0) === M.OPACIDAD.min, 'un cero sube al mínimo',
    'un overlay a opacidad cero no se distingue de uno que no se abrió');
  ok(M.opacidadValida(5) === M.OPACIDAD.max, 'y un exceso baja al máximo');
  ok(M.opacidadValida('0.6') === 0.6, 'una cadena vale: del deslizador viene texto');
  ok(M.opacidadValida(undefined) === M.OPACIDAD.por_defecto, 'y sin valor, el de por defecto');
  ok(M.opacidadValida(NaN) === M.OPACIDAD.por_defecto, 'CONTROL: NaN tampoco pasa');
}

console.log('\nel marco produce sus cuatro esquinas y su deslizador');
{
  const h = M.marco({ opacidad: 0.7 });
  for (const e of M.ESQUINAS) ok(h.includes(`data-esq="${e.id}"`), `esquina ${e.id}`);
  ok(h.includes('type="range"') && h.includes('value="0.7"'),
    'y el deslizador con su valor puesto',
    'sin el valor, cada repintado lo devuelve al máximo');
}

console.log('\nel tamaño tiene los mismos topes que la opacidad, y por lo mismo');
{
  ok(M.letraValida(0) === M.LETRA.min, 'un cero sube al mínimo',
    'por debajo de 0,8 las filas dejan de leerse donde se afinaron');
  ok(M.letraValida(9) === M.LETRA.max, 'y un exceso baja al máximo',
    'por encima de 1,8 una fila se come el panel y deja de ser una lista');
  ok(M.letraValida('1.3') === 1.3, 'una cadena vale: del deslizador viene texto');
  ok(M.letraValida(undefined) === M.LETRA.por_defecto, 'y sin valor, el de por defecto');
  ok(M.letraValida(NaN) === M.LETRA.por_defecto, 'CONTROL: NaN tampoco pasa');

  const h = M.marco({ opacidad: 0.7, letra: 1.3 });
  ok(h.includes('mo-le') && h.includes('value="1.3"'),
    'y el marco lo pinta con su valor puesto',
    'sin el valor, cada repintado lo devuelve a 1');
  ok((h.match(/type="range"/g) ?? []).length === 2,
    'los dos mandos están, no uno', 'transparencia y tamaño, dentro del overlay');
  ok(M.marco({}).includes(`value="${M.LETRA.por_defecto}"`),
    'CONTROL: sin decir nada, sale el de por defecto');
}

console.log('\nlos cinco idiomas');
for (const l of TRANSLATED) {
  setLang(l);
  const faltan = M.CLAVES.filter((k) => { const v = t(k); return !v || v === k; });
  ok(faltan.length === 0, `${l}: las ${M.CLAVES.length} claves`, faltan.join(', '));
}
setLang('es');

console.log(`\n${mal ? `${mal} MAL` : 'todo ok'}\n`);
process.exit(mal ? 1 : 0);
