'use client';

/**
 * Botones de acción sobre un usuario (suspender/reactivar, cambiar rol, forzar
 * logout). Disparan las Server Actions, que revalidan el rol admin y auditan. Las
 * acciones destructivas piden confirmación antes de ejecutarse.
 */
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  adminBanUser,
  adminUnbanUser,
  adminSetRole,
  adminRevokeSessions,
} from '@/server/admin/users/actions';

interface Props {
  userId: string;
  banned: boolean;
  role: string | null;
}

export function UserActions({ userId, banned, role }: Props) {
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    start(async () => {
      await fn();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {banned ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => adminUnbanUser(userId))}>
          Reactivar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => adminBanUser(userId), '¿Suspender a este usuario?')}
        >
          Suspender
        </Button>
      )}

      {role === 'admin' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => adminSetRole(userId, 'user'), '¿Retirar el rol admin?')}
        >
          Quitar admin
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => adminSetRole(userId, 'admin'), '¿Conceder rol admin?')}
        >
          Hacer admin
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => adminRevokeSessions(userId), '¿Cerrar todas sus sesiones?')}
      >
        Forzar logout
      </Button>
    </div>
  );
}
