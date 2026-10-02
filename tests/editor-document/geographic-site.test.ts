import { describe, expect, it } from 'vitest';
import { geographicSiteSchema, orthophotoUrl, planToSite, siteToPlan, validIntervention, type GeographicSite } from '@/lib/editor-document/geographic-site';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import { promotionVideoIssue } from '@/lib/editor-document/promotion-video';
import { promotionFrame } from '@/components/editor-v2/scene/promotion-timeline';
import { nativeVideoDurationIssue, nativeVideoDurationMs } from '@/lib/editor-document/native-video';
import { assertGeographicSiteOwnership } from '@/server/editor/geographic-site-ownership';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { renderViewSchema } from '@/lib/editor-document/render-view';

const site: GeographicSite = {
  source: 'IGN-PNOA', latitude: 40.70940806753031, longitude: -3.5302981596101293,
  groundWidthM: 180, assetKey: 'geographic-sites/org/project/00000000-0000-4000-8000-000000000000.jpg',
  capturedAt: '2026-09-30T10:00:00.000Z', anchor: { x: .4, y: .6 }, planOriginMm: { x: 3000, y: 4000 },
  rotationDeg: 0, intervention: [{ x: .2, y: .2 }, { x: .7, y: .2 }, { x: .7, y: .8 }, { x: .2, y: .8 }],
  scenario: 'reconstruction', lighting: 'afternoon', confirmed: true,
};
const doc = () => ({ ...addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]), geographicSite: structuredClone(site) });
describe('geographic site and promotion', () => {
  it('changes plan size independently of the photograph extent and anchor', () => {
    const scaled = { ...site, planScale: 2 }, p = { x: 93000, y: 4000 };
    expect(planToSite(p, scaled).x - site.anchor.x).toBeCloseTo(2 * (planToSite(p, site).x - site.anchor.x));
    expect(scaled.groundWidthM).toBe(site.groundWidthM);
    expect(planToSite(site.planOriginMm, scaled)).toEqual(site.anchor);
    expect(siteToPlan(planToSite(p, scaled), scaled).x).toBeCloseTo(p.x);
  });
  it('saves placement size without changing building dimensions and invalidates the prior placement', () => {
    const before = doc(), after = { ...structuredClone(before), geographicSite: { ...site, planScale: 1.5 } };
    const saved = parseEditorDocument(after);
    expect(saved.geographicSite?.planScale).toBe(1.5);
    expect(saved.vertices).toEqual(before.vertices);
    expect(sameDesignContent(before, saved)).toBe(false);
    expect(() => geographicSiteSchema.parse({ ...site, planScale: 0 })).toThrow();
  });
  it('keeps metre scale and clockwise rotation, independent of placement', () => {
    const q = planToSite({ x: 183000, y: 4000 }, site);
    expect(q.x).toBeCloseTo(1.4); expect(q.y).toBeCloseTo(.6);
    const rotated = planToSite({ x: 183000, y: 4000 }, { ...site, rotationDeg: 90 });
    expect(rotated.x).toBeCloseTo(.4); expect(rotated.y).toBeCloseTo(1.6);
  });
  it.each([-180, -75, 0, 90, 180])('round-trips ground coordinates at %s degrees', rotationDeg => {
    const located = { ...site, rotationDeg }, p = { x: -8500, y: 16400 };
    const restored = siteToPlan(planToSite(p, located), located);
    expect(restored.x).toBeCloseTo(p.x); expect(restored.y).toBeCloseTo(p.y);
  });
  it('rejects crossed, degenerate and underspecified intervention polygons', () => {
    expect(validIntervention(site.intervention)).toBe(true);
    expect(validIntervention([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }])).toBe(false);
    expect(validIntervention([{ x: 0, y: 0 }, { x: .5, y: .5 }, { x: 1, y: 1 }])).toBe(false);
    expect(() => geographicSiteSchema.parse({ ...site, intervention: [] })).toThrow();
    expect(() => geographicSiteSchema.parse({ ...site, intervention: [], confirmed: false })).not.toThrow();
  });
  it('keeps the site at building level when switching and adding floors', () => {
    const upper = addBuildingLevel(doc());
    expect(upper.geographicSite).toEqual(site);
    expect(upper.levels![0]!.document?.geographicSite).toBeUndefined();
    expect(switchBuildingLevel(upper, upper.levels![0]!.id).geographicSite).toEqual(site);
    expect(parseEditorDocument(doc()).geographicSite).toEqual(site);
  });
  it('invalidates content matching when approved placement or lighting changes', () => {
    const a = doc(), b = structuredClone(a);
    expect(sameDesignContent(a, b)).toBe(true);
    b.geographicSite.rotationDeg = 15;
    expect(sameDesignContent(a, b)).toBe(false);
    b.geographicSite = { ...a.geographicSite, lighting: 'evening' };
    expect(sameDesignContent(a, b)).toBe(false);
  });
  it('builds only the bounded IGN WMS URL with north-up Mercator coordinates', () => {
    const url = new URL(orthophotoUrl({ latitude: site.latitude, longitude: site.longitude, groundWidthM: 180 }));
    expect(url.origin).toBe('https://www.ign.es'); expect(url.searchParams.get('SRS')).toBe('EPSG:3857');
    const bbox = url.searchParams.get('BBOX')!.split(',').map(Number);
    expect(bbox[0]).toBeLessThan(bbox[2]!); expect(bbox[1]).toBeLessThan(bbox[3]!);
    expect((bbox[2]! - bbox[0]!) * Math.cos(site.latitude * Math.PI / 180)).toBeCloseTo(180);
    expect(() => orthophotoUrl({ latitude: 89, longitude: 0, groundWidthM: 180 })).toThrow();
    expect(() => orthophotoUrl({ latitude: 40, longitude: 0, groundWidthM: 10000 })).toThrow();
  });
  it('rejects assets from another project or organisation', () => {
    const ctx = { organizationId: 'org', userId: 'user', role: 'owner' as const };
    expect(() => assertGeographicSiteOwnership(doc(), ctx, 'project')).not.toThrow();
    expect(() => assertGeographicSiteOwnership(doc(), ctx, 'other')).toThrow();
    expect(() => assertGeographicSiteOwnership(doc(), { ...ctx, organizationId: 'other' }, 'project')).toThrow();
  });
  it('requires placement confirmation and prevents treating reform as demolition', () => {
    expect(promotionVideoIssue(doc())).toBeNull();
    expect(promotionVideoIssue({ ...doc(), geographicSite: { ...site, confirmed: false } })).toMatch(/confirma/);
    expect(promotionVideoIssue({ ...doc(), geographicSite: { ...site, scenario: 'reform' } })).toMatch(/conservan/);
    expect(promotionVideoIssue(emptyEditorDocument())).not.toBeNull();
  });
  it('has a 30 second script independent of interior routes with a finished final stage', () => {
    expect(nativeVideoDurationMs(0, 'promotion')).toBe(30000);
    expect(nativeVideoDurationIssue(0, 'promotion')).toBeNull();
    expect([0, 3000, 6000, 10000, 15000, 20000, 29999].map(t => promotionFrame(doc(), t).stage))
      .toEqual([-2, -1, 0, 1, 2, 3, 3]);
    expect(promotionFrame(doc(), 3000).label).toMatch(/Sustitución/);
    expect(promotionFrame(doc(), 29999).label).toMatch(/terminado/);
    expect(promotionFrame({ ...doc(), geographicSite: { ...site, scenario: 'new-build' } }, 3000).label).toMatch(/Preparación/);
  });
  it('accepts afternoon in generation and camera capture contracts', () => {
    expect(renderDesignOptionsSchema.parse({ lighting: 'afternoon' }).lighting).toBe('afternoon');
    expect(renderViewSchema.parse({ preset: 'drone', position: [1, 10, 2], quaternion: [0, 0, 0, 1],
      fov: 45, aspect: 16 / 9, allLevels: true, cutaway: false, lighting: 'afternoon' }).lighting).toBe('afternoon');
  });
});
