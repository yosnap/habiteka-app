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

/**
 * Hacia dónde mira el "frente" del modelo glTF en su orientación original (ejes del modelo):
 * `+z`/`-z`/`+x`/`-x`. Es un dato por modelo (el bounding box no lo codifica: la cama y el sofá
 * tienen un frente que hay que declarar). El render lo combina con la alineación automática por
 * proporción y con la rotación de colocación para orientar el mueble SIN ángulos calibrados a mano.
 * Por defecto `+z` (la convención del editor: rotación 0 mira a +Z / sur).
 */
export type FrontAxis = '+z' | '-z' | '+x' | '-x';

export interface FurnitureModel {
  /** URL pública del .glb (servido desde `public/`). */
  url: string;
  /** Eje local hacia el que mira el frente del modelo. Por defecto '+z'. */
  front?: FrontAxis;
}

/** Modelos disponibles por kind. Parcial: lo no listado usa placeholder. */
export const FURNITURE_MODELS: Partial<Record<StructKind, FurnitureModel>> = {
  // Mobiliario
  silla: { url: '/models/cc0/silla.glb' },
  sofa: { url: '/models/cc0/sofa.glb' },
  // Frente medido de la geometría: el cabecero de la cama está en +Z, así que su frente (pies)
  // mira a −Z. Declararlo fija el sentido (cabecero contra la pared), no solo el eje.
  cama: { url: '/models/cc0/cama.glb', front: '-z' },
  // El armario tiene el lado largo y las puertas en una cara X del modelo; el frente mira a +X.
  armario: { url: '/models/cc0/armario.glb', front: '+x' },
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

/** ¿El modelo declara su `front`? Si sí, el render usa ese dato; si no, infiere la orientación
 *  del eje por la proporción del bounding box. */
export function hasFront(kind: StructKind): boolean {
  return FURNITURE_MODELS[kind]?.front != null;
}

/** Ángulo (rad) en que el frente del modelo está girado respecto a +Z (la dirección que el
 *  editor considera "de frente" con rotación 0). El render lo resta para que el frente quede
 *  hacia donde la colocación pide. Deriva del `front` declarado por modelo (por defecto +z = 0). */
export function furnitureFrontAngle(kind: StructKind): number {
  switch (FURNITURE_MODELS[kind]?.front) {
    case '-z':
      return Math.PI;
    case '+x':
      return Math.PI / 2;
    case '-x':
      return -Math.PI / 2;
    default:
      return 0; // '+z' o sin declarar
  }
}

/** URLs de todos los modelos, para precargar (`useGLTF.preload`). */
export function allFurnitureModelUrls(): string[] {
  return Object.values(FURNITURE_MODELS).map((m) => m.url);
}
