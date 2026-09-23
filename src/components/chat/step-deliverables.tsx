'use client';

/**
 * Paso 4: qué quiere recibir el usuario. Tarjetas seleccionables (varias a la vez)
 * con icono, título y una explicación de qué es cada entregable y cuándo conviene.
 * Los títulos vienen de `ENTREGABLES` (catálogo único); aquí solo se explica.
 */
import { ENTREGABLES } from '@/lib/design-options';
import { StepHeading, StepNav } from './step-layout';
import type { DeliverableType } from '@/lib/contracts';

// `Record<DeliverableType, ...>` fuerza exhaustividad: un entregable nuevo sin
// explicación no compila.
const DETALLE: Record<DeliverableType, { icon: string; what: string; when: string }> = {
  render3d: {
    icon: '🖼️',
    what: 'Una imagen realista de tu espacio ya decorado con el estilo elegido.',
    when: 'Ideal para verlo y decidir. Es lo que más ayuda a imaginar el resultado.',
  },
  plano2d: {
    icon: '📐',
    what: 'La planta del espacio dibujada y acotada, con muros, puertas y ventanas.',
    when: 'Útil para medir, repartir el mobiliario o hablar con un instalador.',
  },
  memoria: {
    icon: '📋',
    what: 'Un listado de materiales y acabados propuestos (suelos, pintura, textiles…).',
    when: 'Práctico para presupuestar y comprar sin perder la idea del diseño.',
  },
};

interface Props {
  entregables: DeliverableType[];
  pending: boolean;
  onToggle: (value: DeliverableType) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepDeliverables({ entregables, pending, onToggle, onBack, onNext }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={4}>
        Marca todo lo que quieras; puedes elegir más de una cosa. Cada entregable se genera por
        separado y queda guardado en tu proyecto.
      </StepHeading>

      <div className="flex flex-col gap-2" role="group" aria-label="Entregables a generar">
        {ENTREGABLES.map((o) => {
          const d = DETALLE[o.value];
          const selected = entregables.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={pending}
              onClick={() => onToggle(o.value)}
              className={`rounded-card border p-3 text-left transition disabled:opacity-50 ${
                selected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-line bg-surface hover:border-brand-500/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  {d.icon}
                </span>
                <span className="text-ink text-sm font-semibold">{o.label}</span>
                {selected ? (
                  <span className="text-brand-700 ml-auto text-xs font-semibold">Elegido ✓</span>
                ) : null}
              </span>
              <span className="text-ink-soft mt-1 block text-xs">{d.what}</span>
              <span className="text-ink-soft block text-xs italic">{d.when}</span>
            </button>
          );
        })}
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        disabled={pending}
        nextDisabled={entregables.length === 0}
        hint="Elige al menos un entregable para continuar."
      />
    </div>
  );
}
