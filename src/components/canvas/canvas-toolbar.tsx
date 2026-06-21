'use client';

/**
 * Barra de herramientas del canvas. Selecciona la herramienta activa y expone
 * deshacer/rehacer. Usa los componentes y tokens del design system; accesible
 * por teclado (los botones de shadcn ya gestionan foco y roles).
 */
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructKind } from '@/canvas/types';
import { isValidScale, pxToMeters, metersToPx } from '@/canvas/scale';
import { ScaleControl } from './scale-control';
import { LightControls } from './light-controls';
import { NumberInput } from './number-input';

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
  // Con escala activa, los inputs de medidas trabajan en METROS (lo intuitivo); sin
  // escala, en píxeles. Estos helpers convierten en cada sentido según haya escala.
  const scale = isValidScale(docScale) ? docScale : null;
  const unidad = scale ? 'm' : 'px';
  /** Valor a mostrar en el input para una dimensión en px del objeto. */
  const toInput = (px: number): number =>
    scale ? Math.round(pxToMeters(px, scale) * 100) / 100 : Math.round(px);
  /** Convierte lo que el usuario escribió (m o px) de vuelta a px del modelo. */
  const fromInput = (v: number): number => (scale ? Math.round(metersToPx(v, scale)) : Math.round(v));
  // Paso del input: fino en metros (1 cm), entero en píxeles.
  const stepDim = scale ? 0.01 : 1;
  // Etiqueta de cada input según la forma real: "Largo" = la dimensión MAYOR,
  // "Fondo" = la menor. Así un muro vertical (alto y delgado) etiqueta sus 3,6 m
  // como Largo y sus 15 cm como Fondo, no al revés. Cada input rotula SU dimensión.
  const widthIsLong = ref0 ? ref0.width >= ref0.height : true;
  const labelForWidth = widthIsLong ? 'Largo' : 'Fondo';
  const labelForHeight = widthIsLong ? 'Fondo' : 'Largo';

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
        <NumberInput
          min={0}
          max={359}
          disabled={!hasSel}
          value={ref0 ? Math.round(ref0.rotation) : null}
          onCommit={(v) => {
            if (!hasSel || v === null) return;
            const deg = ((v % 360) + 360) % 360;
            updateObjects(selectedIds, { rotation: deg });
          }}
          aria-label="Ángulo en grados"
          suffix="°"
          className="border-line bg-surface w-14 rounded-control border px-1 py-0.5 text-xs disabled:opacity-50"
        />
      </label>
      {/* En planta se miden dos dimensiones (vista cenital). Las etiquetas se
          asignan por tamaño: "Largo" = la dimensión mayor, "Fondo" = la menor, así
          un muro vertical no muestra su grosor como "Largo". La altura vertical es
          la 3ª dimensión y se edita aparte (campo Alto, en m). El input de width
          siempre escribe en width; solo cambia su rótulo según la forma. */}
      <label className="text-ink-soft flex items-center gap-1 text-xs" title="Dimensión vista en planta">
        {labelForWidth}
        <NumberInput
          min={scale ? 0.05 : 8}
          step={stepDim}
          disabled={!hasSel}
          value={ref0 ? toInput(ref0.width) : null}
          onCommit={(v) => {
            if (!hasSel || v === null) return;
            updateObjects(selectedIds, { width: Math.max(8, fromInput(v)) });
          }}
          aria-label="Dimensión a lo ancho"
          suffix={unidad}
          className="border-line bg-surface w-16 rounded-control border px-1 py-0.5 text-xs disabled:opacity-50"
        />
      </label>
      <label
        className="text-ink-soft flex items-center gap-1 text-xs"
        title="La otra dimensión en planta (en un muro, su grosor) — NO la altura"
      >
        {labelForHeight}
        <NumberInput
          min={scale ? 0.05 : 8}
          step={stepDim}
          disabled={!hasSel}
          value={ref0 ? toInput(ref0.height) : null}
          onCommit={(v) => {
            if (!hasSel || v === null) return;
            updateObjects(selectedIds, { height: Math.max(8, fromInput(v)) });
          }}
          aria-label="Dimensión a lo alto en planta"
          suffix={unidad}
          className="border-line bg-surface w-16 rounded-control border px-1 py-0.5 text-xs disabled:opacity-50"
        />
      </label>
      {/* Altura vertical REAL (3ª dimensión, en metros). Solo con escala activa. */}
      {scale ? (
        <label
          className="text-ink-soft flex items-center gap-1 text-xs"
          title="Altura vertical real en metros (la 3ª dimensión; vacío = altura típica)"
        >
          Alto
          <NumberInput
            min={0}
            step={0.1}
            disabled={!hasSel}
            value={ref0?.heightM ?? null}
            placeholder="auto"
            allowEmpty
            onCommit={(v) => {
              if (!hasSel) return;
              // Vaciar o 0 ⇒ sin altura propia (vuelve a la típica del elemento).
              updateObjects(selectedIds, { heightM: v && v > 0 ? v : undefined });
            }}
            aria-label="Altura vertical real en metros"
            suffix="m"
            className="border-line bg-surface w-14 rounded-control border px-1 py-0.5 text-xs disabled:opacity-50"
          />
        </label>
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
      <LightControls />
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
