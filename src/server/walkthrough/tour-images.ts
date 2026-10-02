import { resolveRenderUrl } from '@/server/storage/render-urls';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { EditorScope } from '@/server/editor/authority';
import type { OrgContext } from '@/server/auth/org-context';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { WHOLE_PROPERTY, type TourImage } from '@/lib/editor-document/image-tour';
import { renderRoomContext } from '@/lib/editor-document/render-room-context';
import { renderViewSchema, type RenderView } from '@/lib/editor-document/render-view';
import { acceptedRenderIssue, type RenderReview } from '@/lib/editor-document/render-review';

interface RenderRow { id: string; payload: unknown; createdAt: Date }
type Generation = { documentRevision?: number; view?: Partial<RenderView>; review?: RenderReview; provider?: string; acceptance?: { acceptedAt: string; userId: string };
  options?: { freedom?: string; redesignFixed?: boolean; redesignInterior?: boolean; regions?: { name?: string }[]; designScope?: string; interiorRoomIds?: string[] } };

/** Convierte los renders guardados en imágenes del montaje; descarta los que no tienen archivo servible. */
export async function tourImagesFromRows(rows: RenderRow[], readDocument?: (revision: number) => Promise<EditorDocument | null>): Promise<TourImage[]> {
  const documents = new Map<number, Promise<EditorDocument | null>>();
  const images = await Promise.all(rows.map(async (row): Promise<TourImage | null> => {
    const payload = row.payload as { assetKey?: string; assetUrl?: string; generation?: Generation } | null;
    if (!payload || typeof payload !== 'object') return null;
    const generation = payload.generation ?? {};
    if (acceptedRenderIssue(generation)) return null;
    const url = await resolveRenderUrl(payload);
    if (!url) return null;
    const region = generation.options?.regions?.[0]?.name?.trim();
    let context = generation.view?.roomId && generation.view.roomName ? generation.view : null;
    // Compatibilidad: recuperar solo de la revisión que produjo la imagen.
    if (!context && readDocument && generation.options?.interiorRoomIds?.length && generation.documentRevision) {
      const view = renderViewSchema.safeParse(generation.view);
      if (view.success) {
        const revision = generation.documentRevision;
        if (!documents.has(revision)) documents.set(revision, readDocument(revision));
        const document = await documents.get(revision)!;
        const recovered = document ? renderRoomContext(document, view.data) : null;
        if (recovered && generation.options.interiorRoomIds.includes(recovered.roomId)) context = recovered;
      }
    }
    const unidentifiedInterior = !context && Boolean(generation.options?.interiorRoomIds?.length);
    const roomLabel = context?.roomName ? `${context.roomName}${context.roomAreaM2
      ? ` · ${context.roomAreaM2.toLocaleString('es', { maximumFractionDigits: 1 })} m²` : ''}` : null;
    return { id: row.id, ambient: roomLabel || region || (unidentifiedInterior ? 'Interior sin identificar'
      : generation.options?.designScope === 'house' ? 'Solo la casa' : WHOLE_PROPERTY),
      ...(unidentifiedInterior ? { ambientId: `unknown:${row.id}` } : {}),
      ...(context ? { ambientId: context.roomId, coveredAmbients: [context.roomName!, ...(context.zones?.map((zone) => zone.name) ?? [])] } : {}), view: generation.view?.preset ?? 'custom',
      lighting: generation.view?.lighting ?? 'daylight', freedom: generation.options?.freedom ?? 'strict',
      redesignFixed: generation.options?.redesignFixed === true,
      redesignInterior: generation.options?.redesignInterior === true,
      revision: Number.isFinite(generation.documentRevision) ? generation.documentRevision! : 0,
      createdAt: row.createdAt.toISOString(), url };
  }));
  return images.filter((image): image is TourImage => image !== null);
}

/** Un historial ausente no justifica inventar una estancia; los errores de BD se propagan. */
export function tourDocumentReader(ctx: OrgContext, scope: EditorScope) {
  const repo = withEditorDocuments(ctx);
  return async (revision: number): Promise<EditorDocument | null> => {
    try { return await repo.readRevision(scope, revision); }
    catch (error) {
      if (error instanceof Error && /Revisión no encontrada|Editor v2 no activado/.test(error.message)) return null;
      throw error;
    }
  };
}

/**
 * Lo que no cambia el aspecto de las imágenes: rutas, comentarios, el nombre de las zonas y el uso declarado del espacio
 * (solo condiciona el prompt). De cada zona se conservan su contorno y su acabado de suelo, que sí se ven.
 */
function withoutNonVisual(doc: EditorDocument): EditorDocument {
  const zones = (doc.designZones ?? []).map(({ polygon, floorFinish }) => ({ polygon, floorFinish }));
  return { ...doc, walkthroughs: [], comments: [], designZones: zones, designSpaceKind: undefined } as unknown as EditorDocument;
}

export function sameVisualDesignContent(first: EditorDocument, second: EditorDocument): boolean {
  return sameDesignContent(withoutNonVisual(first), withoutNonVisual(second));
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
