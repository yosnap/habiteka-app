'use client';
import { useEffect, useState } from 'react';
import { Line } from 'react-konva';
import type { FloorFinish, Point } from '@/lib/editor-document/schema';
import { createFloorPattern } from './floor-pattern';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';

export function FloorSurface({ points, finish, selected, scale, onSelect }: {
  points: Point[]; finish: FloorFinish; selected: boolean; scale: number; onSelect?: () => void;
}) {
  const key = `${finish.texture}:${finish.color}`;
  const [loaded, setLoaded] = useState<{ key: string; image: HTMLImageElement }>();
  const pattern = loaded?.key === key ? loaded.image : undefined;
  useEffect(() => {
    const asset = surfaceMaterial(finish.texture), canvas = createFloorPattern(finish);
    if (!canvas && !asset) return;
    let active = true; const image = new Image();
    image.onload = () => { if (active) setLoaded({ key, image }); }; image.src = asset?.maps.color ?? canvas!.toDataURL();
    return () => { active = false; };
  }, [finish.color, finish.texture]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Line points={points.flatMap((p) => [p.x, p.y])} closed fill={finish.color}
    fillPatternImage={pattern} fillPriority={pattern && finish.texture !== 'none' ? 'pattern' : 'color'}
    fillPatternScaleX={finish.tileSizeMm / (pattern?.width || 256)}
    fillPatternScaleY={finish.tileSizeMm * (surfaceMaterial(finish.texture) ? surfaceMaterial(finish.texture)!.sizeMm[1]! / surfaceMaterial(finish.texture)!.sizeMm[0]! : 1) / (pattern?.height || 256)}
    fillPatternRotation={finish.rotation} stroke={selected ? '#087f75' : undefined} strokeWidth={2 / scale}
    listening={Boolean(onSelect)} onClick={(e) => { e.cancelBubble = true; onSelect?.(); }}
    onTap={(e) => { e.cancelBubble = true; onSelect?.(); }} />;
}
