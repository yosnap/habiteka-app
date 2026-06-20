/**
 * Plano 2D estructurado como árbol serializable.
 *
 * Lo produce la fase de entrega del agente y lo consumen (a) la UI que lo
 * renderiza en canvas y (b) la regeneración parcial del feedback. El diseño en
 * árbol de zonas con `id` estable permite localizar y reemplazar el subárbol de
 * una zona concreta sin tocar el resto del plano.
 *
 * Las coordenadas son métricas (en milímetros) para preservar las cotas; el
 * renderizador las proyecta al lienzo.
 */

/** Punto en el plano, en milímetros. */
export interface PlanPoint {
  x: number;
  y: number;
}

/** Pared como segmento con grosor. */
export interface PlanWall {
  id: string;
  from: PlanPoint;
  to: PlanPoint;
  thicknessMm: number;
}

export type ApertureKind = 'puerta' | 'ventana' | 'hueco';

/** Apertura anclada a una pared (puerta/ventana/hueco). */
export interface PlanAperture {
  id: string;
  kind: ApertureKind;
  /** Pared sobre la que se sitúa la apertura. */
  wallId: string;
  /** Posición a lo largo de la pared (0–1 desde `from`). */
  position: number;
  widthMm: number;
}

/** Cota acotada entre dos puntos, con su valor textual. */
export interface PlanDimension {
  id: string;
  from: PlanPoint;
  to: PlanPoint;
  /** Etiqueta mostrada (p. ej. '3.20 m'). */
  label: string;
}

/**
 * Zona (estancia) del plano. Es la unidad de regeneración parcial: el feedback
 * puede reemplazar una zona completa por su `id` sin alterar las demás.
 */
export interface PlanZone {
  id: string;
  name: string;
  /** Contorno de la zona en milímetros. */
  outline: PlanPoint[];
  walls: PlanWall[];
  apertures: PlanAperture[];
  dimensions: PlanDimension[];
}

export interface Plano2dPayload {
  /** Versión del esquema del plano (para migraciones de formato). */
  schemaVersion: number;
  zones: PlanZone[];
}
