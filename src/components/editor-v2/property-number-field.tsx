'use client';
import styles from './editor.module.css';

export function NumberField({ label, value, change, step = 'any' }: { label: string; value: number; change: (value: number) => boolean | void; step?: number | 'any' }) {
  return <label className={styles.field}>{label}<input key={value} type="number" step={step} inputMode="decimal"
    defaultValue={Math.round(value * 1000) / 1000} onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber;
      if (!Number.isFinite(next) || change(next) === false) event.currentTarget.value = String(value);
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

/** Presents document distances in metres while keeping millimetres in the document model. */
export function MeterField({ label, valueMm, change }: { label: string; valueMm: number; change: (valueMm: number) => boolean | void }) {
  return <NumberField label={`${label} (m)`} value={valueMm / 1000} step={.01} change={(valueM) => change(valueM * 1000)} />;
}
