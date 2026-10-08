'use client';

import type { EditorDocument } from '@/lib/editor-document/schema';
import { RenderRegionMapLayers, planBounds } from './render-region-map';

/** Planta 2D sobre la que trabaja «Diseñar el plano»: se ve tal cual, sin pasar al 3D ni capturar nada. */
export function PlanPreview2d({ document }: { document?: EditorDocument }) {
  const bounds = planBounds(document);
  if (!bounds) return null;
  return (
    <figure className="bg-surface overflow-hidden rounded-card border border-line p-2">
      <svg viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} className="text-ink h-56 w-full"
        role="img" aria-label="Planta 2D que recibe la propuesta">
        <RenderRegionMapLayers document={document} />
      </svg>
      <figcaption className="text-muted-foreground mt-1 text-xs">Planta 2D · la propuesta trabaja sobre ella y no consume créditos</figcaption>
    </figure>
  );
}
