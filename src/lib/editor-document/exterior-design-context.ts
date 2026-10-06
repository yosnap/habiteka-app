import type { EditorDocument, Furniture, Point } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { boundaryDefaults, isBoundary, isLegacyBoundary, planObjects } from './boundary-types';
import { layeredTerrainSurfaces } from './terrain-surfaces';
import { localToWorld } from './spatial-properties';
import { surfaceMaterial } from './surface-materials';
import { deriveRoomsSafe } from './rooms';
import { pointInPolygon } from './polygon-tools';
import { surfaceVisibleInPlan } from './exterior-plan-visibility';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
import { isVehicle, vehicleType } from './vehicle-type';
export { isVehicle } from './vehicle-type';

export type ExteriorCategory = 'surface' | 'boundary' | 'vehicle' | 'vegetation' | 'equipment';
const exteriorKinds = new Set(OUTDOOR_CATALOG.map(item => item.kind));
export function isExteriorObject(item: Furniture): boolean {
  return isVehicle(item) || exteriorKinds.has(item.kind) || item.catalogId?.startsWith('habiteka:outdoor:') === true
    || getFurnitureCatalogEntry(item.catalogId ?? '')?.room === 'exterior';
}
export const EXTERIOR_RENDER_POLICY = 'EXTERIOR EXISTENTE OBLIGATORIO: conserva cada superficie y su material, contorno y capas: césped sigue siendo césped, asfalto sigue siendo asfalto; no sustituyas césped por tierra, arena o pavimento. Conserva cada tramo de cerco o seto, su especie, altura, postes y puertas con sus huecos y aperturas. Cada vehículo sigue siendo un vehículo reconocible del mismo tipo, tamaño, posición y orientación, nunca un bloque de madera, sofá ni mesa. Conserva árboles, arbustos, caminos, piscinas y equipamiento existentes. Mejora el acabado fotográfico sin suprimirlos, cambiar su función ni añadir paisaje fuera del terreno modelado. Una referencia aceptada adjunta fija la apariencia y los acabados; el inventario fija identidad y geometría. En vistas parciales respeta solo lo visible dentro de la cámara o máscara: no destapes ni traslades elementos ocultos.';

const footprint = (item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }): Point[] =>
  [[0, 0], [item.widthMm, 0], [item.widthMm, item.depthMm], [0, item.depthMm]]
    .map(([x, y]) => localToWorld(item, { x: x!, y: y! }));

/** Un jardín/patio puede estar definido como suelo de una zona, además de como terreno rectangular. */
export function exteriorRoomSurfaces(doc: EditorDocument) {
  return deriveRoomsSafe(doc).flatMap(room => {
    const finish = doc.floorFinishes?.find(item => item.roomId === room.id);
    if (!finish) return [];
    const outdoor = room.wallIds.every(id => doc.walls.some(wall => wall.id === id &&
      (wall.hidden || wall.id.startsWith('outdoor:'))));
    if (!outdoor && surfaceMaterial(finish.texture)?.category !== 'Exterior') return [];
    return [{ id: `floor:${room.id}`, name: doc.labels.find(label => pointInPolygon(label, room.boundary))?.text
      ?? 'Suelo exterior', footprint: room.boundary, finish }];
  });
}

/** Inventario de lo que existe, también los vehículos de garaje. Coordenadas y dimensiones en mm. */
export function exteriorDesignContext(doc: EditorDocument, prefix = '') {
  const identify = (id: string) => ({ id: `${prefix}${id}`, sourceId: id });
  const surfaces = layeredTerrainSurfaces(doc).map((surface, layer) => ({
    ...identify(surface.id), category: 'surface' as const, name: surface.name,
    material: surfaceMaterial(surface.texture)?.label ?? surface.texture,
    texture: surface.texture, color: surface.color, tileSizeMm: surface.tileSizeMm,
    textureRotationDeg: surface.rotation, layer,
    // rotation del terreno gira la textura, nunca la huella rectangular.
    footprint: footprint({ ...surface, rotation: 0 }),
  }));
  const boundaries = planObjects(doc).filter(item => isBoundary(item) || isLegacyBoundary(item)).map(item => {
    const boundary = isBoundary(item) ? item : boundaryDefaults(item);
    return { ...identify(item.id), category: 'boundary' as const,
      name: item.name ?? getFurnitureCatalogEntry(item.catalogId ?? '')?.label ?? item.kind,
      kind: item.kind, catalogId: item.catalogId, footprint: footprint(item), color: boundary.color,
      heightMm: boundary.heightMm, elevationMm: boundary.elevationMm, construction: boundary.construction };
  });
  const objects = doc.furniture.filter(item => isExteriorObject(item) && !isLegacyBoundary(item) && !isBoundary(item))
    .map(item => {
      const entry = getFurnitureCatalogEntry(item.catalogId ?? `habiteka:outdoor:${item.kind}`);
      const category: ExteriorCategory = isVehicle(item) ? 'vehicle'
        : /^(arbol|arbusto|planta-exterior|seto|huerto|jardinera-exterior)$/.test(item.kind) ? 'vegetation' : 'equipment';
      return { ...identify(item.id), category, name: item.name ?? entry?.label ?? item.kind,
        model: entry?.label ?? item.kind, kind: item.kind, catalogId: item.catalogId,
        ...(isVehicle(item) ? { vehicleType: vehicleType(item) } : {}),
        footprint: footprint(item), widthMm: item.widthMm, depthMm: item.depthMm,
        heightMm: item.heightMm ?? entry?.heightMm, elevationMm: item.elevationMm ?? 0,
        rotationDeg: item.rotation, color: item.color ?? entry?.color,
        ...(item.porchSteps !== undefined ? { porchSteps: item.porchSteps } : {}) };
    });
  const floors = exteriorRoomSurfaces(doc).map((surface, index) => ({
    ...identify(surface.id), category: 'surface' as const, name: surface.name, footprint: surface.footprint,
    material: surfaceMaterial(surface.finish.texture)?.label ?? surface.finish.texture,
    texture: surface.finish.texture, color: surface.finish.color, tileSizeMm: surface.finish.tileSizeMm,
    textureRotationDeg: surface.finish.rotation, layer: surfaces.length + index,
  }));
  const roomFloors = deriveRoomsSafe(doc).filter(room => room.wallIds.some(id => doc.walls.some(wall =>
    wall.id === id && !wall.hidden && !wall.id.startsWith('outdoor:')))).map(room => room.boundary);
  const objectFootprints = doc.furniture.map(footprint);
  const visibleSurfaces = surfaces.map((surface, index) => ({ ...surface,
    visibleInPlan: surfaceVisibleInPlan(surface.footprint,
      [...surfaces.slice(index + 1).map(item => item.footprint), ...floors.map(item => item.footprint), ...roomFloors, ...objectFootprints]) }));
  const visibleFloors = floors.map((surface, index) => ({ ...surface,
    visibleInPlan: surfaceVisibleInPlan(surface.footprint, [...floors.slice(index + 1).map(item => item.footprint), ...objectFootprints]) }));
  return [...visibleSurfaces, ...visibleFloors, ...boundaries, ...objects];
}
export type ExteriorDesignElement = ReturnType<typeof exteriorDesignContext>[number];
