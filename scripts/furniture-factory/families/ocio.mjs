/** Exterior, parque e instalaciones; la piscina enterrada representa solo su parte visible sobre el terreno. */
export const FAMILY = { id: 'ocio', label: 'Exterior, parque e instalaciones', room: 'exterior',
  dependsOn: ['ocio_instalaciones', 'equipamiento', 'equipamiento_agua', 'equipamiento_vehiculos', 'vehiculos_carroceria', 'vehiculos_detalles'] };
const flat = (color, name, roughness = .5, extra = {}) => ({ kind: 'paint', color, swatch: color, name, material: name, roughness, ...extra });
export const FINISHES = {
  'ocio-asfalto': flat('#35383a', 'Asfalto', .95),
  'ocio-agua': flat('#3babc7', 'Agua azul', .12, { coat: .8 }),
  'ocio-azul': flat('#35759b', 'Azul', .4),
  'ocio-rojo': flat('#b64338', 'Rojo', .4),
};
const finishes = { madera: 'teca', metal: 'ext-metal', inox: 'ext-inox', tela: 'tejido-exterior-crudo',
  piedra: 'jar-piedra-clara', blanco: 'ext-blanco', agua: 'ocio-agua', pintura: 'ocio-azul',
  rojo: 'ocio-rojo', asfalto: 'ocio-asfalto', goma: 'ext-goma', vidrio: 'ext-vidrio' };
const product = (name, type, label, profile, dims, params = {}, room = 'exterior') => ({
  product: name, type, label, profile, room, style: 'Contemporáneo', finishes, params,
  variants: [{ key: 'base', size: `${dims[0] / 1000} × ${dims[1] / 1000} m`, dims, proposal: true }],
});
export const PRODUCTS = [
  product('alfombra_yute_rectangular', 'rug', 'Alfombra tejida rectangular', 'rug', [2000, 3000, 12], {}, 'decoracion'),
  product('alfombra_yute_redonda', 'rug', 'Alfombra tejida redonda', 'rug', [1800, 1800, 12], { round: true }, 'decoracion'),
  product('hamaca_soporte_madera', 'hammock', 'Hamaca con soporte de madera', 'sofa', [1200, 3200, 1400]),
  product('hamaca_soporte_metal', 'hammock', 'Hamaca con soporte metálico', 'sofa', [1100, 3000, 1300], { metal: true }),
  product('piscina_redonda_elevada', 'pool', 'Piscina redonda elevada', 'decor', [4000, 4000, 1200], { round: true }),
  product('piscina_enterrada_rectangular', 'pool', 'Piscina enterrada rectangular', 'decor', [6000, 3000, 90], { buried: true }),
  product('piscina_enterrada_redonda', 'pool', 'Piscina enterrada redonda', 'decor', [4000, 4000, 90], { buried: true, round: true }),
  product('sombrilla_grande', 'umbrella', 'Sombrilla grande de terraza', 'decor', [3500, 3500, 2700]),
  product('sombrilla_compacta', 'umbrella', 'Sombrilla compacta de jardín', 'decor', [2000, 2000, 2300]),
  product('toldo_balcon', 'awning', 'Toldo compacto de balcón', 'decor', [2400, 1800, 2500]),
  product('barbacoa_compacta', 'grill', 'Barbacoa compacta de gas', 'decor', [900, 600, 1100]),
  product('barbacoa_obra_grande', 'grill', 'Barbacoa grande de obra', 'decor', [1800, 800, 1600], { masonry: true }),
  product('calle_doble_sentido', 'street', 'Calle de doble sentido con aceras', 'rug', [6000, 4000, 80]),
  product('acera_modular', 'sidewalk', 'Acera modular', 'rug', [1500, 3000, 120]),
  product('tobogan_parque', 'slide', 'Tobogán de parque con escalera', 'decor', [1000, 3000, 2100]),
  product('columpio_parque_simple', 'swing', 'Columpio de parque individual', 'decor', [2400, 1800, 2300], { seats: 1 }),
  product('columpio_parque_doble', 'swing', 'Columpio de parque doble', 'decor', [3600, 1800, 2300], { seats: 2 }),
  product('banco_parque', 'park_bench', 'Banco de parque de madera y metal', 'bench', [1600, 650, 850]),
  product('papelera_parque', 'bin', 'Papelera de parque', 'decor', [450, 450, 800]),
  product('farola_parque', 'streetlight', 'Farola de parque', 'lamp', [500, 500, 3200]),
  product('guirnalda_luces', 'lights', 'Guirnalda de luces colgantes', 'lamp', [3000, 160, 450], { elev: 2200 }, 'iluminacion'),
  product('lampara_colgante_cocina', 'pendant', 'Lámpara colgante de cocina', 'lamp', [350, 350, 700], { elev: 2000 }, 'iluminacion'),
  product('aire_acondicionado_split', 'ac', 'Aire acondicionado de pared', 'appliance', [900, 230, 300], { elev: 2100 }, 'salon'),
  product('aire_acondicionado_exterior', 'ac', 'Unidad exterior de aire acondicionado', 'appliance', [800, 350, 600], { outdoor: true }),
];
