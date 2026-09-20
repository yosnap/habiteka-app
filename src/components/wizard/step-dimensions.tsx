'use client';

/**
 * Smart Wizard — Paso 2: Dimensiones de la sala.
 * Sliders de ancho, largo y alto con toggle cm / pulgadas.
 * Preview 2D en tiempo real usando RoomShapePreview.
 */
import { useState } from 'react';
import { isValidShapeRoom } from '@/canvas/wizard/build-room-doc';
import { RoomShapePreview } from '@/components/canvas/wizard/room-shape-preview';
import type { ShapeState } from './step-shape';
import { buildParams } from './step-shape';

const MIN_M = 1.5;
const MAX_M = 12;
const MIN_H = 2;
const MAX_H = 4;
const MIN_CUT = 0.5;

function mToDisplay(m: number, useInch: boolean) {
  if (useInch) return Math.round(m * 39.3701);
  return Math.round(m * 100);
}

function displayToM(v: number, useInch: boolean) {
  if (useInch) return v / 39.3701;
  return v / 100;
}

interface Props {
  state: ShapeState;
  onChange: (s: Partial<ShapeState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepDimensions({ state, onChange, onBack, onNext }: Props) {
  const [useInch, setUseInch] = useState(false);
  const unit = useInch ? 'in' : 'cm';

  const params = buildParams(state);
  const valid = isValidShapeRoom({ shape: params, ceilingHeightM: state.ceilingM });

  function slider(
    label: string,
    value: number,
    setter: (m: number) => void,
    minM: number,
    maxM: number,
    accentClass = 'accent-brand-500',
  ) {
    const minD = mToDisplay(minM, useInch);
    const maxD = mToDisplay(maxM, useInch);
    const valD = mToDisplay(value, useInch);
    return (
      <label className="flex flex-col gap-1">
        <span className="text-ink-soft flex justify-between text-xs">
          <span>{label}</span>
          <span className="tabular-nums font-medium text-ink">
            {valD} {unit}
          </span>
        </span>
        <input
          type="range"
          min={minD}
          max={maxD}
          step={useInch ? 1 : 5}
          value={valD}
          onChange={(e) => setter(displayToM(parseInt(e.target.value, 10), useInch))}
          className={accentClass}
          aria-label={label}
        />
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-ink-soft mb-1 text-xs font-semibold uppercase tracking-wider">
          Paso 2 de 3 · Dimensiones
        </p>
        <h2 className="text-ink text-base font-semibold">¿Cuánto mide la sala?</h2>
      </div>

      {/* Toggle unidades */}
      <div className="flex items-center gap-2">
        <span className="text-ink-soft text-xs">Unidades:</span>
        <div className="flex overflow-hidden rounded-control border border-line text-xs">
          {(['cm', 'in'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUseInch(u === 'in')}
              className={
                'px-3 py-1 transition-colors ' +
                ((u === 'in') === useInch
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-soft hover:bg-surface-muted')
              }
            >
              {u === 'cm' ? 'cm' : 'pulgadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Preview + sliders */}
      <div className="flex gap-4">
        <RoomShapePreview
          params={params}
          label={`${mToDisplay(state.widthM, useInch)}×${mToDisplay(state.lengthM, useInch)} ${unit}`}
        />

        <div className="flex flex-1 flex-col gap-3">
          {slider('Ancho', state.widthM, (v) => onChange({ widthM: v }), MIN_M, MAX_M, 'accent-brand-500')}
          {slider('Largo', state.lengthM, (v) => onChange({ lengthM: v }), MIN_M, MAX_M, 'accent-brand-400')}
          {slider('Alto de techo', state.ceilingM, (v) => onChange({ ceilingM: v }), MIN_H, MAX_H)}

          {state.shape === 'l' && <>
            {slider('Recorte ancho', state.cutWidthM, (v) => onChange({ cutWidthM: v }), MIN_CUT, MAX_M)}
            {slider('Recorte largo', state.cutLengthM, (v) => onChange({ cutLengthM: v }), MIN_CUT, MAX_M)}
          </>}
          {state.shape === 'u' && <>
            {slider('Entrante ancho', state.notchWidthM, (v) => onChange({ notchWidthM: v }), MIN_CUT, MAX_M)}
            {slider('Entrante fondo', state.notchLengthM, (v) => onChange({ notchLengthM: v }), MIN_CUT, MAX_M)}
          </>}
          {state.shape === 't' && <>
            {slider('Barra largo', state.barLengthM, (v) => onChange({ barLengthM: v }), MIN_CUT, MAX_M)}
            {slider('Vástago ancho', state.stemWidthM, (v) => onChange({ stemWidthM: v }), MIN_CUT, MAX_M)}
          </>}
        </div>
      </div>

      {!valid && (
        <p className="rounded-control bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          Las medidas del recorte deben ser menores que el ancho y el largo de la sala.
        </p>
      )}

      {/* Botones */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-ink-soft hover:text-ink rounded-control px-3 py-1.5 text-sm"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className="rounded-control bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
