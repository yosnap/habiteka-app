import { notFound } from 'next/navigation';
import { EditorPreview } from './preview-client';

/** Vista de trabajo aislada: no accede ni modifica proyectos privados. */
export default async function EditorPreviewPage({ searchParams }: { searchParams: Promise<{ muestra?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const requested = (await searchParams).muestra;
  const sample = requested === 'visual' || requested === 'plantas' || requested === 'obra' ? requested : null;
  return <EditorPreview key={sample ?? 'empty'} sample={sample} />;
}
