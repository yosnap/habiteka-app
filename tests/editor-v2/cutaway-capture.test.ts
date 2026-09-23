import { describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera } from 'three';
import { hideWallsFacingCamera } from '../../src/components/editor-v2/scene/cutaway-wall';

describe('recorte de muros en la captura', () => {
  it('oculta solo los muros exteriores que miran a la cámara y los restaura', () => {
    const root = new Group();
    const front = new Group(), back = new Group(), floor = new Group();
    front.userData.cutawayExterior = { sourceEntityId: 'f', x: 0, z: 5, normalX: 0, normalZ: 1 };
    back.userData.cutawayExterior = { sourceEntityId: 'b', x: 0, z: -5, normalX: 0, normalZ: -1 };
    root.add(front, back, floor);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 3, 30);
    const restore = hideWallsFacingCamera(root, camera);
    expect([front.visible, back.visible, floor.visible]).toEqual([false, true, true]);
    restore();
    expect(front.visible).toBe(true);
  });
  it('no toca ni restaura un muro que ya estaba oculto', () => {
    const root = new Group(), wall = new Group();
    wall.userData.cutawayExterior = { sourceEntityId: 'f', x: 0, z: 5, normalX: 0, normalZ: 1 };
    wall.visible = false;
    root.add(wall);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 3, 30);
    hideWallsFacingCamera(root, camera)();
    expect(wall.visible).toBe(false);
  });
});

describe('iluminación oculta en la vista', () => {
  it('se enciende solo durante la captura y vuelve a ocultarse', async () => {
    const { revealHiddenLighting } = await import('../../src/components/editor-v2/scene/cutaway-wall');
    const root = new Group(), lighting = new Group();
    lighting.userData.lightingLayer = true;
    lighting.visible = false;
    root.add(lighting);
    const restore = revealHiddenLighting(root);
    expect(lighting.visible).toBe(true);
    restore();
    expect(lighting.visible).toBe(false);
  });
});
