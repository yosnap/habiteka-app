'use client';

/**
 * Atajos de estilo: chips con los valores cerrados del enumerado. Elegir uno
 * envía la elección al agente, evitando que el usuario tenga que escribirlo y
 * garantizando que el valor sea válido.
 */
import { Button } from '@/components/ui/button';
import type { Estilo } from '@/lib/contracts';

const ESTILOS: Array<{ value: Estilo; label: string }> = [
  { value: 'moderno', label: 'Moderno' },
  { value: 'nordico', label: 'Nórdico' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'clasico', label: 'Clásico' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'rustico', label: 'Rústico' },
  { value: 'mediterraneo', label: 'Mediterráneo' },
];

export function StyleQuickPicks({ onPick }: { onPick: (estilo: Estilo) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Estilos sugeridos">
      {ESTILOS.map((e) => (
        <Button
          key={e.value}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPick(e.value)}
        >
          {e.label}
        </Button>
      ))}
    </div>
  );
}
