/**
 * Texturas CC0 y acabados de la fábrica de muebles.
 *
 * TEXTURES: mapas PBR (color, normal y rugosidad) de Poly Haven o ambientCG, ambos CC0 1.0. `tileMm` solo se usa
 * cuando la fuente no publica el tamaño real de la muestra. `normal` es la intensidad del mapa de normales (1 por defecto). `grainU` indica que la veta corre en horizontal en la
 * imagen. `scaleMm` fuerza otra escala que la publicada (el rizo del bouclé se usa a 150 mm para que parezca bucle fino).
 * `tint` permite teñir el mapa de color (se pasa a gris y se lleva al color del acabado). `alpha` marca un atlas con
 * transparencia (hojas de ambientCG con dataType 'Atlas' o texturas de hojas de un modelo de Poly Haven): el color llega
 * a Blender como PNG RGBA con la opacidad en el canal alfa. `px` fija el tamaño máximo de los mapas.
 *
 * FINISHES: acabados con nombre que usan las especificaciones. Los de textura indican su color de muestra (`swatch`)
 * para el catálogo; los lisos (metal, laca, polipropileno, vidrio) se definen con valores PBR.
 */
export const TEXTURES = {
  lino: { source: 'polyhaven', id: 'rough_linen', tileMm: 270, tint: true },
  boucle: { source: 'polyhaven', id: 'curly_teddy_natural', tileMm: 336, scaleMm: 150, tint: true },
  terciopelo: { source: 'polyhaven', id: 'velour_velvet', tileMm: 284, tint: true },
  tejido: { source: 'ambientcg', id: 'Fabric062', tileMm: 400, tint: true },
  espiga: { source: 'polyhaven', id: 'poly_wool_herringbone', tileMm: 270, tint: true },
  algodon: { source: 'polyhaven', id: 'cotton_jersey', tileMm: 264, tint: true },
  punto: { source: 'polyhaven', id: 'knitted_fleece', tileMm: 266, tint: true },
  piel_conac: { source: 'polyhaven', id: 'fabric_leather_02', tileMm: 500, normal: .8 },
  piel_marron: { source: 'polyhaven', id: 'brown_leather', tileMm: 400, normal: .8 },
  piel: { source: 'polyhaven', id: 'leather_white', tileMm: 300, normal: .8, tint: true },
  roble: { source: 'polyhaven', id: 'oak_veneer_01', tileMm: 1830, normal: .6 },
  fresno: { source: 'polyhaven', id: 'ash_veneer', tileMm: 1000, normal: .6, grainU: true },
  nogal: { source: 'polyhaven', id: 'natural_walnut_veneer', tileMm: 1000, normal: .6, grainU: true, tint: true },
  teca: { source: 'polyhaven', id: 'teak_veneer', tileMm: 1000, normal: .6, grainU: true },
  marmol_blanco: { source: 'ambientcg', id: 'Marble021', tileMm: 1000, normal: .35 },
  marmol_negro: { source: 'ambientcg', id: 'Marble009', tileMm: 1000, normal: .35 },
  marmol_crema: { source: 'ambientcg', id: 'Marble014', tileMm: 1000, normal: .35 },
  ratan_oscuro: { source: 'ambientcg', id: 'Wicker006', tileMm: 400, scaleMm: 260 },
  ratan_natural: { source: 'ambientcg', id: 'Wicker013', tileMm: 500 },
  ratan_trenzado: { source: 'ambientcg', id: 'Wicker002', tileMm: 300, tint: true },
  cuerda: { source: 'ambientcg', id: 'Rope001', tileMm: 160, tint: true },
};

const fabric = (texture, color, name, material, extra = {}) => ({ texture, color, swatch: color, name, material, ...extra });
const natural = (texture, swatch, name, material, extra = {}) => ({ texture, swatch, name, material, ...extra });
const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'lino-gris': fabric('lino', '#9b978f', 'Lino gris', 'Lino'),
  'lino-arena': fabric('lino', '#c6b69c', 'Lino arena', 'Lino'),
  'lino-blanco': fabric('lino', '#ece8df', 'Lino blanco', 'Lino'),
  'lino-salvia': fabric('lino', '#a3ad98', 'Lino salvia', 'Lino'),
  'tejido-antracita': fabric('tejido', '#57595a', 'Tejido antracita', 'Tejido'),
  'tejido-beige': fabric('tejido', '#cbbda6', 'Tejido beige', 'Tejido'),
  'tejido-azul': fabric('tejido', '#536a80', 'Tejido azul', 'Tejido'),
  'tejido-exterior-crudo': fabric('tejido', '#ddd6c8', 'Tejido de exterior crudo', 'Tejido de exterior'),
  'tejido-exterior-gris': fabric('tejido', '#a7a6a1', 'Tejido de exterior gris', 'Tejido de exterior'),
  'espiga-gris': fabric('espiga', '#8e8c88', 'Espiga gris', 'Tejido de lana'),
  'boucle-crudo': fabric('boucle', '#e7e0d3', 'Bouclé crudo', 'Bouclé'),
  'boucle-arena': fabric('boucle', '#cdbca3', 'Bouclé arena', 'Bouclé'),
  'terciopelo-verde': fabric('terciopelo', '#3f594b', 'Terciopelo verde', 'Terciopelo', { sheen: .7 }),
  'terciopelo-azul': fabric('terciopelo', '#2f4661', 'Terciopelo azul', 'Terciopelo', { sheen: .7 }),
  'terciopelo-mostaza': fabric('terciopelo', '#b88a33', 'Terciopelo mostaza', 'Terciopelo', { sheen: .7 }),
  'terciopelo-rosa': fabric('terciopelo', '#c79c93', 'Terciopelo rosa empolvado', 'Terciopelo', { sheen: .7 }),
  'piel-conac': natural('piel_conac', '#9a5b2e', 'Piel coñac', 'Piel', { roughness: .45 }),
  'piel-marron': natural('piel_marron', '#4f3020', 'Piel marrón', 'Piel'),
  'piel-negra': fabric('piel', '#2d2a28', 'Piel negra', 'Piel'),
  'algodon-blanco': fabric('algodon', '#efede8', 'Algodón blanco', 'Algodón'),
  'algodon-gris': fabric('algodon', '#c4c2bd', 'Algodón gris perla', 'Algodón'),
  'algodon-arena': fabric('algodon', '#d9cdb9', 'Algodón arena', 'Algodón'),
  'punto-mostaza': fabric('punto', '#b98b3c', 'Punto mostaza', 'Punto de lana'),
  'punto-terracota': fabric('punto', '#a8644a', 'Punto terracota', 'Punto de lana'),
  'punto-gris': fabric('punto', '#7c7d7c', 'Punto gris', 'Punto de lana'),
  'punto-salvia': fabric('punto', '#8d9a84', 'Punto salvia', 'Punto de lana'),
  roble: natural('roble', '#b88d5e', 'Roble', 'Roble'),
  fresno: natural('fresno', '#c9ab86', 'Fresno', 'Fresno'),
  nogal: { ...natural('nogal', '#6a4a35', 'Nogal', 'Nogal'), color: '#6a4a35' },
  'roble-negro': { ...natural('roble', '#2c2825', 'Roble teñido negro', 'Roble'), texture: 'nogal', color: '#2c2825' },
  teca: natural('teca', '#a77649', 'Teca', 'Teca'),
  'marmol-blanco': natural('marmol_blanco', '#ece9e4', 'Mármol blanco', 'Mármol', { roughness: .25, coat: .4 }),
  'marmol-negro': natural('marmol_negro', '#1f2322', 'Mármol negro', 'Mármol', { roughness: .25, coat: .4 }),
  'marmol-crema': natural('marmol_crema', '#d9cdb8', 'Mármol crema', 'Mármol', { roughness: .25, coat: .4 }),
  'ratan-oscuro': natural('ratan_oscuro', '#4a3326', 'Ratán sintético moca', 'Ratán sintético'),
  'ratan-natural': natural('ratan_natural', '#c49a5a', 'Ratán natural', 'Ratán'),
  'ratan-gris': fabric('ratan_trenzado', '#8f8a82', 'Ratán sintético gris', 'Ratán sintético'),
  'cuerda-beige': fabric('cuerda', '#c8b593', 'Cuerda beige', 'Cuerda'),
  'cuerda-gris': fabric('cuerda', '#8f8e88', 'Cuerda gris', 'Cuerda'),
  'metal-negro': flat('metal', '#1d1d1d', .42, 'Metal negro', 'Metal', { metallic: .85 }),
  laton: flat('metal', '#c9a35e', .28, 'Latón', 'Latón', { metallic: 1 }),
  cromo: flat('metal', '#dcdcdc', .12, 'Acero cromado', 'Acero', { metallic: 1 }),
  'forja-negra': flat('metal', '#232220', .55, 'Forja negra', 'Hierro forjado', { metallic: .7 }),
  'aluminio-antracita': flat('paint', '#3b3d3f', .5, 'Aluminio antracita', 'Aluminio'),
  'aluminio-blanco': flat('paint', '#e6e4df', .45, 'Aluminio blanco', 'Aluminio'),
  'lacado-blanco': flat('paint', '#ebe8e1', .35, 'Lacado blanco', 'Madera lacada', { coat: .25 }),
  'lacado-verde': flat('paint', '#5f7564', .4, 'Lacado verde', 'Metal lacado'),
  'polipropileno-blanco': flat('paint', '#e8e7e3', .45, 'Polipropileno blanco', 'Polipropileno'),
  'polipropileno-antracita': flat('paint', '#3c3e40', .45, 'Polipropileno antracita', 'Polipropileno'),
  'polipropileno-salvia': flat('paint', '#9aa58f', .45, 'Polipropileno salvia', 'Polipropileno'),
  cristal: flat('glass', '#eef3f0', .02, 'Cristal templado', 'Cristal'),
};
