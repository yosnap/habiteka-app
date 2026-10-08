import type { TerrainSurface } from './schema';

export const OUTDOOR_SURFACE_PRESETS = [
  { id: 'asfalto', name: 'Asfaltado', texture: 'polyhaven:asphalt_02', tileSizeMm: 3000 },
  { id: 'grava', name: 'Grava natural', texture: 'polyhaven:gravel_road', tileSizeMm: 2000 },
  { id: 'tierra', name: 'Tierra compactada', texture: 'polyhaven:brown_mud_dry', tileSizeMm: 2000 },
  { id: 'cesped', name: 'Césped natural', texture: 'outdoor:grass-lawn-pbr', tileSizeMm: 1400 },
  { id: 'corteza', name: 'Corteza de madera', texture: 'polyhaven:wood_chips', tileSizeMm: 1000 },
  { id: 'arena', name: 'Arena natural', texture: 'polyhaven:sand_01', tileSizeMm: 2000 },
] as const;
export type OutdoorSurfacePresetId = typeof OUTDOOR_SURFACE_PRESETS[number]['id'];

export function applySurfacePreset(surface: TerrainSurface, id?: OutdoorSurfacePresetId): TerrainSurface {
  const preset = OUTDOOR_SURFACE_PRESETS.find((entry) => entry.id === id);
  return preset ? { ...surface, name: preset.name, texture: preset.texture, tileSizeMm: preset.tileSizeMm, color: '#ffffff' } : surface;
}
