import { notFound } from 'next/navigation';
import { EditorPreview } from './preview-client';

/** Vista de trabajo aislada: no accede ni modifica proyectos privados. */
export default async function EditorPreviewPage({ searchParams }: { searchParams: Promise<{ muestra?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EditorPreview visualSample={(await searchParams).muestra === 'visual'} />;
}
