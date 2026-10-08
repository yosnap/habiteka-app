/**
 * El prompt de la cenital se traduce al inglés antes de enviarlo. Una traducción incompleta o un fallo del modelo de
 * texto no deben bloquear ni alterar la generación: se envía el original en español.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChatVisionAdapter } from '@/lib/contracts';
import { englishImagePrompt, withEnglishPrompts } from '@/server/agent/editor-v2/english-image-prompt';

const spanish = ['Crea un diseño de interiores moderno con vista cenital.', 'Estancias: COCINA (arriba), BAÑO (derecha).',
  'Piezas por estancia: BAÑO (derecha): 1 inodoro, 1 lavabo, 1 ducha.', 'Sin textos, rótulos, cotas ni marcos.'].join('\n');
const english = ['Create a modern interior design in a top-down view.', 'Rooms: KITCHEN (top), BATHROOM (right).',
  'Fixtures per room: BATHROOM (right): 1 toilet, 1 washbasin, 1 shower.', 'No text, labels, dimensions or frames.'].join('\n');
const adapter = (answer: () => Promise<unknown>) => ({ chat: vi.fn(async () => ({ structured: await answer(), content: '' })), chatStream: vi.fn() }) as unknown as ChatVisionAdapter & { chat: ReturnType<typeof vi.fn> };

describe('prompt de imagen en inglés', () => {
  it('envía la traducción completa y la reutiliza sin volver a pagarla', async () => {
    const chat = adapter(async () => ({ english }));
    expect(await englishImagePrompt(chat, spanish)).toEqual({ prompt: english, translated: true });
    const request = chat.chat.mock.calls[0]![0];
    expect(request.temperature).toBe(0);
    expect(request.reasoning).toEqual({ effort: 'low' });
    expect(request.messages[0].content[0].text).toContain(spanish);
    expect(await englishImagePrompt(chat, spanish)).toEqual({ prompt: english, translated: true });
    expect(chat.chat).toHaveBeenCalledTimes(1);
  });

  it('conserva el original si la traducción pierde líneas o el modelo falla', async () => {
    const other = `${spanish}\nIluminación: luz de día.`;
    expect(await englishImagePrompt(adapter(async () => ({ english: english.split('\n').slice(0, 2).join('\n') })), other))
      .toMatchObject({ prompt: other, translated: false, issue: expect.stringMatching(/longitud|líneas/) });
    expect(await englishImagePrompt(adapter(async () => { throw new Error('caído'); }), `${other}\nOtra`))
      .toEqual({ prompt: `${other}\nOtra`, translated: false, issue: 'caído' });
  });

  it('no traduce las líneas con datos JSON del plano y las restaura intactas', async () => {
    const withData = `Respeta el plano.\nDatos del plano: {"rooms":[{"id":"L1-R1","name":"COCINA","x":1200}]}\nSin textos.`;
    const chat = adapter(async () => ({ english: 'Respect the plan.\n[[DATA 1]]\nNo text.' }));
    const result = await englishImagePrompt(chat, withData);
    expect(chat.chat.mock.calls[0]![0].messages[0].content[0].text).not.toContain('"COCINA"');
    expect(result).toEqual({ prompt: 'Respect the plan.\nDatos del plano: {"rooms":[{"id":"L1-R1","name":"COCINA","x":1200}]}\nNo text.', translated: true });
    expect(await englishImagePrompt(adapter(async () => ({ english: 'Respect the plan.\nNo text.\nExtra.' })), `${withData}\nOtra`))
      .toMatchObject({ translated: false, issue: 'faltan datos del plano' });
  });

  it('acepta la traducción de una indicación corta aunque cambie de longitud', async () => {
    expect(await englishImagePrompt(adapter(async () => ({ english: 'remove it, it is extra' })), 'sobra'))
      .toEqual({ prompt: 'remove it, it is extra', translated: true });
  });

  it('el estudio y el chat traducen el prompt al generar y envían el original si no hay modelo de análisis visual', async () => {
    const generate = vi.fn(async (request: { prompt: string }) => ({ assetUrl: request.prompt, cost: { amountUsd: 0, unit: 'image' } }));
    const image = { generate, inpaint: vi.fn() } as never;
    await withEnglishPrompts(image, async () => adapter(async () => ({ english: 'Draw the plan again.' }))).generate({ prompt: 'Dibuja de nuevo el plano.' });
    expect(generate).toHaveBeenLastCalledWith({ prompt: 'Draw the plan again.' });
    await withEnglishPrompts(image, async () => { throw new Error('sin ruta'); }).generate({ prompt: 'Redibuja el plano.', aspectRatio: '1:1' });
    expect(generate).toHaveBeenLastCalledWith({ prompt: 'Redibuja el plano.', aspectRatio: '1:1' });
  });
});
