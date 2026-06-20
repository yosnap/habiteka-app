/**
 * Registro y consulta de consentimiento (RGPD art. 7).
 *
 * El consentimiento es append-only: cada acción (otorgar/revocar) añade una fila
 * con la versión de política y el timestamp, de modo que se puede demostrar QUÉ
 * se consintió y CUÁNDO (prueba de consentimiento, art. 7.1). El estado actual de
 * un propósito es la fila más reciente para ese (usuario, propósito).
 */
import { prisma } from '@/server/db/prisma';
import type { ConsentPurpose } from '@/generated/prisma/client';

export interface RecordConsentInput {
  userId: string;
  organizationId: string;
  purpose: ConsentPurpose;
  policyVersion: string;
  granted: boolean;
}

/** Añade un registro de consentimiento (otorgado o revocado). */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  await prisma.consentRecord.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      purpose: input.purpose,
      policyVersion: input.policyVersion,
      granted: input.granted,
    },
  });
}

/**
 * Indica si un propósito está consentido AHORA por el usuario: mira la fila más
 * reciente y devuelve su `granted`. Sin registros → no consentido.
 */
export async function hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
  const latest = await prisma.consentRecord.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: 'desc' },
    select: { granted: true },
  });
  return latest?.granted ?? false;
}

/**
 * Lanza si el propósito no está consentido. Pensado para invocarse ANTES de
 * tratar el dato (p. ej. subir/enviar una imagen a la IA).
 */
export async function assertConsent(userId: string, purpose: ConsentPurpose): Promise<void> {
  if (!(await hasConsent(userId, purpose))) {
    throw new ConsentRequiredError(purpose);
  }
}

export class ConsentRequiredError extends Error {
  constructor(public readonly purpose: ConsentPurpose) {
    super(`Falta el consentimiento para: ${purpose}`);
    this.name = 'ConsentRequiredError';
  }
}
