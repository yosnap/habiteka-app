import { z } from 'zod';
import type { EditorDocument } from './schema';
import type { DesignScope } from './design-scope';
import { designScopeRooms, designScopeZone } from './design-scope';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { polygonContainsFootprint } from './proposal-permissions';
import { footprint } from './spatial-properties';
import { surfaceMaterial } from './surface-materials';

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const material = z.string().refine((id) => Boolean(surfaceMaterial(id)));
export const fixedFinishSchema = z.object({
  id: z.string().min(1).max(200), color,
  label: z.string().max(200).optional(),
  baseMaterialId: material.optional(), worktopMaterialId: material.optional(),
  worktopColor: color.optional(), uppersColor: color.optional(), plinthColor: color.optional(),
});
export type FixedDesignFinish = z.infer<typeof fixedFinishSchema>;

/** Fijos ya modelados, cuya huella completa pertenece al ámbito de la propuesta. */
export function scopedDesignFixtures(doc: EditorDocument, scope: DesignScope) {
  const boundaries = scope.kind === 'zone' ? [designScopeZone(doc, scope).polygon]
    : designScopeRooms(doc, scope).map((room) => room.boundary);
  return [...doc.furniture, ...(doc.kitchenRuns ?? [])].filter((item) => {
    const profile = item.catalogId ? getFurnitureCatalogEntry(item.catalogId)?.profile : undefined;
    const fixed = 'kitchen' in item || (profile && ['kitchen', 'sink', 'toilet', 'bath', 'shower', 'appliance'].includes(profile));
    return fixed && boundaries.some((polygon) => polygonContainsFootprint(polygon, footprint(item)));
  });
}

/** IDs y acabados son verificables; no se admiten cambios de posición, medidas ni instalaciones. */
export function validateFixedFinishes(raw: unknown, doc: EditorDocument, scope: DesignScope, enabled: boolean): FixedDesignFinish[] {
  if (!enabled || !Array.isArray(raw)) return [];
  const targets = new Map(scopedDesignFixtures(doc, scope).map((item) => [item.id, item]));
  const seen = new Set<string>();
  return raw.slice(0, 40).flatMap((value) => {
    const parsed = fixedFinishSchema.safeParse(value);
    if (!parsed.success || seen.has(parsed.data.id)) return [];
    const target = targets.get(parsed.data.id);
    if (!target) return [];
    seen.add(target.id);
    const label = target.name || (target.catalogId ? getFurnitureCatalogEntry(target.catalogId)?.label : undefined) || target.kind;
    return [{ ...('kitchen' in target ? parsed.data : { id: target.id, color: parsed.data.color }), label }];
  });
}

export function applyFixedFinishes(doc: EditorDocument, scope: DesignScope, finishes: FixedDesignFinish[]) {
  for (const finish of validateFixedFinishes(finishes, doc, scope, true)) {
    const item = [...doc.furniture, ...(doc.kitchenRuns ?? [])].find((target) => target.id === finish.id)!;
    item.color = finish.color;
    if ('kitchen' in item) {
      const kitchen = (item as NonNullable<EditorDocument['kitchenRuns']>[number]).kitchen;
      if (finish.baseMaterialId) kitchen.baseMaterialId = finish.baseMaterialId;
      if (finish.worktopMaterialId) kitchen.worktopMaterialId = finish.worktopMaterialId;
      if (finish.worktopColor) kitchen.worktopColor = finish.worktopColor;
      if (finish.plinthColor) kitchen.plinthColor = finish.plinthColor;
      if (finish.uppersColor && kitchen.uppers) kitchen.uppers.color = finish.uppersColor;
    }
  }
}
