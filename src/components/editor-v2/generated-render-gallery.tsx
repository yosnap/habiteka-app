'use client';
import { RenderBatchGallery } from '@/components/deliverables/render-batch-gallery';
import type { DeliverableView } from '@/components/deliverables/deliverables-panel';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import type { RenderGeneratedResult, RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';

/** Misma galería durante la generación y al volver a Diseños. Solo incluye resultados ya guardados. */
export function GeneratedRenderGallery({ results, captures, options, projectId, zoneId, revision }: {
  results: Array<RenderGeneratedResult | undefined>; captures: RenderCapture[];
  options: RenderDesignOptions; projectId: string; zoneId: string | null; revision: number;
}) {
  const items: DeliverableView[] = results.flatMap((result, index) => !result?.id ? [] : [{
    id: result.id, type: 'render3d', version: 1, legalSeal: DELIVERABLE_LEGAL_SEAL, zoneId, sourceImageUrl: null,
    payload: { type: 'render3d', assetUrl: result.assetUrl, generation: {
      ...result.generation, promptVersion: result.generation?.promptVersion ?? 'gallery',
      documentRevision: result.generation?.documentRevision ?? revision,
      options: result.generation?.options ?? options, view: result.generation?.view ?? captures[index]?.view,
    } },
  }]);
  return items.length ? <RenderBatchGallery items={items} projectId={projectId} /> : null;
}
