'use client';

/**
 * Paleta de objetos del catálogo, agrupados por categoría. Al pulsar un objeto se
 * arma la herramienta de creación correspondiente; el siguiente clic en el lienzo
 * lo coloca. Es el panel que responde a "¿cómo pongo un baño / una TV?".
 */
import { CATALOG } from '@/canvas/catalog';
import { cn } from '@/lib/utils';
import type { Tool } from './canvas-toolbar';

interface Props {
  tool: Tool;
  onPick: (tool: Tool) => void;
}

export function ObjectPalette({ tool, onPick }: Props) {
  return (
    <div className="border-line bg-surface w-44 shrink-0 overflow-y-auto border-r p-2">
      {CATALOG.map((cat) => (
        <div key={cat.id} className="mb-3">
          <p className="text-ink-soft mb-1 px-1 text-xs font-medium tracking-wide uppercase">
            {cat.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {cat.items.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => onPick(item.kind)}
                className={cn(
                  'rounded-[var(--radius-control)] px-2 py-1.5 text-left text-sm transition-colors',
                  tool === item.kind
                    ? 'bg-brand-500 text-white'
                    : 'text-ink hover:bg-surface-muted',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
