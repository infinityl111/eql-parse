/**
 * La pelea, en texto para pegar en el chat del juego.
 *
 * EL LÍMITE, MEDIDO. Se daba por supuesto que EQ corta en unos 250 caracteres.
 * No es así, o al menos no en EQL. Sobre el registro real —537.952 líneas,
 * 8.098 mensajes de canal humano (tell, guild, group, raid, fellowship, canal,
 * ooc, subasta, grito) de 568 emisores distintos—, el texto más largo escrito
 * por una persona son 423 caracteres y hay UNO solo de esa longitud. La cola es
 * suave: las quince mayores son 423, 356, 331, 281, 269, 264, 262, 258, 256,
 * 252, 246, 246, 246, 245, 242. Un cliente que corta se delata con una pila de
 * mensajes clavados en el mismo número, y el más repetido por encima de 100 son
 * 26 mensajes de 102 caracteres — reparto normal, no un tope.
 *
 * CORRECCIÓN: aquí se decía 491, y 491 era la línea ENTERA del registro, con su
 * marca de tiempo y el «Fulano tells General:1, '» delante. Lo que una persona
 * puede teclear medido de verdad son 423. No cambia ninguna decisión —el
 * presupuesto sigue muy por debajo—, pero la cifra estaba mal atribuida.
 *
 * Y no hay techo documentado: la wiki de EQL lista los canales y describe la
 * ventana de chat sin dar ningún máximo, y la documentación de EQ tampoco. El
 * número que circula por la comunidad —255, del cliente clásico— ya lo desmiente
 * este mismo registro con 423 medidos.
 *
 * Así que 423 es un suelo comprobado, no un techo conocido. El presupuesto por
 * defecto es 240: por debajo de todos los candidatos, incluido el más
 * restrictivo que se repite por ahí, y de sobra para lo que hay que decir.
 *
 * Y el chat no respeta saltos de línea, así que no cabe una tabla. Salen dos
 * líneas independientes y se pegan por separado.
 *
 * SÓLO ASCII, Y NO ES PRUDENCIA: ESTÁ MEDIDO
 *
 * De los 9.934 mensajes de chat del registro, el ÚNICO carácter no-ASCII que
 * aparece es U+FFFD once veces — el rombo de «no sé pintar esto». Y en los
 * mensajes propios escritos en español no hay ni una tilde ni una eñe. O la
 * fuente no las pinta o el cuadro de texto no las acepta; en cualquiera de los
 * dos casos, aquí no entran. Fuera «·», «×», «→» y «máx». Por eso el recorte
 * dice «+3 mas» y no «+3 más»: la tilde no llegaría de todos modos, y escribirla
 * aquí sólo serviría para que el saneador de abajo la borrase sin avisar.
 *
 * EL «|» LLEGA, Y ESTÁ COMPROBADO DE IDA Y VUELTA
 *
 * Es el separador de las dos líneas, así que no vale suponerlo. En el registro
 * hay siete líneas con «|». Tres son de otras personas escribiendo en un canal
 * —«<Vanguard of Valhalla> | EU Casual | PST for guild invite»—, una es la ayuda
 * del propio juego, y las otras DOS son este texto: salidas de aquí, pegadas en
 * el chat de gremio y devueltas por el registro con sus barras intactas:
 *
 *     You say to your guild, 'a necro neophyte 7s - 470 (67dps) | Campeon 470...'
 *
 * O sea que el viaje completo —cuadro de texto, servidor, registro— no se come
 * el carácter. Eso es una medida, no una precaución.
 *
 * EL «%» SÍ PASA, Y LA MEDIDA QUE DECÍA LO CONTRARIO ERA UNA TRAMPA
 *
 * Aquí hubo un error de razonamiento que conviene dejar escrito, porque la
 * medida era correcta y la conclusión no.
 *
 * Medido: «%» sale en 622 líneas del registro y CERO veces en los 9.934
 * mensajes de chat. Todas las apariciones son del juego —«You gain experience!
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
 *   1  el reparto entre los tuyos, que es lo que se comparte:
 *
 *        Innoruuk, the Prince of Hate 4m18s | TOTAL GRUPO 84848 (329dps)
 *        | Campeon 61585 (239dps 73%) | Kabaner 23263 (90dps 27%)
 *
 *      «TOTAL GRUPO» rotula el total. Sin rótulo, la cifra de la cabecera
 *      quedaba pegada a la duración y se leía como la de alguien.
 *
 *   2  los enemigos, agregados. Mezclarlos con el reparto es lo que sobraba;
 *      aparte y resumidos sí dicen algo — cuánto pegaron y su golpe máximo es
 *      justo lo que se comenta después de un intento fallido:
 *
 *        vs Innoruuk - 45200 (175dps, max 820)
 *
 *      Aquí el nombre va CORTO, sin el título: en la cabecera ya salió entero y
 *      repetirlo cuesta veinte caracteres para no decir nada nuevo.
 *
 *      Y ya no se escribe lo que el bicho RECIBIÓ, que antes iba delante del
 *      guion. Con un enemigo era la misma cifra que «TOTAL GRUPO», dicha dos
 *      veces en dos líneas — y ahora que el total lleva rótulo, el sitio donde
 *      se dice es ése.
 *
 * UN ENEMIGO NORMAL Y SOLO SE LLAMA POR SU NOMBRE
 *
 * Los normales se agregan porque en montón sus nombres no dicen nada. Pero
 * cuando sólo hay uno no hay nada que agregar, y «vs 1 normal 45200» escondía
 * justo el dato que se busca: quién te pegó. Con uno, su nombre.
 *
 * POR QUÉ SE RECORTA LA CABECERA Y NO EL GRUPO
 *
 * Medido: lo que desborda la línea es la lista de nombres de bichos, no la de
 * los tuyos. «a worry wraith, a turmoil toad pet, a turmoil toad, a scareling
 * ×2, a shiverback» son 78 caracteres antes de empezar a contar a nadie. Con la
 * cabecera comprimida a «Master Yael +3» o «5 enemigos», ninguna de las 551
 * peleas guardadas necesita recortar a un solo compañero: pasadas todas por
 * este formato, la primera línea más larga son 212 caracteres y las diez
 * mayores son 212, 197, 188, 181, 179, 177, 176, 174, 173, 173. La segunda no
 * pasa de 139.
 *
 * O sea que el recorte de abajo es una red, no el caso normal. Conviene saberlo
 * antes de retocarlo: no se dispara nunca con datos reales de hoy y una prueba
 * es la única forma de verlo funcionar.
 *
 * Y CUANDO AUN ASÍ NO CABE, SE DICE
 *
 * Lo que se conserva es la cabecera, el total y el «vs». Lo que cae son
 * compañeros, de menor a mayor daño, porque el que menos puso es el que menos
 * cambia la lectura. Pero el texto lo DICE: «| +3 mas». Cortar en silencio no es
 * omitir, es afirmar — un reparto de dos donde había cinco no está incompleto,
 * está diciendo que el grupo era de dos.
 *
 * LOS NÚMEROS, TODOS EXACTOS
 *
 * Convivían «84.8k» en el total y «61585» en los individuales, y la mezcla era
 * casualidad: la abreviatura estaba puesta en unos sitios y en otros no.
 *
 * Se unifican en exacto, y el argumento es que abreviar no ahorra NADA. Contado:
 * de 10.000 a 99.999 el exacto son 5 caracteres y «10.0k»–«99.9k» también son 5;
 * de 100.000 a 999.999, 6 y 6; de 1.000.000 en adelante, 7 y 7. Y no es
 * coincidencia — «.», el decimal y la «k» son tres caracteres que sustituyen
 * exactamente a los tres dígitos que se tiran. El empate es estructural.
 *
 * Así que la abreviatura costaba precisión y no compraba sitio. Y con el exacto
 * las cifras de una misma línea tienen siempre la misma forma; el umbral de
 * 10.000 producía «Campeon 9800» junto a «Kabaner 10.2k», dos formatos en la
 * misma columna, que es peor que cualquiera de los dos. Además el total se puede
 * comprobar sumando, que en un medidor de daño no es un detalle.
 */

/** Presupuesto por línea. Ver arriba: el suelo comprobado es 423. */
export const LIMITE = 240;

/** Sufijo del reparto. Ver arriba: comprobado dentro del juego, «%» pasa. */
export const PCT = '%';

const secs = (s) => (s >= 60
  ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`
  : `${Math.round(s)}s`);

/** Todos los daños, con la misma forma. Ver arriba: abreviar no ahorraba nada. */
const num = (n) => String(Math.round(n ?? 0));

/**
 * El nombre para la SEGUNDA mención: «Innoruuk, the Prince of Hate» ya salió
 * entero en la cabecera y aquí basta «Innoruuk». Se corta por la coma y nada
 * más: los nombres sin título —«Lord Nagafen», «a fire giant warrior»— pasan
 * enteros, que es lo que tiene que pasar.
 */
const corto = (n) => String(n ?? '').split(',')[0].trim() || String(n ?? '');

const esPet = (n) => / pet$/i.test(String(n ?? ''));

/**
 * ¿Es un enemigo «de los gordos»? LO DICE `named`, Y NO SE DEDUCE AQUÍ.
 *
 * ═══ AQUÍ HABÍA UNA TERCERA COPIA DE LA REGLA, Y SE HA BORRADO ═══
 *
 * Esta función tenía su propio respaldo: sin artículo y más de 12.000 de vida
 * recibida. La misma regla que `clasificaJefe` en `src/raid.js`, **con otro
 * umbral** —allí son 20.000— y sin la corrección de la curación enemiga que se
 * le puso a aquélla.
 *
 * NO SE UNIFICÓ EL NÚMERO: SE QUITÓ LA COPIA. Unificar deja dos sitios donde
 * escribir la regla y sólo aplaza la divergencia; el día que alguien afine uno,
 * el otro se queda atrás en silencio. Sin respaldo no puede haber un tercer
 * umbral, porque no hay una tercera regla.
 *
 * Y ERA UNA MINA, no un problema de hoy: los dos llamadores de la aplicación
 * —`ui/app.js` y `ui/overlay.js`— pasan siempre `named`, así que el respaldo no
 * corría nunca. Sólo lo ejercitaban las pruebas. Un camino muerto que contiene
 * una regla desactualizada es peor que uno vacío: parece que cubre el caso.
 *
 * Quien sabe esto de verdad es `jefesDe`, que mira lo que dice la wiki, lo que
 * has dicho tú y —sólo si no hay nada de eso— deduce, con la vida SIN lo que le
 * curaron. Ver `src/raid.js`.
 *
 * @param {string} nombre
 * @param {Set<string>} named  los que constan como tales. Obligatorio.
 */
export function esNamed(nombre, named) {
  if (esPet(nombre)) return false;
  if (!named) throw new TypeError('esNamed: falta `named`. La deducción vive en jefesDe (src/raid.js), no aquí.');
  return named.has(nombre);
}

/**
 * Ya no hay singular que escribir. Los dos sitios que agregan normales —la
 * cabecera y la línea de enemigos— tratan aparte el caso de uno solo, que sale
 * por su nombre; al recuento no le llega nunca un 1. Se deja dicho porque el
 * ayudante que elegía entre «1 normal» y «5 normales» estaba aquí y quien lo
 * eche de menos merece saber que no falta: sobra.
 */
const varios = (n, palabra) => `${n} ${palabra}`;

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
 *   - named    conjunto de nombres que constan como named. OBLIGATORIO: la
 *              deducción vive en  (src/raid.js) y no aquí. Ver .
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
  const gordos = enemigos.filter((r) => esNamed(r.name, named));
  const normales = enemigos.filter((r) => !esNamed(r.name, named));

  // La cabecera: el named se nombra, los normales se cuentan. Sus nombres uno a
  // uno no le dicen nada a nadie y son justo lo que desborda.
  const quien = gordos.length
    ? gordos.map((r) => r.name).join(' + ') + (normales.length ? ` +${normales.length}` : '')
    : (normales.length === 1 ? normales[0].name
      : (normales.length ? varios(normales.length, 'enemigos') : (f.label ?? '')));

  const uno = (r) => `${r.etiqueta} ${num(r.damage)} `
    + `(${Math.round(r.damage / dur)}dps ${Math.round(r.damage / total * 100)}${pct})`;

  // Se quitan del final y se dice cuántos faltan. Nunca se corta a media
  // palabra: un nombre cortado es peor que un nombre ausente, porque parece un
  // nombre. Con uno solo se deja pasar aunque no quepa: mejor largo que vacío.
  //
  // «mas» sin tilde a propósito: ver arriba, el chat es ASCII y escribirla aquí
  // sólo serviría para que el saneador del final se la comiera.
  const cabeza = `${pre}${quien} ${secs(dur)} | TOTAL GRUPO ${num(total)} (${Math.round(total / dur)}dps)`;
  let l1 = cabeza;
  let dentro = 0;
  for (let n = aliados.length; n >= 1; n--) {
    const resto = aliados.length - n;
    const s = `${cabeza} | ${aliados.slice(0, n).map(uno).join(' | ')}`
      + (resto ? ` | +${resto} mas` : '');
    if (s.length <= limite || n === 1) { l1 = s; dentro = n; break; }
  }

  const lineas = [l1];
  if (conEnemigos && enemigos.length) {
    // `cuantos` es a cuántos bichos representa el trozo: el agregado vale por
    // todos los normales de golpe. Hace falta para que el «+N mas» cuente
    // enemigos y no renglones — decir «+1 mas» al tirar un agregado de seis
    // sería el mismo silencio que se quiere evitar.
    const trozo = (nombre, dmg, mx, cuantos) => ({
      cuantos,
      txt: `${nombre} - ${num(dmg)} (${Math.round(dmg / dur)}dps, max ${num(mx)})`,
    });
    // Por daño: si hay que recortar, cae antes el jefe que menos pegó.
    const partes = [...gordos]
      .sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0))
      .map((r) => trozo(corto(r.name), r.damage ?? 0, r.max ?? 0, 1));
    if (normales.length) {
      const dmg = normales.reduce((a, r) => a + (r.damage ?? 0), 0);
      const mx = Math.max(0, ...normales.map((r) => r.max ?? 0));
      // Con uno solo no hay nada que agregar y su nombre es el dato. Ver arriba.
      const etiqueta = normales.length === 1
        ? corto(normales[0].name)
        : varios(normales.length, 'normales');
      partes.push(trozo(etiqueta, dmg, mx, normales.length));
    }
    // Lo mismo que en la primera línea, y por lo mismo: caen los de menos daño y
    // se dice cuántos. Los normales van los últimos, así que caen antes que un
    // jefe: de un jefe se habla, de los añadidos no.
    let l2 = `${pre}vs ${partes.map((p) => p.txt).join(' | ')}`;
    for (let n = partes.length; n >= 1; n--) {
      const restan = partes.slice(n).reduce((a, p) => a + p.cuantos, 0);
      const s = `${pre}vs ${partes.slice(0, n).map((p) => p.txt).join(' | ')}`
        + (restan ? ` | +${restan} mas` : '');
      if (s.length <= limite || n === 1) { l2 = s; break; }
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
