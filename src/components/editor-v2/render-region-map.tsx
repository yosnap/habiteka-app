'use client';

import type { EditorDocument } from '@/lib/editor-document/schema';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { footprint } from '@/canvas/editor-v2/spatial-placement';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';
import styles from './render-options-controls.module.css';

const path = (points: { x: number; y: number }[]) =>
  points.map((point) => `${point.x},${point.y}`).join(' ');

/** Capas del mini plano: muros y elementos construidos, sin interacción. */
export function RenderRegionMapLayers({ document }: { document?: EditorDocument }) {
  if (!document) return null;
  return (
    <>
      {document.walls
        .filter((wall) => !wall.hidden)
        .map((wall) => {
          const from = document.vertices.find((vertex) => vertex.id === wall.startVertexId);
          const to = document.vertices.find((vertex) => vertex.id === wall.endVertexId);
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
      {planObjects(document).map((item) => (
        <polygon key={item.id} points={path(footprint(item))} className={styles.furniture} />
      ))}
      {(document.stairs ?? []).map((item) => (
        <polygon key={item.id} points={path(footprint(item))} className={styles.stair} />
      ))}
      {(document.columns ?? []).map((item) => (
        <polygon key={item.id} points={path(footprint(item))} className={styles.column} />
      ))}
      {(document.ramps ?? []).flatMap((ramp) =>
        rampParts(ramp).map((part, index) => (
          <polygon
            key={`${ramp.id}-${part.kind}-${index}`}
            points={path(rampPartFootprint(ramp, part))}
            className={part.kind === 'landing' ? styles.landing : styles.ramp}
          />
        )),
      )}
    </>
  );
}

/** Encuadre del mini plano en milímetros del documento, con margen alrededor. */
export function planBounds(document?: EditorDocument) {
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
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX: minX - 500,
    minY: minY - 500,
    width: Math.max(1000, Math.max(...xs) - minX + 1000),
    height: Math.max(700, Math.max(...ys) - minY + 1000),
  };
}

export default RenderRegionMapLayers;
