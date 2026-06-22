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
import { deriveScaleFromKnownLength, scaleFromRatio } from '@/canvas/scale';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { NumberInput } from './number-input';

// Ratios de INTERIORISMO/vivienda (no urbanismo): 1:50 es el estándar de planta
// de una estancia. Se evitan 1:500/1:1000 (parcela/urbanismo), que descuadran las
// medidas de una habitación.
const RATIOS = [20, 50, 100, 200] as const;
// Escala por defecto al activar (la habitual en planos de vivienda).
const DEFAULT_RATIO = 50;

export function ScaleControl() {
  const scale = useCanvasStore((s) => s.doc.scale);
  const setScale = useCanvasStore((s) => s.setScale);
  const ceilingHeightM = useCanvasStore((s) => s.doc.ceilingHeightM);
  const setCeilingHeight = useCanvasStore((s) => s.setCeilingHeight);
  const objects = useCanvasStore((s) => s.doc.objects);
  const selection = useCanvasStore((s) => s.doc.selection);

  const [open, setOpen] = useState(false);
  const [meters, setMeters] = useState('');

  // Para calibrar tomamos el ancho del objeto seleccionado como longitud de
  // referencia (el usuario indica a cuántos metros equivale).
  const selectedIds = selection?.type === 'object' ? selection.objectIds : [];
  const refObj = objects.find((o) => selectedIds.includes(o.id));
  const refWidthPx = refObj ? Math.round(refObj.width) : null;
  const refLabel = refObj ? (CATALOG_BY_KIND[refObj.kind]?.label ?? refObj.kind) : '';

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
        onClick={() => {
          // Al abrir el panel SIN escala, se activa con la escala de vivienda por
          // defecto (1:50), para no quedar vacío ni heredar valores raros.
          if (!open && !scale) setScale(scaleFromRatio(DEFAULT_RATIO));
          setOpen((v) => !v);
        }}
        title="Escala arquitectónica del plano"
      >
        Escala{scale?.ratio ? ` 1:${scale.ratio}` : scale ? ' ✓' : ''}
      </Button>

      {open ? (
        <div className="border-line bg-surface flex flex-wrap items-center gap-2 rounded-control border p-2 text-xs">
          {/* Ratio: fija la escala AL INSTANTE (sin necesidad de calibrar). */}
          <label className="text-ink-soft flex items-center gap-1">
            Ratio
            <select
              value={scale?.ratio ?? ''}
              onChange={(e) => {
                const ratio = Number(e.target.value);
                // Elegir un ratio fija una escala usable de inmediato; "—" la quita.
                setScale(ratio ? scaleFromRatio(ratio) : null);
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

          {/* Altura de techo del plano (3ª dimensión). Solo útil con escala. */}
          {scale ? (
            <label className="text-ink-soft flex items-center gap-1">
              Altura de techo
              <NumberInput
                min={0}
                step={0.1}
                value={ceilingHeightM ?? null}
                placeholder="2.5"
                allowEmpty
                onCommit={(v) => setCeilingHeight(v && v > 0 ? v : null)}
                aria-label="Altura de techo en metros"
                className="border-line bg-surface w-16 rounded-control border px-1 py-0.5"
              />
              m
            </label>
          ) : null}

          {/* Ajuste fino OPCIONAL: calibrar con un objeto seleccionado. */}
          <label className="text-ink-soft flex items-center gap-1">
            {refObj
              ? `Afinar: ancho de "${refLabel}" (${refWidthPx} px) =`
              : 'Para afinar, selecciona un objeto'}
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!meters}
                  onClick={calibrate}
                >
                  Calibrar
                </Button>
              </>
            ) : null}
          </label>
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
