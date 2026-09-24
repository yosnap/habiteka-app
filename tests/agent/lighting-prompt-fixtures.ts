/**
 * Plano real con la iluminación completa (foco orientable, foseado en cada
 * estancia, tira bajo módulos altos y escena activa por estancia): el peor caso
 * del prompt compacto, que es donde el presupuesto de caracteres se juega.
 */
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { addLuminaire, setCeilingsForAllRooms } from '@/lib/editor-document/ceiling-commands';
import { addCoveStrip, addFreeStrip, addUnderCabinetStrip } from '@/lib/editor-document/light-strip-commands';
import { applyLightingScene, saveLightingScene } from '@/lib/editor-document/lighting-scene-commands';
import { ceilingSurfaces } from '@/lib/editor-document/ceiling-geometry';
import type { EditorDocument } from '@/lib/editor-document/schema';
import raw from '../editor-document/fixtures/plano-vivienda-real.json';

export const realPlan = setDesignSpaceKind(parseEditorDocument(raw), 'interior');

/**
 * Una estancia puede no admitir un elemento (altura libre, estrechez): la
 * fixture sigue adelante en vez de fallar, porque lo que se mide es el tamaño
 * del prompt del plano completo, no cada colocación.
 */
const attempt = (doc: EditorDocument, step: (input: EditorDocument) => EditorDocument): EditorDocument => {
  try { return step(doc); } catch { return doc; }
};

export interface LitPlanOptions {
  /** Añade además una tira de recorrido propio por estancia: el caso más caro. */
  freeStrips?: boolean;
}

export function litPlan({ freeStrips = false }: LitPlanOptions = {}): EditorDocument {
  let doc = setCeilingsForAllRooms(realPlan, { kind: 'suspended', dropMm: 200 }).document;
  for (const { ceiling, room } of ceilingSurfaces(doc)) {
    doc = attempt(doc, (input) => addCoveStrip(input, ceiling.id));
    doc = attempt(doc, (input) => addLuminaire(input, ceiling.id, 'spot'));
    const [a, b] = room.boundary;
    if (freeStrips && a && b) {
      const x = Math.round((a.x + b.x) / 2), y = Math.round((a.y + b.y) / 2);
      doc = attempt(doc, (input) => addFreeStrip(input, [
        { x, y }, { x: x + 800, y: y + 600 }, { x: x + 1600, y: y + 600 },
      ]));
    }
  }
  for (const run of doc.kitchenRuns ?? []) doc = attempt(doc, (input) => addUnderCabinetStrip(input, run.id));
  for (const { room } of ceilingSurfaces(doc)) {
    const before = doc.lightingScenes?.length ?? 0;
    doc = attempt(doc, (input) => saveLightingScene(input, room.id, 'Cena'));
    const scene = doc.lightingScenes?.[before];
    if (scene) doc = attempt(doc, (input) => applyLightingScene(input, scene.id));
  }
  return doc;
}
