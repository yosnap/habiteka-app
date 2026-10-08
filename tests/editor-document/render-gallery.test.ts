import { describe, expect, it } from 'vitest';
import type { Deliverable } from '@/lib/contracts';
import { groupDeliverables, renderImageLabel } from '@/lib/editor-document/render-gallery';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';

const render = (id: string, batchId?: string, zoneId: string | null = null): Deliverable & { zoneId: string | null } => ({
  id, zoneId, type: 'render3d', version: 1, legalSeal: 'conceptual', payload: { type: 'render3d', assetUrl: '/image.png',
    generation: { promptVersion: 'test', documentRevision: 1, batchId } },
});

describe('galería de tandas', () => {
  it.each([
    ['all', 'Toda la planta'], ['house', 'Solo la casa'], ['interior', 'Interiores'],
    ['exterior', 'Exterior'], ['rooms', 'Estancias seleccionadas'], ['zone', 'Zonas seleccionadas'],
  ] as const)('identifica el ámbito %s sin confundirlo con el inmueble completo', (designScope, zone) => {
    const image = render('scope');
    if (image.payload.type !== 'render3d') throw new Error('fixture');
    image.payload.generation!.options = { ...defaultRenderDesignOptions(), designScope };
    expect(renderImageLabel(image).zone).toBe(zone);
  });
  it('no inventa el ámbito de una imagen antigua sin opciones', () => {
    expect(renderImageLabel(render('old')).zone).toBe('Ámbito sin registrar');
  });
  it('identifica el exterior terminado sin llamarlo isométrica abierta', () => {
    const image = render('roof', 'batch');
    if (image.payload.type !== 'render3d') throw new Error('fixture');
    image.payload.generation!.view = { preset: 'exterior', cutaway: false, ceilingView: 'solid' } as RenderView;
    expect(renderImageLabel(image).view).toBe('Exterior terminado');
  });
  it('reúne siete vistas en un bloque sin mezclar otra tanda intercalada', () => {
    const images = Array.from({ length: 7 }, (_, i) => render(`view-${i}`, 'batch-a'));
    const other = render('other', 'batch-b');
    const groups = groupDeliverables([images[0]!, other, ...images.slice(1)]);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([images.map(item => item.id), ['other']]);
  });
  it('separa zonas y resultados antiguos sin id de tanda', () => {
    const groups = groupDeliverables([render('a', 'same'), render('b', 'same', 'zone'), render('old-a'), render('old-b')]);
    expect(groups).toHaveLength(4);
  });
  it('identifica la estancia y el ángulo trasero aunque no exista ámbito seleccionado', () => {
    const image = render('back', 'batch');
    if (image.payload.type !== 'render3d') throw new Error('fixture');
    image.payload.generation!.view = { preset: 'back', roomName: 'Dormitorio' } as RenderView;
    expect(renderImageLabel(image)).toEqual({ zone: 'Dormitorio', view: 'Trasera' });
  });
  it('distingue cámara interior, zonas seleccionadas y ángulos antiguos desconocidos', () => {
    const image = render('room');
    if (image.payload.type !== 'render3d') throw new Error('fixture');
    image.payload.generation!.view = { preset: 'custom', roomName: 'Salón' } as RenderView;
    expect(renderImageLabel(image).view).toBe('Interior · altura de ojos');
    image.payload.generation!.view = { preset: 'top' } as RenderView;
    image.payload.generation!.options = { ...defaultRenderDesignOptions(), placement: 'selected',
      regions: [{ id: 'z', name: 'Dormitorio principal', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }] };
    expect(renderImageLabel(image)).toEqual({ zone: 'Dormitorio principal', view: 'Cenital' });
    expect(renderImageLabel(render('old')).view).toBe('Vista sin registrar');
  });
});
