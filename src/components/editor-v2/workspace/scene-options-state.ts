import type { EditorDocument } from '@/lib/editor-document/schema';
import { buildingDocuments } from '@/lib/editor-document/building-levels';

export const SCENE_STYLES = {
  studio: {
    label: 'Estudio',
    background: '#eeede8',
    sky: '#ffffff',
    ground: '#a9aaa0',
    exposure: 1,
  },
  paper: {
    label: 'Papel',
    background: '#f6f3e9',
    sky: '#fff6df',
    ground: '#c7beb0',
    exposure: 1.1,
  },
  sunset: {
    label: 'Atardecer',
    background: '#a4824c',
    sky: '#ffd49b',
    ground: '#836347',
    exposure: 1,
  },
  overcast: {
    label: 'Nublado',
    background: '#c8ced1',
    sky: '#e6eff8',
    ground: '#929b9f',
    exposure: 0.9,
  },
  blueprint: {
    label: 'Azul',
    background: '#24415e',
    sky: '#aaccff',
    ground: '#435c80',
    exposure: 0.9,
  },
  mediterranean: {
    label: 'Mediterráneo',
    background: '#dcebf0',
    sky: '#fff1ce',
    ground: '#a6cbd2',
    exposure: 1.1,
  },
  twilight: {
    label: 'Crepúsculo',
    background: '#6b6383',
    sky: '#c3b2e5',
    ground: '#685677',
    exposure: 0.8,
  },
  night: {
    label: 'Noche',
    background: '#172330',
    sky: '#7699bd',
    ground: '#101820',
    exposure: 0.65,
  },
  verdant: {
    label: 'Verde',
    background: '#b7c5aa',
    sky: '#eef6dd',
    ground: '#728868',
    exposure: 1,
  },
} as const;
export type SceneStyle = keyof typeof SCENE_STYLES;
export interface SceneOptions {
  style: SceneStyle;
  garden: boolean;
  walls: boolean;
  grid: boolean;
  names: boolean;
  dimensions: boolean;
  units: 'metric' | 'imperial';
  gridStep: number;
}
export const DEFAULT_SCENE_OPTIONS: SceneOptions = {
  style: 'studio',
  garden: true,
  walls: true,
  grid: false,
  names: true,
  dimensions: false,
  units: 'metric',
  gridStep: 1,
};
export function sceneLength(mm: number, units: SceneOptions['units']) {
  return units === 'imperial' ? `${(mm / 304.8).toFixed(2)} ft` : `${(mm / 1000).toFixed(2)} m`;
}
/** Separación visual exclusivamente: las cotas constructivas permanecen intactas. */
export function explodedOffset(doc: EditorDocument, levelId: string | undefined, enabled: boolean) {
  if (!enabled) return 0;
  const levels = buildingDocuments(doc).sort((a, b) => a.elevationMm - b.elevationMm);
  return (
    Math.max(
      0,
      levels.findIndex((level) => level.id === levelId),
    ) * 4000
  );
}
export function sceneOptionHiddenIds(doc: EditorDocument, options: SceneOptions): string[] {
  const documents = buildingDocuments(doc).map((level) => level.document);
  return documents.flatMap((d) => [
    ...(!options.walls
      ? [...d.walls.map((wall) => wall.id), ...d.openings.map((opening) => opening.id)]
      : []),
    ...(!options.garden
      ? [
          ...(d.terrainSurfaces ?? []).map((surface) => surface.id),
          ...d.furniture
            .filter((item) =>
              /^(arbol|arbusto|planta-exterior|seto|huerto|jardinera-exterior)$/.test(item.kind),
            )
            .map((item) => item.id),
          ...(d.boundaries ?? [])
            .filter((item) => item.construction.infill === 'hedge')
            .map((item) => item.id),
        ]
      : []),
  ]);
}
