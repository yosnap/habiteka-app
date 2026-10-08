import { describe, expect, it } from 'vitest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { placeOpening } from '@/canvas/editor-v2/opening-placement';
import { openingTypeCards } from '@/components/editor-v2/opening-type-cards';
import { applyChosenOpeningType, applyDefaultDoorType, openingPrototype } from '@/lib/editor-document/opening-type-commands';
import { openingTypesFor } from '@/lib/editor-document/opening-types';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';

/** Dos estancias de 3 × 4 m: perímetro de fachada y un tabique central (w6) entre ellas. */
function house(): EditorDocument {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 },
  ];
  doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']].map(([a, b], i) => ({
    id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  return doc;
}

describe('tarjetas de Construir → Puertas y Ventanas', () => {
  it('hay una tarjeta por tipo, en el orden del registro, con su herramienta y sus medidas', () => {
    for (const kind of ['puerta', 'ventana'] as const) {
      const cards = openingTypeCards(kind), types = openingTypesFor(kind);
      expect(cards.map((card) => card.typeId)).toEqual(types.map((type) => type.id));
      expect(cards.map((card) => card.label)).toEqual(types.map((type) => type.name));
      expect(new Set(cards.map((card) => card.tool))).toEqual(new Set([kind === 'puerta' ? 'door' : 'window']));
    }
    const balconera = openingTypeCards('ventana').find((card) => card.typeId === 'ventana-balconera')!;
    expect(balconera.detail).toBe('1,20 × 2,10 m');
    expect(openingTypeCards('ventana').find((card) => card.typeId === 'ventana-basic')!.detail).toBe('1,20 × 1,20 m · alféizar a 0,90 m');
  });
});

describe('colocar el tipo elegido', () => {
  it('la tarjeta activa la herramienta con su tipo y cambiar de herramienta lo olvida', () => {
    const store = createEditorStore(house());
    store.getState().beginOpeningType('ventana-balconera');
    expect(store.getState()).toMatchObject({ tool: 'window', openingTypeId: 'ventana-balconera', pendingOpening: null });
    store.getState().beginOpeningType('puerta-corredera');
    expect(store.getState()).toMatchObject({ tool: 'door', openingTypeId: 'puerta-corredera' });
    store.getState().setTool('door');
    expect(store.getState().openingTypeId).toBeNull();
    store.getState().beginOpeningType('tipo-inexistente');
    expect(store.getState().openingTypeId).toBeNull();
    const readOnly = createEditorStore(house(), { readOnly: true });
    readOnly.getState().beginOpeningType('puerta-doble');
    expect(readOnly.getState()).toMatchObject({ tool: 'select', openingTypeId: null });
  });

  it('la abertura que sigue al ratón lleva el tipo y su ancho; un tipo de otra clase se ignora', () => {
    expect(openingPrototype('p', 'puerta', 'puerta-corredera-vidrio')).toMatchObject({ kind: 'puerta', catalogId: 'puerta-corredera-vidrio', widthMm: 1800 });
    expect(openingPrototype('p', 'puerta', 'ventana-fija')).toEqual({ id: 'p', kind: 'puerta', wallId: '', position: .5, widthMm: 900, dimensionalOrigin: 'physical' });
    expect(openingPrototype('v', 'ventana', null)).not.toHaveProperty('catalogId');
  });

  it('en una fachada, el tipo elegido manda: no se convierte en puerta de entrada', () => {
    const doc = house(), prototype = openingPrototype('door', 'puerta', 'puerta-basic');
    const placed = placeOpening(doc, prototype, { wallId: 'w0', position: .5 });
    expect(applyChosenOpeningType(placed, 'door', 'puerta-basic').openings[0]).toMatchObject({ catalogId: 'puerta-basic', widthMm: 900 });
    // Sin tipo elegido sigue la regla de siempre.
    const automatic = placeOpening(doc, openingPrototype('door', 'puerta'), { wallId: 'w0', position: .5 });
    expect(applyDefaultDoorType(doc, automatic, 'door', 'w0').openings[0]).toMatchObject({ catalogId: 'puerta-entrada' });
  });

  it('al soltarla toma la altura y la cota del tipo, medidas desde el suelo del muro', () => {
    const doc = house(), prototype = openingPrototype('balconera', 'ventana', 'ventana-balconera');
    const placed = placeOpening(doc, prototype, { wallId: 'w1', position: .5 });
    expect(applyChosenOpeningType(placed, 'balconera', 'ventana-balconera').openings[0])
      .toMatchObject({ catalogId: 'ventana-balconera', widthMm: 1200, heightMm: 2100, elevationMm: 0 });
  });
});
