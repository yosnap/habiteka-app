import type { FurnitureVolume } from './furniture-profiles';
import { type KitchenRun, type KitchenSlot, type KitchenSlotKind, isKitchenRun } from './kitchen-run-types';
import type { Furniture } from './schema';
import { localToWorld } from './spatial-properties';

export interface Span { from: number; to: number }
/** Tramos libres tras descontar un recorte; los que quedan vacíos desaparecen. */
export function subtractSpan(spans: Span[], cut: Span): Span[] {
  return spans.flatMap((span) => cut.to <= span.from || cut.from >= span.to ? [span]
    : [{ from: span.from, to: cut.from }, { from: cut.to, to: span.to }].filter((piece) => piece.to - piece.from > .01));
}
/** Módulos a ritmo fijo desde el inicio del tramo; un resto corto se suma al último módulo. */
export function moduleSpans(span: Span, widthMm: number): Span[] {
  const result: Span[] = [];
  for (let x = span.from; span.to - x > .01;) {
    let to = Math.min(span.to, x + widthMm);
    if (span.to - to < widthMm / 2) to = span.to;
    result.push({ from: x, to }); x = to;
  }
  return result;
}
/** Recortes longitudinales de cada capa del mueble; los huecos de aparatos y los extremos cedidos en esquina nacen aquí. */
export interface KitchenRunCuts { plinth: Span[]; base: Span[]; worktop: Span[]; uppers: Span[] }
export interface KitchenRunTrims { trimStartMm?: number; trimEndMm?: number }
const cutsBase = (kind: KitchenSlotKind) => kind === 'lavavajillas' || kind === 'lavadora' || kind === 'horno' || kind === 'frigorifico-columna';
export function kitchenRunCuts(run: KitchenRun, trims: KitchenRunTrims = {}): KitchenRunCuts {
  const whole = { from: trims.trimStartMm ?? 0, to: run.widthMm - (trims.trimEndMm ?? 0) };
  const cuts: KitchenRunCuts = { plinth: [whole], base: [whole], worktop: [whole], uppers: [whole] };
  if (whole.to - whole.from <= .01) return { plinth: [], base: [], worktop: [], uppers: [] };
  for (const slot of run.kitchen.slots) {
    const cut = slotSpan(slot);
    if (cutsBase(slot.kind)) cuts.base = subtractSpan(cuts.base, cut);
    if (slot.kind === 'frigorifico-columna') {
      cuts.plinth = subtractSpan(cuts.plinth, cut); cuts.worktop = subtractSpan(cuts.worktop, cut); cuts.uppers = subtractSpan(cuts.uppers, cut);
    }
  }
  return cuts;
}
export const slotSpan = (slot: KitchenSlot): Span => ({ from: slot.positionMm - slot.widthMm / 2, to: slot.positionMm + slot.widthMm / 2 });

const HARDWARE = '#434743', FRONT = 20, PROUD = 24, SEAM = 4, PLINTH_RECESS = 50;
/** Una sola fuente de geometría para planta, sólidos 3D, colisiones y navegación. Marco local: x a lo largo, y del muro (0) al frente. */
export function kitchenRunVolumes(run: KitchenRun, trims: KitchenRunTrims = {}): FurnitureVolume[] {
  const k = run.kitchen, d = run.depthMm, e = run.elevationMm, h = run.heightMm, cuts = kitchenRunCuts(run, trims);
  const plinthTop = k.plinthHeightMm, worktopBottom = h - k.worktopThicknessMm, parts: FurnitureVolume[] = [];
  const box = (x: number, y: number, widthMm: number, depthMm: number, bottom: number, top: number, color: string, extra: Partial<FurnitureVolume> = {}) => {
    if (widthMm <= .01 || depthMm <= .01 || top - bottom <= .01) return;
    parts.push({ x, y, widthMm, depthMm, bottom: e + bottom, top: e + top, color, ...extra });
  };
  // Carcasa corrida, un frente por módulo con junta y un tirador por frente; el mismo despiece sirve a bajos y altos.
  const cabinets = (span: Span, depth: number, bottom: number, top: number, color: string, materialId: string | undefined, handleZ: number) => {
    box(span.from, 0, span.to - span.from, depth - FRONT - PROUD, bottom, top, color, { materialId });
    for (const m of moduleSpans(span, k.moduleWidthMm)) {
      box(m.from + SEAM / 2, depth - FRONT - PROUD, m.to - m.from - SEAM, FRONT, bottom + SEAM / 2, top - SEAM / 2, color, { materialId });
      const handle = Math.min(180, (m.to - m.from) / 2);
      box((m.from + m.to - handle) / 2, depth - PROUD, handle, PROUD, handleZ, handleZ + 25, HARDWARE);
    }
  };
  for (const span of cuts.plinth) box(span.from, 0, span.to - span.from, d - PLINTH_RECESS, 0, plinthTop, k.plinthColor);
  for (const span of cuts.base) cabinets(span, d, plinthTop, worktopBottom, run.color, k.baseMaterialId, worktopBottom - 70);
  for (const span of cuts.worktop) box(span.from, 0, span.to - span.from, d, worktopBottom, h, k.worktopColor, { materialId: k.worktopMaterialId });
  const u = k.uppers;
  if (u) for (const span of cuts.uppers) cabinets(span, u.depthMm, u.bottomMm, u.bottomMm + u.heightMm, u.color, u.materialId, u.bottomMm + 40);
  const whole = { from: trims.trimStartMm ?? 0, to: run.widthMm - (trims.trimEndMm ?? 0) };
  for (const slot of k.slots) {
    if (slot.positionMm < whole.from || slot.positionMm > whole.to) continue;
    const s = slotSpan(slot), w = slot.widthMm, tag = { part: 'slot' as const, slotId: slot.id };
    switch (slot.kind) {
      case 'fregadero':
        box(s.from + 60, d * .15, w - 120, d * .7, h, h + 8, slot.color, tag);
        box(slot.positionMm - 20, 60, 40, 40, h, h + 280, '#9aa3a4', { ...tag, shape: 'cylinder' });
        break;
      case 'vitroceramica':
        box(s.from + 20, d * .12, w - 40, d * .76, h, h + 6, slot.color, tag);
        break;
      case 'lavavajillas':
      case 'lavadora':
      case 'horno': {
        box(s.from + 2, 0, w - 4, d - PROUD, plinthTop, worktopBottom, slot.color, tag);
        const middle = (plinthTop + worktopBottom) / 2;
        // Ventana del horno y ojo de buey de la lavadora: paneles oscuros ligeramente salientes sobre el frente.
        if (slot.kind === 'horno') box(s.from + 80, d - PROUD, w - 160, 2, plinthTop + 150, worktopBottom - 150, '#313d3e', tag);
        if (slot.kind === 'lavadora') box(slot.positionMm - 160, d - PROUD, 320, 2, middle - 160, middle + 160, '#313d3e', tag);
        box(s.from + 80, d - PROUD, w - 160, PROUD, worktopBottom - 70, worktopBottom - 45, HARDWARE, tag);
        break;
      }
      case 'frigorifico-columna': {
        const top = u ? u.bottomMm + u.heightMm : 2000;
        box(s.from + 2, 0, w - 4, d - PROUD, 0, top, slot.color, tag);
        box(s.to - 60, d - PROUD, 20, PROUD, top * .3, top * .85, HARDWARE, tag);
        break;
      }
    }
  }
  return parts;
}

const direction = (run: KitchenRun) => { const a = run.rotation * Math.PI / 180; return { x: Math.cos(a), y: Math.sin(a) }; };
const bodyNormal = (run: KitchenRun) => { const a = run.rotation * Math.PI / 180; return { x: -Math.sin(a), y: Math.cos(a) }; };
const backEnds = (run: KitchenRun) => [0, run.widthMm].map((x) => localToWorld(run, { x, y: 0 }));
const jointTolerance = (a: Furniture, b: Furniture) => Math.max(a.depthMm, b.depthMm) + 10;

/** Dos tramos que se encuentran por la línea trasera en ángulo comparten esquina: su solape no es una colisión. */
export function isKitchenJoint(a: Furniture, b: Furniture): boolean {
  if (!isKitchenRun(a) || !isKitchenRun(b) || a.id === b.id) return false;
  const ae = backEnds(a), be = backEnds(b), tolerance = jointTolerance(a, b), da = direction(a), db = direction(b);
  if (Math.abs(da.x * db.x + da.y * db.y) > Math.cos(Math.PI / 12)) return false;
  return ae.some((p) => be.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= tolerance));
}
/** En una esquina en L el tramo de id menor conserva el módulo de esquina; el otro cede el fondo del vecino. */
export function kitchenRunDisplayVolumes(run: KitchenRun, peers: KitchenRun[]): FurnitureVolume[] {
  const trims: Required<KitchenRunTrims> = { trimStartMm: 0, trimEndMm: 0 }, dir = direction(run);
  for (const end of [0, run.widthMm]) {
    const corner = localToWorld(run, { x: end, y: 0 }), sign = end === 0 ? 1 : -1;
    for (const peer of peers) {
      if (!(peer.id < run.id) || !isKitchenJoint(run, peer)) continue;
      if (!backEnds(peer).some((q) => Math.hypot(corner.x - q.x, corner.y - q.y) <= jointTolerance(run, peer))) continue;
      const n = bodyNormal(peer);
      if ((n.x * dir.x + n.y * dir.y) * sign < .5) continue;
      if (end === 0) trims.trimStartMm = Math.max(trims.trimStartMm, peer.depthMm); else trims.trimEndMm = Math.max(trims.trimEndMm, peer.depthMm);
    }
  }
  return kitchenRunVolumes(run, trims);
}
