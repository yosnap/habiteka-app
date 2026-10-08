'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Group, Layer, Line, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { exteriorRoofBaseFootprints } from '@/lib/editor-document/exterior-roof-footprint';
import { roofOpeningPoints, ROOF_OPENING_LABELS, type RoofOpening } from '@/lib/editor-document/roof-opening-types';
import type { RoofPlanTool } from './use-roof-plan-tool';
import { roofPlanFacets } from '@/lib/editor-document/roof-slope-cells';

function RoofOpeningNode({ opening, selected, scale, tool }: { opening: RoofOpening; selected: boolean; scale: number; tool: RoofPlanTool }) {
  const node = useRef<Konva.Group>(null), transformer = useRef<Konva.Transformer>(null);
  const outline = roofOpeningPoints({ ...opening, x: 0, y: 0, rotation: 0 });
  useEffect(() => { if (selected && node.current) transformer.current?.nodes([node.current]); }, [selected, opening]);
  const commit = () => {
    const group = node.current;
    if (!group) return;
    const value = { ...opening, x: group.x(), y: group.y(), widthMm: opening.widthMm * group.scaleX(), depthMm: opening.depthMm * group.scaleY(),
      rotation: ((group.rotation() % 360) + 360) % 360 };
    group.scale({ x: 1, y: 1 });
    if (!tool.update(value)) { group.position({ x: opening.x, y: opening.y }); group.rotation(opening.rotation); }
  };
  return <>
    <Group ref={node} x={opening.x} y={opening.y} rotation={opening.rotation} listening={!tool.placing} draggable={!tool.readOnly && !tool.placing}
      onPointerDown={event => { event.cancelBubble = true; tool.setSelectedId(opening.id); }}
      onDragEnd={event => { event.cancelBubble = true; commit(); }} onTransformEnd={commit}>
      <Line points={outline.flatMap(p => [p.x, p.y])} closed fill={opening.kind === 'chimney' ? '#b3816099' : '#84cddd99'} stroke={selected ? '#087f75' : opening.kind === 'roof-window' ? '#43494b' : '#298598'} strokeWidth={(opening.kind === 'roof-window' ? 5 : 2) / scale} />
      <Text text={ROOF_OPENING_LABELS[opening.kind]} x={10 / scale} y={10 / scale} width={Math.max(0, opening.widthMm - 20 / scale)}
        fontSize={11 / scale} fill="#13515d" listening={false} />
    </Group>
    {selected && !tool.readOnly && !tool.placing && <Transformer ref={transformer} ignoreStroke flipEnabled={false} keepRatio={false} rotateEnabled
      onPointerDown={event => { event.cancelBubble = true; }}
      boundBoxFunc={(old, next) => next.width < 200 * scale || next.height < 200 * scale ? old : next} />}
  </>;
}

export function RoofPlanLayer({ tool, scale, disabled }: { tool: RoofPlanTool; scale: number; disabled: boolean }) {
  const base = useMemo(() => { try { return exteriorRoofBaseFootprints(tool.doc); } catch { return []; } }, [tool.doc]);
  const facets = useMemo(() => { try { return roofPlanFacets(tool.doc); } catch { return []; } }, [tool.doc]);
  return <Layer listening={!disabled}>
    {base.flatMap((part, i) => part.rings.map((ring, j) => <Line key={`${i}:${j}`} points={ring.flatMap(p => [p.x, p.y])} closed listening={false}
      fill={part.glazing ? '#84cddd55' : j ? '#ffffff22' : '#6c777c22'} stroke={part.glazing ? '#298598' : '#5d696d'} strokeWidth={2 / scale} dash={part.glazing ? undefined : [8 / scale, 4 / scale]} />))}
    {facets.map((ring, i) => <Line key={`facet:${i}`} points={ring.flatMap(p => [p.x, p.y])} closed listening={false} stroke="#68767d" strokeWidth={1 / scale} dash={[5 / scale, 3 / scale]} />)}
    {tool.doc.exteriorRoof?.openings?.map(opening => <RoofOpeningNode key={opening.id} opening={opening} scale={scale} selected={tool.selectedId === opening.id} tool={tool} />)}
    {tool.preview && <Line points={roofOpeningPoints(tool.preview.opening).flatMap(p => [p.x, p.y])}
      closed fill={tool.preview.error ? '#ef444444' : '#84cddd66'} stroke={tool.preview.error ? '#dc2626' : '#087f75'} strokeWidth={2 / scale} listening={false} />}
  </Layer>;
}
