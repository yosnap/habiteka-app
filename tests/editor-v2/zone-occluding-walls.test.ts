import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { zoneOccludingWallIds } from '@/components/editor-v2/scene/zone-occluding-walls';
import { clipShaderAboveSupport, cutawaySupportHeights, hideWallsByIds } from '@/components/editor-v2/scene/cutaway-wall';
import { cutawaySupportHeight } from '@/components/editor-v2/scene/zone-scene-objects';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';

const region = [[{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }]];

function documentWithCrossWalls() {
  const document = emptyEditorDocument();
  document.vertices = [
    { id: 'front-a', x: 0, y: 0 }, { id: 'front-b', x: 4000, y: 0 },
    { id: 'rear-a', x: 0, y: 4000 }, { id: 'rear-b', x: 4000, y: 4000 },
    { id: 'other-a', x: 6000, y: 0 }, { id: 'other-b', x: 6000, y: 4000 },
    { id: 'right-a', x: 4000, y: 0 }, { id: 'right-b', x: 4000, y: 4000 },
    { id: 'left-a', x: 0, y: 0 }, { id: 'left-b', x: 0, y: 4000 },
  ];
  document.walls = [
    { id: 'front', startVertexId: 'front-a', endVertexId: 'front-b', thicknessMm: 180, dimensionalOrigin: 'physical' },
    { id: 'rear', startVertexId: 'rear-a', endVertexId: 'rear-b', thicknessMm: 180, dimensionalOrigin: 'physical' },
    { id: 'other', startVertexId: 'other-a', endVertexId: 'other-b', thicknessMm: 180, dimensionalOrigin: 'physical' },
    { id: 'right', startVertexId: 'right-a', endVertexId: 'right-b', thicknessMm: 180, dimensionalOrigin: 'physical' },
    { id: 'left', startVertexId: 'left-a', endVertexId: 'left-b', thicknessMm: 180, dimensionalOrigin: 'physical' },
  ];
  return document;
}

describe('recorte de muros delante de una zona de diseño', () => {
  it('escoge la pared que tapa desde cada lado, conserva la del fondo', () => {
    const document = documentWithCrossWalls();
    expect(zoneOccludingWallIds(document, { x: 2, y: 2, z: -5 }, region)).toEqual(['front']);
    expect(zoneOccludingWallIds(document, { x: 2, y: 2, z: 9 }, region)).toEqual(['rear']);
    expect(zoneOccludingWallIds(document, { x: 9, y: 2, z: 2 }, region)).toEqual(['right']);
    expect(zoneOccludingWallIds(document, { x: -5, y: 2, z: 2 }, region)).toEqual(['left']);
  });

  it('no quita paredes exteriores ajenas ni tabiques interiores de la zona', () => {
    const document = documentWithCrossWalls();
    document.vertices.push({ id: 'partition-a', x: 0, y: -2000 }, { id: 'partition-b', x: 4000, y: -2000 });
    document.walls.push({ id: 'partition', startVertexId: 'partition-a', endVertexId: 'partition-b', thicknessMm: 120, dimensionalOrigin: 'physical' });
    const before = JSON.stringify(document);
    expect(zoneOccludingWallIds(document, { x: 2, y: 2, z: -5 }, region)).toEqual(['front']);
    expect(JSON.stringify(document)).toBe(before);
    document.walls.find((wall) => wall.id === 'partition')!.hidden = true;
    expect(zoneOccludingWallIds(document, { x: 2, y: 2, z: -5 }, region)).toEqual(['front']);
    document.vertices.push({ id: 'inner-a', x: 0, y: 2000 }, { id: 'inner-b', x: 4000, y: 2000 });
    document.walls.push({ id: 'inner', startVertexId: 'inner-a', endVertexId: 'inner-b', thicknessMm: 120, dimensionalOrigin: 'physical' });
    expect(zoneOccludingWallIds(document, { x: 2, y: 2, z: -5 }, region)).toEqual(['front']);
  });

  it('no recorta paredes desde dentro de la zona', () => {
    expect(zoneOccludingWallIds(documentWithCrossWalls(), { x: 2, y: 2, z: 2 }, region)).toEqual([]);
  });

  it('conserva un muro que queda por debajo de la línea de visión', () => {
    expect(zoneOccludingWallIds(documentWithCrossWalls(), { x: 2, y: 20, z: -5 }, region)).toEqual([]);
  });
});

describe('visibilidad temporal de la captura', () => {
  it('oculta el muro y los huecos vinculados y restaura solo lo que cambió', () => {
    const root = new Group();
    const wall = new Group(), opening = new Group(), furniture = new Group(), previouslyHidden = new Group();
    wall.userData.cutawayWallId = 'front';
    opening.userData.cutawayWallId = 'front';
    previouslyHidden.userData.cutawayWallId = 'front';
    previouslyHidden.visible = false;
    root.add(wall, opening, furniture, previouslyHidden);
    const restore = hideWallsByIds(root, new Set(['front']));
    expect([wall.visible, opening.visible, furniture.visible, previouslyHidden.visible]).toEqual([false, false, true, false]);
    restore();
    expect([wall.visible, opening.visible, furniture.visible, previouslyHidden.visible]).toEqual([true, true, true, false]);
  });

  it('conserva bajo la abertura el apoyo de una estancia elevada sin dejar flotante el suelo', () => {
    let document = emptyEditorDocument();
    document.vertices = [
      { id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 },
      { id: 'c', x: 4000, y: 4000 }, { id: 'd', x: 0, y: 4000 },
    ];
    document.walls = ([['front', 'a', 'b'], ['right', 'b', 'c'], ['back', 'c', 'd'], ['left', 'd', 'a']] as const)
      .map(([id, startVertexId, endVertexId]) => ({ id, startVertexId, endVertexId,
        thicknessMm: 150, dimensionalOrigin: 'physical' as const }));
    const room = deriveRooms(document)[0]!;
    document = upgradeSpatialDocument(document);
    document.schemaVersion = 5;
    document.floorFinishes = [{ roomId: room.id, color: '#ffffff', texture: 'none', tileSizeMm: 600,
      rotation: 0, elevationMm: 1000 }];
    const heights = cutawaySupportHeights(document, new Set(['front']), 3000);
    expect(heights.get('front')).toBe(4);

    const root = new Group(), wall = new Group(), opening = new Group();
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(4, 3, .15), material);
    wall.userData = { cutawayWallId: 'front', cutawayStructural: true };
    opening.userData = { cutawayWallId: 'front' };
    wall.add(mesh); root.add(wall, opening);
    const restore = hideWallsByIds(root, new Set(['front']), heights);
    expect(wall.visible).toBe(true);
    expect(opening.visible).toBe(false);
    expect(mesh.material).not.toBe(material);
    expect(cutawaySupportHeight(mesh)).toBe(4);
    const shader = { uniforms: {}, vertexShader: 'void main() { vec3 transformed = position; #include <project_vertex> }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' } as WebGLProgramParametersWithUniforms;
    clipShaderAboveSupport(shader, heights.get('front')!);
    expect(shader.fragmentShader).toContain('vHabitekaCutawayY > 4.000000');
    restore();
    expect(mesh.material).toBe(material);
    expect(opening.visible).toBe(true);
    expect(cutawaySupportHeight(mesh)).toBeUndefined();
  });
});
