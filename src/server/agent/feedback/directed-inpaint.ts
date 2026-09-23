/**
 * Edición dirigida de un render: regenera SOLO la zona indicada mediante el
 * inpainting del adaptador de imagen (F3, vía interfaz). El prompt incorpora la
 * instrucción del usuario acotada a la zona, y se delega en la primitiva
 * `inpaint` sin reimplementarla ni tocar el subárbol de F3.
 */
import type { ImageAdapter, ImageResult, CanvasZone, InpaintRequest } from '@/lib/contracts';

export interface DirectedInpaintInput {
  baseImage: InpaintRequest['baseImage'];
  zone: CanvasZone;
  instruction: string;
}

/** Compone el prompt dirigido y ejecuta el inpaint de la zona. */
export function directedInpaint(
  image: ImageAdapter,
  input: DirectedInpaintInput,
): Promise<ImageResult> {
  const prompt = buildDirectedPrompt(input.instruction, coversWholeImage(input.zone));
  return image.inpaint({
    baseImage: input.baseImage,
    zone: input.zone,
    prompt,
  });
}

/** Zona que abarca toda la imagen: el cambio pedido es global, no de una región. */
function coversWholeImage(zone: CanvasZone): boolean {
  const b = zone.bbox;
  return !!b && b.x <= 0 && b.y <= 0 && b.width >= 1 && b.height >= 1;
}

// El prompt acota el cambio a la zona para reducir el "sangrado" fuera de ella.
function buildDirectedPrompt(instruction: string, wholeImage: boolean): string {
  if (wholeImage) {
    return (
      `Edita esta imagen según esta indicación: ${instruction}. ` +
      'Conserva el mismo espacio, encuadre, perspectiva, arquitectura e iluminación; ' +
      'cambia solo lo que pide la indicación, sin añadir texto ni marcas.'
    );
  }
  return (
    `Modifica únicamente la región enmascarada según esta indicación: ${instruction}. ` +
    'Mantén el resto de la imagen sin cambios, conservando estilo, iluminación y perspectiva.'
  );
}
