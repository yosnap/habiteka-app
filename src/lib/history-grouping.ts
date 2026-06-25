/**
 * Agrupa los diseños de un proyecto por su imagen de origen para la galería de
 * historial. Lógica pura (sin IO) para poder testearla aislada.
 *
 * Reglas:
 *  - Cada imagen de origen forma un grupo, aunque aún no haya producido diseños
 *    (subiste pero no generaste).
 *  - Un diseño sin `sourceImageId`, o cuyo origen no se pudo resolver (storage
 *    caído / imagen borrada), cae al grupo "sin imagen de origen" para no perderlo.
 *  - El grupo "sin origen" solo aparece si tiene diseños.
 */

export interface HistoryDeliverableLike {
  sourceImageId: string | null;
}

export interface HistorySourceImageLike {
  id: string;
}

export interface HistoryGroupOf<D> {
  sourceImageId: string | null;
  sourceImageUrl: string | null;
  deliverables: D[];
}

export function groupHistory<D extends HistoryDeliverableLike>(
  sourceImages: HistorySourceImageLike[],
  deliverables: D[],
  urlBySourceImageId: Map<string, string>,
): HistoryGroupOf<D>[] {
  const bySource = new Map<string, D[]>();
  const orphans: D[] = [];
  for (const d of deliverables) {
    // Solo agrupa bajo un origen cuyo URL se resolvió; si no, va a huérfanos.
    if (d.sourceImageId && urlBySourceImageId.has(d.sourceImageId)) {
      const list = bySource.get(d.sourceImageId) ?? [];
      list.push(d);
      bySource.set(d.sourceImageId, list);
    } else {
      orphans.push(d);
    }
  }

  const groups: HistoryGroupOf<D>[] = sourceImages.map((img) => ({
    sourceImageId: img.id,
    sourceImageUrl: urlBySourceImageId.get(img.id) ?? null,
    deliverables: bySource.get(img.id) ?? [],
  }));

  if (orphans.length > 0) {
    groups.push({ sourceImageId: null, sourceImageUrl: null, deliverables: orphans });
  }
  return groups;
}
