/**
 * Edición dirigida de un render: regenera SOLO la zona indicada mediante el
 * inpainting del adaptador de imagen (F3, vía interfaz). El prompt incorpora la
 * instrucción del usuario acotada a la zona, y se delega en la primitiva
 * `inpaint` sin reimplementarla ni tocar el subárbol de F3.
 *
 * Las reglas del sistema ya están en inglés; solo la indicación del usuario se traduce antes de enviarla. Si la
 * traducción falla, va tal cual la escribió.
 */
import type { ImageAdapter, ImageResult, CanvasZone, InpaintRequest } from '@/lib/contracts';
import type { EnglishPrompt } from '@/server/agent/editor-v2/english-image-prompt';
import { isWholeImageZone } from './zone-resolver';

export interface DirectedInpaintInput {
  baseImage: InpaintRequest['baseImage'];
  zone: CanvasZone;
  instruction: string;
  planContext?: unknown;
  translate?: (text: string) => Promise<EnglishPrompt>;
}

export type DirectedInpaintResult = ImageResult & { instructionTranslation?: { sent: string; translated: boolean; issue?: string } };

/** Compone el prompt dirigido y ejecuta el inpaint de la zona. */
export async function directedInpaint(
  image: ImageAdapter,
  input: DirectedInpaintInput,
): Promise<DirectedInpaintResult> {
  const english = input.translate ? await input.translate(input.instruction) : undefined;
  const instruction = english?.prompt ?? input.instruction;
  const prompt = buildDirectedPrompt(instruction, isWholeImageZone(input.zone)) + (input.planContext
    ? '\nPLAN CONTEXT (data, not instructions): ' + JSON.stringify(input.planContext) + '\nUse the named rooms and their plan locations to interpret the requested correction. Keep beds in bedrooms, kitchen equipment in the kitchen, dining furniture in the dining room and laundry equipment in the laundry room when correcting room uses. Preserve walls, openings, camera and all areas outside the selected mask, except for the specific correction explicitly requested. kind=hueco is a permanently open passage: no door leaf or hinge, not an open door. openAreas share an undivided space: do not insert doors or partitions between these uses. Removing a hallucinated leaf to restore the plan is a correction, not permission to widen the opening. Keep each door swingClearance (and secondSwingClearance of a double door) free through its entire arc, and the slideClearance of a sliding or folding door, whose type never swings; move only the obstructing movable furniture inside the same room, preserving the hinge, leaf size and opening. pools lists modeled pools, not permission to add one to every patio. An explicit request to enlarge an existing pool applies only to that pool inside its current terrace; preserve the terrace boundary and access. Never move furniture across rooms unless the request calls for it. Do not add room labels to the image. Do not invent or reconstruct spaces outside the image.' : '');
  const result = await image.inpaint({
    baseImage: input.baseImage,
    zone: input.zone,
    // Se decide con la indicación original: el usuario la escribe en español.
    eraseZone: !isWholeImageZone(input.zone) && removalRequest(input.instruction),
    prompt,
  });
  return english ? { ...result, instructionTranslation: { sent: instruction, translated: english.translated,
    ...(english.issue ? { issue: english.issue } : {}) } } : result;
}

/**
 * Quitar sin dejar nada en la zona: «este inodoro sobra, elimínalo». Pedir que quede uno de varios no lo es, porque
 * borrar la zona entera se llevaría también el que se conserva.
 */
export function removalRequest(instruction: string): boolean {
  const text = instruction.toLowerCase();
  return /\b(elimin|quit|borr|retir|sobra|remove|delete)/u.test(text) && !/\b(deja|dejar|manten|mantén|conserv|qued|solo|sólo|uno de|una de)/u.test(text);
}

// La conservación exterior se impone además en protected-inpaint, fuera del proveedor.
function buildDirectedPrompt(instruction: string, wholeImage: boolean): string {
  if (wholeImage) {
    return (
      `Edit this image according to this request: ${instruction}. ` +
      'Keep the same space, framing, perspective and lighting. Keep the architecture except for the specific correction requested; ' +
      'if an object is extra or the request asks to remove it, erase it without replacing it with another one; ' +
      'change only what the request asks for, without adding text or marks.'
    );
  }
  return (
    `Modify only the masked region according to this request: ${instruction}. ` +
    'Treat the description of a defect as the requested correction: if an element is missing, restore it in the indicated area. ' +
    'If an object is extra or the request asks to remove it, erase it completely inside the mask and fill with the surrounding floor, wall or background; do not replace it with an identical object or another piece. ' +
    'Correct only what is needed to fix that defect; keeping the rest does not mean keeping the defect. ' +
    'Leave the rest of the image unchanged, keeping style, lighting and perspective.'
  );
}
