import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { prepareFurnitureModel } from '@/canvas/editor-v2/scene/furniture-model-transform';
import { ASSET_CATALOG, furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import type { Furniture } from '@/lib/editor-document/schema';

function sourceModel() {
  const source = new Group();
  const material = new MeshStandardMaterial({ color: '#aabbcc', map: new Texture() });
  const mesh = new Mesh(new BoxGeometry(2, 3, 4), material);
  mesh.position.set(7, -4, 11);
  source.add(mesh);
  return { source, mesh, material };
}

describe('revisión de contratos GLB', () => {
  it('normaliza después de orientar, con base cero y centro físico estable', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, .37]) {
      const { source } = sourceModel();
      const prepared = prepareFurnitureModel(source, angle);
      const bounds = new Box3().setFromObject(prepared.object);
      const size = bounds.getSize(new Vector3());
      expect(size.x).toBeCloseTo(1, 8);
      expect(size.y).toBeCloseTo(1, 8);
      expect(size.z).toBeCloseTo(1, 8);
      expect(bounds.min.y).toBeCloseTo(0, 8);
      expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0, 8);
      expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0, 8);
      prepared.dispose();
    }
  });

  it('aísla materiales de dos instancias sin modificar ni liberar recursos compartidos', () => {
    const { source, mesh, material } = sourceModel();
    let materialDisposals = 0, geometryDisposals = 0, textureDisposals = 0;
    material.addEventListener('dispose', () => materialDisposals++);
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    material.map!.addEventListener('dispose', () => textureDisposals++);
    const originalHex = material.color.getHex();
    const a = prepareFurnitureModel(source, 0, '#ff0000');
    const b = prepareFurnitureModel(source, 0);
    let aMesh: Mesh | undefined, bMesh: Mesh | undefined;
    a.object.traverse((node) => { if ((node as Mesh).isMesh) aMesh = node as Mesh; });
    b.object.traverse((node) => { if ((node as Mesh).isMesh) bMesh = node as Mesh; });
    expect(aMesh!.material).not.toBe(bMesh!.material);
    expect((aMesh!.material as MeshStandardMaterial).color.getHex()).not.toBe(originalHex);
    expect((bMesh!.material as MeshStandardMaterial).color.getHex()).toBe(originalHex);
    expect(material.color.getHex()).toBe(originalHex);
    expect(mesh.position.toArray()).toEqual([7, -4, 11]);
    a.dispose(); b.dispose();
    expect([materialDisposals, geometryDisposals, textureDisposals]).toEqual([0, 0, 0]);
  });

  it('rechaza una escena vacía en lugar de crear escalas infinitas', () => {
    expect(() => prepareFurnitureModel(new Group(), 0)).toThrow('dimensiones válidas');
  });

  it('mantiene identidades separadas de los muebles procedurales existentes', () => {
    expect(ASSET_CATALOG).toHaveLength(29);
    expect(new Set(FURNITURE_CATALOG.map((item) => item.id)).size).toBe(FURNITURE_CATALOG.length);
    expect(furnitureAsset({ catalogId: 'habiteka:furniture:mesa-comedor' })).toBeUndefined();
    for (const entry of ASSET_CATALOG) {
      expect(furnitureAsset({ catalogId: entry.id })?.url).toMatch(/^\/models\/cc0\/[^/]+\.glb$/);
    }
  });

  it('usa un volumen sólido conservador incluso para mesas GLB con espacios interiores desconocidos', () => {
    const item = { id: 'a', kind: 'asset-mesa', catalogId: 'habiteka:asset:mesa', x: 0, y: 0,
      widthMm: 800, depthMm: 800, heightMm: 750, elevationMm: 100, rotation: 0 } as Furniture;
    expect(furnitureVolumes(item)).toEqual([
      { x: 0, y: 0, widthMm: 800, depthMm: 800, bottom: 100, top: 850 },
    ]);
  });
});
