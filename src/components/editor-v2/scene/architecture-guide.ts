import { DoubleSide, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { isViewCover } from '@/lib/editor-document/view-covers';
import { isPorch } from '@/lib/editor-document/porch-volumes';
import { isBoundaryKind } from '@/lib/editor-document/boundary-types';

/** La maqueta fija arquitectura, nunca el modelo de mobiliario del diseño aceptado. */
export function architectureGuide(scene: Object3D, documents: EditorDocument[]): () => void {
  const furnitureIds = new Set(documents.flatMap(doc => [
    ...doc.furniture.filter(item => !isViewCover(item) && !isPorch(item) && !isBoundaryKind(item.kind)),
    ...(doc.kitchenRuns ?? []),
  ].map(item => item.id)));
  const restore: (() => void)[] = [];
  const glass = new MeshBasicMaterial({ color: '#65b8d4', side: DoubleSide });
  scene.traverse(object => {
    if (furnitureIds.has(object.userData.sourceEntityId) || furnitureIds.has(object.userData.buildKey)) {
      const visible = object.visible;
      object.visible = false;
      restore.push(() => { object.visible = visible; });
    }
    // Cristal inequívoco en la guía, sin tocar la geometría ni inventar travesaños.
    if (object instanceof Mesh && object.userData.roofGlazing) {
      const material = object.material;
      object.material = glass;
      restore.push(() => { object.material = material; });
    }
  });
  return () => { for (const reset of restore) reset(); glass.dispose(); };
}
