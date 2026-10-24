'use client';

/**
 * Navegación lateral del back-office, agrupada por área y con la sección activa marcada. El acceso real lo controla
 * el guardia server-side, no la presencia o ausencia de un enlace.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Cpu, Gauge, Image as ImageIcon, Package, Receipt, Settings, Users } from 'lucide-react';

const GROUPS = [
  { title: 'Personas', items: [{ href: '/users', label: 'Usuarios', icon: Users }] },
  { title: 'Inteligencia artificial', items: [
    { href: '/config', label: 'Proveedores y modelos', icon: Cpu },
    { href: '/analytics/ai-costs', label: 'Costes IA', icon: Receipt },
    { href: '/analytics/quality', label: 'Eficacia IA', icon: Gauge },
  ] },
  { title: 'Plataforma', items: [
    { href: '/config/system', label: 'Ajustes de sistema', icon: Settings },
    { href: '/config/products', label: 'Productos', icon: Package },
    { href: '/media', label: 'Media', icon: ImageIcon },
    { href: '/analytics', label: 'Analítica', icon: BarChart3 },
  ] },
] as const;

// «/config» también es la entrada de «/config/models»; el resto marca solo su propia ruta y sus hijas.
function isActive(pathname: string, href: string): boolean {
  if (href === '/config') return pathname === '/config' || pathname.startsWith('/config/models');
  if (href === '/analytics') return pathname === '/analytics';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de administración" className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="text-ink-soft px-3 text-[11px] font-semibold uppercase tracking-wider">{group.title}</p>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors ${active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-soft hover:bg-muted hover:text-ink'}`}>
                <Icon size={16} aria-hidden />{label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
