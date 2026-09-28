import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { belongsToFurnitureGroup, furnitureBelongsToZone } from '@/components/editor-v2/scene/zone-scene-objects';

const region = [[
  { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 },
]];

function furniture(x: number) {
  const group = new Group();
  group.userData.videoStage = 3;
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.position.x = x;
  mesh.position.z = .5;
  group.add(mesh);
  group.updateMatrixWorld(true);
  return { group, mesh };
}

describe('muebles en captura por zona', () => {
  it('mantiene entero un mueble que cruza el contorno y oculta uno ajeno', () => {
    const partlyInside = furniture(1.1);
    const outside = furniture(2);
    expect(furnitureBelongsToZone(partlyInside.group, region)).toBe(true);
    expect(furnitureBelongsToZone(outside.group, region)).toBe(false);
    expect(belongsToFurnitureGroup(partlyInside.mesh)).toBe(true);
  });

  it('descarta una intersección accidental muy estrecha', () => {
    expect(furnitureBelongsToZone(furniture(1.49).group, region)).toBe(false);
  });
});
