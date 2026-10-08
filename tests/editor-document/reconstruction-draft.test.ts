import { describe, expect, it } from 'vitest';
import { reconstructionGeometry, validateReconstruction } from '../../scripts/reconstruction/design-scene';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

function manifest() {
  return { purpose: 'reconstruction-draft', referenceIds: ['accepted'], materials: { cream: { color: '#e0ddcc' } },
    defaults: { wall: 'cream', floor: 'cream', frame: 'cream', leaf: 'cream', roof: 'cream', glass: 'cream' },
    surfaces: [], objects: [], unresolved: ['Mobiliario pendiente de correspondencia visual.'] };
}

describe('reconstrucción local desde diseños aceptados', () => {
  it('bloquea referencias que han perdido su aceptación', () => {
    expect(() => validateReconstruction(manifest(), [])).toThrow('sin aceptación');
  });
  it('exige procedencia aceptada y material a cada pieza explícita', () => {
    const object = { id: 'fountain', shape: 'fountain', material: 'cream', referenceId: 'other',
      evidence: 'Fuente cuadrada visible en el patio.', position: [1, 0, 2], size: [1, .4, 1] };
    expect(() => validateReconstruction({ ...manifest(), objects: [object] }, ['accepted'])).toThrow('vincular');
    expect(() => validateReconstruction({ ...manifest(), objects: [{ ...object, referenceId: 'accepted', material: undefined }] }, ['accepted'])).toThrow('material');
  });
  it('no permite rutas arbitrarias ni fuentes sin limitaciones declaradas', () => {
    expect(() => validateReconstruction({ ...manifest(), unresolved: [] }, ['accepted'])).toThrow();
    expect(() => validateReconstruction({ ...manifest(), objects: [{ id: 'bad', model: '/models/../private.glb', referenceId: 'accepted',
      evidence: 'Modelo no autorizado por la ruta.', position: [0, 0, 0], size: [1, 1, 1] }] }, ['accepted'])).toThrow();
  });
  it('exporta muros sin incorporar implícitamente el mobiliario del editor', () => {
    const doc = emptyEditorDocument();
    doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }];
    doc.walls = [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
    doc.furniture = [{ id: 'editor-sofa', kind: 'sofa', x: 0, y: 500, widthMm: 2000, depthMm: 900, rotation: 0, dimensionalOrigin: 'physical' }];
    const before = structuredClone(doc), meshes = reconstructionGeometry(doc, validateReconstruction(manifest(), ['accepted']));
    expect(meshes.some(mesh => mesh.sourceId === 'wall')).toBe(true);
    expect(meshes.some(mesh => mesh.sourceId === 'editor-sofa')).toBe(false);
    expect(doc).toEqual(before);
    for (const mesh of meshes) {
      expect(mesh.vertices.every(Number.isFinite)).toBe(true);
      expect(mesh.triangles.every(index => index >= 0 && index < mesh.vertices.length / 3)).toBe(true);
    }
  });
});
