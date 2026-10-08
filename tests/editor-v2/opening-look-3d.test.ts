/**
 * Modelo 3D del aspecto de puertas y ventanas (diseño de hoja, acabado con textura CC0, tirador, tapajuntas y herrajes
 * propios de cada tipo), su foto en Construir y los apartados de las tarjetas. Los documentos sin aspecto elegido
 * conservan el modelo de siempre.
 */
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Opening } from '@/lib/editor-document/schema';
import { OPENING_TYPES, openingTypesFor } from '@/lib/editor-document/opening-types';
import { openingTypeLookPatch } from '@/lib/editor-document/opening-look';
import { openingMeshes } from '@/canvas/editor-v2/scene/opening-meshes';
import { CATALOG_PHOTO_VERSION, openingPhotoDocument, openingPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { openingTypeCards, openingTypeSections } from '@/components/editor-v2/opening-type-cards';
import { setWallCurve } from '@/lib/editor-document/curve-commands';
import type { SceneBox } from '@/canvas/editor-v2/scene/types';

function wallWith(catalogId: string, extra: Partial<Opening> = {}): EditorDocument {
  const type = OPENING_TYPES.find((item) => item.id === catalogId)!;
  return { ...emptyEditorDocument(), schemaVersion: 4, vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 9000, y: 0 }],
    walls: [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 200, heightMm: 2900, colors: { left: '#ffffff', right: '#ffffff' },
      materials: { left: 'plaster-white', right: 'plaster-white' }, dimensionalOrigin: 'physical' }],
    openings: [{ id: 'o', wallId: 'wall', kind: type.kind, position: .5, widthMm: type.widthMm, dimensionalOrigin: 'physical', catalogId,
      heightMm: type.heightMm, elevationMm: type.elevationMm, hinge: 'left', swing: 'left', openAngleDeg: type.kind === 'puerta' ? 30 : 0,
      colors: { frame: '#f4f1e9', leaf: '#bb956c' }, ...extra }], furniture: [], stairs: [], comments: [] };
}
const meshes = (doc: EditorDocument) => openingMeshes(doc, doc.openings[0]!);
const shapes = (boxes: SceneBox[], shape: SceneBox['shape']) => boxes.filter((box) => box.shape === shape).length;

describe('aspecto en 3D', () => {
  it('los tipos históricos sin aspecto elegido no ganan texturas, herrajes ni tapajuntas', () => {
    for (const type of OPENING_TYPES.filter((item) => item.legacy)) {
      const boxes = meshes(wallWith(type.id));
      expect(boxes.every((box) => !box.materialId && !box.appearance && !box.shape)).toBe(true);
      expect(boxes.filter((box) => box.role === 'leaf').every((box) => box.color === '#bb956c')).toBe(true);
    }
    // La puerta lisa de siempre: tres piezas de marco y una sola hoja.
    expect(meshes(wallWith('puerta-basic')).map((box) => box.role)).toEqual(['frame', 'frame', 'frame', 'leaf']);
  });

  it('con diseño, acabado y tirador: cuarterones, textura de nogal, manilla y tapajuntas a juego', () => {
    const plain = meshes(wallWith('puerta-basic'));
    const boxes = meshes(wallWith('puerta-basic', { leafDesign: 'molduras-4', leafFinish: 'nogal', handle: 'manilla' }));
    expect(boxes.filter((box) => box.role === 'leaf').length).toBeGreaterThan(10);
    expect(boxes.some((box) => box.materialId === 'ambientcg:Wood049')).toBe(true);
    // Marco y tapajuntas llevan el mismo acabado que la hoja.
    expect(boxes.filter((box) => box.role === 'frame' && box.materialId === 'ambientcg:Wood049').length).toBeGreaterThanOrEqual(3 + 6);
    expect(shapes(boxes, 'rounded-box')).toBeGreaterThanOrEqual(4);
    expect(boxes.length).toBeGreaterThan(plain.length);
    const lacquer = meshes(wallWith('puerta-basic', { leafFinish: 'lacado-blanco', leafDesign: 'ranurada' }));
    expect(lacquer.some((box) => box.color === '#f1efea' && !box.materialId)).toBe(true);
    expect(new Set(lacquer.filter((box) => box.role === 'leaf').map((box) => box.color)).size).toBe(2);
  });

  it('cada tipo nuevo lleva sus herrajes: granero, entrada, vidrio templado, vaivén y oscilobatiente', () => {
    const look = (id: string) => openingTypeLookPatch(OPENING_TYPES.find((type) => type.id === id)!);
    const barn = meshes(wallWith('puerta-granero', look('puerta-granero')));
    expect(barn.filter((box) => box.shape === 'ellipsoid' && box.color === '#2a2b2d').length).toBe(2);
    const entrance = meshes(wallWith('puerta-entrada', { ...look('puerta-entrada'), openAngleDeg: 0 }));
    expect(shapes(entrance, 'ellipsoid')).toBeGreaterThanOrEqual(3);
    const glass = meshes(wallWith('puerta-cristal', look('puerta-cristal')));
    expect(glass.filter((box) => box.role === 'glass').length).toBe(1);
    expect(glass.some((box) => box.appearance === 'powder-coated-metal')).toBe(true);
    const swing = meshes(wallWith('puerta-vaiven', look('puerta-vaiven')));
    expect(swing.filter((box) => box.size[1] === .25 && box.appearance === 'powder-coated-metal').length).toBe(2);
    expect(shapes(meshes(wallWith('ventana-oscilobatiente')), 'rounded-box')).toBe(2);
    const transom = meshes(wallWith('ventana-montante'));
    expect(transom.filter((box) => box.role === 'glass').length).toBe(3);
  });

  it('las puertas de garaje: paneles recogidos bajo el techo, cajón de la enrollable y basculante asomando a la calle', () => {
    const open = meshes(wallWith('puerta-garaje', { openAngleDeg: 90 }));
    const slab = open.find((box) => box.role === 'leaf' && box.size[1] === .045)!;
    expect(slab.size[2]).toBeGreaterThan(2);
    expect(slab.position[2]).toBeGreaterThan(.1);
    const roller = meshes(wallWith('puerta-garaje-enrollable', { openAngleDeg: 90 }));
    expect(roller.some((box) => box.size[1] === .3 && box.size[2] === .3)).toBe(true);
    expect(roller.filter((box) => box.role === 'leaf').length).toBe(1);
    const tilting = meshes(wallWith('puerta-garaje-basculante', { openAngleDeg: 90 }));
    const panel = tilting.find((box) => box.role === 'leaf' && box.size[1] === .045)!;
    expect(panel.position[2] - panel.size[2] / 2).toBeLessThan(-.1);
    expect(panel.position[2] + panel.size[2] / 2).toBeGreaterThan(1);
    // La batiente, un tipo nuevo, toma sus cuarterones y sus manillas aunque el documento no los diga.
    const swing = meshes(wallWith('puerta-garaje-batiente'));
    expect(swing.filter((box) => box.role === 'leaf').length).toBeGreaterThan(20);
    expect(shapes(swing, 'rounded-box')).toBeGreaterThanOrEqual(8);
  });

  it('en un muro curvo también salen los herrajes del tipo, sin tapajuntas', () => {
    const doc = setWallCurve(wallWith('puerta-granero', { leafDesign: 'ranurada', handle: 'tirador' }), 'wall', 400);
    const boxes = meshes(doc);
    expect(boxes.filter((box) => box.shape === 'ellipsoid').length).toBeGreaterThanOrEqual(2);
    expect(boxes.every((box) => box.position.every(Number.isFinite))).toBe(true);
  });
});

describe('foto de cada tipo en Construir', () => {
  it('versión nueva del estudio y aspecto por defecto de cada tipo en su foto', () => {
    expect(CATALOG_PHOTO_VERSION).toBe(2);
    for (const type of OPENING_TYPES) {
      const opening = openingPhotoDocument(type.id)!.openings[0]!;
      expect(opening).toMatchObject(openingTypeLookPatch(type));
      expect(openingPhotoSource(type.id)!.key).toContain('v2|');
    }
    expect(openingPhotoDocument('puerta-entrada')!.openings[0]).toMatchObject({ leafDesign: 'molduras-4', leafFinish: 'nogal', handle: 'pomo', openAngleDeg: 0 });
  });

  it('la de entrada y las de garaje que suben se ven desde la calle; las ventanas, por la cara de la manilla', () => {
    expect(openingPhotoSource('puerta-entrada')!.front).toBe(-1);
    expect(openingPhotoSource('puerta-garaje-enrollable')!.front).toBe(-1);
    expect(openingPhotoSource('ventana-oscilobatiente')!.front).toBe(1);
    expect(openingPhotoSource('puerta-granero')!.front).toBe(1);
    // La corredera vista lleva a la vista el paño de pared por el que se recoge.
    const barn = openingPhotoDocument('puerta-granero')!;
    expect(barn.vertices[1]!.x).toBeGreaterThan(2 * 1000 + 220);
  });
});

describe('apartados de Construir', () => {
  it('agrupa las puertas en Interior, Entrada, Correderas y Exterior y garaje sin perder ninguna', () => {
    const sections = openingTypeSections('puerta');
    expect(sections.map((section) => section.title)).toEqual(['Interior', 'Entrada', 'Correderas', 'Exterior y garaje']);
    expect(sections.flatMap((section) => section.cards.map((card) => card.typeId)).sort())
      .toEqual(openingTypesFor('puerta').map((type) => type.id).sort());
    const exterior = sections.find((section) => section.id === 'exterior')!.cards.map((card) => card.typeId);
    expect(exterior).toEqual(expect.arrayContaining(['puerta-garaje', 'puerta-garaje-enrollable', 'puerta-garaje-basculante',
      'puerta-garaje-corredera', 'puerta-garaje-batiente', 'puerta-corredera-elevadora']));
    expect(sections.find((section) => section.id === 'entrada')!.cards.map((card) => card.typeId))
      .toEqual(['puerta-entrada', 'puerta-entrada-hoja-media']);
    expect(openingTypeSections('ventana')).toEqual([{ id: 'todas', title: null, cards: openingTypeCards('ventana') }]);
  });

  it('las puertas de garaje tienen medidas reales: de 2,4 a 5 m de ancho y de 2 a 2,5 m de alto', () => {
    for (const type of OPENING_TYPES.filter((item) => item.id.startsWith('puerta-garaje'))) {
      expect(type.widthMm).toBeGreaterThanOrEqual(2400);
      expect(type.maxWidthMm).toBe(5000);
      expect(type.heightMm).toBeGreaterThanOrEqual(2000);
      expect(type.heightMm).toBeLessThanOrEqual(2500);
    }
  });
});
