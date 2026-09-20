import { ProjectEditorPage } from '@/components/editor-v2/session/project-editor-page';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zona?: string }>;
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona } = await searchParams;
  return <ProjectEditorPage projectId={id} zoneId={zona} />;
}
