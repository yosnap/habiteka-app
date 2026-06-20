/**
 * Edición dirigida de un render: regenera SOLO la zona indicada mediante el
 * inpainting del adaptador de imagen (F3, vía interfaz). El prompt incorpora la
 * instrucción del usuario acotada a la zona, y se delega en la primitiva
 * `inpaint` sin reimplementarla ni tocar el subárbol de F3.
 */
import type { ImageAdapter, ImageResult, CanvasZone } from '@/lib/contracts';

export interface DirectedInpaintInput {
  baseAssetUrl: string;
  zone: CanvasZone;
  instruction: string;
}

/** Compone el prompt dirigido y ejecuta el inpaint de la zona. */
export function directedInpaint(
  image: ImageAdapter,
  input: DirectedInpaintInput,
): Promise<ImageResult> {
  const prompt = buildDirectedPrompt(input.instruction);
  return image.inpaint({
    baseImage: { url: input.baseAssetUrl },
    zone: input.zone,
    prompt,
  });
}

// El prompt acota el cambio a la zona para reducir el "sangrado" fuera de ella.
function buildDirectedPrompt(instruction: string): string {
  return (
    `Modifica únicamente la región enmascarada según esta indicación: ${instruction}. ` +
    'Mantén el resto de la imagen sin cambios, conservando estilo, iluminación y perspectiva.'
  );
}
