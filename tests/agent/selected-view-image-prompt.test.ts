import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { selectedViewImagePrompt, projectVehicleCount, designContractRule } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';

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

  it('conserva la unión y el color de una cocina en L', () => {
    const first = kitchenRunDefaults({ id: 'a', x: 0, y: 0, widthMm: 2000, rotation: 0 });
    const second = kitchenRunDefaults({ id: 'b', x: 2000, y: 0, widthMm: 2000, rotation: 90 });
    const options = { ...defaultRenderDesignOptions(), placement: 'selected' as const,
      regions: [{ id: 'cocina', name: 'Cocina', polygon: [
        { x: -100, y: -100 }, { x: 3000, y: -100 }, { x: 3000, y: 3000 }, { x: -100, y: 3000 },
      ] }] };
    const text = selectedViewImagePrompt({ ...document, kitchenRuns: [first, second] }, view,
      'moderno', options, '', '', true);
    expect(text).toContain('unión continua, sin huecos');
    expect(text).toContain('el mismo color #e0dbcf');
    expect(selectedViewImagePrompt({ ...document, kitchenRuns: [first, second] }, view,
      'moderno', defaultRenderDesignOptions(), '', '', false)).not.toContain('La cocina en L');
  });

  // Cada vista es una consulta independiente: los acabados del diseño viajan en todas para que no se reinventen.
  it('fija los mismos acabados del diseño en todas las vistas', () => {
    const base = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true));
    const withWalls = { ...base, designSpaceKind: 'patio' as const,
      walls: base.walls.map((wall) => ({ ...wall, materials: { left: 'polyhaven:white_plaster_02', right: 'polyhaven:white_plaster_02' } })) };
    const rule = designContractRule(withWalls);
    expect(rule).toContain('DISEÑO FIJADO, IGUAL EN TODAS LAS VISTAS');
    expect(rule).toContain('muros:');
    const top = selectedViewImagePrompt(withWalls, { preset: 'top' } as RenderView, 'moderno', defaultRenderDesignOptions(), '', '', false);
    const front = selectedViewImagePrompt(withWalls, { preset: 'front' } as RenderView, 'moderno', defaultRenderDesignOptions(), '', '', false);
    expect(top).toContain(rule);
    expect(front).toContain(rule);
  });

  it('no añade el contrato si el proyecto aún no tiene acabados', () => {
    expect(designContractRule(document)).toBeUndefined();
  });

  // La ancla enseña materiales y ambiente de otra vista; nunca el encuadre.
  it('describe la imagen ancla solo como referencia de estilo, con el número correcto', () => {
    const conAncla = selectedViewImagePrompt(document, view, 'moderno', defaultRenderDesignOptions(), '', '', false, true);
    expect(conAncla).toContain('La imagen 2 es otra vista ya aceptada del MISMO diseño');
    expect(conAncla).toContain('SOLO como referencia de materiales');
    expect(conAncla).toContain('no copies el encuadre');
    const conMascara = selectedViewImagePrompt(document, view, 'moderno', { ...defaultRenderDesignOptions(), placement: 'selected', regions: [{ id: 's', name: 'S', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }] }, '', '', true, true);
    expect(conMascara).toContain('La imagen 3 es otra vista ya aceptada');
    expect(selectedViewImagePrompt(document, view, 'moderno', defaultRenderDesignOptions(), '', '', false)).not.toContain('otra vista ya aceptada');
  });
});
