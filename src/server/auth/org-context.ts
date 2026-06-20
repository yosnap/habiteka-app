/**
 * Contexto de organización: la unidad de tenancy resuelta desde la sesión.
 *
 * Todo acceso a recursos de negocio se hace en nombre de una organización (la
 * personal es una organización implícita de un miembro). El `OrgContext` lleva
 * además el rol del miembro para los chequeos de permisos.
 */

export type MemberRole = 'owner' | 'admin' | 'member';

export interface OrgContext {
  organizationId: string;
  userId: string;
  role: MemberRole;
}
