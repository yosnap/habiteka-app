'use client';

/**
 * Panel de catálogo para el overlay 3D: pestañas por categoría, elementos
 * agrupados en familias y mostrados con miniatura + nombre.
 * Al hacer clic en un ítem llama a `onAdd(kind)`.
 */
import { useState, useEffect } from 'react';
import { CATALOG } from '@/canvas/catalog';
import type { StructKind } from '@/canvas/types';

const EXCLUDED_KINDS = new Set(['wall']);
const CATEGORIES = CATALOG
  .map((c) => ({ ...c, items: c.items.filter((it) => !EXCLUDED_KINDS.has(it.kind)) }))
  .filter((c) => c.items.length > 0);

/** Agrupa los ítems de una categoría por su campo `family`. */
function groupByFamily(items: (typeof CATEGORIES)[0]['items']) {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.family ?? 'Otros';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

export function CatalogPanel3D({ onAdd, swapMode }: { onAdd: (kind: StructKind) => void; swapMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]?.id ?? '');

  useEffect(() => { if (swapMode) setOpen(true); }, [swapMode]);

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

  const category = CATEGORIES.find((c) => c.id === activeCat);
  const families = groupByFamily(category?.items ?? []);

  return (
    <div
      className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white/95 shadow-2xl ring-1 ring-black/10"
      style={{ maxHeight: '78vh', width: 232 }}
    >
      {/* Cabecera */}
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className={`text-xs font-semibold ${swapMode ? 'text-blue-600' : 'text-neutral-600'}`}>
          {swapMode ? 'Reemplazar tipo' : 'Añadir elemento'}
        </span>
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
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-100 p-2">
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

      {/* Contenido con scroll: familias + grid de miniaturas */}
      <div className="overflow-y-auto p-2">
        {[...families.entries()].map(([familyName, items]) => (
          <div key={familyName} className="mb-3">
            {families.size > 1 && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                {familyName}
              </p>
            )}
            <div className="grid grid-cols-3 gap-1">
              {items.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => {
                    onAdd(item.kind);
                    setOpen(false);
                  }}
                  className="group flex flex-col items-center rounded-lg p-1 hover:bg-blue-50 transition-colors"
                  title={item.label}
                >
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={item.label}
                      className="h-16 w-16 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-neutral-100">
                      <span className="text-[10px] font-medium text-neutral-400 text-center leading-tight px-1">
                        {item.label}
                      </span>
                    </div>
                  )}
                  <span className="mt-0.5 text-center text-[10px] leading-tight text-neutral-600 group-hover:text-blue-700">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
