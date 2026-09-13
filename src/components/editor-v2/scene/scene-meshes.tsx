'use client';
import { useMemo } from 'react';
import { Path, Shape } from 'three';
import { Edges } from '@react-three/drei';
import type { SceneBox, ScenePolygon, SceneRamp } from '@/canvas/editor-v2/scene/types';
import { FloorMaterial } from './floor-material';
import { SurfaceMaterial } from './surface-material';
import { rampPrismGeometry } from '@/canvas/editor-v2/scene/ramp-prism';

export function BoxMesh({ box, selected, onSelect }: { box: SceneBox; selected: boolean; onSelect: (id: string) => void }) {
  const colors = box.sideColors ? [box.color, box.color, box.topColor ?? box.color, box.color, box.sideColors[0], box.sideColors[1]] : null;
  return <mesh position={box.position} rotation={[0, box.rotation, 0]} castShadow={box.role !== 'glass'} receiveShadow
    userData={{ sourceEntityId: box.sourceEntityId }} onClick={(e) => { e.stopPropagation(); onSelect(box.sourceEntityId); }}>
    <boxGeometry args={box.size} />
    {colors ? colors.map((color, index) => index === 2 && box.topColor
      ? <meshBasicMaterial key={index} attach={`material-${index}`} color={color} toneMapped={false} />
      : <SurfaceMaterial key={index} attach={`material-${index}`} color={color} id={index >= 4 ? box.sideMaterials?.[index - 4] : undefined}
        width={box.size[0]} height={box.size[1]} offsetX={box.textureOffset?.[0]} offsetY={box.textureOffset?.[1]} />)
      : <meshStandardMaterial color={selected ? '#43b6a0' : box.color} roughness={box.role === 'glass' ? .12 : .7}
        metalness={box.role === 'rail' ? .5 : 0} transparent={box.role === 'glass'} opacity={box.role === 'glass' ? .35 : 1}
        depthWrite={box.role !== 'glass'} />}
    {selected && colors && <Edges color="#087f75" />}
  </mesh>;
}

export function RampMesh({ ramp, selected, onSelect }: { ramp: SceneRamp; selected: boolean; onSelect: (id: string) => void }) {
  if (ramp.rise === 0) return <mesh position={[ramp.position[0], ramp.position[1] + ramp.baseHeight / 2, ramp.position[2]]} rotation={[0, ramp.rotation, 0]} castShadow receiveShadow onClick={(event) => {
    event.stopPropagation(); onSelect(ramp.sourceEntityId);
  }}><boxGeometry args={[ramp.width, Math.max(ramp.baseHeight, .02), ramp.depth]} /><meshStandardMaterial color={selected ? '#43b6a0' : ramp.color} roughness={.75} /></mesh>;
  const { vertices, indices } = rampPrismGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
  return <mesh position={ramp.position} rotation={[0, ramp.rotation, 0]} castShadow receiveShadow onClick={(event) => {
    event.stopPropagation(); onSelect(ramp.sourceEntityId);
  }}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices, 3]} /><bufferAttribute attach="index" args={[indices, 1]} /></bufferGeometry>
    <meshStandardMaterial color={selected ? '#43b6a0' : ramp.color} roughness={.75} side={2} /></mesh>;
}
export function PolygonMesh({ polygon, selected, onSelect }: { polygon: ScenePolygon; selected: boolean; onSelect: (id: string) => void }) {
  const shape = useMemo(() => {
    const result = new Shape();
    polygon.points.forEach((p, i) => i ? result.lineTo(p.x, -p.y) : result.moveTo(p.x, -p.y));
    for (const ring of polygon.holes ?? []) {
      const hole = new Path();
      ring.forEach((p, i) => i ? hole.lineTo(p.x, -p.y) : hole.moveTo(p.x, -p.y));
      hole.closePath(); result.holes.push(hole);
    }
    result.closePath(); return result;
  }, [polygon.points, polygon.holes]);
  return <group><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, polygon.elevation, 0]} receiveShadow castShadow={polygon.role === 'junction'}
    userData={{ sourceEntityId: polygon.sourceEntityId }} onClick={(e) => {
      e.stopPropagation(); onSelect(polygon.sourceEntityId);
    }}>
    {polygon.height === 0 ? <shapeGeometry args={[shape]} />
      : <extrudeGeometry args={[shape, { depth: polygon.height, bevelEnabled: false, steps: 1 }]} />}
    {polygon.floorFinish ? polygon.height > 0 ? <>
      <FloorMaterial finish={polygon.floorFinish} attach="material-0" />
      <meshStandardMaterial attach="material-1" color={polygon.sideColor ?? '#756f66'} roughness={.85} />
    </> : <FloorMaterial finish={polygon.floorFinish} /> : polygon.topColor || polygon.edgeFinishes ? <>
      <meshBasicMaterial attach="material-0" color={polygon.topColor ?? polygon.color} toneMapped={false} />
      <meshStandardMaterial attach="material-1" color={polygon.color} roughness={.85} visible={!polygon.edgeFinishes} />
    </> : <meshStandardMaterial color={selected ? '#43b6a0' : polygon.color} roughness={.85} />}
    {selected && polygon.role === 'floor' && <Edges color="#087f75" />}
  </mesh>
    {polygon.floorFinish && polygon.height > 0 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, polygon.elevation - .001, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <FloorMaterial finish={polygon.floorFinish} textureId={polygon.floorFinish.undersideTexture ?? 'none'}
        color={polygon.floorFinish.undersideColor ?? polygon.sideColor ?? '#756f66'} doubleSide />
    </mesh>}
    {polygon.edgeFinishes?.map((finish, index) => {
      const a = polygon.points[index]!, b = polygon.points[(index + 1) % polygon.points.length]!;
      return <mesh key={index} position={[(a.x + b.x) / 2, polygon.elevation + polygon.height / 2, (a.y + b.y) / 2]}
        rotation={[0, -Math.atan2(b.y - a.y, b.x - a.x), 0]} castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(finish.sourceEntityId); }}>
        <planeGeometry args={[Math.hypot(b.x - a.x, b.y - a.y), polygon.height]} />
        <SurfaceMaterial color={finish.color} id={finish.materialId} width={finish.spanX ?? Math.hypot(b.x - a.x, b.y - a.y)} height={polygon.height}
          offsetX={finish.offsetX} offsetY={polygon.elevation} doubleSide />
      </mesh>;
    })}
  </group>;
}
