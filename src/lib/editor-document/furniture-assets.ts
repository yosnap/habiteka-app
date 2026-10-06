import manifest from '../../../public/models/cc0/manifest.json';
import { HABITEKA_MODEL_ASSETS } from './habiteka-furniture';
import type { Furniture } from './schema';
import type { FurnitureCatalogEntry, FurnitureProfile, FurnitureRoom } from './furniture-catalog';

export const ORIGINAL_ASSET_COLOR = '#8ea69b';
/** Clave, nombre, estancia, perfil, ancho, fondo, alto y, opcionalmente, cota de apoyo (mm). */
type AssetDefinition = [string, string, FurnitureRoom, FurnitureProfile, number, number, number, number?];
/**
 * Alfombras realistas generadas con scripts/build-cc0-rugs.mjs a partir de texturas CC0 (ambientCG y Poly Haven):
 * diseño, nombre y tamaños en cm (fondo × ancho; el lado largo va en X). Losas de 10 mm pegadas al suelo.
 */
const RUG_SIZES_CM = [[140, 200], [160, 230], [200, 300]] as const;
const RUG_DESIGNS: readonly (readonly [string, string])[] = [
  ['lana_beige', 'Alfombra lisa de lana beige'], ['gris', 'Alfombra lisa gris'], ['pelo_largo', 'Alfombra de pelo largo crudo'],
  ['bereber', 'Alfombra bereber de rombos'], ['kilim', 'Kilim de rombos terracota'], ['geometrica', 'Alfombra geométrica beige'],
  ['yute', 'Alfombra de yute natural'], ['rayas', 'Alfombra de rayas crudo y carbón'],
];
const rugDefinitions: AssetDefinition[] = [
  ...RUG_DESIGNS.flatMap(([design, label]) => RUG_SIZES_CM.map(([depth, width]): AssetDefinition =>
    [`alfombra_${design}_${depth}x${width}`, `${label} · ${depth} × ${width} cm`, 'decoracion', 'rug', width * 10, depth * 10, 10])),
  ['alfombra_redonda_yute_160', 'Alfombra redonda de yute · Ø 160 cm', 'decoracion', 'rug', 1600, 1600, 10],
  ['alfombra_redonda_pelo_200', 'Alfombra redonda de pelo largo · Ø 200 cm', 'decoracion', 'rug', 2000, 2000, 10],
];
/** Filenames are historical. Labels describe the actual model, not old placeholder aliases. */
const definitions: AssetDefinition[] = [
  ['silla', 'Silla Sheen', 'comedor', 'chair', 600, 600, 850],
  ['sofa', 'Sofá Glam Velvet', 'salon', 'sofa', 2000, 900, 850],
  ['cama', 'Cama doble', 'dormitorio', 'bed', 1500, 2000, 800],
  ['armario', 'Armario', 'dormitorio', 'cabinet', 1200, 600, 2000],
  ['mesa', 'Mesa redonda pequeña', 'comedor', 'table', 800, 800, 750],
  ['nevera', 'Frigorífico', 'cocina', 'appliance', 700, 700, 1800],
  ['horno', 'Horno', 'cocina', 'appliance', 600, 600, 900],
  ['fregadero', 'Fregadero', 'cocina', 'sink', 800, 600, 900],
  ['inodoro', 'Inodoro', 'bano', 'toilet', 400, 700, 800],
  ['lavabo', 'Lavabo', 'bano', 'sink', 600, 450, 850],
  ['ducha', 'Cabina de ducha curva', 'bano', 'shower', 900, 900, 2000],
  ['tv', 'Pantalla de televisión', 'salon', 'screen', 1200, 100, 700],
  ['planta', 'Planta con maceta', 'decoracion', 'plant', 450, 450, 1000],
  ['microondas', 'Microondas', 'cocina', 'appliance', 550, 380, 350],
  ['banera', 'Bañera', 'bano', 'bath', 1700, 750, 600],
  ['mesilla', 'Mesita de noche', 'dormitorio', 'cabinet', 450, 400, 500],
  ['vitroceramica', 'Cocina con fogones', 'cocina', 'appliance', 600, 600, 900],
  ['encimera', 'Mueble bajo de cocina', 'cocina', 'kitchen', 1200, 600, 900],
  ['estanteria', 'Estantería de madera', 'salon', 'shelf', 1000, 300, 1800],
  ['lampara', 'Lámpara de pie', 'iluminacion', 'lamp', 400, 400, 1500],
  ['chimenea', 'Chimenea', 'salon', 'cabinet', 1200, 400, 1200],
  ['ordenador', 'Ordenador portátil', 'oficina', 'screen', 350, 250, 250],
  ['alfombra', 'Alfombra redonda', 'decoracion', 'rug', 1600, 1600, 10],
  ['isla', 'Mesa con base en cruz', 'comedor', 'table', 1000, 1000, 750],
  ['bidet', 'Contenedor de baño', 'bano', 'cabinet', 350, 350, 500],
  ['nevera_americana', 'Frigorífico grande', 'cocina', 'appliance', 900, 800, 1800],
  ['nevera_mini', 'Minifrigorífico', 'cocina', 'appliance', 500, 550, 850],
  ['sofa_grande', 'Sofá grande', 'salon', 'sofa', 2800, 1000, 850],
  ['butaca', 'Butaca', 'salon', 'sofa', 900, 900, 850],
  ['sillon_moderno', 'Sillón de madera y piel', 'salon', 'chair', 820, 990, 1020],
  ['mesa_centro_moderna', 'Mesa de centro de piedra y madera', 'salon', 'table', 1200, 600, 390],
  ['silla_comedor_piel', 'Silla de comedor de piel', 'comedor', 'chair', 450, 580, 980],
  ['mesa_comedor_mantel', 'Mesa de comedor con mantel', 'comedor', 'table', 2256, 1390, 877],
  ['mesa_comedor_madera', 'Mesa de comedor de madera', 'comedor', 'table', 1600, 900, 800],
  ['jarron_ceramica', 'Jarrón de cerámica', 'decoracion', 'decor', 220, 220, 309],
  ['cama_hotel', 'Cama king tapizada', 'dormitorio', 'bed', 2020, 2204, 1422],
  // Poly Haven (CC0), importados con scripts/import-polyhaven-models.mjs: medidas de la caja real del GLB.
  ['taburete_barra_madera', 'Taburete de barra de madera', 'cocina', 'chair', 483, 486, 751],
  ['taburete_barra_metal', 'Taburete de barra de metal', 'cocina', 'chair', 352, 355, 883],
  ['taburete_barra_respaldo', 'Taburete de barra con respaldo', 'cocina', 'chair', 461, 471, 1023],
  ['mesilla_madera_cajon', 'Mesilla de noche con cajón', 'dormitorio', 'cabinet', 505, 509, 616],
  ['mesilla_estantes', 'Mesilla con dos estantes', 'dormitorio', 'cabinet', 550, 450, 551],
  ['velador_alto', 'Mesa auxiliar alta (velador)', 'salon', 'table', 384, 384, 761],
  ['cajonera_baja_madera', 'Cajonera baja de madera', 'dormitorio', 'cabinet', 858, 457, 545],
  ['lampara_mesa_industrial', 'Lámpara de mesa industrial', 'iluminacion', 'lamp', 183, 262, 364],
  ['flexo_articulado', 'Lámpara de escritorio articulada (flexo)', 'iluminacion', 'lamp', 202, 614, 893, 750],
  ['cajonera_alta_industrial', 'Cajonera alta con estantes', 'salon', 'cabinet', 1141, 488, 1881],
  ['aparador_bajo_moderno', 'Aparador bajo moderno (mueble de TV)', 'salon', 'cabinet', 2440, 520, 680],
  ['aparador_vitrina_clasico', 'Aparador con vitrina clásico', 'comedor', 'cabinet', 2022, 670, 2235],
  ['comoda_clasica', 'Cómoda clásica de cajones', 'dormitorio', 'cabinet', 1201, 581, 1212],
  ['aparador_industrial', 'Aparador industrial de madera', 'comedor', 'cabinet', 1327, 575, 830],
  ['sofa_chester_piel', 'Sofá Chester de piel', 'salon', 'sofa', 1807, 818, 710],
  ['sofa_clasico_tapizado', 'Sofá clásico tapizado de tres plazas', 'salon', 'sofa', 2731, 925, 1118],
  ['sillon_giratorio_piel', 'Sillón giratorio de piel', 'salon', 'sofa', 1009, 1190, 1169],
  ['butaca_clasica', 'Butaca clásica tapizada', 'salon', 'sofa', 848, 766, 1065],
  ['puf_piel', 'Puf de piel', 'salon', 'bench', 885, 621, 624],
  ['mesa_centro_redonda', 'Mesa de centro redonda', 'salon', 'table', 1301, 1301, 491],
  ['mesa_centro_cuadrada', 'Mesa de centro cuadrada', 'salon', 'table', 1199, 1200, 369],
  ['mesa_alta_redonda', 'Mesa alta redonda de pie central', 'cocina', 'table', 1399, 1399, 1005],
  ['mesa_redonda_pequena', 'Mesa redonda pequeña con pedestal', 'comedor', 'table', 796, 796, 746],
  ['mesa_alta_rustica', 'Mesa alta rústica de madera pintada', 'cocina', 'table', 2406, 1137, 959],
  ['silla_comedor_blanca', 'Silla de comedor de madera blanca', 'comedor', 'chair', 432, 540, 956],
  ['cama_doble_tallada', 'Cama doble de madera tallada', 'dormitorio', 'bed', 1494, 2040, 1534],
  ['cama_individual_hierro', 'Cama individual de hierro (sin colchón)', 'dormitorio', 'bed', 905, 2002, 1201],
  ['estanteria_cubos', 'Estantería de cubos de madera', 'salon', 'shelf', 1078, 371, 1556],
  ['estanteria_acero_madera', 'Estantería grande de acero y madera', 'salon', 'shelf', 2351, 721, 2312],
  ['escritorio_metalico', 'Escritorio metálico con cajones', 'oficina', 'table', 2000, 947, 787],
  ['cocina_electrica_horno', 'Cocina eléctrica con horno', 'cocina', 'appliance', 503, 648, 859],
  ['planta_maceta_barro', 'Planta en maceta de barro', 'decoracion', 'plant', 701, 657, 841],
  ['aloe_maceta', 'Aloe en maceta pequeña', 'decoracion', 'plant', 168, 185, 267],
  ...rugDefinitions,
];
export const ASSET_CATALOG: FurnitureCatalogEntry[] = definitions.map(([key, label, room, profile, widthMm, depthMm, heightMm, elevationMm = 0]) => ({
  id: `habiteka:asset:${key}`, productId: `asset-${key}`, variantLabel: 'Original', kind: `asset-${key}`,
  label, room, category: profile, profile, function: label, style: 'Modelo original', material: 'Materiales del modelo',
  color: ORIGINAL_ASSET_COLOR, widthMm, depthMm, heightMm, elevationMm,
}));
interface ModelAsset {
  key: string;
  url: string;
  frontRotation: number;
  tintMaterialNames?: string[];
  file: string;
  kind: string;
  source: string;
  author: string;
  license: string;
  attributionRequired: boolean;
  sha256: string;
  thumbnailUrl?: string;
}
const assets = new Map<string, ModelAsset>(definitions.map(([key]) => {
  const provenance = manifest.assets.find((item) => item.kind === key)!;
  if (!provenance) throw new Error(`Falta procedencia del modelo ${key}`);
  return [`habiteka:asset:${key}` as string, { key, ...provenance, url: `/models/cc0/${provenance.file}`,
    // Fixed facing direction: resizing never changes orientation automatically. Los modelos importados con el
    // script de Poly Haven ya llegan con el frente hacia +Z.
    frontRotation: key === 'cama' ? Math.PI : key === 'armario' ? -Math.PI / 2
      : key === 'mesa_centro_moderna' ? Math.PI / 2 : 0,
  }] as const;
}));
// Muebles propios de la fábrica de Blender: mismo contrato que los modelos CC0, con su foto de producto como miniatura.
for (const [catalogId, asset] of HABITEKA_MODEL_ASSETS) assets.set(catalogId, asset);
/**
 * Modelos antiguos de estilo plano (Poly Pizza) con equivalente realista: en planta y en 3D se ven con el realista
 * (Poly Haven o alfombra CC0), porque con colores planos el plano parecía un borrador. El catálogo ya no los ofrece
 * (duplicaban al realista), pero los documentos que los usan siguen abriéndose igual. El valor es la clave de un
 * modelo CC0 o el id completo de un mueble propio (habiteka:model:<pieza>), de la misma medida que el antiguo.
 */
export const REALISTIC_ASSET_REPLACEMENTS: Readonly<Record<string, string>> = {
  cama: 'cama_hotel', mesa: 'mesa_redonda_pequena', mesilla: 'mesilla_madera_cajon', estanteria: 'estanteria_cubos',
  planta: 'planta_maceta_barro', butaca: 'sillon_moderno', sofa_grande: 'sofa_clasico_tapizado',
  alfombra: 'alfombra_redonda_yute_160',
  armario: 'habiteka:model:armario_nordico_2p_120x200', microondas: 'habiteka:model:microondas_inox_32l',
  nevera_americana: 'habiteka:model:frigorifico_americano_inox_90x80', nevera: 'habiteka:model:frigorifico_combi_inox_70x180',
};
const carProvenance = manifest.assets.find((entry) => entry.kind === 'coche');
if (!carProvenance) throw new Error('Falta procedencia del modelo de coche');
assets.set('habiteka:outdoor:coche:turismo-3d', {
  ...carProvenance, key: 'coche', url: `/models/cc0/${carProvenance.file}`,
  frontRotation: Math.PI, tintMaterialNames: ['paintB'],
});
export function furnitureAsset(item: Pick<Furniture, 'catalogId'>) {
  return item.catalogId ? assets.get(item.catalogId) : undefined;
}
