import type { Boundary, BoundaryGate } from './boundary-types';
import type { FurnitureVolume } from './furniture-profiles';

/** A single geometry source for drawing, solids, navigation and exported scenes. */
export function boundaryVolumes(b: Boundary): FurnitureVolume[] {
  const c = b.construction, parts: FurnitureVolume[] = [], d = b.depthMm, w = b.widthMm, e = b.elevationMm;
  const box = (x: number, y: number, widthMm: number, depthMm: number, bottom: number, top: number, color: string, materialId?: string) => {
    if (widthMm <= .01 || top - bottom <= .01) return;
    // Subtract openings in the X/Z plane from both masonry and infill.
    let pieces = [{ left: x, right: x + widthMm, bottom, top }];
    for (const g of c.gates) pieces = pieces.flatMap((p) => {
      const left = Math.max(p.left, g.positionMm - g.widthMm / 2), right = Math.min(p.right, g.positionMm + g.widthMm / 2);
      if (left >= right || p.bottom >= g.heightMm) return [p];
      return [{ ...p, right: left }, { ...p, left: right }, { left, right, bottom: Math.max(p.bottom, g.heightMm), top: p.top }]
        .filter((p) => p.right - p.left > .01 && p.top - p.bottom > .01);
    });
    parts.push(...pieces.map((p) => ({ x: p.left, y, widthMm: p.right - p.left, depthMm, bottom: e + p.bottom, top: e + p.top, color, materialId })));
  };
  box(0, 0, w, d, 0, c.baseHeightMm, c.baseColor, c.baseMaterialId);
  const base = c.baseHeightMm, height = b.heightMm - base;
  if (c.infill === 'hedge') {
    const count = Math.ceil(w / 1000);
    for (let i = 0; i < count; i++) {
      box(i * w / count, d * .1, w / count, d * .8, base, b.heightMm - height * .15, b.color, c.infillMaterialId);
      box((i + .1) * w / count, d * .15, w / count * .8, d * .7, base + height * .7, b.heightMm, b.color, c.infillMaterialId);
    }
  } else if (c.infill === 'vertical') {
    for (let x = 0; x < w; x += c.slatWidthMm + c.gapMm)
      box(x, d * .35, Math.min(c.slatWidthMm, w - x), d * .3, base, b.heightMm, b.color, c.infillMaterialId);
    for (const fraction of [.2, .8]) box(0, d * .25, w, d * .5, base + height * fraction, Math.min(b.heightMm, base + height * fraction + 50), b.color, c.infillMaterialId);
  } else {
    for (let z = base; z < b.heightMm; z += c.slatWidthMm + c.gapMm)
      box(0, d * .35, w, d * .3, z, Math.min(b.heightMm, z + c.slatWidthMm), b.color, c.infillMaterialId);
  }
  const post = (x: number) => parts.push({ x: x - c.postSizeMm / 2, y: (d - c.postSizeMm) / 2,
    widthMm: c.postSizeMm, depthMm: c.postSizeMm, bottom: e, top: e + b.heightMm,
    color: c.postColor, materialId: c.postMaterialId, shape: c.postShape === 'circle' ? 'cylinder' : 'box', part: 'post' });
  const positions: number[] = [];
  if (c.infill !== 'hedge') {
    const count = Math.ceil(w / c.postSpacingMm);
    for (let i = 0; i <= count; i++) {
      const x = i * w / count;
      if (!c.gates.some((g) => Math.abs(x - g.positionMm) < g.widthMm / 2 + c.postSizeMm)) positions.push(x);
    }
  }
  for (const g of c.gates) positions.push(g.positionMm - (g.widthMm + c.postSizeMm) / 2, g.positionMm + (g.widthMm + c.postSizeMm) / 2);
  for (const x of positions) if (!positions.some((p) => p < x && x - p < c.postSizeMm - .01)) post(x);
  for (const g of c.gates) parts.push(...gateVolumes(b, g));
  return parts;
}
function gateVolumes(b: Boundary, g: BoundaryGate): FurnitureVolume[] {
  const width = g.widthMm - 16, thickness = Math.min(50, b.depthMm / 3);
  const angle = g.hinge === 'left' ? g.openAngleDeg : 180 - g.openAngleDeg;
  const r = angle * Math.PI / 180, hinge = g.positionMm + (g.hinge === 'left' ? -1 : 1) * width / 2;
  return [{ x: hinge + Math.sin(r) * thickness / 2, y: b.depthMm / 2 - Math.cos(r) * thickness / 2,
    widthMm: width, depthMm: thickness, rotation: angle, bottom: b.elevationMm + 30, top: b.elevationMm + g.heightMm,
    color: g.color, materialId: b.construction.infillMaterialId, part: 'gate', gateId: g.id }];
}

/** Identical corner/end posts have one owner, avoiding doubled meshes and flickering. */
export function boundaryDisplayVolumes(b: Boundary, peers: Boundary[]): FurnitureVolume[] {
  const a = b.rotation * Math.PI / 180;
  const endPoint = (item: Boundary, x: number) => {
    const r = item.rotation * Math.PI / 180;
    return { x: item.x + x * Math.cos(r) - item.depthMm / 2 * Math.sin(r), y: item.y + x * Math.sin(r) + item.depthMm / 2 * Math.cos(r) };
  };
  return boundaryVolumes(b).filter((part) => {
    if (part.part !== 'post') return true;
    const x = part.x + part.widthMm / 2;
    if (Math.abs(x) > .01 && Math.abs(x - b.widthMm) > .01) return true;
    const point = { x: b.x + x * Math.cos(a) - b.depthMm / 2 * Math.sin(a), y: b.y + x * Math.sin(a) + b.depthMm / 2 * Math.cos(a) };
    return !peers.some((p) => p.id < b.id && p.construction.infill !== 'hedge' &&
      p.construction.postShape === b.construction.postShape && p.construction.postSizeMm === b.construction.postSizeMm &&
      p.construction.postMaterialId === b.construction.postMaterialId && p.construction.postColor === b.construction.postColor && p.heightMm === b.heightMm && p.elevationMm === b.elevationMm &&
      [0, p.widthMm].some((x) => { const q = endPoint(p, x); return Math.hypot(point.x - q.x, point.y - q.y) < .01; }));
  });
}
