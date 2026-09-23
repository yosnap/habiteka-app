'use client';

/**
 * Cabecera del asistente: los pasos de la ruta elegida en columnas iguales, con el
 * número encima del título (ocupa menos y se lee en vertical) y una línea de
 * progreso animada. Cada paso completado o disponible es clicable; el asistente
 * decide qué hace el salto (a veces hay que retroceder también en el servidor).
 *
 * Los pasos llegan por props porque cada ruta tiene los suyos (seis para crear un
 * diseño, tres para convertir un plano).
 */
import { Button } from '@/components/ui/button';
import type { StepId, WizardStep } from './wizard-steps';

export function WizardStepper({
  steps,
  current,
  isReachable,
  onSelect,
  onChangeIntent,
  disabled = false,
}: {
  steps: ReadonlyArray<WizardStep>;
  current: StepId;
  isReachable: (step: StepId) => boolean;
  onSelect: (step: StepId) => void;
  /** Vuelve al paso 0 para elegir otra ruta. */
  onChangeIntent?: () => void;
  disabled?: boolean;
}) {
  // La línea va del centro del primer círculo al del último.
  const count = steps.length;
  const index = Math.max(0, steps.findIndex((s) => s.id === current));
  const progress = count > 1 ? (index / (count - 1)) * 100 : 0;
  // Mitad de una columna a cada lado: así la línea nace y muere en los círculos.
  const inset = 50 / count;

  return (
    <nav
      aria-label="Pasos del asistente"
      className="border-line bg-surface rounded-card border px-2 py-3"
    >
      <div className="relative">
        <span
          aria-hidden
          className="bg-line absolute top-4 h-0.5 rounded-full"
          style={{ left: `${inset}%`, right: `${inset}%` }}
        />
        <span
          aria-hidden
          className="bg-brand-500 absolute top-4 h-0.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ left: `${inset}%`, width: `${(progress * (100 - inset * 2)) / 100}%` }}
        />
        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {steps.map((s, i) => {
            const active = s.id === current;
            const done = s.id < current;
            const ordinal = i + 1;
            const clickable = !active && !disabled && isReachable(s.id);
            return (
              <li key={s.id} className="relative flex justify-center">
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Paso ${ordinal}: ${s.title}${done ? ' (completado)' : ''}`}
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
                      ordinal
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
      {onChangeIntent ? (
        <div className="mt-2 flex justify-center">
          <Button type="button" variant="ghost" size="sm" onClick={onChangeIntent} disabled={disabled}>
            ← Cambiar lo que quiero hacer
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
