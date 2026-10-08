/**
 * Camas con cabecero y ropa de cama. Colchones de mercado (mm): individuales 90 × 190 y 105 × 190; dobles 135 × 190,
 * 150 × 190, 160 × 200 y 180 × 200. Las medidas exteriores salen del colchón más el marco y el cabecero de cada modelo.
 */
const ALL = [90, 105, 135, 150, 160, 180];
const MATTRESSES = { 90: [900, 1900], 105: [1050, 1900], 135: [1350, 1900], 150: [1500, 1900], 160: [1600, 2000], 180: [1800, 2000] };

/** Variantes por ancho de colchón: margen lateral y de fondo del modelo, alto del cabecero y la medida propuesta. */
function sizes(widths, { side, extraDepth, height, proposal }) {
  return widths.map((width) => {
    const [mw, ml] = MATTRESSES[width];
    return {
      key: String(width), size: `${width < 135 ? 'Individual' : 'Doble'} · colchón ${mw / 10} × ${ml / 10} cm`,
      dims: [mw + 2 * side, ml + extraDepth, height], params: { mattress: [mw, ml] }, proposal: width === proposal,
    };
  });
}

const bedding = (edredon, cojines, plaid) => ({ sabanas: 'algodon-blanco', edredon, cojines, plaid });

export const FAMILY = { id: 'camas', label: 'Camas con cabecero y ropa de cama', room: 'dormitorio' };

export const PRODUCTS = [
  {
    product: 'cama_tapizada', label: 'Cama con cabecero tapizado', style: 'Contemporáneo',
    params: { headboard: 'tapizado', base: 'tapizada', leg: 'conica' },
    finishes: { tapiceria: 'lino-gris', patas: 'roble', ...bedding('lino-blanco', 'lino-salvia', 'punto-mostaza') },
    variants: sizes(ALL, { side: 45, extraDepth: 120, height: 1200, proposal: 150 }),
  },
  {
    product: 'cama_capitone', label: 'Cama con cabecero capitoné', style: 'Clásico',
    params: { headboard: 'capitone', base: 'tapizada', leg: 'taco' },
    finishes: { tapiceria: 'tejido-beige', patas: 'nogal', ...bedding('algodon-gris', 'terciopelo-mostaza', 'punto-gris') },
    variants: sizes(ALL, { side: 45, extraDepth: 130, height: 1300, proposal: 160 }),
  },
  {
    product: 'cama_madera', label: 'Cama de madera maciza', style: 'Nórdico',
    params: { headboard: 'madera', base: 'madera' },
    finishes: { madera: 'roble', ...bedding('lino-arena', 'algodon-blanco', 'punto-terracota') },
    variants: sizes(ALL, { side: 65, extraDepth: 110, height: 1050, proposal: 135 }),
  },
  {
    product: 'cama_listones', label: 'Cama con cabecero de listones', style: 'Nórdico',
    params: { headboard: 'listones', base: 'madera' },
    finishes: { madera: 'nogal', ...bedding('algodon-blanco', 'lino-salvia', 'punto-salvia') },
    variants: sizes(ALL, { side: 65, extraDepth: 110, height: 1100, proposal: 150 }),
  },
  {
    product: 'cama_forja', label: 'Cama de forja', style: 'Rústico', mainSlot: 'metal',
    params: { headboard: 'forja', base: 'metal' },
    finishes: { metal: 'forja-negra', ...bedding('lino-blanco', 'lino-arena', 'punto-gris') },
    variants: sizes(ALL, { side: 30, extraDepth: 90, height: 1250, proposal: 135 }),
  },
  {
    product: 'canape', label: 'Canapé abatible con cabecero tapizado', style: 'Contemporáneo',
    params: { headboard: 'tapizado', base: 'canape' },
    finishes: { tapiceria: 'tejido-antracita', patas: 'metal-negro', ...bedding('algodon-blanco', 'tejido-antracita', 'punto-terracota') },
    variants: sizes(ALL, { side: 30, extraDepth: 110, height: 1200, proposal: 150 }),
  },
].map((product) => ({ type: 'bed', profile: 'bed', ...product }));
