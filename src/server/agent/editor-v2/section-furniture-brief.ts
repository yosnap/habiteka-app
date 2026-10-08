import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import { UserFacingError } from '@/server/errors/user-facing-error';

type Image = { base64: string; mimeType: string };

/** Lado del cabecero o respaldo en la cenital girada: abajo es la fachada retirada, la más cercana a la cámara. */
export type PieceFacing = 'behind' | 'front' | 'profile-left' | 'profile-right';
export interface SectionPiece { kind: 'bed' | 'sofa'; facing: PieceFacing }
/** Una línea por estancia para el prompt y sus camas y sofás; `null` si esa estancia no se pudo leer con seguridad. */
export interface SectionFurnitureBrief { lines: string[]; pieces: (SectionPiece[] | null)[] }

const FACINGS: PieceFacing[] = ['behind', 'front', 'profile-left', 'profile-right'];
const BRIEF_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['rooms'],
  properties: { rooms: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'furniture', 'pieces'],
    properties: { name: { type: 'string' }, furniture: { type: 'string' }, pieces: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['kind', 'facing'],
      properties: { kind: { type: 'string', enum: ['bed', 'sofa'] }, facing: { type: 'string', enum: FACINGS } } } } } } } },
};

/**
 * Mobiliario de cada estancia abierta tal como se verá desde la cámara del alzado, leído de la cenital aceptada ya girada.
 * El generador de imágenes no traduce bien la planta a la vista frontal: enseñaba de frente camas cuyo cabecero toca la
 * fachada retirada. Si no se puede leer, se detiene antes de llamar al generador: el plano no sustituye el diseño.
 */
export async function sectionFurnitureBrief(chat: ChatVisionAdapter, acceptedTop: Image, rooms: string[], visibilityHints: string[] = []): Promise<SectionFurnitureBrief> {
  if (!rooms.length) return { lines: [], pieces: [] };
  try {
    const result = await chat.chat({
      model: '', responseSchema: BRIEF_SCHEMA, temperature: 0, maxTokens: 3000, reasoning: { effort: 'low' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: [
          'La imagen es la planta cenital aceptada de un inmueble, girada para que su borde inferior sea la fachada que se retira en una maqueta abierta vista desde ese lado, a la altura de los ojos.',
          `Estancias abiertas, de izquierda a derecha: ${rooms.join(', ')}.`,
          ...rooms.flatMap((name, index) => visibilityHints[index] ? [`Visibilidad de ${name}: ${visibilityHints[index]}`] : []),
          'Para cada una, en una frase de 25 palabras como máximo, describe sus muebles principales tal como se verán desde esa cámara: qué queda al fondo, a la izquierda y a la derecha, y cómo se ve cada cama, sofá o mesa: de espaldas si su cabecero o respaldo está junto al borde inferior, de perfil si está junto a un lado, de frente si está junto al fondo.',
          // Su orientación sale del plano: la lectura decía «de frente a la cámara» un coche aparcado de lado.
          'No describas vehículos: su tipo y su orientación se indican aparte. En una cochera, describe solo los muebles o escribe sin muebles visibles.',
          'En pieces enumera cada cama y cada sofá visibles de esa estancia, uno por elemento, según dónde toca su cabecero o respaldo en esta imagen: behind si toca el borde inferior (desde la cámara se ve por detrás), front si toca el borde superior, profile-left si toca el lado izquierdo y profile-right si toca el derecho. Vacío si no hay ninguno.',
          'Describe solo lo que se ve en la planta y queda visible desde esa cámara, sin inventar muebles ni sacar objetos de una franja oculta. Devuelve TODAS las estancias en el mismo orden y con el mismo nombre, incluso si su franja visible está vacía (indica sin muebles visibles). No uses muebles del plano técnico para rellenar un diseño que no puedes reconocer.',
        ].join('\n') },
        { type: 'image_url', base64: acceptedTop.base64, mimeType: acceptedTop.mimeType },
      ] }],
    });
    const described = (result.structured as { rooms?: { name?: unknown; furniture?: unknown; pieces?: unknown }[] } | undefined)?.rooms ?? [];
    const used = new Set<number>();
    const read = rooms.map(name => {
      const index = described.findIndex((room, i) => !used.has(i) && room.name === name);
      const furniture = described[index]?.furniture;
      if (typeof furniture !== 'string' || !furniture.trim()) throw new Error('Estancia no leída');
      used.add(index);
      return { line: `${name}: ${furniture.trim().slice(0, 400)}`, pieces: validPieces(described[index]?.pieces) };
    });
    return { lines: read.map(room => room.line), pieces: read.map(room => room.pieces) };
  } catch {
    throw new UserFacingError('No se pudo leer el diseño de todas las estancias en la cenital aceptada. Se ha detenido la vista antes de generar una imagen.');
  }
}

function validPieces(value: unknown): SectionPiece[] | null {
  if (!Array.isArray(value)) return null;
  const pieces = value.filter((piece): piece is SectionPiece => typeof piece === 'object' && piece !== null
    && ['bed', 'sofa'].includes((piece as SectionPiece).kind) && FACINGS.includes((piece as SectionPiece).facing));
  return pieces.length === value.length ? pieces : null;
}
