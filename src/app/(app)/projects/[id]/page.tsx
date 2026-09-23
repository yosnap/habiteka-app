import { ProjectEditorPage } from '@/components/editor-v2/session/project-editor-page';
import { parseAutoGenerate } from '@/components/editor-v2/auto-generate-request';

interface Props {
  params: Promise<{ id: string }>;
  /** `generar`/`estilo` los pone el asistente al terminar la ruta del plano. */
  searchParams: Promise<{ zona?: string; generar?: string; estilo?: string }>;
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona, generar, estilo } = await searchParams;
  return (
    <ProjectEditorPage
      projectId={id}
      zoneId={zona}
      autoGenerate={parseAutoGenerate({ generar, estilo })}
    />
  );
}
