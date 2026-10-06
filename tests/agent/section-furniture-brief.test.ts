/**
 * El generador no traduce bien la cenital girada a la vista frontal: una lectura previa describe cada estancia como la
 * verá la cámara; si falta una lectura completa, se detiene antes de generar.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import { sectionFurnitureBrief } from '@/server/agent/editor-v2/section-furniture-brief';

const top = { base64: 'aW1n', mimeType: 'image/png' };
const adapter = (chat: (request: ChatRequest) => Promise<unknown>) => ({ chat: vi.fn(chat), chatStream: vi.fn() }) as unknown as ChatVisionAdapter & { chat: ReturnType<typeof vi.fn> };

describe('lectura del mobiliario de la sección', () => {
  it('devuelve una línea por estancia en el orden de la sección e ignora las que no reconoce', async () => {
    const vision = adapter(async () => ({ structured: { rooms: [
      { name: 'Dormitorio 2', furniture: 'cama individual de espaldas, cabecero delante' },
      { name: 'Salón', furniture: 'sofá en L al fondo' }, { name: 'Comedor', furniture: 'mesa rectangular de perfil' }, { name: 'Pasillo', furniture: 'alfombra' }] } }));
    expect(await sectionFurnitureBrief(vision, top, ['Salón', 'Dormitorio 2', 'Comedor']))
      .toEqual(['Salón: sofá en L al fondo', 'Dormitorio 2: cama individual de espaldas, cabecero delante', 'Comedor: mesa rectangular de perfil']);
    const request = vision.chat.mock.calls[0]![0] as ChatRequest;
    expect(request.reasoning).toEqual({ effort: 'low' });
    expect((request.messages[0]!.content[0] as { text: string }).text).toContain('de izquierda a derecha: Salón, Dormitorio 2, Comedor');
  });
  it('detiene antes de generar si no se puede leer el diseño aceptado', async () => {
    const vision = adapter(async () => { throw new Error('schema'); });
    await expect(sectionFurnitureBrief(vision, top, ['Salón'])).rejects.toThrow('antes de generar');
  });
  it('rechaza una lectura incompleta y no reutiliza una descripción para dos estancias con el mismo nombre', async () => {
    const vision = adapter(async () => ({ structured: { rooms: [{ name: 'Baño', furniture: 'lavabo' }] } }));
    await expect(sectionFurnitureBrief(vision, top, ['Baño', 'Baño'])).rejects.toThrow('todas las estancias');
    await expect(sectionFurnitureBrief(vision, top, ['Baño', 'Salón'])).rejects.toThrow('todas las estancias');
  });
});
