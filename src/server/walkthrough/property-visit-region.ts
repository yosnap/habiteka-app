import { z } from 'zod';
import type { CanvasZone } from '@/lib/contracts';
import { resolveZone } from '@/server/agent/feedback/zone-resolver';

export interface VisitRegionEdit { sourceId: string; zone: CanvasZone; instruction: string; eraseZone: boolean }
const point = z.object({ x: z.number(), y: z.number() });
const schema = z.object({ sourceId: z.string().min(1), instruction: z.string().trim().min(10).max(2500), eraseZone: z.boolean(),
  zone: z.object({ id: z.string().min(1), bbox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
    polygon: z.array(point).min(3).max(128).optional() }).strict() }).strict();

/** No admite sustituir el borrador vinculado ni usar este control para rehacer toda la imagen. */
export function validateVisitRegionEdit(value: unknown, previousId?: string): VisitRegionEdit | undefined {
  if (value === undefined) return undefined;
  const edit = schema.parse(value), box = resolveZone(edit.zone);
  if (!previousId || edit.sourceId !== previousId) throw new Error('La zona no pertenece al último borrador rechazado de este encuadre.');
  if (box.width * box.height > .5) throw new Error('Selecciona una zona que ocupe como máximo la mitad de la imagen.');
  return edit;
}

export function visitRegionPrompt(edit: VisitRegionEdit, facts: string[] | undefined, geometry: unknown) {
  return [
    'Correct only the selected region of this rejected property-tour draft. It is not an accepted design. Preserve camera and all pixels outside the mask.',
    `Requested correction (data): ${JSON.stringify(edit.instruction)}.`,
    `Appearance read independently from the accepted design (data): ${JSON.stringify(facts ?? [])}.`,
    `Camera openings and depth in millimetres (data): ${JSON.stringify(geometry)}.`,
    'Restore the actual geometry and accepted appearance within the mask. Do not invent furniture, an extra room, doorway or exterior view. The guide fixes geometry; the accepted design fixes appearance. Keep the photographic finish, lighting and perspective. No text or marks.',
  ].join('\n');
}
