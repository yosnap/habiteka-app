'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Coloca controles de la página junto al flotante común sin duplicar navegación. */
const hostSnapshot = () => document.querySelector<HTMLElement>('[data-project-floating-tools]');
const serverSnapshot = () => null;
function subscribeHost(notify: () => void) {
  let previous = hostSnapshot();
  const observer = new MutationObserver(() => {
    const current = hostSnapshot();
    if (current !== previous) { previous = current; notify(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
export function ProjectFloatingTools({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribeHost, hostSnapshot, serverSnapshot);
  return host ? createPortal(children, host) : null;
}
