'use client';

/**
 * Panel de catálogo para el overlay 3D: permite añadir muebles directamente desde
 * la vista 3D sin tener que volver al editor 2D. Excluye la categoría "estructura"
 * (muros, puertas, ventanas) porque no tiene sentido colocarlos desde 3D.
 *
 * Al hacer clic en un ítem llama a `onAdd(kind)` — el overlay se encarga de calcular
 * tamaños, posición inicial y activar el gizmo de mover.
 */
import { useState } from 'react';
import { CATALOG } from '@/canvas/catalog';
import type { StructKind } from '@/canvas/types';

const EXCLUDED = new Set(['estructura']);

/** Categorías visibles en el panel 3D (sin estructura). */
const CATEGORIES = CATALOG.filter((c) => !EXCLUDED.has(c.id));

export function CatalogPanel3D({ onAdd }: { onAdd: (kind: StructKind) => void }) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]?.id ?? '');

  const activeItems = CATEGORIES.find((c) => c.id === activeCat)?.items ?? [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir catálogo"
        className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 px-3 py-3 text-lg font-bold text-neutral-700 shadow-lg ring-1 ring-black/10 hover:bg-white"
      >
        +
      </button>
    );
  }

  return (
    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white/95 shadow-2xl ring-1 ring-black/10"
      style={{ maxHeight: '70vh', width: 200 }}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-600">Añadir elemento</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar catálogo"
          className="text-neutral-400 hover:text-neutral-700"
        >
          ✕
        </button>
      </div>

      {/* Tabs de categoría */}
      <div className="flex flex-wrap gap-1 border-b border-neutral-100 p-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCat(cat.id)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              activeCat === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Lista de ítems */}
      <div className="overflow-y-auto">
        {activeItems.map((item) => (
          <button
            key={item.kind}
            type="button"
            onClick={() => {
              onAdd(item.kind);
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-blue-50 hover:text-blue-700"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
