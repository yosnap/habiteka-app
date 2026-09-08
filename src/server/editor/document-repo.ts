import { Prisma } from '@/generated/prisma/client';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { assertEditorScope, type EditorScope } from './authority';
import { assertRevision, documentFingerprint, readDocumentInput } from './document-input';

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

async function readRevision(tx: Prisma.TransactionClient, stateId: string, revision: number) {
  const row = await tx.editorDocumentRevision.findUnique({
    where: { stateId_revision: { stateId, revision } },
  });
  if (!row) throw new Error('Revisión no encontrada');
  return parseEditorDocument(row.document);
}

export function withEditorDocuments(ctx: OrgContext) {
  return {
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
