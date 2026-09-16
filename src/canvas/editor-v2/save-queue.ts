import type { EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { draftKey, type DraftScope, type DraftStorage, type EditorDraft } from './draft-storage';
import { parseEditorDraft } from './draft-contract';

export interface SaveTransport {
  reauthorize(): Promise<boolean>;
  save(input: { document: EditorDocument; expectedRevision: number; requestKey: string }):
    Promise<{ status: 'saved' | 'conflict'; document: EditorDocument }>;
}
export interface SaveQueueState {
  closed: boolean;
  sequence: number;
  localSequence: number;
  remoteSequence: number;
  saving: boolean;
  error: string | null;
  conflict: EditorDocument | null;
}

/** Un cambio sólo está realmente guardado cuando el servidor confirma su secuencia. */
export function hasPendingRemoteChanges(state: SaveQueueState) {
  return state.sequence > state.remoteSequence;
}

/** Serializa el diario local y distingue su ACK del ACK remoto. No modifica la historia del editor. */
export class EditorSaveQueue {
  private draft: EditorDraft;
  private writes: Promise<void> = Promise.resolve();
  private draining: Promise<void> | null = null;
  private online = true;
  private stopped = false;
  private resolving = false;
  private listeners = new Set<() => void>();
  private state: SaveQueueState;

  constructor(private storage: DraftStorage, scope: DraftScope, initial: EditorDocument,
    private transport: SaveTransport, recovered?: EditorDraft) {
    this.draft = recovered ? parseEditorDraft(recovered, scope) : {
      key: draftKey(scope), userId: scope.userId, scope, document: parseEditorDocument(initial),
      baseRevision: initial.revision, sequence: 0, remoteSequence: 0, updatedAt: Date.now(),
    };
    if (!this.draft.inFlight && this.draft.sequence === (this.draft.remoteSequence ?? 0)) {
      this.draft.document = parseEditorDocument(initial);
      this.draft.baseRevision = initial.revision;
    }
    this.state = { closed: false, sequence: this.draft.sequence, localSequence: recovered?.sequence ?? 0,
      remoteSequence: this.draft.remoteSequence ?? 0, saving: false, error: null, conflict: null };
    // A lost response is retried with its durable key before deciding whether the head conflicts.
    if (recovered && !recovered.inFlight && recovered.baseRevision !== initial.revision &&
      recovered.sequence > (recovered.remoteSequence ?? 0)) this.state.conflict = parseEditorDocument(initial);
  }
  getSnapshot = () => this.state;
  getDocument = () => structuredClone(this.draft.document);
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SaveQueueState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setOnline(online: boolean) { this.online = online; }
  /** Esperar antes de limpiar IDB al salir de la cuenta: ningún ACK tardío recreará el diario. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.publish({ closed: true, error: 'Sesión de edición cerrada. Vuelve a entrar para continuar.' });
    await this.writes.catch(() => {});
  }

  async capture(document: EditorDocument): Promise<void> {
    if (this.stopped) throw new Error('Sesión de edición cerrada');
    if (this.resolving) throw new Error('Espera a que termine la resolución del conflicto.');
    this.draft.document = parseEditorDocument(document);
    this.draft.sequence += 1;
    this.draft.updatedAt = Date.now();
    this.publish({ sequence: this.draft.sequence });
    await this.persist();
  }

  /** Elección explícita, con copia local durable y CAS: nunca fuerza una revisión ajena. */
  async resolveConflict(choice: 'local' | 'server', loadLatest: () => Promise<EditorDocument>): Promise<EditorDocument> {
    if (this.stopped || this.resolving || !this.state.conflict) throw new Error('No hay un conflicto disponible para resolver.');
    this.resolving = true;
    try {
      await this.draining;
      await this.writes.catch(() => {});
      if (!await this.transport.reauthorize() || this.stopped) throw new Error('La sesión no permite resolver el conflicto.');
      const latest = parseEditorDocument(await loadLatest());
      if (this.stopped) throw new Error('La sesión se cerró durante la resolución.');
      if (latest.revision !== this.state.conflict!.revision) {
        this.publish({ conflict: latest });
        throw new Error('La versión guardada volvió a cambiar. Revisa la nueva revisión y elige de nuevo.');
      }
      const previous = structuredClone(this.draft);
      const backupScope = { ...previous.scope, branchId: `backup-${crypto.randomUUID()}` };
      // Copia archivada, no pendiente de sincronizar ni recuperada automáticamente.
      this.writes = this.writes.catch(() => {}).then(() => this.stopped ? undefined : this.storage.write({
        ...previous, scope: backupScope, key: draftKey(backupScope),
        sequence: 0, remoteSequence: 0, inFlight: undefined, updatedAt: Date.now() }));
      await this.writes;
      if (this.stopped) throw new Error('La sesión se cerró durante la resolución.');
      const sequence = previous.sequence + 1;
      this.draft = { ...previous, document: choice === 'server' ? latest : { ...previous.document, revision: latest.revision },
        baseRevision: latest.revision, inFlight: undefined, sequence,
        remoteSequence: choice === 'server' ? sequence : previous.remoteSequence, updatedAt: Date.now() };
      try { await this.persist(); }
      catch (error) { this.draft = previous; throw error; }
      if (this.stopped) throw new Error('La sesión se cerró durante la resolución.');
      this.publish({ conflict: null, error: null, sequence, remoteSequence: this.draft.remoteSequence ?? 0 });
      if (choice === 'local') await this.flush();
      if (this.state.conflict) throw new Error('Otra pestaña volvió a guardar. Tu edición sigue conservada; revisa el conflicto nuevo.');
      return { ...this.getDocument(), revision: this.draft.baseRevision };
    } finally { this.resolving = false; }
  }

  private persist(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    const snapshot = structuredClone(this.draft);
    const write = this.writes.catch(() => {}).then(() => this.stopped ? undefined : this.storage.write(snapshot));
    this.writes = write;
    return write.then(() => {
      if (this.stopped) return;
      this.publish({ localSequence: Math.max(this.state.localSequence, snapshot.sequence), error: null });
    }, () => {
      if (this.stopped) return;
      this.publish({ error: 'No se pudo guardar en este dispositivo. Mantén esta pestaña abierta.' });
      throw new Error('Borrador local no confirmado');
    });
  }

  /** Reintentar conserva el requestKey: una respuesta perdida nunca crea otra revisión. */
  flush(): Promise<void> {
    if (this.draining) return this.draining;
    const operation = this.drain();
    this.draining = operation.finally(() => { this.draining = null; this.publish({ saving: false }); });
    return this.draining;
  }
  private async drain(): Promise<void> {
    if (this.stopped || !this.online || this.state.conflict) return;
    this.publish({ saving: true, error: null });
    try {
      if (!await this.transport.reauthorize()) {
        this.publish({ error: 'Inicia sesión de nuevo para sincronizar. Tu borrador permanece local.' });
        return;
      }
      while (!this.stopped && this.online && !this.state.conflict &&
        (this.draft.inFlight || this.draft.sequence > (this.draft.remoteSequence ?? 0))) {
        if (!this.draft.inFlight) {
          this.draft.inFlight = {
            requestKey: crypto.randomUUID(), sequence: this.draft.sequence,
            expectedRevision: this.draft.baseRevision,
            document: { ...structuredClone(this.draft.document), revision: this.draft.baseRevision },
          };
        }
        // Persistir clave + snapshot ANTES del envío permite recuperar una caída o timeout.
        await this.persist();
        if (this.stopped || !this.online) return;
        const request = structuredClone(this.draft.inFlight);
        const result = await this.transport.save(request);
        if (this.stopped) return;
        const document = parseEditorDocument(result.document);
        if (result.status === 'conflict') {
          this.publish({ conflict: document, error: 'Hay otra revisión en el servidor. Tu borrador no se ha sobrescrito.' });
          return;
        }
        if (document.revision !== request.expectedRevision + 1) throw new Error('ACK remoto inválido');
        this.draft.baseRevision = document.revision;
        this.draft.remoteSequence = request.sequence;
        this.draft.inFlight = undefined;
        this.publish({ remoteSequence: request.sequence });
        await this.persist();
      }
    } catch {
      if (!this.state.error) this.publish({ error: 'Sincronización pendiente. Puedes reintentar sin duplicar el guardado.' });
    }
  }
}
