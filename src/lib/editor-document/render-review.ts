/** Revisión posterior: una auditoría automática puede dejar pasar un defecto visual. */
export interface RenderReview {
  status: 'rejected';
  reason: string;
  reviewedAt: string;
}

export function renderReviewIssue(generation?: { review?: RenderReview }): string | null {
  return generation?.review?.status === 'rejected'
    ? (typeof generation.review.reason === 'string' && generation.review.reason.trim())
      || 'Imagen descartada tras revisar su fidelidad.'
    : null;
}

/** La auditoría automática no sustituye la decisión del usuario sobre el diseño. */
export function acceptedRenderIssue(generation?: { provider?: string; review?: RenderReview; acceptance?: { acceptedAt: string; userId: string } }): string | null {
  if (!generation?.provider || generation.provider === 'native') return 'Solo se admiten diseños generados con IA; el 3D del plano es una guía.';
  const rejected = renderReviewIssue(generation);
  if (rejected) return rejected;
  if (!generation.acceptance?.userId || !Number.isFinite(Date.parse(generation.acceptance.acceptedAt)))
    return 'Abre la imagen en Diseños y acepta su diseño antes de usarla en un vídeo.';
  return null;
}

export const FURNITURE_USE_RULE = 'Conserva la función reconocible de cada mueble visible. Los pies y cabeceros de las camas siguen perteneciendo a camas completas: nunca los interpretes como butacas, sillas ni sofás. Puedes cambiar su estilo dentro de los permisos, pero no convertir un dormitorio en una sala de estar. Las placas de cocina siguen siendo placas, nunca bandejas ni decoración. La pieza plana con aros o quemadores sobre una isla o encimera es la placa de cocción: conserva sus fogones reconocibles, su posición y tamaño. No la conviertas en tabla, frutero, jarrón ni bandeja; tampoco la tapes con objetos. No añadas una placa en una cámara que no la muestra.';
