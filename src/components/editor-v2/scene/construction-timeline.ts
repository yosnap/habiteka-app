import type { EditorDocument } from '@/lib/editor-document/schema';
import { showcaseFrame } from './showcase-timeline';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { constructionTiming, type ConstructionTimingOptions } from '@/lib/editor-document/construction-timing';

export const CONSTRUCTION_STARTS_MS = constructionTiming().starts;
export const CONSTRUCTION_ENDS_MS = constructionTiming().ends;

/** Construcción independiente y combinada comparten ritmo y orden de obra. */
export function constructionFrame(doc: EditorDocument, elapsedMs: number, regions: ZoneMaskRegions = [], options: ConstructionTimingOptions = {}) {
  return showcaseFrame(doc, elapsedMs, regions, options);
}
