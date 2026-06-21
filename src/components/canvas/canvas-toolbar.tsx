'use client';

/**
 * Barra de herramientas del canvas. Selecciona la herramienta activa y expone
 * deshacer/rehacer. Usa los componentes y tokens del design system; accesible
 * por teclado (los botones de shadcn ya gestionan foco y roles).
 */
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructKind } from '@/canvas/types';
import { isValidScale, formatObjectSize } from '@/canvas/scale';
import { ScaleControl } from './scale-control';

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
  const rotate90Action = useCanvasStore((s) => s.rotate90);
  const flipSelection = useCanvasStore((s) => s.flipSelection);
  const objects = useCanvasStore((s) => s.doc.objects);
  const docScale = useCanvasStore((s) => s.doc.scale);
  const baseImage = useCanvasStore((s) => s.doc.baseImage);
  const setBaseImage = useCanvasStore((s) => s.setBaseImage);
  const setBaseImageOpacity = useCanvasStore((s) => s.setBaseImageOpacity);
  const selectedIds = selection?.type === 'object' ? selection.objectIds : [];
  const selectedObjs = objects.filter((o) => selectedIds.includes(o.id));
  // Objeto de referencia para los campos numéricos (el primero de la selección).
  const ref0 = selectedObjs[0];
  const hasSel = selectedObjs.length > 0;
  // Con escala activa, mostramos las dimensiones reales junto a las de píxeles.
  const scale = isValidScale(docScale) ? docScale : null;
  const realSize = scale && ref0 ? formatObjectSize(ref0, scale) : null;

  // Rotar/voltear: la lógica de grupo (centro común) vive en el store.
  const rotate90 = () => rotate90Action(selectedIds);
  const flip = () => flipSelection(selectedIds);

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
      {/* Dimensiones reales (cm/m) cuando hay escala arquitectónica activa. */}
      {realSize ? (
        <span className="text-ink-soft text-xs" title="Medidas reales según la escala">
          ≈ {realSize}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasSel}
        onClick={() => removeObjects(selectedIds)}
      >
        Eliminar
      </Button>
      <ScaleControl />
      {/* Controles del fondo: solo cuando hay una imagen base (render aplicado). */}
      {baseImage ? (
        <>
          <span className="bg-border mx-1 h-5 w-px" aria-hidden />
          <label className="text-ink-soft flex items-center gap-1 text-xs">
            Fondo
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((baseImage.opacity ?? 1) * 100)}
              onChange={(e) => setBaseImageOpacity(Number(e.target.value) / 100)}
              className="w-20"
              aria-label="Opacidad del fondo"
              title="Opacidad del fondo"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setBaseImage(null)}
            title="Quitar la imagen de fondo del plano"
          >
            Quitar fondo
          </Button>
        </>
      ) : null}
    </div>
  );
}
