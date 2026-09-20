import type { EditorSaveQueue } from './save-queue';

const sessions = new Map<EditorSaveQueue, string>();
let channel: BroadcastChannel | null = null;
export function registerEditorSession(userId: string, queue: EditorSaveQueue) {
  sessions.set(queue, userId);
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('habiteka-editor-session');
    channel.onmessage = (event) => {
      if (event.data?.kind === 'logout' && typeof event.data.userId === 'string') {
        void stopEditorSessions(event.data.userId, false);
      }
    };
  }
  return () => { sessions.delete(queue); };
}
export async function stopEditorSessions(userId: string, broadcast = true): Promise<void> {
  if (broadcast && typeof BroadcastChannel !== 'undefined') {
    const sender = new BroadcastChannel('habiteka-editor-session');
    sender.postMessage({ kind: 'logout', userId }); sender.close();
  }
  await Promise.all([...sessions].filter(([, owner]) => owner === userId).map(([queue]) => queue.stop()));
}
