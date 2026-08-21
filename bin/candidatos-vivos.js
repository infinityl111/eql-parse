#!/usr/bin/env node
/**
 * ¿SALE LA LISTA DE CANDIDATOS, Y EL CRONO QUE ABRE VE SUS MUERTES?
 *
 * Las pruebas puras ya dicen que `candidatosDe` produce las claves correctas y
 * que el constructor pinta sus filas. Lo que ninguna puede decir es lo de
 * siempre:
 *
 *     PRODUCIR NO ES PINTAR, Y PINTAR NO ES QUE EL BOTÓN HAGA ALGO.
 *
 * Así que esto arranca la aplicación de verdad, abre Reapariciones, pulsa la
 * pestaña de alta, lee las filas, pulsa «Seguir» en una y comprueba **que el
 * temporizador que nace NO dice «esperando su primera muerte»** — que es como
 * se ve un crono cuya clave no casa con el índice, y es exactamente el fallo
 * que había: la mitad del histórico guarda la zona con el dígito de la
 * dificultad pegado y la clave del crono la lleva limpia.
 *
 * Un crono ciego y uno recién abierto de un bicho vivo se ven IGUAL en
 * pantalla. Por eso el histórico de esta sonda se siembra con la muerte dentro:
 * aquí «esperando su primera muerte» sólo puede significar que no la encuentra.
 *
 * Uso:  npm run candidatos  ·  node bin/candidatos-vivos.js
 */
import { arrancaListo, abreSeccion, espera } from './sonda.js';

/**
 * EL HISTÓRICO SE SIEMBRA CON LA FORMA ENFERMA, no con la sana.
 *
 * `zoneBase` con el dígito dentro —«The Ruins of Old Guk 2»— es como está en
 * disco en 1.026 de las 1.899 peleas con muerte del almacén real. Sembrar la
 * forma limpia haría una sonda que pasa por construcción.
 */
const ZONA = 'The Ruins of Old Guk';
const T = Date.now() - 3600e3;
/**
 * LA ETIQUETA TIENE QUE CASAR CON EL DÍGITO, y esto lo enseñó esta sonda.
 *
 * `parseZone` sólo saca el dígito del nombre cuando la etiqueta declara esa
 * misma dificultad: «Old Guk 3 (Adaptive)» —que es 2— se queda con el 3 dentro
 * a propósito, porque ahí el dígito no está diciendo la dificultad. Sembrando
 * la pareja mal, la sonda medía la zona equivocada y lo cantó en la primera
 * pasada.
 */
const TAG = { 1: 'Awakened', 2: 'Adaptive', 3: 'Fused', 4: 'Refined' };
const pelea = (at, diff, nombre, t) => ({
  zone: `${ZONA} ${diff} (${TAG[diff]})`, zoneBase: `${ZONA} ${diff}`, diff, diffTag: TAG[diff],
  duration: 120, total: 5000, start: Math.round(at / 1000),
  kills: [nombre], killTimes: [{ name: nombre, t }],
  rows: [{ name: 'Campeon', side: 'ally' }, { name: nombre, side: 'enemy' }],
});

const siembra = async (store) => {
  store.append(pelea(T, 2, 'Ancient Croaker', 30), T);
  store.append(pelea(T + 600e3, 2, 'Ancient Croaker', 45), T + 600e3);
  store.append(pelea(T + 900e3, 3, 'a shin ghoul knight', 20), T + 900e3);
};

const { lee, fin } = await arrancaListo({
  nombre: 'eql-candidatos-vivos',
  registro: [`[${new Date().toDateString()}] Logging to 'eqlog.txt' is now *ON*.`],
  siembra,
  config: { cronos: [] },
});

let mal = 0;
const ok = (c, m, extra = '') => {
  console.log(`  ${c ? 'ok  ' : 'MAL '} ${m}${extra !== '' ? ` — ${extra}` : ''}`);
  if (!c) mal++;
};

console.log('\nLA LISTA DE CANDIDATOS, en vivo\n');

if (!await abreSeccion(lee, 'cronos', '.pz-pest')) {
  console.error('  Reapariciones no llegó a pintar.');
  fin(1);
}

// La pestaña de alta. Pulsarla antes de que exista no falla: no hace nada.
await lee(`document.querySelector('.pz-pest button[data-ir="sug"]')?.click()`);

/**
 * LA PRIMERA RESPUESTA NO VALE COMO RESPUESTA. La lista se pide por el puente y
 * la sección se repinta cuatro veces por segundo: se espera a que haya filas,
 * no a que diga lo que quiero.
 */
let filas = [];
for (let i = 0; i < 40; i++) {
  filas = await lee(`(() => {
    const v = document.querySelector('[data-vista="sug"]');
    if (!v || v.hidden) return [];
    return [...v.querySelectorAll('.pz-fila')].map((f) => ({
      id: f.dataset.id,
      nombre: f.querySelector('b')?.textContent ?? '',
      cuenta: f.querySelector('.cro-candn')?.textContent?.trim() ?? '',
      ultima: f.querySelector('.cro-candu')?.textContent?.trim() ?? '',
      puede: !!f.querySelector('[data-alta]'),
    }));
  })()`) ?? [];
  if (filas.length) break;
  await espera(500);
}

for (const f of filas) {
  console.log(`     ${f.nombre.padEnd(22)} ${f.cuenta.padEnd(24)} ${f.ultima}`);
}
console.log('');

ok(filas.length === 2, 'la lista trae los dos candidatos del histórico sembrado',
  `${filas.length} filas`);
ok(filas.every((f) => f.id?.includes(`|${ZONA}|`)),
  'y la clave de TODAS lleva la base LIMPIA, sin el dígito de la dificultad',
  filas.map((f) => f.id).join(' · '));
ok(filas.some((f) => /2/.test(f.cuenta)), 'con su recuento de muertes',
  filas.map((f) => f.cuenta).join(' · '));

// Se abre el primero, que es el de las dos muertes.
const i = filas.findIndex((f) => f.nombre === 'Ancient Croaker');
ok(i >= 0 && filas[i].puede, 'el que no tiene temporizador enseña su botón');
await lee(`document.querySelectorAll('[data-vista="sug"] [data-alta]')[${i}]?.click()`);

/**
 * Y AHORA LO QUE IMPORTA: el crono que ha nacido, ¿ve su muerte?
 *
 * Se lee la pestaña de vigilancia. «Esperando su primera muerte» aquí no es un
 * estado legítimo: la muerte está sembrada en el histórico.
 */
let ficha = null;
for (let j = 0; j < 40; j++) {
  await lee(`document.querySelector('.pz-pest button[data-ir="vig"]')?.click()`);
  ficha = await lee(`(() => {
    const v = document.querySelector('[data-vista="vig"]');
    const f = v?.querySelector('.pz-fila');
    if (!f) return null;
    return { texto: f.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160) };
  })()`);
  if (ficha) break;
  await espera(500);
}

console.log(`     ficha: ${ficha?.texto ?? '(ninguna)'}\n`);
ok(!!ficha, 'pulsar «Seguir» abre el temporizador');
ok(ficha && !/Esperando su primera muerte/i.test(ficha.texto),
  'y el temporizador VE su muerte',
  ficha && /Esperando su primera muerte/i.test(ficha.texto)
    ? 'NACE CIEGO: la clave del candidato no casa con la del índice'
    : 'la clave del candidato es la misma que consulta el motor');
ok(ficha && /observaci/i.test(ficha.texto), 'y trae su recuento de observaciones',
  'con dos muertes en peleas distintas tiene que haber una');

// EL DENOMINADOR, siempre: «falla una» y «sólo miré una» se leen igual.
console.log(`\n${mal} de 7 comprobaciones fallan\n`);
fin(mal ? 1 : 0);
