import { ProjectEditorPage } from '@/components/editor-v2/session/project-editor-page';

export default async function VideosPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ zona?: string }>;
}) {
  const { id } = await params, { zona } = await searchParams;
  return <ProjectEditorPage projectId={id} zoneId={zona} openVideoStudio />;
}
