import { z } from 'zod';
import type { EditorDocument } from './schema';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { surfaceMaterial } from './surface-materials';
import { parseEditorDocument } from './validation';

export const ROOF_KIND_LABELS = { flat: 'Plana', mono: 'Una agua', gable: 'Dos aguas', hip: 'Cuatro aguas' } as const;
export const exteriorRoofSchema = z.object({
  kind: z.enum(['flat', 'mono', 'gable', 'hip']),
  /** Sin campo en documentos anteriores: conservar sus huecos hasta una elección manual. */
  voidCover: z.enum(['solid', 'open', 'glass']).optional(),
  roomIds: z.array(z.string().max(4000).refine(id => {
    try { const ids = JSON.parse(id.slice(5)); return id.startsWith('room:') && Array.isArray(ids) && ids.length >= 3 && ids.every(v => typeof v === 'string' && v.length > 0); }
    catch { return false; }
  }, 'Estancia de tejado inválida')).min(1).max(100).refine(ids => new Set(ids).size === ids.length, 'Estancia de tejado duplicada'),
  pitchDeg: z.number().finite().min(0).max(60),
  orientationDeg: z.number().finite().min(0).max(360),
  eavesMm: z.number().finite().min(0).max(1000),
  thicknessMm: z.number().finite().min(80).max(500),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  materialId: z.string().refine(id => Boolean(surfaceMaterial(id)), 'Material de tejado desconocido').optional(),
}).strict().refine(roof => roof.kind === 'flat' || roof.pitchDeg >= 2, 'El tejado inclinado necesita al menos 2° de pendiente');
export type ExteriorRoof = z.infer<typeof exteriorRoofSchema>;

export function setExteriorRoof(input: EditorDocument, patch: Partial<ExteriorRoof> | null): EditorDocument {
  const doc = structuredClone(input);
  if (patch === null) delete doc.exteriorRoof;
  else {
    const defaults: ExteriorRoof = { kind: 'flat', roomIds: eligibleCeilingRooms(doc).map(room => room.id),
      pitchDeg: 25, orientationDeg: 0, eavesMm: 250, thicknessMm: 160, color: '#57534e' };
    const next: ExteriorRoof = { ...defaults, ...doc.exteriorRoof, ...patch };
    next.voidCover = patch.voidCover ?? doc.exteriorRoof?.voidCover ?? (doc.exteriorRoof ? 'open' : 'solid');
    if (patch.materialId === undefined && Object.hasOwn(patch, 'materialId')) delete next.materialId;
    doc.exteriorRoof = exteriorRoofSchema.parse(next);
  }
  doc.revision++;
  return parseEditorDocument(doc);
}
