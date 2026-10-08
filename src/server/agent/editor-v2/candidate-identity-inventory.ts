import { z } from 'zod';
import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import { IncompleteRenderReviewError } from './render-fidelity-verdict';

type Image = { base64: string; mimeType: string };
const inventorySchema = z.object({ observations: z.array(z.object({
  group: z.string().trim().min(1),
  appearance: z.string().trim().min(1),
  visiblePieces: z.array(z.object({
    location: z.string().trim().min(1),
    description: z.string().trim().min(1),
  })),
})).min(1) });

/** Sin referencia ni veredicto anterior: evita trasladar cantidades entre cámaras. */
export async function candidateIdentityInventory(chat: ChatVisionAdapter, candidate: Image, details: Image[]) {
  const result = await chat.chat({ model: '', temperature: 0, maxTokens: 3000, reasoning: { effort: 'medium' },
    responseSchema: z.toJSONSchema(inventorySchema) as JsonSchema,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        'Describe únicamente lo que ves en esta imagen del inmueble, sin imaginar un diseño anterior.',
        'Agrupa muebles, textiles, cocina, vehículos y vegetación visibles. Describe material, color, forma, respaldo, patas y disposición en appearance. Incluye también pavimento y cubierta si se ven.',
        'No resumas todo un sofá o cama por su color dominante. Registra por separado los cojines, mantas y colchas visibles (cada color y posición), y describe también los brazos y laterales del mueble. Señala contrastes de color o material entre brazos y tapicería, aunque afecten a una parte pequeña. Incluye estos grupos en observations y localiza sus piezas visibles.',
        'Para grupos de objetos contables enumera cada pieza VISIBLE en visiblePieces con su centro aproximado (x%,y% de la primera imagen) en location y sus rasgos en description. Una pieza tapada parcialmente cuenta si puedes identificarla. No inventes piezas totalmente ocultas ni cantidades habituales.',
        'No cuentes el respaldo y asiento de una misma pieza como dos objetos ni confundas sillas de comedor con taburetes de barra. Para superficies continuas visiblePieces queda vacío.',
        'La primera imagen es la completa. Si siguen cuatro imágenes, son detalles de la MISMA imagen: arriba izquierda/derecha, abajo izquierda/derecha. Se solapan: no sumes objetos repetidos.',
      ].join('\n') },
      ...[candidate, ...details].map(image => ({ type: 'image_url' as const, ...image })),
    ] }],
  });
  const parsed = inventorySchema.safeParse(result.structured);
  if (!parsed.success) throw new IncompleteRenderReviewError('No se pudo leer por separado la identidad de la imagen generada.');
  return parsed.data.observations.map(group => ({ ...group, visibleCount: group.visiblePieces.length }));
}
