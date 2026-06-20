/**
 * Detalle de un usuario con sus acciones administrativas. Carga el usuario tras
 * revalidar el rol admin y muestra su estado y los controles de gestión.
 */
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin/guard';
import { prisma } from '@/server/db/prisma';
import { RoleBadge } from '@/components/admin/role-badge';
import { UserActions } from '@/components/admin/user-actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true },
  });
  if (!user) notFound();

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{user.name}</h1>
        <RoleBadge role={user.role} banned={user.banned} />
      </div>
      <dl className="text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Email:</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Alta:</dt>
          <dd>{user.createdAt.toISOString().slice(0, 10)}</dd>
        </div>
      </dl>
      <UserActions userId={user.id} banned={user.banned ?? false} role={user.role} />
    </section>
  );
}
