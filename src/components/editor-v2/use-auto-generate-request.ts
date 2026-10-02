'use client';

import { useEffect, useRef } from 'react';
import type { AutoGenerateRequest } from './auto-generate-request';

/** Atiende nuevas peticiones de navegación sin reiniciar el editor al revalidar. */
export function useAutoGenerateRequest(
  request: AutoGenerateRequest | null | undefined,
  onRequest: (request: AutoGenerateRequest) => void,
  clearUrl = false,
) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!request) { handled.current = null; return; }
    const key = JSON.stringify(request);
    if (handled.current === key) return;
    handled.current = key;
    onRequest(request);
    if (clearUrl) {
      const url = new URL(window.location.href);
      for (const param of ['generar', 'estilo', 'continuarTanda']) url.searchParams.delete(param);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }, [request, onRequest, clearUrl]);
}
