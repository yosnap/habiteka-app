import type { EditorDocument } from './schema';
import { geographicSiteSchema } from './geographic-site';
export const PROMOTION_DURATION_MS = 30000;
export const PROMOTION_ROUTE_ID = 'geographic-promotion';
export function promotionVideoIssue(doc: EditorDocument): string | null {
  if (!doc.vertices.length) return 'Dibuja el inmueble antes de preparar su promoción.';
  const parsed = geographicSiteSchema.safeParse(doc.geographicSite);
  if (!parsed.success || !parsed.data.confirmed)
    return 'Sitúa el plano y confirma la intervención, la orientación y el acceso en «Parcela real».';
  if (parsed.data.scenario === 'reform')
    return 'La reforma necesita definir qué elementos se conservan. No se simula como una demolición.';
  return null;
}
