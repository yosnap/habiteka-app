import { z } from 'zod';
import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import { IncompleteRenderReviewError } from './render-fidelity-verdict';

const schema = z.object({ checks: z.array(z.object({
  index: z.number().int().min(0),
  candidate: z.string().trim().min(1),
  status: z.enum(['preserved', 'changed', 'occluded', 'uncertain']),
  evidence: z.string().trim().min(1),
})) });

/** La referencia es inmutable: esta llamada solo ve la candidata, nunca reescribe lo leído en el original. */
export async function auditIsolatedReference(chat: ChatVisionAdapter, candidate: { base64: string; mimeType: string },
  facts: string[], cameraContext: string) {
  if (!facts.length) throw new IncompleteRenderReviewError('Falta la lectura independiente del diseño aceptado.');
  const result = await chat.chat({ model: '', temperature: 0, maxTokens: 4000, reasoning: { effort: 'medium' },
    responseSchema: z.toJSONSchema(schema) as JsonSchema,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        'La única imagen adjunta es una CANDIDATA, nunca la referencia aceptada.',
        'Estos hechos se leyeron ANTES y SOLO en la referencia aceptada. Son datos inmutables: no los reformules ni atribuyas a la referencia objetos que ahora ves en la candidata.',
        JSON.stringify(facts.map((reference, index) => ({ index, reference }))),
        cameraContext,
        'Devuelve exactamente un check por índice, sin duplicados. Describe únicamente lo visible en la candidata y su posición como evidencia. Compara cada hecho con la misma estancia, transformando la orientación de cámara.',
        'changed si un paso descrito como vacío contiene cómoda, alfombra u otro mueble visible; también si se inventa fondo, salida o se cambia el objeto. No asignes muebles de una habitación vecina al paso. No excuses una contradicción visible por iluminación o estilo.',
        'Las entradas AL OTRO LADO describen la habitación conectada en la CENITAL, no prometen que cada mueble sea visible por cada hueco. Si por una puerta queda oculto el escritorio y por su ventana sí se ve, no es un cambio: explica la oclusión de esa puerta. changed requiere una sustitución o contradicción visible, no ausencia fuera de campo.',
        'La referencia es cenital: no determina altura de vegetación ni troncos ocultos. Árbol/arbusto o porte mediano en la lectura son descripciones, no una medida. Una copa próxima a cámara puede ocupar el primer plano con tronco fuera del encuadre. Compara copa, tamaño relativo, posición, hojas y jardinera observables; no declares sustitución solo por no ver el tronco o por llamar arbusto a una copa.',
        'occluded solo si identificas el obstáculo o la parte fuera de encuadre. No certifica conservación. uncertain si la correspondencia o un rasgo visible no se puede verificar; no adivines lo oculto. No exijas ver desde una cámara interior todas las piezas contadas en la cenital: compara subconjuntos visibles y explica el resto oculto.',
      ].join('\n') },
      { type: 'image_url', ...candidate },
    ] }],
  });
  const parsed = schema.safeParse(result.structured);
  const checks = parsed.success ? parsed.data.checks : [];
  if (checks.length !== facts.length || new Set(checks.map(item => item.index)).size !== facts.length ||
    checks.some(item => item.index >= facts.length))
    throw new IncompleteRenderReviewError('La comprobación aislada no cubrió todos los rasgos de la referencia.');
  return checks.map(item => ({ element: `Rasgo de referencia ${item.index + 1}`, reference: facts[item.index]!,
    candidate: item.candidate, status: item.status, evidence: item.evidence }));
}
