import { OUTDOOR_MATERIALS } from './outdoor-materials';
import manifest from '../../../public/materials/polyhaven/manifest.json';

export const SURFACE_MATERIALS = [...manifest, ...OUTDOOR_MATERIALS];
const registry = new Map(SURFACE_MATERIALS.map((entry) => [entry.id, entry]));
export const surfaceMaterial = (id?: string) => id ? registry.get(id) : undefined;
export const SURFACE_CATEGORIES = [...new Set(SURFACE_MATERIALS.map((entry) => entry.category))];
