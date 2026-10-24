/** Sólidos detallados para piezas con espacio utilizable bajo o entre sus partes. */
export function needsFurnitureProxy({ profile, id }) {
  return ['table', 'chair', 'bench'].includes(profile) || /sombrilla|hamaca/.test(id);
}

/** Las lonas grandes no necesitan una rejilla de 2 cm; 4 cm conserva sus soportes y reduce el coste del arrastre. */
export const furnitureProxyCellMm = id => /sombrilla|hamaca/.test(id) ? 40 : 20;
