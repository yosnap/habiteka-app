'use client';

/**
 * Aviso al apartarse del diseño aprobado. Un empujón de 1 cm con las flechas dejaba sin validez, sin decir nada, la
 * aprobación y las imágenes aceptadas con ella: los interiores y los vídeos se bloqueaban horas después.
 */
export function ApprovalDriftNotice({ onUndo, onApprove, onDismiss, disabled }: {
  onUndo?: () => void;
  onApprove?: () => void;
  onDismiss: () => void;
  disabled: boolean;
}) {
  const button = 'rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50';
  return <section role="status" aria-label="Cambio sobre el diseño aprobado"
    className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
    <p className="min-w-0 flex-1">El plano ya no coincide con el diseño aprobado. Las imágenes aceptadas con él dejan de servir
      para nuevos interiores y vídeos hasta que deshagas el cambio, o lo apruebes y vuelvas a generarlas.</p>
    {onUndo && <button type="button" className={button} disabled={disabled} onClick={onUndo}>Deshacer</button>}
    {onApprove && <button type="button" className={button} disabled={disabled} onClick={onApprove}>Aprobar cambios</button>}
    <button type="button" className={button} onClick={onDismiss}>Mantener el cambio</button>
  </section>;
}
