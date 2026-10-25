/** Mi perfil › Resumen: el estado de la cuenta y de la organización de un vistazo, con los pasos pendientes. */
import Link from 'next/link';
import { Activity, ArrowRight, Building2, CheckCircle2, CircleAlert, Coins, Cpu, FolderOpen, KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { getProfileSummary } from '@/server/settings/profile-ops';
import { Card } from '@/components/ui/card';
import { ProfileSection } from '@/components/profile/profile-section';

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' });
const usd = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function Stat({ icon, label, value, detail, href }: { icon: ReactNode; label: string; value: ReactNode; detail?: ReactNode; href?: string }) {
  const body = (
    <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-brand-500/40">
      <span className="text-ink-soft flex items-center gap-2 text-xs font-medium uppercase tracking-wide">{icon}{label}</span>
      <span className="text-ink text-2xl font-semibold tracking-tight">{value}</span>
      {detail ? <span className="text-ink-soft text-xs">{detail}</span> : null}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Step({ done, title, detail, href, action }: { done: boolean; title: string; detail: string; href: string; action: string }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {done ? <CheckCircle2 size={20} className="text-brand-700 shrink-0" aria-label="Hecho" /> : <CircleAlert size={20} className="shrink-0 text-[--color-danger]" aria-label="Pendiente" />}
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-medium">{title}</p>
        <p className="text-ink-soft text-xs">{detail}</p>
      </div>
      <Link href={href} className="text-brand-700 inline-flex items-center gap-1 text-sm font-medium hover:underline">{action}<ArrowRight size={14} aria-hidden /></Link>
    </li>
  );
}

export default async function ProfileSummaryPage() {
  const summary = await getProfileSummary(await requireOrgContext());
  const { keys, models, usage } = summary;
  return (
    <ProfileSection title="Resumen" description={`Cuenta creada el ${dateFormat.format(new Date(summary.user.createdAt))}. Organización: ${summary.organization.name} (${summary.organization.role}).`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<KeyRound size={14} aria-hidden />} label="Claves de IA" value={`${keys.configured} de ${keys.total}`}
          detail={keys.providers.length ? keys.providers.join(', ') : 'Todavía sin claves'} href="/perfil/claves-ia" />
        <Stat icon={<Cpu size={14} aria-hidden />} label="Modelos elegidos" value={`${models.customized} de ${models.total}`}
          detail={models.customized === models.total ? 'Todos los usos personalizados' : 'El resto usa los recomendados'} href="/perfil/modelos" />
        <Stat icon={<Activity size={14} aria-hidden />} label="Uso de IA · 30 días" value={usage.calls}
          detail={`${usd.format(usage.costUsd)} estimados en tus proveedores${usage.failed ? ` · ${usage.failed} con error` : ''}`} href="/perfil/uso" />
        <Stat icon={<FolderOpen size={14} aria-hidden />} label="Proyectos" value={summary.projects} detail="De tu organización" href="/proyectos" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <h3 className="text-ink text-base font-semibold">Para generar con IA</h3>
          <ol className="divide-line divide-y">
            <Step done={keys.configured > 0} title="Añade la clave de al menos un proveedor"
              detail="Sin claves propias no se puede generar. Cada uso lo cobra tu proveedor." href="/perfil/claves-ia" action="Claves de IA" />
            <Step done={models.customized > 0} title="Revisa qué modelo usa cada función"
              detail="Puedes quedarte con los recomendados o elegir los tuyos, con indicaciones para cada uso." href="/perfil/modelos" action="Modelos de IA" />
          </ol>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-base font-semibold">Tu organización</h3>
          <p className="text-ink-soft flex items-center gap-2 text-sm"><Building2 size={16} aria-hidden />{summary.organization.name}</p>
          <p className="text-ink-soft text-sm">{summary.organization.members} {summary.organization.members === 1 ? 'miembro' : 'miembros'} · tu rol: {summary.organization.role}</p>
          <p className="text-ink-soft flex items-center gap-2 text-sm"><Coins size={16} aria-hidden />{summary.credits} créditos</p>
          <Link href="/perfil/organizacion" className="text-brand-700 mt-auto inline-flex items-center gap-1 text-sm font-medium hover:underline">Ver organización<ArrowRight size={14} aria-hidden /></Link>
        </Card>
      </div>
    </ProfileSection>
  );
}
