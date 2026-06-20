'use server';

/**
 * Server Actions del canvas.
 *
 * Persisten y recuperan el estado del lienzo a través del repositorio con ámbito
 * (aislamiento por organización). El payload del cliente NO se confía: se
 * normaliza con el (de)serializador del canvas antes de guardarlo, de modo que
 * datos corruptos o de otra versión no entran en la base.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';

export async function loadCanvas(projectId: string) {
  const ctx = await requireOrgContext();
  const raw = await withOrg(ctx).canvas.load(projectId);
  // Se devuelve ya normalizado para que el cliente hidrate un documento válido.
  return serializeCanvas(deserializeCanvas(raw));
}

export async function saveCanvas(projectId: string, payload: unknown) {
  const ctx = await requireOrgContext();
  // Normaliza el payload del cliente: descarta lo inválido antes de persistir.
  const clean = serializeCanvas(deserializeCanvas(payload));
  await withOrg(ctx).canvas.save(projectId, clean);
}
