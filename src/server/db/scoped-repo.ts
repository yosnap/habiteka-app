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
import type { SourceImageRole } from '@/generated/prisma/enums';
import { prisma } from './prisma';
import type { OrgContext } from '@/server/auth/org-context';

export interface CreateProjectInput {
  title: string;
}

export interface CreateSourceImageInput {
  key: string;
  mime: string;
  width?: number;
  height?: number;
  role?: SourceImageRole;
  faceBlurred: boolean;
}

export interface ZoneRow {
  id: string;
  name: string;
  kind: string | null;
  order: number;
}

export interface CreateZoneInput {
  name: string;
  kind?: string;
  order?: number;
}

export interface SourceImageRow {
  id: string;
  /**
   * Clave en el object storage. La URL para mostrarla se genera al servir (URL
   * presignada de vida corta): persistir la URL la dejaría caducada. Ver M1.
   */
  key: string;
  mime: string;
  width: number | null;
  height: number | null;
  role: SourceImageRole;
  createdAt: Date;
}

export interface ScopedRepo {
  projects: {
    list(): Promise<Array<{ id: string; title: string; createdAt: Date }>>;
    findById(id: string): Promise<{ id: string; title: string; createdAt: Date } | null>;
    create(input: CreateProjectInput): Promise<{ id: string; title: string; createdAt: Date }>;
    delete(id: string): Promise<void>;
  };
  canvas: {
    /** Lee el plano de un proyecto de la org (zoneId null = plano por defecto), o null. */
    load(projectId: string, zoneId?: string | null): Promise<unknown | null>;
    /** Guarda el plano (por proyecto+zona) verificando la pertenencia del proyecto. */
    save(projectId: string, data: unknown, zoneId?: string | null): Promise<void>;
  };
  deliverables: {
    /** Lista los entregables de un proyecto de la org (los más recientes primero). */
    list(
      projectId: string,
    ): Promise<
      Array<{
        id: string;
        type: string;
        payload: unknown;
        legalSeal: string;
        version: number;
        sourceImageId: string | null;
        zoneId: string | null;
      }>
    >;
  };
  sourceImages: {
    /** Crea una imagen de origen verificando la pertenencia del proyecto (anti-IDOR). */
    create(projectId: string, input: CreateSourceImageInput): Promise<{ id: string }>;
    /** Lista las imágenes de origen vivas de un proyecto de la org (recientes primero). */
    list(projectId: string): Promise<SourceImageRow[]>;
    /** Id de la imagen de origen PRIMARY más reciente de un proyecto de la org, o null. */
    latestPrimaryId(projectId: string): Promise<string | null>;
  };
  zones: {
    /** Crea una zona verificando la pertenencia del proyecto (anti-IDOR). */
    create(projectId: string, input: CreateZoneInput): Promise<ZoneRow>;
    /** Lista las zonas vivas de un proyecto de la org (por `order`, luego antigüedad). */
    list(projectId: string): Promise<ZoneRow[]>;
    /** Renombra/recoloca una zona del proyecto. No-op si no es de ese proyecto+org. */
    update(projectId: string, zoneId: string, input: Partial<CreateZoneInput>): Promise<void>;
    /** Borra (hard, dispara Cascade del plano) una zona del proyecto. No-op si ajena. */
    remove(projectId: string, zoneId: string): Promise<void>;
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
      // `zoneId` opcional: null/omitido = plano por defecto del proyecto (v1);
      // con valor = plano de esa zona. La unicidad por (proyecto, zona) la
      // garantizan índices únicos parciales en BD (ver migración).
      async load(projectId, zoneId = null) {
        // El join por organización impide leer el canvas de un proyecto ajeno.
        const row = await prisma.canvasState.findFirst({
          where: { projectId, zoneId, project: { organizationId, deletedAt: null } },
          select: { data: true },
        });
        return row?.data ?? null;
      },
      async save(projectId, data, zoneId = null) {
        // Verifica la pertenencia del proyecto antes de escribir (anti-IDOR).
        const owned = await prisma.project.findFirst({
          where: { id: projectId, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!owned) {
          throw new Error('Proyecto no encontrado en la organización');
        }
        const value = data as Prisma.InputJsonValue;
        // No se usa upsert: la unicidad de (projectId, zoneId) la dan índices
        // PARCIALES, que Prisma no expone como clave de `where` en upsert. Se hace
        // find-then-update/create; la concurrencia la cubre el índice único (un
        // segundo insert simultáneo del mismo plano fallaría a nivel de BD).
        const existing = await prisma.canvasState.findFirst({
          where: { projectId, zoneId },
          select: { id: true },
        });
        if (existing) {
          await prisma.canvasState.update({ where: { id: existing.id }, data: { data: value } });
        } else {
          await prisma.canvasState.create({ data: { projectId, zoneId, data: value } });
        }
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
          select: {
            id: true,
            type: true,
            payload: true,
            legalSeal: true,
            version: true,
            sourceImageId: true,
            zoneId: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    },

    sourceImages: {
      // Verifica la pertenencia del proyecto antes de escribir (anti-IDOR). El
      // organizationId se denormaliza en la fila para filtrar barato en el resto.
      async create(projectId, input) {
        const owned = await prisma.project.findFirst({
          where: { id: projectId, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!owned) {
          throw new Error('Proyecto no encontrado en la organización');
        }
        return prisma.sourceImage.create({
          data: {
            organizationId,
            projectId,
            key: input.key,
            mime: input.mime,
            width: input.width ?? null,
            height: input.height ?? null,
            role: input.role ?? 'PRIMARY',
            faceBlurred: input.faceBlurred,
          },
          select: { id: true },
        });
      },
      // El join por organización impide listar imágenes de un proyecto ajeno.
      list(projectId) {
        return prisma.sourceImage.findMany({
          where: {
            projectId,
            deletedAt: null,
            project: { organizationId, deletedAt: null },
          },
          select: {
            id: true,
            key: true,
            mime: true,
            width: true,
            height: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      async latestPrimaryId(projectId) {
        const row = await prisma.sourceImage.findFirst({
          where: {
            projectId,
            role: 'PRIMARY',
            deletedAt: null,
            project: { organizationId, deletedAt: null },
          },
          select: { id: true },
          // Desempate por `id` (cuid monotónico): si varias imágenes comparten el
          // mismo `createdAt` (misma petición, resolución de ms), el resultado es
          // determinista en vez de arbitrario.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return row?.id ?? null;
      },
    },

    zones: {
      // Verifica la pertenencia del proyecto antes de crear (anti-IDOR). El
      // organizationId se denormaliza en la fila para filtrar barato en el resto.
      async create(projectId, input) {
        const owned = await prisma.project.findFirst({
          where: { id: projectId, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!owned) {
          throw new Error('Proyecto no encontrado en la organización');
        }
        return prisma.projectZone.create({
          data: {
            organizationId,
            projectId,
            name: input.name,
            kind: input.kind ?? null,
            order: input.order ?? 0,
          },
          select: { id: true, name: true, kind: true, order: true },
        });
      },
      // El join por organización impide listar zonas de un proyecto ajeno.
      list(projectId) {
        return prisma.projectZone.findMany({
          where: {
            projectId,
            deletedAt: null,
            project: { organizationId, deletedAt: null },
          },
          select: { id: true, name: true, kind: true, order: true },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });
      },
      // El filtro por (proyecto, org) evita tocar zonas de otra org o de otro
      // proyecto de la misma org (integridad intra-org). No-op si no coincide.
      async update(projectId, zoneId, input) {
        await prisma.projectZone.updateMany({
          where: { id: zoneId, projectId, organizationId, deletedAt: null },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.kind !== undefined ? { kind: input.kind } : {}),
            ...(input.order !== undefined ? { order: input.order } : {}),
          },
        });
      },
      // Hard-delete real de la zona: dispara el Cascade que elimina su plano
      // (CanvasState), evitando planos huérfanos impurgables. Los diseños e imágenes
      // de la zona quedan con zoneId=null (FK SetNull): no se pierden, se "desasignan".
      // Acotado por (proyecto, org) para no tocar zonas ajenas.
      async remove(projectId, zoneId) {
        await prisma.projectZone.deleteMany({
          where: { id: zoneId, projectId, organizationId },
        });
      },
    },
  };
}
