import type { EditorScope } from '@/server/editor/authority';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import type { VideoPresentationOptions } from '@/lib/editor-document/video-presentation';
import { prepareWalkthroughUpload, finishWalkthroughUpload } from '@/server/walkthrough/actions';

/** Los dos puntos de exportación registran las mismas opciones que recibe el grabador. */
export function createWalkthroughVideoSaver(scope: EditorScope, approvalId: string) {
  return (blob: Blob, routeId: string, mode: NativeVideoMode, presentation?: VideoPresentationOptions) =>
    saveWalkthroughVideo(scope, approvalId, blob, routeId, mode, presentation?.contentScope, presentation);
}

export async function saveWalkthroughVideo(scope: EditorScope, approvalId: string, blob: Blob, routeId: string, mode: NativeVideoMode,
  contentScope: import('@/lib/editor-document/video-content-scope').VideoContentScope = 'all', presentation?: VideoPresentationOptions) {
  const section = mode !== 'walkthrough' ? 'Vídeos' : 'Recorridos';
  const upload = await prepareWalkthroughUpload(scope, approvalId, routeId, blob.size, mode, contentScope, presentation);
  const response = await fetch(upload.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' } });
  if (!response.ok) throw new Error(`El MP4 se descargó, pero no se pudo subir a ${section}.`);
  try { await finishWalkthroughUpload(upload.ticket); }
  catch { throw new Error(`El MP4 se descargó, pero no se pudo registrar en ${section}. Vuelve a intentarlo.`); }
}
