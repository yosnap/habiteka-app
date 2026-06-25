/**
 * Guardia de acceso al back-office.
 *
 * Verifica en el SERVIDOR que la sesión pertenece a un usuario con rol de
 * plataforma `admin` antes de dejar pasar. Se invoca en el layout del panel y se
 * revalida en cada acción administrativa (defensa en profundidad): ocultar un
 * enlace en el cliente no es una barrera, así que el control vive aquí.
 */
import { headers } from 'next/headers';
import { auth } from '@/server/auth/auth';

export class ForbiddenAdminError extends Error {
  constructor() {
    super('Acceso restringido al panel de administración');
    this.name = 'ForbiddenAdminError';
  }
}

export interface AdminActor {
  userId: string;
  email: string;
}

/** Devuelve el actor admin si la sesión lo es; lanza `ForbiddenAdminError` si no. */
export async function requireAdmin(): Promise<AdminActor> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as { id: string; email: string; role?: string | null } | undefined;
  if (!user || user.role !== 'admin') {
    throw new ForbiddenAdminError();
  }
  return { userId: user.id, email: user.email };
}

/** Verdadero si un rol corresponde al administrador de plataforma. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin';
}
