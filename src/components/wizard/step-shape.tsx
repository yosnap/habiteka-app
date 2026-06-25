'use client';

/**
 * Smart Wizard — Paso 1: Forma de la sala.
 * El usuario elige una de las 4 formas disponibles y puede rotarla/voltearla.
 * El preview 2D en tiempo real usa `RoomShapePreview` (mismo que el wizard clásico).
 */
import type { RoomShape, RoomShapeParams } from '@/canvas/wizard/room-shapes';
import { RoomShapePreview } from '@/components/canvas/wizard/room-shape-preview';

const SHAPES: { id: RoomShape; label: string; icon: string }[] = [
  { id: 'rect', label: 'Rectangular', icon: '▭' },
  { id: 'l',    label: 'Forma L',     icon: '⌐' },
  { id: 'u',    label: 'Forma U',     icon: '⊔' },
  { id: 't',    label: 'Forma T',     icon: '⊤' },
];

export interface ShapeState {
  shape: RoomShape;
  widthM: number;
  lengthM: number;
  ceilingM: number;
  cutWidthM: number;
  cutLengthM: number;
  notchWidthM: number;
  notchLengthM: number;
  barLengthM: number;
  stemWidthM: number;
}

interface Props {
  state: ShapeState;
  onChange: (s: Partial<ShapeState>) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepShape({ state, onChange, onNext, onSkip }: Props) {
  const shapeParams: RoomShapeParams = buildParams(state);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-ink-soft mb-1 text-xs font-semibold uppercase tracking-wider">
          Paso 1 de 3 · Forma de la habitación
        </p>
        <h2 className="text-ink text-base font-semibold">¿Qué forma tiene la sala?</h2>
      </div>

      {/* Grid de formas */}
      <div className="grid grid-cols-4 gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange({ shape: s.id })}
            aria-pressed={state.shape === s.id}
            className={
              'flex flex-col items-center gap-1 rounded-lg border py-3 text-xs transition-colors ' +
              (state.shape === s.id
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line text-ink-soft hover:bg-surface-muted')
            }
          >
            <span className="text-xl leading-none">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Preview 2D */}
      <div className="flex justify-center">
        <RoomShapePreview
          params={shapeParams}
          label={`${state.widthM} × ${state.lengthM} m`}
        />
      </div>

      {/* Botones */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-ink-soft hover:text-ink rounded-control px-3 py-1.5 text-sm"
        >
          Dibujar a mano
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded-control bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}

export function buildParams(s: ShapeState): RoomShapeParams {
  switch (s.shape) {
    case 'rect': return { shape: 'rect', widthM: s.widthM, lengthM: s.lengthM };
    case 'l':    return { shape: 'l', widthM: s.widthM, lengthM: s.lengthM, cutWidthM: s.cutWidthM, cutLengthM: s.cutLengthM };
    case 'u':    return { shape: 'u', widthM: s.widthM, lengthM: s.lengthM, notchWidthM: s.notchWidthM, notchLengthM: s.notchLengthM };
    case 't':    return { shape: 't', widthM: s.widthM, lengthM: s.lengthM, barLengthM: s.barLengthM, stemWidthM: s.stemWidthM };
  }
}
