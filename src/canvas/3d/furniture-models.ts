/**
 * Mapa declarativo `kind` → modelo glTF para el render 3D (F6.2). Solo los kinds con
 * un modelo real; el resto cae a un placeholder (caja etiquetada) en el render. Añadir
 * un modelo nuevo = una entrada aquí + su `.glb` en `public/models/`.
 *
 * Licencias de los modelos actuales (en `public/models/cc0/`):
 *   - silla  → SheenChair (Wayfair, CC0)
 *   - lampara → Lantern (Microsoft, CC0)
 *   - sofa   → GlamVelvetSofa (Wayfair, CC-BY 4.0 — requiere atribución)
 * Modelos CC0 sueltos por decisión del usuario (jun-2026); el Kit de Kenney completo es
 * trabajo futuro. Mantener la atribución de los CC-BY al publicar.
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
  silla: { url: '/models/cc0/silla.glb' },
  lampara: { url: '/models/cc0/lampara.glb' },
  sofa: { url: '/models/cc0/sofa.glb' },
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
