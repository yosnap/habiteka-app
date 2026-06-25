/**
 * Registro de auditoría de acciones administrativas.
 *
 * Toda acción destructiva del back-office (suspender, cambiar rol, revocar
 * sesiones) deja una traza fiable: quién la hizo, sobre qué, cuándo. La tabla es
 * append-only a nivel de base de datos (un trigger rechaza UPDATE/DELETE), de modo
 * que la traza no es falsificable ni siquiera desde el propio servidor.
 */
import { prisma } from '@/server/db/prisma';
import type { Prisma } from '@/generated/prisma/client';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Prisma.InputJsonValue;
}

/** Escribe una entrada de auditoría. No puede modificarse ni borrarse después. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      meta: entry.meta,
    },
  });
}
