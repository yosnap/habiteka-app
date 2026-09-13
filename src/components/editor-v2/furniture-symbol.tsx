'use client';
import { Ellipse, Group, Line, Rect } from 'react-konva';
import type { Furniture } from '@/lib/editor-document/schema';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { catalogFurnitureVolumes } from '@/lib/editor-document/furniture-profiles';

/** Procedural solids in plan; GLB assets use category symbols within their envelope. */
export function FurnitureSymbol({ item, scale, selected }: { item: Furniture; scale: number; selected: boolean }) {
  const asset = furnitureAsset(item), round = asset && ['mesa', 'alfombra'].includes(asset.key);
  const parts = (asset ? catalogFurnitureVolumes(item) ?? furnitureVolumes(item) : furnitureVolumes(item)).toSorted((a, b) => a.top - b.top);
  return <Group>
    <Rect width={item.widthMm} height={item.depthMm} fill="rgba(0,0,0,0.001)" />
    {round ? <><Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm / 2} radiusY={item.depthMm / 2}
      fill={item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={1 / scale} listening={false} />
      <Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm * .4} radiusY={item.depthMm * .4}
        stroke="#59635c" strokeWidth={.6 / scale} listening={false} /></> : parts.map((part, index) => <Rect key={index} x={part.x} y={part.y} width={part.widthMm} height={part.depthMm}
      fill={part.color ?? item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={.7 / scale} listening={false} />)}
    {asset?.key === 'isla' && <Line points={[0, 0, item.widthMm, item.depthMm, item.widthMm, 0, 0, item.depthMm]}
      stroke="#59635c" strokeWidth={1 / scale} listening={false} />}
    {selected && <Rect width={item.widthMm} height={item.depthMm} stroke="#087f75" strokeWidth={2 / scale} listening={false} />}
  </Group>;
}
