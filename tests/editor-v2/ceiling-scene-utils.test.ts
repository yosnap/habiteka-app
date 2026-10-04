import { describe, expect, it } from 'vitest';
import { ShapeGeometry, Group, Vector3 } from 'three';
import { captureCeilingView, captureCutaway, ceilingShape, ceilingShapes, createLuminaireEmitter, presetCeilingView, sceneCoversHidden, temperatureColor } from '../../src/components/editor-v2/scene/ceiling-scene-utils';
import { spotAimPoint } from '../../src/lib/editor-document/ceiling-geometry';

describe('representación de techos e iluminación', () => {
  it('conserva pérgolas en capturas laterales aunque la escena esté en cenital sin techo', () => {
    expect(sceneCoversHidden('top', 'hidden', { ceiling: 'solid', aerial: false }, false)).toBe(false);
    expect(sceneCoversHidden('front', 'solid', { ceiling: 'hidden', aerial: true }, false)).toBe(true);
    expect(sceneCoversHidden('top', 'hidden', null, false)).toBe(true);
    expect(sceneCoversHidden('top', 'hidden', null, true)).toBe(false);
  });
  it('recorta el techo inferior con un hueco transitable para la escalera', () => {
    const shapes = ceilingShapes([
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 },
    ], [[{ x: 1000, y: 1000 }, { x: 2000, y: 1000 }, { x: 2000, y: 3500 }, { x: 1000, y: 3500 }]]);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.holes).toHaveLength(1);
    const geometry = new ShapeGeometry(shapes);
    const positions = geometry.getAttribute('position'), indices = geometry.index!;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
      area += Math.abs((positions.getX(b) - positions.getX(a)) * (positions.getY(c) - positions.getY(a))
        - (positions.getY(b) - positions.getY(a)) * (positions.getX(c) - positions.getX(a))) / 2;
    }
    expect(area).toBeCloseTo(21.5);
    geometry.dispose();
  });
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
  it('orienta el haz del foco al mismo punto que marca el símbolo 2D', () => {
    for (const [tiltDeg, azimuthDeg] of [[0, 0], [30, 0], [45, 90], [60, 200], [30, 315]] as const) {
      const luminaire = { id: 'light', ceilingId: 'ceiling', kind: 'spot' as const, x: 2000, y: 1500,
        dropMm: 0, color: '#ffffff', temperatureK: 3000, lumens: 550, enabled: true,
        mount: 'surface' as const, tiltDeg, azimuthDeg };
      const light = createLuminaireEmitter(luminaire);
      const fixture = new Group();
      fixture.position.set(2, 2.5, 1.5);
      fixture.add(light, light.target);
      fixture.updateMatrixWorld(true);
      const origin = light.getWorldPosition(new Vector3());
      const direction = light.target.getWorldPosition(new Vector3()).sub(origin).normalize();
      // El haz llega al suelo justo donde `spotAimPoint` lo sitúa en el plano.
      const ground = origin.clone().addScaledVector(direction, 2.5 / -direction.y);
      const aim = spotAimPoint({ luminaire, heightMm: 2500, floorElevationMm: 0 });
      expect(ground.x).toBeCloseTo(aim.x / 1000);
      expect(ground.z).toBeCloseTo(aim.y / 1000);
      expect(light.angle).toBeCloseTo(30 * Math.PI / 180);
      expect(light.penumbra).toBeCloseTo(.35);
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
  it('retira techo y tejado de los alzados que se capturan para diseñar', () => {
    const context = { cutaway: true, cameraHeightM: 6, highestCeilingM: 2.7, forDesign: true };
    for (const view of ['front', 'back', 'left', 'right']) {
      expect(captureCeilingView(view, context)).toBe('hidden');
      expect(captureCeilingView(view, { ...context, forDesign: false })).toBe('solid');
    }
    expect(captureCeilingView('exterior', context)).toBe('solid');
  });
  it('mantiene fachada y cubierta en Exterior terminado aunque la vista viva esté seccionada', () => {
    expect(captureCutaway('exterior', true)).toBe(false);
    expect(captureCeilingView('exterior', { cutaway: true, cameraHeightM: 9, highestCeilingM: 3, forDesign: true })).toBe('solid');
    expect(sceneCoversHidden('isometric', 'hidden', { ceiling: 'solid', aerial: false }, false)).toBe(false);
  });
  it('oculta cubierta en dron y abre fachadas independientemente de que exista un tejado', () => {
    const context = { cutaway: false, cameraHeightM: 9, highestCeilingM: 3 };
    expect(captureCeilingView('drone', context)).toBe('hidden');
    expect(captureCutaway('front', false)).toBe(true);
    expect(captureCutaway('right', false)).toBe(true);
  });
  it('adapta el techo al cambiar entre maqueta y vistas exteriores terminadas', () => {
    for (const view of ['front', 'back', 'left', 'right']) {
      expect(presetCeilingView(view, 'transparent')).toBe('solid');
      expect(presetCeilingView(view, 'hidden')).toBe('solid');
    }
    expect(presetCeilingView('isometric', 'solid')).toBe('hidden');
    expect(presetCeilingView('top', 'solid')).toBe('hidden');
    expect(presetCeilingView('drone', 'solid')).toBe('hidden');
    expect(presetCeilingView('fit', 'solid')).toBe('solid');
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
  it('abre solo los alzados aunque el 3D muestre todos los muros', () => {
    for (const view of ['front', 'back', 'left', 'right']) expect(captureCutaway(view, false)).toBe(true);
  });
  it('conserva todos los muros en cenital, isométrica y dron', () => {
    for (const view of ['top', 'isometric', 'drone']) {
      expect(captureCutaway(view, false)).toBe(false);
      expect(captureCutaway(view, true)).toBe(false);
    }
  });
  it('respeta la elección del usuario en vista libre', () => {
    for (const view of ['custom', 'current', null]) {
      expect(captureCutaway(view, false)).toBe(false);
      expect(captureCutaway(view, true)).toBe(true);
    }
  });
});
