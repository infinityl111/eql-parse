/**
 * Los rótulos que las notas de versión CITAN, sustituidos desde el diccionario.
 *
 * VIVE EN SU PROPIO FICHERO Y NO DENTRO DE `build.mjs` POR UN MOTIVO CONCRETO:
 * `build.mjs` termina en `main()`, así que importarlo para usar una función
 * suelta CONSTRUYE LA WEB ENTERA — borra `web/dist`, llama a la API de GitHub y
 * reescribe veinte páginas. La prueba de los rótulos hacía eso al arrancar.
 * Una función que quieren dos sitios no puede vivir en un fichero que se
 * ejecuta al mirarlo.
 *
 * POR QUÉ SUSTITUIR Y NO COTEJAR, que es la alternativa que se consideró:
 *
 *   · La sustitución QUITA el modo de fallo; declarar al pie las claves citadas
 *     y comprobarlas sólo lo DETECTA si el autor se acuerda de declarar. Una
 *     enumeración que depende de que quien escribe la mantenga ya ha fallado dos
 *     veces en este proyecto.
 *   · Y su fallo es RUIDOSO: si alguien publica el `.md` en crudo, salen las
 *     llaves a la vista y se ve al instante. Citar sin declarar no rompe nada y
 *     nadie se entera. Entre dos soluciones imperfectas, la que grita.
 *
 * DECISIÓN QUE ALGUIEN VA A QUERER «ARREGLAR» DENTRO DE UN AÑO, y no hay que
 * arreglarla: cuando un rótulo se reescriba en una versión futura, las notas
 * ANTIGUAS pasarán a renderizar el texto NUEVO — un rótulo que quien usó la
 * 1.12.0 nunca vio. Es deliberado. Estas citas están para que el lector
 * reconozca lo que tiene delante en SU programa, no para dejar constancia de lo
 * que decía la versión de entonces.
 */
import { setLang, getLang, t } from '../src/i18n.js';

/**
 * @param {string} texto  el markdown con `{{clave}}` dentro
 * @param {string} lang   el idioma en el que se quiere el rótulo
 */
export function sustituirRotulos(texto, lang) {
  const antes = getLang();
  setLang(lang);
  try {
    return String(texto ?? '').replace(/\{\{([a-zA-Z0-9._-]+)\}\}/g, (todo, clave) => {
      // `t()` devuelve la clave cuando no la conoce. Eso no se pinta como si
      // fuera un rótulo: se deja `{{clave}}` con las llaves puestas para que el
      // fallo se vea. `test/notas.js` lo caza antes, pero el respaldo se queda.
      const v = t(clave);
      return v === clave ? todo : v;
    });
  } finally {
    // El idioma activo se devuelve como estaba: sin esto, construir la web en
    // los cinco idiomas dejaba el diccionario en el último.
    setLang(antes);
  }
}
