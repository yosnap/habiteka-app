import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';
import { collisions } from '@/canvas/editor-v2/spatial-placement';

const run = kitchenRunDefaults({ id: 'run', x: 0, y: 0, widthMm: 3000, rotation: 0 });
const withSink = { ...run, elevationMm: 1000, kitchen: { ...run.kitchen,
  slots: [{ id: 'sink', kind: 'fregadero' as const, positionMm: 1500, widthMm: 800, color: '#b8c0bd' }] } };
// Estor de ventana pegado a la pared: su cajón (79 mm de fondo) coincide en planta con el grifo, que nace a 60–100 mm de la trasera.
const blind = { id: 'blind', catalogId: 'habiteka:furniture:estor-enrollable:gris', kind: 'estor-enrollable',
  x: 700, y: 0, widthMm: 1600, depthMm: 150, heightMm: 1600, elevationMm: 1900, rotation: 0, color: '#8a8a8a' } as unknown as Furniture;

describe('tramo de cocina y cubiertas de ventana', () => {
  it('un estor sobre la encimera no cuenta como choque con el grifo del fregadero', () => {
    const document = { ...emptyEditorDocument(), kitchenRuns: [withSink], furniture: [blind] };
    const hits = [...collisions(document).keys()].filter((key) => key.includes('blind') && key.includes('run'));
    expect(hits).toEqual([]);
  });
});
