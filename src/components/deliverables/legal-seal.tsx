/**
 * Sello legal visible (refuerzo en el DOM). No es ocultable por props ni por el
 * usuario. El sello que sobrevive a la exportación de imagen/PDF se dibuja dentro
 * del lienzo o se aplica en el servidor; este es la garantía visual en pantalla.
 */
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';

export function LegalSeal() {
  return (
    <p
      className="text-muted-foreground bg-surface/80 pointer-events-none absolute right-2 bottom-2 z-10 rounded px-2 py-1 text-xs"
      role="note"
    >
      {DELIVERABLE_LEGAL_SEAL}
    </p>
  );
}
