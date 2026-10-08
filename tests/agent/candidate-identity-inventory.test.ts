import { expect, it, vi } from 'vitest';
import type { ChatVisionAdapter } from '@/lib/contracts';
import { candidateIdentityInventory } from '@/server/agent/editor-v2/candidate-identity-inventory';

const candidate = { base64: 'candidate-only', mimeType: 'image/jpeg' };
it.each([undefined, { observations: [] }, { observations: [{ group: 'sillas', appearance: '', visiblePieces: [] }] }])(
  'bloquea una lectura independiente incompleta', async structured => {
    const chat = { chat: vi.fn().mockResolvedValue({ structured }) } as unknown as ChatVisionAdapter;
    await expect(candidateIdentityInventory(chat, candidate, [])).rejects.toThrow('No se pudo leer por separado');
  });
it('deriva la cantidad de piezas enumeradas y solo envía candidata y sus detalles', async () => {
  const detail = { base64: 'candidate-detail', mimeType: 'image/jpeg' };
  const visiblePieces = [
    { location: '20%, 40%', description: 'respaldo gris' },
    { location: '40%, 30%', description: 'respaldo gris parcialmente tapado' },
  ];
  const chat = vi.fn().mockResolvedValue({ structured: { observations: [{ group: 'sillas', appearance: 'gris', visiblePieces }] } });
  const result = await candidateIdentityInventory({ chat } as unknown as ChatVisionAdapter, candidate, [detail]);
  expect(result[0]?.visibleCount).toBe(2);
  expect(chat.mock.calls[0]![0].messages[0].content.filter((part: { type: string }) => part.type === 'image_url'))
    .toEqual([{ type: 'image_url', ...candidate }, { type: 'image_url', ...detail }]);
});
