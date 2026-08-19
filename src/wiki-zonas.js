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
export const ZONAS = Object.freeze({
  'Befallen': { segundos: 270, pagina: 'https://eqlwiki.com/Befallen', cita: 'Zone Spawn Timer: 4:30' },
  'Clan Crushbone': { segundos: 540, pagina: 'https://eqlwiki.com/Crushbone', cita: 'Zone Spawn Timer: 9:00' },
  'East Commonlands': { segundos: 400, pagina: 'https://eqlwiki.com/East_Commonlands', cita: 'Zone Spawn Timer: 6:40' },
  'East Freeport': { segundos: 1440, pagina: 'https://eqlwiki.com/Freeport', cita: 'Zone spawn timer: 24:00' },
  'Everfrost Peaks': { segundos: 400, pagina: 'https://eqlwiki.com/Everfrost_Peaks', cita: 'Zone Spawn Timer: 6:40' },
  'Halas': { segundos: 1440, pagina: 'https://eqlwiki.com/Halas', cita: 'Zone Spawn Timer: 24:00' },
  'Kedge Keep': { segundos: 1320, pagina: 'https://eqlwiki.com/Kedge_Keep', cita: 'Zone Spawn Timer: 22:00' },
  'Nagafen\'s Lair': { segundos: 1320, pagina: 'https://eqlwiki.com/Nagafen%27s_Lair', cita: 'Zone Spawn Timer: 22:00' },
  'Najena': { segundos: 290, pagina: 'https://eqlwiki.com/Najena', cita: 'Zone Spawn Timer: 4:50' },
  'North Freeport': { segundos: 1440, pagina: 'https://eqlwiki.com/Freeport', cita: 'Zone spawn timer: 24:00' },
  'North Kaladim': { segundos: 1440, pagina: 'https://eqlwiki.com/Kaladim', cita: 'Zone Spawn Timer: 24:00' },
  'Paineel': { segundos: null, pagina: 'https://eqlwiki.com/Paineel', cita: 'no declara' },
  'Permafrost Keep': { segundos: 425, pagina: 'https://eqlwiki.com/Permafrost', cita: 'Zone Spawn Timer: 7:05' },
  'Qeynos Hills': { segundos: 400, pagina: 'https://eqlwiki.com/Qeynos_Hills', cita: 'Zone Spawn Timer: 6:40' },
  'The Castle of Mistmoore': { segundos: 390, pagina: 'https://eqlwiki.com/Mistmoore_Castle', cita: 'Respawn time: 6.5 minutes for the zone (Mistmoore castle has both 6 AM/8 PM respawns for vampires which reset the timer).' },
  'The Feerrott': { segundos: 400, pagina: 'https://eqlwiki.com/The_Feerrott', cita: 'Zone Spawn Timer: 6:40' },
  'The Lair of the Splitpaw': { segundos: 390, pagina: 'https://eqlwiki.com/Splitpaw_Lair', cita: 'Zone Spawn Timer: 6:30' },
  'The Lesser Faydark': { segundos: 400, pagina: 'https://eqlwiki.com/Lesser_Faydark', cita: 'Spawn timer: 6:40' },
  'The Northern Desert of Ro': { segundos: 400, pagina: 'https://eqlwiki.com/The_Northern_Desert_of_Ro', cita: 'Zone Spawn Timer: 6:40' },
  'The Oasis of Marr': { segundos: 400, pagina: 'https://eqlwiki.com/Oasis_of_Marr', cita: 'Zone Spawn Timer: 6:40' },
  'The Ocean of Tears': { segundos: 360, pagina: 'https://eqlwiki.com/Ocean_of_Tears', cita: 'Zone Spawn Timer: 6:00' },
  'The Permafrost Caverns': { segundos: 425, pagina: 'https://eqlwiki.com/Permafrost', cita: 'Zone Spawn Timer: 7:05' },
  'The Plane of Fear': { segundos: null, pagina: 'https://eqlwiki.com/Plane_of_Fear', cita: 'no declara' },
  'The Plane of Hate': { segundos: null, pagina: 'https://eqlwiki.com/Plane_of_Hate', cita: 'no declara' },
  'The Plane of Sky': { segundos: null, pagina: 'https://eqlwiki.com/Plane_of_Sky', cita: 'no declara' },
  'The Ruins of Old Guk': { segundos: 660, pagina: 'https://eqlwiki.com/Lower_Guk', cita: 'Zone Spawn Timer: 11:00 (y, aparte del recuadro: "Zone Respawn Time = 28 minutes" = 1680 s)' },
  'The Ruins of Old Paineel': { segundos: 468, pagina: 'https://eqlwiki.com/The_Hole', cita: 'Zone Spawn Timer: 7:48' },
  'The Southern Plains of Karana': { segundos: 360, pagina: 'https://eqlwiki.com/Southern_Karana', cita: 'Zone Spawn Timer: 6:00' },
  'The Warrens': { segundos: 400, pagina: 'https://eqlwiki.com/The_Warrens', cita: 'Zone Spawn Timer: 6:40' },
  'Toxxulia Forest': { segundos: 400, pagina: 'https://eqlwiki.com/Toxxulia_Forest', cita: 'Zone Spawn Timer: 6:40' },
  'West Commonlands': { segundos: 400, pagina: 'https://eqlwiki.com/West_Commonlands', cita: 'Zone Spawn Timer: 6:40' },
  'West Freeport': { segundos: 1440, pagina: 'https://eqlwiki.com/Freeport', cita: 'Zone spawn timer: 24:00' },
});

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
  if (!base) return null;
  /**
   * EL DÍGITO DE DIFICULTAD PUEDE VENIR PEGADO AL NOMBRE, y hay que quitarlo
   * para buscar aquí.
   *
   * `parseZone` separa el dígito cuando la línea trae su etiqueta —`Befallen 2
   * (Adaptive)` da base «Befallen»— pero lo DEJA DENTRO cuando no la trae:
   * `Befallen 2` a secas da base «Befallen 2». Las dos formas conviven en el
   * mismo registro, así que buscar sólo por la literal fallaría en la mitad de
   * los casos y en silencio: devolvería null, la ficha diría «aún no», y nadie
   * sabría que el número existía.
   */
  const z = ZONAS[base] ?? ZONAS[String(base).replace(/ [0-9]$/, '')] ?? null;
  return z?.segundos != null ? { segundos: z.segundos, pagina: z.pagina } : null;
}
