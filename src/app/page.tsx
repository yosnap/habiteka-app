import { headers } from 'next/headers';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { LandingHeader } from '@/components/landing/landing-header';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works';
import { LandingFooter } from '@/components/landing/landing-footer';
import { DevNavPanel } from '@/components/landing/dev-nav-panel';

const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as { id?: string; name?: string; role?: string | null } | undefined;

  // El panel de desarrollo se muestra con sesión activa o con el dev-login
  // habilitado; en producción sin sesión, solo la landing.
  const showDevPanel = Boolean(user) || devLoginEnabled;

  // Enlace directo al canvas: primer proyecto de la organización del usuario.
  let canvasProjectId: string | null = null;
  if (user?.id) {
    const member = await prisma.member.findFirst({ where: { userId: user.id } });
    if (member) {
      const project = await prisma.project.findFirst({
        where: { organizationId: member.organizationId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      canvasProjectId = project?.id ?? null;
    }
  }

  return (
    <>
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingHowItWorks />
        {showDevPanel ? (
          <DevNavPanel
            userName={user?.name}
            isAdmin={user?.role === 'admin'}
            canvasProjectId={canvasProjectId}
          />
        ) : null}
      </main>
      <LandingFooter />
    </>
  );
}
