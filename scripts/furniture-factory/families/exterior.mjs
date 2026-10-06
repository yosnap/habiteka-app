/** Exterior: sofás, sillones, chill-out, sillas, tumbonas y mesas de jardín y terraza (mm). */
const cushions = (tapiceria) => ({ tapiceria, patas: 'aluminio-antracita' });

export const FAMILY = { id: 'exterior', label: 'Muebles de jardín y terraza', room: 'exterior', dependsOn: ['comedor'] };

export const PRODUCTS = [
  {
    product: 'sofa_ratan', type: 'sofa_rattan', label: 'Sofá de ratán sintético con cojines', profile: 'sofa', style: 'Mediterráneo',
    mainSlot: 'trenzado', finishes: { trenzado: 'ratan-oscuro', ...cushions('tejido-exterior-crudo') },
    variants: [
      { key: '3p', size: '3 plazas · 200 cm', dims: [2000, 850, 780], params: { seats: 3 }, proposal: true },
      { key: '2p', size: '2 plazas · 150 cm', dims: [1500, 850, 780], params: { seats: 2 } },
      { key: '3p_gris', size: '3 plazas · 200 cm', dims: [2000, 850, 780], params: { seats: 3 }, finishes: { trenzado: 'ratan-gris', tapiceria: 'tejido-exterior-gris' } },
    ],
  },
  {
    product: 'sillon_ratan', type: 'sofa_rattan', label: 'Sillón de ratán sintético', profile: 'sofa', style: 'Mediterráneo',
    mainSlot: 'trenzado', params: { seats: 1 }, finishes: { trenzado: 'ratan-oscuro', ...cushions('tejido-exterior-crudo') }, textureSize: 512,
    variants: [
      { key: 'moca', size: '85 cm', dims: [850, 850, 780], proposal: true },
      { key: 'gris', size: '85 cm', dims: [850, 850, 780], finishes: { trenzado: 'ratan-gris', tapiceria: 'tejido-exterior-gris' } },
    ],
  },
  {
    product: 'sofa_teca', type: 'sofa_teak', label: 'Sofá de teca con cojines', profile: 'sofa', style: 'Mediterráneo',
    mainSlot: 'madera', finishes: { madera: 'teca', tapiceria: 'tejido-exterior-crudo' },
    variants: [
      { key: '3p', size: '3 plazas · 190 cm', dims: [1900, 800, 800], params: { seats: 3 }, proposal: true },
      { key: '2p', size: '2 plazas · 140 cm', dims: [1400, 800, 800], params: { seats: 2 }, finishes: { tapiceria: 'tejido-exterior-gris' } },
    ],
  },
  {
    product: 'sofa_aluminio', type: 'sofa_aluminium', label: 'Sofá de aluminio con cojines', profile: 'sofa', style: 'Contemporáneo',
    mainSlot: 'estructura', finishes: { estructura: 'aluminio-antracita', tapiceria: 'tejido-exterior-gris' },
    variants: [
      { key: 'antracita', size: '3 plazas · 200 cm', dims: [2000, 820, 740], params: { seats: 3 }, proposal: true },
      { key: 'blanco', size: '3 plazas · 200 cm', dims: [2000, 820, 740], params: { seats: 3 }, finishes: { estructura: 'aluminio-blanco', tapiceria: 'tejido-exterior-crudo' } },
    ],
  },
  {
    product: 'conjunto_chillout', type: 'chillout', label: 'Conjunto chill-out de ratán', profile: 'sofa-corner', style: 'Mediterráneo',
    mainSlot: 'trenzado', finishes: { trenzado: 'ratan-natural', madera: 'teca', ...cushions('tejido-exterior-crudo') },
    variants: [
      { key: 'natural', size: 'Rinconera y mesa · 240 × 200 cm', dims: [2400, 2000, 650], proposal: true },
      { key: 'gris', size: 'Rinconera y mesa · 240 × 200 cm', dims: [2400, 2000, 650], finishes: { trenzado: 'ratan-gris', tapiceria: 'tejido-exterior-gris' } },
    ],
  },
  {
    product: 'silla_apilable', type: 'chair_stack', label: 'Silla apilable de exterior', profile: 'chair', style: 'Contemporáneo',
    mainSlot: 'carcasa', finishes: { carcasa: 'polipropileno-blanco' }, textureSize: 512,
    variants: [
      { key: 'blanca', size: '54 cm', dims: [540, 530, 800], proposal: true },
      { key: 'antracita', size: '54 cm', dims: [540, 530, 800], finishes: { carcasa: 'polipropileno-antracita' } },
      { key: 'salvia', size: '54 cm', dims: [540, 530, 800], finishes: { carcasa: 'polipropileno-salvia' } },
    ],
  },
  {
    product: 'silla_ratan', type: 'chair_rattan', label: 'Silla de ratán tipo bistró', profile: 'chair', style: 'Mediterráneo',
    mainSlot: 'trenzado', finishes: { trenzado: 'ratan-natural', estructura: 'metal-negro' }, textureSize: 512,
    variants: [
      { key: 'natural', size: '56 cm', dims: [560, 580, 860], proposal: true },
      { key: 'moca', size: '56 cm', dims: [560, 580, 860], finishes: { trenzado: 'ratan-oscuro', estructura: 'aluminio-antracita' } },
    ],
  },
  {
    product: 'silla_metalica_exterior', type: 'chair_metal', label: 'Silla metálica de exterior', profile: 'chair', style: 'Industrial',
    mainSlot: 'estructura', finishes: { estructura: 'lacado-verde' }, textureSize: 512,
    variants: [
      { key: 'verde', size: '44 cm', dims: [440, 500, 850], proposal: true },
      { key: 'blanca', size: '44 cm', dims: [440, 500, 850], finishes: { estructura: 'aluminio-blanco' } },
    ],
  },
  {
    product: 'silla_cuerda', type: 'chair_rope', label: 'Sillón de cuerda trenzada', profile: 'chair', style: 'Mediterráneo',
    mainSlot: 'cuerda', finishes: { estructura: 'teca', cuerda: 'cuerda-beige' }, textureSize: 512,
    variants: [
      { key: 'teca', size: '60 cm', dims: [600, 620, 780], proposal: true },
      { key: 'aluminio', size: '60 cm', dims: [600, 620, 780], finishes: { estructura: 'aluminio-antracita', cuerda: 'cuerda-gris' } },
    ],
  },
  {
    product: 'tumbona', type: 'lounger', label: 'Tumbona o chaise longue de exterior', profile: 'sofa-chaise', style: 'Mediterráneo',
    mainSlot: 'madera', finishes: { madera: 'teca', tapiceria: 'tejido-exterior-crudo', patas: 'metal-negro' },
    variants: [
      { key: 'teca', size: '70 × 195 cm', dims: [700, 1950, 860], proposal: true },
      { key: 'aluminio', size: '70 × 195 cm', dims: [700, 1950, 860], params: { frame: 'estructura' },
        finishes: { madera: undefined, estructura: 'aluminio-blanco', tapiceria: 'tejido-exterior-gris' } },
    ],
  },
  {
    product: 'mesa_teca_exterior', type: 'slat_table', label: 'Mesa de teca de exterior', profile: 'table', style: 'Mediterráneo',
    mainSlot: 'sobre', finishes: { sobre: 'teca', madera: 'teca' },
    variants: [
      { key: '180', size: '180 × 90 cm', dims: [1800, 900, 750], proposal: true },
      { key: '220', size: '220 × 100 cm', dims: [2200, 1000, 750] },
    ],
  },
  {
    product: 'mesa_aluminio_exterior', type: 'slat_table', label: 'Mesa de aluminio de exterior', profile: 'table', style: 'Contemporáneo',
    mainSlot: 'sobre', params: { frame: 'estructura' }, finishes: { sobre: 'aluminio-antracita', estructura: 'aluminio-antracita' },
    variants: [
      { key: 'antracita', size: '160 × 90 cm', dims: [1600, 900, 740], proposal: true },
      { key: 'blanca', size: '160 × 90 cm', dims: [1600, 900, 740], finishes: { sobre: 'aluminio-blanco', estructura: 'aluminio-blanco' } },
    ],
  },
  {
    product: 'mesa_centro_exterior', label: 'Mesa de centro de exterior', profile: 'table', style: 'Mediterráneo', mainSlot: 'sobre',
    variants: [
      { key: 'teca', type: 'slat_table', size: 'Teca · 100 × 60 cm', dims: [1000, 600, 350], finishes: { sobre: 'teca', madera: 'teca' }, proposal: true },
      { key: 'ratan', type: 'coffee_rattan', size: 'Ratán y cristal · 90 × 90 cm', dims: [900, 900, 330], finishes: { sobre: 'cristal', trenzado: 'ratan-natural' } },
    ],
  },
];
