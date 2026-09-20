import type { Point, Stair } from '@/lib/editor-document/schema';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { pointOnSegment } from '@/lib/editor-document/geometry';
import { materialColor, meters, type SceneBox } from './types';

export function stairMeshes(stair: Stair): SceneBox[] {
  const layout = stairLayout(stair), angle = stair.rotation * Math.PI / 180, boxes: SceneBox[] = [];
  const add = (role: SceneBox['role'], x: number, y: number, z: number, width: number, depth: number, height: number) => {
    const centerX = x + width / 2, centerY = y + depth / 2;
    boxes.push({ id: `${stair.id}:${boxes.length}`, sourceEntityId: stair.id, role,
      position: [meters(stair.x + centerX * Math.cos(angle) - centerY * Math.sin(angle)),
        meters(stair.elevationMm + z + height / 2), meters(stair.y + centerX * Math.sin(angle) + centerY * Math.cos(angle))],
      size: [meters(width), meters(height), meters(depth)], rotation: -angle,
      color: role === 'rail' ? '#424d51' : stair.color ?? materialColor(stair.materialId),
      ...(role === 'rail' ? {} : { topMaterialId: stair.materialId }) });
  };
  for (const [role, parts] of [['step', layout.steps], ['landing', layout.landings]] as const) {
    for (const part of parts) {
      add(role, part.x, part.y, part.z, part.widthMm, part.depthMm, part.heightMm);
      const corners = [{ x: part.x, y: part.y }, { x: part.x + part.widthMm, y: part.y },
        { x: part.x + part.widthMm, y: part.y + part.depthMm }, { x: part.x, y: part.y + part.depthMm }];
      corners.forEach((a, index) => {
        const b = corners[(index + 1) % 4]!;
        const onOutline = layout.outline.some((from, i) => {
          const to = layout.outline[(i + 1) % layout.outline.length]!;
          return pointOnSegment(a, from, to) && pointOnSegment(b, from, to);
        });
        // Leave the entrance and final exit open; railings follow real concave exterior edges.
        const entry = near(a.y, stair.depthMm) && near(b.y, stair.depthMm);
        const exit = stair.kind === 'straight' ? near(a.y, 0) && near(b.y, 0)
          : stair.kind === 'L' && near(a.x, stair.widthMm) && near(b.x, stair.widthMm);
        if (!onOutline || entry || exit) return;
        if (stair.railingLeft === false && stair.railingRight === false) return;
        // En una escalera recta, los laterales se definen mirando hacia la subida.
        if (stair.kind === 'straight' && stair.railingLeft === false && near(a.x, 0) && near(b.x, 0)) return;
        if (stair.kind === 'straight' && stair.railingRight === false && near(a.x, stair.widthMm) && near(b.x, stair.widthMm)) return;
        const top = part.z + part.heightMm;
        const p: Point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        add('rail', p.x - 18, p.y - 18, top, 36, 36, 900);
        add('rail', Math.min(a.x, b.x) - 20, Math.min(a.y, b.y) - 20, top + 870,
          Math.abs(a.x - b.x) + 40, Math.abs(a.y - b.y) + 40, 40);
      });
    }
  }
  return boxes;
}
const near = (a: number, b: number) => Math.abs(a - b) < .001;
