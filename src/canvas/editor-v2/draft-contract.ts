import type { EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';

export interface DraftScope {
  userId: string; organizationId: string; projectId: string; zoneId: string | null; branchId?: string; accessEpoch?: number;
}
export interface EditorDraft {
  key: string; userId: string; scope: DraftScope; document: EditorDocument;
  sequence: number; baseRevision: number; updatedAt: number; remoteSequence?: number;
  inFlight?: { requestKey: string; document: EditorDocument; expectedRevision: number; sequence: number };
}
export const draftKey = (scope: DraftScope) => JSON.stringify([
  scope.userId, scope.organizationId, scope.projectId, scope.zoneId, ...(scope.branchId ? [scope.branchId] : []),
]);
function integer(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Contador de borrador inválido');
}
function identifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) throw new Error('Ámbito de borrador inválido');
}
/** El diario es entrada no fiable: validar también petición pendiente y ACK, sin borrarlo al fallar. */
export function parseEditorDraft(value: unknown, expectedScope?: DraftScope): EditorDraft {
  if (!value || typeof value !== 'object') throw new Error('Borrador inválido');
  const raw = value as EditorDraft, scope = raw.scope;
  if (!scope || typeof scope !== 'object') throw new Error('Ámbito de borrador inválido');
  [scope.userId, scope.organizationId, scope.projectId].forEach(identifier);
  if (scope.zoneId !== null) identifier(scope.zoneId);
  if (scope.branchId !== undefined) identifier(scope.branchId);
  if (scope.accessEpoch !== undefined) integer(scope.accessEpoch);
  if (raw.key !== draftKey(scope) || raw.userId !== scope.userId ||
    (expectedScope && raw.key !== draftKey(expectedScope)) ||
    (expectedScope?.accessEpoch !== undefined && scope.accessEpoch !== expectedScope.accessEpoch)) throw new Error('Borrador de otro ámbito');
  integer(raw.sequence); integer(raw.baseRevision); integer(raw.updatedAt);
  integer(raw.remoteSequence ?? 0);
  if ((raw.remoteSequence ?? 0) > raw.sequence) throw new Error('ACK remoto inválido');
  const document = parseEditorDocument(raw.document);
  const inFlight = raw.inFlight;
  if (inFlight) {
    identifier(inFlight.requestKey);
    integer(inFlight.sequence); integer(inFlight.expectedRevision);
    if (inFlight.sequence > raw.sequence || inFlight.sequence <= (raw.remoteSequence ?? 0) ||
      inFlight.expectedRevision !== raw.baseRevision) throw new Error('Petición pendiente incoherente');
    const pending = parseEditorDocument(inFlight.document);
    if (pending.revision !== inFlight.expectedRevision) throw new Error('Revisión pendiente incoherente');
  }
  return structuredClone({ ...raw, document });
}
