/** Literas, comedores completos y asientos bajos; reutiliza constructores de comedor y exterior. */
export const FAMILY = { id: 'descanso', label: 'Literas, comedores y descanso', room: 'dormitorio', dependsOn: ['comedor', 'exterior'] };

const bedding = { sabanas: 'algodon-blanco', edredon: 'lino-salvia' };
const cushions = { tapiceria: 'tejido-exterior-crudo', patas: 'aluminio-antracita' };

export const PRODUCTS = [
  {
    product: 'litera_madera', type: 'bunk', label: 'Litera de madera con escalera', profile: 'bed', style: 'Nórdico',
    finishes: { madera: 'roble', ...bedding },
    variants: [
      { key: '90', size: 'Dos camas de 90 × 190 cm', dims: [1100, 2020, 1800], proposal: true },
      { key: 'blanca', size: 'Dos camas de 90 × 190 cm', dims: [1100, 2020, 1800], finishes: { madera: 'lacado-blanco' } },
    ],
  },
  {
    product: 'litera_metal', type: 'bunk', label: 'Litera metálica con escalera', profile: 'bed', style: 'Industrial',
    finishes: { madera: 'metal-negro', ...bedding },
    variants: [{ key: '90', size: 'Dos camas de 90 × 190 cm', dims: [1100, 2020, 1800], proposal: true }],
  },
  {
    product: 'litera_familiar', type: 'bunk', label: 'Litera con cama doble inferior', profile: 'bed', style: 'Mediterráneo',
    params: { lowerWidth: 1350 }, finishes: { madera: 'roble', ...bedding },
    variants: [{ key: '135_90', size: 'Inferior 135 y superior 90 × 190 cm', dims: [1550, 2020, 1850], proposal: true }],
  },
  {
    product: 'set_comedor_rectangular', type: 'dining_set', label: 'Set de comedor de roble con sillas', profile: 'table',
    room: 'comedor', style: 'Nórdico', finishes: { sobre: 'roble', estructura: 'roble', madera: 'roble' },
    variants: [
      { key: '4', size: 'Mesa de 120 × 80 cm y 4 sillas', dims: [1200, 1800, 850], params: { seats: 4, table: [1200, 800] }, proposal: true },
      { key: '6', size: 'Mesa de 180 × 90 cm y 6 sillas', dims: [1800, 1900, 850], params: { seats: 6, table: [1800, 900] } },
    ],
  },
  {
    product: 'set_comedor_redondo', type: 'dining_set', label: 'Set de comedor redondo con sillas', profile: 'table',
    room: 'comedor', style: 'Contemporáneo', params: { round: true, seats: 4, table: [1100, 1100] },
    finishes: { sobre: 'marmol-blanco', estructura: 'aluminio-blanco', madera: 'roble' },
    variants: [{ key: '4', size: 'Mesa de Ø 110 cm y 4 sillas', dims: [2100, 2100, 850], proposal: true }],
  },
  {
    product: 'sofa_chillout_bajo', type: 'low_seat', label: 'Sofá bajo chill out de ratán', profile: 'sofa',
    room: 'exterior', style: 'Mediterráneo', mainSlot: 'trenzado', finishes: { trenzado: 'ratan-natural', ...cushions },
    variants: [
      { key: '2p', size: '2 plazas · 160 cm', dims: [1600, 900, 650], params: { seats: 2 }, proposal: true },
      { key: '3p', size: '3 plazas · 220 cm', dims: [2200, 900, 650], params: { seats: 3 } },
    ],
  },
  {
    product: 'sillon_chillout_bajo', type: 'low_seat', label: 'Sillón bajo chill out de ratán', profile: 'chair',
    room: 'exterior', style: 'Mediterráneo', mainSlot: 'trenzado', params: { seats: 1 },
    finishes: { trenzado: 'ratan-natural', ...cushions },
    variants: [
      { key: 'natural', size: '85 cm · cojín crudo', dims: [850, 900, 650], proposal: true },
      { key: 'gris', size: '85 cm · cojín gris', dims: [850, 900, 650], finishes: { trenzado: 'ratan-gris', tapiceria: 'tejido-exterior-gris' } },
    ],
  },
];
