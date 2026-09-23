import { describe, expect, it } from 'vitest';
import { ShapeGeometry, Group, Vector3 } from 'three';
import { captureCeilingView, captureCutaway, ceilingShape, createLuminaireEmitter, temperatureColor } from '../../src/components/editor-v2/scene/ceiling-scene-utils';

describe('representación de techos e iluminación', () => {
  it('triangula un techo cóncavo en metros sin rellenar el hueco exterior', () => {
    const geometry = new ShapeGeometry(ceilingShape([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 2000 },
      { x: 2000, y: 2000 }, { x: 2000, y: 4000 }, { x: 0, y: 4000 },
    ]));
    const positions = geometry.getAttribute('position');
    const indices = geometry.index!;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
      area += Math.abs((positions.getX(b) - positions.getX(a)) * (positions.getY(c) - positions.getY(a))
        - (positions.getY(b) - positions.getY(a)) * (positions.getX(c) - positions.getX(a))) / 2;
    }
    expect(area).toBeCloseTo(12);
    geometry.dispose();
  });
  it('ancla el haz y sus sombras a la luminaria incluso al trasladar la planta', () => {
    for (const kind of ['recessed', 'flush', 'pendant'] as const) {
      const light = createLuminaireEmitter({ id: 'light', ceilingId: 'ceiling', kind,
        x: 9000, y: 4200, dropMm: 0, color: '#ffffff', temperatureK: 3000, lumens: 800, enabled: true });
      const floor = new Group(), fixture = new Group();
      floor.position.y = 3;
      fixture.position.set(9, 2.55, 4.2);
      floor.add(fixture);
      fixture.add(light, light.target);
      floor.updateMatrixWorld(true);
      const origin = light.getWorldPosition(new Vector3());
      const direction = light.target.getWorldPosition(new Vector3()).sub(origin).normalize();
      expect(origin.x).toBeCloseTo(9);
      expect(origin.y).toBeCloseTo(5.525);
      expect(origin.z).toBeCloseTo(4.2);
      expect(direction.toArray()).toEqual([0, -1, 0]);
      expect(light.castShadow).toBe(true);
      expect(light.power).toBeCloseTo(800);
      expect(light.angle).toBeLessThan(Math.PI / 2);
      expect(light.shadow.camera.near).toBeLessThan(.025);
      light.shadow.updateMatrices(light);
      expect(light.shadow.camera.position.distanceTo(origin)).toBeCloseTo(0);
      expect(light.shadow.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeCloseTo(0);
      fixture.position.x += 2;
      floor.updateMatrixWorld(true);
      light.shadow.updateMatrices(light);
      expect(light.shadow.camera.position.x).toBeCloseTo(11);
      expect(light.shadow.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeCloseTo(0);
      light.dispose();
    }
  });
  it('diferencia luz cálida y fría y produce colores finitos en los extremos', () => {
    expect(temperatureColor(2700).b).toBeLessThan(temperatureColor(6500).b);
    for (const kelvin of [-500, 2700, 6500, 50000]) {
      expect(temperatureColor(kelvin).toArray().every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    }
  });
  it('oculta techos en capturas aéreas y los conserva en interiores', () => {
    for (const view of ['top', 'isometric', 'drone']) expect(captureCeilingView(view)).toBe('hidden');
    for (const view of ['front', 'back', 'left', 'right', null]) expect(captureCeilingView(view)).toBe('solid');
  });
  it('oculta techo en órbita libre por encima del edificio solo con corte activo', () => {
    const context = { cutaway: true, cameraHeightM: 8, highestCeilingM: 5.4 };
    for (const view of [null, 'current', 'custom']) expect(captureCeilingView(view, context)).toBe('hidden');
    expect(captureCeilingView(null, { ...context, cameraHeightM: 4 })).toBe('solid');
    expect(captureCeilingView(null, { ...context, cameraHeightM: 5.4 })).toBe('solid');
    expect(captureCeilingView(null, { ...context, cutaway: false })).toBe('solid');
    // Para diseñar con IA, desde encima del techo nunca se manda la losa.
    expect(captureCeilingView('current', { ...context, cutaway: false, forDesign: true })).toBe('hidden');
    expect(captureCeilingView('current', { ...context, cutaway: false, forDesign: true, cameraHeightM: 1.6 })).toBe('solid');
    expect(captureCeilingView(null, { ...context, highestCeilingM: null })).toBe('solid');
    expect(captureCeilingView('front', context)).toBe('solid');
    expect(captureCeilingView('top', { ...context, cameraHeightM: 1, cutaway: false })).toBe('hidden');
  });

});

describe('recorte de muros en capturas', () => {
  it('fuerza el recorte en alzados e isométrica aunque el 3D muestre todos los muros', () => {
    for (const view of ['front', 'back', 'left', 'right', 'isometric']) expect(captureCutaway(view, false)).toBe(true);
  });
  it('respeta la elección del usuario en cenital, dron y vista libre', () => {
    for (const view of ['top', 'drone', 'custom', 'current', null]) {
      expect(captureCutaway(view, false)).toBe(false);
      expect(captureCutaway(view, true)).toBe(true);
    }
  });
});
