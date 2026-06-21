/**
 * Recomendación de decoración propuesta por la IA (F4).
 *
 * La IA sugiere elementos del catálogo para enriquecer el plano; el usuario las
 * acepta o rechaza. Al aceptar, se materializan como objetos editables del plano
 * (mismo `kind` del catálogo), no como texto suelto: así quedan editables y
 * entran en el render por el flujo normal.
 */
import type { StructKind } from '@/canvas/types';

export interface DecorRecommendation {
  /** Tipo del catálogo a colocar (validado contra el catálogo en el servidor). */
  kind: StructKind;
  /** Posición sugerida en píxeles de stage. */
  x: number;
  y: number;
  /** Motivo breve de la recomendación, mostrado al usuario. */
  motivo: string;
}
