/** Complementos de cocina, decoración y almacenaje; geometría propia, sin marcas. */
export const FAMILY = { id: 'complementos', label: 'Cocina y complementos', room: 'cocina', dependsOn: ['complementos_cocina', 'complementos_almacenaje'] };
const flat = (color, name, roughness = .4, extra = {}) => ({ kind: 'paint', color, swatch: color, name, material: name, roughness, ...extra });
export const FINISHES = {
  'comp-crema': flat('#eee5d6', 'Crema', .3, { coat: .5 }),
  'comp-rojo': flat('#ae3931', 'Rojo', .3, { coat: .5 }),
  'comp-ceramica': flat('#bf9272', 'Cerámica terracota', .55),
  'comp-azul': flat('#47798c', 'Cerámica azul', .3, { coat: .5 }),
  'comp-coco': flat('#92704b', 'Fibra de coco', .95),
  'comp-negro': flat('#24282a', 'Negro', .65),
};
const small = { carcasa: 'comp-crema', metal: 'ext-inox', vidrio: 'ext-vidrio', negro: 'comp-negro' };
const wood = { madera: 'roble', sobre: 'roble', frentes: 'lacado-blanco', metal: 'ext-inox', vidrio: 'ext-vidrio', libro: 'comp-azul', papel: 'comp-crema' };
const product = (name, type, label, profile, dims, params = {}, finishes = small, room = 'cocina') => ({
  product: name, type, label, profile, style: 'Contemporáneo', room, params, finishes,
  variants: [{ key: 'base', size: `${dims[0] / 10} × ${dims[1] / 10} cm`, dims, proposal: true }],
});
export const PRODUCTS = [
  product('batidora_vaso', 'blender', 'Batidora de vaso', 'appliance', [210, 240, 420]),
  product('licuadora', 'juicer', 'Licuadora de frutas', 'appliance', [260, 280, 400]),
  product('robot_cocina', 'processor', 'Robot de cocina multifunción tipo Thermomix', 'appliance', [320, 360, 350]),
  product('batidora_amasadora', 'mixer', 'Batidora amasadora', 'appliance', [250, 390, 350], {}, { ...small, carcasa: 'comp-rojo' }),
  product('microondas_compacto', 'microwave', 'Microondas compacto', 'appliance', [440, 340, 260]),
  product('microondas_retro', 'microwave', 'Microondas retro', 'appliance', [480, 360, 280], {}, { ...small, carcasa: 'comp-rojo' }),
  product('felpudo_coco', 'mat', 'Felpudo de fibra de coco', 'rug', [750, 450, 18], {}, { carcasa: 'comp-coco', negro: 'comp-negro' }, 'recibidor'),
  product('felpudo_goma', 'mat', 'Felpudo de goma con relieve', 'rug', [800, 500, 15], { rubber: true }, { carcasa: 'comp-negro', negro: 'comp-negro' }, 'recibidor'),
  product('florero_ceramica', 'vase', 'Florero de cerámica', 'decor', [180, 180, 320], {}, { carcasa: 'comp-ceramica' }, 'decoracion'),
  product('florero_azul', 'vase', 'Florero azul de cuello estrecho', 'decor', [160, 160, 380], { narrow: true }, { carcasa: 'comp-azul' }, 'decoracion'),
  product('florero_cristal', 'vase', 'Florero de cristal', 'decor', [150, 150, 280], { straight: true }, { carcasa: 'ext-vidrio' }, 'decoracion'),
  ...[600, 900].map(width => product(`armario_alto_cocina_${width}`, 'wall_cabinet', 'Armario superior de cocina', 'cabinet', [width, 350, 700], { doors: width > 600 ? 2 : 1, elev: 1450 }, wood)),
  product('armario_alto_cocina_vitrina', 'wall_cabinet', 'Vitrina superior de cocina', 'cabinet', [800, 350, 700], { doors: 2, glass: true, elev: 1450 }, wood),
  product('armario_alto_cocina_abierto', 'wall_cabinet', 'Módulo superior abierto de cocina', 'shelf', [600, 350, 700], { open: true, elev: 1450 }, wood),
  product('libreria_baja_libros', 'bookcase', 'Librería baja con libros', 'shelf', [1200, 320, 900], { columns: 3, rows: 2 }, wood, 'salon'),
  product('libreria_estrecha', 'bookcase', 'Librería estrecha con libros', 'shelf', [500, 320, 1900], { columns: 1, rows: 5 }, wood, 'oficina'),
  product('estanteria_abierta', 'bookcase', 'Estantería abierta de roble', 'shelf', [1000, 350, 1800], { columns: 2, rows: 5, open: true }, wood, 'salon'),
  product('estante_cocina_pared', 'wall_cabinet', 'Estantería superior abierta de cocina', 'shelf', [1000, 260, 400], { open: true, elev: 1500 }, wood),
];
