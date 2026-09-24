'use client';

/**
 * Botones de acción sobre un usuario (suspender/reactivar, cambiar rol, forzar
 * logout). Disparan las Server Actions, que revalidan el rol admin y auditan. Las
 * acciones destructivas piden confirmación antes de ejecutarse.
 */
import { useState, useTransition } from 'react';
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
  // Acción destructiva a la espera de confirmación en línea (sin diálogos del navegador).
  const [asking, setAsking] = useState<{ question: string; fn: () => Promise<void> } | null>(null);

  const execute = (fn: () => Promise<void>) => start(async () => { await fn(); });
  const run = (fn: () => Promise<void>, confirmMsg?: string) => {
    if (confirmMsg) setAsking({ question: confirmMsg, fn });
    else execute(fn);
  };

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={asking.question}
        onKeyDown={(event) => { if (event.key === 'Escape') setAsking(null); }}>
        <span className="text-sm" role="status">{asking.question}</span>
        <Button size="sm" variant="destructive" autoFocus disabled={pending}
          onClick={() => { const { fn } = asking; setAsking(null); execute(fn); }}>
          Sí, continuar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAsking(null)}>Cancelar</Button>
      </div>
    );
  }

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
