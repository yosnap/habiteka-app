'use client';
import { Ellipse, Group, Line, Rect } from 'react-konva';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { catalogFurnitureVolumes } from '@/lib/editor-document/furniture-profiles';

/** Procedural solids in plan; GLB assets use category symbols within their envelope. */
export function FurnitureSymbol({ item, scale, selected, document, selectedGateId, onGateSelect, onGateMove, onGateSnap }: { document?: EditorDocument; selectedGateId?: string; onGateSelect?: (id: string) => void; onGateMove?: (id: string, deltaX: number) => void; onGateSnap?: (id: string, deltaX: number) => number; item: Furniture; scale: number; selected: boolean }) {
  const asset = furnitureAsset(item), round = asset && ['mesa', 'alfombra'].includes(asset.key);
  const parts = (asset ? catalogFurnitureVolumes(item) ?? furnitureVolumes(item, document) : furnitureVolumes(item, document)).toSorted((a, b) => a.top - b.top);
  return <Group>
    <Rect width={item.widthMm} height={item.depthMm} fill="rgba(0,0,0,0.001)" />
    {round ? <><Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm / 2} radiusY={item.depthMm / 2}
      fill={item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={1 / scale} listening={false} />
      <Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm * .4} radiusY={item.depthMm * .4}
        stroke="#59635c" strokeWidth={.6 / scale} listening={false} /></> : parts.map((part, index) => part.shape === 'cylinder' ? <Ellipse key={index} x={part.x + part.widthMm / 2} y={part.y + part.depthMm / 2} radiusX={part.widthMm / 2} radiusY={part.depthMm / 2} fill={part.color ?? item.color} stroke="#59635c" strokeWidth={.7 / scale} listening={false} /> : <Rect key={index} x={part.x} y={part.y} width={part.widthMm} height={part.depthMm} rotation={part.rotation ?? 0}
      fill={part.gateId && part.gateId === selectedGateId ? '#43b6a0' : part.color ?? item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={.7 / scale}
      draggable={!!part.gateId && !!onGateMove} onDragStart={(e) => { e.cancelBubble = true; if (part.gateId) onGateSelect?.(part.gateId); }}
      onDragMove={(e) => { e.cancelBubble = true; e.target.y(part.y); if (part.gateId && onGateSnap) e.target.x(part.x + onGateSnap(part.gateId, e.target.x() - part.x)); }}
      onDragEnd={(e) => { e.cancelBubble = true; const delta = e.target.x() - part.x; e.target.position({ x: part.x, y: part.y }); if (part.gateId) onGateMove?.(part.gateId, delta); }}
      listening={!!part.gateId && !!onGateSelect} onClick={(e) => { if (part.gateId && onGateSelect) { e.cancelBubble = true; onGateSelect(part.gateId); } }}
      onTap={(e) => { if (part.gateId && onGateSelect) { e.cancelBubble = true; onGateSelect(part.gateId); } }} />)}
    {asset?.key === 'isla' && <Line points={[0, 0, item.widthMm, item.depthMm, item.widthMm, 0, 0, item.depthMm]}
      stroke="#59635c" strokeWidth={1 / scale} listening={false} />}
    {selected && <Rect width={item.widthMm} height={item.depthMm} stroke="#087f75" strokeWidth={2 / scale} listening={false} />}
  </Group>;
}
