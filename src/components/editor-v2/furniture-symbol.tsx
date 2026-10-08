'use client';
import { Ellipse, Group, Image as KonvaImage, Line, Rect } from 'react-konva';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { catalogFurnitureVolumes, isPainted, type FurnitureVolume } from '@/lib/editor-document/furniture-profiles';
import { useFurnitureTopView } from './furniture-top-view';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { isBoundary } from '@/lib/editor-document/boundary-types';
import { hedgeModelPieces } from '@/lib/editor-document/hedge-model-pieces';
import { porchPlanDepth } from '@/lib/editor-document/porch-volumes';

interface Props {
  item: Furniture; scale: number; selected: boolean; document?: EditorDocument; visual?: boolean;
  /** Pieza seleccionable que vive sobre un tramo lineal: puerta de cerramiento o aparato de cocina. */
  selectedPartId?: string;
  onPartSelect?: (id: string) => void;
  onPartMove?: (id: string, deltaX: number) => void;
  onPartSnap?: (id: string, deltaX: number) => number;
}
const partId = (part: FurnitureVolume) => part.gateId ?? part.slotId;
function lighten(color: string, amount: number) {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;
  const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}
/**
 * Procedural solids in plan. A piece with a 3D model is drawn with a realistic top view of that model (textures and
 * soft shadow) once it is rendered; until then, and for pieces without a model, the category symbol.
 */
export function FurnitureSymbol({ item, scale, selected, document, visual = false, selectedPartId, onPartSelect, onPartMove, onPartSnap }: Props) {
  const asset = furnitureAsset(item), round = asset && ['mesa', 'alfombra'].includes(asset.key);
  const volumes = (asset ? catalogFurnitureVolumes(item) ?? furnitureVolumes(item, document) : furnitureVolumes(item, document)).toSorted((a, b) => a.top - b.top);
  // Los tramos con piezas que se seleccionan y arrastran (cocina, cerramientos con puerta) siguen con sus volúmenes.
  const hedge = isBoundary(item) && item.construction.infill === 'hedge' ? item : null;
  const topView = useFurnitureTopView(furnitureModel(item) && (hedge || !volumes.some((part) => partId(part))) ? (hedge ? { ...item, widthMm: 1000 } : item) : null);
  if (topView && !hedge) return <Group>
    <KonvaImage image={topView} width={item.widthMm} height={porchPlanDepth(item)}
      shadowColor="#24362f" shadowBlur={10 / scale} shadowOffsetY={3 / scale} shadowOpacity={visual ? .28 : .18} />
    {selected && <Rect width={item.widthMm} height={item.depthMm} stroke="#087f75" strokeWidth={2 / scale} listening={false} />}
  </Group>;
  // Los aparatos encajados se dibujan encima aunque queden bajo la encimera: en planta deben verse y poder arrastrarse.
  const visibleVolumes = hedge && topView ? volumes.filter((part) => part.part !== 'foliage') : volumes;
  const parts = [...visibleVolumes.filter((part) => !part.slotId), ...visibleVolumes.filter((part) => part.slotId)];
  // Un mueble pintado se ve pintado en planta: los acentos del perfil (encimera, cojines) solo se mantienen con el color de catálogo.
  const painted = isPainted(item);
  const partFill = (part: FurnitureVolume) => painted && !part.gateId && part.part !== 'post' ? item.color! : part.color ?? item.color ?? '#b7c5be';
  const highest = Math.max(...parts.map((part) => part.top), 1);
  const finish = (part: FurnitureVolume) => visual ? lighten(partFill(part), .035 + .09 * part.top / highest) : partFill(part);
  const shadow = visual ? { shadowColor: '#24362f', shadowBlur: 11 / scale, shadowOffsetY: 3 / scale, shadowOpacity: .18 } : {};
  return <Group>
    <Rect width={item.widthMm} height={item.depthMm} fill="rgba(0,0,0,0.001)" />
    {round ? <><Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm / 2} radiusY={item.depthMm / 2}
      fill={visual ? lighten(item.color ?? '#b7c5be', .08) : item.color ?? '#b7c5be'} stroke="#59635c" strokeWidth={1 / scale} listening={false} {...shadow} />
      <Ellipse x={item.widthMm / 2} y={item.depthMm / 2} radiusX={item.widthMm * .4} radiusY={item.depthMm * .4}
        stroke="#59635c" strokeWidth={.6 / scale} listening={false} /></> : parts.map((part, index) => {
      const id = partId(part), interactive = !!id && !!onPartSelect;
      if (part.shape === 'cylinder' || part.shape === 'ellipsoid') return <Ellipse key={index} x={part.x + part.widthMm / 2} y={part.y + part.depthMm / 2} radiusX={part.widthMm / 2} radiusY={part.depthMm / 2} fill={finish(part)} stroke="#59635c" strokeWidth={.7 / scale} listening={false} {...shadow} />;
      return <Rect key={index} x={part.x} y={part.y} width={part.widthMm} height={part.depthMm} rotation={part.rotation ?? 0}
        cornerRadius={part.shape === 'rounded-box' ? Math.min(part.widthMm, part.depthMm, part.top - part.bottom) * .2 : 0}
        fill={id && id === selectedPartId ? '#43b6a0' : finish(part)} stroke="#59635c" strokeWidth={visual ? .55 / scale : .7 / scale} opacity={part.opacity ?? 1}
        {...(visual && part.top / highest > .4 ? shadow : {})}
        draggable={!!id && !!onPartMove} onDragStart={(e) => { e.cancelBubble = true; if (id) onPartSelect?.(id); }}
        onDragMove={(e) => { e.cancelBubble = true; e.target.y(part.y); if (id && onPartSnap) e.target.x(part.x + onPartSnap(id, e.target.x() - part.x)); }}
        onDragEnd={(e) => { e.cancelBubble = true; const delta = e.target.x() - part.x; e.target.position({ x: part.x, y: part.y }); if (id) onPartMove?.(id, delta); }}
        listening={interactive} onClick={(e) => { if (id && onPartSelect) { e.cancelBubble = true; onPartSelect(id); } }}
        onTap={(e) => { if (id && onPartSelect) { e.cancelBubble = true; onPartSelect(id); } }} />;
    })}
    {hedge && topView && hedgeModelPieces({ ...hedge, x: 0, y: 0, rotation: 0 }).map((piece) =>
      <KonvaImage key={piece.id} image={topView} x={piece.x} y={piece.y} width={piece.widthMm} height={piece.depthMm} listening={false} />)}
    {asset?.key === 'isla' && <Line points={[0, 0, item.widthMm, item.depthMm, item.widthMm, 0, 0, item.depthMm]}
      stroke="#59635c" strokeWidth={1 / scale} listening={false} />}
    {selected && <Rect width={item.widthMm} height={item.depthMm} stroke="#087f75" strokeWidth={2 / scale} listening={false} />}
  </Group>;
}
