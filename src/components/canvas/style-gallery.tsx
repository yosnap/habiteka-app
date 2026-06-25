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
            className={`relative w-[46%] shrink-0 snap-start overflow-hidden rounded-card text-left transition disabled:opacity-50 ${
              selected
                ? 'ring-accent shadow-[var(--shadow-float)] ring-[3px]'
                : 'ring-line hover:ring-accent/50 opacity-80 ring-1 hover:opacity-100'
            }`}
          >
            <div className="relative">
              <Image
                src={s.image}
                alt={`Estilo ${s.label}`}
                width={480}
                height={320}
                className="h-32 w-full object-cover"
              />
              {/* Marca de selección clara en la esquina. */}
              {selected ? (
                <span className="bg-accent text-accent-foreground absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full shadow">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : null}
            </div>
            <span
              className={`block px-2 py-1.5 text-sm ${
                selected ? 'bg-accent text-accent-foreground font-semibold' : 'text-ink-soft bg-surface'
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
