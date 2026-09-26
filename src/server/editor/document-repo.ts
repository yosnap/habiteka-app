import { Prisma } from '@/generated/prisma/client';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { assertEditorScope, type EditorScope } from './authority';
import { assertRevision, documentFingerprint, readDocumentInput } from './document-input';
import { approvedAssets, approvedAssetsMatch, type ApprovedAsset, type ApprovedDesign, type ApprovedDesignSummary, type ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { designApprovalIssues } from './design-approval';

export type EditorLoadResult =
  | { authority: 'legacy'; legacySnapshot: unknown; legacyFingerprint: string }
  | { authority: 'v2'; document: EditorDocument; writable: boolean };
export interface ActivateDocumentInput {
  document: unknown;
  expectedLegacyFingerprint: string;
  confirmed: true;
}
export interface SaveDocumentInput {
  document: unknown;
  expectedRevision: number;
  requestKey: string;
}
export interface SaveDocumentResult {
  status: 'saved' | 'conflict';
  document: EditorDocument;
}
export interface EditorRevisionSummary {
  revision: number;
  createdAt: string;
  furniture: number;
  walls: number;
}

async function readRevision(tx: Prisma.TransactionClient, stateId: string, revision: number) {
  const row = await tx.editorDocumentRevision.findUnique({
    where: { stateId_revision: { stateId, revision } },
  });
  if (!row) throw new Error('Revisión no encontrada');
  return parseEditorDocument(row.document);
}

function approvedFromRecord(row: {
  id: string; stateId: string; fingerprint: string; assets: Prisma.JsonValue; approvedAt: Date;
  approvedById: string; lightingPreset: string; revision: { stateId: string; revision: number; document: Prisma.JsonValue };
}): ApprovedDesign {
  if (row.stateId !== row.revision.stateId) throw new Error('La revisión aprobada no pertenece a este plano.');
  if (!Array.isArray(row.assets) || !['daylight', 'warm', 'evening'].includes(row.lightingPreset))
    throw new Error('Aprobación incompleta');
  const document = parseEditorDocument(row.revision.document);
  const assets = row.assets as unknown as ApprovedAsset[];
  if (documentFingerprint(document) !== row.fingerprint || !approvedAssetsMatch(document, assets))
    throw new Error('El diseño aprobado ya no coincide con su documento o sus modelos 3D.');
  return { id: row.id, revision: row.revision.revision, document, assets,
    fingerprint: row.fingerprint, approvedAt: row.approvedAt.toISOString(), approvedById: row.approvedById,
    lightingPreset: row.lightingPreset as ApprovedLightingPreset };
}

export function withEditorDocuments(ctx: OrgContext) {
  return {
    async listRevisions(input: EditorScope, offset = 0, limit = 25): Promise<{
      headRevision: number | null; total: number; revisions: EditorRevisionSummary[];
    }> {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
        throw new Error('Página de revisiones inválida');
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope, select: { id: true, headRevision: true } });
        if (!state) return { headRevision: null, total: 0, revisions: [] };
        const [total, rows] = await Promise.all([
          tx.editorDocumentRevision.count({ where: { stateId: state.id } }),
          tx.editorDocumentRevision.findMany({
            where: { stateId: state.id }, orderBy: { revision: 'desc' }, skip: offset, take: limit,
            select: { revision: true, createdAt: true, document: true },
          }),
        ]);
        return { headRevision: state.headRevision, total, revisions: rows.map((row) => {
          const document = parseEditorDocument(row.document);
          const levels = buildingDocuments(document);
          return { revision: row.revision, createdAt: row.createdAt.toISOString(),
            furniture: levels.reduce((count, level) => count + level.document.furniture.length, 0),
            walls: levels.reduce((count, level) => count + level.document.walls.length, 0) };
        }) };
      });
    },
    async listApprovals(input: EditorScope): Promise<ApprovedDesignSummary[]> {
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope, select: { id: true } });
        if (!state) return [];
        const rows = await tx.editorDesignApproval.findMany({
          where: { stateId: state.id },
          select: { id: true, approvedAt: true, lightingPreset: true, revision: { select: { revision: true, stateId: true } } },
          orderBy: { revision: { revision: 'desc' } },
        });
        return rows.map((row) => {
          if (row.revision.stateId !== state.id || !['daylight', 'warm', 'evening'].includes(row.lightingPreset))
            throw new Error('Aprobación incompleta');
          return { id: row.id, revision: row.revision.revision, approvedAt: row.approvedAt.toISOString(),
            lightingPreset: row.lightingPreset as ApprovedLightingPreset };
        });
      });
    },
    async latestApproval(input: EditorScope): Promise<ApprovedDesign | null> {
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope, select: { id: true } });
        if (!state) return null;
        const approved = await tx.editorDesignApproval.findFirst({
          where: { stateId: state.id }, include: { revision: true },
          orderBy: { revision: { revision: 'desc' } },
        });
        return approved ? approvedFromRecord(approved) : null;
      });
    },
    async readApproval(input: EditorScope, approvalId: string): Promise<ApprovedDesign> {
      if (typeof approvalId !== 'string' || !approvalId.trim() || approvalId.length > 128)
        throw new Error('Diseño aprobado no encontrado');
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope, select: { id: true } });
        if (!state) throw new Error('Diseño aprobado no encontrado');
        const approved = await tx.editorDesignApproval.findFirst({
          where: { id: approvalId, stateId: state.id }, include: { revision: true },
        });
        if (!approved) throw new Error('Diseño aprobado no encontrado');
        return approvedFromRecord(approved);
      });
    },
    async approve(input: EditorScope, expectedRevision: number, lightingPreset: ApprovedLightingPreset): Promise<ApprovedDesign> {
      assertRevision(expectedRevision);
      if (!['daylight', 'warm', 'evening'].includes(lightingPreset)) throw new Error('Iluminación inválida');
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input, { lock: true });
        const state = await tx.editorDocumentState.findFirst({ where: scope });
        if (!state?.writable) throw new Error('El editor no permite aprobar este plano');
        if (state.headRevision !== expectedRevision) throw new Error('El plano cambió. Sincroniza y revisa antes de aprobar.');
        const revision = await tx.editorDocumentRevision.findUnique({
          where: { stateId_revision: { stateId: state.id, revision: expectedRevision } },
        });
        if (!revision) throw new Error('Revisión no encontrada');
        const document = parseEditorDocument(revision.document);
        const issues = designApprovalIssues(document);
        if (issues.length) throw new Error(`No se puede aprobar el diseño: ${issues.join(' ')}`);
        const existing = await tx.editorDesignApproval.findUnique({
          where: { revisionId: revision.id }, include: { revision: true },
        });
        if (existing) {
          if (existing.lightingPreset !== lightingPreset)
            throw new Error('Esta revisión ya está aprobada con otra iluminación. Guarda una nueva revisión para cambiarla.');
          return approvedFromRecord(existing);
        }
        const approved = await tx.editorDesignApproval.create({
          data: { stateId: state.id, revisionId: revision.id, approvedById: ctx.userId,
            fingerprint: documentFingerprint(document), lightingPreset,
            assets: approvedAssets(document) as unknown as Prisma.InputJsonValue },
          include: { revision: true },
        });
        return approvedFromRecord(approved);
      });
    },
    async load(input: EditorScope): Promise<EditorLoadResult> {
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope });
        if (state)
          return {
            authority: 'v2',
            writable: state.writable,
            document: await readRevision(tx, state.id, state.headRevision),
          };
        const legacy = await tx.canvasState.findFirst({ where: scope, select: { data: true } });
        const legacySnapshot = legacy?.data ?? null;
        return {
          authority: 'legacy',
          legacySnapshot,
          legacyFingerprint: documentFingerprint(legacySnapshot),
        };
      });
    },
    async activate(input: EditorScope, request: ActivateDocumentInput): Promise<EditorLoadResult> {
      if (
        !request ||
        request.confirmed !== true ||
        typeof request.expectedLegacyFingerprint !== 'string'
      )
        throw new Error('Activación requiere confirmación explícita');
      const document = readDocumentInput(request.document);
      document.revision = 0;
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input, { lock: true });
        if (await tx.editorDocumentState.findFirst({ where: scope }))
          throw new Error('Editor v2 ya activado');
        const legacy = await tx.canvasState.findFirst({ where: scope, select: { data: true } });
        const snapshot = legacy?.data ?? null;
        const fingerprint = documentFingerprint(snapshot);
        if (fingerprint !== request.expectedLegacyFingerprint)
          throw new Error('El plano legacy cambió; revisa de nuevo la conversión');
        const state = await tx.editorDocumentState.create({
          data: {
            ...scope,
            legacySnapshot: snapshot === null ? Prisma.JsonNull : snapshot,
            legacyFingerprint: fingerprint,
          },
        });
        await tx.editorDocumentRevision.create({
          data: {
            stateId: state.id,
            revision: 0,
            document: document as unknown as Prisma.InputJsonValue,
            fingerprint: documentFingerprint(document),
          },
        });
        return { authority: 'v2', document, writable: true };
      });
    },
    async save(input: EditorScope, request: SaveDocumentInput): Promise<SaveDocumentResult> {
      if (!request) throw new Error('Petición de guardado inválida');
      assertRevision(request.expectedRevision);
      if (
        typeof request.requestKey !== 'string' ||
        !request.requestKey.trim() ||
        request.requestKey.length > 128
      )
        throw new Error('Clave de guardado inválida');
      const document = readDocumentInput(request.document);
      if (document.revision !== request.expectedRevision)
        throw new Error('Revisión del documento no coincide');
      const fingerprint = documentFingerprint({
        document,
        expectedRevision: request.expectedRevision,
      });
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input, { lock: true });
        const state = await tx.editorDocumentState.findFirst({ where: scope });
        if (!state) throw new Error('Activa el editor v2 explícitamente antes de guardar');
        const replay = await tx.editorDocumentRevision.findUnique({
          where: { stateId_requestKey: { stateId: state.id, requestKey: request.requestKey } },
        });
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new Error('La clave de guardado ya pertenece a otro contenido');
          return { status: 'saved', document: parseEditorDocument(replay.document) };
        }
        if (!state.writable) throw new Error('Editor v2 en modo solo lectura');
        const updated = await tx.editorDocumentState.updateMany({
          where: { id: state.id, headRevision: request.expectedRevision, writable: true },
          data: { headRevision: { increment: 1 } },
        });
        if (!updated.count)
          return {
            status: 'conflict',
            document: await readRevision(tx, state.id, state.headRevision),
          };
        document.revision = request.expectedRevision + 1;
        await tx.editorDocumentRevision.create({
          data: {
            stateId: state.id,
            revision: document.revision,
            document: document as unknown as Prisma.InputJsonValue,
            requestKey: request.requestKey,
            fingerprint,
          },
        });
        return { status: 'saved', document };
      });
    },
    async readRevision(input: EditorScope, revision: number) {
      assertRevision(revision);
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({ where: scope });
        if (!state) throw new Error('Editor v2 no activado');
        return readRevision(tx, state.id, revision);
      });
    },
    async readLegacySnapshot(input: EditorScope) {
      return prisma.$transaction(async (tx) => {
        const scope = await assertEditorScope(tx, ctx, input);
        const state = await tx.editorDocumentState.findFirst({
          where: scope,
          select: { legacySnapshot: true },
        });
        if (!state) throw new Error('Editor v2 no activado');
        return state.legacySnapshot;
      });
    },
  };
}
