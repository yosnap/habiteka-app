/** Elementos propios de exterior: modelos de catálogo, conservando las dimensiones editables del editor. */
export const FAMILY = { id: 'equipamiento', label: 'Equipamiento exterior', room: 'exterior', dependsOn: ['equipamiento_agua', 'equipamiento_vehiculos', 'vehiculos_carroceria', 'vehiculos_detalles'] };
const flat = (kind, color, roughness, name, extra = {}) => ({ kind, color, swatch: color, roughness, name, material: name, ...extra });
export const FINISHES = {
  'ext-metal': flat('metal', '#394349', .32, 'Acero lacado', { metallic: .65 }),
  'ext-inox': flat('metal', '#bec7c9', .22, 'Acero inoxidable'),
  'ext-goma': flat('paint', '#171b1d', .9, 'Caucho'),
  'ext-vidrio': flat('glass', '#b8d2dd', .08, 'Vidrio'),
  'ext-cristal-coche': flat('paint', '#182c38', .12, 'Cristal tintado', { metallic: .4, coat: 1 }),
  'veh-cristal': flat('paint', '#101a22', .08, 'Vidrio tintado de automóvil', { metallic: .15, coat: 1 }),
  'veh-goma': flat('paint', '#151619', .88, 'Goma de neumático'),
  'veh-freno': flat('metal', '#737a7c', .42, 'Disco de freno', { metallic: .8 }),
  'veh-espejo': flat('metal', '#cbd6dd', .04, 'Espejo retrovisor'),
  'veh-led': flat('paint', '#f0f4f8', .15, 'Guía óptica blanca'),
  'veh-led-rojo': flat('paint', '#e83228', .12, 'Guía óptica roja', { coat: 1 }),
  'veh-plata': flat('metal', '#9aa5af', .26, 'Plata metalizado', { metallic: .7, coat: 1 }),
  'veh-azul': flat('metal', '#344d6a', .24, 'Azul metalizado', { metallic: .65, coat: 1 }),
  'veh-gris': flat('metal', '#6a7379', .28, 'Gris metalizado', { metallic: .7, coat: 1 }),
  'veh-blanco': flat('paint', '#d5d7d4', .30, 'Blanco de carrocería', { coat: 1 }),
  'ext-agua': flat('glass', '#53a4b4', .12, 'Agua'),
  'ext-faro': flat('paint', '#e5eff3', .12, 'Difusor'),
  'ext-piloto': flat('paint', '#9d1c1b', .16, 'Piloto rojo', { coat: .7 }),
  'ext-pintura': flat('paint', '#66818c', .2, 'Pintura metalizada', { metallic: .65, coat: 1 }),
  'ext-blanco': flat('paint', '#e9e7df', .3, 'Lacado blanco', { coat: .4 }),
};
const finishes = { madera: 'teca', metal: 'ext-metal', inox: 'ext-inox', goma: 'ext-goma',
  tela: 'tejido-exterior-crudo', vidrio: 'ext-vidrio', agua: 'ext-agua', piedra: 'jar-piedra-clara',
  pintura: 'ext-pintura', faro: 'ext-faro', piloto: 'ext-piloto', blanco: 'ext-blanco' };
const rows = [
  ['porche_entrada', 'porch', 'Porche de entrada con cuatro columnas', 3000, 2000, 2700],
  ['pergola_madera', 'pergola', 'Pérgola de madera', 3000, 3000, 2500],
  ['pergola_aluminio', 'pergola', 'Pérgola de aluminio', 3000, 3000, 2500, { metal: true }],
  ['carpa_jardin', 'tent', 'Carpa con laterales transparentes', 3000, 3000, 2800],
  ...['left', 'right', 'both'].map((rolled) => [`carpa_${rolled}`, 'tent', 'Carpa con laterales recogidos', 3000, 3000, 2800, { rolled }]),
  ['toldo_terraza', 'awning', 'Toldo de terraza', 3500, 2500, 2600],
  ['sombrilla_jardin', 'umbrella', 'Sombrilla de jardín', 2500, 2500, 2400],
  ['barbacoa_gas', 'grill', 'Barbacoa de gas con parrilla', 1400, 700, 1150],
  ['barbacoa_obra', 'grill', 'Barbacoa de obra', 1400, 700, 1600, { masonry: true }],
  ['piscina_elevada', 'pool', 'Piscina elevada con escalera', 6000, 3000, 1500],
  ['estanque_jardin', 'pond', 'Estanque ornamental', 2500, 1800, 350],
  ['fuente_jardin', 'fountain', 'Fuente de jardín', 1400, 1400, 1300],
  ['aspersor_riego', 'sprinkler', 'Aspersor de superficie', 160, 160, 150],
  ['aspersor_emergente', 'sprinkler', 'Aspersor emergente', 100, 100, 100, { popup: true }],
  ['turismo_compacto', 'car', 'Coche compacto', 1750, 4000, 1450, { vehicle: 'compact' }],
  ['turismo_berlina', 'car', 'Berlina', 1800, 4600, 1500, { vehicle: 'saloon' }],
  ['vehiculo_suv', 'car', 'SUV', 1900, 4700, 1750, { vehicle: 'suv' }],
  ['furgoneta', 'car', 'Furgoneta', 2000, 5200, 2300, { vehicle: 'van' }],
];
export const PRODUCTS = rows.map(([product, type, label, w, d, h, params = {}]) => ({
  product, type, label, profile: 'decor', style: 'Contemporáneo', hidden: true, mainSlot: type === 'car' ? 'pintura' : 'madera',
  finishes: type === 'car' ? { ...finishes, vidrio: 'veh-cristal', goma: 'veh-goma', freno: 'veh-freno', espejo: 'veh-espejo',
    led: 'veh-led', 'led-rojo': 'veh-led-rojo', pintura: ({ compact: 'veh-plata', saloon: 'veh-azul', suv: 'veh-gris', van: 'veh-blanco' })[params.vehicle] } : finishes, params,
  variants: [{ key: 'exterior', size: `${w/1000} × ${d/1000} m`, dims: [w,d,h], proposal: true }],
}));
