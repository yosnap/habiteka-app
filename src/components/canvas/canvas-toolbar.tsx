'use client';

/**
 * Barra de herramientas del canvas. Selecciona la herramienta activa y expone
 * deshacer/rehacer. Usa los componentes y tokens del design system; accesible
 * por teclado (los botones de shadcn ya gestionan foco y roles).
 */
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructKind } from '@/canvas/types';

// La herramienta activa: modos generales o la creación de un objeto del catálogo.
export type Tool = 'select' | 'freehand' | 'zone' | StructKind;

// Modos del editor de planos. La herramienta 'zone' existe en el modelo (se usa
// para el feedback dirigido sobre un render), pero no se expone aquí: en el editor
// manual confunde, ya que está pensada para marcar áreas sobre un diseño generado.
const MODES: Array<{ tool: Tool; label: string }> = [
  { tool: 'select', label: 'Seleccionar' },
  { tool: 'freehand', label: 'Dibujar' },
];

interface Props {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function CanvasToolbar({ tool, onToolChange }: Props) {
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const selection = useCanvasStore((s) => s.doc.selection);
  const removeObjects = useCanvasStore((s) => s.removeObjects);
  const updateObjects = useCanvasStore((s) => s.updateObjects);
  const objects = useCanvasStore((s) => s.doc.objects);
  const selectedIds = selection?.type === 'object' ? selection.objectIds : [];
  const selectedObjs = objects.filter((o) => selectedIds.includes(o.id));
  // Objeto de referencia para los campos numéricos (el primero de la selección).
  const ref0 = selectedObjs[0];
  const hasSel = selectedObjs.length > 0;

  // Rota los seleccionados 90° (cada uno desde su ángulo actual).
  const rotate90 = () => {
    for (const o of selectedObjs) updateObjects([o.id], { rotation: (o.rotation + 90) % 360 });
  };

  // Voltea horizontalmente (espejo) cada seleccionado.
  const flip = () => {
    for (const o of selectedObjs) updateObjects([o.id], { flipX: !o.flipX });
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Herramientas">
      {MODES.map(({ tool: t, label }) => (
        <Button
          key={t}
          type="button"
          size="sm"
          variant={tool === t ? 'default' : 'ghost'}
          aria-pressed={tool === t}
          onClick={() => onToolChange(t)}
        >
          {label}
        </Button>
      ))}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <Button type="button" size="sm" variant="ghost" disabled={!canUndo} onClick={undo}>
        Deshacer
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={!canRedo} onClick={redo}>
        Rehacer
      </Button>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasSel}
        onClick={rotate90}
        title="Girar 90° (p. ej. ventana en vertical)"
      >
        Girar 90°
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasSel}
        onClick={flip}
        title="Voltear horizontalmente (p. ej. puerta al otro lado)"
      >
        Voltear
      </Button>
      <label className="text-ink-soft flex items-center gap-1 text-xs">
        Ángulo
        <input
          type="number"
          min={0}
          max={359}
          step={1}
          disabled={!hasSel}
          value={ref0 ? Math.round(ref0.rotation) : ''}
          onChange={(e) => {
            if (!hasSel) return;
            const deg = ((Number(e.target.value) % 360) + 360) % 360;
            updateObjects(selectedIds, { rotation: deg });
          }}
          className="border-line bg-surface w-14 rounded-[var(--radius-control)] border px-1 py-0.5 text-xs disabled:opacity-50"
        />
        °
      </label>
      <label className="text-ink-soft flex items-center gap-1 text-xs">
        Ancho
        <input
          type="number"
          min={8}
          step={1}
          disabled={!hasSel}
          value={ref0 ? Math.round(ref0.width) : ''}
          onChange={(e) => {
            if (!hasSel) return;
            updateObjects(selectedIds, { width: Math.max(8, Number(e.target.value)) });
          }}
          className="border-line bg-surface w-16 rounded-[var(--radius-control)] border px-1 py-0.5 text-xs disabled:opacity-50"
        />
      </label>
      <label className="text-ink-soft flex items-center gap-1 text-xs">
        Alto
        <input
          type="number"
          min={8}
          step={1}
          disabled={!hasSel}
          value={ref0 ? Math.round(ref0.height) : ''}
          onChange={(e) => {
            if (!hasSel) return;
            updateObjects(selectedIds, { height: Math.max(8, Number(e.target.value)) });
          }}
          className="border-line bg-surface w-16 rounded-[var(--radius-control)] border px-1 py-0.5 text-xs disabled:opacity-50"
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasSel}
        onClick={() => removeObjects(selectedIds)}
      >
        Eliminar
      </Button>
    </div>
  );
}
