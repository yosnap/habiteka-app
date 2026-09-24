'use client';
import { useState, type ReactNode } from 'react';

/**
 * Confirmación en línea de dos pasos para acciones que pierden trabajo, en
 * lugar del `confirm()` del navegador: el primer clic pregunta en el propio
 * sitio y el segundo ejecuta. Esc o «No» vuelven al estado inicial.
 */
export function InlineConfirmButton({ label, question, confirmLabel = 'Sí', cancelLabel = 'No', className, cancelClassName, disabled, ariaLabel, title, onConfirm }: {
  /** Contenido del botón en reposo. */
  label: ReactNode;
  /** Pregunta que se muestra al pedir confirmación. */
  question: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  /** Clase del botón «No»; por defecto sin estilo propio, para no teñirlo de peligro. */
  cancelClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return <button type="button" className={className} disabled={disabled} aria-label={ariaLabel} title={title}
      onClick={() => setAsking(true)}>{label}</button>;
  return <span role="group" aria-label={question} className="inline-flex flex-wrap items-center gap-1"
    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setAsking(false); } }}>
    <span role="status">{question}</span>
    <button type="button" autoFocus className={className} disabled={disabled}
      onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</button>
    <button type="button" className={cancelClassName} onClick={() => setAsking(false)}>{cancelLabel}</button>
  </span>;
}

export default InlineConfirmButton;
