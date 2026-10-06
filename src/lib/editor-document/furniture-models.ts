import type { Furniture } from './schema';
import { furnitureAsset, ORIGINAL_ASSET_COLOR, REALISTIC_ASSET_REPLACEMENTS } from './furniture-assets';
import { isPainted } from './furniture-profiles';
import { furnitureSpatial } from './spatial-properties';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { windowDressingModelId } from './window-dressing-models';
import { gardenModelId } from './garden-models';

/**
 * Modelo realista (CC0) con que se ve en el plano y en 3D una pieza del catálogo hecha por código: la cama, el sofá o la
 * mesilla que coloca Amueblar dejan de ser cajas. Solo es apariencia: medidas, holguras, choques y el plano que se envía
 * a la IA siguen saliendo de la pieza del catálogo, y el modelo se escala a sus medidas. Solo se asigna donde la forma
 * casa sin deformarse: los muebles propios llevan una variante a la medida exacta de su pieza; lo que no tiene modelo
 * a su medida (horno de pie, cajonera de oficina…) sigue con sus volúmenes.
 */
const CATALOG_MODELS: Readonly<Record<string, string>> = {
  // Sofás, butacas, camas, mesas y sillas usan los muebles propios de la fábrica (mismas proporciones y acabado).
  'habiteka:furniture:sofa-2': 'habiteka:model:sofa_nordico_2p',
  'habiteka:furniture:sofa-3': 'habiteka:model:sofa_moderno_3p',
  'habiteka:furniture:sofa-3:piel': 'habiteka:model:sofa_capitone_3p',
  'habiteka:furniture:butaca': 'habiteka:model:butaca_tapizada_mostaza',
  'habiteka:furniture:mesa-centro': 'mesa_centro_moderna',
  'habiteka:furniture:mesa-auxiliar': 'mesilla_estantes',
  'habiteka:furniture:mueble-tv': 'habiteka:model:mueble_tv_roble_160',
  'habiteka:furniture:libreria': 'habiteka:model:libreria_alta_roble_100',
  'habiteka:furniture:televisor': 'tv',
  'habiteka:furniture:cama-doble': 'habiteka:model:cama_madera_160',
  'habiteka:furniture:cama-doble:king': 'habiteka:model:cama_tapizada_180',
  'habiteka:furniture:cama-individual': 'habiteka:model:cama_madera_90',
  // Almacenaje de la fábrica (families/almacenaje.mjs), a la medida de cada pieza por código.
  'habiteka:furniture:mesita': 'habiteka:model:mesilla_roble_45',
  'habiteka:furniture:armario': 'habiteka:model:armario_nordico_2p_120',
  'habiteka:furniture:armario:grande': 'habiteka:model:armario_roble_3p_180',
  'habiteka:furniture:comoda': 'habiteka:model:comoda_roble_100',
  'habiteka:furniture:aparador': 'habiteka:model:aparador_nogal_150',
  'habiteka:furniture:vitrina': 'habiteka:model:vitrina_metal_90',
  'habiteka:furniture:zapatero': 'habiteka:model:zapatero_abatible_roble_80',
  'habiteka:furniture:mueble-columna': 'habiteka:model:armario_nordico_columna_50',
  'habiteka:furniture:mesa-comedor': 'habiteka:model:mesa_comedor_roble_160',
  'habiteka:furniture:mesa-comedor:grande': 'habiteka:model:mesa_comedor_nogal_180',
  'habiteka:furniture:mesa-cocina': 'habiteka:model:mesa_extensible_cerrada',
  'habiteka:furniture:silla-comedor': 'habiteka:model:silla_nordica_roble',
  'habiteka:furniture:taburete': 'taburete_barra_metal',
  // Muebles propios (fábrica de Blender) donde la forma casa con la pieza por código.
  'habiteka:furniture:banco-comedor': 'habiteka:model:banco_madera_140',
  'habiteka:furniture:banco-pie-cama': 'habiteka:model:banco_tapizado_120',
  'habiteka:furniture:silla-jardin': 'habiteka:model:silla_cuerda_teca',
  'habiteka:furniture:sofa-exterior': 'habiteka:model:sofa_ratan_3p',
  'habiteka:furniture:chaise-longue': 'habiteka:model:sofa_chaise_derecha_3p',
  'habiteka:furniture:sofa-cama': 'habiteka:model:sofa_cama_cerrado',
  'habiteka:furniture:sofa-cama:abierto': 'habiteka:model:sofa_cama_abierto',
  // Frigorífico por código de 70 cm de ancho: combi XL de la fábrica a su medida.
  'habiteka:furniture:frigorifico': 'habiteka:model:frigorifico_combi_inox_70x190',
  // Electrodomésticos de la fábrica (families/electrodomesticos.mjs), a la medida de cada pieza por código.
  'habiteka:furniture:lavadora': 'habiteka:model:lavadora_blanca',
  'habiteka:furniture:secadora': 'habiteka:model:secadora_blanca_60x60',
  'habiteka:furniture:lavavajillas': 'habiteka:model:lavavajillas_60_inox',
  // El lavabo sigue con el modelo CC0: los de la fábrica llevan grifo (1045 mm) y la pieza mide 850 mm hasta la
  // encimera, que es la altura que dibuja la sección que guía los renders.
  'habiteka:furniture:lavabo': 'lavabo',
  // Baño de la fábrica (families/bano.mjs), a la medida de cada pieza por código.
  'habiteka:furniture:inodoro': 'habiteka:model:inodoro_cisterna_blanco',
  'habiteka:furniture:banera': 'habiteka:model:banera_empotrada_170x75_repisa',
  'habiteka:furniture:banera-compacta': 'habiteka:model:banera_empotrada_140_repisa',
  'habiteka:furniture:ducha': 'habiteka:model:plato_ducha_90x90',
  'habiteka:furniture:columna-bano': 'habiteka:model:columna_bano_suelo_blanca',
  'habiteka:furniture:escritorio': 'escritorio_metalico',
  'habiteka:furniture:lampara-pie': 'lampara',
  'habiteka:furniture:lampara-mesa': 'lampara_mesa_industrial',
  // Planta propia (fábrica, familia plantas): ficus lyrata de 120 cm en maceta de barro, con las proporciones de la pieza.
  'habiteka:furniture:planta': 'habiteka:model:ficus_lyrata_120',
  // Alfombras CC0 generadas a su tamaño (scripts/build-cc0-rugs.mjs): lana lisa y yute para la variante grande.
  'habiteka:furniture:alfombra': 'alfombra_lana_beige_160x230',
  'habiteka:furniture:alfombra:grande': 'alfombra_yute_200x300',
};

/** Clave de un modelo CC0 (habiteka:asset:<clave>) o id completo de un mueble propio (habiteka:model:<pieza>). */
const asset = (key: string) => furnitureAsset({ catalogId: key.includes(':') ? key : `habiteka:asset:${key}` });

/**
 * Modelo 3D con que se ve la pieza: el suyo (o su equivalente realista), el estado de cortina o persiana que
 * corresponde a su medida y cobertura, o el asignado a su pieza del catálogo.
 */
export function furnitureModel(item: Pick<Furniture, 'catalogId'> & Partial<Pick<Furniture, 'widthMm' | 'heightMm' | 'coverage' | 'rolledSides'>>) {
  const garden = gardenModelId(item);
  if (garden) { const model = asset(garden); if (model) return model; }
  const own = furnitureAsset(item);
  if (own) return REALISTIC_ASSET_REPLACEMENTS[own.key] ? asset(REALISTIC_ASSET_REPLACEMENTS[own.key]!) ?? own : own;
  const key = windowDressingModelId(item) ?? (item.catalogId ? CATALOG_MODELS[item.catalogId] : undefined);
  return key ? asset(key) : undefined;
}

/** Color con que se tiñe el modelo: solo el que el usuario ha pintado; el de catálogo deja el modelo con sus texturas. */
export function modelTint(item: Furniture): string | undefined {
  // Cortinas y persianas: la tela y las lamas lacadas del modelo salen casi blancas y toman siempre el color de la pieza.
  if (windowDressingModelId(item)) return item.color ?? getFurnitureCatalogEntry(item.catalogId)?.color;
  // El color neutro por defecto de los modelos no es una pintura, aunque lo lleve una pieza del catálogo.
  const color = furnitureAsset(item) ? furnitureSpatial(item).color : item.color;
  if (!color || color === ORIGINAL_ASSET_COLOR) return undefined;
  return furnitureAsset(item) || isPainted(item) ? color : undefined;
}
