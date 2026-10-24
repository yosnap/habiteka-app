export type NameLabelFont = 'sans' | 'serif' | 'mono';
export interface NameLabelStyle {
  font: NameLabelFont;
  size: number;
  bold: boolean;
  color: string;
  background: string;
  backgroundVisible: boolean;
  radius: number;
}
export interface SceneOptions {
  style: 'studio' | 'paper' | 'sunset' | 'overcast' | 'blueprint' | 'mediterranean' | 'twilight' | 'night' | 'verdant';
  garden: boolean; walls: boolean; grid: boolean; names: boolean; dimensions: boolean;
  units: 'metric' | 'imperial'; gridStep: number; nameStyle: NameLabelStyle;
}
export const LABEL_FONTS = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'Courier New, monospace' } as const;
export const DEFAULT_NAME_STYLE: NameLabelStyle = {
  font: 'sans', size: 11, bold: true, color: '#29413c', background: '#ffffff', backgroundVisible: true, radius: 20,
};
export const DEFAULT_SCENE_OPTIONS: SceneOptions = {
  style: 'studio', garden: true, walls: true, grid: false, names: true, dimensions: true,
  units: 'metric', gridStep: 1, nameStyle: DEFAULT_NAME_STYLE,
};

/** Preferencias locales de visualización: nunca forman parte de la geometría ni de la aprobación. */
export function parseWorkspaceDisplay(value: string | null): SceneOptions {
  try {
    const source = JSON.parse(value ?? 'null') as Partial<SceneOptions> | null;
    if (!source || typeof source !== 'object') return DEFAULT_SCENE_OPTIONS;
    const next = { ...DEFAULT_SCENE_OPTIONS };
    for (const key of ['garden', 'walls', 'grid', 'names', 'dimensions'] as const)
      if (typeof source[key] === 'boolean') next[key] = source[key];
    if (['studio', 'paper', 'sunset', 'overcast', 'blueprint', 'mediterranean', 'twilight', 'night', 'verdant'].includes(source.style ?? '')) next.style = source.style!;
    if (source.units === 'metric' || source.units === 'imperial') next.units = source.units;
    if ([.5, 1, 2, 5].includes(source.gridStep ?? 0)) next.gridStep = source.gridStep!;
    const s = source.nameStyle;
    next.nameStyle = { ...DEFAULT_NAME_STYLE };
    if (s && typeof s === 'object') {
      if (['sans', 'serif', 'mono'].includes(s.font)) next.nameStyle.font = s.font;
      if (Number.isFinite(s.size)) next.nameStyle.size = Math.max(9, Math.min(24, s.size));
      if (Number.isFinite(s.radius)) next.nameStyle.radius = Math.max(0, Math.min(24, s.radius));
      for (const key of ['color', 'background'] as const) if (/^#[\da-f]{6}$/i.test(s[key] ?? '')) next.nameStyle[key] = s[key];
      for (const key of ['bold', 'backgroundVisible'] as const) if (typeof s[key] === 'boolean') next.nameStyle[key] = s[key];
    }
    return next;
  } catch { return DEFAULT_SCENE_OPTIONS; }
}
