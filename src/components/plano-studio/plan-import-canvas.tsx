'use client';
import { useMemo, useState, type PointerEvent } from 'react';
import type { PlanPoint, Plano2dPayload } from '@/lib/contracts';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { PlanImageViewer } from './plan-image-viewer';

export type PlanReviewSelection = { kind: 'door' | 'wall' | 'zone' | 'scale'; id: string } | null;
export function PlanImportCanvas({ plano, sourceFrame, imageUrl, overlay, opacity = .7, selected = null, onSelect, onMoveEndpoint }: {
  plano: Plano2dPayload; sourceFrame?: { width: number; height: number }; imageUrl?: string | null;
  overlay: boolean; opacity?: number; selected?: PlanReviewSelection;
  onSelect?: (selection: PlanReviewSelection) => void;
  onMoveEndpoint?: (wallId: string, endpoint: 'from' | 'to', point: PlanPoint) => void;
}) {
  const walls = useMemo(() => [...new Map(plano.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const))).values()], [plano]);
  const aligned = Boolean(overlay && imageUrl && sourceFrame);
  const frame = useMemo(() => {
    if (sourceFrame) return { minX: 0, minY: 0, ...sourceFrame };
    const points = plano.zones.flatMap(zone => zone.outline);
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const minX = Math.min(0, ...xs) - 500, minY = Math.min(0, ...ys) - 500;
    return { minX, minY, width: Math.max(1000, ...xs) - minX + 500, height: Math.max(1000, ...ys) - minY + 500 };
  }, [sourceFrame, plano]);
  const svg = useMemo(() => planoToSvg(plano, { viewBox: frame, stretchToFrame: true,
    showDimensions: !aligned, showAreas: false, showLabels: false, showDoorNumbers: true,
    theme: { background: 'transparent', floorFill: 'transparent', wallFill: aligned ? '#e11d48' : '#26221f',
      lineColor: aligned ? '#e11d48' : '#26221f', windowColor: '#2b7bbf' },
  }), [plano, frame, aligned]);
  const vectorUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const blank = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width / 10}" height="${frame.height / 10}"><rect width="100%" height="100%" fill="white"/></svg>`)}`;
  const doors = plano.zones.flatMap(zone => zone.apertures.filter(aperture => aperture.kind === 'puerta'));
  const [preview, setPreview] = useState<{ wallId: string; endpoint: 'from' | 'to'; point: PlanPoint } | null>(null);
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!preview) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    setPreview({ ...preview, point: { x: Math.round(point.x), y: Math.round(point.y) } });
  };
  const finish = () => {
    const pending = preview;
    setPreview(null);
    if (pending) onMoveEndpoint?.(pending.wallId, pending.endpoint, pending.point);
  };
  const startDrag = (event: PointerEvent<SVGCircleElement>, wallId: string, endpoint: 'from' | 'to', point: PlanPoint) => {
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    setPreview({ wallId, endpoint, point: { x: point.x, y: point.y } });
  };
  return <PlanImageViewer src={aligned ? imageUrl! : blank} alt={aligned ? 'Plano original para revisar' : 'Marco del plano revisado'}
    caption={onSelect ? 'Pulsa una puerta o un muro para editarlo. Mano desplaza la vista.' : undefined}
    overlay={<>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria, alineado al original. */}
      <img src={vectorUrl} alt="Geometría revisada" draggable={false} className="absolute inset-0 h-full w-full" style={{ opacity: aligned ? opacity : 1, pointerEvents: 'none' }} />
      <svg aria-label="Elementos del plano revisado" viewBox={`${frame.minX} ${frame.minY} ${frame.width} ${frame.height}`}
        preserveAspectRatio="none" className="absolute inset-0 h-full w-full" onPointerMove={move} onPointerUp={finish}
        onPointerCancel={() => setPreview(null)}>
        {selected?.kind === 'zone' && plano.zones.filter(zone => zone.id === selected.id).map(zone =>
          <polygon key={zone.id} points={zone.outline.map(point => `${point.x},${point.y}`).join(' ')}
            fill="#007f6d" fillOpacity={.15} stroke="#007f6d" strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
        {walls.map((wall, index) => {
          const active = selected?.kind === 'wall' && selected.id === wall.id;
          const from = active && preview?.endpoint === 'from' ? preview.point : wall.from;
          const to = active && preview?.endpoint === 'to' ? preview.point : wall.to;
          return <g key={wall.id}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={active ? '#007f6d' : 'transparent'}
              strokeWidth={active ? 4 : 14} vectorEffect="non-scaling-stroke" role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined} aria-label={`Seleccionar muro ${index + 1}`} style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onClick={() => onSelect?.({ kind: 'wall', id: wall.id })}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.({ kind: 'wall', id: wall.id }); } }} />
            {active && onMoveEndpoint && (['from', 'to'] as const).map(endpoint => <circle key={endpoint}
              cx={(endpoint === 'from' ? from : to).x} cy={(endpoint === 'from' ? from : to).y} r={100}
              fill="white" stroke="#007f6d" strokeWidth={3} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }}
              onPointerDown={event => startDrag(event, wall.id, endpoint, wall[endpoint])} />)}
          </g>;
        })}
        {doors.map((door, index) => {
          const wall = walls.find(item => item.id === door.wallId);
          if (!wall) return null;
          const x = wall.from.x + (wall.to.x - wall.from.x) * door.position;
          const y = wall.from.y + (wall.to.y - wall.from.y) * door.position;
          return <circle key={door.id} cx={x} cy={y} r={Math.max(160, door.widthMm * .22)} fill="transparent"
            stroke={selected?.kind === 'door' && selected.id === door.id ? '#007f6d' : 'transparent'} strokeWidth={4} vectorEffect="non-scaling-stroke"
            role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`Seleccionar puerta ${index + 1}`}
            style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.({ kind: 'door', id: door.id })}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.({ kind: 'door', id: door.id }); } }} />;
        })}
      </svg>
    </>} />;
}
