import { describe, expect, it } from 'vitest';
import { placeOpening, resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';
import { openingPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { openingTypeCards } from '@/components/editor-v2/opening-type-cards';
import { openingLeafLayout } from '@/lib/editor-document/opening-leaves';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { openingSymbol } from '@/lib/editor-document/opening-symbol';
import { applyChosenOpeningType, openingPrototype } from '@/lib/editor-document/opening-type-commands';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';

function wall(heightMm = 2700) {
  const doc = upgradeConstructionDocument(emptyEditorDocument());
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 12000, y: 0 }];
  doc.walls = [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 200, heightMm,
    materials: { left: 'plaster-white', right: 'plaster-white' }, dimensionalOrigin: 'physical' }];
  return doc;
}

describe('puertas de garaje y portón exterior montados en pared', () => {
  it.each(['puerta-garaje', 'puerta-garaje-enrollable', 'puerta-garaje-basculante',
    'puerta-garaje-corredera', 'puerta-garaje-batiente', 'puerta-exterior-corredera'])(
    '%s conserva el tipo elegido al colocar y guardar', (typeId) => {
      const doc = wall(), prototype = openingPrototype('door', 'puerta', typeId);
      const preview = resolveOpeningPlacement(doc, { x: 6000, y: 0 }, .1, prototype)!;
      expect(preview.valid).toBe(true);
      const placed = applyChosenOpeningType(placeOpening(doc, prototype, preview), 'door', typeId);
      const saved = parseEditorDocument(JSON.parse(JSON.stringify(placed)));
      expect(saved.openings[0]).toMatchObject({ catalogId: typeId, wallId: 'wall', widthMm: prototype.widthMm,
        heightMm: prototype.heightMm, elevationMm: 0 });
      expect(openingTypeCards('puerta').find((card) => card.typeId === typeId)?.group).toBe('exterior');
      const photo = openingPhotoSource(typeId);
      expect(photo?.kind).toBe('boxes');
      if (photo?.kind === 'boxes') expect(photo.boxes.length).toBeGreaterThan(0);
    });

  it('el portón de 2 m cabe en un muro de 2 m y una seccional más alta no', () => {
    const doc = wall(2000);
    expect(resolveOpeningPlacement(doc, { x: 6000, y: 0 }, .1,
      openingPrototype('door', 'puerta', 'puerta-exterior-corredera'))?.valid).toBe(true);
    expect(resolveOpeningPlacement(doc, { x: 6000, y: 0 }, .1,
      openingPrototype('door', 'puerta', 'puerta-garaje'))?.reason).toBe('La abertura supera la altura del muro');
  });

  it('la corredera exterior se recoge a ambos lados y por ambas caras sin arco de giro', () => {
    const prototype = openingPrototype('door', 'puerta', 'puerta-exterior-corredera');
    for (const hinge of ['left', 'right'] as const) for (const swing of ['left', 'right'] as const) {
      const opening = { ...prototype, hinge, swing, openAngleDeg: 90 };
      const closed = openingLeafLayout({ ...opening, openAngleDeg: 0 }, 3000, 200)!;
      const open = openingLeafLayout(opening, 3000, 200)!;
      expect(open.panels[0]!.center.x - closed.panels[0]!.center.x).toBe(hinge === 'left' ? -3000 : 3000);
      expect(Math.sign(open.panels[0]!.center.y)).toBe(swing === 'left' ? 1 : -1);
      expect(open.travel).toHaveLength(1);
      expect(openingSymbol(opening, 200).some((stroke) => stroke.role === 'arc')).toBe(false);
    }
  });
});
