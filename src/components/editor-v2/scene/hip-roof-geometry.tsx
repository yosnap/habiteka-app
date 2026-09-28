'use client';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Vector3Tuple } from '@/canvas/editor-v2/scene/types';

type Point = [number, number, number];

/** Lona de cuatro aguas con cumbrera sobre el lado largo y canto fino en el alero. */
export function createHipRoofGeometry(width: number, height: number, depth: number): BufferGeometry {
  const short = Math.min(width, depth), long = Math.max(width, depth);
  const halfShort = short / 2, halfLong = long / 2, halfRidge = (long - short) / 2;
  const thickness = Math.min(height * .12, .065);
  const eaveTop = -height / 2 + thickness, eaveBottom = -height / 2;
  const ridgeTop = height / 2, ridgeBottom = height / 2 - thickness;
  // La construcción canónica lleva la cumbrera en Z; se transpone para carpas más anchas que profundas.
  const orient = ([x, y, z]: Point): Point => width <= depth ? [x, y, z] : [z, y, x];
  const positions: number[] = [];
  const face = (points: Point[], outward: Point) => {
    const vertices = points.map(orient), target = orient(outward);
    const [ax, ay, az] = vertices[0]!, [bx, by, bz] = vertices[1]!, [cx, cy, cz] = vertices[2]!;
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const normal: Point = [aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx];
    if (normal[0] * target[0] + normal[1] * target[1] + normal[2] * target[2] < 0) vertices.reverse();
    for (let i = 1; i < vertices.length - 1; i++) positions.push(...vertices[0]!, ...vertices[i]!, ...vertices[i + 1]!);
  };
  const shell = (eave: number, ridge: number, upward: boolean) => {
    const lf: Point = [-halfShort, eave, -halfLong], lb: Point = [-halfShort, eave, halfLong];
    const rf: Point = [halfShort, eave, -halfLong], rb: Point = [halfShort, eave, halfLong];
    const front: Point = [0, ridge, -halfRidge], back: Point = [0, ridge, halfRidge];
    const vertical = upward ? 1 : -1;
    face(halfRidge ? [lf, lb, back, front] : [lf, lb, front], [-1, vertical, 0]);
    face(halfRidge ? [rf, rb, back, front] : [rf, rb, front], [1, vertical, 0]);
    face([lf, rf, front], [0, vertical, -1]);
    face([lb, rb, back], [0, vertical, 1]);
  };
  shell(eaveTop, ridgeTop, true);
  shell(eaveBottom, ridgeBottom, false);
  face([[-halfShort, eaveTop, -halfLong], [-halfShort, eaveTop, halfLong], [-halfShort, eaveBottom, halfLong], [-halfShort, eaveBottom, -halfLong]], [-1, 0, 0]);
  face([[halfShort, eaveTop, -halfLong], [halfShort, eaveTop, halfLong], [halfShort, eaveBottom, halfLong], [halfShort, eaveBottom, -halfLong]], [1, 0, 0]);
  face([[-halfShort, eaveTop, -halfLong], [halfShort, eaveTop, -halfLong], [halfShort, eaveBottom, -halfLong], [-halfShort, eaveBottom, -halfLong]], [0, 0, -1]);
  face([[-halfShort, eaveTop, halfLong], [halfShort, eaveTop, halfLong], [halfShort, eaveBottom, halfLong], [-halfShort, eaveBottom, halfLong]], [0, 0, 1]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function HipRoofGeometry({ size }: { size: Vector3Tuple }) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => createHipRoofGeometry(width, height, depth), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}
