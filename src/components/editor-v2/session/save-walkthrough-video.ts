import type { EditorScope } from '@/server/editor/authority';
import { prepareWalkthroughUpload, finishWalkthroughUpload } from '@/server/walkthrough/actions';
export async function saveWalkthroughVideo(scope: EditorScope, blob: Blob, routeId: string) {
  const upload = await prepareWalkthroughUpload(scope, routeId, blob.size);
  const response = await fetch(upload.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' } });
  if (!response.ok) throw new Error('El MP4 se descargó, pero no se pudo subir a Diseños.');
  try { await finishWalkthroughUpload(upload.ticket); }
  catch { throw new Error('El MP4 se descargó, pero no se pudo registrar en Diseños. Vuelve a intentarlo.'); }
}
