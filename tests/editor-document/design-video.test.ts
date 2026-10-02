import { describe, expect, it } from 'vitest';
import { defaultDesignVideoReferenceIds, designConstructionPrompt, designVideoEstimate, designVideoReferenceRole, type DesignVideoReference } from '@/lib/editor-document/design-video';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';

describe('construcción basada en diseños', () => {
  const settings = { presentation: DEFAULT_VIDEO_PRESENTATION, resolution: '768P' as const };
  const reference = (id: string, preset: DesignVideoReference['preset'], extra: Partial<DesignVideoReference> = {}): DesignVideoReference => ({
    id, preset, name: 'Conjunto', view: preset ?? 'Actual', batchId: 'batch', revision: 7, scope: 'all', closedRoof: preset === 'exterior',
    url: 'https://example.com/design.png', zones: ['Patio', 'Rampa'], ...extra,
  });
  it('propone solo distribución y exterior válido de una tanda, sin arrastrar vistas descartadas', () => {
    const images = [reference('rejected', 'exterior', { issue: 'Fachada abierta', batchId: 'bad' }), reference('roof', 'exterior'),
      reference('side', 'left'), reference('top', 'top'), reference('other', 'top', { batchId: 'other' })];
    expect(defaultDesignVideoReferenceIds(images)).toEqual(['top', 'roof']);
    expect(designVideoEstimate(settings, defaultDesignVideoReferenceIds(images).length).usd).toBe(.32);
  });
  it('prioriza la cenital sobre una isométrica y mantiene sus índices aunque el exterior vaya primero', () => {
    const images = [reference('roof', 'exterior'), reference('oblique', 'isometric'), reference('top', 'top')];
    const prompt = designConstructionPrompt('daylight', settings, images, 'exactamente 2 escaleras');
    expect(designVideoReferenceRole(images[2]!, images)).toBe('Distribución y muebles');
    expect(designVideoReferenceRole(images[0]!, images)).toBe('Fachadas y tejado');
    expect(prompt).toContain('La referencia 3 es la fuente principal');
    expect(prompt).toContain('La referencia 1 fija fachadas cerradas');
    expect(prompt).toContain('seguir únicamente la referencia 3');
    expect(prompt).toContain('no forzar una vuelta completa');
    expect(prompt).toContain('exactamente 2 escaleras');
  });
  it('sin distribución válida no propone otras tandas para rellenar la selección', () => {
    expect(defaultDesignVideoReferenceIds([reference('roof', 'exterior'), reference('old-top', 'top', { batchId: 'old' })])).toEqual(['roof']);
    expect(defaultDesignVideoReferenceIds([reference('top', 'top', { issue: 'Tabique oculto' })])).toEqual([]);
  });
  it('conserva las zonas exteriores elegidas y hace que los muebles provengan de imágenes', () => {
    const reference: DesignVideoReference = { id: 'design', name: 'Conjunto aprobado', view: 'Cenital', batchId: 'batch', revision: 7,
      scope: 'all', closedRoof: false, url: 'https://example.com/design.png', zones: ['Patio', 'Rampa', 'Escalera', 'Baño exterior'] };
    const prompt = designConstructionPrompt('daylight', settings, [reference]);
    for (const name of reference.zones) expect(prompt).toContain(name);
    expect(prompt).toContain('cuatro camas'); expect(prompt).toContain('No recuperar el mobiliario de la maqueta');
    expect(prompt).toContain('8 segundos en total'); expect(prompt).toContain('3 segundos en conjunto');
  });
  it('presupuesta salida y referencias extra sin cobrar vídeo de entrada inexistente', () => {
    expect(designVideoEstimate(settings, 5)).toEqual({ usd: .32, credits: 32 });
    expect(designVideoEstimate(settings, 6)).toEqual({ usd: .34, credits: 34 });
    expect(designVideoEstimate({ ...settings, resolution: '2K' }, 6)).toEqual({ usd: .54, credits: 54 });
    expect(designVideoEstimate({ ...settings, presentation: { ...settings.presentation, constructionDurationSeconds: 12 } }, 5).usd).toBe(.48);
  });
});
