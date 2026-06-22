'use client';

/**
 * Preview de coste antes de una acción generadora. Muestra el mensaje (gratis o
 * créditos) que decide la facturación y exige confirmación explícita antes de
 * disparar la acción: nunca se reserva crédito sin que el usuario confirme.
 */
import { Button } from '@/components/ui/button';
import { costPreviewMessage, type CostInputs } from './cost-preview-message';

interface Props {
  cost: CostInputs;
  onConfirm: () => void;
  pending?: boolean;
}

export function CostPreview({ cost, onConfirm, pending }: Props) {
  const preview = costPreviewMessage(cost);
  return (
    <div className="border-line bg-surface-muted flex items-center justify-between gap-3 rounded-control border p-3">
      <span className={preview.free ? 'text-[--color-success] text-sm' : 'text-ink text-sm'}>
        {preview.message}
      </span>
      <Button type="button" size="sm" onClick={onConfirm} disabled={pending}>
        {pending ? 'Generando…' : 'Confirmar'}
      </Button>
    </div>
  );
}
