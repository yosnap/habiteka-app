import type { EditorDocument, Furniture } from './schema';

export type KitchenSlotKind = 'fregadero' | 'vitroceramica' | 'lavavajillas' | 'lavadora' | 'horno' | 'frigorifico-columna';
export const KITCHEN_SLOT_KINDS: readonly KitchenSlotKind[] = ['fregadero', 'vitroceramica', 'lavavajillas', 'lavadora', 'horno', 'frigorifico-columna'];
/** Aparato encajado en el tramo: se sitúa por su centro a lo largo del mueble y recorta lo que le corresponde. */
export interface KitchenSlot {
  id: string;
  kind: KitchenSlotKind;
  positionMm: number;
  widthMm: number;
  color: string;
}
/** Módulos altos colgados sobre la encimera; la cota inferior se mide desde el suelo del tramo. */
export interface KitchenUppers {
  bottomMm: number;
  heightMm: number;
  depthMm: number;
  color: string;
  materialId?: string;
}
export interface KitchenComposition {
  plinthHeightMm: number;
  plinthColor: string;
  worktopThicknessMm: number;
  worktopColor: string;
  worktopMaterialId?: string;
  baseMaterialId?: string;
  /** Ritmo de puertas y cajones; el último módulo absorbe el resto del tramo. */
  moduleWidthMm: number;
  uppers?: KitchenUppers;
  slots: KitchenSlot[];
}
export const KITCHEN_RUN_KIND = 'cocina-lineal';
export const KITCHEN_RUN_CATALOG_ID = 'habiteka:kitchen:run';
export const KITCHEN_RUN_LABEL = 'Cocina lineal';
/**
 * Mueble de cocina trazado como una pared: el origen es el extremo inicial de la línea trasera, x recorre el tramo
 * y el cuerpo ocupa el fondo hacia +y. `heightMm` es la cota de la cara superior de la encimera.
 */
export interface KitchenRun extends Furniture {
  kind: typeof KITCHEN_RUN_KIND;
  catalogId: typeof KITCHEN_RUN_CATALOG_ID;
  heightMm: number;
  elevationMm: number;
  /** Color de frentes y carcasa de los módulos bajos. */
  color: string;
  kitchen: KitchenComposition;
}
export function isKitchenRun(item: Furniture): item is KitchenRun { return 'kitchen' in item; }
export const KITCHEN_SLOT_DEFAULTS: Record<KitchenSlotKind, { label: string; widthMm: number; color: string }> = {
  fregadero: { label: 'Fregadero', widthMm: 800, color: '#b8c0bd' },
  vitroceramica: { label: 'Vitrocerámica', widthMm: 600, color: '#1f2426' },
  lavavajillas: { label: 'Lavavajillas', widthMm: 600, color: '#b1b7b8' },
  lavadora: { label: 'Lavadora', widthMm: 600, color: '#bcc5c7' },
  horno: { label: 'Horno', widthMm: 600, color: '#747f82' },
  'frigorifico-columna': { label: 'Frigorífico columna', widthMm: 700, color: '#aeb7b8' },
};
export function kitchenRunDefaults(item: Pick<Furniture, 'id' | 'x' | 'y' | 'widthMm' | 'rotation'> & Partial<Furniture>): KitchenRun {
  return { ...item, kind: KITCHEN_RUN_KIND, catalogId: KITCHEN_RUN_CATALOG_ID, dimensionalOrigin: item.dimensionalOrigin ?? 'physical',
    depthMm: item.depthMm ?? 600, heightMm: item.heightMm ?? 900, elevationMm: item.elevationMm ?? 0, color: item.color ?? '#d9d5cb',
    kitchen: { plinthHeightMm: 100, plinthColor: '#4a4d4b', worktopThicknessMm: 30, worktopColor: '#e0dbcf', moduleWidthMm: 600, slots: [] } };
}
export function kitchenSlotOwner(doc: EditorDocument, id: string | undefined) {
  for (const run of doc.kitchenRuns ?? []) {
    const slot = run.kitchen.slots.find((s) => s.id === id);
    if (slot) return { run, slot };
  }
  return undefined;
}
