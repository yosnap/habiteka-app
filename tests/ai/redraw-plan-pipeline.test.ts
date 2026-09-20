/**
 * Redibujado imagen→imagen del plano: la imagen original viaja como referencia
 * y el prompt exige respetar la distribución sin inventar medidas. Sin red.
 */
import { describe, expect, it } from 'vitest';
import { planFidelityRules } from '@/server/ai/design/redraw-plan-pipeline';
import { redrawPlan, redrawPlanPrompt } from '@/server/ai/design/redraw-plan-pipeline';
import type { ImageAdapter, ImageGenRequest } from '@/lib/contracts';

describe('redrawPlanPrompt', () => {
  it('exige la misma distribución y prohíbe inventar medidas o elementos', () => {
    const p = redrawPlanPrompt();
    expect(p).toContain('EXACTAMENTE la misma distribución');
    expect(p).toContain('PROHIBIDO');
    expect(p).toContain('cotas o medidas que no estén escritas');
    // Solo estructura: el mobiliario dibujado (fregaderos, camas) contaminaba
    // la detección de muros al extraer la geometría.
    expect(p).toContain('SOLO ESTRUCTURA');
    expect(p).toContain('puramente');
  });
});

describe('redrawPlan', () => {
  it('envía la imagen original como referencia al modelo de imagen', async () => {
    let captured: ImageGenRequest | null = null;
    const image: ImageAdapter = {
      generate: async (req) => {
        captured = req;
        return {
          assetUrl: 'https://assets/plano-redibujado.png',
          cost: { amountUsd: 0.04, unit: 'image' },
        };
      },
      inpaint: async () => {
        throw new Error('no aplica');
      },
    };

    const result = await redrawPlan({ image }, { base64: 'ORIGINALBASE64', mimeType: 'image/jpeg' });

    expect(result.assetUrl).toBe('https://assets/plano-redibujado.png');
    expect(captured!.referenceImage).toEqual({ base64: 'ORIGINALBASE64', mimeType: 'image/jpeg' });
    expect(captured!.prompt).toBe(redrawPlanPrompt());
  });
});

describe('redrawPlanPrompt — modos y fidelidad', () => {
  it('el modo decorado conserva mobiliario, sanitarios y medidas escritas', () => {
    const p = redrawPlanPrompt('decorado');
    expect(p).toContain('CON MOBILIARIO');
    expect(p).toContain('bañera');
    expect(p).not.toContain('SOLO ESTRUCTURA');
    expect(p).toContain(planFidelityRules());
  });
  it('las reglas de fidelidad fijan puertas con hoja y arco, ventanas solo dibujadas y muros proporcionados', () => {
    const r = planFidelityRules();
    expect(r).toContain('ARCO DE BARRIDO');
    expect(r).toContain('80–90 cm');
    expect(r).toContain('PROHIBIDO añadir ventanas');
    expect(r).toContain('25–30 cm');
    expect(redrawPlanPrompt()).toContain(r);
  });
});
