import { expect, it } from 'vitest';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import type { Furniture } from '@/lib/editor-document/schema';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

const place = (catalogId: string): Furniture => {
  const entry = getFurnitureCatalogEntry(catalogId)!;
  return { id: catalogId, kind: entry.kind, catalogId, x: 0, y: 0, widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm,
    elevationMm: entry.elevationMm, rotation: 0, color: entry.color, dimensionalOrigin: 'physical' };
};
const NEW = ['chaise-longue', 'rinconera', 'sofa-modular', 'sofa-cama', 'sofa-cama:abierto', 'cortina-abierta', 'estor-enrollable', 'persiana-veneciana', 'persiana-vertical', 'persiana-exterior']
  .map((id) => `habiteka:furniture:${id}`);

it('los sofás, cortinas y persianas nuevos existen y su geometría queda dentro de la huella', () => {
  for (const id of NEW) {
    const item = place(id), volumes = furnitureVolumes(item);
    expect(volumes.length, id).toBeGreaterThanOrEqual(3);
    for (const v of volumes) {
      expect(v.x, id).toBeGreaterThanOrEqual(-.01); expect(v.x + v.widthMm, id).toBeLessThanOrEqual(item.widthMm + .01);
      expect(v.y, id).toBeGreaterThanOrEqual(-.01); expect(v.y + v.depthMm, id).toBeLessThanOrEqual(item.depthMm + .01);
      expect(v.top, id).toBeLessThanOrEqual(item.elevationMm! + item.heightMm! + .01);
    }
  }
  // El rinconero ocupa la esquina: hay asiento tanto en el tramo largo como en el corto.
  const corner = furnitureVolumes(place('habiteka:furniture:rinconera'));
  expect(corner.some((v) => v.y > 1000 && v.x > 1800)).toBe(true);
  expect(corner.some((v) => v.y > 1000 && v.x < 1000)).toBe(false);
  // Estor y persianas arrancan a la altura de la ventana; las cortinas desde el suelo.
  expect(getFurnitureCatalogEntry('habiteka:furniture:estor-enrollable')!.elevationMm).toBe(900);
  expect(getFurnitureCatalogEntry('habiteka:furniture:cortina-abierta')!.elevationMm).toBe(0);
  expect(FURNITURE_CATALOG.filter((e) => e.productId === 'cortina').length).toBeGreaterThanOrEqual(4);
});

it('la pérgola existe en madera, aluminio y acero y la carpa tiene laterales transparentes visibles en la escena', () => {
  const pergolas = OUTDOOR_CATALOG.filter((e) => e.kind.startsWith('pergola'));
  expect(pergolas.map((e) => e.material)).toEqual(['Madera', 'Aluminio', 'Acero lacado']);
  expect(new Set(pergolas.map((e) => e.color)).size).toBe(3);
  for (const entry of pergolas) expect(furnitureVolumes(place(entry.id)).length).toBeGreaterThan(10);
  const carpa = place('habiteka:outdoor:carpa'), volumes = furnitureVolumes(carpa);
  const clear = volumes.filter((v) => v.opacity !== undefined);
  expect(clear).toHaveLength(3);
  expect(clear.every((v) => v.opacity! < .5 && v.top <= carpa.heightMm! * .8 + .01)).toBe(true);
  // El frente (y = fondo) queda abierto: ningún panel transparente llega a la cara delantera.
  expect(clear.some((v) => v.y + v.depthMm >= carpa.depthMm - 1 && v.widthMm > carpa.widthMm / 2)).toBe(false);
  const scene = editorDocumentToScene(insertSpatialItem(emptyEditorDocument(), carpa));
  expect(scene.boxes.filter((b) => b.opacity !== undefined)).toHaveLength(3);
});
