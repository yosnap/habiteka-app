import type { CameraPose } from '@/lib/contracts/walkthrough-keyframe';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { isInteriorRenderMode, renderDesignOptionsSchema, zoneCompositeActive, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { roomInteriorCameras, selectedInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { zoneCaptureRegions } from '@/lib/editor-document/zone-capture-regions';
import { renderScopeRegions } from '@/lib/editor-document/render-scope-regions';
import { assertRenderViewIntegrity } from '@/lib/editor-document/render-view-integrity';

/** Capturas consecutivas sobre una única revisión; cualquier edición invalida el lote completo. */
export async function prepareRenderCaptures(input: {
  options: RenderDesignOptions; capture: CaptureRenderView; document: EditorDocument;
  snapshot: string; currentSnapshot: () => string; keyframeCamera?: CameraPose | null;
}): Promise<RenderCapture[]> {
  const options = renderDesignOptionsSchema.parse(input.options);
  const masked = zoneCompositeActive(options);
  const zoneMask = masked ? { maskRegions: zoneCaptureRegions(input.document, renderScopeRegions(input.document, options)) } : {};
  const captures: RenderCapture[] = [];
  const assertUnchanged = () => {
    if (input.snapshot !== input.currentSnapshot())
      throw new Error('El plano cambió durante la preparación. Vuelve a preparar las vistas.');
  };
  if (isInteriorRenderMode(options)) {
    const rooms = selectedInteriorCameras(roomInteriorCameras(input.document), options.interiorRoomIds);
    if (!rooms.length || rooms.length !== options.interiorRoomIds.length)
      throw new Error('Elige estancias que sigan teniendo muros cerrados.');
    for (const room of rooms) {
      assertUnchanged();
      captures.push(await input.capture({ lighting: options.lighting, camera: room.camera, ...zoneMask }));
      assertUnchanged();
      assertRenderViewIntegrity(input.document, captures.at(-1)!.view);
    }
    return captures;
  }
  // Las referencias se generan antes de las vistas que las requieren: la cenital antes que laterales, isométrica y
  // exterior; la isométrica antes que el dron.
  const rank = (view: string) => ['front', 'back', 'left', 'right', 'isometric', 'exterior'].includes(view) ? 1
    : view === 'drone' ? 2 : 0;
  for (const view of [...options.views].sort((a, b) => rank(a) - rank(b))) {
    assertUnchanged();
    captures.push(await input.capture({ view, lighting: options.lighting, fit: view !== 'current' || masked, ...zoneMask,
      ...(input.keyframeCamera && view === 'current' && !masked ? { camera: input.keyframeCamera } : {}) }));
    assertUnchanged();
    assertRenderViewIntegrity(input.document, captures.at(-1)!.view);
  }
  return captures.sort((a, b) => rank(a.view.preset) - rank(b.view.preset));
}
