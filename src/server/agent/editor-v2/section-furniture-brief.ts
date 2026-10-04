import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';

type Image = { base64: string; mimeType: string };

const BRIEF_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['rooms'],
  properties: { rooms: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'furniture'],
    properties: { name: { type: 'string' }, furniture: { type: 'string' } } } } },
};

/**
 * Mobiliario de cada estancia abierta tal como se verá desde la cámara del alzado, leído de la cenital aceptada ya girada.
 * El generador de imágenes no traduce bien la planta a la vista frontal: enseñaba de frente camas cuyo cabecero toca la
 * fachada retirada. Es un extra: si la lectura falla, el alzado se genera sin ella.
 */
export async function sectionFurnitureBrief(chat: ChatVisionAdapter, acceptedTop: Image, rooms: string[]): Promise<string[]> {
  if (!rooms.length) return [];
  try {
    const result = await chat.chat({
      model: '', responseSchema: BRIEF_SCHEMA, temperature: 0, maxTokens: 3000, reasoning: { effort: 'low' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: [
          'La imagen es la planta cenital aceptada de un inmueble, girada para que su borde inferior sea la fachada que se retira en una maqueta abierta vista desde ese lado, a la altura de los ojos.',
          `Estancias abiertas, de izquierda a derecha: ${rooms.join(', ')}.`,
          'Para cada una, en una frase de 25 palabras como máximo, describe sus muebles principales tal como se verán desde esa cámara: qué queda al fondo, a la izquierda y a la derecha, y cómo se ve cada cama, sofá o mesa: de espaldas si su cabecero o respaldo está junto al borde inferior, de perfil si está junto a un lado, de frente si está junto al fondo.',
          'Describe solo lo que se ve en la planta, sin inventar muebles. Devuelve las estancias en el mismo orden y con el mismo nombre.',
        ].join('\n') },
        { type: 'image_url', base64: acceptedTop.base64, mimeType: acceptedTop.mimeType },
      ] }],
    });
    const described = (result.structured as { rooms?: { name?: unknown; furniture?: unknown }[] } | undefined)?.rooms ?? [];
    return rooms.flatMap((name) => {
      const furniture = described.find((room) => room.name === name)?.furniture;
      return typeof furniture === 'string' && furniture.trim() ? [`${name}: ${furniture.trim().slice(0, 220)}`] : [];
    });
  } catch {
    return [];
  }
}
