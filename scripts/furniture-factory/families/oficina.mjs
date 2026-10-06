/**
 * Oficina: silla giratoria con ruedas, cajonera con ruedas, estantería metálica con baldas de roble, monitor con pie,
 * lámpara de escritorio articulada y portátil, a la medida de las piezas por código del catálogo (furniture-models.ts)
 * y del portátil antiguo de estilo plano. Monitor, lámpara y portátil se construyen apoyados (cota 0): la pieza por
 * código lleva su cota de mesa y el editor los sube al mueble sobre el que se sueltan.
 *
 * Python: scripts/blender/fam_oficina.py (BUILDERS); la cajonera usa el cuerpo común de fam_almacenaje_cuerpo.py y los
 * aparatos, las piezas de fam_electrodomesticos_partes.py (ambos en dependsOn).
 */
export const FAMILY = { id: 'oficina', label: 'Oficina', room: 'oficina', dependsOn: ['almacenaje_cuerpo', 'electrodomesticos_partes'] };

const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'oficina-malla-negra': { texture: 'tejido', color: '#2a2c2e', swatch: '#2a2c2e', name: 'Malla negra', material: 'Malla técnica' },
  'oficina-malla-gris': { texture: 'tejido', color: '#7d8083', swatch: '#7d8083', name: 'Malla gris', material: 'Malla técnica' },
  'oficina-chapa-gris': flat('paint', '#8f9694', .42, 'Chapa lacada gris', 'Metal lacado', { metallic: .35 }),
  'oficina-chapa-blanca': flat('paint', '#e9e8e4', .38, 'Chapa lacada blanca', 'Metal lacado', { metallic: .2 }),
  'oficina-carton': flat('paint', '#b48b5e', .85, 'Cartón kraft', 'Cartón'),
  'oficina-archivador-azul': flat('paint', '#2f4b6e', .55, 'Archivador azul', 'Polipropileno'),
  'oficina-archivador-gris': flat('paint', '#5f6366', .55, 'Archivador gris', 'Polipropileno'),
  'oficina-papel': flat('paint', '#f3f1ea', .9, 'Papel', 'Papel'),
};

const GADGET = { carcasa: 'elec-plastico-negro', pantalla: 'elec-pantalla', mandos: 'elec-aluminio', led: 'elec-indicador' };

export const PRODUCTS = [
  {
    product: 'silla_oficina', type: 'office_chair', label: 'Silla de oficina giratoria con ruedas', profile: 'chair', style: 'Contemporáneo',
    mainSlot: 'tapiceria', textureSize: 512,
    finishes: { tapiceria: 'oficina-malla-negra', estructura: 'elec-plastico-negro', metal: 'elec-aluminio', ruedas: 'elec-goma' },
    variants: [
      { key: 'negra', size: '65 × 65 cm', dims: [650, 650, 1100], proposal: true },
      { key: 'gris', size: '65 × 65 cm', dims: [650, 650, 1100], finishes: { tapiceria: 'oficina-malla-gris' } },
    ],
  },
  {
    product: 'cajonera_oficina', type: 'pedestal', label: 'Cajonera de oficina con ruedas', profile: 'cabinet', style: 'Industrial',
    mainSlot: 'cuerpo', textureSize: 512,
    params: { grid: ['C C*2 C*2'], base: 'ninguno', fronts: 'sobre', handle: 'unero' },
    finishes: { cuerpo: 'oficina-chapa-gris', tirador: 'elec-aluminio', patas: 'elec-goma', metal: 'cromo' },
    variants: [
      { key: 'gris', size: '42 × 55 cm', dims: [420, 550, 600], proposal: true },
      { key: 'blanca', size: '42 × 55 cm', dims: [420, 550, 600], finishes: { cuerpo: 'oficina-chapa-blanca' } },
    ],
  },
  {
    product: 'estanteria_oficina', type: 'office_shelf', label: 'Estantería de oficina de metal y roble', profile: 'shelf', style: 'Industrial',
    mainSlot: 'estructura',
    finishes: { estructura: 'metal-negro', madera: 'roble', carton: 'oficina-carton', archivador: 'oficina-archivador-azul',
      archivador2: 'oficina-archivador-gris', papel: 'oficina-papel' },
    variants: [{ key: '120', size: '120 × 35 cm', dims: [1200, 350, 1800], proposal: true }],
  },
  {
    product: 'monitor', type: 'monitor', label: 'Monitor de 27 pulgadas con pie', profile: 'screen', style: 'Contemporáneo',
    mainSlot: 'carcasa', textureSize: 512, finishes: GADGET,
    variants: [{ key: '27', size: '27 pulgadas', dims: [600, 200, 450], proposal: true }],
  },
  {
    product: 'lampara_escritorio', type: 'desk_lamp', label: 'Lámpara de escritorio articulada', profile: 'lamp', style: 'Industrial', room: 'iluminacion',
    mainSlot: 'metal', textureSize: 512, finishes: { metal: 'metal-negro', articulacion: 'laton', bombilla: 'textil-plastico' },
    variants: [{ key: 'negra', size: '25 × 25 × 50 cm', dims: [250, 250, 500], proposal: true }],
  },
  {
    product: 'portatil', type: 'laptop', label: 'Ordenador portátil', profile: 'screen', style: 'Contemporáneo',
    mainSlot: 'carcasa', textureSize: 512,
    finishes: { carcasa: 'elec-aluminio', teclas: 'elec-plastico-negro', pantalla: 'elec-pantalla', marco: 'elec-plastico-negro' },
    variants: [{ key: '15', size: '15 pulgadas', dims: [350, 250, 250], proposal: true }],
  },
];
