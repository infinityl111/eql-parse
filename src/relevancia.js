/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ¿ESTE SUCESO ES DE ESTA PELEA? UNA PREGUNTA, UN SITIO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El registro ve TODO lo que pasa alrededor, incluido un desconocido matando
 * bichos a diez metros. Decidir qué entra en una pelea y qué no es una de las
 * preguntas más caras del programa, y se contestaba en DOS sitios con DOS
 * reglas distintas:
 *
 *   `src/encounter.js` — la buena. Un suceso cuenta si toca a los tuyos, o a
 *     alguien a quien los tuyos ya estáis pegando.
 *
 *   `src/guion.js` — la del reproductor, que releía el registro entre el inicio
 *     y el fin de la pelea y metía como actor a CUALQUIERA que saliera en esa
 *     ventana. Una ventana de tiempo usada como si fuera una lista de
 *     pertenencia.
 *
 * ── LO QUE COSTABA, MEDIDO — Y REMEDIDO, PORQUE LA PRIMERA CIFRA ERA MALA ───
 *
 * Aquí decía «1.257 peleas (80,5 %) con actores ajenos y 184 (11,8 %) en las que
 * esos ajenos se pegan». ESAS DOS CIFRAS NO SON DE ESTE CÓDIGO: salían de un
 * arnés que contaba NOMBRES EN LA VENTANA, no figuras dibujadas, y la etiqueta
 * «...y esos ajenos SE PEGAN» estaba puesta sobre un recuento de «algún golpe
 * que TOCA a un ajeno», que es otra cosa y mucho más frecuente.
 *
 * LA MEDICIÓN BUENA se hace corriendo el mundo con este fichero y sin él: se
 * ejecuta el `guion.js` anterior al arreglo y el de hoy sobre EL MISMO almacén y
 * EL MISMO registro, y se cuentan las figuras que cada uno DIBUJA. Es la
 * partición diferencial aplicada a un dibujo — ver la undécima familia en
 * `ui/app.js`.
 *
 * Medido el 16 de agosto de 2026 sobre el almacén de Miguel (1.493 peleas con
 * combatientes) y `eqlog_Campeon_erudin.txt` (985.189 líneas con cabecera):
 *
 *                                            SIN la guarda   CON la guarda
 *     peleas con alguna figura AJENA           446 (29,9 %)    190 (12,7 %)
 *     ...con algún golpe que TOCA a un ajeno   156 (10,4 %)          —
 *     ...con combate ENTRE dos ajenos           49 ( 3,3 %)      0 (0,0 %)
 *
 * Y sobre un almacén reconstruido ese mismo día desde ese mismo registro (1.504
 * peleas): 463 (30,8 %) -> 203 (13,5 %), y 49 -> 0. Las dos cuentas dan lo
 * mismo, que es lo que se le pide a una medición.
 *
 * LAS 190 QUE CONSERVAN UN AJENO SON LAS LEGÍTIMAS: 266 figuras en total,
 * ninguna de ellas peleando con otro ajeno, todas habiendo tocado a alguien de
 * la pelea. Es la categoría que este fichero existe para conservar.
 *
 * LA PEOR —11 de agosto, 19:34:32, hora local— es una pelea de 99 segundos con
 * TRES combatientes: `Campeon`, `Vobn` y `a rock golem`. El reproductor dibujaba
 * TRECE figuras: diez actores de dos combates ajenos —`Matherdon`,
 * `a flighty fiend`, `Kabartik`, `a ratman warrior` y seis más— con 468 golpes
 * entre ellos dentro. Hoy dibuja tres.
 *
 * (El «17:34:32» que se escribió al principio era esa misma pelea con la hora en
 * UTC. El registro va en hora local y la lista de peleas también, así que la
 * hora que se cita tiene que ser la local o no se encuentra la pelea.)
 *
 * Y NO ERA UN FILTRO FLOJO: era una respuesta propia a una pregunta que ya
 * estaba contestada. Por eso el arreglo no es endurecer aquella regla, es
 * borrarla y llamar a ésta.
 *
 * ── ES LA MISMA FORMA QUE EL COMBATE CONTRA CADÁVERES ──────────────────────
 *
 * Aquel fallo era una ventana de tiempo tratada como pertenencia: si la línea
 * cae dentro del rato, es de la pelea. Éste es idéntico con otro sujeto —allí
 * eran los muertos, aquí los desconocidos— y por eso el parche de entonces no
 * protegía de esto: tapaba un síntoma de la misma raíz.
 *
 * ── LA REGLA, EN UNA FRASE ─────────────────────────────────────────────────
 *
 *     QUIEN SÓLO INTERACTÚA CON QUIEN NO ESTÁ EN LA PELEA, NO ESTÁ EN LA PELEA.
 *
 * Es la definición de pelea de la 1.14.0 —un componente conexo— aplicada donde
 * nunca se había aplicado: al decidir qué se dibuja.
 *
 * ── LOS DOS LLAMADORES PREGUNTAN LO MISMO CON DISTINTA INFORMACIÓN ─────────
 *
 * El motor pregunta MIENTRAS la pelea crece, así que sus conjuntos van
 * cambiando: `foesSeen` se llena a medida que golpeas. El reproductor pregunta
 * cuando la pelea YA ESTÁ DECIDIDA, así que le pasa el reparto entero como
 * respuesta cerrada. Es la misma pregunta contestada con la información que
 * cada uno tiene, no dos preguntas.
 */

/** Los tipos que cuentan como daño, para `compaPega`. Mismo conjunto que el motor. */
export const DAÑO = new Set(['melee', 'spell', 'dot', 'ds']);

/**
 * ¿Cuenta este suceso para esta pelea?
 *
 * @param {object} ev  el suceso ya parseado
 * @param {object} ctx
 * @param {Set<string>} ctx.mios        tú y tus mascotas
 * @param {Set<string>} ctx.objetivos   a quién estáis pegando (`foesSeen` en vivo,
 *   el reparto entero cuando la pelea ya está cerrada)
 * @param {Set<string>} ctx.enPelea     quién figura ya como combatiente
 * @param {Set<string>} ctx.companions  compañeros DECLARADOS a mano
 */
export function esRelevante(ev, { mios, objetivos, enPelea, companions }) {
  const rel = (n) => !!n && (mios.has(n) || objetivos.has(n));
  const dentro = (n) => !!n && enPelea.has(n);
  /**
   * Un compañero DECLARADO pegando también cuenta, y es lo que permite que la
   * pelea de tu grupo exista cuando tú no llegaste a tocar al enemigo. Sólo
   * pegando: un fallo o una curación suya abrirían un encuentro vacío.
   *
   * Y no abre la puerta a cualquiera: pide estar en la lista escrita a mano.
   */
  const compaPega = companions.size > 0
    && DAÑO.has(ev.kind) && ev.amount > 0
    && (companions.has(ev.source) || companions.has(ev.target));
  /**
   * Las muertes no traen `source` ni `target`, sino `victim` y `killer`: hay que
   * mirar los cuatro. Mirando sólo los dos primeros se descartaban TODAS las
   * muertes, y con ellas los abatidos, el nombre de la pelea y la vida estimada
   * del enemigo.
   */
  return ev.kind === 'death'
    ? (rel(ev.victim) || rel(ev.killer) || dentro(ev.victim) || dentro(ev.killer))
    : (rel(ev.source) || rel(ev.target) || compaPega);
}
