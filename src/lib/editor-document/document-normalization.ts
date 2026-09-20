import type { EditorDocument } from './schema';
import { pruneOrphanOutdoorEdges } from './outdoor-prune';
import { joinDanglingWallEnds } from './wall-join';
import { restObjectsOnFloors } from './object-floor-rest';

/**
 * Saneamiento estructural que el editor aplica al cargar y en cada edición: retira restos invisibles de patios,
 * une extremos de muro sueltos que apoyan en la construcción y apoya los muebles en el suelo de su estancia. Nunca toca geometría que ya esté bien.
 */
export function normalizeEditorDocument(doc: EditorDocument, options: { onLoad?: boolean } = {}): EditorDocument {
  // Cada paso puede habilitar al otro (un resto retirado deja cerrar una estancia y viceversa): se itera hasta estabilizar.
  // Al cargar no hay ningún trazado en curso, así que la limpieza puede ser más agresiva con tramos sueltos.
  let current = doc;
  for (let round = 0; round < 4; round++) {
    const next = restObjectsOnFloors(joinDanglingWallEnds(pruneOrphanOutdoorEdges(current, { aggressive: options.onLoad })));
    if (next === current) break;
    current = next;
  }
  return current;
}
