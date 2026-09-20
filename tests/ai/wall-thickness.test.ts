/**
 * Grosor de muro por clases: reasignación por solape con las bandas medidas y
 * agrupación exterior/interior determinista.
 */
import { describe, expect, it } from 'vitest';
import { assignMeasuredThickness, classifyWallThickness } from '@/server/ai/sketch/wall-thickness';

describe('assignMeasuredThickness', () => {
  it('toma el grosor de la banda que solapa con el muro limpio y respeta la ortogonalidad', () => {
    const measured = [
      { x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.2, thickness: 0.02 }, // fachada gruesa
      { x1: 0.5, y1: 0.2, x2: 0.9, y2: 0.2, thickness: 0.02 },
      { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8, thickness: 0.005 }, // tabique vertical
    ];
    // Muro limpio horizontal: fusión de las dos bandas gruesas.
    const walls = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2 },
      { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 },
      { x1: 0.1, y1: 0.6, x2: 0.4, y2: 0.6 }, // sin banda medida
    ];
    const out = assignMeasuredThickness(walls, measured, 0.03, 12);
    expect(out[0]!.thickness).toBe(0.02);
    expect(out[1]!.thickness).toBe(0.005);
    expect(out[2]!.thickness).toBeUndefined();
  });

  it('ignora bandas paralelas alejadas (otro muro) aunque solapen en recorrido', () => {
    const measured = [{ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, thickness: 0.03 }];
    const walls = [{ x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2 }];
    expect(assignMeasuredThickness(walls, measured, 0.03, 12)[0]!.thickness).toBeUndefined();
  });
});

describe('classifyWallThickness', () => {
  it('separa fachada y tabiques en dos clases redondeadas a 10 mm', () => {
    const out = classifyWallThickness([190, 205, 180, 90, 95, 85, undefined], 120);
    expect(out.slice(0, 3)).toEqual([190, 190, 190]);
    expect(out.slice(3, 6)).toEqual([90, 90, 90]);
    expect(out[6]).toBe(90); // sin medida → clase fina
  });

  it('con trazo uniforme (una sola clase) aplica el grosor por defecto', () => {
    expect(classifyWallThickness([100, 105, 98, 102], 120)).toEqual([120, 120, 120, 120]);
  });

  it('no abre dos clases por un único muro atípico', () => {
    expect(classifyWallThickness([100, 102, 98, 300], 120)).toEqual([120, 120, 120, 120]);
  });

  it('acota los grosores a un rango plausible', () => {
    const out = classifyWallThickness([900, 950, 20, 25], 120);
    expect(out).toEqual([400, 400, 80, 80]);
  });
});
