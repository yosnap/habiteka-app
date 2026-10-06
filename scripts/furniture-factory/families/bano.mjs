/**
 * Baño: lavabos, muebles de lavabo, inodoros, bidés, platos de ducha con mampara, bañeras y complementos, con medidas
 * de mercado en España (mm). Las piezas colgadas (mueble suspendido, inodoro y bidé suspendidos, espejos, columna,
 * toalleros y portarrollos) se construyen a su cota real: `dims` es su tamaño visible y la fábrica registra la cota
 * del punto más bajo como elevación. Bordes de lavabo a 85 cm, de inodoro y bidé a 40 cm.
 *
 * Python: scripts/blender/fam_bano.py (BUILDERS) y sus módulos auxiliares, declarados en dependsOn para que la huella
 * del generador cambie cuando cambian.
 */
export const FAMILY = {
  id: 'bano', label: 'Baño', room: 'bano',
  dependsOn: ['bano_formas', 'bano_griferia', 'bano_sanitarios', 'bano_duchas', 'bano_complementos'],
};

/** Resina con carga mineral y relieve de pizarra (Rock058 de ambientCG, CC0), teñida al color de cada acabado. */
export const TEXTURES = {
  'bano-pizarra': { source: 'ambientcg', id: 'Rock058', tileMm: 700, scaleMm: 500, tint: true, normal: .9 },
};

const paint = (color, roughness, name, material, extra = {}) => ({ kind: 'paint', color, swatch: color, roughness, name, material, ...extra });
const slate = (color, name) => ({ texture: 'bano-pizarra', color, swatch: color, name, material: 'Resina con carga mineral' });

export const FINISHES = {
  'bano-ceramica-blanca': paint('#f4f3ef', .07, 'Cerámica blanca', 'Cerámica', { coat: .6 }),
  'bano-ceramica-negra': paint('#2c2c2b', .42, 'Cerámica negra mate', 'Cerámica'),
  'bano-acrilico-blanco': paint('#f6f5f2', .12, 'Acrílico blanco', 'Acrílico', { coat: .5 }),
  'bano-lacado-gris': paint('#8e8f8b', .38, 'Lacado gris', 'Madera lacada', { coat: .2 }),
  'bano-resina-blanca': slate('#ecebe6', 'Resina pizarra blanca'),
  'bano-resina-gris': slate('#a3a19c', 'Resina pizarra gris'),
  'bano-resina-antracita': slate('#3f3f3e', 'Resina pizarra antracita'),
  'bano-espejo': { kind: 'metal', color: '#eef0f0', swatch: '#c9d0d2', roughness: .015, metallic: 1, name: 'Espejo', material: 'Vidrio plateado' },
  'bano-led': paint('#fffdf6', .55, 'Luz LED', 'Vidrio esmerilado'),
  'bano-papel': paint('#f8f7f3', .95, 'Papel', 'Papel'),
  'bano-vidrio': { kind: 'glass', color: '#ffffff', swatch: '#e8eeec', roughness: 0, name: 'Vidrio templado transparente', material: 'Vidrio templado' },
  'bano-vidrio-mate': { kind: 'glass', color: '#f4f7f6', swatch: '#e3e8e6', roughness: .3, name: 'Vidrio templado mate', material: 'Vidrio templado' },
};

const room = (product) => ({ room: 'bano', textureSize: 512, ...product });
/** Cota del borde de los lavabos (RIM de fam_bano_sanitarios.py): la sección dibuja hasta ahí, sin el grifo. */
const RIM_MM = 850;
const ceramic = { ceramica: 'bano-ceramica-blanca', griferia: 'cromo' };

const VESSELS = [
  ['redondo', 'Lavabo sobre encimera redondo', [380, 380, 145]],
  ['ovalado', 'Lavabo sobre encimera ovalado', [520, 370, 140]],
  ['rectangular', 'Lavabo sobre encimera rectangular', [500, 350, 125]],
].map(([shape, label, basin]) => room({
  product: `lavabo_sobre_encimera_${shape}`, type: 'vessel_basin', label, profile: 'sink', style: 'Contemporáneo', mainSlot: 'ceramica',
  params: { shape, basin, top_h: 760 }, finishes: { ...ceramic, encimera: 'roble' }, counterMm: 760 + basin[2],
  variants: [
    { key: '80', size: 'Encimera 80 × 46 cm', dims: [800, 460, 612], proposal: true },
    { key: '100', size: 'Encimera 100 × 46 cm', dims: [1000, 460, 612] },
    { key: 'marmol_100', size: 'Encimera de mármol 100 × 46 cm', dims: [1000, 460, 612], finishes: { encimera: 'marmol-blanco', griferia: 'metal-negro' } },
  ],
}));

const VANITY_FINISHES = { carcasa: 'lacado-blanco', tirador: 'cromo', ceramica: 'bano-ceramica-blanca', griferia: 'cromo' };
const vanityVariants = (base, widths, proposal, extra, h) => [
  ...widths.map((width) => ({ key: String(width / 10), size: `${width / 10} cm`, dims: [width, 460, h], ...(width === proposal ? { proposal: true } : {}) })),
  ...extra.map(([key, carcasa, tirador]) => ({
    key: `${proposal / 10}_${key}`, size: `${proposal / 10} cm`, dims: [proposal, 460, h], finishes: { carcasa, tirador: tirador ?? base.tirador },
  })),
];

const LAVABOS = [
  ...VESSELS,
  room({
    product: 'lavabo_suspendido', type: 'wall_basin', counterMm: RIM_MM, label: 'Lavabo suspendido', profile: 'sink', style: 'Contemporáneo', mainSlot: 'ceramica',
    params: { support: 'suspendido' }, finishes: ceramic,
    variants: [
      { key: '50', size: '50 × 42 cm', dims: [500, 420, 600] },
      { key: '60', size: '60 × 46 cm', dims: [600, 460, 600], proposal: true },
    ],
  }),
  room({
    product: 'lavabo_pedestal', type: 'wall_basin', counterMm: RIM_MM, label: 'Lavabo de pedestal', profile: 'sink', style: 'Clásico', mainSlot: 'ceramica',
    params: { support: 'pedestal' }, finishes: ceramic,
    variants: [
      { key: '55', size: '55 × 44 cm', dims: [550, 440, 1045] },
      { key: '65', size: '65 × 50 cm', dims: [650, 500, 1045], proposal: true },
    ],
  }),
  room({
    product: 'lavabo_semipedestal', type: 'wall_basin', counterMm: RIM_MM, label: 'Lavabo con semipedestal', profile: 'sink', style: 'Contemporáneo', mainSlot: 'ceramica',
    params: { support: 'semipedestal' }, finishes: ceramic,
    variants: [
      { key: '55', size: '55 × 44 cm', dims: [550, 440, 675] },
      { key: '60', size: '60 × 46 cm', dims: [600, 460, 675], proposal: true },
    ],
  }),
  room({
    product: 'mueble_lavabo_suspendido', type: 'vanity', counterMm: RIM_MM, label: 'Mueble de baño suspendido con lavabo integrado', profile: 'sink', style: 'Contemporáneo',
    mainSlot: 'carcasa', params: { mount: 'suspendido', bowls: 1 }, finishes: VANITY_FINISHES,
    variants: vanityVariants(VANITY_FINISHES, [600, 800, 1000, 1200], 800, [['roble', 'roble', 'metal-negro'], ['nogal', 'nogal', 'metal-negro'], ['gris', 'bano-lacado-gris']], 695),
  }),
  room({
    product: 'mueble_lavabo_suelo', type: 'vanity', counterMm: RIM_MM, label: 'Mueble de baño de suelo con lavabo integrado', profile: 'sink', style: 'Nórdico',
    mainSlot: 'carcasa', params: { mount: 'suelo', bowls: 1 }, finishes: { ...VANITY_FINISHES, carcasa: 'roble', tirador: 'metal-negro' },
    variants: vanityVariants({ tirador: 'metal-negro' }, [600, 800, 1000, 1200], 800, [['blanco', 'lacado-blanco', 'cromo'], ['nogal', 'nogal'], ['gris', 'bano-lacado-gris', 'cromo']], 1045),
  }),
  room({
    product: 'mueble_lavabo_doble', type: 'vanity', counterMm: RIM_MM, label: 'Mueble de baño suspendido con dos lavabos', profile: 'sink', style: 'Contemporáneo',
    mainSlot: 'carcasa', params: { mount: 'suspendido', bowls: 2 }, finishes: { ...VANITY_FINISHES, carcasa: 'roble', tirador: 'metal-negro' },
    variants: vanityVariants({ tirador: 'metal-negro' }, [1200, 1400], 1400, [['blanco', 'lacado-blanco', 'cromo'], ['nogal', 'nogal'], ['gris', 'bano-lacado-gris', 'cromo']], 695),
  }),
];

const SANITARIOS = [
  room({
    product: 'inodoro_cisterna', type: 'toilet', label: 'Inodoro a suelo con cisterna vista y tapa amortiguada', profile: 'toilet', style: 'Clásico',
    mainSlot: 'ceramica', params: { style: 'cisterna' }, finishes: ceramic,
    variants: [{ key: 'blanco', size: '38 × 66 cm', dims: [380, 660, 800], proposal: true }],
  }),
  room({
    product: 'inodoro_compacto', type: 'toilet', label: 'Inodoro compacto «back to wall» con tapa amortiguada', profile: 'toilet', style: 'Contemporáneo',
    mainSlot: 'ceramica', params: { style: 'compacto' }, finishes: ceramic,
    variants: [{ key: 'blanco', size: '36 × 65 cm', dims: [360, 650, 800], proposal: true }],
  }),
  room({
    product: 'inodoro_suspendido', type: 'toilet', label: 'Inodoro suspendido con pulsador de pared y tapa amortiguada', profile: 'toilet', style: 'Contemporáneo',
    mainSlot: 'ceramica', params: { style: 'suspendido' }, finishes: ceramic,
    variants: [
      { key: 'blanco', size: '36 × 54 cm', dims: [360, 540, 885], proposal: true },
      { key: 'negro', size: '36 × 54 cm', dims: [360, 540, 885], finishes: { ceramica: 'bano-ceramica-negra', griferia: 'metal-negro' } },
    ],
  }),
  room({
    product: 'bide_suelo', type: 'bidet', label: 'Bidé a suelo', profile: 'toilet', style: 'Contemporáneo', mainSlot: 'ceramica',
    params: { style: 'suelo' }, finishes: ceramic,
    variants: [{ key: 'blanco', size: '36 × 54 cm', dims: [360, 540, 540], proposal: true }],
  }),
  room({
    product: 'bide_suspendido', type: 'bidet', label: 'Bidé suspendido', profile: 'toilet', style: 'Contemporáneo', mainSlot: 'ceramica',
    params: { style: 'suspendido' }, finishes: ceramic,
    variants: [
      { key: 'blanco', size: '36 × 52 cm', dims: [360, 520, 340], proposal: true },
      { key: 'negro', size: '36 × 52 cm', dims: [360, 520, 340], finishes: { ceramica: 'bano-ceramica-negra', griferia: 'metal-negro' } },
    ],
  }),
];

const TRAY_SIZES = [[800, 800], [900, 900], [1200, 700], [1400, 800], [1600, 800], [1800, 900]];
const traySize = ([w, d]) => `${Math.min(w, d) / 10} × ${Math.max(w, d) / 10} cm`;
const SHOWER_FINISHES = { plato: 'bano-resina-blanca', cristal: 'bano-vidrio', perfil: 'cromo', griferia: 'cromo' };

const DUCHAS = [
  room({
    product: 'plato_ducha', type: 'shower_tray', label: 'Plato de ducha extraplano de resina pizarra', profile: 'shower', style: 'Contemporáneo',
    mainSlot: 'plato', finishes: { plato: 'bano-resina-blanca', griferia: 'cromo' },
    variants: [
      ...TRAY_SIZES.map(([w, d]) => ({ key: `${d / 10}x${w / 10}`, size: traySize([w, d]), dims: [w, d, 30], ...(w === 1400 ? { proposal: true } : {}) })),
      { key: '80x140_gris', size: '80 × 140 cm', dims: [1400, 800, 30], finishes: { plato: 'bano-resina-gris' } },
      { key: '80x140_antracita', size: '80 × 140 cm', dims: [1400, 800, 30], finishes: { plato: 'bano-resina-antracita' } },
    ],
  }),
  room({
    product: 'ducha_walk_in', type: 'shower', label: 'Ducha con mampara fija walk-in y columna termostática', profile: 'shower', style: 'Contemporáneo',
    mainSlot: 'plato', params: { screen: 'walk_in' }, finishes: SHOWER_FINISHES,
    variants: [
      { key: '80x140', size: '80 × 140 cm', dims: [1400, 800, 2110], proposal: true },
      { key: '80x160', size: '80 × 160 cm', dims: [1600, 800, 2110] },
      { key: '90x180', size: '90 × 180 cm', dims: [1800, 900, 2110] },
      { key: '80x140_negra', size: '80 × 140 cm · perfil negro', dims: [1400, 800, 2110], finishes: { plato: 'bano-resina-antracita', perfil: 'metal-negro', griferia: 'metal-negro' } },
    ],
  }),
  room({
    product: 'ducha_corredera', type: 'shower', label: 'Ducha con mampara frontal corredera', profile: 'shower', style: 'Contemporáneo',
    mainSlot: 'plato', params: { screen: 'corredera', shower: 'columna' }, finishes: SHOWER_FINISHES,
    variants: [
      { key: '70x120', size: '70 × 120 cm · columna', dims: [1200, 700, 2110] },
      { key: '80x140', size: '80 × 140 cm · columna', dims: [1400, 800, 2110], proposal: true },
      { key: '80x160', size: '80 × 160 cm · columna', dims: [1600, 800, 2110] },
      { key: '80x140_techo', size: '80 × 140 cm · rociador de techo', dims: [1400, 800, 2400], params: { shower: 'techo' }, finishes: { plato: 'bano-resina-gris' } },
    ],
  }),
  room({
    product: 'ducha_angular', type: 'shower', label: 'Ducha angular con mampara de esquina corredera', profile: 'shower', style: 'Contemporáneo',
    mainSlot: 'plato', params: { screen: 'angular', shower: 'columna' }, finishes: SHOWER_FINISHES,
    variants: [
      { key: '80x80', size: '80 × 80 cm · columna', dims: [800, 800, 2110] },
      { key: '90x90', size: '90 × 90 cm · columna', dims: [900, 900, 2110], proposal: true },
      { key: '90x90_techo', size: '90 × 90 cm · rociador de techo', dims: [900, 900, 2400], params: { shower: 'techo' } },
      { key: '90x90_antracita', size: '90 × 90 cm · perfil negro', dims: [900, 900, 2110], finishes: { plato: 'bano-resina-antracita', perfil: 'metal-negro', griferia: 'metal-negro' } },
    ],
  }),
];

const BANERAS = [
  room({
    product: 'banera_empotrada', type: 'bath_built_in', label: 'Bañera empotrada con faldón y grifo de pared', profile: 'bath', style: 'Contemporáneo',
    mainSlot: 'acrilico', params: { tub_h: 560 }, finishes: { acrilico: 'bano-acrilico-blanco', griferia: 'cromo' },
    variants: [
      { key: '160', size: '160 × 70 cm', dims: [1600, 700, 1350] },
      { key: '170', size: '170 × 70 cm', dims: [1700, 700, 1350], proposal: true },
      { key: '140_repisa', size: '140 × 70 cm · grifo de repisa', dims: [1400, 700, 580], params: { faucet: 'repisa', tub_h: 520 } },
      { key: '170x75_repisa', size: '170 × 75 cm · grifo de repisa', dims: [1700, 750, 600], params: { faucet: 'repisa', tub_h: 540 } },
    ],
  }),
  room({
    product: 'banera_hidromasaje', type: 'bath_built_in', label: 'Bañera de hidromasaje', profile: 'bath', style: 'Contemporáneo',
    mainSlot: 'acrilico', params: { jets: true, tub_h: 560 }, finishes: { acrilico: 'bano-acrilico-blanco', griferia: 'cromo' },
    variants: [{ key: '170', size: '170 × 75 cm', dims: [1700, 750, 620], proposal: true }],
  }),
  room({
    product: 'banera_exenta', type: 'bath_freestanding', label: 'Bañera exenta ovalada con grifo de pie', profile: 'bath', style: 'Contemporáneo',
    mainSlot: 'acrilico', params: { tub_depth: 800, tub_h: 600 }, finishes: { acrilico: 'bano-acrilico-blanco', griferia: 'cromo' },
    variants: [
      { key: '160', size: '160 × 75 cm', dims: [1600, 920, 980], params: { tub_depth: 750 } },
      { key: '170', size: '170 × 80 cm', dims: [1700, 970, 980], proposal: true },
      { key: '170_negra', size: '170 × 80 cm · grifo negro', dims: [1700, 970, 980], finishes: { griferia: 'metal-negro' } },
    ],
  }),
  room({
    product: 'banera_esquina', type: 'bath_corner', label: 'Bañera de esquina', profile: 'bath', style: 'Contemporáneo',
    mainSlot: 'acrilico', params: { tub_h: 560 }, finishes: { acrilico: 'bano-acrilico-blanco', griferia: 'cromo' },
    variants: [{ key: '140', size: '140 × 140 cm', dims: [1400, 1400, 790], proposal: true }],
  }),
];

const COMPLEMENTOS = [
  room({
    product: 'espejo_rectangular', type: 'mirror', label: 'Espejo de baño rectangular', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'espejo', params: { shape: 'rectangular' }, finishes: { espejo: 'bano-espejo', marco: 'aluminio-antracita' },
    variants: [
      { key: '60', size: '60 × 80 cm', dims: [600, 20, 800] },
      { key: '80', size: '80 × 70 cm', dims: [800, 20, 700], proposal: true },
      { key: '100', size: '100 × 70 cm', dims: [1000, 20, 700] },
      { key: '120', size: '120 × 70 cm', dims: [1200, 20, 700] },
    ],
  }),
  room({
    product: 'espejo_redondo', type: 'mirror', label: 'Espejo de baño redondo con marco metálico', profile: 'decor', style: 'Nórdico',
    mainSlot: 'espejo', params: { shape: 'redondo', frame: true }, finishes: { espejo: 'bano-espejo', marco: 'metal-negro' },
    variants: [
      { key: '60', size: 'Ø 60 cm', dims: [600, 33, 600] },
      { key: '80', size: 'Ø 80 cm', dims: [800, 33, 800], proposal: true },
      { key: '80_laton', size: 'Ø 80 cm · marco de latón', dims: [800, 33, 800], finishes: { marco: 'laton' } },
    ],
  }),
  room({
    product: 'espejo_led', type: 'mirror', label: 'Espejo de baño con luz LED', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'espejo', params: { shape: 'rectangular', led: true }, finishes: { espejo: 'bano-espejo', marco: 'aluminio-antracita', led: 'bano-led' },
    variants: [
      { key: '80', size: '80 × 70 cm', dims: [800, 21, 700], proposal: true },
      { key: '100', size: '100 × 70 cm', dims: [1000, 21, 700] },
    ],
  }),
  room({
    product: 'columna_bano', type: 'tall_cabinet', label: 'Columna de baño suspendida', profile: 'cabinet', style: 'Contemporáneo',
    mainSlot: 'carcasa', finishes: { carcasa: 'lacado-blanco', tirador: 'cromo' },
    variants: [
      { key: 'blanca', size: '35 × 30 × 150 cm', dims: [350, 300, 1500], proposal: true },
      { key: 'roble', size: '35 × 30 × 150 cm', dims: [350, 300, 1500], finishes: { carcasa: 'roble', tirador: 'metal-negro' } },
    ],
  }),
  room({
    product: 'columna_bano_suelo', type: 'tall_cabinet', label: 'Columna de baño de suelo', profile: 'cabinet', style: 'Contemporáneo',
    mainSlot: 'carcasa', params: { bottom: 100, legs: true }, finishes: { carcasa: 'lacado-blanco', tirador: 'cromo' },
    variants: [
      { key: 'blanca', size: '35 × 32 × 180 cm', dims: [350, 323, 1800], proposal: true },
      { key: 'roble', size: '35 × 32 × 180 cm', dims: [350, 323, 1800], finishes: { carcasa: 'roble', tirador: 'metal-negro' } },
    ],
  }),
  room({
    product: 'toallero_barra', type: 'towel_bar', label: 'Toallero de barra', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'griferia', finishes: { griferia: 'cromo', toalla: 'algodon-gris' },
    variants: [
      { key: '60', size: '60 cm', dims: [600, 100, 450], proposal: true },
      { key: '60_negro', size: '60 cm', dims: [600, 100, 450], finishes: { griferia: 'metal-negro', toalla: 'algodon-blanco' } },
    ],
  }),
  room({
    product: 'radiador_toallero', type: 'towel_radiator', label: 'Radiador toallero', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'estructura', finishes: { estructura: 'lacado-blanco' },
    variants: [
      { key: '50x120', size: '50 × 120 cm', dims: [500, 85, 1310], proposal: true },
      { key: '50x120_cromo', size: '50 × 120 cm', dims: [500, 85, 1310], finishes: { estructura: 'cromo' } },
    ],
  }),
  room({
    product: 'portarrollos', type: 'paper_holder', label: 'Portarrollos de pared', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'griferia', finishes: { griferia: 'cromo', papel: 'bano-papel' },
    variants: [
      { key: 'cromo', size: 'Cromo', dims: [170, 120, 160], proposal: true },
      { key: 'negro', size: 'Negro mate', dims: [170, 120, 160], finishes: { griferia: 'metal-negro' } },
    ],
  }),
  room({
    product: 'estante_bano', type: 'glass_shelf', label: 'Estante de baño de vidrio', profile: 'decor', style: 'Contemporáneo',
    mainSlot: 'cristal', finishes: { cristal: 'bano-vidrio-mate', griferia: 'cromo' },
    variants: [{ key: '60', size: '60 cm', dims: [600, 130, 75], proposal: true }],
  }),
];

export const PRODUCTS = [...LAVABOS, ...SANITARIOS, ...DUCHAS, ...BANERAS, ...COMPLEMENTOS];
