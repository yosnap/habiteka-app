/**
 * Lectura del registro de auditoría y de las creaciones de los usuarios (solo
 * lectura). Para la auditoría de contenido se exponen metadatos (tipo, fecha,
 * propietario), no el contenido en sí, alineado con la minimización de datos.
 */
import { prisma } from '@/server/db/prisma';

export interface AuditQuery {
  page: number;
  pageSize: number;
  actorId?: string;
  action?: string;
}

/** Lista entradas de auditoría paginadas, con filtro opcional por actor/acción. */
export async function listAuditLog(query: AuditQuery) {
  const where = {
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, (query.page - 1) * query.pageSize),
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { entries, total };
}

export interface UserCreationsSummary {
  projects: number;
  deliverables: number;
  iterations: number;
}

/** Recuento de lo que ha creado una organización (metadatos, no contenido). */
export async function userCreations(organizationId: string): Promise<UserCreationsSummary> {
  const [projects, deliverables, iterations] = await Promise.all([
    prisma.project.count({ where: { organizationId } }),
    prisma.deliverable.count({ where: { project: { organizationId } } }),
    prisma.iteration.count({ where: { deliverable: { project: { organizationId } } } }),
  ]);
  return { projects, deliverables, iterations };
}
