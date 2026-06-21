/**
 * Pantalla de un proyecto: carga el estado del canvas en el servidor y monta el
 * workspace de edición. La carga pasa por el repositorio con ámbito (aislamiento
 * por organización); el guardado se delega a una Server Action.
 */
import { loadCanvas, saveCanvas } from '@/server/actions/canvas';
import { CanvasWorkspace } from '@/components/canvas/canvas-workspace';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  // El layout del proyecto ya validó la sesión y la pertenencia; aquí solo se
  // carga el estado del canvas (la propia Server Action vuelve a acotar por org).
  const initialDoc = await loadCanvas(id);

  return (
    <main className="flex h-[calc(100vh-7rem)] flex-col gap-3 p-4">
      <div className="min-h-0 flex-1">
        <CanvasWorkspace projectId={id} initialDoc={initialDoc} saveAction={saveCanvas} />
      </div>
    </main>
  );
}
