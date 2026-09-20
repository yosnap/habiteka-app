'use client';

/**
 * Smart Wizard — flujo guiado en 3 pasos (estilo Planner5D).
 * Paso 1: forma de sala → Paso 2: dimensiones → Paso 3: tipo + estilo + preview 3D.
 * Entrega al workspace un CanvasDoc ya amueblado y listo para persistir.
 */
import { useState } from 'react';
import type { CanvasDoc } from '@/canvas/types';
import type { RoomType } from '@/canvas/wizard/room-types';
import type { ShapeState } from './step-shape';
import { StepShape } from './step-shape';
import { StepDimensions } from './step-dimensions';
import { StepStyle } from './step-style';

export type { RoomType };

interface Props {
  /** Llamado cuando el usuario completa el wizard; el doc ya está amueblado. */
  onComplete: (doc: CanvasDoc, roomType: RoomType) => void;
  /** El usuario elige dibujar a mano en lugar de usar el wizard. */
  onSkip: () => void;
}

const INITIAL_SHAPE: ShapeState = {
  shape:        'rect',
  widthM:       4,
  lengthM:      3,
  ceilingM:     2.5,
  cutWidthM:    1.5,
  cutLengthM:   1.5,
  notchWidthM:  1.5,
  notchLengthM: 1.5,
  barLengthM:   1.5,
  stemWidthM:   1.5,
};

export function SmartWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [shapeState, setShapeState] = useState<ShapeState>(INITIAL_SHAPE);

  function patchShape(patch: Partial<ShapeState>) {
    setShapeState((s) => ({ ...s, ...patch }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de sala"
      onKeyDown={(e) => e.key === 'Escape' && onSkip()}
    >
      {/* Fondo: clic fuera cierra */}
      <div
        className="absolute inset-0"
        onClick={onSkip}
        aria-hidden="true"
      />

      <div className="relative bg-surface w-full max-w-lg rounded-2xl border border-line p-5 shadow-xl">
        {/* Indicador de paso */}
        <div className="mb-4 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={
                'h-1 flex-1 rounded-full transition-colors ' +
                (i <= step ? 'bg-brand-500' : 'bg-surface-muted')
              }
            />
          ))}
        </div>

        {step === 0 && (
          <StepShape
            state={shapeState}
            onChange={patchShape}
            onNext={() => setStep(1)}
            onSkip={onSkip}
          />
        )}

        {step === 1 && (
          <StepDimensions
            state={shapeState}
            onChange={patchShape}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepStyle
            shapeState={shapeState}
            onBack={() => setStep(1)}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}
