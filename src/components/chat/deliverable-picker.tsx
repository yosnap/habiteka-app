'use client';

/**
 * Selección de entregables: el usuario marca qué quiere recibir (plano, render,
 * memoria). Los valores son los del enumerado; la selección se envía al agente.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DeliverableType } from '@/lib/contracts';

const OPTIONS: Array<{ value: DeliverableType; label: string }> = [
  { value: 'plano2d', label: 'Plano 2D' },
  { value: 'render3d', label: 'Render 3D' },
  { value: 'memoria', label: 'Memoria de materiales' },
];

export function DeliverablePicker({
  onConfirm,
}: {
  onConfirm: (types: DeliverableType[]) => void;
}) {
  const [selected, setSelected] = useState<DeliverableType[]>([]);

  const toggle = (value: DeliverableType) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Entregables a generar">
      <div className="flex flex-wrap gap-1">
        {OPTIONS.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={selected.includes(o.value) ? 'default' : 'outline'}
            aria-pressed={selected.includes(o.value)}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={selected.length === 0}
        onClick={() => onConfirm(selected)}
      >
        Confirmar entregables
      </Button>
    </div>
  );
}
