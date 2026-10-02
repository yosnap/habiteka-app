'use client';
import { useId } from 'react';

/** The same precise control for camera zoom, placement and intervention dimensions. */
export function SiteAdjustmentControl({ label, value, min, max, step, unit, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  disabled?: boolean; onChange: (value: number) => void;
}) {
  const id = useId();
  const update = (next: number) => {
    const rounded = Number(Math.max(min, Math.min(max, next)).toFixed(2));
    if (Number.isFinite(rounded) && Math.abs(rounded - value) > .005) onChange(rounded);
  };
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-center rounded-md border bg-white px-2 focus-within:ring-2 focus-within:ring-brand-600">
        <input aria-label={`${label}: valor exacto`} type="number" min={min} max={max} step={step}
          className="w-16 bg-transparent py-1 text-right text-sm tabular-nums outline-none"
          key={value} defaultValue={Number(value.toFixed(2))} disabled={disabled}
          onBlur={e => {
            const next = Number.isFinite(e.target.valueAsNumber) ? Math.max(min, Math.min(max, e.target.valueAsNumber)) : value;
            update(next);
            e.target.value = String(Number(next.toFixed(2)));
          }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <span className="ml-1 text-xs text-ink-soft">{unit}</span>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button type="button" aria-label={`Reducir ${label.toLowerCase()}`} disabled={disabled || value <= min}
        className="h-7 w-7 shrink-0 rounded-md border bg-white hover:bg-stone-100" onClick={() => update(value - step)}>−</button>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        className="h-5 min-w-0 flex-1 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" onChange={e => update(Number(e.target.value))} />
      <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={disabled || value >= max}
        className="h-7 w-7 shrink-0 rounded-md border bg-white hover:bg-stone-100" onClick={() => update(value + step)}>+</button>
    </div>
  </div>;
}
