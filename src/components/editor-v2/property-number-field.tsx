'use client';
import styles from './editor.module.css';

export function NumberField({ label, value, change }: { label: string; value: number; change: (value: number) => boolean | void }) {
  return <label className={styles.field}>{label}<input key={value} type="number" step="any" inputMode="decimal"
    defaultValue={Math.round(value * 100) / 100} onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber;
      if (!Number.isFinite(next) || change(next) === false) event.currentTarget.value = String(value);
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}
