/** Mi perfil › Datos personales. */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { ProfileSection } from '@/components/profile/profile-section';
import { PersonalDetailsForm } from '@/components/profile/personal-details-form';

export const metadata = { title: 'Datos personales — Habiteka' };

export default async function PersonalDetailsPage() {
  const ctx = await requireOrgContext();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true, email: true } });
  return (
    <ProfileSection title="Datos personales" description="Tu nombre aparece en los proyectos y en la organización. Al cambiar la contraseña se cierran tus otras sesiones abiertas.">
      <PersonalDetailsForm name={user.name} email={user.email} />
    </ProfileSection>
  );
}
