import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { applyAcceptedIdentityReview, auditAcceptedDesignIdentity } from '@/server/agent/editor-v2/accepted-design-identity-audit';
import type { RenderFidelityReport } from '@/lib/editor-document/render-fidelity';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';
vi.mock('@/server/agent/editor-v2/interior-furniture-brief', () => ({ interiorFurnitureBrief: async () => ({ brief: ['Paso vacío'] }) }));
const isolated = vi.hoisted(() => vi.fn(async () => [] as { element: string; reference: string; candidate: string; status: 'changed'; evidence: string }[]));
vi.mock('@/server/agent/editor-v2/isolated-reference-audit', () => ({ auditIsolatedReference: isolated }));
const report = (): RenderFidelityReport => ({ version: 'test', status: 'passed', checkedAt: '',
  criteria: [{ id: 'objectIdentityPreserved', status: 'pass', observation: 'La revisión general no encontró cambios' }],
  roomChecks: [], openingChecks: [], violations: [] });
const check = { element: 'sillas', reference: 'tapizadas beige con respaldo continuo', candidate: 'listones blancos', evidence: 'El respaldo ha cambiado de forma' };
describe('comparación independiente del diseño aceptado', () => {
  it('un aprobado conjunto no borra la contradicción de la lectura aislada', async () => {
    isolated.mockResolvedValueOnce([{ element: 'Paso', reference: 'Vacío', candidate: 'Cómoda', status: 'changed', evidence: 'Visible en el centro' }]);
    const image = { base64: (await sharp({ create: { width: 64, height: 64, channels: 3, background: '#abc' } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
    const chat = vi.fn().mockResolvedValueOnce({ structured: { observations: [{ group: 'suelo', appearance: 'roble', visiblePieces: [] }] } })
      .mockResolvedValueOnce({ structured: { occlusions: [], comparisons: [{ ...check, status: 'preserved' }] } });
    const result = await auditAcceptedDesignIdentity({ chat } as unknown as ChatVisionAdapter, image, image,
      { preset: 'custom', position: [0, 1.6, 5], quaternion: [0, 0, 0, 1], fov: 75, aspect: 16 / 9, allLevels: false, cutaway: false },
      'interior', [], { acceptedBrief: ['Vacío'], spatial: { units: 'mm', levels: [] } });
    expect(() => applyAcceptedIdentityReview(report(), result)).toThrow(RenderRejectedError);
    expect(isolated).toHaveBeenLastCalledWith(expect.anything(), image, ['Vacío'], expect.any(String));
  });
  it('envía originales y detalles de ambas vistas identificando a quién pertenece cada grupo', async () => {
    const base64 = (await sharp({ create: { width: 2048, height: 866, channels: 3, background: '#abcdef' } }).jpeg().toBuffer()).toString('base64');
    const image = { base64, mimeType: 'image/jpeg' };
    const chat = vi.fn().mockResolvedValueOnce({ structured: { observations: [{ group: 'suelo', appearance: 'roble', visiblePieces: [] }] } })
      .mockResolvedValueOnce({ structured: { occlusions: [], comparisons: [{ ...check, status: 'preserved' }] } });
    await auditAcceptedDesignIdentity({ chat } as unknown as ChatVisionAdapter, image, image,
      { preset: 'custom' } as RenderView, 'interior');
    const inventoryParts = (chat.mock.calls[0]![0] as ChatRequest).messages[0]!.content;
    expect(inventoryParts.filter(part => part.type === 'image_url')).toHaveLength(5);
    const parts = (chat.mock.calls[1]![0] as ChatRequest).messages[0]!.content;
    expect(parts.filter(part => part.type === 'image_url')).toHaveLength(10);
    expect(parts[3]).toMatchObject({ type: 'text', text: 'Ampliaciones de REFERENCIA aceptada (imagen 1).' });
    expect(parts[8]).toMatchObject({ type: 'text', text: 'Ampliaciones de CANDIDATA (imagen 2).' });
  });
  it.each(['changed', 'uncertain'])('un %s invalida un aprobado global y conserva la evidencia', status => {
    const initial = report();
    try { applyAcceptedIdentityReview(initial, { occlusions: [], comparisons: [{ ...check, status }] }); throw new Error('No rechazó'); }
    catch (error) {
      expect(error).toBeInstanceOf(RenderRejectedError);
      expect((error as RenderRejectedError).fidelity?.status).toBe('rejected');
      expect(initial.criteria?.[0]?.status).toBe('fail');
      expect(initial.violations?.join()).toContain('listones blancos');
    }
  });
  it('contrasta el exterior aceptado y las habitaciones detrás de los huecos, sin añadir otra llamada', async () => {
    const image = { base64: (await sharp({ create: { width: 64, height: 64, channels: 3, background: '#abc' } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
    const chat = vi.fn().mockResolvedValueOnce({ structured: { observations: [{ group: 'cama', appearance: 'blanca', visiblePieces: [] }] } })
      .mockResolvedValueOnce({ structured: { occlusions: [], comparisons: [{ ...check, status: 'preserved' }],
        architectureCheck: { ...check, element: 'lucernario', status: 'changed' } } });
    const constraints = { architecture: image, spatial: { units: 'mm' as const,
      roofGlazing: [{ kind: 'glass' as const, footprint: [{ x: 0, y: 0 }] }],
      levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: [{ id: 'window', kind: 'ventana' as const,
        center: { x: 3000, y: 2000 }, widthMm: 1000, heightMm: 1000, connectsRooms: [{ name: 'Estudio', anchor: { x: 3500, y: 2000 } }] }] }] } };
    const result = await auditAcceptedDesignIdentity({ chat } as unknown as ChatVisionAdapter, image, image,
      { preset: 'custom', position: [0, 1.6, 5], quaternion: [0, 0, 0, 1], fov: 75, aspect: 16 / 9,
        allLevels: false, cutaway: false }, 'interior', ['Patio'], constraints);
    const parts = (chat.mock.calls[1]![0] as ChatRequest).messages[0]!.content;
    expect(parts.at(-2)).toMatchObject({ type: 'text', text: expect.stringContaining('REFERENCIA EXTERIOR ACEPTADA') });
    expect(parts.at(-1)).toMatchObject({ type: 'image_url' });
    expect(parts[0]).toMatchObject({ text: expect.stringContaining('Estudio') });
    expect(chat).toHaveBeenCalledTimes(2);
    expect((chat.mock.calls[1]![0] as ChatRequest).responseSchema).toMatchObject({ required: expect.arrayContaining(['architectureCheck']) });
    expect(() => applyAcceptedIdentityReview(report(), result)).toThrow(RenderRejectedError);
  });
  it.each([{}, { comparisons: [] }, { comparisons: [{ ...check, status: 'occluded' }] }])('no certifica una comparación ausente o totalmente oculta', value => {
    expect(() => applyAcceptedIdentityReview(report(), value)).toThrow('No se pudo contrastar');
  });
  it('conserva las observaciones de una coincidencia sin cambiar la aceptación del usuario', () => {
    const result = applyAcceptedIdentityReview(report(), { occlusions: [], comparisons: [{ ...check, candidate: check.reference, status: 'preserved' }] });
    expect(result.status).toBe('passed');
    expect(result.criteria?.[0]?.observation).toContain('Comparación independiente');
    expect(result).not.toHaveProperty('review');
  });
  it('documenta un subconjunto oculto sin certificarlo ni invalidar el subconjunto visible correcto', () => {
    const result = applyAcceptedIdentityReview(report(), {
      occlusions: [{ element: 'fila posterior', hiddenIn: 'candidate', obstacle: 'encimera y frente opacos', location: 'centro superior' }],
      comparisons: [{ ...check, element: 'fila anterior', candidate: check.reference, status: 'preserved' }],
    });
    expect(result.status).toBe('passed');
    expect(result.criteria?.[0]?.observation).toContain('No se certifica su conservación');
  });
  it('una oclusión no borra un cambio visible en el mismo grupo', () => {
    expect(() => applyAcceptedIdentityReview(report(), {
      occlusions: [{ element: 'fila posterior', hiddenIn: 'candidate', obstacle: 'barra', location: 'centro' }],
      comparisons: [{ ...check, element: 'fila anterior', status: 'changed' }],
    })).toThrow(RenderRejectedError);
  });
});
