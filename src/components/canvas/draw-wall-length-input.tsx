'use client';

/**
 * Entrada de longitud exacta del muro en curso (F7.3). Aparece (overlay HTML sobre el
 * canvas) mientras se dibuja un muro: el usuario teclea los metros y Enter fija el muro a
 * esa longitud en la dirección actual. Estilo Planner5D/CAD. La longitud tecleada manda
 * sobre cualquier snap a rejilla.
 */
import { useState } from 'react';

export function DrawWallLengthInput({
  visible,
  onConfirm,
}: {
  visible: boolean;
  /** Confirma el muro con la longitud (en metros). */
  onConfirm: (lengthM: number) => void;
}) {
  const [value, setValue] = useState('');

  if (!visible) return null;

  const submit = () => {
    const m = parseFloat(value.replace(',', '.'));
    if (Number.isFinite(m) && m > 0) {
      onConfirm(m);
      setValue('');
    }
  };

  return (
    <div className="border-line bg-surface/95 absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1 rounded-control border px-2 py-1 shadow-sm">
      <span className="text-ink-soft text-xs">Largo del muro</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter fija el muro; evita que el atajo del editor lo capture.
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }
        }}
        placeholder="m"
        aria-label="Longitud del muro en metros"
        className="border-line text-ink w-16 rounded-control border px-1.5 py-0.5 text-sm tabular-nums"
      />
      <span className="text-ink-soft text-xs">m · Enter</span>
    </div>
  );
}
