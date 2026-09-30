import { resolveRenderUrl } from '@/server/storage/render-urls';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { EditorScope } from '@/server/editor/authority';
import type { OrgContext } from '@/server/auth/org-context';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { WHOLE_PROPERTY, type TourImage } from '@/lib/editor-document/image-tour';

interface RenderRow { id: string; payload: unknown; createdAt: Date }
type Generation = { documentRevision?: number; view?: { preset?: string; lighting?: string };
  options?: { freedom?: string; regions?: { name?: string }[]; designScope?: string } };

/** Convierte los renders guardados en imágenes del montaje; descarta los que no tienen archivo servible. */
export async function tourImagesFromRows(rows: RenderRow[]): Promise<TourImage[]> {
  const images = await Promise.all(rows.map(async (row): Promise<TourImage | null> => {
    const payload = row.payload as { assetKey?: string; assetUrl?: string; generation?: Generation } | null;
    if (!payload || typeof payload !== 'object') return null;
    const generation = payload.generation ?? {};
    const url = await resolveRenderUrl(payload);
    if (!url) return null;
    const region = generation.options?.regions?.[0]?.name?.trim();
    return { id: row.id, ambient: region || WHOLE_PROPERTY, view: generation.view?.preset ?? 'custom',
      lighting: generation.view?.lighting ?? 'daylight', freedom: generation.options?.freedom ?? 'strict',
      revision: Number.isFinite(generation.documentRevision) ? generation.documentRevision! : 0,
      createdAt: row.createdAt.toISOString(), url };
  }));
  return images.filter((image): image is TourImage => image !== null);
}

/**
 * Lo que no cambia el aspecto de las imágenes: rutas, comentarios, el nombre de las zonas y el uso declarado del espacio
 * (solo condiciona el prompt). De cada zona se conservan su contorno y su acabado de suelo, que sí se ven.
 */
function withoutNonVisual(doc: EditorDocument): EditorDocument {
  const zones = (doc.designZones ?? []).map(({ polygon, floorFinish }) => ({ polygon, floorFinish }));
  return { ...doc, walkthroughs: [], comments: [], designZones: zones, designSpaceKind: undefined } as unknown as EditorDocument;
}

/**
 * Revisiones cuyo contenido visual es el del diseño aprobado: la propia aprobada y las que solo difieren en rutas,
 * comentarios o zonas. Una imagen generada desde cualquiera de ellas muestra el mismo diseño.
 */
export async function sameContentRevisions(ctx: OrgContext, scope: EditorScope, approved: { revision: number; document: EditorDocument },
  revisions: number[]): Promise<number[]> {
  const reference = withoutNonVisual(approved.document), repo = withEditorDocuments(ctx);
  const candidates = [...new Set(revisions)].filter((revision) => revision !== approved.revision && Number.isSafeInteger(revision) && revision >= 1);
  const same = await Promise.all(candidates.map(async (revision) => {
    try { return sameDesignContent(withoutNonVisual(await repo.readRevision(scope, revision)), reference) ? revision : null; }
    catch (error) {
      // Una revisión que no existe en este plano no es válida; un fallo de la base de datos no debe pasar por «distinta».
      if (error instanceof Error && /Revisión no encontrada|Editor v2 no activado/.test(error.message)) return null;
      throw error;
    }
  }));
  return [approved.revision, ...same.filter((revision): revision is number => revision !== null)].sort((a, b) => a - b);
}
