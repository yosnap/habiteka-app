'use client';

/**
 * Selector visual de estilo (galería de miniaturas realistas), estilo Planner5D.
 * Sustituye al `<select>` de texto: cada estilo es una tarjeta GRANDE con su foto y
 * nombre, en un carrusel con scroll horizontal (se ven ~2 por fila para apreciar el
 * diseño). La seleccionada se resalta. Compartido por los diálogos de generación y de
 * sugerencias de decoración (un solo sitio de verdad).
 */
import Image from 'next/image';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo } from '@/lib/contracts';

export function StyleGallery({
  value,
  onChange,
  disabled,
}: {
  value: Estilo;
  onChange: (estilo: Estilo) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Estilo"
      className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
    >
      {ESTILOS.map((s) => {
        const selected = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={s.label}
            disabled={disabled}
            onClick={() => onChange(s.value)}
            className={`w-[46%] shrink-0 snap-start overflow-hidden rounded-card border text-left transition disabled:opacity-50 ${
              selected ? 'border-accent ring-accent ring-2' : 'border-line hover:border-accent/60'
            }`}
          >
            <Image
              src={s.image}
              alt={`Estilo ${s.label}`}
              width={480}
              height={320}
              className="h-32 w-full object-cover"
            />
            <span
              className={`block px-2 py-1.5 text-sm ${
                selected ? 'text-accent font-semibold' : 'text-ink-soft'
              }`}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
