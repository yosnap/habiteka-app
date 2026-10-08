/**
 * Lo leído en el boceto se empareja con el catálogo; lo que no existe (un tendedero, un perchero) se le dice al cliente
 * en lugar de sustituirlo por otra pieza. «mesilla» contiene «silla» y se leía como las sillas de una mesa.
 */
import { describe, expect, it } from 'vitest';
import { matchSketchItem } from '@/server/agent/editor-v2/sketch-catalog-match';
import { alignToSketch, sketchMissing } from '@/server/agent/editor-v2/sketch-design-rule';

describe('objetos del boceto frente al catálogo', () => {
  it('empareja cada objeto con su pieza o su papel', () => {
    expect(matchSketchItem('mesilla')).toEqual({ catalogId: 'habiteka:furniture:mesita' });
    expect(matchSketchItem('Sillas')).toEqual({ role: 'chairs' });
    expect(matchSketchItem('silla de escritorio')).toEqual({ catalogId: 'habiteka:furniture:silla-oficina' });
    expect(matchSketchItem('sofá en L')).toEqual({ catalogId: 'habiteka:furniture:rinconera' });
    expect(matchSketchItem('encimera con fregadero')).toEqual({ role: 'kitchen' });
    expect(matchSketchItem('mesa redonda de exterior')).toEqual({ catalogId: 'habiteka:furniture:mesa-jardin' });
    expect(matchSketchItem('Frigorífico')).toEqual({ catalogId: 'habiteka:furniture:frigorifico' });
  });

  it('lo que el catálogo no tiene se lista con su estancia, sin repetir', () => {
    expect(matchSketchItem('piano')).toBeNull();
    expect(matchSketchItem('bicicleta')).toBeNull();
    // Ya en el catálogo: la pila de lavadero y el zapatero dibujados se colocan.
    expect(matchSketchItem('pila de lavadero')).toEqual({ catalogId: 'habiteka:furniture:pila-lavadero' });
    const item = (label: string, x: number) => ({ label, kind: '', centreMm: { x, y: 500 }, sizeMm: { x: 300, y: 300 }, back: null, count: 1, missing: !matchSketchItem(label) });
    const guide = { image: { type: 'text' as const, text: '' }, frameMm: { width: 4000, height: 1000 }, items: [item('piano', 500), item('piano', 600), item('planta', 700), item('bicicleta', 3000)] };
    const rooms = [{ id: 'a', name: 'Entrada', boundary: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 0, y: 1000 }] }];
    expect(sketchMissing(guide as never, rooms)).toEqual(['Piano (Entrada)', 'Bicicleta']);
  });
});

describe('el boceto manda en el sitio', () => {
  const roomOfRaw = (value: unknown) => (value as { room?: string }).room;
  it('impone la pared, el punto y el giro dibujados, conserva la variante de la IA y añade lo que faltaba', () => {
    const raw = [
      { catalogId: 'habiteka:furniture:mesa-comedor:grande', wall: '', cxMm: 1, cyMm: 1, rotation: 0, reason: 'IA', room: 'comedor' },
      { catalogId: 'habiteka:furniture:cama-doble', wall: 'E9z', alongMm: 10, cxMm: 0, cyMm: 0, rotation: 0, reason: 'IA', room: 'dormitorio' },
      { catalogId: 'habiteka:furniture:zapatero', wall: 'E1a', alongMm: 10, cxMm: 0, cyMm: 0, rotation: 0, reason: 'IA', room: 'lavadero' },
      { catalogId: 'habiteka:furniture:lampara-pie', wall: '', cxMm: 5, cyMm: 5, rotation: 0, reason: 'IA', room: 'salon' },
    ];
    const pieces = [
      { label: 'mesa de comedor', roomId: 'comedor', roomName: 'Comedor', catalogId: 'habiteka:furniture:mesa-comedor', cxMm: 1000, cyMm: 2000, rotation: 90 },
      { label: 'cama individual', roomId: 'dormitorio', roomName: 'Dormitorio 2', catalogId: 'habiteka:furniture:cama-individual', wall: 'E4a', alongMm: 4900 },
      { label: 'zapatero', roomId: 'entrada', roomName: 'Entrada', catalogId: 'habiteka:furniture:zapatero', wall: 'E2a', alongMm: 6600 },
    ];
    const aligned = alignToSketch(raw, pieces, roomOfRaw) as Record<string, unknown>[];
    expect(aligned[0]).toMatchObject({ catalogId: 'habiteka:furniture:mesa-comedor:grande', cxMm: 1000, cyMm: 2000, rotation: 90 });
    // Dibujada individual: la cama doble de la IA pasa a individual, contra la pared medida.
    expect(aligned[1]).toMatchObject({ catalogId: 'habiteka:furniture:cama-individual', wall: 'E4a', alongMm: 4900 });
    // El zapatero de la IA en el lavadero sobra; se añade el dibujado en la entrada. La lámpara, no dibujada, se queda.
    expect(aligned.map((item) => item.catalogId)).toEqual(['habiteka:furniture:mesa-comedor:grande', 'habiteka:furniture:cama-individual',
      'habiteka:furniture:lampara-pie', 'habiteka:furniture:zapatero']);
    expect(aligned.at(-1)).toMatchObject({ wall: 'E2a', alongMm: 6600, reason: 'Dibujado en el boceto' });
  });
});
