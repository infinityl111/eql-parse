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
 * ── LO QUE COSTABA, MEDIDO ─────────────────────────────────────────────────
 *
 * Sobre las 1.561 peleas con combatientes del registro de referencia:
 *
 *     con actores AJENOS dentro de la ventana      1.257   (80,5 %)
 *     ...y en las que esos ajenos SE PEGAN            184   (11,8 %)
 *
 * La peor —11 de agosto, 17:34:32— es una pelea de 98 segundos con TRES
 * combatientes de verdad, once actores ajenos y 495 golpes entre ellos dentro.
 * El reproductor dibujaba catorce figuras donde hubo tres.
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
