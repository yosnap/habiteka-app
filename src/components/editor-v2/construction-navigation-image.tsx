import type { ConstructionCategory } from './construction-catalog';
import { NavigationAtlasImage } from './navigation-atlas-image';

// Las celdas 12 y 13 (terreno y pavimento) ya no se usan: esas fichas tienen foto de producto propia.
const cells: Record<ConstructionCategory, number> = {
  walls: 0, columns: 1, outdoor: 2, patio: 3, rooms: 4, kitchen: 5,
  shapes: 6, doors: 7, windows: 8, passages: 9, ramps: 10, stairs: 11,
};
// El atlas generado tiene separadores de 1–2 px y filas ligeramente distintas.
// Recortamos cada fotografía en CSS sin arrastrar líneas de la celda contigua.
const rowBounds = [[0, 234], [236, 469], [471, 705], [707, 942], [945, 1179], [1181, 1405], [1408, 1660]] as const;

/** Foto de cada categoría del menú Construir. */
export function ConstructionNavigationImage({ category }: { category: ConstructionCategory }) {
  const cell = cells[category], [top, bottom] = rowBounds[Math.floor(cell / 2)]!;
  return <NavigationAtlasImage src="/images/catalog/construction-v1.webp" width={948} height={1660}
    columns={2} rows={7} cell={cell} region={{ x: cell % 2 ? 476 : 0, y: top, width: 472, height: bottom - top }} />;
}
