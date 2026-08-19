/**
 * LA TABLA DE TIEMPOS DECLARADOS POR eqlwiki.
 *
 * ⚠ ESTA BATERÍA FIJA SIGNIFICADO, no un observable: decide qué es una entrada
 * válida y cómo se busca. Si se pone roja hay que leerla, no acallarla.
 *
 * Lo que vigila no es el contenido —que se corrige recogiendo la wiki otra
 * vez— sino la FORMA, que es donde estaría el fallo silencioso: una entrada sin
 * página, un segundo sin cita, o una búsqueda que devuelve null cuando el dato
 * existe. Los tres fallan callando.
 */
import { ZONAS, CONSULTADA, tiempoDeZona } from '../src/wiki-zonas.js';

let failed = 0;
const ok = (cond, msg, extra) => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ok ' : 'MAL'}  ${msg}${extra !== undefined ? ` — ${extra}` : ''}`);
};

const filas = Object.entries(ZONAS);

console.log('\ncada entrada trae de dónde salió');
{
  ok(filas.length >= 30, 'la tabla tiene las zonas del histórico', filas.length);

  /**
   * UNA CIFRA SIN SU FUENTE NO SE PUEDE IR A COMPROBAR, y entonces no se
   * distingue de una inventada. La página es obligatoria SIEMPRE, también en
   * las que no declaran tiempo: sin ella, «no declara» sería una afirmación de
   * la que nadie podría dudar.
   */
  const sinPagina = filas.filter(([, z]) => !z.pagina || !/^https:\/\/eqlwiki\.com\//.test(z.pagina));
  ok(sinPagina.length === 0, 'todas traen su página de eqlwiki',
    sinPagina.map(([n]) => n).join(', ') || '0');

  const sinCita = filas.filter(([, z]) => !z.cita);
  ok(sinCita.length === 0, 'y todas traen la cita literal, también las que no declaran',
    sinCita.map(([n]) => n).join(', ') || '0');

  ok(/^\d{4}-\d{2}-\d{2}$/.test(CONSULTADA), 'y consta la fecha de consulta', CONSULTADA);
}

console.log('\nlos valores son plausibles o son null, sin puntos medios');
{
  const raros = filas.filter(([, z]) => z.segundos != null
    && (!Number.isInteger(z.segundos) || z.segundos <= 0 || z.segundos > 7 * 86400));
  ok(raros.length === 0, 'ningún tiempo es cero, negativo, fraccionario ni absurdo',
    raros.map(([n, z]) => `${n}=${z.segundos}`).join(', ') || '0');

  /**
   * «No declara» tiene que ser `null` y no `0`. Un cero diría «reaparece al
   * instante», que es una afirmación, y lo que hay es una ausencia.
   */
  const ceros = filas.filter(([, z]) => z.segundos === 0);
  ok(ceros.length === 0, 'la ausencia se escribe null y nunca cero');
  const nulos = filas.filter(([, z]) => z.segundos == null);
  ok(nulos.length > 0, 'y hay zonas que no lo declaran: eso es un dato, no un hueco',
    nulos.map(([n]) => n).join(', '));
}

console.log('\nla búsqueda aguanta el dígito de dificultad pegado al nombre');
{
  /**
   * `parseZone` separa el dígito cuando la línea trae etiqueta —`Befallen 2
   * (Adaptive)` da «Befallen»— y lo DEJA DENTRO cuando no la trae: `Befallen 2`
   * a secas da «Befallen 2». Las dos formas conviven en el mismo registro.
   */
  const conNombre = filas.find(([, z]) => z.segundos != null);
  const [nombre, z] = conNombre;
  ok(tiempoDeZona(nombre)?.segundos === z.segundos, `«${nombre}» se encuentra por su nombre`);
  ok(tiempoDeZona(`${nombre} 2`)?.segundos === z.segundos,
    'y también con el dígito de dificultad pegado');
  ok(tiempoDeZona(nombre)?.pagina === z.pagina, 'y devuelve la página con el número');

  /**
   * CONTROL POSITIVO. Sin esto, todo lo de arriba pasaría con una función que
   * devolviera siempre la primera fila. Una zona que no está tiene que dar
   * null, y una que está pero no declara, también.
   */
  ok(tiempoDeZona('Zona Que No Existe') === null,
    'CONTROL: una zona que no está da null');
  const sinTiempo = filas.find(([, x]) => x.segundos == null);
  ok(tiempoDeZona(sinTiempo[0]) === null,
    `CONTROL: «${sinTiempo[0]}» está en la tabla y no declara: también null`);
  ok(tiempoDeZona(null) === null && tiempoDeZona('') === null,
    'CONTROL: sin zona, null y sin reventar');

  /**
   * Y que el recorte del dígito no se coma parte de un nombre de verdad: sólo
   * quita « <dígito>» al final, no cualquier número.
   */
  ok(tiempoDeZona('Befallen 22') === null || tiempoDeZona('Befallen 22')?.segundos === undefined
    || ZONAS['Befallen 22'] !== undefined,
    'CONTROL: sólo se recorta UN dígito final, no cualquier número');
}

console.log('\nlo que la tabla NO dice, dicho aquí para que no se olvide');
{
  /**
   * La wiki declara UNA cifra por zona. Nuestras claves son zona + dificultad +
   * modo, así que varias comparten la misma cifra — y eso no es un error de la
   * tabla, es la granularidad de la fuente. Se fija aquí porque es la clase de
   * cosa que alguien «arregla» sin saber.
   */
  const porPagina = new Map();
  for (const [n, z] of filas) porPagina.set(z.pagina, [...(porPagina.get(z.pagina) ?? []), n]);
  const compartidas = [...porPagina.values()].filter((l) => l.length > 1);
  ok(compartidas.length > 0,
    'hay zonas nuestras que comparten página, y es correcto: la wiki es más gruesa',
    compartidas.map((l) => l.join(' = ')).join(' · '));
}

console.log(failed ? `\n${failed} MAL\n` : '\ntodo bien\n');
process.exit(failed ? 1 : 0);
