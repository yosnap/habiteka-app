'use client';
import type { FurnitureRoom } from '@/lib/editor-document/furniture-catalog';
import { NavigationAtlasImage } from './navigation-atlas-image';

/** Atlas de fotos de habitaciones: el de las nueve primeras y el de las cuatro que se añadieron después. */
const ROOM_ATLASES = {
  base: { src: '/images/catalog/rooms-v1.webp', width: 1536, height: 1024, columns: 3, rows: 3 },
  extra: { src: '/images/catalog/rooms-extra-v1.webp', width: 1024, height: 682, columns: 2, rows: 2 },
} as const;
const roomCells: Record<FurnitureRoom, readonly [keyof typeof ROOM_ATLASES, number]> = {
  salon: ['base', 0], dormitorio: ['base', 1], cocina: ['base', 2], bano: ['base', 3], comedor: ['base', 4], oficina: ['base', 5],
  exterior: ['base', 6], iluminacion: ['base', 7], decoracion: ['base', 8],
  infantil: ['extra', 0], recibidor: ['extra', 1], lavadero: ['extra', 2], garaje: ['extra', 3],
};
const categoryCells: Record<string, number> = {
  seating: 0, beds: 1, tables: 2, chairs: 3, storage: 4, kitchen: 5,
  bath: 6, lights: 7, decor: 8, windows: 9, screens: 10, outdoor: 11,
};

/** Fotos genéricas de navegación: no representan un modelo concreto del catálogo. */
export function CatalogNavigationImage({ room, categoryId }: { room: FurnitureRoom; categoryId?: string }) {
  if (categoryId !== undefined && categoryCells[categoryId] !== undefined) {
    return <NavigationAtlasImage src="/images/catalog/categories-v1.webp" width={1086} height={1448} columns={3} rows={4}
      cell={categoryCells[categoryId]!} />;
  }
  const [atlas, cell] = roomCells[room];
  return <NavigationAtlasImage {...ROOM_ATLASES[atlas]} cell={cell} />;
}
