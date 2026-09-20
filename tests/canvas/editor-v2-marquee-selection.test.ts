import { describe, expect, it } from 'vitest';
import { selectEntitiesInRectangle, selectableEntityIds } from '@/canvas/editor-v2/marquee-selection';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

function documentWithElements() {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
  doc = addOpening(doc, doc.walls[0]!.id, { x: 3500, y: 0 }, 'puerta');
  doc.furniture = [{ id: 'chair', kind: 'chair', x: 1200, y: 600, widthMm: 700, depthMm: 700, rotation: 0, dimensionalOrigin: 'physical' }];
  doc.stairs = [{ id: 'stairs', kind: 'straight', catalogId: 'stairs', x: 2600, y: 600, widthMm: 1000, depthMm: 1800,
    heightMm: 1000, elevationMm: 0, rotation: 0, stepCount: 8, materialId: 'oak-natural' }];
  doc.ramps = [{ id: 'ramp', catalogId: 'ramp', x: 4000, y: 600, widthMm: 800, depthMm: 2000,
    riseMm: 500, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' }];
  doc.labels = [{ id: 'label', x: 100, y: 1200, text: 'Entrada' }];
  doc.dimensions = [{ id: 'dimension', from: { x: 0, y: -500 }, to: { x: 5000, y: -500 } }];
  return doc;
}

describe('marquee selection', () => {
  it('selects every deletable element fully contained in either drag direction', () => {
    const doc = documentWithElements(), expected = selectableEntityIds(doc).sort();
    expect(selectEntitiesInRectangle(doc, { x: -1000, y: -1000 }, { x: 7000, y: 4000 }).sort()).toEqual(expected);
    expect(selectEntitiesInRectangle(doc, { x: 7000, y: 4000 }, { x: -1000, y: -1000 }).sort()).toEqual(expected);
  });

  it('does not select an element that only crosses the selection boundary', () => {
    const doc = documentWithElements();
    expect(selectEntitiesInRectangle(doc, { x: 1100, y: 500 }, { x: 2000, y: 1400 })).toEqual(['chair']);
  });
});
