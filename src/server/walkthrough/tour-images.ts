import { resolveRenderUrl } from '@/server/storage/render-urls';
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
