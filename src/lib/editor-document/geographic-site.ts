import { z } from 'zod';
import { LIGHTING_PRESETS } from '@/lib/lighting-preset';
import type { EditorDocument } from './schema';

const point = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const mapPoint = point.extend({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export const geographicLocationSchema = z.object({
  latitude: z.number().min(27).max(44), longitude: z.number().min(-19).max(5),
  groundWidthM: z.number().min(40).max(500),
}).strict();
export const geographicSiteSchema = geographicLocationSchema.extend({
  source: z.literal('IGN-PNOA'),
  assetKey: z.string().regex(/^geographic-sites\/[^/]+\/[^/]+\/[a-f0-9-]{36}\.jpg$/),
  capturedAt: z.string().datetime(),
  anchor: mapPoint, planOriginMm: point,
  rotationDeg: z.number().min(-180).max(180),
  planScale: z.number().min(.25).max(5).optional(),
  intervention: z.array(mapPoint).max(20),
  scenario: z.enum(['new-build', 'reconstruction', 'reform']),
  lighting: z.enum(LIGHTING_PRESETS),
  confirmed: z.boolean(),
}).strict().superRefine((site, ctx) => {
  if (site.intervention.length > 0 && site.intervention.length < 3)
    ctx.addIssue({ code: 'custom', path: ['intervention'], message: 'Marca al menos tres puntos.' });
  if (site.confirmed && !validIntervention(site.intervention))
    ctx.addIssue({ code: 'custom', path: ['intervention'], message: 'Delimita una zona de intervención sin cruces.' });
});
export type GeographicSite = z.infer<typeof geographicSiteSchema>;
export type SitePoint = { x: number; y: number };
const cross = (a: SitePoint, b: SitePoint, c: SitePoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function validIntervention(points: SitePoint[]): boolean {
  if (points.length < 3) return false;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) < .0001) return false;
    area += a.x * b.y - a.y * b.x;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j]!, d = points[(j + 1) % points.length]!;
      if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
        Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y)) return false;
    }
  }
  return Math.abs(area) > .00001;
}
/** Saved placement scale; clockwise angle with north at the top. Plan dimensions stay unchanged. */
export function planToSite(pointMm: SitePoint, site: GeographicSite): SitePoint {
  const angle = site.rotationDeg * Math.PI / 180;
  const x = (pointMm.x - site.planOriginMm.x) * (site.planScale ?? 1) / (site.groundWidthM * 1000);
  const y = (pointMm.y - site.planOriginMm.y) * (site.planScale ?? 1) / (site.groundWidthM * 1000);
  return { x: site.anchor.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: site.anchor.y + x * Math.sin(angle) + y * Math.cos(angle) };
}
export function sitePlanOrigin(doc: EditorDocument): SitePoint {
  const points = doc.vertices;
  if (!points.length) throw new Error('El plano no tiene una huella para situar.');
  return { x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2 };
}
export function siteToPlan(point: SitePoint, site: GeographicSite): SitePoint {
  const angle = site.rotationDeg * Math.PI / 180, span = site.groundWidthM * 1000 / (site.planScale ?? 1);
  const x = point.x - site.anchor.x, y = point.y - site.anchor.y;
  return { x: site.planOriginMm.x + span * (x * Math.cos(angle) + y * Math.sin(angle)),
    y: site.planOriginMm.y + span * (-x * Math.sin(angle) + y * Math.cos(angle)) };
}
export function orthophotoUrl(location: z.infer<typeof geographicLocationSchema>): string {
  const { latitude, longitude, groundWidthM } = geographicLocationSchema.parse(location);
  const r = 6378137, lat = latitude * Math.PI / 180;
  const x = r * longitude * Math.PI / 180, y = r * Math.log(Math.tan(Math.PI / 4 + lat / 2));
  const half = groundWidthM / (2 * Math.cos(lat));
  const url = new URL('https://www.ign.es/wms-inspire/pnoa-ma');
  url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
    LAYERS: 'OI.OrthoimageCoverage', STYLES: '', SRS: 'EPSG:3857',
    BBOX: [x - half, y - half, x + half, y + half].join(','),
    WIDTH: '1440', HEIGHT: '1440', FORMAT: 'image/jpeg' }).toString();
  return url.toString();
}
