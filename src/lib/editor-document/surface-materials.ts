import { OUTDOOR_MATERIALS } from './outdoor-materials';
import polyhavenManifest from '../../../public/materials/polyhaven/manifest.json';
import cc0Manifest from '../../../public/materials/cc0/manifest.json';
import { LEGACY_SURFACE_NAMES, SURFACE_CATEGORY_ORDER } from './surface-material-names';

/**
 * Biblioteca local de acabados: la primera selección de Poly Haven (ids históricos, renombrada al español), la
 * biblioteca CC0 de ambientCG y Poly Haven (scripts/import-cc0-materials.mjs) y las texturas exteriores propias.
 * Se ordena por categoría (suelos, paredes, fachada, exterior) para que el selector agrupe lo parecido.
 */
const legacy = polyhavenManifest.map((entry) => {
  const names = LEGACY_SURFACE_NAMES[entry.id];
  return names ? { ...entry, label: names[0], category: names[1] } : entry;
});
const categoryRank = (category: string) => {
  const index = (SURFACE_CATEGORY_ORDER as readonly string[]).indexOf(category);
  return index < 0 ? SURFACE_CATEGORY_ORDER.length : index;
};
export const SURFACE_MATERIALS = [...legacy, ...cc0Manifest, ...OUTDOOR_MATERIALS]
  .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
const registry = new Map(SURFACE_MATERIALS.map((entry) => [entry.id, entry]));
export const surfaceMaterial = (id?: string) => id ? registry.get(id) : undefined;
export const SURFACE_CATEGORIES = [...new Set(SURFACE_MATERIALS.map((entry) => entry.category))];

// El albedo fotografiado de este yeso CC0 es marrón grisáceo. Para el acabado
// pintado se conserva su relieve y rugosidad, pero se usa una base blanca neutra.
const APPEARANCE_OVERRIDES: Record<string, { baseColor: string; useColorMap: false }> = {
  'polyhaven:white_plaster_02': { baseColor: '#f3f0e9', useColorMap: false },
};
export const surfaceMaterialAppearance = (id?: string) => id ? APPEARANCE_OVERRIDES[id] : undefined;
