import { ProjectEditorPage } from '@/components/editor-v2/session/project-editor-page';

export default async function EditorPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ zona?: string; aprobado?: string }>;
}) {
  const { id } = await params, { zona, aprobado } = await searchParams;
  return <ProjectEditorPage projectId={id} zoneId={zona} approvedId={aprobado} />;
}
