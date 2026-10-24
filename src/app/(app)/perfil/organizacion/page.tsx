/** Mi perfil › Organización: nombre y miembros de la organización activa. */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { getOrganizationDetails } from '@/server/settings/profile-ops';
import { ProfileSection } from '@/components/profile/profile-section';
import { OrganizationForm } from '@/components/profile/organization-form';

export const metadata = { title: 'Organización — Habiteka' };

export default async function OrganizationPage() {
  const details = await getOrganizationDetails(await requireOrgContext());
  return (
    <ProfileSection title="Organización" description="Los proyectos, las claves de IA y los modelos son de la organización: los comparten todos sus miembros.">
      <OrganizationForm name={details.name} canEdit={details.canEdit} members={details.members} />
    </ProfileSection>
  );
}
