/**
 * Distintivo del estado de un usuario: su rol de plataforma y si está suspendido.
 * Usa color e icono además del texto para no depender solo del color (accesible).
 */
interface Props {
  role: string | null;
  banned: boolean | null;
}

export function RoleBadge({ role, banned }: Props) {
  if (banned) {
    return (
      <span className="rounded bg-[--color-danger] px-2 py-0.5 text-xs text-white">Suspendido</span>
    );
  }
  if (role === 'admin') {
    return <span className="bg-brand-500 rounded px-2 py-0.5 text-xs text-white">Admin</span>;
  }
  return <span className="bg-surface-muted text-ink rounded px-2 py-0.5 text-xs">Usuario</span>;
}
