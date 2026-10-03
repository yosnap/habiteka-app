import type { ReactNode } from 'react';
import type { ConstructionCategory } from './construction-catalog';
import { NavigationAtlasImage } from './navigation-atlas-image';

const cells: Record<ConstructionCategory | 'terrain' | 'paving', number> = {
  walls: 0, columns: 1, outdoor: 2, patio: 3, rooms: 4, kitchen: 5,
  shapes: 6, doors: 7, windows: 8, passages: 9, ramps: 10, stairs: 11, terrain: 12, paving: 13,
};
// El atlas generado tiene separadores de 1–2 px y filas ligeramente distintas.
// Recortamos cada fotografía en CSS sin arrastrar líneas de la celda contigua.
const rowBounds = [[0, 234], [236, 469], [471, 705], [707, 942], [945, 1179], [1181, 1405], [1408, 1660]] as const;

export function ConstructionNavigationImage({ category, fallback }: { category: keyof typeof cells; fallback: ReactNode }) {
  const cell = cells[category], [top, bottom] = rowBounds[Math.floor(cell / 2)]!;
  return <NavigationAtlasImage src="/images/catalog/construction-v1.webp" width={948} height={1660}
    columns={2} rows={7} cell={cell} region={{ x: cell % 2 ? 476 : 0, y: top, width: 472, height: bottom - top }} fallback={fallback} />;
}
