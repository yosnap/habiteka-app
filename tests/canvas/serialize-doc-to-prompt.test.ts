import { describe, it, expect } from 'vitest';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import { emptyCanvasDoc, type CanvasDoc, type StructObj } from '@/canvas/types';

const o = (
  kind: StructObj['kind'],
  x: number,
  y: number,
  width = 100,
  height = 50,
  rotation = 0,
): StructObj => ({ id: `${kind}-${x}-${y}`, kind, x, y, width, height, rotation });

const docWith = (objects: StructObj[]): CanvasDoc => ({ ...emptyCanvasDoc(), objects });

// Sala apaisada de 600×300 definida por dos muros horizontales (norte y sur).
const walls = [o('wall', 0, 0, 600, 12), o('wall', 0, 288, 600, 12)];

describe('serializeDocToPrompt', () => {
  it('devuelve null si el lienzo no tiene objetos', () => {
    expect(serializeDocToPrompt(emptyCanvasDoc())).toBeNull();
  });

  it('declara que es una vista en planta (cenital), no una foto frontal', () => {
    const out = serializeDocToPrompt(docWith([...walls, o('sofa', 40, 120)]))!;
    expect(out.toLowerCase()).toContain('planta');
    expect(out.toLowerCase()).toContain('cenital');
  });

  it('describe la proporción de la sala (apaisada) a partir de los muros', () => {
    const out = serializeDocToPrompt(docWith([...walls, o('sofa', 40, 120)]))!;
    expect(out.toLowerCase()).toContain('apaisada');
  });

  it('ubica cada elemento por pared/lado en vez de píxeles crudos', () => {
    // Sofá arriba-izquierda; lámpara abajo-derecha.
    const out = serializeDocToPrompt(
      docWith([...walls, o('sofa', 20, 20), o('lampara', 540, 240, 40, 40)]),
    )!;
    expect(out).toContain('Sofá');
    expect(out).toContain('pared del fondo'); // sofá arriba ⇒ fondo
    expect(out).toContain('a la izquierda');
    expect(out).toContain('a la derecha'); // lámpara
    // No vuelca coordenadas en píxeles crudas como "(20, 20)".
    expect(out).not.toContain('(20, 20)');
  });

  it('indica la orientación según la proporción del elemento', () => {
    const out = serializeDocToPrompt(
      docWith([...walls, o('sofa', 40, 120, 200, 60), o('tv', 300, 20, 20, 120)]),
    )!;
    expect(out).toContain('orientado en horizontal'); // sofá ancho
    expect(out).toContain('orientado en vertical'); // tv alta
  });

  it('no lista los muros como elementos colocables (definen la sala)', () => {
    const out = serializeDocToPrompt(docWith([...walls, o('sofa', 40, 120)]))!;
    expect(out).not.toContain('- Muro');
  });

  it('sin escala no añade medidas reales (degrada al texto histórico)', () => {
    const out = serializeDocToPrompt(docWith([...walls, o('sofa', 40, 120, 200, 60)]))!;
    expect(out).not.toContain(' cm');
    expect(out).not.toContain('La sala mide');
  });

  it('con escala válida añade medidas reales a la sala y a los elementos', () => {
    // 50 px = 1 m ⇒ sala 600×300 px = 12 × 6 m; sofá 200×40 px = 4 m × 80 cm.
    const doc: CanvasDoc = {
      ...docWith([...walls, o('sofa', 40, 120, 200, 40)]),
      scale: { pxPerMeter: 50, ratio: 50 },
    };
    const out = serializeDocToPrompt(doc)!;
    expect(out).toContain('La sala mide');
    expect(out).toContain('12 m'); // ancho de la sala
    expect(out).toContain('6 m'); // profundidad de la sala
    expect(out).toContain('4 m × 80 cm'); // medida del sofá (lado < 1 m en cm)
  });

  it('una escala inválida (pxPerMeter ≤ 0) se ignora y no añade medidas', () => {
    const doc: CanvasDoc = {
      ...docWith([...walls, o('sofa', 40, 120, 200, 60)]),
      scale: { pxPerMeter: 0 },
    };
    const out = serializeDocToPrompt(doc)!;
    expect(out).not.toContain('La sala mide');
  });
});
