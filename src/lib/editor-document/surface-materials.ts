import { OUTDOOR_MATERIALS } from './outdoor-materials';
import manifest from '../../../public/materials/polyhaven/manifest.json';

export const SURFACE_MATERIALS = [...manifest, ...OUTDOOR_MATERIALS];
const registry = new Map(SURFACE_MATERIALS.map((entry) => [entry.id, entry]));
export const surfaceMaterial = (id?: string) => id ? registry.get(id) : undefined;
export const SURFACE_CATEGORIES = [...new Set(SURFACE_MATERIALS.map((entry) => entry.category))];

// El albedo fotografiado de este yeso CC0 es marrón grisáceo. Para el acabado
// pintado se conserva su relieve y rugosidad, pero se usa una base blanca neutra.
const APPEARANCE_OVERRIDES: Record<string, { baseColor: string; useColorMap: false }> = {
  'polyhaven:white_plaster_02': { baseColor: '#f3f0e9', useColorMap: false },
};
export const surfaceMaterialAppearance = (id?: string) => id ? APPEARANCE_OVERRIDES[id] : undefined;
