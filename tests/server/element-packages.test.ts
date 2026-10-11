import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { makeUser } from '../helpers/db';
import { TEST_DATABASE_MARKER_SQL, verifyTestDatabaseMarker } from '@/server/db/test-database-guard';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { extractElementPackage } from '@/lib/editor-document/element-packages';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';

const session = vi.hoisted(() => ({ userId: '', organizationId: 'project-org-one', authenticated: true }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => {
  if (!session.authenticated) throw new Error('No autenticado');
  return { userId: session.userId, organizationId: session.organizationId, role: 'member' };
} }));
import { deleteElementPackage, listElementPackages, saveElementPackage } from '@/server/actions/element-packages';

let owner = '', stranger = '';
beforeAll(async () => {
  await verifyTestDatabaseMarker(process.env.DATABASE_URL, () => prisma.$queryRawUnsafe(TEST_DATABASE_MARKER_SQL));
  owner = (await makeUser()).id; stranger = (await makeUser()).id;
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, stranger].filter(Boolean) } } }); });

describe('biblioteca personal persistida en PostgreSQL', () => {
  it('comparte paquetes entre proyectos del titular y aísla otras cuentas, también al borrar', async () => {
    session.userId = owner;
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }]);
    const pack = await saveElementPackage('Entrada reutilizable', extractElementPackage(doc, [doc.walls[0]!.id]));
    expect((await listElementPackages()).map(item => item.id)).toContain(pack.id);
    session.organizationId = 'another-project-org';
    expect((await listElementPackages()).map(item => item.id)).toContain(pack.id);
    session.userId = stranger;
    expect((await listElementPackages()).map(item => item.id)).not.toContain(pack.id);
    await expect(deleteElementPackage(pack.id)).rejects.toThrow('no está disponible');
    session.userId = owner;
    const persisted = (await listElementPackages()).find(item => item.id === pack.id)!;
    expect(persisted.document).toEqual(pack.document);
    await deleteElementPackage(pack.id);
    expect((await listElementPackages()).map(item => item.id)).not.toContain(pack.id);
  });
  it('rechaza peticiones sin sesión y documentos de proyecto completos', async () => {
    session.userId = owner;
    await expect(saveElementPackage('', emptyEditorDocument())).rejects.toThrow('nombre');
    await expect(saveElementPackage('Vacío', emptyEditorDocument())).rejects.toThrow('entre 1 y 300');
    session.authenticated = false;
    await expect(listElementPackages()).rejects.toThrow('No autenticado');
    await expect(deleteElementPackage('id-ajeno')).rejects.toThrow('No autenticado');
    session.authenticated = true;
  });
});
