/**
 * Opciones de aspecto de puertas y ventanas, independientes del tipo: diseño de la hoja, acabado, tirador y marco.
 * Sin dependencias para que el esquema, la validación y la interfaz compartan la misma lista.
 */
export const LEAF_DESIGNS = ['lisa', 'ranurada', 'molduras-2', 'molduras-4', 'franja-vidrio', 'vidrio-cuadriculado', 'lamas', 'vidrio'] as const;
export type LeafDesign = (typeof LEAF_DESIGNS)[number];

export const LEAF_FINISHES = ['lacado-blanco', 'roble', 'nogal', 'antracita', 'negro'] as const;
export type LeafFinish = (typeof LEAF_FINISHES)[number];

export const DOOR_HANDLES = ['ninguno', 'manilla', 'tirador', 'pomo'] as const;
export type DoorHandle = (typeof DOOR_HANDLES)[number];

export const FRAME_FINISHES = ['pvc-blanco', 'aluminio-antracita', 'madera'] as const;
export type FrameFinish = (typeof FRAME_FINISHES)[number];

export const LEAF_DESIGN_NAMES: Readonly<Record<LeafDesign, string>> = {
  lisa: 'Lisa',
  ranurada: 'Ranurada horizontal',
  'molduras-2': 'Con molduras (2 cuarterones)',
  'molduras-4': 'Con molduras (4 cuarterones)',
  'franja-vidrio': 'Con franja de vidrio',
  'vidrio-cuadriculado': 'Vidrio cuadriculado',
  lamas: 'De lamas',
  vidrio: 'Vidriera (vidrio completo)',
};

export const LEAF_FINISH_NAMES: Readonly<Record<LeafFinish, string>> = {
  'lacado-blanco': 'Lacado blanco',
  roble: 'Roble',
  nogal: 'Nogal',
  antracita: 'Gris antracita',
  negro: 'Negro',
};

export const DOOR_HANDLE_NAMES: Readonly<Record<DoorHandle, string>> = {
  ninguno: 'Sin tirador',
  manilla: 'Manilla',
  tirador: 'Tirador largo vertical',
  pomo: 'Pomo',
};

export const FRAME_FINISH_NAMES: Readonly<Record<FrameFinish, string>> = {
  'pvc-blanco': 'PVC blanco',
  'aluminio-antracita': 'Aluminio antracita',
  madera: 'Madera',
};

const isOneOf = <T extends string>(list: readonly T[]) => (value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const isLeafDesign = isOneOf(LEAF_DESIGNS);
export const isLeafFinish = isOneOf(LEAF_FINISHES);
export const isDoorHandle = isOneOf(DOOR_HANDLES);
export const isFrameFinish = isOneOf(FRAME_FINISHES);
