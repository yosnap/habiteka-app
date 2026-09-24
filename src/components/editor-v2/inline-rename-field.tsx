'use client';
import { useState } from 'react';

/**
 * Renombrado en línea, sin diálogos nativos del navegador: se escribe el
 * nombre dentro del propio panel y se confirma con Aceptar o Intro; Esc y
 * Cancelar lo dejan como estaba.
 *
 * Quien lo usa decide cuándo montarlo (normalmente con el id que se está
 * renombrando), así el borrador arranca limpio en cada apertura.
 */
export function InlineRenameField({ label, value, maxLength = 80, disabled, onSubmit, onCancel }: {
  label: string;
  value: string;
  maxLength?: number;
  disabled?: boolean;
  /** Devuelve el nombre escrito; quien lo recibe decide si la operación cuajó. */
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const submit = () => { if (draft.trim()) onSubmit(draft.trim()); };
  return <div role="group" aria-label={label}>
    <input autoFocus value={draft} maxLength={maxLength} aria-label={label} disabled={disabled}
      autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); submit(); }
        else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      }} />
    <button type="button" disabled={disabled || !draft.trim()} onClick={submit}>Aceptar</button>
    <button type="button" onClick={onCancel}>Cancelar</button>
  </div>;
}

export default InlineRenameField;
