'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import type { VideoContentScope } from '@/lib/editor-document/video-content-scope';
import type { VideoPresentationOptions } from '@/lib/editor-document/video-presentation';

const MESSAGE = 'Los vídeos deben partir de diseños IA aceptados. El plano 3D es una guía y ya no admite exportación como vídeo final.';

/** Bloquea también clientes antiguos: no emite tickets ni accede al almacenamiento. */
export async function prepareWalkthroughUpload(..._args: [scope: EditorScope, approvalId: string, routeId: string, bytes: number,
  mode?: NativeVideoMode, contentScope?: VideoContentScope, presentation?: VideoPresentationOptions, name?: string]): Promise<{ ticket: string; url: string }> {
  void _args;
  await requireOrgContext();
  throw new Error(MESSAGE);
}

/** Un ticket nativo anterior no permite publicar otro vídeo del plano guía. */
export async function finishWalkthroughUpload(_token: string): Promise<{ id: string }> {
  void _token;
  await requireOrgContext();
  throw new Error(MESSAGE);
}
