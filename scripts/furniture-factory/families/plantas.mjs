/**
 * Plantas de interior realistas en maceta (monstera, ficus lyrata, olivo, sansevieria, kentia, potus, cactus,
 * suculentas, strelitzia, helecho y bambú) para decorar cualquier estancia.
 *
 * Las hojas son láminas curvadas con textura CC0 con canal alfa (alphaMode MASK en el GLB): atlas de hojas de ambientCG
 * y texturas de hojas de modelos de Poly Haven. Las siluetas que no existen en CC0 (monstera perforada, hoja de violín,
 * strelitzia rasgada, folíolos de kentia, bambú, olivo y las bandas de la sansevieria) se dibujan por código sobre el
 * color de una hoja CC0 (scripts/blender/fam_plantas_hojas.py). Tallos y pecíolos nacen de la tierra y llegan a cada
 * hoja; la tierra queda 2,5 cm por debajo del borde (1,4 cm en el cuenco). Huecos: maceta, tierra, hojas, tutor (fibra de
 * coco de la monstera), corteza (olivo), grava (cactus y suculentas) y cuerda (macramé).
 *
 * params.pot: { kind, d (diámetro exterior en mm), h (alto en mm), square? } con kind = terracota (con plato),
 * cilindro, bola, cesta (con asas), hormigon, cuenco o colgante (con colgador de macramé). Las medidas de `dims` son
 * las del modelo construido (follaje incluido); el potus colgante cuelga de un aro a 2,2 m y su cota baja es
 * `elevationMm`.
 */
export const FAMILY = {
  id: 'plantas', label: 'Plantas de interior', room: 'decoracion',
  dependsOn: ['plantas_img', 'plantas_geo', 'plantas_hojas', 'plantas_especies', 'plantas_varias'],
};

export const TEXTURES = {
  pla_hoja_oscura: { source: 'polyhaven', id: 'anthurium_botany_01', alpha: true, px: 1024, tileMm: 300 },
  pla_hoja_clara: { source: 'ambientcg', id: 'LeafSet018', alpha: true, px: 1024, tileMm: 200 },
  pla_hoja_potus: { source: 'ambientcg', id: 'LeafSet004', alpha: true, px: 1024, tileMm: 200 },
  pla_fronda: { source: 'polyhaven', id: 'fern_02', alpha: true, px: 1024, tileMm: 600 },
  pla_terracota: { source: 'ambientcg', id: 'Clay002', tileMm: 400, px: 512 },
  pla_hormigon: { source: 'ambientcg', id: 'Concrete034', tileMm: 1100, scaleMm: 600, px: 512, normal: .6, tint: true },
  pla_fibra: { source: 'ambientcg', id: 'Wicker002', tileMm: 300, scaleMm: 220, px: 512, tint: true },
  pla_tierra: { source: 'polyhaven', id: 'brown_mud', tileMm: 1300, scaleMm: 350, px: 512, tint: true },
  pla_corteza: { source: 'polyhaven', id: 'bark_willow_02', tileMm: 2150, scaleMm: 450, px: 512 },
  pla_coco: { source: 'ambientcg', id: 'Ground048', tileMm: 1400, scaleMm: 260, px: 512 },
};

// Hojas: fuente CC0 del atlas que pinta cada planta (fam_plantas_img); el material con recorte alfa se crea allí.
const leaves = (texture, swatch, name) => ({ texture, swatch, name, material: 'Hojas naturales' });

export const FINISHES = {
  'pla-terracota': { texture: 'pla_terracota', swatch: '#b4653e', name: 'Barro cocido', material: 'Terracota', roughness: .85 },
  'pla-ceramica-blanca': { kind: 'paint', color: '#eeebe5', swatch: '#eeebe5', roughness: .2, coat: .6, name: 'Cerámica blanca', material: 'Cerámica esmaltada' },
  'pla-hormigon': { texture: 'pla_hormigon', color: '#8e8b85', swatch: '#8e8b85', name: 'Hormigón', material: 'Hormigón', roughness: .9 },
  'pla-fibra': { texture: 'pla_fibra', color: '#a98b5f', swatch: '#a98b5f', name: 'Fibra natural', material: 'Fibra vegetal' },
  'pla-tierra': { texture: 'pla_tierra', color: '#3b2b20', swatch: '#3b2b20', name: 'Sustrato', material: 'Sustrato', roughness: .95 },
  'pla-corteza': { texture: 'pla_corteza', swatch: '#7b7266', name: 'Corteza', material: 'Madera' },
  'pla-grava': { texture: 'pla_hormigon', color: '#a39b8e', swatch: '#a39b8e', name: 'Grava', material: 'Piedra', roughness: .8 },
  'pla-coco': { texture: 'pla_coco', swatch: '#4a3324', name: 'Fibra de coco', material: 'Fibra de coco', roughness: .95 },
  'pla-hojas-oscuras': leaves('pla_hoja_oscura', '#2f5a2a', 'Hojas verde oscuro'),
  'pla-hojas-claras': leaves('pla_hoja_clara', '#6f8f3a', 'Hojas verde claro'),
  'pla-hojas-potus': leaves('pla_hoja_potus', '#3f6b2c', 'Hojas acorazonadas'),
  'pla-frondas': leaves('pla_fronda', '#4d6b2b', 'Frondas de helecho'),
};

const MACETA = { barro: 'pla-terracota', ceramica: 'pla-ceramica-blanca', cesta: 'pla-fibra', hormigon: 'pla-hormigon' };
const size = (cm, dims, pot, maceta, extra = {}) => ({
  key: String(cm), size: `${cm} cm de alto`, dims, ...extra,
  params: { pot, ...extra.params }, finishes: { maceta: MACETA[maceta], ...extra.finishes },
});
const pot = (kind, d, h, extra = {}) => ({ kind, d, h, ...extra });

export const PRODUCTS = [
  {
    product: 'monstera', type: 'monstera', label: 'Monstera deliciosa', style: 'Contemporáneo',
    finishes: { hojas: 'pla-hojas-oscuras', tierra: 'pla-tierra' },
    variants: [
      size(70, [650, 620, 700], pot('bola', 240, 220), 'ceramica', { params: { leaves: 8, leaf: 300 } }),
      size(120, [1000, 950, 1200], pot('cesta', 340, 300), 'cesta',
        { params: { leaves: 12, leaf: 480, pole: true }, finishes: { tutor: 'pla-coco' }, proposal: true }),
      size(150, [1200, 1150, 1500], pot('hormigon', 400, 380), 'hormigon',
        { params: { leaves: 15, leaf: 560, pole: true }, finishes: { tutor: 'pla-coco' } }),
    ],
  },
  {
    product: 'ficus_lyrata', type: 'ficus_lyrata', label: 'Ficus lyrata', style: 'Nórdico',
    finishes: { hojas: 'pla-hojas-oscuras', tierra: 'pla-tierra' },
    variants: [
      size(60, [420, 400, 600], pot('cilindro', 180, 170), 'ceramica', { params: { leaves: 12, leaf: 200, bush: true } }),
      size(120, [500, 500, 1200], pot('terracota', 280, 250), 'barro', { params: { leaves: 22, leaf: 290 }, proposal: true }),
      size(180, [750, 750, 1800], pot('hormigon', 380, 370), 'hormigon', { params: { leaves: 30, leaf: 360 } }),
    ],
  },
  {
    product: 'olivo', type: 'olivo', label: 'Olivo en maceta', style: 'Mediterráneo',
    finishes: { hojas: 'pla-hojas-claras', tierra: 'pla-tierra', corteza: 'pla-corteza' },
    variants: [
      size(120, [600, 600, 1200], pot('terracota', 360, 320), 'barro', { proposal: true }),
      size(170, [850, 850, 1700], pot('hormigon', 460, 440, { square: true }), 'hormigon'),
    ],
  },
  {
    product: 'sansevieria', type: 'sansevieria', label: 'Sansevieria', style: 'Contemporáneo',
    finishes: { hojas: 'pla-hojas-oscuras', tierra: 'pla-tierra' },
    variants: [
      size(55, [320, 290, 550], pot('cilindro', 180, 170), 'ceramica', { params: { leaves: 11 }, proposal: true }),
      size(90, [420, 460, 900], pot('hormigon', 260, 280), 'hormigon', { params: { leaves: 15 } }),
    ],
  },
  {
    product: 'kentia', type: 'kentia', label: 'Palmera kentia', style: 'Clásico',
    finishes: { hojas: 'pla-hojas-oscuras', tierra: 'pla-tierra' },
    variants: [
      size(140, [1050, 1050, 1400], pot('cesta', 320, 290), 'cesta', { params: { fronds: 9 }, proposal: true }),
      size(190, [1350, 1350, 1900], pot('cilindro', 380, 360), 'ceramica', { params: { fronds: 12 } }),
    ],
  },
  {
    product: 'potus_sobremesa', type: 'potus', label: 'Potus de sobremesa', style: 'Nórdico',
    finishes: { hojas: 'pla-hojas-potus', tierra: 'pla-tierra' },
    variants: [size(30, [520, 480, 300], pot('terracota', 150, 140), 'barro', { proposal: true })],
  },
  {
    product: 'potus_colgante', type: 'potus_colgante', label: 'Potus colgante con macramé', style: 'Nórdico',
    finishes: { hojas: 'pla-hojas-potus', tierra: 'pla-tierra', cuerda: 'cuerda-beige' },
    variants: [{ ...size(105, [420, 430, 1050], pot('colgante', 170, 130), 'ceramica', { proposal: true }), size: 'Colgado a 2,2 m · cae 105 cm' }],
  },
  {
    product: 'cactus', type: 'cactus', label: 'Cactus columnar', style: 'Mediterráneo',
    finishes: { tierra: 'pla-tierra', grava: 'pla-grava' },
    variants: [size(100, [300, 280, 1000], pot('terracota', 260, 230), 'barro', { proposal: true })],
  },
  {
    product: 'suculentas', type: 'suculentas', label: 'Centro de suculentas', style: 'Contemporáneo',
    finishes: { tierra: 'pla-tierra', grava: 'pla-grava' },
    variants: [size(16, [320, 320, 160], pot('cuenco', 320, 110), 'hormigon', { proposal: true })],
  },
  {
    product: 'strelitzia', type: 'strelitzia', label: 'Strelitzia nicolai', style: 'Contemporáneo',
    finishes: { hojas: 'pla-hojas-oscuras', tierra: 'pla-tierra' },
    variants: [
      size(150, [1050, 1000, 1500], pot('cesta', 340, 310), 'cesta', { params: { leaves: 9 }, proposal: true }),
      size(180, [1220, 1000, 1800], pot('cilindro', 380, 360), 'ceramica', { params: { leaves: 12 } }),
    ],
  },
  {
    product: 'helecho', type: 'helecho', label: 'Helecho de Boston', style: 'Clásico',
    finishes: { hojas: 'pla-frondas', tierra: 'pla-tierra' },
    variants: [size(55, [800, 800, 550], pot('bola', 240, 210), 'ceramica', { params: { fronds: 46 }, proposal: true })],
  },
  {
    product: 'bambu', type: 'bambu', label: 'Bambú de interior', style: 'Contemporáneo',
    finishes: { hojas: 'pla-hojas-claras', tierra: 'pla-tierra' },
    variants: [
      size(120, [500, 480, 1200], pot('cilindro', 280, 260), 'ceramica', { params: { culms: 5 } }),
      size(180, [700, 650, 1800], pot('hormigon', 380, 380, { square: true }), 'hormigon', { params: { culms: 7 }, proposal: true }),
    ],
  },
].map((product) => ({ profile: 'plant', mainSlot: 'maceta', textureSize: 1024, ...product }));
