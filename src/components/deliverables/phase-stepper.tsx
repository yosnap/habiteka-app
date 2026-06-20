/**
 * Indicador de progreso de las cinco fases, con lenguaje de producto (sin jerga
 * interna). Refleja la fase actual del agente; los pasos futuros aparecen
 * atenuados. La fase de entrega solo se habilita cuando el servidor confirma que
 * el guard legal se cumple — el frontend solo refleja, no decide.
 */
import type { AgentPhase } from '@/lib/contracts';

const STEPS: Array<{ phase: AgentPhase; label: string }> = [
  { phase: 'ingesta', label: 'Sube tu espacio' },
  { phase: 'cualificacion', label: 'Cuéntanos' },
  { phase: 'entrega', label: 'Tus diseños' },
  { phase: 'feedback', label: 'Ajusta' },
  { phase: 'addons', label: 'Comparte' },
];

const ORDER: AgentPhase[] = ['ingesta', 'cualificacion', 'entrega', 'feedback', 'addons'];

interface Props {
  current: AgentPhase;
  /** El servidor (F5) indica si la entrega está permitida (guard legal OK). */
  deliveryUnlocked: boolean;
}

export function PhaseStepper({ current, deliveryUnlocked }: Props) {
  const currentIndex = ORDER.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Progreso del diseño">
      {STEPS.map((step, i) => {
        const isCurrent = step.phase === current;
        const isDone = i < currentIndex;
        const blocked = step.phase === 'entrega' && !deliveryUnlocked;
        return (
          <li
            key={step.phase}
            aria-current={isCurrent ? 'step' : undefined}
            className={[
              'rounded-[var(--radius-control)] px-3 py-1 text-sm',
              isCurrent ? 'bg-brand-500 text-white' : '',
              isDone ? 'text-ink' : '',
              !isCurrent && !isDone ? 'text-muted-foreground' : '',
              blocked ? 'opacity-50' : '',
            ].join(' ')}
          >
            {i + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
