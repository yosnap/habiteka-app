'use client';

/**
 * Input numérico para los campos de medidas del plano (largo, fondo, ángulo,
 * altura…). A diferencia de un input controlado directo, mantiene el TEXTO que se
 * escribe mientras se edita, de modo que se puede borrar y teclear dígito a dígito
 * sin que un `Math.max`/clamp inmediato fuerce el valor (el bug de "no me deja
 * limpiar el campo"). El valor se confirma (con su mínimo/máximo) al salir del
 * campo (blur) o al pulsar Enter; al perder el foco se resincroniza con `value`.
 */
import { useState } from 'react';

interface Props {
  /** Valor numérico actual (del store). Vacío permitido con value = null. */
  value: number | null;
  /** Se llama con el número ya acotado al confirmar (blur/Enter). null = vacío. */
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** Permite vaciar el campo (commitea null) en vez de forzar un mínimo. */
  allowEmpty?: boolean;
  /** Unidad mostrada DENTRO del campo, pegada al número (p. ej. "m", "cm", "°"). */
  suffix?: string;
}

export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  placeholder,
  className,
  allowEmpty = false,
  suffix,
  'aria-label': ariaLabel,
}: Props) {
  // null = no se está editando; el input refleja `value`. string = edición libre.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));

  const commit = () => {
    if (draft === null) return; // no se editó
    const trimmed = draft.trim();
    if (trimmed === '') {
      onCommit(allowEmpty ? null : (min ?? null));
    } else {
      let n = Number(trimmed.replace(',', '.'));
      if (Number.isFinite(n)) {
        if (typeof min === 'number') n = Math.max(min, n);
        if (typeof max === 'number') n = Math.min(max, n);
        onCommit(n);
      }
    }
    setDraft(null); // volver a reflejar el valor confirmado
  };

  const input = (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={shown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      // Con sufijo, deja hueco a la derecha para que el número no lo pise.
      className={suffix ? `${className} pr-5` : className}
    />
  );
  if (!suffix) return input;
  return (
    <span className="relative inline-flex items-center">
      {input}
      <span
        className="text-ink-soft pointer-events-none absolute right-1 text-[10px]"
        aria-hidden
      >
        {suffix}
      </span>
    </span>
  );
}
