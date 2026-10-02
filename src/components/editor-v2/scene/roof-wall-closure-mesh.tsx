'use client';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RoofWallClosure } from '@/lib/editor-document/exterior-roof-wall-closures';
import { wallPath } from '@/lib/editor-document/wall-path';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { materialColor } from '@/canvas/editor-v2/scene/types';
import { SurfaceMaterial } from './surface-material';
import { CutawayWall } from './cutaway-wall';
import type { ExteriorWall } from '@/canvas/editor-v2/scene/types';

export function RoofWallClosureMesh({ part, document, exterior, cutaway = false }: { part: RoofWallClosure; document: EditorDocument; exterior?: ExteriorWall; cutaway?: boolean }) {
  const wall = document.walls.find(wall => wall.id === part.wallId)!;
  const geometry = useMemo(() => {
    const path = wallPath(document, wall), value = new BufferGeometry();
    value.setAttribute('position', new BufferAttribute(part.positions, 3)); value.setAttribute('uv', new BufferAttribute(part.uvs, 2));
    value.setIndex(new BufferAttribute(part.indices, 1));
    for (let i = 0; i < part.indices.length; i += 3) {
      const vertices = [part.indices[i]!, part.indices[i + 1]!, part.indices[i + 2]!];
      const point = { x: vertices.reduce((sum, index) => sum + part.positions[index * 3]!, 0) / 3 * 1000,
        y: vertices.reduce((sum, index) => sum + part.positions[index * 3 + 2]!, 0) / 3 * 1000 };
      const t = path.project(point), center = path.at(t), tangent = path.tangent(t);
      value.addGroup(i, 3, (point.x - center.x) * -tangent.y + (point.y - center.y) * tangent.x >= 0 ? 0 : 1);
    }
    const faceted = value.toNonIndexed(); value.dispose(); faceted.computeVertexNormals(); return faceted;
  }, [document, wall, part]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const materials = wallConstruction(wall).materials;
  return <group userData={{ videoStage: 1, buildKey: wall.id, buildBaseM: part.buildBaseM, cutawayWallId: wall.id, cutawayStructural: true }}>
    <CutawayWall exterior={exterior} enabled={cutaway} selected={false}><mesh geometry={geometry} castShadow receiveShadow userData={{ sourceEntityId: wall.id }}>
      {(['left', 'right'] as const).map((side, index) => <SurfaceMaterial key={side} attach={`material-${index}`} id={materials[side]}
        color={wall.colors?.[side] ?? materialColor(materials[side])} width={1} height={1} doubleSide />)}
    </mesh></CutawayWall>
  </group>;
}
