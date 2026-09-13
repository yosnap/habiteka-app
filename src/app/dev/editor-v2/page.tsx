import { notFound } from 'next/navigation';
import { EditorPreview } from './preview-client';

/** Vista de trabajo aislada: no accede ni modifica proyectos privados. */
export default function EditorPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <EditorPreview />;
}
