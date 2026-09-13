import manifest from '../../../public/materials/polyhaven/manifest.json';

export const SURFACE_MATERIALS = manifest;
const registry = new Map(manifest.map((entry) => [entry.id, entry]));
export const surfaceMaterial = (id?: string) => id ? registry.get(id) : undefined;
export const SURFACE_CATEGORIES = [...new Set(manifest.map((entry) => entry.category))];
