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

const MODES: Array<{ tool: Tool; label: string }> = [
  { tool: 'select', label: 'Seleccionar' },
  { tool: 'freehand', label: 'Dibujar' },
  { tool: 'zone', label: 'Zona' },
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
  const removeObject = useCanvasStore((s) => s.removeObject);
  const selectedId = selection?.type === 'object' ? selection.objectId : null;

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
        disabled={!selectedId}
        onClick={() => selectedId && removeObject(selectedId)}
      >
        Eliminar
      </Button>
    </div>
  );
}
