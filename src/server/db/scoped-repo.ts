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
  deliverables: {
    /** Lista los entregables de un proyecto de la org (los más recientes primero). */
    list(
      projectId: string,
    ): Promise<
      Array<{ id: string; type: string; payload: unknown; legalSeal: string; version: number }>
    >;
  };
}

export function withOrg(ctx: OrgContext): ScopedRepo {
  const { organizationId } = ctx;

  return {
    projects: {
      list() {
        // Solo proyectos vivos: el soft-delete (`deletedAt`) los oculta de las
        // vistas normales sin borrarlos (papelera/retención).
        return prisma.project.findMany({
          where: { organizationId, deletedAt: null },
          select: { id: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
      },
      // El id del cliente nunca basta: la consulta siempre acota por la org del
      // contexto, así que un id ajeno simplemente no encuentra nada.
      findById(id) {
        return prisma.project.findFirst({
          where: { id, organizationId, deletedAt: null },
          select: { id: true, title: true, createdAt: true },
        });
      },
      create(input) {
        return prisma.project.create({
          data: { title: input.title, organizationId },
          select: { id: true, title: true, createdAt: true },
        });
      },
      // Borrado de usuario = SOFT-delete (marca `deletedAt`), no hard-delete. El
      // borrado real (RGPD art. 17 / purga por TTL) lo hace el deletion-service.
      // `updateMany` con el filtro de org evita tocar recursos de otra org.
      async delete(id) {
        await prisma.project.updateMany({
          where: { id, organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      },
    },

    canvas: {
      async load(projectId) {
        // El join por organización impide leer el canvas de un proyecto ajeno.
        const row = await prisma.canvasState.findFirst({
          where: { projectId, project: { organizationId, deletedAt: null } },
          select: { data: true },
        });
        return row?.data ?? null;
      },
      async save(projectId, data) {
        // Verifica la pertenencia del proyecto antes de escribir (anti-IDOR).
        const owned = await prisma.project.findFirst({
          where: { id: projectId, organizationId, deletedAt: null },
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

    deliverables: {
      async list(projectId) {
        // El join por organización impide listar entregables de un proyecto ajeno.
        return prisma.deliverable.findMany({
          where: {
            projectId,
            deletedAt: null,
            project: { organizationId, deletedAt: null },
          },
          select: { id: true, type: true, payload: true, legalSeal: true, version: true },
          orderBy: { createdAt: 'desc' },
        });
      },
    },
  };
}
