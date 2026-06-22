/**
 * Mapa declarativo `kind` → modelo glTF para el render 3D (F6.2). Solo los kinds con
 * un modelo real; el resto cae a un placeholder (caja etiquetada) en el render. Añadir
 * un modelo nuevo = una entrada aquí + su `.glb` en `public/models/`.
 *
 * Modelos en `public/models/cc0/` con su procedencia/licencia en `manifest.json`. La mayoría
 * son CC0 de Quaternius (mismo estilo low-poly, coherente) vía Poly Pizza; silla/ducha de otros
 * autores CC0; sofa es CC-BY (atribución). Comprimidos con `@gltf-transform/cli` (WebP+meshopt).
 *
 * La `lampara` sigue como placeholder (no se encontró una lámpara de interior CC0 adecuada).
 */
import type { StructKind } from '../types';

export interface FurnitureModel {
  /** URL pública del .glb (servido desde `public/`). */
  url: string;
  /**
   * Corrección de orientación del glTF en radianes (F7.6): se SUMA a la rotación del
   * objeto. Compensa que el modelo venga girado respecto a su "frente" esperado (el doc
   * orienta el mueble por su rotación; este offset alinea el modelo con esa intención).
   * Calibrado por modelo mirando el render. 0 = el glTF ya viene bien orientado.
   */
  frontOffsetRad?: number;
}

/** Modelos disponibles por kind. Parcial: lo no listado usa placeholder. */
export const FURNITURE_MODELS: Partial<Record<StructKind, FurnitureModel>> = {
  // Mobiliario
  silla: { url: '/models/cc0/silla.glb' },
  sofa: { url: '/models/cc0/sofa.glb' },
  cama: { url: '/models/cc0/cama.glb' },
  armario: { url: '/models/cc0/armario.glb' },
  mesa: { url: '/models/cc0/mesa.glb' },
  // Cocina
  nevera: { url: '/models/cc0/nevera.glb' },
  horno: { url: '/models/cc0/horno.glb' },
  fregadero: { url: '/models/cc0/fregadero.glb' },
  // Sanitarios
  inodoro: { url: '/models/cc0/inodoro.glb' },
  lavabo: { url: '/models/cc0/lavabo.glb' },
  ducha: { url: '/models/cc0/ducha.glb' },
  // Electrónica / decoración
  tv: { url: '/models/cc0/tv.glb' },
  planta: { url: '/models/cc0/planta.glb' },
};

/** URL del modelo de un kind, o null si no hay (→ placeholder). */
export function furnitureModelUrl(kind: StructKind): string | null {
  return FURNITURE_MODELS[kind]?.url ?? null;
}

/** Offset de orientación (rad) del modelo de un kind; 0 si no hay modelo o no se calibró. */
export function furnitureFrontOffset(kind: StructKind): number {
  return FURNITURE_MODELS[kind]?.frontOffsetRad ?? 0;
}

/** URLs de todos los modelos, para precargar (`useGLTF.preload`). */
export function allFurnitureModelUrls(): string[] {
  return Object.values(FURNITURE_MODELS).map((m) => m.url);
}
