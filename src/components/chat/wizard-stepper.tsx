'use client';

/**
 * Cabecera del asistente: seis pasos en columnas iguales, con el número encima del
 * título (ocupa menos y se lee en vertical) y una línea de progreso animada.
 * Cada paso completado o disponible es clicable; el asistente decide qué hace el
 * salto (a veces hay que retroceder también en el servidor).
 */
import { STEPS, type StepId } from './wizard-steps';

export function WizardStepper({
  current,
  isReachable,
  onSelect,
  disabled = false,
}: {
  current: StepId;
  isReachable: (step: StepId) => boolean;
  onSelect: (step: StepId) => void;
  disabled?: boolean;
}) {
  // La línea va del centro del primer círculo al del último: 5 tramos entre 6 pasos.
  const progress = ((current - 1) / (STEPS.length - 1)) * 100;

  return (
    <nav
      aria-label="Pasos del asistente"
      className="border-line bg-surface rounded-card border px-2 py-3"
    >
      <div className="relative">
        <span
          aria-hidden
          className="bg-line absolute top-4 right-[8.33%] left-[8.33%] h-0.5 rounded-full"
        />
        <span
          aria-hidden
          className="bg-brand-500 absolute top-4 left-[8.33%] h-0.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${(progress * (100 - 16.66)) / 100}%` }}
        />
        <ol className="relative grid grid-cols-6">
          {STEPS.map((s) => {
            const active = s.id === current;
            const done = s.id < current;
            const clickable = !active && !disabled && isReachable(s.id);
            return (
              <li key={s.id} className="relative flex justify-center">
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Paso ${s.id}: ${s.title}${done ? ' (completado)' : ''}`}
                  disabled={!clickable}
                  onClick={() => onSelect(s.id)}
                  className={`group flex w-full flex-col items-center gap-1.5 rounded-control px-1 text-center transition-colors ${
                    clickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`relative z-10 flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                      active
                        ? 'bg-brand-500 ring-brand-100 scale-110 text-white ring-4'
                        : done
                          ? 'bg-brand-500 text-white'
                          : 'border-line text-ink-soft border bg-white'
                    } ${clickable ? 'group-hover:ring-brand-100 group-hover:ring-4' : ''}`}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </span>
                  <span
                    className={`text-[11px] leading-tight transition-colors sm:text-xs ${
                      active ? 'text-ink font-semibold' : done ? 'text-ink' : 'text-ink-soft'
                    } ${clickable ? 'group-hover:text-brand-700 group-hover:underline' : ''}`}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
