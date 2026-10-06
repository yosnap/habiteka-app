/**
 * Almacenaje: armarios libres (batientes, correderos y con espejo), cómodas, sinfonier, mesillas, muebles de TV,
 * composición de salón, aparadores, vitrina, librerías y estanterías, zapateros, consolas y muebles de recibidor.
 * Medidas del catálogo maestro (plans/261005-0727-catalogo-puertas-muebles/catalogo-maestro.json), oleadas 2 y 3.
 *
 * Python: scripts/blender/fam_almacenaje.py (BUILDERS) y el cuerpo común con cajones y puertas de
 * fam_almacenaje_cuerpo.py, declarado en dependsOn para que la huella del generador lo incluya. El tipo «casework»
 * lee la rejilla de huecos (grid), la base, el estilo de frente y el tirador de params (ver fam_almacenaje_cuerpo.py).
 *
 * Estancias: zapateros, consolas, percheros y el mueble de entrada van a recibidor; los muebles que sirven también en
 * otra estancia (armarios y cómodas en infantil, por ejemplo) los ofrece furniture-rooms.ts.
 */
export const FAMILY = {
  id: 'almacenaje', label: 'Armarios, cómodas, mesillas, muebles de TV, aparadores y librerías', room: 'dormitorio',
  dependsOn: ['almacenaje_cuerpo'],
};

export const TEXTURES = {
  // Tejido de ratán fino: a 140 mm por muestra parece rejilla de puerta (ambientCG no publica el tamaño real).
  alm_rejilla: { source: 'ambientcg', id: 'Wicker008A', tileMm: 300, scaleMm: 140, normal: .8 },
};

const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'alm-lacado-gris': flat('paint', '#a8a6a0', .38, 'Lacado gris piedra', 'Madera lacada', { coat: .2 }),
  'alm-aluminio': flat('metal', '#c3c5c7', .3, 'Aluminio anodizado', 'Aluminio', { metallic: 1 }),
  'alm-espejo': flat('metal', '#eef1f1', .03, 'Espejo', 'Espejo', { metallic: 1 }),
  'alm-fondo-oscuro': flat('paint', '#2d2a27', .7, 'Fondo oscuro', 'Tablero'),
  'alm-rejilla': { texture: 'alm_rejilla', swatch: '#c9a46b', name: 'Rejilla de ratán', material: 'Ratán' },
  'alm-libro-terracota': flat('paint', '#a35d45', .6, 'Lomo terracota', 'Papel'),
  'alm-libro-salvia': flat('paint', '#8c9a86', .6, 'Lomo salvia', 'Papel'),
  'alm-libro-crema': flat('paint', '#e3d9c4', .6, 'Lomo crema', 'Papel'),
};

const BOOKS = { libro1: 'alm-libro-terracota', libro2: 'alm-libro-salvia', libro3: 'alm-libro-crema' };
const OAK = { cuerpo: 'roble', frente: 'roble', patas: 'roble', tirador: 'roble' };
const WHITE = { cuerpo: 'lacado-blanco', frente: 'lacado-blanco' };
const oakLegs = (base_h) => ({ base: 'patas', base_h, leg: 'conica' });

export const PRODUCTS = [
  // ── Armarios libres ──────────────────────────────────────────────────────────────────────────────────────────────
  {
    product: 'armario_nordico', type: 'casework', label: 'Armario nórdico lacado', profile: 'cabinet', style: 'Nórdico',
    params: { ...oakLegs(120), fronts: 'sobre', handle: 'pomo' }, mainSlot: 'frente',
    finishes: { ...WHITE, patas: 'roble', tirador: 'roble' },
    variants: [
      { key: '1p_50', size: 'Una puerta · 50 cm', dims: [500, 580, 2010], params: { grid: ['P'] } },
      { key: '2p_100', size: 'Dos puertas · 100 cm', dims: [1000, 580, 2010], params: { grid: ['PP'] }, proposal: true },
      { key: '3p_150', size: 'Tres puertas · 150 cm', dims: [1500, 580, 2010], params: { grid: ['P', '2:PP'] } },
      // A la medida de piezas que ya existen: armario por código, armario antiguo de Poly Pizza y mueble columna.
      { key: '2p_120', size: 'Dos puertas · 120 cm', dims: [1200, 600, 2200], params: { grid: ['PP'] } },
      { key: '2p_120x200', size: 'Dos puertas · 120 × 200 cm', dims: [1200, 600, 2000], params: { grid: ['PP'] } },
      { key: 'columna_50', size: 'Columna · 50 × 40 cm', dims: [500, 400, 1900], params: { grid: ['P'] } },
    ],
  },
  {
    product: 'armario_roble', type: 'casework', label: 'Armario de roble con perfil tirador', profile: 'cabinet', style: 'Contemporáneo',
    params: { base: 'zocalo', base_h: 80, fronts: 'sobre', handle: 'unero' }, mainSlot: 'frente',
    finishes: { cuerpo: 'lacado-blanco', frente: 'roble', perfil: 'alm-aluminio' },
    variants: [
      { key: '2p_100', size: 'Dos puertas · 100 cm', dims: [1000, 580, 2360], params: { grid: ['PP'] } },
      { key: '3p_150', size: 'Tres puertas · 150 cm', dims: [1500, 580, 2360], params: { grid: ['P', '2:PP'] }, proposal: true },
      { key: '3p_180', size: 'Tres puertas · 180 cm', dims: [1800, 600, 2200], params: { grid: ['P', '2:PP'] } },
    ],
  },
  {
    product: 'armario_corredero', type: 'wardrobe_sliding', label: 'Armario de puertas correderas', profile: 'cabinet', style: 'Contemporáneo',
    params: { panels: 2, sections: [['liso', 1], ['liso', 1], ['liso', 1]] }, mainSlot: 'frente',
    finishes: { ...WHITE, perfil: 'alm-aluminio' },
    variants: [
      { key: '180', size: '180 cm', dims: [1800, 650, 2360], proposal: true },
      { key: '200', size: '200 cm', dims: [2000, 650, 2360] },
    ],
  },
  {
    product: 'armario_corredero_espejo', type: 'wardrobe_sliding', label: 'Armario corredero con espejo', profile: 'cabinet', style: 'Contemporáneo',
    params: { panels: 2, sections: [['liso', 1], ['espejo', 3], ['liso', 1]] }, mainSlot: 'frente',
    finishes: { cuerpo: 'roble', frente: 'roble', espejo: 'alm-espejo', perfil: 'alm-aluminio' },
    variants: [
      { key: '150', size: '150 cm', dims: [1500, 650, 2360] },
      { key: '200', size: '200 cm', dims: [2000, 650, 2360], proposal: true },
    ],
  },
  {
    product: 'armario_rejilla', type: 'casework', label: 'Armario de dos puertas de rejilla', profile: 'cabinet', style: 'Mediterráneo',
    params: { grid: ['PP'], ...oakLegs(150), fronts: 'inset', front: 'rejilla', handle: 'pomo' }, mainSlot: 'frente',
    finishes: { ...OAK, rejilla: 'alm-rejilla' },
    variants: [{ key: '100', size: '100 cm', dims: [1000, 580, 2000], proposal: true }],
  },
  // ── Cómodas, sinfonier y mesillas ────────────────────────────────────────────────────────────────────────────────
  {
    product: 'comoda_roble', type: 'casework', label: 'Cómoda de roble', profile: 'cabinet', style: 'Nórdico',
    params: { grid: ['C C C', 'C C C'], ...oakLegs(140), fronts: 'sobre', handle: 'pomo' }, mainSlot: 'frente', finishes: OAK,
    variants: [
      { key: '100', size: 'Seis cajones · 100 cm', dims: [1000, 450, 850] },
      { key: '120', size: 'Seis cajones · 120 cm', dims: [1200, 480, 780] },
      { key: '160', size: 'Seis cajones · 160 cm', dims: [1600, 480, 780], proposal: true },
    ],
  },
  {
    product: 'comoda_lacada', type: 'casework', label: 'Cómoda lacada con perfil tirador', profile: 'cabinet', style: 'Contemporáneo',
    params: { grid: ['C C C'], base: 'zocalo', base_h: 70, fronts: 'sobre', handle: 'unero' }, mainSlot: 'frente',
    finishes: { ...WHITE, perfil: 'alm-aluminio' }, textureSize: 512,
    variants: [{ key: '80', size: 'Tres cajones · 80 cm', dims: [800, 480, 780], proposal: true }],
  },
  {
    product: 'sinfonier', type: 'casework', label: 'Sinfonier de seis cajones', profile: 'cabinet', style: 'Nórdico',
    params: { grid: ['C C C C C C'], ...oakLegs(120), fronts: 'sobre', handle: 'pomo', top_th: 22, top_over: 10 },
    mainSlot: 'frente', finishes: { ...WHITE, sobre: 'roble', patas: 'roble', tirador: 'roble' }, textureSize: 512,
    variants: [{ key: '50', size: '50 cm', dims: [500, 450, 1200], proposal: true }],
  },
  {
    product: 'comoda_nogal', type: 'casework', label: 'Cómoda de nogal con patas altas', profile: 'cabinet', style: 'Clásico',
    params: { grid: ['C C C'], base: 'patas', base_h: 260, leg: 'laton', fronts: 'inset', handle: 'barra_larga' }, mainSlot: 'frente',
    finishes: { cuerpo: 'nogal', frente: 'nogal', patas: 'laton', tirador: 'laton' },
    variants: [{ key: '120', size: 'Tres cajones · 120 cm', dims: [1200, 450, 850], proposal: true }],
  },
  {
    product: 'mesilla_roble', type: 'casework', label: 'Mesilla de dos cajones de roble', profile: 'cabinet', style: 'Nórdico',
    params: { grid: ['C C'], ...oakLegs(150), fronts: 'inset', handle: 'pomo' }, mainSlot: 'frente', finishes: OAK, textureSize: 512,
    variants: [{ key: '45', size: '45 cm', dims: [450, 400, 550], proposal: true }],
  },
  {
    product: 'mesilla_suspendida', type: 'casework', label: 'Mesilla suspendida de un cajón', profile: 'cabinet', style: 'Contemporáneo',
    params: { grid: ['C'], base: 'suspendido', elev: 420, fronts: 'sobre', handle: 'unero' }, mainSlot: 'frente',
    finishes: { ...WHITE, perfil: 'alm-aluminio' }, textureSize: 512,
    variants: [{ key: '45', size: '45 cm', dims: [450, 300, 170], proposal: true }],
  },
  {
    product: 'mesilla_nogal', type: 'casework', label: 'Mesilla de nogal con patas de latón', profile: 'cabinet', style: 'Contemporáneo',
    params: { grid: ['C A'], base: 'patas', base_h: 220, leg: 'laton', fronts: 'inset', handle: 'barra' }, mainSlot: 'frente',
    finishes: { cuerpo: 'nogal', frente: 'nogal', patas: 'laton', tirador: 'laton' }, textureSize: 512,
    variants: [{ key: '50', size: '50 cm', dims: [500, 400, 550], proposal: true }],
  },
  {
    product: 'mesilla_ratan', type: 'casework', label: 'Mesilla de ratán con balda', profile: 'cabinet', style: 'Mediterráneo',
    params: { grid: ['C A'], ...oakLegs(160), fronts: 'inset', drawer_front: 'rejilla', handle: 'pomo' }, mainSlot: 'cuerpo',
    finishes: { ...OAK, rejilla: 'alm-rejilla' }, textureSize: 512,
    variants: [{ key: '45', size: '45 cm', dims: [450, 400, 550], proposal: true }],
  },
  // ── Salón: muebles de TV y composición ──────────────────────────────────────────────────────────────────────────
  {
    product: 'mueble_tv_roble', type: 'casework', label: 'Mueble de TV bajo de roble con patas', profile: 'cabinet', style: 'Nórdico', room: 'salon',
    params: { grid: ['P', 'A C', 'P'], ...oakLegs(140), fronts: 'sobre', handle: 'pomo' }, mainSlot: 'cuerpo',
    finishes: { cuerpo: 'roble', frente: 'lacado-blanco', patas: 'roble', tirador: 'roble' },
    variants: [{ key: '160', size: '160 cm', dims: [1600, 420, 520], proposal: true }],
  },
  {
    product: 'mueble_tv_nogal', type: 'casework', label: 'Mueble de TV de nogal con frentes ranurados', profile: 'cabinet', style: 'Contemporáneo', room: 'salon',
    params: { base: 'patas', base_h: 100, leg: 'metal', fronts: 'sobre', front: 'ranurado', handle: 'ninguno', top_th: 20 },
    mainSlot: 'frente', finishes: { cuerpo: 'nogal', frente: 'nogal', sobre: 'nogal', patas: 'metal-negro' },
    variants: [
      { key: '160', size: '160 cm', dims: [1600, 450, 500], params: { grid: ['P', 'P', 'P'] } },
      { key: '200', size: '200 cm', dims: [2000, 450, 500], params: { grid: ['P', 'P', 'P', 'P'] }, proposal: true },
    ],
  },
  {
    product: 'mueble_tv_suspendido', type: 'casework', label: 'Mueble de TV suspendido lacado', profile: 'cabinet', style: 'Contemporáneo', room: 'salon',
    params: { grid: ['B', '2:A', 'B'], base: 'suspendido', elev: 350, fronts: 'sobre', handle: 'ranura' }, mainSlot: 'frente',
    finishes: { ...WHITE, perfil: 'aluminio-antracita' },
    variants: [
      { key: '140', size: '140 cm', dims: [1400, 350, 300] },
      { key: '180', size: '180 cm', dims: [1800, 350, 300], proposal: true },
    ],
  },
  {
    product: 'mueble_tv_industrial', type: 'casework', label: 'Mueble de TV industrial de madera y acero', profile: 'cabinet', style: 'Industrial', room: 'salon',
    params: { grid: ['C A', 'A A', 'C A'], base: 'bastidor', base_h: 120, fronts: 'inset', handle: 'barra' }, mainSlot: 'cuerpo',
    finishes: { cuerpo: 'roble', frente: 'roble', estructura: 'metal-negro', tirador: 'metal-negro' },
    variants: [{ key: '180', size: '180 cm', dims: [1800, 400, 550], proposal: true }],
  },
  {
    product: 'mueble_tv_rejilla', type: 'casework', label: 'Mueble de TV con puertas de rejilla', profile: 'cabinet', style: 'Mediterráneo', room: 'salon',
    params: { grid: ['P', 'P', 'P'], ...oakLegs(150), fronts: 'inset', front: 'rejilla', handle: 'pomo' }, mainSlot: 'cuerpo',
    finishes: { ...OAK, rejilla: 'alm-rejilla' },
    variants: [{ key: '150', size: '150 cm', dims: [1500, 400, 550], proposal: true }],
  },
  {
    product: 'composicion_salon', type: 'tv_wall', label: 'Composición de salón con columnas y puente', profile: 'cabinet', style: 'Contemporáneo', room: 'salon',
    params: { column_w: 450, low_h: 450, bridge_h: 350, handle: 'ninguno' }, mainSlot: 'frente',
    finishes: { ...WHITE, sobre: 'roble', vidrio: 'cristal' },
    variants: [{ key: '300', size: '300 cm', dims: [3000, 400, 2000], proposal: true }],
  },
  // ── Comedor: aparadores y vitrina ───────────────────────────────────────────────────────────────────────────────
  {
    product: 'aparador_roble', type: 'casework', label: 'Aparador de roble de tres puertas de lamas', profile: 'cabinet', style: 'Nórdico', room: 'comedor',
    params: { grid: ['P', 'P', 'P'], ...oakLegs(150), fronts: 'sobre', front: 'lamas', handle: 'ninguno', top_th: 20, top_over: 8 },
    mainSlot: 'frente', finishes: { ...OAK, sobre: 'roble', fondo: 'alm-fondo-oscuro' },
    variants: [
      { key: '150', size: '150 cm', dims: [1500, 450, 780] },
      { key: '180', size: '180 cm', dims: [1800, 450, 780], proposal: true },
    ],
  },
  {
    product: 'aparador_rejilla', type: 'casework', label: 'Aparador con puertas de rejilla', profile: 'cabinet', style: 'Mediterráneo', room: 'comedor',
    params: { grid: ['P', 'C C', 'P'], ...oakLegs(150), fronts: 'inset', front: 'rejilla', handle: 'pomo' }, mainSlot: 'cuerpo',
    finishes: { ...OAK, rejilla: 'alm-rejilla' },
    variants: [{ key: '150', size: '150 cm', dims: [1500, 450, 800], proposal: true }],
  },
  {
    product: 'aparador_lacado', type: 'casework', label: 'Aparador lacado sin tiradores', profile: 'cabinet', style: 'Contemporáneo', room: 'comedor',
    params: { grid: ['P', 'P', 'P', 'P'], base: 'zocalo', base_h: 80, fronts: 'sobre', handle: 'ranura' }, mainSlot: 'frente',
    finishes: { cuerpo: 'alm-lacado-gris', frente: 'alm-lacado-gris', perfil: 'aluminio-antracita' },
    variants: [{ key: '200', size: '200 cm', dims: [2000, 450, 750], proposal: true }],
  },
  {
    product: 'aparador_nogal', type: 'casework', label: 'Aparador clásico de nogal', profile: 'cabinet', style: 'Clásico', room: 'comedor',
    params: { grid: ['P', 'C C', 'P'], base: 'patas', base_h: 160, leg: 'torneada', leg_size: .8, fronts: 'inset', front: 'marco',
      handle: 'pomo', top_th: 25, top_over: 12 },
    mainSlot: 'frente', finishes: { cuerpo: 'nogal', frente: 'nogal', sobre: 'nogal', patas: 'nogal', tirador: 'laton' },
    variants: [{ key: '150', size: '150 cm', dims: [1500, 450, 850], proposal: true }],
  },
  {
    product: 'vitrina_metal', type: 'glass_cabinet', label: 'Vitrina de metal y vidrio', profile: 'shelf', style: 'Industrial', room: 'comedor',
    mainSlot: 'estructura', finishes: { estructura: 'metal-negro', vidrio: 'cristal' }, textureSize: 512,
    variants: [{ key: '90', size: '90 cm', dims: [900, 400, 1800], proposal: true }],
  },
  // ── Librerías y estanterías ─────────────────────────────────────────────────────────────────────────────────────
  {
    product: 'libreria_alta', type: 'casework', label: 'Librería alta', profile: 'shelf', style: 'Nórdico', room: 'salon',
    params: { base: 'zocalo', base_h: 60, fronts: 'inset', panel: 20 }, mainSlot: 'cuerpo',
    variants: [
      { key: 'lacada', size: '80 cm', dims: [800, 280, 2020], params: { grid: ['A A A A A'] }, finishes: WHITE, proposal: true },
      { key: 'roble', size: '80 cm · con puertas', dims: [800, 280, 2020], params: { grid: ['A A A A PP*1.2'], handle: 'pomo', relleno: true },
        finishes: { ...OAK, ...BOOKS } },
      { key: 'roble_100', size: '100 cm · con puertas', dims: [1000, 350, 1900], params: { grid: ['A A A A PP*1.2'], handle: 'pomo', relleno: true },
        finishes: { ...OAK, ...BOOKS } },
    ],
  },
  {
    product: 'estanteria_cubos', type: 'casework', label: 'Estantería de cubos', profile: 'shelf', style: 'Contemporáneo', room: 'salon',
    params: { base: 'ninguno', fronts: 'inset', panel: 38, divider: 16, back: false }, mainSlot: 'cuerpo',
    variants: [
      { key: '2x4', size: '2 × 4 cubos', dims: [770, 390, 1470], params: { grid: ['A A A A', 'A A A A'] }, finishes: { cuerpo: 'lacado-blanco' }, proposal: true },
      { key: '4x4', size: '4 × 4 cubos', dims: [1470, 390, 1470], params: { grid: ['A A A A', 'A A A A', 'A A A A', 'A A A A'] }, finishes: { cuerpo: 'roble' } },
    ],
  },
  {
    product: 'estanteria_escalera', type: 'ladder_shelf', label: 'Estantería escalera', profile: 'shelf', style: 'Nórdico', room: 'salon',
    params: { shelves: 5 }, mainSlot: 'cuerpo', finishes: { cuerpo: 'roble' }, textureSize: 512,
    variants: [{ key: '60', size: '60 cm', dims: [600, 350, 1800], proposal: true }],
  },
  {
    product: 'libreria_baja', type: 'casework', label: 'Librería baja de nogal', profile: 'shelf', style: 'Contemporáneo', room: 'salon',
    params: { grid: ['A A', 'A A', 'A A'], base: 'patas', base_h: 80, leg: 'metal', fronts: 'inset', relleno: true }, mainSlot: 'cuerpo',
    finishes: { cuerpo: 'nogal', patas: 'metal-negro', ...BOOKS },
    variants: [{ key: '120', size: '120 cm', dims: [1200, 300, 800], proposal: true }],
  },
  {
    product: 'estante_pared', type: 'wall_shelf', label: 'Estante de pared flotante', profile: 'shelf', style: 'Nórdico', room: 'salon',
    params: { style: 'flotante', elev: 1500 }, mainSlot: 'cuerpo', finishes: { cuerpo: 'roble' }, textureSize: 512,
    variants: [
      { key: '80', size: '80 cm', dims: [800, 200, 40], proposal: true },
      { key: '120', size: '120 cm', dims: [1200, 200, 40] },
    ],
  },
  {
    product: 'estante_escuadras', type: 'wall_shelf', label: 'Estante de pared con escuadras', profile: 'shelf', style: 'Industrial', room: 'salon',
    params: { style: 'escuadras', elev: 1400 }, mainSlot: 'cuerpo', finishes: { cuerpo: 'roble', estructura: 'metal-negro' }, textureSize: 512,
    variants: [{ key: '120', size: '120 cm', dims: [1200, 250, 200], proposal: true }],
  },
  // ── Recibidor: zapateros, consolas, percheros y mueble de entrada ──────────────────────────────────────────────
  {
    product: 'zapatero_abatible', type: 'casework', label: 'Zapatero de dos compartimentos abatibles', profile: 'cabinet', style: 'Contemporáneo', room: 'recibidor',
    params: { grid: ['C*0.4 B B'], base: 'zocalo', base_h: 40, fronts: 'sobre', handle: 'pomo' }, mainSlot: 'frente',
    finishes: { ...WHITE, tirador: 'roble' }, textureSize: 512,
    variants: [
      { key: '80', size: '80 cm', dims: [800, 240, 1050], proposal: true },
      { key: 'roble_80', size: '80 × 35 cm', dims: [800, 350, 1000], finishes: { cuerpo: 'roble', frente: 'roble' } },
    ],
  },
  {
    product: 'banco_zapatero', type: 'shoe_bench', label: 'Banco zapatero con cojín', profile: 'bench', style: 'Nórdico', room: 'recibidor',
    mainSlot: 'cuerpo', finishes: { cuerpo: 'roble', tapiceria: 'lino-gris' }, textureSize: 512,
    variants: [{ key: '100', size: '100 cm', dims: [1000, 350, 480], proposal: true }],
  },
  {
    product: 'consola_roble', type: 'console', label: 'Consola de roble con cajones', profile: 'table', style: 'Nórdico', room: 'recibidor',
    params: { style: 'nordica' }, mainSlot: 'sobre', finishes: { ...OAK, sobre: 'roble' }, textureSize: 512,
    variants: [{ key: '100', size: '100 cm', dims: [1000, 350, 800], proposal: true }],
  },
  {
    product: 'consola_marmol', type: 'console', label: 'Consola de metal y mármol', profile: 'table', style: 'Contemporáneo', room: 'recibidor',
    params: { style: 'metal_marmol' }, mainSlot: 'sobre', finishes: { sobre: 'marmol-blanco', estructura: 'metal-negro' }, textureSize: 512,
    variants: [{ key: '120', size: '120 cm', dims: [1200, 350, 800], proposal: true }],
  },
  {
    product: 'consola_estrecha', type: 'console', label: 'Consola estrecha clásica de nogal', profile: 'table', style: 'Clásico', room: 'recibidor',
    params: { style: 'clasica' }, mainSlot: 'sobre',
    finishes: { cuerpo: 'nogal', frente: 'nogal', sobre: 'nogal', patas: 'nogal', tirador: 'laton' }, textureSize: 512,
    variants: [{ key: '80', size: '80 × 25 cm', dims: [800, 250, 800], proposal: true }],
  },
  {
    product: 'mueble_recibidor', type: 'casework', label: 'Mueble de recibidor con cajones y puertas', profile: 'cabinet', style: 'Nórdico', room: 'recibidor',
    params: { grid: ['C P*3', 'C P*3'], ...oakLegs(140), fronts: 'sobre', handle: 'pomo' }, mainSlot: 'frente',
    finishes: { cuerpo: 'roble', frente: 'alm-lacado-gris', patas: 'roble', tirador: 'roble' }, textureSize: 512,
    variants: [{ key: '90', size: '90 cm', dims: [900, 350, 850], proposal: true }],
  },
  {
    product: 'perchero_pared', type: 'coat_rack_wall', label: 'Perchero de pared con estante', profile: 'shelf', style: 'Industrial', room: 'recibidor',
    params: { elev: 1600 }, mainSlot: 'cuerpo', finishes: { cuerpo: 'roble', estructura: 'metal-negro' }, textureSize: 512,
    variants: [{ key: '80', size: '80 cm', dims: [800, 250, 300], proposal: true }],
  },
  {
    product: 'perchero_pie', type: 'coat_stand', label: 'Perchero de pie', profile: 'decor', style: 'Nórdico', room: 'recibidor',
    mainSlot: 'cuerpo', finishes: { cuerpo: 'roble' }, textureSize: 512,
    variants: [{ key: '45', size: 'Ø 45 cm', dims: [450, 450, 1800], proposal: true }],
  },
];
