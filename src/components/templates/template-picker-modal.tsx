'use client';

/**
 * Modal "Empieza con una plantilla" — se muestra al crear un proyecto nuevo.
 * Las plantillas son builtin (generadas proceduralmente); sin BD ni renders aún.
 * El thumbnail usa RoomShapePreview SVG para mostrar la silueta del plano.
 */
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from '@/canvas/templates';
import { RoomShapePreview } from '@/components/canvas/wizard/room-shape-preview';

interface Props {
  projectName: string;
  onSelect: (template: BuiltinTemplate) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function TemplatePickerModal({ projectName, onSelect, onSkip, disabled }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Empieza con una plantilla"
    >
      <div className="bg-surface border-line w-full max-w-lg rounded-2xl border shadow-xl">
        {/* Header */}
        <div className="border-line border-b px-5 py-4">
          <h2 className="text-ink text-base font-semibold">
            Crear &ldquo;{projectName}&rdquo;
          </h2>
          <p className="text-ink-soft mt-0.5 text-sm">
            Empieza desde cero o elige una plantilla de sala.
          </p>
        </div>

        <div className="p-5">
          {/* Botón "desde cero" */}
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="border-line text-ink hover:bg-surface-muted mb-4 w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Lienzo en blanco — empezar desde cero
          </button>

          {/* Grid de plantillas */}
          <p className="text-ink-soft mb-2 text-xs font-semibold uppercase tracking-wider">
            Plantillas
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BUILTIN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl)}
                disabled={disabled}
                className="border-line hover:border-brand-400 hover:bg-brand-50 group flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-colors disabled:opacity-50"
              >
                {/* Miniatura SVG del contorno del plano */}
                <RoomShapePreview params={tpl.shapeParams} label="" />

                <div className="w-full">
                  <p className="text-ink text-xs font-medium leading-tight">
                    {tpl.label}
                  </p>
                  <p className="text-ink-soft mt-0.5 text-[10px] leading-tight">
                    {tpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
