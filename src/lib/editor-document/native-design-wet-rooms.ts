import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from './furniture-catalog';
import type { NativeDesignFurniture } from './native-design-proposal';
import { faceAxis, fromModelFurniture, placeOnFace } from './proposal-coordinates';
import type { RoomWallFace } from './room-wall-faces';
import type { Point } from './schema';

/** Sanitarios: van contra la pared y, en un baño pequeño, solo caben todos si se colocan bien seguidos. */
export const WET_PROFILES = new Set(['toilet', 'sink', 'bath', 'shower']);
export const isWetFixture = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.room === 'bano' && WET_PROFILES.has(entry.profile);
/** Dos órdenes: lo grande primero (cabe todo en un baño normal) o lo imprescindible primero (en un aseo estrecho). */
export const WET_PACK_ORDERS: readonly Readonly<Record<string, number>>[] = [{ bath: 0, shower: 0, toilet: 1, sink: 2 }, { toilet: 0, sink: 1, bath: 2, shower: 2 }];
/** Un baño vale más con inodoro y lavabo que con ducha y sin lavabo. */
export const wetScore = (items: readonly NativeDesignFurniture[]) => items.reduce((score, item) => {
  const profile = getFurnitureCatalogEntry(item.catalogId)?.profile;
  return score + (profile === 'toilet' || profile === 'sink' ? 2 : 1);
}, 0);
export const DEFAULT_WASHBASIN = 'habiteka:furniture:lavabo';

/**
 * Coloca los sanitarios de una estancia desde las esquinas: primero la bañera o la ducha, después el inodoro y el
 * lavabo, cada uno pegado a un extremo de un tramo libre y deslizándose por él hasta que cabe; si una pieza no cabe en
 * ninguna pared, prueba la alternativa más pequeña (la ducha por la bañera). La IA repartía el inodoro y el lavabo por
 * el centro de las paredes y la ducha ya no cabía. `place` valida y fija la pieza; devuelve null si no cabe.
 */
export function packWetRoom(entries: readonly FurnitureCatalogEntry[], faces: readonly RoomWallFace[], smaller: Readonly<Record<string, string>>,
  place: (item: NativeDesignFurniture, axis: Point) => NativeDesignFurniture | null, order = WET_PACK_ORDERS[0]!): NativeDesignFurniture[] {
  const placed: NativeDesignFurniture[] = [];
  for (const wanted of [...entries].sort((a, b) => (order[a.profile] ?? 3) - (order[b.profile] ?? 3)))
    for (let entry: FurnitureCatalogEntry | undefined = wanted; entry; entry = smaller[entry.id] ? getFurnitureCatalogEntry(smaller[entry.id]!) : undefined) {
      const done = firstSpot(entry, faces, place);
      if (done) { placed.push(done); break; }
    }
  return placed;
}

/** Primer extremo de tramo libre, en cualquier pared, donde la pieza cabe pegada a la esquina o deslizándose desde ella. */
function firstSpot(entry: FurnitureCatalogEntry, faces: readonly RoomWallFace[],
  place: (item: NativeDesignFurniture, axis: Point) => NativeDesignFurniture | null): NativeDesignFurniture | null {
  for (const face of faces) for (const [from, to] of face.free) {
    if (to - from < entry.widthMm) continue;
    for (const alongMm of [from + entry.widthMm / 2, to - entry.widthMm / 2]) {
      const candidate = fromModelFurniture(placeOnFace({ catalogId: entry.id, alongMm, cxMm: 0, cyMm: 0, rotation: 0, reason: 'Sanitario contra la pared' }, face));
      const done = candidate && place(candidate, faceAxis(face));
      if (done) return done;
    }
  }
  return null;
}
