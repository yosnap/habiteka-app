'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';

/** Panel junto al punto de selección, contenido dentro de la ventana incluso al desplegar texturas. */
export function AnchoredEditorPanel({ store, label, children, className }: { store: EditorStore; label: string; children: ReactNode; className?: string }) {
  const anchor = useStore(store, (state) => state.detailAnchor), panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = panel.current; if (!node) return;
    const place = () => {
      const { width, height } = node.getBoundingClientRect();
      const point = anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const x = point.x + 24 + width <= window.innerWidth - 12 ? point.x + 24 : point.x - width - 24;
      node.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, x))}px`;
      node.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, point.y - Math.min(90, height / 3)))}px`;
    };
    place(); const observer = new ResizeObserver(place); observer.observe(node);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [anchor]);
  return <section ref={panel} role="dialog" aria-label={label} className={className}
    style={{ position: 'fixed', right: 'auto', bottom: 'auto', left: 12, top: 12, width: 'min(320px, calc(100vw - 24px))', maxHeight: 'min(65vh, calc(100vh - 24px))', overflow: 'auto',
      background: 'white', padding: 20, borderRadius: 16, boxShadow: '0 8px 32px #0003', zIndex: 40 }}>
    {children}
  </section>;
}
