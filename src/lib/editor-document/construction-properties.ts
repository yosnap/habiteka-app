import type { Opening, Wall } from './schema';

export type WallConstruction = Required<Pick<Wall, 'heightMm' | 'materials'>>;
export type OpeningConstruction = Required<Pick<Opening,
  'heightMm' | 'elevationMm' | 'catalogId' | 'hinge' | 'swing' | 'openAngleDeg'>>;

/** Defaults for historical v2 views; never mutate the immutable source revision. */
export function wallConstruction(wall: Wall): WallConstruction {
  return {
    heightMm: wall.heightMm ?? 2700,
    materials: { ...(wall.materials ?? { left: 'plaster-white', right: 'plaster-white' }) },
  };
}
export function openingConstruction(opening: Opening): OpeningConstruction {
  return {
    heightMm: opening.heightMm ?? (opening.kind === 'ventana' ? 1200 : 2100),
    elevationMm: opening.elevationMm ?? (opening.kind === 'ventana' ? 900 : 0),
    catalogId: opening.catalogId ?? `${opening.kind}-basic`,
    hinge: opening.hinge ?? 'left',
    swing: opening.swing ?? 'left',
    openAngleDeg: opening.openAngleDeg ?? (opening.kind === 'puerta' ? 90 : 0),
  };
}
