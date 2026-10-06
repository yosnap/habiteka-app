/**
 * Electrodomésticos de libre instalación, realistas y sin marca: lavadora, secadora y lavasecadora de carga frontal,
 * lavavajillas, frigorífico combi y americano, microondas y horno de sobremesa, cafetera espresso, campana decorativa
 * de pared y termo eléctrico. Medidas del catálogo maestro (plans/261005-0727-catalogo-puertas-muebles/
 * catalogo-maestro.json), oleadas 2–4.
 *
 * Python: scripts/blender/fam_electrodomesticos.py (BUILDERS) y sus piezas comunes en fam_electrodomesticos_partes.py,
 * declarado en dependsOn para que la huella del generador lo incluya.
 *
 * Alturas: los aparatos de encimera (microondas, horno de sobremesa y cafetera) se construyen apoyados (cota 0) y el
 * editor los sube a la encimera o al mueble sobre el que se sueltan (object-host-rest.ts); con una cota de catálogo
 * quedarían flotando sobre un mueble más bajo. Solo los colgados llevan params.elev (mm): la campana con la visera a
 * 1550 mm y el termo con las tomas de agua a su cota; la fábrica deriva de ahí elevationMm. La campana mide 900 mm de
 * alto (no 1000) para que la chimenea acabe a 2450 mm, por debajo de un techo de 2500.
 *
 * Estancias: lavadora, secadora, lavasecadora y termo van a lavadero; furniture-rooms.ts ofrece además lavadora y
 * secadora en baño y cocina.
 */
export const FAMILY = {
  id: 'electrodomesticos', label: 'Electrodomésticos de libre instalación', room: 'cocina',
  dependsOn: ['electrodomesticos_partes', 'electrodomesticos_placa'],
};

export const TEXTURES = {
  // Acero cepillado (ambientCG no publica el tamaño de la muestra): el cepillado corre en horizontal en la imagen. A
  // 200 mm por muestra la variación de rugosidad se lee como satinado fino y no como manchas en paneles grandes.
  elec_inox: { source: 'ambientcg', id: 'Metal009', tileMm: 400, scaleMm: 200, normal: .4, grainU: true, tint: true },
};

const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'elec-inox': { texture: 'elec_inox', color: '#c4c6c8', swatch: '#c4c6c8', name: 'Acero inoxidable', material: 'Acero inoxidable', metallic: 1 },
  'elec-inox-oscuro': { texture: 'elec_inox', color: '#55585c', swatch: '#55585c', name: 'Inox oscuro', material: 'Acero inoxidable', metallic: 1 },
  'elec-blanco': flat('paint', '#f2f2ef', .3, 'Blanco', 'Chapa esmaltada', { coat: .4 }),
  'elec-plata': flat('metal', '#b3b6b9', .38, 'Gris plata', 'Chapa pintada', { metallic: .75 }),
  'elec-cristal-negro': flat('paint', '#0d0e10', .05, 'Cristal negro', 'Cristal', { coat: 1 }),
  'elec-cristal-ahumado': flat('glass', '#4f565e', .03, 'Cristal ahumado', 'Cristal'),
  'elec-ventana': flat('paint', '#1d2023', .2, 'Ventana con rejilla', 'Cristal'),
  'elec-pantalla': flat('paint', '#07090b', .1, 'Pantalla', 'Cristal', { coat: .8 }),
  'elec-digitos': flat('paint', '#cfe8ff', .4, 'Dígitos', 'Pantalla'),
  'elec-indicador': flat('paint', '#ff7a1f', .35, 'Piloto', 'Plástico'),
  'elec-goma': flat('paint', '#1b1c1e', .75, 'Goma negra', 'Goma'),
  'elec-plastico-gris': flat('paint', '#8e9297', .45, 'Plástico gris', 'Plástico'),
  'elec-plastico-negro': flat('paint', '#222326', .4, 'Plástico negro', 'Plástico'),
  'elec-tambor': flat('metal', '#6c6f73', .35, 'Acero del tambor', 'Acero', { metallic: .9 }),
  'elec-esmalte': flat('paint', '#2a2c30', .3, 'Esmalte interior', 'Esmalte'),
  'elec-aluminio': flat('metal', '#c6c9cc', .32, 'Aluminio', 'Aluminio', { metallic: 1 }),
  'elec-esfera': flat('paint', '#f4f2ec', .4, 'Esfera', 'Plástico'),
  'elec-azul': flat('paint', '#2f6db3', .4, 'Anilla azul', 'Plástico'),
  'elec-rojo': flat('paint', '#c23b30', .4, 'Anilla roja', 'Plástico'),
  'elec-serigrafia': flat('paint', '#aeb3b8', .45, 'Serigrafía de cocción', 'Serigrafía'),
};

/** Detalles comunes: gomas, pantalla con dígitos, mandos y placa de marca genérica. */
const BASE = { goma: 'elec-goma', pantalla: 'elec-pantalla', led: 'elec-digitos', mandos: 'cromo', logo: 'cromo' };
const LAUNDRY = { ...BASE, vidrio: 'elec-cristal-ahumado', interior: 'elec-tambor' };

export const PRODUCTS = [
  {
    product: 'vitroceramica', type: 'ceramic_hob', label: 'Vitrocerámica de cuatro zonas', profile: 'appliance', style: 'Contemporáneo', room: 'cocina',
    mainSlot: 'vidrio', params: {},
    finishes: { vidrio: 'elec-cristal-negro', carcasa: 'elec-plastico-negro', marco: 'elec-aluminio', marcas: 'elec-serigrafia' },
    // Solo la parte visible sobre la encimera: el cuerpo de encastre queda dentro del mueble.
    variants: [{ key: '60', size: '60 × 52 cm', dims: [600, 520, 8], proposal: true }],
  },
  {
    product: 'lavadora', type: 'washer', label: 'Lavadora de carga frontal', profile: 'appliance', style: 'Contemporáneo', room: 'lavadero',
    params: { kind: 'lavadora' }, mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...LAUNDRY, carcasa: 'elec-blanco', panel: 'elec-blanco', aro: 'elec-plastico-gris', mandos: 'elec-blanco' },
    variants: [
      { key: 'blanca', size: '8 kg · 60 cm', dims: [600, 600, 850], proposal: true },
      { key: 'inox', size: '8 kg · 60 cm', dims: [600, 600, 850],
        finishes: { carcasa: 'elec-inox', panel: 'elec-cristal-negro', aro: 'elec-inox-oscuro', mandos: 'cromo' } },
    ],
  },
  {
    product: 'secadora', type: 'washer', label: 'Secadora de bomba de calor', profile: 'appliance', style: 'Contemporáneo', room: 'lavadero',
    params: { kind: 'secadora', door_r: 185, door_z: 440 }, mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...LAUNDRY, carcasa: 'elec-blanco', panel: 'elec-plastico-gris', aro: 'elec-blanco', mandos: 'elec-blanco' },
    variants: [
      { key: 'blanca', size: '9 kg · 60 cm', dims: [600, 640, 850], proposal: true },
      { key: 'blanca_60x60', size: '9 kg · 60 × 60 cm', dims: [600, 600, 850] },
    ],
  },
  {
    product: 'lavasecadora', type: 'washer', label: 'Lavasecadora', profile: 'appliance', style: 'Contemporáneo', room: 'lavadero',
    params: { kind: 'lavasecadora' }, mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...LAUNDRY, carcasa: 'elec-inox', panel: 'elec-cristal-negro', aro: 'elec-plastico-negro', cajetin: 'elec-inox' },
    variants: [{ key: 'inox', size: '9/6 kg · 60 cm', dims: [600, 620, 850], proposal: true }],
  },
  {
    product: 'lavavajillas', type: 'dishwasher', label: 'Lavavajillas de libre instalación', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'frente', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-blanco', frente: 'elec-blanco', panel: 'elec-plastico-gris', mandos: 'elec-blanco', tirador: 'elec-plata' },
    variants: [
      { key: '45_blanco', size: '45 cm', dims: [450, 600, 850] },
      { key: '60_blanco', size: '60 cm', dims: [600, 600, 850], proposal: true },
      { key: '60_inox', size: '60 cm', dims: [600, 600, 850],
        finishes: { carcasa: 'elec-plata', frente: 'elec-inox', panel: 'elec-cristal-negro', mandos: 'cromo', tirador: 'elec-inox' } },
    ],
  },
  {
    product: 'frigorifico_combi', type: 'fridge_combi', label: 'Frigorífico combi', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'frente', textureSize: 512,
    variants: [
      { key: 'inox_186', size: '186 × 60 cm', dims: [595, 650, 1860], params: { freezer_h: 620, display: true }, proposal: true,
        finishes: { ...BASE, carcasa: 'elec-plata', frente: 'elec-inox', tirador: 'elec-inox' } },
      { key: 'blanco_203', size: '203 × 60 cm', dims: [595, 650, 2030], params: { freezer_h: 660, display: false },
        finishes: { ...BASE, carcasa: 'elec-blanco', frente: 'elec-blanco', tirador: 'elec-plata' } },
      // Combi XL de 70 cm (p. ej. 203 × 70 × 67 cm): a la medida del frigorífico por código y del antiguo de Poly Pizza.
      { key: 'inox_70x190', size: '190 × 70 cm', dims: [700, 700, 1900], params: { freezer_h: 640, display: true },
        finishes: { ...BASE, carcasa: 'elec-plata', frente: 'elec-inox', tirador: 'elec-inox' } },
      { key: 'inox_70x180', size: '180 × 70 cm', dims: [700, 700, 1800], params: { freezer_h: 610, display: true },
        finishes: { ...BASE, carcasa: 'elec-plata', frente: 'elec-inox', tirador: 'elec-inox' } },
    ],
  },
  {
    product: 'frigorifico_americano', type: 'fridge_american', label: 'Frigorífico americano con dispensador', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'frente', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-plata', frente: 'elec-inox', tirador: 'elec-inox', interior: 'elec-plastico-negro', aro: 'cromo' },
    variants: [
      { key: 'inox', size: '91 cm', dims: [910, 720, 1790], proposal: true },
      { key: 'inox_90x80', size: '90 cm', dims: [900, 800, 1800] },
    ],
  },
  {
    product: 'microondas', type: 'microwave', label: 'Microondas de sobremesa', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'carcasa', textureSize: 512,
    variants: [
      { key: 'inox', size: '25 L', dims: [480, 380, 280], proposal: true,
        finishes: { ...BASE, carcasa: 'elec-inox', frente: 'elec-cristal-negro', panel: 'elec-inox', ventana: 'elec-ventana', tirador: 'elec-inox' } },
      { key: 'negro', size: '25 L', dims: [480, 380, 280],
        finishes: { ...BASE, carcasa: 'elec-plastico-negro', frente: 'elec-cristal-negro', panel: 'elec-cristal-negro', ventana: 'elec-ventana', tirador: 'elec-plastico-negro' } },
      { key: 'inox_32l', size: '32 L', dims: [550, 380, 350],
        finishes: { ...BASE, carcasa: 'elec-inox', frente: 'elec-cristal-negro', panel: 'elec-inox', ventana: 'elec-ventana', tirador: 'elec-inox' } },
    ],
  },
  {
    product: 'horno_sobremesa', type: 'mini_oven', label: 'Horno de sobremesa', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-plastico-negro', frente: 'elec-plastico-negro', panel: 'elec-inox', vidrio: 'elec-cristal-ahumado',
      interior: 'elec-esmalte', tirador: 'cromo', indicador: 'elec-indicador' },
    variants: [{ key: '35l', size: '35 L', dims: [520, 420, 320], proposal: true }],
  },
  {
    product: 'cafetera_espresso', type: 'espresso', label: 'Cafetera espresso', profile: 'appliance', style: 'Contemporáneo',
    mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-inox', tirador: 'cromo', mandos: 'elec-plastico-negro', esfera: 'elec-esfera', indicador: 'elec-indicador' },
    variants: [{ key: 'inox', size: 'Manual', dims: [300, 350, 350], proposal: true }],
  },
  {
    product: 'campana_pared', type: 'hood', label: 'Campana decorativa de pared', profile: 'appliance', style: 'Contemporáneo',
    params: { elev: 1550 }, mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-inox', filtro: 'elec-aluminio', mandos: 'elec-plastico-negro' },
    variants: [
      { key: '60', size: '60 cm', dims: [600, 500, 900] },
      { key: '90', size: '90 cm', dims: [900, 500, 900], proposal: true },
    ],
  },
  {
    product: 'termo_electrico', type: 'water_heater', label: 'Termo eléctrico', profile: 'appliance', style: 'Contemporáneo', room: 'lavadero',
    mainSlot: 'carcasa', textureSize: 512,
    finishes: { ...BASE, carcasa: 'elec-blanco', panel: 'elec-plastico-gris', mandos: 'elec-blanco', tirador: 'cromo', aro: 'cromo',
      esfera: 'elec-esfera', indicador: 'elec-indicador', frio: 'elec-azul', calor: 'elec-rojo' },
    variants: [
      { key: '50', size: '50 L', dims: [450, 470, 680], params: { elev: 1500 } },
      { key: '80', size: '80 L', dims: [450, 470, 900], params: { elev: 1400 }, proposal: true },
      { key: '100', size: '100 L', dims: [450, 470, 1060], params: { elev: 1250 } },
    ],
  },
];
