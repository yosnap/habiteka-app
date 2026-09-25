import { describe, expect, it } from 'vitest';
import { extractPlanSymbols, mergePlanSymbols, needsSymbolPass } from '@/server/ai/sketch/extract-plan-symbols';
import { extractPlanSource } from '@/server/plan/extract-plan-source';
import type { ChatVisionAdapter, ChatRequest } from '@/lib/contracts';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import sharp from 'sharp';

const raw: RawSketch = {
  muros: [
    { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.2 },
    { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 },
  ],
  habitaciones: Array.from({ length: 5 }, (_, i) => ({ nombre: `Zona ${i}`, poligono: [
    { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 },
  ] })),
  aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.5 }],
};

describe('segunda lectura de símbolos del plano', () => {
  it('sitúa el arco en su muro real aunque la primera lectura cite otro', () => {
    const result = mergePlanSymbols(raw, { doors: [{
      hinge: { x: 0.5, y: 0.3 }, openingEnd: { x: 0.5, y: 0.38 },
      arcPoint: { x: 0.58, y: 0.3 },
    }], windows: [] });
    const door = result.aberturas.find((item) => item.tipo === 'puerta' && item.arcGeometry);
    expect(door).toMatchObject({ muro: 1, arcVisible: true });
    expect(door!.posicion).toBeCloseTo((0.34 - 0.2) / 0.6);
    expect(raw.aberturas[0]).toEqual({ tipo: 'puerta', muro: 0, posicion: 0.5 });
  });

  it('recupera una ventana omitida y descarta símbolos alejados o arcos falsos', () => {
    const result = mergePlanSymbols(raw, {
      doors: [{ hinge: { x: 0.5, y: 0.3 }, openingEnd: { x: 0.5, y: 0.38 },
        arcPoint: { x: 0.95, y: 0.95 } }],
      windows: [
        { start: { x: 0.25, y: 0.2 }, end: { x: 0.35, y: 0.2 } },
        { start: { x: 0.1, y: 0.9 }, end: { x: 0.2, y: 0.9 } },
      ],
    });
    expect(result.aberturas.filter((item) => item.tipo === 'puerta')).toHaveLength(1);
    const windows = result.aberturas.filter((item) => item.tipo === 'ventana');
    expect(windows).toHaveLength(1);
    expect(windows[0]!.muro).toBe(0);
    expect(windows[0]!.posicion).toBeCloseTo(1 / 6);
  });

  it('no proyecta un símbolo desplazado a un muro solo porque está cerca', () => {
    const result = mergePlanSymbols(raw, { doors: [{
      hinge: { x: 0.52, y: 0.3 }, openingEnd: { x: 0.52, y: 0.38 },
      arcPoint: { x: 0.59, y: 0.33 },
    }], windows: [] });
    expect(result.aberturas).toEqual(raw.aberturas);
  });

  it('recupera un vano al final de una pared cortada si coincide con la arista de estancia', () => {
    const sketch: RawSketch = {
      muros: [{ x1: 0.1, y1: 0.5, x2: 0.4, y2: 0.5 }], aberturas: [],
      habitaciones: [{ nombre: 'Dormitorio', poligono: [
        { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 },
      ] }],
    };
    const result = mergePlanSymbols(sketch, { doors: [{
      hinge: { x: 0.4, y: 0.5 }, openingEnd: { x: 0.5, y: 0.5 },
      arcPoint: { x: 0.4, y: 0.4 },
    }], windows: [] });
    expect(result.muros).toHaveLength(2);
    expect(result.aberturas).toMatchObject([{ tipo: 'puerta', muro: 1, arcVisible: true }]);
  });

  it('solo activa la lectura focal si el plano es complejo y faltan arcos ubicados', () => {
    expect(needsSymbolPass(raw)).toBe(true);
    expect(needsSymbolPass({ ...raw, habitaciones: raw.habitaciones.slice(0, 3) })).toBe(false);
  });

  it('ejecuta la lectura focal tras la general cuando faltan símbolos', async () => {
    const requests: ChatRequest[] = [];
    const chat: ChatVisionAdapter = {
      chat: async (request) => {
        requests.push(request);
        return { content: '', usage: { promptTokens: 0, completionTokens: 0 },
          structured: requests.length === 1 ? raw : {
            doors: [{ hinge: { x: 0.5, y: 0.3 }, openingEnd: { x: 0.5, y: 0.38 },
              arcPoint: { x: 0.58, y: 0.3 } }], windows: [],
          } };
      },
      chatStream: async function* () { /* La extracción estructurada no usa streaming. */ },
    };
    const result = await extractPlanSource(chat, [], 'plano');
    expect(requests).toHaveLength(2);
    expect(result.raw.aberturas.some((item) => item.arcGeometry?.hinge.x === 0.5)).toBe(true);
  });

  it('amplía la zona central, recoloca sus símbolos y sustituye una ventana demasiado larga', async () => {
    const requests: ChatRequest[] = [];
    const chat: ChatVisionAdapter = {
      chat: async (request) => {
        requests.push(request);
        return { content: '', usage: { promptTokens: 0, completionTokens: 0 },
          structured: requests.length === 1 ? { doors: [], windows: [] } : {
            doors: [{ hinge: { x: 0.5, y: 0.5 }, openingEnd: { x: 0.5, y: 0.6 },
              arcPoint: { x: 0.6, y: 0.5 } }],
            windows: [{ start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.3 } }],
          } };
      },
      chatStream: async function* () { /* No se usa streaming. */ },
    };
    const image = await sharp({ create: { width: 1000, height: 1000, channels: 3,
      background: '#ffffff' } }).png().toBuffer();
    const result = await extractPlanSymbols(chat,
      [{ type: 'image_url', base64: image.toString('base64'), mimeType: 'image/png' }],
      { ...raw, aberturas: [{ tipo: 'ventana', muro: 1, posicion: 0.3167,
        anchoSobreMuro: 0.3667 }] });
    expect(requests).toHaveLength(2);
    const door = result.aberturas.find((item) => item.tipo === 'puerta');
    expect(door?.arcGeometry?.hinge).toEqual({ x: 0.5, y: 0.5 });
    const windows = result.aberturas.filter((item) => item.tipo === 'ventana');
    expect(windows).toHaveLength(1);
    expect(windows[0]?.anchoSobreMuro).toBeCloseTo(0.11);
  });

  it('añade un acercamiento a la estancia pequeña para separar puertas próximas', async () => {
    const requests: ChatRequest[] = [];
    const chat: ChatVisionAdapter = {
      chat: async (request) => {
        requests.push(request);
        return { content: '', usage: { promptTokens: 0, completionTokens: 0 },
          structured: { doors: [], windows: [] } };
      },
      chatStream: async function* () { /* No se usa streaming. */ },
    };
    const image = await sharp({ create: { width: 1000, height: 1000, channels: 3,
      background: '#ffffff' } }).png().toBuffer();
    await extractPlanSymbols(chat,
      [{ type: 'image_url', base64: image.toString('base64'), mimeType: 'image/png' }],
      { ...raw, habitaciones: [...raw.habitaciones, { nombre: 'Baño', poligono: [
        { x: 0.2, y: 0.2 }, { x: 0.35, y: 0.2 }, { x: 0.35, y: 0.3 }, { x: 0.2, y: 0.3 },
      ] }] });
    expect(requests).toHaveLength(3);
    const focused = requests[2]!.messages[0]!.content.find((part) => part.type === 'text');
    expect(focused).toMatchObject({ text: expect.stringContaining('estancia pequeña') });
  });
});
