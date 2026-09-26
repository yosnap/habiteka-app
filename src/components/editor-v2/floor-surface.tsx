'use client';
import { useEffect, useState } from 'react';
import { Line } from 'react-konva';
import type { FloorFinish, Point } from '@/lib/editor-document/schema';
import { createFloorPattern } from './floor-pattern';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';

export function FloorSurface({ points, finish, selected, scale, onSelect, onMove, onSnapMove, referenceVisible = false, presentation = 'visual' }: {
  points: Point[]; finish: FloorFinish; selected: boolean; scale: number;
  presentation?: 'technical' | 'visual';
  onSelect?: (event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onMove?: (delta: Point) => void; onSnapMove?: (delta: Point) => Point; referenceVisible?: boolean;
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
  return <Line draggable={Boolean(onMove)} onDragStart={() => onSelect?.()} onDragMove={(event) => { if (onSnapMove) event.target.position(onSnapMove(event.target.position())); }}
    onDragEnd={(event) => { const delta = event.target.position(); event.target.position({ x: 0, y: 0 }); onMove?.(delta); }} points={points.flatMap((point) => [point.x, point.y])} closed fill={finish.color}
    opacity={referenceVisible ? 0.12 : presentation === 'technical' ? .48 : 1}
    fillPatternImage={pattern} fillPriority={pattern && finish.texture !== 'none' ? 'pattern' : 'color'}
    fillPatternScaleX={finish.tileSizeMm / (pattern?.width || 256)}
    fillPatternScaleY={finish.tileSizeMm * (surfaceMaterial(finish.texture) ? surfaceMaterial(finish.texture)!.sizeMm[1]! / surfaceMaterial(finish.texture)!.sizeMm[0]! : 1) / (pattern?.height || 256)}
    fillPatternRotation={finish.rotation} stroke={selected ? '#087f75' : undefined} strokeWidth={2 / scale}
    listening={Boolean(onSelect)} onClick={(e) => { e.cancelBubble = true; onSelect?.(e.evt as MouseEvent); }}
    onTap={(e) => { e.cancelBubble = true; onSelect?.(e.evt as TouchEvent); }} />;
}
