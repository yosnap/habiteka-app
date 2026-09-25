/**
 * Materializa una importación de plano como documento del EDITOR V2 con
 * autoridad de editor: si el proyecto aún vive en el canvas legacy, activa el
 * editor v2 con la huella del snapshot legacy actual (así el editor no vuelve
 * a convertirlo); si ya está activado, escribe una revisión nueva sobre la
 * cabeza. Nunca toca `canvasState`. El llamador ya validó organización,
 * consentimiento y confirmación del usuario.
 */
import type { PlanImportResult } from '@/lib/contracts';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { StudioQuality } from '@/lib/studio-state';
import type { OrgContext } from '@/server/auth/org-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { editorGeometryFingerprint } from '@/server/quality/editor-geometry-fingerprint';

export interface ImportToEditorResult {
  document: EditorDocument;
  /** Avisos de conversión no bloqueantes (campos no convertibles, etc.). */
  issues: string[];
}

export async function importPlanToEditor(
  ctx: OrgContext,
  projectId: string,
  result: PlanImportResult,
  quality?: StudioQuality,
): Promise<ImportToEditorResult> {
  const conversion = fromPlanImport(result);
  if (!conversion.document) {
    throw new Error(`No se pudo convertir el plano importado: ${conversion.issues.join('; ')}`);
  }
  const severe = result.warnings.filter((warning) =>
    warning.code === 'estancias-solapadas' || warning.code === 'ajuste-desplaza-muros' ||
    warning.code === 'estancia-inferida' || warning.code === 'cotas-generales-discordantes');
  const reasons = quality?.decision === 'block' ? quality.reasons : severe.map((warning) => warning.message);
  if (reasons.length) conversion.document.importReview = {
    geometryFingerprint: editorGeometryFingerprint(conversion.document),
    reasons: reasons.slice(0, 5).map((reason) => reason.slice(0, 500)),
  };
  const repo = withEditorDocuments(ctx);
  const scope = { projectId };
  const current = await repo.load(scope);

  if (current.authority === 'legacy') {
    const activated = await repo.activate(scope, {
      document: conversion.document,
      expectedLegacyFingerprint: current.legacyFingerprint,
      confirmed: true,
    });
    if (activated.authority !== 'v2') throw new Error('No se pudo activar el editor.');
    return { document: activated.document, issues: conversion.issues };
  }

  if (!current.writable) throw new Error('El editor de este proyecto está en solo lectura.');
  const document = { ...conversion.document, revision: current.document.revision };
  const saved = await repo.save(scope, {
    document,
    expectedRevision: current.document.revision,
    // Clave idempotente por contenido: reintentar la misma importación no duplica revisiones.
    requestKey: `plan-import:${current.document.revision}:${Date.now()}`,
  });
  if (saved.status === 'conflict') {
    throw new Error('El plano cambió mientras se importaba; vuelve a intentarlo.');
  }
  return { document: saved.document, issues: conversion.issues };
}
