import { describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { prepareFurnitureModel } from '@/canvas/editor-v2/scene/furniture-model-transform';

describe('independent normalized GLB instances', () => {
  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('orients then normalizes a displaced model at %s', (angle) => {
    const source = new Group(), mesh = new Mesh(new BoxGeometry(2, 3, 4), new MeshStandardMaterial());
    mesh.position.set(8, -5, 20); source.add(mesh);
    const original = source.toJSON(), prepared = prepareFurnitureModel(source, angle);
    const bounds = new Box3().setFromObject(prepared.object), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    expect(size.x).toBeCloseTo(1); expect(size.y).toBeCloseTo(1); expect(size.z).toBeCloseTo(1);
    expect(bounds.min.y).toBeCloseTo(0); expect(center.x).toBeCloseTo(0); expect(center.z).toBeCloseTo(0);
    expect(source.toJSON()).toEqual(original);
    const physical = new Group(); physical.scale.set(1.8, .85, .9); physical.add(prepared.object);
    const placed = new Group(); placed.position.set(3, 1.2, 4); placed.rotation.y = -37 * Math.PI / 180; placed.add(physical);
    expect(new Box3().setFromObject(placed).min.y).toBeCloseTo(1.2);
    expect(new Box3().setFromObject(placed).max.y).toBeCloseTo(2.05);
    prepared.dispose(); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose();
  });
  it('clones materials per instance, preserves textures and never disposes cached geometry', () => {
    const material = new MeshStandardMaterial({ color: '#ffffff' }), mesh = new Mesh(new BoxGeometry(), material);
    const disposeOriginal = vi.spyOn(material, 'dispose'), disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const first = prepareFurnitureModel(mesh, 0, '#ff0000'), second = prepareFurnitureModel(mesh, 0);
    const firstMesh = first.object.children[0]!.children[0] as Mesh, secondMesh = second.object.children[0]!.children[0] as Mesh;
    expect(firstMesh.geometry).toBe(mesh.geometry);
    expect((firstMesh.material as MeshStandardMaterial).color).toEqual(new Color('#ff0000'));
    expect((secondMesh.material as MeshStandardMaterial).color).toEqual(new Color('#ffffff'));
    first.dispose(); expect(disposeOriginal).not.toHaveBeenCalled(); expect(disposeGeometry).not.toHaveBeenCalled();
    expect(material.color).toEqual(new Color('#ffffff')); second.dispose();
  });
  it('rejects empty geometry and preserves transparent materials under a global tint', () => {
    expect(() => prepareFurnitureModel(new Group(), 0)).toThrow('dimensiones');
    const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#abcdef', transparent: true, opacity: .3 }));
    const model = prepareFurnitureModel(glass, 0, '#ff0000');
    const copy = model.object.children[0]!.children[0] as Mesh;
    expect((copy.material as MeshStandardMaterial).color).toEqual(new Color('#abcdef')); model.dispose();
  });
  it('recolorea solo la pintura del coche y conserva cristales, ruedas y luces', () => {
    const source = new Group();
    for (const name of ['paintB', 'trim', 'glass']) {
      const material = new MeshStandardMaterial({ name, color: '#abcdef' });
      source.add(new Mesh(new BoxGeometry(), material));
    }
    const prepared = prepareFurnitureModel(source, Math.PI, '#ff0000', 1, ['paintB']);
    const materials: MeshStandardMaterial[] = [];
    prepared.object.traverse((object) => { if (object instanceof Mesh) materials.push(object.material as MeshStandardMaterial); });
    expect(materials.map((material) => material.color.getHexString())).toEqual(['ff0000', 'abcdef', 'abcdef']);
    prepared.dispose();
  });
});
