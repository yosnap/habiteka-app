/** Criterios visuales: no son la fiabilidad del plano ni una aceptación del usuario. */
export const RENDER_FIDELITY_CRITERIA = {
  cameraAndGeometryPreserved: 'Arquitectura y proporciones',
  roomUsesPreserved: 'Uso de las estancias',
  doorsPhysicallyCoherent: 'Puertas y ventanas',
  circulationPreserved: 'Pasos y circulación',
  photorealistic: 'Realismo y nitidez',
  objectIdentityPreserved: 'Identidad del mobiliario',
  redesignApplied: 'Cambios solicitados',
} as const;

export type RenderFidelityCriterion = keyof typeof RENDER_FIDELITY_CRITERIA;
export interface RenderFidelityCheck {
  id: string;
  name?: string;
  status: 'pass' | 'fail' | 'not-visible';
  observation: string;
}
export interface RenderFidelityReport {
  version: string;
  status: 'passed' | 'rejected';
  checkedAt: string;
  model?: string;
  /** Ausente en informes antiguos: nunca inventar criterios a partir del aprobado global. */
  criteria?: { id: RenderFidelityCriterion; status: 'pass' | 'fail' | 'uncertain'; observation: string }[];
  violations?: string[];
  roomChecks: RenderFidelityCheck[];
  openingChecks: RenderFidelityCheck[];
  /** Controles explícitos desde v3; ausentes en informes anteriores. */
  openAreaChecks?: RenderFidelityCheck[];
  /** Inventario exterior desde v4; no disponible en informes históricos. */
  exteriorChecks?: RenderFidelityCheck[];
  /** Cantidades y función de sanitarios y placas desde v5. */
  fixtureChecks?: RenderFidelityCheck[];
  constructionCheck?: { status: 'pass' | 'fail' | 'uncertain'; observation: string };
}
