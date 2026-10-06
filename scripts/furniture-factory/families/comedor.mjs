/** Comedor: mesas (rectangulares, redondas y extensibles), sillas y bancos con medidas de mercado en mm. */
export const FAMILY = { id: 'comedor', label: 'Mesas, sillas y bancos de comedor', room: 'comedor' };

export const PRODUCTS = [
  {
    product: 'mesa_comedor_roble', type: 'table', label: 'Mesa de comedor de roble', profile: 'table', style: 'Nórdico',
    params: { base: 'conicas' }, finishes: { sobre: 'roble', estructura: 'roble' },
    variants: [
      { key: '160', size: '160 × 90 cm', dims: [1600, 900, 750], proposal: true },
      { key: '200', size: '200 × 100 cm', dims: [2000, 1000, 750] },
    ],
  },
  {
    product: 'mesa_comedor_nogal', type: 'table', label: 'Mesa de comedor de nogal con caballetes', profile: 'table', style: 'Clásico',
    params: { base: 'caballete', top_th: 40 }, finishes: { sobre: 'nogal', estructura: 'nogal' },
    variants: [{ key: '180', size: '180 × 90 cm', dims: [1800, 900, 760], proposal: true }],
  },
  {
    product: 'mesa_comedor_marmol', type: 'table', label: 'Mesa de comedor de mármol', profile: 'table', style: 'Contemporáneo',
    params: { base: 'trineo', top_th: 20 }, finishes: { sobre: 'marmol-blanco', estructura: 'metal-negro' },
    variants: [
      { key: 'blanco', size: '180 × 90 cm', dims: [1800, 900, 750], proposal: true },
      { key: 'negro', size: '180 × 90 cm', dims: [1800, 900, 750], finishes: { sobre: 'marmol-negro', estructura: 'laton' } },
    ],
  },
  {
    product: 'mesa_comedor_cristal', type: 'table', label: 'Mesa de comedor de cristal', profile: 'table', style: 'Contemporáneo',
    params: { base: 'acero', top_th: 12 }, finishes: { sobre: 'cristal', estructura: 'cromo' },
    variants: [{ key: '160', size: '160 × 90 cm', dims: [1600, 900, 750], proposal: true }],
  },
  {
    product: 'mesa_extensible', type: 'table', label: 'Mesa extensible de roble', profile: 'table', style: 'Nórdico',
    params: { base: 'patas' }, finishes: { sobre: 'roble', estructura: 'roble' },
    variants: [
      { key: 'cerrada', size: 'Cerrada · 140 × 90 cm', dims: [1400, 900, 750], params: { seams: [0] }, proposal: true },
      { key: 'abierta', size: 'Abierta · 190 × 90 cm', dims: [1900, 900, 750], params: { seams: [-250, 250] } },
    ],
  },
  {
    product: 'mesa_redonda_marmol', type: 'round_table', label: 'Mesa redonda de mármol con pie de tulipa', profile: 'table', style: 'Contemporáneo',
    params: { base: 'tulipa', top_th: 20 }, finishes: { sobre: 'marmol-blanco', estructura: 'lacado-blanco' },
    variants: [
      { key: '120', size: 'Ø 120 cm', dims: [1200, 1200, 740], proposal: true },
      { key: '90', size: 'Ø 90 cm', dims: [900, 900, 740] },
    ],
  },
  {
    product: 'mesa_redonda_madera', type: 'round_table', label: 'Mesa redonda de madera', profile: 'table', style: 'Nórdico',
    finishes: { sobre: 'roble', estructura: 'roble' },
    variants: [
      { key: 'patas', size: 'Ø 100 cm · cuatro patas', dims: [1000, 1000, 750], params: { base: 'patas' }, proposal: true },
      { key: 'pie_nogal', size: 'Ø 110 cm · pie central', dims: [1100, 1100, 750], params: { base: 'columna' }, finishes: { sobre: 'nogal', estructura: 'nogal' } },
    ],
  },
  {
    product: 'silla_nordica', type: 'chair', label: 'Silla nórdica de madera', profile: 'chair', style: 'Nórdico',
    params: { style: 'nordica' }, finishes: { madera: 'roble' }, textureSize: 512,
    variants: [
      { key: 'roble', size: '45 cm', dims: [450, 520, 800], proposal: true },
      { key: 'negra', size: '45 cm', dims: [450, 520, 800], finishes: { madera: 'roble-negro' } },
    ],
  },
  {
    product: 'silla_tapizada', type: 'chair', label: 'Silla de comedor tapizada', profile: 'chair', style: 'Contemporáneo',
    params: { style: 'tapizada' }, finishes: { tapiceria: 'lino-gris', patas: 'roble' }, textureSize: 512,
    variants: [
      { key: 'gris', size: '48 cm', dims: [480, 560, 860], proposal: true },
      { key: 'verde', size: '48 cm', dims: [480, 560, 860], finishes: { tapiceria: 'terciopelo-verde', patas: 'nogal' } },
    ],
  },
  {
    product: 'silla_metalica', type: 'chair', label: 'Silla metálica tipo bistró', profile: 'chair', style: 'Industrial',
    params: { style: 'metalica' }, finishes: { estructura: 'metal-negro' }, textureSize: 512,
    variants: [{ key: 'negra', size: '44 cm', dims: [440, 500, 850], proposal: true }],
  },
  {
    product: 'silla_windsor', type: 'chair', label: 'Silla Windsor', profile: 'chair', style: 'Rústico',
    params: { style: 'windsor' }, finishes: { madera: 'fresno' }, textureSize: 512,
    variants: [
      { key: 'fresno', size: '52 cm', dims: [520, 520, 920], proposal: true },
      { key: 'nogal', size: '52 cm', dims: [520, 520, 920], finishes: { madera: 'nogal' } },
    ],
  },
  {
    product: 'silla_cocina', type: 'chair', label: 'Silla de cocina con asiento de enea', profile: 'chair', style: 'Mediterráneo',
    room: 'cocina', params: { style: 'cocina' }, mainSlot: 'estructura', finishes: { estructura: 'lacado-blanco', asiento: 'cuerda-beige' }, textureSize: 512,
    variants: [
      { key: 'blanca', size: '42 cm', dims: [420, 480, 860], proposal: true },
      { key: 'verde', size: '42 cm', dims: [420, 480, 860], finishes: { estructura: 'lacado-verde' } },
    ],
  },
  {
    product: 'banco_madera', type: 'bench', label: 'Banco de comedor de madera', profile: 'bench', style: 'Nórdico',
    params: { style: 'madera' }, finishes: { madera: 'roble' },
    variants: [
      { key: '140', size: '140 cm', dims: [1400, 350, 450], proposal: true },
      { key: '180', size: '180 cm', dims: [1800, 350, 450] },
    ],
  },
  {
    product: 'banco_tapizado', type: 'bench', label: 'Banco tapizado', profile: 'bench', style: 'Contemporáneo',
    params: { style: 'tapizado' }, finishes: { tapiceria: 'boucle-arena', estructura: 'metal-negro' },
    variants: [{ key: '120', size: '120 cm', dims: [1200, 400, 460], proposal: true }],
  },
];
