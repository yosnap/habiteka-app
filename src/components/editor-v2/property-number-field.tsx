'use client';
import styles from './editor.module.css';
import { formatEditorDecimal, parseEditorDecimal } from './decimal-input';

export function NumberField({ label, value, change, step = 'any' }: { label: string; value: number; change: (value: number) => boolean | void; step?: number | 'any' }) {
  return <label className={styles.field}>{label}<input key={value} type="text" inputMode="decimal" data-step={step}
    defaultValue={formatEditorDecimal(value)} onBlur={(event) => {
      const next = parseEditorDecimal(event.currentTarget.value);
      if (!Number.isFinite(next) || change(next) === false) event.currentTarget.value = formatEditorDecimal(value);
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

/** Presents document distances in metres while keeping millimetres in the document model. */
export function MeterField({ label, valueMm, change }: { label: string; valueMm: number; change: (valueMm: number) => boolean | void }) {
  return <NumberField label={`${label} (m)`} value={valueMm / 1000} step={.01} change={(valueM) => change(valueM * 1000)} />;
}
