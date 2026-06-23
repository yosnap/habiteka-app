/**
 * Pantalla de un proyecto: carga el plano (de la zona activa) en el servidor y
 * monta el workspace de edición. La carga pasa por el repositorio con ámbito
 * (aislamiento por organización); el guardado se delega a una Server Action.
 *
 * Multi-zona: el query param `?zona=<id>` selecciona la zona activa; sin él se
 * edita el plano por defecto del proyecto (idéntico a un proyecto monozona). El
 * guardado liga el `zoneId` activo para que el autosave escriba en el plano correcto.
 */
import { loadCanvas, saveCanvas } from '@/server/actions/canvas';
import {
  generateDesignFromCanvas,
  recommendDecoration,
  detectPlanFromPhoto,
} from './_actions/agent-actions';
import { listZones } from './_actions/zone-actions';
import { CanvasWorkspace } from '@/components/canvas/canvas-workspace';
import { ZoneSwitcher } from '@/components/canvas/zone-switcher';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zona?: string }>;
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona } = await searchParams;

  // El layout del proyecto ya validó la sesión y la pertenencia. Se listan las
  // zonas (acotadas por org) y se resuelve la zona activa: solo vale un `zona` que
  // exista en el proyecto; cualquier otro valor cae al plano por defecto (null).
  const zones = await listZones(id);
  const activeZoneId = zona && zones.some((z) => z.id === zona) ? zona : null;

  const initialDoc = await loadCanvas(id, activeZoneId);

  // Guardado ligado a la zona activa: el workspace llama save(projectId, payload)
  // sin conocer la zona; este wrapper le añade el zoneId resuelto en servidor.
  async function saveCanvasForZone(projectId: string, payload: unknown) {
    'use server';
    await saveCanvas(projectId, payload, activeZoneId);
  }

  return (
    <main className="flex h-[calc(100vh-7rem)] flex-col gap-3 p-4">
      <ZoneSwitcher projectId={id} zones={zones} activeZoneId={activeZoneId} />
      <div className="min-h-0 flex-1">
        {/* `key` por zona: fuerza re-montar el workspace al cambiar de zona para que
            su store cargue el plano de la zona activa (si no, React reusa la
            instancia y conserva el plano anterior). */}
        <CanvasWorkspace
          key={activeZoneId ?? 'default'}
          projectId={id}
          activeZoneId={activeZoneId}
          initialDoc={initialDoc}
          saveAction={saveCanvasForZone}
          generateAction={generateDesignFromCanvas}
          recommendAction={recommendDecoration}
          detectAction={detectPlanFromPhoto}
        />
      </div>
    </main>
  );
}
