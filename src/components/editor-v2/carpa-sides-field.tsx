'use client';

import { ModernSelect } from '@/components/ui/modern-select';
import type { Furniture } from '@/lib/editor-document/schema';

type RolledSides = NonNullable<Furniture['rolledSides']>;

export function CarpaSidesField({ value, onChange, className }: {
  value: Furniture['rolledSides'];
  onChange: (value: RolledSides) => void;
  className?: string;
}) {
  return <label className={className}>
    <span>Laterales de la carpa</span>
    <ModernSelect value={value ?? 'none'} onChange={(event) => onChange(event.target.value as RolledSides)}>
      <option value="none">Ambos desplegados</option>
      <option value="left">Izquierdo recogido</option>
      <option value="right">Derecho recogido</option>
      <option value="both">Ambos recogidos</option>
    </ModernSelect>
    <small>Izquierda y derecha mirando desde el frente abierto.</small>
  </label>;
}
