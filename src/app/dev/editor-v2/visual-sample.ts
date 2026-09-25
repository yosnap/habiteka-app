import { ASSET_CATALOG, ORIGINAL_ASSET_COLOR } from '@/lib/editor-document/furniture-assets';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { emptyEditorDocument, type EditorDocument, type Furniture, type Opening, type Wall } from '@/lib/editor-document/schema';
import { upgradeRampDocument } from '@/lib/editor-document/spatial-properties';

/** Vivienda sintética para comparar las mismas entidades en 2D, cenital e interior. */
export function visualSampleDocument(): EditorDocument {
  const points = [
    ['a', 0, 0], ['b', 6000, 0], ['c', 10000, 0],
    ['d', 10000, 4500], ['e', 10000, 8000], ['f', 6000, 8000],
    ['g', 0, 8000], ['h', 0, 4500], ['i', 6000, 4500],
  ] as const;
  const walls = [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'g'], ['g', 'h'], ['h', 'a'],
    ['b', 'i'], ['i', 'f'], ['h', 'i'], ['i', 'd'],
  ] as const;
  const segments: Wall[] = walls.map(([startVertexId, endVertexId], index) => ({
    id: `wall-${index}`, startVertexId, endVertexId,
    thicknessMm: index < 8 ? 220 : 120, dimensionalOrigin: 'physical',
  }));
  const opening = (id: string, wallIndex: number, kind: Opening['kind'], position = .5): Opening => ({
    id, wallId: `wall-${wallIndex}`, kind, position,
    widthMm: kind === 'ventana' ? 1400 : 900, dimensionalOrigin: 'physical',
  });
  const asset = (id: string, key: string, x: number, y: number, rotation = 0): Furniture => {
    const entry = ASSET_CATALOG.find((item) => item.id === `habiteka:asset:${key}`);
    if (!entry) throw new Error(`Falta el modelo de muestra ${key}`);
    return { id, kind: entry.kind, catalogId: entry.id, x, y, rotation,
      widthMm: entry.widthMm, depthMm: entry.depthMm, dimensionalOrigin: 'physical' };
  };
  const source: EditorDocument = {
    ...emptyEditorDocument(),
    vertices: points.map(([id, x, y]) => ({ id, x, y })),
    walls: segments,
    openings: [
      opening('entry', 7, 'puerta', .44), opening('living-kitchen', 8, 'puerta', .53),
      opening('living-bedroom', 10, 'puerta', .52), opening('kitchen-bath', 11, 'puerta', .48),
      opening('living-window', 0, 'ventana'), opening('kitchen-window', 1, 'ventana'),
      opening('bedroom-window', 5, 'ventana'), opening('bath-window', 3, 'ventana'),
    ],
    furniture: [
      asset('sofa', 'sofa', 500, 850), asset('chair', 'sillon_moderno', 3650, 800, 20),
      asset('living-table', 'mesa_centro_moderna', 2450, 1800),
      asset('plant', 'planta', 4700, 600), asset('dining-table', 'mesa', 7600, 1900),
      asset('dining-chair-1', 'silla_comedor_piel', 6750, 1950, 90), asset('dining-chair-2', 'silla_comedor_piel', 8600, 1950, 270),
      asset('kitchen-base', 'encimera', 8400, 500), asset('fridge', 'nevera', 9300, 550),
      asset('bed', 'cama', 1050, 5050), asset('nightstand', 'mesilla', 2750, 5700),
      asset('wardrobe', 'armario', 4450, 4900), asset('bath', 'banera', 6300, 5900),
      asset('toilet', 'inodoro', 9200, 6000), asset('sink', 'lavabo', 8100, 7100),
    ],
    labels: [
      { id: 'living-label', text: 'Salón', x: 3000, y: 3700 },
      { id: 'kitchen-label', text: 'Cocina / comedor', x: 7900, y: 3900 },
      { id: 'bedroom-label', text: 'Dormitorio', x: 3000, y: 7400 },
      { id: 'bath-label', text: 'Baño', x: 8100, y: 7400 },
    ],
  };
  const document = upgradeRampDocument(source);
  document.schemaVersion = 8;
  document.floorFinishes = [];
  document.ceilings = [];
  document.luminaires = [];
  document.furniture = document.furniture.map((item) => ({
    ...item,
    heightMm: ASSET_CATALOG.find((entry) => entry.id === item.catalogId)!.heightMm,
    color: ORIGINAL_ASSET_COLOR,
  }));
  const rooms = deriveRooms(document);
  document.floorFinishes = rooms.map((room) => {
    const x = room.boundary.reduce((sum, point) => sum + point.x, 0) / room.boundary.length;
    const y = room.boundary.reduce((sum, point) => sum + point.y, 0) / room.boundary.length;
    return { roomId: room.id, color: '#ffffff',
      texture: x > 6000 && y > 4500 ? 'polyhaven:interior_tiles' : 'polyhaven:oak_wood_planks',
      tileSizeMm: 1700, rotation: 0 };
  });
  document.ceilings = rooms.map((room) => ({
    id: `ceiling-${room.id}`, roomId: room.id, kind: 'plain', dropMm: 0, color: '#f5f2eb',
  }));
  document.luminaires = rooms.map((room) => ({
    id: `light-${room.id}`, ceilingId: `ceiling-${room.id}`, kind: 'flush',
    x: room.boundary.reduce((sum, point) => sum + point.x, 0) / room.boundary.length,
    y: room.boundary.reduce((sum, point) => sum + point.y, 0) / room.boundary.length,
    dropMm: 0, color: '#e7e1d5', temperatureK: 3200, lumens: 120, enabled: true,
  }));
  return document;
}
