import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraFitDistance } from '@/components/editor-v2/scene/camera-fit';

describe('encuadre ajustado a pantalla', () => {
  for (const aspect of [.6, 1, 2.2]) for (const direction of [new Vector3(0, 1, .0001), new Vector3(1, 1, 1), new Vector3(0, 0, 1), new Vector3(1, 2, 1)]) {
    it(`mantiene todas las esquinas visibles ${aspect}/${direction.toArray()}`, () => {
      const extent = new Vector3(14, 3, 8);
      const camera = new PerspectiveCamera(45, aspect, .01, 1000);
      const distance = cameraFitDistance(extent, direction, Math.PI / 4, aspect);
      camera.position.copy(direction).normalize().multiplyScalar(distance);
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      let occupied = 0;
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const projected = new Vector3(x * 7, y * 1.5, z * 4).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        occupied = Math.max(occupied, Math.abs(projected.x), Math.abs(projected.y));
      }
      expect(occupied).toBeGreaterThan(.9);
    });
  }
});
