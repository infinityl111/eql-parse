/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOS TIEMPOS DE ZONA QUE DECLARA eqlwiki. DECLARADO, nunca medido.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada cifra de aquí sale de la PÁGINA INDIVIDUAL de su zona en `eqlwiki.com`,
 * copiada con su cita literal y su fecha de consulta. No sale de nuestro
 * registro, no la hemos medido nosotros, y en pantalla se rotula «de la wiki»
 * con la página al lado — para que quien la lea pueda ir a comprobarla.
 *
 * ── POR QUÉ LA PÁGINA DE ZONA Y NO LA TABLA RESUMEN ───────────────────────
 *
 * Son DOS FUENTES DISTINTAS y no coinciden. En Befallen, la tabla resumen
 * falla por un factor 4,2× mientras la página de zona da 4:30. Mezclarlas en
 * una columna sería juntar dos cosas que no dicen lo mismo, que es la forma
 * que este proyecto lleva treinta y dos familias persiguiendo.
 *
 * ── LO QUE ESTA TABLA NO AUTORIZA ─────────────────────────────────────────
 *
 * NO VALIDA NUESTRAS MEDIDAS, y no por prudencia: está medido que no puede.
 * `PERIODOS-CONGELADOS.md` §12 y §13 miden que la wiki declara UNA cifra por
 * zona mientras nuestras claves contienen varios racimos a valores distintos —
 * Old Guk D2 tiene seis, de 100 a 567 s. Es GRANULARIDAD distinta, no un error
 * de nadie. Que un número de aquí y uno nuestro no cuadren es lo esperable, y
 * por eso la ficha los enseña los dos y dice en cuánto discrepan sin decidir.
 *
 * Y al revés también: que cuadren tampoco confirma nada. Las dos cosas están
 * escritas ahí para no tener que volver a discutirlo.
 *
 * ── LA CLAVE ES LA ZONA BASE ──────────────────────────────────────────────
 *
 * Sin dificultad y sin modo: la wiki no los distingue. Así que el mismo valor
 * se ofrece a `Befallen D2` y a `Befallen D4`, y eso es una limitación de la
 * fuente que hay que conocer antes de leerla, no un descuido.
 */

/**
 * Zona base → { segundos, pagina, cita }.
 *
 * `pagina` es la URL exacta que resolvió, y `cita` el texto literal del campo.
 * Una zona cuya página NO declara tiempo va con `segundos: null` y su motivo:
 * «no lo declara» es un dato, no un hueco, y sin escribirlo alguien volvería a
 * buscarlo dentro de un mes.
 */
export const ZONAS = Object.freeze({});

/** Cuándo se consultaron. Va aquí y no en un comentario para poder enseñarla. */
export const CONSULTADA = '2026-08-19';

/**
 * El tiempo declarado para una zona base, o null.
 *
 * Devuelve null tanto si la zona no está como si su página no declara tiempo:
 * las dos son «no tenemos número», y quien pinta no necesita distinguirlas
 * porque en los dos casos la línea de la ficha dice lo mismo.
 */
export function tiempoDeZona(base) {
  const z = base ? ZONAS[base] : null;
  return z?.segundos != null ? { segundos: z.segundos, pagina: z.pagina } : null;
}
