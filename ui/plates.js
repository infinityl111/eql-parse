/**
 * Las láminas de la enciclopedia.
 *
 * Dibujadas a mano en SVG, no generadas ni traídas de fuera: la aplicación no
 * pide una sola imagen por la red y no hay ningún fichero binario que mantener.
 *
 * Están pintadas con las variables de color de la interfaz —`currentColor` para
 * la tinta, `var(--slate-800)` para el papel, los acentos del juego para lo que
 * señala—, así que el tema claro no es otra imagen: es la misma lámina con la
 * tinta y el pergamino cambiados. Sólo hay un color literal, el hueco de las
 * órbitas: un agujero es oscuro en los dos temas, y con una variable dejaría de
 * serlo en el claro.
 *
 * Cuadradas y sin márgenes propios: la tarjeta las estira a su ancho.
 *
 * Los motivos dicen algo cierto o no están. La carta lleva rosa de los vientos
 * y escala porque una zona sin su dificultad es media zona; el cráneo lleva la
 * cuenta a palotes porque todo lo que hay dentro sale de encuentros contados.
 */

/** El marco común: doble filete y las cuatro escuadras. */
const MARCO = `
  <rect x="8.5" y="8.5" width="183" height="183" stroke-opacity=".38"/>
  <rect x="12.5" y="12.5" width="175" height="175" stroke-opacity=".16"/>
  <g stroke-opacity=".55" stroke-width="1.4">
    <path d="M8.5 22V8.5H22M178 8.5h13.5V22M191.5 178v13.5H178M22 191.5H8.5V178"/>
  </g>`;

/** El perfil de la isla, repetido tres veces: orilla, tierra y línea de costa. */
const COSTA = 'M60 74 78 66 92 74 106 62 124 66 136 60 150 72 160 90 154 104 166 116 '
  + '158 132 142 136 128 150 110 146 96 154 78 146 66 150 56 136 62 122 50 112 54 94Z';

const ZONAS = `
  <g stroke="currentColor" fill="none">
    <g stroke-opacity=".06"><path d="M50 8V192M100 8V192M150 8V192M8 50H192M8 100H192M8 150H192"/></g>
    ${MARCO}
  </g>

  <!-- mar: cuatro ondas, que es lo que dice «esto es una carta» -->
  <g stroke="currentColor" stroke-opacity=".17" fill="none">
    <path d="M24 46q5-4 10 0t10 0M24 56q5-4 10 0t10 0"/>
    <path d="M150 168q5-4 10 0t10 0M150 176q5-4 10 0t10 0"/>
    <path d="M28 152q5-4 10 0t10 0"/>
  </g>

  <!-- costa: el eco de fuera hace de bajío y el de dentro de línea de playa -->
  <g fill="none" stroke="currentColor" stroke-linejoin="round">
    <path d="${COSTA}" transform="translate(105 106) scale(1.07) translate(-105 -106)" stroke-opacity=".12"/>
    <path d="${COSTA}" fill="var(--t-melee)" fill-opacity=".10" stroke-opacity=".8" stroke-width="1.7"/>
    <path d="${COSTA}" transform="translate(105 106) scale(.9) translate(-105 -106)"
          stroke-opacity=".2" stroke-dasharray="2 3"/>
  </g>
  <path d="M40 130 46 126 50 132 44 136Z" fill="var(--t-melee)" fill-opacity=".10"
        stroke="currentColor" stroke-opacity=".55"/>

  <!-- sierra, con la ladera a plumilla -->
  <g fill="none" stroke="currentColor" stroke-linejoin="round">
    <g stroke-opacity=".75" stroke-width="1.5">
      <path d="M92 108 106 84 120 108Z"/><path d="M114 108 124 92 134 108Z"/><path d="M78 110 88 96 98 110Z"/>
    </g>
    <g stroke-opacity=".3"><path d="M106 88 101 100M106 94 103 102M124 96 120 104M88 100 85 106"/></g>
  </g>
  <g stroke="currentColor" stroke-opacity=".5" fill="none" stroke-linejoin="round">
    <path d="M74 132v-4M69 128h10l-5-9ZM88 136v-4M83 132h10l-5-9ZM100 130v-4M95 126h10l-5-9Z"/>
  </g>
  <path d="M110 106q-4 12 2 20t-4 18-2 12" fill="none" stroke="var(--t-cold)"
        stroke-opacity=".35" stroke-width="1.3"/>

  <!-- la ruta y su destino -->
  <g fill="none" stroke="var(--t-cold)" stroke-width="1.7">
    <path d="M66 140q18 2 28-8t28-12" stroke-dasharray="3 4" stroke-opacity=".9"/>
    <path d="M117 115l11 11M128 115l-11 11"/>
  </g>
  <circle cx="66" cy="140" r="2.8" fill="var(--t-cold)" fill-opacity=".9"/>

  <!-- rosa de los vientos -->
  <g transform="translate(155 46)">
    <circle r="16" fill="none" stroke="currentColor" stroke-opacity=".3"/>
    <circle r="11.5" fill="none" stroke="currentColor" stroke-opacity=".16"/>
    <path d="M0-16 3.4-3.4 16 0 3.4 3.4 0 16-3.4 3.4-16 0-3.4-3.4Z"
          fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-opacity=".55"/>
    <path d="M0-16 3.4-3.4 0 0-3.4-3.4Z" fill="var(--t-cold)" fill-opacity=".9"/>
    <path d="M-11-11-2.6-2.6M11 11 2.6 2.6M11-11 2.6-2.6M-11 11-2.6 2.6"
          stroke="currentColor" stroke-opacity=".3" fill="none"/>
  </g>

  <!-- escala -->
  <g transform="translate(28 174)" stroke="currentColor" stroke-opacity=".45" fill="none">
    <path d="M0 0h44M0-3.5v7M11-2v4M22-3.5v7M33-2v4M44-3.5v7"/>
  </g>`;

const ENEMIGOS = `
  <g stroke="currentColor" fill="none">${MARCO}</g>

  <!-- medallón de lámina de bestiario -->
  <g transform="translate(100 94)">
    <path d="M0-64 55-32V32L0 64-55 32V-32Z" fill="var(--t-ds)" fill-opacity=".08"
          stroke="currentColor" stroke-opacity=".28"/>
    <path d="M0-56 48-28V28L0 56-48 28V-28Z" fill="none" stroke="currentColor" stroke-opacity=".14"/>
  </g>

  <g fill="var(--t-melee)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".75" stroke-width="1.7">
    <path d="M70 72C54 62 44 46 48 32c6 14 16 24 28 30Z"/>
    <path d="M130 72c16-10 26-26 22-40-6 14-16 24-28 30Z"/>
  </g>
  <path d="M100 44c22 0 38 17 38 40 0 12-5 22-12 28-2 7-8 11-16 12l-2 10H92l-2-10c-8-1-14-5-16-12-7-6-12-16-12-28 0-23 16-40 38-40Z"
        fill="var(--t-melee)" fill-opacity=".13" stroke="currentColor" stroke-opacity=".85" stroke-width="1.8"/>
  <g fill="none" stroke="currentColor" stroke-opacity=".18"><path d="M78 60q22-14 44 0M74 70q26-16 52 0"/></g>

  <!-- órbitas huecas, con la brasa dentro -->
  <path d="M95 84 74 78c-6 2-8 9-4 14 5 6 15 7 21 2 3-3 4-7 4-10Z"
        fill="#171C24" stroke="currentColor" stroke-opacity=".7" stroke-width="1.4"/>
  <path d="M105 84l21-6c6 2 8 9 4 14-5 6-15 7-21 2-3-3-4-7-4-10Z"
        fill="#171C24" stroke="currentColor" stroke-opacity=".7" stroke-width="1.4"/>
  <circle cx="84" cy="87" r="2.9" fill="var(--t-ds)"/>
  <circle cx="116" cy="87" r="2.9" fill="var(--t-ds)"/>
  <path d="M100 98l5 12H95Z" fill="currentColor" fill-opacity=".5"/>
  <g stroke="currentColor" stroke-opacity=".55" fill="none"><path d="M86 118h28M92 118v9M100 118v10M108 118v9"/></g>

  <!-- una muesca por encuentro medido -->
  <g stroke="currentColor" stroke-opacity=".45" stroke-width="1.7" fill="none">
    <path d="M64 174v-15M72 174v-15M80 174v-15M88 174v-15M62 160l28 14"/>
    <path d="M106 174v-15M114 174v-15M122 174v-15M130 174v-15"/>
  </g>`;

/**
 * Botín: el arcón y su etiqueta.
 *
 * La etiqueta colgando no es adorno: lo que esta sección contesta no es «qué
 * objetos hay» sino «de quién cayó éste», y una etiqueta atada a la pieza es
 * exactamente eso.
 */
const BOTIN = `
  <g stroke="currentColor" fill="none">${MARCO}</g>
  <g fill="none" stroke="currentColor" stroke-linejoin="round">
    <!-- tapa abombada -->
    <path d="M40 104a60 38 0 0 1 120 0Z" fill="var(--t-poison)" fill-opacity=".09"
          stroke-opacity=".85" stroke-width="1.8"/>
    <!-- cuerpo -->
    <path d="M40 104h120v48H40Z" fill="var(--t-melee)" fill-opacity=".10"
          stroke-opacity=".85" stroke-width="1.8"/>
    <path d="M40 104h120" stroke-opacity=".5"/>
    <path d="M34 152h132" stroke-opacity=".55" stroke-width="1.6"/>
    <!-- herrajes -->
    <g stroke-opacity=".42">
      <path d="M64 72v80M136 72v80"/>
      <path d="M44 116h112M44 140h112" stroke-opacity=".18"/>
    </g>
    <!-- cerradura -->
    <path d="M86 98h28v26H86Z" fill="var(--slate-800)" stroke-opacity=".8" stroke-width="1.5"/>
    <circle cx="100" cy="108" r="4" stroke-opacity=".8"/>
    <path d="M100 112v7" stroke-opacity=".8"/>
  </g>
  <!-- la etiqueta, atada a la cerradura -->
  <g fill="none" stroke="currentColor">
    <path d="M114 118q16 6 20 22" stroke-opacity=".45" stroke-width="1.4"/>
    <g transform="translate(130 140) rotate(12)">
      <path d="M0 0h40l10 13-10 13H0Z" fill="var(--slate-800)" stroke-opacity=".75" stroke-width="1.5"/>
      <circle cx="9" cy="13" r="2.6" stroke-opacity=".55"/>
      <path d="M17 8h22M17 18h16" stroke-opacity=".35"/>
    </g>
  </g>
  <!-- lo que ya ha salido de él -->
  <g stroke="currentColor" stroke-opacity=".42" fill="none" stroke-linejoin="round">
    <circle cx="42" cy="166" r="7"/><circle cx="58" cy="174" r="4.5"/>
    <path d="M22 172 30 162 38 172 30 182Z"/>
  </g>`;

/**
 * Mis hechizos: el libro abierto y el sello.
 *
 * El sello va suelto y por encima porque lo que se guarda no es el libro —EQL
 * no publica ninguno— sino lo que has lanzado tú.
 */
const HECHIZOS = `
  <g stroke="currentColor" fill="none">${MARCO}</g>
  <!-- sello -->
  <g transform="translate(100 62)" fill="none" stroke="currentColor">
    <circle r="34" stroke-opacity=".3"/>
    <circle r="27" stroke-opacity=".15"/>
    <path d="M0-27 23.4 13.5-23.4 13.5Z" fill="var(--t-magic)" fill-opacity=".16"
          stroke-opacity=".65" stroke-width="1.5"/>
    <circle r="10" stroke-opacity=".5"/>
    <g stroke-opacity=".45" stroke-width="1.4">
      <path d="M0-34v-7M0 34v7M-34 0h-7M34 0h7M-24-24-29-29M24 24 29 29M24-24 29-29M-24 24-29 29"/>
    </g>
    <circle r="4" fill="var(--t-magic)" fill-opacity=".85" stroke="none"/>
  </g>
  <!-- libro abierto -->
  <g fill="none" stroke="currentColor" stroke-linejoin="round">
    <path d="M100 118c-18-11-40-14-62-10v52c22-4 44-1 62 10Z"
          fill="var(--t-melee)" fill-opacity=".11" stroke-opacity=".85" stroke-width="1.8"/>
    <path d="M100 118c18-11 40-14 62-10v52c-22-4-44-1-62 10Z"
          fill="var(--t-melee)" fill-opacity=".07" stroke-opacity=".85" stroke-width="1.8"/>
    <path d="M100 118v52" stroke-opacity=".55"/>
    <g stroke-opacity=".28">
      <path d="M48 122q22 0 44 8M48 134q22 0 44 8M48 146q22 0 44 8"/>
      <path d="M152 122q-22 0-44 8M152 134q-22 0-44 8M152 146q-22 0-44 8"/>
    </g>
  </g>`;

/**
 * Mi progresión: el cuadrante.
 *
 * Un instrumento de medir y no una flecha subiendo, porque lo que se enseña son
 * marcas medidas y agrupadas por nivel; la línea de dentro es lo que el
 * instrumento midió, no una promesa de que vaya a seguir subiendo.
 */
const PROGRESO = `
  <g stroke="currentColor" fill="none">${MARCO}</g>
  <g transform="translate(44 158)" fill="none" stroke="currentColor" stroke-linejoin="round">
    <path d="M0 0h116M0 0V-116" stroke-opacity=".5" stroke-width="1.5"/>
    <path d="M116 0A116 116 0 0 0 0-116" stroke-opacity=".75" stroke-width="1.8"
          fill="var(--t-fire)" fill-opacity=".05"/>
    <!-- graduación cada 15° -->
    <g stroke-opacity=".45" stroke-width="1.4">
      <path d="M112-30 102.3-27.4M100.4-58 91.9-53M82-82 75-75M58-100.4 53-91.9M30-112 27.4-102.3"/>
    </g>
    <!-- la plomada -->
    <path d="M0 0 75-88" stroke="var(--t-fire)" stroke-opacity=".8" stroke-width="1.6"/>
    <circle cx="75" cy="-88" r="3.6" fill="var(--t-fire)" fill-opacity=".85" stroke="none"/>
    <!-- lo medido -->
    <path d="M14-18 38-38 62-32 86-64 106-76" stroke-opacity=".5" stroke-dasharray="3 3"/>
    <g fill="currentColor" fill-opacity=".5" stroke="none">
      <circle cx="14" cy="-18" r="2.6"/><circle cx="38" cy="-38" r="2.6"/>
      <circle cx="62" cy="-32" r="2.6"/><circle cx="86" cy="-64" r="2.6"/>
      <circle cx="106" cy="-76" r="2.6"/>
    </g>
  </g>`;

/**
 * Habilidades de los enemigos: la rueda de referencias cruzadas.
 *
 * Es el índice leído al revés, y eso es lo que dibuja: una habilidad en el
 * centro y las marcas del anillo que la lanzan. Tres trazos de acento y no
 * ocho, porque la gracia de la sección es que sólo algunos la tienen.
 */
const HABILIDADES = `
  <g stroke="currentColor" fill="none">${MARCO}</g>
  <g transform="translate(100 100)" fill="none" stroke="currentColor">
    <circle r="66" stroke-opacity=".28"/>
    <circle r="58" stroke-opacity=".14"/>
    <!-- las doce marcas del anillo: cada una un enemigo -->
    <g stroke-opacity=".5" stroke-width="1.6">
      <path d="M0-66v-8"/><path d="M33-57.2 37-64.1"/><path d="M57.2-33 64.1-37"/>
      <path d="M66 0h8"/><path d="M57.2 33 64.1 37"/><path d="M33 57.2 37 64.1"/>
      <path d="M0 66v8"/><path d="M-33 57.2-37 64.1"/><path d="M-57.2 33-64.1 37"/>
      <path d="M-66 0h-8"/><path d="M-57.2-33-64.1-37"/><path d="M-33-57.2-37-64.1"/>
    </g>
    <!-- las que sí la lanzan -->
    <g stroke="var(--t-dot)" stroke-opacity=".8" stroke-width="1.6">
      <path d="M0-58 0-20M50.2-29 17.3-10M-28.9-50.2-10-17.3"/>
    </g>
    <g fill="var(--t-dot)" fill-opacity=".85" stroke="none">
      <circle cx="0" cy="-58" r="3.4"/><circle cx="50.2" cy="-29" r="3.4"/>
      <circle cx="-28.9" cy="-50.2" r="3.4"/>
    </g>
    <!-- la habilidad, en el centro -->
    <path d="M0-22 19-11V11L0 22-19 11V-11Z" fill="var(--t-dot)" fill-opacity=".14"
          stroke-opacity=".6" stroke-width="1.5"/>
    <path d="M0-11 9.5 5.5H-9.5Z" fill="currentColor" fill-opacity=".45" stroke="none"/>
  </g>`;

/**
 * Mis muertes: la estela y la cuenta.
 *
 * Las muescas al pie son las mismas que las de la lámina de Enemigos, y a
 * propósito: allí cuentan encuentros y aquí cuentan caídas, y las dos son
 * cuentas medidas de lo mismo visto desde cada lado.
 */
const MUERTES = `
  <g stroke="currentColor" fill="none">${MARCO}</g>
  <g fill="none" stroke="currentColor" stroke-linejoin="round">
    <!-- estela -->
    <path d="M58 156V96a42 42 0 0 1 84 0v60Z" fill="var(--t-melee)" fill-opacity=".11"
          stroke-opacity=".85" stroke-width="1.8"/>
    <path d="M68 156V98a32 32 0 0 1 64 0v58" stroke-opacity=".2"/>
    <!-- un signo tallado, no una cruz ni un epitafio: aquí no se escribe nada
         que el registro no diga -->
    <path d="M100 68 112 82 100 96 88 82Z" stroke-opacity=".6" stroke-width="1.6"/>
    <path d="M100 76 106 82 100 88 94 82Z" stroke-opacity=".3"/>
    <!-- la inscripción: rayada, no escrita -->
    <g stroke-opacity=".32">
      <path d="M76 110h48M76 122h48M76 134h32"/>
    </g>
    <!-- suelo -->
    <path d="M38 156h124" stroke-opacity=".55" stroke-width="1.7"/>
    <path d="M46 163h108" stroke-opacity=".16"/>
  </g>
  <g stroke="currentColor" stroke-opacity=".45" stroke-width="1.7" fill="none">
    <path d="M64 182v-14M72 182v-14M80 182v-14M88 182v-14M62 168l28 14"/>
    <path d="M106 182v-14M114 182v-14"/>
  </g>`;

/**
 * Lámina aún sin dibujar.
 *
 * Lleva el marco de las demás y el filete a trazos: se ve que el hueco está
 * reservado y que lo que falta es el dibujo, no la sección.
 */
const PENDIENTE = (glifo) => `
  <g stroke="currentColor" fill="none" stroke-opacity=".9">
    <rect x="8.5" y="8.5" width="183" height="183" stroke-opacity=".22" stroke-dasharray="5 4"/>
    <rect x="12.5" y="12.5" width="175" height="175" stroke-opacity=".1"/>
  </g>
  <g transform="translate(100 100)" stroke="currentColor" fill="none"
     stroke-opacity=".35" stroke-width="1.6" stroke-linejoin="round">${glifo}</g>`;

const LAMINAS = {
  zonas: ZONAS,
  enemigos: ENEMIGOS,
  botin: BOTIN,
  hechizos: HECHIZOS,
  progreso: PROGRESO,
  habilidades: HABILIDADES,
  muertes: MUERTES,
};

/**
 * @param {string} key  sección de la enciclopedia
 * @returns {string} un `<svg>` cuadrado, listo para meter en la tarjeta
 */
export function plate(key) {
  return `<svg viewBox="0 0 200 200" class="plate" aria-hidden="true">
    <rect width="200" height="200" fill="var(--slate-800)"/>${
      LAMINAS[key] ?? PENDIENTE('<circle r="24"/>')}</svg>`;
}

/** Las que ya están dibujadas. La tarjeta lo dice en vez de disimularlo. */
export const DIBUJADAS = Object.keys(LAMINAS);
