'use client';

/**
 * Paleta de objetos del catálogo, agrupados por categoría. Al pulsar un objeto se
 * arma la herramienta de creación correspondiente; el siguiente clic en el lienzo
 * lo coloca. Es el panel que responde a "¿cómo pongo un baño / una TV?".
 */
import { useState } from 'react';
import { CATALOG } from '@/canvas/catalog';
import { searchCatalog } from '@/canvas/catalog-search';
import { cn } from '@/lib/utils';
import type { Tool } from './canvas-toolbar';

interface Props {
  tool: Tool;
  onPick: (tool: Tool) => void;
}

export function ObjectPalette({ tool, onPick }: Props) {
  const [query, setQuery] = useState('');

  // Los muros se crean con la herramienta "Dibujar muro" (línea con cota en vivo, F7),
  // no desde la paleta: se excluye 'wall' para no tener dos formas de crear el mismo kind.
  const base = CATALOG.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => item.kind !== 'wall'),
  })).filter((cat) => cat.items.length > 0);
  // Filtro por texto (nombre, categoría o sinónimo); estado DERIVADO del query.
  const categories = searchCatalog(base, query);

  return (
    <div className="border-line bg-surface w-44 shrink-0 overflow-y-auto border-r p-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar objeto…"
        aria-label="Buscar objeto en el catálogo"
        className="border-line bg-surface text-ink placeholder:text-ink-soft mb-2 w-full rounded-control border px-2 py-1 text-sm"
      />
      {categories.length === 0 ? (
        <p className="text-ink-soft px-1 py-2 text-xs">Sin resultados para “{query}”.</p>
      ) : null}
      {categories.map((cat) => (
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
                  'rounded-control px-2 py-1.5 text-left text-sm transition-colors',
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
