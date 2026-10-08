'use client';
import { useCallback, type ReactNode } from 'react';
import styles from './visibility-menu.module.css';

interface HeaderMenuProps { icon: ReactNode; label: string; ariaLabel: string; role?: 'dialog' | 'menu'; children: ReactNode }

/**
 * Menú desplegable de la cabecera (Vista, Seleccionar). Es un `details` nativo con dos añadidos:
 * se cierra al hacer clic fuera y con Escape. Los oyentes viven mientras el elemento está montado.
 */
export function HeaderMenu({ icon, label, ariaLabel, role = 'dialog', children }: HeaderMenuProps) {
  const attach = useCallback((node: HTMLDetailsElement | null) => {
    if (!node) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-radix-popper-content-wrapper]')) return;
      if (node.open && !node.contains(event.target as Node)) node.removeAttribute('open');
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && node.open) { node.removeAttribute('open'); node.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, []);
  return <details ref={attach} className={styles.menu}>
    <summary aria-label={ariaLabel}>{icon}<span>{label}</span></summary>
    <div className={styles.popover} role={role} aria-label={ariaLabel}>{children}</div>
  </details>;
}
