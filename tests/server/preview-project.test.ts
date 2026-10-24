import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { createPreviewProject } from '@/server/editor/preview-project-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import type { OrgContext } from '@/server/auth/org-context';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let ctx: OrgContext;
beforeEach(async () => {
  await resetDb();
  ctx = { userId: (await makeUser()).id, organizationId: await makeOrg(), role: 'owner' };
});

it('guarda la muestra modificada como proyecto editable y no duplica reintentos', async () => {
  const document = visualSampleDocument();
  document.furniture[0]!.x += 100;
  document.revision = 9;
  const input = { title: 'Mi vivienda', document, requestKey: randomUUID() };
  const first = await createPreviewProject(ctx, input);
  expect(await createPreviewProject(ctx, input)).toEqual(first);
  expect(await prisma.project.count()).toBe(1);
  const loaded = await withEditorDocuments(ctx).load({ projectId: first.id });
  expect(loaded).toMatchObject({ authority: 'v2', writable: true, document: { ...document, revision: 0 } });
  expect(await prisma.editorDesignApproval.count()).toBe(0);
});

it('rechaza documentos inválidos sin crear proyectos incompletos', async () => {
  await expect(createPreviewProject(ctx, { title: 'Inválido', document: {}, requestKey: randomUUID() })).rejects.toThrow();
  expect(await prisma.project.count()).toBe(0);
});

it('no permite recuperar por clave un proyecto de otra organización ni cambiar la primera revisión', async () => {
  const input = { title: 'Mi vivienda', document: visualSampleDocument(), requestKey: randomUUID() };
  const project = await createPreviewProject(ctx, input);
  await expect(createPreviewProject({ ...ctx, organizationId: await makeOrg() }, input)).rejects.toThrow();
  input.document.furniture[0]!.x += 100;
  await expect(createPreviewProject(ctx, input)).rejects.toThrow(/contenido/);
  expect(await prisma.editorDocumentRevision.count()).toBe(1);
  expect(await prisma.project.count({ where: { id: project.id, organizationId: ctx.organizationId } })).toBe(1);
});
