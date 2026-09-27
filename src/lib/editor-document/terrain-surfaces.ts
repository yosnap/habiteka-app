import type { EditorDocument, TerrainSurface } from './schema';
import { parseEditorDocument } from './validation';
import { planObjects } from './boundary-types';
import { localToWorld } from './spatial-properties';

/** Un terreno delimita apariencia y encuadre; no modifica la navegación. */
export function addTerrainSurface(source: EditorDocument, surface: TerrainSurface): EditorDocument {
  const next = structuredClone(source);
  next.terrainSurfaces = [...(next.terrainSurfaces ?? []), surface];
  next.revision += 1;
  return parseEditorDocument(next);
}

export function updateTerrainSurface(source: EditorDocument, id: string, patch: Partial<Omit<TerrainSurface, 'id'>>): EditorDocument {
  const next = structuredClone(source), target = next.terrainSurfaces?.find((item) => item.id === id);
  if (!target) throw new Error('No se encuentra el terreno');
  Object.assign(target, patch);
  next.revision += 1;
  return parseEditorDocument(next);
}

/** Una propuesta editable alrededor de la obra, nunca un lindero catastral implícito. */
export function suggestedTerrainSurface(source: EditorDocument, id: string): TerrainSurface {
  const objects = [...planObjects(source), ...(source.stairs ?? []), ...(source.ramps ?? []), ...(source.columns ?? [])];
  const points = [...source.vertices, ...objects.flatMap((item) =>
    [[0, 0], [item.widthMm, 0], [item.widthMm, item.depthMm], [0, item.depthMm]]
      .map(([x, y]) => localToWorld(item, { x: x!, y: y! })))];
  const minX = points.length ? Math.min(...points.map((point) => point.x)) : 0;
  const minY = points.length ? Math.min(...points.map((point) => point.y)) : 0;
  const maxX = points.length ? Math.max(...points.map((point) => point.x)) : 16000;
  const maxY = points.length ? Math.max(...points.map((point) => point.y)) : 16000;
  return { id, name: 'Terreno exterior', x: minX - 2500, y: minY - 2500,
    widthMm: Math.min(200000, Math.max(16000, maxX - minX + 5000)),
    depthMm: Math.min(200000, Math.max(16000, maxY - minY + 5000)),
    texture: 'outdoor:grass-lawn-pbr', color: '#ffffff', tileSizeMm: 1400, rotation: 0 };
}
