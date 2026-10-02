'use client';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { exteriorRoofGeometry, type RoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { SurfaceMaterial } from './surface-material';
import { RoofWallClosureMesh } from './roof-wall-closure-mesh';
import type { ExteriorWall } from '@/canvas/editor-v2/scene/types';

function RoofPart({ part, document }: { part: RoofGeometry; document: EditorDocument }) {
  const geometry = useMemo(() => {
    const value = new BufferGeometry();
    value.setAttribute('position', new BufferAttribute(part.positions, 3));
    value.setAttribute('uv', new BufferAttribute(part.uvs, 2));
    value.setIndex(new BufferAttribute(part.indices, 1));
    const faceted = value.toNonIndexed(); value.dispose(); faceted.computeVertexNormals();
    return faceted;
  }, [part]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group userData={{ videoStage: 2, buildKey: 'exterior-roof' }}>
    <mesh geometry={geometry} castShadow receiveShadow userData={{ sourceEntityId: 'exterior-roof' }}>
      <SurfaceMaterial id={document.exteriorRoof!.materialId} color={document.exteriorRoof!.color} width={1} height={1} doubleSide />
    </mesh>
  </group>;
}

export function ExteriorRoofMeshes({ document, visible, exteriorWalls = [], cutaway = false }: { document: EditorDocument; visible: boolean; exteriorWalls?: ExteriorWall[]; cutaway?: boolean }) {
  const geometry = useMemo(() => {
    try { return { parts: exteriorRoofGeometry(document), error: null }; }
    catch (error) { return { parts: [], error: error instanceof Error ? error.message : 'Tejado inválido' }; }
  }, [document]);
  return <group visible={visible} userData={{ roofLayer: true, roofError: geometry.error }}>
    {geometry.parts.map((part, index) => <RoofPart key={index} part={part} document={document} />)}
    {geometry.parts.flatMap((part, index) => part.wallClosures.map(closure => <RoofWallClosureMesh key={`${index}:${closure.wallId}`} part={closure} document={document}
      exterior={exteriorWalls.find(wall => wall.sourceEntityId === closure.wallId)} cutaway={cutaway} />))}
  </group>;
}
