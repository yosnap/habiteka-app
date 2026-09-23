import { describe, expect, it, vi } from 'vitest';
import {
  classifyImageKind,
  rasterLooksLikePlan,
  toImageKind,
} from '@/server/agent/phases/image-kind';
import { runIngesta } from '@/server/agent/phases/ingesta';
import type { ChatVisionAdapter } from '@/lib/contracts';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';

const wall = (x1: number, y1: number, x2: number, y2: number): SketchWall => ({
  x1,
  y1,
  x2,
  y2,
  thickness: 0.01,
});

/** Visión mockeada: devuelve lo que se le pida como salida estructurada. */
function vision(structured: unknown): ChatVisionAdapter {
  return {
    chat: async () => ({
      content: '',
      structured,
      usage: { promptTokens: 1, completionTokens: 1 },
    }),
    chatStream: async function* () {},
  };
}

describe('clasificación plano/foto', () => {
  it('sanea el valor del modelo', () => {
    expect(toImageKind('floor_plan')).toBe('floor_plan');
    expect(toImageKind('room_photo')).toBe('room_photo');
    expect(toImageKind('PLANO')).toBe('other');
    expect(toImageKind(undefined)).toBe('other');
  });

  it('ve retícula de plano solo con varios tramos y alguno largo', () => {
    const grid = [
      wall(0, 0, 1, 0),
      wall(0, 1, 1, 1),
      wall(0, 0, 0, 1),
      wall(1, 0, 1, 1),
      wall(0.5, 0, 0.5, 0.6),
      wall(0, 0.5, 0.6, 0.5),
    ];
    expect(rasterLooksLikePlan(grid)).toBe(true);
    expect(rasterLooksLikePlan(grid.slice(0, 3))).toBe(false);
    expect(
      rasterLooksLikePlan(Array.from({ length: 8 }, (_, i) => wall(0, i / 10, 0.1, i / 10))),
    ).toBe(false);
  });

  it('el ráster solo desempata cuando la visión no se moja', () => {
    expect(classifyImageKind('room_photo', { looksLikePlan: true })).toBe('room_photo');
    expect(classifyImageKind('floor_plan', { looksLikePlan: false })).toBe('floor_plan');
    expect(classifyImageKind('other', { looksLikePlan: true })).toBe('floor_plan');
    expect(classifyImageKind('other', { looksLikePlan: false })).toBe('other');
    expect(classifyImageKind('other', null)).toBe('other');
  });
});

describe('ingesta con clasificación', () => {
  it('devuelve el tipo de imagen junto a los elementos detectados', async () => {
    const result = await runIngesta(
      vision({ walls: 4, doors: 1, windows: 2, pillars: 0, imageKind: 'floor_plan' }),
      [{ type: 'text', text: 'sin imagen embebida' }],
    );
    expect(result.detected).toEqual({ walls: 4, doors: 1, windows: 2, pillars: 0 });
    expect(result.imageKind).toBe('floor_plan');
    expect(result.disclaimer).toBeTruthy();
  });

  it('pide el campo en el esquema de salida estructurada', async () => {
    const chat = vision({ walls: 1, doors: 0, windows: 0, pillars: 0, imageKind: 'room_photo' });
    const spy = vi.spyOn(chat, 'chat');
    const result = await runIngesta(chat, [{ type: 'text', text: 'x' }]);
    expect(spy.mock.calls[0]![0].responseSchema?.properties?.imageKind).toBeDefined();
    expect(result.imageKind).toBe('room_photo');
  });

  it('una respuesta sin el campo no bloquea la ingesta', async () => {
    const result = await runIngesta(vision({ walls: 2, doors: 0, windows: 0, pillars: 0 }), [
      { type: 'text', text: 'x' },
    ]);
    expect(result.imageKind).toBe('other');
    expect(result.detected.walls).toBe(2);
  });
});
