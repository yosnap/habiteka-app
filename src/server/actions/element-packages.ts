'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { packageCategory, validatePackageDocument, type ElementPackage } from '@/lib/editor-document/element-packages';

export async function listElementPackages(): Promise<ElementPackage[]> {
  const { userId } = await requireOrgContext();
  const rows = await prisma.elementPackage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return rows.map(row => ({ id: row.id, name: row.name, category: packageCategory(row.document as unknown as ElementPackage['document']),
    document: row.document as unknown as ElementPackage['document'] }));
}

export async function saveElementPackage(name: string, value: unknown): Promise<ElementPackage> {
  const { userId } = await requireOrgContext();
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
  const document = validatePackageDocument(value), category = packageCategory(document);
  const row = await prisma.elementPackage.create({ data: { userId, name: name.trim(), category,
    document: document as unknown as Prisma.InputJsonValue } });
  return { id: row.id, name: row.name, category, document };
}

export async function deleteElementPackage(id: string): Promise<void> {
  const { userId } = await requireOrgContext();
  if (typeof id !== 'string' || !id || id.length > 200) throw new Error('Paquete inválido.');
  const result = await prisma.elementPackage.deleteMany({ where: { id, userId } });
  if (!result.count) throw new Error('El paquete ya no está disponible en tu cuenta.');
}
