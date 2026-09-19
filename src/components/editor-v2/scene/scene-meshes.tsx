'use client';
import { useMemo } from 'react';
import { Path, Shape } from 'three';
import { Edges } from '@react-three/drei';
import type { SceneBox, ScenePolygon, SceneRamp } from '@/canvas/editor-v2/scene/types';
import { FloorMaterial } from './floor-material';
import { SurfaceMaterial } from './surface-material';
import { rampPrismGeometry, rampSurfaceGeometry } from '@/canvas/editor-v2/scene/ramp-prism';

export function BoxMesh({ box, selected, onSelect }: { box: SceneBox; selected: boolean; onSelect: (id: string) => void }) {
  const colors = box.sideColors ? [box.color, box.color, box.topColor ?? box.color, box.color, box.sideColors[0], box.sideColors[1]] : null;
  const faceColors = colors ?? Array.from({ length: 6 }, () => box.color);
  return <mesh position={box.position} rotation={[0, box.rotation, 0]} castShadow={box.role !== 'glass'} receiveShadow
    userData={{ sourceEntityId: box.sourceEntityId }} onClick={(e) => { e.stopPropagation(); onSelect(box.sourceEntityId); }}>
    {box.shape === 'cylinder' ? <cylinderGeometry args={[box.size[0] / 2, box.size[0] / 2, box.size[1], 24]} /> : <boxGeometry args={box.size} />}
    {box.materialId ? <SurfaceMaterial color={selected ? '#43b6a0' : box.color} id={box.materialId} width={box.size[0]} height={box.size[1]} /> : (colors || box.topMaterialId) ? faceColors.map((color, index) => index === 2 && box.topMaterialId
      ? <SurfaceMaterial key={index} attach={`material-${index}`} color={selected ? '#43b6a0' : color} id={box.topMaterialId}
        width={box.size[0]} height={box.size[2]} />
      : index === 2 && box.topColor
        ? <meshBasicMaterial key={index} attach={`material-${index}`} color={color} toneMapped={false} />
      : <SurfaceMaterial key={index} attach={`material-${index}`} color={color} id={index >= 4 ? box.sideMaterials?.[index - 4] : undefined}
        width={box.size[0]} height={box.size[1]} offsetX={box.textureOffset?.[0]} offsetY={box.textureOffset?.[1]} />)
      : <meshStandardMaterial emissive={box.emissive} emissiveIntensity={box.emissive ? 2 : 0} color={selected ? '#43b6a0' : box.color} roughness={box.role === 'glass' ? .12 : .7}
        metalness={box.role === 'rail' ? .5 : 0} transparent={box.role === 'glass'} opacity={box.role === 'glass' ? .35 : 1}
        depthWrite={box.role !== 'glass'} />}
    {selected && colors && <Edges color="#087f75" />}
  </mesh>;
}

export function RampMesh({ ramp, selected, onSelect }: { ramp: SceneRamp; selected: boolean; onSelect: (id: string) => void }) {
  const select = (event: { stopPropagation: () => void }) => { event.stopPropagation(); onSelect(ramp.sourceEntityId); };
  // El pavimento PBR puede ser claro; el cuerpo que lo sustenta debe leerse
  // como construcción, no confundirse con el fondo como una losa flotante.
  const structuralColor = ramp.floorFinish?.texture !== 'none' ? '#756f66' : ramp.color;
  if (ramp.rise === 0) return <mesh position={[ramp.position[0], ramp.position[1] + ramp.baseHeight / 2, ramp.position[2]]} rotation={[0, ramp.rotation, 0]} castShadow receiveShadow onClick={select}>
    <boxGeometry args={[ramp.width, Math.max(ramp.baseHeight, .02), ramp.depth]} />
    {[0, 1, 2, 3, 4, 5].map((face) => face === 2 && ramp.floorFinish
      ? <FloorMaterial key={face} finish={ramp.floorFinish} attach={`material-${face}`} width={ramp.width} height={ramp.depth} />
      : <meshStandardMaterial key={face} attach={`material-${face}`} color={selected ? '#43b6a0' : structuralColor} roughness={.75} />)}
  </mesh>;
  const { vertices, indices } = rampPrismGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
  const surface = rampSurfaceGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
  return <group position={ramp.position} rotation={[0, ramp.rotation, 0]} onClick={select}>
    <mesh castShadow receiveShadow><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices, 3]} /><bufferAttribute attach="index" args={[indices, 1]} /></bufferGeometry>
      <meshStandardMaterial color={selected ? '#43b6a0' : structuralColor} roughness={.75} side={2} /></mesh>
    {ramp.floorFinish && <mesh receiveShadow raycast={() => undefined}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[surface.vertices, 3]} />
        <bufferAttribute attach="attributes-uv" args={[surface.uvs, 2]} />
        <bufferAttribute attach="attributes-normal" args={[surface.normals, 3]} />
        <bufferAttribute attach="index" args={[surface.indices, 1]} />
      </bufferGeometry>
      <FloorMaterial finish={ramp.floorFinish}
        width={ramp.width} height={Math.hypot(ramp.depth, ramp.rise)} doubleSide />
    </mesh>}
    {ramp.railingLeft && <RampRail ramp={ramp} side={-1} />}
    {ramp.railingRight && <RampRail ramp={ramp} side={1} />}
  </group>;
}

/** Pasamanos continuo con postes en ambos extremos, medido sobre la pendiente real. */
function RampRail({ ramp, side }: { ramp: SceneRamp; side: -1 | 1 }) {
  const height = .9, thickness = .04, slope = Math.atan2(ramp.rise, ramp.depth), length = Math.hypot(ramp.depth, ramp.rise);
  const x = side * (ramp.width / 2 - thickness / 2), high = ramp.baseHeight + ramp.rise, low = ramp.baseHeight;
  return <group>
    <mesh position={[x, (high + low) / 2 + height, 0]} rotation={[slope, 0, 0]} castShadow><boxGeometry args={[thickness, thickness, length]} /><meshStandardMaterial color="#424d51" metalness={.5} roughness={.4} /></mesh>
    <mesh position={[x, high + height / 2, -ramp.depth / 2]} castShadow><boxGeometry args={[thickness, height, thickness]} /><meshStandardMaterial color="#424d51" metalness={.5} roughness={.4} /></mesh>
    <mesh position={[x, low + height / 2, ramp.depth / 2]} castShadow><boxGeometry args={[thickness, height, thickness]} /><meshStandardMaterial color="#424d51" metalness={.5} roughness={.4} /></mesh>
  </group>;
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
