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
    expect(text).not.toContain('DATOS DEL PROYECTO');
    expect(text.length).toBeLessThan(2500);
  });

  it('explica la máscara y exige que exista al limitar adiciones a zonas', () => {
    const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const,
      placement: 'selected' as const, regions: [{ id: 'sala', name: 'Sala', polygon: [
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 },
      ] }] };
    expect(() => selectedViewImagePrompt(document, view, 'moderno', options, '', '', false)).toThrow('máscara');
    const prompt = selectedViewImagePrompt(document, view, 'moderno', options, '', '', true);
    expect(prompt).toContain('Imagen 2 es una máscara de posición');
    expect(prompt).toContain('El negro está bloqueado');
    expect(prompt).toContain('piscina, aparcamiento, vallas y exteriores');
  });

  it('identifica los vehículos para que el modelo no los convierta en muebles', () => {
    const withCars = { ...document, furniture: [{ kind: 'coche' }, { kind: 'coche' }, { kind: 'coche' }] } as typeof document;
    expect(projectVehicleCount(withCars)).toBe(3);
    expect(selectedViewImagePrompt(withCars, view, 'moderno', defaultRenderDesignOptions(), '', '', false))
      .toContain('3 coches');
  });
});
