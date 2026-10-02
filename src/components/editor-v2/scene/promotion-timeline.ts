import type { EditorDocument } from '@/lib/editor-document/schema';
import { PROMOTION_DURATION_MS } from '@/lib/editor-document/promotion-video';
import { buildingFlyFrame, stageProgress } from './showcase-timeline';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
export function promotionFrame(doc: EditorDocument, elapsedMs: number, regions: ZoneMaskRegions = []) {
  const elapsed = Math.max(0, Math.min(PROMOTION_DURATION_MS, elapsedMs));
  const shot = buildingFlyFrame(doc, elapsed / PROMOTION_DURATION_MS, regions);
  const stage = elapsed < 3000 ? -2 : elapsed < 6000 ? -1 : elapsed < 10000 ? 0
    : elapsed < 15000 ? 1 : elapsed < 20000 ? 2 : 3;
  const label = elapsed < 3000 ? 'Parcela · estado de la ortofoto'
    : elapsed < 6000 ? doc.geographicSite?.scenario === 'reconstruction' ? 'Sustitución de la construcción · área marcada' : 'Preparación de la zona de obra'
    : elapsed < 10000 ? 'Suelos y plataformas del diseño'
    : elapsed < 15000 ? 'Estructura del diseño'
    : elapsed < 20000 ? 'Huecos y cubiertas'
    : elapsed < 25000 ? 'Acabados y mobiliario' : 'Diseño terminado · vuelo exterior';
  return { ...shot, stage, label, stageProgress: stageProgress(elapsed, stage, [6000, 10000, 15000, 20000], [10000, 15000, 20000, 25000]) };
}
