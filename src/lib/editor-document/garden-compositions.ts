import type { EditorDocument, Furniture } from './schema';
import { newId, editDocument } from '@/canvas/editor-v2/editing-operations';
import { suggestedPavingSurface } from './terrain-surfaces';
import { applySurfacePreset } from './outdoor-surface-presets';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
import { upgradeSpatialDocument } from './spatial-properties';

/** Composición inicial de 4 × 3 m. Cada planta y el suelo mantienen su propia selección y medidas. */
export function addMixedGarden(source: EditorDocument): { document: EditorDocument; ids: string[] } {
  const surface = { ...applySurfacePreset(suggestedPavingSurface(source, newId()), 'corteza'), name: 'Jardín variado' };
  const placements: [string, number, number][] = [
    ['arbusto:romero', 350, 300], ['arbusto:lavanda', 1300, 300], ['arbusto:lavanda', 2200, 300],
    ['planta-exterior:graminea', 3150, 350], ['arbusto', 450, 1600],
    ['planta-exterior:graminea', 1750, 1700], ['arbusto:romero', 2900, 1900],
  ];
  const plants: Furniture[] = placements.map(([key, x, y]) => {
    const entry = OUTDOOR_CATALOG.find((item) => item.id === `habiteka:outdoor:${key}`)!;
    return { id: newId(), catalogId: entry.id, kind: entry.kind, x: surface.x+x, y: surface.y+y,
      widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm, color: entry.color,
      rotation: 0, elevationMm: 0, dimensionalOrigin: 'physical' };
  });
  const document = editDocument(upgradeSpatialDocument(source), (next) => {
    next.terrainSurfaces = [...(next.terrainSurfaces ?? []), surface];
    next.furniture.push(...plants);
  });
  return { document, ids: [surface.id, ...plants.map((plant) => plant.id)] };
}
