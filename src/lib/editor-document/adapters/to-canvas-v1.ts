import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { emptyCanvasDoc, type CanvasDoc, type StructKind } from '@/canvas/types';
import type { EditorDocument } from '../schema';
import { wallPoints } from '../geometry';
import { assertEditorDocument } from '../validation';

/** Downgrade explícito: rechaza características que el lector anterior no representa. */
export function toCanvasV1(doc: EditorDocument): CanvasDoc {
  assertEditorDocument(doc);
  if (doc.schemaVersion >= 3)
    throw new Error('Canvas legacy no representa propiedades constructivas v3 sin pérdida');
  if (doc.dimensions.length || doc.openings.some((o) => o.kind === 'hueco')) {
    throw new Error('Canvas legacy no representa cotas o huecos de paso sin pérdida');
  }
  const factor = doc.calibration?.mmPerPixel;
  if (!factor) throw new Error('Falta escala para convertir a píxeles');
  const output = emptyCanvasDoc();
  output.scale = { pxPerMeter: 1000 / factor };
  // The existing 2D renderer consumes objects, not walls. Emit one authority only.
  output.version = 1;
  delete output.walls;
  output.objects = doc.walls.map((w) => {
    const [a, b] = wallPoints(doc, w);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    return { id: w.id, kind: 'wall',
      x: (a.x + Math.sin(angle) * w.thicknessMm / 2) / factor,
      y: (a.y - Math.cos(angle) * w.thicknessMm / 2) / factor,
      width: Math.hypot(b.x - a.x, b.y - a.y) / factor,
      height: w.thicknessMm / factor, rotation: angle * 180 / Math.PI };
  });
  output.objects.push(...doc.furniture.map((f) => {
    if (!Object.hasOwn(CATALOG_BY_KIND, f.kind)) throw new Error(`Mueble no representable: ${f.kind}`);
    return { id: f.id, kind: f.kind as StructKind, x: f.x / factor, y: f.y / factor,
      width: f.widthMm / factor, height: f.depthMm / factor, rotation: f.rotation,
      ...(f.catalogId ? { catalogId: f.catalogId } : {}) };
  }));
  for (const o of doc.openings) {
    const w = doc.walls.find((wall) => wall.id === o.wallId)!;
    const [a, b] = wallPoints(doc, w);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const center = { x: a.x + (b.x - a.x) * o.position, y: a.y + (b.y - a.y) * o.position };
    output.objects.push({ id: o.id, parentId: o.wallId, kind: o.kind === 'puerta' ? 'door' : 'window',
      x: (center.x - Math.cos(angle) * o.widthMm / 2 + Math.sin(angle) * w.thicknessMm / 2) / factor,
      y: (center.y - Math.sin(angle) * o.widthMm / 2 - Math.cos(angle) * w.thicknessMm / 2) / factor,
      width: o.widthMm / factor, height: w.thicknessMm / factor, rotation: angle * 180 / Math.PI });
  }
  output.notes = doc.labels.map((l) => ({ id: l.id, text: l.text, x: l.x / factor, y: l.y / factor }));
  return output;
}
