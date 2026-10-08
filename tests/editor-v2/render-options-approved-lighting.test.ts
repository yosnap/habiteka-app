/**
 * La luz aprobada es una sugerencia: primera persona conserva la luz de sus imágenes aceptadas.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { RenderOptionsControls } from '@/components/editor-v2/render-options-controls';

function salon() {
  const doc = setDesignSpaceKind(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true), 'casa');
  doc.labels = [{ id: 'salon', text: 'Salón', x: 3000, y: 2000 }];
  return doc;
}

describe('luz de la aprobación al preparar interiores', () => {
  it('avisa si la luz elegida no es la de la aprobación y calla si coincide', () => {
    const document = salon(), interiorRoomIds = roomInteriorCameras(document).map(camera => camera.roomId);
    expect(interiorRoomIds.length).toBeGreaterThan(0);
    const markup = (lighting: 'daylight' | 'warm') => renderToStaticMarkup(createElement(RenderOptionsControls, { document,
      options: { ...defaultRenderDesignOptions(), lighting, interiorRoomIds }, onChange: () => undefined, approvedLighting: 'warm' }));
    expect(markup('daylight')).toContain('La aprobación vigente usa luz de atardecer');
    expect(markup('daylight')).toContain('Usar luz de la aprobación');
    expect(markup('daylight')).toContain('conservará la luz de las imágenes aceptadas');
    expect(markup('daylight')).not.toContain('no sirven para el vídeo');
    expect(markup('warm')).not.toContain('La aprobación vigente usa luz');
  });
});
