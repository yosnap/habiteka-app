'use client';
import { planObjects } from '@/lib/editor-document/boundary-types';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import styles from './render-options-controls.module.css';
import { footprint } from '@/canvas/editor-v2/spatial-placement';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';

interface Props {
  document?: EditorDocument;
  regions: RenderDesignOptions['regions'];
  onChange: (regions: RenderDesignOptions['regions']) => void;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

/** Selector 2D: las zonas se guardan en milímetros del documento, nunca en píxeles de cámara. */
export function RenderRegionPicker({ document, regions, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [name, setName] = useState('Zona permitida');
  const svgRef = useRef<SVGSVGElement>(null);
  const bounds = getBounds(document);

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): Point | null => {
    if (!bounds) return null;
    const svg = svgRef.current;
    if (!svg) return null;
    const transform = svg.getScreenCTM();
    if (!transform) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    return { x: point.x + bounds.minX, y: point.y + bounds.minY };
  };
  const start = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ start: point, end: point });
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return;
    const point = pointFromEvent(event);
    if (point) setDraft({ ...draft, end: point });
  };
  const finish = () => {
    if (!draft || !bounds) return;
    const x1 = Math.min(draft.start.x, draft.end.x),
      x2 = Math.max(draft.start.x, draft.end.x);
    const y1 = Math.min(draft.start.y, draft.end.y),
      y2 = Math.max(draft.start.y, draft.end.y);
    setDraft(null);
    if (x2 - x1 < bounds.width * 0.02 || y2 - y1 < bounds.height * 0.02 || regions.length >= 12)
      return;
    onChange([
      ...regions,
      {
        id: crypto.randomUUID(),
        name: name.trim() || 'Zona permitida',
        polygon: [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
        ],
      },
    ]);
  };

  if (!bounds)
    return (
      <p className="text-muted-foreground rounded-control border border-line p-3 text-xs">
        Guarda un documento 2D válido para dibujar zonas con coordenadas reales.
      </p>
    );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          aria-label="Nombre de la nueva zona"
          className="border-line bg-surface min-w-0 flex-1 rounded-control border px-2 py-1.5 text-xs"
        />
        <span className="text-muted-foreground text-[11px]">Arrastra para marcar</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        className={`${styles.map} border-line bg-canvas w-full rounded-control border`}
        role="img"
        aria-label="Mapa 2D del documento para seleccionar zonas permitidas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => setDraft(null)}
      >
        <g transform={`translate(${-bounds.minX} ${-bounds.minY})`}>
          {(document?.walls ?? [])
            .filter((wall) => !wall.hidden)
            .map((wall) => {
              const from = document?.vertices.find((vertex) => vertex.id === wall.startVertexId);
              const to = document?.vertices.find((vertex) => vertex.id === wall.endVertexId);
              return from && to ? (
                <line
                  key={wall.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="currentColor"
                  strokeWidth={Math.max(18, wall.thicknessMm)}
                  strokeLinecap="round"
                  opacity=".55"
                />
              ) : null;
            })}
          {(document ? planObjects(document) : []).map((item) => (
            <polygon
              key={item.id}
              points={footprint(item)
                .map((point) => `${point.x},${point.y}`)
                .join(' ')}
              className={styles.furniture}
            />
          ))}
          {(document?.stairs ?? []).map((item) => (
            <polygon
              key={item.id}
              points={footprint(item)
                .map((point) => `${point.x},${point.y}`)
                .join(' ')}
              className={styles.stair}
            />
          ))}
          {(document?.columns ?? []).map((item) => (
            <polygon
              key={item.id}
              points={footprint(item)
                .map((point) => `${point.x},${point.y}`)
                .join(' ')}
              className={styles.column}
            />
          ))}
          {(document?.ramps ?? []).flatMap((ramp) =>
            rampParts(ramp).map((part, index) => (
              <polygon
                key={`${ramp.id}-${part.kind}-${index}`}
                points={rampPartFootprint(ramp, part)
                  .map((point) => `${point.x},${point.y}`)
                  .join(' ')}
                className={part.kind === 'landing' ? styles.landing : styles.ramp}
              />
            )),
          )}
          {regions.map((region) => (
            <polygon
              key={region.id}
              points={region.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
              className={styles.selected}
            />
          ))}
          {draft && (
            <rect
              x={Math.min(draft.start.x, draft.end.x)}
              y={Math.min(draft.start.y, draft.end.y)}
              width={Math.abs(draft.end.x - draft.start.x)}
              height={Math.abs(draft.end.y - draft.start.y)}
              className={styles.draft}
            />
          )}
        </g>
      </svg>
      {regions.length > 0 && (
        <div className="space-y-1">
          {regions.map((region) => (
            <div
              key={region.id}
              className="bg-canvas flex items-center justify-between rounded-control px-2 py-1 text-xs"
            >
              <span>{region.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(regions.filter((item) => item.id !== region.id))}
                className="text-destructive underline-offset-2 hover:underline"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBounds(document?: EditorDocument) {
  if (!document) return null;
  const points = (document.vertices ?? []).map(({ x, y }) => ({ x, y }));
  for (const item of [
    ...planObjects(document),
    ...(document.stairs ?? []),
    ...(document.columns ?? []),
  ])
    points.push(...footprint(item));
  for (const ramp of document.ramps ?? [])
    for (const part of rampParts(ramp)) points.push(...rampPartFootprint(ramp, part));
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x)),
    maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y)),
    maxY = Math.max(...points.map((point) => point.y));
  return {
    minX: minX - 500,
    minY: minY - 500,
    width: Math.max(1000, maxX - minX + 1000),
    height: Math.max(700, maxY - minY + 1000),
  };
}

export default RenderRegionPicker;
