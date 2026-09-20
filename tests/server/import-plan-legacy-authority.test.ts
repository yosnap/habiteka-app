/**
 * Importar un plano escribe con autoridad de EDITOR: sobre un proyecto legacy
 * activa el editor v2 sin tocar `canvasState`; sobre uno ya activado crea una
 * revisión nueva. Requiere Postgres de pruebas (mismo patrón que el resto de
 * tests de `server/`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
const auth = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => auth.ctx }));
import { prisma } from '@/server/db/prisma';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { importPlanToEditor } from '@/server/plan/import-plan-to-editor';
import type { PlanImportResult } from '@/lib/contracts';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let ctx: OrgContext;
let projectId: string;

function importResult(): PlanImportResult {
  const walls = [
    { id: 'n', from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thicknessMm: 200 },
    { id: 's', from: { x: 0, y: 4000 }, to: { x: 5000, y: 4000 }, thicknessMm: 200 },
    { id: 'w', from: { x: 0, y: 0 }, to: { x: 0, y: 4000 }, thicknessMm: 200 },
    { id: 'e', from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thicknessMm: 200 },
  ];
  return {
    plano: {
      schemaVersion: 1,
      zones: [{
        id: 'z0', name: 'Salón', walls, apertures: [], dimensions: [],
        outline: [{ x: 100, y: 100 }, { x: 4900, y: 100 }, { x: 4900, y: 3900 }, { x: 100, y: 3900 }],
      }],
    },
    escalaEstimada: false, writtenDimensions: [], corrections: [], exteriors: [], furniture: [], warnings: [],
  };
}

beforeEach(async () => {
  await resetDb();
  const user = await makeUser();
  ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
  auth.ctx = ctx;
  projectId = (await withOrg(ctx).projects.create({ title: 'Importación' })).id;
  await withOrg(ctx).canvas.save(projectId, { preserved: 'legacy' });
});

describe('importPlanToEditor', () => {
  it('sobre un proyecto legacy activa el editor v2 y conserva el snapshot legacy intacto', async () => {
    const { document } = await importPlanToEditor(ctx, projectId, importResult());
    expect(document.walls).toHaveLength(4);
    const loaded = await withEditorDocuments(ctx).load({ projectId });
    expect(loaded.authority).toBe('v2');
    expect((await prisma.canvasState.findFirstOrThrow({ where: { projectId } })).data).toEqual({ preserved: 'legacy' });
  });

  it('sobre un proyecto ya activado escribe una revisión nueva sobre la cabeza', async () => {
    await importPlanToEditor(ctx, projectId, importResult());
    const second = importResult();
    second.plano.zones[0]!.name = 'Comedor';
    const { document } = await importPlanToEditor(ctx, projectId, second);
    expect(document.revision).toBe(1);
    expect(document.labels[0]!.text).toBe('Comedor');
    const loaded = await withEditorDocuments(ctx).load({ projectId });
    expect(loaded.authority === 'v2' && loaded.document.revision).toBe(1);
  });

  it('rechaza una importación de otra organización', async () => {
    const other: OrgContext = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' };
    await expect(importPlanToEditor(other, projectId, importResult())).rejects.toThrow();
  });
});
