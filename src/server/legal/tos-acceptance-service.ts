/**
 * Aceptación de los Términos de Servicio / EULA.
 *
 * La aceptación es la CONDICIÓN CONTRACTUAL para generar entregables: sin una
 * aceptación registrada de la versión vigente, la generación se bloquea. Se
 * guarda append-only (versión + timestamp) para demostrar qué aceptó cada usuario.
 *
 * La versión vigente se compara de forma exacta: si se publica una nueva versión
 * del ToS, una aceptación anterior no basta y se debe volver a aceptar.
 */
import { prisma } from '@/server/db/prisma';

/** Versión vigente de los Términos. Subir al publicar un ToS nuevo. */
export const CURRENT_TOS_VERSION = '2026-06';

/** Registra que el usuario aceptó la versión indicada de los Términos. */
export async function acceptTos(
  userId: string,
  version: string = CURRENT_TOS_VERSION,
): Promise<void> {
  await prisma.tosAcceptance.create({ data: { userId, version } });
}

/** true si el usuario tiene aceptada la versión vigente de los Términos. */
export async function hasAcceptedCurrentTos(userId: string): Promise<boolean> {
  const accepted = await prisma.tosAcceptance.findFirst({
    where: { userId, version: CURRENT_TOS_VERSION },
    select: { id: true },
  });
  return accepted !== null;
}

export class TosNotAcceptedError extends Error {
  constructor() {
    super('Debes aceptar los Términos de Servicio vigentes antes de generar');
    this.name = 'TosNotAcceptedError';
  }
}

/**
 * Gate previo a la generación: lanza si el usuario no ha aceptado el ToS vigente.
 * El orquestador del agente lo invoca antes de producir cualquier entregable.
 */
export async function assertTosAccepted(userId: string): Promise<void> {
  if (!(await hasAcceptedCurrentTos(userId))) {
    throw new TosNotAcceptedError();
  }
}
