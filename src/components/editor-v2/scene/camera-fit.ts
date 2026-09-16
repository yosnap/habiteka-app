import { Vector3 } from 'three';

/** Fit the eight bounds corners in camera space, not an oversized bounding sphere. */
export function cameraFitDistance(extent: Vector3, direction: Vector3, verticalFov: number, aspect: number, margin = 1.08): number {
  const backward = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), backward);
  if (right.lengthSq() < 1e-10) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(backward, right).normalize();
  const tanY = Math.tan(verticalFov / 2), tanX = tanY * aspect;
  let distance = .3;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const corner = new Vector3(x * extent.x / 2, y * extent.y / 2, z * extent.z / 2);
    const depth = corner.dot(backward);
    distance = Math.max(distance, depth + margin * Math.abs(corner.dot(right)) / tanX,
      depth + margin * Math.abs(corner.dot(up)) / tanY);
  }
  return distance;
}
