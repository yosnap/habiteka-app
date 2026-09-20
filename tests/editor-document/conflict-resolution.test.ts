import { expect, it, vi } from 'vitest';
import { EditorSaveQueue, hasPendingRemoteChanges, type SaveTransport } from '@/canvas/editor-v2/save-queue';
import { draftKey, type DraftStorage, type EditorDraft } from '@/canvas/editor-v2/draft-storage';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

function setup() {
  const scope = { userId: 'u', organizationId: 'o', projectId: 'p', zoneId: null };
  const local = { ...emptyEditorDocument(), labels: [{ id: 'a', text: 'local', x: 0, y: 0 }] };
  const server = { ...emptyEditorDocument(), revision: 196 };
  const drafts = new Map<string, EditorDraft>();
  const storage: DraftStorage = { read: async (s) => drafts.get(draftKey(s)) ?? null,
    remove: async (s) => { drafts.delete(draftKey(s)); },
    write: vi.fn(async (d) => { drafts.set(d.key, structuredClone(d)); }) };
  const transport: SaveTransport = { reauthorize: vi.fn(async () => true),
    save: vi.fn(async ({ document, expectedRevision }) => ({ status: 'saved' as const,
      document: { ...document, revision: expectedRevision + 1 } })) };
  const recovered = { key: draftKey(scope), userId: 'u', scope, document: local,
    sequence: 1, remoteSequence: 0, baseRevision: 0, updatedAt: Date.now() };
  const queue = new EditorSaveQueue(storage, scope, server, transport, recovered);
  return { queue, drafts, storage, transport, local, server };
}

it('carga servidor sin escribir remotamente y respalda la edición local', async () => {
  const { queue, server, drafts, transport, local } = setup();
  expect(await queue.resolveConflict('server', async () => server)).toEqual(server);
  expect(transport.save).not.toHaveBeenCalled();
  expect(hasPendingRemoteChanges(queue.getSnapshot())).toBe(false);
  expect([...drafts.values()].find(d => d.scope.branchId?.startsWith('backup-'))?.document).toEqual(local);
});
it('conserva local mediante CAS sobre la revisión confirmada', async () => {
  const { queue, server, transport } = setup();
  const result = await queue.resolveConflict('local', async () => server);
  expect(result.revision).toBe(197);
  expect(result.labels[0]?.text).toBe('local');
  expect(transport.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 196 }));
  expect(hasPendingRemoteChanges(queue.getSnapshot())).toBe(false);
});
it('exige reconfirmar si cambió la revisión desde que se mostró el aviso', async () => {
  const { queue, server, transport, local } = setup();
  await expect(queue.resolveConflict('local', async () => ({ ...server, revision: 197 }))).rejects.toThrow('volvió a cambiar');
  expect(queue.getDocument()).toEqual(local);
  expect(transport.save).not.toHaveBeenCalled();
  expect(queue.getSnapshot().conflict?.revision).toBe(197);
});
it('no sustituye nada si falla la copia de seguridad', async () => {
  const { queue, server, storage, local, transport } = setup();
  vi.mocked(storage.write).mockRejectedValueOnce(new Error('disco lleno'));
  await expect(queue.resolveConflict('server', async () => server)).rejects.toThrow();
  expect(queue.getDocument()).toEqual(local);
  expect(queue.getSnapshot().conflict?.revision).toBe(196);
  expect(transport.save).not.toHaveBeenCalled();
});
it('mantiene conflicto si hay otra escritura durante el CAS', async () => {
  const { queue, server, transport } = setup();
  vi.mocked(transport.save).mockResolvedValueOnce({ status: 'conflict', document: { ...server, revision: 197 } });
  await expect(queue.resolveConflict('local', async () => server)).rejects.toThrow('volvió a guardar');
  expect(queue.getSnapshot().conflict?.revision).toBe(197);
  expect(queue.getDocument().labels[0]?.text).toBe('local');
});
it('no anuncia sincronizado ante fallo de red', async () => {
  const { queue, server, transport } = setup();
  vi.mocked(transport.save).mockRejectedValueOnce(new Error('offline'));
  await queue.resolveConflict('local', async () => server);
  expect(hasPendingRemoteChanges(queue.getSnapshot())).toBe(true);
  expect(queue.getSnapshot().error).toBeTruthy();
});
