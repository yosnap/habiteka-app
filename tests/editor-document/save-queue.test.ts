import { describe, expect, it, vi } from 'vitest';
import { EditorSaveQueue, type SaveTransport } from '@/canvas/editor-v2/save-queue';
import type { DraftStorage, EditorDraft } from '@/canvas/editor-v2/draft-storage';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

const scope = { userId: 'u', organizationId: 'o', projectId: 'p', zoneId: null };
function setup() {
  let stored: EditorDraft | null = null;
  const storage: DraftStorage = { read: async () => stored, remove: async () => { stored = null; },
    write: vi.fn(async (value) => { stored = structuredClone(value); }) };
  const transport: SaveTransport = { reauthorize: vi.fn(async () => true),
    save: vi.fn<SaveTransport['save']>(async ({ document, expectedRevision }) => ({ status: 'saved',
      document: { ...document, revision: expectedRevision + 1 } })) };
  const queue = new EditorSaveQueue(storage, scope, emptyEditorDocument(), transport);
  return { queue, storage, transport, stored: () => stored };
}
function edited(text: string) {
  return { ...emptyEditorDocument(), labels: [{ id: 'label', text, x: 100, y: 100 }] };
}
describe('durable save queue', () => {
  it('no confirma una escritura omitida al cerrar inmediatamente la sesión', async () => {
    const { queue, storage } = setup();
    const capture = queue.capture(edited('A'));
    await queue.stop();
    await capture;
    expect(storage.write).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({ closed: true, localSequence: 0 });
    expect(queue.getSnapshot().error).toContain('cerrada');
  });
  it('no confunde ACK local con servidor y no envía estando offline', async () => {
    const { queue, transport, stored } = setup();
    queue.setOnline(false);
    await queue.capture(edited('A'));
    await queue.flush();
    expect(queue.getSnapshot()).toMatchObject({ sequence: 1, localSequence: 1, remoteSequence: 0 });
    expect(stored()?.document.labels[0]?.text).toBe('A');
    expect(transport.save).not.toHaveBeenCalled();
  });
  it('no confirma durabilidad antes de finalizar la escritura', async () => {
    const { queue, storage } = setup();
    let release!: () => void;
    vi.mocked(storage.write).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const capture = queue.capture(edited('A'));
    await Promise.resolve(); await Promise.resolve();
    expect(queue.getSnapshot().localSequence).toBe(0);
    release(); await capture;
    expect(queue.getSnapshot().localSequence).toBe(1);
  });
  it('serializa dos ediciones durante una petición sin ACK prematuro del segundo gesto', async () => {
    const { queue, transport, stored } = setup();
    let release!: () => void;
    vi.mocked(transport.save).mockImplementationOnce(async ({ document }) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { status: 'saved', document: { ...document, revision: 1 } };
    });
    await queue.capture(edited('A'));
    const flush = queue.flush();
    await vi.waitFor(() => expect(transport.save).toHaveBeenCalledOnce());
    expect(stored()?.inFlight?.requestKey).toBeTruthy();
    await queue.capture(edited('B'));
    expect(queue.getSnapshot().remoteSequence).toBe(0);
    release(); await flush;
    expect(queue.getSnapshot()).toMatchObject({ sequence: 2, localSequence: 2, remoteSequence: 2 });
    expect(transport.save).toHaveBeenCalledTimes(2);
    expect(stored()).toMatchObject({ baseRevision: 2, inFlight: undefined });
    expect(stored()?.document.labels[0]?.text).toBe('B');
  });
  it('reintenta respuesta perdida con la misma clave incluso al recuperar el diario', async () => {
    const { queue, transport, storage, stored } = setup();
    vi.mocked(transport.save).mockRejectedValueOnce(new Error('timeout'));
    await queue.capture(edited('A')); await queue.flush();
    const requestKey = vi.mocked(transport.save).mock.calls[0]![0].requestKey;
    const recovered = new EditorSaveQueue(storage, scope, emptyEditorDocument(), transport, stored()!);
    await recovered.flush();
    expect(vi.mocked(transport.save).mock.calls[1]![0].requestKey).toBe(requestKey);
    expect(recovered.getSnapshot().remoteSequence).toBe(1);
  });
  it('conserva borrador ante conflicto y bloquea envíos sin sesión', async () => {
    const { queue, transport, stored } = setup();
    vi.mocked(transport.reauthorize).mockResolvedValueOnce(false);
    await queue.capture(edited('A')); await queue.flush();
    expect(transport.save).not.toHaveBeenCalled();
    vi.mocked(transport.save).mockResolvedValueOnce({ status: 'conflict', document: { ...emptyEditorDocument(), revision: 3 } });
    await queue.flush(); await queue.flush();
    expect(transport.save).toHaveBeenCalledOnce();
    expect(queue.getSnapshot().conflict?.revision).toBe(3);
    expect(stored()?.document.labels[0]?.text).toBe('A');
  });
  it('un error de cuota no declara el último gesto durable ni envía al servidor', async () => {
    const { queue, storage, transport } = setup();
    vi.mocked(storage.write).mockRejectedValue(new Error('quota'));
    await expect(queue.capture(edited('A'))).rejects.toThrow();
    await queue.flush();
    expect(queue.getSnapshot()).toMatchObject({ localSequence: 0, remoteSequence: 0 });
    expect(transport.save).not.toHaveBeenCalled();
  });
});
