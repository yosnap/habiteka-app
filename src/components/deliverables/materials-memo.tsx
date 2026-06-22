/**
 * Memoria de materiales: texto estructurado del entregable. Se renderiza como
 * texto plano (preservando saltos de línea) y NUNCA como HTML crudo, para evitar
 * inyección a partir del contenido generado por el modelo.
 */
import { LegalSeal } from './legal-seal';

export function MaterialsMemo({ markdown }: { markdown: string }) {
  return (
    <div className="bg-surface relative rounded-card border border-[--color-line] p-4">
      <pre className="text-ink font-sans text-sm whitespace-pre-wrap">{markdown}</pre>
      <LegalSeal />
    </div>
  );
}
