/**
 * Al portapapeles, desde las dos ventanas.
 *
 * Vive aquí y no dentro de cada una porque el overlay y la ventana principal
 * copian lo mismo, y dos copias de esto acabarían divergiendo justo en el caso
 * raro — que es el único que importa aquí.
 *
 * EL CASO RARO. `navigator.clipboard` exige contexto seguro y, en la práctica,
 * que la ventana tenga el foco. El overlay es `focusable: false` a propósito:
 * si tomara el foco, EverQuest pasaría a segundo plano y limitaría los
 * fotogramas, que es justo el tirón que se quería evitar. Así que ahí puede
 * fallar y hay respaldo con `execCommand`, que es viejo y está desaconsejado
 * pero funciona sin foco.
 *
 * Y si fallan los dos se devuelve `false` en vez de tragárselo: un botón que
 * dice «copiado» sin haber copiado es peor que uno que dice que no pudo.
 */
export async function copiarAlPortapapeles(texto) {
  if (!texto) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch { /* sin permiso o sin foco: se prueba lo de siempre */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    // Fuera de la vista pero dentro del documento: `execCommand('copy')` no
    // copia de un elemento que no esté pintado, así que `display:none` no vale.
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
