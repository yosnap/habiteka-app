import { describe, expect, it, vi } from 'vitest';
import type { ChatVisionAdapter } from '@/lib/contracts';
import { auditIsolatedReference } from '@/server/agent/editor-v2/isolated-reference-audit';
const candidate = { base64: 'candidate', mimeType: 'image/png' };
const check = { index: 0, status: 'changed', candidate: 'Cómoda visible al fondo', evidence: 'Centro de la puerta' };
describe('referencia sin contaminación de la candidata', () => {
  it('conserva la referencia aunque la IA intente sobrescribirla', async () => {
    const chat = vi.fn().mockResolvedValue({ structured: { checks: [{ ...check, reference: 'Cómoda aceptada' }] } });
    const result = await auditIsolatedReference({ chat } as unknown as ChatVisionAdapter, candidate, ['Paso vacío'], 'Puerta central');
    expect(result[0]).toMatchObject({ reference: 'Paso vacío', status: 'changed' });
    expect(chat.mock.calls[0]![0].messages[0].content.filter((part: { type: string }) => part.type === 'image_url'))
      .toEqual([{ type: 'image_url', ...candidate }]);
  });
  it.each([[], [{ ...check, index: 1 }], [check, check]].map(checks => ({ checks })))('bloquea índices incompletos: %j', ({ checks }) => {
    const chat = vi.fn().mockResolvedValue({ structured: { checks } });
    return expect(auditIsolatedReference({ chat } as unknown as ChatVisionAdapter, candidate, ['Paso vacío'], '')).rejects.toThrow('no cubrió');
  });
});
