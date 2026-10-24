'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Reserva espacio para el recorrido fuera de los controles flotantes. */
export function WorkspaceRouteControls({
  enabled,
  anchor,
  children,
}: {
  enabled: boolean;
  anchor: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      setHost(
        anchor.current
          ?.closest('[data-workspace-body]')
          ?.parentElement?.querySelector('[data-workspace-route-dock]') ?? null,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, anchor]);
  if (!enabled) return children;
  return host ? createPortal(children, host) : null;
}
