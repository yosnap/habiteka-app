import registry from '../../../public/models/habiteka/catalog.json';
import type { FurnitureCatalogEntry, FurnitureProfile, FurnitureRoom } from './furniture-catalog';
import { withProductRoom } from './furniture-rooms';

/**
 * Muebles propios de Habiteka generados por la fábrica de Blender (scripts/build-furniture-factory.mjs). El registro
 * public/models/habiteka/catalog.json lo escribe la fábrica con todas sus familias; aquí se convierte en entradas del
 * catálogo y en modelos 3D. La procedencia completa está en public/models/habiteka/manifest/<familia>.json.
 */
export const HABITEKA_MODEL_PREFIX = 'habiteka:model:';
export const HABITEKA_MODEL_AUTHOR = 'Habiteka (modelo propio)';
export const HABITEKA_MODEL_LICENSE = 'LicenseRef-Habiteka';

export interface HabitekaRegistryEntry {
  id: string; productId: string; family: string; label: string; variantLabel: string; room: FurnitureRoom;
  profile: FurnitureProfile; style: string; material: string; color: string; widthMm: number; depthMm: number;
  heightMm: number; file: string; thumbnail: string; sha256: string; proposal: boolean; smaller?: string;
  /** Cota del hueco bajo una pieza colgada (lavabo suspendido, espejo); sin ella la pieza va al suelo. */
  elevationMm?: number;
  /** Estado de una cortina o persiana (medida y cobertura) que elige window-dressing-models.ts: no entra en el catálogo. */
  hidden?: boolean;
  /** Cota desde el suelo de la encimera o del borde de un lavabo o fregadero; el grifo queda por encima. */
  counterMm?: number;
}

function checkedRegistry(value: unknown): HabitekaRegistryEntry[] {
  if (!Array.isArray(value)) throw new Error('El registro de muebles propios no es una lista');
  for (const entry of value as Partial<HabitekaRegistryEntry>[]) {
    const valid = typeof entry.id === 'string' && /^[a-z0-9_]+$/.test(entry.id) && typeof entry.productId === 'string'
      && typeof entry.label === 'string' && typeof entry.variantLabel === 'string' && typeof entry.file === 'string'
      && typeof entry.thumbnail === 'string' && typeof entry.sha256 === 'string' && typeof entry.proposal === 'boolean'
      && [entry.widthMm, entry.depthMm, entry.heightMm].every((size) => typeof size === 'number' && size > 0)
      && (entry.elevationMm === undefined || (typeof entry.elevationMm === 'number' && entry.elevationMm >= 0))
      && (entry.hidden === undefined || typeof entry.hidden === 'boolean')
      && (entry.counterMm === undefined || (typeof entry.counterMm === 'number' && entry.counterMm > 0));
    if (!valid) throw new Error(`Entrada no válida en el registro de muebles propios: ${JSON.stringify(entry).slice(0, 120)}`);
  }
  return value as HabitekaRegistryEntry[];
}

export const HABITEKA_REGISTRY: readonly HabitekaRegistryEntry[] = checkedRegistry(registry);

/** Entrada del catálogo de una pieza del registro (`dims` visibles; la elevación sale de la geometría medida). */
export function catalogEntryFromRegistry(entry: HabitekaRegistryEntry): FurnitureCatalogEntry {
  return {
    id: `${HABITEKA_MODEL_PREFIX}${entry.id}`, productId: entry.productId, variantLabel: entry.variantLabel, kind: `model-${entry.id}`,
    label: entry.label, room: entry.room, category: entry.profile, profile: entry.profile, function: entry.label, style: entry.style,
    material: entry.material, color: entry.color, widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm,
    elevationMm: entry.elevationMm ?? 0,
    // La sección dibuja lavabos y fregaderos hasta su borde, medido desde la base de la pieza (sin el grifo).
    ...(entry.counterMm ? { counterHeightMm: entry.counterMm - (entry.elevationMm ?? 0) } : {}),
  };
}

/** Con la estancia que corresponde a cada producto (el zapatero al recibidor, la lavadora al lavadero). */
export const HABITEKA_FURNITURE_CATALOG: FurnitureCatalogEntry[] = HABITEKA_REGISTRY.filter((entry) => !entry.hidden)
  .map((entry) => withProductRoom(catalogEntryFromRegistry(entry)));

/** Modelo 3D de cada pieza con la misma forma que los modelos CC0 (furniture-assets.ts). Ya llega con el frente en +Z. */
const isVehicle = (id: string) => /^(turismo_|vehiculo_|furgoneta_)/.test(id);
const assetVersion = (entry: HabitekaRegistryEntry) => isVehicle(entry.id) || entry.id === 'porche_entrada_exterior' ? `?v=${entry.sha256.slice(0, 12)}` : '';
export const HABITEKA_MODEL_ASSETS = HABITEKA_REGISTRY.map((entry) => [`${HABITEKA_MODEL_PREFIX}${entry.id}`, {
  key: entry.id, url: `/models/habiteka/${entry.file}${assetVersion(entry)}`, frontRotation: 0, file: entry.file, kind: entry.id,
  source: 'Fábrica de muebles de Habiteka (Blender, scripts/build-furniture-factory.mjs)', author: HABITEKA_MODEL_AUTHOR,
  license: HABITEKA_MODEL_LICENSE, attributionRequired: false, sha256: entry.sha256,
  // Los estados de cortinas y persianas salen casi blancos y se tiñen con el color de su pieza: su foto se renderiza
  // con ese color (la de la fábrica sería blanca). Solo tela y lamas lacadas; barras, cordones y madera no.
  ...(entry.hidden && entry.family === 'textiles' ? { tintMaterialNames: ['tela', 'lamas'] } : { thumbnailUrl: `/models/habiteka/${entry.thumbnail}${assetVersion(entry)}` }),
  // Una planta pintada cambia el color de la maceta, no el de las hojas ni el de la tierra.
  ...(entry.profile === 'plant' ? { tintMaterialNames: ['maceta'] } : {}),
  // El cristal de la placa puede teñirse sin borrar la serigrafía ni pintar el marco metálico.
  ...(entry.id.startsWith('vitroceramica_') ? { tintMaterialNames: ['vidrio'] } : {}),
  ...(entry.family === 'equipamiento' ? { tintMaterialNames: isVehicle(entry.id) ? ['pintura'] : entry.id === 'porche_entrada_exterior' ? ['blanco'] : ['pintura', 'metal', 'tela'] } : {}),
}] as const);

const proposalIds = new Set(HABITEKA_REGISTRY.filter((entry) => entry.proposal).map((entry) => `${HABITEKA_MODEL_PREFIX}${entry.id}`));

/**
 * Amueblar ve una sola variante por producto (la marcada en la especificación) para no inflar su lista: los colores
 * no cambian la distribución y las demás medidas se prueban con HABITEKA_SMALLER cuando la elegida no cabe.
 */
export function listedForProposal(entry: Pick<FurnitureCatalogEntry, 'id'>): boolean {
  return !entry.id.startsWith(HABITEKA_MODEL_PREFIX) || proposalIds.has(entry.id);
}

/** Variante inmediatamente más estrecha del mismo producto y acabado (calculada por la fábrica a partir de la especificación). */
export const HABITEKA_SMALLER: Readonly<Record<string, string>> = Object.fromEntries(HABITEKA_REGISTRY
  .filter((entry) => entry.smaller && !entry.hidden).map((entry) => [`${HABITEKA_MODEL_PREFIX}${entry.id}`, `${HABITEKA_MODEL_PREFIX}${entry.smaller}`]));
