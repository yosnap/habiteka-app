import { expect, it } from 'vitest';
import { Group, Mesh, MeshPhysicalMaterial } from 'three';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { architectureGuide } from '@/components/editor-v2/scene/architecture-guide';

it('retira muebles contradictorios, conserva arquitectura y restaura materiales compartidos y visibilidad', () => {
  const doc = emptyEditorDocument(), scene = new Group();
  doc.furniture = ['fuente', 'sofa', 'pergola', 'porche-entrada', 'valla-madera'].map(kind => ({ id: kind, kind }) as Furniture);
  const meshes = doc.furniture.map(item => { const mesh = new Mesh(); mesh.userData.sourceEntityId = item.id; scene.add(mesh); return mesh; });
  meshes[1]!.visible = false;
  const glass = new Mesh(undefined, new MeshPhysicalMaterial({ transmission: .85 }));
  const original = glass.material;
  glass.userData.roofGlazing = true; scene.add(glass);
  const restore = architectureGuide(scene, [doc]);
  expect(meshes.map(mesh => mesh.visible)).toEqual([false, false, true, true, true]);
  expect(glass.material).not.toBe(original);
  expect(original.transmission).toBe(.85);
  restore();
  expect(meshes.map(mesh => mesh.visible)).toEqual([true, false, true, true, true]);
  expect(glass.material).toBe(original);
});
