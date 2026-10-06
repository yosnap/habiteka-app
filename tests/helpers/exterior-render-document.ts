import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { boundaryDefaults } from '@/lib/editor-document/boundary-types';
import { upgradeBoundaryDocument } from '@/lib/editor-document/boundary-commands';

export function exteriorRenderDocument() {
  const doc = upgradeBoundaryDocument(emptyEditorDocument());
  doc.designSpaceKind = 'casa';
  doc.terrainSurfaces = [{ id: 'lawn', name: 'Jardín', x: 0, y: 0, widthMm: 10000, depthMm: 10000,
    texture: 'outdoor:grass-lawn-pbr', color: '#ffffff', tileSizeMm: 1400, rotation: 45 }];
  doc.vertices = [{ id: 'a', x: 3000, y: 3000 }, { id: 'b', x: 6000, y: 3000 },
    { id: 'c', x: 6000, y: 6000 }, { id: 'd', x: 3000, y: 6000 }];
  doc.walls = ['a', 'b', 'c', 'd'].map((id, i, ids) => ({ id: `w${i}`, startVertexId: id,
    endVertexId: ids[(i + 1) % 4]!, thicknessMm: 150, heightMm: 2700,
    materials: { left: 'plaster-white', right: 'plaster-white' }, colors: { left: '#ffffff', right: '#ffffff' },
    dimensionalOrigin: 'physical' as const }));
  const hedge = boundaryDefaults({ id: 'hedge', kind: 'seto', catalogId: 'habiteka:outdoor:seto:laurel',
    x: 1000, y: 1000, widthMm: 8000, depthMm: 300, heightMm: 1800, rotation: 0, color: '#356b38', dimensionalOrigin: 'physical' });
  hedge.construction.gates = [{ id: 'gate', positionMm: 4000, widthMm: 1000, heightMm: 1800,
    hinge: 'left', openAngleDeg: 90, color: '#656b6b' }];
  doc.boundaries = [hedge];
  doc.furniture = [
    { id: 'car1', kind: 'coche', catalogId: 'habiteka:outdoor:coche', x: 7000, y: 3000,
      widthMm: 1800, depthMm: 4200, heightMm: 1500, elevationMm: 0, rotation: 0, color: '#c5c8cc', dimensionalOrigin: 'physical' },
    { id: 'car2', kind: 'coche', catalogId: 'habiteka:outdoor:coche:turismo-3d', x: 1000, y: 3500,
      widthMm: 1700, depthMm: 3800, heightMm: 1450, elevationMm: 0, rotation: 0, color: '#b95741', dimensionalOrigin: 'physical' },
  ];
  return doc;
}
