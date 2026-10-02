'use client';
import { useMemo } from 'react';
import { Color, Quaternion, Vector3 } from 'three';
import type { Vector3Tuple } from '@/canvas/editor-v2/scene/types';

type Segment = [Vector3Tuple, Vector3Tuple];

/** Uniones cosidas de los paños, colocadas sobre la lona sin alterar su volumen de paso. */
export function hipRoofSeams([width, height, depth]: Vector3Tuple): Segment[] {
  const short = Math.min(width, depth), long = Math.max(width, depth);
  const halfShort = short / 2, halfLong = long / 2, halfRidge = (long - short) / 2;
  const eave = -height / 2 + Math.min(height * .12, .065);
  const orient = ([x, y, z]: Vector3Tuple): Vector3Tuple => width <= depth ? [x, y, z] : [z, y, x];
  const front = orient([0, height / 2, -halfRidge]);
  const back = orient([0, height / 2, halfRidge]);
  return [
    ...(halfRidge > 0 ? [[front, back] as Segment] : []),
    [orient([-halfShort, eave, -halfLong]), front],
    [orient([halfShort, eave, -halfLong]), front],
    [orient([-halfShort, eave, halfLong]), back],
    [orient([halfShort, eave, halfLong]), back],
  ];
}

export function HipRoofSeams({ size, color, selected }: { size: Vector3Tuple; color: string; selected: boolean }) {
  const segments = useMemo(() => hipRoofSeams(size), [size]);
  const seamColor = useMemo(() => selected ? '#087f75' : `#${new Color(color).lerp(new Color('#aaa69d'), .27).getHexString()}`, [color, selected]);
  return <group raycast={() => undefined}>
    {segments.map(([start, end], index) => {
      const a = new Vector3(...start), b = new Vector3(...end), direction = b.clone().sub(a);
      const midpoint = a.add(b).multiplyScalar(.5);
      const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
      return <mesh key={index} position={midpoint} quaternion={quaternion} castShadow={false} raycast={() => undefined}>
        <cylinderGeometry args={[.008, .008, direction.length(), 6]} />
        <meshStandardMaterial color={seamColor} roughness={.72} />
      </mesh>;
    })}
  </group>;
}
