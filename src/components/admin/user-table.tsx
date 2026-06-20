/**
 * Tabla de usuarios del back-office. Presenta la página actual de resultados con
 * su estado; las acciones por usuario viven en su detalle. Es solo presentación.
 */
import Link from 'next/link';
import { RoleBadge } from './role-badge';
import type { UserRow } from '@/server/admin/users/user-operations';

export function UserTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">No hay usuarios que coincidan.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground text-left">
        <tr>
          <th className="py-2">Nombre</th>
          <th className="py-2">Email</th>
          <th className="py-2">Estado</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-line border-t">
            <td className="py-2">
              <Link href={`/users/${u.id}`} className="text-brand-700 hover:underline">
                {u.name}
              </Link>
            </td>
            <td className="py-2">{u.email}</td>
            <td className="py-2">
              <RoleBadge role={u.role} banned={u.banned} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
