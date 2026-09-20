'use client';
import { Ellipse, Group, Line, Rect } from 'react-konva';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { catalogFurnitureVolumes, isPainted, type FurnitureVolume } from '@/lib/editor-document/furniture-profiles';

interface Props {
  item: Furniture; scale: number; selected: boolean; document?: EditorDocument;
  /** Pieza seleccionable que vive sobre un tramo lineal: puerta de cerramiento o aparato de cocina. */
  selectedPartId?: string;
  onPartSelect?: (id: string) => void;
  onPartMove?: (id: string, deltaX: number) => void;
  onPartSnap?: (id: string, deltaX: number) => number;
}
const partId = (part: FurnitureVolume) => part.gateId ?? part.slotId;
/** Procedural solids in plan; GLB assets use category symbols within their envelope. */
export function FurnitureSymbol({ item, scale, selected, document, selectedPartId, onPartSelect, onPartMove, onPartSnap }: Props) {
  const asset = furnitureAsset(item), round = asset && ['mesa', 'alfombra'].includes(asset.key);
  const volumes = (asset ? catalogFurnitureVolumes(item) ?? furnitureVolumes(item, document) : furnitureVolumes(item, document)).toSorted((a, b) => a.top - b.top);
  // Los aparatos encajados se dibujan encima aunque queden bajo la encimera: en planta deben verse y poder arrastrarse.
  const parts = [...volumes.filter((part) => !part.slotId), ...volumes.filter((part) => part.slotId)];
  // Un mueble pintado se ve pintado en planta: los acentos del perfil (encimera, cojines) solo se mantienen con el color de catálogo.
  const painted = isPainted(item);
  const partFill = (part: FurnitureVolume) => painted && !part.gateId && part.part !== 'post' ? item.color! : part.color ?? item.color ?? '#b7c5be';
  return <Group>
    <Rect width={item.widthMm} height={item.depthMm} fill="rgba(0,0,0,0.001)" />
    {round ? <><Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm / 2} radiusY={item.depthMm / 2}
      fill={item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={1 / scale} listening={false} />
      <Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm * .4} radiusY={item.depthMm * .4}
        stroke="#59635c" strokeWidth={.6 / scale} listening={false} /></> : parts.map((part, index) => {
      const id = partId(part), interactive = !!id && !!onPartSelect;
      if (part.shape === 'cylinder') return <Ellipse key={index} x={part.x + part.widthMm / 2} y={part.y + part.depthMm / 2} radiusX={part.widthMm / 2} radiusY={part.depthMm / 2} fill={partFill(part)} stroke="#59635c" strokeWidth={.7 / scale} listening={false} />;
      return <Rect key={index} x={part.x} y={part.y} width={part.widthMm} height={part.depthMm} rotation={part.rotation ?? 0}
        fill={id && id === selectedPartId ? '#43b6a0' : partFill(part)} stroke="#59635c" strokeWidth={.7 / scale} opacity={part.opacity ?? 1}
        draggable={!!id && !!onPartMove} onDragStart={(e) => { e.cancelBubble = true; if (id) onPartSelect?.(id); }}
        onDragMove={(e) => { e.cancelBubble = true; e.target.y(part.y); if (id && onPartSnap) e.target.x(part.x + onPartSnap(id, e.target.x() - part.x)); }}
        onDragEnd={(e) => { e.cancelBubble = true; const delta = e.target.x() - part.x; e.target.position({ x: part.x, y: part.y }); if (id) onPartMove?.(id, delta); }}
        listening={interactive} onClick={(e) => { if (id && onPartSelect) { e.cancelBubble = true; onPartSelect(id); } }}
        onTap={(e) => { if (id && onPartSelect) { e.cancelBubble = true; onPartSelect(id); } }} />;
    })}
    {asset?.key === 'isla' && <Line points={[0, 0, item.widthMm, item.depthMm, item.widthMm, 0, 0, item.depthMm]}
      stroke="#59635c" strokeWidth={1 / scale} listening={false} />}
    {selected && <Rect width={item.widthMm} height={item.depthMm} stroke="#087f75" strokeWidth={2 / scale} listening={false} />}
  </Group>;
}
