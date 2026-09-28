import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { selectedViewImagePrompt, projectVehicleCount } from '@/server/agent/editor-v2/selected-view-image-prompt';

const document = { ...emptyEditorDocument(), designSpaceKind: 'patio' as const };
const view = { preset: 'isometric' } as RenderView;

describe('instrucción de imagen basada en la captura', () => {
  it('prioriza cámara y geometría sin enviar el inventario completo', () => {
    const text = selectedViewImagePrompt(document, view, 'moderno', defaultRenderDesignOptions(), '', '', false);
    expect(text).toContain('MISMA cámara (Isométrica)');
    expect(text).toContain('conserva tamaño y posición del inmueble');
    expect(text).toContain('No añadas objetos nuevos');
    expect(text).toContain('conserva TODOS los muros');
    expect(text).toContain('Conserva las hojas de puerta con la apertura');
    expect(text).toContain('materiales y contornos nítidos');
    expect(text).not.toContain('DATOS DEL PROYECTO');
    expect(text.length).toBeLessThan(2500);
  });

  it('explica la máscara y exige que exista al limitar adiciones a zonas', () => {
    const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const,
      placement: 'selected' as const, regions: [{ id: 'sala', name: 'Sala', polygon: [
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 },
      ] }] };
    expect(() => selectedViewImagePrompt(document, view, 'moderno', options, '', '', false)).toThrow('máscara');
    expect(() => selectedViewImagePrompt(document, view, 'moderno', { ...options, freedom: 'strict' }, '', '', false)).toThrow('máscara');
    const prompt = selectedViewImagePrompt(document, view, 'moderno', options, '', '', true);
    expect(prompt).toContain('ÚNICAMENTE la zona elegida');
    expect(prompt).toContain('Fuera del blanco deja fondo gris claro vacío');
    expect(prompt).toContain('no recrees otras estancias');
  });

  it('identifica los vehículos para que el modelo no los convierta en muebles', () => {
    const withCars = { ...document, furniture: [{ kind: 'coche' }, { kind: 'coche' }, { kind: 'coche' }] } as typeof document;
    expect(projectVehicleCount(withCars)).toBe(3);
    expect(selectedViewImagePrompt(withCars, view, 'moderno', defaultRenderDesignOptions(), '', '', false))
      .toContain('3 coches');
  });

  it('distingue vivienda terminada de maqueta y preserva el fondo neutro en modo estricto', () => {
    const finished = { ...view, preset: 'drone' as const, cutaway: false, ceilingView: 'solid' as const };
    const text = selectedViewImagePrompt(document, finished, 'moderno', defaultRenderDesignOptions(), '', '', false);
    expect(text).toContain('VISTA EXTERIOR TERMINADA');
    expect(text).toContain('El fondo liso de la captura NO representa un terreno diseñado');
    expect(text).not.toContain('Respeta los cortes de la maqueta');
  });

  it('no describe una cámara interior como maqueta cortada', () => {
    const options = { ...defaultRenderDesignOptions(), interiorRoomIds: ['salon'] };
    const text = selectedViewImagePrompt(document, { ...view, preset: 'custom' }, 'moderno', options, '', '', false);
    expect(text).toContain('VISTA INTERIOR A ALTURA DE OJOS');
    expect(text).not.toContain('Respeta los cortes de la maqueta');
    expect(text).not.toContain('El fondo liso de la captura');
  });
});
