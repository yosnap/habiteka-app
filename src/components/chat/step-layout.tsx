'use client';

/**
 * Piezas compartidas por los pasos del asistente: el encabezado (número, título y
 * explicación) y la barra de navegación Atrás/Siguiente. Un solo sitio para que
 * todos los pasos se vean y se comporten igual.
 */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { stepTitle, type StepId } from './wizard-steps';
import type { AssistantIntent } from '@/lib/contracts';

export function StepHeading({
  step,
  intent = 'design',
  children,
}: {
  step: StepId;
  /** Ruta del asistente: decide el título del paso. */
  intent?: AssistantIntent;
  children: ReactNode;
}) {
  const title = stepTitle(intent, step);
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-ink text-base font-semibold">
        Paso {step} · {title}
      </h2>
      <p className="text-ink-soft text-sm">{children}</p>
    </header>
  );
}

export function StepNav({
  onBack,
  onNext,
  nextLabel = 'Siguiente',
  backLabel = 'Atrás',
  nextDisabled,
  disabled,
  hint,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  disabled?: boolean;
  /** Texto que explica por qué «Siguiente» está deshabilitado. */
  hint?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={disabled}>
            ← {backLabel}
          </Button>
        ) : (
          <span />
        )}
        {onNext ? (
          <Button type="button" onClick={onNext} disabled={disabled || nextDisabled}>
            {nextLabel}
          </Button>
        ) : null}
      </div>
      {hint && nextDisabled ? <p className="text-ink-soft text-right text-xs">{hint}</p> : null}
    </div>
  );
}
