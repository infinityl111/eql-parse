/**
 * La pelea, en texto para pegar en el chat del juego.
 *
 * EL LÍMITE, MEDIDO. Se daba por supuesto que EQ corta en unos 250 caracteres.
 * No es así, o al menos no en EQL: sobre 4.967 mensajes de canal de 449
 * jugadores distintos de un registro real, el más largo escrito por una persona
 * son 491 caracteres, y la cola de longitudes es suave — no hay ningún número
 * repetido en el máximo, que es como se delata un corte del cliente. La wiki de
 * EQL lista los canales y NO documenta ningún máximo.
 *
 * Así que 491 es un suelo comprobado, no un techo conocido. El presupuesto por
 * defecto es 240: la mitad de lo comprobado, de sobra para lo que hay que decir.
 *
 * Y el chat no respeta saltos de línea, así que no cabe una tabla. Salen dos
 * líneas independientes y se pegan por separado.
 *
 * SÓLO ASCII, Y NO ES PRUDENCIA: ESTÁ MEDIDO
 *
 * De los 6.163 mensajes de chat del registro, el ÚNICO carácter no-ASCII que
 * aparece es U+FFFD ocho veces — el rombo de «no sé pintar esto». Y en 359
 * mensajes propios escritos en español no hay ni una tilde ni una eñe. O la
 * fuente no las pinta o el cuadro de texto no las acepta; en cualquiera de los
 * dos casos, aquí no entran. Fuera «·», «×», «→» y «máx».
 *
 * EL «%» SÍ PASA, Y LA MEDIDA QUE DECÍA LO CONTRARIO ERA UNA TRAMPA
 *
 * Aquí hubo un error de razonamiento que conviene dejar escrito, porque la
 * medida era correcta y la conclusión no.
 *
 * Medido: «%» sale 216 veces en el registro y CERO veces en los 6.163 mensajes
 * de chat. Todas las apariciones son del juego —«You gain experience!
 * (3.721%)»—, ninguna de una persona. De ahí se dedujo que el cuadro de texto
 * se lo comía, siendo como es el prefijo de sustitución de las macros («%T»).
 *
 * Se probó dentro del juego y es falso: «prueba 30%» sale tal cual en el canal
 * de gremio. La explicación de la ausencia era mucho más aburrida —nadie
 * escribe porcentajes charlando— y 451 jugadores sin usar un carácter no
 * demuestran que no se pueda usar. Ausencia de evidencia no es evidencia de
 * ausencia, y un registro sólo enseña lo que la gente hizo, no lo que podía.
 *
 * Así que por defecto va «%». Se deja configurable por si algún cliente se
 * comporta distinto. Y un apunte de la misma prueba: «%%» también sale como
 * «%», o sea que el juego trata el doble como escape — no hace falta, pero si
 * algún día un cliente se come el simple, ése es el camino.
 *
 * QUÉ VA EN CADA UNA
 *
 *   1  el reparto entre los tuyos, que es lo que se comparte.
 *   2  los enemigos, agregados. Mezclarlos con el reparto es lo que sobraba;
 *      aparte y resumidos sí dicen algo — cuánto pegaron y su golpe máximo es
 *      justo lo que se comenta después de un intento fallido.
 *
 * POR QUÉ SE RECORTA LA CABECERA Y NO EL GRUPO
 *
 * Medido: lo que desborda la línea es la lista de nombres de bichos, no la de
 * los tuyos. «a worry wraith, a turmoil toad pet, a turmoil toad, a scareling
 * ×2, a shiverback» son 78 caracteres antes de empezar a contar a nadie. Con la
 * cabecera comprimida a «Master Yael +3» o «5 enemigos», ninguna de las 324
 * peleas guardadas necesitó recortar a un solo compañero.
 */

/** Presupuesto por línea. Ver arriba: el suelo comprobado es 491. */
export const LIMITE = 240;

/** Sufijo del reparto. Ver arriba: comprobado dentro del juego, «%» pasa. */
export const PCT = '%';

const secs = (s) => (s >= 60
  ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`
  : `${Math.round(s)}s`);

/** Miles con una decimal a partir de 10.000: «22473» pero «141.0k». */
const k = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

const esPet = (n) => / pet$/i.test(String(n ?? ''));

/**
 * ¿Es un enemigo «de los gordos»? DEDUCIDO, y por eso se puede sustituir.
 *
 * Dos señales, y ninguna basta sola. Medido sobre 120 enemigos con vida
 * conocida: los que NO llevan artículo tienen de media 26.994 de vida y los que
 * sí, 7.952 — 3,4 veces. Pero falla en los dos sentidos y con casos reales:
 * `a spite golem` lleva artículo y tiene 49.452; `King Thex\`Ka IV` no lo lleva
 * y tiene 1.417. Y `Amygdalan warrior` sale marcado sin serlo.
 *
 * Quien lo sabe de verdad es la wiki, que categoriza las páginas como «Raid
 * Encounters» y «Named Mobs». Mientras eso no esté, esto es una deducción y el
 * que llame puede pasar `named` con la lista buena para no usarla.
 *
 * @param {Set<string>|null} named  los que constan como tales. Manda sobre todo.
 */
export function esNamed(nombre, vidaRecibida, named = null) {
  if (esPet(nombre)) return false;
  if (named) return named.has(nombre);
  return !/^(an?|the) /i.test(String(nombre ?? '')) && (vidaRecibida ?? 0) > 12000;
}

/** «5 normales» pero «1 normal». */
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * De quién es esta fila, si es de alguien.
 *
 * `petOf` lo pone el `/pet who leader` de otro jugador; `pet` marca las tuyas.
 * Lo que no lleve ninguna de las dos no se toca: no consta que sea de nadie y
 * inventarle un dueño sería peor que dejarla suelta.
 */
const duenoDe = (r, self) => (r.petOf ? r.petOf : (r.pet && self ? self : null));

/**
 * @param {object} f      la pelea, tal cual la manda el motor
 * @param {object} opts
 *   - limite   caracteres por línea (240)
 *   - prefijo  lo que va delante, p. ej. «[EQL] ». Vacío por defecto: en un
 *              chat de grupo ya se entiende, y son caracteres que en el borde
 *              cuentan. Configurable porque en un canal lleno sí distingue.
 *   - named    conjunto de nombres que constan como named. Sin él, se deduce.
 *   - enemigos si se genera la segunda línea (sí)
 *   - self     tu nombre. Hace falta para saber de quién son TUS mascotas: la
 *              fila sólo trae la marca `pet`, no el dueño.
 *   - pets     'merge' (por defecto) suma la mascota a su dueño; 'group' la
 *              deja aparte, rotulada y pegada a él. Ver abajo.
 * @returns {{lineas: string[], texto: string, fuera: number}}
 */
export function fightToChat(f, opts = {}) {
  const limite = opts.limite ?? LIMITE;
  const pre = opts.prefijo ?? '';
  const named = opts.named ?? null;
  const pct = opts.pct ?? PCT;
  const self = opts.self ?? null;
  const modoPets = opts.pets === 'group' ? 'group' : 'merge';
  const conEnemigos = opts.enemigos !== false;
  if (!f) return { lineas: [], texto: '', fuera: 0 };

  const dur = f.duration || 1;
  const rows = f.rows ?? [];

  // Los tuyos que hicieron algo. Quien no pegó no ocupa sitio en una línea que
  // va justa; el que quiera ver los ceros tiene la aplicación.
  const crudas = rows.filter((r) => r.side !== 'enemy' && (r.damage ?? 0) > 0);
  const total = crudas.reduce((a, r) => a + (r.damage ?? 0), 0) || 1;

  // ── La mascota no es un jugador más ──────────────────────────────────────
  //
  // Suelta y ordenada por daño, en el chat parece uno del grupo. Y no es un
  // detalle estético: medido en una pelea real, «Campeon 15363 (40%)» con
  // «Gekab 8025 (21%)» tres puestos más abajo describe a dos personas donde hay
  // una. Sumadas son 23388, el 61%, y el reparto entero cambia de orden.
  //
  // Así que se agrupa por dueño y el orden entre grupos sale del daño CONJUNTO:
  // ordenar por el del jugador solo dejaría al último a quien más pone.
  const grupos = new Map();
  for (const r of crudas) {
    const d = duenoDe(r, self);
    const clave = d ?? r.name;
    if (!grupos.has(clave)) grupos.set(clave, { nombre: clave, jugador: null, pets: [], suma: 0 });
    const g = grupos.get(clave);
    if (d) g.pets.push(r); else g.jugador = r;
    g.suma += r.damage ?? 0;
  }
  const ordenados = [...grupos.values()].sort((a, b) => b.suma - a.suma);

  // `aliados` es lo que se va a escribir, ya en su orden y con su etiqueta.
  const aliados = [];
  for (const g of ordenados) {
    if (modoPets === 'merge' && g.jugador && g.pets.length) {
      // «+pet» y no a secas: la cifra ya no es sólo del jugador y quien la lea
      // tiene que saberlo. Sin la marca sería un número inflado sin avisar.
      aliados.push({ etiqueta: `${g.jugador.name} +pet`, damage: g.suma });
      continue;
    }
    if (g.jugador) aliados.push({ etiqueta: g.jugador.name, damage: g.jugador.damage });
    // Las mascotas van pegadas a su dueño, rotuladas con él. Si el dueño no
    // pegó —o no está—, la mascota sale sola pero igualmente rotulada: es la
    // única forma de que no pase por jugador.
    for (const p of g.pets.sort((x, y) => y.damage - x.damage)) {
      aliados.push({ etiqueta: `${p.name} (${g.nombre}'s Pet)`, damage: p.damage });
    }
  }

  // Las mascotas enemigas se pliegan: «a turmoil toad pet» no es un enemigo
  // del que se hable, y en la cabecera sólo gasta caracteres.
  const enemigos = rows.filter((r) => r.side === 'enemy' && !esPet(r.name));
  const gordos = enemigos.filter((r) => esNamed(r.name, r.taken, named));
  const normales = enemigos.filter((r) => !esNamed(r.name, r.taken, named));

  // La cabecera: el named se nombra, los normales se cuentan. Sus nombres uno a
  // uno no le dicen nada a nadie y son justo lo que desborda.
  const quien = gordos.length
    ? gordos.map((r) => r.name).join(' + ') + (normales.length ? ` +${normales.length}` : '')
    : (normales.length === 1 ? normales[0].name
      : (normales.length ? plural(normales.length, 'enemigo', 'enemigos') : (f.label ?? '')));

  const uno = (r) => `${r.etiqueta} ${Math.round(r.damage)} `
    + `(${Math.round(r.damage / dur)}dps ${Math.round(r.damage / total * 100)}${pct})`;

  // Se quitan del final y se dice cuántos faltan. Nunca se corta a media
  // palabra: un nombre cortado es peor que un nombre ausente, porque parece un
  // nombre. Con uno solo se deja pasar aunque no quepa: mejor largo que vacío.
  const cabeza = `${pre}${quien} ${secs(dur)} - ${k(total)} (${Math.round(total / dur)}dps)`;
  let l1 = cabeza;
  let dentro = 0;
  for (let n = aliados.length; n >= 1; n--) {
    const resto = aliados.length - n;
    const s = `${cabeza} | ${aliados.slice(0, n).map(uno).join(' | ')}`
      + (resto ? ` | +${resto}` : '');
    if (s.length <= limite || n === 1) { l1 = s; dentro = n; break; }
  }

  const lineas = [l1];
  if (conEnemigos && enemigos.length) {
    const trozo = (r) => `${r.name} ${k(r.taken ?? 0)} - ${k(r.damage ?? 0)} `
      + `(${Math.round((r.damage ?? 0) / dur)}dps, max ${Math.round(r.max ?? 0)})`;
    const partes = gordos.map(trozo);
    if (normales.length) {
      const dmg = normales.reduce((a, r) => a + (r.damage ?? 0), 0);
      const rec = normales.reduce((a, r) => a + (r.taken ?? 0), 0);
      const mx = Math.max(0, ...normales.map((r) => r.max ?? 0));
      partes.push(`${plural(normales.length, 'normal', 'normales')} ${k(rec)} - ${k(dmg)} `
        + `(${Math.round(dmg / dur)}dps, max ${mx})`);
    }
    let l2 = `${pre}vs ${partes.join(' | ')}`;
    // Si tampoco cabe, caen los normales antes que el named: de un jefe se
    // habla, de los añadidos no.
    if (l2.length > limite && partes.length > 1) {
      l2 = `${pre}vs ${partes.slice(0, -1).join(' | ')} | +${plural(normales.length, 'normal', 'normales')}`;
    }
    lineas.push(l2);
  }

  // Red de seguridad: si un nombre trae un carácter que el chat no pinta, se
  // sustituye en vez de mandar un rombo. Las tildes se degradan a su letra
  // —«Muñoz» sale «Munoz», que se lee— y lo demás a «?», que al menos avisa.
  const limpias = lineas.map((x) => x.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?'));
  return { lineas: limpias, texto: limpias.join('\n'), fuera: aliados.length - dentro };
}
