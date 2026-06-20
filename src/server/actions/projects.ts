'use server';

/**
 * Server Actions base de proyecto.
 *
 * Cada acción resuelve primero el contexto de organización (que exige sesión) y
 * accede a los datos únicamente a través del repositorio con ámbito: el
 * aislamiento entre organizaciones no depende de recordar filtrar, está en la
 * única puerta de acceso.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { requireRole } from '@/server/auth/permissions';

export async function listProjects() {
  const ctx = await requireOrgContext();
  return withOrg(ctx).projects.list();
}

export async function createProject(title: string) {
  const ctx = await requireOrgContext();
  // Crear proyectos requiere al menos rol de miembro de la organización.
  requireRole(ctx, 'member');
  return withOrg(ctx).projects.create({ title });
}

export async function deleteProject(id: string) {
  const ctx = await requireOrgContext();
  requireRole(ctx, 'admin');
  await withOrg(ctx).projects.delete(id);
}
