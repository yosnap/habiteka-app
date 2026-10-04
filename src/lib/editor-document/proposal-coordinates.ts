import { getFurnitureCatalogEntry } from './furniture-catalog';
import type { NativeDesignFurniture } from './native-design-proposal';
import { objectCenter } from './spatial-properties';
import type { Point } from './schema';
import { FACE_ROTATION, type RoomWallFace } from './room-wall-faces';

/**
 * Lo que escribe la IA: el centro de la huella y uno de cuatro giros. El plano guarda la esquina local (0,0) y gira
 * sobre ella, así que con el giro esa esquina cambia de sitio; la IA la daba como «esquina superior izquierda» de la
 * pieza ya girada y todo lo girado acababa dentro del muro. El centro no depende del giro.
 */
export interface ModelFurniture {
  catalogId: string;
  /** Pared elegida (id de `roomWallFaces`) o vacío si la pieza va exenta. */
  wall?: string;
  /** Centro de la pieza a lo largo de esa pared: x en paredes de arriba/abajo, y en las laterales. */
  alongMm?: number;
  cxMm: number;
  cyMm: number;
  rotation: number;
  reason: string;
}

export const PROPOSAL_ROTATIONS = [0, 90, 180, 270] as const;

/** Giro más cercano de los cuatro permitidos: la huella queda alineada con los muros y el frente es inequívoco. */
export function snapRotation(rotation: number): number {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
}

/** Esquina local (0,0) de una huella de ancho × fondo girada sobre ella cuyo centro cae en (cx, cy). */
export function originFromCentre(cxMm: number, cyMm: number, rotation: number, widthMm: number, depthMm: number): Point {
  const angle = rotation * Math.PI / 180, halfWidth = widthMm / 2, halfDepth = depthMm / 2;
  return { x: cxMm - (Math.cos(angle) * halfWidth - Math.sin(angle) * halfDepth), y: cyMm - (Math.sin(angle) * halfWidth + Math.cos(angle) * halfDepth) };
}

export function fromModelFurniture(item: ModelFurniture): NativeDesignFurniture | null {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog) return null;
  const rotation = snapRotation(item.rotation), origin = originFromCentre(item.cxMm, item.cyMm, rotation, catalog.widthMm, catalog.depthMm);
  return { catalogId: item.catalogId, rotation, reason: item.reason, xMm: origin.x, yMm: origin.y };
}

export function toModelFurniture(item: NativeDesignFurniture): ModelFurniture {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  const centre = objectCenter({ x: item.xMm, y: item.yMm, rotation: item.rotation,
    widthMm: catalog?.widthMm ?? 0, depthMm: catalog?.depthMm ?? 0 });
  return { catalogId: item.catalogId, wall: '', alongMm: 0, cxMm: Math.round(centre.x), cyMm: Math.round(centre.y), rotation: item.rotation, reason: item.reason };
}

const horizontalFace = (face: RoomWallFace) => face.side === 'arriba' || face.side === 'abajo';
/** Dirección en la que se desliza una pieza sin despegarse de su pared. */
export const faceAxis = (face: RoomWallFace): Point => horizontalFace(face) ? { x: 1, y: 0 } : { x: 0, y: 1 };

/**
 * Pieza contra una pared: su trasera toca la cara interior y su centro cae en el punto elegido del tramo. La IA decide
 * la pared y el punto, como un interiorista; las coordenadas y el giro exactos los pone el código.
 */
export function placeOnFace(item: ModelFurniture, face: RoomWallFace): ModelFurniture {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog) return item;
  const half = catalog.widthMm / 2, wanted = item.alongMm ?? (face.fromMm + face.toMm) / 2;
  const along = face.toMm - face.fromMm >= catalog.widthMm ? Math.min(face.toMm - half, Math.max(face.fromMm + half, wanted)) : (face.fromMm + face.toMm) / 2;
  const across = face.side === 'arriba' || face.side === 'izquierda' ? face.atMm + catalog.depthMm / 2 : face.atMm - catalog.depthMm / 2;
  return { ...item, rotation: FACE_ROTATION[face.side], cxMm: horizontalFace(face) ? along : across, cyMm: horizontalFace(face) ? across : along };
}

/**
 * Tramo de cocina contra una pared entre `fromMm` y `toMm`: devuelve el extremo inicial de su línea trasera y el giro con
 * el que el cuerpo queda hacia la estancia, el mismo marco con el que el editor dibuja un mueble de cocina.
 */
export function placeRunOnFace(face: RoomWallFace, fromMm: number, toMm: number, depthMm: number): { xMm: number; yMm: number; rotation: number } {
  const rotation = FACE_ROTATION[face.side], along = (fromMm + toMm) / 2;
  const across = face.side === 'arriba' || face.side === 'izquierda' ? face.atMm + depthMm / 2 : face.atMm - depthMm / 2;
  const origin = horizontalFace(face) ? originFromCentre(along, across, rotation, toMm - fromMm, depthMm) : originFromCentre(across, along, rotation, toMm - fromMm, depthMm);
  return { xMm: origin.x, yMm: origin.y, rotation };
}
