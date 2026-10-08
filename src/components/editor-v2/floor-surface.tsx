'use client';
import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-konva';
import { Color } from 'three';
import type { FloorFinish, Point } from '@/lib/editor-document/schema';
import { createFloorPattern } from './floor-pattern';
import { surfaceMaterial, surfaceMaterialAppearance } from '@/lib/editor-document/surface-materials';

export function FloorSurface({ points, finish, selected, scale, onSelect, onMove, onSnapMove, referenceVisible = false, presentation = 'visual' }: {
  points: Point[]; finish: FloorFinish; selected: boolean; scale: number;
  presentation?: 'technical' | 'visual';
  onSelect?: (event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onMove?: (delta: Point, duplicate?: boolean) => void; onSnapMove?: (delta: Point) => Point; referenceVisible?: boolean;
}) {
  const duplicateDrag = useRef(false);
  const key = `${finish.texture}:${finish.color}`;
  const appearance = surfaceMaterialAppearance(finish.texture);
  const fillColor = appearance ? new Color(finish.color).multiply(new Color(appearance.baseColor)).getStyle() : finish.color;
  const [loaded, setLoaded] = useState<{ key: string; image: HTMLImageElement }>();
  const pattern = appearance?.useColorMap === false ? undefined : loaded?.key === key ? loaded.image : undefined;
  useEffect(() => {
    const asset = surfaceMaterial(finish.texture), canvas = createFloorPattern(finish);
    if (appearance?.useColorMap === false || (!canvas && !asset)) return;
    let active = true; const image = new Image();
    image.onload = () => { if (active) setLoaded({ key, image }); }; image.src = asset?.maps.color ?? canvas!.toDataURL();
    return () => { active = false; };
  }, [finish.color, finish.texture, appearance]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Line draggable={Boolean(onMove)} onDragStart={(event) => { duplicateDrag.current = event.evt.altKey; onSelect?.(); }} onDragMove={(event) => { if (onSnapMove) event.target.position(onSnapMove(event.target.position())); }}
    onDragEnd={(event) => { const delta = event.target.position(); event.target.position({ x: 0, y: 0 }); onMove?.(delta, duplicateDrag.current); duplicateDrag.current = false; }} points={points.flatMap((point) => [point.x, point.y])} closed fill={fillColor}
    opacity={referenceVisible ? 0.12 : presentation === 'technical' ? .48 : 1}
    fillPatternImage={pattern} fillPriority={pattern && finish.texture !== 'none' ? 'pattern' : 'color'}
    fillPatternScaleX={finish.tileSizeMm / (pattern?.width || 256)}
    fillPatternScaleY={finish.tileSizeMm * (surfaceMaterial(finish.texture) ? surfaceMaterial(finish.texture)!.sizeMm[1]! / surfaceMaterial(finish.texture)!.sizeMm[0]! : 1) / (pattern?.height || 256)}
    fillPatternRotation={finish.rotation} stroke={selected ? '#087f75' : undefined} strokeWidth={2 / scale}
    listening={Boolean(onSelect)} onClick={(e) => { e.cancelBubble = true; onSelect?.(e.evt as MouseEvent); }}
    onTap={(e) => { e.cancelBubble = true; onSelect?.(e.evt as TouchEvent); }} />;
}
