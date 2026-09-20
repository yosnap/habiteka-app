'use client';

/**
 * Panel lateral del catálogo (F1). Divide el catálogo en dos secciones:
 *
 *  CONSTRUIR  — Asistente de sala, Dibujar muros, Puertas, Ventanas.
 *  AMUEBLAR   — Categorías con tabs + familias + grid de miniaturas.
 *               Mezcla builtin (catalog.ts) + items custom/store de la org (API).
 *
 * Reemplaza al `ObjectPalette` anterior. Mantiene el mismo contrato:
 * `onPick(tool)` activa la herramienta de creación del canvas.
 */
import { useState } from 'react';
import { CATALOG } from '@/canvas/catalog';
import { searchCatalog } from '@/canvas/catalog-search';
import { cn } from '@/lib/utils';
import type { Tool } from '@/components/canvas/canvas-toolbar';
import { UploadItemModal } from './upload-item-modal';
import { useCatalogItems, type ApiCatalogItem } from './use-catalog-items';

// Ítems estructurales que van en la sección Construir (wall usa botón propio).
const STRUCTURAL_ITEMS =
  CATALOG.find((c) => c.id === 'estructura')?.items.filter((it) => it.kind !== 'wall') ?? [];

// Categorías de la sección Amueblar (todo menos estructura).
const AMUEBLAR = CATALOG.filter((c) => c.id !== 'estructura');

/** Agrupa ítems de una categoría por su campo `family`. */
function groupByFamily(items: (typeof AMUEBLAR)[0]['items']) {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.family ?? 'Varios';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

/** Botón de herramienta compacto para la sección Construir. */
function BuildButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-control w-full px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-brand-500 text-white' : 'text-ink hover:bg-surface-muted',
      )}
    >
      {label}
    </button>
  );
}

/** Tarjeta de ítem del catálogo con miniatura y nombre. Soporta drag al canvas. */
function ItemCard({
  item,
  active,
  onClick,
}: {
  item: { kind: string; label: string; thumbnailUrl?: string; widthM?: number; depthM?: number };
  active: boolean;
  onClick: () => void;
}) {
  function handleDragStart(e: React.DragEvent<HTMLButtonElement>) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'text/catalog',
      JSON.stringify({ kind: item.kind, widthM: item.widthM, depthM: item.depthM }),
    );
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      title={`${item.label} — arrastra al plano`}
      className={cn(
        'group flex flex-col items-center rounded-lg p-1 transition-colors',
        active ? 'bg-brand-50 ring-1 ring-brand-400' : 'hover:bg-surface-muted',
      )}
    >
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl}
          alt={item.label}
          className="h-14 w-14 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded bg-surface-muted">
          <span className="px-1 text-center text-[10px] leading-tight text-ink-soft">
            {item.label}
          </span>
        </div>
      )}
      <span
        className={cn(
          'mt-0.5 text-center text-[10px] leading-tight',
          active ? 'font-medium text-brand-700' : 'text-ink-soft group-hover:text-ink',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  tool: Tool;
  onPick: (tool: Tool) => void;
  /** Abre el asistente de diseño guiado (DesignWizard). */
  onOpenWizard: () => void;
}

export function CatalogSidebar({ tool, onPick, onOpenWizard }: Props) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(AMUEBLAR[0]?.id ?? '');
  const [showUpload, setShowUpload] = useState(false);

  // Items custom/store de la org para la categoría activa.
  const { items: apiItems, reload: reloadApi } = useCatalogItems(activeCat);

  const isSearching = query.trim().length > 0;

  // Búsqueda flat sobre todas las categorías de Amueblar.
  const searchResults = isSearching ? searchCatalog(AMUEBLAR, query) : [];
  const matchingItems = searchResults.flatMap((c) => c.items);

  const activeCatData = AMUEBLAR.find((c) => c.id === activeCat);
  // Items builtin agrupados por familia.
  const families = groupByFamily(activeCatData?.items ?? []);
  // Items custom/store agrupados por familia (se añaden tras los builtin).
  const customByFamily = new Map<string, ApiCatalogItem[]>();
  for (const it of apiItems) {
    const key = it.family ?? 'Varios';
    if (!customByFamily.has(key)) customByFamily.set(key, []);
    customByFamily.get(key)!.push(it);
  }

  return (
    <div className="border-line bg-surface flex w-52 shrink-0 flex-col overflow-hidden border-r">

      {/* Buscador */}
      <div className="border-line shrink-0 border-b p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar elemento…"
          aria-label="Buscar elemento en el catálogo"
          className="border-line bg-surface text-ink placeholder:text-ink-soft w-full rounded-control border px-2 py-1 text-sm"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isSearching ? (
          /* ── Resultados de búsqueda ────────────────────────────────── */
          matchingItems.length === 0 ? (
            <p className="text-ink-soft px-3 py-4 text-xs">
              Sin resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-2">
              {matchingItems.map((item) => (
                <ItemCard
                  key={item.kind}
                  item={item}
                  active={tool === item.kind}
                  onClick={() => onPick(item.kind as Tool)}
                />
              ))}
            </div>
          )
        ) : (
          <>
            {/* ── Sección CONSTRUIR ───────────────────────────────────── */}
            <section className="border-line border-b px-2 pb-2 pt-1">
              <p className="text-ink-soft mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider">
                Construir
              </p>
              <button
                type="button"
                onClick={onOpenWizard}
                className="border-line mb-1 w-full rounded-control border bg-brand-500 px-2 py-1.5 text-left text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                ✦ Asistente de sala
              </button>
              <BuildButton
                label="Dibujar muros"
                active={tool === 'draw-wall'}
                onClick={() => onPick('draw-wall')}
              />
              {STRUCTURAL_ITEMS.map((item) => (
                <BuildButton
                  key={item.kind}
                  label={item.label}
                  active={tool === item.kind}
                  onClick={() => onPick(item.kind as Tool)}
                />
              ))}
            </section>

            {/* ── Sección AMUEBLAR ───────────────────────────────────── */}
            <section>
              <p className="text-ink-soft mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider">
                Amueblar
              </p>

              {/* Tabs de categoría */}
              <div className="flex flex-wrap gap-1 px-2 pb-2">
                {AMUEBLAR.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCat(cat.id)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                      activeCat === cat.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-muted text-ink-soft hover:bg-surface-hover',
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Grid de miniaturas agrupado por familia — builtin primero */}
              <div className="px-2 pb-2">
                {[...families.entries()].map(([familyName, items]) => (
                  <div key={familyName} className="mb-3">
                    {families.size > 1 && (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                        {familyName}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      {items.map((item) => (
                        <ItemCard
                          key={item.kind}
                          item={item}
                          active={tool === item.kind}
                          onClick={() => onPick(item.kind as Tool)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Items custom/store de la org */}
                {[...customByFamily.entries()].map(([familyName, items]) => (
                  <div key={`custom-${familyName}`} className="mb-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                      {familyName} · custom
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {items.map((item) => (
                        <ItemCard
                          key={item.kind}
                          item={{
                            kind: item.kind,
                            label: item.label,
                            thumbnailUrl: item.thumbnailUrl ?? undefined,
                            widthM: item.widthM,
                            depthM: item.depthM,
                          }}
                          active={tool === item.kind}
                          onClick={() => onPick(item.kind as Tool)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón añadir elemento custom */}
              <div className="border-line border-t px-2 py-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="border-line w-full rounded-control border border-dashed px-2 py-1.5 text-center text-xs text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-600"
                >
                  + Añadir elemento
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Modal de upload */}
      {showUpload && (
        <UploadItemModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            reloadApi();
          }}
        />
      )}
    </div>
  );
}
