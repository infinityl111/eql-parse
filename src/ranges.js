/**
 * Tramos de tiempo del filtro del histórico.
 *
 * Vive aparte de store.js a propósito: store.js usa node:fs y sólo puede
 * cargarse en el proceso principal. La ventana necesita esta lista, y si la
 * importara de allí arrastraría node:fs, que en el renderizador no existe —
 * el módulo entero falla y la interfaz se queda en blanco.
 */
export const RANGES = [
  { key: '2h', ms: 2 * 3600e3 },
  { key: '12h', ms: 12 * 3600e3 },
  { key: '24h', ms: 24 * 3600e3 },
  { key: '3d', ms: 3 * 24 * 3600e3 },
  { key: '7d', ms: 7 * 24 * 3600e3 },
  { key: '30d', ms: 30 * 24 * 3600e3 },
  { key: 'all', ms: null },
];
