/**
 * Listado de usuarios del back-office. Lee la página y el filtro de la URL y
 * obtiene solo esa página (paginación server-side). El acceso ya lo validó el
 * layout; la acción de listado lo revalida.
 */
import { adminListUsers } from '@/server/admin/users/actions';
import { UserTable } from '@/components/admin/user-table';

interface Props {
  searchParams: Promise<{ page?: string; search?: string; banned?: string }>;
}

const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const { users, total } = await adminListUsers({
    page,
    pageSize: PAGE_SIZE,
    search: params.search,
    banned: params.banned === 'true' ? true : params.banned === 'false' ? false : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Usuarios ({total})</h1>
      <UserTable users={users} />
      <p className="text-muted-foreground text-xs">
        Página {page} de {totalPages}
      </p>
    </section>
  );
}
