import type { EditorDocument } from '@/lib/editor-document/schema';

export const BUILD_DURATION_MS = 4000;
export const REVEAL_DURATION_MS = 4000;
export const SHOWCASE_INTRO_MS = BUILD_DURATION_MS + REVEAL_DURATION_MS;

/** Guion determinista de la introducción; el paseo usa después WalkthroughPath. */
export function showcaseFrame(doc: EditorDocument, elapsedMs: number) {
  const xs = doc.vertices.map((vertex) => vertex.x / 1000);
  const zs = doc.vertices.map((vertex) => vertex.y / 1000);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 4);
  const progress = Math.max(0, Math.min(1, elapsedMs / SHOWCASE_INTRO_MS));
  const angle = Math.PI * (-.25 + progress * 1.1);
  const radius = span * 1.25;
  return {
    stage: Math.min(3, Math.floor(Math.max(0, elapsedMs) / 1000)),
    position: [centerX + Math.cos(angle) * radius, Math.max(5, span * .72), centerZ + Math.sin(angle) * radius] as [number, number, number],
    focus: [centerX, 1, centerZ] as [number, number, number],
    fov: 45,
  };
}
