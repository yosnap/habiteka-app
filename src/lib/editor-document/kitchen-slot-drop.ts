import type { EditorDocument, Furniture, Point } from './schema';
import type { KitchenSlotKind } from './kitchen-run-types';
import { worldToLocal } from './spatial-properties';

/** Aparato del catálogo que tiene equivalente como hueco del mueble de cocina. */
export function slotKindFor(item: Pick<Furniture, 'kind'>): KitchenSlotKind | undefined {
  const kind = item.kind.toLowerCase();
  if (/fregadero/.test(kind)) return 'fregadero';
  if (/vitro|fogones/.test(kind)) return 'vitroceramica';
  if (/lavavajillas/.test(kind)) return 'lavavajillas';
  if (/lavadora/.test(kind)) return 'lavadora';
  if (/horno/.test(kind)) return 'horno';
  if (/frigor|nevera/.test(kind)) return 'frigorifico-columna';
  return undefined;
}
/** Un aparato soltado sobre un tramo de cocina se encaja en él en vez de quedar como mueble suelto. */
export function kitchenSlotDrop(doc: EditorDocument, item: Pick<Furniture, 'kind'>, pointer: Point): { runId: string; kind: KitchenSlotKind; positionMm: number } | null {
  const kind = slotKindFor(item);
  if (!kind) return null;
  for (const run of doc.kitchenRuns ?? []) {
    const local = worldToLocal(run, pointer);
    if (local.x >= 0 && local.x <= run.widthMm && local.y >= 0 && local.y <= run.depthMm) return { runId: run.id, kind, positionMm: local.x };
  }
  return null;
}
