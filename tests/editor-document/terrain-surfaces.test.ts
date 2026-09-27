import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addTerrainSurface, suggestedTerrainSurface, updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { deleteEntities } from '@/canvas/editor-v2/editing-operations';

describe('terreno exterior', () => {
  it('guarda medidas y acabado en la misma escena 3D sin abrir zonas caminables', () => {
    const base = emptyEditorDocument(), surface = suggestedTerrainSurface(base, 'terrain-1');
    const saved = addTerrainSurface(base, surface);
    expect(base.terrainSurfaces).toBeUndefined();
    const polygon = editorDocumentToScene(saved).polygons.find((item) => item.sourceEntityId === surface.id);
    expect(polygon).toMatchObject({ role: 'floor', elevation: -.04,
      floorFinish: { texture: 'outdoor:grass-lawn-pbr' } });
    expect(polygon?.points[0]).toEqual({ x: surface.x / 1000, y: surface.y / 1000 });
    expect(walkthroughNavigation(saved).blockAt({ x: 1000, y: 1000 })?.kind).toBe('outside');
    const moved = updateTerrainSurface(saved, surface.id, { x: 1200, widthMm: 24000, texture: 'outdoor:paving' });
    expect(moved.terrainSurfaces?.[0]).toMatchObject({ x: 1200, widthMm: 24000, texture: 'outdoor:paving' });
    expect(deleteEntities(moved, [surface.id]).terrainSurfaces).toEqual([]);
  });

  it('rechaza acabados desconocidos y dimensiones fuera de rango', () => {
    const doc = addTerrainSurface(emptyEditorDocument(), suggestedTerrainSurface(emptyEditorDocument(), 'terrain-1'));
    expect(() => updateTerrainSurface(doc, 'terrain-1', { widthMm: 0 })).toThrow();
    expect(() => updateTerrainSurface(doc, 'terrain-1', { texture: 'outdoor:desconocido' })).toThrow();
  });
});
