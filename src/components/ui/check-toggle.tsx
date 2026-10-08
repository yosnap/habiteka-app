'use client';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './check-toggle.module.css';

interface CheckToggleProps { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; ariaLabel?: string; disabled?: boolean; className?: string }

/** Casilla propia del proyecto: input nativo oculto para accesibilidad y caja dibujada con los colores de la marca. */
export function CheckToggle({ checked, onChange, label, ariaLabel, disabled, className }: CheckToggleProps) {
  return <label className={`${styles.toggle} ${className ?? ''}`} data-checked={checked || undefined} data-disabled={disabled || undefined}>
    <input type="checkbox" checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={(event) => onChange(event.target.checked)} />
    <span className={styles.box} aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
    <span className={styles.label}>{label}</span>
  </label>;
}
