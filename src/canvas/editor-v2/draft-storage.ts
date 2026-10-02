import { draftKey, parseEditorDraft, type DraftScope, type EditorDraft } from './draft-contract';
export { draftKey, type DraftScope, type EditorDraft } from './draft-contract';
export interface DraftStorage {
  read(scope: DraftScope): Promise<EditorDraft | null>;
  write(draft: EditorDraft): Promise<void>;
  remove(scope: DraftScope): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Almacenamiento local no disponible')); return; }
    const request = indexedDB.open('habiteka-editor-drafts', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('drafts')) {
        const store = request.result.createObjectStore('drafts', { keyPath: 'key' });
        store.createIndex('userId', 'userId');
      }
      if (!request.result.objectStoreNames.contains('access')) request.result.createObjectStore('access', { keyPath: 'userId' });
    };
    let blocked = false;
    request.onsuccess = () => {
      if (blocked) request.result.close(); else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Cierra otras pestañas para actualizar el almacenamiento'));
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void, tx: IDBTransaction) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['drafts', 'access'], mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('No se pudo guardar el borrador')); };
    try { action(tx.objectStore('drafts'), (value) => { result = value; }, tx); }
    catch (error) { tx.abort(); db.close(); reject(error); }
  });
}

/** El ACK se resuelve en oncomplete de la transacción, no en éxito de put. */
export const indexedDbDraftStorage: DraftStorage = {
  read: (scope) => transaction('readonly', (store, done) => {
    const request = store.get(draftKey(scope));
    request.onsuccess = () => {
      const draft = request.result as EditorDraft | undefined;
      if (!draft) { done(null); return; }
      try { done(parseEditorDraft(draft, scope)); }
      catch { request.transaction!.abort(); }
    };
  }),
  write: (draft) => {
    const validated = parseEditorDraft(draft);
    return transaction('readwrite', (store, done, tx) => {
      const access = tx.objectStore('access').get(validated.userId);
      access.onsuccess = () => {
        if (!access.result || access.result.blocked || access.result.epoch !== validated.scope.accessEpoch) {
          tx.abort(); return;
        }
        store.put(validated); done(undefined);
      };
    });
  },
  remove: (scope) => transaction('readwrite', (store, done) => { store.delete(draftKey(scope)); done(undefined); }),
};

export async function clearUserDrafts(userId: string): Promise<void> {
  return transaction('readwrite', (store, done, tx) => {
    const accessStore = tx.objectStore('access'), access = accessStore.get(userId);
    access.onsuccess = () => accessStore.put({ userId, epoch: (access.result?.epoch ?? 0) + 1, blocked: true });
    const request = store.index('userId').openCursor(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { cursor.delete(); cursor.continue(); } else done(undefined);
    };
  });
}

/** Solo una comprobación de sesión servidor vigente puede reabrir el diario tras un logout. */
export async function openAuthorizedDrafts(userId: string, reauthorize: () => Promise<boolean>): Promise<number> {
  const before = await transaction<number>('readonly', (_store, done, tx) => {
    const request = tx.objectStore('access').get(userId);
    request.onsuccess = () => done(request.result?.epoch ?? 0);
  });
  if (!await reauthorize()) throw new Error('Sesión de editor no válida');
  return transaction('readwrite', (_store, done, tx) => {
    const store = tx.objectStore('access'), request = store.get(userId);
    request.onsuccess = () => {
      const epoch = request.result?.epoch ?? 0;
      if (epoch !== before) { tx.abort(); return; }
      store.put({ userId, epoch, blocked: false }); done(epoch);
    };
  });
}

export async function hasPendingUserDrafts(userId: string): Promise<boolean> {
  return transaction('readonly', (store, done) => {
    const request = store.index('userId').openCursor(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { done(false); return; }
      try {
        const draft = parseEditorDraft(cursor.value);
        if (draft.inFlight || draft.sequence > (draft.remoteSequence ?? 0)) { done(true); return; }
      } catch { done(true); return; }
      cursor.continue();
    };
  });
}

/** Enumera solo el ámbito autorizado. Las ramas de otras pestañas nunca se sobrescriben. */
export async function listScopeDrafts(scope: DraftScope): Promise<{ drafts: EditorDraft[]; invalid: number; invalidKeys: string[] }> {
  return transaction('readonly', (store, done) => {
    const result = { drafts: [] as EditorDraft[], invalid: 0, invalidKeys: [] as string[] };
    const request = store.index('userId').openCursor(IDBKeyRange.only(scope.userId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { done(result); return; }
      const raw = cursor.value as EditorDraft;
      if (raw.scope?.organizationId === scope.organizationId && raw.scope?.projectId === scope.projectId &&
        raw.scope?.zoneId === scope.zoneId) {
        try { result.drafts.push(parseEditorDraft(raw)); }
        catch { result.invalid += 1; result.invalidKeys.push(String(cursor.key)); }
      }
      cursor.continue();
    };
  });
}
