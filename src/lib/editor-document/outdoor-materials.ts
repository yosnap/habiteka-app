const materials = [
  ['grass-natural', 'Césped natural'], ['grass-artificial', 'Césped artificial'], ['soil', 'Tierra'],
  ['gravel', 'Gravilla'], ['pine-bark', 'Corteza de pino'], ['sand', 'Arena'],
  ['asphalt', 'Asfalto / parking'], ['paving', 'Pavimento exterior'],
];
export const OUTDOOR_MATERIALS = materials.map(([id, label]) => ({
  id: `outdoor:${id}`, label: label!, category: 'Exterior', source: '/materials/outdoor/license.txt',
  license: 'Habiteka original', authors: ['Habiteka'], sizeMm: [1000, 1000],
  preview: `/materials/outdoor/${id}.png`, maps: { color: `/materials/outdoor/${id}.png`,
    normal: '/materials/outdoor/normal.png', roughness: '/materials/outdoor/roughness.png' },
}));
