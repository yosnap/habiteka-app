import { draftKey, type DraftScope } from './draft-contract';

/** sessionStorage conserva la rama al recargar; la elección de otra rama siempre es explícita. */
export function acquireDraftBranch(scope: DraftScope): Promise<{ branchId: string; release: () => void }> {
  const key = `editor-branch:${draftKey({ ...scope, branchId: undefined })}`;
  let branchId = sessionStorage.getItem(key) ?? crypto.randomUUID();
  const token = crypto.randomUUID();
  const channel = new BroadcastChannel('habiteka-editor-branches');
  let ready = false;
  channel.onmessage = (event: MessageEvent<{ key: string; branchId: string; token: string; kind: string }>) => {
    const message = event.data;
    if (!message || message.key !== key || message.branchId !== branchId || message.token === token) return;
    if (message.kind === 'probe' && (ready || token < message.token)) {
      channel.postMessage({ key, branchId, token, kind: 'occupied' });
    }
    if (!ready && (message.kind === 'occupied' || (message.kind === 'probe' && token > message.token))) {
      branchId = crypto.randomUUID();
    }
  };
  channel.postMessage({ key, branchId, token, kind: 'probe' });
  return new Promise((resolve, reject) => setTimeout(() => {
    ready = true;
    try {
      sessionStorage.setItem(key, branchId);
      resolve({ branchId, release: () => channel.close() });
    } catch (error) { channel.close(); reject(error); }
  }, 100));
}
