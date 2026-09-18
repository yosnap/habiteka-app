'use client';
import { useRef, useState } from 'react';
import { formatEditorDecimal, parseEditorDecimal } from './decimal-input';
import styles from './decimal-stepper.module.css';

export function DecimalStepper({ value, change, step = 1, label, minimum = -Infinity }: {
  value: number; change: (value: number) => boolean | void; step?: number; label: string; minimum?: number;
}) {
  const [edit, setEdit] = useState({ base: value, text: formatEditorDecimal(value) });
  const draft = edit.base === value ? edit.text : formatEditorDecimal(value);
  const setDraft = (text: string) => setEdit({ base: value, text });
  const input = useRef<HTMLInputElement>(null);
  const commit = (next: number) => {
    if (!Number.isFinite(next) || next < minimum || change(next) === false) setDraft(formatEditorDecimal(value));
    else setDraft(formatEditorDecimal(next));
  };
  const increment = (direction: number) => {
    const parsed = parseEditorDecimal(draft);
    commit(Number(((Number.isFinite(parsed) ? parsed : value) + direction * step).toFixed(8)));
  };
  return <span className={styles.stepper}>
    <input ref={input} type="text" role="spinbutton" aria-label={label} aria-valuenow={value}
      aria-valuemin={Number.isFinite(minimum) ? minimum : undefined} inputMode="decimal" value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (parseEditorDecimal(draft) !== value) commit(parseEditorDecimal(draft)); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); increment(e.key === 'ArrowUp' ? 1 : -1); }
      }} />
    <span className={styles.buttons}>
      <button type="button" aria-label={`Aumentar ${label}`} onPointerDown={(e) => e.preventDefault()} onClick={() => { input.current?.focus(); increment(1); }}>▴</button>
      <button type="button" aria-label={`Disminuir ${label}`} onPointerDown={(e) => e.preventDefault()} onClick={() => { input.current?.focus(); increment(-1); }}>▾</button>
    </span>
  </span>;
}
