'use server';

import { z } from 'zod';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { designVideoSources } from './design-video-sources';
import { propertyVisitEntries } from '@/lib/editor-document/property-visit-entries';
import { planPropertyVisit } from '@/lib/editor-document/property-visit-plan';
import { propertyVisitReferenceCoverage, type PropertyVisitReference } from '@/lib/editor-document/property-visit-references';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { LIGHTING_PRESETS } from '@/lib/lighting-preset';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { propertyVisitDocument } from '@/lib/editor-document/property-visit-document';

const inputSchema = z.object({ approvalId: z.string().min(1).max(200).optional(),
  entryId: z.string().min(1).max(200).optional(), lighting: z.enum(LIGHTING_PRESETS).default('daylight'),
  openDoors: z.boolean().default(true) }).strict();

/** Preparación gratuita y de solo lectura. No guarda en el plano, no acepta diseños ni llama a proveedores. */
export async function inspectPropertyVisit(rawScope: EditorScope, rawInput: z.input<typeof inputSchema> = {}) {
  const scope = normalizeEditorScope(rawScope), input = inputSchema.parse(rawInput), ctx = await requireOrgContext();
  const repo = withEditorDocuments(ctx), approvals = await repo.listApprovals(scope);
  const sources = await designVideoSources(ctx, scope, input.approvalId);
  const approved = sources.approved;
  if (!approved) throw new Error('Revisa una versión del proyecto antes de preparar su recorrido.');
  const scene = propertyVisitDocument(approved.document, input.openDoors);
  const plan = planPropertyVisit(scene.document, input.entryId);
  const entries = propertyVisitEntries(scene.document);
  const levels = buildingDocuments(scene.document);
  const navigation = new Map(levels.map(level => [level.id, walkthroughNavigation(level.document)]));
  const references: PropertyVisitReference[] = sources.rows.flatMap(row => {
    const reference = sources.references.find(item => item.id === row.id);
    const view = renderViewSchema.safeParse(row.payload.generation?.view);
    if (reference?.issue || !view.success || !reference?.lighting || view.data.preset !== 'custom' || view.data.allLevels ||
      view.data.cutaway || view.data.ceilingView !== 'solid' || view.data.cutawayWallIds?.length || view.data.cutawayObjectIds?.length) return [];
    try {
      const camera = cameraPoseFromView(view.data), nav = navigation.get(camera.levelId ?? 'ground');
      if (!nav) return [];
      const at = { x: camera.position[0] * 1000, y: camera.position[2] * 1000 };
      const height = camera.position[1] * 1000 - nav.floorAt(at);
      if (height < 900 || height > 2200) return [];
      return [{ id: row.id, camera, lighting: reference.lighting, batchId: reference.batchId }];
    }
    catch { return []; }
  });
  const coverage = propertyVisitReferenceCoverage(plan, scene.openedDoorIds.length ? [] : references, input.lighting);
  const mapLevel = levels.find(level => level.id === plan.entry?.levelId) ?? levels[0]!;
  return { approvalId: approved.id, revision: approved.revision, approvals, entries, plan, references: coverage,
    lighting: input.lighting, openDoors: input.openDoors, openedDoorIds: scene.openedDoorIds,
    anchors: sources.references.filter(reference => !reference.issue && reference.lighting === input.lighting &&
      (reference.preset === 'top' || reference.closedRoof)),
    acceptedViews: references.filter(reference => reference.lighting === input.lighting).length,
    map: { rooms: deriveRooms(mapLevel.document).map(room => ({ id: room.id, boundary: room.boundary })),
      levelId: mapLevel.id, entries: entries.filter(entry => entry.levelId === mapLevel.id) },
    generationIssue: 'Guarda el paseo para generar sus encuadres, aceptar las imágenes y continuar con los tramos enlazados.' };
}
