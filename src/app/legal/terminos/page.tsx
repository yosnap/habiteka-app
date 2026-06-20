/**
 * Página pública de los Términos de Servicio. Lee el documento legal versionado
 * (`docs/legal/tos/terms-of-service.md`) en el servidor y lo muestra como texto
 * preformateado, sin añadir un renderer de Markdown (el documento es estable y la
 * legibilidad simple basta). La fuente de verdad es el fichero versionado.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const metadata = {
  title: 'Términos de Servicio — Habiteka',
};

export default async function TerminosPage() {
  const path = join(process.cwd(), 'docs', 'legal', 'tos', 'terms-of-service.md');
  const text = await readFile(path, 'utf8');

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <article className="text-ink text-sm leading-relaxed whitespace-pre-wrap">{text}</article>
    </main>
  );
}
