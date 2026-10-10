'use server';
import { requireOrgContext, UnauthenticatedError } from '@/server/auth/require-org-context';
import { createPreviewProject } from '@/server/editor/preview-project-repo';

export async function savePreview(input: { title: string; document: unknown; requestKey: string }) {
  if (process.env.NODE_ENV !== 'development') throw new Error('Muestra no disponible.');
  try {
    const result = await createPreviewProject(await requireOrgContext(), input);
    return { projectId: result.id };
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { error: 'Inicia sesión en otra pestaña y vuelve a guardar aquí. Tu copia se conserva.' };
    return { error: 'No se pudo guardar el proyecto. La copia de esta pestaña se conserva; puedes volver a intentarlo.' };
  }
}
