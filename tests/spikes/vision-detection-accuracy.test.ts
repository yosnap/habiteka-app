/**
 * Medición de la fiabilidad de la detección de visión sobre bocetos (F-S0).
 *
 * Para cada boceto con ground-truth anotado, pide al modelo de visión los
 * elementos estructurales y compara con lo anotado. Reporta la tasa de acierto
 * (elementos exactos / total) — insumo clave del GO/NO-GO: si la detección sobre
 * boceto a mano falla a menudo, el paso "confirmar detección" deja de ser un
 * ahorro y pasa a ser corrección manual.
 *
 * Llamadas REALES: solo corre con `RUN_SPIKE=true` y `OPENROUTER_API_KEY`. El
 * modelo de visión se toma de `SPIKE_VISION_MODEL` (p. ej. un modelo multimodal).
 */
import { describe, it, expect } from 'vitest';
import { OpenRouterChatVisionAdapter } from '@/server/ai/chat-vision-adapter';
import { loadCases, readInputImage, spikeEnabled } from './spike-cases';

const ELEMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['walls', 'doors', 'windows', 'pillars'],
  properties: {
    walls: { type: 'integer' },
    doors: { type: 'integer' },
    windows: { type: 'integer' },
    pillars: { type: 'integer' },
  },
};

type Elements = { walls: number; doors: number; windows: number; pillars: number };

function accuracy(detected: Elements, truth: Elements): number {
  const keys: (keyof Elements)[] = ['walls', 'doors', 'windows', 'pillars'];
  const hits = keys.filter((k) => detected[k] === truth[k]).length;
  return hits / keys.length;
}

describe.runIf(spikeEnabled())('detección de visión sobre boceto (llamadas reales)', () => {
  it('reporta la tasa de acierto frente al ground-truth', async () => {
    const cases = (await loadCases()).filter((c) => c.groundTruth);
    expect(cases.length).toBeGreaterThan(0);

    const model = process.env.SPIKE_VISION_MODEL;
    expect(model, 'Define SPIKE_VISION_MODEL con un modelo multimodal').toBeTruthy();

    const chat = new OpenRouterChatVisionAdapter();
    const perCase: number[] = [];

    for (const c of cases) {
      const img = await readInputImage(c);
      const result = await chat.chat({
        model: model as string,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Detecta los elementos estructurales del espacio.' },
              { type: 'image_url', base64: img.toString('base64'), mimeType: 'image/jpeg' },
            ],
          },
        ],
        responseSchema: ELEMENTS_SCHEMA,
      });
      perCase.push(accuracy(result.structured as Elements, c.groundTruth as Elements));
    }

    const overall = perCase.reduce((a, b) => a + b, 0) / perCase.length;
    // Reporta la tasa (no fuerza un umbral aquí: el umbral lo fija rubric.md y la
    // decisión es humana). El log queda en la salida del runner.
    console.log(`[spike] tasa de acierto de detección: ${(overall * 100).toFixed(1)}%`);
    expect(overall).toBeGreaterThanOrEqual(0);
  });
});
