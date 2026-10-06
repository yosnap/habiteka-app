import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import { UserFacingError } from '@/server/errors/user-facing-error';

type Image = { base64: string; mimeType: string };

const BRIEF_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['rooms'],
  properties: { rooms: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'furniture'],
    properties: { name: { type: 'string' }, furniture: { type: 'string' } } } } },
};

/**
 * Mobiliario de cada estancia abierta tal como se verá desde la cámara del alzado, leído de la cenital aceptada ya girada.
 * El generador de imágenes no traduce bien la planta a la vista frontal: enseñaba de frente camas cuyo cabecero toca la
 * fachada retirada. Si no se puede leer, se detiene antes de llamar al generador: el plano no sustituye el diseño.
 */
export async function sectionFurnitureBrief(chat: ChatVisionAdapter, acceptedTop: Image, rooms: string[], visibilityHints: string[] = []): Promise<string[]> {
  if (!rooms.length) return [];
  try {
    const result = await chat.chat({
      model: '', responseSchema: BRIEF_SCHEMA, temperature: 0, maxTokens: 3000, reasoning: { effort: 'low' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: [
          'La imagen es la planta cenital aceptada de un inmueble, girada para que su borde inferior sea la fachada que se retira en una maqueta abierta vista desde ese lado, a la altura de los ojos.',
          `Estancias abiertas, de izquierda a derecha: ${rooms.join(', ')}.`,
          ...rooms.flatMap((name, index) => visibilityHints[index] ? [`Visibilidad de ${name}: ${visibilityHints[index]}`] : []),
          'Para cada una, en una frase de 25 palabras como máximo, describe sus muebles principales tal como se verán desde esa cámara: qué queda al fondo, a la izquierda y a la derecha, y cómo se ve cada cama, sofá o mesa: de espaldas si su cabecero o respaldo está junto al borde inferior, de perfil si está junto a un lado, de frente si está junto al fondo.',
          'Describe solo lo que se ve en la planta y queda visible desde esa cámara, sin inventar muebles ni sacar objetos de una franja oculta. Devuelve TODAS las estancias en el mismo orden y con el mismo nombre, incluso si su franja visible está vacía (indica sin muebles visibles). No uses muebles del plano técnico para rellenar un diseño que no puedes reconocer.',
        ].join('\n') },
        { type: 'image_url', base64: acceptedTop.base64, mimeType: acceptedTop.mimeType },
      ] }],
    });
    const described = (result.structured as { rooms?: { name?: unknown; furniture?: unknown }[] } | undefined)?.rooms ?? [];
    const used = new Set<number>();
    return rooms.map(name => {
      const index = described.findIndex((room, i) => !used.has(i) && room.name === name);
      const furniture = described[index]?.furniture;
      if (typeof furniture !== 'string' || !furniture.trim()) throw new Error('Estancia no leída');
      used.add(index);
      return `${name}: ${furniture.trim().slice(0, 400)}`;
    });
  } catch {
    throw new UserFacingError('No se pudo leer el diseño de todas las estancias en la cenital aceptada. Se ha detenido la vista antes de generar una imagen.');
  }
}
