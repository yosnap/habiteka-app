'use client';
import type { FurnitureRoom } from '@/lib/editor-document/furniture-catalog';
import { CatalogRoomArt } from './catalog-room-art';
import { NavigationAtlasImage } from './navigation-atlas-image';

const roomCells: Record<FurnitureRoom, number> = {
  salon: 0, dormitorio: 1, cocina: 2, bano: 3, comedor: 4, oficina: 5,
  exterior: 6, iluminacion: 7, decoracion: 8,
};
const categoryCells: Record<string, number> = {
  seating: 0, beds: 1, tables: 2, chairs: 3, storage: 4, kitchen: 5,
  bath: 6, lights: 7, decor: 8, windows: 9, screens: 10, outdoor: 11,
};

/** Imágenes genéricas de navegación: no representan un modelo concreto del catálogo. */
export function CatalogNavigationImage({ room, categoryId }: { room: FurnitureRoom; categoryId?: string }) {
  const category = categoryId !== undefined && categoryCells[categoryId] !== undefined;
  const cell = category ? categoryCells[categoryId]! : roomCells[room];
  return <NavigationAtlasImage src={`/images/catalog/${category ? 'categories' : 'rooms'}-v1.webp`}
    width={category ? 1086 : 1536} height={category ? 1448 : 1024} columns={3} rows={category ? 4 : 3}
    cell={cell} fallback={<CatalogRoomArt room={room} />} />;
}
