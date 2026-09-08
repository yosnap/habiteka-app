'use client';
import { useEffect, useState } from 'react';
import { Line } from 'react-konva';
import type { FloorFinish, Point } from '@/lib/editor-document/schema';
import { createFloorPattern } from './floor-pattern';

export function FloorSurface({ points, finish, selected, scale, onSelect }: {
  points: Point[]; finish: FloorFinish; selected: boolean; scale: number; onSelect?: () => void;
}) {
  const [pattern, setPattern] = useState<HTMLImageElement>();
  useEffect(() => {
    const canvas = createFloorPattern(finish); if (!canvas) return;
    let active = true; const image = new Image();
    image.onload = () => { if (active) setPattern(image); }; image.src = canvas.toDataURL();
    return () => { active = false; };
  }, [finish.color, finish.texture]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Line points={points.flatMap((p) => [p.x, p.y])} closed fill={finish.color}
    fillPatternImage={pattern} fillPriority={pattern && finish.texture !== 'none' ? 'pattern' : 'color'}
    fillPatternScaleX={finish.tileSizeMm / 256} fillPatternScaleY={finish.tileSizeMm / 256}
    fillPatternRotation={finish.rotation} stroke={selected ? '#087f75' : undefined} strokeWidth={2 / scale}
    listening={Boolean(onSelect)} onClick={(e) => { e.cancelBubble = true; onSelect?.(); }}
    onTap={(e) => { e.cancelBubble = true; onSelect?.(); }} />;
}
