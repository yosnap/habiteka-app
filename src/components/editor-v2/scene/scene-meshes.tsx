'use client';
import { useMemo } from 'react';
import { Path, Shape } from 'three';
import { Edges, RoundedBoxGeometry } from '@react-three/drei';
import type { SceneBox, ScenePolygon, SceneRamp } from '@/canvas/editor-v2/scene/types';
import { FloorMaterial } from './floor-material';
import { SurfaceMaterial } from './surface-material';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { rampBodySurfaceGeometry, rampPrismGeometry, rampSurfaceGeometry } from '@/canvas/editor-v2/scene/ramp-prism';
import { WaterSurfaceMaterial } from './water-surface-material';
import { HipRoofGeometry } from './hip-roof-geometry';
import { HipRoofSeams } from './hip-roof-seams';

export function BoxMesh({ box, selected, onSelect }: { box: SceneBox; selected: boolean; onSelect: (id: string) => void }) {
  const colors = box.sideColors ? [box.color, box.color, box.topColor ?? box.color, box.color, box.sideColors[0], box.sideColors[1]] : null;
  const faceColors = colors ?? Array.from({ length: 6 }, () => box.color);
  const clear = box.role === 'glass' || box.opacity !== undefined || box.appearance === 'water';
  return <><mesh position={box.position} rotation={[0, box.rotation, 0]}
    scale={box.shape === 'ellipsoid' ? box.size : undefined} castShadow={!clear} receiveShadow
    userData={{ sourceEntityId: box.sourceEntityId }} onClick={(e) => { e.stopPropagation(); onSelect(box.sourceEntityId); }}>
    {box.shape === 'cylinder' ? <cylinderGeometry args={[box.size[0] / 2, box.size[0] / 2, box.size[1], 24]} />
      : box.shape === 'hip-roof' ? <HipRoofGeometry size={box.size} />
        : box.shape === 'rounded-box' ? <RoundedBoxGeometry args={box.size} radius={Math.min(...box.size) * .2} smoothness={3} bevelSegments={2} />
        : box.shape === 'ellipsoid' ? <sphereGeometry args={[.5, 20, 12]} /> : <boxGeometry args={box.size} />}
    {box.appearance === 'water' ? <WaterSurfaceMaterial color={selected ? '#43b6a0' : box.color} width={box.size[0]} depth={box.size[2]} /> : box.materialId ? <SurfaceMaterial color={selected ? '#43b6a0' : box.color} id={box.materialId}
      width={box.size[0]} height={box.shape === 'hip-roof' ? box.size[2] : box.size[1]}
      useColorMap={box.useColorMap} fabricSheen={box.shape === 'hip-roof'} /> : (colors || box.topMaterialId || box.bodyMaterialId) ? faceColors.map((color, index) => index === 2 && box.topMaterialId
      ? <SurfaceMaterial key={index} attach={`material-${index}`} color={selected ? '#43b6a0' : color} id={box.topMaterialId}
        width={box.size[0]} height={box.size[2]} />
      : index !== 2 && box.bodyMaterialId
        ? <SurfaceMaterial key={index} attach={`material-${index}`} color={selected ? '#43b6a0' : '#ffffff'} id={box.bodyMaterialId}
          width={index < 2 ? box.size[2] : box.size[0]} height={index === 3 ? box.size[2] : box.size[1]} />
      : index === 2 && box.topColor
        ? box.role === 'wall'
          ? <meshStandardMaterial key={index} attach={`material-${index}`} color={color} roughness={.85} />
          : <meshBasicMaterial key={index} attach={`material-${index}`} color={color} toneMapped={false} />
      : <SurfaceMaterial key={index} attach={`material-${index}`} color={color} id={index >= 4 ? box.sideMaterials?.[index - 4] : undefined}
        width={box.size[0]} height={box.size[1]} offsetX={box.textureOffset?.[0]} offsetY={box.textureOffset?.[1]} />)
      : <meshStandardMaterial emissive={box.emissive} emissiveIntensity={box.emissive ? 2 : 0} color={selected ? '#43b6a0' : box.color}
        roughness={box.appearance === 'powder-coated-metal' ? .42 : box.role === 'glass' ? .08 : box.role === 'seal' ? .38 : box.shape === 'hip-roof' ? .92 : .7}
        metalness={box.appearance === 'powder-coated-metal' ? .65 : box.role === 'rail' ? .5 : box.role === 'glass' ? .18 : box.role === 'seal' ? .12 : 0}
        envMapIntensity={box.role === 'glass' ? 1.6 : 1}
        transparent={clear} opacity={box.opacity ?? (box.role === 'glass' ? .38 : 1)}
        depthWrite={!clear} />}
    {selected && colors && <Edges color="#087f75" />}
  </mesh>
    {box.shape === 'hip-roof' && <group position={box.position} rotation={[0, box.rotation, 0]}>
      <HipRoofSeams size={box.size} color={box.color} selected={selected} />
    </group>}
  </>;
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
      : ramp.bodyMaterialId ? <SurfaceMaterial key={face} attach={`material-${face}`} id={ramp.bodyMaterialId}
        color={selected ? '#43b6a0' : '#ffffff'} width={face === 0 || face === 1 ? ramp.depth : ramp.width}
        height={face === 3 ? ramp.depth : Math.max(ramp.baseHeight, .02)} />
      : <meshStandardMaterial key={face} attach={`material-${face}`} color={selected ? '#43b6a0' : structuralColor} roughness={.75} />)}
  </mesh>;
  const { vertices, indices } = rampPrismGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
  const body = ramp.bodyMaterialId ? rampBodySurfaceGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight) : undefined;
  const surface = rampSurfaceGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
  return <group position={ramp.position} rotation={[0, ramp.rotation, 0]} onClick={select}>
    <mesh castShadow receiveShadow><bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[body?.vertices ?? vertices, 3]} />
      {body && <><bufferAttribute attach="attributes-uv" args={[body.uvs, 2]} />
        <bufferAttribute attach="attributes-normal" args={[body.normals, 3]} /></>}
      <bufferAttribute attach="index" args={[body?.indices ?? indices, 1]} />
    </bufferGeometry>
      {ramp.bodyMaterialId ? <SurfaceMaterial id={ramp.bodyMaterialId} color={selected ? '#43b6a0' : '#ffffff'} width={1} height={1} doubleSide />
        : <meshStandardMaterial color={selected ? '#43b6a0' : structuralColor} roughness={.75} side={2} />}</mesh>
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
      {surfaceMaterial(polygon.floorFinish.undersideTexture)
        ? <SurfaceMaterial attach="material-1" color={selected ? '#43b6a0' : polygon.sideColor ?? '#ffffff'}
          id={polygon.floorFinish.undersideTexture} width={1} height={1} />
        : <meshStandardMaterial attach="material-1" color={selected ? '#43b6a0' : polygon.sideColor ?? '#756f66'} roughness={.85} />}
    </> : <FloorMaterial finish={polygon.floorFinish} /> : polygon.topColor || polygon.edgeFinishes ? <>
      {polygon.role === 'wall' || polygon.role === 'junction'
        ? <meshStandardMaterial attach="material-0" color={polygon.color} roughness={.85} />
        : <meshBasicMaterial attach="material-0" color={polygon.topColor ?? polygon.color} toneMapped={false} />}
      <meshStandardMaterial attach="material-1" color={polygon.color} roughness={.85} visible={!polygon.edgeFinishes} />
    </> : <meshStandardMaterial color={selected ? '#43b6a0' : polygon.color} roughness={.85} />}
    {selected && polygon.role === 'floor' && <Edges color="#087f75" />}
  </mesh>
    {polygon.floorFinish && polygon.height > 0 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, polygon.elevation - .001, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <FloorMaterial finish={polygon.floorFinish} textureId={polygon.floorFinish.undersideTexture ?? 'none'}
        color={polygon.sideColor ?? '#756f66'} doubleSide />
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
