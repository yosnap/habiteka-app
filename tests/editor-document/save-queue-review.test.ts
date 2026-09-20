import { describe, expect, it, vi } from 'vitest';
import { EditorSaveQueue, type SaveTransport } from '@/canvas/editor-v2/save-queue';
import { draftKey, type DraftStorage, type EditorDraft } from '@/canvas/editor-v2/draft-storage';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

const scope = { userId: 'user', organizationId: 'org', projectId: 'project', zoneId: null };
const storage: DraftStorage = { read: async () => null, write: async () => {}, remove: async () => {} };
const transport: SaveTransport = { reauthorize: async () => true,
  save: vi.fn(async ({ document, expectedRevision }) => ({ status: 'saved' as const,
    document: { ...document, revision: expectedRevision + 1 } })) };
function draft(): EditorDraft {
  return { key: draftKey(scope), userId: scope.userId, scope, document: emptyEditorDocument(),
    sequence: 1, remoteSequence: 0, baseRevision: 0, updatedAt: 1 };
}

describe('revisión de recuperación del diario', () => {
  it.each([NaN, -1, 0.5])('rechaza secuencia local corrupta %s', (sequence) => {
    expect(() => new EditorSaveQueue(storage, scope, emptyEditorDocument(), transport,
      { ...draft(), sequence })).toThrow();
  });

  it('rechaza ACK remoto por delante de los gestos locales', () => {
    expect(() => new EditorSaveQueue(storage, scope, emptyEditorDocument(), transport,
      { ...draft(), remoteSequence: 2 })).toThrow();
  });

  it('valida también el documento de la petición pendiente recuperada', () => {
    const corrupted = draft();
    corrupted.inFlight = { requestKey: 'retry', sequence: 1, expectedRevision: 0,
      document: { ...emptyEditorDocument(), schemaVersion: 99 } as unknown as EditorDraft['document'] };
    expect(() => new EditorSaveQueue(storage, scope, emptyEditorDocument(), transport, corrupted)).toThrow();
  });
});
