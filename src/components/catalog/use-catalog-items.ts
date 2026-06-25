'use client';

/**
 * Hook que obtiene los items custom/store de la org desde GET /api/catalog.
 * Soporta recarga manual (tras un upload exitoso) y filtrado por categoría.
 *
 * El hook encapsula el side-effect de fetch (no debe usarse useEffect directamente
 * en los componentes; aquí se centraliza correctamente en un custom hook).
 */
import { useEffect, useRef, useState } from 'react';

export interface ApiCatalogItem {
  id: string;
  kind: string;
  label: string;
  source: 'custom' | 'store';
  category: string;
  family?: string;
  thumbnailUrl: string | null;
  widthM: number;
  depthM: number;
  heightM: number;
  tags: string[];
}

interface State {
  items: ApiCatalogItem[];
  loading: boolean;
  error: string | null;
}

export function useCatalogItems(category?: string) {
  const [state, setState] = useState<State>({ items: [], loading: false, error: null });
  // Contador que fuerza una recarga cuando se incrementa.
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState((s) => ({ ...s, loading: true, error: null }));

    const url = new URL('/api/catalog', window.location.origin);
    if (category) url.searchParams.set('category', category);

    fetch(url.toString(), { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar el catálogo.');
        return res.json() as Promise<{ items: ApiCatalogItem[] }>;
      })
      .then(({ items }) => {
        if (!ctrl.signal.aborted) {
          setState({ items, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Error desconocido',
          }));
        }
      });

    return () => ctrl.abort();
    // revision se incluye para forzar recarga tras un upload exitoso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, revision]);

  const reload = () => setRevision((r) => r + 1);

  return { ...state, reload };
}
