/**
 * El generador no traduce bien la cenital girada a la vista frontal: una lectura previa describe cada estancia como la
 * verá la cámara, y si falla el alzado sigue sin ella.
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
      { name: 'Salón', furniture: 'sofá en L al fondo' }, { name: 'Pasillo', furniture: 'alfombra' }] } }));
    expect(await sectionFurnitureBrief(vision, top, ['Salón', 'Dormitorio 2', 'Comedor']))
      .toEqual(['Salón: sofá en L al fondo', 'Dormitorio 2: cama individual de espaldas, cabecero delante']);
    const request = vision.chat.mock.calls[0]![0] as ChatRequest;
    expect(request.reasoning).toEqual({ effort: 'low' });
    expect((request.messages[0]!.content[0] as { text: string }).text).toContain('de izquierda a derecha: Salón, Dormitorio 2, Comedor');
  });
  it('no bloquea el alzado si la lectura falla', async () => {
    const vision = adapter(async () => { throw new Error('schema'); });
    expect(await sectionFurnitureBrief(vision, top, ['Salón'])).toEqual([]);
  });
});
