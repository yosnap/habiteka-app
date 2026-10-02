export const LIGHTING_PRESETS = ['daylight', 'afternoon', 'warm', 'evening'] as const;
export type LightingPreset = (typeof LIGHTING_PRESETS)[number];
export const LIGHTING_LABELS: Record<LightingPreset, string> = {
  daylight: 'Día', afternoon: 'Tarde', warm: 'Atardecer', evening: 'Noche',
};
export const LIGHTING_DESCRIPTIONS: Record<LightingPreset, string> = {
  daylight: 'luz natural de día',
  afternoon: 'luz natural de tarde, sol más bajo y sombras largas, sin convertirla en atardecer ni noche',
  warm: 'luz cálida de atardecer', evening: 'escena nocturna',
};
