/**
 * Mi perfil › Claves de IA: cada organización añade, prueba y borra las claves de sus proveedores de IA. Las
 * generaciones usan estas claves; sin la del proveedor del modelo elegido, la función se bloquea.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { canManageAiKeys, listOrganizationAiKeys } from '@/server/settings/organization-ai-keys';
import { OrganizationAiKeysPanel } from '@/components/settings/organization-ai-keys-panel';
import { ProfileSection } from '@/components/profile/profile-section';

export const metadata = { title: 'Claves de IA — Habiteka' };

export default async function AiKeysSettingsPage() {
  const ctx = await requireOrgContext();
  const keys = await listOrganizationAiKeys(ctx);
  return (
    <ProfileSection title="Claves de IA" description="Habiteka genera con las claves de tu organización: cada uso lo cobra tu proveedor directamente en tu cuenta. Añade la del proveedor de los modelos que uses (lo ves en Modelos de IA). Las claves se guardan cifradas y nunca se vuelven a mostrar enteras.">
      <OrganizationAiKeysPanel
        keys={keys.map(({ updatedAt, ...key }) => ({ ...key, updatedAt: updatedAt?.toISOString() ?? null }))}
        canEdit={canManageAiKeys(ctx)}
      />
    </ProfileSection>
  );
}
