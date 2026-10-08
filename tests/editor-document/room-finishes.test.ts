/**
 * Un baño no lleva el mismo suelo ni las mismas paredes que un dormitorio, y la fachada no lleva el acabado de un
 * interior: cada cara de muro toma el acabado de la estancia a la que da.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { floorFinish } from '@/lib/editor-document/floor-finishes';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { parseNativeDesignProposalDetailed } from '@/server/agent/editor-v2/native-design-proposal';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

// Baño (x 0–4000) y dormitorio (x 4000–8000) separados por un tabique.
const house = () => {
  const doc = upgradeSpatialDocument(addWallPath(addWallPath(emptyEditorDocument(),
    [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true), [{ x: 4000, y: 0 }, { x: 4000, y: 4000 }]));
  doc.labels = [{ id: 'l1', x: 2000, y: 2000, text: 'Baño' }, { id: 'l2', x: 6000, y: 2000, text: 'Dormitorio' }];
  return doc;
};
const roomAt = (doc: ReturnType<typeof house>, x: number) => deriveRooms(doc).find((room) => pointInPolygon({ x, y: 2000 }, room.boundary))!;
const materials = { walls: 'polyhaven:white_plaster_02', exteriorWalls: 'polyhaven:stone_wall', floors: 'wood' as const,
  stairs: 'polyhaven:oak_wood_planks', ramps: 'polyhaven:concrete', columns: 'polyhaven:concrete' };

describe('acabados por estancia', () => {
  it('pone suelo y paredes de cada estancia y la fachada en las caras exteriores', () => {
    const doc = house(), bath = roomAt(doc, 2000), bedroom = roomAt(doc, 6000);
    const proposal: NativeDesignProposal = { style: 'moderno', summary: '', materials, furniture: [],
      roomFinishes: [{ roomId: bath.id, name: 'Baño', floor: 'polyhaven:grey_tiles', walls: 'polyhaven:long_white_tiles' }] };
    const result = applyNativeDesignProposal(doc, proposal);
    expect(floorFinish(result, bath.id).texture).toBe('polyhaven:grey_tiles');
    expect(floorFinish(result, bedroom.id).texture).toBe('wood');
    const partition = result.walls.find((wall) => [wall.startVertexId, wall.endVertexId].every((id) => result.vertices.find((v) => v.id === id)!.x === 4000))!;
    const sides = Object.values(wallConstruction(partition).materials).sort();
    expect(sides).toEqual(['polyhaven:long_white_tiles', 'polyhaven:white_plaster_02']);
    // Cada muro exterior lleva fachada por fuera y el acabado de su estancia por dentro.
    const outer = result.walls.filter((wall) => wall.id !== partition.id).flatMap((wall) => Object.values(wallConstruction(wall).materials));
    expect(outer.filter((id) => id === 'polyhaven:stone_wall')).toHaveLength(result.walls.length - 1);
    expect(outer).toContain('polyhaven:long_white_tiles');
  });
  it('solo acepta acabados de estancias del ámbito con materiales del catálogo y les pone su nombre', () => {
    const doc = house(), bath = roomAt(doc, 2000);
    const { proposal } = parseNativeDesignProposalDetailed({ summary: '', furniture: [], fixedFinishes: [],
      materials: { ...materials, slabUndersides: 'none', stairBodies: 'none', rampBodies: 'none', landingBodies: 'none' },
      roomFinishes: [{ roomId: bath.id, floor: 'polyhaven:grey_tiles', walls: 'polyhaven:long_white_tiles' },
        { roomId: 'inventada', floor: 'wood', walls: 'polyhaven:white_plaster_02' },
        { roomId: bath.id, floor: 'mármol de Carrara', walls: 'polyhaven:long_white_tiles' }] }, 'moderno', doc, defaultRenderDesignOptions());
    expect(proposal.roomFinishes).toEqual([{ roomId: bath.id, name: 'Baño', floor: 'polyhaven:grey_tiles', walls: 'polyhaven:long_white_tiles' }]);
    expect(proposal.materials.exteriorWalls).toBe('polyhaven:stone_wall');
  });
});
