import type { EditorScope } from '@/server/editor/authority';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import { prepareWalkthroughUpload, finishWalkthroughUpload } from '@/server/walkthrough/actions';
export async function saveWalkthroughVideo(scope: EditorScope, approvalId: string, blob: Blob, routeId: string, mode: NativeVideoMode) {
  const upload = await prepareWalkthroughUpload(scope, approvalId, routeId, blob.size, mode);
  const response = await fetch(upload.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' } });
  if (!response.ok) throw new Error('El MP4 se descargó, pero no se pudo subir a Diseños.');
  try { await finishWalkthroughUpload(upload.ticket); }
  catch { throw new Error('El MP4 se descargó, pero no se pudo registrar en Diseños. Vuelve a intentarlo.'); }
}
