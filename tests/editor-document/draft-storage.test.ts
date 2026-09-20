import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { draftKey, type EditorDraft } from '@/canvas/editor-v2/draft-contract';
import { clearUserDrafts, hasPendingUserDrafts, indexedDbDraftStorage as storage,
  listScopeDrafts, openAuthorizedDrafts } from '@/canvas/editor-v2/draft-storage';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange); });
afterEach(() => vi.unstubAllGlobals());
async function draft(userId = 'user', branchId = 'tab-a'): Promise<EditorDraft> {
  const accessEpoch = await openAuthorizedDrafts(userId, async () => true);
  const scope = { userId, organizationId: 'org', projectId: 'project', zoneId: null, branchId, accessEpoch };
  return { key: draftKey(scope), userId, scope, document: emptyEditorDocument(),
    sequence: 1, remoteSequence: 0, baseRevision: 0, updatedAt: 1 };
}
describe('IndexedDB transaccional del editor', () => {
  it('persiste y recupera exactamente dos ramas sin pisarlas', async () => {
    const a = await draft(), b = await draft('user', 'tab-b');
    b.document.labels.push({ id: 'label', text: 'Otro borrador', x: 10, y: 20 });
    await Promise.all([storage.write(a), storage.write(b)]);
    expect(await storage.read(a.scope)).toEqual(a);
    expect(await storage.read(b.scope)).toEqual(b);
    expect((await listScopeDrafts(a.scope)).drafts).toHaveLength(2);
    expect(await hasPendingUserDrafts('user')).toBe(true);
  });
  it('limpia solo la cuenta indicada y revoca escrituras tardías incluso después de volver a entrar', async () => {
    const a = await draft(), other = await draft('other');
    await storage.write(a); await storage.write(other);
    await clearUserDrafts('user');
    expect(await storage.read(a.scope)).toBeNull();
    expect(await storage.read(other.scope)).toEqual(other);
    await expect(storage.write(a)).rejects.toThrow();
    const reopened = await draft();
    expect(reopened.scope.accessEpoch).toBe(1);
    await expect(storage.write(a)).rejects.toThrow();
    await storage.write(reopened);
    expect(await storage.read(reopened.scope)).toEqual(reopened);
  });
  it('un logout ocurrido durante la comprobación de acceso impide reabrir el diario', async () => {
    await draft();
    let release!: (valid: boolean) => void;
    const check = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve; }));
    const open = openAuthorizedDrafts('user', check);
    await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());
    await clearUserDrafts('user');
    const rejected = expect(open).rejects.toThrow();
    release(true); await rejected;
  });
  it('rechaza acceso sin sesión y consulta de otra cuenta no muestra borradores', async () => {
    const a = await draft(); await storage.write(a);
    await expect(openAuthorizedDrafts('other', async () => false)).rejects.toThrow('Sesión');
    expect((await listScopeDrafts({ ...a.scope, userId: 'other' })).drafts).toEqual([]);
  });
  it('rechaza contadores y payloads corruptos antes de iniciar escritura', async () => {
    const a = await draft();
    expect(() => storage.write({ ...a, sequence: NaN })).toThrow();
    expect(await storage.read(a.scope)).toBeNull();
  });
});
