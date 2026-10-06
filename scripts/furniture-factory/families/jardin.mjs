/**
 * Jardín: árboles (plátano de sombra, olivo y naranjo), arbusto, seto recortado, formio, maceta de terracota,
 * jardineras con plantas, bancal de huerto, roca, piedras y setas de cerámica. Visten las piezas de Construir › Exterior
 * y jardín y del catálogo (src/lib/editor-document/garden-models.ts); no se ofrecen sueltas como muebles (`hidden`).
 *
 * Follaje: un árbol de 4 m no cabe con hojas sueltas en 40 000 triángulos. Cada tarjeta es un ramillete (ramita con
 * hojas recortadas de un atlas CC0 de ambientCG) pintado en el atlas propio de la pieza, con recorte alfa (MASK); el
 * seto y las bolas de boj llevan además un volumen opaco con una textura continua pintada con las mismas ramitas.
 * Las medidas de `dims` son las del modelo construido y coinciden con las de su pieza del catálogo.
 */
export const FAMILY = {
  id: 'jardin', label: 'Jardín', room: 'exterior',
  dependsOn: ['jardin_follaje', 'jardin_arboles', 'jardin_macetas', 'jardin_piedras', 'jardin_especies', 'jardin_aromaticas', 'plantas_img', 'plantas_geo', 'plantas_hojas'],
};

export const TEXTURES = {
  jar_hoja_platano: { source: 'ambientcg', id: 'LeafSet010', alpha: true, px: 1024, tileMm: 300 },
  jar_hoja_olivo: { source: 'ambientcg', id: 'LeafSet018', alpha: true, px: 1024, tileMm: 200 },
  jar_hoja_naranjo: { source: 'ambientcg', id: 'LeafSet022', alpha: true, px: 1024, tileMm: 250 },
  jar_hoja_arbusto: { source: 'ambientcg', id: 'LeafSet003', alpha: true, px: 1024, tileMm: 250 },
  jar_hoja_boj: { source: 'ambientcg', id: 'LeafSet002', alpha: true, px: 1024, tileMm: 250 },
  jar_hoja_lechuga: { source: 'ambientcg', id: 'LeafSet009', alpha: true, px: 1024, tileMm: 300 },
  jar_hoja_formio: { source: 'polyhaven', id: 'anthurium_botany_01', alpha: true, px: 1024, tileMm: 300 },
  jar_corteza_platano: { source: 'polyhaven', id: 'bark_platanus', tileMm: 1500, scaleMm: 900, px: 1024 },
  jar_corteza_olivo: { source: 'polyhaven', id: 'bark_brown_02', tileMm: 1000, scaleMm: 700, px: 1024 },
  jar_corteza_fina: { source: 'polyhaven', id: 'bark_willow_02', tileMm: 2150, scaleMm: 450, px: 512 },
  jar_pino: { source: 'polyhaven', id: 'coated_pine', tileMm: 740, px: 1024, grainU: true, normal: .6 },
  jar_terracota: { source: 'ambientcg', id: 'Clay002', tileMm: 400, px: 512 },
  jar_tierra: { source: 'polyhaven', id: 'brown_mud', tileMm: 1300, scaleMm: 350, px: 512, tint: true },
  jar_roca: { source: 'ambientcg', id: 'Rock030', tileMm: 1500, scaleMm: 900, px: 1024 },
  jar_piedra_clara: { source: 'polyhaven', id: 'worn_rock_natural_01', tileMm: 2000, scaleMm: 600, px: 1024 },
};

const leaves = (texture, swatch, name) => ({ texture, swatch, name, material: 'Hojas naturales' });
const bark = (texture, swatch, name) => ({ texture, swatch, name, material: 'Madera' });
const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'jar-lavanda': flat('paint', '#745198', .65, 'Flor de lavanda', 'Flor'),
  'jar-espiga': flat('paint', '#c6b58a', .85, 'Espiga seca', 'Flor'),
  'jar-conifera': flat('paint', '#294b25', .8, 'Verde conífera', 'Follaje'),
  'jar-palmera': flat('paint', '#43652a', .58, 'Hoja de palmera', 'Follaje'),
  'jar-hojas-platano': leaves('jar_hoja_platano', '#4f6f2c', 'Hojas de plátano'),
  'jar-hojas-olivo': leaves('jar_hoja_olivo', '#7d8a6a', 'Hojas de olivo'),
  'jar-hojas-naranjo': leaves('jar_hoja_naranjo', '#2f4f22', 'Hojas de naranjo'),
  'jar-hojas-arbusto': leaves('jar_hoja_arbusto', '#455f2c', 'Hojas perennes'),
  'jar-hojas-boj': leaves('jar_hoja_boj', '#3f5a26', 'Boj'),
  'jar-hojas-lechuga': leaves('jar_hoja_lechuga', '#7aa045', 'Lechugas'),
  'jar-hojas-formio': leaves('jar_hoja_formio', '#4a5a2c', 'Formio'),
  'jar-corteza-platano': bark('jar_corteza_platano', '#7d7466', 'Corteza de plátano'),
  'jar-corteza-olivo': bark('jar_corteza_olivo', '#6f6a5c', 'Corteza de olivo'),
  'jar-corteza-fina': bark('jar_corteza_fina', '#6b6052', 'Corteza'),
  'jar-pino': { texture: 'jar_pino', swatch: '#a8743f', name: 'Pino tratado', material: 'Madera de pino', roughness: .7 },
  'jar-terracota': { texture: 'jar_terracota', swatch: '#b4653e', name: 'Terracota', material: 'Terracota', roughness: .85 },
  'jar-tierra': { texture: 'jar_tierra', color: '#3b2b20', swatch: '#3b2b20', name: 'Tierra', material: 'Sustrato', roughness: .95 },
  'jar-roca': { texture: 'jar_roca', swatch: '#8f8b80', name: 'Roca', material: 'Piedra', roughness: .85 },
  'jar-piedra-clara': { texture: 'jar_piedra_clara', swatch: '#b0a58e', name: 'Piedra caliza', material: 'Piedra', roughness: .8 },
  'jar-naranja': flat('paint', '#e07a12', .42, 'Naranjas', 'Fruta', { coat: .2 }),
  'jar-ceramica-roja': flat('paint', '#b4532f', .22, 'Cerámica esmaltada roja', 'Cerámica', { coat: .6 }),
  'jar-ceramica-crema': flat('paint', '#ece2cc', .28, 'Cerámica esmaltada crema', 'Cerámica', { coat: .5 }),
};

export const PRODUCTS = [
  ...[
    ['lavanda', 'Lavanda', 'lavender', 650, 650, 650, 'jar-lavanda'],
    ['romero', 'Romero', 'rosemary', 700, 650, 700, 'jar-lavanda'],
    ['graminea', 'Gramínea ornamental', 'grass', 700, 700, 1100, 'jar-espiga'],
  ].map(([product, label, species, w, d, h, flor]) => ({ product, label, type: 'aromatic', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-palmera', flor }, params: { species },
    variants: [{ key: 'jardin', size: `${h/1000} m`, dims: [w,d,h], proposal: true }] })),
  ...[
    ['seto_bajo', 'Boj bajo', 2000, 450, 500, 'jar-hojas-boj', .25],
    ['seto_laurel', 'Seto de laurel', 2000, 700, 1800, 'jar-hojas-arbusto', .28],
    ['seto_fotinia', 'Seto de fotinia', 2000, 650, 1400, 'jar-hojas-naranjo', .04],
  ].map(([product, label, w, d, h, hojas, hue]) => ({ product, label, type: 'hedge', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas }, params: { hue }, variants: [{ key: 'jardin', size: `${h/1000} m de alto`, dims: [w,d,h], proposal: true }] })),
  ...[
    ['pino', 'pine', 'Pino de jardín', 3200, 3200, 5000, 'jar-conifera'],
    ['cipres', 'cypress', 'Ciprés mediterráneo', 900, 900, 3500, 'jar-conifera'],
    ['palmera', 'palm', 'Palmera de jardín', 3600, 3600, 4500, 'jar-palmera'],
  ].map(([product, type, label, w, d, h, hojas]) => ({ product, type, label, profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas, corteza: 'jar-corteza-fina' },
    variants: [{ key: 'jardin', size: `${h / 1000} m`, dims: [w, d, h], proposal: true }] })),
  {
    product: 'arbol_platano', type: 'shade_tree', label: 'Plátano de sombra', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-platano', corteza: 'jar-corteza-platano' },
    variants: [{ key: '400', size: '4 m de alto', dims: [2500, 2500, 3950], proposal: true }],
  },
  {
    product: 'olivo_jardin', type: 'olive_tree', label: 'Olivo de jardín', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-olivo', corteza: 'jar-corteza-olivo' },
    variants: [{ key: '300', size: '3 m de alto', dims: [2500, 2500, 3000], proposal: true }],
  },
  {
    product: 'naranjo', type: 'orange_tree', label: 'Naranjo', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-naranjo', corteza: 'jar-corteza-fina', fruto: 'jar-naranja' },
    variants: [{ key: '280', size: '2,8 m de alto', dims: [2000, 2000, 2800], proposal: true }],
  },
  {
    product: 'arbusto', type: 'shrub', label: 'Arbusto perenne', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-arbusto', corteza: 'jar-corteza-fina' },
    variants: [{ key: '100', size: '1 m de alto', dims: [1000, 900, 1000], proposal: true }],
  },
  {
    product: 'seto_boj', type: 'hedge', label: 'Seto recortado de boj', profile: 'plant', style: 'Clásico',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-boj' },
    variants: [{ key: '200', size: 'Módulo de 2 m · 1,4 m de alto', dims: [2000, 600, 1400], proposal: true }],
  },
  {
    product: 'formio', type: 'phormium', label: 'Formio', profile: 'plant', style: 'Contemporáneo',
    mainSlot: 'hojas', finishes: { hojas: 'jar-hojas-formio' },
    variants: [{ key: '110', size: '1,1 m de alto', dims: [600, 600, 1100], proposal: true }],
  },
  {
    product: 'maceta_terracota', type: 'garden_pot', label: 'Maceta de terracota de exterior', profile: 'plant', style: 'Mediterráneo',
    mainSlot: 'maceta', finishes: { maceta: 'jar-terracota', tierra: 'jar-tierra' },
    variants: [{ key: '50', size: 'Ø 50 cm', dims: [500, 500, 500], proposal: true }],
  },
  {
    product: 'jardinera', label: 'Jardinera con plantas', profile: 'plant', style: 'Mediterráneo', mainSlot: 'maceta',
    variants: [
      { key: 'madera_150', type: 'planter_box', size: 'Madera · 150 × 45 cm', dims: [1500, 450, 800], proposal: true,
        finishes: { madera: 'jar-pino', tierra: 'jar-tierra', hojas: 'jar-hojas-boj' } },
      { key: 'terracota_100', type: 'planter_trough', size: 'Terracota · 100 × 40 cm', dims: [1000, 400, 900],
        finishes: { maceta: 'jar-terracota', tierra: 'jar-tierra', hojas: 'jar-hojas-formio' } },
    ],
  },
  {
    product: 'huerto', type: 'raised_bed', label: 'Bancal de huerto elevado', profile: 'plant', style: 'Rústico',
    finishes: { madera: 'jar-pino', tierra: 'jar-tierra', hojas: 'jar-hojas-lechuga', puerros: 'jar-hojas-olivo' },
    variants: [{ key: '240', size: '240 × 120 cm', dims: [2400, 1200, 600], proposal: true }],
  },
  {
    product: 'roca', type: 'rock', label: 'Roca ornamental', profile: 'decor', style: 'Rústico',
    mainSlot: 'piedra', finishes: { piedra: 'jar-roca' },
    variants: [{ key: '110', size: '110 × 80 cm', dims: [1100, 800, 650], proposal: true }],
  },
  {
    product: 'piedras', type: 'stones', label: 'Grupo de piedras ornamentales', profile: 'decor', style: 'Rústico',
    mainSlot: 'piedra', finishes: { piedra: 'jar-piedra-clara' },
    variants: [{ key: '100', size: '100 × 70 cm', dims: [1000, 700, 250], proposal: true }],
  },
  {
    product: 'setas', type: 'mushrooms', label: 'Setas de cerámica', profile: 'decor', style: 'Rústico',
    mainSlot: 'sombrero', finishes: { sombrero: 'jar-ceramica-roja', pie: 'jar-ceramica-crema' },
    variants: [{ key: '40', size: 'Tres setas · 40 cm', dims: [450, 450, 400], proposal: true }],
  },
].map((product) => ({ hidden: true, ...product }));
