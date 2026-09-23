'use server';

/**
 * Evaluación de calidad del plano del editor para el diálogo de generación.
 *
 * Juzga el documento QUE MANDA EL CLIENTE, exactamente el mismo que evaluará la
 * puerta al generar. Evaluar el documento guardado producía un estado imposible
 * —la tarjeta decía «fiabilidad alta» y el servidor pedía confirmar sobre otro
 * documento— y dos llamadas a Jev; con el mismo documento, la caché por
 * evidencia hace que la generación reutilice este veredicto sin pagarlo otra vez.
 *
 * No genera imágenes ni consume créditos del usuario: solo puntúa la evidencia
 * estructural.
 */
import type { QualityVerdict } from '@/lib/quality-verdict';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction, fail } from '@/server/errors/run-action';
import { withOrg } from '@/server/db/scoped-repo';
import { editorDocumentQuality } from '@/server/quality/editor-gate';

/** Tope del documento serializado: mismo criterio de acotar la entrada que las generaciones. */
const MAX_DOCUMENT_CHARS = 4_000_000;

export async function evaluateEditorQuality(
  projectId: string,
  rawDocument: unknown,
  zoneId: string | null = null,
) {
  return runAction(async (): Promise<QualityVerdict | null> => {
    const ctx = await requireOrgContext();
    // Misma guarda de pertenencia que las acciones de generación: el proyecto
    // tiene que ser de la organización de la sesión (IDOR).
    if (!(await withOrg(ctx).projects.findById(projectId)))
      fail('Proyecto no encontrado en tu organización');
    if (JSON.stringify(rawDocument ?? null).length > MAX_DOCUMENT_CHARS)
      fail('El plano es demasiado grande para comprobar su calidad.');
    const document = parseEditorDocument(rawDocument);
    return editorDocumentQuality(ctx, { projectId, zoneId }, document);
  });
}
