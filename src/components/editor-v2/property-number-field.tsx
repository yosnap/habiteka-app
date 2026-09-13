'use client';
import styles from './editor.module.css';
import { formatEditorDecimal, parseEditorDecimal } from './decimal-input';

export function NumberField({ label, value, change, step = 'any' }: { label: string; value: number; change: (value: number) => boolean | void; step?: number | 'any' }) {
  const commit = (input: HTMLInputElement, next: number) => {
    if (!Number.isFinite(next) || change(next) === false) input.value = formatEditorDecimal(value);
  };
  return <label className={styles.field}>{label}<input key={value} type="text" inputMode="decimal" data-step={step}
    defaultValue={formatEditorDecimal(value)} onBlur={(event) => {
      const next = parseEditorDecimal(event.currentTarget.value);
      commit(event.currentTarget, next);
    }} onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const increment = typeof step === 'number' ? step : 1;
      const current = parseEditorDecimal(event.currentTarget.value);
      commit(event.currentTarget, (Number.isFinite(current) ? current : value) + (event.key === 'ArrowUp' ? increment : -increment));
    }} /></label>;
}

/** Presents document distances in metres while keeping millimetres in the document model. */
export function MeterField({ label, valueMm, change }: { label: string; valueMm: number; change: (valueMm: number) => boolean | void }) {
  return <NumberField label={`${label} (m)`} value={valueMm / 1000} step={.01} change={(valueM) => change(valueM * 1000)} />;
}
