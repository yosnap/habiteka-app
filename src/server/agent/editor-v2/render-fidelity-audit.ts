import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';

type Image = { base64: string; mimeType: string };

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['accepted', 'violations'],
  properties: {
    accepted: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
  },
};

function isVerdict(value: unknown): value is { accepted: boolean; violations: string[] } {
  return typeof value === 'object' && value !== null
    && typeof (value as { accepted?: unknown }).accepted === 'boolean'
    && Array.isArray((value as { violations?: unknown }).violations)
    && (value as { violations: unknown[] }).violations.every((item) => typeof item === 'string');
}

/** Contrasta una imagen candidata con la captura real antes de publicarla como diseño. */
export async function assertRenderFidelity(
  chat: ChatVisionAdapter,
  capture: Image,
  candidate: Image,
  view: RenderView,
  mask?: Image,
): Promise<void> {
  const result = await chat.chat({
    model: '', responseSchema: VERDICT_SCHEMA, temperature: 0,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        `Audita la fidelidad de un diseño arquitectónico. Ángulo solicitado: ${view.preset}.`,
        'Imagen 1: captura original del 3D del proyecto. Imagen 2: diseño candidato.',
        ...(mask ? ['Imagen 3: máscara de zonas permitidas (blanco = se pueden añadir objetos; negro = no).'] : []),
        'Acepta mejoras de materiales, iluminación y realismo. La maqueta original puede tener muros cortados para ver el interior.',
        'Rechaza si cambia el punto de vista, orientación, silueta, número o posición de plantas, muros, huecos, escaleras, rampas, piscina o accesos visibles.',
        'Rechaza si sustituye el inmueble por otra casa, extiende la maqueta fuera de sus bordes, inserta una imagen del 3D dentro de otra escena, o produce un collage, superposición o doble arquitectura.',
        'Rechaza si desaparecen o se desplazan muebles grandes visibles o si se añaden construcciones.',
        ...(mask ? ['Fuera del blanco no deben aparecer objetos nuevos ni cambiar la distribución. El acabado de materiales y luz sí puede mejorar.'] : []),
        'No penalices diferencias normales de textura o decoración permitida. Ante duda sobre geometría o cámara, rechaza.',
        'Devuelve accepted y una lista breve de violaciones observables.',
      ].join('\n') },
      { type: 'image_url', base64: capture.base64, mimeType: capture.mimeType },
      { type: 'image_url', base64: candidate.base64, mimeType: candidate.mimeType },
      ...(mask ? [{ type: 'image_url' as const, base64: mask.base64, mimeType: mask.mimeType }] : []),
    ] }],
  });
  const verdict = result.structured;
  if (!isVerdict(verdict) || !verdict.accepted || verdict.violations.length) {
    const detail = isVerdict(verdict) ? verdict.violations.slice(0, 3).join('; ').slice(0, 300) : '';
    throw new Error(`Se descartó el diseño porque no respeta la vista 3D${detail ? `: ${detail}` : '.'}`);
  }
}
