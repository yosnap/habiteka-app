import { describe, expect, it } from 'vitest';
import { CATALOG_PHOTO_VERSION, catalogEntryFurniture, hashText, openingPhotoDocument, openingPhotoSource, pregeneratedThumbnailUrl,
  renderedFurnitureSource as furniturePhotoSource }
  from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { editorDocumentToScene, furnitureSceneBoxes } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { OPENING_TYPES } from '@/lib/editor-document/opening-types';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

const modeled = FURNITURE_CATALOG.find((entry) => furnitureModel({ catalogId: entry.id }))!;
const volumetric = FURNITURE_CATALOG.find((entry) => entry.profile === 'appliance' && !furnitureModel({ catalogId: entry.id }))!;

describe('fuente y clave de la foto de un mueble', () => {
  it('la pieza del catálogo se fotografía con sus medidas y su color, apoyada en el suelo', () => {
    const item = catalogEntryFurniture({ ...modeled, elevationMm: 1200 });
    expect(item).toMatchObject({ catalogId: modeled.id, kind: modeled.kind, widthMm: modeled.widthMm, depthMm: modeled.depthMm,
      heightMm: modeled.heightMm, color: modeled.color, elevationMm: 0, rotation: 0 });
  });

  it('con modelo, usa el GLB del 3D y la clave lleva versión, URL, tinte y medidas', () => {
    const item = catalogEntryFurniture(modeled), source = furniturePhotoSource(item)!;
    expect(source.kind).toBe('model');
    if (source.kind !== 'model') return;
    expect(source.url).toBe(furnitureModel(item)!.url);
    expect(source.sizeM).toEqual([modeled.widthMm / 1000, modeled.heightMm / 1000, modeled.depthMm / 1000]);
    expect(source.key.startsWith(`v${CATALOG_PHOTO_VERSION}|`)).toBe(true);
    expect(source.key).toContain(source.url);
    expect(furniturePhotoSource(item)!.key).toBe(source.key);
    expect(furniturePhotoSource({ ...item, widthMm: item.widthMm + 100 })!.key).not.toBe(source.key);
    // Un color pintado cambia la foto; el del catálogo deja el modelo con sus texturas.
    expect(furniturePhotoSource({ ...item, color: '#123456' })!.key).not.toBe(source.key);
  });

  it('sin modelo, fotografía los mismos volúmenes que la escena y su clave sigue a su geometría', () => {
    const item = catalogEntryFurniture(volumetric), source = furniturePhotoSource(item)!;
    expect(source.kind).toBe('boxes');
    if (source.kind !== 'boxes') return;
    expect(source.boxes).toEqual(furnitureSceneBoxes(item));
    expect(source.key.startsWith(`v${CATALOG_PHOTO_VERSION}|volumenes|`)).toBe(true);
    expect(furniturePhotoSource(item)!.key).toBe(source.key);
    expect(furniturePhotoSource({ ...item, color: '#123456' })!.key).not.toBe(source.key);
    expect(furniturePhotoSource({ ...item, heightMm: (item.heightMm ?? 0) + 200 })!.key).not.toBe(source.key);
  });

  it('los volúmenes de una pieza son los mismos que pinta la escena del plano', () => {
    const doc = emptyEditorDocument();
    doc.furniture = [{ ...catalogEntryFurniture(volumetric), id: 'aparato', x: 500, y: 800, rotation: 90 }];
    const scene = editorDocumentToScene(doc).boxes.filter((box) => box.sourceEntityId === 'aparato');
    expect(scene).toEqual(furnitureSceneBoxes(doc.furniture[0]!, doc));
  });

  it('la huella de texto es estable y distingue cambios mínimos', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
});

describe('foto de cada tipo de puerta y ventana', () => {
  it('monta cada tipo en un trozo de muro con sus medidas, y cada tipo tiene su propia foto', () => {
    const keys = new Set<string>();
    for (const type of OPENING_TYPES) {
      const doc = openingPhotoDocument(type.id)!, opening = doc.openings[0]!, wall = doc.walls[0]!;
      expect(opening).toMatchObject({ kind: type.kind, catalogId: type.id, widthMm: type.widthMm, heightMm: type.heightMm,
        elevationMm: type.elevationMm });
      // Paño de muro a los lados, encima y bajo el alféizar.
      expect(doc.vertices[1]!.x).toBeGreaterThan(type.widthMm);
      expect(wall.baseElevationMm! + wall.heightMm!).toBeGreaterThan(type.elevationMm + type.heightMm);
      expect(wall.baseElevationMm).toBeLessThanOrEqual(type.elevationMm);
      const source = openingPhotoSource(type.id)!;
      expect(source.kind).toBe('boxes');
      if (source.kind !== 'boxes') continue;
      expect(source.boxes.some((box) => box.role === 'wall')).toBe(true);
      expect(source.boxes.some((box) => box.role === 'frame')).toBe(true);
      keys.add(source.key);
    }
    expect(keys.size).toBe(OPENING_TYPES.length);
  });

  it('la puerta se ve desde el lado hacia el que abre su hoja; un tipo desconocido no tiene foto', () => {
    expect(openingPhotoSource('puerta-basic')!.front).toBe(1);
    const doc = openingPhotoDocument('puerta-basic')!;
    expect(doc.openings[0]!.openAngleDeg).toBeGreaterThan(0);
    expect(openingPhotoDocument('ventana-basic')!.walls[0]!.baseElevationMm).toBeGreaterThan(0);
    expect(openingPhotoDocument('ventana-balconera')!.walls[0]!.baseElevationMm).toBe(0);
    expect(openingPhotoSource('puerta-inexistente')).toBeNull();
  });
});

describe('miniatura pregenerada', () => {
  it('se lee de forma opcional; manda la del modelo y solo vale una ruta del sitio o https', () => {
    const model = { thumbnailUrl: '/models/habiteka/thumbs/sofa.webp' }, entry = { thumbnailUrl: '/models/habiteka/thumbs/otra.webp' };
    expect(pregeneratedThumbnailUrl([model, entry])).toBe('/models/habiteka/thumbs/sofa.webp');
    expect(pregeneratedThumbnailUrl([undefined, entry])).toBe('/models/habiteka/thumbs/otra.webp');
    expect(pregeneratedThumbnailUrl([{ thumbnailUrl: 'https://cdn.habiteka.app/x.webp' }])).toBe('https://cdn.habiteka.app/x.webp');
    for (const thumbnailUrl of ['', '   ', 42, null, 'javascript:alert(1)', '//otro.sitio/x.webp', 'http://inseguro/x.webp']) {
      expect(pregeneratedThumbnailUrl([{ thumbnailUrl }, {}, null, 'texto'])).toBeNull();
    }
  });
});
