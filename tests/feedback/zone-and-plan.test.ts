import { describe, it, expect, vi } from 'vitest';
import { resolveZone, InvalidZoneError } from '@/server/agent/feedback/zone-resolver';
import {
  replaceZone,
  onlyZoneChanged,
  ZoneNotFoundError,
} from '@/server/agent/feedback/partial-plan-editor';
import { directedInpaint, removalRequest } from '@/server/agent/feedback/directed-inpaint';
import type { Plano2dPayload, PlanZone, ImageAdapter, CanvasZone } from '@/lib/contracts';

describe('resolveZone — validación de la zona', () => {
  it('acepta un bbox dentro de los límites', () => {
    const box = resolveZone({ id: 'z', bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } });
    expect(box.width).toBe(0.3);
  });

  it('rechaza una zona de área nula', () => {
    expect(() => resolveZone({ id: 'z', bbox: { x: 0, y: 0, width: 0, height: 0.2 } })).toThrow(
      InvalidZoneError,
    );
  });

  it('rechaza una zona fuera de los límites', () => {
    expect(() => resolveZone({ id: 'z', bbox: { x: 0.9, y: 0, width: 0.3, height: 0.2 } })).toThrow(
      InvalidZoneError,
    );
  });

  it('deriva un bbox de un polígono', () => {
    const box = resolveZone({
      id: 'z',
      polygon: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.4, y: 0.5 },
      ],
    });
    expect(box.x).toBeCloseTo(0.2);
    expect(box.width).toBeCloseTo(0.4);
  });
});

function zone(id: string, name: string): PlanZone {
  return { id, name, outline: [{ x: 0, y: 0 }], walls: [], apertures: [], dimensions: [] };
}

const plano: Plano2dPayload = {
  schemaVersion: 1,
  zones: [zone('salon', 'Salón'), zone('cocina', 'Cocina'), zone('bano', 'Baño')],
};

describe('replaceZone — regeneración parcial del plano', () => {
  it('reemplaza solo la zona indicada y conserva el resto por referencia', () => {
    const regenerated = zone('ignored', 'Salón remodelado');
    const next = replaceZone(plano, 'salon', regenerated);

    // La zona editada cambió de nombre; las demás son la MISMA referencia.
    expect(next.zones[0]?.name).toBe('Salón remodelado');
    expect(next.zones[0]?.id).toBe('salon'); // id estable entre versiones
    expect(next.zones[1]).toBe(plano.zones[1]);
    expect(next.zones[2]).toBe(plano.zones[2]);
    expect(onlyZoneChanged(plano, next, 'salon')).toBe(true);
  });

  it('lanza si la zona no existe (no inventa zonas)', () => {
    expect(() => replaceZone(plano, 'inexistente', zone('x', 'X'))).toThrow(ZoneNotFoundError);
  });
});

describe('directedInpaint — consume la primitiva de inpaint', () => {
  it('llama a inpaint con la zona y un prompt dirigido a esa región', async () => {
    let captured: { zone: CanvasZone; prompt: string } | null = null;
    const image: ImageAdapter = {
      generate: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
      inpaint: async (req) => {
        captured = { zone: req.zone, prompt: req.prompt };
        return { assetUrl: 'https://cdn/new.png', cost: { amountUsd: 0.04, unit: 'image' } };
      },
    };
    const result = await directedInpaint(image, {
      baseImage: { url: 'https://cdn/base.png' },
      zone: { id: 'z1', bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      instruction: 'cambia el suelo a parquet',
    });
    expect(result.assetUrl).toBe('https://cdn/new.png');
    expect(captured!.zone.id).toBe('z1');
    expect(captured!.prompt).toContain('parquet');
    expect(captured!.prompt).toContain('unchanged');
    // «Este inodoro sobra» devolvía otro inodoro en la misma zona.
    expect(captured!.prompt).toMatch(/erase it completely[^.]*do not replace it with an identical object/);
  });

  it('envía la indicación del usuario en inglés, pero decide el borrado con la que escribió', async () => {
    let captured: { prompt: string; eraseZone?: boolean } | null = null;
    const image: ImageAdapter = {
      generate: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
      inpaint: async (req) => { captured = { prompt: req.prompt, eraseZone: req.eraseZone }; return { assetUrl: 'https://cdn/new.png', cost: { amountUsd: 0.04, unit: 'image' } }; },
    };
    const zone = { id: 'z1', bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } };
    const translate = vi.fn(async () => ({ prompt: 'this toilet is extra, remove it', translated: true }));
    const result = await directedInpaint(image, { baseImage: { url: 'https://cdn/base.png' }, zone, instruction: 'este inodoro sobra, elimínalo', translate });
    expect(translate).toHaveBeenCalledWith('este inodoro sobra, elimínalo');
    expect(captured!.prompt).toContain('this toilet is extra, remove it');
    expect(captured!.prompt).not.toContain('elimínalo');
    expect(captured!.eraseZone).toBe(true);
    expect(result.instructionTranslation).toEqual({ sent: 'this toilet is extra, remove it', translated: true });

    const failed = async () => ({ prompt: 'cambia el suelo a parquet', translated: false, issue: 'caído' });
    const kept = await directedInpaint(image, { baseImage: { url: 'https://cdn/base.png' }, zone, instruction: 'cambia el suelo a parquet', translate: failed });
    expect(captured!.prompt).toContain('cambia el suelo a parquet');
    expect(kept.instructionTranslation).toEqual({ sent: 'cambia el suelo a parquet', translated: false, issue: 'caído' });
  });

  it('borra la zona antes de enviarla solo cuando se pide quitar algo sin conservar nada de ella', () => {
    expect(removalRequest('este inodoro sobra, elimínalo')).toBe(true);
    expect(removalRequest('quita esta silla')).toBe(true);
    expect(removalRequest('aquí hay 3 retretes y 2 lavabos, deja solamente uno de cada')).toBe(false);
    expect(removalRequest('cambia el suelo a parquet')).toBe(false);
    expect(removalRequest('en esta pared falta una puerta')).toBe(false);
  });
});
