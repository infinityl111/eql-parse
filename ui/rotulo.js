/**
 * El rótulo que sigue al ratón.
 *
 * Sólo la CAJA: crearla, colocarla junto al cursor sin que se salga de la
 * pantalla, y enseñarla o esconderla. Lo que va dentro lo pone quien lo llama.
 *
 * POR QUÉ COMPARTIDO. La reproducción también lo necesita, y tenerlo dos veces
 * significa que el día que se arregle un borde sólo se arregla en uno. Ya pasó
 * con la gráfica; aquí se hace bien desde el principio.
 *
 * Y POR QUÉ SÓLO LA CAJA. El contenido NO se comparte a propósito, porque no es
 * el mismo dato: en combate el rótulo describe la pelea entera —está cerrada,
 * son sus totales— y en la reproducción describe lo que va llevando hasta el
 * segundo en el que estás. Dos preguntas distintas con la misma forma. Meterlas
 * en una función con un `si` sería fingir que son la misma.
 */

let caja = null;
const raton = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  raton.x = e.clientX; raton.y = e.clientY;
  if (caja && caja.style.display === 'block') colocar();
});

function crear() {
  if (!caja) {
    caja = document.createElement('div');
    caja.className = 'tip';
    document.body.appendChild(caja);
  }
  return caja;
}

/** Junto al cursor, y siempre dentro de la ventana. */
function colocar() {
  const el = crear();
  const r = el.getBoundingClientRect();
  let x = raton.x + 16, y = raton.y + 14;
  if (x + r.width > window.innerWidth - 8) x = raton.x - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
  el.style.left = `${Math.max(8, x)}px`;
  el.style.top = `${Math.max(8, y)}px`;
}

export function cajaRotulo() { return crear(); }
export function colocarRotulo() { colocar(); }
export function ocultarRotulo() { if (caja) caja.style.display = 'none'; }
export function visible() { return !!caja && caja.style.display === 'block'; }

/** Enseña este HTML. `clase` permite variantes, como la ficha de un objeto. */
export function mostrarRotulo(html, clase = 'tip') {
  const el = crear();
  el.className = clase;
  el.innerHTML = html;
  el.style.display = 'block';
  colocar();
}
