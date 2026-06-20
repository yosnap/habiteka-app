/**
 * Scoping estructural por organización (anti-IDOR por construcción).
 *
 * `withOrg(ctx)` es la ÚNICA puerta a las queries de recursos de negocio: cada
 * método inyecta `ctx.organizationId` en el `where`, de modo que es imposible
 * —no solo desaconsejado— leer o mutar un recurso de otra organización. No
 * existe un método que omita el contexto, así que el aislamiento no depende de
 * que quien programa recuerde filtrar.
 */
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './prisma';
import type { OrgContext } from '@/server/auth/org-context';

export interface CreateProjectInput {
  title: string;
}

export interface ScopedRepo {
  projects: {
    list(): Promise<Array<{ id: string; title: string; createdAt: Date }>>;
    findById(id: string): Promise<{ id: string; title: string; createdAt: Date } | null>;
    create(input: CreateProjectInput): Promise<{ id: string; title: string; createdAt: Date }>;
    delete(id: string): Promise<void>;
  };
  canvas: {
    /** Lee el estado del canvas de un proyecto de la org, o null. */
    load(projectId: string): Promise<unknown | null>;
    /** Guarda el estado del canvas (upsert) verificando la pertenencia del proyecto. */
    save(projectId: string, data: unknown): Promise<void>;
  };
}

export function withOrg(ctx: OrgContext): ScopedRepo {
  const { organizationId } = ctx;

  return {
    projects: {
      list() {
        return prisma.project.findMany({
          where: { organizationId },
          select: { id: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
      },
      // El id del cliente nunca basta: la consulta siempre acota por la org del
      // contexto, así que un id ajeno simplemente no encuentra nada.
      findById(id) {
        return prisma.project.findFirst({
          where: { id, organizationId },
          select: { id: true, title: true, createdAt: true },
        });
      },
      create(input) {
        return prisma.project.create({
          data: { title: input.title, organizationId },
          select: { id: true, title: true, createdAt: true },
        });
      },
      async delete(id) {
        // `deleteMany` con el filtro de org evita borrar recursos de otra org:
        // si el id no pertenece a la organización, no afecta a ninguna fila.
        await prisma.project.deleteMany({ where: { id, organizationId } });
      },
    },

    canvas: {
      async load(projectId) {
        // El join por organización impide leer el canvas de un proyecto ajeno.
        const row = await prisma.canvasState.findFirst({
          where: { projectId, project: { organizationId } },
          select: { data: true },
        });
        return row?.data ?? null;
      },
      async save(projectId, data) {
        // Verifica la pertenencia del proyecto antes de escribir (anti-IDOR).
        const owned = await prisma.project.findFirst({
          where: { id: projectId, organizationId },
          select: { id: true },
        });
        if (!owned) {
          throw new Error('Proyecto no encontrado en la organización');
        }
        const value = data as Prisma.InputJsonValue;
        await prisma.canvasState.upsert({
          where: { projectId },
          create: { projectId, data: value },
          update: { data: value },
        });
      },
    },
  };
}
