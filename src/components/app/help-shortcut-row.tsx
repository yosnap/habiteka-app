/**
 * Fila "tecla(s) → acción" y la tecla en sí, reutilizadas por la página de ayuda.
 * Sin lógica: solo presentación, con los tokens de marca de Habiteka.
 */
import type { ReactNode } from 'react';

/** Una tecla o combinación de teclas dibujada como capuchón de teclado. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-line bg-surface-muted text-ink rounded-control border border-b-2 px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

interface RowProps {
  /** Una o varias teclas (con `Plus` entre ellas si se pulsan a la vez). */
  keys: ReactNode;
  label: string;
  note?: string;
}

/** Fila de una tabla de atajos: teclas a la izquierda, acción a la derecha. */
export function ShortcutRow({ keys, label, note }: RowProps) {
  return (
    <div className="border-line flex items-baseline gap-3 border-t py-1.5 first:border-t-0 first:pt-0">
      <span className="flex w-24 shrink-0 flex-wrap items-center gap-1">{keys}</span>
      <span className="text-ink text-sm">
        {label}
        {note ? <span className="text-ink-soft"> ({note})</span> : null}
      </span>
    </div>
  );
}

/** Separador "+" entre teclas de una misma combinación. */
export function Plus() {
  return <span className="text-ink-soft text-xs">+</span>;
}
