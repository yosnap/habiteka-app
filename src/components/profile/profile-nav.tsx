'use client';

/** Navegación de «Mi perfil»: columna en escritorio y fila desplazable en el móvil, con la sección activa marcada. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Cpu, KeyRound, LayoutDashboard, Shield, UserRound } from 'lucide-react';

const SECTIONS = [
  { href: '/perfil', label: 'Resumen', icon: LayoutDashboard },
  { href: '/perfil/datos', label: 'Datos personales', icon: UserRound },
  { href: '/perfil/organizacion', label: 'Organización', icon: Building2 },
  { href: '/perfil/claves-ia', label: 'Claves de IA', icon: KeyRound },
  { href: '/perfil/modelos', label: 'Modelos de IA', icon: Cpu },
] as const;

export function ProfileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const item = 'flex shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors';
  return (
    <nav aria-label="Secciones de Mi perfil" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`${item} ${active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-soft hover:bg-muted hover:text-ink'}`}>
            <Icon size={16} aria-hidden />{label}
          </Link>
        );
      })}
      {isAdmin ? (
        <Link href="/config" className={`${item} text-ink-soft hover:bg-muted hover:text-ink lg:mt-3 lg:border-t lg:border-line lg:pt-3`}>
          <Shield size={16} aria-hidden />Administración
        </Link>
      ) : null}
    </nav>
  );
}
