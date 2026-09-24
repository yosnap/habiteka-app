'use client';
import { useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import styles from './editor.module.css';

/**
 * Elementos fuera del panel que no cuentan como «clic fuera»: los desplegables
 * de Radix viven en un portal al final del body, y el botón de la cabecera que
 * abre el panel ya lo conmuta él mismo.
 */
const KEEP_OPEN = '[data-radix-popper-content-wrapper], [data-side-panel-toggle], [aria-modal="true"]';

/** Un diálogo modal abierto (p. ej. «Diseñar con IA») manda sobre el panel de fondo. */
const modalOpen = () => Boolean(document.querySelector('[aria-modal="true"]'));
/** Esc dentro de un campo de texto es de ese campo (renombrar, buscar…), no del panel. */
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName));

/**
 * Ranura lateral única del editor: alberga Propiedades, Catálogo, Recorrido,
 * Contexto IA y Techo y luces, uno a la vez. Se cierra con la X, con Escape y
 * al pulsar fuera, salvo mientras se dibuja con una herramienta distinta de
 * «Seleccionar» (una tira LED o una zona), donde cada clic va al plano.
 */
export function EditorSidePanel({ store, title, children }: {
  store: EditorStore; title: string; children: ReactNode;
}) {
  const attach = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || node.contains(target)) return;
      const element = target instanceof Element ? target : target.parentElement;
      if (element?.closest(KEEP_OPEN)) return;
      if (store.getState().tool !== 'select') return;
      store.getState().closeSidePanel();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || modalOpen() || isEditable(event.target)) return;
      store.getState().closeSidePanel();
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [store]);
  return <div ref={attach} className={styles.sidebar} data-open="true" role="dialog" aria-label={title}>
    <header className={styles.sidePanelHeader}>
      <h2>{title}</h2>
      <button type="button" onClick={() => store.getState().closeSidePanel()} aria-label={`Cerrar ${title.toLowerCase()}`}>
        <X size={18} aria-hidden="true" />
      </button>
    </header>
    <div className={styles.sidePanelBody}>{children}</div>
  </div>;
}
