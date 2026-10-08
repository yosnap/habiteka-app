/**
 * Taburetes de cocina y barra. Alturas de asiento de mercado: 65 cm (encimera de cocina, 90 cm) y 75 cm (barra, 105 cm);
 * los bajos de cocina, 45 cm. `seat_h` es la altura del asiento en mm; los que llevan respaldo suman su alto en dims.
 */
export const FAMILY = { id: 'taburetes', label: 'Taburetes de barra y de cocina', room: 'cocina' };

const bar = (key, seat, extra = {}) => ({ key, size: `Asiento a ${seat / 10} cm`, params: { seat_h: seat }, ...extra });

export const PRODUCTS = [
  {
    product: 'taburete_madera', type: 'stool_wood', label: 'Taburete de barra de madera', style: 'Nórdico',
    finishes: { madera: 'roble' },
    variants: [
      { ...bar('65', 650), dims: [380, 380, 650] },
      { ...bar('75', 750), dims: [400, 400, 750], proposal: true },
      { ...bar('75_nogal', 750), dims: [400, 400, 750], finishes: { madera: 'nogal' } },
    ],
  },
  {
    product: 'taburete_metal', type: 'stool_metal', label: 'Taburete de barra metálico', style: 'Industrial',
    finishes: { estructura: 'metal-negro' },
    variants: [
      { ...bar('65', 650), dims: [380, 380, 650] },
      { ...bar('75', 750), dims: [400, 400, 750], proposal: true },
      { ...bar('75_blanco', 750), dims: [400, 400, 750], finishes: { estructura: 'aluminio-blanco' } },
    ],
  },
  {
    product: 'taburete_tapizado', type: 'stool_upholstered', label: 'Taburete de barra tapizado con respaldo', style: 'Contemporáneo',
    params: { back: true }, finishes: { tapiceria: 'boucle-crudo', estructura: 'metal-negro' },
    variants: [
      { ...bar('65', 650), dims: [440, 450, 920] },
      { ...bar('75', 750), dims: [440, 450, 1020], proposal: true },
      { ...bar('75_verde', 750), dims: [440, 450, 1020], finishes: { tapiceria: 'terciopelo-verde', estructura: 'laton' } },
    ],
  },
  {
    product: 'taburete_tapizado_sin_respaldo', type: 'stool_upholstered', label: 'Taburete de barra tapizado sin respaldo', style: 'Contemporáneo',
    finishes: { tapiceria: 'piel-conac', estructura: 'metal-negro' },
    variants: [
      { ...bar('65', 650), dims: [400, 400, 650] },
      { ...bar('75', 750), dims: [400, 400, 750], proposal: true },
    ],
  },
  {
    product: 'taburete_giratorio_respaldo', type: 'stool_swivel', label: 'Taburete giratorio con respaldo', style: 'Contemporáneo',
    params: { back: true }, finishes: { tapiceria: 'piel-negra', base: 'cromo' },
    variants: [
      { ...bar('65', 650), dims: [420, 420, 920] },
      { ...bar('75', 750), dims: [420, 420, 1020], proposal: true },
      { ...bar('75_gris', 750), dims: [420, 420, 1020], finishes: { tapiceria: 'tejido-antracita', base: 'metal-negro' } },
    ],
  },
  {
    product: 'taburete_giratorio', type: 'stool_swivel', label: 'Taburete giratorio sin respaldo', style: 'Contemporáneo',
    finishes: { tapiceria: 'piel-conac', base: 'cromo' },
    variants: [
      { ...bar('65', 650), dims: [420, 420, 650] },
      { ...bar('75', 750), dims: [420, 420, 750], proposal: true },
    ],
  },
  {
    product: 'taburete_bajo', label: 'Taburete bajo de cocina', style: 'Nórdico',
    variants: [
      { key: 'madera', type: 'stool_wood', size: 'Asiento a 45 cm', dims: [340, 340, 450], params: { seat_h: 450 }, finishes: { madera: 'roble' }, proposal: true },
      { key: 'metal', type: 'stool_metal', size: 'Asiento a 45 cm', dims: [340, 340, 450], params: { seat_h: 450 }, finishes: { estructura: 'metal-negro' } },
    ],
  },
].map((product) => ({ profile: 'chair', textureSize: 512, ...product }));
