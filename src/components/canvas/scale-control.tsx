'use client';

/**
 * Control de escala arquitectónica del plano. Permite fijar la escala mediante
 * calibración por dimensión conocida ("el ancho de la sala es X m") y elegir un
 * ratio presentacional (1:50, 1:100…). La conversión real la gobierna
 * `pxPerMeter`; el ratio es solo metadato (ver `src/canvas/scale.ts`).
 *
 * Se separa de la toolbar para no inflarla: la escala es un concepto propio con
 * su pequeño formulario de calibración.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import { deriveScaleFromKnownLength } from '@/canvas/scale';

// Ratios arquitectónicos habituales ofrecidos como atajo presentacional.
const RATIOS = [50, 100, 200, 500, 1000] as const;

export function ScaleControl() {
  const scale = useCanvasStore((s) => s.doc.scale);
  const setScale = useCanvasStore((s) => s.setScale);
  const objects = useCanvasStore((s) => s.doc.objects);
  const selection = useCanvasStore((s) => s.doc.selection);

  const [open, setOpen] = useState(false);
  const [meters, setMeters] = useState('');

  // Para calibrar tomamos el ancho del objeto seleccionado como longitud de
  // referencia (el usuario indica a cuántos metros equivale).
  const selectedIds = selection?.type === 'object' ? selection.objectIds : [];
  const refObj = objects.find((o) => selectedIds.includes(o.id));
  const refWidthPx = refObj ? Math.round(refObj.width) : null;

  const calibrate = () => {
    if (refWidthPx === null) return;
    const m = Number(meters.replace(',', '.'));
    const next = deriveScaleFromKnownLength(refWidthPx, m, scale?.ratio);
    if (next) {
      setScale(next);
      setOpen(false);
      setMeters('');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <Button
        type="button"
        size="sm"
        variant={scale ? 'default' : 'ghost'}
        aria-pressed={!!scale}
        onClick={() => setOpen((v) => !v)}
        title="Escala arquitectónica del plano"
      >
        Escala{scale?.ratio ? ` 1:${scale.ratio}` : scale ? ' ✓' : ''}
      </Button>

      {open ? (
        <div className="border-line bg-surface flex flex-wrap items-center gap-2 rounded-control border p-2 text-xs">
          {/* Ratio presentacional. */}
          <label className="text-ink-soft flex items-center gap-1">
            Ratio
            <select
              value={scale?.ratio ?? ''}
              onChange={(e) => {
                const ratio = Number(e.target.value) || undefined;
                // El ratio es metadato presentacional y no existe sin una escala
                // calibrada (pxPerMeter es la fuente de verdad). Sin escala, elegir
                // ratio no hace nada: primero hay que calibrar.
                if (scale) setScale({ ...scale, ...(ratio ? { ratio } : {}) });
              }}
              className="border-line bg-surface rounded-control border px-1 py-0.5"
            >
              <option value="">—</option>
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  1:{r}
                </option>
              ))}
            </select>
          </label>

          {/* Calibración por dimensión conocida del objeto seleccionado. */}
          <label className="text-ink-soft flex items-center gap-1">
            {refObj ? `Ancho del objeto (${refWidthPx} px) =` : 'Selecciona un objeto para calibrar'}
            {refObj ? (
              <>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={meters}
                  onChange={(e) => setMeters(e.target.value)}
                  placeholder="m"
                  className="border-line bg-surface w-16 rounded-control border px-1 py-0.5"
                />
                m
              </>
            ) : null}
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!refObj || !meters}
            onClick={calibrate}
          >
            Calibrar
          </Button>
          {scale ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setScale(null)}>
              Quitar escala
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
