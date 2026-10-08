export const GARDEN_PATH_MATERIALS = {
  losas: 'Losas continuas', 'pasos-cesped': 'Pasos sobre césped', 'pasos-grava': 'Pasos sobre grava',
  adoquin: 'Adoquines', grava: 'Grava natural', tierra: 'Tierra compactada',
} as const;
export type GardenPathMaterial = keyof typeof GARDEN_PATH_MATERIALS;
