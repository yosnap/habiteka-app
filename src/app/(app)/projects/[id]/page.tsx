/**
 * Pantalla de un proyecto: carga el plano (de la zona activa) en el servidor y
 * monta el workspace de edición. La carga pasa por el repositorio con ámbito
 * (aislamiento por organización); el guardado se delega a una Server Action.
 *
 * Multi-zona: el query param `?zona=<id>` selecciona la zona activa; sin él se
 * edita el plano por defecto del proyecto (idéntico a un proyecto monozona). El
 * guardado liga el `zoneId` activo para que el autosave escriba en el plano correcto.
 */
import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zona?: string }>;
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona } = await searchParams;
  const query = zona ? `?zona=${encodeURIComponent(zona)}` : '';
  redirect(`/projects/${id}/plano${query}`);
}
