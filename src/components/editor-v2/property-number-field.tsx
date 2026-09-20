'use client';
import styles from './editor.module.css';
import { DecimalStepper } from './decimal-stepper';

export function NumberField({ label, value, change, step = 'any' }: { label: string; value: number; change: (value: number) => boolean | void; step?: number | 'any' }) {
  return <label className={styles.field}>{label}<DecimalStepper label={label} value={value} change={change} step={typeof step === 'number' ? step : 1} /></label>;
}

/** Presents document distances in metres while keeping millimetres in the document model. */
export function MeterField({ label, valueMm, change }: { label: string; valueMm: number; change: (valueMm: number) => boolean | void }) {
  return <NumberField label={`${label} (m)`} value={valueMm / 1000} step={.01} change={(valueM) => change(valueM * 1000)} />;
}
